import argon2 from 'argon2';
import { generateToken, verifyToken } from '../../utils/paseto.util.js';
import { pool } from '../../db/pool.js';
import logger from '../../utils/logger.js';
import { getActiveRolesForUser } from '../roles/roles.repository.js';
import { withTransaction } from '../../db/transaction.js';

const formatError = (code, message, details = []) => ({
  error: { code, message, details },
});

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Email and password are required'));
    }

    // Fetch user from database
    const { rows } = await pool.query(
      'SELECT id, full_name, institute_email, password_hash, is_active FROM users WHERE institute_email = $1',
      [email]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid credentials'));
    }

    let isMatch = false;
    try {
      isMatch = await argon2.verify(user.password_hash, password);
    } catch {
      isMatch = false;
    }
    if (!isMatch) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid credentials'));
    }
    const roles = await getActiveRolesForUser(user.id);

    const userPayload = { sub: user.id, email: user.institute_email };

    const token = await generateToken(userPayload, process.env.ACCESS_TOKEN_EXPIRY || '15m');
    const refresh_token = await generateToken({ ...userPayload, type: 'refresh' }, process.env.REFRESH_TOKEN_EXPIRY || '7d');

    // Store refresh token in database
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    return res.status(200).json({
      token,
      refresh_token,
      user: { id: user.id, full_name: user.full_name, institute_email: user.institute_email, roles },
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Login error');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'An unexpected error occurred'));
  }
};

export const refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Refresh token is required'));
    }

    // Verify the PASETO token structure
    const payload = await verifyToken(refresh_token);
    if (payload.type !== 'refresh') {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid refresh token'));
    }

    // Hash the refresh token to look it up
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    // Check if token exists in database and is valid
    const { rows } = await pool.query(
      `SELECT user_id FROM refresh_tokens 
       WHERE token_hash = $1 
         AND expires_at > NOW() 
         AND revoked_at IS NULL`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid or expired refresh token'));
    }

    const userId = rows[0].user_id;

    // Check if user is still active
    const { rows: userRows } = await pool.query(
      'SELECT id, institute_email, is_active FROM users WHERE id = $1',
      [userId]
    );

    const user = userRows[0];
    if (!user || !user.is_active) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'User account is inactive'));
    }

    // Generate new tokens
    const userPayload = { sub: user.id, email: user.institute_email };
    const newAccessToken = await generateToken(userPayload, process.env.ACCESS_TOKEN_EXPIRY || '15m');
    const newRefreshToken = await generateToken(
      { ...userPayload, type: 'refresh' }, 
      process.env.REFRESH_TOKEN_EXPIRY || '7d'
    );

    // Rotate refresh token: revoke old, store new
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Revoke old token
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      // Store new token
      await client.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, newTokenHash, expiresAt]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.status(200).json({ 
      token: newAccessToken,
      refresh_token: newRefreshToken 
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Refresh token error');
    return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid or expired refresh token'));
  }
};

export const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    // If refresh_token is provided, revoke it
    if (refresh_token) {
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
        [tokenHash]
      );
    }

    // Client should discard the access token
    return res.status(204).send();
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Logout error');
    // Still return 204 even on error - logout should be forgiving
    return res.status(204).send();
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Email is required'));
    }

    // Always return success to prevent email enumeration
    // Check if user exists
    const { rows } = await pool.query(
      'SELECT id, is_active FROM users WHERE institute_email = $1',
      [email.toLowerCase()]
    );

    const user = rows[0];

    // Only send reset email if user exists and is active
    if (user && user.is_active) {
      // Generate a cryptographically secure reset token
      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Token expires in 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Store token hash in database
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      // In production, send email with reset link containing resetToken
      // For development, log the token
      (req.log || logger).info({ email }, 'Password reset token generated');
      (req.log || logger).debug(
        { email, resetToken },
        'Password reset token (development debug)'
      );
      
      // TODO: Integrate email service
      // await sendEmail({
      //   to: email,
      //   subject: 'Password Reset Request',
      //   body: `Reset your password: http://yourapp.com/reset-password?token=${resetToken}`
      // });
    }

    // Always return the same response (prevent email enumeration)
    return res.status(200).json({ 
      message: 'If the email exists, a reset link has been sent.' 
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Forgot password error');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'An unexpected error occurred'));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Token and new password are required'));
    }

    if (password.length < 8) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Password must be at least 8 characters'));
    }

    // Hash the token to compare with stored hash
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid, unused token
    const { rows } = await pool.query(
      `SELECT user_id FROM password_reset_tokens 
       WHERE token_hash = $1 
         AND expires_at > NOW() 
         AND used_at IS NULL`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json(formatError('UNAUTHORIZED', 'Invalid or expired reset token'));
    }

    const userId = rows[0].user_id;

    // Hash new password
    const hashedPassword = await argon2.hash(password);

    // Update password and mark token as used in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );

      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      // Optional: Revoke all refresh tokens for this user
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.status(204).send();
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Reset password error');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'An unexpected error occurred'));
  }
};

export const register = async (req, res) => {
  try {
    const { full_name, institute_email, roll_no, phone, programme, password } = req.body;

    if (!full_name || !institute_email || !roll_no || !password) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Full name, email, roll number, and password are required'));
    }

    if (full_name.length > 255) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Full name exceeds maximum length of 255 characters'));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(institute_email)) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Invalid email format'));
    }

    if (password.length < 8) {
      return res.status(422).json(formatError('VALIDATION_ERROR', 'Password must be at least 8 characters'));
    }

    // Check if user already exists
    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM users WHERE institute_email = $1 OR roll_no = $2',
      [institute_email.toLowerCase(), roll_no]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json(formatError('CONFLICT', 'User with this email or roll number already exists'));
    }

    // Hash password and create user
    const hashedPassword = await argon2.hash(password);
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (full_name, institute_email, roll_no, phone, programme, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, full_name, institute_email, roll_no, phone, programme, admission_year, is_active, created_at, updated_at`,
        [full_name, institute_email.toLowerCase(), roll_no, phone || null, programme || null, hashedPassword]
      );
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'borrower')",
        [rows[0].id]
      );
      return rows[0];
    });

    // Generate tokens
    const userPayload = { sub: user.id, email: user.institute_email };
    const token = await generateToken(userPayload, process.env.ACCESS_TOKEN_EXPIRY || '15m');
    const refresh_token = await generateToken({ ...userPayload, type: 'refresh' }, process.env.REFRESH_TOKEN_EXPIRY || '7d');

    // Store refresh token in database
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    return res.status(201).json({
      token,
      refresh_token,
      user: {
        id: user.id,
        full_name: user.full_name,
        institute_email: user.institute_email,
        roles: await getActiveRolesForUser(user.id),
      },
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Registration error');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'An unexpected error occurred'));
  }
};
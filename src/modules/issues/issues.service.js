// src/modules/issues/issues.service.js
import * as issuesRepository from './issues.repository.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../shared/app-error.js';
import { logIssueAction } from '../../shared/audit.service.js';

// Calculate due date based on category defaults or asset override
async function calculateDueDate(assetId, client = pool) {
  const { rows } = await client.query(
    `SELECT 
      COALESCE(a.loan_days_override, c.default_loan_days) as loan_days
     FROM assets a
     JOIN categories c ON a.category_id = c.id
     WHERE a.id = $1`,
    [assetId]
  );

  if (!rows[0]) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }

  const loanDays = rows[0].loan_days;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + loanDays);
  return dueDate;
}

// Check if asset is available for borrowing (with optional row locking)
async function checkAssetAvailability(assetId, requestedQuantity, client = pool, lock = false) {
  const lockClause = lock ? 'FOR UPDATE OF a' : '';
  const { rows: assetRows } = await client.query(
    `SELECT
      a.id,
      a.quantity AS total_quantity,
      a.tracking,
      a.is_issuable,
      a.status,
      a.condition
     FROM assets a
     WHERE a.id = $1
     ${lockClause}`,
    [assetId]
  );

  if (!assetRows[0]) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }

  const { rows: quantityRows } = await client.query(
    `SELECT COALESCE(SUM(quantity) FILTER (WHERE status IN ('requested', 'active', 'dropped')), 0)::int AS issued_quantity
     FROM issues
     WHERE asset_id = $1`,
    [assetId]
  );

  const asset = { ...assetRows[0], issued_quantity: quantityRows[0].issued_quantity };

  if (!asset.is_issuable) {
    throw new AppError('NOT_ISSUABLE', 'This asset is not available for borrowing', 409);
  }

  if (asset.status !== 'available') {
    throw new AppError('NOT_AVAILABLE', `Asset status is ${asset.status}`, 409);
  }

  const availableQuantity = asset.total_quantity - asset.issued_quantity;

  if (requestedQuantity > availableQuantity) {
    throw new AppError('INSUFFICIENT_QUANTITY', 
      `Only ${availableQuantity} unit(s) available, requested ${requestedQuantity}`, 409);
  }

  return asset;
}

export async function createIssue(issueData, actorId) {
  return withTransaction(async (client) => {
    const borrowerId = issueData.borrower_id || actorId;

    // Check borrower blocks
    const { rows: blockRows } = await client.query(
      `SELECT * FROM borrower_blocks 
       WHERE user_id = $1 
         AND is_active = true
         AND (blocked_until IS NULL OR blocked_until > NOW())
       LIMIT 1`,
      [borrowerId]
    );

    if (blockRows[0]) {
      throw new AppError('BORROWER_BLOCKED', 
        `Borrower is blocked: ${blockRows[0].reason}. ${blockRows[0].blocked_until ? `Until ${blockRows[0].blocked_until}` : 'Indefinitely'}`, 403);
    }

    // Check and lock asset availability
    await checkAssetAvailability(issueData.asset_id, issueData.quantity, client, true);

    // Calculate due date
    const dueDate = await calculateDueDate(issueData.asset_id, client);

    // Create issue
    const { rows } = await client.query(
      `INSERT INTO issues (
        asset_id, quantity, borrower_id, on_behalf_of_org, purpose, 
        status, requested_at, due_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *`,
      [
        issueData.asset_id,
        issueData.quantity,
        borrowerId,
        issueData.on_behalf_of_org || null,
        issueData.purpose || null,
        'requested',
        dueDate,
      ]
    );

    const issue = rows[0];

    // Log audit entry
    await logIssueAction('create_request', issue.id, actorId, {
      asset_id: issue.asset_id,
      quantity: issue.quantity,
      borrower_id: borrowerId,
      due_at: dueDate,
    }, client);

    return issuesRepository.getIssueById(issue.id);
  });
}

export async function listIssues({ limit, offset, filters }) {
  return issuesRepository.listIssues({ limit, offset, filters });
}

export async function getIssueById(id) {
  const issue = await issuesRepository.getIssueById(id);
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }
  return issue;
}

export async function updateIssue(id, fields) {
  const issue = await issuesRepository.getIssueById(id);
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }

  // Only allow updates before issue
  if (issue.status !== 'requested') {
    throw new AppError(409, 'INVALID_STATE', 'Can only update issues in requested state');
  }

  return issuesRepository.updateIssue(id, fields);
}

export async function issueAsset(issueId, issuedBy) {
  return withTransaction(async (client) => {
    // Lock and get issue
    const { rows: issueRows } = await client.query(
      `SELECT i.*, a.id as asset_id
       FROM issues i
       JOIN assets a ON i.asset_id = a.id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'requested') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot issue from status ${issue.status}. Must be in requested state.`, 409);
    }

    // Re-check borrower blocks
    const { rows: blockRows } = await client.query(
      `SELECT * FROM borrower_blocks 
       WHERE user_id = $1 
         AND is_active = true
         AND (blocked_until IS NULL OR blocked_until > NOW())
       LIMIT 1`,
      [issue.borrower_id]
    );

    if (blockRows[0]) {
      throw new AppError('BORROWER_BLOCKED', 
        `Borrower is blocked: ${blockRows[0].reason}`, 403);
    }

    // Re-check and lock asset availability
    await checkAssetAvailability(issue.asset_id, issue.quantity, client, true);

    // Update issue to active
    await client.query(
      `UPDATE issues 
       SET status = 'active', 
           issued_at = NOW(), 
           issued_by = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [issuedBy, issueId]
    );

    // Log audit entry
    await logIssueAction('issue', issueId, issuedBy, {
      previous_status: 'requested',
      new_status: 'active',
    }, client);

    return issuesRepository.getIssueById(issueId);
  });
}

export async function dropIssue(issueId, dropBoxId, droppedBy) {
  return withTransaction(async (client) => {
    // Lock and get issue
    const { rows: issueRows } = await client.query(
      'SELECT * FROM issues WHERE id = $1 FOR UPDATE',
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'active') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot drop from status ${issue.status}. Must be in active state.`, 409);
    }

    // Verify drop box exists and is active
    const { rows: boxRows } = await client.query(
      'SELECT id, name, is_active FROM drop_boxes WHERE id = $1',
      [dropBoxId]
    );

    if (!boxRows[0]) {
      throw new AppError('NOT_FOUND', 'Drop box not found', 404);
    }

    if (!boxRows[0].is_active) {
      throw new AppError('DROP_BOX_INACTIVE', 'Drop box is not active', 409);
    }

    // Update issue to dropped
    await client.query(
      `UPDATE issues 
       SET status = 'dropped', 
           dropped_at = NOW(), 
           drop_box_id = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [dropBoxId, issueId]
    );

    // Log audit entry
    await logIssueAction('drop', issueId, droppedBy || issue.borrower_id, {
      previous_status: 'active',
      new_status: 'dropped',
      drop_box_id: dropBoxId,
      drop_box_name: boxRows[0].name,
    }, client);

    return issuesRepository.getIssueById(issueId);
  });
}

export async function receiveIssue(issueId, receiveData, receivedBy) {
  return withTransaction(async (client) => {
    // Lock and get issue
    const { rows: issueRows } = await client.query(
      'SELECT * FROM issues WHERE id = $1 FOR UPDATE',
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'dropped') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot receive from status ${issue.status}. Item must be dropped first.`, 409);
    }

    // Update issue to returned
    await client.query(
      `UPDATE issues 
       SET status = 'returned', 
           returned_at = NOW(), 
           received_by = $1,
           return_condition = $2,
           remarks = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [receivedBy, receiveData.return_condition, receiveData.remarks || null, issueId]
    );

    // Log audit entry
    await logIssueAction('receive', issueId, receivedBy, {
      previous_status: 'dropped',
      new_status: 'returned',
      return_condition: receiveData.return_condition,
      remarks: receiveData.remarks,
    }, client);

    return issuesRepository.getIssueById(issueId);
  });
}

export async function cancelIssue(issueId, cancellationReason, cancelledBy) {
  return withTransaction(async (client) => {
    // Lock and get issue
    const { rows: issueRows } = await client.query(
      'SELECT * FROM issues WHERE id = $1 FOR UPDATE',
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'requested') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        'Can only cancel issues in requested state', 409);
    }

    // Update issue to cancelled
    await client.query(
      `UPDATE issues 
       SET status = 'cancelled', 
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [cancellationReason, issueId]
    );

    // Log audit entry
    await logIssueAction('cancel', issueId, cancelledBy, {
      previous_status: 'requested',
      new_status: 'cancelled',
      cancellation_reason: cancellationReason,
    }, client);

    return issuesRepository.getIssueById(issueId);
  });
}

export async function renewIssue(issueId, renewalData, requestedBy) {
  return withTransaction(async (client) => {
    // Lock and get issue with category info
    const { rows: issueRows } = await client.query(
      `SELECT i.*, c.max_renewals, c.default_loan_days
       FROM issues i
       JOIN assets a ON i.asset_id = a.id
       JOIN categories c ON a.category_id = c.id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'active') {
      throw new AppError('INVALID_STATE', 
        'Can only renew active issues', 409);
    }

    // Check max renewals
    if (issue.renewal_count >= issue.max_renewals) {
      throw new AppError('MAX_RENEWALS_REACHED', 
        `Maximum ${issue.max_renewals} renewals allowed`, 409);
    }

    // Calculate new due date
    const currentDue = new Date(issue.due_at);
    const newDueDate = new Date(currentDue);
    newDueDate.setDate(newDueDate.getDate() + issue.default_loan_days);

    const approvedBy = renewalData.approved_by || requestedBy;

    // Create renewal record
    const { rows: renewalRows } = await client.query(
      `INSERT INTO loan_renewals 
       (issue_id, requested_by, approved_by, previous_due_at, new_due_at, 
        status, reason, decision_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
       RETURNING *`,
      [issueId, requestedBy, approvedBy, issue.due_at, newDueDate, renewalData.reason || null]
    );

    // Update issue
    await client.query(
      `UPDATE issues 
       SET due_at = $1, 
           renewal_count = renewal_count + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [newDueDate, issueId]
    );

    // Log audit entry
    await logIssueAction('renew', issueId, requestedBy, {
      previous_due_at: issue.due_at,
      new_due_at: newDueDate,
      renewal_count: issue.renewal_count + 1,
      approved_by: approvedBy,
    }, client);

    return {
      issue: await issuesRepository.getIssueById(issueId),
      renewal: renewalRows[0],
    };
  });
}

export async function getOverdueIssues(borrowerId = null, orgUnitIds = null) {
  return issuesRepository.getOverdueIssues(borrowerId, orgUnitIds);
}

export async function getDroppedIssues(orgUnitIds = null) {
  return issuesRepository.getDroppedIssues(orgUnitIds);
}

/**
 * Direct return (active → returned) without drop box
 * For cases where borrower returns directly to staff
 */
export async function directReturn(issueId, receiveData, receivedBy) {
  return withTransaction(async (client) => {
    // Lock and get issue
    const { rows: issueRows } = await client.query(
      'SELECT * FROM issues WHERE id = $1 FOR UPDATE',
      [issueId]
    );

    if (!issueRows[0]) {
      throw new AppError('NOT_FOUND', 'Issue not found', 404);
    }

    const issue = issueRows[0];

    if (issue.status !== 'active') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot return from status ${issue.status}. Must be in active state.`, 409);
    }

    // Update issue to returned (skip dropped state)
    await client.query(
      `UPDATE issues 
       SET status = 'returned', 
           returned_at = NOW(), 
           received_by = $1,
           return_condition = $2,
           remarks = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [receivedBy, receiveData.return_condition, receiveData.remarks || null, issueId]
    );

    // Log audit entry
    await logIssueAction('direct_return', issueId, receivedBy, {
      previous_status: 'active',
      new_status: 'returned',
      return_condition: receiveData.return_condition,
      remarks: receiveData.remarks,
    }, client);

    return issuesRepository.getIssueById(issueId);
  });
}

// test-user-creation.js
import 'dotenv/config';
import { pool } from '../../src/db/pool.js';
import * as userService from '../../src/modules/users/users.service.js';

async function testUserCreation() {
  console.log('🧪 Testing User Creation and Data Persistence\n');

  try {
    // Check database connection
    console.log('1️⃣ Checking database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connected successfully\n');

    // Create a test user
    console.log('2️⃣ Creating a new test user...');
    const testUserData = {
      full_name: 'Test User',
      institute_email: `test${Date.now()}@institute.edu`,
      roll_no: `TEST${Date.now()}`,
      phone: '1234567890',
      programme: 'Computer Science',
      password: 'testpassword123',
    };

    console.log('User data:', {
      full_name: testUserData.full_name,
      institute_email: testUserData.institute_email,
      roll_no: testUserData.roll_no,
      phone: testUserData.phone,
      programme: testUserData.programme,
    });

    const createdUser = await userService.createUser(testUserData);
    console.log('✅ User created successfully!');
    console.log('Created user ID:', createdUser.id);
    console.log('Created user:', createdUser, '\n');

    // Verify the user was saved by fetching it from database
    console.log('3️⃣ Verifying user was saved to database...');
    const { rows } = await pool.query(
      'SELECT id, full_name, institute_email, roll_no, phone, programme, admission_year, is_active, created_at, updated_at FROM users WHERE id = $1',
      [createdUser.id]
    );

    if (rows.length === 0) {
      console.log('❌ ERROR: User not found in database!');
      return;
    }

    const savedUser = rows[0];
    console.log('✅ User found in database!');
    console.log('Saved user:', savedUser, '\n');

    // Verify data integrity
    console.log('4️⃣ Verifying data integrity...');
    const checks = {
      'Full name matches': savedUser.full_name === testUserData.full_name,
      'Email matches': savedUser.institute_email === testUserData.institute_email,
      'Roll number matches': savedUser.roll_no === testUserData.roll_no,
      'Phone matches': savedUser.phone === testUserData.phone,
      'Programme matches': savedUser.programme === testUserData.programme,
      'User is active': savedUser.is_active === true,
      'Has created_at timestamp': !!savedUser.created_at,
      'Has updated_at timestamp': !!savedUser.updated_at,
    };

    let allChecksPass = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allChecksPass = false;
    }

    console.log('\n5️⃣ Counting total users in database...');
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as count FROM users');
    console.log(`Total users in database: ${countRows[0].count}\n`);

    if (allChecksPass) {
      console.log('🎉 All tests passed! User creation is working correctly.\n');
    } else {
      console.log('⚠️ Some checks failed. Review the data above.\n');
    }

    // Optional: Clean up test user
    console.log('6️⃣ Cleaning up test user...');
    await pool.query('DELETE FROM users WHERE id = $1', [createdUser.id]);
    console.log('✅ Test user deleted\n');

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.detail) console.error('Error detail:', error.detail);
    console.error('\nFull error:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

testUserCreation();

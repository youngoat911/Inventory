// test-roles-system.js
import 'dotenv/config';
import { pool } from '../../src/db/pool.js';
import * as userService from '../../src/modules/users/users.service.js';
import * as rolesService from '../../src/modules/roles/roles.service.js';

async function testRolesSystem() {
  console.log('🧪 Testing Roles System\n');

  try {
    // Check database connection
    console.log('1️⃣ Checking database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connected\n');

    // Create a test user
    console.log('2️⃣ Creating a test user...');
    const testUserData = {
      full_name: 'Admin User',
      institute_email: `admin${Date.now()}@institute.edu`,
      roll_no: `ADMIN${Date.now()}`,
      phone: '9876543210',
      programme: 'Computer Science',
      password: 'adminpassword123',
    };

    const user = await userService.createUser(testUserData);
    console.log('✅ User created:', user.id, user.full_name, '\n');

    // Assign roles to the user
    console.log('3️⃣ Assigning roles to user...');
    
    // Assign super_admin role
    const superAdminRole = await rolesService.createRole({
      user_id: user.id,
      role: 'super_admin',
      position_title: 'System Administrator',
    });
    console.log('✅ Super admin role assigned:', superAdminRole);

    // Assign borrower role
    const borrowerRole = await rolesService.createRole({
      user_id: user.id,
      role: 'borrower',
      academic_year: '2024-2025',
    });
    console.log('✅ Borrower role assigned:', borrowerRole, '\n');

    // Get all roles for user
    console.log('4️⃣ Fetching all roles for user...');
    const allRoles = await rolesService.getRolesByUserId(user.id);
    console.log(`✅ Found ${allRoles.length} roles:`, allRoles, '\n');

    // Get active roles only
    console.log('5️⃣ Fetching active roles for user...');
    const activeRoles = await rolesService.getActiveRolesForUser(user.id);
    console.log(`✅ Found ${activeRoles.length} active roles:`, activeRoles, '\n');

    // Update a role
    console.log('6️⃣ Updating borrower role...');
    const updatedRole = await rolesService.updateRole(borrowerRole.id, {
      position_title: 'Student Borrower',
      academic_year: '2025-2026',
    });
    console.log('✅ Role updated:', updatedRole, '\n');

    // Delete a role
    console.log('7️⃣ Deleting super_admin role...');
    await rolesService.deleteRole(superAdminRole.id);
    console.log('✅ Role deleted\n');

    // Verify deletion
    console.log('8️⃣ Verifying roles after deletion...');
    const remainingRoles = await rolesService.getRolesByUserId(user.id);
    console.log(`✅ Remaining roles: ${remainingRoles.length}`, remainingRoles, '\n');

    // Clean up
    console.log('9️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All role system tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

testRolesSystem();

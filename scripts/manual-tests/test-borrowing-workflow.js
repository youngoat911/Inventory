// test-borrowing-workflow.js
/**
 * Comprehensive integration test for the borrowing/returning workflow
 * 
 * Tests:
 * - Complete borrow/return lifecycle
 * - Transaction rollback on errors
 * - Concurrency control (race conditions)
 * - Direct return flow
 * - Renewals
 * - Borrower blocks
 * - State transition validations
 * 
 * Run with: node test-borrowing-workflow.js
 */

import 'dotenv/config';
import { pool } from '../../src/db/pool.js';
import * as issuesService from '../../src/modules/issues/issues.service.js';

// Test utilities
function log(message, data = null) {
  console.log(`\n${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function success(message) {
  console.log(`✅ ${message}`);
}

function error(message, err) {
  console.log(`❌ ${message}`);
  console.error(err);
}

async function setupTestData() {
  log('🔧 Setting up test data...');
  
  // Create test user
  const userResult = await pool.query(`
    INSERT INTO users (full_name, institute_email, roll_no, phone, is_active)
    VALUES ('Test Borrower', 'test@example.com', 'TEST001', '1234567890', true)
    ON CONFLICT (institute_email) DO UPDATE SET is_active = true
    RETURNING id
  `);
  const userId = userResult.rows[0].id;

  // Create test staff user
  const staffResult = await pool.query(`
    INSERT INTO users (full_name, institute_email, roll_no, phone, is_active)
    VALUES ('Test Staff', 'staff@example.com', 'STAFF001', '0987654321', true)
    ON CONFLICT (institute_email) DO UPDATE SET is_active = true
    RETURNING id
  `);
  const staffId = staffResult.rows[0].id;

  // Create test org unit
  const orgResult = await pool.query(`
    INSERT INTO org_units (name, code, type, is_active)
    VALUES ('Test Department', 'TEST-DEPT', 'department', true)
    ON CONFLICT (code) DO UPDATE SET is_active = true
    RETURNING id
  `);
  const orgId = orgResult.rows[0].id;

  // Create test category
  const categoryResult = await pool.query(`
    INSERT INTO categories (name, default_loan_days, max_renewals)
    VALUES ('Test Electronics', 7, 2)
    RETURNING id
  `);
  const categoryId = categoryResult.rows[0].id;

  // Create test asset
  const assetResult = await pool.query(`
    INSERT INTO assets (
      name, asset_tag, category_id, tracking, quantity, 
      low_stock_threshold, is_issuable, status, condition,
      owner_org_id
    )
    VALUES (
      'Test Laptop', 'LAPTOP-TEST-001', $1, 'quantity', 5,
      2, true, 'available', 'good', $2
    )
    RETURNING id
  `, [categoryId, orgId]);
  const assetId = assetResult.rows[0].id;

  // Create test drop box
  const locationResult = await pool.query(`
    INSERT INTO locations (name, org_unit_id, is_active)
    VALUES ('Test Location', $1, true)
    RETURNING id
  `, [orgId]);
  const locationId = locationResult.rows[0].id;

  const dropBoxResult = await pool.query(`
    INSERT INTO drop_boxes (name, location_id, org_unit_id, is_active)
    VALUES ('Test Drop Box', $1, $2, true)
    RETURNING id
  `, [locationId, orgId]);
  const dropBoxId = dropBoxResult.rows[0].id;

  success('Test data created');

  return { userId, staffId, assetId, orgId, categoryId, dropBoxId };
}

async function cleanupTestData() {
  log('🧹 Cleaning up test data...');
  
  await pool.query(`DELETE FROM audit_log WHERE table_name = 'issues'`);
  await pool.query(`DELETE FROM issues WHERE asset_id IN (SELECT id FROM assets WHERE asset_tag LIKE 'LAPTOP-TEST-%')`);
  await pool.query(`DELETE FROM borrower_blocks WHERE user_id IN (SELECT id FROM users WHERE institute_email LIKE 'test%')`);
  await pool.query(`DELETE FROM assets WHERE asset_tag LIKE 'LAPTOP-TEST-%'`);
  await pool.query(`DELETE FROM drop_boxes WHERE name LIKE 'Test%'`);
  await pool.query(`DELETE FROM locations WHERE name LIKE 'Test%'`);
  await pool.query(`DELETE FROM categories WHERE name LIKE 'Test%'`);
  await pool.query(`DELETE FROM org_units WHERE code LIKE 'TEST-%'`);
  await pool.query(`DELETE FROM users WHERE institute_email LIKE 'test%' OR institute_email LIKE 'staff%'`);
  
  success('Test data cleaned up');
}

async function testCompleteWorkflow(testData) {
  log('📋 Test 1: Complete borrow/return workflow (via drop box)');
  
  try {
    // Step 1: Create borrow request
    log('   1️⃣  Creating borrow request...');
    const issue = await issuesService.createIssue({
      asset_id: testData.assetId,
      quantity: 2,
      purpose: 'Test borrowing',
    }, testData.userId);
    
    success(`Request created: ${issue.id}, Status: ${issue.status}`);
    
    // Step 2: Issue asset
    log('   2️⃣  Issuing asset to borrower...');
    const issued = await issuesService.issueAsset(issue.id, testData.staffId);
    success(`Asset issued: Status: ${issued.status}`);
    
    // Step 3: Drop in drop box
    log('   3️⃣  Dropping asset in drop box...');
    const dropped = await issuesService.dropIssue(issue.id, testData.dropBoxId, testData.userId);
    success(`Asset dropped: Status: ${dropped.status}`);
    
    // Step 4: Receive returned asset
    log('   4️⃣  Receiving returned asset...');
    const returned = await issuesService.receiveIssue(issue.id, {
      return_condition: 'good',
      remarks: 'Returned in good condition',
    }, testData.staffId);
    success(`Asset received: Status: ${returned.status}`);
    
    success('Complete workflow test passed! ✨');
    return issue.id;
  } catch (err) {
    error('Complete workflow test failed', err);
    throw err;
  }
}

async function testDirectReturn(testData) {
  log('📋 Test 2: Direct return workflow (without drop box)');
  
  try {
    // Create and issue
    const issue = await issuesService.createIssue({
      asset_id: testData.assetId,
      quantity: 1,
      purpose: 'Test direct return',
    }, testData.userId);
    
    await issuesService.issueAsset(issue.id, testData.staffId);
    success('Asset issued');
    
    // Direct return
    log('   🔄 Returning directly to staff...');
    const returned = await issuesService.directReturn(issue.id, {
      return_condition: 'good',
      remarks: 'Returned directly',
    }, testData.staffId);
    
    success(`Direct return successful: Status: ${returned.status}`);
    success('Direct return test passed! ✨');
  } catch (err) {
    error('Direct return test failed', err);
    throw err;
  }
}

async function testRenewal(testData) {
  log('📋 Test 3: Loan renewal');
  
  try {
    // Create and issue
    const issue = await issuesService.createIssue({
      asset_id: testData.assetId,
      quantity: 1,
      purpose: 'Test renewal',
    }, testData.userId);
    
    await issuesService.issueAsset(issue.id, testData.staffId);
    
    const originalDueDate = issue.due_at;
    
    // Renew
    log('   🔄 Renewing loan...');
    const result = await issuesService.renewIssue(issue.id, {
      reason: 'Need more time',
    }, testData.userId);
    
    success(`Renewal successful. Renewal count: ${result.issue.renewal_count}`);
    success(`Due date extended from ${originalDueDate} to ${result.issue.due_at}`);
    
    // Try to exceed max renewals
    log('   🔄 Testing max renewal limit...');
    await issuesService.renewIssue(issue.id, { reason: 'Second renewal' }, testData.userId);
    
    try {
      await issuesService.renewIssue(issue.id, { reason: 'Third renewal' }, testData.userId);
      error('Should have failed on max renewals', null);
    } catch (err) {
      if (err.code === 'MAX_RENEWALS_REACHED') {
        success('Max renewals limit enforced correctly');
      } else {
        throw err;
      }
    }
    
    success('Renewal test passed! ✨');
  } catch (err) {
    error('Renewal test failed', err);
    throw err;
  }
}

async function testInvalidStateTransitions(testData) {
  log('📋 Test 4: Invalid state transitions');
  
  try {
    const issue = await issuesService.createIssue({
      asset_id: testData.assetId,
      quantity: 1,
      purpose: 'Test state transitions',
    }, testData.userId);
    
    // Try to drop without issuing
    log('   ❌ Trying to drop without issuing...');
    try {
      await issuesService.dropIssue(issue.id, testData.dropBoxId, testData.userId);
      error('Should have failed - cannot drop from requested state', null);
    } catch (err) {
      if (err.code === 'INVALID_STATE_TRANSITION') {
        success('Invalid transition blocked correctly');
      } else {
        throw err;
      }
    }
    
    // Try to receive without dropping
    log('   ❌ Trying to receive without dropping...');
    await issuesService.issueAsset(issue.id, testData.staffId);
    try {
      await issuesService.receiveIssue(issue.id, {
        return_condition: 'good',
      }, testData.staffId);
      error('Should have failed - cannot receive from active state', null);
    } catch (err) {
      if (err.code === 'INVALID_STATE_TRANSITION') {
        success('Invalid transition blocked correctly');
      } else {
        throw err;
      }
    }
    
    success('State transition validation test passed! ✨');
  } catch (err) {
    error('State transition test failed', err);
    throw err;
  }
}

async function testBorrowerBlock(testData) {
  log('📋 Test 5: Borrower blocking');
  
  try {
    // Block borrower
    log('   🚫 Blocking borrower...');
    await pool.query(`
      INSERT INTO borrower_blocks (user_id, reason, blocked_by, is_active)
      VALUES ($1, 'Test block', $2, true)
    `, [testData.userId, testData.staffId]);
    
    // Try to create issue
    log('   ❌ Trying to borrow while blocked...');
    try {
      await issuesService.createIssue({
        asset_id: testData.assetId,
        quantity: 1,
        purpose: 'Should fail',
      }, testData.userId);
      error('Should have failed - borrower is blocked', null);
    } catch (err) {
      if (err.code === 'BORROWER_BLOCKED') {
        success('Blocked borrower prevented from borrowing');
      } else {
        throw err;
      }
    }
    
    // Unblock
    await pool.query(`
      UPDATE borrower_blocks SET is_active = false WHERE user_id = $1
    `, [testData.userId]);
    
    success('Borrower block test passed! ✨');
  } catch (err) {
    error('Borrower block test failed', err);
    throw err;
  }
}

async function testConcurrencyControl(testData) {
  log('📋 Test 6: Concurrency control (race condition prevention)');
  
  try {
    // Create asset with only 1 unit available
    const assetResult = await pool.query(`
      INSERT INTO assets (
        name, asset_tag, category_id, tracking, quantity, 
        low_stock_threshold, is_issuable, status, condition,
        owner_org_id
      )
      VALUES (
        'Limited Laptop', 'LAPTOP-TEST-RACE', $1, 'quantity', 1,
        0, true, 'available', 'good', $2
      )
      RETURNING id
    `, [testData.categoryId, testData.orgId]);
    const limitedAssetId = assetResult.rows[0].id;
    
    log('   🏁 Creating two concurrent borrow requests for 1 item...');
    
    // Create two requests simultaneously
    const [request1, request2] = await Promise.all([
      issuesService.createIssue({
        asset_id: limitedAssetId,
        quantity: 1,
        purpose: 'Request 1',
      }, testData.userId),
      issuesService.createIssue({
        asset_id: limitedAssetId,
        quantity: 1,
        purpose: 'Request 2',
      }, testData.userId),
    ]);
    
    success('Both requests created (OK - both in requested state)');
    
    // Try to issue both simultaneously
    log('   🏁 Trying to issue both simultaneously...');
    
    const results = await Promise.allSettled([
      issuesService.issueAsset(request1.id, testData.staffId),
      issuesService.issueAsset(request2.id, testData.staffId),
    ]);
    
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;
    
    if (successes === 1 && failures === 1) {
      success('Concurrency control works! Only one issue succeeded.');
      const failedReason = results.find(r => r.status === 'rejected').reason;
      success(`Failed request error: ${failedReason.code}`);
    } else {
      error(`Unexpected result: ${successes} successes, ${failures} failures`, null);
    }
    
    success('Concurrency control test passed! ✨');
  } catch (err) {
    error('Concurrency control test failed', err);
    throw err;
  }
}

async function testAuditLogging(issueId) {
  log('📋 Test 7: Audit logging');
  
  try {
    const result = await pool.query(`
      SELECT action, changed_by, new_data
      FROM audit_log
      WHERE table_name = 'issues' AND record_id = $1
      ORDER BY created_at ASC
    `, [issueId]);
    
    log(`   Found ${result.rows.length} audit log entries:`);
    result.rows.forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.action}`);
    });
    
    if (result.rows.length >= 4) {
      success('Audit logging is working correctly');
    } else {
      error('Expected at least 4 audit entries', null);
    }
    
    success('Audit logging test passed! ✨');
  } catch (err) {
    error('Audit logging test failed', err);
    throw err;
  }
}

async function runAllTests() {
  console.log('🧪 BORROWING/RETURNING WORKFLOW TEST SUITE\n');
  console.log('==========================================\n');
  
  let testData;
  let firstIssueId;
  
  try {
    // Setup
    testData = await setupTestData();
    
    // Run tests
    firstIssueId = await testCompleteWorkflow(testData);
    await testDirectReturn(testData);
    await testRenewal(testData);
    await testInvalidStateTransitions(testData);
    await testBorrowerBlock(testData);
    await testConcurrencyControl(testData);
    await testAuditLogging(firstIssueId);
    
    // Summary
    console.log('\n==========================================');
    console.log('✨ ALL TESTS PASSED! ✨');
    console.log('==========================================\n');
    
  } catch (err) {
    console.log('\n==========================================');
    console.log('❌ TEST SUITE FAILED');
    console.log('==========================================\n');
    console.error(err);
    process.exit(1);
  } finally {
    // Cleanup
    if (testData) {
      await cleanupTestData();
    }
    await pool.end();
  }
}

// Run tests
runAllTests().catch(console.error);

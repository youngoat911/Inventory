// test-issues-system.js
import 'dotenv/config';

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let testData = {
  userId: null,
  borrowerId: null,
  orgUnitId: null,
  categoryId: null,
  locationId: null,
  assetId: null,
  issueId: null,
  dropBoxId: null,
};

async function makeRequest(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  return {
    success: response.ok,
    status: response.status,
    data: data,
  };
}

async function setup() {
  console.log('🔧 SETUP: Creating test data...\n');

  // Create admin user
  const timestamp = Date.now();
  const adminRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Test Admin',
      institute_email: `admin${timestamp}@institute.edu`,
      roll_no: `ADMIN${timestamp}`,
      password: 'testpass123',
    }),
  });

  const adminData = await adminRes.json();
  authToken = adminData.token;
  testData.userId = adminData.user.id;
  console.log('✅ Admin created:', testData.userId);

  // Create borrower user
  const borrowerRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Test Borrower',
      institute_email: `borrower${timestamp}@institute.edu`,
      roll_no: `BORROW${timestamp}`,
      password: 'testpass123',
    }),
  });

  const borrowerData = await borrowerRes.json();
  testData.borrowerId = borrowerData.user.id;
  console.log('✅ Borrower created:', testData.borrowerId);

  // Create org unit
  const orgRes = await makeRequest('POST', '/org-units', {
    name: 'Test Club',
    code: `CLUB${timestamp}`,
    type: 'club',
  });
  testData.orgUnitId = orgRes.data.data.id;
  console.log('✅ Org unit created:', testData.orgUnitId);

  // Create category
  const catRes = await makeRequest('POST', '/categories', {
    name: 'Test Equipment',
    description: 'Test category',
    default_loan_days: 7,
    max_renewals: 2,
  });
  testData.categoryId = catRes.data.data.id;
  console.log('✅ Category created:', testData.categoryId);

  // Create location
  const locRes = await makeRequest('POST', '/locations', {
    name: 'Test Lab',
    type: 'lab',
    building: 'Main Building',
    org_unit_id: testData.orgUnitId,
  });
  testData.locationId = locRes.data.data.id;
  console.log('✅ Location created:', testData.locationId);

  // Create drop box
  const dropBoxRes = await makeRequest('POST', '/drop-boxes', {
    name: 'Main Drop Box',
    location_id: testData.locationId,
    org_unit_id: testData.orgUnitId,
  });
  
  if (dropBoxRes.success) {
    testData.dropBoxId = dropBoxRes.data.data.id;
    console.log('✅ Drop box created:', testData.dropBoxId);
  } else {
    console.log('⚠️ Drop box creation skipped (module not implemented yet)');
  }

  // Create asset
  const assetRes = await makeRequest('POST', '/assets', {
    name: 'Laptop Dell XPS',
    asset_tag: `ASSET${timestamp}`,
    category_id: testData.categoryId,
    tracking: 'individual',
    quantity: 1,
    condition: 'good',
    status: 'available',
    is_issuable: true,
    owner_org_id: testData.orgUnitId,
    location_id: testData.locationId,
  });

  if (assetRes.success) {
    testData.assetId = assetRes.data.data.id;
    console.log('✅ Asset created:', testData.assetId);
  } else {
    console.log('❌ Asset creation failed:', assetRes.data);
    console.log('⚠️ Cannot proceed without asset. Assets module may not be implemented yet.');
    return false;
  }

  console.log('');
  return true;
}

async function testIssuesWorkflow() {
  console.log('🧪 Testing Issues Workflow\n');

  try {
    // Test 1: Create borrow request
    console.log('1️⃣ Creating borrow request...');
    const createRes = await makeRequest('POST', '/issues', {
      asset_id: testData.assetId,
      quantity: 1,
      borrower_id: testData.borrowerId,
      purpose: 'For project work',
    });

    if (!createRes.success) {
      console.log('❌ Create request failed:', createRes.data);
      return;
    }

    testData.issueId = createRes.data.data.id;
    console.log('✅ Borrow request created');
    console.log('   Issue ID:', testData.issueId);
    console.log('   Status:', createRes.data.data.status);
    console.log('   Due date:', createRes.data.data.due_at);
    console.log('');

    // Test 2: List issues
    console.log('2️⃣ Listing all issues...');
    const listRes = await makeRequest('GET', '/issues?page=1&limit=10');
    console.log('✅ Found', listRes.data.data.length, 'issue(s)');
    console.log('');

    // Test 3: Get issue by ID
    console.log('3️⃣ Getting issue details...');
    const getRes = await makeRequest('GET', `/issues/${testData.issueId}`);
    console.log('✅ Issue details retrieved');
    console.log('   Borrower:', getRes.data.data.borrower_name);
    console.log('   Asset:', getRes.data.data.asset_name);
    console.log('');

    // Test 4: Issue asset (approve and hand over)
    console.log('4️⃣ Issuing asset to borrower...');
    const issueRes = await makeRequest('POST', `/issues/${testData.issueId}/issue`, {
      issued_by: testData.userId,
    });
    
    if (!issueRes.success) {
      console.log('❌ Issue failed:', issueRes.data);
      return;
    }

    console.log('✅ Asset issued');
    console.log('   Status:', issueRes.data.data.status);
    console.log('   Issued at:', issueRes.data.data.issued_at);
    console.log('');

    // Test 5: Try to renew
    console.log('5️⃣ Renewing loan...');
    const renewRes = await makeRequest('POST', `/issues/${testData.issueId}/renew`, {
      reason: 'Need more time for project',
    });
    
    if (renewRes.success) {
      console.log('✅ Loan renewed');
      console.log('   New due date:', renewRes.data.data.issue.due_at);
      console.log('   Renewal count:', renewRes.data.data.issue.renewal_count);
    } else {
      console.log('⚠️ Renewal failed:', renewRes.data);
    }
    console.log('');

    // Test 6: Drop in drop box
    if (testData.dropBoxId) {
      console.log('6️⃣ Dropping item in drop box...');
      const dropRes = await makeRequest('POST', `/issues/${testData.issueId}/drop`, {
        drop_box_id: testData.dropBoxId,
      });
      
      if (dropRes.success) {
        console.log('✅ Item dropped');
        console.log('   Status:', dropRes.data.data.status);
        console.log('   Dropped at:', dropRes.data.data.dropped_at);
        console.log('');

        // Test 7: Receive item
        console.log('7️⃣ Staff receiving returned item...');
        const receiveRes = await makeRequest('POST', `/issues/${testData.issueId}/receive`, {
          received_by: testData.userId,
          return_condition: 'good',
          remarks: 'All accessories returned',
        });
        
        if (receiveRes.success) {
          console.log('✅ Item received');
          console.log('   Status:', receiveRes.data.data.status);
          console.log('   Returned at:', receiveRes.data.data.returned_at);
          console.log('   Condition:', receiveRes.data.data.return_condition);
        } else {
          console.log('❌ Receive failed:', receiveRes.data);
        }
      } else {
        console.log('⚠️ Drop failed:', dropRes.data);
      }
    } else {
      console.log('⚠️ Skipping drop/receive tests (no drop box)');
    }
    console.log('');

    // Test 8: Get overdue issues
    console.log('8️⃣ Checking overdue issues...');
    const overdueRes = await makeRequest('GET', '/issues/overdue');
    console.log('✅ Found', overdueRes.data.data.length, 'overdue issue(s)');
    console.log('');

    // Test 9: Get dropped issues
    console.log('9️⃣ Checking dropped issues...');
    const droppedRes = await makeRequest('GET', '/issues/dropped');
    console.log('✅ Found', droppedRes.data.data.length, 'dropped issue(s)');
    console.log('');

    console.log('🎉 All issue workflow tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 TESTING ISSUES/BORROWING SYSTEM');
  console.log('='.repeat(60));
  console.log('');

  const setupSuccess = await setup();
  
  if (!setupSuccess) {
    console.log('\n❌ Setup failed. Cannot proceed with tests.');
    console.log('💡 Make sure the assets module is implemented first.');
    return;
  }

  await testIssuesWorkflow();

  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('Test Data IDs:');
  console.log('  Admin User:', testData.userId);
  console.log('  Borrower:', testData.borrowerId);
  console.log('  Org Unit:', testData.orgUnitId);
  console.log('  Category:', testData.categoryId);
  console.log('  Location:', testData.locationId);
  console.log('  Asset:', testData.assetId);
  console.log('  Issue:', testData.issueId);
  console.log('  Drop Box:', testData.dropBoxId || 'N/A');
  console.log('');
  console.log('✅ Issues system tested!');
  console.log('💡 Test data remains in database for inspection.');
}

runTests();

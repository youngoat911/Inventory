// test-friend-modules.js
import 'dotenv/config';

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let testData = {
  userId: null,
  orgUnitId: null,
  categoryId: null,
  locationId: null,
  vendorId: null,
  purchaseId: null,
};

async function testModule(moduleName, tests) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${moduleName}`);
  console.log('='.repeat(60));
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result.success) {
        console.log(`✅ ${test.name}`);
        if (result.data) {
          console.log(`   Data:`, JSON.stringify(result.data, null, 2).split('\n').slice(0, 5).join('\n'));
        }
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Error:`, result.error);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Exception`);
      console.log(`   Error:`, error.message);
    }
  }
}

async function makeRequest(method, endpoint, body = null, expectAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (expectAuth && authToken) {
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
    error: !response.ok ? data : null,
  };
}

async function runTests() {
  console.log('🚀 Testing Friend\'s Modules\n');
  console.log('Starting tests at:', new Date().toISOString());

  try {
    // Step 1: Setup - Register and Login
    console.log('\n📝 SETUP: Creating test user and logging in...');
    
    const timestamp = Date.now();
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Admin',
        institute_email: `testadmin${timestamp}@institute.edu`,
        roll_no: `ADMIN${timestamp}`,
        password: 'testpass123',
        programme: 'Testing',
      }),
    });

    const registerData = await registerRes.json();
    if (!registerRes.ok) {
      console.error('❌ Registration failed:', registerData);
      return;
    }
    
    authToken = registerData.token;
    testData.userId = registerData.user.id;
    console.log('✅ User created and logged in');
    console.log('   User ID:', testData.userId);
    console.log('   Token:', authToken.substring(0, 20) + '...\n');

    // Test Org Units
    await testModule('ORG UNITS (Clubs/Organizations)', [
      {
        name: 'Create org unit',
        fn: async () => {
          const result = await makeRequest('POST', '/org-units', {
            name: 'Computer Science Club',
            code: 'CSC001',
            type: 'club',
            description: 'CS student organization',
          });
          if (result.success) {
            testData.orgUnitId = result.data.data.id;
          }
          return result;
        },
      },
      {
        name: 'List org units',
        fn: async () => makeRequest('GET', '/org-units?page=1&limit=10'),
      },
      {
        name: 'Get org unit by ID',
        fn: async () => {
          if (!testData.orgUnitId) return { success: false, error: 'No org unit created' };
          return makeRequest('GET', `/org-units/${testData.orgUnitId}`);
        },
      },
      {
        name: 'Update org unit',
        fn: async () => {
          if (!testData.orgUnitId) return { success: false, error: 'No org unit created' };
          return makeRequest('PATCH', `/org-units/${testData.orgUnitId}`, {
            description: 'Updated description',
          });
        },
      },
    ]);

    // Test Categories
    await testModule('CATEGORIES', [
      {
        name: 'Create category',
        fn: async () => {
          const result = await makeRequest('POST', '/categories', {
            name: 'Electronics',
            description: 'Electronic equipment',
            default_loan_days: 7,
            max_renewals: 2,
          });
          if (result.success) {
            testData.categoryId = result.data.data.id;
          }
          return result;
        },
      },
      {
        name: 'List categories',
        fn: async () => makeRequest('GET', '/categories?page=1&limit=10'),
      },
      {
        name: 'Get category by ID',
        fn: async () => {
          if (!testData.categoryId) return { success: false, error: 'No category created' };
          return makeRequest('GET', `/categories/${testData.categoryId}`);
        },
      },
      {
        name: 'Update category',
        fn: async () => {
          if (!testData.categoryId) return { success: false, error: 'No category created' };
          return makeRequest('PATCH', `/categories/${testData.categoryId}`, {
            default_loan_days: 14,
          });
        },
      },
    ]);

    // Test Locations
    await testModule('LOCATIONS', [
      {
        name: 'Create location',
        fn: async () => {
          const result = await makeRequest('POST', '/locations', {
            name: 'Main Lab',
            type: 'lab',
            building: 'Engineering Block',
            floor: '2nd Floor',
            room_number: '201',
            org_unit_id: testData.orgUnitId,
          });
          if (result.success) {
            testData.locationId = result.data.data.id;
          }
          return result;
        },
      },
      {
        name: 'List locations',
        fn: async () => makeRequest('GET', '/locations?page=1&limit=10'),
      },
      {
        name: 'Get location by ID',
        fn: async () => {
          if (!testData.locationId) return { success: false, error: 'No location created' };
          return makeRequest('GET', `/locations/${testData.locationId}`);
        },
      },
      {
        name: 'Update location',
        fn: async () => {
          if (!testData.locationId) return { success: false, error: 'No location created' };
          return makeRequest('PATCH', `/locations/${testData.locationId}`, {
            description: 'Computer lab with 50 workstations',
          });
        },
      },
    ]);

    // Test Vendors
    await testModule('VENDORS', [
      {
        name: 'Create vendor',
        fn: async () => {
          const result = await makeRequest('POST', '/vendors', {
            name: 'Tech Suppliers Inc',
            code: 'TECH001',
            contact_person: 'John Vendor',
            email: 'vendor@techsuppliers.com',
            phone: '9876543210',
            address: '123 Tech Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
          });
          if (result.success) {
            testData.vendorId = result.data.data.id;
          }
          return result;
        },
      },
      {
        name: 'List vendors',
        fn: async () => makeRequest('GET', '/vendors?page=1&limit=10'),
      },
      {
        name: 'Get vendor by ID',
        fn: async () => {
          if (!testData.vendorId) return { success: false, error: 'No vendor created' };
          return makeRequest('GET', `/vendors/${testData.vendorId}`);
        },
      },
      {
        name: 'Update vendor',
        fn: async () => {
          if (!testData.vendorId) return { success: false, error: 'No vendor created' };
          return makeRequest('PATCH', `/vendors/${testData.vendorId}`, {
            website: 'https://techsuppliers.com',
          });
        },
      },
    ]);

    // Test Purchases
    await testModule('PURCHASES', [
      {
        name: 'Create purchase',
        fn: async () => {
          const result = await makeRequest('POST', '/purchases', {
            purchase_order_no: `PO${timestamp}`,
            vendor_id: testData.vendorId,
            org_unit_id: testData.orgUnitId,
            purchase_date: '2024-10-15',
            invoice_no: `INV${timestamp}`,
            invoice_date: '2024-10-15',
            total_amount: 50000.00,
            tax_amount: 9000.00,
            grand_total: 59000.00,
            payment_status: 'pending',
            purchased_by: testData.userId,
          });
          if (result.success) {
            testData.purchaseId = result.data.data.id;
          }
          return result;
        },
      },
      {
        name: 'List purchases',
        fn: async () => makeRequest('GET', '/purchases?page=1&limit=10'),
      },
      {
        name: 'Get purchase by ID',
        fn: async () => {
          if (!testData.purchaseId) return { success: false, error: 'No purchase created' };
          return makeRequest('GET', `/purchases/${testData.purchaseId}`);
        },
      },
      {
        name: 'Update purchase',
        fn: async () => {
          if (!testData.purchaseId) return { success: false, error: 'No purchase created' };
          return makeRequest('PATCH', `/purchases/${testData.purchaseId}`, {
            payment_status: 'paid',
            payment_date: '2024-10-20',
            payment_method: 'bank_transfer',
          });
        },
      },
    ]);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('Test Data Created:');
    console.log('  User ID:', testData.userId);
    console.log('  Org Unit ID:', testData.orgUnitId);
    console.log('  Category ID:', testData.categoryId);
    console.log('  Location ID:', testData.locationId);
    console.log('  Vendor ID:', testData.vendorId);
    console.log('  Purchase ID:', testData.purchaseId);
    console.log('\n✅ All modules tested!');
    console.log('\n💡 Note: Test data was created. Clean up manually if needed.');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
  }
}

runTests();

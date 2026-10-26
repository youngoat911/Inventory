// test-alerts-system.js
/**
 * Integration test for the alerts system
 * Run with: node test-alerts-system.js
 */

import 'dotenv/config';
import { pool } from '../../src/db/pool.js';
import * as alertsService from '../../src/modules/alerts/alerts.service.js';
import * as alertsRepository from '../../src/modules/alerts/alerts.repository.js';

async function testAlertsSystem() {
  console.log('🧪 Testing Alerts System\n');

  try {
    // Test 1: Create a test alert
    console.log('1️⃣  Creating a test alert...');
    const testAlert = await alertsService.createAlert({
      type: 'low_stock',
      severity: 'high',
      title: 'Test Low Stock Alert',
      message: 'This is a test alert for low stock',
      entity_type: 'asset',
      entity_id: '00000000-0000-0000-0000-000000000001',
      metadata: {
        test: true,
        quantity: 5,
        threshold: 10,
      },
    });
    console.log('✅ Alert created:', testAlert.id);
    console.log('   Type:', testAlert.type);
    console.log('   Status:', testAlert.status);
    console.log('   Severity:', testAlert.severity);
    console.log();

    // Test 2: List alerts
    console.log('2️⃣  Listing all alerts...');
    const listResult = await alertsService.listAlerts({
      limit: 10,
      offset: 0,
      filters: {},
    });
    console.log('✅ Found', listResult.total, 'alert(s)');
    console.log();

    // Test 3: Get alert by ID
    console.log('3️⃣  Getting alert by ID...');
    const alert = await alertsService.getAlertById(testAlert.id);
    console.log('✅ Retrieved alert:', alert.title);
    console.log();

    // Test 4: Update alert
    console.log('4️⃣  Updating alert severity...');
    const updatedAlert = await alertsService.updateAlert(testAlert.id, {
      severity: 'critical',
      message: 'Updated test message',
    });
    console.log('✅ Alert updated. New severity:', updatedAlert.severity);
    console.log();

    // Test 5: Acknowledge alert
    console.log('5️⃣  Acknowledging alert...');
    const acknowledgedAlert = await alertsService.acknowledgeAlert(
      testAlert.id,
      '00000000-0000-0000-0000-000000000001' // Test user ID
    );
    console.log('✅ Alert acknowledged. Status:', acknowledgedAlert.status);
    console.log('   Acknowledged at:', acknowledgedAlert.acknowledged_at);
    console.log();

    // Test 6: Get alert summary
    console.log('6️⃣  Getting alert summary...');
    const summary = await alertsService.getAlertSummary();
    console.log('✅ Alert Summary:');
    console.log('   Total alerts:', summary.total_alerts);
    console.log('   By status:', summary.by_status);
    console.log('   By severity:', summary.by_severity);
    console.log();

    // Test 7: Resolve alert
    console.log('7️⃣  Resolving alert...');
    const resolvedAlert = await alertsService.resolveAlert(
      testAlert.id,
      '00000000-0000-0000-0000-000000000001',
      'Test resolution - issue has been fixed'
    );
    console.log('✅ Alert resolved. Status:', resolvedAlert.status);
    console.log('   Resolved at:', resolvedAlert.resolved_at);
    console.log('   Resolution notes:', resolvedAlert.resolution_notes);
    console.log();

    // Test 8: Test deduplication
    console.log('8️⃣  Testing alert deduplication...');
    const duplicateAlert = await alertsService.createAlert({
      type: 'low_stock',
      severity: 'high',
      title: 'Another Low Stock Alert',
      message: 'This should create a new alert (different entity)',
      entity_type: 'asset',
      entity_id: '00000000-0000-0000-0000-000000000002', // Different ID
      metadata: { test: true },
    });
    console.log('✅ New alert created (different entity):', duplicateAlert.id);
    console.log();

    // Test 9: Filter alerts
    console.log('9️⃣  Filtering alerts by type...');
    const filteredResult = await alertsService.listAlerts({
      limit: 10,
      offset: 0,
      filters: { type: 'low_stock' },
    });
    console.log('✅ Found', filteredResult.total, 'low_stock alert(s)');
    console.log();

    // Test 10: Dismiss alert
    console.log('🔟 Dismissing alert...');
    const dismissedAlert = await alertsService.dismissAlert(duplicateAlert.id);
    console.log('✅ Alert dismissed. Status:', dismissedAlert.status);
    console.log();

    // Cleanup: Delete test alerts
    console.log('🧹 Cleaning up test alerts...');
    await pool.query('DELETE FROM alerts WHERE metadata @> \'{"test": true}\'');
    console.log('✅ Test alerts cleaned up');
    console.log();

    console.log('✨ All tests passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
testAlertsSystem().catch(console.error);

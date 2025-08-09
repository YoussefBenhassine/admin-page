const { db, createTables } = require('./database.js');

async function testDatabaseFunction() {
  console.log('🧪 Testing Database Function Directly...\n');

  try {
    // Initialize database
    await createTables();
    console.log('✅ Database initialized\n');

    // Test 1: Create a machine with needs_trial_reset = true
    console.log('1️⃣ Creating test machine with reset flag...');
    const testMachine = await db.createOrUpdateMachine({
      machineId: 'test-machine-123',
      hostname: 'test-host',
      platform: 'TestOS',
      version: '1.0.0',
      licenseKey: 'test-license-123'
    });
    console.log(`   Created machine: ${JSON.stringify(testMachine)}\n`);

    // Test 2: Set needs_trial_reset = true
    console.log('2️⃣ Setting needs_trial_reset = true...');
    await db.updateMachineNeedsTrialReset('test-machine-123', true);
    console.log('   Set needs_trial_reset = true\n');

    // Test 3: Try to update with license (should be blocked)
    console.log('3️⃣ Trying to update with license (should be blocked)...');
    const updatedMachine = await db.createOrUpdateMachine({
      machineId: 'test-machine-123',
      hostname: 'test-host-updated',
      platform: 'TestOS-Updated',
      version: '1.0.1',
      licenseKey: 'new-license-456'
    });
    console.log(`   Updated machine: ${JSON.stringify(updatedMachine)}`);
    console.log(`   License key preserved: ${updatedMachine.license_key === 'test-license-123' ? 'YES' : 'NO'}`);
    console.log(`   License key blocked: ${updatedMachine.license_key !== 'new-license-456' ? 'YES' : 'NO'}\n`);

    // Test 4: Update without license (should be allowed)
    console.log('4️⃣ Updating without license (should be allowed)...');
    const finalMachine = await db.createOrUpdateMachine({
      machineId: 'test-machine-123',
      hostname: 'test-host-final',
      platform: 'TestOS-Final',
      version: '1.0.2'
      // No licenseKey
    });
    console.log(`   Final machine: ${JSON.stringify(finalMachine)}`);
    console.log(`   License key still preserved: ${finalMachine.license_key === 'test-license-123' ? 'YES' : 'NO'}\n`);

    // Summary
    console.log('📋 TEST SUMMARY:');
    console.log(`   License key preserved during reset: ${updatedMachine.license_key === 'test-license-123' ? 'YES' : 'NO'}`);
    console.log(`   New license key blocked: ${updatedMachine.license_key !== 'new-license-456' ? 'YES' : 'NO'}`);
    console.log(`   Machine stays in reset state: ${finalMachine.needs_trial_reset ? 'YES' : 'NO'}`);

    if (updatedMachine.license_key === 'test-license-123' && 
        updatedMachine.license_key !== 'new-license-456' && 
        finalMachine.needs_trial_reset) {
      console.log('\n✅ DATABASE FUNCTION IS WORKING CORRECTLY!');
    } else {
      console.log('\n❌ DATABASE FUNCTION HAS ISSUES!');
    }

    // Cleanup
    await db.deleteMachine('test-machine-123');
    console.log('\n🧹 Test machine cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the test
testDatabaseFunction();

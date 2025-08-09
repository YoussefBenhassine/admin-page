async function testResetFunctionality() {
  console.log('🧪 Testing Reset Functionality with Blocked Re-registration...\n');

  try {
    // Dynamic import for node-fetch
    const fetch = (await import('node-fetch')).default;
    const BASE_URL = 'https://admin-page-7ikz.onrender.com';

    // Step 1: Get all machines to find the connected one
    console.log('1️⃣ Getting machines...');
    const machinesResponse = await fetch(`${BASE_URL}/api/machines`);
    const machinesData = await machinesResponse.json();
    
    if (!machinesData.success || machinesData.machines.length === 0) {
      console.log('❌ No machines found.');
      return;
    }

    const testMachine = machinesData.machines[0];
    console.log(`✅ Found machine: ${testMachine.machine_id} (${testMachine.hostname})`);
    console.log(`   Current needs_trial_reset: ${testMachine.needs_trial_reset || false}`);
    console.log(`   Current license_key: ${testMachine.license_key ? 'EXISTS' : 'NULL'}\n`);

    // Step 2: Reset the machine
    console.log('2️⃣ Resetting machine...');
    const resetResponse = await fetch(`${BASE_URL}/api/machines/${testMachine.machine_id}/reset-trial`, {
      method: 'POST'
    });
    const resetData = await resetResponse.json();
    console.log(`   Reset result: ${JSON.stringify(resetData)}\n`);

    // Step 3: Try to re-register with license (should be blocked)
    console.log('3️⃣ Testing blocked re-registration with license...');
    const blockedRegisterResponse = await fetch(`${BASE_URL}/api/machines/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId: testMachine.machine_id,
        hostname: testMachine.hostname,
        platform: testMachine.platform,
        version: testMachine.version,
        licenseKey: 'old-license-key-123' // This should be blocked
      })
    });
    const blockedRegisterData = await blockedRegisterResponse.json();
    console.log(`   Blocked registration result: ${JSON.stringify(blockedRegisterData)}\n`);

    // Step 4: Try to re-register without license (should be allowed)
    console.log('4️⃣ Testing allowed re-registration without license...');
    const allowedRegisterResponse = await fetch(`${BASE_URL}/api/machines/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId: testMachine.machine_id,
        hostname: testMachine.hostname,
        platform: testMachine.platform,
        version: testMachine.version
        // No licenseKey - this should be allowed
      })
    });
    const allowedRegisterData = await allowedRegisterResponse.json();
    console.log(`   Allowed registration result: ${JSON.stringify(allowedRegisterData)}\n`);

    // Step 5: Check final status
    console.log('5️⃣ Checking final machine status...');
    const finalMachinesResponse = await fetch(`${BASE_URL}/api/machines`);
    const finalMachinesData = await finalMachinesResponse.json();
    const finalMachine = finalMachinesData.machines.find(m => m.machine_id === testMachine.machine_id);
    
    if (finalMachine) {
      console.log(`   Final needs_trial_reset: ${finalMachine.needs_trial_reset || false}`);
      console.log(`   Final license_key: ${finalMachine.license_key ? 'EXISTS' : 'NULL'}`);
      console.log(`   Final status: ${finalMachine.license_key ? 'LICENSE' : 'ESSAI'}\n`);
    }

    // Summary
    console.log('📋 TEST SUMMARY:');
    console.log(`   Reset successful: ${resetData.success ? 'YES' : 'NO'}`);
    console.log(`   Re-registration with license blocked: ${blockedRegisterData.error === 'reset_required' ? 'YES' : 'NO'}`);
    console.log(`   Re-registration without license allowed: ${allowedRegisterData.success ? 'YES' : 'NO'}`);
    console.log(`   Machine stays in trial mode: ${!finalMachine?.license_key ? 'YES' : 'NO'}`);

    if (resetData.success && 
        blockedRegisterData.error === 'reset_required' && 
        allowedRegisterData.success && 
        !finalMachine?.license_key) {
      console.log('\n✅ RESET FUNCTIONALITY IS NOW WORKING CORRECTLY!');
      console.log('   - Reset blocks re-registration with old license');
      console.log('   - Machine stays in trial mode until client handles reset');
    } else {
      console.log('\n❌ RESET FUNCTIONALITY STILL HAS ISSUES!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testResetFunctionality();

import fetch from 'node-fetch';

const API_BASE = 'https://admin-page-7ikz.onrender.com/api';

async function testOneTimeUse() {
    console.log('🧪 Test de la fonctionnalité one-time use des licences\n');

    try {
        // 1. Créer une licence sans machineId (universelle)
        console.log('1. Création d\'une licence universelle...');
        const createResponse = await fetch(`${API_BASE}/licenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                // Pas de machineId - licence universelle
            })
        });
        
        const createData = await createResponse.json();
        if (!createData.success) {
            throw new Error('Erreur création licence: ' + createData.error);
        }
        
        const licenseKey = createData.license.key;
        const machineId1 = 'test-machine-123';
        const machineId2 = 'test-machine-456';
        console.log(`✅ Licence universelle créée: ${licenseKey.substring(0, 20)}...`);

        // 2. Première validation (doit réussir et lier la licence à la machine)
        console.log('\n2. Première validation de la licence...');
        const firstValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, machineId: machineId1 })
        });
        
        const firstResult = await firstValidation.json();
        if (!firstResult.valid) {
            throw new Error('Première validation échouée: ' + firstResult.error);
        }
        console.log('✅ Première validation réussie - licence liée à la machine');

        // 3. Deuxième validation avec la même machine (doit échouer)
        console.log('\n3. Deuxième validation avec la même machine...');
        const secondValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, machineId: machineId1 })
        });
        
        const secondResult = await secondValidation.json();
        if (secondResult.valid) {
            throw new Error('❌ Deuxième validation aurait dû échouer');
        }
        console.log('✅ Deuxième validation échouée comme attendu: ' + secondResult.error);

        // 4. Validation avec une machine différente (doit échouer car licence déjà liée)
        console.log('\n4. Validation avec une machine différente...');
        const thirdValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, machineId: machineId2 })
        });
        
        const thirdResult = await thirdValidation.json();
        if (thirdResult.valid) {
            throw new Error('❌ Validation avec machine différente aurait dû échouer');
        }
        console.log('✅ Validation avec machine différente échouée comme attendu: ' + thirdResult.error);

        // 5. Test création licence avec machineId spécifique
        console.log('\n5. Test création licence avec machineId spécifique...');
        const specificCreateResponse = await fetch(`${API_BASE}/licenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                machineId: 'test-machine-specific'
            })
        });
        
        const specificCreateData = await specificCreateResponse.json();
        if (!specificCreateData.success) {
            throw new Error('Erreur création licence spécifique: ' + specificCreateData.error);
        }
        
        const specificLicenseKey = specificCreateData.license.key;
        console.log(`✅ Licence spécifique créée: ${specificLicenseKey.substring(0, 20)}...`);

        // 6. Test validation licence spécifique sur machine autorisée
        console.log('\n6. Validation licence spécifique sur machine autorisée...');
        const specificValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: specificLicenseKey, machineId: 'test-machine-specific' })
        });
        
        const specificResult = await specificValidation.json();
        if (!specificResult.valid) {
            throw new Error('Validation licence spécifique échouée: ' + specificResult.error);
        }
        console.log('✅ Validation licence spécifique réussie');

        // 7. Test validation licence spécifique sur machine non autorisée
        console.log('\n7. Validation licence spécifique sur machine non autorisée...');
        const unauthorizedValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: specificLicenseKey, machineId: 'test-machine-unauthorized' })
        });
        
        const unauthorizedResult = await unauthorizedValidation.json();
        if (unauthorizedResult.valid) {
            throw new Error('❌ Validation licence spécifique sur machine non autorisée aurait dû échouer');
        }
        console.log('✅ Validation licence spécifique sur machine non autorisée échouée comme attendu: ' + unauthorizedResult.error);

        console.log('\n🎉 Tous les tests one-time use sont passés avec succès!');
        console.log('\n📋 Résumé des vérifications:');
        console.log('✅ Licence universelle créée sans machineId');
        console.log('✅ Première utilisation lie la licence à la machine');
        console.log('✅ Réutilisation sur même machine bloquée');
        console.log('✅ Utilisation sur machine différente bloquée');
        console.log('✅ Licence spécifique créée avec machineId');
        console.log('✅ Licence spécifique fonctionne sur machine autorisée');
        console.log('✅ Licence spécifique bloquée sur machine non autorisée');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        process.exit(1);
    }
}

// Exécuter le test
testOneTimeUse();

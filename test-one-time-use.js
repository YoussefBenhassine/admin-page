import fetch from 'node-fetch';

const API_BASE = 'https://admin-page-7ikz.onrender.com/api';

async function testOneTimeUse() {
    console.log('🧪 Test de la fonctionnalité one-time use des licences\n');

    try {
        // 1. Créer une licence avec machineId requis
        console.log('1. Création d\'une licence...');
        const createResponse = await fetch(`${API_BASE}/licenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                machineId: 'test-machine-123'
            })
        });
        
        const createData = await createResponse.json();
        if (!createData.success) {
            throw new Error('Erreur création licence: ' + createData.error);
        }
        
        const licenseKey = createData.license.key;
        const machineId1 = 'test-machine-123';
        const machineId2 = 'test-machine-456';
        console.log(`✅ Licence créée: ${licenseKey.substring(0, 20)}...`);

        // 2. Première validation (doit réussir)
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
        console.log('✅ Première validation réussie');

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

        // 4. Validation avec une machine différente (doit échouer)
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

        // 5. Test création licence sans machineId (doit échouer)
        console.log('\n5. Test création licence sans machineId...');
        const invalidCreateResponse = await fetch(`${API_BASE}/licenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                // Pas de machineId
            })
        });
        
        const invalidCreateData = await invalidCreateResponse.json();
        if (invalidCreateData.success) {
            throw new Error('❌ Création licence sans machineId aurait dû échouer');
        }
        console.log('✅ Création licence sans machineId échouée comme attendu: ' + invalidCreateData.error);

        console.log('\n🎉 Tous les tests one-time use sont passés avec succès!');
        console.log('\n📋 Résumé des vérifications:');
        console.log('✅ Licence créée avec machineId requis');
        console.log('✅ Première utilisation réussie');
        console.log('✅ Réutilisation sur même machine bloquée');
        console.log('✅ Utilisation sur machine différente bloquée');
        console.log('✅ Création licence universelle bloquée');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        process.exit(1);
    }
}

// Exécuter le test
testOneTimeUse();

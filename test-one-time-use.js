import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testOneTimeUse() {
    console.log('🧪 Test de la fonctionnalité one-time use des licences\n');

    try {
        // 1. Créer une licence
        console.log('1. Création d\'une licence...');
        const createResponse = await fetch(`${API_BASE}/licenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            })
        });
        
        const createData = await createResponse.json();
        if (!createData.success) {
            throw new Error('Erreur création licence: ' + createData.error);
        }
        
        const licenseKey = createData.license.key;
        const machineId = 'test-machine-123';
        console.log(`✅ Licence créée: ${licenseKey.substring(0, 20)}...`);

        // 2. Première validation (doit réussir)
        console.log('\n2. Première validation de la licence...');
        const firstValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, machineId })
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
            body: JSON.stringify({ licenseKey, machineId })
        });
        
        const secondResult = await secondValidation.json();
        if (secondResult.valid) {
            throw new Error('Deuxième validation aurait dû échouer');
        }
        console.log('✅ Deuxième validation échouée comme attendu: ' + secondResult.error);

        // 4. Validation avec une machine différente (doit réussir)
        console.log('\n4. Validation avec une machine différente...');
        const thirdValidation = await fetch(`${API_BASE}/validate-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, machineId: 'test-machine-456' })
        });
        
        const thirdResult = await thirdValidation.json();
        if (!thirdResult.valid) {
            throw new Error('Validation avec machine différente échouée: ' + thirdResult.error);
        }
        console.log('✅ Validation avec machine différente réussie');

        // 5. Vérifier les informations d'utilisation
        console.log('\n5. Vérification des informations d\'utilisation...');
        const licenseId = createData.license.id;
        const usageResponse = await fetch(`${API_BASE}/licenses/${licenseId}/usage`);
        const usageData = await usageResponse.json();
        
        if (!usageData.success) {
            throw new Error('Erreur récupération usage: ' + usageData.error);
        }
        
        console.log(`✅ Utilisations enregistrées: ${usageData.usage.length} machines`);
        usageData.usage.forEach(u => {
            console.log(`   - Machine ${u.machine_id.substring(0, 8)}... utilisée le ${new Date(u.used_at).toLocaleString()}`);
        });

        console.log('\n🎉 Tous les tests sont passés avec succès !');
        console.log('✅ La fonctionnalité one-time use fonctionne correctement.');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        process.exit(1);
    }
}

// Lancer le test si le script est exécuté directement
testOneTimeUse();

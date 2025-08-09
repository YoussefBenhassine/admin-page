// Script de débogage pour tester le chargement des machines
console.log('🔍 Début du débogage des machines...');

// Test 1: Vérifier si l'élément machines-table existe
const machinesTable = document.getElementById('machines-table');
console.log('📋 Élément machines-table trouvé:', machinesTable);

// Test 2: Vérifier si la fonction loadMachines existe
console.log('🔧 Fonction loadMachines existe:', typeof loadMachines);

// Test 3: Appeler l'API directement
fetch('/api/machines')
    .then(response => response.json())
    .then(data => {
        console.log('📡 Données API machines:', data);
        
        if (data.success && data.machines.length > 0) {
            console.log('✅ Machines trouvées:', data.machines.length);
            data.machines.forEach((machine, index) => {
                console.log(`   Machine ${index + 1}:`, {
                    id: machine.machine_id,
                    hostname: machine.hostname,
                    platform: machine.platform,
                    version: machine.version,
                    lastSeen: machine.last_seen
                });
            });
            
            // Test 4: Essayer de mettre à jour la table
            if (typeof updateMachinesTable === 'function') {
                console.log('🔧 Tentative de mise à jour de la table...');
                // Simuler les données globales
                window.machines = data.machines;
                updateMachinesTable();
                console.log('✅ Table mise à jour');
            } else {
                console.log('❌ Fonction updateMachinesTable non trouvée');
            }
        } else {
            console.log('❌ Aucune machine trouvée dans l\'API');
        }
    })
    .catch(error => {
        console.error('❌ Erreur lors de l\'appel API:', error);
    });

// Test 5: Vérifier les variables globales
console.log('🌐 Variables globales:', {
    machines: typeof machines !== 'undefined' ? machines : 'Non définie',
    currentTab: typeof currentTab !== 'undefined' ? currentTab : 'Non définie'
});

console.log('🔍 Fin du débogage des machines'); 
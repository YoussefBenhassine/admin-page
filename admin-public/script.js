// Admin Panel JavaScript - Bootstrap Version

// Global variables
let currentTab = 'dashboard';
let licenses = [];
let machines = [];
let settings = {};

// Format license key for display: keep old keys intact, format 16-char alphanumeric as XXXX-XXXX-XXXX-XXXX
function formatLicenseKeyForDisplay(key) {
    if (!key || typeof key !== 'string') return '';
    // Keep legacy encrypted format as-is (contains colon)
    if (key.includes(':')) return key;
    const upper = key.toUpperCase();
    const hyphenatedPattern = /^([A-Z0-9]{4}-){3}[A-Z0-9]{4}$/;
    if (hyphenatedPattern.test(upper)) return upper;
    const cleaned = upper.replace(/[^A-Z0-9]/g, '');
    if (cleaned.length === 16) {
        return cleaned.match(/.{1,4}/g).join('-');
    }
    return key;
}

function truncateForDisplay(text, maxLength = 20) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Initialize the application
function initializeApp() {
    setupEventListeners();
    updateCurrentTime();
    loadDashboardData();
    loadSettings();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    
    // Refresh data every 30 seconds
    setInterval(() => {
        if (currentTab === 'dashboard') {
            loadDashboardData();
        } else if (currentTab === 'licenses') {
            loadLicenses();
        } else if (currentTab === 'machines') {
            loadMachines();
        }
    }, 30000);
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-bs-target').substring(1);
            switchTab(target);
        });
    });
    
    // Create license button
    document.getElementById('create-license-btn').addEventListener('click', () => {
        openModal('create-license-modal');
    });
    
    // Create license form
    document.getElementById('create-license-form').addEventListener('submit', handleCreateLicense);
    
    // Settings form
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
}

// Switch tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update active tab
    document.querySelectorAll('.nav-link').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-bs-target="#${tabName}"]`).classList.add('active');
    
    // Load tab-specific data
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'licenses':
            loadLicenses();
            break;
        case 'machines':
            loadMachines();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Update current time
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('current-time').textContent = timeString;
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        if (data.success) {
            updateDashboardStats(data.stats);
            updateRecentLicenses(data.recentLicenses);
            updateRecentMachines(data.recentMachines);
        }
    } catch (error) {
        console.error('Erreur lors du chargement du tableau de bord:', error);
    }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
    animateCounter('total-licenses', stats.totalLicenses);
    animateCounter('active-licenses-count', stats.activeLicenses);
    animateCounter('active-machines', stats.activeMachines);
    animateCounter('expiring-soon', stats.expiringSoon);
    
    document.getElementById('active-licenses').textContent = `${stats.activeLicenses} actives`;
}

// Animate counter
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    const increment = (targetValue - currentValue) / 20;
    let current = currentValue;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
            element.textContent = targetValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 50);
}

// Update recent licenses
function updateRecentLicenses(licenses) {
    const container = document.getElementById('recent-licenses');
    container.innerHTML = '';
    
    licenses.forEach(license => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.innerHTML = `
            <div class="recent-item-icon bg-primary bg-opacity-10 text-primary">
                <i class="fas fa-key"></i>
            </div>
            <div class="recent-item-content">
                <div class="recent-item-title">Licence ${license.id}</div>
                <div class="recent-item-subtitle">Expire le ${new Date(license.expirationDate).toLocaleDateString('fr-FR')}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Update recent machines
function updateRecentMachines(machines) {
    const container = document.getElementById('recent-machines');
    container.innerHTML = '';
    
    machines.forEach(machine => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.innerHTML = `
            <div class="recent-item-icon bg-success bg-opacity-10 text-success">
                <i class="fas fa-desktop"></i>
            </div>
            <div class="recent-item-content">
                <div class="recent-item-title">${machine.hostname}</div>
                <div class="recent-item-subtitle">${machine.platform} - ${machine.version}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Load licenses
async function loadLicenses() {
    try {
        const response = await fetch('/api/licenses');
        const data = await response.json();
        
        if (data.success) {
            licenses = data.licenses;
            updateLicensesTable();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des licences:', error);
    }
}

// Update licenses table
function updateLicensesTable() {
    const tbody = document.getElementById('licenses-table');
    tbody.innerHTML = '';
    
    licenses.forEach(license => {
        const row = document.createElement('tr');
        const statusClass = license.isActive ? 'status-active' : 'status-expired';
        const statusText = license.isActive ? 'Active' : 'Expirée';
        
        // Format and truncate key for display
        const fullDisplayKey = formatLicenseKeyForDisplay(license.key);
        const displayKey = truncateForDisplay(fullDisplayKey, 20);
        
        row.innerHTML = `
            <td class="align-middle">
                <span class="badge bg-secondary">${license.id.substring(0, 8)}</span>
            </td>
            <td class="align-middle">
                <div class="license-key-container" data-bs-toggle="tooltip" data-bs-placement="top" title="${fullDisplayKey}">
                    <div class="license-key-display">
                        <code class="license-key-text">${displayKey}</code>
                        <button class="license-key-copy-btn" type="button" onclick="copyLicenseKey('${fullDisplayKey}', this)" title="Copier la clé">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </td>
            <td class="align-middle">
                <span class="text-muted">${new Date(license.expirationDate).toLocaleDateString('fr-FR')}</span>
            </td>
            <td class="align-middle">
                ${license.machineId ? 
                    `<span class="badge bg-info">${license.machineId.substring(0, 8)}</span>` : 
                    '<span class="badge bg-warning">Générique</span>'
                }
            </td>
            <td class="align-middle">
                <span class="badge bg-primary" title="Utilisations totales">${license.usageCount || 0}</span>
                ${license.usageCount > 0 ? '<br><small class="text-muted">One-time use</small>' : ''}
            </td>
            <td class="align-middle">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="align-middle">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-info" onclick="viewLicenseDetails('${license.id}')" title="Voir les détails">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteLicense('${license.id}')" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Initialiser les tooltips Bootstrap
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Load machines
async function loadMachines() {
    console.log('🔧 loadMachines appelée');
    try {
        const response = await fetch('/api/machines');
        const data = await response.json();
        
        console.log('📡 Réponse API machines:', data);
        
        if (data.success) {
            machines = data.machines;
            console.log('✅ Machines chargées:', machines);
            updateMachinesTable();
        } else {
            console.error('❌ Erreur API:', data.error);
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement des machines:', error);
    }
}

// Update machines table
function updateMachinesTable() {
    console.log('🔧 updateMachinesTable appelée');
    console.log('📊 Machines à afficher:', machines);
    
    const tbody = document.getElementById('machines-table');
    console.log('📋 Élément tbody trouvé:', tbody);
    
    if (!tbody) {
        console.error('❌ Élément machines-table non trouvé');
        return;
    }
    
    tbody.innerHTML = '';
    console.log('🧹 Table vidée');
    
    if (!machines || machines.length === 0) {
        console.log('⚠️ Aucune machine à afficher');
        return;
    }
    
    machines.forEach((machine, index) => {
        console.log(`🔧 Création ligne pour machine ${index + 1}:`, machine);
        const row = document.createElement('tr');
        const online = isOnline(machine.last_seen);
        const statusClass = online ? 'status-active' : 'status-expired';
        const statusText = online ? 'En ligne' : 'Hors ligne';
        
        // Tronquer la clé de licence si elle existe
        const licenseDisplay = machine.license_key ? 
            truncateForDisplay(formatLicenseKeyForDisplay(machine.license_key), 20) : 
            'Essai';
        
        row.innerHTML = `
            <td class="align-middle">
                <span class="badge bg-secondary">${machine.machine_id.substring(0, 8)}</span>
            </td>
            <td class="align-middle">
                <strong>${machine.hostname}</strong>
            </td>
            <td class="align-middle">
                <span class="badge bg-info">${machine.platform}</span>
            </td>
            <td class="align-middle">
                <span class="text-muted">${machine.version}</span>
            </td>
            <td class="align-middle">
                ${machine.license_key ? 
                    `<div class="license-key-container" data-bs-toggle="tooltip" data-bs-placement="top" title="${formatLicenseKeyForDisplay(machine.license_key)}">
                        <div class="license-key-display">
                            <code class="license-key-text">${licenseDisplay}</code>
                            <button class="license-key-copy-btn" type="button" onclick="copyLicenseKey('${formatLicenseKeyForDisplay(machine.license_key)}', this)" title="Copier la clé">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>` : 
                    '<span class="badge bg-warning">Essai</span>'
                }
            </td>
            <td class="align-middle">
                <span class="text-muted small">${new Date(machine.last_seen).toLocaleString('fr-FR')}</span>
            </td>
            <td class="align-middle">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="align-middle">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-warning" onclick="resetMachineTrial('${machine.machine_id}')" title="Remettre en période d'essai">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="viewMachineDetails('${machine.machine_id}')" title="Voir les détails">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Initialiser les tooltips Bootstrap
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Load settings
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        if (data.success) {
            settings = data.settings;
            document.getElementById('trial-duration').value = settings.trialDuration || 30;
            document.getElementById('max-machines').value = settings.maxMachines || 1;
        }
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
    }
}

// Handle create license
       async function handleCreateLicense(e) {
           e.preventDefault();
           
           const form = e.target;
           const submitBtn = form.querySelector('button[type="submit"]');
           const originalText = submitBtn.innerHTML;
           
           // Show loading state
           submitBtn.disabled = true;
           submitBtn.classList.add('btn-loading');
           submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Création...';
           
           try {
               const formData = new FormData(form);
               
               // Récupérer la date directement (format YYYY-MM-DD du type="date")
               const expirationDate = formData.get('license-expiration');
               
               // Validation de la date
               if (!expirationDate) {
                   showToast('Date d\'expiration requise', 'error');
                   return;
               }
               
               // Vérifier que la date n'est pas dans le passé
               const selectedDate = new Date(expirationDate);
               const today = new Date();
               today.setHours(0, 0, 0, 0);
               
               if (selectedDate < today) {
                   showToast('La date d\'expiration ne peut pas être dans le passé', 'error');
                   return;
               }
        
        const response = await fetch('/api/licenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                expirationDate: expirationDate,
                machineId: formData.get('license-machine-id') || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('create-license-modal'));
            modal.hide();
            
            // Show success modal
            document.getElementById('generated-license-key').value = formatLicenseKeyForDisplay(data.license.key);
            document.getElementById('generated-expiration').value = new Date(data.license.expirationDate).toLocaleDateString('fr-FR');
            
            const successModal = new bootstrap.Modal(document.getElementById('license-key-modal'));
            successModal.show();
            
            // Refresh licenses table
            loadLicenses();
            loadDashboardData();
            
            showToast('Licence créée avec succès !', 'success');
        } else {
            showToast(data.error || 'Erreur lors de la création de la licence', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la création de la licence:', error);
        showToast('Erreur lors de la création de la licence', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
    }
}

// Handle save settings
async function handleSaveSettings(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sauvegarde...';
    
    try {
        const formData = new FormData(form);
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trialDuration: parseInt(formData.get('trial-duration')),
                maxMachines: parseInt(formData.get('max-machines'))
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Paramètres sauvegardés avec succès !', 'success');
        } else {
            showToast(data.error || 'Erreur lors de la sauvegarde', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des paramètres:', error);
        showToast('Erreur lors de la sauvegarde des paramètres', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
    }
}

// Open modal
function openModal(modalId) {
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
    
    // Focus first input
    const firstInput = document.querySelector(`#${modalId} input`);
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 500);
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) {
        modal.hide();
    }
    
    // Reset form
    const form = document.querySelector(`#${modalId} form`);
    if (form) {
        form.reset();
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// Copy to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.value;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copié dans le presse-papiers !', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// Copy license key
function copyLicenseKey(licenseKey, element) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(licenseKey).then(() => {
            const copyBtn = element.querySelector('.license-key-copy');
            const icon = copyBtn.querySelector('i');
            
            // Visual feedback
            copyBtn.classList.add('license-key-copied');
            icon.className = 'fas fa-check';
            
            setTimeout(() => {
                copyBtn.classList.remove('license-key-copied');
                icon.className = 'fas fa-copy';
            }, 2000);
            
            showToast('Clé de licence copiée !', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(licenseKey);
        });
    } else {
        fallbackCopyTextToClipboard(licenseKey);
    }
}

// Fallback copy function
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('Copié dans le presse-papiers !', 'success');
    } catch (err) {
        showToast('Erreur lors de la copie', 'error');
    }
    
    document.body.removeChild(textArea);
}

// View license usage details
async function viewLicenseDetails(licenseId) {
    try {
        const response = await fetch(`/api/licenses/${licenseId}/usage`);
        const data = await response.json();
        
        if (data.success) {
            showLicenseUsageModal(data.license, data.usage);
        } else {
            showToast('Erreur lors du chargement des détails', 'error');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        showToast('Erreur lors du chargement des détails', 'error');
    }
}

// Show license usage modal
function showLicenseUsageModal(license, usage) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'license-usage-modal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-info-circle me-2 text-info"></i>
                        Détails d'utilisation de la licence
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <h6 class="text-muted">Informations de la licence</h6>
                            <div class="mb-2">
                                <strong>ID:</strong> <span class="badge bg-secondary">${license.id.substring(0, 8)}</span>
                            </div>
                            <div class="mb-2">
                                <strong>Clé:</strong> 
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control" value="${formatLicenseKeyForDisplay(license.key)}" readonly>
                                    <button class="btn btn-outline-secondary" onclick="copyToClipboard(this.previousElementSibling)">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="mb-2">
                                <strong>Expiration:</strong> ${new Date(license.expirationDate).toLocaleDateString('fr-FR')}
                            </div>
                            <div class="mb-2">
                                <strong>Machine assignée:</strong> 
                                ${license.machineId ? 
                                    `<span class="badge bg-info">${license.machineId.substring(0, 8)}</span>` : 
                                    '<span class="badge bg-warning">Générique</span>'
                                }
                            </div>
                            <div class="mb-2">
                                <strong>Statut:</strong> 
                                <span class="status-badge ${license.isActive ? 'status-active' : 'status-expired'}">
                                    ${license.isActive ? 'Active' : 'Expirée'}
                                </span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted">Statistiques d'utilisation</h6>
                            <div class="mb-2">
                                <strong>Utilisations totales:</strong> <span class="badge bg-primary">${license.usageCount || 0}</span>
                            </div>
                            <div class="mb-2">
                                <strong>Machines uniques:</strong> <span class="badge bg-success">${usage.length}</span>
                            </div>
                            <div class="mb-2">
                                <strong>Créée le:</strong> ${new Date(license.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <h6 class="text-muted">Historique d'utilisation par machine</h6>
                        ${usage.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Machine ID</th>
                                            <th>Date d'utilisation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${usage.map(u => `
                                            <tr>
                                                <td><span class="badge bg-secondary">${u.machine_id.substring(0, 8)}</span></td>
                                                <td>${new Date(u.used_at).toLocaleString('fr-FR')}</div>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                Aucune utilisation enregistrée pour cette licence.
                            </div>
                        `}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Remove modal from DOM after it's hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

// Delete license
async function deleteLicense(licenseId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette licence ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/licenses/${licenseId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Licence supprimée avec succès !', 'success');
            loadLicenses();
            loadDashboardData();
        } else {
            showToast(data.error || 'Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la licence:', error);
        showToast('Erreur lors de la suppression de la licence', 'error');
    }
}

// Reset machine trial
async function resetMachineTrial(machineId) {
    if (!confirm('Êtes-vous sûr de vouloir remettre cette machine en période d\'essai ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/machines/${machineId}/reset-trial`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Machine remise en période d\'essai !', 'success');
            loadMachines();
        } else {
            showToast(data.error || 'Erreur lors de la réinitialisation', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la réinitialisation de la machine:', error);
        showToast('Erreur lors de la réinitialisation de la machine', 'error');
    }
}

// Copy to clipboard utility function
function copyToClipboard(element) {
    const text = element.value;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copié dans le presse-papiers !', 'success');
    }).catch(() => {
        fallbackCopyTextToClipboard(text);
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-custom show`;
    
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
    
    toast.innerHTML = `
        <div class="toast-header">
            <i class="fas fa-${icon} ${bgClass} text-white me-2"></i>
            <strong class="me-auto">Notification</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Expose functions to window for onclick handlers
window.copyLicenseKey = copyLicenseKey;
window.deleteLicense = deleteLicense;
window.resetMachineTrial = resetMachineTrial;
window.copyToClipboard = copyToClipboard;
window.viewLicenseDetails = viewLicenseDetails;
window.viewMachineDetails = viewMachineDetails;

// Helper function to check if machine is online
function isOnline(lastSeen) {
    return (Date.now() - new Date(lastSeen).getTime()) < 300000; // 5 minutes
}

// View license details
function viewLicenseDetails(licenseId) {
    const license = licenses.find(l => l.id === licenseId);
    if (!license) {
        showToast('Licence non trouvée', 'error');
        return;
    }
    
    // Créer le contenu du modal
    const modalContent = `
        <div class="modal-header">
            <h5 class="modal-title">
                <i class="fas fa-key me-2 text-primary"></i>
                Détails de la Licence
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label fw-bold">ID de Licence</label>
                    <div class="form-control-plaintext">${license.id}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Statut</label>
                    <div class="form-control-plaintext">
                        <span class="status-badge ${license.isActive ? 'status-active' : 'status-expired'}">
                            ${license.isActive ? 'Active' : 'Expirée'}
                        </span>
                    </div>
                </div>
                <div class="col-12">
                    <label class="form-label fw-bold">Clé de Licence</label>
                    <div class="input-group">
                        <input type="text" class="form-control font-monospace" value="${formatLicenseKeyForDisplay(license.key)}" readonly>
                        <button class="btn btn-outline-secondary" type="button" onclick="copyToClipboard('license-detail-key')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Date d'Expiration</label>
                    <div class="form-control-plaintext">${new Date(license.expirationDate).toLocaleDateString('fr-FR')}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Date de Création</label>
                    <div class="form-control-plaintext">${new Date(license.createdAt).toLocaleDateString('fr-FR')}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Machine ID</label>
                    <div class="form-control-plaintext">
                        ${license.machineId ? 
                            `<span class="badge bg-info">${license.machineId}</span>` : 
                            '<span class="badge bg-warning">Générique</span>'
                        }
                    </div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Nombre d'Utilisations</label>
                    <div class="form-control-plaintext">
                        <span class="badge bg-primary fs-6">${license.usageCount || 0}</span>
                    </div>
                </div>
                ${license.lastUsed ? `
                <div class="col-12">
                    <label class="form-label fw-bold">Dernière Utilisation</label>
                    <div class="form-control-plaintext">${new Date(license.lastUsed).toLocaleString('fr-FR')}</div>
                </div>
                ` : ''}
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
        </div>
    `;
    
    // Créer le modal dynamiquement
    const modalId = 'license-details-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    ${modalContent}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.querySelector('.modal-content').innerHTML = modalContent;
    }
    
    // Afficher le modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Ajouter un champ caché pour la copie
    setTimeout(() => {
        const copyInput = document.createElement('input');
        copyInput.type = 'text';
        copyInput.id = 'license-detail-key';
        copyInput.value = formatLicenseKeyForDisplay(license.key);
        copyInput.style.position = 'absolute';
        copyInput.style.left = '-9999px';
        document.body.appendChild(copyInput);
    }, 100);
}

// View machine details
function viewMachineDetails(machineId) {
    const machine = machines.find(m => m.machine_id === machineId);
    if (!machine) {
        showToast('Machine non trouvée', 'error');
        return;
    }

    const modalContent = `
        <div class="modal-header">
            <h5 class="modal-title">
                <i class="fas fa-desktop me-2 text-success"></i>
                Détails de la Machine
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label fw-bold">Machine ID</label>
                    <div class="form-control-plaintext">${machine.machine_id}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Statut</label>
                    <div class="form-control-plaintext">
                        <span class="status-badge ${isOnline(machine.last_seen) ? 'status-active' : 'status-expired'}">
                            ${isOnline(machine.last_seen) ? 'En ligne' : 'Hors ligne'}
                        </span>
                    </div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Hôte</label>
                    <div class="form-control-plaintext">${machine.hostname}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Système d'Exploitation</label>
                    <div class="form-control-plaintext">${machine.platform} - ${machine.version}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Clé de Licence</label>
                    <div class="input-group">
                        <input type="text" class="form-control font-monospace" value="${machine.license_key ? formatLicenseKeyForDisplay(machine.license_key) : 'Aucune'}" readonly>
                        <button class="btn btn-outline-secondary" type="button" onclick="copyToClipboard('machine-detail-license-key')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Dernière Vérification</label>
                    <div class="form-control-plaintext">${new Date(machine.last_seen).toLocaleString('fr-FR')}</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label fw-bold">Date de Création</label>
                    <div class="form-control-plaintext">${new Date(machine.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
        </div>
    `;

    const modalId = 'machine-details-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    ${modalContent}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.querySelector('.modal-content').innerHTML = modalContent;
    }

    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();

    setTimeout(() => {
        const copyInput = document.createElement('input');
        copyInput.type = 'text';
        copyInput.id = 'machine-detail-license-key';
        copyInput.value = machine.license_key ? formatLicenseKeyForDisplay(machine.license_key) : '';
        copyInput.style.position = 'absolute';
        copyInput.style.left = '-9999px';
        document.body.appendChild(copyInput);
    }, 100);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp); 
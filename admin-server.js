const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

// Import de la configuration de base de données
const { createTables, db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'admin-public')));

// Variables globales
let adminData = {
  licenses: [],
  machines: [],
  settings: {
    trialDuration: 30,
    maxMachines: 1
  }
};

// Initialisation de la base de données
const initializeDatabase = async () => {
  try {
    await createTables();
    await db.migrateFromJson();
    console.log('✅ Base de données initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1);
  }
};

// Fonction de génération de clé de licence
function generateLicenseKey() {
  const key = crypto.randomBytes(32).toString('hex');
  const iv = crypto.randomBytes(16);
  
  // Créer une clé de 32 bytes pour AES-256
  const encryptionKey = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || 'default-key', 
    'salt', 
    32
  );
  
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Routes API

// Dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await db.getStats();
    const recentLicenses = await db.getAllLicenses();
    const recentMachines = await db.getAllMachines();

    res.json({
      success: true,
      stats: {
        totalLicenses: parseInt(stats.total_licenses),
        activeLicenses: parseInt(stats.active_licenses),
        activeMachines: parseInt(stats.active_machines),
        expiringSoon: parseInt(stats.expiring_soon)
      },
      recentLicenses: recentLicenses.slice(0, 5),
      recentMachines: recentMachines.slice(0, 5)
    });
  } catch (error) {
    console.error('Erreur lors du chargement du dashboard:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement du dashboard' });
  }
});

// Licences
app.get('/api/licenses', async (req, res) => {
  try {
    const licenses = await db.getAllLicenses();
    res.json({ success: true, licenses });
  } catch (error) {
    console.error('Erreur lors du chargement des licences:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des licences' });
  }
});

app.post('/api/licenses', async (req, res) => {
  try {
    const { expirationDate, machineId } = req.body;
    
    if (!expirationDate) {
      return res.status(400).json({ success: false, error: 'Date d\'expiration requise' });
    }

    const licenseId = uuidv4();
    const licenseKey = generateLicenseKey();

    const license = await db.createLicense({
      id: licenseId,
      key: licenseKey,
      expirationDate: new Date(expirationDate),
      machineId: machineId || null
    });

    res.json({
      success: true,
      license: {
        id: license.id,
        key: license.key,
        expirationDate: license.expiration_date,
        machineId: license.machine_id,
        isActive: license.is_active,
        usageCount: license.usage_count,
        createdAt: license.created_at
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création de la licence:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la licence' });
  }
});

app.delete('/api/licenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteLicense(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la licence:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la licence' });
  }
});

// Machines
app.get('/api/machines', async (req, res) => {
  try {
    const machines = await db.getAllMachines();
    res.json({ success: true, machines });
  } catch (error) {
    console.error('Erreur lors du chargement des machines:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des machines' });
  }
});

app.post('/api/machines/register', async (req, res) => {
  try {
    const { machineId, hostname, platform, version, licenseKey } = req.body;
    
    if (!machineId || !hostname || !platform || !version) {
      return res.status(400).json({ success: false, error: 'Données de machine incomplètes' });
    }

    // La logique de vérification des licences est maintenant gérée dans createOrUpdateMachine
    // Permettre l'enregistrement même si la machine a besoin d'une réinitialisation
    const machine = await db.createOrUpdateMachine({
      machineId,
      hostname,
      platform,
      version,
      licenseKey: licenseKey || null
    });

    res.json({ success: true, machine });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la machine:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'enregistrement de la machine' });
  }
});

app.post('/api/machines/:machineId/reset-trial', async (req, res) => {
  try {
    const { machineId } = req.params;
    
    // Désactiver toutes les licences associées à cette machine
    await db.updateLicensesByMachineId(machineId, { is_active: false });
    
    // Supprimer la licence associée à la machine
    await db.updateMachineLicenseKey(machineId, null);
    
    // Marquer la machine comme ayant besoin d'une réinitialisation d'essai
    await db.updateMachineNeedsTrialReset(machineId, true);
    
    console.log(`🔄 Machine ${machineId} réinitialisée - en attente de traitement client`);
    
    res.json({ 
      success: true, 
      message: 'Machine réinitialisée avec succès. La machine doit maintenant traiter la réinitialisation.',
      machineId,
      needsTrialReset: true
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la machine:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la réinitialisation de la machine' });
  }
});

// Vérifier si une machine a besoin d'une réinitialisation d'essai
app.get('/api/machines/:machineId/needs-trial-reset', async (req, res) => {
  try {
    const { machineId } = req.params;
    const needsReset = await db.getMachineNeedsTrialReset(machineId);
    
    res.json({ 
      success: true, 
      machineId, 
      needsTrialReset: needsReset 
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut de réinitialisation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la vérification du statut de réinitialisation' });
  }
});

// Paramètres
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({
      success: true,
      settings: {
        trialDuration: settings.trial_duration,
        maxMachines: settings.max_machines
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des paramètres' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { trialDuration, maxMachines } = req.body;
    
    if (trialDuration === undefined || maxMachines === undefined) {
      return res.status(400).json({ success: false, error: 'Paramètres incomplets' });
    }

    const settings = await db.updateSettings({
      trialDuration: parseInt(trialDuration),
      maxMachines: parseInt(maxMachines)
    });

    res.json({
      success: true,
      settings: {
        trialDuration: settings.trial_duration,
        maxMachines: settings.max_machines
      }
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde des paramètres' });
  }
});

// Validation de licence
app.post('/api/validate-license', async (req, res) => {
  try {
    const { licenseKey, machineId } = req.body;
    
    if (!licenseKey || !machineId) {
      return res.status(400).json({ success: false, error: 'Clé de licence et ID machine requis' });
    }

    // Vérifier si c'est une demande de réinitialisation d'essai
    if (licenseKey === 'check_trial_reset') {
      const machine = await db.getMachineById(machineId);
      if (machine && machine.needs_trial_reset) {
        // Marquer la machine comme réinitialisée et effacer le flag
        await db.updateMachineLastSeen(machineId);
        await db.updateMachineNeedsTrialReset(machineId, false);
        return res.json({ valid: false, error: 'reset_trial', message: 'Trial reset successful' });
      }
      return res.json({ valid: false, error: 'Licence invalide' });
    }

    const license = await db.getLicenseByKey(licenseKey);
    
    if (!license) {
      return res.json({ valid: false, error: 'Clé de licence invalide' });
    }

    // Vérifier si la licence est expirée
    if (new Date(license.expiration_date) < new Date()) {
      return res.json({ valid: false, error: 'Licence expirée' });
    }

    // Vérifier si la licence est pour une machine spécifique
    if (license.machine_id && license.machine_id !== machineId) {
      return res.json({ valid: false, error: 'Licence non autorisée pour cette machine' });
    }

    // Incrémenter le compteur d'utilisation
    await db.incrementUsageCount(license.id);

    // Mettre à jour la dernière activité de la machine
    await db.updateMachineLastSeen(machineId);

    res.json({ valid: true, license });
  } catch (error) {
    console.error('Erreur lors de la validation de la licence:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation de la licence' });
  }
});

// Route par défaut
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-public', 'index.html'));
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur admin démarré sur http://localhost:${PORT}`);
      console.log(`🌐 Interface web disponible sur http://localhost:${PORT}`);
      console.log(`📊 Base de données PostgreSQL connectée`);
      console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

startServer(); 
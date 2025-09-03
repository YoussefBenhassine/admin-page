require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const mongoDbName = process.env.MONGODB_DB_NAME || 'email_campaign_admin';

let mongoClient;
let connectPromise;

async function getDb() {
  if (!connectPromise) {
    mongoClient = new MongoClient(mongoUri, {
      maxPoolSize: 10
    });
    connectPromise = mongoClient.connect();
  }
  await connectPromise;
  return mongoClient.db(mongoDbName);
}

// Création des collections et index MongoDB
const createTables = async () => {
  const db = await getDb();

  // Collections
  const licenses = db.collection('licenses');
  const machines = db.collection('machines');
  const settings = db.collection('settings');
  const licenseUsage = db.collection('license_usage');

  // Indexes
  await licenses.createIndex({ id: 1 }, { unique: true });
  await licenses.createIndex({ key: 1 }, { unique: true });
  await machines.createIndex({ machine_id: 1 }, { unique: true });
  await licenseUsage.createIndex({ license_id: 1, machine_id: 1 }, { unique: true });

  // Paramètres par défaut
  const existingSettings = await settings.findOne({ _id: 'singleton' });
  if (!existingSettings) {
    await settings.insertOne({
      _id: 'singleton',
      trial_duration: 30,
      max_machines: 1,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  console.log('✅ Collections et index MongoDB prêts');
};

// Fonctions de base de données
const db = {
  // Licences
  async getAllLicenses() {
    const database = await getDb();
    return database.collection('licenses').find({}).sort({ created_at: -1 }).toArray();
  },

  async getLicenseById(id) {
    const database = await getDb();
    return database.collection('licenses').findOne({ id });
  },

  async getLicenseByKey(key) {
    const database = await getDb();
    return database.collection('licenses').findOne({ key });
  },

  async createLicense(license) {
    const database = await getDb();
    const now = new Date();
    const doc = {
      id: license.id,
      key: license.key,
      expiration_date: new Date(license.expirationDate),
      machine_id: license.machineId || null,
      is_active: true,
      usage_count: 0,
      last_used: null,
      created_at: now,
      updated_at: now
    };
    await database.collection('licenses').insertOne(doc);
    return doc;
  },

  async updateLicense(id, updates) {
    if (!id) {
      throw new Error('ID de licence requis pour la mise à jour');
    }
    const database = await getDb();
    const sanitized = { ...updates };
    delete sanitized.id;
    delete sanitized.key; // éviter de briser l'unicité sans contrôle
    const result = await database.collection('licenses').findOneAndUpdate(
      { id },
      { $set: { ...sanitized, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result.value) {
      throw new Error(`Licence avec l'ID ${id} non trouvée`);
    }
    return result.value;
  },

  async updateLicenseMachineId(licenseId, machineId) {
    const database = await getDb();
    const result = await database.collection('licenses').findOneAndUpdate(
      { id: licenseId },
      { $set: { machine_id: machineId, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result.value) {
      throw new Error(`Licence avec l'ID ${licenseId} non trouvée`);
    }
    return result.value;
  },

  async updateLicensesByMachineId(machineId, updates) {
    const database = await getDb();
    const sanitized = { ...updates };
    delete sanitized.id;
    delete sanitized.key;
    await database.collection('licenses').updateMany(
      { machine_id: machineId },
      { $set: { ...sanitized, updated_at: new Date() } }
    );
    return database.collection('licenses').find({ machine_id: machineId }).toArray();
  },

  async deleteLicense(id) {
    const database = await getDb();
    await database.collection('licenses').deleteOne({ id });
  },

  async incrementUsageCount(id) {
    const database = await getDb();
    await database.collection('licenses').updateOne(
      { id },
      { $inc: { usage_count: 1 }, $set: { last_used: new Date(), updated_at: new Date() } }
    );
  },

  async recordLicenseUsage(licenseId, machineId) {
    const database = await getDb();
    try {
      await database.collection('license_usage').insertOne({
        license_id: licenseId,
        machine_id: machineId,
        used_at: new Date()
      });
    } catch (error) {
      // Ignore duplicate key error (unique index ensures no duplicates)
      if (!(error && error.code === 11000)) {
        throw error;
      }
    }
  },

  async hasLicenseBeenUsedByMachine(licenseId, machineId) {
    const database = await getDb();
    const count = await database.collection('license_usage').countDocuments({ license_id: licenseId, machine_id: machineId });
    return count > 0;
  },

  async getLicenseUsageByMachine(licenseId) {
    const database = await getDb();
    return database.collection('license_usage')
      .find({ license_id: licenseId }, { projection: { _id: 0, machine_id: 1, used_at: 1 } })
      .sort({ used_at: -1 })
      .toArray();
  },

  async getLicenseUsageCount(licenseId) {
    const database = await getDb();
    return database.collection('license_usage').countDocuments({ license_id: licenseId });
  },

  // Machines
  async getAllMachines() {
    const database = await getDb();
    return database.collection('machines').find({}).sort({ last_seen: -1 }).toArray();
  },

  async getMachineById(machineId) {
    const database = await getDb();
    return database.collection('machines').findOne({ machine_id: machineId });
  },

  async createOrUpdateMachine(machine) {
    const database = await getDb();
    const machines = database.collection('machines');
    const existing = await machines.findOne({ machine_id: machine.machineId });

    if (existing && existing.needs_trial_reset) {
      const blockedLicenseKey = existing.blocked_license_key;

      if (machine.licenseKey && machine.licenseKey === blockedLicenseKey) {
        const result = await machines.findOneAndUpdate(
          { machine_id: machine.machineId },
          {
            $set: {
              hostname: machine.hostname,
              platform: machine.platform,
              version: machine.version,
              last_seen: new Date(),
              updated_at: new Date()
            }
          },
          { returnDocument: 'after', upsert: false }
        );
        return result.value;
      } else if (machine.licenseKey && machine.licenseKey !== blockedLicenseKey) {
        const result = await machines.findOneAndUpdate(
          { machine_id: machine.machineId },
          {
            $set: {
              hostname: machine.hostname,
              platform: machine.platform,
              version: machine.version,
              license_key: machine.licenseKey,
              needs_trial_reset: false,
              blocked_license_key: null,
              last_seen: new Date(),
              updated_at: new Date()
            },
            $setOnInsert: {
              created_at: new Date()
            }
          },
          { returnDocument: 'after', upsert: true }
        );
        return result.value;
      } else {
        const result = await machines.findOneAndUpdate(
          { machine_id: machine.machineId },
          {
            $set: {
              hostname: machine.hostname,
              platform: machine.platform,
              version: machine.version,
              last_seen: new Date(),
              updated_at: new Date()
            }
          },
          { returnDocument: 'after', upsert: false }
        );
        return result.value;
      }
    } else {
      if (machine.licenseKey !== undefined) {
        const result = await machines.findOneAndUpdate(
          { machine_id: machine.machineId },
          {
            $set: {
              hostname: machine.hostname,
              platform: machine.platform,
              version: machine.version,
              license_key: machine.licenseKey,
              last_seen: new Date(),
              updated_at: new Date()
            },
            $setOnInsert: { created_at: new Date() }
          },
          { returnDocument: 'after', upsert: true }
        );
        return result.value;
      } else {
        const licenseToPreserve = existing ? (existing.license_key || null) : null;
        const result = await machines.findOneAndUpdate(
          { machine_id: machine.machineId },
          {
            $set: {
              hostname: machine.hostname,
              platform: machine.platform,
              version: machine.version,
              license_key: licenseToPreserve,
              last_seen: new Date(),
              updated_at: new Date()
            },
            $setOnInsert: { created_at: new Date() }
          },
          { returnDocument: 'after', upsert: true }
        );
        return result.value;
      }
    }
  },

  async updateMachineLastSeen(machineId) {
    const database = await getDb();
    await database.collection('machines').updateOne(
      { machine_id: machineId },
      { $set: { last_seen: new Date(), updated_at: new Date() } }
    );
  },

  async updateMachineLicenseKey(machineId, licenseKey = null) {
    const database = await getDb();
    const result = await database.collection('machines').findOneAndUpdate(
      { machine_id: machineId },
      { $set: { license_key: licenseKey, last_seen: new Date(), updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result.value;
  },

  async updateMachineNeedsTrialReset(machineId, needsReset) {
    const database = await getDb();
    const result = await database.collection('machines').findOneAndUpdate(
      { machine_id: machineId },
      { $set: { needs_trial_reset: !!needsReset, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result.value;
  },

  async updateMachineBlockedLicenseKey(machineId, blockedLicenseKey) {
    const database = await getDb();
    const result = await database.collection('machines').findOneAndUpdate(
      { machine_id: machineId },
      { $set: { blocked_license_key: blockedLicenseKey || null, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result.value;
  },

  async getMachineNeedsTrialReset(machineId) {
    const database = await getDb();
    const doc = await database.collection('machines').findOne(
      { machine_id: machineId },
      { projection: { needs_trial_reset: 1 } }
    );
    return doc ? !!doc.needs_trial_reset : false;
  },

  async deleteMachine(machineId) {
    const database = await getDb();
    await database.collection('machines').deleteOne({ machine_id: machineId });
  },

  // Paramètres
  async getSettings() {
    const database = await getDb();
    const settings = await database.collection('settings').findOne({ _id: 'singleton' });
    if (!settings) {
      const doc = {
        _id: 'singleton',
        trial_duration: 30,
        max_machines: 1,
        created_at: new Date(),
        updated_at: new Date()
      };
      await database.collection('settings').insertOne(doc);
      return doc;
    }
    return settings;
  },

  async updateSettings(settings) {
    const database = await getDb();
    const result = await database.collection('settings').findOneAndUpdate(
      { _id: 'singleton' },
      {
        $set: {
          trial_duration: parseInt(settings.trialDuration, 10),
          max_machines: parseInt(settings.maxMachines, 10),
          updated_at: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true, returnDocument: 'after' }
    );
    return result.value;
  },

  // Statistiques
  async getStats() {
    const database = await getDb();
    const now = new Date();
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [totalLicenses, activeLicenses, activeMachines, expiringSoon] = await Promise.all([
      database.collection('licenses').countDocuments({}),
      database.collection('licenses').countDocuments({ is_active: true, expiration_date: { $gt: now } }),
      database.collection('machines').countDocuments({ last_seen: { $gt: new Date(Date.now() - 5 * 60 * 1000) } }),
      database.collection('licenses').countDocuments({ expiration_date: { $gt: now, $lte: soon } })
    ]);
    return {
      total_licenses: totalLicenses,
      active_licenses: activeLicenses,
      active_machines: activeMachines,
      expiring_soon: expiringSoon
    };
  },

  // Migration des données existantes depuis un JSON local
  async migrateFromJson() {
    try {
      const fs = require('fs');
      const path = require('path');

      const dataPath = path.join(__dirname, 'admin-data.json');
      if (!fs.existsSync(dataPath)) {
        console.log('📁 Aucun fichier admin-data.json trouvé pour la migration');
        return;
      }

      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

      // Migrer les licences
      for (const license of data.licenses || []) {
        const exists = await this.getLicenseById(license.id);
        if (!exists) {
          await this.createLicense({
            id: license.id,
            key: license.key,
            expirationDate: license.expirationDate,
            machineId: license.machineId
          });
        }
      }

      // Migrer les machines
      for (const machine of data.machines || []) {
        await this.createOrUpdateMachine(machine);
      }

      // Migrer les paramètres
      if (data.settings) {
        await this.updateSettings(data.settings);
      }

      console.log('✅ Migration des données terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la migration:', error);
    }
  }
};

// Pour compatibilité d'export avec l'ancien code, exporter un objet "pool"
const pool = { client: () => mongoClient };

module.exports = { pool, createTables, db };
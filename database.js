const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Scripts de création des tables
const createTables = async () => {
  const client = await pool.connect();
  
  try {
    // Table des licences
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id VARCHAR(36) PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        expiration_date TIMESTAMP NOT NULL,
        machine_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des machines
    await client.query(`
      CREATE TABLE IF NOT EXISTS machines (
        machine_id VARCHAR(255) PRIMARY KEY,
        hostname VARCHAR(255) NOT NULL,
        platform VARCHAR(100) NOT NULL,
        version VARCHAR(50) NOT NULL,
        license_key TEXT,
        needs_trial_reset BOOLEAN DEFAULT false,
        blocked_license_key TEXT,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des paramètres
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        trial_duration INTEGER DEFAULT 30,
        max_machines INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table pour tracker l'utilisation des licences par machine (one-time use)
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_usage (
        id SERIAL PRIMARY KEY,
        license_id VARCHAR(36) NOT NULL,
        machine_id VARCHAR(255) NOT NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(license_id, machine_id),
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
      )
    `);

    // Insérer les paramètres par défaut s'ils n'existent pas
    await client.query(`
      INSERT INTO settings (trial_duration, max_machines)
      VALUES (30, 1)
      ON CONFLICT DO NOTHING
    `);

    // Migration: Ajouter la colonne needs_trial_reset si elle n'existe pas
    try {
      await client.query(`
        ALTER TABLE machines 
        ADD COLUMN IF NOT EXISTS needs_trial_reset BOOLEAN DEFAULT false
      `);
    } catch (error) {
      console.log('ℹ️ Colonne needs_trial_reset déjà présente ou erreur de migration:', error.message);
    }

    // Migration: Ajouter la colonne blocked_license_key si elle n'existe pas
    try {
      await client.query(`
        ALTER TABLE machines 
        ADD COLUMN IF NOT EXISTS blocked_license_key TEXT
      `);
    } catch (error) {
      console.log('ℹ️ Colonne blocked_license_key déjà présente ou erreur de migration:', error.message);
    }

    console.log('✅ Tables créées avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Fonctions de base de données
const db = {
  // Licences
  async getAllLicenses() {
    const result = await pool.query('SELECT * FROM licenses ORDER BY created_at DESC');
    return result.rows;
  },

  async getLicenseById(id) {
    const result = await pool.query('SELECT * FROM licenses WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getLicenseByKey(key) {
    const result = await pool.query('SELECT * FROM licenses WHERE key = $1', [key]);
    return result.rows[0];
  },

  async createLicense(license) {
    const result = await pool.query(`
      INSERT INTO licenses (id, key, expiration_date, machine_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [license.id, license.key, license.expirationDate, license.machineId]);
    return result.rows[0];
  },

  async updateLicense(id, updates) {
    if (!id) {
      throw new Error('ID de licence requis pour la mise à jour');
    }
    
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updates);
    const result = await pool.query(`
      UPDATE licenses 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);
    
    if (result.rows.length === 0) {
      throw new Error(`Licence avec l'ID ${id} non trouvée`);
    }
    
    return result.rows[0];
  },

  async updateLicensesByMachineId(machineId, updates) {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updates);
    const result = await pool.query(`
      UPDATE licenses 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE machine_id = $1
      RETURNING *
    `, [machineId, ...values]);
    
    return result.rows;
  },

  async deleteLicense(id) {
    await pool.query('DELETE FROM licenses WHERE id = $1', [id]);
  },

  async incrementUsageCount(id) {
    await pool.query(`
      UPDATE licenses 
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  },

  async recordLicenseUsage(licenseId, machineId) {
    await pool.query(`
      INSERT INTO license_usage (license_id, machine_id)
      VALUES ($1, $2)
      ON CONFLICT (license_id, machine_id) DO NOTHING
    `, [licenseId, machineId]);
  },

  async hasLicenseBeenUsedByMachine(licenseId, machineId) {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM license_usage 
      WHERE license_id = $1 AND machine_id = $2
    `, [licenseId, machineId]);
    return parseInt(result.rows[0].count) > 0;
  },

  async getLicenseUsageByMachine(licenseId) {
    const result = await pool.query(`
      SELECT machine_id, used_at FROM license_usage 
      WHERE license_id = $1
      ORDER BY used_at DESC
    `, [licenseId]);
    return result.rows;
  },

  // Machines
  async getAllMachines() {
    const result = await pool.query('SELECT * FROM machines ORDER BY last_seen DESC');
    return result.rows;
  },

  async getMachineById(machineId) {
    const result = await pool.query('SELECT * FROM machines WHERE machine_id = $1', [machineId]);
    return result.rows[0];
  },

  async createOrUpdateMachine(machine) {
    // Vérifier si la machine a besoin d'une réinitialisation d'essai
    const existingMachine = await pool.query('SELECT needs_trial_reset, license_key, blocked_license_key FROM machines WHERE machine_id = $1', [machine.machineId]);
    
    if (existingMachine.rows.length > 0 && existingMachine.rows[0].needs_trial_reset) {
      // Si la machine a besoin d'une réinitialisation, vérifier si c'est une licence bloquée
      const blockedLicenseKey = existingMachine.rows[0].blocked_license_key;
      
      if (machine.licenseKey && machine.licenseKey === blockedLicenseKey) {
        // Si c'est la licence bloquée, ne pas permettre la mise à jour
        const result = await pool.query(`
          UPDATE machines 
          SET 
            hostname = $2,
            platform = $3,
            version = $4,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE machine_id = $1
          RETURNING *
        `, [machine.machineId, machine.hostname, machine.platform, machine.version]);
        return result.rows[0];
      } else if (machine.licenseKey && machine.licenseKey !== blockedLicenseKey) {
        // Si c'est une licence différente de la bloquée, permettre la mise à jour
        const result = await pool.query(`
          INSERT INTO machines (machine_id, hostname, platform, version, license_key)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (machine_id) 
          DO UPDATE SET 
            hostname = EXCLUDED.hostname,
            platform = EXCLUDED.platform,
            version = EXCLUDED.version,
            license_key = EXCLUDED.license_key,
            needs_trial_reset = false,
            blocked_license_key = NULL,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [machine.machineId, machine.hostname, machine.platform, machine.version, machine.licenseKey]);
        return result.rows[0];
      } else {
        // Si pas de licence fournie, ne pas mettre à jour la licence
        const result = await pool.query(`
          UPDATE machines 
          SET 
            hostname = $2,
            platform = $3,
            version = $4,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE machine_id = $1
          RETURNING *
        `, [machine.machineId, machine.hostname, machine.platform, machine.version]);
        return result.rows[0];
      }
    } else {
      // Comportement normal si pas de réinitialisation en cours
      if (machine.licenseKey !== undefined) {
        // Si une licence est fournie, l'utiliser
        const result = await pool.query(`
          INSERT INTO machines (machine_id, hostname, platform, version, license_key)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (machine_id) 
          DO UPDATE SET 
            hostname = EXCLUDED.hostname,
            platform = EXCLUDED.platform,
            version = EXCLUDED.version,
            license_key = EXCLUDED.license_key,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [machine.machineId, machine.hostname, machine.platform, machine.version, machine.licenseKey]);
        return result.rows[0];
      } else {
        // Si pas de licence fournie, préserver la licence existante
        const result = await pool.query(`
          INSERT INTO machines (machine_id, hostname, platform, version, license_key)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (machine_id) 
          DO UPDATE SET 
            hostname = EXCLUDED.hostname,
            platform = EXCLUDED.platform,
            version = EXCLUDED.version,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [machine.machineId, machine.hostname, machine.platform, machine.version, existingMachine.rows[0]?.license_key || null]);
        return result.rows[0];
      }
    }
  },

  async updateMachineLastSeen(machineId) {
    await pool.query(`
      UPDATE machines 
      SET last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE machine_id = $1
    `, [machineId]);
  },

  async updateMachineLicenseKey(machineId, licenseKey = null) {
    const result = await pool.query(`
      UPDATE machines 
      SET license_key = $2, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE machine_id = $1
      RETURNING *
    `, [machineId, licenseKey]);
    
    return result.rows[0];
  },

  async updateMachineNeedsTrialReset(machineId, needsReset) {
    const result = await pool.query(`
      UPDATE machines 
      SET needs_trial_reset = $2, updated_at = CURRENT_TIMESTAMP
      WHERE machine_id = $1
      RETURNING *
    `, [machineId, needsReset]);
    
    return result.rows[0];
  },

  async updateMachineBlockedLicenseKey(machineId, blockedLicenseKey) {
    const result = await pool.query(`
      UPDATE machines 
      SET blocked_license_key = $2, updated_at = CURRENT_TIMESTAMP
      WHERE machine_id = $1
      RETURNING *
    `, [machineId, blockedLicenseKey]);
    
    return result.rows[0];
  },

  async getMachineNeedsTrialReset(machineId) {
    const result = await pool.query(`
      SELECT needs_trial_reset FROM machines WHERE machine_id = $1
    `, [machineId]);
    
    return result.rows[0]?.needs_trial_reset || false;
  },

  async deleteMachine(machineId) {
    await pool.query('DELETE FROM machines WHERE machine_id = $1', [machineId]);
  },

  // Paramètres
  async getSettings() {
    const result = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (result.rows.length === 0) {
      // Créer les paramètres par défaut s'ils n'existent pas
      const defaultResult = await pool.query(`
        INSERT INTO settings (trial_duration, max_machines)
        VALUES (30, 1)
        RETURNING *
      `);
      return defaultResult.rows[0];
    }
    return result.rows[0];
  },

  async updateSettings(settings) {
    // Vérifier s'il existe des paramètres
    const existing = await pool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(existing.rows[0].count) === 0) {
      // Créer les paramètres s'ils n'existent pas
      const result = await pool.query(`
        INSERT INTO settings (trial_duration, max_machines)
        VALUES ($1, $2)
        RETURNING *
      `, [settings.trialDuration, settings.maxMachines]);
      return result.rows[0];
    } else {
      // Mettre à jour les paramètres existants
      const result = await pool.query(`
        UPDATE settings 
        SET trial_duration = $1, max_machines = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM settings ORDER BY id DESC LIMIT 1)
        RETURNING *
      `, [settings.trialDuration, settings.maxMachines]);
      return result.rows[0];
    }
  },

  // Statistiques
  async getStats() {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM licenses) as total_licenses,
        (SELECT COUNT(*) FROM licenses WHERE is_active = true AND expiration_date > CURRENT_TIMESTAMP) as active_licenses,
        (SELECT COUNT(*) FROM machines WHERE last_seen > CURRENT_TIMESTAMP - INTERVAL '5 minutes') as active_machines,
        (SELECT COUNT(*) FROM licenses WHERE expiration_date BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '30 days') as expiring_soon
    `);
    return stats.rows[0];
  },

  // Migration des données existantes
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
        try {
          await this.createLicense({
            id: license.id,
            key: license.key,
            expirationDate: license.expirationDate,
            machineId: license.machineId
          });
        } catch (error) {
          if (error.code !== '23505') { // Ignorer les doublons
            console.error('Erreur migration licence:', error);
          }
        }
      }

      // Migrer les machines
      for (const machine of data.machines || []) {
        try {
          await this.createOrUpdateMachine(machine);
        } catch (error) {
          console.error('Erreur migration machine:', error);
        }
      }

      // Migrer les paramètres
      if (data.settings) {
        try {
          await this.updateSettings(data.settings);
        } catch (error) {
          console.error('Erreur migration paramètres:', error);
        }
      }

      console.log('✅ Migration des données terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la migration:', error);
    }
  }
};

module.exports = { pool, createTables, db }; 
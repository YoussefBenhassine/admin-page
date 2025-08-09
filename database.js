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

    // Insérer les paramètres par défaut s'ils n'existent pas
    await client.query(`
      INSERT INTO settings (trial_duration, max_machines)
      VALUES (30, 1)
      ON CONFLICT DO NOTHING
    `);

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
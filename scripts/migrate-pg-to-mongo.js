/*
  Migration script: PostgreSQL -> MongoDB Atlas
  Usage:
    NODE_ENV=production node scripts/migrate-pg-to-mongo.js

  Requires env:
    - DATABASE_URL or DB_* for Postgres
    - MONGODB_URI and MONGODB_DB_NAME for MongoDB
*/

require('dotenv').config();
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

async function getPgPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  return pool;
}

async function getMongo() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'email_campaign_admin';
  if (!uri) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function migrate() {
  const pool = await getPgPool();
  const { client: mongoClient, db } = await getMongo();

  try {
    console.log('🔌 Connected to PostgreSQL and MongoDB');

    // Prepare indexes
    await db.collection('licenses').createIndex({ id: 1 }, { unique: true });
    await db.collection('licenses').createIndex({ key: 1 }, { unique: true });
    await db.collection('machines').createIndex({ machine_id: 1 }, { unique: true });
    await db.collection('license_usage').createIndex({ license_id: 1, machine_id: 1 }, { unique: true });

    // Licenses
    console.log('➡️  Migrating licenses...');
    const licensesRes = await pool.query('SELECT * FROM licenses');
    for (const row of licensesRes.rows) {
      const doc = {
        id: row.id,
        key: row.key,
        expiration_date: row.expiration_date ? new Date(row.expiration_date) : null,
        machine_id: row.machine_id || null,
        is_active: row.is_active,
        usage_count: row.usage_count || 0,
        last_used: row.last_used ? new Date(row.last_used) : null,
        created_at: row.created_at ? new Date(row.created_at) : new Date(),
        updated_at: row.updated_at ? new Date(row.updated_at) : new Date()
      };
      await db.collection('licenses').updateOne(
        { id: doc.id },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`✅ Licenses migrated: ${licensesRes.rows.length}`);

    // Machines
    console.log('➡️  Migrating machines...');
    const machinesRes = await pool.query('SELECT * FROM machines');
    for (const row of machinesRes.rows) {
      const doc = {
        machine_id: row.machine_id,
        hostname: row.hostname,
        platform: row.platform,
        version: row.version,
        license_key: row.license_key || null,
        needs_trial_reset: !!row.needs_trial_reset,
        blocked_license_key: row.blocked_license_key || null,
        last_seen: row.last_seen ? new Date(row.last_seen) : new Date(),
        created_at: row.created_at ? new Date(row.created_at) : new Date(),
        updated_at: row.updated_at ? new Date(row.updated_at) : new Date()
      };
      await db.collection('machines').updateOne(
        { machine_id: doc.machine_id },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`✅ Machines migrated: ${machinesRes.rows.length}`);

    // Settings: take the latest row
    console.log('➡️  Migrating settings...');
    const settingsRes = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (settingsRes.rows.length > 0) {
      const row = settingsRes.rows[0];
      await db.collection('settings').updateOne(
        { _id: 'singleton' },
        {
          $set: {
            trial_duration: parseInt(row.trial_duration, 10) || 30,
            max_machines: parseInt(row.max_machines, 10) || 1,
            updated_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );
      console.log('✅ Settings migrated');
    } else {
      console.log('ℹ️ No settings found in Postgres');
    }

    // License usage
    console.log('➡️  Migrating license usage...');
    const usageRes = await pool.query('SELECT * FROM license_usage');
    for (const row of usageRes.rows) {
      const doc = {
        license_id: row.license_id,
        machine_id: row.machine_id,
        used_at: row.used_at ? new Date(row.used_at) : new Date()
      };
      try {
        await db.collection('license_usage').insertOne(doc);
      } catch (e) {
        if (!(e && e.code === 11000)) throw e;
      }
    }
    console.log(`✅ License usage migrated: ${usageRes.rows.length}`);

    console.log('🎉 Migration completed successfully');
  } finally {
    await pool.end();
    await mongoClient.close();
  }
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});



const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, migrate };

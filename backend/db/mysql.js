const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST || 'localhost';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || 'Tyagli@2005';
const database = process.env.MYSQL_DB || 'voting_db';

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    const connection = await mysql.createConnection({ host, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await connection.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS voters (
        id VARCHAR(255) PRIMARY KEY,
        voter_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        dob VARCHAR(255),
        address VARCHAR(255),
        constituency VARCHAR(255) NOT NULL,
        fingerprint_template VARCHAR(255) NULL,
        face_embedding TEXT NULL,
        face_image LONGTEXT NULL,
        has_voted INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [voterColumns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'voters'
    `, [database]);

    const voterColumnNames = new Set(voterColumns.map((column) => column.COLUMN_NAME));
    if (voterColumnNames.has('fingerprint_id') && !voterColumnNames.has('fingerprint_template')) {
      await pool.query(`ALTER TABLE voters CHANGE COLUMN fingerprint_id fingerprint_template VARCHAR(255)`);
    } else if (!voterColumnNames.has('fingerprint_template')) {
      await pool.query(`ALTER TABLE voters ADD COLUMN fingerprint_template VARCHAR(255) AFTER constituency`);
    }

    await pool.query(`ALTER TABLE voters MODIFY COLUMN fingerprint_template VARCHAR(255) NULL`);

    if (!voterColumnNames.has('face_embedding')) {
      await pool.query(`ALTER TABLE voters ADD COLUMN face_embedding TEXT NULL AFTER fingerprint_template`);
    }
    if (!voterColumnNames.has('face_image')) {
      await pool.query(`ALTER TABLE voters ADD COLUMN face_image LONGTEXT NULL AFTER face_embedding`);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id VARCHAR(255) PRIMARY KEY,
        voter_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        party VARCHAR(255) NOT NULL,
        symbol VARCHAR(255),
        constituency VARCHAR(255) NOT NULL
      )
    `);

    const [candidateColumns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'candidates'
    `, [database]);

    const candidateColumnNames = new Set(candidateColumns.map((column) => column.COLUMN_NAME));
    if (!candidateColumnNames.has('voter_id')) {
      await pool.query(`ALTER TABLE candidates ADD COLUMN voter_id VARCHAR(255) NULL AFTER id`);
      await pool.query(`ALTER TABLE candidates ADD UNIQUE (voter_id)`);
    }

    console.log('✅ MySQL database initialized.');
  } catch (err) {
    console.error('MySQL Init Error:', err);
  }
}

initDB();

module.exports = pool;

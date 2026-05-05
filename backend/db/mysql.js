const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST || 'localhost';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || 'Mysql@9876';
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
        fingerprint_template TEXT NOT NULL,
        has_voted INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        party VARCHAR(255) NOT NULL,
        symbol VARCHAR(255),
        constituency VARCHAR(255) NOT NULL
      )
    `);

    console.log('✅ MySQL database initialized.');
  } catch (err) {
    console.error('MySQL Init Error:', err);
  }
}

initDB();

module.exports = pool;

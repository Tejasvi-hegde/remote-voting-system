require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
// db is required to ensure tables exist, but because initDB is async and doesn't return a promise in mysql.js,
// we might need to wait a second or connect directly.
// Let's connect directly here to make seeding robust.
const mysql = require('mysql2/promise');

const FP_VOTER1 = `FP_TEMPLATE_V1
ridge:00110011
ridge:11001100
minutiae:x=120,y=340,angle=45
minutiae:x=200,y=180,angle=90
minutiae:x=310,y=420,angle=135
core:x=215,y=300`;

const FP_VOTER2 = `FP_TEMPLATE_V1
ridge:10101010
ridge:01010101
minutiae:x=100,y=200,angle=30
minutiae:x=250,y=310,angle=60
minutiae:x=180,y=400,angle=120
core:x=190,y=280`;

const FP_VOTER3 = `FP_TEMPLATE_V1
ridge:11110000
ridge:00001111
minutiae:x=140,y=360,angle=15
minutiae:x=290,y=190,angle=75
minutiae:x=330,y=440,angle=150
core:x=230,y=310`;

async function seed() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || 'Mysql@9876';
  const database = process.env.MYSQL_DB || 'voting_db';

  // Connect without DB to create it if it doesn't exist
  let connection = await mysql.createConnection({ host, user, password });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await connection.end();

  // Now connect with DB
  connection = await mysql.createConnection({ host, user, password, database });

  console.log('Seeding database...');
  
  // Ensure tables exist
  await connection.query(`
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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      party VARCHAR(255) NOT NULL,
      symbol VARCHAR(255),
      constituency VARCHAR(255) NOT NULL
    )
  `);

  await connection.query('DELETE FROM voters');
  await connection.query('DELETE FROM candidates');

  const insertVoter = `
    INSERT INTO voters (id, voter_id, name, dob, address, constituency, fingerprint_template)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await connection.query(insertVoter, [uuidv4(), 'VTR001', 'Ravi Kumar', '1990-05-12', '12 MG Road, Bengaluru', 'Bengaluru South', FP_VOTER1]);
  await connection.query(insertVoter, [uuidv4(), 'VTR002', 'Priya Sharma', '1988-11-23', '45 Indiranagar, Bengaluru', 'Bengaluru North', FP_VOTER2]);
  await connection.query(insertVoter, [uuidv4(), 'VTR003', 'Mohan Das', '1975-03-08', '78 Jayanagar, Bengaluru', 'Bengaluru South', FP_VOTER3]);

  const insertCandidate = `
    INSERT INTO candidates (id, name, party, symbol, constituency)
    VALUES (?, ?, ?, ?, ?)
  `;

  const c1 = uuidv4(), c2 = uuidv4(), c3 = uuidv4(), c4 = uuidv4();
  await connection.query(insertCandidate, [c1, 'Anand Raj', 'Party A', 'Lotus', 'Bengaluru South']);
  await connection.query(insertCandidate, [c2, 'Sunita Devi', 'Party B', 'Hand', 'Bengaluru South']);
  await connection.query(insertCandidate, [c3, 'Kiran Bhat', 'Party C', 'Bicycle', 'Bengaluru North']);
  await connection.query(insertCandidate, [c4, 'Meena Rao', 'Party A', 'Lotus', 'Bengaluru North']);

  console.log('✅ MySQL database seeded successfully.');
  console.log('   Voters: VTR001, VTR002, VTR003');
  console.log('   Candidates seeded for Bengaluru South and Bengaluru North');
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

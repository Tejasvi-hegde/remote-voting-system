require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Dummy FP data removed because we are seeding existing voters without biometrics.

async function seed() {
  const blockchainPath = path.join(__dirname, 'blockchain', 'blockchain.json');
  if (fs.existsSync(blockchainPath)) {
    try {
      fs.unlinkSync(blockchainPath);
      console.log('Cleared existing blockchain.json');
    } catch (err) {
      console.error('Failed to delete blockchain.json:', err.message);
    }
  }
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
  await connection.query('DROP TABLE IF EXISTS candidates');
  await connection.query('DROP TABLE IF EXISTS voters');
  
  // Ensure tables exist
  await connection.query(`
    CREATE TABLE IF NOT EXISTS voters (
      id VARCHAR(255) PRIMARY KEY,
      voter_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      dob VARCHAR(255),
      address VARCHAR(255),
      constituency VARCHAR(255) NOT NULL,
      face_embedding TEXT NULL,
      face_image LONGTEXT NULL,
      has_voted INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [voterColumns] = await connection.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'voters'
  `, [database]);

  const voterColumnNames = new Set(voterColumns.map((column) => column.COLUMN_NAME));

  if (!voterColumnNames.has('face_embedding')) {
    await connection.query('ALTER TABLE voters ADD COLUMN face_embedding TEXT NULL AFTER constituency');
  }
  if (!voterColumnNames.has('face_image')) {
    await connection.query('ALTER TABLE voters ADD COLUMN face_image LONGTEXT NULL AFTER face_embedding');
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(255) PRIMARY KEY,
      voter_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      party VARCHAR(255) NOT NULL,
      symbol VARCHAR(255),
      constituency VARCHAR(255) NOT NULL
    )
  `);

  await connection.query('DELETE FROM voters');
  await connection.query('DELETE FROM candidates');

  const insertVoter = `
    INSERT INTO voters (id, voter_id, name, dob, address, constituency, face_embedding, face_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Generate 50 dummy existing voters using actual EPIC format (e.g. IND0000001)
  const constituencies = ['Bengaluru South', 'Bengaluru North', 'Bengaluru Central', 'Mysuru'];
  const firstNames = ['Amit', 'Priya', 'Ravi', 'Sunita', 'Mohan', 'Kiran', 'Meena', 'Rahul', 'Sneha', 'Vikram'];
  const lastNames = ['Sharma', 'Kumar', 'Das', 'Bhat', 'Rao', 'Patil', 'Reddy', 'Gowda', 'Singh', 'Jain'];
  
  for (let i = 1; i <= 50; i++) {
    const vId = `IND${String(i).padStart(7, '0')}`;
    const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const year = 1960 + (i % 40);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const dob = `${year}-${month}-${day}`;
    const address = `${i * 10} Main Road, Block ${i % 5}`;
    const constituency = constituencies[i % constituencies.length];
    
    await connection.query(insertVoter, [uuidv4(), vId, name, dob, address, constituency, null, null]);
  }

  const insertCandidate = `
    INSERT INTO candidates (id, voter_id, name, party, symbol, constituency)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const extraCandidates = [
    // Bengaluru South
    ['Anand Raj', 'Party A', 'Lotus', 'Bengaluru South'],
    ['Sunita Devi', 'Party B', 'Hand', 'Bengaluru South'],
    ['Rakesh Sharma', 'Party C', 'Bicycle', 'Bengaluru South'],
    ['Vidya Balan', 'Party D', 'Elephant', 'Bengaluru South'],
    ['Rahul Dravid', 'Independent', 'Bat', 'Bengaluru South'],
    
    // Bengaluru North
    ['Kiran Bhat', 'Party A', 'Lotus', 'Bengaluru North'],
    ['Meena Rao', 'Party B', 'Hand', 'Bengaluru North'],
    ['Chetan Kumar', 'Party C', 'Bicycle', 'Bengaluru North'],
    ['Akshata Murthy', 'Party D', 'Elephant', 'Bengaluru North'],
    ['Srinivas Gowda', 'Independent', 'Bat', 'Bengaluru North'],

    // Bengaluru Central
    ['Ramesh Kumar', 'Party A', 'Lotus', 'Bengaluru Central'],
    ['Pooja Nayak', 'Party B', 'Hand', 'Bengaluru Central'],
    ['Arun Vijay', 'Party C', 'Bicycle', 'Bengaluru Central'],
    ['Shruthi Hassan', 'Party D', 'Elephant', 'Bengaluru Central'],
    ['Prakash Raj', 'Independent', 'Bat', 'Bengaluru Central'],

    // Mysuru
    ['Siddaramaiah', 'Party A', 'Lotus', 'Mysuru'],
    ['Pratap Simha', 'Party B', 'Hand', 'Mysuru'],
    ['Rashmika Mandanna', 'Party D', 'Elephant', 'Mysuru'],
    ['Yash', 'Independent', 'Bat', 'Mysuru'],
  ];

  for (let idx = 0; idx < extraCandidates.length; idx++) {
    const c = extraCandidates[idx];
    const cVoterId = `CAN${String(idx + 1).padStart(7, '0')}`;
    
    // Register candidate as a voter first
    await connection.query(insertVoter, [
      uuidv4(),
      cVoterId,
      c[0], // name
      '1975-08-15', // dob
      'Candidate Constituency Office', // address
      c[3], // constituency
      null, // fingerprint
      null, // face embedding
      null  // face image
    ]);

    // Insert candidate
    await connection.query(insertCandidate, [uuidv4(), cVoterId, c[0], c[1], c[2], c[3]]);
  }

  console.log('✅ MySQL database seeded successfully.');
  console.log('   50 dummy voters created with EPIC IDs.');
  console.log('   Candidates registered as voters and seeded.');
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

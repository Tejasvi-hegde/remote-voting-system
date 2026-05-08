require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
// db is required to ensure tables exist, but because initDB is async and doesn't return a promise in mysql.js,
// we might need to wait a second or connect directly.
// Let's connect directly here to make seeding robust.
const mysql = require('mysql2/promise');

// Dummy FP data removed because we are seeding existing voters without biometrics.

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
      fingerprint_template VARCHAR(255) NULL,
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
  if (voterColumnNames.has('fingerprint_id') && !voterColumnNames.has('fingerprint_template')) {
    await connection.query(`ALTER TABLE voters CHANGE COLUMN fingerprint_id fingerprint_template VARCHAR(255)`);
  } else if (!voterColumnNames.has('fingerprint_template')) {
    await connection.query(`ALTER TABLE voters ADD COLUMN fingerprint_template VARCHAR(255) AFTER constituency`);
  }

  await connection.query(`ALTER TABLE voters MODIFY COLUMN fingerprint_template VARCHAR(255) NULL`);

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

  // Generate 50 dummy existing voters
  const constituencies = ['Bengaluru South', 'Bengaluru North', 'Bengaluru Central', 'Mysuru'];
  const firstNames = ['Amit', 'Priya', 'Ravi', 'Sunita', 'Mohan', 'Kiran', 'Meena', 'Rahul', 'Sneha', 'Vikram'];
  const lastNames = ['Sharma', 'Kumar', 'Das', 'Bhat', 'Rao', 'Patil', 'Reddy', 'Gowda', 'Singh', 'Jain'];
  
  for (let i = 1; i <= 50; i++) {
    const vId = `VTR${String(i).padStart(3, '0')}`;
    const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const year = 1960 + (i % 40);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const dob = `${year}-${month}-${day}`;
    const address = `${i * 10} Main Road, Block ${i % 5}`;
    const constituency = constituencies[i % constituencies.length];
    
    await connection.query(insertVoter, [uuidv4(), vId, name, dob, address, constituency, null]);
  }

  const insertCandidate = `
    INSERT INTO candidates (id, name, party, symbol, constituency)
    VALUES (?, ?, ?, ?, ?)
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
    ['Pooja Hegde', 'Party B', 'Hand', 'Bengaluru Central'],
    ['Arun Vijay', 'Party C', 'Bicycle', 'Bengaluru Central'],
    ['Shruthi Hassan', 'Party D', 'Elephant', 'Bengaluru Central'],
    ['Prakash Raj', 'Independent', 'Bat', 'Bengaluru Central'],

    // Mysuru
    ['Siddaramaiah', 'Party A', 'Lotus', 'Mysuru'],
    ['Pratap Simha', 'Party B', 'Hand', 'Mysuru'],
    ['Darshan Toogudeepa', 'Party C', 'Bicycle', 'Mysuru'],
    ['Rashmika Mandanna', 'Party D', 'Elephant', 'Mysuru'],
    ['Yash', 'Independent', 'Bat', 'Mysuru'],
  ];

  for (const c of extraCandidates) {
    await connection.query(insertCandidate, [uuidv4(), c[0], c[1], c[2], c[3]]);
  }

  console.log('✅ MySQL database seeded successfully.');
  console.log('   50 dummy voters created without fingerprints.');
  console.log('   Candidates seeded.');
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

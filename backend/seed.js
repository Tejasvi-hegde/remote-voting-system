/**
 * seed.js — Test Data Seeder
 * Run with: node seed.js
 *
 * Populates MongoDB with:
 * - 5 test voters across 2 constituencies
 * - Candidates for each constituency
 *
 * NOTE: biometricHash values here are SHA-256 of test strings.
 * In production, hashes come from the actual fingerprint scanner.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const Voter = require('./models/Voter');
const Candidate = require('./models/Candidate');

// Helper: SHA-256 of a test string (simulates fingerprint hash)
const fakeHash = (str) => crypto.createHash('sha256').update(str).digest('hex');

const candidates = [
  // Constituency KA-001: Bengaluru North
  { candidateID: 'C001', name: 'Arjun Sharma', party: 'National Democratic Alliance', partySymbol: '🪷', constituencyID: 'KA-001', constituencyName: 'Bengaluru North' },
  { candidateID: 'C002', name: 'Priya Nair', party: 'Indian National Congress', partySymbol: '✋', constituencyID: 'KA-001', constituencyName: 'Bengaluru North' },
  { candidateID: 'C003', name: 'Ravi Kumar', party: 'Aam Aadmi Party', partySymbol: '🧹', constituencyID: 'KA-001', constituencyName: 'Bengaluru North' },
  { candidateID: 'C004', name: 'Sunita Reddy', party: 'Independent', partySymbol: '⭐', constituencyID: 'KA-001', constituencyName: 'Bengaluru North' },

  // Constituency MH-001: Mumbai South
  { candidateID: 'C005', name: 'Vijay Patil', party: 'National Democratic Alliance', partySymbol: '🪷', constituencyID: 'MH-001', constituencyName: 'Mumbai South' },
  { candidateID: 'C006', name: 'Ananya Desai', party: 'Indian National Congress', partySymbol: '✋', constituencyID: 'MH-001', constituencyName: 'Mumbai South' },
  { candidateID: 'C007', name: 'Rahul Mehta', party: 'Shiv Sena', partySymbol: '🏹', constituencyID: 'MH-001', constituencyName: 'Mumbai South' },
];

const voters = [
  {
    voterID: 'ABC1234567',
    name: 'Tejasvi Vasant Hegde',
    biometricHash: fakeHash('voter_tejasvi_fingerprint'),
    constituency: { id: 'KA-001', name: 'Bengaluru North', state: 'Karnataka' }
  },
  {
    voterID: 'DEF2345678',
    name: 'GC Nikhil',
    biometricHash: fakeHash('voter_nikhil_fingerprint'),
    constituency: { id: 'KA-001', name: 'Bengaluru North', state: 'Karnataka' }
  },
  {
    voterID: 'GHI3456789',
    name: 'Rohit N Katti',
    biometricHash: fakeHash('voter_rohit_fingerprint'),
    constituency: { id: 'KA-001', name: 'Bengaluru North', state: 'Karnataka' }
  },
  {
    voterID: 'JKL4567890',
    name: 'Sarath Sanjay S',
    biometricHash: fakeHash('voter_sarath_fingerprint'),
    constituency: { id: 'MH-001', name: 'Mumbai South', state: 'Maharashtra' }
  },
  {
    voterID: 'MNO5678901',
    name: 'Demo Voter One',
    biometricHash: fakeHash('voter_demo_fingerprint'),
    constituency: { id: 'MH-001', name: 'Mumbai South', state: 'Maharashtra' }
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/votingdb');
  console.log('Connected to MongoDB');

  // Clear existing test data
  await Voter.deleteMany({});
  await Candidate.deleteMany({});
  console.log('Cleared existing data.');

  // Insert candidates
  await Candidate.insertMany(candidates);
  console.log(`✅ Inserted ${candidates.length} candidates.`);

  // Insert voters
  await Voter.insertMany(voters);
  console.log(`✅ Inserted ${voters.length} voters.`);

  // Print test credentials
  console.log('\n📋 Test Voter Credentials:');
  console.log('──────────────────────────────────────────────────────');
  voters.forEach((v) => {
    console.log(`Voter ID: ${v.voterID}`);
    console.log(`Name:     ${v.name}`);
    console.log(`Hash:     ${v.biometricHash.substring(0, 32)}...`);
    console.log(`Area:     ${v.constituency.name}`);
    console.log('');
  });

  console.log('💡 To simulate a fingerprint hash in testing:');
  console.log("   const crypto = require('crypto');");
  console.log("   const hash = crypto.createHash('sha256').update('voter_tejasvi_fingerprint').digest('hex');");

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch(console.error);

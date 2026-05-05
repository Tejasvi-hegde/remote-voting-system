const sequelize = require('./config/database');
const bcrypt = require('bcryptjs');
const Voter = require('./models/Voter');
const Candidate = require('./models/Candidate');
const Vote = require('./models/Vote');

const seedData = async () => {
  try {
    console.log('Syncing database...');
    await sequelize.sync({ force: true }); // Reset DB

    console.log('Seeding Candidates...');
    const candidates = [
      { candidateID: 'C001', name: 'Arun Sharma', party: 'National Progress Party', partySymbol: '🦅', constituencyID: 'DL01', constituencyName: 'New Delhi' },
      { candidateID: 'C002', name: 'Meera Reddy', party: 'United Democratic Front', partySymbol: '✋', constituencyID: 'DL01', constituencyName: 'New Delhi' },
      { candidateID: 'C003', name: 'Rajesh Kumar', party: 'Independent', partySymbol: '🚲', constituencyID: 'DL01', constituencyName: 'New Delhi' },
      { candidateID: 'C004', name: 'Sanjay Singh', party: 'National Progress Party', partySymbol: '🦅', constituencyID: 'UP04', constituencyName: 'Lucknow' },
      { candidateID: 'C005', name: 'Priya Desai', party: 'United Democratic Front', partySymbol: '✋', constituencyID: 'UP04', constituencyName: 'Lucknow' },
      { candidateID: 'C006', name: 'Vijay Patil', party: 'National Democratic Alliance', partySymbol: '🪷', constituencyID: 'MH02', constituencyName: 'Mumbai South' },
      { candidateID: 'C007', name: 'Ananya Desai', party: 'Indian National Congress', partySymbol: '✋', constituencyID: 'MH02', constituencyName: 'Mumbai South' },
      { candidateID: 'C008', name: 'Rahul Mehta', party: 'Shiv Sena', partySymbol: '🏹', constituencyID: 'MH02', constituencyName: 'Mumbai South' }
    ];
    await Candidate.bulkCreate(candidates);

    console.log('Seeding Mock Voters...');
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);

    const voters = [
      { voterID: 'ABC1234567', name: 'John Doe', password, constituencyId: 'DL01', constituencyName: 'New Delhi', constituencyState: 'Delhi' },
      { voterID: 'XYZ9876543', name: 'Jane Smith', password, constituencyId: 'UP04', constituencyName: 'Lucknow', constituencyState: 'Uttar Pradesh' },
      { voterID: 'MNO4567890', name: 'Bob Wilson', password, constituencyId: 'DL01', constituencyName: 'New Delhi', constituencyState: 'Delhi' }
    ];
    await Voter.bulkCreate(voters);

    console.log('✅ Seeding complete!');
    console.log('You can login with Voter ID (e.g. ABC1234567) and Password (password123)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedData();

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Vote Model
 * Simulates the blockchain ledger. We store encrypted votes here.
 */
const Vote = sequelize.define('Vote', {
  transactionID: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true
  },
  voterID: {
    type: DataTypes.STRING,
    allowNull: false
  },
  candidateID: {
    type: DataTypes.STRING,
    allowNull: false
  },
  constituencyID: {
    type: DataTypes.STRING,
    allowNull: false
  },
  encryptedVote: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = Vote;

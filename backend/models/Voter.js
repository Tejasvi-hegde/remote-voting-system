const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Voter = sequelize.define('Voter', {
  voterID: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  constituencyId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  constituencyName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  constituencyState: {
    type: DataTypes.STRING,
    allowNull: true
  },
  hasVoted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  votedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  votedAtTerminal: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = Voter;

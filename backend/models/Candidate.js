const mongoose = require('mongoose');

/**
 * Candidate Schema
 * Stores candidates per constituency.
 * The ballot is dynamically loaded based on the voter's constituency.
 */
const candidateSchema = new mongoose.Schema(
  {
    candidateID: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    party: { type: String, required: true, trim: true },
    partySymbol: { type: String, trim: true },     // emoji or image URL
    constituencyID: { type: String, required: true },
    constituencyName: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

candidateSchema.index({ constituencyID: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);

const mongoose = require('mongoose');

/**
 * Voter Schema
 * Stores pre-registered voter information.
 * biometricHash is SHA-256 of the fingerprint template — the raw biometric
 * NEVER leaves the hardware device.
 */
const voterSchema = new mongoose.Schema(
  {
    voterID: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      // Indian voter ID format: 3 letters + 7 digits e.g. ABC1234567
      match: [/^[A-Z]{3}[0-9]{7}$/, 'Invalid voter ID format']
    },

    name: { type: String, required: true, trim: true },

    biometricHash: {
      type: String,
      required: true,
      // SHA-256 hex string — 64 characters
      match: [/^[a-f0-9]{64}$/, 'Invalid biometric hash']
    },

    constituency: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      state: { type: String, required: true }
    },

    hasVoted: {
      type: Boolean,
      default: false
    },

    // Timestamp when vote was cast (for audit trail)
    votedAt: {
      type: Date,
      default: null
    },

    // The terminal ID where they voted (for audit)
    votedAtTerminal: {
      type: String,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Index for fast lookup during authentication
voterSchema.index({ voterID: 1, biometricHash: 1 });

module.exports = mongoose.model('Voter', voterSchema);

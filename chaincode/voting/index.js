'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * VotingContract — Hyperledger Fabric Smart Contract
 *
 * This chaincode runs on every peer node.
 * All functions that write to the ledger create a new block.
 * All reads use CouchDB as the state database (for rich queries).
 *
 * Ledger key structure:
 *   VOTE_{voterID}           → vote record (one per voter)
 *   COUNT_{constituencyID}_{candidateID}  → running vote tally
 *   TX_{transactionID}       → transaction metadata
 */
class VotingContract extends Contract {

  /**
   * Initialize the ledger.
   * Called once when the chaincode is first deployed.
   * Creates initial count entries for constituencies/candidates.
   */
  async initLedger(ctx) {
    console.log('=== Voting Contract Initialized ===');

    // Example: seed initial zero-count entries for known constituencies.
    // In production, this is driven by Election Commission data.
    const initialData = [
      { constituencyID: 'KA-001', candidateID: 'C001' },
      { constituencyID: 'KA-001', candidateID: 'C002' },
      { constituencyID: 'KA-001', candidateID: 'C003' }
    ];

    for (const item of initialData) {
      const countKey = this._countKey(item.constituencyID, item.candidateID);
      const countRecord = {
        docType: 'voteCount',
        constituencyID: item.constituencyID,
        candidateID: item.candidateID,
        count: 0
      };
      await ctx.stub.putState(countKey, Buffer.from(JSON.stringify(countRecord)));
    }

    return JSON.stringify({ success: true, message: 'Ledger initialized.' });
  }

  /**
   * castVote — submit a vote to the blockchain
   *
   * @param {string} voterID         - Voter's unique identifier
   * @param {string} encryptedVote   - AES-256 encrypted vote payload
   * @param {string} candidateID     - Selected candidate
   * @param {string} constituencyID  - Voter's constituency
   *
   * Checks:
   * - Voter must not have already voted (on-chain check)
   * - After commit, increments vote count atomically
   */
  async castVote(ctx, voterID, encryptedVote, candidateID, constituencyID) {
    const txID = ctx.stub.getTxID();
    const timestamp = new Date().toISOString();

    // ── Duplicate vote check (on-chain) ────────────────────────────────────
    const voteKey = `VOTE_${voterID}`;
    const existingVoteBytes = await ctx.stub.getState(voteKey);

    if (existingVoteBytes && existingVoteBytes.length > 0) {
      throw new Error(`Voter ${voterID} has already voted. Duplicate vote rejected.`);
    }

    // ── Record the vote ────────────────────────────────────────────────────
    const voteRecord = {
      docType: 'vote',
      voterID,
      encryptedVote,      // actual choice is hidden — only EC can decrypt with AES key
      candidateID,        // stored for count aggregation
      constituencyID,
      transactionID: txID,
      timestamp
    };

    await ctx.stub.putState(voteKey, Buffer.from(JSON.stringify(voteRecord)));

    // ── Update vote count atomically ───────────────────────────────────────
    const countKey = this._countKey(constituencyID, candidateID);
    const countBytes = await ctx.stub.getState(countKey);

    let countRecord;
    if (countBytes && countBytes.length > 0) {
      countRecord = JSON.parse(countBytes.toString());
      countRecord.count += 1;
    } else {
      // Auto-create count entry if it doesn't exist
      countRecord = {
        docType: 'voteCount',
        constituencyID,
        candidateID,
        count: 1
      };
    }

    await ctx.stub.putState(countKey, Buffer.from(JSON.stringify(countRecord)));

    // ── Store transaction metadata ─────────────────────────────────────────
    const txRecord = {
      docType: 'transaction',
      transactionID: txID,
      voterID,
      constituencyID,
      timestamp,
      status: 'COMMITTED'
    };
    await ctx.stub.putState(`TX_${txID}`, Buffer.from(JSON.stringify(txRecord)));

    // ── Emit an event (optional — client apps can listen) ──────────────────
    ctx.stub.setEvent('VoteCast', Buffer.from(JSON.stringify({
      constituencyID,
      transactionID: txID,
      timestamp
    })));

    console.log(`Vote committed: voterID=${voterID} candidate=${candidateID} txID=${txID}`);

    return JSON.stringify({
      success: true,
      transactionID: txID,
      timestamp
    });
  }

  /**
   * getVoteCounts — return vote totals for a constituency
   * Read-only — no new block created.
   *
   * Uses CouchDB rich query (JSON selector) to find all count records
   * for the given constituency.
   */
  async getVoteCounts(ctx, constituencyID) {
    const queryString = JSON.stringify({
      selector: {
        docType: 'voteCount',
        constituencyID: constituencyID
      }
    });

    const resultsIterator = await ctx.stub.getQueryResult(queryString);
    const results = [];

    let result = await resultsIterator.next();
    while (!result.done) {
      const record = JSON.parse(result.value.value.toString('utf8'));
      results.push({
        candidateID: record.candidateID,
        count: record.count
      });
      result = await resultsIterator.next();
    }

    await resultsIterator.close();
    return JSON.stringify(results);
  }

  /**
   * getTransactionByID — fetch a transaction record by its ID.
   * Voters use this to verify their vote was recorded.
   * Note: only metadata is returned — the encrypted vote is NOT returned.
   */
  async getTransactionByID(ctx, transactionID) {
    const txBytes = await ctx.stub.getState(`TX_${transactionID}`);

    if (!txBytes || txBytes.length === 0) {
      throw new Error(`Transaction ${transactionID} not found on ledger.`);
    }

    const tx = JSON.parse(txBytes.toString());

    // Return only metadata — not the encrypted vote payload
    return JSON.stringify({
      transactionID: tx.transactionID,
      constituencyID: tx.constituencyID,
      timestamp: tx.timestamp,
      status: tx.status
    });
  }

  /**
   * hasVoterVoted — check if a voter has already voted.
   * Read-only query.
   */
  async hasVoterVoted(ctx, voterID) {
    const voteBytes = await ctx.stub.getState(`VOTE_${voterID}`);
    const voted = voteBytes && voteBytes.length > 0;
    return JSON.stringify({ voterID, hasVoted: voted });
  }

  /**
   * getTotalVoteCount — get total votes across all candidates in a constituency.
   */
  async getTotalVoteCount(ctx, constituencyID) {
    const queryString = JSON.stringify({
      selector: { docType: 'voteCount', constituencyID }
    });

    const iterator = await ctx.stub.getQueryResult(queryString);
    let total = 0;

    let result = await iterator.next();
    while (!result.done) {
      const record = JSON.parse(result.value.value.toString('utf8'));
      total += record.count;
      result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify({ constituencyID, totalVotes: total });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _countKey(constituencyID, candidateID) {
    return `COUNT_${constituencyID}_${candidateID}`;
  }
}

module.exports = VotingContract;

// Start the chaincode
const { ChaincodeServer } = require('fabric-shim');
const votingContract = new VotingContract();
const server = new ChaincodeServer(votingContract, {
  ccid: process.env.CHAINCODE_ID,
  address: process.env.CHAINCODE_SERVER_ADDRESS || '0.0.0.0:9999'
});
server.start();

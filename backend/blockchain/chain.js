const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHAIN_PATH = process.env.BLOCKCHAIN_PATH || path.join(__dirname, 'blockchain.json');

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data))
      .digest('hex');
  }
}

class Blockchain {
  constructor() {
    this.chain = [];
    this.loadFromFile();
    if (this.chain.length === 0) {
      this.chain.push(this.createGenesisBlock());
      this.saveToFile();
    }
  }

  createGenesisBlock() {
    return new Block(0, new Date().toISOString(), { message: 'Genesis Block' }, '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(data) {
    const prev = this.getLatestBlock();
    const newBlock = new Block(
      this.chain.length,
      new Date().toISOString(),
      data,
      prev.hash
    );
    this.chain.push(newBlock);
    this.saveToFile();
    return newBlock;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      const recalculated = new Block(
        current.index, current.timestamp, current.data, current.previousHash
      ).calculateHash();
      if (current.hash !== recalculated) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    return true;
  }

  hasVoted(voterID) {
    return this.chain.some(
      block => block.data && block.data.voterID === voterID
    );
  }

  getVoteCounts(constituency) {
    const counts = {};
    for (const block of this.chain) {
      if (block.data && block.data.constituency === constituency && block.data.candidateID) {
        const cid = block.data.candidateID;
        counts[cid] = (counts[cid] || 0) + 1;
      }
    }
    return counts;
  }

  getAllVotes() {
    return this.chain.filter(b => b.data && b.data.candidateID);
  }

  findByHash(txHash) {
    return this.chain.find(b => b.hash === txHash) || null;
  }

  saveToFile() {
    fs.writeFileSync(CHAIN_PATH, JSON.stringify(this.chain, null, 2));
  }

  loadFromFile() {
    if (fs.existsSync(CHAIN_PATH)) {
      try {
        const raw = fs.readFileSync(CHAIN_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        this.chain = parsed.map(b =>
          Object.assign(new Block(b.index, b.timestamp, b.data, b.previousHash), { hash: b.hash })
        );
      } catch {
        this.chain = [];
      }
    }
  }
}

const blockchain = new Blockchain();
module.exports = blockchain;

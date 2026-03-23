const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

/**
 * Fabric Network Helper
 * Manages connections to the Hyperledger Fabric peer network.
 * Implements connection pooling — one gateway per process.
 */

let gateway = null;
let network = null;

/**
 * Load the connection profile JSON.
 * This file describes peers, orderers, CAs, and TLS certificates.
 */
function loadConnectionProfile() {
  const profilePath = path.resolve(process.env.FABRIC_CONNECTION_PROFILE);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Connection profile not found at: ${profilePath}`);
  }
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

/**
 * Load (or create) the wallet containing user identities.
 * The wallet stores the enrolled user's certificate and private key.
 */
async function loadWallet() {
  const walletPath = path.resolve(process.env.FABRIC_WALLET_PATH || './fabric/wallet');
  return await Wallets.newFileSystemWallet(walletPath);
}

/**
 * Enroll the Fabric admin user and save credentials to wallet.
 * Run once during initial setup.
 */
async function enrollAdmin() {
  const connectionProfile = loadConnectionProfile();
  const wallet = await loadWallet();

  // Check if admin is already enrolled
  const identity = await wallet.get(process.env.FABRIC_ADMIN_ID);
  if (identity) {
    console.log('Admin already enrolled in wallet.');
    return;
  }

  // Find CA URL from connection profile
  const caInfo = connectionProfile.certificateAuthorities[
    Object.keys(connectionProfile.certificateAuthorities)[0]
  ];
  const caTLSCACerts = caInfo.tlsCACerts.pem;
  const ca = new FabricCAServices(
    caInfo.url,
    { trustedRoots: caTLSCACerts, verify: false },
    caInfo.caName
  );

  // Enroll admin
  const enrollment = await ca.enroll({
    enrollmentID: process.env.FABRIC_ADMIN_ID,
    enrollmentSecret: process.env.FABRIC_ADMIN_SECRET
  });

  const identity2 = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    },
    mspId: process.env.FABRIC_MSP_ID,
    type: 'X.509'
  };

  await wallet.put(process.env.FABRIC_ADMIN_ID, identity2);
  console.log('✅ Admin enrolled and saved to wallet.');
}

/**
 * Get the smart contract (chaincode) instance.
 * Establishes gateway connection if not already connected.
 */
async function getContract() {
  if (network) {
    return network.getContract(process.env.FABRIC_CHAINCODE_NAME);
  }

  const connectionProfile = loadConnectionProfile();
  const wallet = await loadWallet();

  // Ensure admin identity exists
  const identity = await wallet.get(process.env.FABRIC_ADMIN_ID);
  if (!identity) {
    throw new Error('Admin identity not found in wallet. Run enrollAdmin() first.');
  }

  gateway = new Gateway();
  await gateway.connect(connectionProfile, {
    wallet,
    identity: process.env.FABRIC_ADMIN_ID,
    discovery: { enabled: true, asLocalhost: true }
  });

  network = await gateway.getNetwork(process.env.FABRIC_CHANNEL_NAME);
  console.log(`✅ Connected to Fabric channel: ${process.env.FABRIC_CHANNEL_NAME}`);

  return network.getContract(process.env.FABRIC_CHAINCODE_NAME);
}

/**
 * Disconnect from the gateway gracefully.
 */
async function disconnect() {
  if (gateway) {
    gateway.disconnect();
    gateway = null;
    network = null;
  }
}

// Disconnect cleanly on process exit
process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);

module.exports = { getContract, enrollAdmin, disconnect };

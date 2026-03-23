# Location Independent Blockchain-Based Secure Voting System
**Team 282 | RV College of Engineering | IDP Sem 6**

---

## Project Overview
Allows migrant voters, students, and out-of-constituency citizens to vote
from any authorized Remote Voting Centre using biometric authentication
and Hyperledger Fabric blockchain for tamper-proof vote storage.

---

## Project Structure
```
voting-system/
├── backend/              Node.js + Express API server
│   ├── models/           MongoDB schemas (Voter, Candidate)
│   ├── routes/           API routes (auth, voter, vote, dashboard)
│   ├── middleware/        JWT auth middleware
│   ├── fabric/           Hyperledger Fabric network connector
│   ├── server.js         Entry point
│   └── seed.js           Test data seeder
│
├── chaincode/voting/     Hyperledger Fabric smart contract
│   └── index.js          VotingContract (castVote, getVoteCounts...)
│
├── frontend/src/
│   ├── pages/            AuthScreen, BallotScreen, ConfirmScreen, Dashboard
│   ├── api/              Axios API client
│   └── App.jsx           Router + token initialization
│
├── hardware/             Raspberry Pi code (EC student)
│   ├── enroll.py         One-time voter fingerprint enrollment
│   └── biometric.py      Main terminal voting script
│
├── network/              Hyperledger Fabric network config
│   └── network-setup.sh  Automated network bootstrap script
│
└── docker/
    └── docker-compose.yml  Full system orchestration
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + React Router |
| Backend | Node.js + Express.js |
| Database | MongoDB (voter registry) |
| Blockchain | Hyperledger Fabric 2.5 |
| Smart Contract | JavaScript Chaincode |
| State DB | CouchDB (vote counts via Fabric) |
| Biometric | R307/AS608 fingerprint sensor (UART) |
| Hardware | Raspberry Pi 4 |
| Encryption | AES-256 (votes) + SHA-256 (biometric hash) |
| Auth | JWT (15-min sessions) |
| Containers | Docker + Docker Compose |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- Docker Desktop + Docker Compose
- Python 3.9+ (on Raspberry Pi)
- Go v1.21+ (for Fabric tools)
- Hyperledger Fabric binaries: https://hyperledger-fabric.readthedocs.io

### 1. Clone and install dependencies
```bash
git clone <your-repo>
cd voting-system

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Chaincode
cd chaincode/voting && npm install && cd ../..
```

### 2. Configure environment variables
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET and VOTE_ENCRYPTION_KEY
```

### 3. Start Docker services
```bash
docker-compose -f docker/docker-compose.yml up -d mongodb couchdb
```

### 4. Seed test data
```bash
cd backend
node seed.js
```

### 5. Bootstrap Fabric network
```bash
# Install Fabric binaries first if not done:
# curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.6

cd network
chmod +x network-setup.sh
./network-setup.sh
```

### 6. Enroll admin and start backend
```bash
cd backend
node -e "require('./fabric/network').enrollAdmin().then(() => console.log('Done'))"
npm start
```

### 7. Start frontend
```bash
cd frontend
npm start
# Opens on http://localhost:3000
```

### 8. Setup Raspberry Pi terminal
```bash
# On the Pi
pip3 install -r hardware/requirements.txt

# Enable UART in /boot/config.txt:
# enable_uart=1

# Enroll test voters
python3 hardware/enroll.py

# Start voting terminal
export BACKEND_URL=http://YOUR_SERVER_IP:5000
export FRONTEND_URL=http://YOUR_SERVER_IP:3000
export TERMINAL_ID=RVC-1
python3 hardware/biometric.py
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Pre-register voter with biometric hash |
| POST | `/api/auth/verify` | Authenticate voter (returns JWT) |
| GET | `/api/voter/ballot` | Get candidate list (JWT required) |
| POST | `/api/vote/cast` | Submit vote to blockchain (JWT required) |
| GET | `/api/dashboard/results/:id` | Vote counts per constituency |
| GET | `/api/dashboard/stats` | Turnout statistics |
| GET | `/api/dashboard/transaction/:txID` | Verify a transaction |

---

## Voting Flow

```
Pi captures fingerprint
       ↓
SHA-256 hash computed locally
       ↓
POST /api/auth/verify (voterID + hash + terminalID)
       ↓
MongoDB checks voter + duplicate prevention
       ↓
JWT token issued (15-min expiry)
       ↓
React ballot loads (constituency candidates from JWT)
       ↓
Voter selects candidate → Confirm screen
       ↓
POST /api/vote/cast → AES-256 encrypt vote
       ↓
Hyperledger Fabric chaincode castVote()
  → On-chain duplicate check
  → Vote stored in ledger
  → CouchDB vote count incremented
  → MongoDB voter.hasVoted = true
       ↓
Transaction ID returned to voter
```

---

## EC Student Contributions
- Raspberry Pi 4 hardware setup and UART wiring
- R307 fingerprint sensor integration (enroll.py, biometric.py)
- SHA-256 biometric hashing pipeline
- Local SQLite offline vote buffer and sync
- Terminal kiosk mode (Chromium fullscreen)
- Voter ID barcode scanner integration

## CS Student Contributions
- Hyperledger Fabric network configuration and chaincode
- Node.js backend (auth, voter, vote, dashboard APIs)
- MongoDB schema design
- React.js frontend (3-screen voting flow + EC dashboard)
- JWT session management and AES-256 vote encryption
- Docker containerization

---

## Security Features
1. **Biometric auth**: SHA-256 fingerprint hash — raw biometric never leaves the Pi
2. **Duplicate prevention**: Double-checked in both MongoDB AND blockchain chaincode
3. **Vote secrecy**: AES-256 encrypted votes on ledger — only EC can decrypt
4. **Session security**: JWT expires in 15 minutes; cleared after vote
5. **Rate limiting**: 10 auth attempts per 15 min per IP
6. **Timing-safe comparison**: `crypto.timingSafeEqual` prevents timing attacks
7. **TLS everywhere**: All Fabric peer communication uses TLS

---

## Team
| Name | Program | USN |
|------|---------|-----|
| Tejasvi Vasant Hegde | CSE | 1RV23CS272 |
| GC Nikhil | CSE | 1RV23CS089 |
| Rohit N Katti | ECE | 1RV23EC123 |
| Sarath Sanjay S | ECE | 1RV23EC132 |

**Guide**: Dr. N S Narahari, Visiting Professor, IEM Department  
**Institution**: RV College of Engineering, Bengaluru

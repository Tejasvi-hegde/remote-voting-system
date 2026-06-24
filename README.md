# Location Independent Blockchain-Based Secure Voting System
**Team 282 | RV College of Engineering | IDP Sem 6**

---

## Project Overview
Allows out-of-constituency citizens, students, and migrant voters to securely cast their votes from any authorized Remote Voting Centre (RVC). Authentication is performed using face-recognition biometrics, and votes are secured on a custom tamper-proof file-persisted JS Blockchain.

---

## Project Structure
```
voting-system/
├── backend/              Node.js + Express API server
│   ├── db/               MySQL database schemas & initialization (mysql.js)
│   ├── routes/           API routes (auth, voter, vote, dashboard, admin)
│   ├── middleware/       JWT auth middleware
│   ├── blockchain/       Custom JS Blockchain ledger implementation (chain.js)
│   ├── server.js         Laptop backend entry point
│   └── seed.js           Mock database seeder (also cleans blockchain.json)
│
├── frontend/src/         React.js Web App
│   ├── pages/            AuthScreen (Face Scan Pi), Dashboard, Results
│   ├── api/              Axios API client
│   └── App.jsx           Router + token initialization
│
├── hardware/             Raspberry Pi 5/4 Interactive Terminal
│   ├── pi_server.py      HTTP server & main voting terminal (captures face, showcases ballot, posts votes)
│   ├── candidates.json   Local candidate directory mapped by constituency
│   └── implementation.md Detailed Raspberry Pi setup & GPIO connection guide
│
└── README.md             This documentation file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js (Vite) + Vanilla CSS |
| **Backend** | Node.js + Express.js |
| **Database** | MySQL (mysql2) |
| **Blockchain** | Custom JS Blockchain, file-persisted as `blockchain.json` |
| **Biometric** | Facial Recognition via Face-API / Custom 128-d Embeddings |
| **Hardware** | Raspberry Pi 5 / 4 |
| **Display** | 1.3" I2C OLED Display (SH1106 / SSD1306) |
| **Input** | 8-Button GPIO Push Button Module (Buttons 1-8) |
| **Encryption** | AES-256 (Votes) + SHA-256 (Blockchain Blocks) |
| **Auth** | JWT (15-min sessions) |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MySQL Server (installed and running locally on Laptop)
- Python 3.9+ (on Raspberry Pi)

### 1. Clone & Laptop Setup
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <your-repo>
   cd remote-voting-system
   ```
2. Install laptop backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Configure your local database and environment in `backend/.env` (using `backend/.env.example` as a template). Make sure to set:
   ```env
   JWT_SECRET=your_jwt_secret
   VOTE_ENCRYPTION_KEY=your_64_character_hex_encryption_key
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DB=voting_db
   ```
4. Seed the MySQL database and reset the blockchain ledger:
   ```bash
   node seed.js
   ```
5. Start the laptop backend server:
   ```bash
   node server.js
   ```
6. Start the operator dashboard UI:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

### 2. Raspberry Pi Setup
Detailed step-by-step instructions (including wiring diagrams) can be found in the [implementation.md](file:///d:/voting_nikhil/remote-voting-system/hardware/implementation.md) file.
1. Move the `hardware/` directory to the Raspberry Pi.
2. Enable the I2C interface on the Pi via `sudo raspi-config` -> Interface Options.
3. Install system requirements and set up a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. Connect the I2C OLED Display and the 8 Push Buttons module to the specified GPIO pins (see [implementation.md](file:///d:/voting_nikhil/remote-voting-system/hardware/implementation.md)).
5. Start the Pi interactive server:
   ```bash
   python pi_server.py
   ```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/api/auth/verify-face-pi` | Triggers Pi camera capture, extracts face embeddings, performs verification, and starts the Pi showcase. |
| **POST** | `/api/vote/cast-pi` | Receives ballot button clicked index from Pi, encrypts candidate selection, and records it on the blockchain. |
| **GET** | `/api/admin/voter/lookup/:voterID` | Fetch voter information from database. |
| **POST** | `/api/admin/voter/register-face` | Saves base64 photo and registers a voter's face embedding. |
| **GET** | `/api/dashboard/results/:constituency` | Fetch live vote counts from blockchain. |
| **GET** | `/api/dashboard/stats` | Fetch system turnout statistics. |
| **GET** | `/api/dashboard/blockchain` | Fetch all blocks in the blockchain ledger. |

---

## End-to-End Hybrid Voting Flow

```
   Laptop Dashboard: Operator initiates "Face Scan (Pi)" 
                       ↓
   Laptop Backend calls GET http://<PI_IP>:5002/capture
                       ↓
   Pi Server captures camera photo and returns base64 string
                       ↓
   Laptop Backend matches face embeddings via Cosine Distance 
                       ↓
   If match -> Laptop issues JWT & calls POST http://<PI_IP>:5002/showcase
                       ↓
   Pi Screen showcases voter details & waits for YES (Btn 1)
                       ↓
   Pi Screen showcases candidate ballot (sorted list from candidates.json)
                       ↓
   Voter selects Candidate (Btn 3-7) or NOTA (Btn 8) & confirms with YES (Btn 1)
                       ↓
   Pi Server posts choice back to Laptop: POST /api/vote/cast-pi
                       ↓
   Laptop encrypts vote with AES-256 and appends blocks to ledger (blockchain.json)
                       ↓
   MySQL updates voters has_voted = 1, and Pi Screen displays Success!
```

---

## Team Contributions

### EC Student Contributions
- Raspberry Pi hardware setup, CSI/Webcam camera driver interface, and I2C OLED connection wiring.
- GPIO button mapping and input loop implementation in `pi_server.py`.
- Base64 image capturing and optimization for standard USB Logitech webcams.

### CS Student Contributions
- Node.js backend (face verification, blockchain construction, database schema design, and administration APIs).
- Customized cryptographic module implementing AES-256 CBC vote encryption.
- React.js frontend web app featuring dashboard metrics and interactive biometric triggering.

---

## Security Features
1. **Facial Cosine Similarity Match**: Bypasses traditional plaintext passwords, performing 128-d vector matching on the backend.
2. **Double-Spend Prevention**: Voters are double-checked on both the MySQL relational database (`has_voted` column) and the blockchain ledger (`voterID` block presence check) before casting is allowed.
3. **Vote Secrecy**: The voter status block and actual candidate choice blocks are written to the ledger as two separate, decoupled events, ensuring individual choices cannot be linked back to a specific voter.
4. **AES-256 CBC Encryption**: Votes are encrypted with a secure 32-byte secret key on the blockchain.

---

## Team RVCE
| Name | Program | USN |
|------|---------|-----|
| Tejasvi Vasant Hegde | CSE | 1RV23CS272 |
| GC Nikhil | CSE | 1RV23CS089 |
| Rohit N Katti | ECE | 1RV23EC123 |
| Sarath Sanjay S | ECE | 1RV23EC132 |

**Guide**: Dr. N S Narahari, IEM Department  
**Institution**: RV College of Engineering, Bengaluru

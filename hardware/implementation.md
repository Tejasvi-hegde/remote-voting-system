# Raspberry Pi Voting Terminal — End-to-End Implementation Guide

This guide provides the complete setup, wiring, network configuration, and file structure required to deploy the **Remote Voting System's Hardware Terminal** on a Raspberry Pi (designed for Raspberry Pi 4/5).

---

## 1. Needed Files in the `hardware/` Folder

The Raspberry Pi requires only a specific subset of files from the repository to run:

1. **`pi_server.py` (Core)**: 
   - Exposes a Flask-like HTTP server (via standard `http.server`) on port `5002`.
   - Exposes `GET /capture` to snap face images from a USB webcam/CSI camera and return them in base64 format.
   - Exposes `POST /showcase` to receive voter details from the laptop, initialize the candidate selection screen, read GPIO button inputs, and post the voter's choice back to the laptop server.
2. **`candidates.json` (Local Directory)**:
   - Houses the local directory of candidates mapped by constituency. The list order matches the laptop database sorting so indices are consistent.
3. **`requirements.txt` (Dependencies)**:
   - List of Python libraries required for OLED displays, button inputs, networking, and camera controls.

> [!NOTE]
> `camera_server.py`, `register_face.py`, and `voting_terminal.py` are legacy scripts from previous iterations. They are superseded entirely by the laptop browser interface (for registration) and `pi_server.py` (for voting).

---

## 2. Raspberry Pi Setup Instructions

### Step A: Install Raspberry Pi OS
1. Download the **Raspberry Pi Imager** tool on your laptop.
2. Flash **Raspberry Pi OS (64-bit)** (Desktop or Lite version) onto a high-speed MicroSD card.
3. Insert the card into the Raspberry Pi 5.

### Step B: Enable Hardware Interfaces
Open the terminal on the Raspberry Pi and run:
```bash
sudo raspi-config
```
- Navigate to **Interface Options** -> **I2C** -> Enable it.
- Navigate to **Interface Options** -> **VNC** or **SSH** -> Enable SSH (useful for remote command-line control).
- Reboot the Pi: `sudo reboot`

### Step C: Install System Libraries
Update system packages and install OpenCV and development headers:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv git
sudo apt-get install -y libopencv-dev python3-opencv
```

### Step D: Setup Virtual Environment & Install Dependencies
1. Create a workspace folder on the Pi and transfer the `hardware` files:
   ```bash
   mkdir ~/voting_hardware
   cd ~/voting_hardware
   ```
2. Set up a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install the dependencies listed in `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```

---

## 3. Hardware Connections (Wiring Guide)

The terminal uses a **1.3" I2C OLED Display** and an **8-Button Push Module**.

### Connection Pinout Table

| Hardware Module | Module Pin | Raspberry Pi Pin Name | Pi Physical Pin Number |
| :--- | :--- | :--- | :--- |
| **OLED Display** | VCC | 3.3V Power | Pin 1 |
| **OLED Display** | GND | Ground | Pin 9 |
| **OLED Display** | SDA | I2C1 SDA (GPIO 2) | Pin 3 |
| **OLED Display** | SCL | I2C1 SCL (GPIO 3) | Pin 5 |
| **8-Button Module** | GND | Ground | Pin 14 (or any GND pin) |
| **Button 1 (YES / Confirm)** | K1 | GPIO 17 | Pin 11 |
| **Button 2 (NO / Cancel)** | K2 | GPIO 27 | Pin 13 |
| **Button 3 (Candidate 1)** | K3 | GPIO 22 | Pin 15 |
| **Button 4 (Candidate 2)** | K4 | GPIO 23 | Pin 16 |
| **Button 5 (Candidate 3)**| K5 | GPIO 24 | Pin 18 |
| **Button 6 (Candidate 4)** | K6 | GPIO 25 | Pin 22 |
| **Button 7 (Candidate 5)** | K7 | GPIO 5 | Pin 29 |
| **Button 8 (NOTA / None)** | K8 | GPIO 6 | Pin 31 |

*Note: Buttons use the Pi's internal pull-up configuration (`GPIO.PUD_UP`), meaning button inputs read `LOW` (0) when pressed, and `HIGH` (1) when idle.*

---

## 4. Network Configuration (Connecting Pi to Laptop)

To exchange verification tokens and vote choices, both devices must be on the **same Local Area Network (LAN)**.

### Step A: Establish Shared Network
Choose one of the following methods:
*   **Method 1 (Laptop Hotspot - Recommended)**: Enable the Wi-Fi Hotspot on your laptop. Connect your Raspberry Pi's Wi-Fi to this hotspot network.
*   **Method 2 (Local Wi-Fi Router)**: Connect both the laptop and the Raspberry Pi to the same Wi-Fi router.

### Step B: Identify IP Addresses
1. **On the Laptop**:
   - Open Command Prompt/PowerShell and run `ipconfig`.
   - Find your IPv4 address (e.g., `192.168.137.1` on a hotspot connection).
2. **On the Raspberry Pi**:
   - Open terminal and run `hostname -I` or `ifconfig`.
   - Note the Pi's local IP address (e.g., `192.168.137.56`).

---

## 5. End-to-End Execution Flow

### Step 1: Start the Pi Server
Log into your Pi terminal, activate the virtual environment, and run:
```bash
source .venv/bin/activate
python pi_server.py
```
*The terminal will display ready status and wait for incoming authentication commands on port `5002`.*

### Step 2: Start the Laptop Server
On your laptop, run the backend server:
```bash
# Inside remote-voting-system/backend
node server.js
```

### Step 3: Trigger Voter Verification
1. Access the Laptop Administrator Panel Dashboard (or trigger via API).
2. Enter the Raspberry Pi's IP address (e.g. `192.168.137.56`) in the "Pi IP Address" input box and click **Face Scan**.
3. **The Laptop Backend**:
   - Calls `GET http://<PI_IP>:5002/capture` to snap the voter's photo.
   - Performs facial verification against MySQL registered voter embeddings.
   - Generates a signed JWT token.
   - Transmits voter details (EPIC, Name, Constituency, Token) to the Pi via `POST http://<PI_IP>:5002/showcase`.

### Step 4: Casting the Ballot on Pi
1. The Pi showcase screen lights up showing:
   ```
   Voter: [Voter Name]
   Area: [Constituency Name]
   Press YES (Btn1) to confirm & view ballot
   ```
2. The voter presses **Button 1 (YES)** on the EVM.
3. The OLED displays candidates for that voter's constituency.
4. The voter presses a candidate button (**Buttons 3-7** or **Button 8** for NOTA).
5. The OLED shows a choice confirmation. The voter confirms by pressing **Button 1 (YES)**.
6. The Pi makes a secure POST request back to the laptop backend:
   ```http
   POST http://<LAPTOP_IP>:5001/api/vote/cast-pi
   Headers: Authorization: Bearer <JWT>
   Body: { "clickedNumber": <button_number> }
   ```
7. The Laptop Backend processes the vote, records the transaction hash on the blockchain, updates MySQL, and returns a successful transaction ID.
8. The Pi EVM display flashes `[OK] VOTE RECORDED!` and returns to idle.

---

## 6. Device & Resolution Mismatch Handling

The system is designed to support cross-device face verification:
- **Registration**: Occurs on the Laptop using the laptop's high-resolution webcam (typically 720p or 1080p) or a high-quality photo file upload.
- **Verification**: Occurs on the Raspberry Pi 5 using a standard USB webcam (e.g., 240p/480p) or a CSI camera module.

### How it Works:
1. **Resizing & Optimization**: The backend python helper automatically detects image dimensions and resizes any high-resolution image to a standard maximum bounding box of `800x800` pixels before processing. This prevents CPU bottlenecks and memory consumption on the server.
2. **Device-Independent Face Embeddings**: Face detection and recognition algorithms (such as the deep learning models used by `face_recognition`) extract a 128-dimensional floating-point vector based on relative facial landmark positions. Since the face image is internally cropped and normalized to a fixed size (e.g., 150x150 pixels) before vector calculation, variations in capture hardware, resolution, lens aspect ratios, or lighting do *not* impact the validity of the computed Euclidean or Cosine distance comparison.


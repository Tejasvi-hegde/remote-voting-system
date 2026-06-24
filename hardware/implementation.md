# Raspberry Pi Voting Terminal — End-to-End Implementation Guide

This guide provides the complete setup, wiring, network configuration, code deployment, and SSH setup required to deploy the **Remote Voting System's Hardware Terminal** on a Raspberry Pi (designed for Raspberry Pi 4/5).

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

## 2. Raspberry Pi Setup Instructions (Headless Setup & SSH)

To set up the Raspberry Pi 4 or 5 without needing a dedicated monitor, keyboard, or mouse, follow this headless guide.

### Step A: Flash Raspberry Pi OS with Custom Settings
1. Download and open the **Raspberry Pi Imager** on your laptop.
2. Select **Raspberry Pi Device** (e.g. Raspberry Pi 5 or 4) and select **Raspberry Pi OS (64-bit)** (Lite or Desktop version).
3. Select your MicroSD Card.
4. Click **Next**. When asked to apply OS customization settings, click **Edit Settings**:
   - **General Tab**:
     - Check **Set hostname** (e.g. `raspberrypi`).
     - Check **Set username and password** (e.g., username `pi`, password `raspberry`).
     - Check **Configure wireless LAN**: Input your Laptop Hotspot's Wi-Fi name (SSID) and Password so the Pi connects to it automatically on boot.
   - **Services Tab**:
     - Check **Enable SSH** and select **Use password authentication**.
5. Save the configuration and click **Yes** to write/flash the MicroSD card.
6. Once complete, insert the card into the Raspberry Pi and power it on.

### Step B: Connect to the Pi via SSH
1. Turn on the Wi-Fi Hotspot on your laptop (or connect both devices to the same router).
2. Power on the Raspberry Pi. Wait 1–2 minutes for it to boot and connect to the Wi-Fi.
3. Find the Pi's IP address:
   - Go to your laptop's Hotspot settings page to see connected devices. Note down the IP address of the Pi (e.g., `192.168.137.56`).
   - Alternatively, open PowerShell / Terminal on your laptop and ping the hostname:
     ```powershell
     ping raspberrypi.local
     ```
4. Establish an SSH session from your laptop terminal:
   ```bash
   ssh pi@192.168.137.56
   ```
   *(Replace `192.168.137.56` with the Pi's actual IP. Enter the password `raspberry` when prompted.)*

### Step C: Enable Hardware Interfaces via SSH
Inside your SSH session, run the configuration utility:
```bash
sudo raspi-config
```
1. Use arrow keys to navigate to **Interface Options** and press Enter.
2. Select **I2C** and choose **Yes** to enable the I2C interface.
3. Select **Finish** to exit.
4. Reboot the Pi to apply changes:
   ```bash
   sudo reboot
   ```
5. Wait 1 minute and re-establish your SSH session:
   ```bash
   ssh pi@192.168.137.56
   ```

### Step D: Install System Libraries (On the Raspberry Pi via SSH)
Update system packages and install Python development dependencies and OpenCV on the Pi:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv git
sudo apt-get install -y libopencv-dev python3-opencv
```

---

## 3. Code Deployment (Copying Files to Pi)

To copy the `hardware` files from your laptop to the Raspberry Pi over the Wi-Fi connection, run this command from the **Laptop's Terminal** (outside the SSH session):

```powershell
# Run this from the root of remote-voting-system directory on your laptop
scp -r ./hardware pi@192.168.137.56:~/voting_hardware
```
*(Replace `192.168.137.56` with the Pi's actual IP).*

Once completed:
1. Return to your **SSH session** on the Pi.
2. Navigate to the copied folder:
   ```bash
   cd ~/voting_hardware/hardware
   ```
3. Set up a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 4. Hardware Connections (Wiring Guide)

The terminal uses a **1.3" I2C OLED Display** (SH1106 or SSD1306) and an **8-Button Push Module**.

### Wiring Table

| Hardware Module | Module Pin | Raspberry Pi Pin Name | Pi Physical Pin Number |
| :--- | :--- | :--- | :--- |
| **OLED Display** | VCC | 3.3V Power | Pin 1 |
| **OLED Display** | GND | Ground | Pin 9 |
| **OLED Display** | SDA | I2C1 SDA (GPIO 2) | Pin 3 |
| **OLED Display** | SCL | I2C1 SCL (GPIO 3) | Pin 5 |
| **8-Button Module** | GND | Ground | Pin 14 (or any GND pin) |
| **Button 1 (Candidate 1)** | K1 | GPIO 17 | Pin 11 |
| **Button 2 (Candidate 2)** | K2 | GPIO 27 | Pin 13 |
| **Button 3 (Candidate 3)** | K3 | GPIO 22 | Pin 15 |
| **Button 4 (Candidate 2)** | K4 | GPIO 23 | Pin 16 |
| **Button 5 (Candidate 5)** | K5 | GPIO 24 | Pin 18 |
| **Button 6 (NOTA / None)**  | K6 | GPIO 25 | Pin 22 |
| **Button 7 (YES / Confirm)**| K7 | GPIO 5  | Pin 29 |
| **Button 8 (NO / Cancel)**  | K8 | GPIO 6  | Pin 31 |

*Note: Buttons use the Pi's internal pull-up configuration (`GPIO.PUD_UP`), meaning button inputs read `LOW` (0) when pressed, and `HIGH` (1) when idle.*

---

## 5. End-to-End Execution Flow

Ensure your Laptop and Raspberry Pi are connected to the same local hotspot.

### Step 1: Setup & Seed Database on Laptop
1. Open PowerShell or Command Prompt on the Laptop.
2. Run the launcher script:
   ```cmd
   run.bat
   ```
3. Choose **Option [3] Seed Database**. This automatically initializes the MySQL `voting_db` database, deletes any old `blockchain.json` blocks, and seeds candidates and 50 mock voters.

### Step 2: Start Laptop Servers
1. On the `run.bat` menu, choose **Option [4] Start System Locally**.
2. This will open two new terminal windows:
   - **Voting Backend**: Running Node.js on `http://localhost:5001`.
   - **Voting Frontend**: Running React on `http://localhost:3000`.

### Step 3: Register a Voter (Using Laptop Camera)
1. Open your laptop browser and navigate to the admin panel: `http://localhost:3000/admin` (or click Admin Panel tab).
2. Enter a Voter ID EPIC code (e.g. `IND0000002` or `IND0000003`) and click **Lookup Voter**.
3. Scroll to the **Capture Face Biometrics** section:
   - Click **Use Laptop Webcam**.
   - Align your face in front of the laptop's built-in camera and click **Capture Photo**.
   - Click **Register & Link Face with Voter ID**.
   - *This generates a 128-d face embedding on the laptop backend and saves it to MySQL under the voter's profile.*

### Step 4: Start Pi Terminal Server
1. Go to your SSH session on the Raspberry Pi and ensure your camera (USB Webcam or CSI) is plugged in.
2. Run the Pi server script inside the virtual environment:
   ```bash
   source .venv/bin/activate
   python pi_server.py
   ```
   *(The OLED screen will light up showing `Ready for Authentication`)*

### Step 5: Perform Face Verification (Voter Login)
1. On the Laptop Browser, go to the Voter Authentication screen: `http://localhost:3000/` (or click Authenticate tab).
2. The system automatically routes connections to the Pi using its hostname `raspberrypi.local` (removing the need to configure IP addresses in the UI).
3. Click **Capture & Verify Face**.
4. **The Laptop Backend**:
   - Makes a request to the Pi server at `http://raspberrypi.local:5002/capture`.
   - Snaps the voter's face photo from the camera connected to the Pi.
   - Calculates the 128-d vector distance against the registered Laptop face embedding.
   - If verified, creates a signed session JWT and posts voter details to the Pi at `http://raspberrypi.local:5002/showcase`.

### Step 6: Cast Ballot on Pi EVM Terminal
1. The Raspberry Pi OLED display lights up showing:
   ```
   Voter: [Voter Name]
   Area: [Constituency Name]
   Press YES (Btn7) to confirm & view ballot
   ```
2. The voter presses **Button 7 (YES)** (or presses the key `y` on the Pi simulator terminal) to proceed.
3. The OLED displays candidates for that constituency.
4. The voter presses a candidate button (**Button 1-5** or **Button 6** for NOTA) on the Pi terminal (or numbers `1-5` / `6` on the keyboard).
5. The OLED shows a choice confirmation (e.g., `Vote for: Prakash Raj`).
6. The voter confirms by pressing **Button 7 (YES)** (or key `y` on the simulator) or cancels by pressing **Button 8 (NO)** (or key `n`).
7. The Pi automatically posts the choice back to the Laptop Backend (`POST /api/vote/cast-pi`).
8. The Laptop records the vote in the custom blockchain ledger (`blockchain.json`), marks `has_voted = 1` in MySQL, and returns a transaction hash.
9. The Pi terminal screen flashes `[OK] VOTE RECORDED!`, sounds a beep, and returns to idle state.

---

## 6. Device & Resolution Mismatch Handling

The system is designed to support cross-device face verification:
- **Registration**: Occurs on the Laptop using the laptop's high-resolution webcam (typically 720p or 1080p) or a high-quality photo file upload.
- **Verification**: Occurs on the Raspberry Pi 5 using a standard USB webcam (e.g., 240p/480p) or a CSI camera module.

### How it Works:
1. **Resizing & Optimization**: The backend python helper automatically detects image dimensions and resizes any high-resolution image to a standard maximum bounding box of `800x800` pixels before processing. This prevents CPU bottlenecks and memory consumption on the server.
2. **Device-Independent Face Embeddings**: Face detection and recognition algorithms (such as the deep learning models used by `face_recognition`) extract a 128-dimensional floating-point vector based on relative facial landmark positions. Since the face image is internally cropped and normalized to a fixed size (e.g., 150x150 pixels) before vector calculation, variations in capture hardware, resolution, lens aspect ratios, or lighting do *not* impact the validity of the computed Euclidean or Cosine distance comparison.

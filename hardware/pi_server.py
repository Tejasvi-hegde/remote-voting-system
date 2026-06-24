#!/usr/bin/env python3
"""
pi_server.py — Raspberry Pi 5 Interactive Voting Terminal Server
================================================================
Runs a lightweight HTTP server on the Raspberry Pi (Port 5002).
Handles three primary functions:
1. Capture: Captures face photo (webcam/CSI) and sends base64 image back.
2. Voter Showcase: Receives voter details (POST /showcase), showcases candidates on OLED/console.
3. Send Data: Reads clicked candidate button and transmits choice back to laptop server.

Includes simulation mode for physical hardware-free running.
"""

import sys
import os
import json
import base64
import time
import subprocess
import threading
import queue
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler

# Reconfigure stdout/stderr encoding to UTF-8 on Windows to prevent encoding crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Input queue for terminal keyboard simulation
input_queue = queue.Queue()

def stdin_reader():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            char = line.strip().lower()
            if char:
                input_queue.put(char)
        except Exception:
            break

# Start keyboard thread
threading.Thread(target=stdin_reader, daemon=True).start()

# ── GPIO Button Config ────────────────────────────────────────────────────────
PIN_CAND1 = 17     # Button 1
PIN_CAND2 = 27     # Button 2
PIN_CAND3 = 22     # Button 3
PIN_CAND4 = 23     # Button 4
PIN_CAND5 = 24     # Button 5
PIN_NOTA = 25      # Button 6
PIN_YES = 5        # Button 7
PIN_NO = 6         # Button 8

PINS = [PIN_CAND1, PIN_CAND2, PIN_CAND3, PIN_CAND4, PIN_CAND5, PIN_NOTA, PIN_YES, PIN_NO]

# Detect physical GPIO buttons
HAS_GPIO = False
GPIO_LIB = "simulation"
GPIO_BUTTONS = {}

# Try gpiozero first (standard and highly reliable on Raspberry Pi 5)
try:
    from gpiozero import Button as GZButton
    GPIO_BUTTONS = {
        1: GZButton(PIN_CAND1, bounce_time=0.05),
        2: GZButton(PIN_CAND2, bounce_time=0.05),
        3: GZButton(PIN_CAND3, bounce_time=0.05),
        4: GZButton(PIN_CAND4, bounce_time=0.05),
        5: GZButton(PIN_CAND5, bounce_time=0.05),
        6: GZButton(PIN_NOTA, bounce_time=0.05),
        7: GZButton(PIN_YES, bounce_time=0.05),
        8: GZButton(PIN_NO, bounce_time=0.05)
    }
    HAS_GPIO = True
    GPIO_LIB = "gpiozero"
    print("[OK] gpiozero initialized. Physical buttons configured with debouncing.")
except Exception as e1:
    # Fallback to RPi.GPIO (standard for Raspberry Pi 4 and below)
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        for pin in PINS:
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        HAS_GPIO = True
        GPIO_LIB = "RPi.GPIO"
        print("[OK] RPi.GPIO initialized. Physical buttons configured.")
    except Exception as e2:
        print(f"[WARN] GPIO libraries not available/failed (gpiozero: {e1}; RPi.GPIO: {e2}). Running buttons in SIMULATION mode.")

# Detect physical OLED display (SH1106 / SSD1306)
HAS_OLED = False
oled_device = None
try:
    from luma.core.interface.serial import i2c
    from luma.core.render import canvas
    from luma.oled.device import sh1106, ssd1306
    from PIL import ImageFont
    
    try:
        serial = i2c(port=1, address=0x3C)
        oled_device = sh1106(serial)
        HAS_OLED = True
        print("[OK] 1.3 inch I2C SH1106 OLED connected.")
    except Exception:
        serial = i2c(port=1, address=0x3C)
        oled_device = ssd1306(serial)
        HAS_OLED = True
        print("[OK] 1.3 inch I2C SSD1306 OLED connected.")
except Exception as e:
    print(f"[WARN] OLED libraries not available ({e}). Running display in SIMULATION mode.")

# ── Terminal Display Helper ───────────────────────────────────────────────────
class TerminalDisplay:
    def __init__(self):
        self.lines = ["", "", "", ""]
        if HAS_OLED:
            try:
                self.font = ImageFont.load_default()
            except Exception as e:
                print(f"[WARN] Failed to load default font: {e}")

    def show(self, line1="", line2="", line3="", line4=""):
        new_lines = [line1, line2, line3, line4]
        self.lines = new_lines
        
        # Console Display
        if sys.stdout.isatty():
            os.system('cls' if os.name == 'nt' else 'clear')
        else:
            print("\n--- SCREEN UPDATE ---")
        print("=========================================")
        print("       ECI REMOTE VOTING TERMINAL        ")
        print("=========================================")
        print("┌──────────────────────────────────────┐")
        for line in self.lines:
            centered = line.center(36)
            print(f"│ {centered} │")
        print("└──────────────────────────────────────┘")
        print("=========================================")
        print(f" [Simulation] Keys: y=YES, n=NO, 1-5=Candidates, 6=NOTA (GPIO Mode: {GPIO_LIB})")
        print("=========================================")
        
        # OLED Display using standard canvas rendering context
        if HAS_OLED:
            try:
                with canvas(oled_device) as draw:
                    # Draw a bounding box for aesthetics
                    draw.rectangle(oled_device.bounding_box, outline="white", fill="black")
                    # Draw the text lines
                    draw.text((8, 4), line1, font=self.font, fill="white")
                    draw.text((8, 18), line2, font=self.font, fill="white")
                    draw.text((8, 32), line3, font=self.font, fill="white")
                    draw.text((8, 46), line4, font=self.font, fill="white")
            except Exception as oled_err:
                print(f"[OLED Error] Failed to update physical OLED display: {oled_err}")

display = TerminalDisplay()

# ── Input Reader ──────────────────────────────────────────────────────────────
def get_button_press():
    """
    Checks physical buttons and stdin queue.
    Returns:
        1-5: Candidate 1-5 selection
        6: NOTA selection
        7: YES / Confirm Choice
        8: NO / Cancel Choice
    """
    global HAS_GPIO
    if HAS_GPIO:
        try:
            if GPIO_LIB == "gpiozero":
                for btn_num, btn in GPIO_BUTTONS.items():
                    if btn.is_pressed:
                        time.sleep(0.2)
                        return btn_num
            elif GPIO_LIB == "RPi.GPIO":
                if GPIO.input(PIN_CAND1) == GPIO.LOW:
                    time.sleep(0.2)
                    return 1
                if GPIO.input(PIN_CAND2) == GPIO.LOW:
                    time.sleep(0.2)
                    return 2
                if GPIO.input(PIN_CAND3) == GPIO.LOW:
                    time.sleep(0.2)
                    return 3
                if GPIO.input(PIN_CAND4) == GPIO.LOW:
                    time.sleep(0.2)
                    return 4
                if GPIO.input(PIN_CAND5) == GPIO.LOW:
                    time.sleep(0.2)
                    return 5
                if GPIO.input(PIN_NOTA) == GPIO.LOW:
                    time.sleep(0.2)
                    return 6
                if GPIO.input(PIN_YES) == GPIO.LOW:
                    time.sleep(0.2)
                    return 7
                if GPIO.input(PIN_NO) == GPIO.LOW:
                    time.sleep(0.2)
                    return 8
        except Exception as ex:
            print(f"[GPIO Warning] Failed to read physical buttons ({ex}). Falling back to simulation mode.")
            HAS_GPIO = False

    try:
        char = input_queue.get_nowait()
        if char == '1':
            return 1
        if char == '2':
            return 2
        if char == '3':
            return 3
        if char == '4':
            return 4
        if char == '5':
            return 5
        if char == '6':
            return 6
        if char == 'y':
            return 7
        if char == 'n':
            return 8
    except queue.Empty:
        pass
            
    return None

# ── Camera Helper (Capture Function) ──────────────────────────────────────────
def capture_face_base64_list(count=2, interval=0.15):
    """
    Captures multiple snapshots (count) from the camera to ensure at least one high-quality,
    properly exposed and in-focus frame is obtained.
    Returns:
        list of base64 strings
    """
    mock_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    images = []
    
    # 1. OpenCV Capture (USB Webcam / standard driver)
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            # Force buffer size to 1 to flush cached dark frames
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
            
            # Auto-exposure warm-up: read 15 frames rapidly to let the sensor adapt to light
            for _ in range(15):
                cap.read()
                time.sleep(0.01)

            for _ in range(count):
                ret, frame = cap.read()
                if ret:
                    _, buffer = cv2.imencode('.jpg', frame)
                    img_b64 = base64.b64encode(buffer).decode('utf-8')
                    images.append(img_b64)
                
                # Discard 2 frames to clear internal buffer before next snapshot
                for _ in range(2):
                    cap.read()
                time.sleep(interval)
            
            cap.release()
            if images:
                return images
    except Exception as e:
        print(f"[DEBUG] OpenCV capture failed: {e}")

    # 2. libcamera Capture (Raspberry Pi CSI Camera)
    try:
        # Give the CSI sensor 1500ms to auto-expose and focus before saving
        temp_file = "/tmp/capture_face.jpg"
        result = subprocess.run([
            'libcamera-still', '-o', temp_file, '-t', '1500', 
            '--width', '320', '--height', '240', '--nopreview'
        ], capture_output=True, timeout=5)
        if result.returncode == 0 and os.path.exists(temp_file):
            with open(temp_file, 'rb') as f:
                img_data = f.read()
            os.remove(temp_file)
            return [base64.b64encode(img_data).decode('utf-8')]
    except Exception as e:
        print(f"[DEBUG] libcamera-still failed: {e}")

    return [mock_base64]

# ── Voter Showcase and Send Data Thread ───────────────────────────────────────
voting_active = False

def print_console_ballot(candidates, constituency):
    if sys.stdout.isatty():
        os.system('cls' if os.name == 'nt' else 'clear')
    print("=========================================")
    print(f"  BALLOT CONSTITUENCY: {constituency}")
    print("=========================================")
    for idx, c in enumerate(candidates):
        print(f" Button {idx + 1} -> Candidate {idx + 1}: {c['name']} ({c['party']})")
    print(" Button 6 -> NOTA (None of the Above)")
    print("=========================================")
    print(" Please press button (1-5 for candidates, 6 for NOTA)")
    print("=========================================")

def run_voting_flow(token, voter_id, name, constituency, backend_url):
    global voting_active
    voting_active = True
    print(f"\n[Pi Flow] Starting voting flow for voter: {name} (ID: {voter_id}), constituency: '{constituency}'")
    
    # Show verification success on the OLED screen immediately
    try:
        display.show(
            "VERIFICATION SUCCESS",
            f"Voter: {name[:20]}",
            "Loading ballot...",
            "Please wait..."
        )
        time.sleep(2)
    except Exception as display_err:
        print(f"[Pi Flow] Warning: Failed to display verification success: {display_err}")

    try:
        # Load candidates list from candidates.json
        try:
            candidates_path = os.path.join(os.path.dirname(__file__), 'candidates.json')
            print(f"[Pi Flow] Loading candidates list from: {candidates_path}")
            with open(candidates_path, 'r') as f:
                all_candidates = json.load(f)
        except Exception as e:
            print(f"[Pi Flow] ERROR loading candidates.json: {e}")
            display.show("SYSTEM ERROR", "Failed to load candidates", "Resetting terminal...", "")
            time.sleep(3)
            return

        candidates = all_candidates.get(constituency, [])
        print(f"[Pi Flow] Found {len(candidates)} candidates for constituency '{constituency}'")
        if not candidates:
            print(f"[Pi Flow] ERROR: No candidates found for constituency '{constituency}'")
            display.show("SYSTEM ERROR", f"No candidates for {constituency[:10]}", "Resetting terminal...", "")
            time.sleep(3)
            return

        # Flush input queue
        print("[Pi Flow] Flushing input queue...")
        while not input_queue.empty():
            try: input_queue.get_nowait()
            except queue.Empty: break

        # 1. Voter Ready Confirmation
        print("[Pi Flow] Showing Voter Ready Confirmation screen on OLED/Terminal")
        display.show(
            f"Voter: {name[:20]}",
            f"Area: {constituency[:20]}",
            "Press YES (Btn7) to",
            "confirm & view ballot"
        )
        
        ready_confirmed = False
        timeout = time.time() + 60
        while time.time() < timeout:
            press = get_button_press()
            if press is not None:
                print(f"[Pi Flow] Key/Button pressed: {press}")
            if press == 7:
                ready_confirmed = True
                print("[Pi Flow] Voter pressed YES/Confirm (Btn 7 / Key 'y')")
                break
            elif press == 8:
                print("[Pi Flow] Voter pressed NO/Cancel (Btn 8 / Key 'n')")
                display.show("VOTING CANCELLED", "Returning to start...", "", "")
                time.sleep(2)
                return
            time.sleep(0.1)

        if not ready_confirmed:
            print("[Pi Flow] Voter confirmation timed out")
            display.show("SESSION TIMEOUT", "Returning to start...", "", "")
            time.sleep(2)
            return

        # 2. Candidate Selection Loop
        print("[Pi Flow] Entering Candidate Selection Loop")
        while True:
            selected_candidate = None
            selected_idx = None
            
            while True:
                line1 = f"1: {candidates[0]['name'][:10]} | 2: {candidates[1]['name'][:10]}" if len(candidates) > 1 else f"1: {candidates[0]['name'][:10]}" if len(candidates) > 0 else ""
                line2 = f"3: {candidates[2]['name'][:10]} | 4: {candidates[3]['name'][:10]}" if len(candidates) > 3 else f"3: {candidates[2]['name'][:10]}" if len(candidates) > 2 else ""
                line3 = f"5: {candidates[4]['name'][:10]} | 6: NOTA" if len(candidates) > 4 else "6: NOTA"
                # line4 = "Btn 1-5: Cand | Btn 6: NOTA"
                
                print_console_ballot(candidates, constituency)
                display.show(line1, line2, line3)
                
                press = None
                timeout = time.time() + 60
                while time.time() < timeout:
                    press = get_button_press()
                    if press is not None:
                        print(f"[Pi Flow] Key/Button pressed during candidate selection: {press}")
                        break
                    time.sleep(0.1)
                    
                if press is None:
                    print("[Pi Flow] Candidate selection timed out")
                    display.show("SESSION TIMEOUT", "Returning to start...", "", "")
                    time.sleep(2)
                    return
                    
                if press >= 1 and press <= 5:
                    cand_idx = press - 1
                    if cand_idx < len(candidates):
                        selected_candidate = candidates[cand_idx]
                        selected_idx = cand_idx + 1
                        print(f"[Pi Flow] Selected candidate {selected_idx}: {selected_candidate['name']}")
                        break
                elif press == 6:
                    selected_candidate = {"name": "NOTA", "party": "None of the Above"}
                    selected_idx = 6
                    print("[Pi Flow] Selected NOTA (Button 6)")
                    break

            # 3. Confirm Choice
            print(f"[Pi Flow] Confirming choice: {selected_candidate['name']}")
            display.show(
                f"Vote for: {selected_candidate['name'][:18]}",
                f"Party: {selected_candidate['party'][:20]}",
                "Confirm? YES (Btn7)",
                "Cancel? NO (Btn8)"
            )
            
            confirm_press = None
            timeout = time.time() + 30
            while time.time() < timeout:
                confirm_press = get_button_press()
                if confirm_press in [7, 8]:
                    print(f"[Pi Flow] Key/Button pressed during confirm choice: {confirm_press}")
                    break
                time.sleep(0.1)
                
            if confirm_press == 7:
                print("[Pi Flow] Vote confirmed (YES / Btn 7 / Key 'y')")
                break  # Confirmed! Proceed to send.
            elif confirm_press == 8:
                print("[Pi Flow] Vote cancelled (NO / Btn 8 / Key 'n'), restarting selection")
                continue  # Re-run selection loop.
            else:
                print("[Pi Flow] Vote confirmation timed out")
                display.show("SESSION TIMEOUT", "Returning to start...", "", "")
                time.sleep(2)
                return

        # 4. Send Choice to Laptop Backend (Send Data Function)
        print(f"[Pi Flow] Sending cast vote request to backend at {backend_url}/api/vote/cast-pi")
        display.show(
            "[VOTE] SENDING CHOICE...",
            "Securing transaction",
            "Recording in ledger",
            "Please wait..."
        )
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            res = requests.post(
                f"{backend_url}/api/vote/cast-pi",
                json={"clickedNumber": selected_idx},
                headers=headers,
                timeout=15
            )
            
            if res.status_code == 200:
                res_data = res.json()
                tx_id = res_data.get("transactionID", "UNKNOWN")
                print(f"[Pi Flow] SUCCESS: Vote recorded. Transaction ID: {tx_id}")
                display.show(
                    "[OK] VOTE RECORDED!",
                    "Success! Thank you.",
                    f"Tx: {tx_id[:16]}...",
                    "Clearing session..."
                )
                time.sleep(4)
            else:
                err_msg = res.json().get("error", "Cast failed.")
                print(f"[Pi Flow] ERROR: Vote cast rejected by server (HTTP {res.status_code}): {err_msg}")
                display.show(
                    "[FAIL] SUBMIT FAILED",
                    err_msg[:30],
                    "Resetting in 3s...",
                    ""
                )
                time.sleep(3)
        except Exception as e:
            print(f"[Pi Flow] Network Cast Error: {e}")
            display.show(
                "[FAIL] NETWORK ERROR",
                "Could not reach server",
                "Resetting in 3s...",
                ""
            )
            time.sleep(3)
            
    except Exception as outer_err:
        import traceback
        print("!!! UNEXPECTED EXCEPTION IN run_voting_flow THREAD !!!")
        traceback.print_exc()
        try:
            display.show("SYSTEM ERROR", "Thread crashed", str(outer_err)[:30], "")
            time.sleep(3)
        except Exception:
            pass
            
    finally:
        print("[Pi Flow] flow run ended. Resetting to idle state.")
        reset_to_idle()

def reset_to_idle():
    global voting_active
    voting_active = False
    print("[Pi Flow] Resetting terminal to idle screen")
    display.show(
        "REMOTE VOTING TERMINAL",
        "Ready for Authentication",
        "Use Laptop Dashboard",
        "to initiate Face Scan"
    )

# ── HTTP Server Request Handler ───────────────────────────────────────────────
class PiServerHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/capture':
            print("Received camera capture request (capturing multiple frames).")
            try:
                img_list = capture_face_base64_list(count=3, interval=0.25)
                formatted_list = []
                for img in img_list:
                    if not img.startswith("data:image"):
                        img = f"data:image/jpeg;base64,{img}"
                    formatted_list.append(img)
                
                response = {
                    "success": True,
                    "faceImage": formatted_list[0],  # For backwards compatibility
                    "faceImages": formatted_list
                }
                self.send_response(200)
            except Exception as e:
                response = {
                    "success": False,
                    "error": str(e)
                }
                self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        global voting_active
        if self.path == '/showcase':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                print(f"[Pi Server] Received /showcase POST with data: {data}")
                token = data.get('token')
                voter_id = data.get('voterID')
                name = data.get('name')
                constituency = data.get('constituency')
                backend_url = data.get('backendUrl', 'http://localhost:5001')
                
                # Auto-resolve laptop's IP address based on client connection IP
                client_ip = self.client_address[0]
                print(f"[Pi Server] Incoming request from client IP: {client_ip}")
                try:
                    from urllib.parse import urlparse, urlunparse
                    parsed = urlparse(backend_url)
                    netloc = client_ip
                    if parsed.port:
                        netloc = f"{client_ip}:{parsed.port}"
                    backend_url = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
                    print(f"[Pi Server] Automatically resolved and overrode backendUrl to: {backend_url}")
                except Exception as parse_err:
                    print(f"[Pi Server] Warning: failed to parse/override backend URL: {parse_err}")
                
                if not all([token, voter_id, name, constituency]):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": "Missing parameters."}).encode('utf-8'))
                    return
                
                if voting_active:
                    self.send_response(423) # Locked
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": "Terminal is currently busy voting."}).encode('utf-8'))
                    return
                
                # Launch background voting thread
                threading.Thread(
                    target=run_voting_flow,
                    args=(token, voter_id, name, constituency, backend_url),
                    daemon=True
                ).start()
                
                self.send_response(202) # Accepted
                response = {"success": True, "message": "Showcase and ballot started."}
            except Exception as e:
                self.send_response(500)
                response = {"success": False, "error": str(e)}
                
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    port = 5002
    server = HTTPServer(('0.0.0.0', port), PiServerHandler)
    reset_to_idle()
    print("=================================================")
    print("       RASPBERRY PI INTERACTIVE SERVER           ")
    print(f"       Running on port: {port}                    ")
    print("=================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Pi server.")
        server.server_close()
        if HAS_GPIO:
            GPIO.cleanup()
        sys.exit(0)

if __name__ == '__main__':
    main()

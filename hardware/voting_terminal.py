#!/usr/bin/env python3
"""
voting_terminal.py — Raspberry Pi 5 Voting Terminal Script
===========================================================
Orchestrates the wireless voting flow using:
  1. Camera module v1.2 (via libcamera-still or OpenCV) for face capture.
  2. 1.3" I2C OLED Display (SH1106 / SSD1306) to show status and candidates.
  3. 8 Push Button Module:
     - Button 1 (GPIO 17): YES / Confirm Identity & Vote
     - Button 2 (GPIO 27): NO / Cancel Identity & Vote
     - Button 3-7 (GPIO 22, 23, 24, 25, 5): Candidate 1-5
     - Button 8 (GPIO 6): NOTA
  4. Wireless communication with the laptop server.

Includes a fully featured Simulation Mode for running on a laptop or without hardware.
"""

import sys
import os
import json
import time
import base64
import requests
import subprocess
import select
from datetime import datetime

import threading
import queue

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

# Start background thread to read stdin non-blockingly on all platforms
threading.Thread(target=stdin_reader, daemon=True).start()

# Reconfigure stdout/stderr encoding to UTF-8 on Windows to prevent encoding crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for older python versions
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5001')
TERMINAL_ID = os.environ.get('TERMINAL_ID', 'RVC-1')

# GPIO Button Pins
PIN_YES = 17       # Button 1
PIN_NO = 27        # Button 2
PIN_CAND1 = 22     # Button 3
PIN_CAND2 = 23     # Button 4
PIN_CAND3 = 24     # Button 5
PIN_CAND4 = 25     # Button 6
PIN_CAND5 = 5      # Button 7
PIN_NOTA = 6       # Button 8

PINS = [PIN_YES, PIN_NO, PIN_CAND1, PIN_CAND2, PIN_CAND3, PIN_CAND4, PIN_CAND5, PIN_NOTA]

# ── Hardware Library Imports & Detection ──────────────────────────────────────
HAS_GPIO = False
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    for pin in PINS:
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    HAS_GPIO = True
    print("[OK] RPi.GPIO initialized. Physical buttons configured.")
except Exception as e:
    print(f"[WARN] RPi.GPIO not available ({e}). Running buttons in SIMULATION mode.")

HAS_OLED = False
oled_device = None
try:
    from luma.core.interface.serial import i2c
    from luma.oled.device import sh1106, ssd1306
    from PIL import Image, ImageDraw, ImageFont
    
    # Try initializing SH1106 (common for 1.3" OLED), fallback to SSD1306
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

# ── State Machine Constants ───────────────────────────────────────────────────
STATE_IDLE = "IDLE"
STATE_VERIFYING = "VERIFYING"
STATE_CONFIRM_IDENTITY = "CONFIRM_IDENTITY"
STATE_BALLOT = "BALLOT"
STATE_CONFIRM_VOTE = "CONFIRM_VOTE"
STATE_CASTING = "CASTING"
STATE_SUCCESS = "SUCCESS"
STATE_FAILURE = "FAILURE"

# ── Terminal Display Helper ───────────────────────────────────────────────────
class TerminalDisplay:
    def __init__(self):
        self.lines = ["", "", "", ""]
        if HAS_OLED:
            # Use small standard fonts
            self.font = ImageFont.load_default()
            self.image = Image.new('1', (oled_device.width, oled_device.height))
            self.draw = ImageDraw.Draw(self.image)

    def show(self, line1="", line2="", line3="", line4=""):
        new_lines = [line1, line2, line3, line4]
        if new_lines == self.lines:
            return
        self.lines = new_lines
        
        # 1. Print to console for simulation
        if sys.stdout.isatty():
            os.system('cls' if os.name == 'nt' else 'clear')
        else:
            print("\n--- SCREEN UPDATE ---")
        print("=========================================")
        print(f"  ECI VOTING TERMINAL | {TERMINAL_ID}")
        print("=========================================")
        print("┌──────────────────────────────────────┐")
        for line in self.lines:
            # Center the line
            centered = line.center(36)
            print(f"│ {centered} │")
        print("└──────────────────────────────────────┘")
        print("=========================================")
        print(" [Sim Control] Keys: y=YES, n=NO, 1-5=Candidates, 6=NOTA")
        print("=========================================")
        
        # 2. Render to physical I2C OLED if connected
        if HAS_OLED:
            self.draw.rectangle((0, 0, oled_device.width, oled_device.height), outline=0, fill=0)
            self.draw.text((2, 2), line1, font=self.font, fill=255)
            self.draw.text((2, 17), line2, font=self.font, fill=255)
            self.draw.text((2, 32), line3, font=self.font, fill=255)
            self.draw.text((2, 47), line4, font=self.font, fill=255)
            oled_device.display(self.image)

display = TerminalDisplay()

# ── Button Input Reader ───────────────────────────────────────────────────────
def get_button_press():
    """
    Reads button presses.
    - Checks physical GPIO pins if available (active low, pull-up).
    - Checks terminal keyboard standard input for simulation mode.
    Returns:
        int: 1 (YES), 2 (NO), 3-7 (CAND 1-5), 8 (NOTA)
        None if no press
    """
    # 1. Check physical GPIO buttons
    if HAS_GPIO:
        # Check active low (pressed = False/0)
        if GPIO.input(PIN_YES) == GPIO.LOW:
            time.sleep(0.2) # debounce
            return 1
        if GPIO.input(PIN_NO) == GPIO.LOW:
            time.sleep(0.2)
            return 2
        if GPIO.input(PIN_CAND1) == GPIO.LOW:
            time.sleep(0.2)
            return 3
        if GPIO.input(PIN_CAND2) == GPIO.LOW:
            time.sleep(0.2)
            return 4
        if GPIO.input(PIN_CAND3) == GPIO.LOW:
            time.sleep(0.2)
            return 5
        if GPIO.input(PIN_CAND4) == GPIO.LOW:
            time.sleep(0.2)
            return 6
        if GPIO.input(PIN_CAND5) == GPIO.LOW:
            time.sleep(0.2)
            return 7
        if GPIO.input(PIN_NOTA) == GPIO.LOW:
            time.sleep(0.2)
            return 8

    # 2. Check terminal keyboard simulation input (non-blocking, thread-safe queue)
    try:
        char = input_queue.get_nowait()
        if char == 'y':
            return 1
        if char == 'n':
            return 2
        if char == '1':
            return 3
        if char == '2':
            return 4
        if char == '3':
            return 5
        if char == '4':
            return 6
        if char == '5':
            return 7
        if char == '6':
            return 8
    except queue.Empty:
        pass
            
    return None

# ── Camera Capture Helper ─────────────────────────────────────────────────────
def capture_face_base64():
    """
    Captures a frame using camera module.
    Tries OpenCV (Standard USB webcam like Logitech C270), falls back to libcamera-still, falls back to mock image.
    Returns:
        str: Base64-encoded image string
    """
    # Fallback mock image: 1x1 white pixel PNG
    mock_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # 1. Try OpenCV (Standard USB webcam/V4L2, e.g. Logitech C270 HD)
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
            ret, frame = cap.read()
            cap.release()
            if ret:
                _, buffer = cv2.imencode('.jpg', frame)
                return base64.b64encode(buffer).decode('utf-8')
    except Exception:
        pass

    # 2. Try libcamera-still (Raspberry Pi CSI camera module)
    try:
        temp_file = "/tmp/capture_face.jpg"
        result = subprocess.run([
            'libcamera-still', '-o', temp_file, '-t', '500', 
            '--width', '320', '--height', '240', '--nopreview'
        ], capture_output=True, timeout=5)
        
        if result.returncode == 0 and os.path.exists(temp_file):
            with open(temp_file, 'rb') as f:
                img_data = f.read()
            os.remove(temp_file)
            return base64.b64encode(img_data).decode('utf-8')
    except Exception:
        pass

    # 3. Fallback to mock image
    return mock_base64

# ── Main State Machine ────────────────────────────────────────────────────────
def run_state_machine():
    state = STATE_IDLE
    
    token = None
    voter_id = None
    voter_name = None
    constituency = None
    candidates = []
    selected_candidate = None
    
    last_scan_time = 0

    while True:
        # 1. IDLE State
        if state == STATE_IDLE:
            display.show(
                "REMOTE VOTING SYSTEM",
                "Ready to Scan Face",
                "Look at the Camera",
                "Or Press YES to simulate scan"
            )
            
            token = None
            voter_id = None
            voter_name = None
            constituency = None
            candidates = []
            selected_candidate = None
            
            press = get_button_press()
            if press == 1:
                state = STATE_VERIFYING

        # 2. VERIFYING State
        elif state == STATE_VERIFYING:
            display.show(
                "[CAM] CAPTURING FACE...",
                "Contacting Server",
                "Please stand still",
                "Analyzing biometrics"
            )
            
            face_b64 = capture_face_base64()
            
            try:
                res = requests.post(
                    f"{BACKEND_URL}/api/auth/verify-face",
                    json={"faceImage": face_b64, "terminalID": TERMINAL_ID},
                    timeout=10
                )
                
                if res.status_code == 200:
                    data = res.json()
                    token = data["token"]
                    voter_id = data["voterID"]
                    voter_name = data["name"]
                    constituency = data["constituency"]
                    candidates = data["candidates"]
                    state = STATE_CONFIRM_IDENTITY
                else:
                    err_msg = res.json().get("error", "Face not recognized.")
                    display.show(
                        "[FAIL] MATCH FAILED",
                        err_msg[:30],
                        "Resetting in 3s...",
                        ""
                    )
                    time.sleep(3)
                    state = STATE_IDLE
            except Exception as e:
                display.show(
                    "[FAIL] NETWORK ERROR",
                    "Cannot reach server",
                    "Please check WiFi",
                    "Resetting in 3s..."
                )
                print(f"Server Connection Error: {e}")
                time.sleep(3)
                state = STATE_IDLE

        # 3. CONFIRM IDENTITY State
        elif state == STATE_CONFIRM_IDENTITY:
            display.show(
                f"Voter: {voter_name}",
                f"Area: {constituency}",
                "Is this correct?",
                "Press: YES (Btn1) / NO (Btn2)"
            )
            
            press = get_button_press()
            if press == 1:
                state = STATE_BALLOT
            elif press == 2:
                display.show("TERMINAL RESET", "Incorrect identity", "Returning to start...", "")
                time.sleep(2)
                state = STATE_IDLE

        # 4. BALLOT State
        elif state == STATE_BALLOT:
            line1 = f"1: {candidates[0]['name'][:10]}" if len(candidates) > 0 else "1: [Empty]"
            line2 = f"2: {candidates[1]['name'][:10]} | 3: {candidates[2]['name'][:10]}" if len(candidates) > 2 else f"2: {candidates[1]['name'][:10]}" if len(candidates) > 1 else ""
            line3 = f"4: {candidates[3]['name'][:10]} | 5: {candidates[4]['name'][:10]}" if len(candidates) > 4 else f"4: {candidates[3]['name'][:10]}" if len(candidates) > 3 else ""
            line4 = "Btn 3-7: Cand | Btn 8: NOTA"
            
            # Console ballot visualization
            if sys.stdout.isatty():
                os.system('cls' if os.name == 'nt' else 'clear')
            else:
                print("\n--- BALLOT UPDATE ---")
            print("=========================================")
            print(f"  BALLOT CONSTITUENCY: {constituency}")
            print("=========================================")
            for idx, c in enumerate(candidates):
                print(f" Button {idx + 3} -> Candidate {idx + 1}: {c['name']} ({c['party']})")
            print(" Button 8 -> NOTA (None of the Above)")
            print("=========================================")
            print(" Please press button (3-7 for candidates, 8 for NOTA)")
            print("=========================================")
            
            if HAS_OLED:
                display.show(line1, line2, line3, line4)
            else:
                # Mock rendering by terminal display print
                display.show(line1, line2, line3, line4)

            press = get_button_press()
            if press is not None:
                if press >= 3 and press <= 7:
                    cand_idx = press - 3
                    if cand_idx < len(candidates):
                        selected_candidate = candidates[cand_idx]
                        state = STATE_CONFIRM_VOTE
                elif press == 8:
                    selected_candidate = {"candidateID": "NOTA", "name": "NOTA", "party": "None"}
                    state = STATE_CONFIRM_VOTE

        # 5. CONFIRM VOTE State
        elif state == STATE_CONFIRM_VOTE:
            display.show(
                f"Confirm vote for:",
                f"{selected_candidate['name']}",
                f"Party: {selected_candidate['party']}",
                "YES (Btn1) / NO (Btn2)"
            )
            
            press = get_button_press()
            if press == 1:
                state = STATE_CASTING
            elif press == 2:
                state = STATE_BALLOT

        # 6. CASTING State
        elif state == STATE_CASTING:
            display.show(
                "[VOTE] CASTING VOTE...",
                "Securing transaction",
                "Encrypting ledger",
                "Please wait..."
            )
            
            try:
                headers = {"Authorization": f"Bearer {token}"}
                res = requests.post(
                    f"{BACKEND_URL}/api/vote/cast",
                    json={"candidateID": selected_candidate["candidateID"]},
                    headers=headers,
                    timeout=10
                )
                
                if res.status_code == 200:
                    state = STATE_SUCCESS
                else:
                    err_msg = res.json().get("error", "Submission failed.")
                    display.show(
                        "[FAIL] CAST FAILED",
                        err_msg[:30],
                        "Resetting in 3s...",
                        ""
                    )
                    time.sleep(3)
                    state = STATE_IDLE
            except Exception as e:
                display.show(
                    "[FAIL] NETWORK ERROR",
                    "Failed to send vote",
                    "Retrying later...",
                    ""
                )
                print(f"Cast Connection Error: {e}")
                time.sleep(3)
                state = STATE_IDLE

        # 7. SUCCESS State
        elif state == STATE_SUCCESS:
            display.show(
                "[OK] VOTE CASTED!",
                "Successfully recorded",
                "Thank you for voting",
                "Resetting terminal..."
            )
            time.sleep(3)
            state = STATE_IDLE

        time.sleep(0.1)

if __name__ == '__main__':
    try:
        run_state_machine()
    except KeyboardInterrupt:
        print("\n[OK] Voting terminal shut down.")
        if HAS_GPIO:
            GPIO.cleanup()
        sys.exit(0)

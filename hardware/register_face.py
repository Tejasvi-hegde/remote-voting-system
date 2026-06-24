#!/usr/bin/env python3
"""
register_face.py — Raspberry Pi 5 Voter Face Registration Utility
==================================================================
Runs on the Raspberry Pi 5.
1. Prompts for a Voter ID.
2. Performs lookup on the laptop backend server to verify the voter exists.
3. Captures a face snapshot using the USB webcam (Logitech C270 HD).
4. Submits the face image base64 to register face biometrics on the laptop.
"""

import sys
import os
import json
import base64
import re
import requests
import subprocess
import time

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5001')

# ── Camera Capture Helper (Optimized for Logitech USB Webcams) ─────────────────
def capture_face_base64():
    """
    Captures a frame using camera module.
    Tries OpenCV (Standard USB webcam like Logitech C270), falls back to libcamera-still, falls back to mock image.
    Returns:
        str: Base64-encoded image string
    """
    mock_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # 1. Try OpenCV (Standard USB webcam/V4L2, e.g. Logitech C270 HD)
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
            # Let the camera warm up for a fraction of a second
            time.sleep(0.3)
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

# ── Main Script ───────────────────────────────────────────────────────────────
def main():
    print("=================================================")
    print("      VOTER FACE REGISTRATION TERMINAL           ")
    print(f"      Backend Server: {BACKEND_URL}              ")
    print("=================================================\n")

    # 1. Prompt for Voter ID
    voter_id = input("Enter Voter ID (EPIC Format, e.g. IND0000001): ").strip().upper()
    
    # 2. Validate Format
    epic_regex = re.compile(r'^[A-Z]{3}\d{7}$')
    if not epic_regex.match(voter_id):
        print("\n❌ Error: Invalid Voter ID format. Expected 3 letters followed by 7 digits (e.g. IND0000001).")
        sys.exit(1)

    # 3. Query the Backend to Lookup Voter
    print(f"\nContacting server to lookup voter '{voter_id}'...")
    try:
        res = requests.get(f"{BACKEND_URL}/api/admin/voter/lookup/{voter_id}", timeout=10)
        if res.status_code == 404:
            print(f"❌ Error: Voter ID '{voter_id}' is not registered in the National Database.")
            sys.exit(1)
        elif res.status_code != 200:
            err = res.json().get("error", "Unknown error occurred.")
            print(f"❌ Server returned error: {err}")
            sys.exit(1)
            
        voter_data = res.json()
        print("\n-------------------------------------------------")
        print(f"  VOTER FOUND:")
        print(f"  Name:         {voter_data['name']}")
        print(f"  Constituency: {voter_data['constituency']}")
        print(f"  Address:      {voter_data.get('address', 'N/A')}")
        print(f"  Biometric:    {'Registered' if voter_data.get('has_face') else 'NOT REGISTERED'}")
        print("-------------------------------------------------")
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection Error: Cannot reach backend server at {BACKEND_URL}. Check network connection.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error during lookup: {e}")
        sys.exit(1)

    # 4. Confirm Registration
    confirm = input("\nProceed to capture face snapshot? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Registration cancelled.")
        sys.exit(0)

    # 5. Capture Snapshot
    print("\n[CAMERA] Capturing face snapshot from Logitech Webcam...")
    face_b64 = capture_face_base64()
    
    # If the capture returned the fallback mock because of no camera
    if face_b64 == "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==":
        print("⚠️  Warning: Camera failed to capture image. Registering with mock face image.")

    # 6. Submit face image to backend
    print("Uploading face embedding & snapshot to server...")
    try:
        headers = {"Content-Type": "application/json"}
        payload = {
            "voterID": voter_id,
            "faceImage": face_b64
        }
        res = requests.post(f"{BACKEND_URL}/api/admin/voter/register-face", json=payload, headers=headers, timeout=15)
        
        if res.status_code == 200:
            print(f"\n✅ SUCCESS: Voter {voter_data['name']} ({voter_id}) is successfully registered!")
        else:
            err = res.json().get("error", "Unknown registration error.")
            print(f"\n❌ FAILED: Face registration failed. Server response: {err}")
    except Exception as e:
        print(f"\n❌ Connection Error: Failed to upload face to backend: {e}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nRegistration utility aborted.")
        sys.exit(0)

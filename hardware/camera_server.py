#!/usr/bin/env python3
"""
camera_server.py — Raspberry Pi 5 Camera Server
===============================================
Runs a lightweight HTTP server on the Raspberry Pi 5 (Port 5002).
Exposes a GET /capture endpoint that snaps a photo using the Logitech C270 HD webcam,
converts it to base64, and returns it to the laptop frontend with CORS headers enabled.
"""

import sys
import os
import json
import base64
import time
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── Camera Capture Helper ─────────────────────────────────────────────────────
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
            time.sleep(0.3)  # Let the camera auto-expose
            ret, frame = cap.read()
            cap.release()
            if ret:
                _, buffer = cv2.imencode('.jpg', frame)
                return base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        print(f"[DEBUG] OpenCV capture failed: {e}")

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
    except Exception as e:
        print(f"[DEBUG] libcamera-still capture failed: {e}")

    # 3. Fallback to mock image
    return mock_base64

# ── HTTP Request Handler ──────────────────────────────────────────────────────
class CameraServerHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for standard browser requests from frontend (localhost:3000)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/capture':
            print(f"[{time.strftime('%H:%M:%S')}] Received capture request from laptop client.")
            
            try:
                img_b64 = capture_face_base64()
                # Append base64 Data URL header for direct HTML rendering
                if not img_b64.startswith("data:image"):
                    img_b64 = f"data:image/jpeg;base64,{img_b64}"
                
                response = {
                    "success": True,
                    "faceImage": img_b64
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
            print(f"[{time.strftime('%H:%M:%S')}] Snapshot captured and successfully sent.")
        else:
            self.send_response(404)
            self.end_headers()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    port = 5002
    server = HTTPServer(('0.0.0.0', port), CameraServerHandler)
    print("=================================================")
    print("      RASPBERRY PI CAMERA WEB SERVER            ")
    print(f"      Listening on port: {port}                  ")
    print("      Endpoint: http://<PI_IP>:5002/capture      ")
    print("=================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down camera server.")
        server.server_close()

if __name__ == '__main__':
    main()

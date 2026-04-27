#!/usr/bin/env python3
"""
biometric.py - Voting Terminal Main Script
==========================================
This script runs on the Raspberry Pi voting terminal.
It orchestrates the full voting flow:
  1. Get voter ID from keyboard or barcode scanner
  2. Capture fingerprint from R307 sensor
  3. Hash fingerprint and call backend /api/auth/verify
  4. Receive JWT token
  5. Open the browser to the React ballot UI
  6. Wait for the browser to signal vote completion locally

Hardware:
  - Raspberry Pi 4
  - R307/AS608 fingerprint sensor on GPIO UART (/dev/ttyS0)
  - USB barcode scanner or keyboard
  - HDMI touchscreen display or reused monitor
"""

import hashlib
import json
import os
import select
import sqlite3
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

import requests
from pyfingerprint.pyfingerprint import PyFingerprint, FINGERPRINT_CHARBUFFER1

UART_PORT = os.environ.get('UART_PORT', '/dev/ttyS0')
BAUD_RATE = int(os.environ.get('UART_BAUD_RATE', '57600'))
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://192.168.1.100:5000')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://192.168.1.100:3000')
TERMINAL_ID = os.environ.get('TERMINAL_ID', 'RVC-1')
LOCAL_DB_PATH = os.environ.get('LOCAL_DB_PATH', '/var/lib/voting/local_buffer.db')
CALLBACK_HOST = os.environ.get('TERMINAL_CALLBACK_HOST', '127.0.0.1')
CALLBACK_PORT = int(os.environ.get('TERMINAL_CALLBACK_PORT', '8787'))
SESSION_TIMEOUT_SECONDS = int(os.environ.get('SESSION_TIMEOUT_SECONDS', str(15 * 60)))

SESSION_COMPLETE = threading.Event()
LAST_COMPLETION = {}


def init_local_db():
    """Create the local SQLite buffer database if it does not exist."""
    os.makedirs(os.path.dirname(LOCAL_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS offline_queue (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_id     TEXT NOT NULL,
            token        TEXT NOT NULL,
            candidate_id TEXT NOT NULL,
            queued_at    TEXT NOT NULL,
            synced       INTEGER DEFAULT 0
        )
        '''
    )
    conn.commit()
    conn.close()
    print('Local buffer database ready.')


def sync_offline_queue():
    """Attempt to sync all queued offline votes to the backend."""
    conn = sqlite3.connect(LOCAL_DB_PATH)
    pending = conn.execute(
        'SELECT id, voter_id, token, candidate_id FROM offline_queue WHERE synced = 0'
    ).fetchall()

    if not pending:
        conn.close()
        return

    print(f'Syncing {len(pending)} offline vote(s)...')

    for row_id, voter_id, token, candidate_id in pending:
        try:
            response = requests.post(
                f'{BACKEND_URL}/api/vote/cast',
                json={'candidateID': candidate_id},
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )
            if response.status_code == 200:
                conn.execute('UPDATE offline_queue SET synced = 1 WHERE id = ?', (row_id,))
                conn.commit()
                print(f'Synced vote for voter {voter_id}')
            else:
                print(f'Sync failed for {voter_id}: {response.json()}')
        except requests.exceptions.ConnectionError:
            print('Still offline. Will retry later.')
            break

    conn.close()


def build_terminal_callback_url():
    return f'http://{CALLBACK_HOST}:{CALLBACK_PORT}/terminal/session-complete'


class TerminalCallbackHandler(BaseHTTPRequestHandler):
    """Receive vote-complete notifications from the local browser session."""

    def _send_json(self, status_code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != '/terminal/session-complete':
            self._send_json(404, {'error': 'Not found'})
            return

        params = parse_qs(parsed.query)
        LAST_COMPLETION.clear()
        LAST_COMPLETION.update(
            {
                'status': params.get('status', ['completed'])[0],
                'transactionID': params.get('transactionID', [''])[0],
                'timestamp': params.get('timestamp', [''])[0],
                'candidateID': params.get('candidateID', [''])[0],
                'terminalID': params.get('terminalID', [TERMINAL_ID])[0],
            }
        )
        SESSION_COMPLETE.set()
        self._send_json(200, {'success': True})

    def log_message(self, fmt, *args):
        return


def start_callback_server():
    """Start a lightweight local HTTP server for kiosk completion callbacks."""
    server = ThreadingHTTPServer((CALLBACK_HOST, CALLBACK_PORT), TerminalCallbackHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f'Terminal callback server listening on {build_terminal_callback_url()}')
    return server


def connect_sensor():
    """Initialize the fingerprint sensor. Retries 3 times on failure."""
    for attempt in range(3):
        try:
            sensor = PyFingerprint(UART_PORT, BAUD_RATE, 0xFFFFFFFF, 0x00000000)
            if sensor.verifyPassword():
                print('Fingerprint sensor ready.')
                return sensor
        except Exception as err:
            print(f'Sensor connect attempt {attempt + 1}/3 failed: {err}')
            time.sleep(2)

    print('Cannot connect to fingerprint sensor. Check wiring and UART settings.')
    sys.exit(1)


def capture_and_hash(sensor):
    """Capture one fingerprint scan and return its SHA-256 hash."""
    print('\nPlace your finger on the scanner...')

    start = time.time()
    while not sensor.readImage():
        if time.time() - start > 30:
            raise TimeoutError('Fingerprint scan timed out. Please try again.')

    print('Fingerprint captured.')
    sensor.convertImage(FINGERPRINT_CHARBUFFER1)

    characteristics = sensor.downloadCharacteristics(FINGERPRINT_CHARBUFFER1)
    template_bytes = bytes(characteristics)
    return hashlib.sha256(template_bytes).hexdigest()


def verify_voter(voter_id, biometric_hash):
    """Call backend /api/auth/verify with voter credentials."""
    try:
        response = requests.post(
            f'{BACKEND_URL}/api/auth/verify',
            json={
                'voterID': voter_id,
                'biometricHash': biometric_hash,
                'terminalID': TERMINAL_ID,
            },
            timeout=10,
        )

        data = response.json()
        if response.status_code == 200 and data.get('success'):
            return data

        print(f'Auth failed: {data.get("error", "Unknown error")}')
        return None
    except requests.exceptions.ConnectionError:
        print('Backend unreachable. Check network connection.')
        return None
    except requests.exceptions.Timeout:
        print('Backend timeout.')
        return None


def open_ballot(token):
    """Open the React voting interface in Chromium kiosk mode."""
    callback_url = quote(build_terminal_callback_url(), safe='')
    url = (
        f'{FRONTEND_URL}?token={token}&terminal={TERMINAL_ID}'
        f'&terminalCallback={callback_url}'
    )

    subprocess.run(['pkill', '-f', 'chromium'], capture_output=True)
    time.sleep(1)

    subprocess.Popen(
        [
            'chromium-browser',
            '--kiosk',
            '--no-first-run',
            '--disable-infobars',
            '--disable-session-crashed-bubble',
            '--disable-restore-session-state',
            url,
        ]
    )
    print('Ballot opened for voting session.')


def clear_screen():
    os.system('clear')


def print_banner():
    clear_screen()
    print('=' * 50)
    print('  ELECTION COMMISSION OF INDIA')
    print('  Secure Voting Terminal')
    print(f'  Terminal ID: {TERMINAL_ID}')
    print('=' * 50)


def main():
    print_banner()
    init_local_db()
    sync_offline_queue()
    callback_server = start_callback_server()
    sensor = connect_sensor()

    try:
        while True:
            print('\n' + '-' * 50)
            print('  NEW VOTING SESSION')
            print('-' * 50)

            voter_id = input('\nEnter Voter ID (or scan barcode): ').strip().upper()
            if not voter_id:
                print('Voter ID cannot be empty.')
                continue

            if len(voter_id) != 10:
                print('Invalid Voter ID format. Expected 10 characters (e.g., ABC1234567).')
                continue

            try:
                biometric_hash = capture_and_hash(sensor)
            except TimeoutError as err:
                print(err)
                continue
            except Exception as err:
                print(f'Sensor error: {err}')
                continue

            print('\nVerifying identity...')
            result = verify_voter(voter_id, biometric_hash)

            if not result:
                print('\nAuthentication failed.')
                print('Possible reasons:')
                print('  - Voter ID not found in database')
                print('  - Fingerprint does not match')
                print('  - This voter has already voted')
                input('\nPress Enter to start a new session...')
                continue

            voter = result['voter']
            token = result['token']

            print('\nIdentity verified.')
            print(f'   Name:         {voter["name"]}')
            print(f'   Constituency: {voter["constituency"]["name"]}, {voter["constituency"]["state"]}')
            print('\nSession active for 15 minutes.')

            SESSION_COMPLETE.clear()
            LAST_COMPLETION.clear()
            open_ballot(token)

            print('\nWaiting for voter to complete...')
            print('The browser will notify this terminal automatically when voting finishes.')
            print('Press [R] to force reset if operator intervention is needed.')

            start = time.time()
            while True:
                if SESSION_COMPLETE.wait(timeout=1):
                    break
                if select.select([sys.stdin], [], [], 0)[0]:
                    key = sys.stdin.read(1).lower()
                    if key == 'r':
                        LAST_COMPLETION.clear()
                        LAST_COMPLETION.update({'status': 'manual-reset', 'terminalID': TERMINAL_ID})
                        break
                if time.time() - start > SESSION_TIMEOUT_SECONDS:
                    LAST_COMPLETION.clear()
                    LAST_COMPLETION.update({'status': 'timed-out', 'terminalID': TERMINAL_ID})
                    print('\nSession timed out.')
                    break

            subprocess.run(['pkill', '-f', 'chromium'], capture_output=True)

            if LAST_COMPLETION.get('transactionID'):
                print('\nVote completion received from kiosk.')
                print(f'   Transaction ID: {LAST_COMPLETION["transactionID"]}')
            else:
                print(f'\nSession closed with status: {LAST_COMPLETION.get("status", "reset")}.')

            print('Terminal reset for next voter.')
            sync_offline_queue()
    finally:
        callback_server.shutdown()
        callback_server.server_close()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\nTerminal shut down by operator.')
        sys.exit(0)

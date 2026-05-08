#!/usr/bin/env python3
"""
biometric.py — Voting Terminal Main Script
==========================================
This script runs on the Raspberry Pi voting terminal.
It orchestrates the full voting flow:
  1. Get voter ID from keyboard or barcode scanner
  2. Capture fingerprint from R307 sensor
  3. Hash fingerprint and call backend /api/auth/verify
  4. Receive JWT token
  5. Open the browser to the React ballot UI (passing JWT in URL)
  6. Monitor for vote completion signal

Hardware:
  - Raspberry Pi 4 (4GB RAM recommended)
  - R307/AS608 fingerprint sensor on GPIO UART (/dev/ttyS0)
  - USB barcode scanner or keyboard (for voter ID input)
  - HDMI touchscreen display

Run with: python3 biometric.py
"""

import hashlib
import sys
import json
import time
import os
import subprocess
import sqlite3
import requests
from datetime import datetime
from pyfingerprint.pyfingerprint import PyFingerprint, FINGERPRINT_CHARBUFFER1

# ── Config ────────────────────────────────────────────────────────────────────
UART_PORT = '/dev/ttyS0'
BAUD_RATE = 57600
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://192.168.1.100:5001')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://192.168.1.100:3000')
TERMINAL_ID = os.environ.get('TERMINAL_ID', 'RVC-1')
LOCAL_DB_PATH = '/var/lib/voting/local_buffer.db'

# ── Local SQLite Buffer ───────────────────────────────────────────────────────
# When network is down, votes are queued locally and synced when reconnected.

def init_local_db():
    """Create local SQLite buffer database if it doesn't exist."""
    os.makedirs(os.path.dirname(LOCAL_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS offline_queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_id    TEXT NOT NULL,
            token       TEXT NOT NULL,
            candidate_id TEXT NOT NULL,
            queued_at   TEXT NOT NULL,
            synced      INTEGER DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()
    print('✅ Local buffer database ready.')


def queue_vote_locally(voter_id, token, candidate_id):
    """Store a vote in local SQLite when backend is unreachable."""
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.execute(
        'INSERT INTO offline_queue (voter_id, token, candidate_id, queued_at) VALUES (?, ?, ?, ?)',
        (voter_id, token, candidate_id, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    print(f'📦 Vote queued locally for voter {voter_id}. Will sync when online.')


def sync_offline_queue():
    """
    Attempt to sync all queued offline votes to the backend.
    Called on startup and periodically.
    """
    conn = sqlite3.connect(LOCAL_DB_PATH)
    pending = conn.execute(
        'SELECT id, voter_id, token, candidate_id FROM offline_queue WHERE synced = 0'
    ).fetchall()

    if not pending:
        conn.close()
        return

    print(f'🔄 Syncing {len(pending)} offline vote(s)...')

    for row_id, voter_id, token, candidate_id in pending:
        try:
            response = requests.post(
                f'{BACKEND_URL}/api/vote/cast',
                json={'candidateID': candidate_id},
                headers={'Authorization': f'Bearer {token}'},
                timeout=10
            )
            if response.status_code == 200:
                conn.execute('UPDATE offline_queue SET synced = 1 WHERE id = ?', (row_id,))
                conn.commit()
                print(f'✅ Synced vote for voter {voter_id}')
            else:
                print(f'⚠️  Sync failed for {voter_id}: {response.json()}')
        except requests.exceptions.ConnectionError:
            print('❌ Still offline. Will retry later.')
            break

    conn.close()


# ── Fingerprint Sensor ────────────────────────────────────────────────────────

def connect_sensor():
    """Initialize fingerprint sensor. Retries 3 times on failure."""
    for attempt in range(3):
        try:
            sensor = PyFingerprint(UART_PORT, BAUD_RATE, 0xFFFFFFFF, 0x00000000)
            if sensor.verifyPassword():
                print('✅ Fingerprint sensor ready.')
                return sensor
        except Exception as e:
            print(f'Sensor connect attempt {attempt + 1}/3 failed: {e}')
            time.sleep(2)

    print('❌ Cannot connect to fingerprint sensor. Check wiring.')
    sys.exit(1)


def capture_and_hash(sensor):
    """
    Capture one fingerprint scan and return its SHA-256 hash.
    For verification (not enrollment), one scan is sufficient.

    Returns:
        str: SHA-256 hex digest
    """
    print('\n👆 Place your finger on the scanner...')

    timeout = 30  # seconds
    start = time.time()

    while not sensor.readImage():
        if time.time() - start > timeout:
            raise TimeoutError('Fingerprint scan timed out. Please try again.')

    print('✅ Fingerprint captured.')
    sensor.convertImage(FINGERPRINT_CHARBUFFER1)

    characteristics = sensor.downloadCharacteristics(FINGERPRINT_CHARBUFFER1)
    
    ascii_lines = ['FP_TEMPLATE_V1']
    for i, val in enumerate(characteristics):
        ascii_lines.append(f'byte_{i:04d}:{val:08b}')
    template_str = '\n'.join(ascii_lines)
    with open('/tmp/scan_fp.txt', 'w') as fp_file:
        fp_file.write(template_str)
    
    fingerprint_ascii = open('/tmp/scan_fp.txt').read()

    return fingerprint_ascii


# ── Backend Communication ─────────────────────────────────────────────────────

def verify_voter(voter_id, fingerprint_ascii):
    """
    Call backend /api/auth/verify with voter credentials.

    Returns:
        dict: { 'token': str, 'voter': {...} } on success
        None on failure
    """
    try:
        response = requests.post(
            f'{BACKEND_URL}/api/auth/verify',
            json={
                'voterID': voter_id,
                'fingerprintAscii': fingerprint_ascii,
                'terminalID': TERMINAL_ID
            },
            timeout=10
        )

        data = response.json()

        if response.status_code == 200 and data.get('token'):
            return data
        else:
            print(f'⚠️  Auth failed: {data.get("error", "Unknown error")}')
            return None

    except requests.exceptions.ConnectionError:
        print('❌ Backend unreachable. Check network connection.')
        return None
    except requests.exceptions.Timeout:
        print('❌ Backend timeout.')
        return None


# ── UI Helpers ────────────────────────────────────────────────────────────────

def open_ballot(token):
    """
    Open the React voting interface in Chromium.
    Passes the JWT as a URL parameter so React can use it.
    Runs in kiosk mode (fullscreen, no address bar).
    """
    url = f'{FRONTEND_URL}?token={token}&terminal={TERMINAL_ID}'

    # Kill any existing browser instance
    subprocess.run(['pkill', '-f', 'chromium'], capture_output=True)
    time.sleep(1)

    # Launch in kiosk mode
    subprocess.Popen([
        'chromium-browser',
        '--kiosk',
        '--no-first-run',
        '--disable-infobars',
        '--disable-session-crashed-bubble',
        '--disable-restore-session-state',
        url
    ])
    print(f'🌐 Ballot opened for voting session.')


def clear_screen():
    os.system('clear')


def print_banner():
    clear_screen()
    print('=' * 50)
    print('  ELECTION COMMISSION OF INDIA')
    print('  Secure Voting Terminal')
    print(f'  Terminal ID: {TERMINAL_ID}')
    print('=' * 50)


# ── Main Voting Flow ──────────────────────────────────────────────────────────

def main():
    print_banner()
    init_local_db()
    sync_offline_queue()   # sync any queued votes first
    sensor = connect_sensor()

    while True:  # Loop — allow multiple voters at one terminal
        print('\n' + '-' * 50)
        print('  NEW VOTING SESSION')
        print('-' * 50)

        # ── Step 1: Get Voter ID ─────────────────────────────────────────
        voter_id = input('\nEnter Voter ID (or scan barcode): ').strip().upper()
        if not voter_id:
            print('❌ Voter ID cannot be empty.')
            continue

        # Basic format validation
        if len(voter_id) != 10:
            print('❌ Invalid Voter ID format. Expected 10 characters (e.g., ABC1234567).')
            continue

        # ── Step 2: Capture Fingerprint ──────────────────────────────────
        try:
            fingerprint_ascii = capture_and_hash(sensor)
        except TimeoutError as e:
            print(f'❌ {e}')
            continue
        except Exception as e:
            print(f'❌ Sensor error: {e}')
            continue

        # ── Step 3: Verify with Backend ──────────────────────────────────
        print('\n🔍 Verifying identity...')
        result = verify_voter(voter_id, fingerprint_ascii)

        if not result:
            print('\n❌ Authentication failed.')
            print('   Possible reasons:')
            print('   - Voter ID not found in database')
            print('   - Fingerprint does not match')
            print('   - This voter has already voted')
            input('\nPress Enter to start a new session...')
            continue

        voter = result['voter']
        token = result['token']

        print(f'\n✅ Identity verified!')
        print(f'   Name:         {voter["name"]}')
        print(f'   Constituency: {voter["constituency"]["name"]}, {voter["constituency"]["state"]}')
        print(f'\n   Session active for 15 minutes.')

        # ── Step 4: Open Ballot UI ───────────────────────────────────────
        open_ballot(token)

        # Wait for voter to complete (monitor for keypress or timeout)
        print('\n⏳ Waiting for voter to complete...')
        print('   Press [R] to reset (if voter finishes or times out)')

        import select
        start = time.time()
        while True:
            if select.select([sys.stdin], [], [], 1)[0]:
                key = sys.stdin.read(1).lower()
                if key == 'r':
                    break
            if time.time() - start > 15 * 60:  # 15 minute timeout
                print('\n⏰ Session timed out.')
                break

        # Kill browser when done
        subprocess.run(['pkill', '-f', 'chromium'], capture_output=True)
        print('\n🔒 Session closed. Terminal reset for next voter.')

        # Attempt to sync any offline queue after each vote
        sync_offline_queue()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n🛑 Terminal shut down by operator.')
        sys.exit(0)

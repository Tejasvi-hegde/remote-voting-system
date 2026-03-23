#!/usr/bin/env python3
"""
enroll.py — Fingerprint Enrollment Script
==========================================
Run this ONCE per voter during the registration/pre-enrollment phase.
It captures the voter's fingerprint, extracts the template, computes
its SHA-256 hash, and sends it to the backend for storage.

Hardware: Raspberry Pi 4 + R307/AS608 fingerprint sensor
UART:     /dev/ttyS0 (GPIO 14/15), baud 57600
"""

import hashlib
import sys
import json
import time
import requests
from pyfingerprint.pyfingerprint import PyFingerprint, FINGERPRINT_CHARBUFFER1, FINGERPRINT_CHARBUFFER2

# ── Config ────────────────────────────────────────────────────────────────────
UART_PORT = '/dev/ttyS0'
BAUD_RATE = 57600
BACKEND_URL = 'http://192.168.1.100:5000'   # Change to your server IP


def connect_sensor():
    """Initialize UART connection to fingerprint sensor."""
    try:
        sensor = PyFingerprint(UART_PORT, BAUD_RATE, 0xFFFFFFFF, 0x00000000)
        if not sensor.verifyPassword():
            raise ValueError('Sensor password verification failed.')
        print('✅ Fingerprint sensor connected.')
        print(f'   Templates stored: {sensor.getTemplateCount()}')
        return sensor
    except Exception as e:
        print(f'❌ Could not connect to sensor: {e}')
        sys.exit(1)


def capture_fingerprint_hash(sensor, sample_count=2):
    """
    Capture fingerprint twice (for accuracy), merge templates,
    and return the SHA-256 hash of the merged template.

    Args:
        sensor: PyFingerprint instance
        sample_count: number of scan attempts (2 recommended for enrollment)
    Returns:
        str: SHA-256 hex digest of the fingerprint template
    """
    print('\n📍 Place your finger on the sensor...')

    for attempt in range(sample_count):
        # Wait for a finger to be detected
        while not sensor.readImage():
            pass

        print(f'   Scan {attempt + 1}/{sample_count} captured. Lift finger.')
        sensor.convertImage(FINGERPRINT_CHARBUFFER1 if attempt == 0 else FINGERPRINT_CHARBUFFER2)
        time.sleep(1)

        if attempt < sample_count - 1:
            # Wait for finger lift
            print('   Place the same finger again for verification...')
            time.sleep(2)
            while not sensor.readImage():
                pass
            sensor.convertImage(FINGERPRINT_CHARBUFFER2)

    # Check that both scans match (similarity > 75%)
    if sample_count >= 2:
        accuracy = sensor.compareCharacteristics()
        print(f'   Match accuracy: {accuracy}')
        if accuracy < 75:
            raise ValueError(
                f'Fingerprint scans do not match (score: {accuracy}). '
                'Try again with a clean, flat placement.'
            )

    # Merge both scans into a single template
    sensor.createTemplate()

    # Download the template bytes from the sensor
    characteristics = sensor.downloadCharacteristics(FINGERPRINT_CHARBUFFER1)

    # Convert to bytes and compute SHA-256
    template_bytes = bytes(characteristics)
    sha256_hash = hashlib.sha256(template_bytes).hexdigest()

    return sha256_hash, characteristics


def register_voter(voter_id, name, biometric_hash, constituency):
    """Send voter registration data to the backend."""
    payload = {
        'voterID': voter_id,
        'name': name,
        'biometricHash': biometric_hash,
        'constituency': constituency
    }
    try:
        response = requests.post(
            f'{BACKEND_URL}/api/auth/register',
            json=payload,
            timeout=10
        )
        return response.json()
    except requests.exceptions.ConnectionError:
        return {'error': 'Cannot reach backend server. Check network connection.'}


def main():
    print('=== Voter Fingerprint Enrollment ===\n')

    # Gather voter information
    voter_id = input('Enter Voter ID (e.g., ABC1234567): ').strip().upper()
    name = input('Enter Voter Full Name: ').strip()
    constituency_id = input('Enter Constituency ID (e.g., KA-001): ').strip()
    constituency_name = input('Enter Constituency Name: ').strip()
    state = input('Enter State: ').strip()

    constituency = {
        'id': constituency_id,
        'name': constituency_name,
        'state': state
    }

    # Connect to fingerprint sensor
    sensor = connect_sensor()

    # Capture fingerprint and get hash
    try:
        biometric_hash, _ = capture_fingerprint_hash(sensor)
        print(f'\n✅ Fingerprint captured successfully.')
        print(f'   Hash: {biometric_hash[:16]}...{biometric_hash[-8:]} (SHA-256)')
    except ValueError as e:
        print(f'\n❌ Capture failed: {e}')
        sys.exit(1)

    # Confirm before sending
    print(f'\nAbout to register:')
    print(f'  Voter ID: {voter_id}')
    print(f'  Name:     {name}')
    print(f'  Area:     {constituency_name}, {state}')
    confirm = input('\nConfirm? (yes/no): ').strip().lower()

    if confirm != 'yes':
        print('Registration cancelled.')
        sys.exit(0)

    # Send to backend
    result = register_voter(voter_id, name, biometric_hash, constituency)
    if result.get('success'):
        print(f'\n✅ Voter {voter_id} registered successfully!')
    else:
        print(f'\n❌ Registration failed: {result.get("error")}')


if __name__ == '__main__':
    main()

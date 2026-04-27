#!/usr/bin/env python3
"""
enroll.py - Fingerprint Enrollment Script
=========================================
Run this once per voter during the registration/pre-enrollment phase.
It captures the voter's fingerprint, extracts the template, computes
its SHA-256 hash, and sends it to the backend for storage.

Hardware: Raspberry Pi 4 + R307/AS608 fingerprint sensor
UART:     /dev/ttyS0 (GPIO 14/15), baud 57600
"""

import hashlib
import os
import sys
import time
import requests
from pyfingerprint.pyfingerprint import (
    PyFingerprint,
    FINGERPRINT_CHARBUFFER1,
    FINGERPRINT_CHARBUFFER2,
)

UART_PORT = os.environ.get('UART_PORT', '/dev/ttyS0')
BAUD_RATE = int(os.environ.get('UART_BAUD_RATE', '57600'))
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://192.168.1.100:5000')


def connect_sensor():
    """Initialize UART connection to the fingerprint sensor."""
    try:
        sensor = PyFingerprint(UART_PORT, BAUD_RATE, 0xFFFFFFFF, 0x00000000)
        if not sensor.verifyPassword():
            raise ValueError('Sensor password verification failed.')
        print('Fingerprint sensor connected.')
        print(f'   Templates stored: {sensor.getTemplateCount()}')
        return sensor
    except Exception as err:
        print(f'Could not connect to sensor: {err}')
        sys.exit(1)


def capture_fingerprint_hash(sensor, sample_count=2):
    """
    Capture the fingerprint twice, merge templates, and return the hash.
    """
    print('\nPlace your finger on the sensor...')

    for attempt in range(sample_count):
        while not sensor.readImage():
            pass

        print(f'   Scan {attempt + 1}/{sample_count} captured. Lift finger.')
        sensor.convertImage(
            FINGERPRINT_CHARBUFFER1 if attempt == 0 else FINGERPRINT_CHARBUFFER2
        )
        time.sleep(1)

        if attempt < sample_count - 1:
            print('   Place the same finger again for verification...')
            time.sleep(2)
            while not sensor.readImage():
                pass
            sensor.convertImage(FINGERPRINT_CHARBUFFER2)

    if sample_count >= 2:
        accuracy = sensor.compareCharacteristics()
        print(f'   Match accuracy: {accuracy}')
        if accuracy < 75:
            raise ValueError(
                f'Fingerprint scans do not match (score: {accuracy}). '
                'Try again with a clean, flat placement.'
            )

    sensor.createTemplate()
    characteristics = sensor.downloadCharacteristics(FINGERPRINT_CHARBUFFER1)
    template_bytes = bytes(characteristics)
    sha256_hash = hashlib.sha256(template_bytes).hexdigest()

    return sha256_hash


def register_voter(voter_id, name, biometric_hash, constituency):
    """Send voter registration data to the backend."""
    payload = {
        'voterID': voter_id,
        'name': name,
        'biometricHash': biometric_hash,
        'constituency': constituency,
    }

    try:
        response = requests.post(
            f'{BACKEND_URL}/api/auth/register',
            json=payload,
            timeout=10,
        )
        return response.json()
    except requests.exceptions.ConnectionError:
        return {'error': 'Cannot reach backend server. Check network connection.'}


def main():
    print('=== Voter Fingerprint Enrollment ===\n')

    voter_id = input('Enter Voter ID (e.g., ABC1234567): ').strip().upper()
    name = input('Enter Voter Full Name: ').strip()
    constituency_id = input('Enter Constituency ID (e.g., KA-001): ').strip()
    constituency_name = input('Enter Constituency Name: ').strip()
    state = input('Enter State: ').strip()

    constituency = {
        'id': constituency_id,
        'name': constituency_name,
        'state': state,
    }

    sensor = connect_sensor()

    try:
        biometric_hash = capture_fingerprint_hash(sensor)
        print('\nFingerprint captured successfully.')
        print(f'   Hash: {biometric_hash[:16]}...{biometric_hash[-8:]} (SHA-256)')
    except ValueError as err:
        print(f'\nCapture failed: {err}')
        sys.exit(1)

    print('\nAbout to register:')
    print(f'  Voter ID: {voter_id}')
    print(f'  Name:     {name}')
    print(f'  Area:     {constituency_name}, {state}')
    confirm = input('\nConfirm? (yes/no): ').strip().lower()

    if confirm != 'yes':
        print('Registration cancelled.')
        sys.exit(0)

    result = register_voter(voter_id, name, biometric_hash, constituency)
    if result.get('success'):
        print(f'\nVoter {voter_id} registered successfully.')
    else:
        print(f'\nRegistration failed: {result.get("error")}')


if __name__ == '__main__':
    main()

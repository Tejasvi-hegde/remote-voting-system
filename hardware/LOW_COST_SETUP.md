# Low-Cost Hardware Setup

This project can run on a low-cost remote voting terminal without needing a custom industrial kiosk.

## Recommended Budget Build

- Raspberry Pi 4 Model B, 2 GB or 4 GB RAM
- R307 or AS608 fingerprint sensor
- 7-inch to 10-inch HDMI display, or a reused HDMI monitor or TV
- Basic USB keyboard
- Optional low-cost USB barcode scanner
- 5V/3A Raspberry Pi power adapter
- 32 GB microSD card
- Plastic or acrylic enclosure

## Practical Budget Strategy

- Cheapest display option: reuse an old HDMI monitor or small TV
- Cheapest input option: use a USB keyboard instead of a barcode scanner at first
- Best value biometric option: use an R307 or AS608 sensor instead of a more expensive industrial scanner

For a student prototype, the minimum practical setup is:

- 1 Raspberry Pi
- 1 fingerprint sensor
- 1 reused monitor
- 1 USB keyboard

## Wiring

For an R307 or AS608 UART fingerprint sensor:

- `VCC` -> Pi `5V`
- `GND` -> Pi `GND`
- `TX` -> Pi `RX` on GPIO 15
- `RX` -> Pi `TX` on GPIO 14

Enable UART on the Pi:

1. Run `sudo raspi-config`
2. Open `Interface Options`
3. Enable `Serial Port`
4. Disable the login shell over serial
5. Reboot

## Software Setup on the Pi

Install only what the terminal needs:

```bash
sudo apt update
sudo apt install -y python3 python3-pip chromium-browser
pip3 install -r hardware/requirements.txt
```

Set the runtime environment:

```bash
export BACKEND_URL=http://YOUR_BACKEND_IP:5000
export FRONTEND_URL=http://YOUR_FRONTEND_IP:3000
export TERMINAL_ID=RVC-1
export UART_PORT=/dev/ttyS0
export UART_BAUD_RATE=57600
python3 hardware/biometric.py
```

## Cheapest Practical Variants

- Cheapest: Raspberry Pi + fingerprint sensor + reused monitor + USB keyboard
- Better operator workflow: add a cheap USB barcode scanner
- Better voter experience: add a touchscreen and enclosure later

## Notes

- Most USB barcode scanners behave like keyboards, so they are easy to add later.
- For demos, reusing an existing monitor saves a lot of cost.
- If internet stability is poor, keep the local SQLite buffering path enabled and test recovery thoroughly.

#!/usr/bin/env python3
"""Talk to a robot over USB from the container: the bench version of the
instructor console on mecanum/ir.html.

Needs pyserial and the host's /dev mounted at /dev/host (see NOTES.md). Run it
with the venv that has pyserial:

    ~/.venvs/bot/bin/python scripts/bot-console.py --listen 6
    ~/.venvs/bot/bin/python scripts/bot-console.py -c '?' -c 'k?;'
    ~/.venvs/bot/bin/python scripts/bot-console.py --light 20

--light asks b over and over and prints each sensor with the range it has
covered, the same check as "Watch the light sensors" on the page: cover an LDR
and its number must DROP (if it rises, that LDR and its resistor are swapped).

Opening the port resets the board, so the sketch's boot banner comes first.
The port is always globbed, never hardcoded: /dev/host first (the host's /dev),
then this container's own /dev. CH340 clones are ttyUSB*, a genuine Uno ttyACM*.
"""
import argparse
import glob
import re
import sys
import time

try:
    import serial
except ImportError:
    sys.exit("no pyserial: ~/.venvs/bot/bin/python scripts/bot-console.py ... (or pip install pyserial)")

BAUD = 9600          # Serial.begin(9600) in every sketch here
PATTERNS = ("/dev/host/ttyUSB*", "/dev/host/ttyACM*", "/dev/ttyUSB*", "/dev/ttyACM*")


def find_ports():
    found = []
    for pattern in PATTERNS:
        found += sorted(glob.glob(pattern))
    return found


def open_port(name):
    try:
        return serial.Serial(name, BAUD, timeout=0.2)
    except serial.SerialException as error:
        if "Permission denied" in str(error):
            sys.exit("cannot open " + name + ": permission denied. That is the host's udev rule or "
                     "group on the device, not something to work around from in here: ask the human.")
        sys.exit("cannot open " + name + ": " + str(error))


def show(line):
    print("%7.2f  %s" % (time.monotonic() - START, line), flush=True)


def read_lines(port, seconds, on_line=None):
    """Print (and optionally hand on) whole lines for this many seconds."""
    buffer = ""
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        buffer += port.read(256).decode("utf-8", "replace")
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip("\r")
            if not line:
                continue
            if on_line is None or on_line(line) is not False:
                show(line)


def light_watch(port, seconds):
    """Ask b about three times a second; keep each sensor's lowest and highest."""
    sides = ["left", "right", "back"]
    low, high = {}, {}

    def handle(line):
        match = re.match(r"^B,-?\d+,\d+,(\d+),(\d+)(?:,(\d+))?", line)
        if not match:
            return True                      # anything else the robot says: print it
        parts = [match.group(1), match.group(2), match.group(3)]
        out = []
        for side, text in zip(sides, parts):
            if text is None:
                continue
            value = int(text)
            low[side] = min(value, low.get(side, value))
            high[side] = max(value, high.get(side, value))
            out.append("%-5s %4d  (%d - %d)" % (side, value, low[side], high[side]))
        print("%7.2f  %s" % (time.monotonic() - START, " | ".join(out)), flush=True)
        return False

    print("cover an LDR: its number must DROP. A flashlight should lift it 150 or more;")
    print("the teach-in needs 60. Left and right within about 50 of each other in room light.")
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        port.write(b"b\n")
        read_lines(port, 0.3, handle)


START = time.monotonic()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", help="serial port (default: the first one globbed)")
    parser.add_argument("--list", action="store_true", help="list the ports and stop")
    parser.add_argument("-c", "--command", action="append", default=[], help="send this line (repeatable)")
    parser.add_argument("--listen", type=float, default=0, help="seconds to keep printing what the robot says")
    parser.add_argument("--light", type=float, default=0, help="seconds of the repeating light reading")
    args = parser.parse_args()

    ports = find_ports()
    if args.list or not (args.port or ports):
        print("ports: " + (", ".join(ports) if ports else "none. Is the host's /dev mounted at /dev/host?"))
        return 0 if ports else 1

    name = args.port or ports[0]
    show("opening " + name + " at %d baud (this resets the board)" % BAUD)
    port = open_port(name)
    read_lines(port, 2.5)                    # the boot banner
    for command in args.command:
        show("> " + command)
        port.write((command + "\n").encode())
        read_lines(port, 1.0)
    if args.light:
        light_watch(port, args.light)
    if args.listen:
        read_lines(port, args.listen)
    port.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

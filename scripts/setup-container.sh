#!/bin/sh
# Set up a fresh project container for this repo: simulator packages, arduino-cli with
# the Uno core, the test tooling's node modules, the 20 MB commit guard.
# Safe to run again: it skips what is already there. Run it on a new container and
# after every container recreate (apt packages do not survive one; the home folder does).
set -e
cd "$(dirname "$0")/.."

if ! command -v simavr >/dev/null || ! command -v gcc >/dev/null || [ ! -e /usr/include/simavr/sim_avr.h ]; then
  sudo apt-get update
  sudo apt-get install -y simavr libsimavr-dev libelf-dev gcc
fi

CLI="$HOME/.local/bin/arduino-cli"
if [ ! -x "$CLI" ]; then
  mkdir -p "$HOME/.local/bin"
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR="$HOME/.local/bin" sh
fi
if ! "$CLI" core list | grep -q "arduino:avr *1.8.8"; then
  "$CLI" core update-index
  "$CLI" core install arduino:avr@1.8.8
fi

[ -L scripts/node_modules ] && rm scripts/node_modules
(cd scripts && npm install --no-audit --no-fund)
# Newer npm skips install scripts unless approved, and puppeteer fetches its Chrome in
# one; fetch it explicitly (a no-op when ~/.cache/puppeteer already has it).
(cd scripts && npx puppeteer browsers install chrome)

git config core.hooksPath .githooks
echo "setup done"

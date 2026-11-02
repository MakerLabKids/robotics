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

# Chrome itself lives in ~/.cache/puppeteer and survives a recreate, but the system
# libraries it links against do not, and then every browser suite fails with
# "Failed to launch the browser process: Code: 127". Install them when Chrome will not
# even print its version.
CHROME=$(ls -d "$HOME"/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | tail -1)
if [ -n "$CHROME" ] && ! "$CHROME" --version >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y libglib2.0-0t64 libnss3 libnspr4 libatk1.0-0t64 \
    libatk-bridge2.0-0t64 libdbus-1-3 libcups2t64 libxkbcommon0 libasound2t64 \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libatspi2.0-0t64 libgbm1 libdrm2 libxext6 libx11-xcb1 \
    libxcb-dri3-0 fonts-liberation
fi

git config core.hooksPath .githooks

# A fresh container has no git identity, so the first commit fails. Set one if missing
# (the repo's commits are the model's name with the user's address).
git config user.email >/dev/null || git config user.email "claude.com@qlamail.com"
git config user.name >/dev/null || git config user.name "Claude"
echo "setup done"

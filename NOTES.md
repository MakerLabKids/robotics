# Notes for Claude (handoff, 2026-10-31)

Read this after CLAUDE.md. CLAUDE.md says how the repo works; this file says where
things stand, what is still open, and how the user likes to work. Keep it current:
when you close an item, move it to "Done lately" (or delete it); when you learn
something the next session needs, add it here or to your memory.

## History in one paragraph

The robot workshop started as /abot/ (and earlier /arduinobot/) inside the
makerlabkids.com repo. On 2026-10-21 it became its own site, robotics.makerlabkids.com,
in the repo acklenx/robotics, checked out inside the makerlabkids project container at
/workspace/robots-site. On 2026-10-31 the repo was transferred to the MakerLabKids org
(MakerLabKids/robotics; GitHub redirects the old URL) and the work moved to its own
project, /srv/robotics on the host. Old notes and commit messages may still say
"robots-site/..." or "/abot/...": that is this repo's root.

## Setting up a fresh container

**First thing on a new container, and again after every recreate:**
`sh scripts/setup-container.sh`. It is safe to rerun and skips what is already there. It:
- apt-installs simavr, libsimavr-dev, libelf-dev and gcc (these do not survive a recreate);
- installs `~/.local/bin/arduino-cli` with the `arduino:avr@1.8.8` core (the home
  folder survives a recreate, so this happens once);
- runs `npm install` in scripts/ (puppeteer + jsdom) and downloads puppeteer's Chrome into ~/.cache/puppeteer;
- apt-installs the system libraries that Chrome links against (libglib, libnss3, libatk,
  libgbm and the rest). Chrome survives a recreate but those do not, and without them
  every browser suite fails with "Failed to launch the browser process: Code: 127";
- turns on the 20 MB commit guard (`git config core.hooksPath .githooks`);
- sets a git identity if the clone has none (a fresh container has none and the first
  commit fails). It sets the name to "Claude": change it to the model you are.

Then check it worked: `cd scripts && npm run test:site && npm run check:shared`.
Tell the user about the full simulator suite (`npm run test:mecanum`, several minutes)
before running it.

## Talking to a real robot over USB

**Not enabled for this container as of 2026-11-02.** There is no `/dev/host`, no
`/dev/bus/usb` and no `/dev/ttyUSB*` in here, and `arduino-cli board list` finds nothing,
so a plugged-in robot is invisible: everything has to go through the human (flash, then
read the instructor console on mecanum/ir.html in their own browser).

The human's other projects (the picos, the wormhole container) do have it, so it is a
conf change plus a recreate, not new machinery. What those containers get:

- the host's `/dev` mounted at `/dev/host`, and `/dev/bus/usb` passed through;
- boards then show up as `/dev/host/ttyUSB*` (CH340 clones, 1a86:7523) or
  `/dev/host/ttyACM*` (genuine Uno). **Always glob, never hardcode the port.**

Check it with `python3 -c "open('/dev/host/ttyUSB0','rb+')"`. Permission denied means the
host's udev rule or device group, which is the human's to fix: tell them, do not work
around it.

Ready for the day it is enabled (both in the home volume, so they survive a recreate):
- `~/.venvs/bot/bin/python` has pyserial 3.5;
- `arduino-cli` with `arduino:avr@1.8.8`, so `arduino-cli upload -p /dev/host/ttyUSB0
  --fqbn arduino:avr:uno ir/ir.ino` is the flash step;
- `scripts/bot-console.py` is the bench version of the instructor console: `--list`,
  `-c '?' -c 'k?;'`, `--listen <s>`, and `--light <s>` for the repeating light reading
  with each sensor's range (the same check as "Watch the light sensors" on the page).
  Globs the port, 9600 baud, every sketch here. **Never run against a real board yet.**
  Opening the port resets the board, so the boot banner comes first.

Driving a real robot from in here needs care: `b`, `?`, `k?;` and `p?;` only read, but
`i##1;`, `m...` and `v...` move it. Ask before sending those, and ask whether the robot
is clear of the table edge.

Other facts:
- The simulator suites call `~/.local/bin/arduino-cli` by that exact path and build
  `temp/mecanum-sim/uno-sim` from `scripts/mecanum-sim/uno-sim.c` themselves.
- Python figure scripts (scripts/*.py) use only the standard library.
- Local server: `cd scripts && npm run serve` (port 8220, one of this project's published
  ports 8220-8229, bound 0.0.0.0, so the human opens http://127.0.0.1:8220/).
- Push: `sh scripts/push.sh` (token `makerlabkids_robotics` in /workspace/.env, a
  fine-grained token for MakerLabKids/robotics with Contents read/write; never print it).
  Older tokens in the old container belonged to the acklenx account and get 403 here.
- Your memory: if `temp/robotics-handoff/memory/` exists, copy its files into your
  memory directory (they are the old container's robotics notes, paths already
  rewritten), then tell the user it is done.

Gitignored local-only files (not on GitHub; copied over by hand if at all): the kit's
assembly video (`Assembly Tutorial Video.mp4`), the kit PDF (`Mecanum Wheels Robot Car Kit (1).pdf`),
`mecanum/lafvin/` (the vendor's sample code), `ir/temp/` (the Blocks editor's original
zip and the web-session conversation it came from), `temp/` (scratch, including the
source PDFs of the assembly instructions and wiring diagram; the published copies are
in resources/).

## Where things stand

- Firmware line 0.10.x. ir.ino, mecanum_holonomic.ino and calibration.ino are all 0.10.82
  and share one motion engine (`npm run check:shared`, which checks FIRMWARE_VERSION too:
  bump all three together). ir.ino is what the class runs.
- Pages: Programming Guide (mecanum/ir.html) 0.1.20, Remote Guide 0.1.19, Light bot 0.1.15,
  Wiring 0.1.10. Versions live in the page titles.
- Hosting: Cloudflare Worker (static assets) deploys every push to main in about a minute.
  It stopped after the repo transfer and was reconnected on 2026-11-01: for a while the
  live site still served 618e9d7 (the last pre-transfer commit touching a served file),
  then reconnecting the repo to the MakerLabKids org plus an empty commit (1a2f253) started
  it again. Confirmed working: the live site is byte-identical to HEAD. If it ever stalls
  again, the symptom is pushes that never appear with no cf-cache-status or age on the
  responses (the Worker serving old assets, not a cache), and the fix is the human's:
  Cloudflare dashboard, Workers, the robotics worker, Settings, Build.
  Note when checking: /index.html 307s to /, so diff against `curl -sL .../` or curl
  saves an empty redirect body and the page looks like it does not match.

## Open items

Robots and firmware:
1. The flashlight calibration for the light modes (`# # 1` / `# # 2`, ir.ino 0.10.81)
   worked well on the first real bot (the user, 2026-11-02). On a second bot the user
   rewired connector, LDR and resistor and it still only "sometimes sees the light", and
   they could not get cleanly through the calibration. Open: whether that bot's LDRs are
   wired and soldered right, so 0.10.82 ships the tools to tell: a live light-sensor
   readout on the instructor console of mecanum/ir.html ("Watch the light sensors": it
   asks `b` over and over and shows left, right and back with the range each has covered)
   and a tick plus "light: # # - press 1 to follow, 2 to run away" when `# #` is armed,
   so a dropped `#` is not mistaken for the 5 s window running out. Ask what the readings
   showed before changing any light code.
2. Troubleshooting guide page: wanted, not written. Collect entries in the log below as
   problems come up; build the page when the user asks.
3. Crab walking (strafe) is very poor; the user wants it fixed, ideally inside the remote
   calibration `# # #` of ir.ino.
4. mecanum_holonomic.ino is nearly out of flash (about 32.1 of 32.26 KB). It ships with
   USE_TOF 0 and USE_SONAR 0, so the Blocks page's laser/sonar blocks fault on it (clean
   message, no hang). IMU tilt/accel blocks are simulator-only.
5. Never confirmed on real hardware: HC-06 rename with rename.ino (HC-05 rename works),
   the mecanum_holonomic Tune Save surviving a power cycle.

Site and tests:
6. `npm run check:contrast` flags 17 low-contrast styles on ir.html, remote-guide.html and
   challenges.html (pre-existing).
7. `npm run test:workshop` (the archived 2WD app) crashes in jsdom: "fetch is not defined"
   inside Blockly. Pre-existing.
8. Pre-existing simulator failures, same on code from before the move: sticks (expects a
   161.8 mm/s start and 0.45 strafe), sensors (ADC layout), rename (answer timeout). Do not
   chase them as new regressions; fix them when asked. Confirmed again 2026-11-01 on a
   fresh container: `npm run test:mecanum` is 6 of 12 failed, and the six are exactly
   these three in both usb and bt. The other six (calpage usb/bt, program usb/bt, blocks
   usb, ir usb) pass, so that is what a healthy run looks like right now.
9. mecanum/README.md still points at /arduinobot/remote.html, which lives on
   makerlabkids.com, not here.
10. The older 2WD pages under arduinobot/ are still in the makerlabkids repo (not this one).

## Robot troubleshooting log

Each entry: date, bot, symptom, cause, fix, and how it was closed (a troubleshooting
item for the guide, or a code fix).

1. 2026-10-30, a kid's bot on ir.ino: hold the forward arrow, it only moves a short tap.
   Cause: dying battery in the IR remote; it sends the first frame but not the repeat
   frames of a held key (hold-to-drive needs repeats, IR_RELEASE_MS 250). Tapping still
   works every time, which makes it look like a robot bug. Fix: new remote battery
   (probably a CR2025 coin cell, not checked against the kit). CLOSED: troubleshooting
   item (row in mecanum/ir.html since 0.1.18).
2. 2026-10-30, light follower bots (0.10.80): start fine, then keep driving with no
   flashlight. Cause: the room-light level froze while the light was "seen", so a brighter
   floor counted as the flashlight; also mismatched LDRs. CLOSED: code fix in 0.10.81
   (flashlight calibration, per-LDR gains, room catch-up). Guide items: the two new rows
   on the Light bot page (never twitches = needs "nothing" between shines; slow "no"
   shake = weak sensor).
3. 2026-11-02, a second light bot (0.10.81/0.10.82): "sometimes sees the light", never
   cleanly through the teach-in, after rewiring connector, LDR and resistor. Not yet
   diagnosed. Suspects, in the order worth checking: a swapped LDR and resistor (the
   divider is 5V - LDR - pin - resistor - GND, so covering the LDR must make the number
   DROP; swapped, it rises and nothing ever counts as a shine); an IMU still plugged into
   the shield's I2C header, because A4/A5 are SDA/SCL; a cold joint or loose connector
   (the number jumps when the wire is wiggled); too little swing (the teach-in needs a
   rise of 60, a flashlight should give 150 or more; GL5537 with 4.7k worked on the
   user's robot). Also note the flash start can steal the bench: shining left, right,
   left, right to TEST the sensors is itself the no-remote start, and it drops the robot
   into the "both sensors now" half of the teach-in, so the side shines the user then
   does are ignored. Watch for "light: follow" appearing by itself.

## How the user works (learned the hard way)

- **Talk during long runs.** Say what is about to run and roughly how long BEFORE any
  test or sim run over a minute, and post short updates while it runs. When the user is
  waiting to see something, push first (after a quick check), then run the long suites
  in the background and report.
- **Write notes before long or risky steps.** Sessions have crashed mid-task; update your
  memory (or this file) with goal, files, test status and next step first.
- **Versions: bump only the build number** on every edit and commit (0.10.81 -> 0.10.82).
  Minor and major bumps only with the user's explicit say-so; a change that breaks the
  app/robot protocol is a new minor line and needs asking first (see CLAUDE.md).
- **Compile every .ino change** and check the size; flash is tight. Run blocks-e2e too
  after ir.ino changes (it broke once unnoticed).
- **Classroom first.** Calibration and setup must work for a teacher with kids: on the
  robot or from the remote, no typing constants, no reflashing, few purposeful steps,
  always clear which numbers the robot is running. Before adding a measurement, say what
  it buys. One step at a time; do not add two steps at once.
- **Never scroll or move focus by code** in pages. Open and close sections in place; use a
  sticky banner if something important is off screen.
- **American English** everywhere (flashlight, never torch). Third-party API names stay.
- **It is light following**, never line following, even if the user types "line".
- **The live site shows only what the current class has covered**: nothing that reads like
  a schedule or "next week". Retire pages into archive/, never delete.
- Robot hardware facts: Bluetooth is SoftwareSerial (HC-06 on A0/A1) and drops bytes
  while the sketch replies, so apps send one command and wait for its answer (test with
  the `bt` variants of the sim suites). The IR receiver is on D10; LDRs on A4 (left),
  A5 (right), optional back LDR on A3; GL5537 with 4.7k worked on the user's robot.

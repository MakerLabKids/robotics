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

- Firmware line 0.10.x. ir.ino, mecanum_holonomic.ino and calibration.ino are all 0.10.83
  and share one motion engine (`npm run check:shared`, which checks FIRMWARE_VERSION too:
  bump all three together). ir.ino is what the class runs. **0.10.83 reads the LDR divider
  the other way round** (resistor to 5V, LDR to GND, `LIGHT_BRIGHT_READS_HIGH false`): a bot
  must have the new cable build (log entry 4) before it gets 0.10.83, or it sees "light"
  in the dark.
- Pages: Programming Guide (mecanum/ir.html) 0.1.21, Remote Guide 0.1.19, Light bot 0.1.16,
  Light sensor build 0.1.10, Wiring 0.1.11, Workshop app 0.6.38. Versions live in the page
  titles. `scripts/check-version-bump.js` (pre-commit hook, `npm run test:site`,
  `npm run check:versions`) fails a commit that edits a sketch or a versioned page without
  a new build number.
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

## Bot roster (status per bot, started 2026-11-04)

One line per robot, updated whenever a bot is on the bench. "Last seen" is the date the
status was checked. Add a bot the first time it is mentioned; never drop one.

"Wiring" is the LDR cable: OLD = LDR to 5V, resistor to Gnd (sketches up to 0.10.82);
NEW = the servo-cable build of log entry 4 (resistor to 5V, LDR to Gnd; 0.10.83 or newer).
Wiring and firmware must match.

| Bot | Firmware | Wiring | Status (last seen) | Open problem |
|---|---|---|---|---|
| Coltrane's bot | ir.ino | no light sensors? (not checked) | drives; fixed 2026-10-30 | none (was a dying remote battery, log entry 1) |
| Light bot A (the user's) | ir.ino 0.10.81+ | OLD | calibration teach-in works (2026-11-02) | rebuild the cables the NEW way before flashing 0.10.83 |
| Light bot B | ir.ino 0.10.82 | OLD, rewired 2026-11-02 | "sometimes sees the light", never cleanly through the teach-in (2026-11-02) | rebuild the cables the NEW way, flash 0.10.83, then the bench procedure (log entry 3) |
| Tucker's bot | ir.ino, 0.10.83 to flash | NEW (first one, 2026-11-04, resistor bands read 4.7k in the photo) | cable soldered and heat-shrunk; not yet on the bot or tested | flash 0.10.83, then the three `b` readings (room, covered, flashlight) to mark verified |

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
   **Bench procedure** (2026-11-02, bot on the test stand, USB in, serial monitor at
   9600, wheels free to spin): the keys can be typed, so the remote is out of the loop -
   `i##1;` is `# # 1` and `iO;` is OK. 1) `b` three times, room light, no flashlight:
   both numbers mid-scale and within about 50 of each other. 2) cover the left LDR with a
   hand, `b`: left must DROP and right must barely move; uncover; same for the right.
   3) flashlight on the left from 10-20 cm, `b`: left up 150 or more, right up much less
   (a shine has to beat the other side by 1.5x to count). Keep each flashlight test to
   ONE side and pause 6 s between sides, or the alternating hits are the flash start.
   4) `i##1;`: `light: # # - press 1 to follow, 2 to run away`, tick, `light: follow
   (left N, right N)`, `light: calibrate, one sensor at a time`, wiggle. Then left,
   nothing, right, nothing, left, nothing, right (`light: shine 1 left` ... 4 + a tick
   each), `light: now both`, both, nothing, both (`light: both 1`, tick, then
   `light: calibrated, gains left X%, right Y% (shine left +N ...)` and a nod).
   5) it drives: `light: sees it`, wheels follow the light, `light: lost it` and stop.
   The spans in the calibrated line are the numbers to report.
   Also note the flash start can steal the bench: shining left, right,
   left, right to TEST the sensors is itself the no-remote start, and it drops the robot
   into the "both sensors now" half of the teach-in, so the side shines the user then
   does are ignored. Watch for "light: follow" appearing by itself.
4. 2026-11-04, Tucker's bot (ir.ino): the LDRs' hot and ground were reversed at the
   shield. Cause: the shield's analog header is three rows in the order +5V (top),
   Gnd (middle), A pin (bottom), and the LDRs are wired with standard servo extension
   cables, whose plug is signal, red (hot) in the MIDDLE, black. Pushed on by the plug's
   own order, red lands on Gnd and black on +5V (or signal on +5V, depending on which
   way round), so the divider is upside down: the number goes DOWN with the flashlight,
   or sits at 1000 and never moves. Nothing fries, an LDR and a resistor have no
   polarity; it just reads wrong. Making it worse, the header pins are not butted
   together, so the plug only fits after bending the pins. Fix (the user): re-pin the
   servo plug to the header's order, red on +5V, black on Gnd, signal on the A pin,
   then bend the pins to take the plug. Status: rewired; CLOSE as a troubleshooting
   item once the `b` check passes (room: both mid-scale; cover left: left drops;
   flashlight on left: left up 150 or more, right barely).
   Guide item: "the shield's LDR header is NOT servo order: red goes on the top row,
   not the middle". Candidate for the wiring page too (the header paragraph says
   three rows, not their order).
   Option raised by the user 2026-11-04: the servo headers (SER1 = D10, SER2 = D9) are
   in proper servo order. They cannot take an LDR: D9/D10 are digital pins, the Uno
   reads voltages only on A0-A5, and D10 already holds the IR receiver. What they CAN
   do is power: one servo plug on SER2 gives 5V (middle) and Gnd for both LDRs with no
   bending, and only the two signal wires go to A4 and A5 (single-pin jumpers on the A
   row). Not adopted yet; if it is, wiring.html and light-build.html change to match.
   DECIDED instead (the user, 2026-11-04, for ALL bots): keep the servo cable as it is,
   cut the far end, solder the parts on there: the resistor on the wire that lands on
   +5V (the cable's black, given the shield's row order), the LDR on the wire that
   lands on Gnd (the cable's red; it stays the one bare wire past the heat shrink, so
   bare = ground, harmless), the signal wire at the junction. That is a divider the
   other way round, 5V - resistor - pin - LDR - Gnd: brighter reads LOWER. The code is
   built for it: ir.ino `LIGHT_BRIGHT_READS_HIGH` (line 179) goes false, and
   mecanum_holonomic's `LIGHT_DEFAULT_BRIGHT_READS_HIGH` (line 485) with it, so the
   set-aside Workshop app agrees. Everything above lightRead() (b, calibration, flash
   start, thresholds) works on the flipped value and needs no change.
   The flip touches: both sketches (build bump), the simulator scripts (ir-e2e drives
   the LDRs in mV with room 2000 / shine 3500: every value becomes 5000 - mV, which
   also ends the 3.3 V ADC cap problem), wiring.html (circuit text, schematic,
   "number goes DOWN in bright light" row inverts), light-build.html (resistor goes to
   +5V, not Gnd), and the troubleshooting rows. Known small loss: lightFindBack()
   detects the back LDR by the pin reading under 1015 with the pull-up on; the
   inverted divider sits near the top in a DARK room, so a back LDR can be missed
   with the lights off (only matters for the optional back LDR).
   Fleet rule: wiring and firmware must flip together. A bot wired the old way on
   the new firmware sees "light" in the dark and never gets through the teach-in.
   Roster gets a wiring column (old / new) until every bot is done.
   CLOSED 2026-11-04, both kinds. Code fix: 0.10.83 (commit eb0c07d) flips the reading in
   all three sketches, ir-e2e maps its LDR voltages, versions.json 0.10.83. Troubleshooting
   items: wiring.html 0.1.11 (the class build paragraph, the schematic and steps the new
   way round, the GL5537 row says 4.7k, new rows: B,0,0,0,0 = the LDR has no ground, a
   number stuck at 0 = plug upside down, goes DOWN in bright light = wired the old way),
   light.html 0.1.16 (same two symptoms), ir.html 0.1.21 (the divider line). The
   light-build page (0.1.10) keeps its dupont build with connectors 1 and 2 relabeled
   (1 Gnd, 2 +5V): the same physical build is the inverted divider. A page for the
   servo-cable build is still wanted; it needs photos of the user's cable.
   The fleet cable build (photo 2026-11-04, the user): a servo extension cable cut at
   one end. Red soldered straight onto one LDR leg (that wire lands on the Gnd row;
   stays bare past the shrink). Black onto the FAR end of the 4.7k resistor (lands on
   the +5V row). White (signal, lands on the A row) at the junction of the resistor
   and the other LDR leg. One blue heat shrink over the resistor side, up to the LDR
   base, so the only bare metal is the ground lead. Check with a meter at the plug
   before shrinking: black-white 4.7k steady, red-white = the LDR (changes with
   light), red-black = the sum. light-build.html describes the OLD build (resistor to
   Gnd, dupont pins) and gets rewritten to this one with the flip.

## Troubleshooting steps for the kids (draft for the guide page)

Collected while fixing bots. Kid language, one check per line, in the order a kid should
try them. Each line says what to look at and what "good" looks like. When the guide page
is built, these rows move there.

Robot does nothing at all:
- Is the power switch on? The shield's light should be on.
- Are the batteries in the right way, and charged? Dim shield light = flat batteries.

Robot moves a little then stops when you hold an arrow:
- Tap the arrow 3 times. If every tap works but holding does not, the REMOTE battery is
  dying. Swap it (coin cell), not the robot.

Robot does not see the flashlight (light bot):
- Hold the flashlight 4 to 8 inches from one sensor, not both.
- Nothing in between: point the flashlight at the ceiling between shines, or the robot
  thinks it was one long shine.
- A slow "no" shake means that sensor is weak: tell a grown-up which side.
Light bot: the number goes DOWN when the flashlight is on it (check with `b`):
- The LDR and its resistor are swapped (the old way round). The resistor goes from +5V
  to the A pin, the LDR from the A pin to Gnd. Or the robot has a sketch older than 0.10.83.

Light bot: one number sits at 0 and never moves:
- That plug is on upside down. The signal wire goes on the row at the board's edge.

Light bot: it turns AWAY from the flashlight:
- Left and right are swapped. The left sensor goes on A4, the right one on A5.

Light bot: plugging the sensor cable onto the shield (every bot):
- The three-row header is +5V on TOP, Gnd in the MIDDLE, the A pin at the edge. The plug
  goes on with its white (signal) wire on the edge row. Then black is on top and red in
  the middle, and that is right for these cables (the resistor is on the black wire, the
  LDR on the red one). Check with `b`: cover the sensor and its number must go DOWN.
- The pins are spaced apart. A grown-up bends them together so the plug fits.

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
- Shield header fact (2026-11-04): the analog header's three rows are +5V (top), Gnd
  (middle), A pin (edge). Servo plugs have red in the middle, so a servo cable pushed on
  signal-to-the-edge puts black on +5V and red on Gnd; the fleet build (log entry 4)
  accepts that: resistor on black, LDR on red. The pins must be bent together to fit.
- Robot hardware facts: Bluetooth is SoftwareSerial (HC-06 on A0/A1) and drops bytes
  while the sketch replies, so apps send one command and wait for its answer (test with
  the `bt` variants of the sim suites). The IR receiver is on D10; LDRs on A4 (left),
  A5 (right), optional back LDR on A3; GL5537 with 4.7k. Since 0.10.83 the divider is
  5V - resistor - pin - LDR - GND (the sketch flips the reading).

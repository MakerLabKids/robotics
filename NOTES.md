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

- Firmware line 0.10.x. ir.ino, programming.ino, mecanum_holonomic.ino and calibration.ino
  are all 0.10.86 and share one motion engine (`npm run check:shared`, which checks
  FIRMWARE_VERSION too: bump all four together). ir.ino is what the class runs today;
  **programming.ino (2026-11-04) is the next one: ir.ino for calibrated robots, with
  remote AND Bluetooth programming** (see "programming.ino" below). **0.10.83 reads the LDR divider
  the other way round** (resistor to 5V, LDR to GND, `LIGHT_BRIGHT_READS_HIGH false`): a bot
  must have the new cable build (log entry 4) before it gets 0.10.83, or it sees "light"
  in the dark. **0.10.84 is the two-shine teach-in** (log entry 5): one shine per side,
  either order, nod, go; no "both" step; a weak side gets one more shine, not a restart.
  **0.10.85: the 8 (repeat) works typed before its steps as well as after, and a long
  program line over Bluetooth arrives whole** (log entry 8). **0.10.86: a step that runs
  another saved program** (`* 2 <slot>` on the remote, `g<slot>` in a program line; see
  "programming.ino", "Programs that run programs").
- Pages: Programming Guide (mecanum/ir.html) 0.1.25, Remote Guide 0.1.21, Light bot 0.1.19,
  Light sensor build 0.1.11, Wiring 0.1.12, Blocks 0.1.12, Connect with Bluetooth 0.1.3,
  Sticks 0.1.12 (Full screen / Exit), Tune the robot 0.1.0, Workshop app 0.6.39. Versions live in the page
  titles. A nav change (scripts/site-nav.js) rewrites every page, so every versioned page
  needs its build number raised in the same commit (title, plus APP_VERSION / EDITOR_VERSION
  where a page has one, the title in scripts/square-figs.py, then
  `node scripts/snapshot-mecanum-app.js --list` for the Workshop app). `scripts/check-version-bump.js` (pre-commit hook, `npm run test:site`,
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

## programming.ino (started 2026-11-04)

The user: "a new program, programming.ino, where we introduce Bluetooth programming.
Keep IR programming, but not the current demo programs. The bots are calibrated so we
can drop all of that (just keep the offsets, which are stored on the bots anyway). Keep
the light follower. Drive with a phone, program on a computer and send that to a bot to
run. You make that fit."

What it is: `programming/programming.ino` = ir.ino minus the nine built-in demos (an
empty slot answers "is empty" and a "no") and minus the `# # #` remote calibration (a
third `#` is one more `#`). Everything else is the same code, and
`scripts/check-mecanum-shared.js` now fails if any function or constant the two both
have differs (89 functions, 76 constants; runSlot, handleProgramText, handleKeyIdle and
handleKey differ on purpose). It reads the motion numbers saved on the robot exactly as
ir.ino does, so uploading it over a calibrated ir.ino keeps the calibration AND the
saved slot programs (programming-e2e proves both with a simulated upload). 79% of
flash, 905 bytes of RAM free (ir.ino: 91%, 887).

What turned out to exist already: ir.ino has always read commands from Bluetooth as
well as USB. Phone driving is the `v` command (the Sticks page), programs from a
computer are `p<n>=<steps>;` (the Blocks page, Remote slots), run with `p<n>;` or
`* <n>`. So nothing had to be added for the protocol. What was broken and is fixed in
0.10.85 (both sketches): a slot line longer than 64 bytes lost bytes over Bluetooth
(SoftwareSerial's buffer; a full slot is 100), and an 8 typed before its steps did
nothing.

Known limit, not fixable in firmware with this module: the HC-05/06 on SoftwareSerial is
half-duplex. A byte that arrives while the robot is sending is lost. One command at a
time, wait for the answer. A single `x` (stop) sent while a running program prints
"step 3: ..." is lost about one time in twenty, so the Blocks page sends x three times
(0, 60, 120 ms) and so does programming-e2e. Sticks sends "xx" but the robot says
nothing while it drives by `v`, so that one is safe.

Programs that run programs (2026-11-05). The user: "In Blockly have a start block that
can attach to the top of a block of code. That block will be the one that runs if there
are multiple blocks in the editor. And we should be able to call other programs as well
as other functions and routines, so the programs should have names that can be called."
- Already there: the start block ("when RUN is pressed", Start category; loose stacks do
  nothing; several start blocks run top one first), subroutines (the Subroutines
  category), and reading what was typed on the remote into the editor ("Remote slots...",
  "Read the robot's slots", then "Open as a new tab" or replace tabs 1 to 9).
- New in Blocks 0.1.11: **"run program <tab name>"** (Start category). The list is the
  tab names; renaming a tab renames the blocks that run it, in every tab. Each called tab
  becomes a function of its own in the generated code, so its variables and subroutines
  stay its own. A name that is no tab is kept, shown as "(no such program)", and RUN says
  so. A program that runs itself stops with a reason 20 deep.
- New in firmware 0.10.86 (ir.ino and programming.ino): the step **run program** =
  `* 2 <slot>` on the remote, `g<slot>` in a program line (`p9=g1 f20 g1;`). The called
  slot runs right there, then the caller carries on; any key or x stops the lot. 3 calls
  deep (RUN_MAX_DEPTH, about 100 bytes of RAM each); deeper, or an empty slot, the step is
  skipped with a line on the console, so a program that runs itself goes four rounds and
  ends. Repeats work around it (`g1 n4`). This is also the way past 16 steps: nine slots
  of 16 that can run each other.
- Slot export: a "run program" block naming one of tabs 1 to 9 is sent as one `g` step
  (the tab has to be sent too; Send all does). If the connected robot said a firmware
  older than 0.10.86 (boot line or K,fw), the moves are written out instead. Read back
  from the robot, `g2` opens as "run program" naming tab 2.
- Not changed: the printable Remote Guide (hand-placed print layout, and the class is not
  on 0.10.86 yet). The Programming Guide 0.1.24 has the key (2 = run a slot).

The user asked 2026-11-05 whether a bot can be reset (as power off and on) from either
remote, because "some programs get truncated". Answer given: no restart exists (# and x
only stop); a restart cannot mend a saved program (slots are in EEPROM). Offered, NOT
built (no answer yet): `# # 0` on the remote and `kr;` on the console as a true restart,
and an error instead of silently keeping 16 steps when a program line has more. Where a
program can be cut short: more than 16 steps (a line: silently; the remote: "no" at step
17), bytes lost over Bluetooth (sketches older than 0.10.85 lost the tail of a line over
64 bytes; any version loses bytes sent while the robot is answering), or the run being
stopped (any key from ANY remote in the room, a sagging battery restarting the board).
`p?;` shows what is really stored. Still unknown: typed on the remote or sent from
Blocks, and which firmware.

Next class (the user, 2026-11-05: "tomorrow"): the kids play with light following; if
everyone is good and there is time, the Bluetooth modules go on and loaner phones connect
for the first time. Nothing Bluetooth has run on a real robot or a real phone yet, so:
try ONE bot and ONE loaner phone before class (Android, Chrome 138 or newer, pair the module
in the phone's Bluetooth settings with PIN 1234 or 0000, then the Sticks page,
robotics.makerlabkids.com/mecanum/sticks, "Serial", pick the module). Every module
arrives with the same name (HC-05 / HC-06): name them first (`kN<name>;` over USB, then
power off and on; never confirmed on an HC-06) or pair one bot at a time with the others
switched off. iPhones cannot connect. The light code has not changed since 0.10.84.

Bluetooth sheet (2026-11-05). The user liked the light sensor build sheet ("nice graphics
and step by step") and asked for the same for Bluetooth, to print for class:
**mecanum/bluetooth-build.html** (How to Plug In Bluetooth, one letter page, first in the
Bluetooth subnav as "Plug in the module") and its print-ready copy
**resources/bluetooth-sheet.pdf**. Where the wires are (the user, 2026-11-05): a hole in
the chassis BETWEEN the sonar bracket and the Arduino / driver tower, not under the
sensor; the wires leave the Arduino, go down through another hole, run forward under the
bot, and the connectors come up into the hole from below, halfway in, and stop. So
picture 1 is a side view (0.1.2). On the shield (the user: "an important depiction") the
four wires make an L on the analog header: +5V, Gnd and A0 down the A0 column, A1 next to
A0 (top row all +5V, middle all Gnd, bottom A0-A5). Since 0.1.4 two panels show it, drawn
by `python3 scripts/bluetooth-figs.py` (the light sheet's board_overview and
header_closeup with other pins marked; keep the two scripts' board looking the same).
Ten steps: find the hole, wiggle and push (the hole just fits 4 dupont connectors; tip:
a quarter turn of each connector may help), find the analog header, make an L, which wire is which
(+5V VCC, Gnd GND, A0 TXD, A1 RXD), plug in the module, switch on (blinks), connect
("your robot's name (it may be listed as HC-06)": the user says names are showing up now),
Sticks and Blocks with light screenshots (img/sticks-light.png, img/blocks-light.png),
links and QR codes. Wires are drawn red 5V, black Gnd, blue and yellow data, and the text
never names a color (the kids' wires are random colors: the user's rule). Remake:
`node temp/shot-light.js` (screenshots), `node temp/print-bt.js` (PDF to temp/, copy it
to resources/). Not checked against a real module: the pin order drawn in step 4
(RXD, TXD, GND, VCC).

Tune the robot (2026-11-05). The user: "how much room do we have for a little bit of
calibration from bluetooth mode? I really need a simple rotation calibration so we can
turn 90 degrees. Distance would be second: just a 1 meter test. And 3rd, a stretch: a way
to send more power to one of the diagonal pairs when strafing. Most of the bots don't
strafe well: two wheels (a diagonal pair) are barely turning while the other two are
furiously spinning."
- Room: programming.ino is 25942 bytes (80%, 6314 free), 904 bytes of RAM free. None of
  it was needed: the sketches already take `m` test moves, `km<i>=<v>;`, `kw;`, `kd;` over
  Bluetooth, so the calibration is a page, **mecanum/tune.html** (Tune the robot 0.1.0, in
  the Bluetooth subnav). No firmware change, no reflash, works on ir.ino and
  programming.ino as they are (0.10.86 tested).
- 1 Turn: "Turn right 4 times" (four `m0,0,90;`), then the kid turns a picture of the
  robot (5 degree steps) to match where the real one points, Fix it: spin efficiency x
  (360 + error) / 360, saved. The same math as ir.ino's `# # #` step 3.
- 2 Distance: "Drive 1 meter" (`m0,1000,0;`), cm with -5 -1 +1 +5 buttons, Fix it: the
  five speeds (start, half, 192, max, strafe start) x cm / 100 as `# # #` does, AND spin
  and strafe efficiency / the same factor. That second half is new: without it a distance
  fix of f changes every turn by f; with it a turn asks for the same PWM for the same time
  (tune-e2e checks the duties are identical before and after). So the three cards can be
  done in any order.
- 3 Slide: the diagonal bias (M_DIAG_BIAS, index 21): "More orange" (FL+RR) / "Even" /
  "More blue" (FR+RL) in 0.05 steps, slide left / right 50 cm tests, and after a slide
  "did it creep forward or backward?" which moves one step the right way (sliding right,
  FL+RR roll forward: creeping forward means that pair is the strong one).
- **Why most bots strafe badly: the class default STRAFE_DIAG_BIAS is 0.34**, measured on
  robot 2 on 2026-10-07 (its comment says robot 1 twisted badly at 0.101). It takes 34%
  from FL+RR and gives it to FR+RL, and at the program slide speed the weak pair falls to
  the start power: the simulator shows motor power 196, 85, 255, 86 at 0.34 and 196, 196,
  255, 255 at 0. That is exactly "two barely turning, two furiously spinning". Not changed
  in the sketches (a firmware bump on four sketches, and robots with saved numbers keep
  theirs anyway): told the user; "Even" on the Tune page is the per-robot fix. **Decided
  2026-11-05 (the user): "leave it as is."** The sketch default stays 0.34; do not ask
  again.
- Each card has its own undo (back to how it was at connect); "Back to the class numbers"
  is `kd;`. Every change is saved at once (`kw;`). A fixed STOP bar sends x three times.
- Nothing of this has run on a real robot. First things to check on hardware: the dial's
  direction (the picture turned right = the robot went past the line clockwise), and which
  color pair is which on a real bot (orange = front left + back right).
- Simulator fact for Bluetooth tests: in `live bt` mode the simulator's stdout is the
  robot's USB copy of an answer. The Bluetooth copy of the same bytes leaves later (the
  sketch buffers up to 255, about 270 ms), and a command sent in that gap is garbled (an
  `m` was read as `b`). A real phone only hears the Bluetooth copy, so tune-e2e delays
  what it hands the page by 300 ms in bt mode. The page itself also keeps its buttons
  waiting until `K,end` has arrived.

Not done yet (next steps, in order):
1. Flash programming.ino on one calibrated bot and check on hardware: it drives as
   before (numbers kept), `* 1` on an empty slot shakes "no", `# # 1` light mode, then
   pair the Bluetooth module and try Sticks from a phone and "Remote slots... Send" from
   Blocks on a computer, including a 16-step slot and STOP during a run.
2. DONE 2026-11-05 for phone driving (the user: "how do we connect with bluetooth or
   drive with sticks... that needs to be enabled now"): "Bluetooth" is in the nav, with
   a kid page mecanum/bluetooth.html (How to connect: the Bluetooth button first, no PIN;
   robot not in the list = pair in Settings with 1234 / 0000, then Serial; how the sticks
   work; troubleshooting; a QR code to Sticks) and Sticks itself (out of "set aside", its
   narrow-screen Back link goes to the guide). The connect steps come from what the user
   found on their own phone on 2026-10-05 (both buttons worked on the kit's module; the
   Bluetooth button needed no PIN); nothing has been tried with ir.ino / programming.ino on
   a real robot yet. Names: the Sticks Bluetooth list filters by name prefix (HC, HM, JDY,
   BT, MLT, MLK) or names saved on that phone, so the page says to name robots MLK-....
   Still to write: the Blocks send/run part for kids (Blocks stays a tease).
   **The bots were named before** (the user, 2026-11-05: "we previously named the bots...
   did that get blown away?"). Answer: no. The name is in the Bluetooth module's own
   memory; a sketch upload never touches it, and only a kN / rename (pending flag, then
   AT+NAME at the next power-on) changes it. Which names, and by which tool, is not
   recorded here: ask, and add them to the bot roster. So ignore the "every module
   arrives with the same name" advice above for this fleet. Names are exact (no MLK-
   prefix since Calibrate 0.1.10), so on a loaner phone that never saved the name the
   Sticks Bluetooth list may not show a named robot unless its module advertises the
   FFE0 service (unknown). Sticks 0.1.10: closing the list without a pick shows
   "Robot not in the list? Show every Bluetooth device" (acceptAllDevices, as Calibrate
   and Rename have); the guide 0.1.1 says so. Blocks and the Programming page console
   still have no show-all.
   **Correction, later on 2026-11-05 (the user): "when I connect these bots to new phones,
   all of them identify as HC-06."** So whatever the naming did, the kit modules still
   announce themselves as HC-06 to a phone that has not met them. Why is not known (the
   HC-06 rename was never confirmed on hardware, open item 5; a name seen earlier may have
   been the robot's own copy, K,name, or a phone's memory of it). What it means: the first
   Bluetooth list always shows them (the HC prefix), kids cannot pick by name, and there
   are no names to put in the roster. Connect with Bluetooth 0.1.4 says so: every robot is
   HC-06, hold the phone against your own robot and pick the strongest signal, push a
   stick a little to check it is yours, a connected robot leaves the list. Do not write
   pages that count on names. Best guess at the cause (not proven): the kit module answers
   OKlinvorV1.8 AND serves the BLE service FFE0 (found 2026-10-05), so it is a dual-mode
   module with two names. AT+NAME (answer OKsetname, confirmed by the user on 2026-10-05)
   sets the classic name; the BLE advertisement, which is all a new phone's Web Bluetooth
   list reads, keeps HC-06 and needs a second, maker-specific command (AT+NAMB, AT+BNAME,
   AT+LENAME are the usual candidates; none tried). Check that tells: on a new phone,
   Android Settings > Bluetooth > Pair new device shows the classic name. **Confirmed by
   the user the same day: "it shows up in the pairing menu, but not the webpage connect"**
   (the given name is in Android's pairing list; the web page's list says HC-06). Looking
   it up did not settle the command: the FFE0 / FFE1 notify / FFE2 write layout matches
   DX-BT04-E-style modules, whose datasheet lists one AT+NAME only (with a line end, answer
   +NAME=...), and ours answers the linvor way, so it is some other firmware.
   **The probe is built: rename.ino 0.2.4, `B<name>`** (USB only) sends AT+HELP, then
   AT+NAMB<name>, AT+LENAME=<name>, AT+LENAME<name>, AT+BNAME=<name>, AT+BNAME<name>, each
   first as it is (1.5 s for an answer) and then a line end (1.5 s more), prints
   "bt try: <command> -> <answer>" per try to USB, stops at the first OK (or the name said
   back), ends with "bt try: done - the module took one / none of them". `A<text>` and
   `L<text>` send anything to the module (as it is, or with a line end) for trying more by
   hand. Rename Robot 0.1.7 has a "Try the web list name" button that runs B and shows the
   answers. rename-e2e covers it (the simulator's live mode got a `btsend <text>` control
   line to play the module's answer). NOT yet run on a real module. When the user reports
   the answers: put the command that works into rename.ino's renameModule (set both
   names) and into the kN start-up rename of ir / programming / calibration (a four-sketch
   build bump), and take the "every robot is HC-06" wording back out of the Bluetooth
   guide once the fleet is renamed. Not asked for and not built: making the rename work on the
   kit module, or showing the robot's own name (K,name) on Sticks after connecting.
   Found while checking: BT_NAME_EEPROM_ADDRESS is 1040 in ir, programming, calibration
   and rename, but an Uno's EEPROM ends at 1023, so on the chip the flag and letters land
   at 16 to 33 (the address register has 10 bits). Reads and writes agree, so it works,
   and ir / programming / calibration / rename use nothing else down there; but
   mecanum_holonomic keeps its settings from address 0, so saving settings there can
   overwrite the robot's copy of its name (not the module's name), and in the worst case
   leave a pending flag behind. NOT changed (it needs a firmware bump on four sketches
   and loses the stored letters): ask first.
3. Phones: Chrome on Android opens a paired HC-05/06 through Web Serial (the "Connect"
   button with the Bluetooth serial service); iPhones cannot (no Web Serial, and the
   module is classic Bluetooth, not BLE). Not yet tried with programming.ino.
4. `torch` in ir.ino / programming.ino comments should become `flashlight` (American
   English rule); left alone so the two files stay identical to what was tested.

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
8. Pre-existing simulator failures, same on code from before the move: sensors (ADC
   layout), rename (answer timeout). (sticks was a third, expecting a 161.8 mm/s start and
   0.45 strafe: FIXED 2026-11-05, sticks-e2e now works its expected speeds out from the
   robot's own K,cal line and takes the sketch as an argument, `node
   scripts/mecanum-sim/sticks-e2e.js [bt] [programming | ir]`; it passes on
   mecanum_holonomic usb/bt, programming usb/bt and ir bt, and run-all has a
   "sticks bt programming" run.) Do not
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

Fleet note 2026-11-04 (the user): "the bots appear to be working now" after metering
every LDR and every resistor on every bot (the third pass through did it). New rule: meter
each LDR (10-50 k in room light) and resistor (4.7k) before a cable goes on a bot.

| Bot | Firmware | Wiring | Status (last seen) | Open problem |
|---|---|---|---|---|
| Coltrane's bot | ir.ino | no light sensors? (not checked) | drives; fixed 2026-10-30 | none (was a dying remote battery, log entry 1) |
| Light bot A (the user's) | ir.ino 0.10.81+ | OLD | calibration teach-in works (2026-11-02) | rebuild the cables the NEW way before flashing 0.10.83 |
| Light bot B | ir.ino 0.10.82 | OLD, rewired 2026-11-02 | "sometimes sees the light", never cleanly through the teach-in (2026-11-02) | rebuild the cables the NEW way, flash 0.10.83, then the bench procedure (log entry 3) |
| Shep's bot | ir.ino (version not noted) | NEW (reads up with light) | the light delta is far too small: room 0-3, flashlight on the left 13-39, 63 at 3 inches straight in (2026-11-04); the pin sits at 5V, the LDR is about 1.5 M dark / 70 k lit, 10x+ the fleet's | LDR was dead (1.8 M in room light); replaced after metering every LDR and resistor; works (2026-11-04) | none |
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
   (From 0.10.84 step 4 is shorter: `light: calibrate, shine on one sensor, then the
   other`, wiggle, left, nothing, right (`light: shine 1 left`, `light: shine 2 right`,
   a tick each), then the calibrated line and the nod. No "both".)
   5) it drives: `light: sees it`, wheels follow the light, `light: lost it` and stop.
   The spans in the calibrated line are the numbers to report.
   **Which LDR is on the bot, from `b` alone** (2026-11-04; the pack mixes GL5516/28/37/39/49,
   which look identical). With 4.7k the room reading is 1000 x 4.7 / (R + 4.7), so in the
   user's room, same spot, same light: 800 = 1.1k = GL5516; 600-680 = 2.2-3.2k = GL5528;
   370-460 = 5.5-8k = GL5537 (the fleet's grade); 320 = 10k = GL5539; 55-90 = 50-80k =
   GL5549; 0-3 = megohms = a dead cell (Shep's bot). Rule: 250-700 in room light is fine,
   leave it (the teach-in gains cover a 28 next to a 37); above 750 is a 5516 that
   saturates in a lit classroom, swap in a 37 (or 1k on that cable); below 150 is a 5549
   or a dead cell, swap in a 37. The user's loose stock, metered in that room: 2x 1.1k,
   piles at 2.2k, 3.2k, 5.5-8k and 10k, 1x 50k, 1x 80k. The 5.5-8k pile is the one to
   use with 4.7k; a bot's two LDRs should come from the same pile.
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

5. 2026-11-04, the light modes in general (the user, after a class with 0.10.81/82):
   (a) `# # 1` "rotates left most of the time", then a power cycle. Two candidates, the
   console tells them apart: a lost second `#` makes the `1` a left-turn tap (`ir: #`,
   `ir: 1`, `drive: ...`, about 250 ms of turning), or the `# #` tick / the wiggle
   itself reads as "it turned left" (each is spin-left 70 ms then spin-right 70 ms at
   gesture power; if the reverse half stalls the net move is a small left turn) and the
   robot is then silently waiting for shines. (b) The teach-in's "both" step rarely
   registers: each LDR must rise by 20% of its own shine (LIGHT_CAL_BOTH_SHARE) at the
   same time, and with the LDRs at 45 degrees with tubes a flashlight between them
   lights neither enough. (c) Four side shines, alternating, and any weak side starts
   the whole thing over. Proposed (not built): two shines (one per side, either order),
   no "both" step (gains from the side spans alone), a weak side repeats only that side,
   OK still skips; and `1`/`2` accepted after one `#` as well as two, so a lost `#` is a
   light start, not a turn.
   Then the user watched again: "it looks like it shakes no after L R L R". The only "no"
   in the light flow is the weak-side check after the fourth shine goes dark (a side
   whose shine rose less than LIGHT_CAL_MIN_SPAN 60 on the 0..1023 scale), and it
   restarted the whole teach-in. Two things make a real flashlight rise that little:
   the room level chased the flashlight at 1/32 per 20 ms tick while no shine was
   counted yet (a flashlight brought in slowly was half absorbed before it counted), and
   aim (the LDRs look 45 degrees out, down tubes; a shine at the nose barely reaches
   either). CLOSED 2026-11-04: code fix in ir.ino 0.10.84: two shines, one per side,
   either order, a tick each, then the calibrated line and a nod; gains from the two
   spans; no "both" step; the absolute 60 floor is gone, a side is "weak" only when it
   rose less than 1/4 of the other (the gain would clamp), and then it gets a slow "no"
   and ONE more shine on that side alone (the other is kept); still weak after that, it
   nods and goes with the gain at its limit (the console says the spans). The room level
   no longer learns at 1/32 during the teach-in (only the slow 1/400 creep and the
   min-tracking), so a slow approach counts in full. The flash start (four hits) is the
   two shines already and goes straight to the nod. Pages: Light bot 0.1.17 (teach card,
   no-remote line, "no" row), Programming Guide 0.1.22. The remote grammar is unchanged
   (`# # 1`): accepting `# 1` was dropped, a kid pressing `#` then `1` to turn left would
   land in light mode. Guide items: the rewritten "Shakes no" row. Not yet tried on a
   real bot: the user has to flash 0.10.84 and run the bench procedure.

6. 2026-11-04, Shep's bot (the user): "the delta is too low to trigger a light flash, so
   it's hard to calibrate, and because the delta is low shining into a single LDR, it has
   no chance of driving forward when the light is spread out a little more". OPEN. What
   the numbers mean: the flash start needs a rise of LIGHT_FLASH_MIN 120 (of 1023) on
   one side, the teach-in counts a rise of 30, and following needs a gained rise of
   LIGHT_SEEN 40 on the brighter side; a flashlight on one tube gives 300-500 on the
   user's bot. Suspects, in the order to check with `b` (room light, no flashlight):
   (a) that sensor's room reading sits near the top (800+): the LDR is a more sensitive
   type from the pack (GL5516/5528, low resistance) or the room is bright, and with 4.7k
   the divider is squashed against 5V, so the flashlight has nowhere left to go; the fix
   is a smaller resistor for THAT bot (1k) so the room reads mid-scale; (b) near the
   bottom (under 150): the opposite (a GL5549 or a dark corner), a bigger resistor
   (10k); (c) the reading barely moves when the LDR is covered: a bad joint, the wrong
   row, or the tube pointing at the floor so the flashlight never reaches the LDR face.
   Firmware idea if it is (a) or (b) and we do not want per-bot resistors: make the
   teach-in gains absolute (gain = a reference rise, say 300, divided by the side's
   span, limit 8) instead of relative (mean / span), so LIGHT_SEEN and the steering
   mean "a share of this bot's own flashlight"; the flash start (before any teach-in)
   would still need the raw 120, so a weak bot starts from the remote. Not built;
   needs the `b` numbers from Shep's bot first.
   The `b` numbers (the user, 2026-11-04, bot on the bench looking at a blue soldering
   mat): room `B,45,3,0,3`; left, medium flashlight `B,-23,13,13,5`; left, bright
   `B,-40,39,39,3`; left, flashlight straight into the sensor from 3 inches (not a
   real-life condition) `B,-42,63,63,3`. So it is case (b), squashed at the BOTTOM, not
   the top: the pin sits within 3 percent of 5V, which with a 4.7k resistor to 5V means
   the LDR is about 1.5 M in room light and still about 70 k with a flashlight 3 inches
   away. A GL5537 is 10-50 k in room light and under 1 k under a flashlight, so this is
   either a much higher-resistance LDR from the pack (GL5549 / GL5539 type) or a
   resistor that is not 4.7k (a 470 ohm, yellow-violet-brown, gives exactly these
   numbers with a normal LDR). Check: meter across the resistor (should be 4.7k,
   bands yellow violet red) and across the LDR in room light (10-50 k is right, 100 k+
   is the wrong type). Fix for THIS bot: a bigger resistor (47k if the LDR is the odd
   one; 4.7k if the resistor is the odd one) so the room reads 200-500 and the
   flashlight adds 300+. Firmware gains cannot rescue a 13-39 rise: the ADC noise is
   2-3 counts and "sees it" needs 40.
   Metered (the user, 2026-11-04): the resistor is 4.694k, so the LDR is the odd part.
   Next: meter the LDR in room light (10-50 k = a GL5537 that has gone bad; 100 k and
   up = a higher-resistance type from the pack), then swap it for a GL5537, or keep it
   and fit a 47k resistor.
   Metered: 1.8 M across the LDR in room light. That is a dark reading (a good GL5537
   is 10-50 k in room light, about 2 M in the dark), and the flashlight only brought
   it to about 70 k, so the cell is bad: most likely cooked during soldering (CdS
   cells are heat-sensitive; keep the leads long and the iron quick) or a cracked
   face. Fix: a new GL5537. Before soldering it, meter it: 10-50 k in room light,
   dropping as a flashlight comes near. CLOSED 2026-11-04: troubleshooting item (a
   sensor whose room reading sits near 0 and barely moves under a flashlight is a dead
   LDR; meter it, replace it). The firmware idea above is not needed.

7. 2026-11-04, every light bot (the user): teach the robot on a LIGHT floor. "If you cal
   on a dark surface and then drive to a light surface, you may not stop." Cause: the
   room level is learned where the robot starts; a lighter floor later reads as more
   light (the LDRs look down at the floor), so with the flashlight gone the robot keeps
   going until the room catch-up (about 8 s, LIGHT_ROOM_CATCHUP_TICKS) absorbs it. Taught
   on the lightest floor it will drive on, no floor change can look like a flashlight.
   CLOSED 2026-11-04: troubleshooting item (Light bot page 0.1.18 row + teach card; kid
   step below).

8. 2026-11-04, the 8 key (repeat) "does not work at all in ir.ino" (the user). Tested in
   the simulator: an 8 AFTER its steps worked (typed on the remote, saved, with and
   without a number, twice in one program, and in p-lines). An 8 typed BEFORE the steps
   (the order a Blocks "repeat" reads in) was accepted, nodded at, and did nothing: the
   steps ran once. No error. Also found: the Blocks "Remote slots" export never wrote
   an 8 at all: it unrolled loops into plain steps, so "repeat 10: forward, turn" was 20
   steps, split across two 16-step slots that each run alone. CLOSED 2026-11-04: code
   fixes. Firmware 0.10.85 (commit 75ebea1): an 8 with no steps before it (first, or
   right after another 8) repeats the steps that FOLLOW, up to the next 8 or the end; an
   8 after its steps is unchanged. Blocks 0.1.10: the export packs repeating moves as
   "<moves> n<times>" (always the 8-after form, so older sketches run it too; "f10 n1
   f50 t90 n4" closes a one-time stretch with n1), a slot takes as many moves as fit in
   16 steps, and a slot read back with its 8 first opens as the same repeat block.
   Guide item: "8 can go after the steps or before them" (Programming Guide 0.1.23,
   Remote Guide 0.1.20).
9. 2026-11-05, one bot (the user's bench, first Bluetooth try with an Android phone): the
   module blinked as if waiting, but the robot was in no list: not in Android Settings
   and not in the Sticks Bluetooth list, even with "Show every Bluetooth device" (other
   devices were listed, none with a strong signal 3 inches from the bot). **Cause: this
   one bot carried a replacement module scrounged from the user's basement, a classic
   one (not the kit's module, which shows in the Bluetooth button's low-energy list).**
   **Fix: the user swapped in a different (kit) module and it connected.** CLOSED
   2026-11-05: troubleshooting item. Tell-tale: the phone's scan works (other devices
   show) yet nothing strong is near the bot = the module does not send the low-energy
   signal. A classic module can still be used by pairing in Settings (PIN 1234 / 0000)
   and pressing Serial (the guide's "Robot not in the list?" card; Android needs Chrome
   138 or newer), not tried on this bot. A blinking light only proves power: a module
   needs just VCC and GND to be visible, so the sketch and the TXD/RXD wires are never
   the reason a robot is missing from a list. Not known: which bot, and whether the swapped-in module
   carries a name.

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

Light bot keeps driving after the flashlight is gone:
- Start it (and teach it) on the LIGHTEST floor it will drive on. It learns "no
  flashlight" from the floor under its nose at the start; a lighter floor later looks
  like light, and it may not stop.

The 8 key (do it again) seems to do nothing:
- The robot needs 0.10.85 or newer for an 8 typed FIRST. On older sketches the 8 goes
  AFTER the steps it repeats: forward, turn, then 8 and how many times.
- 8 counts "times in all": 8 then 4 runs the steps four times, not five.

Robot does not see the flashlight (light bot):
- Teach it first: `# # 1`, wiggle, then shine on one sensor (twitch), light away, the
  other sensor (twitch), light away, and it nods. Two shines, either side first.
- Hold the flashlight 4 to 8 inches from one sensor, straight down its tube, not between
  the two.
- Nothing in between: point the flashlight at the ceiling between shines, or the robot
  thinks it was one long shine.
- A slow "no" shake means one sensor barely saw it: shine on that sensor again, closer.
  It nods and goes after that even if the sensor is still weak: tell a grown-up which
  side shook "no".
Light bot: it twitches for the shines but never drives, or the flashlight barely moves
the number (check with `b` in plain room light):
- A sensor that reads 800 or more with no flashlight is "full": the flashlight cannot
  push it higher. A grown-up swaps that sensor's resistor for a smaller one (1k).
- A sensor under 150 with the lights on is the other way round: a bigger resistor (10k).
- Good is in the middle, 300 to 700, and a flashlight adds 150 or more.
- A sensor that reads 0 to 5 in room light and only gets to 60 with the flashlight
  touching it is a dead LDR (a meter shows 1 M or more in room light; good ones show
  10k to 50k). A grown-up solders in a new one, quickly, with long leads: the heat kills
  them.

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

// End-to-end: the Tune page (mecanum/tune.html) against the real firmware in
// simavr. Run: node scripts/mecanum-sim/tune-e2e.js [bt] [ir]
// (the sketch on the robot: programming.ino unless ir is given).
// The page's link is a bridge to the simulator's UART, the buttons are
// clicked as a kid would, and the numbers are read back from the robot's own
// K,cal lines and after a restart, so this covers button -> test move ->
// answer -> km / kw -> saved on the robot.
const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const BT = process.argv.includes('bt');
const SKETCH = process.argv.includes('ir') ? 'ir' : 'programming';
const PORT = 8260 + (BT ? 10 : 0) + (SKETCH === 'ir' ? 20 : 0);
const root = path.resolve(__dirname, '..', '..');
const build = path.join(root, 'temp', 'mecanum-sim', 'tune-e2e' + (SKETCH === 'ir' ? '-ir' : '') + (BT ? '-bt' : ''));
const simBinary = path.join(build, 'uno-sim');
const sketchCopy = path.join(build, SKETCH);
const elf = path.join(build, 'out', SKETCH + '.ino.elf');

function buildEverything() {
  require('fs').mkdirSync(sketchCopy, { recursive: true });
  execSync(`gcc -O2 -o "${simBinary}" "${path.join(__dirname, 'uno-sim.c')}" -lsimavr -lelf -lm`, { stdio: 'inherit' });
  require('fs').copyFileSync(path.join(root, SKETCH, SKETCH + '.ino'), path.join(sketchCopy, SKETCH + '.ino'));
  execSync(`"${path.join(os.homedir(), '.local', 'bin', 'arduino-cli')}" compile --fqbn arduino:avr:uno --output-dir "${path.join(build, 'out')}" "${sketchCopy}"`, { stdio: 'ignore' });
}
const failures = [];
function check(condition, message) {
  console.log((condition ? 'ok   ' : 'FAIL ') + message);
  if (!condition) failures.push(message);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, tolerance) => Math.abs(a - b) <= (tolerance || 0.002);

(async () => {
  buildEverything();
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '0.0.0.0'], { cwd: root, stdio: 'ignore' });
  const sim = spawn(simBinary, [elf, 'live'].concat(BT ? ['bt'] : []));
  let simLog = '';
  await sleep(800);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`http://127.0.0.1:${PORT}/mecanum/tune.html`, { waitUntil: 'load' });
  await page.exposeFunction('simWrite', (bytes) => sim.stdin.write(Buffer.from(bytes)));
  sim.stdout.on('data', (chunk) => {
    simLog += chunk.toString();
    // The simulator prints the robot's USB copy of each answer. The Bluetooth copy of the same bytes
    // leaves later (the sketch keeps up to 255 of them in a buffer, about 270 ms at 9600 baud), and the
    // robot cannot hear a command until it has: a phone hears the answer only then, so does the page here.
    setTimeout(() => page.evaluate((bytes) => handleIncomingBytes(new Uint8Array(bytes)), [...chunk]).catch(() => {}), BT ? 300 : 0);
  });
  const control = (text) => sim.stdin.write('\x01' + text + '\n');
  const waitFor = async (fn, label, timeoutMs = 8000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await page.evaluate(fn)) return true;
      await sleep(50);
    }
    check(false, 'timed out waiting for ' + label);
    return false;
  };
  const idle = (label, timeoutMs) => waitFor(() => busy === '' && robot.numbers !== null, label, timeoutMs);
  const pwm = async () => {
    const before = simLog.length;
    control('pwm');
    for (let i = 0; i < 40; i++) {
      await sleep(25);
      const match = /\[pwm (\d+) (\d+) (\d+) (\d+)\]/.exec(simLog.slice(before));
      if (match) return match.slice(1).map(Number);
    }
    return null;
  };
  // Click a button the way a kid would: with it in the middle of the screen, clear of the STOP bar.
  const press = async (selector) => {
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), selector);
    await page.click(selector);
  };
  const moving = (duties) => !!duties && duties.some((d) => d > 0);
  const numbers = () => page.evaluate(() => robot.numbers);
  const sent = (text) => page.evaluate((t) => sentCommands.filter((c) => c === t).length, text);
  const text = (id) => page.evaluate((i) => document.getElementById(i).textContent, id);
  const hidden = (id) => page.evaluate((i) => document.getElementById(i).hidden, id);
  // The robot's own last K,cal line, as its 23 numbers.
  const robotSays = () => {
    const lines = simLog.match(/K,cal,[^\r\n]+/g) || [];
    const fields = lines[lines.length - 1].slice(6).split(',').filter((f) => !/^[a-z]$/.test(f)).map(Number);
    return Array.from({ length: 23 }, (_, i) => fields[i < 19 ? i : i + 1]);
  };

  // ---- Connect: the page reads the robot's numbers ----
  check(await page.evaluate(() => document.getElementById('turnTestButton').disabled), 'not connected: the test buttons wait');
  await page.evaluate(() => {
    window.sentCommands = [];
    link = { kind: 'usb', label: 'simavr', write: (b) => { window.sentCommands.push(new TextDecoder().decode(b)); return window.simWrite(Array.from(b)); }, close: () => Promise.resolve() };
  });
  control('reboot');
  await sleep(3500);
  check(new RegExp(SKETCH + ' v\\d+\\.\\d+\\.\\d+').test(simLog), 'robot booted (' + SKETCH + ')');
  await page.evaluate(() => linkOpened(0));
  await idle('the numbers from the robot', 15000);
  let n = await numbers();
  check(n && near(n[6], 0.612) && near(n[21], 0.34) && near(n[2], 335, 0.1), 'the page read the robot\'s numbers: turn ' + n[6] + ', slide share ' + n[21] + ', start speed ' + n[2]);
  check(await text('spinNumber') === '0.612' && /the class numbers/.test(await text('robotLine')) && new RegExp(SKETCH).test(await text('robotLine')),
    'shown for the grown-up: ' + await text('robotLine'));
  check(!(await page.evaluate(() => document.getElementById('turnTestButton').disabled)), 'connected: the test buttons are ready');

  // ---- 1 Turn: four right 90s, 20 degrees too far, Fix ----
  check(await hidden('turnAnswer'), 'turn: no question before the test');
  await press('#turnTestButton');
  await sleep(600);
  check(moving(await pwm()), 'turn: the robot is turning');
  await idle('the four turns', 25000);
  check(await sent('m0,0,90;') === 4 && (simLog.match(/move: done/g) || []).length === 4, 'turn: four m0,0,90; moves, each ran to its end');
  check(!(await hidden('turnAnswer')), 'turn: asks where the robot points');
  for (let i = 0; i < 4; i++) await press('#turnMoreButton');
  check(/20 degrees too far/.test(await text('turnErrorText')) && await page.evaluate(() => document.getElementById('dialBot').getAttribute('transform') === 'rotate(20)'),
    'turn: four presses = 20 degrees too far, the picture turns with it');
  await press('#turnFixButton');
  await idle('the turn fix', 15000);
  const spinFixed = 0.612 * 380 / 360;
  check(near((await numbers())[6], spinFixed) && near(robotSays()[6], spinFixed), 'turn: the turn number is 0.612 x 380 / 360 = ' + spinFixed.toFixed(3) + ' on the robot (' + robotSays()[6] + ')');
  check(/config: saved/.test(simLog) && await hidden('turnAnswer') && /Fixed and saved/.test(await text('turnSay')), 'turn: saved on the robot, the question closes');

  // one turn, to compare the motor power before and after the distance fix
  await press('#turnOnceButton');
  await sleep(600);
  const turnDutiesBefore = await pwm();
  await idle('one turn', 10000);

  // ---- 2 Distance: went 110 cm, Fix ----
  await press('#distanceTestButton');
  await sleep(700);
  check(moving(await pwm()), 'distance: the robot is driving');
  await idle('the meter', 20000);
  check(await sent('m0,1000,0;') === 1 && !(await hidden('distanceAnswer')), 'distance: one m0,1000,0; move, then asks how far');
  await press('[data-cm="5"]');
  await press('[data-cm="5"]');
  check(await text('distanceCm') === '110', 'distance: +5 twice = 110 cm');
  await press('#distanceFixButton');
  await idle('the distance fix', 25000);
  n = robotSays();
  check(near(n[2], 368.5, 0.1) && near(n[3], 528, 0.1) && near(n[4], 660, 0.1) && near(n[5], 759, 0.1) && near(n[18], 368.5, 0.1),
    'distance: every speed x 1.1 on the robot: ' + [n[2], n[3], n[4], n[5], n[18]].join(', '));
  check(near(n[6], spinFixed / 1.1) && near(n[7], 0.54 / 1.1), 'distance: the turn and slide numbers / 1.1: ' + n[6] + ', ' + n[7]);
  await press('#turnOnceButton');
  await sleep(600);
  const turnDutiesAfter = await pwm();
  await idle('one turn', 10000);
  check(moving(turnDutiesBefore) && turnDutiesAfter && turnDutiesBefore.every((d, i) => Math.abs(d - turnDutiesAfter[i]) <= 1),
    'distance: a turn uses the same motor power as before the fix: ' + JSON.stringify(turnDutiesBefore) + ' -> ' + JSON.stringify(turnDutiesAfter));

  // ---- 3 Slide: the pair shares ----
  check(/orange pair 66 %\s+blue pair 134 %/.test(await text('splitText')), 'slide: shows the shares: ' + await text('splitText'));
  await press('#slideRightButton');
  await sleep(700);
  const slideDuties = await pwm();
  check(moving(slideDuties), 'slide: the robot is sliding at share 0.34, motor power M1-M4 ' + JSON.stringify(slideDuties));
  await idle('the slide', 15000);
  check(await sent('m90,500,0;') === 1 && !(await hidden('slideAnswer')), 'slide: one m90,500,0; move, then asks about creeping');
  await press('#creepForwardButton');
  await idle('the creep fix', 10000);
  check(near(robotSays()[21], 0.39) && /blue/.test(await text('slideSay')) && await hidden('slideAnswer'), 'slide right crept forward: a little more to the blue pair (0.39)');
  await press('#slideLeftButton');
  await idle('the slide left', 15000);
  check(await sent('m270,500,0;') === 1, 'slide left: one m270,500,0; move');
  await press('#creepForwardButton');
  await idle('the creep fix', 10000);
  check(near(robotSays()[21], 0.34) && /orange/.test(await text('slideSay')), 'slide left crept forward: a little more to the orange pair (0.34)');
  await press('#moreOrangeButton');
  await idle('more to orange', 10000);
  check(near(robotSays()[21], 0.29), 'More to orange: 0.29');
  await press('#evenButton');
  await idle('even', 10000);
  check(near(robotSays()[21], 0) && /orange pair 100 %\s+blue pair 100 %/.test(await text('splitText')), 'Even: both pairs 100 %');
  await press('#slideRightButton');
  await sleep(700);
  const evenDuties = await pwm();
  check(moving(evenDuties), 'slide with even shares, motor power M1-M4 ' + JSON.stringify(evenDuties));
  await idle('the slide', 15000);
  await press('#creepNoneButton');
  check(await hidden('slideAnswer') && near(robotSays()[21], 0), 'No, straight: nothing changes');

  // ---- Saved: the numbers are there after the robot restarts ----
  control('reboot');
  await sleep(3500);
  await page.evaluate(() => { robot.numbers = null; linkOpened(0); });
  await idle('the numbers after a restart', 15000);
  n = await numbers();
  check(near(n[6], spinFixed / 1.1) && near(n[21], 0) && near(n[5], 759, 0.1) && await page.evaluate(() => robot.saved) && /its own saved numbers/.test(await text('robotLine')),
    'after a restart the robot still has them (its own saved numbers)');

  // ---- STOP in the middle of a move ----
  await press('#distanceTestButton');
  await sleep(700);
  check(moving(await pwm()), 'driving the meter again');
  await press('#stopButton');
  await idle('the stop', 6000);
  check(!moving(await pwm()) && /Stopped/.test(await text('distanceSay')) && await hidden('distanceAnswer'), 'STOP: the robot stops, no question asked');

  // ---- Undo, each card its own part ----
  await press('#turnUndoButton');
  await idle('undo the turn', 10000);
  check(near(robotSays()[6], 0.612 / 1.1), 'undo the turn fix: the turn number is 0.612 / 1.1 (the distance fix stays): ' + robotSays()[6]);
  await press('#distanceUndoButton');
  await idle('undo the distance', 25000);
  n = robotSays();
  check(near(n[2], 335, 0.1) && near(n[5], 690, 0.1) && near(n[6], 0.612) && near(n[7], 0.54), 'undo the distance fix: speeds, turn and slide numbers as at the start');
  await press('#slideUndoButton');
  await idle('undo the slide', 10000);
  check(near(robotSays()[21], 0.34), 'undo the slide changes: 0.34 again');
  check(await page.evaluate(() => document.getElementById('turnUndoButton').disabled && document.getElementById('distanceUndoButton').disabled && document.getElementById('slideUndoButton').disabled),
    'nothing left to undo: the undo buttons wait');

  // ---- Back to the class numbers ----
  await press('#moreBlueButton');
  await idle('more to blue', 10000);
  await press('#resetButton');
  await idle('the reset', 15000);
  n = await numbers();
  check(near(n[21], 0.34) && near(n[6], 0.612) && !(await page.evaluate(() => robot.saved)) && /the class numbers/.test(await text('robotLine')), 'reset: the class numbers again, nothing saved');

  // ---- Layout ----
  for (const size of [[420, 900], [360, 640], [1100, 800]]) {
    await page.setViewport({ width: size[0], height: size[1], isMobile: size[0] < 900, hasTouch: size[0] < 900 });
    await sleep(150);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `no sideways scroll at ${size[0]}x${size[1]}`);
  }
  await page.setViewport({ width: 420, height: 900, isMobile: true, hasTouch: true });
  await page.evaluate(() => { turnTested = true; turnError = 15; distanceTested = true; lastSlide = 'right'; render(); });
  await page.screenshot({ path: path.join(build, 'tune.png'), fullPage: true });
  check(pageErrors.length === 0, 'no page errors' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));

  await browser.close();
  sim.kill();
  server.kill();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

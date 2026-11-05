// End-to-end: mecanum/rename.html with rename/rename.ino in simavr (no Bluetooth module in the
// simulator, so a rename is saved for the next power-on). Run: node scripts/mecanum-sim/rename-e2e.js
const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const PORT = 8198;
const root = path.resolve(__dirname, '..', '..');
const build = path.join(root, 'temp', 'mecanum-sim', 'rename-e2e');
const simBinary = path.join(build, 'uno-sim');
const elf = path.join(build, 'out', 'rename.ino.elf');
const failures = [];
function check(condition, message) { console.log((condition ? 'ok   ' : 'FAIL ') + message); if (!condition) failures.push(message); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const fs = require('fs');
  const cli = path.join(os.homedir(), '.local', 'bin', 'arduino-cli');
  fs.mkdirSync(path.join(build, 'rename'), { recursive: true });
  execSync(`gcc -O2 -o "${simBinary}" "${path.join(__dirname, 'uno-sim.c')}" -lsimavr -lelf -lm`, { stdio: 'inherit' });
  fs.copyFileSync(path.join(root, 'rename', 'rename.ino'), path.join(build, 'rename', 'rename.ino'));
  execSync(`"${cli}" compile --fqbn arduino:avr:uno --output-dir "${path.join(build, 'out')}" "${path.join(build, 'rename')}"`, { stdio: 'ignore' });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '0.0.0.0'], { cwd: root, stdio: 'ignore' });
  const sim = spawn(simBinary, [elf, 'live']);
  let simLog = '';
  await sleep(800);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/mecanum/rename.html`, { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await page.exposeFunction('simWrite', (bytes) => sim.stdin.write(Buffer.from(bytes)));
  sim.stdout.on('data', (chunk) => { simLog += chunk.toString(); page.evaluate((b) => handleIncomingBytes(new Uint8Array(b)), [...chunk]).catch(() => {}); });
  const control = (text) => sim.stdin.write('\x01' + text + '\n');
  const waitFor = async (fn, label, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await sleep(100); } check(false, 'timed out waiting for ' + label); return false; };
  control('reboot');
  await page.evaluate(() => { link = { kind: 'usb', label: 'simavr', write: (b) => window.simWrite(Array.from(b)), close: () => Promise.resolve() }; linked(9000); });   // (no module: the three probes take ~5 s)
  await waitFor(() => robot.role === 'rename' && !document.getElementById('renameButton').disabled, 'connected to rename.ino', 30000);
  check(/Connected/.test(await page.evaluate(() => document.getElementById('connectResult').textContent)) && /bt module: /.test(simLog), 'connected: rename.ino, module asked at start-up');
  await page.type('#nameInput', 'bad name!');
  await page.click('#renameButton');
  check(/letters, numbers/.test(await page.evaluate(() => document.getElementById('nameWorking').textContent)), 'a name with a space is refused');
  await page.evaluate(() => { document.getElementById('nameInput').value = 'Rexy_7x'; });
  await page.click('#renameButton');
  await waitFor(() => pending === null && !document.getElementById('nameResult').hidden, 'the rename answer', 25000);
  const result = await page.evaluate(() => document.getElementById('nameResult').textContent);
  check(/bt name: Rexy_7x - saved: switch the robot off and on/.test(simLog), 'robot: no module in the simulator, so the name is saved for the next power-on (x sent as *)');
  check(/Saved: switch the robot off and on/.test(result) && /Rexy_7x/.test(result), 'page says saved, switch off and on: ' + result.slice(0, 80));
  check(await page.evaluate(() => (storageGet('mlk-robot-names') || []).indexOf('Rexy_7x') >= 0), 'the name joins this phone\'s robot list');
  // The other name (the one a web page's list shows): every command tried, no module to answer.
  let mark = simLog.length;
  await page.click('#tryButton');
  await waitFor(() => pending === null && !document.getElementById('tryResult').hidden, 'the tries to finish', 40000);
  let tried = simLog.slice(mark);
  check(/bt try: AT\+HELP -> nothing/.test(tried) && /bt try: AT\+NAMBRexy_7x -> nothing/.test(tried) && /bt try: AT\+NAMBRexy_7x \+ line end -> nothing/.test(tried) &&
    /bt try: AT\+LENAME=Rexy_7x -> nothing/.test(tried) && /bt try: AT\+BNAME=Rexy_7x -> nothing/.test(tried) && /bt try: AT\+BNAMERexy_7x \+ line end -> nothing/.test(tried),
    'robot: tries each command for the other name, without and with a line end');
  check(/bt try: done - the module took none of them/.test(tried), 'robot: says the module took none');
  let tryText = await page.evaluate(() => document.getElementById('tryResult').textContent);
  check(/took none/.test(tryText) && /AT\+NAMBRexy_7x -> nothing/.test(tryText), 'page shows every answer and that none was taken');
  // Again, and this time a module answers the first name command: the robot stops there.
  mark = simLog.length;
  await page.click('#tryButton');
  const helpDone = Date.now();
  while (!/bt try: AT\+HELP \+ line end ->/.test(simLog.slice(mark)) && Date.now() - helpDone < 15000) await sleep(50);
  await sleep(400);   // (the robot is sending the command now: the answer comes after it)
  control('btsend OKsetnamb');
  await waitFor(() => pending === null && !document.getElementById('tryResult').hidden, 'the tries to finish (answered)', 40000);
  tried = simLog.slice(mark);
  check(/bt try: AT\+NAMBRexy_7x -> OKsetnamb/.test(tried) && !/LENAME/.test(tried), 'robot: a module that answers OK to a command ends the tries there');
  check(/bt try: done - the module took one/.test(tried), 'robot: says the module took one');
  tryText = await page.evaluate(() => document.getElementById('tryResult').textContent);
  check(/took one/.test(tryText) && /Switch the robot off and on/.test(tryText), 'page says it was taken: switch off and on, look at the list');
  // A<text>: anything to the module, as it is.
  mark = simLog.length;
  await page.evaluate(() => sendCommand('AAT+VERSION\n'));
  await sleep(4000);
  check(/bt try: AT\+VERSION -> nothing/.test(simLog.slice(mark)) && /bt try: AT\+VERSION \+ line end -> nothing/.test(simLog.slice(mark)), 'A<text> sends text to the module and prints the answer');
  const n = simLog.length;
  control('reboot');
  await sleep(14000);
  check(/bt name: Rexy_7x - the module did not answer/.test(simLog.slice(n)), 'at the next power-on the robot gives the module the saved name');
  check(pageErrors.length === 0, 'no page errors' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
  await browser.close(); sim.kill(); server.kill();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

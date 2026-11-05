// Loads the Blocks editor under the site's real Content-Security-Policy (from
// _headers, which forbids eval) and runs four demos in the simulator, the slot
// export, the Code tab and STOP. Run: node scripts/check-mecanum-blocks.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = require('path').resolve(__dirname, '..');
const csp = fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n').find((l) => /^\s*Content-Security-Policy:/.test(l)).replace(/^\s*Content-Security-Policy:\s*/, '');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.cur': 'image/x-win-bitmap', '.mp3': 'audio/mpeg', '.gif': 'image/gif' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp });
    res.end(data);
  });
});
const failures = [];
function check(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failures.push(m); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(8198, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('request failed ' + r.url()));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let documentCsp = '';
  page.on('response', (r) => { if (/blocks\.html$/.test(r.url())) documentCsp = r.headers()['content-security-policy'] || ''; });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:8198/mecanum/blocks.html', { waitUntil: 'load' });
  await sleep(2000);
  check(await page.evaluate(() => typeof Interpreter === 'function'), 'JS-Interpreter loaded under the CSP');
  check(/script-src 'self'/.test(documentCsp) && !/unsafe-eval/.test(documentCsp), 'the page was served with the site CSP (no unsafe-eval): ' + documentCsp.slice(0, 60));

  const consoleText = () => page.evaluate(() => document.querySelector('#consoleLines') ? (document.querySelector('#consoleLines').textContent) : document.body.textContent);
  async function runTab(index, label, timeoutMs) {
    await page.evaluate((i) => { document.querySelectorAll('#programTabs .program-tab')[i].click(); }, index);
    await sleep(400);
    await page.evaluate(() => { var s = document.querySelector('#simulatorSpeed, select[name=simulatorSpeed]'); });
    const before = (await consoleText()).length;
    await page.click('#runButton');
    const started = Date.now();
    let text = '';
    while (Date.now() - started < timeoutMs) {
      text = (await consoleText()).slice(before);
      if (/Program finished\.|hit a problem|could not be turned|Program stopped/.test(text)) break;
      await sleep(200);
    }
    check(/Program finished\./.test(text), label + ' runs in the simulator to "Program finished"' + (/Program finished\./.test(text) ? '' : ': ' + text.slice(-300)));
  }
  // Faster simulator so the demos finish quickly
  await page.evaluate(() => { var sel = document.querySelector('select'); });
  await page.evaluate(() => { try { editorSettings.simulatorSpeed = '10'; } catch (e) {} });
  await runTab(0, 'Square (repeat loop)', 60000);
  await runTab(5, 'Spiral (variable + counting loop)', 90000);
  await runTab(7, 'Figure 8 (two subroutines)', 90000);
  await runTab(8, 'Dance', 60000);

  const exported = await page.evaluate(async () => (await buildAllSlotsExport()));
  check(exported.lines.length === 9 && /^p1=f50 t90 n4;$/.test(exported.lines[0]) && /^p8=f40 t90 n4 f40 t-90 n4;$/.test(exported.lines[7]), 'slot export (the recorder) builds all nine lines, repeats written as n: ' + exported.lines[0] + ' ... ' + exported.lines[7]);

  // Packing moves into slot steps (compressSlotSteps) and what a slot's steps drive (expandSlotSteps)
  const packing = await page.evaluate(() => {
    const square = ['f50', 't90', 'f50', 't90', 'f50', 't90', 'f50', 't90'];
    const longLoop = [];
    for (let i = 0; i < 20; i++) { longLoop.push('f50', 't90'); }
    const distinct = [];
    for (let i = 1; i <= 20; i++) { distinct.push('f' + i); }
    // random lists over a small alphabet repeat a lot: packed and unpacked they must come back the same
    let seed = 12345;
    const random = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    let roundTrips = 0, roundTripFailures = [], longer = 0, overfull = 0;
    for (let round = 0; round < 400; round++) {
      const list = [];
      const length = random(31);
      const letters = 1 + random(3);
      for (let i = 0; i < length; i++) { list.push(['f10', 't90', 'b10'][random(letters)]); }
      const whole = compressSlotSteps(list);
      const slot = compressSlotSteps(list, 16);
      roundTrips += 1;
      if (JSON.stringify(expandSlotSteps(whole.steps)) !== JSON.stringify(list) || whole.used !== list.length) { roundTripFailures.push(list.join(' ') + ' -> ' + whole.steps.join(' ')); }
      if (JSON.stringify(expandSlotSteps(slot.steps)) !== JSON.stringify(list.slice(0, slot.used))) { roundTripFailures.push('(16) ' + list.join(' ') + ' -> ' + slot.steps.join(' ')); }
      if (whole.steps.length > list.length) { longer += 1; }
      if (slot.steps.length > 16) { overfull += 1; }
    }
    const blocksOf = (steps) => JSON.stringify(slotStepsToState(steps));
    return {
      square: compressSlotSteps(square).steps.join(' '),
      before: compressSlotSteps(['f10'].concat(square)).steps.join(' '),
      after: compressSlotSteps(square.concat(['f10'])).steps.join(' '),
      twice: compressSlotSteps(['f10', 'f10']).steps.join(' '),
      thrice: compressSlotSteps(['f10', 'f10', 'f10']).steps.join(' '),
      plain: compressSlotSteps(['f10', 't90', 'b10']).steps.join(' '),
      longLoop: compressSlotSteps(longLoop, 16),
      distinct: compressSlotSteps(distinct, 16),
      headed: expandSlotSteps(['n2', 'f10', 'n3', 'b10']).join(' '),
      mixed: expandSlotSteps(['f10', 'n2', 'n2', 'b10']).join(' '),
      trailing: expandSlotSteps(['f10', 'n1', 'f50', 't90', 'n2']).join(' '),
      roundTrips, roundTripFailures, longer, overfull,
      headedBlocks: (blocksOf([{ letter: 'n', amount: 3 }, { letter: 'f', amount: 10 }, { letter: 't', amount: 90 }]).match(/controls_repeat_ext/g) || []).length,
      trailingBlocks: (blocksOf([{ letter: 'f', amount: 10 }, { letter: 't', amount: 90 }, { letter: 'n', amount: 3 }]).match(/controls_repeat_ext/g) || []).length,
      headedSame: blocksOf([{ letter: 'n', amount: 3 }, { letter: 'f', amount: 10 }, { letter: 't', amount: 90 }]) === blocksOf([{ letter: 'f', amount: 10 }, { letter: 't', amount: 90 }, { letter: 'n', amount: 3 }]),
    };
  });
  check(packing.square === 'f50 t90 n4', 'a square packs into "f50 t90 n4": ' + packing.square);
  check(packing.before === 'f10 n1 f50 t90 n4' && packing.after === 'f50 t90 n4 f10', 'a move before a repeat is closed with n1, a move after it stays plain: ' + packing.before + ' / ' + packing.after);
  check(packing.twice === 'f10 f10' && packing.thrice === 'f10 n3' && packing.plain === 'f10 t90 b10', 'no gain, no repeat: ' + packing.twice + ' / ' + packing.thrice + ' / ' + packing.plain);
  check(packing.longLoop.steps.join(' ') === 'f50 t90 n20' && packing.longLoop.used === 40, 'a 40-move loop fits one slot: ' + packing.longLoop.steps.join(' '));
  check(packing.distinct.used === 16 && packing.distinct.steps.length === 16, '20 different moves: the first 16 fit a slot');
  check(packing.headed === 'f10 f10 b10 b10 b10' && packing.mixed === 'f10 f10 b10 b10' && packing.trailing === 'f10 f50 t90 f50 t90', 'what slot steps drive, n before or after its moves: ' + packing.headed + ' / ' + packing.mixed + ' / ' + packing.trailing);
  check(packing.roundTripFailures.length === 0 && packing.longer === 0 && packing.overfull === 0, packing.roundTrips + ' random move lists pack and unpack to the same moves, never longer, never over 16' + (packing.roundTripFailures.length ? ': ' + packing.roundTripFailures.slice(0, 3).join(' ; ') : ''));
  check(packing.headedBlocks === 1 && packing.trailingBlocks === 1 && packing.headedSame, 'a slot read back with its n FIRST opens as the same repeat block as with its n last');
  const codeShown = await page.evaluate(() => { document.querySelectorAll('#programTabs .program-tab')[7].click(); return refreshWillDoAndCode().then(function () { return document.getElementById('codeView').textContent; }); });
  check(!/await|async/.test(codeShown) && /function /.test(codeShown), 'Code tab shows plain JavaScript with subroutines, no async');

  // "run program <tab>": a program runs another tab's program by its name
  const calls = await page.evaluate(async () => {
    const make = programBlockBuilders();
    const state = (blocks) => workspaceStateFromTopBlocks([startBlockWith(blocks)]);
    const out = {};
    addProgram('Caller', state([make.runProgram('Square'), make.drive(0, 100), make.runProgram('Square')]));   // tab 10
    const moves = (recording) => recording.steps.map((step) => step.kind === 'move' ? (step.distanceMm ? 'f' + step.distanceMm : 't' + step.turnDegrees) : step.kind + (step.slot || '')).join(' ');
    out.inlined = moves(await recordActiveProgram());
    out.forSlots = moves(await recordActiveProgram(true));
    out.line = buildSlotExport(await recordActiveProgram(true), 9, false).lines[0];
    out.code = generateProgramCode(false).code;
    out.saved = JSON.stringify(Blockly.serialization.workspaces.save(blockWorkspace));
    // an older robot cannot run a program from a program: the moves are written out
    robotLink.isConnected = true; robotLink.firmwareVersion = '0.10.85';
    out.oldRobot = moves(await recordActiveProgram(true));
    robotLink.firmwareVersion = '0.10.86';
    out.newRobot = moves(await recordActiveProgram(true));
    robotLink.isConnected = false; robotLink.firmwareVersion = null;
    // renaming the tab it runs: the blocks follow, here and in the stored tabs
    addProgram('Other caller', state([make.runProgram('Square')]));   // tab 11
    switchToProgram(programStore.programs[0].id);
    const realPrompt = window.prompt;
    window.prompt = () => 'Box';
    renameActiveProgram();
    window.prompt = realPrompt;
    out.storedAfterRename = JSON.stringify(programStore.programs[9].state).match(/"PROGRAM":"[^"]*"/g).join(' ');
    switchToProgram(programStore.programs[9].id);
    out.liveAfterRename = blockWorkspace.getAllBlocks(false).filter((block) => block.type === 'robot_run_program').map((block) => block.getFieldValue('PROGRAM') + '/' + block.getField('PROGRAM').getText()).join(' ');
    out.afterRename = moves(await recordActiveProgram());
    // a tab that is not there: the name is kept, RUN says so
    addProgram('Lost', state([make.runProgram('Nowhere')]));   // tab 12
    const lost = blockWorkspace.getAllBlocks(false).find((block) => block.type === 'robot_run_program');
    out.lostValue = lost.getFieldValue('PROGRAM') + '/' + lost.getField('PROGRAM').getText();
    out.lostProblem = (await recordActiveProgram()).problem;
    // a program that runs itself
    addProgram('Round', state([make.drive(0, 100), make.runProgram('Round')]));   // tab 13
    const round = await recordActiveProgram();
    out.roundSteps = round.steps.length;
    out.roundProblem = round.problem;
    // a slot read from the robot: g1 names tab 1
    out.imported = JSON.stringify(slotStepsToState([{ letter: 'g', amount: 1 }, { letter: 'f', amount: 10 }])).match(/"PROGRAM":"[^"]*"/g).join(' ');
    // the heading block makes code that parses
    const hidden = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(state([{ type: 'text_print', inputs: { TEXT: { block: { type: 'robot_heading' } } } }]), hidden, { recordUndo: false });
    try { new Interpreter(generateProgramCode(true, hidden).code); out.headingParses = true; } catch (problem) { out.headingParses = String(problem); }
    hidden.dispose();
    switchToProgram(programStore.programs[9].id);
    return out;
  });
  const square = 'f500 t90 f500 t90 f500 t90 f500 t90';
  check(calls.inlined === square + ' f100 ' + square, 'run program "Square", forward, run program "Square": the list shows both squares driven');
  check(calls.forSlots === 'call1 f100 call1' && calls.line === 'p9=g1 f10 g1;', 'for a slot the tab it runs is one step: ' + calls.line);
  check(/function \$program1\(\)/.test(calls.code) && /robot\.enterProgram\('Square'\)/.test(calls.code) && /"extraState":\{"program":"Square"\}/.test(calls.saved), 'Code tab: the tab it runs is a function of its own; the block saves the name');
  check(calls.oldRobot === calls.inlined && calls.newRobot === 'call1 f100 call1', 'a connected robot older than 0.10.86 gets the moves written out, 0.10.86 gets the step');
  check(calls.storedAfterRename === '"PROGRAM":"Box" "PROGRAM":"Box"' && calls.liveAfterRename === 'Box/Box Box/Box' && calls.afterRename === calls.inlined, 'renaming tab 1 to "Box": the blocks that run it follow, in the open tab and the stored ones: ' + calls.liveAfterRename);
  check(/^Nowhere\/Nowhere \(no such program\)$/.test(calls.lostValue) && /There is no program called "Nowhere"/.test(calls.lostProblem || ''), 'a tab that is not there: the block keeps the name and says so: ' + calls.lostValue);
  check(calls.roundSteps === 21 && /keep running each other/.test(calls.roundProblem || ''), 'a program that runs itself stops with a reason after 20 rounds: ' + calls.roundSteps + ' moves');
  check(calls.imported === '"PROGRAM":"Box"', 'a slot step g1 read from the robot opens as "run program" naming tab 1: ' + calls.imported);
  check(calls.headingParses === true, 'the heading block makes code that parses: ' + calls.headingParses);
  await runTab(9, 'Caller (runs the tab "Box" twice)', 90000);

  // The sensor examples (light, line) and the sensor blocks in the simulator
  async function runExample(name, timeoutMs, mustSay) {
    const loaded = await page.evaluate((n) => {
      const example = listLiveExamplePrograms().find((e) => e.name === n);
      if (!example) return false;
      Blockly.serialization.workspaces.load(example.state, blockWorkspace);
      return true;
    }, name);
    check(loaded, 'example "' + name + '" exists');
    if (!loaded) return;
    await sleep(300);
    const before = (await consoleText()).length;
    await page.click('#runButton');
    const started = Date.now();
    let text = '';
    while (Date.now() - started < timeoutMs) {
      text = (await consoleText()).slice(before);
      if (/Program finished\.|hit a problem|could not be turned|Program stopped/.test(text)) break;
      await sleep(200);
    }
    check(/Program finished\./.test(text) && mustSay.test(text), name + ' runs in the simulator: ' + (mustSay.test(text) ? 'says what it should' : text.slice(-300)));
  }
  await page.evaluate(() => { editorSettings.simulatorSpeed = '10'; });
  await runExample('Moth', 60000, /moth: chasing the light[\s\S]*moth: at the light/);
  await runExample('Cockroach', 60000, /cockroach: running from the light/);
  await runExample('Line loop', 90000, /follow the line for 20 s/);
  const sensed = await page.evaluate(async () => {
    resetSimulatorWorld();
    const control = createRunControl();
    const backend = createSimulatorBackend(control);
    const out = {
      lightLevel: await backend.readLight('level', 0), lightDirection: await backend.readLight('direction', 0), ldr1: await backend.readLight('sensor', 1),
      lineSeen: await backend.readLine('seen', 0), linePosition: await backend.readLine('position', 0), ch4: await backend.readLine('sensor', 4), ch1: await backend.readLine('sensor', 1),
      heading: await backend.imu('heading'), pitch: await backend.imu('pitch'), up: await backend.imu('accelUp'),
    };
    backend.finish();
    return out;
  });
  check(sensed.lightLevel > 40 && sensed.lightLevel < 80 && Math.abs(sensed.lightDirection - 45) <= 1 && sensed.ldr1 > 0, 'light from the start: level ' + sensed.lightLevel + ', direction ' + sensed.lightDirection + ', LDR 1 ' + sensed.ldr1);
  check(sensed.lineSeen === true && Math.abs(sensed.linePosition) <= 1 && sensed.ch4 > 50 && sensed.ch1 === 0, 'line at the start: seen, centred (' + sensed.linePosition + ' mm), channel 4 ' + sensed.ch4 + ', channel 1 ' + sensed.ch1);
  check(sensed.heading === 0 && sensed.pitch === 0 && sensed.up === 1, 'IMU in the simulator: heading 0, pitch 0, up 1 g');
  const toolbox = await page.evaluate(() => Array.from(document.querySelectorAll('.blocklyToolboxCategory, .blocklyTreeRow')).map((e) => e.textContent.trim()).filter(Boolean));
  check(toolbox.some((t) => /Someday/.test(t)), 'the Someday category is in the toolbox');

  // STOP mid-run
  await page.evaluate(() => { document.querySelectorAll('#programTabs .program-tab')[0].click(); });
  await sleep(300);
  await page.click('#runButton');
  await sleep(800);
  await page.evaluate(() => pressStop());
  await sleep(600);
  check(/Program stopped\./.test(await consoleText()), 'STOP ends a running program');

  console.log('errors:', errors);
  check(errors.filter((e) => !/favicon/.test(e)).length === 0, 'no page errors, CSP violations or failed requests');
  await browser.close();
  server.close();
  console.log(failures.length ? failures.length + ' FAILED' : 'all passed');
  process.exit(failures.length ? 1 : 0);
})();

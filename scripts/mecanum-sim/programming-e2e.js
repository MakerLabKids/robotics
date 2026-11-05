// End-to-end: programming.ino (ir.ino without the built-in demos and the # # #
// calibration; the class's Bluetooth programming sketch) in simavr, driven by
// a script of remote keys, light readings and commands over USB and over the
// Bluetooth pin. It starts on ir.ino, saves a motion number and a program,
// then "uploads" programming.ino over it (EEPROM carried over, as a real
// upload leaves it) to show that a calibrated robot keeps its numbers.
// No browser: the test reads what the sketch prints on USB and the motor PWM.
// Run: node scripts/mecanum-sim/programming-e2e.js
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const build = path.join(root, 'temp', 'mecanum-sim', 'programming-e2e');
const simBinary = path.join(build, 'uno-sim');

// A sketch built with USE_LIGHT_BACK 0 (the sonar on A2/A3, two light sensors), as ir-e2e's main run
function buildSketch(name) {
  const copy = path.join(build, name, name);
  fs.mkdirSync(copy, { recursive: true });
  const text = fs.readFileSync(path.join(root, name, name + '.ino'), 'utf8').replace(/#define USE_LIGHT_BACK \d/, '#define USE_LIGHT_BACK 0');
  fs.writeFileSync(path.join(copy, name + '.ino'), text);
  const out = path.join(build, name, 'out');
  execSync(`"${path.join(os.homedir(), '.local', 'bin', 'arduino-cli')}" compile --fqbn arduino:avr:uno --output-dir "${out}" "${copy}"`, { stdio: 'ignore' });
  return path.join(out, name + '.ino.elf');
}

fs.mkdirSync(build, { recursive: true });
execSync(`gcc -O2 -o "${simBinary}" "${path.join(__dirname, 'uno-sim.c')}" -lsimavr -lelf -lm`, { stdio: 'inherit' });
const irElf = buildSketch('ir');
const programmingElf = buildSketch('programming');

const failures = [];
function check(condition, message) { console.log((condition ? 'ok   ' : 'FAIL ') + message); if (!condition) failures.push(message); }

// The 17-key remote's NEC command bytes
const KEY = { U: '18', D: '52', L: '08', R: '5A', O: '1C', '*': '16', '#': '0D', 0: '19', 1: '45', 2: '46', 3: '47', 4: '44', 5: '40', 6: '43', 7: '07', 8: '15', 9: '09' };
const press = (keys, holdMs) => keys.split('').map((k) => 'ir ' + KEY[k] + (holdMs ? ' ' + holdMs : '')).join('\n');
// Brightness in millivolts on the simulator's 3.3 V ADC scale (2000 = the room,
// 3500 = a flashlight); the LDR sits on the GND side, so the pin goes the other way.
const ldr = (ch, mv) => 'adc ' + ch + ' ' + (3300 - Math.min(mv, 3300));
const shine = (ch, mv) => [ldr(ch, mv), 'wait 300', ldr(ch, 2000), 'wait 400'];
let markers = 0;
const mark = () => '[script: --- ' + (++markers) + ' ---]';
const fullSlot = 'p3=' + new Array(17).join('t-180 ').trim() + ';';   // 16 steps, 100 bytes

const script = [
  'irpin B 2', 'wait 2600',          // ir.ino boots
  mark(),                            // 1 on ir.ino: a motion number saved on the robot, a program in slot 2
  'send km0=77;\\n', 'wait 300', 'send kw;\\n', 'wait 600', 'send p2=f10 t90;\\n', 'wait 600',
  'flash ' + programmingElf, 'irpin B 2', 'wait 2600',
  mark(),                            // 2 programming.ino uploaded over it: its banner, the saved numbers, the slots
  'send ?\\n', 'wait 200', 'send k?;\\n', 'wait 1500', 'send p?;\\n', 'wait 1800',
  mark(),                            // 3 the remote: hold UP; an empty slot is empty; # # # is not a calibration
  press('U', 400), 'pwm', 'wait 400', 'pwm',
  press('*1'), 'wait 900',
  press('###'), 'wait 600', press('1'), 'wait 800', press('O'), 'wait 300', press('#'), 'wait 300',
  mark(),                            // 4 programming from the remote: 8 x2 first, then forward 10; saved in slot 4; run with * 4
  press('***'), 'wait 2500', press('*82*'), 'wait 500', press('*U10*'), 'wait 500', press('**'), 'wait 900', press('4**'), 'wait 900', press('*4'), 'wait 5000',
  mark(),                            // 5 programming over Bluetooth: a full slot line, a program with a repeat, run it, list
  'btsend ' + fullSlot, 'wait 1500',
  'btsend p5=n3 f10 t90;', 'wait 800', 'btsend p5;', 'wait 11000',
  'btsend p?;', 'wait 2500',
  mark(),                            // 6 driving over Bluetooth: v (stops by itself when the phone goes quiet), a move, x stops a run
                                     // (x three times, as the pages send it: the module cannot hear while the robot is
                                     // sending a "step" line, so one x in about twenty is lost)
  'btsend v60,0,0;', 'wait 150', 'pwm', 'btsend v0,0,50;', 'wait 150', 'pwm', 'wait 800', 'pwm',
  'btsend m0,100,0;', 'wait 2500',
  'btsend p5;', 'wait 600', 'btsend x', 'wait 60', 'btsend x', 'wait 60', 'btsend x', 'wait 600', 'pwm',
  mark(),                            // 7 the light follower: two shines, then it follows
  ldr(4, 2000), ldr(5, 2000), 'wait 300', press('##1'), 'wait 800', ...shine(4, 3500), ...shine(5, 3500), 'wait 800',
  ldr(5, 3500), 'wait 500', 'pwm', ldr(5, 2000), 'wait 800', press('O'), 'wait 300',
  mark(),                            // 8 a step that runs another program (g<slot>, * 2 <slot> on the remote); an empty slot is skipped
  'btsend p6=g2 g9 b10;', 'wait 800', 'btsend p6;', 'wait 7000',
  press('***'), 'wait 2500', press('*22*'), 'wait 500', press('**'), 'wait 900', press('7**'), 'wait 900', 'send p?;\\n', 'wait 1800',
  mark(),
  '',
].join('\n');
fs.writeFileSync(path.join(build, 'script.txt'), script);
const result = spawnSync(simBinary, [irElf], { input: script, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = result.stdout || '';
fs.writeFileSync(path.join(build, 'output.txt'), output + (result.stderr || ''));
const sections = output.split(/\[script: --- \d+ ---\]/);
const pwms = (text) => (text.match(/\[pwm [^\]]*\]/g) || []);   // [pwm M1 M2 M3 M4]
const moving = (line) => /[1-9]/.test((line || '').replace('pwm', ''));
// what each run did: the steps it drove and the "again" lines, in order
const runsOf = (text) => text.split(/run: (?:the new program|slot \d+)/).slice(1).map((part) => (part.match(/^(step \d+|again: \d+ more|run: (?:done|stopped))/gm) || []).join(' | '));

// 0-1 ir.ino
check(/^ir v0\.10\.\d+/m.test(sections[0]), 'starts on ir.ino');
let s = sections[1];
check(/config: saved/.test(s) && /program: slot 2 = 2 steps/.test(s), 'ir.ino: motion number 0 saved on the robot, a program stored in slot 2');
check(/^programming v0\.10\.\d+/m.test(s) && /ir: receiver on pin 10/.test(s), 'the upload boots as programming');

// 2 after the upload
s = sections[2];
check(/^ready/m.test(s) && /p<n>=<steps>;/.test(s) && /v<f>,<r>,<s>;/.test(s), 'help lists the program and drive commands');
check(/^K,fw,0\.10\.\d+\r?$/m.test(s) && /^K,role,programming\r?$/m.test(s), 'k? says the firmware version and the role programming');
check(/^K,cal,77\.000,.*,e\r?$/m.test(s), 'the motion numbers saved on the robot are read and used (number 0 is the 77 saved under ir.ino, source e)');
check(/^P,2,f10,t90\r?$/m.test(s) && /P,end/.test(s), 'the program saved under ir.ino is still in slot 2');
check(/^P,1\r?$/m.test(s) && /^P,9\r?$/m.test(s) && !/builtin/.test(s), 'the other slots are empty: no built-in demos');

// 3 the remote
s = sections[3];
let p = pwms(s);
check(/ir: up/.test(s) && /drive: forward/.test(s) && p.length >= 2 && moving(p[0]) && !moving(p[1]) && /drive: stop/.test(s), 'hold UP drives, release stops: ' + p.slice(0, 2).join(' | '));
check(/run: slot 1 is empty/.test(s) && /gesture: no\b/.test(s), '* 1 on an empty slot: "is empty" and a "no" (no demo)');
check(!/calibrate:/.test(s) && /light: follow/.test(s) && /light: calibration skipped/.test(s) && /light: stop/.test(s), '# # # is not a calibration: the 1 after it starts the light follower; OK skips the teach-in, # stops');

// 4 programming from the remote
s = sections[4];
check(/program: listening/.test(s) && /step 1: do it all again 2 times/.test(s) && /program: saved in slot 4/.test(s), 'remote: * * *, 8 x2, forward 10, * * *, 4 * * saves in slot 4');
check(runsOf(s)[0] === 'step 2 | again: 1 more | step 2 | run: done', '* 4 runs it: the 8 typed first repeats the step after it: ' + runsOf(s)[0]);

// 5 programming over Bluetooth
s = sections[5];
check(/program: slot 3 = 16 steps/.test(s) && /^P,3(,t-180){16}\r?$/m.test(s), 'Bluetooth: a full 16-step line (100 bytes) is stored whole');
check(/program: slot 5 = 3 steps/.test(s) && runsOf(s)[0] === 'step 2 | step 3 | again: 2 more | step 2 | step 3 | again: 1 more | step 2 | step 3 | run: done', 'Bluetooth: p5=n3 f10 t90; then p5; runs forward and turn three times: ' + runsOf(s)[0]);
check(/^P,4,n2,f10\r?$/m.test(s) && /^P,5,n3,f10,t90\r?$/m.test(s) && /P,end/.test(s), 'Bluetooth: p? lists the remote-typed slot 4 and the Bluetooth-sent slot 5');

// 6 driving over Bluetooth
s = sections[6];
p = pwms(s);
check(p.length >= 4 && moving(p[0]) && moving(p[1]) && p[0] !== p[1], 'Bluetooth: v drives forward, then turns: ' + p[0] + ' then ' + p[1]);
check(!moving(p[2]), 'Bluetooth: the phone goes quiet: it stops by itself: ' + p[2]);
check(/move: start/.test(s) && /move: done/.test(s), 'Bluetooth: m0,100,0; drives a move to the end');
check(runsOf(s)[0] !== undefined && /run: stopped/.test(s) && !moving(p[3]), 'Bluetooth: x stops a running program: ' + runsOf(s)[0]);

// 7 the light follower
s = sections[7];
p = pwms(s);
check(/light: calibrated, gains left 100%, right 100%/.test(s) && /gesture: nod/.test(s), 'light: # # 1, a shine on each sensor: calibrated, nod');
check(/light: sees it/.test(s) && p.length && moving(p[0]) && /light: stop/.test(s), 'light: it follows the flashlight, OK stops it: ' + p[0]);

// 8 a step that runs another program
s = sections[8];
{
  const lines = (s.match(/^(step \d+: [a-z ]+ \d+|run: [a-z ,]+)/gm) || []).join(' | ');
  check(/program: slot 6 = 3 steps/.test(s) && lines.indexOf('step 1: run program 2 | step 1: forward 10 | step 2: turn right 90 | step 2: run program 9 | run: nothing in that slot, skipped | step 3: back 10 | run: done') !== -1, 'Bluetooth: p6=g2 g9 b10; runs slot 2 inside it, skips the empty slot 9, carries on: ' + lines);
  check(/step 1: run program 2\r?\n/.test(s) && /program: saved in slot 7/.test(s) && /^P,7,g2\r?$/m.test(s), 'remote: * 2 2 is a "run program 2" step, saved in slot 7 as g2');
}

console.log(failures.length ? failures.length + ' FAILED (see ' + path.join(build, 'output.txt') + ')' : 'all passed');
process.exit(failures.length ? 1 : 0);

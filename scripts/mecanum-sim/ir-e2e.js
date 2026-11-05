// End-to-end: ir.ino (the remote-only robot) in simavr, driven by a script of
// remote keys, sonar readings and instructor commands. No browser: the test
// reads what the sketch prints on USB and the motor PWM the simulator sees.
// Run: node scripts/mecanum-sim/ir-e2e.js
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const build = path.join(root, 'temp', 'mecanum-sim', 'ir-e2e');
const simBinary = path.join(build, 'uno-sim');
const elf = path.join(build, 'ir-sonar.elf');

// The sketch with USE_LIGHT_BACK set (0: the sonar on A2/A3; 1: a back LDR on A3)
function buildSketch(lightBack, folder) {
  const copy = path.join(build, folder, 'ir');
  fs.mkdirSync(copy, { recursive: true });
  const text = fs.readFileSync(path.join(root, 'ir', 'ir.ino'), 'utf8').replace(/#define USE_LIGHT_BACK \d/, '#define USE_LIGHT_BACK ' + lightBack);
  fs.writeFileSync(path.join(copy, 'ir.ino'), text);
  const out = path.join(build, folder, 'out');
  execSync(`"${path.join(os.homedir(), '.local', 'bin', 'arduino-cli')}" compile --fqbn arduino:avr:uno --output-dir "${out}" "${copy}"`, { stdio: 'ignore' });
  return path.join(out, 'ir.ino.elf');
}

function buildEverything() {
  fs.mkdirSync(build, { recursive: true });
  execSync(`gcc -O2 -o "${simBinary}" "${path.join(__dirname, 'uno-sim.c')}" -lsimavr -lelf -lm`, { stdio: 'inherit' });
  fs.copyFileSync(buildSketch(0, 'sonar'), elf);
}

const failures = [];
function check(condition, message) { console.log((condition ? 'ok   ' : 'FAIL ') + message); if (!condition) failures.push(message); }

// The 17-key remote's NEC command bytes
const KEY = { U: '18', D: '52', L: '08', R: '5A', O: '1C', '*': '16', '#': '0D', 0: '19', 1: '45', 2: '46', 3: '47', 4: '44', 5: '40', 6: '43', 7: '07', 8: '15', 9: '09' };
const press = (keys, holdMs) => keys.split('').map((k) => 'ir ' + KEY[k] + (holdMs ? ' ' + holdMs : '')).join('\n');
// A marker line so the output can be cut into sections
// The light calibration: a shine on one LDR (A4 left, A5 right), then nothing
// (both back to the room's 2 V of brightness); and the whole start sequence (one shine per side)
// Since 0.10.83 the LDR sits on the GND side of its divider (resistor to 5V), so
// a brighter LDR is a LOWER pin voltage. The numbers in this script are
// brightness in millivolts on the simulator's 3.3 V ADC scale (2000 = the room,
// 3500 = a torch, as the old wiring read them); ldr() turns them into the pin
// voltage the sketch actually sees. 'adc' lines written out by hand are raw.
const ldr = (ch, mv) => 'adc ' + ch + ' ' + (3300 - Math.min(mv, 3300));
const shine = (ch, mv) => [ldr(ch, mv), 'wait 300', ldr(ch, 2000), 'wait 400'];
const calibrate = (left, right) => [].concat(shine(4, left), shine(5, right));
let markers = 0;
const mark = () => '[script: --- ' + (++markers) + ' ---]';

buildEverything();
const script = [
  'irpin B 2',                       // the receiver on D10 (PB2), the sketch's default
  'wait 2600',                       // boot: the Bluetooth module gets 2 s
  'send ?\\n',
  'wait 200',
  mark(),                            // 1 drive by remote: hold UP
  press('U', 400), 'pwm', 'wait 400', 'pwm',
  mark(),                            // 2 the sonar: something 150 mm ahead
  'sonar 150', press('U', 300), 'pwm', 'wait 400',
  press('D', 300), 'pwm', 'wait 400',
  'send u\\n', 'wait 100',
  'sonar -1',
  mark(),                            // 3 a program: * * *, * UP 5 0, * 3 9 0, * * *, slot 3, * *
  press('***'), 'wait 800',
  press('*U50*'), 'wait 400',
  press('390***'), 'wait 800',
  press('3**'), 'wait 400',
  'send p?\\n', 'wait 300',
  mark(),                            // 4 run slot 3 (500 mm + 90 deg at the program speed)
  press('*3'), 'wait 300', 'pwm', 'wait 4500',
  mark(),                            // 5 run again, stop it with 0
  press('*3'), 'wait 400', press('0'), 'wait 300', 'pwm',
  mark(),                            // 6 an empty slot
  press('*4'), 'wait 800', 'pwm', 'wait 10000',
  mark(),                            // 7 the instructor: store, list, run by text; cancel with #
  'send p5=f20 t-90 b20;\\n', 'wait 200',
  'send p?\\n', 'wait 400',
  'send i***;\\n', 'wait 800',
  'send iU5;\\n', 'wait 200',
  'send i#;\\n', 'wait 800',
  'send i*5;\\n', 'wait 3500',
  mark(),                            // 8 the sonar stops a running program
  press('***'), 'wait 800', press('*U99***'), 'wait 1200', press('O'), 'wait 300', 'sonar 100', 'wait 600', 'pwm',
  'sonar -1', 'wait 200', press('#'), 'wait 800',   // (still in program mode: # leaves it)
  mark(),                            // 9 a lone * is forgotten after 5 s; # stops driving
  press('*'), 'wait 5200', press('5'), 'wait 200',
  press('U', 300), press('#'), 'wait 100', 'pwm',
  mark(),                            // 10 calibration from the remote: # # #, start power, 1 m, drift, four turns
  press('###'), 'wait 1200',
  press('D'), 'wait 700', press('U'), 'wait 700', press('O'), 'wait 600',
  press('O'), 'wait 4000', press('*'), 'wait 4000',
  press('90O'), 'wait 700',
  press('R5O'), 'wait 600',
  press('O'), 'wait 8500',
  press('R10O'), 'wait 1200',
  'send k?\\n', 'wait 1500',
  mark(),                            // 12 keep driving from the phone: v drives until it is not repeated; the sonar zeroes forward
  'send v40,0,0;\\n', 'wait 100', 'pwm', 'wait 700', 'pwm',
  'sonar 150', 'send v40,20,0;\\n', 'wait 100', 'pwm', 'send x\\n', 'sonar -1', 'wait 300',
  mark(),                            // 11 cancel puts the saved numbers back
  press('###'), 'wait 1200', press('U'), 'wait 700', press('#'), 'wait 800', 'send k?\\n', 'wait 1500',
  mark(),                            // 13 new steps: a square in three steps (forward 20, turn right, do it all again 4 times)
  press('***'), 'wait 800', press('*U20*'), 'wait 400', press('*3*'), 'wait 400', press('*84***'), 'wait 900',
  press('6**'), 'wait 600', 'send p?\\n', 'wait 1500',
  press('*6'), 'wait 300', 'wait 9000',
  mark(),                            // 14 add to slot 6 (* * * * 6): pause 2 s and diagonal left 15; text form of every new letter
  press('****6'), 'wait 900', press('*52*'), 'wait 400', press('*715*'), 'wait 400', press('***'), 'wait 800', press('6**'), 'wait 600',
  'send p7=q15 e15 p1 n2 c60;\\n', 'wait 300', 'send p?\\n', 'wait 1800',
  mark(),                            // 15 program 0: the circle
  press('*0'), 'wait 600', 'pwm', 'wait 14000',
  mark(),                            // 16 follow the light (# # 1): LDRs on A4 / A5, room light ~2 V
  ldr(4, 2000), ldr(5, 2000), 'wait 100', 'send b\\n', 'wait 100',
  press('##1'), 'wait 800', 'pwm',
  ...shine(4, 3500), ...shine(4, 3500), ...shine(5, 3500),   // (left twice: counted once)
  'wait 300', 'pwm',
  ldr(5, 3500), 'wait 500', 'pwm',
  ldr(4, 3500), 'wait 500', 'pwm', 'dirs',
  'sonar 150', 'wait 300', 'pwm', 'sonar -1',
  ldr(4, 2000), ldr(5, 2000), 'wait 800', 'pwm',
  press('O'), 'wait 300',
  mark(),                            // 17 run from the light (# # 2); x stops it
  press('##2'), 'wait 800', press('O'), 'wait 300', ldr(4, 3500), ldr(5, 3500), 'wait 500', 'pwm', 'dirs',
  'send x\\n', 'wait 200', 'pwm', ldr(4, 2000), ldr(5, 2000),
  mark(),                            // 18 not a flash start: left left (same side), then three hits and too slow
  'wait 1500', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300',
  'wait 5500', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300', ldr(5, 3500), 'wait 200', ldr(5, 2000), 'wait 300', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300', 'wait 5500', ldr(5, 3500), 'wait 200', ldr(5, 2000), 'wait 300', 'wait 300', 'pwm',
  mark(),                            // 19 the flash start: left right left right in 5 s follows, like # # 1
  'wait 5500', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300', ldr(5, 3500), 'wait 200', ldr(5, 2000), 'wait 300', ldr(4, 3500), 'wait 200', ldr(4, 2000), 'wait 300', ldr(5, 3500), 'wait 200', ldr(5, 2000), 'wait 300',
  'wait 300', ldr(4, 2000), ldr(5, 3500), 'wait 500', 'pwm', press('O'), 'wait 300', ldr(5, 2000),
  mark(),                            // 20 mismatched LDRs: the left rises 3x the right (the simulator's ADC tops out at 3.3 V); after the calibration that light on both drives straight; OK keeps those gains
  'wait 300', press('##1'), 'wait 800', ...calibrate(3250, 2400), 'wait 800', ldr(4, 3250), ldr(5, 2400), 'wait 500', 'pwm', 'dirs',
  press('O'), 'wait 300', ldr(4, 2000), ldr(5, 2000), 'wait 300',
  press('##1'), 'wait 800', press('O'), 'wait 300', ldr(4, 3250), ldr(5, 2400), 'wait 500', 'pwm', 'dirs', press('O'), 'wait 300', ldr(4, 2000), ldr(5, 2000),
  mark(),                            // 21 the other LDR lit with no "nothing" between: not counted; a sensor that barely changes: "no", that side again; still weak: goes anyway; # stops
  'wait 300', press('##1'), 'wait 800',
  ldr(4, 3500), 'wait 300', ldr(5, 3500), 'wait 300', ldr(4, 2000), 'wait 300', ldr(5, 2000), 'wait 400',
  ...shine(5, 2170), ...shine(4, 3500), ...shine(5, 2170), 'wait 300', 'pwm', press('#'), 'wait 300',
  mark(),                            // 22 a brighter floor (no flashlight): it sees it at first, then the room's light catches up and it stops
  'wait 300', press('##1'), 'wait 800', ...calibrate(3500, 3500), 'wait 800',
  ldr(4, 2300), ldr(5, 2300), 'wait 500', 'pwm', 'wait 11000', 'pwm', press('O'), 'wait 300', ldr(4, 2000), ldr(5, 2000),
  mark(),                            // 23 the 8 (repeat) BEFORE its steps: typed on the remote, and in slot lines (alone and mixed with an 8 after)
  'wait 300', press('***'), 'wait 2500', press('*82*'), 'wait 500', press('*U10*'), 'wait 500', press('*390*'), 'wait 500', press('**'), 'wait 900', press('O'), 'wait 7000', press('#'), 'wait 400',
  'send p8=n2 f10 n3 b10;\\n', 'wait 400', 'send p8;\\n', 'wait 9000',
  'send p8=f10 n2 n2 b10;\\n', 'wait 400', 'send p8;\\n', 'wait 7000',
  mark(),                            // 24 Bluetooth: a full 16-step slot line (100 bytes, more than SoftwareSerial's 64) arrives whole; two commands in one burst; drive and stop
  'btsend p3=' + new Array(17).join('t-180 ').trim() + ';', 'wait 1500',
  'btsend p4=f10 t90 n2;p?;', 'wait 2500',
  'btsend v60,0,0;', 'wait 150', 'pwm', 'btsend x', 'wait 300', 'pwm',
  mark(),                            // 25 a step that runs another program: typed on the remote (* 2 <slot>), in slot lines (g<slot>),
                                     // inside a repeat, a program that runs itself, and a key during the program it runs
  'send p1=f10 t90;\\n', 'wait 400',
  press('***'), 'wait 2500', press('*21*'), 'wait 500', press('*D10*'), 'wait 500', press('**'), 'wait 900', press('O'), 'wait 7000', press('#'), 'wait 400',
  'send p2=g1 n2;\\n', 'wait 400', 'send p2;\\n', 'wait 9000',
  'send p3=f10 g3;\\n', 'wait 400', 'send p3;\\n', 'wait 9000',
  'send p2;\\n', 'wait 700', press('0'), 'wait 800', 'pwm',
  'send p?\\n', 'wait 1500',
  mark(),
  '',
].join('\n');
fs.writeFileSync(path.join(build, 'script.txt'), script);
const result = spawnSync(simBinary, [elf], { input: script, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = result.stdout || '';
fs.writeFileSync(path.join(build, 'output.txt'), output + (result.stderr || ''));
const sections = output.split(/\[script: --- \d+ ---\]/);
const pwms = (text) => (text.match(/\[pwm [^\]]*\]/g) || []);   // [pwm M1 M2 M3 M4]
const moving = (line) => /[1-9]/.test(line.replace('pwm', ''));

check(/^ir v0\.10\.\d+/m.test(output) && /ir: receiver on pin 10, sonar stop at 250 mm/.test(output), 'boots as ir, receiver on pin 10, sonar stop 250 mm');
check(/^ready/m.test(sections[0]) && /i<keys>; p\?;/.test(sections[0]), 'help lists the remote and program commands');

// 1 hold UP: drives forward while held, stops 250 ms after the last repeat
let s = sections[1];
let p = pwms(s);
check(/ir: up/.test(s) && /drive: forward/.test(s), 'UP echoed and drives forward');
check(p.length === 2 && moving(p[0]) && !moving(p[1]), 'motors on while held, off after release: ' + p.join(' | '));
check(/drive: stop/.test(s), 'release stops');

// 2 sonar
s = sections[2];
p = pwms(s);
check(/stop: something ahead/.test(s) && p.length >= 1 && !moving(p[0]), 'UP with something 150 mm ahead: does not drive, says why');
check(/drive: back/.test(s) && p.length >= 2 && moving(p[1]), 'DOWN still drives with something ahead');
check(/^U,1[3-7]\d$/m.test(s), 'u reads the sonar (~150 mm)');

// 3 programming
s = sections[3];
check(/program: listening/.test(s) && /gesture: wiggle/.test(s), '* * * enters program mode with a wiggle');
check(/step 1: forward 50 cm/.test(s) && /step 2: turn right 90 deg/.test(s), 'steps understood: forward 50 cm, turn right 90 deg');
check((s.match(/gesture: nod/g) || []).length >= 3, 'a nod per step and for the save');
check(/program: 2 steps - which slot\?/.test(s), '* * * ends the program and asks for a slot');
check(/program: saved in slot 3/.test(s), '3 * * saves in slot 3');
check(/^P,3,f50,t90$/m.test(s) && /^P,1,f50,t90,n4,builtin$/m.test(s), 'p? lists slot 3 as f50,t90 and slot 1 as its built-in square');

// 4 run
s = sections[4];
p = pwms(s);
check(/run: slot 3/.test(s) && /step 1: forward 50 cm/.test(s) && /step 2: turn right 90 deg/.test(s), '* 3 runs slot 3, both steps');
check(p.length && moving(p[0]), 'motors on during the run');
check(/run: done/.test(s), 'run finishes');

// 5 stopped by a key
s = sections[5];
p = pwms(s);
check(/run: slot 3/.test(s) && /run: stopped/.test(s) && !/run: done/.test(s), '0 during a run stops it');
check(p.length && !moving(p[0]), 'motors off after the stop');

// 6 empty slot
s = sections[6];
p = pwms(s);
check(/run: slot 4 \(built-in demo\)/.test(s) && /step 1: forward 50 cm/.test(s) && /step 2: turn right 120 deg/.test(s) && p.length && moving(p[0]) && /run: done/.test(s), '* 4 with nothing saved: runs the built-in triangle');

// 7 instructor commands
s = sections[7];
check(/program: slot 5 = 3 steps/.test(s) && /^P,5,f20,t-90,b20$/m.test(s), 'p5=f20 t-90 b20 stored and listed');
check(/program: listening/.test(s) && /ir: up/.test(s) && /program: canceled/.test(s) && /gesture: no/.test(s), 'i***; iU5; i#; types keys: program mode then cancelled');
check(/run: slot 5/.test(s) && /step 2: turn left 90 deg/.test(s) && /run: done/.test(s), 'i*5; runs slot 5 (turn left 90 included)');

// 8 the sonar stops a running program (OK = try the draft)
s = sections[8];
p = pwms(s);
check(/run: the new program/.test(s) && /step 1: forward 99 cm/.test(s), 'OK after * * * tries the new program');
check(/stop: something ahead/.test(s) && /run: stopped/.test(s), 'something 100 mm ahead stops the forward step');
check(p.length && !moving(p[0]), 'motors off after the sonar stop');
check(/program: canceled/.test(s), '# afterwards leaves program mode');

// 9 timeouts and #
s = sections[9];
p = pwms(s);
check(!/run: slot 5/.test(s), 'a * forgotten after 5 s: 5 alone does not run slot 5');
check(/drive: forward/.test(s) && /drive: stop/.test(s) && p.length && !moving(p[0]), '# stops driving');

// 10 calibration
s = sections[10];
check(/calibrate: start/.test(s) && /gesture: wiggle/.test(s) && /calibrate: pulse at 85/.test(s), '# # # starts calibration with a wiggle and a pulse at the start power');
check(/pulse at 82/.test(s) && (s.match(/pulse at 85/g) || []).length === 2, 'DOWN pulses at 82, UP back at 85');
check(/calibrate: start power 85/.test(s) && /calibrate: 2 put it on a mark - OK drives 1 m/.test(s), 'OK keeps the start power and waits for OK before driving');
check((s.match(/calibrate: driving 1 m/g) || []).length === 2 && /calibrate: 2 how many cm/.test(s), 'OK drives 1 m, * drives it again, then asks for the cm');
check(/calibrate: speeds x 0\.900/.test(s), '90 cm typed: speeds x 0.9');
check(/calibrate: left gain x 0\.9\d\d/.test(s), 'drift RIGHT 5 cm: left wheels turned down');
check(/calibrate: 3 mark where it faces - OK turns/.test(s) && /turning right 90, four times/.test(s) && /calibrate: 3 off by\?/.test(s), 'waits for OK, four right 90s, then asks how far off');
check(/calibrate: spin efficiency 0\.62\d/.test(s), 'RIGHT 10 past: spin efficiency x 370/360');
check(/calibrate: saved on the robot/.test(s) && /^K,cal,84\.000,85\.000,301\.500,432\.000,.*,e$/m.test(s), 'saved: k? shows the new numbers from EEPROM (e)');

// 12 keep driving (v)
s = sections[11];
p = pwms(s);
check(p.length >= 3 && moving(p[0]) && !moving(p[1]), 'v40,0,0; runs the motors and they stop when it is not repeated: ' + p.slice(0, 2).join(' | '));
check(/stop: something ahead/.test(s) && moving(p[2]), 'v with something 150 mm ahead: forward zeroed and said, the sideways part still drives: ' + p[2]);

// 11 cancel
s = sections[12];
check(/calibrate: canceled/.test(s) && /gesture: no/.test(s) && /^K,cal,84\.000,85\.000,301\.500,432\.000,.*,e$/m.test(s), '# in calibration: cancelled, saved numbers back');

// 13 diagonals / pause / repeat
s = sections[13];
check(/step 3: do it all again 4 times/.test(s) && /program: saved in slot 6/.test(s) && /^P,6,f20,t90,n4$/m.test(s), '* 8 4 is a repeat step; slot 6 lists as f20,t90,n4');
check((s.slice(s.indexOf('run: slot 6')).match(/step 1: forward 20 cm/g) || []).length === 4 && /again: 3 more/.test(s) && /again: 1 more/.test(s) && /run: done/.test(s), 'running it goes round four times');

// 14 add mode and the text letters
s = sections[14];
check(/program: adding to slot 6 \(3 steps\)/.test(s) && /gesture: wiggle[\s\S]*gesture: nod/.test(s), '* * * * 6: adding to slot 6 with a wiggle and a nod');
check(/step 4: wait 2 s/.test(s) && /step 5: diagonal left 15 cm/.test(s) && /^P,6,f20,t90,n4,p2,q15$/m.test(s), 'added a pause and a diagonal; slot 6 lists all five');
check(/program: slot 7 = 5 steps/.test(s) && /^P,7,q15,e15,p1,n2,c60$/m.test(s), 'p7=q15 e15 p1 n2 c60 round-trips through the text form');

// 15 the circle
s = sections[15];
p = pwms(s);
check(/run: program 0 \(circle, 1 m across, facing in\)/.test(s) && /step 1: circle, facing in, 100 cm across/.test(s) && p.length && moving(p[0]) && /run: done/.test(s), '* 0 runs the 1 m circle to the end');

// 16 follow the light
s = sections[16];
p = pwms(s);
const nums = (line) => (line || '').replace(/[^-\d ]/g, ' ').trim().split(/\s+/).map(Number);
check(/^B,0,(\d+),\1,\1$/m.test(s), 'b reads both LDRs (the same 2 V on each: straight ahead, brightest = each)');
check(/light: follow \(left \d+, right \d+\)/.test(s) && /light: calibrate, shine on one sensor, then the other/.test(s) && /gesture: wiggle/.test(s), '# # 1 says the room light and wiggles for the calibration');
check(p.length >= 6 && !moving(p[0]), 'calibrating: motors off: ' + p[0]);
const shines = (s.match(/light: shine \d \w+/g) || []).join(', ');
check(shines === 'light: shine 1 left, light: shine 2 right', 'left, left again (not counted), right: two shines, one per side: ' + shines);
check(/light: # # - press 1 to follow, 2 to run away/.test(s), '# # ticks and says 1 follows, 2 runs away (so a lost # is not mistaken for a window that ran out)');
check((s.match(/gesture: tick/g) || []).length === 3 && !/light: now both/.test(s) && !/gesture: no\b/.test(s), 'a tick for # # and for each of the two shines, nothing else');
check(/light: calibrated, gains left 100%, right 100% \(shine left \+\d+, right \+\d+\)/.test(s) && /gesture: nod/.test(s), 'matched LDRs: gains 100% and 100%, a nod');
const dirs = (text) => (text.match(/\[dirs [^\]]*\]/g) || []);   // [dirs FL FR RL RR]
check(!moving(p[1]), 'after the nod, flashlight off: it waits: ' + p[1]);
const [m1, m2, m3, m4] = nums(p[2]);   // M1 RL, M2 RR, M3 FR, M4 FL
check(/light: sees it/.test(s) && moving(p[2]) && m4 > m3 && m1 > m2, 'torch on the right: it turns right (left wheels harder): ' + p[2]);
check(moving(p[3]) && dirs(s)[0] === '[dirs + + + +]', 'torch on both: straight ahead, every wheel forward: ' + p[3] + ' ' + dirs(s)[0]);
check(!nums(p[4]).some((n) => n > 0) || nums(p[4]).every((n) => n === 0), 'something 150 mm ahead: it stops going forward: ' + p[4]);
check(/light: lost it/.test(s) && !moving(p[5]), 'torch gone: lost it, motors off: ' + p[5]);
check(/light: stop/.test(s), 'OK stops light mode');

// 17 run from the light
s = sections[17];
p = pwms(s);
check(/light: calibration skipped/.test(s), '# # 2 then OK: calibration skipped');
check(/light: run away/.test(s) && p.length >= 2 && moving(p[0]) && dirs(s)[0] === '[dirs - - - -]', '# # 2 with a torch ahead: it backs away, every wheel backward: ' + p[0] + ' ' + dirs(s)[0]);
check(/light: stop/.test(s) && !moving(p[1]), 'x stops it');

// 18 not a flash start
s = sections[18];
p = pwms(s);
check(/light: flash 3/.test(s) && !/light: flash 4/.test(s) && !/light: follow/.test(s) && p.length && !moving(p[0]), 'the same LDR twice, or three hits then a slow fourth: no start: ' + (s.match(/light: flash \d/g) || []).join(' '));

// 19 the flash start
s = sections[19];
p = pwms(s);
check(/light: flash 4/.test(s) && /light: follow/.test(s) && !/light: calibrate,/.test(s) && !/light: shine/.test(s) && !/gesture: wiggle/.test(s), 'left right left right within 5 s: following, no teach-in to do');
check(/light: calibrated, gains left 100%, right 100%/.test(s) && /gesture: nod/.test(s), 'the four flashes are the two shines: calibrated on the spot, nod');
check(/light: sees it/.test(s) && p.length && moving(p[0]) && /light: stop/.test(s), 'then it follows the torch and OK stops it: ' + p[0]);

// 20 mismatched LDRs
s = sections[20];
p = pwms(s);
{
  const g = s.match(/light: calibrated, gains left (\d+)%, right (\d+)%/);
  check(g && +g[1] < 80 && +g[2] > 150, 'left 3x as sensitive: its gain goes down, the right one up: ' + (g ? g[0] : 'none'));
  // straight = what matched LDRs with the same light on both drive (section 22; the drive's own trims make the sides differ a little)
  const straight = pwms(sections[22])[0];
  // the same within a couple of PWM steps: the gains come from 300 ms shines, the drive is sampled later
  const near = (a, b) => nums(a).every((n, i) => Math.abs(n - nums(b)[i]) <= 2);
  check(moving(p[0]) && dirs(s)[0] === '[dirs + + + +]' && near(p[0], straight), 'the flashlight straight ahead: drives the same as matched LDRs do: ' + p[0] + ' vs ' + straight);
  check(/light: calibration skipped, gains left (\d+)%/.test(s) && near(p[1], straight), 'next start, OK skips: the same gains, still straight: ' + p[1]);
}

// 21 strict shines, a weak LDR
s = sections[21];
p = pwms(s);
check((s.match(/light: shine \d \w+/g) || []).join(', ') === 'light: shine 1 left, light: shine 2 right, light: shine 3 right', 'the right lit before the left went dark: not counted (counted on its own later); after the "no" only the right counts again: ' + (s.match(/light: shine \d \w+/g) || []).join(', '));
check(/light: the right sensor barely changes \(\+\d+\): shine on it again/.test(s) && (s.match(/gesture: no\b/g) || []).length === 1 && (s.match(/light: calibrate,/g) || []).length === 1, 'a right LDR that rises only ~50 (under 1/4 of the left): one "no", no start over');
check(/light: calibrated, gains left \d+%, right 400%/.test(s) && /gesture: nod/.test(s), 'still weak on the second shine: it goes anyway with the right gain at its limit');
check(p.length && !moving(p[0]) && /light: stop/.test(s), 'it never drove (no flashlight); # stops');

// 22 a brighter floor
s = sections[22];
p = pwms(s);
check(/light: calibrated/.test(s) && moving(p[0]) && p.length >= 2 && !moving(p[1]) && /light: lost it/.test(s), 'floor a bit brighter, no flashlight: drives at first, then the room catches up and it stops: ' + p[0] + ' then ' + p[1]);

// 23 the 8 before its steps
s = sections[23];
{
  // what each run did: the steps it drove and the "again" lines, in order
  const runs = s.split(/run: (?:the new program|slot \d+)/).slice(1).map((part) => (part.match(/^(step \d+|again: \d+ more|run: done)/gm) || []).join(' | '));
  check(/step 1: do it all again 2 times/.test(s) && runs[0] === 'step 2 | step 3 | again: 1 more | step 2 | step 3 | run: done', 'remote: 8 x2 typed FIRST, then forward and turn: both steps run twice: ' + runs[0]);
  check(runs[1] === 'step 2 | again: 1 more | step 2 | step 4 | again: 2 more | step 4 | again: 1 more | step 4 | run: done', 'p8=n2 f10 n3 b10: each 8 repeats the steps after it: ' + runs[1]);
  check(runs[2] === 'step 1 | again: 1 more | step 1 | step 4 | again: 1 more | step 4 | run: done', 'p8=f10 n2 n2 b10: the first 8 repeats what came before, the second what follows: ' + runs[2]);
}

// 24 Bluetooth
s = sections[24];
p = pwms(s);
check(/program: slot 3 = 16 steps/.test(s) && /^P,3(,t-180){16}\r?$/m.test(s), 'Bluetooth: a full 16-step line (100 bytes) is stored whole');
check(/program: slot 4 = 3 steps/.test(s) && /^P,4,f10,t90,n2\r?$/m.test(s) && /P,end/.test(s), 'Bluetooth: two commands in one burst (store, then list) both run');
check(p.length >= 2 && moving(p[0]) && !moving(p[1]) && /stop/.test(s), 'Bluetooth: v drives, x stops: ' + p[0] + ' then ' + p[1]);

// 25 a step that runs another program
s = sections[25];
p = pwms(s);
{
  // what each run did: every step, "again" and "run:" line, in order
  const runs = s.split(/run: (?:the new program|slot \d+)\r?\n/).slice(1).map((part) => (part.match(/^(step \d+: [a-z ]+ \d+|again: \d+ more|run: [a-z ,]+)/gm) || []).join(' | '));
  check(/step 1: run program 1\r?\n/.test(s) && runs[0] === 'step 1: run program 1 | step 1: forward 10 | step 2: turn right 90 | step 2: back 10 | run: done', 'remote: * 2 1 (run program 1), then back 10: slot 1 runs inside the new program, then it carries on: ' + runs[0]);
  check(runs[1] === 'step 1: run program 1 | step 1: forward 10 | step 2: turn right 90 | again: 1 more | step 1: run program 1 | step 1: forward 10 | step 2: turn right 90 | run: done', 'p2=g1 n2: the program it runs is repeated like any step: ' + runs[1]);
  check((runs[2].match(/forward 10/g) || []).length === 4 && (runs[2].match(/too many programs deep, skipped/g) || []).length === 1 && /run: done$/.test(runs[2]), 'p3=f10 g3 (runs itself): four rounds, then the step is skipped and it ends: ' + runs[2]);
  check(runs[3] !== undefined && /run: stopped$/.test(runs[3]) && !/run: done/.test(runs[3]) && p.length && !moving(p[0]), 'a key during the program it runs stops the whole run, once: ' + runs[3]);
  check(/^P,2,g1,n2\r?$/m.test(s) && /^P,3,f10,g3\r?$/m.test(s), 'p? lists the step as g<slot>');
}

// The back LDR on A3 (USE_LIGHT_BACK 1): a light behind
const backScript = [
  'irpin B 2', 'wait 2600',
  ldr(3, 2000), ldr(4, 2000), ldr(5, 2000), 'wait 100', 'send b\\n', 'wait 200',
  press('##1'), 'wait 800', press('O'), 'wait 300', ldr(3, 3500), 'wait 500', 'pwm', 'dirs',
  ldr(4, 2900), 'wait 500', 'pwm', 'dirs', press('O'), 'wait 300', ldr(3, 2000), ldr(4, 2000), 'wait 300',
  press('##2'), 'wait 800', press('O'), 'wait 300', ldr(3, 3500), 'wait 500', 'pwm', 'dirs', 'send x\\n', 'wait 300', ldr(3, 2000),
  'adc 3 5000', 'wait 100', press('##1'), 'wait 800', 'send x\\n', 'wait 300',
  '',
].join('\n');
const backResult = spawnSync(simBinary, [buildSketch(1, 'back')], { input: backScript, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const back = backResult.stdout || '';
fs.writeFileSync(path.join(build, 'output-back.txt'), back + (backResult.stderr || ''));
p = pwms(back);
const bd = back.match(/\[dirs [^\]]*\]/g) || [];
check(/no sonar: back light sensor on A3/.test(back) && /^B,0,(\d+),\1,\1,\1$/m.test(back) && /light: back sensor found/.test(back), 'USE_LIGHT_BACK 1: boots without the sonar, finds the back LDR, b reads three');
check(p.length >= 3 && bd[0] === '[dirs - - - -]', '# # 1, light behind: it backs straight toward it: ' + p[0] + ' ' + bd[0]);
{
  const [b1, b2, b3, b4] = nums(p[1]);   // M1 RL, M2 RR, M3 FR, M4 FL
  check(/^\[dirs [-0] - [-0] -\]$/.test(bd[1] || '') && b4 < b3 && b1 < b2, 'spill on the front-left LDR: still backing, tail swinging toward it (clockwise): ' + p[1] + ' ' + bd[1]);
}
check(bd[2] === '[dirs + + + +]', '# # 2, light behind: it runs forward, away from it: ' + p[2] + ' ' + bd[2]);
check(/light: no back sensor/.test(back), 'an empty A3 (reads the top with the pull-up on): no back sensor');

console.log(failures.length ? '\n' + failures.length + ' FAILED (see ' + path.join(build, 'output.txt') + ')' : '\nall passed');
process.exit(failures.length ? 1 : 0);

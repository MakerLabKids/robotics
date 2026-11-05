// calibration.ino measures the robot that mecanum_holonomic.ino drives, and
// ir.ino and programming.ino drive it from the remote, so the code all four
// use must be the same: the motor shield, the speed curve, the wheel math,
// the move timing, and the motion numbers themselves (calibrating changes
// them in every file). This compares those functions and constants (code
// only: comments and spacing may differ) between mecanum_holonomic.ino and
// each of the others, and fails on any difference.
// programming.ino is ir.ino without the built-in demos and the # # #
// calibration: every function the two both have must be identical too, apart
// from the few that differ on purpose (IR_VS_PROGRAMMING_DIFFERENT), so a fix
// in one lands in the other.
// Run: node scripts/check-mecanum-shared.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const robot = fs.readFileSync(path.join(root, 'mecanum_holonomic', 'mecanum_holonomic.ino'), 'utf8');
const OTHERS = [
  { name: 'calibration.ino', text: fs.readFileSync(path.join(root, 'calibration', 'calibration.ino'), 'utf8') },
  { name: 'ir.ino', text: fs.readFileSync(path.join(root, 'ir', 'ir.ino'), 'utf8') },
  { name: 'programming.ino', text: fs.readFileSync(path.join(root, 'programming', 'programming.ino'), 'utf8') },
];
// What programming.ino does differently from ir.ino on purpose: an empty slot
// is empty (no demo), and a third # does not start a calibration.
const IR_VS_PROGRAMMING_DIFFERENT = ['runSlot', 'handleProgramText', 'handleKeyIdle', 'handleKey'];

const FUNCTIONS = [
  'readCommandByte', 'pushShiftRegister', 'setChannelPwm', 'setChannelPower', 'initMotorPins', 'setWheelPower', 'stopAllWheels',
  'rotationLeverMm', 'bodyVelocityToWheelSpeeds', 'largestMagnitude', 'curvePwm', 'curveSpeed',
  'startSpeedFor', 'wheelSpeedToPwm', 'driveBody', 'driveStraightWhileSpinning', 'spinInPlace', 'parseThreeInts', 'saveMotion', 'loadMotion',
];
const CONSTANTS = [
  'FIRMWARE_VERSION', 'BLUETOOTH_RX_PIN', 'BLUETOOTH_TX_PIN', 'WHEELBASE_MM', 'TRACK_MM',
  'PWM_DEADBAND', 'CURVE_LOW_PWM', 'SPEED_AT_LOW_PWM', 'HALF_POWER_MM_PER_SEC', 'SPEED_AT_PWM_192', 'MAX_WHEEL_MM_PER_SEC',
  'SPIN_EFFICIENCY', 'STRAFE_EFFICIENCY', 'STRAFE_FRONT_BIAS', 'STRAFE_DIAG_BIAS', 'STRAFE_FWD_ROLL_BIAS', 'SPIN_COAST_MS', 'WHEEL_START', 'WHEEL_GAIN', 'STRAFE_START_SPEED', 'SURFACE_TAG',
  'ACCEL_MM_PER_S2', 'MOTION_DEFAULTS', 'CONTROL_TICK_MS', 'DEFAULT_SPIN_DEG_PER_SEC', 'DEMO_SPEED_MM_PER_SEC',
  'SHIFT_DATA_PIN', 'SHIFT_CLOCK_PIN', 'SHIFT_LATCH_PIN', 'SHIFT_ENABLE_PIN', 'MOTOR_CHANNELS', 'wheelWiring',
  'MOTION_EEPROM_ADDRESS', 'MOTION_MAGIC', 'MOTION_LAYOUT',
];

function codeOnly(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

// The function's whole text: its signature up to the matching closing brace.
function functionText(source, name) {
  const match = new RegExp('^[A-Za-z_][\\w ]*[\\s*&]' + name + '\\s*\\(', 'm').exec(source);
  if (!match) return null;
  let depth = 0;
  for (let i = source.indexOf('{', match.index); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(match.index, i + 1);
  }
  return null;
}

// A #define, a one-line const, a const array / struct table, or the enum.
function constantText(source, name) {
  const define = new RegExp('^#define ' + name + '\\b.*(\\\\\\n.*)*', 'm').exec(source);
  if (define) return define[0];
  const declaration = new RegExp('^[^\\n/]*\\b' + name + '(\\[[^\\]]*\\])*\\s*=', 'm').exec(source);
  if (!declaration) return null;
  const end = source.indexOf(';', declaration.index);
  return source.slice(declaration.index, end + 1);
}

// executeTimedBodyMotion: calibration's runs without the gyro, so only the
// speed scaling and the ramp maths must match.
function engineParts(source) {
  const body = functionText(source, 'executeTimedBodyMotion') || '';
  const scaling = body.slice(body.indexOf('float peak = 0;'), body.indexOf('float k = k0, s = 0;'));
  const ramp = (/float rampPerSec[^;]*;/.exec(body) || [''])[0] + (/k = min\(k \+ rampPerSec[^;]*;/.exec(body) || [''])[0];
  const step = (/s \+= k \* \(CONTROL_TICK_MS[^;]*;/.exec(body) || [''])[0];
  return [scaling, ramp, step].join('\n');
}

const failures = [];
const motionEnum = (source) => (/enum \{ M_DEADBAND[\s\S]*?\};/.exec(source) || [null])[0];
OTHERS.forEach((other) => {
  function compare(kind, name, a, b) {
    if (a === null || b === null) {
      failures.push(kind + ' ' + name + ': missing in ' + (a === null ? 'mecanum_holonomic.ino' : other.name));
    } else if (codeOnly(a) !== codeOnly(b)) {
      failures.push(kind + ' ' + name + ' differs in ' + other.name);
    }
  }
  FUNCTIONS.forEach((name) => compare('function', name, functionText(robot, name), functionText(other.text, name)));
  CONSTANTS.forEach((name) => compare('constant', name, constantText(robot, name), constantText(other.text, name)));
  compare('move engine', 'executeTimedBodyMotion (scaling and ramps)', engineParts(robot), engineParts(other.text));
  compare('enum', 'M_ (motion number order)', motionEnum(robot), motionEnum(other.text));
});

// The version in each sketch's first comment line must match its FIRMWARE_VERSION
[{ name: 'mecanum_holonomic.ino', text: robot }].concat(OTHERS).forEach((sketch) => {
  const fw = (sketch.text.match(/#define FIRMWARE_VERSION "([^"]+)"/) || [])[1];
  const header = (sketch.text.split('\n')[0].match(/\(v(\d+\.\d+\.\d+)/) || [])[1];
  if (fw !== header) failures.push(sketch.name + ': first line says v' + header + ', FIRMWARE_VERSION is ' + fw);
});

// ir.ino and programming.ino: every function both define, and every one-line constant both have
const irSketch = OTHERS.find((o) => o.name === 'ir.ino').text;
const programmingSketch = OTHERS.find((o) => o.name === 'programming.ino').text;
const functionNames = (source) => (source.match(/^[A-Za-z_][\w ]*[\s*&](\w+)\s*\([^;{]*\)\s*(?:override\s*)?\{/gm) || [])
  .map((signature) => /(\w+)\s*\(/.exec(signature)[1]);
const constantNames = (source) => (source.match(/^const [\w ]+?\b([A-Z][A-Z0-9_]+)(\[[^\]]*\])*\s*(PROGMEM\s*)?=/gm) || [])
  .map((line) => /\b([A-Z][A-Z0-9_]+)(\[[^\]]*\])*\s*(PROGMEM\s*)?=/.exec(line)[1]);
const inBoth = (a, b) => a.filter((name, i) => a.indexOf(name) === i && b.includes(name));
const pairFunctions = inBoth(functionNames(irSketch), functionNames(programmingSketch)).filter((name) => !IR_VS_PROGRAMMING_DIFFERENT.includes(name));
const pairConstants = inBoth(constantNames(irSketch), constantNames(programmingSketch));
pairFunctions.forEach((name) => {
  if (codeOnly(functionText(irSketch, name) || '') !== codeOnly(functionText(programmingSketch, name) || 'x')) failures.push('function ' + name + ' differs between ir.ino and programming.ino');
});
// (a "const ... NAME ... = ...;" line or table, PROGMEM ones included: from its line to the first ;)
const pairConstantText = (source, name) => {
  const start = new RegExp('^const [\\w ]+?\\b' + name + '(\\[[^\\]]*\\])*\\s*(PROGMEM\\s*)?=', 'm').exec(source);
  return start ? source.slice(start.index, source.indexOf(';', start.index) + 1) : null;
};
pairConstants.forEach((name) => {
  if (codeOnly(pairConstantText(irSketch, name) || '') !== codeOnly(pairConstantText(programmingSketch, name) || 'x')) failures.push('constant ' + name + ' differs between ir.ino and programming.ino');
});
IR_VS_PROGRAMMING_DIFFERENT.forEach((name) => {
  if (!functionText(irSketch, name) || !functionText(programmingSketch, name)) failures.push('function ' + name + ' (listed as different on purpose) is missing in ir.ino or programming.ino');
});
if (pairFunctions.length < 60) failures.push('only ' + pairFunctions.length + ' functions found in both ir.ino and programming.ino (the function finder is broken?)');

if (failures.length) {
  console.log('mecanum_holonomic.ino and the other sketches disagree:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('shared code matches in calibration.ino, ir.ino and programming.ino: ' + FUNCTIONS.length + ' functions, ' + CONSTANTS.length + ' constants, the move engine, the motion order');
console.log('ir.ino and programming.ino: ' + pairFunctions.length + ' functions and ' + pairConstants.length + ' constants in both are identical (' + IR_VS_PROGRAMMING_DIFFERENT.length + ' functions differ on purpose)');

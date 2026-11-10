// programming.ino   (v0.10.87 - the mecanum robot programmed from the kit's IR remote AND over
//                    Bluetooth: drive it from a phone, write a program on a computer and send
//                    it to the robot; L293D shield, Bluetooth on A0/A1 as shipped, IR receiver
//                    on IR_RECEIVER_PIN, light sensors on A4/A5)
//
// This is ir.ino for a class whose robots are already calibrated: the same
// remote driving and programming, the same light modes, the same commands
// over USB and Bluetooth. What is gone: the nine built-in demo programs (an
// empty slot is empty) and the # # # calibration from the remote. The motion
// numbers saved on the robot (by ir.ino's # # #, the Calibrate page or
// calibration.ino) are still read at start and used: uploading this sketch
// keeps them. The code it shares with the other sketches must stay identical:
// node scripts/check-mecanum-shared.js.
//
// BLUETOOTH (the kit's HC-05/HC-06 module, 9600 baud; pair it, then connect)
//   Drive from a phone: the Sticks page sends v<f>,<r>,<s>; several times a
//   second (below). Program on a computer: the Blocks page runs a program
//   live (it sends m moves one at a time) or stores it in a slot with
//   p<n>=<steps>; so it runs from the remote (* <n>) or with p<n>; with no
//   computer near. A full slot line is 100 bytes: it arrives whole (loop()).
//   One command at a time: the module cannot listen while the robot answers.
//   That goes for x (stop) too: sent while the robot is saying "step 3: ..."
//   it is lost, so the pages send x three times, a moment apart.
//
// THE REMOTE (the kit's 17-key remote: arrows, OK, 0-9, * and #)
//   hold an arrow     drive that way (up forward, down back, left/right slide)
//   hold 1 / 3        turn left / right in place
//   0 or OK           stop
//   * * *             program mode: the robot wiggles and listens
//   * * * * <1-9>     add to the program in that slot: wiggle + nod, its steps are
//                     loaded, then add steps as usual (the 4th * must come within 2 s)
//     * <arrow or 1/3> <digits>   a step: how far in cm (1/3: how many degrees);
//                                 no digits = 25 cm / 90 degrees. The next * ends it.
//     * 7 <cm>  * 9 <cm>          diagonal forward-left / forward-right
//     * 5 <seconds>               pause (no digits = 1 s)
//     * 8 <times>                 repeat, that many times in all (no digits = 2). AFTER some steps:
//                                 do them again (a second 8 repeats only what came after the first).
//                                 BEFORE any steps (first, or right after another 8): repeat the
//                                 steps that FOLLOW, up to the next 8 or the end
//     * 0 <cm across>             a circle that wide, one lap, nose pointed at the middle (no digits = 1 m)
//     * 2 <1-9>                   run the program saved in that slot here, then carry on (0.10.86);
//                                 an empty slot is skipped. Programs can run programs, 3 deep
//     * * *           done: the robot wiggles and waits for a slot number 1-9
//     <1-9> * *       saved in that slot (nod)
//     OK (after * * *)   try the program now without saving
//   * <1-9>           run the program in that slot (any key stops it). An empty slot: "no"
//   * 0               program 0: a circle 1 m across, facing in (always this)
//   #                 cancel / stop, anywhere
//   # # 1             follow the light: two LDRs (A4 left, A5 right) steer it toward a flashlight
//   # # 2             run from the light: it backs away from a flashlight, nose turned to watch it
//                     (either one: any key stops it; with no light it waits)
//                     With USE_LIGHT_BACK 1 a third LDR on A3 looks behind: a light there makes it
//                     back straight at it (follow) or run forward (run away), steering by
//                     whatever spill the front LDRs catch
//                     Both start with a calibration (no time limit): the flashlight on one LDR,
//                     nothing, the other (either side first): a tick for each shine, then a nod
//                     and it goes. An LDR that barely changes next to the other: "no", shine
//                     on that one again. OK skips (last gains).
//   flashlight flashed on the left LDR, right, left, right within 5 s: the same as # # 1 with
//                     the shines done (it nods and goes)
//
// COMMANDS (USB or Bluetooth, 9600 baud)
//   i<keys>;       press remote keys: U D L R O(k) * # 0-9, e.g. i***;  iU50*;  i*5;
//   p<n>;          run slot n       p?;   list the slots (P,<n>,<steps>)
//   p<n>=<steps>;  store steps in slot n: f/b/l/r<cm> t<deg> (t-90 = left) q/e<cm> diagonals
//                  p<s> pause n<times> repeat (after its steps, or before them), e.g. p3=f50 t90 n4;
//                  g<slot> run the program in that slot, then carry on, e.g. p9=g1 f20 g1;
//                  p<n>=;  empties the slot
//   u              one sonar reading (U,<mm>, -1 = nothing within ~4 m)
//   b              one light reading: B,<direction>,<brightest>,<left>,<right>[,<back>]
//                  (0..1000, brighter = higher; the Blocks page's bs reads it too)
//   v<f>,<r>,<s>;  keep driving forward / right / clockwise at -100..100 % of full
//                  speed (the Blocks page's keep-driving and the two-stick controller);
//                  stops unless repeated within VECTOR_TIMEOUT_MS. No reply. The sonar
//                  zeroes the forward part when something is ahead.
//   m<bearing>,<mm>,<turn>;  a move exactly as mecanum_holonomic drives it
//   k?;  km<i>=<v>;  kw;  kd;  kN<name>;   the motion numbers and the Bluetooth name (as calibration.ino);
//                  k? also answers K,name,<name>, and the boot lines include ir: name <name>
//   x              stop        ?  this list
// Every remote key the robot hears is echoed as "ir: <key>", so the phone can
// watch what a kid presses.
// ---------------------------------------------------------------------------

#include <Arduino.h>
#include <avr/eeprom.h>

#define FIRMWARE_VERSION "0.10.87"   // same line as mecanum_holonomic (bump both together)
#define SKETCH_NAME "programming"

// A program step (the IR sketch's own): which way, and how far / how many degrees
enum StepDirection { S_FORWARD, S_BACK, S_LEFT, S_RIGHT, S_TURN_LEFT, S_TURN_RIGHT, S_DIAG_LEFT, S_DIAG_RIGHT, S_WAIT, S_REPEAT, S_CIRCLE, S_CALL };
struct Step {
  byte dir;          // StepDirection
  uint16_t amount;   // cm, or degrees for turns
};
bool movingForward = false;   // the current move goes forward: the sonar may stop it

// ===========================================================================
// CONFIG - Bluetooth (classic SPP module on SoftwareSerial, as shipped)
// ===========================================================================
#define USE_BLUETOOTH_SOFTSERIAL 1
const byte BLUETOOTH_RX_PIN = A0;   // module TXD -> this pin
const byte BLUETOOTH_TX_PIN = A1;   // this pin -> module RXD

#if USE_BLUETOOTH_SOFTSERIAL
#include <SoftwareSerial.h>
SoftwareSerial bluetoothSerial(BLUETOOTH_RX_PIN, BLUETOOTH_TX_PIN);
#endif

// Everything the sketch says goes to USB and, when compiled in, to the
// Bluetooth module too, so the phone hears replies however it connected. The
// Bluetooth bytes wait in a buffer and go out when the IR line is quiet
// (btFlush, below): SoftwareSerial turns interrupts off for every byte it
// sends, and a remote key arriving then would be lost.
void btEnqueue(uint8_t c);
class DualPrint : public Print {
 public:
  size_t write(uint8_t c) override {
    Serial.write(c);
#if USE_BLUETOOTH_SOFTSERIAL
    btEnqueue(c);
#endif
    return 1;
  }
};
DualPrint out;

// Next command byte from either port, or -1.
int readCommandByte() {
  if (Serial.available()) return Serial.read();
#if USE_BLUETOOTH_SOFTSERIAL
  if (bluetoothSerial.available()) return bluetoothSerial.read();
#endif
  return -1;
}

// ===========================================================================
// CONFIG - geometry
// ===========================================================================
const float WHEELBASE_MM      = 150.0;  // front axle centre to rear axle centre
const float TRACK_MM          = 130.0;  // left wheel centre to right wheel centre

// ===========================================================================
// CONFIG - IR remote receiver (VS1838B / HX1838 / KY-022: OUT, VCC 5V, GND)
// ===========================================================================
// Any pin works: the decoder samples the pin from a Timer1 tick (every 100 us)
// instead of a pin interrupt, because SoftwareSerial (the Bluetooth module)
// owns every pin-change interrupt. 10 is the signal pin of the shield's SER1
// servo header: the receiver plugs in, no soldering. (The servo headers'
// hardware PWM is lost; nothing here uses it.)
const byte IR_RECEIVER_PIN = 10;
const unsigned long IR_RELEASE_MS = 250;        // the remote repeats every 108 ms while held
const unsigned long IR_STAR_TIMEOUT_MS = 5000;  // a lone * (or # #) is forgotten after this; 3 s was too short for kids

// ===========================================================================
// CONFIG - HC-SR04 sonar (A3 trig / A2 echo as shipped): a stop, nothing more
// ===========================================================================
// The sonar is on (since 0.10.87, for the Blocks "if" lessons): Echo A2, Trig A3.
// USE_LIGHT_BACK 1 puts a third LDR on A3 looking straight back instead (see
// CONFIG - light sensors); A3 is the sonar's Trig, so that turns the sonar off.
#define USE_LIGHT_BACK 0
#define USE_SONAR (!USE_LIGHT_BACK)
const byte SONAR_ECHO_PIN = A2;
const byte SONAR_TRIG_PIN = A3;
const int SONAR_STOP_MM = 250;                  // anything nearer ahead stops the robot
const bool SONAR_STOPS_EVERYTHING = false;      // false: only forward motion (so it can back away); true: every move
const unsigned long SONAR_PERIOD_MS = 60;       // how often it looks while moving
const unsigned long SONAR_TIMEOUT_US = 25000;   // round trip, ~4.3 m (the u reading)

// ===========================================================================
// CONFIG - light sensors: two LDRs at the front corners (# # 1 / # # 2)
// ===========================================================================
// Each LDR makes a divider with a fixed resistor (4.7k for a GL5537). The
// class builds them on servo extension cables: 5V - resistor - pin - LDR - GND,
// so the pin reads LOWER in brighter light and lightRead() flips it
// (LIGHT_BRIGHT_READS_HIGH false, since 0.10.83; the other way round, LDR to
// 5V and resistor to GND, reads higher: set it true). Everything above
// lightRead() sees "brighter = higher". A4 / A5 are free here, so the sonar
// stays on A2 / A3 and still stops the robot short of whoever holds the torch.
// The robot compares each LDR with the room's own light (it keeps learning
// that while it sees no torch), so two LDRs that read a bit differently are fine.
const byte LIGHT_LEFT_PIN = A4;                 // front left corner, looking 45 degrees left
const byte LIGHT_RIGHT_PIN = A5;                // front right corner, looking 45 degrees right
const byte LIGHT_BACK_PIN = A3;                 // with USE_LIGHT_BACK 1: middle of the back, looking straight back
const float LIGHT_BACK_SPIN_SHARE = 1.0;        // backing toward (or running from) a light behind: how hard the
                                                // front LDRs' spill steers the tail at it (0 = straight back)
const bool LIGHT_BRIGHT_READS_HIGH = false;      // resistor to 5V, LDR to GND (the fleet's cable build)
const int LIGHT_SEEN = 40;                      // this much over the room's light = a torch
const unsigned int LIGHT_LOST_MS = 300;         // under half of that for this long = lost it
const float LIGHT_SPEED_MM_PER_SEC = 400.0;     // straight at it (or away)
const float LIGHT_SPIN_RAD_PER_SEC = 2.5;       // turning when the light is all on one side
const unsigned long LIGHT_TICK_MS = 20;
// Flash start: with the robot idle, a torch flashed on the left LDR, the right,
// the left, the right (or starting on the right), all within the window, starts
// following, the same as # # 1. Each hit must be strong, on one LDR only, and
// held a moment, so a robot with no LDRs (floating pins) does not start by itself.
const bool LIGHT_FLASH_START = true;
const int LIGHT_FLASH_MIN = 120;                // a hit: this much over the room's light
const unsigned int LIGHT_FLASH_HOLD_MS = 60;    // ... for at least this long
const unsigned long LIGHT_FLASH_WINDOW_MS = 5000;
// Calibration at every start (# # 1, # # 2): the flashlight on one LDR,
// nothing, the other (either side first): a twitch for each shine, then a nod
// and it drives. Each LDR gets a gain from its own shine so the two read the
// same (mismatched or one-sided LDRs). A side much weaker than the other (its
// gain would hit the limit) gets a slow "no" and one more shine on that side
// only, then it goes with what it has. The flash start's four hits are the two
// shines already. No time limit; OK skips it (keeps the last gains), any other
// key stops. While it waits the room's light only creeps (the slow rate below),
// so a flashlight brought in slowly still counts in full.
const int LIGHT_CAL_HIT = 30;                   // a shine: this much over the room's light, on that LDR mostly
const float LIGHT_GAIN_LIMIT = 4.0;             // gains stay within 1/4 .. 4; a side under 1/4 of the other is "weak"
// While it sees the light, the room's light still creeps toward the reading
// over about this many ticks (8 s), so a brighter floor stops counting as the
// flashlight. 0 = frozen while it sees the light (before 0.10.81).
const int LIGHT_ROOM_CATCHUP_TICKS = 400;

// ===========================================================================
// CONFIG - programs and gestures
// ===========================================================================
const byte PROGRAM_SLOTS = 9;                   // * 1 .. * 9
const byte PROGRAM_MAX_STEPS = 16;
const int DEFAULT_STEP_CM = 25;                 // a step with no digits
const int DEFAULT_TURN_DEG = 90;
const int DEFAULT_WAIT_S = 1;
const int DEFAULT_REPEAT_TIMES = 2;
const int DEFAULT_CIRCLE_CM = 100;             // across; * 0 on its own is this circle
const unsigned long STEP_PAUSE_MS = 300;        // breath between steps
const int GESTURE_PWM_OVER_START = 30;          // gesture power: this much over the start power
const unsigned int GESTURE_TWITCH_MS = 70;      // one wiggle / nod twitch
const unsigned int GESTURE_SLOW_MS = 180;       // one head-shake swing

// Programs in EEPROM: 9 slots x 34 bytes at 600..905, before the motion
// numbers at 920 (mecanum_holonomic's sensor settings live at 0 and 400).
const int PROGRAM_EEPROM_ADDRESS = 600;
const byte PROGRAM_MAGIC = 0xA8;   // A8 (0.10.76): 4-bit step kinds (diagonals, pause, repeat)
const byte PROGRAM_SLOT_BYTES = 2 + 2 * PROGRAM_MAX_STEPS;


// ===========================================================================
// CONFIG - motion numbers: the numbers every sketch drives on (the same as
// mecanum_holonomic.ino and calibration.ino: calibrating changes all three).
// ===========================================================================
const int PWM_DEADBAND = 84;                   // one under CURVE_LOW_PWM: anything below is "off"
const int CURVE_LOW_PWM = 85;                  // start power: the highest any robot needs (robot 1: 78 on tired batteries, robot 2: 85, 2026-10-07)
const float SPEED_AT_LOW_PWM = 335.0;         // at CURVE_LOW_PWM 85, robot 2 on fresh batteries, 2026-10-07: 650 mm in 2 s, 1320 in 4 s (robot 1 at 78, tired batteries: 249)
const float HALF_POWER_MM_PER_SEC = 480.0;     // speed at PWM 128 (robot 2, fresh batteries, 2026-10-07; robot 1 tired: 360)
const float SPEED_AT_PWM_192 = 600.0;          // (robot 1 tired: 505)
const float MAX_WHEEL_MM_PER_SEC = 690.0;      // speed at PWM 255 (robot 1 tired: 590)
const float SPIN_EFFICIENCY = 0.612;          // robot 2, 2026-10-07, fit of 0.607 +10, 0.610 +15, 0.614 -7, 0.624 -15: the turn repeats to about +-15 deg, so this is as good as it gets (robot 1: 0.705)
const float STRAFE_EFFICIENCY = 0.540;        // measured 2026-10-07: a 1 m slide went 1200 mm with 0.45
// Sliding sideways, the front wheels get this much MORE of the sideways wheel
// speed and the back this much less (0.064: front 1.064 x, back 0.936 x). The
// back wheels carry more weight and grip the floor better sideways, so with
// equal speeds a slide bends forward and the robot twists; this evens the
// sideways push front to back. Only sliding uses it. Measured 2026-10-07: a
// 1 m slide ended 300 mm ahead with 0.
const float STRAFE_FRONT_BIAS = 0.065;        // robot 2, 2026-10-07: 0.017 twisted left 45 deg (robot 1 held its heading at 0.017)
// Sliding, a stronger diagonal pair creeps the robot forward or back (no
// twist). Two slide-only shares: STRAFE_DIAG_BIAS takes from the FL+RR pair
// and gives to FR+RL (0.1: FL and RR 0.9 x, FR and RL 1.1 x), whichever way
// it slides; STRAFE_FWD_ROLL_BIAS takes from the pair rolling FORWARD and
// gives to the pair rolling backwards (motors weaker in reverse). The
// calibration page's step 10 sets them from a right and a left slide.
const float STRAFE_DIAG_BIAS = 0.34;          // robot 2, 2026-10-07: creep 650 at 0, 450 at 0.237 (heading held). The most the share can do: beyond this the slow pair hits the slide start speed. (Robot 1: 0.101 twisted the slides badly)
const float STRAFE_FWD_ROLL_BIAS = 0.0;       // (0.039 from the same slides, taken out with it)
const long SPIN_COAST_MS = -46;               // robot 2, hard stop, 2026-10-07: a 1 m move went ~1070 with -255 (negative: the motors run late at the start speed)
constexpr float WHEEL_START[4] = { 0, 0, 0, 0 };
constexpr float WHEEL_GAIN[4] = { 1, 1, 1, 1 };
const float STRAFE_START_SPEED = SPEED_AT_LOW_PWM;
const float ACCEL_MM_PER_S2 = 1500;            // moves speed up from the start speed at this (mm/s per second)
const byte SURFACE_TAG = 0;
enum { M_DEADBAND, M_LOW_PWM, M_LOW_SPEED, M_HALF, M_192, M_MAX, M_SPIN_EFF, M_STRAFE_EFF, M_COAST, M_TAG,
       M_GAIN0, M_START0 = M_GAIN0 + 4, M_STRAFE_START = M_START0 + 4, M_ACCEL, M_FRONT_BIAS, M_DIAG_BIAS, M_FWD_ROLL_BIAS, M_COUNT };
#define MOTION_DEFAULTS { PWM_DEADBAND, CURVE_LOW_PWM, SPEED_AT_LOW_PWM, HALF_POWER_MM_PER_SEC, SPEED_AT_PWM_192, \
  MAX_WHEEL_MM_PER_SEC, SPIN_EFFICIENCY, STRAFE_EFFICIENCY, SPIN_COAST_MS, SURFACE_TAG, \
  WHEEL_GAIN[0], WHEEL_GAIN[1], WHEEL_GAIN[2], WHEEL_GAIN[3], WHEEL_START[0], WHEEL_START[1], WHEEL_START[2], WHEEL_START[3], STRAFE_START_SPEED, \
  ACCEL_MM_PER_S2, STRAFE_FRONT_BIAS, STRAFE_DIAG_BIAS, STRAFE_FWD_ROLL_BIAS }
// The numbers the robot drives on: the constants above, unless a set saved
// on the robot (kw) overrides them. km<i>=<value>; changes one live, kw saves
// them all to EEPROM (mecanum_holonomic reads the same place), kd goes back
// to the code's numbers and forgets the saved ones.
float motion[M_COUNT] = MOTION_DEFAULTS;
const float MOTION_DEFAULT_VALUES[M_COUNT] PROGMEM = MOTION_DEFAULTS;

const unsigned long CONTROL_TICK_MS    = 20;      // update rate for time-varying moves
const float DEFAULT_SPIN_DEG_PER_SEC   = 90.0;    // turns in place (m with mm 0)
const float DEMO_SPEED_MM_PER_SEC      = 480.0;   // m moves: the program speed (half power, well off the stall edge)
const unsigned long VECTOR_TIMEOUT_MS  = 500;     // v stops unless repeated within this

// ===========================================================================
// MOTOR SHIELD (L293D, Adafruit Motor Shield v1 layout)
// ===========================================================================
//   shift register:  DATA 8   CLOCK 4   LATCH 12   ENABLE 7 (active LOW)
//   speed PWM:       M1 11    M2 3      M3 6       M4 5
const byte SHIFT_DATA_PIN   = 8;
const byte SHIFT_CLOCK_PIN  = 4;
const byte SHIFT_LATCH_PIN  = 12;
const byte SHIFT_ENABLE_PIN = 7;

struct MotorChannel {
  byte pwmPin;
  byte forwardBit;   // 74HC595 output driven HIGH to run this channel "forward"
  byte reverseBit;   // 74HC595 output driven HIGH to run it the other way
};

// Shield channels M1..M4 in that order. Fixed by the shield; do not edit.
const MotorChannel MOTOR_CHANNELS[4] = {
  { 11, 2, 3 },   // M1
  {  3, 1, 4 },   // M2
  {  6, 5, 7 },   // M3
  {  5, 0, 6 }    // M4
};

// Which shield channel drives which corner (wheel order FL FR RL RR), and
// whether that motor is wired backwards. t0..t3 twitch each channel to check.
struct WheelWiring {
  byte channel;    // 0 = M1, 1 = M2, 2 = M3, 3 = M4
  bool inverted;   // true if the wheel rolls BACKWARDS when asked for forward
};

WheelWiring wheelWiring[4] = {
  { 3, false },   // 0 FL  <- M4
  { 2, false },   // 1 FR  <- M3
  { 0, false },   // 2 RL  <- M1
  { 1, false }    // 3 RR  <- M2
};

int lastWheelPwm[4] = { 0, 0, 0, 0 };   // for telemetry / host tests
byte shiftRegisterState = 0;

void pushShiftRegister() {
  digitalWrite(SHIFT_LATCH_PIN, LOW);
  shiftOut(SHIFT_DATA_PIN, SHIFT_CLOCK_PIN, MSBFIRST, shiftRegisterState);
  digitalWrite(SHIFT_LATCH_PIN, HIGH);
}

// PWM straight on the timer compare registers of the shield's four speed
// pins: M1 11 = OC2A, M2 3 = OC2B (Timer2), M3 6 = OC0A, M4 5 = OC0B
// (Timer0). Duty 0 disconnects the pin; 255 is a constant HIGH.
void setChannelPwm(byte channelIndex, byte duty) {
  volatile uint8_t *control = channelIndex < 2 ? &TCCR2A : &TCCR0A;
  byte connect = (channelIndex & 1) ? _BV(COM2B1) : _BV(COM2A1);   // same bits in TCCR0A
  switch (channelIndex) {
    case 0: OCR2A = duty; break;
    case 1: OCR2B = duty; break;
    case 2: OCR0A = duty; break;
    default: OCR0B = duty; break;
  }
  if (duty) *control |= connect;
  else *control &= ~connect;
}

// Raw access by shield channel, bypassing the wiring table.
void setChannelPower(int channelIndex, int power) {
  const MotorChannel &channel = MOTOR_CHANNELS[channelIndex];
  bitWrite(shiftRegisterState, channel.forwardBit, power > 0);
  bitWrite(shiftRegisterState, channel.reverseBit, power < 0);
  pushShiftRegister();
  setChannelPwm(channelIndex, abs(power));
}

void initMotorPins() {
  pinMode(SHIFT_DATA_PIN, OUTPUT);
  pinMode(SHIFT_CLOCK_PIN, OUTPUT);
  pinMode(SHIFT_LATCH_PIN, OUTPUT);
  pinMode(SHIFT_ENABLE_PIN, OUTPUT);
  digitalWrite(SHIFT_ENABLE_PIN, HIGH);   // outputs off while we clear the register
  shiftRegisterState = 0;
  pushShiftRegister();
  for (int channelIndex = 0; channelIndex < 4; channelIndex++) {
    digitalWrite(MOTOR_CHANNELS[channelIndex].pwmPin, LOW);
    pinMode(MOTOR_CHANNELS[channelIndex].pwmPin, OUTPUT);
    setChannelPwm(channelIndex, 0);
  }
  digitalWrite(SHIFT_ENABLE_PIN, LOW);    // active low: outputs on
}

// power: -255..255, positive = wheel rolls the robot FORWARD.
void setWheelPower(int wheelIndex, int power) {
  power = constrain(power, -255, 255);
  lastWheelPwm[wheelIndex] = power;
  if (wheelWiring[wheelIndex].inverted) {
    power = -power;
  }
  setChannelPower(wheelWiring[wheelIndex].channel, power);
}

void stopAllWheels() {
  for (int wheelIndex = 0; wheelIndex < 4; wheelIndex++) {
    setWheelPower(wheelIndex, 0);
  }
}

// ===========================================================================
// EEPROM: the motion numbers (the same place and layout as mecanum_holonomic:
// a 2-byte mark, a layout number, then the numbers) and the Bluetooth name
// ===========================================================================
const int MOTION_EEPROM_ADDRESS = 920;
const uint16_t MOTION_MAGIC = 0x4D43;
const byte MOTION_LAYOUT = 4;   // 4 (0.10.72): the three slide shares after the acceleration
bool motionFromEeprom = false;

void saveMotion() {
  eeprom_update_word((uint16_t *)MOTION_EEPROM_ADDRESS, MOTION_MAGIC);
  eeprom_update_byte((uint8_t *)(MOTION_EEPROM_ADDRESS + 2), MOTION_LAYOUT);
  eeprom_update_block(motion, (void *)(MOTION_EEPROM_ADDRESS + 3), sizeof(motion));
  motionFromEeprom = true;
}

void loadMotion() {
  byte layout = eeprom_read_byte((const uint8_t *)(MOTION_EEPROM_ADDRESS + 2));
  motionFromEeprom = eeprom_read_word((const uint16_t *)MOTION_EEPROM_ADDRESS) == MOTION_MAGIC && layout >= 1 && layout <= MOTION_LAYOUT;
  if (motionFromEeprom) {
    // Older layouts are shorter: what they lack keeps its default.
    eeprom_read_block(motion, (const void *)(MOTION_EEPROM_ADDRESS + 3),
                      (layout == 1 ? M_STRAFE_START : layout == 2 ? M_ACCEL : layout == 3 ? M_FRONT_BIAS : M_COUNT) * sizeof(float));
    if (layout == 1) motion[M_STRAFE_START] = motion[M_LOW_SPEED];
  }
}

// Bluetooth name (kN): given to the module at the next start-up
const int BT_NAME_EEPROM_ADDRESS = 1040;   // after the motion numbers (920 + 3 + 23 x 4 = 1015)
const byte BT_NAME_PENDING = 0x5A;

// A name saved with kN: tell the module before anything connects (modules
// only take AT commands while unpaired), and forget it either way. The kit's
// module is a classic HC-06: AT+NAME<name> with NO line end (a line end would
// become part of the name), answer OKsetname. Then, for other firmware, the
// newer HC-06 AT+NAME=<name> and the BLE modules' AT+NAME<name>, both with a
// line end. Between tries a line end and a pause clear what the module made of
// the last one (an ERROR has an O in it too). (write, not print: print would
// pull Print's code in for this port alone.)
void btSend(const char *text, bool fromFlash) {
  char c;
  while ((c = fromFlash ? pgm_read_byte(text) : *text)) {
    bluetoothSerial.write(c);
    text++;
  }
}

// The robot's name: the Bluetooth name last saved with kN (the rename and
// calibration pages). The pending flag is cleared once the module has it; the
// letters stay, so the robot can say who it is ("ir: name Rexy" at boot,
// K,name,Rexy on k?). Nothing printed when it was never named.
void printRobotName(const __FlashStringHelper *prefix) {
  char name[17];
  eeprom_read_block(name, (const void *)(BT_NAME_EEPROM_ADDRESS + 1), 16);
  name[16] = 0;
  if (name[0] < ' ' || name[0] > '~') return;
  for (byte i = 0; i < 16 && name[i]; i++) if (name[i] < ' ' || name[i] > '~') name[i] = 0;
  out.print(prefix);
  out.println(name);
}

// Send an AT command and collect the answer (the HC-06 answers after ~1 s).
byte btAsk(const char *command, const char *argument, char *reply, byte size) {
  while (bluetoothSerial.read() >= 0) {}
  btSend(command, true);
  if (argument) btSend(argument, false);
  byte length = 0;
  for (unsigned long t = millis(); millis() - t < 1500;) {
    int c = bluetoothSerial.read();
    if (c >= ' ' && c <= '~' && length < size - 1) reply[length++] = c;
  }
  reply[length] = 0;
  return length;
}

void bluetoothStartUp() {
  delay(500);   // the module boots too
  char reply[24];
  Serial.print(F("bt module: "));
  Serial.println(btAsk(PSTR("AT+VERSION"), NULL, reply, sizeof(reply)) ? reply : "no answer (something is connected to it)");
  if (eeprom_read_byte((const uint8_t *)BT_NAME_EEPROM_ADDRESS) != BT_NAME_PENDING) return;
  char name[17];
  eeprom_read_block(name, (const void *)(BT_NAME_EEPROM_ADDRESS + 1), 17);
  name[16] = 0;
  eeprom_update_byte((uint8_t *)BT_NAME_EEPROM_ADDRESS, 0);   // once, either way
  bool ok = btAsk(PSTR("AT+NAME"), name, reply, sizeof(reply)) && strstr(reply, "OK");
  out.print(F("bt name: "));
  out.print(name);
  out.println(ok ? F(" - set") : F(" - the module did not answer"));
}

// ===========================================================================
// KINEMATICS AND MOVES (the same as mecanum_holonomic's)
// ===========================================================================
float rotationLeverMm() {
  return (WHEELBASE_MM + TRACK_MM) / 2.0;
}

// ===========================================================================
// KINEMATICS - body velocity -> four wheel speeds (mm/s at the wheel rim)
// (the same as mecanum_holonomic's)
// ===========================================================================
void bodyVelocityToWheelSpeeds(float forwardMmPerSec, float rightMmPerSec,
                               float clockwiseRadPerSec, float wheelSpeeds[4]) {
  float strafe = rightMmPerSec / motion[M_STRAFE_EFF];
  float front  = strafe * (1 + motion[M_FRONT_BIAS]);   // the front wheels' share of the sideways speed
  float back   = strafe * (1 - motion[M_FRONT_BIAS]);
  // Sliding right, FL and RR roll forward and FR and RL backwards; left, the
  // other way round. roll: + when FL and RR are the forward-rolling pair.
  float roll   = rightMmPerSec >= 0 ? motion[M_FWD_ROLL_BIAS] : -motion[M_FWD_ROLL_BIAS];
  float diagFLRR = 1 - motion[M_DIAG_BIAS] - roll;
  float diagFRRL = 1 + motion[M_DIAG_BIAS] + roll;
  float spin   = clockwiseRadPerSec * rotationLeverMm() / motion[M_SPIN_EFF];
  wheelSpeeds[0] = forwardMmPerSec + front * diagFLRR + spin;   // FL
  wheelSpeeds[1] = forwardMmPerSec - front * diagFRRL - spin;   // FR
  wheelSpeeds[2] = forwardMmPerSec - back * diagFRRL + spin;    // RL
  wheelSpeeds[3] = forwardMmPerSec + back * diagFLRR - spin;    // RR
}

float largestMagnitude(float values[4]) {
  float largest = 0;
  for (int i = 0; i < 4; i++) {
    if (fabs(values[i]) > largest) largest = fabs(values[i]);
  }
  return largest;
}

float curvePwm(byte i) { return i < 2 ? motion[i] : i * 64 - (i == 4); }
float curveSpeed(byte i) { return i ? motion[M_LOW_PWM + i] : 0; }

// The start speed for the motion being driven: the strafe one when it goes
// more sideways than forward, else the forward one (driveBody sets it).
float startSpeed = 0;
float startSpeedFor(float forward, float right) {
  return motion[fabs(right) > fabs(forward) ? M_STRAFE_START : M_LOW_SPEED];
}

int wheelSpeedToPwm(byte wheel, float mmPerSec) {
  // Nothing between off and the motors' start speed: below it they hum and
  // do not turn. Under half of it is off, the rest gets the start speed.
  float speed = fabs(mmPerSec);
  if (speed < startSpeed * 0.5) return 0;
  if (speed < startSpeed) speed = startSpeed;
  byte i = 1;
  while (i < 4 && speed > curveSpeed(i)) i++;
  float pwm = curvePwm(i - 1) + (speed - curveSpeed(i - 1)) / (curveSpeed(i) - curveSpeed(i - 1)) * (curvePwm(i) - curvePwm(i - 1));
  // This wheel's own start and strength.
  pwm += motion[M_START0 + wheel] + (pwm - motion[M_DEADBAND]) * (motion[M_GAIN0 + wheel] - 1);
  int magnitude = (int)constrain(pwm + 0.5, 0, 255);
  return (mmPerSec < 0) ? -magnitude : magnitude;
}

// Drive the body at the requested velocity. If a wheel would need more than
// MAX_WHEEL_MM_PER_SEC, ALL four are scaled down together so the motion shape
// is preserved (it just happens slower). Returns the scale applied (<= 1).
float driveBody(float forwardMmPerSec, float rightMmPerSec, float clockwiseRadPerSec) {
  float wheelSpeeds[4];
  bodyVelocityToWheelSpeeds(forwardMmPerSec, rightMmPerSec, clockwiseRadPerSec, wheelSpeeds);
  startSpeed = startSpeedFor(forwardMmPerSec, rightMmPerSec);
  float scale = 1.0;
  float peak = largestMagnitude(wheelSpeeds);
  if (peak > motion[M_MAX]) {
    scale = motion[M_MAX] / peak;
  }
  for (int wheelIndex = 0; wheelIndex < 4; wheelIndex++) {
    setWheelPower(wheelIndex, wheelSpeedToPwm(wheelIndex, wheelSpeeds[wheelIndex] * scale));
  }
  return scale;
}

bool abortRequested = false;   // set by 'x' arriving during any blocking move

bool checkForAbort() {
  btFlush();
  int incoming;
  while ((incoming = readCommandByte()) >= 0) {
    if (incoming == 'x' || incoming == 'X') {
      abortRequested = true;
    }
  }
  if (irTakeKey() >= 0) abortRequested = true;   // any remote key stops a move
  if ((movingForward || SONAR_STOPS_EVERYTHING) && wallAhead()) {
    abortRequested = true;
    out.println(F("stop: something ahead"));
  }
  return abortRequested;
}

float degreesToRadians(float degrees) { return degrees * PI / 180.0; }

// A straight line on a bearing while the body turns: the same speed scaling
// (never faster than the top speed, never slower than the start speed) and
// ramps as mecanum_holonomic's executeTimedBodyMotion, without the gyro.
void executeTimedBodyMotion(float v0Forward, float v0Right, float worldRotationRadPerSec,
                            float spinRadPerSec, float durationSec) {
  if (durationSec <= 0) return;
  float relativeRadPerSec = worldRotationRadPerSec - spinRadPerSec;

  float peak = 0;
  for (int sample = 0; sample <= 36; sample++) {
    float t = durationSec * sample / 36.0;
    float angle = relativeRadPerSec * t;
    float forwardNow = v0Forward * cos(angle) - v0Right * sin(angle);
    float rightNow   = v0Forward * sin(angle) + v0Right * cos(angle);
    float wheelSpeeds[4];
    bodyVelocityToWheelSpeeds(forwardNow, rightNow, spinRadPerSec, wheelSpeeds);
    float sampleMax = largestMagnitude(wheelSpeeds);
    if (sampleMax > peak) peak = sampleMax;
  }
  float least = startSpeedFor(v0Forward, v0Right);
  float scale = 1.0;
  if (peak > motion[M_MAX]) {
    scale = motion[M_MAX] / peak;
    out.println(F("move: slowing"));
  } else if (peak > 0 && peak < least) {
    // Slower than the motors can start: they would run at the start speed
    // anyway, for the whole (too long) time. Go at the start speed, for less time.
    scale = least / peak;
  }
  v0Forward         *= scale;
  v0Right           *= scale;
  spinRadPerSec     *= scale;
  relativeRadPerSec *= scale;
  durationSec       /= scale;

  // Ramps (see mecanum_holonomic): k is the share of the move's speed, s how
  // far along the move is in seconds at full speed; it speeds up at motion[M_ACCEL].
  float rampPerSec = motion[M_ACCEL] / (peak * scale);   // share of the move's speed per second
  float k0 = constrain(least / (peak * scale), 0.05, 1.0);
  float k = k0, s = 0;
  float endAt = durationSec - k0 * motion[M_COAST] / 1000.0;
  unsigned long nextTickAt = millis();

  while (s < endAt) {
    if (checkForAbort()) break;
    if (millis() >= nextTickAt) {
      nextTickAt += CONTROL_TICK_MS;
      float angle = worldRotationRadPerSec * s - spinRadPerSec * s;
      float forwardNow = v0Forward * cos(angle) - v0Right * sin(angle);
      float rightNow   = v0Forward * sin(angle) + v0Right * cos(angle);
      driveBody(k * forwardNow, k * rightNow, k * spinRadPerSec);
      s += k * (CONTROL_TICK_MS / 1000.0);
      // Up at the ramp rate to full; no ramp-down: the move runs at full
      // speed to its end and the motors cut (a hard stop).
      k = min(k + rampPerSec * (CONTROL_TICK_MS / 1000.0), 1.0);
    }
    delay(1);
  }
  stopAllWheels();
}

// Straight line on a bearing (0 = forward, 90 = right) while the body turns
// spinDegrees over the move.
void driveStraightWhileSpinning(float bearingDegrees, float distanceMm,
                                float speedMmPerSec, float spinDegrees) {
  if (speedMmPerSec <= 0 || distanceMm <= 0) return;
  float bearing = degreesToRadians(bearingDegrees);
  float durationSec = distanceMm / speedMmPerSec;
  executeTimedBodyMotion(speedMmPerSec * cos(bearing), speedMmPerSec * sin(bearing),
                         0, degreesToRadians(spinDegrees) / durationSec, durationSec);
}

// Spin about the robot's own centre. Positive = clockwise.
void spinInPlace(float degrees, float degreesPerSec) {
  if (degreesPerSec <= 0 || fabs(degrees) < 0.01) return;
  float sign = (degrees < 0) ? -1.0 : 1.0;
  float durationSec = fabs(degrees) / degreesPerSec;
  executeTimedBodyMotion(0, 0, 0, sign * degreesToRadians(degreesPerSec), durationSec);
}

// "12,-3,40" -> value[0..2] (missing ones stay 0).
void parseThreeInts(const char *text, int value[3]) {
  value[0] = value[1] = value[2] = 0;
  byte n = 0;
  bool negative = false;
  for (const char *c = text; ; c++) {
    if (*c == '-') {
      negative = true;
    } else if (*c >= '0' && *c <= '9') {
      value[n] = value[n] * 10 + (*c - '0');
    } else {
      if (negative) value[n] = -value[n];
      negative = false;
      if (!*c || ++n == 3) break;
    }
  }
}

// K,cal,<the M_ numbers in order>,<lever mm>,<e = EEPROM, d = defaults>
void printMotion() {
  out.print(F("K,cal"));
  for (byte i = 0; i < M_ACCEL; i++) {   // (M_ACCEL comes after the lever, below)
    out.print(',');
    out.print(motion[i], 3);
  }
  out.print(',');
  out.print(rotationLeverMm(), 1);
  // The rest after the lever (apps before them read 19 numbers and the lever, and stop there):
  // acceleration, then the three slide shares.
  for (byte i = M_ACCEL; i < M_COUNT; i++) {
    out.print(',');
    out.print(motion[i], 3);
  }
  out.println(motionFromEeprom ? F(",e") : F(",d"));   // e: saved on the robot, d: the code's
}

// ===========================================================================
// BLUETOOTH OUTPUT - buffered, sent while the IR line is quiet
// ===========================================================================
// The decoder's state (the Timer1 interrupt alone writes these)
volatile uint8_t *irPinRegister;
uint8_t irPinMask;
bool irLastLevel = true;
byte irBitCount = 0xFF;                   // 0xFF = waiting for a leader
uint16_t irBits = 0;                      // the last 16 bits: command, ~command
unsigned long irLastEdgeUs = 0;
// Key presses wait in a small queue (the ISR fills it, irTakeKey empties it),
// so keys pressed while the robot is busy with a gesture or a reply are kept
// in order instead of overwriting each other.
volatile byte irKeyQueue[8];
volatile byte irKeyHead = 0, irKeyTail = 0;
volatile bool irRepeatSeen = false;       // a repeat frame arrived

char btOut[256];
byte btOutHead = 0, btOutTail = 0;   // (byte indexes wrap with the 256-byte buffer)

// No IR edge for 15 ms: between frames, or nobody pressing (a held key
// repeats every 108 ms with ~40 ms of quiet between frames).
bool irQuiet() {
  noInterrupts();
  unsigned long last = irLastEdgeUs;
  interrupts();
  return micros() - last > 15000UL;
}

void btFlush() {
#if USE_BLUETOOTH_SOFTSERIAL
  while (btOutHead != btOutTail && irQuiet()) {
    bluetoothSerial.write(btOut[btOutTail++]);
  }
#endif
}

void btEnqueue(uint8_t c) {
#if USE_BLUETOOTH_SOFTSERIAL
  if ((byte)(btOutHead + 1) == btOutTail) bluetoothSerial.write(btOut[btOutTail++]);   // full: the oldest goes out now
#endif
  btOut[btOutHead++] = c;
}

// A pause that keeps the Bluetooth output flowing
void waitMs(unsigned long ms) {
  for (unsigned long t = millis(); millis() - t < ms;) {
    btFlush();
    delay(1);
  }
}

// ===========================================================================
// IR REMOTE - NEC decoder, sampling the receiver pin every 100 us from Timer1
// ===========================================================================
// The receiver's output idles high and pulls low for each burst of 38 kHz.
// NEC is decoded from the time between FALLING edges alone:
//   13.5 ms  leader (9 ms burst + 4.5 ms space): a new frame, 32 bits follow
//   11.25 ms repeat (9 ms + 2.25 ms): the key is still held, every 108 ms
//   1.125 ms a 0 bit, 2.25 ms a 1 bit, least significant first:
//            address, ~address, command, ~command
// Only the command byte and its inverse are checked, so any address works.
// Sampling at 100 us leaves lots of margin on every one of those times.

ISR(TIMER1_COMPA_vect) {
  bool level = *irPinRegister & irPinMask;
  if (level == irLastLevel) return;
  irLastLevel = level;
  if (level) return;                       // only falling edges
  unsigned long now = micros();
  unsigned long gap = now - irLastEdgeUs;
  irLastEdgeUs = now;
  if (gap > 9500 && gap < 15500) {    // (margin: a byte going out on Bluetooth can delay an edge 1 ms)
    if (gap > 12000) {
      irBitCount = 0;                      // leader: 32 bits follow
    } else {
      irRepeatSeen = true;                 // repeat: the key is still held
      irBitCount = 0xFF;
    }
    return;
  }
  if (irBitCount >= 32) return;
  if (gap < 800 || gap > 2800) {           // not a bit: wait for the next leader
    irBitCount = 0xFF;
    return;
  }
  irBits >>= 1;
  if (gap > 1700) irBits |= 0x8000;        // over 1.7 ms: a 1
  if (++irBitCount == 32) {
    byte command = irBits;
    if ((byte)(command ^ (irBits >> 8)) == 0xFF) {
      byte next = (irKeyHead + 1) & 7;
      if (next != irKeyTail) {            // (a full queue drops the newest key)
        irKeyQueue[irKeyHead] = command;
        irKeyHead = next;
      }
    }
    irBitCount = 0xFF;
  }
}

void irBegin() {
  pinMode(IR_RECEIVER_PIN, INPUT);   // the receiver drives its output (it has its own pull-up)
  irPinRegister = portInputRegister(digitalPinToPort(IR_RECEIVER_PIN));
  irPinMask = digitalPinToBitMask(IR_RECEIVER_PIN);
  TCCR1A = 0;                               // Timer1: CTC, clk/8 = 0.5 us a tick
  TCCR1B = _BV(WGM12) | _BV(CS11);
  OCR1A = 199;                              // 100 us
  TIMSK1 = _BV(OCIE1A);
}

// The command byte of a new key press since the last call, or -1.
int irTakeKey() {
  int key = -1;
  noInterrupts();
  if (irKeyTail != irKeyHead) {
    key = irKeyQueue[irKeyTail];
    irKeyTail = (irKeyTail + 1) & 7;
  }
  interrupts();
  return key;
}

// NEC command byte -> the key's letter: U D L R (arrows), O (OK), * # 0-9.
// The kit's 17-key remote. Unlisted codes are printed, so another remote can
// be added here.
struct IrKeyCode {
  byte code;
  char key;
};
const IrKeyCode IR_KEYS[] PROGMEM = {
  { 0x18, 'U' }, { 0x52, 'D' }, { 0x08, 'L' }, { 0x5A, 'R' }, { 0x1C, 'O' },
  { 0x16, '*' }, { 0x0D, '#' }, { 0x19, '0' },
  { 0x45, '1' }, { 0x46, '2' }, { 0x47, '3' }, { 0x44, '4' }, { 0x40, '5' },
  { 0x43, '6' }, { 0x07, '7' }, { 0x15, '8' }, { 0x09, '9' },
};

char irKeyLetter(byte code) {
  for (byte i = 0; i < sizeof(IR_KEYS) / sizeof(IR_KEYS[0]); i++) {
    if (pgm_read_byte(&IR_KEYS[i].code) == code) return pgm_read_byte(&IR_KEYS[i].key);
  }
  return 0;
}

// ===========================================================================
// SONAR - true when something is nearer than SONAR_STOP_MM
// ===========================================================================
// One ping; mm, or -1 for no echo within timeoutUs. Trig goes back to an
// input afterwards. Blocks for the echo (at most timeoutUs).
long sonarMm(unsigned long timeoutUs) {
#if USE_SONAR
  pinMode(SONAR_TRIG_PIN, OUTPUT);
  digitalWrite(SONAR_TRIG_PIN, HIGH);                // a 10 us pulse starts a ping
  delayMicroseconds(10);
  digitalWrite(SONAR_TRIG_PIN, LOW);
  pinMode(SONAR_TRIG_PIN, INPUT);
  volatile uint8_t *echoPort = portInputRegister(digitalPinToPort(SONAR_ECHO_PIN));
  byte echoMask = digitalPinToBitMask(SONAR_ECHO_PIN);
  unsigned long startedAt = micros();
  while (!(*echoPort & echoMask)) {
    if (micros() - startedAt > 2000) return -1;
  }
  startedAt = micros();
  while (*echoPort & echoMask) {
    if (micros() - startedAt > timeoutUs) return -1;
  }
  return (micros() - startedAt) * 343UL / 2000;      // 343 m/s, there and back
#else
  (void)timeoutUs;
  return -1;
#endif
}

// Looks at most every SONAR_PERIOD_MS, and only as far as it needs to (a
// short timeout: anything farther than the stop distance is "clear").
unsigned long sonarLookedAt = 0;
bool sonarBlocked = false;
bool wallAhead() {
#if USE_SONAR
  if (millis() - sonarLookedAt >= SONAR_PERIOD_MS || sonarLookedAt == 0) {
    sonarLookedAt = millis();
    long mm = sonarMm((unsigned long)SONAR_STOP_MM * 2 * 1000 / 343 + 300);
    sonarBlocked = mm >= 0 && mm < SONAR_STOP_MM;
  }
  return sonarBlocked;
#else
  return false;
#endif
}

// ===========================================================================
// GESTURES - the robot's answers (small raw moves, no curve or trims)
// ===========================================================================
int gesturePower() {
  return constrain((int)motion[M_LOW_PWM] + GESTURE_PWM_OVER_START, 0, 255);
}

// spin: +1 clockwise, -1 counter-clockwise, 0 = everything forward (sign by nod)
void twitch(int spin, int nod, unsigned int ms) {
  int p = gesturePower();
  setWheelPower(0, spin ? spin * p : nod * p);          // FL
  setWheelPower(1, spin ? -spin * p : nod * p);         // FR
  setWheelPower(2, spin ? spin * p : nod * p);          // RL
  setWheelPower(3, spin ? -spin * p : nod * p);         // RR
  waitMs(ms);
}

// "I am listening": a quick left-right-left-right
void gestureWiggle() {
  out.println(F("gesture: wiggle"));
  for (byte i = 0; i < 2; i++) {
    twitch(1, 0, GESTURE_TWITCH_MS);
    twitch(-1, 0, GESTURE_TWITCH_MS);
  }
  stopAllWheels();
}

// "got it": forward, back
void gestureNod() {
  out.println(F("gesture: nod"));
  twitch(0, 1, GESTURE_TWITCH_MS);
  twitch(0, -1, GESTURE_TWITCH_MS);
  stopAllWheels();
}

// "counted that one": a single quick right-left (half a wiggle)
void gestureTick() {
  out.println(F("gesture: tick"));
  twitch(1, 0, GESTURE_TWITCH_MS);
  twitch(-1, 0, GESTURE_TWITCH_MS);
  stopAllWheels();
}

// "no": one slow swing each way
void gestureNo() {
  out.println(F("gesture: no"));
  twitch(1, 0, GESTURE_SLOW_MS);
  twitch(-1, 0, GESTURE_SLOW_MS);
  stopAllWheels();
}

// ===========================================================================
// PROGRAMS - steps, running, EEPROM slots
// ===========================================================================
const char STEP_LETTERS[] PROGMEM = "fblrttqepncg";   // for the p commands: f b l r t t, q e diagonals, p pause, n repeat, c circle, g run a program

void printDirection(byte dir) {
  switch (dir) {
    case S_FORWARD: out.print(F("forward")); break;
    case S_BACK: out.print(F("back")); break;
    case S_LEFT: out.print(F("left")); break;
    case S_RIGHT: out.print(F("right")); break;
    case S_TURN_LEFT: out.print(F("turn left")); break;
    case S_TURN_RIGHT: out.print(F("turn right")); break;
    case S_DIAG_LEFT: out.print(F("diagonal left")); break;
    case S_DIAG_RIGHT: out.print(F("diagonal right")); break;
    case S_WAIT: out.print(F("wait")); break;
    case S_CIRCLE: out.print(F("circle, facing in,")); break;
    case S_CALL: out.print(F("run program")); break;
    default: out.print(F("do it all again")); break;
  }
}

bool isTurn(byte dir) { return dir == S_TURN_LEFT || dir == S_TURN_RIGHT; }
bool isDriveStep(byte dir) { return dir != S_WAIT && dir != S_REPEAT && dir != S_CIRCLE && dir != S_CALL; }   // what holding the key drives
int defaultAmount(byte dir) {
  return dir == S_CALL ? 1 : dir == S_WAIT ? DEFAULT_WAIT_S : dir == S_REPEAT ? DEFAULT_REPEAT_TIMES : dir == S_CIRCLE ? DEFAULT_CIRCLE_CM : isTurn(dir) ? DEFAULT_TURN_DEG : DEFAULT_STEP_CM;
}

void printStep(const Step &step) {
  printDirection(step.dir);
  out.print(' ');
  out.print(step.amount);
  out.print(step.dir == S_CALL ? F("") : step.dir == S_WAIT ? F(" s") : step.dir == S_REPEAT ? F(" times") : step.dir == S_CIRCLE ? F(" cm across") : isTurn(step.dir) ? F(" deg") : F(" cm"));
}

// Drive one step. False when stopped (a key, x, or the sonar).
bool runStep(const Step &step) {
  abortRequested = false;
  movingForward = step.dir == S_FORWARD || step.dir == S_DIAG_LEFT || step.dir == S_DIAG_RIGHT;
  float mm = step.amount * 10.0;
  switch (step.dir) {
    case S_FORWARD: driveStraightWhileSpinning(0, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_BACK: driveStraightWhileSpinning(180, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_LEFT: driveStraightWhileSpinning(270, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_RIGHT: driveStraightWhileSpinning(90, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_DIAG_LEFT: driveStraightWhileSpinning(315, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_DIAG_RIGHT: driveStraightWhileSpinning(45, mm, DEMO_SPEED_MM_PER_SEC, 0); break;
    case S_TURN_LEFT: spinInPlace(-(float)step.amount, DEFAULT_SPIN_DEG_PER_SEC); break;
    case S_TURN_RIGHT: spinInPlace(step.amount, DEFAULT_SPIN_DEG_PER_SEC); break;
    case S_WAIT:
      for (unsigned long t = millis(); millis() - t < step.amount * 1000UL && !checkForAbort();) { delay(1); }
      break;
    case S_CIRCLE: {
      // One lap clockwise around a point that far ahead, nose locked on it (the
      // Workshop's pk demo): the centre slides left while the body turns with the orbit.
      float radius = step.amount * 5.0;   // across, cm -> radius, mm
      float omega = DEMO_SPEED_MM_PER_SEC / radius;
      executeTimedBodyMotion(0, -DEMO_SPEED_MM_PER_SEC, omega, omega, 2 * PI * radius / DEMO_SPEED_MM_PER_SEC);
      break;
    }
    default: break;   // S_REPEAT and S_CALL: runSteps handles them
  }
  stopAllWheels();
  movingForward = false;
  return !abortRequested;
}

// A "run program" step (* 2 <slot>, g<slot>): the steps saved in that slot run
// here, then the program that asked carries on. A program may run a program
// that runs a program, RUN_MAX_DEPTH deep (each one deep costs about 100 bytes
// of RAM); deeper than that, or an empty slot, the step is skipped. So a
// program that runs itself goes round RUN_MAX_DEPTH times and ends.
// False when stopped.
const byte RUN_MAX_DEPTH = 3;
byte runDepth = 0;

bool runCalledSlot(byte slot) {
  Step steps[PROGRAM_MAX_STEPS];
  byte count = (slot <= PROGRAM_SLOTS && runDepth < RUN_MAX_DEPTH) ? loadRunnable(slot, steps) : 0;
  if (!count) {
    out.println(runDepth < RUN_MAX_DEPTH ? F("run: nothing in that slot, skipped") : F("run: too many programs deep, skipped"));
    abortRequested = false;
    return true;
  }
  runDepth++;
  bool finished = runSteps(steps, count);
  runDepth--;
  return finished;
}

// Run steps one after another; any key, x or the sonar stops the lot (false).
// An 8 (repeat) AFTER some steps sends the run back to the step after the
// previous 8 (or the start) until it has gone round that many times in all.
// An 8 with no steps before it (first, or right after another 8) repeats the
// steps that FOLLOW it instead, up to the next 8 or the end.
bool runSteps(const Step *steps, byte count) {
  int loopStart = 0;
  int roundsLeft = -1;   // -1: not inside a repeat yet
  bool headed = false;   // this stretch's 8 came before it: the next 8 (or the end) closes it
  for (int i = 0; i <= count; i++) {
    if (i == count || steps[i].dir == S_REPEAT) {
      if (headed) {
        if (roundsLeft > 0 && i > loopStart) {
          roundsLeft--;
          out.print(F("again: "));
          out.print(roundsLeft + 1);
          out.println(F(" more"));
          i = loopStart - 1;
          continue;
        }
        headed = false;
        roundsLeft = -1;
        loopStart = i;     // the 8 here has nothing before it now: it heads what follows
      }
      if (i == count) break;
      if (i == loopStart && roundsLeft < 0) {
        headed = true;
        roundsLeft = (int)steps[i].amount - 1;
        loopStart = i + 1;
        continue;
      }
      if (roundsLeft < 0) roundsLeft = (int)steps[i].amount - 1;
      if (roundsLeft > 0) {
        roundsLeft--;
        out.print(F("again: "));
        out.print(roundsLeft + 1);
        out.println(F(" more"));
        i = loopStart - 1;
      } else {
        roundsLeft = -1;
        loopStart = i + 1;
      }
      continue;
    }
    out.print(F("step "));
    out.print(i + 1);
    out.print(F(": "));
    printStep(steps[i]);
    out.println();
    if (steps[i].dir == S_CALL ? !runCalledSlot(steps[i].amount) : !runStep(steps[i])) return false;
    // A breath between steps (a key during it stops too)
    for (unsigned long t = millis(); millis() - t < STEP_PAUSE_MS;) {
      if (checkForAbort()) return false;
    }
  }
  return true;
}

// A program from its first step, and how it ended
void runProgram(const Step *steps, byte count) {
  runDepth = 0;
  abortRequested = false;
  out.println(runSteps(steps, count) ? F("run: done") : F("run: stopped"));
}

int slotAddress(byte slot) {   // slot 1..PROGRAM_SLOTS
  return PROGRAM_EEPROM_ADDRESS + (slot - 1) * PROGRAM_SLOT_BYTES;
}

// The steps saved in a slot (0 when the slot is empty or not a program).
byte loadProgram(byte slot, Step *steps) {
  if (slot < 1 || slot > PROGRAM_SLOTS) return 0;
  int address = slotAddress(slot);
  if (eeprom_read_byte((const uint8_t *)address) != PROGRAM_MAGIC) return 0;
  byte count = eeprom_read_byte((const uint8_t *)(address + 1));
  if (count > PROGRAM_MAX_STEPS) return 0;
  for (byte i = 0; i < count; i++) {
    uint16_t packed = eeprom_read_word((const uint16_t *)(address + 2 + 2 * i));
    steps[i].dir = packed >> 12;
    steps[i].amount = packed & 0x0FFF;
  }
  return count;
}

void saveProgram(byte slot, const Step *steps, byte count) {
  int address = slotAddress(slot);
  eeprom_update_byte((uint8_t *)address, count ? PROGRAM_MAGIC : 0);
  eeprom_update_byte((uint8_t *)(address + 1), count);
  for (byte i = 0; i < count; i++) {
    eeprom_update_word((uint16_t *)(address + 2 + 2 * i), ((uint16_t)steps[i].dir << 12) | (steps[i].amount & 0x0FFF));
  }
}

// "f50 t90 n4" -> steps (letters f b l r, q e diagonals, t degrees with t-90 =
// left, p pause seconds, n repeat times, g run the program in that slot; no
// number = the step's default).
byte parseStepText(const char *text, Step *steps) {
  byte count = 0;
  for (const char *c = text; *c && count < PROGRAM_MAX_STEPS;) {
    char letter = *c++;
    int dir = letter == 'f' ? S_FORWARD : letter == 'b' ? S_BACK : letter == 'l' ? S_LEFT : letter == 'r' ? S_RIGHT : letter == 't' ? S_TURN_RIGHT
            : letter == 'q' ? S_DIAG_LEFT : letter == 'e' ? S_DIAG_RIGHT : letter == 'p' ? S_WAIT : letter == 'n' ? S_REPEAT : letter == 'c' ? S_CIRCLE : letter == 'g' ? S_CALL : -1;
    if (dir < 0) continue;
    bool negative = *c == '-';
    if (negative) c++;
    int amount = 0;
    while (*c >= '0' && *c <= '9') {   // (not min(): it is a macro and would read *c++ twice)
      amount = amount * 10 + (*c++ - '0');
      if (amount > 4095) amount = 4095;
    }
    if (dir == S_TURN_RIGHT && negative) dir = S_TURN_LEFT;
    if (amount == 0) amount = defaultAmount(dir);
    steps[count].dir = dir;
    steps[count].amount = amount;
    count++;
  }
  return count;
}

// What a "run program" step runs: the saved steps (ir.ino: or the built-in demo)
byte loadRunnable(byte slot, Step *steps) {
  return loadProgram(slot, steps);
}

// * 0: program 0 is always a circle 1 m across, facing in
void runCircle() {
  Step circle = { S_CIRCLE, DEFAULT_CIRCLE_CM };
  out.println(F("run: program 0 (circle, 1 m across, facing in)"));
  runProgram(&circle, 1);
}

void runSlot(byte slot) {
  Step steps[PROGRAM_MAX_STEPS];
  byte count = loadProgram(slot, steps);
  out.print(F("run: slot "));
  out.print(slot);
  if (!count) {
    out.println(F(" is empty"));
    gestureNo();
    return;
  }
  out.println();
  runProgram(steps, count);
}

// ===========================================================================
// THE REMOTE - what each key does
// ===========================================================================
enum RemoteMode { IDLE, PROGRAMMING };
// While programming: waiting for the * that starts a step; for the step's
// direction; for its digits; after * *, for the third; for the slot number;
// after the slot number, for * *.
enum ProgramState { P_STEP_START, P_DIRECTION, P_AMOUNT, P_END, P_SLOT, P_SAVE };

RemoteMode remoteMode = IDLE;
ProgramState programState = P_STEP_START;
Step draft[PROGRAM_MAX_STEPS];
byte draftCount = 0;
Step current;
bool currentHasDigits = false;
byte draftSlot = 0;
unsigned long programEnteredAt = 0;   // a 4th * and a slot digit right after entering = add to that slot
byte stars = 0;                   // * presses in a row (IDLE and P_SAVE)
unsigned long starAt = 0;
byte pounds = 0;                  // # presses in a row (IDLE)

// Hold-to-drive from the remote
bool irDriving = false;
byte driveDirection = S_FORWARD;
unsigned long irHeldAt = 0;

// Keep driving from the phone (v): a vector that must be repeated
bool vectorActive = false;
unsigned long vectorAt = 0;
bool vectorSaidBlocked = false;

// -1 when the key is not a direction (arrows, 1 and 3)
int directionOf(char key) {
  switch (key) {
    case 'U': return S_FORWARD;
    case 'D': return S_BACK;
    case 'L': return S_LEFT;
    case 'R': return S_RIGHT;
    case '1': return S_TURN_LEFT;
    case '3': return S_TURN_RIGHT;
    case '7': return S_DIAG_LEFT;
    case '9': return S_DIAG_RIGHT;
    case '5': return S_WAIT;
    case '8': return S_REPEAT;
    case '2': return S_CALL;
    case '0': return S_CIRCLE;
    default: return -1;
  }
}

void stopDriving(bool say) {
  if (irDriving && say) out.println(F("drive: stop"));
  irDriving = false;
  vectorActive = false;
  stopAllWheels();
}

// v<forward>,<right>,<spin>; at -100..100 % of full speed, like mecanum_holonomic's
// vector drive: full speed is the top wheel speed, spin % is that speed at the lever.
void handleVector(const char *text) {
  int value[3];
  parseThreeInts(text, value);
  irDriving = false;
  float speed = motion[M_MAX];
  float forward = constrain(value[0], -100, 100) * 0.01;
  float right = constrain(value[1], -100, 100) * 0.01;
  float spin = constrain(value[2], -100, 100) * 0.01;
  movingForward = forward > 0;
  if (movingForward && wallAhead()) {
    forward = 0;   // the phone may still strafe and turn
    if (!vectorSaidBlocked) out.println(F("stop: something ahead"));
    vectorSaidBlocked = true;
  } else {
    vectorSaidBlocked = false;
  }
  vectorActive = true;
  vectorAt = millis();
  driveBody(forward * speed, right * speed, spin * speed / rotationLeverMm());
}

void startDriving(byte direction) {
  vectorActive = false;
  irDriving = true;
  driveDirection = direction;
  irHeldAt = millis();
  movingForward = direction == S_FORWARD || direction == S_DIAG_LEFT || direction == S_DIAG_RIGHT;
  if (movingForward && wallAhead()) {
    out.println(F("stop: something ahead"));
    stopDriving(false);
    return;
  }
  float v = DEMO_SPEED_MM_PER_SEC;
  float spin = degreesToRadians(DEFAULT_SPIN_DEG_PER_SEC);
  out.print(F("drive: "));
  printDirection(direction);
  out.println();
  switch (direction) {
    case S_FORWARD: driveBody(v, 0, 0); break;
    case S_BACK: driveBody(-v, 0, 0); break;
    case S_LEFT: driveBody(0, -v, 0); break;
    case S_RIGHT: driveBody(0, v, 0); break;
    case S_DIAG_LEFT: driveBody(v * 0.7071, -v * 0.7071, 0); break;
    case S_DIAG_RIGHT: driveBody(v * 0.7071, v * 0.7071, 0); break;
    case S_TURN_LEFT: driveBody(0, 0, -spin); break;
    default: driveBody(0, 0, spin); break;
  }
}

void beginStep(byte direction) {
  current.dir = direction;
  current.amount = 0;
  currentHasDigits = false;
  programState = P_AMOUNT;
}

void commitStep() {
  if (!currentHasDigits || current.amount == 0) {
    current.amount = defaultAmount(current.dir);
  }
  if (draftCount >= PROGRAM_MAX_STEPS) {
    out.println(F("program: full"));
    gestureNo();
  } else {
    draft[draftCount++] = current;
    out.print(F("step "));
    out.print(draftCount);
    out.print(F(": "));
    printStep(current);
    out.println();
    gestureNod();
  }
  programState = P_DIRECTION;   // the * that ended this step may start the next
}

void enterProgramming() {
  stopDriving(false);
  remoteMode = PROGRAMMING;
  programState = P_STEP_START;
  draftCount = 0;
  stars = 0;
  programEnteredAt = millis();
  out.println(F("program: listening"));
  gestureWiggle();
}

// * * * * <slot>: the slot's steps become the draft, to add to
void addToSlot(byte slot) {
  draftCount = loadProgram(slot, draft);
  programState = P_STEP_START;
  out.print(F("program: adding to slot "));
  out.print(slot);
  out.print(F(" ("));
  out.print(draftCount);
  out.println(F(" steps)"));
  gestureWiggle();
  gestureNod();
}

void cancelProgramming() {
  remoteMode = IDLE;
  draftCount = 0;
  stars = 0;
  out.println(F("program: canceled"));
  gestureNo();
}

void finishProgram() {
  if (draftCount == 0) {
    cancelProgramming();
    return;
  }
  programState = P_SLOT;
  stars = 0;
  out.print(F("program: "));
  out.print(draftCount);
  out.println(F(" steps - which slot? (1-9, or OK to try it)"));
  gestureWiggle();
}

void saveDraft() {
  saveProgram(draftSlot, draft, draftCount);
  out.print(F("program: saved in slot "));
  out.println(draftSlot);
  remoteMode = IDLE;
  stars = 0;
  gestureNod();
}

// ===========================================================================
// LIGHT - follow a torch (# # 1, or flash it left right left right) or run from it (# # 2)
// ===========================================================================
#define LIGHT_SENSORS (USE_LIGHT_BACK ? 3 : 2)   // 0 left, 1 right, 2 back
byte lightMode = 0;                // 0 off, 1 follow, 2 run away
float lightLevel[LIGHT_SENSORS];   // smoothed reading
float lightRoom[LIGHT_SENSORS];    // the room's light without the torch
bool lightSeen = false;
bool lightWatching = false;        // the readings are being kept up to date
bool lightBackFound = false;       // a back LDR answered on LIGHT_BACK_PIN
unsigned long lightTickAt = 0;
unsigned long lightLastSeenAt = 0;
// The flash start: alternate hits on the two LDRs
bool flashLit[2] = { false, false };       // bright last tick
bool flashCounted[2] = { false, false };   // this flash already counted
unsigned long flashLitSince[2];
byte flashHits = 0;
byte flashLastSide = 0;
unsigned long flashFirstAt = 0;
float flashPeak[2];                        // each LDR's strongest hit in this flash start
// The start calibration
enum LightCalStage { CAL_DONE, CAL_SHINES };
byte lightCal = CAL_DONE;
byte calCount = 0;                 // shines counted
int8_t calLit = -1;                // the shine being watched until it goes dark: 0 left, 1 right; -1 dark
byte calLastSide = 2;              // the side counted last (2: none yet); the next shine must be the other
bool calRetried = false;           // the weak side already got its second shine
float calSpan[2];                  // each LDR's rise on its own shine (the strongest); 0 = not shone yet
float lightGain[2] = { 1, 1 };     // left, right: multiplies the rise over the room's light

int lightRead(byte side) {
  int raw = analogRead(side == 2 ? LIGHT_BACK_PIN : side ? LIGHT_RIGHT_PIN : LIGHT_LEFT_PIN);
  return LIGHT_BRIGHT_READS_HIGH ? raw : 1023 - raw;
}

// B,<direction>,<brightest>,<left>,<right>[,<back>]: the same layout as
// mecanum_holonomic's bs answer (so the Blocks page reads it too). Readings
// 0..1000, brighter = higher; direction in degrees clockwise from the nose.
void printLightReading() {
#if USE_LIGHT_BACK
  lightFindBack();
#endif
  byte count = 2;
  int v[3] = { 0, 0, 0 };
#if USE_LIGHT_BACK
  if (lightBackFound) count = 3;
#endif
  int brightest = 0;
  for (byte side = 0; side < count; side++) {
    v[side] = (long)lightRead(side) * 1000 / 1023;
    brightest = max(brightest, v[side]);
  }
  float x = (v[0] + v[1]) * 0.7071 - v[2], y = (v[1] - v[0]) * 0.7071;
  out.print(F("B,"));
  out.print((int)(atan2(y, x) * 180.0 / PI));
  out.print(',');
  out.print(brightest);
  for (byte side = 0; side < count; side++) {
    out.print(',');
    out.print(v[side]);
  }
  out.println();
}

// Is a back LDR wired? With the pin's own pull-up on, a divider (LDR and
// resistor) still reads its light; an empty pin reads the top. With the LDR on
// the GND side (LIGHT_BRIGHT_READS_HIGH false) a back LDR in a DARK room also
// sits near the top and can be missed: start the light modes with the lights on.
void lightFindBack() {
#if USE_LIGHT_BACK
  pinMode(LIGHT_BACK_PIN, INPUT_PULLUP);
  delay(2);
  analogRead(LIGHT_BACK_PIN);
  bool found = analogRead(LIGHT_BACK_PIN) < 1015;
  pinMode(LIGHT_BACK_PIN, INPUT);
  if (found != lightBackFound) {
    lightBackFound = found;
    out.println(found ? F("light: back sensor found") : F("light: no back sensor"));
  }
#endif
}

void lightReset() {
  lightFindBack();
  for (byte side = 0; side < LIGHT_SENSORS; side++) lightLevel[side] = lightRoom[side] = lightRead(side);
}

// Smooth the readings and learn the room while no torch is seen; extra[] is
// how far each LDR is over the room's light.
void lightSample(float extra[LIGHT_SENSORS]) {
  for (byte side = 0; side < LIGHT_SENSORS; side++) {
    lightLevel[side] += (lightRead(side) - lightLevel[side]) * 0.25;
    if (lightLevel[side] < lightRoom[side]) lightRoom[side] = lightLevel[side];
    else if (!lightSeen && lightCal == CAL_DONE) lightRoom[side] += (lightLevel[side] - lightRoom[side]) / 32;
    else if (LIGHT_ROOM_CATCHUP_TICKS) lightRoom[side] += (lightLevel[side] - lightRoom[side]) / LIGHT_ROOM_CATCHUP_TICKS;
    extra[side] = max(lightLevel[side] - lightRoom[side], 0.0f);
  }
#if USE_LIGHT_BACK
  if (!lightBackFound) extra[2] = 0;
#endif
}

void lightStop() {
  if (!lightMode) return;
  lightMode = 0;
  lightSeen = false;
  lightCal = CAL_DONE;
  calLit = -1;
  movingForward = false;
  stopAllWheels();
  out.println(F("light: stop"));
}

// The start calibration (see LIGHT_CAL_HIT): a shine on each LDR, either side
// first, nothing in between. From the flash start both shines are already
// done (their peaks are in flashPeak), so it finishes on the spot.
void lightCalBegin(bool fromFlash) {
  lightCal = CAL_SHINES;
  calCount = 0;
  calLastSide = 2;
  calLit = -1;
  calRetried = false;
  lightSeen = false;
  for (byte side = 0; side < 2; side++) calSpan[side] = fromFlash ? flashPeak[side] : 0;
  if (fromFlash) {
    lightCalFinish();
    return;
  }
  out.println(F("light: calibrate, shine on one sensor, then the other"));
  gestureWiggle();
}

void printGains() {
  out.print(F("gains left "));
  out.print((int)(lightGain[0] * 100 + 0.5));
  out.print(F("%, right "));
  out.print((int)(lightGain[1] * 100 + 0.5));
  out.print('%');
}

void lightCalFinish() {
  float mean = (calSpan[0] + calSpan[1]) / 2;
  for (byte side = 0; side < 2; side++) lightGain[side] = constrain(mean / calSpan[side], 1 / LIGHT_GAIN_LIMIT, LIGHT_GAIN_LIMIT);
  lightCal = CAL_DONE;
  calLit = -1;
  lightSeen = false;
  out.print(F("light: calibrated, "));
  printGains();
  out.print(F(" (shine left +"));
  out.print((int)calSpan[0]);
  out.print(F(", right +"));
  out.print((int)calSpan[1]);
  out.println(')');
  gestureNod();
}

// OK during the calibration: go with the gains it has (the last calibration
// since power-on, or 1 and 1).
void lightCalSkip() {
  lightCal = CAL_DONE;
  calLit = -1;
  lightSeen = false;
  out.print(F("light: calibration skipped, "));
  printGains();
  out.println();
  gestureNod();
}

// One tick of the calibration, with each LDR's rise over the room's light.
void lightCalTick(const float extra[LIGHT_SENSORS]) {
  if (calLit >= 0) {
    // Watching a shine: keep its peak, wait for dark ("nothing") on both LDRs
    calSpan[calLit] = max(calSpan[calLit], extra[calLit]);
    for (byte side = 0; side < 2; side++) {
      if (extra[side] >= max(LIGHT_CAL_HIT / 2.0f, calSpan[side] / 4)) return;
    }
    calLit = -1;
    lightSeen = false;
    if (calSpan[0] <= 0 || calSpan[1] <= 0) return;   // the other side still to come
    // Both shone. A side much weaker than the other gets one more shine, by itself
    byte weak = calSpan[0] < calSpan[1] ? 0 : 1;
    if (!calRetried && calSpan[weak] * LIGHT_GAIN_LIMIT < calSpan[1 - weak]) {
      calRetried = true;
      calLastSide = 1 - weak;
      out.print(weak ? F("light: the right") : F("light: the left"));
      out.print(F(" sensor barely changes (+"));
      out.print((int)calSpan[weak]);
      out.println(F("): shine on it again"));
      gestureNo();
      return;
    }
    lightCalFinish();
    return;
  }
  // Dark: the next shine must be on the other LDR (either one to begin)
  for (byte side = 0; side < 2; side++) {
    if (side == calLastSide || extra[side] <= LIGHT_CAL_HIT || extra[side] <= extra[1 - side] * 1.5) continue;
    calCount++;
    calLastSide = side;
    calLit = side;
    lightSeen = true;
    calSpan[side] = max(calSpan[side], extra[side]);
    out.print(F("light: shine "));
    out.print(calCount);
    out.println(side ? F(" right") : F(" left"));
    gestureTick();
    return;
  }
}

// fromFlash: started by the torch itself, so keep the room's light already
// learned (a fresh look now would count the torch as the room).
void lightStart(byte mode, bool fromFlash) {
  stopDriving(false);
  if (!fromFlash || !lightWatching) lightReset();
  lightWatching = true;
  lightMode = mode;
  lightSeen = false;
  lightTickAt = millis();
  out.print(mode == 1 ? F("light: follow") : F("light: run away"));
  out.print(F(" (left "));
  out.print((int)lightLevel[0]);
  out.print(F(", right "));
  out.print((int)lightLevel[1]);
  out.println(F(")"));
  lightCalBegin(fromFlash);
}

// While nothing else is going on: a torch flashed on the left LDR, the right,
// the left, the right (or right first), each hit strong and on one side
// only, all within LIGHT_FLASH_WINDOW_MS, starts following.
void flashWatch(const float extra[LIGHT_SENSORS]) {
  for (byte side = 0; side < 2; side++) {
    bool bright = extra[side] > LIGHT_FLASH_MIN && extra[side] > extra[1 - side] + LIGHT_SEEN;
    if (bright && !flashLit[side]) flashLitSince[side] = millis();
    flashLit[side] = bright;
    if (bright) flashPeak[side] = max(flashPeak[side], extra[side]);
    if (extra[side] < LIGHT_FLASH_MIN / 2) flashCounted[side] = false;   // dark again: ready for the next flash
    if (!bright || flashCounted[side] || millis() - flashLitSince[side] < LIGHT_FLASH_HOLD_MS) continue;
    flashCounted[side] = true;     // one hit per flash
    if (flashHits && side != flashLastSide && millis() - flashFirstAt < LIGHT_FLASH_WINDOW_MS) {
      flashHits++;
    } else {
      flashHits = 1;
      flashFirstAt = millis();
      flashPeak[1 - side] = 0;     // a new try: only its own hits count
    }
    flashLastSide = side;
    out.print(F("light: flash "));
    out.println(flashHits);
    if (flashHits >= 4) {
      flashHits = 0;
      lightStart(1, true);
      return;
    }
  }
}

// Every LIGHT_TICK_MS: in a light mode, steer toward (or back away from) the
// torch; otherwise, while the robot is idle, watch for the flash start.
void lightTick() {
  if (millis() - lightTickAt < LIGHT_TICK_MS) return;
  bool idle = remoteMode == IDLE && !irDriving && !vectorActive;
  if (!lightMode && !(LIGHT_FLASH_START && idle)) {
    lightWatching = false;
    return;
  }
  lightTickAt = millis();
  if (!lightWatching) {
    lightReset();
    lightWatching = true;
  }
  float extra[LIGHT_SENSORS];
  lightSample(extra);
  if (!lightMode) {
    flashWatch(extra);
    return;
  }
  if (lightCal != CAL_DONE) {
    lightCalTick(extra);
    return;
  }
  for (byte side = 0; side < 2; side++) extra[side] *= lightGain[side];
  float brightest = max(extra[0], extra[1]);
#if USE_LIGHT_BACK
  bool behind = extra[2] > brightest;
  brightest = max(brightest, extra[2]);
#endif
  if (brightest > LIGHT_SEEN) lightLastSeenAt = millis();
  bool seen = brightest > LIGHT_SEEN || (lightSeen && brightest > LIGHT_SEEN / 2 && millis() - lightLastSeenAt < LIGHT_LOST_MS);
  if (seen != lightSeen) {
    lightSeen = seen;
    out.println(seen ? F("light: sees it") : F("light: lost it"));
  }
  if (!seen) {
    stopAllWheels();
    return;
  }
#if USE_LIGHT_BACK
  if (behind) {
    // Behind: tail toward it (follow) or nose away (run away). The front LDRs
    // only catch spill; more on the left means the light is behind-left, and
    // turning clockwise swings the tail toward it.
    float front = extra[0] + extra[1];
    float spill = front > 1 ? (extra[0] - extra[1]) / front * front / (front + extra[2]) : 0;
    float speed = LIGHT_SPEED_MM_PER_SEC * (1 - 0.6 * fabs(spill));
    movingForward = lightMode == 2;
    driveBody(lightMode == 1 ? -speed : speed, 0, spill * LIGHT_BACK_SPIN_SHARE * LIGHT_SPIN_RAD_PER_SEC);
    return;
  }
#endif
  // -1 = all on the left, +1 = all on the right
  float side = (extra[1] - extra[0]) / (extra[0] + extra[1]);
  float speed = LIGHT_SPEED_MM_PER_SEC * (1 - 0.6 * fabs(side));
  movingForward = lightMode == 1;
  if (movingForward && wallAhead()) speed = 0;     // close enough: just keep facing it
  driveBody(lightMode == 1 ? speed : -speed, 0, side * LIGHT_SPIN_RAD_PER_SEC);
}

void handleKeyIdle(char key) {
  if (key == '*') {
    stars++;
    starAt = millis();
    if (stars >= 3) enterProgramming();
    return;
  }
  if (stars == 1 && key >= '0' && key <= '9') {
    stars = 0;
    stopDriving(false);
    if (key == '0') runCircle(); else runSlot(key - '0');
    return;
  }
  stars = 0;
  if (pounds == 2 && (key == '1' || key == '2')) {
    pounds = 0;
    lightStart(key - '0', false);
    return;
  }
  if (key == '#') {
    stopDriving(true);
    pounds++;
    starAt = millis();
    if (pounds > 2) pounds = 2;   // (ir.ino calibrates on a third #; here it is one more #)
    // Two #: a tick says both landed and it is waiting (IR_STAR_TIMEOUT_MS) for
    // the 1 or 2. Without it a lost # looks like a window that ran out.
    if (pounds == 2) {
      out.println(F("light: # # - press 1 to follow, 2 to run away"));
      gestureTick();
    }
    return;
  }
  pounds = 0;
  int direction = directionOf(key);
  if (direction >= 0 && isDriveStep(direction)) {
    startDriving(direction);
  } else if (key == '0' || key == 'O') {
    stopDriving(true);
  }
}

void handleKeyProgramming(char key) {
  if (key == '#') {
    cancelProgramming();
    return;
  }
  int direction = directionOf(key);
  switch (programState) {
    case P_STEP_START:
      if (key == '*') programState = P_DIRECTION;
      else if (direction >= 0) beginStep(direction);   // forgot the *: fine
      break;
    case P_DIRECTION:
      if (key == '*') programState = P_END;             // * * so far
      else if (key >= '1' && key <= '9' && draftCount == 0 && millis() - programEnteredAt < 2000) addToSlot(key - '0');   // * * * * <slot>
      else if (direction >= 0) beginStep(direction);
      break;
    case P_END:
      if (key == '*') finishProgram();                  // * * *
      else if (direction >= 0) beginStep(direction);    // the extra * was a slip
      break;
    case P_AMOUNT:
      if (key >= '0' && key <= '9') {
        current.amount = min(current.amount * 10 + (key - '0'), 4095);
        currentHasDigits = true;
      } else if (key == '*') {
        commitStep();
      } else if (direction >= 0) {                      // forgot the *: fine
        commitStep();
        beginStep(direction);
      }
      break;
    case P_SLOT:
    case P_SAVE:
      if (key >= '1' && key <= '9') {
        draftSlot = key - '0';
        stars = 0;
        programState = P_SAVE;
        out.print(F("program: slot "));
        out.print(draftSlot);
        out.println(F(" - * * saves"));
      } else if (key == 'O') {
        out.println(F("run: the new program"));
        runProgram(draft, draftCount);
      } else if (key == '*' && programState == P_SAVE) {
        if (++stars >= 2) saveDraft();
      }
      break;
  }
}

void handleKey(char key) {
  if (key >= 'a' && key <= 'z') key -= 'a' - 'A';
  out.print(F("ir: "));
  switch (key) {
    case 'U': out.println(F("up")); break;
    case 'D': out.println(F("down")); break;
    case 'L': out.println(F("left")); break;
    case 'R': out.println(F("right")); break;
    case 'O': out.println(F("ok")); break;
    default: out.println(key); break;
  }
  if (lightMode) {
    if (lightCal != CAL_DONE && key == 'O') lightCalSkip();
    else lightStop();
    return;
  }
  if (remoteMode == IDLE) handleKeyIdle(key);
  else handleKeyProgramming(key);
}

void irPoll() {
  bool repeated;
  noInterrupts();
  repeated = irRepeatSeen;
  irRepeatSeen = false;
  interrupts();
  if (repeated && irDriving) irHeldAt = millis();
  int code = irTakeKey();
  if (code >= 0) {
    char key = irKeyLetter(code);
    if (key) {
      handleKey(key);
    } else {
      out.print(F("ir: key 0x"));
      out.print(code, HEX);
      out.println(F(" not mapped"));
    }
  }
  if (irDriving) {
    if (millis() - irHeldAt > IR_RELEASE_MS) {
      stopDriving(true);
    } else if (movingForward && wallAhead()) {
      out.println(F("stop: something ahead"));
      stopDriving(false);
    }
  }
  if (vectorActive && millis() - vectorAt > VECTOR_TIMEOUT_MS) {
    vectorActive = false;
    stopAllWheels();
  }
  if (remoteMode == IDLE && (stars || pounds) && millis() - starAt > IR_STAR_TIMEOUT_MS) stars = pounds = 0;
}

// ===========================================================================
// COMMANDS (USB / Bluetooth)
// ===========================================================================
// m<bearing>,<mm>,<turn>;: mm on a bearing at DEMO_SPEED_MM_PER_SEC while
// turning turn degrees; mm 0 = turn in place. Blocks; x aborts.
void handleMove(const char *text) {
  int value[3];
  parseThreeInts(text, value);
  abortRequested = false;
  int bearing = ((value[0] % 360) + 360) % 360;
  movingForward = value[1] > 0 && (bearing < 45 || bearing > 315);
  out.println(F("move: start"));
  if (value[1] > 0) driveStraightWhileSpinning(value[0], value[1], DEMO_SPEED_MM_PER_SEC, value[2]);
  else spinInPlace(value[2], DEFAULT_SPIN_DEG_PER_SEC);
  stopAllWheels();
  movingForward = false;
  out.println(abortRequested ? F("move: ABORTED") : F("move: done"));
}

// p?; p<n>; p<n>=<steps>;
void handleProgramText(char *text) {
  Step steps[PROGRAM_MAX_STEPS];
  if (text[0] == '?') {
    for (byte slot = 1; slot <= PROGRAM_SLOTS; slot++) {
      byte count = loadProgram(slot, steps);
      out.print(F("P,"));
      out.print(slot);
      for (byte i = 0; i < count; i++) {
        out.print(',');
        out.print((char)pgm_read_byte(&STEP_LETTERS[steps[i].dir]));
        out.print(steps[i].dir == S_TURN_LEFT ? -(int)steps[i].amount : (int)steps[i].amount);
      }
      out.println();
    }
    out.println(F("P,end"));
    return;
  }
  byte slot = text[0] - '0';
  if (slot == 0 && text[1] == 0) { runCircle(); return; }   // p0; the circle
  if (slot < 1 || slot > PROGRAM_SLOTS) {
    out.print(F("program: bad "));
    out.println(text);
    return;
  }
  char *equals = strchr(text, '=');
  if (!equals) {
    runSlot(slot);
    return;
  }
  byte count = parseStepText(equals + 1, steps);
  saveProgram(slot, steps, count);
  out.print(F("program: slot "));
  out.print(slot);
  out.print(F(" = "));
  out.print(count);
  out.println(F(" steps"));
}

// k?; (the numbers, ending K,end), km, kw, kd and kN<name>; (* and # stand
// for x and X: those stop a command).
void handleConfigText(char *text) {
  if (strcmp(text, "?") == 0) {
    out.println(F("K,fw," FIRMWARE_VERSION));
    out.println(F("K,role," SKETCH_NAME));
    printRobotName(F("K,name,"));
    printMotion();
    out.println(F("K,end"));
    return;
  }
  if (text[0] == 'm') {   // km<i>=<value>; one number, live (kw keeps it)
    char *equals = strchr(text, '=');
    if (equals) {
      *equals = 0;
      byte index = atoi(text + 1);
      if (index < M_COUNT) motion[index] = atof(equals + 1);
    }
    printMotion();
    return;
  }
  if (strcmp(text, "w") == 0) {   // kw; save them on the robot (kept through power-off and uploads)
    saveMotion();
    out.println(F("config: saved"));
    return;
  }
  if (strcmp(text, "d") == 0) {   // kd; back to the code's numbers, and forget the saved ones
    memcpy_P(motion, MOTION_DEFAULT_VALUES, sizeof(motion));
    eeprom_update_word((uint16_t *)MOTION_EEPROM_ADDRESS, 0);
    motionFromEeprom = false;
    printMotion();
    return;
  }
  if (text[0] == 'N') {
    for (byte i = 0; i < 17; i++) {
      char c = i < 16 ? text[1 + i] : 0;
      if (c == '*') c = 'x';
      if (c == '#') c = 'X';
      eeprom_update_byte((uint8_t *)(BT_NAME_EEPROM_ADDRESS + 1 + i), c);
      if (!c) break;
    }
    eeprom_update_byte((uint8_t *)BT_NAME_EEPROM_ADDRESS, BT_NAME_PENDING);
    out.println(F("bt name: saved - switch the robot off and on"));
    return;
  }
  out.print(F("config: bad "));
  out.println(text);
}

void printHelp() {
  out.println(F("i<keys>; p?; p<n>; p<n>=<steps>; u b v<f>,<r>,<s>; m<bearing>,<mm>,<turn>; k?; km<i>=<v>; kw; kd; kN<name>; x ?"));
  out.println(F("ready"));
}

// An i, p, m, v or k command collects text up to ';' (or a newline) before it runs.
// (a full slot from the Blocks page, 16 x "t-180 ", is 99 characters)
char textCommand = 'k';
bool awaitingConfigText = false;
char configText[120];
byte configTextLength = 0;

void handleCommand(char command) {
  if (awaitingConfigText) {
    if (command == 'x') {
      awaitingConfigText = false;   // no command text contains x: it is a stop, handle it below
    } else if (command == ';') {
      awaitingConfigText = false;
      configText[configTextLength] = 0;
      if (textCommand == 'm') handleMove(configText);
      else if (textCommand == 'p') handleProgramText(configText);
      else if (textCommand == 'v') handleVector(configText);
      else if (textCommand == 'i') for (char *c = configText; *c; c++) handleKey(*c);
      else handleConfigText(configText);
      return;
    } else if (configTextLength < sizeof(configText) - 1) {
      configText[configTextLength++] = command;
      return;
    } else {
      awaitingConfigText = false;
      out.println(F("config: too long"));
      return;
    }
  }
  switch (command) {
    case 'x': lightStop(); stopDriving(false); out.println(F("stop")); break;
    case 'b': printLightReading(); break;
    case 'u': out.print(F("U,")); out.println(sonarMm(SONAR_TIMEOUT_US)); break;
    case 'k':
    case 'm':
    case 'p':
    case 'v':
    case 'i': textCommand = command; awaitingConfigText = true; configTextLength = 0; break;
    case '?': printHelp(); break;
    default: break;
  }
}

void setup() {
  Serial.begin(9600);
#if USE_BLUETOOTH_SOFTSERIAL
  bluetoothSerial.begin(9600);
  bluetoothStartUp();
#endif
  initMotorPins();
  stopAllWheels();
  irBegin();
  out.println(F(SKETCH_NAME " v" FIRMWARE_VERSION));
  out.print(F("ir: receiver on pin "));
  out.print(IR_RECEIVER_PIN);
#if USE_SONAR
  out.print(F(", sonar stop at "));
  out.print(SONAR_STOP_MM);
  out.println(F(" mm"));
#else
  out.println(F(", no sonar: back light sensor on A3"));
#endif
  printRobotName(F("ir: name "));
  loadMotion();
  printHelp();
}

// One byte from USB or Bluetooth, on its way to handleCommand
void handleIncoming(char incoming) {
  // Upper case is read as lower case, except right after k (kN, the name) or i (the keys)
  if (incoming >= 'A' && incoming <= 'Z' && !(awaitingConfigText && (textCommand == 'k' || textCommand == 'i'))) incoming = incoming - 'A' + 'a';
  if (incoming == '\r' || incoming == '\n') {
    handleCommand(';');
    return;
  }
  if (incoming == ' ' && !(awaitingConfigText && textCommand == 'p')) return;
  handleCommand(incoming);
}

void loop() {
  int incomingByte;
#if USE_BLUETOOTH_SOFTSERIAL
  // SoftwareSerial cannot receive while it transmits, and every reply goes
  // out on it. Let a burst from the module finish arriving (3 ms of quiet)
  // before handling anything in it that could answer or take time, or the
  // reply to its first command cuts off the rest. SoftwareSerial keeps only
  // 64 bytes and a full slot line from the Blocks page is 100, so the text of
  // a command (which only gets stored) goes straight in as it arrives; from
  // the first byte that ends or runs something, the rest is held for the quiet.
  if (bluetoothSerial.available()) {
    static char btHeld[24];
    byte held = 0;
    unsigned long quietSince = micros();
    while (micros() - quietSince < 3000) {
      while (bluetoothSerial.available()) {
        char c = bluetoothSerial.read();
        quietSince = micros();
        bool onlyStored = awaitingConfigText ? (c != ';' && c != '\r' && c != '\n' && c != 'x' && c != 'X')
                                             : (c == ' ' || strchr("kmpviKMPVI", c) != NULL);
        if (!held && c && onlyStored) handleIncoming(c);
        else if (held < sizeof(btHeld)) btHeld[held++] = c;
      }
    }
    for (byte i = 0; i < held; i++) handleIncoming(btHeld[i]);
  }
#endif
  while ((incomingByte = readCommandByte()) >= 0) handleIncoming((char)incomingByte);
  irPoll();
  lightTick();
  btFlush();
}

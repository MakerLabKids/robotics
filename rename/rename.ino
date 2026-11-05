// rename.ino   (v0.2.4 - names the robot: its Bluetooth module (the kit's HC-06, or an HC-05) gets the
//               robot's name, so a room full of robots is not a list of ten "HC-06"s)
//
// Flash this, open mecanum/rename.html, connect with the USB cable, type
// the name, Rename: the module is renamed on the spot (it only takes commands
// while nothing is connected to it over Bluetooth) and answers OKsetname.
// Then flash mecanum_holonomic.ino again. Connected over Bluetooth instead,
// the name is saved and given to the module at the next power-on.
//
// Two kinds of module:
//   HC-06 (the kit's, linvor firmware): always ready for AT commands while
//     unpaired, at the data speed (9600), NO line end, acted on after about a
//     second of quiet: AT+VERSION -> OKlinvorV1.8, AT+NAMERexy -> OKsetname.
//   HC-05 (a spare): only in its AT mode, entered by holding the module's
//     button while the robot is powered on (its LED then blinks slowly); the
//     classic firmware talks AT at 38400 with line ends: AT+VERSION? ->
//     +VERSION:..., AT+NAME=Rexy -> OK. Newer HC-05 firmware takes the same
//     at 9600 while the button is held. Power-cycle to leave AT mode.
// At start-up this asks all three ways and remembers which one answered.
//
// The kit's module has TWO names (found on the class robots, 2026-11-05). It
// answers like a linvor HC-06 and AT+NAME renames what a phone's Bluetooth
// settings show (the classic name). But it is a BLE device as well (service
// FFE0), and the list a web page gets shows the BLE name, which AT+NAME
// leaves at HC-06. Which command sets that one depends on who made the chip,
// so B<name> tries the usual ones and prints every answer (USB only).
//
// COMMANDS (9600 baud, USB or Bluetooth; a newline or ; ends them)
//   N<name>   rename now (USB), or save for the next power-on (Bluetooth)
//   B<name>   try the commands for the name a web page's list shows (USB)
//   A<text>   send <text> to the module as it is and print its answer, then a
//             line end and that answer (USB)
//   L<text>   send <text> and a line end in one go, print the answer (USB)
//   v         ask the module what it is (bt module: ...)
//   ?         this list
// ---------------------------------------------------------------------------

#include <Arduino.h>
#include <avr/eeprom.h>
#include <SoftwareSerial.h>

#define FIRMWARE_VERSION "0.2.4"
#define SKETCH_NAME "rename"

const byte BLUETOOTH_RX_PIN = A0;   // module TXD -> this pin
const byte BLUETOOTH_TX_PIN = A1;   // this pin -> module RXD
SoftwareSerial bluetoothSerial(BLUETOOTH_RX_PIN, BLUETOOTH_TX_PIN);

// A name saved for the next power-on: BT_NAME_PENDING, then up to 20 characters and a 0.
// (Past the motion numbers mecanum_holonomic keeps at 920.)
const int BT_NAME_EEPROM_ADDRESS = 1040;
const byte BT_NAME_PENDING = 0x5A;
const byte NAME_MAX = 20;

// Everything the sketch says goes to USB and to the module (so a Bluetooth
// connection hears it too), except AT traffic, which is USB only.
class DualPrint : public Print {
 public:
  size_t write(uint8_t c) override {
    Serial.write(c);
    bluetoothSerial.write(c);
    return 1;
  }
};
DualPrint out;

// Which module answered: how to talk to it. HC-05: at moduleBaud, with line ends.
const byte MODULE_NONE = 0, MODULE_HC06 = 1, MODULE_HC05 = 2;
byte moduleKind = MODULE_NONE;
long moduleBaud = 9600;
const long HC05_BAUDS[] = { 38400, 9600, 57600, 115200 };

void btSend(const char *text, bool fromFlash) {
  char c;
  while ((c = fromFlash ? pgm_read_byte(text) : *text)) {
    bluetoothSerial.write(c);
    text++;
  }
}

// Send an AT command (the HC-05 forms end with a line end) and collect the
// printable answer (the HC-06 answers after ~1 s). Talking to an HC-05, a
// bare AT first wakes the link up: the first command after a speed change is
// often eaten.
void btWake() {
  if (moduleKind == MODULE_HC06) return;
  while (bluetoothSerial.read() >= 0) {}
  btSend(PSTR("AT\r\n"), true);
  for (unsigned long t = millis(); millis() - t < 400;) bluetoothSerial.read();
}

byte btAsk(const char *command, const char *argument, char *reply, byte size) {
  while (bluetoothSerial.read() >= 0) {}
  btSend(command, true);
  if (argument) btSend(argument, false);
  if (moduleKind != MODULE_HC06) btSend(PSTR("\r\n"), true);
  byte length = 0;
  for (unsigned long t = millis(); millis() - t < 1500;) {
    int c = bluetoothSerial.read();
    if (c >= ' ' && c <= '~' && length < size - 1) reply[length++] = c;
  }
  reply[length] = 0;
  return length;
}

// Try the HC-06 way, then the HC-05 way at each speed (twice: the first
// command after a speed change is often eaten); remember what answered. When
// nothing did, show what came back at each speed, so a wrong speed shows as
// garbage rather than silence.
void askModule() {
  char reply[40];
  char seen[4][12];
  Serial.print(F("bt module: "));
  moduleKind = MODULE_HC06;
  moduleBaud = 9600;
  bluetoothSerial.begin(9600);
  if (btAsk(PSTR("AT+VERSION"), NULL, reply, sizeof(reply)) && strstr(reply, "OK")) {
    Serial.print(F("HC-06 "));
    Serial.println(reply);
    return;
  }
  moduleKind = MODULE_HC05;
  for (byte b = 0; b < 4; b++) {
    moduleBaud = HC05_BAUDS[b];
    bluetoothSerial.begin(moduleBaud);
    seen[b][0] = 0;
    for (byte attempt = 0; attempt < 2; attempt++) {
      if (btAsk(PSTR("AT"), NULL, reply, sizeof(reply)) && strstr(reply, "OK")) {
        btAsk(PSTR("AT+VERSION?"), NULL, reply, sizeof(reply));
        Serial.print(F("HC-05 (AT mode, "));
        Serial.print(moduleBaud);
        Serial.print(F(") "));
        Serial.println(reply);
        return;
      }
      if (reply[0] && !seen[b][0]) {
        strncpy(seen[b], reply, sizeof(seen[b]) - 1);
        seen[b][sizeof(seen[b]) - 1] = 0;
      }
    }
  }
  moduleKind = MODULE_NONE;
  moduleBaud = 9600;
  Serial.print(F("no answer. Heard: HC-06 way -, "));
  for (byte b = 0; b < 4; b++) {
    Serial.print(HC05_BAUDS[b]);
    Serial.print(F(": "));
    Serial.print(seen[b][0] ? seen[b] : "-");
    Serial.print(b < 3 ? F(", ") : F(". "));
  }
  Serial.println(F("HC-06: is something connected to it over Bluetooth? HC-05: hold its button while switching the robot on, and check TXD->A0, RXD->A1"));
}

// AT+NAME<name>, then the module's answer: "bt name: <name> - set" when it
// took it. quiet: say nothing when it did not (the caller saves it instead).
bool renameModule(const char *name, bool quiet) {
  char reply[40];
  if (moduleKind == MODULE_NONE) askModule();   // it may have been put in AT mode since start-up
  if (moduleKind != MODULE_NONE) bluetoothSerial.begin(moduleBaud);
  bool ok = false;
  for (byte attempt = 0; attempt < 2 && !ok && moduleKind != MODULE_NONE; attempt++) {
    btWake();
    ok = btAsk(moduleKind == MODULE_HC06 ? PSTR("AT+NAME") : PSTR("AT+NAME="), name, reply, sizeof(reply)) && strstr(reply, "OK");
  }
  char readBack[40] = "", uart[40] = "";
  if (ok && moduleKind == MODULE_HC05) {
    btWake();
    btAsk(PSTR("AT+NAME?"), NULL, readBack, sizeof(readBack));   // "+NAME:Rexy OK"
    // The data speed the robot sketches talk at: 9600, 1 stop bit, no parity.
    btWake();
    btAsk(PSTR("AT+UART=9600,0,0"), NULL, uart, sizeof(uart));
    btWake();
    btAsk(PSTR("AT+UART?"), NULL, uart, sizeof(uart));            // "+UART:9600,0,0 OK"
  }
  bluetoothSerial.begin(9600);
  if (ok || !quiet) {
    out.print(F("bt name: "));
    out.print(name);
    if (!ok) {
      out.println(F(" - the module did not answer (HC-06: is something connected to it over Bluetooth? HC-05: hold its button while switching the robot on)"));
    } else if (moduleKind == MODULE_HC06) {
      out.println(F(" - set"));
    } else {
      out.print(F(" - set; the module says its name is "));
      char *colon = strchr(readBack, ':');
      char *end = colon ? strstr(colon, "OK") : NULL;
      if (end) *end = 0;
      out.print(colon ? colon + 1 : readBack);
      out.print(F(", data speed "));
      colon = strchr(uart, ':');
      end = colon ? strstr(colon, "OK") : NULL;
      if (end) *end = 0;
      out.print(colon ? colon + 1 : uart);
      out.println(F(". Switch the robot off and on to leave AT mode. Phones cache the old name: forget HC-05 in the phone's Bluetooth settings and scan again."));
    }
  }
  return ok;
}

// --- The other name: the one a web page's Bluetooth list shows ---------------
// One try: the command as it is and what the module says within 1.5 s (the
// linvor way: no line end, acted on after a second of quiet), then a line end
// and what it says to that (the way of modules that wait for one). The line
// end also empties the module's line, so the next try starts clean. Answers go
// to USB only: anything sent to the module now would be a command to it.
// Took it: an OK, or the name said back (+NAMB=Rexy) without an error.
const char TRY_HELP[] PROGMEM = "AT+HELP";
const char TRY_NAMB[] PROGMEM = "AT+NAMB";         // HM-style dual-mode modules
const char TRY_LENAME_EQ[] PROGMEM = "AT+LENAME=";   // Feasycom-style
const char TRY_LENAME[] PROGMEM = "AT+LENAME";
const char TRY_BNAME_EQ[] PROGMEM = "AT+BNAME=";     // HC-04-style
const char TRY_BNAME[] PROGMEM = "AT+BNAME";

bool btTry(const char *command, const char *argument, bool commandInFlash, bool lineEndOnly) {
  char reply[96];
  bool took = false;
  for (byte lineEnd = lineEndOnly ? 1 : 0; lineEnd < 2 && !took; lineEnd++) {
    while (bluetoothSerial.read() >= 0) {}
    if (!lineEnd || lineEndOnly) {
      btSend(command, commandInFlash);
      if (argument) btSend(argument, false);
    }
    if (lineEnd) btSend(PSTR("\r\n"), true);
    byte length = 0;
    for (unsigned long t = millis(); millis() - t < 1500;) {
      int c = bluetoothSerial.read();
      if (c >= ' ' && c <= '~' && length < sizeof(reply) - 1) reply[length++] = c;
    }
    reply[length] = 0;
    took = strstr(reply, "OK") || (argument && strstr(reply, argument) && !strstr(reply, "ERR"));
    Serial.print(F("bt try: "));
    if (commandInFlash) Serial.print((const __FlashStringHelper *)command); else Serial.print(command);
    if (argument) Serial.print(argument);
    Serial.print(lineEnd ? F(" + line end -> ") : F(" -> "));
    Serial.println(length ? reply : "nothing");
    if (lineEndOnly) break;
  }
  return took;
}

void tryOtherName(const char *name) {
  if (moduleKind == MODULE_HC05) bluetoothSerial.begin(moduleBaud);
  btTry(TRY_HELP, NULL, true, false);   // some modules list their commands
  bool took = btTry(TRY_NAMB, name, true, false) || btTry(TRY_LENAME_EQ, name, true, false) || btTry(TRY_LENAME, name, true, false) ||
    btTry(TRY_BNAME_EQ, name, true, false) || btTry(TRY_BNAME, name, true, false);
  bluetoothSerial.begin(9600);
  Serial.println(took ? F("bt try: done - the module took one: switch the robot off and on, then look at the web page's Bluetooth list") :
    F("bt try: done - the module took none of them"));
}

void savePending(const char *name) {
  for (byte i = 0; i <= NAME_MAX; i++) {
    eeprom_update_byte((uint8_t *)(BT_NAME_EEPROM_ADDRESS + 1 + i), name[i]);
    if (!name[i]) break;
  }
  eeprom_update_byte((uint8_t *)BT_NAME_EEPROM_ADDRESS, BT_NAME_PENDING);
  out.print(F("bt name: "));
  out.print(name);
  out.println(F(" - saved: switch the robot off and on"));
}

void renamePending() {
  if (eeprom_read_byte((const uint8_t *)BT_NAME_EEPROM_ADDRESS) != BT_NAME_PENDING) return;
  char name[NAME_MAX + 1];
  eeprom_read_block(name, (const void *)(BT_NAME_EEPROM_ADDRESS + 1), NAME_MAX + 1);
  name[NAME_MAX] = 0;
  eeprom_update_byte((uint8_t *)BT_NAME_EEPROM_ADDRESS, 0);   // once, either way
  renameModule(name, false);
}

// Letters, digits, - and _: anything else out (the apps send x and X as * and #).
void cleanName(char *name) {
  byte j = 0;
  for (byte i = 0; name[i] && j < NAME_MAX; i++) {
    char c = name[i];
    if (c == '*') c = 'x';
    if (c == '#') c = 'X';
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_') name[j++] = c;
  }
  name[j] = 0;
}

void printHelp() {
  out.println(F("N<name> (rename), B<name> (try the web list name), A<text> / L<text> (to the module), v (module), ?"));
  out.println(F("ready"));
}

char lineText[48];
byte lineLength = 0;
bool lineFromUsb = true;

void handleLine(char *text, bool fromUsb) {
  if (text[0] == 'N' || text[0] == 'n' || (text[0] == 'k' && (text[1] == 'N' || text[1] == 'n'))) {
    char *name = text + (text[0] == 'k' ? 2 : 1);
    cleanName(name);
    if (!name[0]) {
      out.println(F("bt name: nothing to set (letters, digits, - and _ only)"));
      return;
    }
    if (fromUsb) {
      if (!renameModule(name, true)) savePending(name);   // no answer now: at the next power-on
    } else {
      savePending(name);   // the module is busy talking to us: at the next power-on
    }
    return;
  }
  if (text[0] == 'B' || text[0] == 'A' || text[0] == 'L') {
    if (!fromUsb) {
      out.println(F("bt try: plug in the USB cable for this (the module takes commands only while nothing is connected to it)"));
      return;
    }
    if (text[0] == 'B') {
      cleanName(text + 1);
      if (!text[1]) {
        Serial.println(F("bt try: no name (letters, digits, - and _ only)"));
        return;
      }
      tryOtherName(text + 1);
    } else if (text[1]) {
      btTry(text + 1, NULL, false, text[0] == 'L');
    }
    return;
  }
  if (text[0] == 'v') {
    askModule();
    bluetoothSerial.begin(9600);
    return;
  }
  printHelp();
}

void setup() {
  Serial.begin(9600);
  bluetoothSerial.begin(9600);
  delay(600);   // the module boots too
  askModule();
  renamePending();
  bluetoothSerial.begin(9600);   // listen for commands at the data speed
  out.println(F(SKETCH_NAME " v" FIRMWARE_VERSION));
  printHelp();
}

void loop() {
  int c = -1;
  bool fromUsb = true;
  if (Serial.available()) {
    c = Serial.read();
  } else if (bluetoothSerial.available()) {
    c = bluetoothSerial.read();
    fromUsb = false;
  }
  if (c < 0) return;
  if (c == '\r' || c == '\n' || c == ';') {
    if (lineLength) {
      lineText[lineLength] = 0;
      handleLine(lineText, lineFromUsb);
    }
    lineLength = 0;
    return;
  }
  if (lineLength == 0) lineFromUsb = fromUsb;
  if (c != ' ' && lineLength < sizeof(lineText) - 1) lineText[lineLength++] = (char)c;
}

// sonar-test.ino   (v0.1.0 - what the HC-SR04 on A2 / A3 really does)
//
// Upload, open the Serial Monitor at 9600, hold a hand about 20 cm in front of the
// sonar. Every half second it pings twice and prints one line per try:
//   as wired  (Trig A3, Echo A2, the class wiring)
//   swapped   (Trig A2, Echo A3, in case the two wires are crossed)
// For each: Echo at rest (should be 0), how long Echo took to start after the ping
// (us), how long it stayed high (us) and that as a distance (mm). It waits up to 60 ms
// for each, much longer than programming.ino (2 ms to start, 25 ms high), so a slow
// or odd module still shows up here. Afterwards, upload programming.ino again.
// No motors, no Bluetooth: nothing else on the robot moves.

#define FIRMWARE_VERSION "0.1.0"
const unsigned long WAIT_US = 60000UL;

void tryPing(const __FlashStringHelper *label, byte trigPin, byte echoPin) {
  pinMode(echoPin, INPUT);
  pinMode(trigPin, OUTPUT);
  digitalWrite(trigPin, LOW);
  delayMicroseconds(4);
  int restLevel = digitalRead(echoPin);
  int restAnalog = analogRead(echoPin);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  unsigned long pingedAt = micros();
  long startUs = -1, highUs = -1;
  while (micros() - pingedAt < WAIT_US) {
    if (digitalRead(echoPin)) { startUs = micros() - pingedAt; break; }
  }
  if (startUs >= 0) {
    unsigned long roseAt = micros();
    while (micros() - roseAt < WAIT_US) {
      if (!digitalRead(echoPin)) { highUs = micros() - roseAt; break; }
    }
  }
  pinMode(trigPin, INPUT);
  Serial.print(label);
  Serial.print(F(": echo at rest "));
  Serial.print(restLevel);
  Serial.print(F(" ("));
  Serial.print(restAnalog);
  Serial.print(F("/1023), start "));
  if (startUs < 0) Serial.print(F("never"));
  else { Serial.print(startUs); Serial.print(F(" us")); }
  Serial.print(F(", high "));
  if (startUs < 0) Serial.print(F("-"));
  else if (highUs < 0) Serial.print(F("over 60000 us (stuck high?)"));
  else { Serial.print(highUs); Serial.print(F(" us = ")); Serial.print(highUs * 343L / 2000L); Serial.print(F(" mm")); }
  Serial.println();
}

void setup() {
  Serial.begin(9600);
  Serial.println(F("sonar-test v" FIRMWARE_VERSION ": Trig A3 / Echo A2 as wired, then swapped. Hand ~20 cm in front."));
}

void loop() {
  tryPing(F("as wired (Trig A3, Echo A2)"), A3, A2);
  delay(80);
  tryPing(F("swapped  (Trig A2, Echo A3)"), A2, A3);
  Serial.println();
  delay(420);
}

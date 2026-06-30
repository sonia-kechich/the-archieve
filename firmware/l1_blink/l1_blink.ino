const uint8_t BEACON = 13;
const unsigned long PERIOD = 500;

unsigned long lastToggle = 0;
bool beaconOn = false;

void setup() {
  pinMode(BEACON, OUTPUT);
}

void loop() {
  unsigned long now = millis();
  if (now - lastToggle >= PERIOD) {
    lastToggle = now;
    beaconOn = !beaconOn;
    digitalWrite(BEACON, beaconOn ? HIGH : LOW);
  }
}

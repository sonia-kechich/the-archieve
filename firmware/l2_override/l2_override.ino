const uint8_t BEACON = 13;
const uint8_t BUTTON = 2;
const unsigned long DEBOUNCE = 20;

int  lastRead    = HIGH;
int  stableState = HIGH;
unsigned long lastChange = 0;

void setup() {
  pinMode(BEACON, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
}

void loop() {
  int reading = digitalRead(BUTTON);

  if (reading != lastRead) {
    lastChange = millis();
    lastRead = reading;
  }

  if (millis() - lastChange >= DEBOUNCE) {
    stableState = reading;
  }

  digitalWrite(BEACON, stableState == LOW ? HIGH : LOW);
}

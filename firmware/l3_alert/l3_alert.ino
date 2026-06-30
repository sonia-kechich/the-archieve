const uint8_t RED    = 13;
const uint8_t GREEN  = 12;
const uint8_t BUZZER = 8;
const uint8_t BUTTON = 2;
const unsigned long DEBOUNCE = 20;

int  lastRead    = HIGH;
int  stableState = HIGH;
unsigned long lastChange = 0;

void setup() {
  pinMode(RED,    OUTPUT);
  pinMode(GREEN,  OUTPUT);
  pinMode(BUZZER, OUTPUT);
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

  if (stableState == LOW) {
    digitalWrite(RED,    HIGH);
    digitalWrite(GREEN,  LOW);
    digitalWrite(BUZZER, HIGH);
  } else {
    digitalWrite(RED,    LOW);
    digitalWrite(GREEN,  HIGH);
    digitalWrite(BUZZER, LOW);
  }
}

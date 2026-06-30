# SECTOR 02 — firmware & realism pipeline

The Arduino Nano in Levels 1–3 runs **real ATmega328P firmware**, compiled here
with `avr-gcc` and executed in the browser by [avr8js](https://github.com/wokwi/avr8js).

## Files

| Path | What it is |
|------|------------|
| `l1_blink/l1_blink.ino`    | Level 1 — beacon blink (millis-based) |
| `l2_override/l2_override.ino` | Level 2 — button override (INPUT_PULLUP + 20 ms debounce) |
| `l3_alert/l3_alert.ino`    | Level 3 — alert array (1 input → red/green/buzzer) |
| `build_fw.js`  | Intel-HEX → base64 program image + sketch source → `../js/firmware.js` |
| `verify_fw.js` | runs each compiled image on real avr8js and checks pin behaviour |
| `../js/firmware.js` | **generated** — `window.FW` (flash images) + `window.FW_SRC` (source shown in-game) |

## Rebuild after editing a sketch

The AVR toolchain is vendored under `../tools` (arduino-cli + arduino:avr, which
ships `avr-gcc`). From the project root:

```sh
export ARDUINO_DIRECTORIES_DATA="$PWD/tools/ard-data"
export ARDUINO_DIRECTORIES_DOWNLOADS="$PWD/tools/ard-dl"
export ARDUINO_DIRECTORIES_USER="$PWD/tools/ard-user"

for d in l1_blink l2_override l3_alert; do
  ./tools/arduino-cli.exe compile --fqbn arduino:avr:nano --output-dir "build/$d" "firmware/$d"
done

node firmware/build_fw.js     # regenerate js/firmware.js
node firmware/verify_fw.js     # sanity-check the images on avr8js
```

## UI / acceptance tests

```sh
cd test && npm install        # one-time (puppeteer-core)
node run.js                    # boots Chrome headless, wires each level,
                               # asserts the win, screenshots, checks console
node closeup.js                # high-DPI close-up of the board silkscreen
```

Screenshots land in `../screenshots`.

## Pin → port mapping (ATmega328P, as wired in `app.js`)

| Arduino | Port/bit | Role in these levels |
|---------|----------|----------------------|
| D13 | PB5 | red beacon LED (also the on-board **L** LED) |
| D12 | PB4 | green all-clear LED |
| D8  | PB0 | active buzzer |
| D2  | PD2 | button input (INPUT_PULLUP) |

PWM (D3/D5/D6/D9/D10/D11) and ADC (A0–A7) are present on the silkscreen but
unused — no level needs an analog signal.

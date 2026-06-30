/* Headless sanity check: run each compiled firmware on the REAL avr8js
   and confirm the pin behaviour the game relies on. No browser needed. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// load the vendored avr8js (defines `var AVR = (...)`)
const AVR = (function () { eval(fs.readFileSync(path.join(ROOT, 'js/avr8js.min.js'), 'utf8')); return AVR; })();
const { FW } = (function () { eval(fs.readFileSync(path.join(ROOT, 'js/firmware.js'), 'utf8').replace(/window\./g, 'var ')); return { FW }; })();

const CLOCK = 16e6;
function b64(b) { return Uint8Array.from(Buffer.from(b, 'base64')); }
function makeRunner(key) {
  const flash = new Uint16Array(0x4000); new Uint8Array(flash.buffer).set(b64(FW[key]));
  const cpu = new AVR.CPU(flash);
  new AVR.AVRTimer(cpu, AVR.timer0Config);
  new AVR.AVRTimer(cpu, AVR.timer1Config);
  new AVR.AVRTimer(cpu, AVR.timer2Config);
  return { cpu, portB: new AVR.AVRIOPort(cpu, AVR.portBConfig), portD: new AVR.AVRIOPort(cpu, AVR.portDConfig) };
}
const HIGH = AVR.PinState.High;
function runMs(r, ms) { const target = r.cpu.cycles + Math.floor(CLOCK * ms / 1000); while (r.cpu.cycles < target) { AVR.avrInstruction(r.cpu); r.cpu.tick(); } }
function d13(r) { return r.portB.pinState(5) === HIGH; }
function d12(r) { return r.portB.pinState(4) === HIGH; }
function d8(r) { return r.portB.pinState(0) === HIGH; }

let pass = true;
function check(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) pass = false; }

// ---- L1 blink: D13 must toggle, ~500 ms each phase ----
(function () {
  const r = makeRunner('blink');
  let high = 0, low = 0, lastEdge = 0, periods = [], prev = null;
  for (let ms = 0; ms < 1600; ms++) {
    runMs(r, 1); const on = d13(r);
    if (on) high++; else low++;
    if (prev !== null && on !== prev) { periods.push(ms - lastEdge); lastEdge = ms; }
    prev = on;
  }
  check('L1 D13 goes HIGH', high > 100);
  check('L1 D13 goes LOW', low > 100);
  const avg = periods.length ? periods.reduce((a, b) => a + b, 0) / periods.length : 0;
  check('L1 half-period ~500ms (got ' + Math.round(avg) + ')', avg > 440 && avg < 560);
})();

// ---- L2 override: released -> D13 low; held -> D13 high (after debounce) ----
(function () {
  const r = makeRunner('btn');
  r.portD.setPin(2, true);            // released = HIGH
  runMs(r, 80);
  check('L2 released -> D13 LOW', d13(r) === false);
  r.portD.setPin(2, false);           // pressed = LOW (pull-up overridden)
  runMs(r, 80);                       // > debounce window
  check('L2 held -> D13 HIGH', d13(r) === true);
  r.portD.setPin(2, true);
  runMs(r, 80);
  check('L2 release -> D13 LOW again', d13(r) === false);
})();

// ---- L3 alert: all-clear -> green; alert -> red+buzzer ----
(function () {
  const r = makeRunner('alert');
  r.portD.setPin(2, true);            // all-clear
  runMs(r, 80);
  check('L3 all-clear -> D12 green HIGH', d12(r) === true);
  check('L3 all-clear -> D13 red LOW', d13(r) === false);
  check('L3 all-clear -> D8 buzzer LOW', d8(r) === false);
  r.portD.setPin(2, false);           // alert
  runMs(r, 80);
  check('L3 alert -> D13 red HIGH', d13(r) === true);
  check('L3 alert -> D12 green LOW', d12(r) === false);
  check('L3 alert -> D8 buzzer HIGH', d8(r) === true);
})();

console.log(pass ? '\nALL FIRMWARE CHECKS PASSED' : '\nFIRMWARE CHECKS FAILED');
process.exit(pass ? 0 : 1);

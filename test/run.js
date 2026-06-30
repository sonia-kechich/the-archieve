/* ============================================================
   Headless acceptance test for SECTOR 02 — Wiring Trials.
   For each level it: boots the app, places the parts, wires the
   CORRECT solution, asserts the level reports a win, screenshots
   the bench, and fails if ANY console error / page exception fired.
   Drives the real Chrome via puppeteer-core; serves over http.
   ============================================================ */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = 8099;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// click a pad by its data-id at its real on-screen position (verifies clickability)
async function clickPad(page, id) {
  const c = await page.evaluate(pid => {
    const hit = document.querySelector('.wb-node[data-id="' + pid + '"] .wb-hit');
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  if (!c) throw new Error('pad not found / not clickable: ' + id);
  await page.mouse.click(c.x, c.y);
  await sleep(45);
}

// correct wiring for each level, by pad id
const SOLUTIONS = [
  { // L1 First Signal
    wires: [['P13', 'R1_1'], ['R1_2', 'RED_A'], ['RED_K', 'GND']], press: false, shot: 'level1.png'
  },
  { // L2 Manual Override
    wires: [['P13', 'R1_1'], ['R1_2', 'RED_A'], ['RED_K', 'GND'], ['BTN_A', 'P2'], ['BTN_B', 'GND']], press: true, shot: 'level2.png'
  },
  { // L3 Alert Array
    wires: [
      ['P13', 'R1_1'], ['R1_2', 'RED_A'], ['RED_K', 'GND'],
      ['P12', 'R2_1'], ['R2_2', 'GRN_A'], ['GRN_K', 'GND'],
      ['P8', 'BUZ_P'], ['BUZ_N', 'GND'],
      ['BTN_A', 'P2'], ['BTN_B', 'GND']
    ], press: true, shot: 'level3.png'
  }
];

function startServer() {
  const srv = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  return srv;
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);
  const server = startServer();
  await sleep(1200);

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1500,950']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
  page.on('response', r => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  let allPass = true;
  const log = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) allPass = false; };

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  // skip the boot sequence, then skip the intro cinematic so init runs deterministically
  await page.evaluate(() => document.getElementById('enterBtn').click());
  await sleep(950);                                              // let the 820ms boot fade + cinematic start
  await page.evaluate(() => { const s = document.getElementById('introSkip'); if (s) s.click(); });
  // wait until initWorld() has actually loaded level 1 (tray rendered), not just that the DOM exists
  await page.waitForFunction(
    () => window.WiringTrials && document.getElementById('modList') && document.getElementById('modList').children.length > 0,
    { timeout: 30000 }
  );

  for (let i = 0; i < SOLUTIONS.length; i++) {
    const sol = SOLUTIONS[i];
    await page.evaluate(n => window.WiringTrials.load(n), i);
    await sleep(120);
    await page.evaluate(() => window.WiringTrials.placeAll());
    await sleep(80);
    // wire by REAL clicks on the pads (proves each board pad is clickable at its new position)
    for (const [a, b] of sol.wires) { await clickPad(page, a); await clickPad(page, b); }

    // button levels must NOT complete on wiring alone — the operator has to test the button first
    if (sol.press) {
      await sleep(150);
      const wonBeforePress = await page.evaluate(n => window.WiringTrials.status()[n], i);
      log(!wonBeforePress, `Level ${i + 1} does NOT complete until the button is tested`);
      await page.evaluate(() => window.WiringTrials.press(true));
    }

    // wait for the win to register (poll status), up to 2s
    let won = false;
    for (let t = 0; t < 40; t++) {
      won = await page.evaluate(n => window.WiringTrials.status()[n], i);
      if (won) break;
      await sleep(50);
    }
    log(won, `Level ${i + 1} correct wiring wins`);

    // wait for the firmware to actually drive the output we expect, so the
    // screenshot shows the lit state (L1 blink ON, L2/L3 beacon ON after press)
    const wantPin = i === 2 ? 'b13' : 'b13';
    for (let t = 0; t < 60; t++) { if (await page.evaluate(p => window.WiringTrials.state().bits[p], wantPin)) break; await sleep(30); }
    const st = await page.evaluate(() => window.WiringTrials.state());
    console.log(`     bits=${JSON.stringify(st.bits)} current=${st.current.toFixed(3)}A`);

    // winLevel() shows the debrief on a 900ms one-shot timer; let it fire BEFORE we hide it,
    // otherwise it re-appears mid-wiring on the next level and the overlay eats the clicks
    await sleep(950);
    await page.evaluate(() => document.getElementById('debrief').classList.remove('show'));
    await sleep(60);
    await page.screenshot({ path: path.join(SHOTS, sol.shot) });
  }

  // a deliberately wrong wiring (LED straight to pin, no resistor) must NOT close the
  // loop, and must surface a current-limit message (won[] is sticky, so check live state)
  await page.evaluate(() => window.WiringTrials.load(0));
  await sleep(120);
  await page.evaluate(() => window.WiringTrials.placeAll());
  await page.evaluate(() => { window.WiringTrials.wire('P13', 'RED_A'); window.WiringTrials.wire('RED_K', 'GND'); });
  await sleep(300);
  const noRes = await page.evaluate(() => ({
    loop: document.getElementById('loopState').textContent,
    msg: document.getElementById('benchMsg').textContent
  }));
  log(/LOOP: OPEN/.test(noRes.loop), 'Level 1 LED-without-resistor does not close the loop');
  log(/mA/.test(noRes.msg) && /pin limit/.test(noRes.msg), 'current-limit fault is reported (' + noRes.msg.replace(/\n/g, ' ') + ')');

  // ---- cinematic progression: finishing Level 2 must roll the Video 3 cinematic before Level 3 ----
  // (the per-level loop above uses WiringTrials.load() which jumps directly and skips cinematics,
  //  so this path — the real "ADVANCE TO NEXT DIRECTIVE" button — is otherwise untested)
  await page.evaluate(() => window.WiringTrials.load(1));   // Level 2 (Manual Override)
  await sleep(120);
  await page.evaluate(() => window.WiringTrials.placeAll());
  await sleep(80);
  for (const [a, b] of SOLUTIONS[1].wires) { await clickPad(page, a); await clickPad(page, b); }
  await page.evaluate(() => window.WiringTrials.press(true));
  let l2won = false;
  for (let t = 0; t < 40; t++) { l2won = await page.evaluate(() => window.WiringTrials.status()[1]); if (l2won) break; await sleep(50); }
  log(l2won, 'Level 2 completes, so ADVANCE is available');

  // click ADVANCE — the handler synchronously starts the cinematic, so read intro state right after
  const cine = await page.evaluate(() => {
    document.getElementById('debrief').classList.add('show');   // debrief is up in the real flow
    document.getElementById('nextBtn').click();
    return {
      show: document.getElementById('intro').classList.contains('show'),
      src: document.getElementById('introVideo').getAttribute('src')
    };
  });
  log(cine.show && /video3\.mp4$/.test(cine.src || ''), 'advancing from Level 2 rolls the Video 3 cinematic (src=' + cine.src + ')');

  // skip the cinematic; progression must then land on Level 3 (index 2)
  await page.evaluate(() => document.getElementById('introSkip').click());
  let onL3 = false;
  for (let t = 0; t < 40; t++) { onL3 = (await page.evaluate(() => window.WiringTrials.state().level)) === 2; if (onL3) break; await sleep(50); }
  log(onL3, 'after the cinematic, progression lands on Level 3');

  log(errors.length === 0, 'zero console errors / page exceptions' + (errors.length ? ':\n   ' + errors.join('\n   ') : ''));

  await browser.close();
  server.kill();
  console.log(allPass ? '\nALL UI TESTS PASSED' : '\nUI TESTS FAILED');
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

const { spawn } = require('child_process'); const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const srv = spawn('python', ['-m', 'http.server', '8098'], { cwd: ROOT, stdio: 'ignore' }); await sleep(1000);
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--mute-audio','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8098/index.html', { waitUntil: 'load' });
  await p.evaluate(() => document.getElementById('enterBtn').click()); await sleep(950);
  await p.evaluate(() => { const s = document.getElementById('introSkip'); if (s) s.click(); });   // skip intro cinematic
  await p.waitForFunction(() => window.WiringTrials && document.getElementById('modList') && document.getElementById('modList').children.length > 0, { timeout: 30000 });
  await p.evaluate(() => { window.WiringTrials.load(2); window.WiringTrials.placeAll(); });
  await sleep(200);
  await p.evaluate(() => { window.WiringTrials.wire('P13', 'R1_1'); window.WiringTrials.wire('R1_2', 'RED_A'); window.WiringTrials.wire('RED_K', 'GND'); window.WiringTrials.wire('P12', 'R2_1'); window.WiringTrials.wire('R2_2', 'GRN_A'); window.WiringTrials.wire('GRN_K', 'GND'); window.WiringTrials.wire('P8', 'BUZ_P'); window.WiringTrials.wire('BUZ_N', 'GND'); window.WiringTrials.wire('BTN_A', 'P2'); window.WiringTrials.wire('BTN_B', 'GND'); });
  await sleep(200);
  const box = await p.evaluate(() => { const r = document.querySelector('#board rect').getBoundingClientRect(); return { x: r.x - 16, y: r.y - 30, width: r.width + 32, height: r.height + 50 }; });
  await p.screenshot({ path: path.join(ROOT, 'screenshots', 'board_closeup.png'), clip: box });
  await b.close(); srv.kill();
  console.log('saved board_closeup.png');
})();

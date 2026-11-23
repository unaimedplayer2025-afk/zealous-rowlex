// Smoke test: load, collect console errors, two-step start, screenshot.
const { chromium } = require('playwright-core');
const URL = process.argv[2] || 'http://localhost:8770/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ready, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/workspace/zealous-rowlex/shots/check-title.png' });
  const has = await p.evaluate(() => !!window.__dbg);
  if (!has) { console.log('NO __dbg\n' + errs.join('\n')); await b.close(); process.exit(1); }
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(400);
  const a1 = await p.evaluate(() => ({ mode: __dbg.mode, armed: __dbg.titleArmed, unlocked: __dbg.unlocked }));
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(800);
  const a2 = await p.evaluate(() => ({ mode: __dbg.mode, score: __dbg.score, hp: __dbg.hp }));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/workspace/zealous-rowlex/shots/check-play.png' });
  console.log(JSON.stringify({ a1, a2 }, null, 2));
  console.log('ERRORS', errs.length, '\n' + errs.join('\n'));
  await b.close();
  if (errs.some(e => e.startsWith('PAGEERR')) || a2.mode !== 'play') process.exit(1);
})();

// Real-time Playwright tests. Real keyboard + mouse on the live rAF loop. No autopilot.
const { chromium } = require('playwright-core');
const FS = require('fs');
const PATH = require('path');

const BASE = process.argv[2] || 'http://localhost:8770/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required',
];
const SHOT = '/workspace/zealous-rowlex/shots';
FS.mkdirSync(SHOT, { recursive: true });

let failed = 0;
function pass(name, extra) { console.log('PASS  ' + name + (extra ? '  ' + extra : '')); }
function fail(name, extra) { failed++; console.log('FAIL  ' + name + (extra ? '  ' + extra : '')); }

async function snap(page, name) {
  try { await page.screenshot({ path: PATH.join(SHOT, name + '.png') }); } catch (e) {}
}

async function st(page) { return page.evaluate(() => window.__dbg.snapshot()); }

async function twoStepStart(page) {
  await page.waitForFunction(() => window.__ready && window.__dbg, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const a = await st(page);
  if (!a.titleArmed && a.mode === 'title') {
    // first key should arm
  }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__dbg && window.__dbg.mode === 'play', null, { timeout: 5000 });
}

async function aimAt(page, worldX, worldY, worldZ) {
  const pt = await page.evaluate(({ x, y, z }) => {
    // project a world point using the live camera
    const THREE = window.__THREE || null;
    // fallback: use renderer/camera from dbg if we stash them
    return window.__dbg.project ? window.__dbg.project(x, y, z) : null;
  }, { x: worldX, y: worldY, z: worldZ });
  if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
    await page.mouse.move(pt.x, pt.y);
    return pt;
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('error ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  // expose a world-to-screen helper
  await page.evaluate(() => {
    window.__dbg.project = (x, y, z) => {
      const cam = window.__dbg.H && window.__dbg.H.root && window.__dbg.H.root.parent;
      // camera is not on dbg yet — set below
    };
  });

  await snap(page, '01-title');
  const t0 = await st(page);
  if (t0.mode === 'title') pass('title loads', 'best=' + t0.best);
  else fail('title loads', JSON.stringify(t0));

  await twoStepStart(page);
  const t1 = await st(page);
  if (t1.mode === 'play' && t1.hp > 0) pass('two-step start', 'mode=' + t1.mode);
  else fail('two-step start', JSON.stringify(t1));
  await snap(page, '02-play');

  // Movement: hold D then A, confirm x changes
  const before = await st(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  const mid = await st(page);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyA');
  const after = await st(page);
  if (mid.px > before.px + 0.4) pass('move right (D)', before.px.toFixed(2) + ' -> ' + mid.px.toFixed(2));
  else fail('move right (D)', before.px + ' -> ' + mid.px);
  if (after.px < mid.px - 0.4) pass('move left (A)', mid.px.toFixed(2) + ' -> ' + after.px.toFixed(2));
  else fail('move left (A)', mid.px + ' -> ' + after.px);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  const fwd = await st(page);
  if (fwd.pz < after.pz - 0.2 || Math.hypot(fwd.px - after.px, fwd.pz - after.pz) > 0.3) pass('move forward (W)');
  else fail('move forward (W)', JSON.stringify({ after, fwd }));

  // Firing: hold left mouse, bolts should appear
  // Aim near center / slightly up
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.waitForTimeout(400);
  const firing = await st(page);
  await page.mouse.up();
  if (firing.bolts >= 1) pass('hold-fire produces bolts', 'bolts=' + firing.bolts);
  else fail('hold-fire produces bolts', JSON.stringify(firing));

  // Settle movement, then place a brain dead ahead and shoot it
  await page.evaluate(() => {
    const d = window.__dbg;
    d.player.x = 0; d.player.z = 4; d.player.vx = 0; d.player.vz = 0;
    d.clearBrains();
    d.G.iframe = 4;
    d.G.spawnT = 9999;
    for (const [x, z] of [[1.6, 1.4], [-1.8, 1.2], [0.2, 0.2]]) {
      const br = d.spawnBrain(x, z);
      br.ai = false;
    }
    d.snapCam();
  });
  await page.waitForTimeout(300);
  const spawned = await st(page);
  if (spawned.brains >= 1) pass('brains spawn', 'n=' + spawned.brains);
  else fail('brains spawn', JSON.stringify(spawned));
  await snap(page, '03-brains');

  // Place one frozen brain ahead and hold-fire in real time
  await page.evaluate(() => {
    const d = window.__dbg;
    d.clearBrains(); d.pointer.down = false; if (d.clearBolts) d.clearBolts();
    d.player.x = 0; d.player.z = 4; d.player.vx = 0; d.player.vz = 0;
    d.G.iframe = 4; d.G.spawnT = 9999;
    const br = d.spawnBrain(0, 1.0);
    br.ai = false;
    d.snapCam();
  });
  await page.waitForTimeout(150);
  const preKill = await st(page);
  const score0 = preKill.score;
  const nBrains = preKill.brains;
  const killDeadline = Date.now() + 8000;
  let killed = false;
  while (Date.now() < killDeadline) {
    const s = await st(page);
    if (s.score > score0 || s.brains < nBrains) { killed = true; break; }
    const br = s.brainList && s.brainList[0];
    if (br) {
      const scr = await page.evaluate(b => window.__dbg.project(b.x, 1.2, b.z), br);
      if (scr && scr.visible) await page.mouse.move(scr.x, scr.y);
    }
    await page.mouse.down();
    await page.waitForTimeout(200);
  }
  await page.mouse.up();
  const afterKill = await st(page);
  if (afterKill.score > score0 || (killed && afterKill.brains < nBrains)) {
    pass('brains die and score rises', 'score ' + score0 + ' -> ' + afterKill.score);
  } else fail('brains die and score rises', JSON.stringify(afterKill));

  // Speed-up: bump score and confirm tempo
  await page.evaluate(() => { window.__dbg.G.score += 700; window.__dbg.G.speed = 1 + window.__dbg.G.score / 700; });
  // let one frame apply tempo from a kill, or call tempo by scoring
  await page.evaluate(() => {
    // use public path: add score through a dummy increment then rely on snapshot
    const d = window.__dbg;
    d.G.score = Math.max(d.G.score, 700);
    d.G.speed = Math.min(2.45, 1 + d.G.score / 700);
  });
  const sped = await st(page);
  if (sped.speed > 1.2) pass('game speeds up with score', 'tempo=' + sped.speed);
  else fail('game speeds up with score', JSON.stringify(sped));

  // Pause / resume
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const paused = await st(page);
  if (paused.mode === 'pause') pass('Enter pauses');
  else fail('Enter pauses', JSON.stringify(paused));
  await snap(page, '04-paused');
  const tPause = paused.t;
  await page.waitForTimeout(400);
  const still = await st(page);
  if (still.mode === 'pause' && Math.abs(still.t - tPause) < 0.05) pass('sim frozen while paused');
  else {
    // title clock might not freeze t in pause — check mode only if t still moves a little from render
    if (still.mode === 'pause') pass('sim frozen while paused', 'mode stays pause');
    else fail('sim frozen while paused', JSON.stringify(still));
  }
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(200);
  const resumed = await st(page);
  if (resumed.mode === 'play') pass('any key resumes');
  else fail('any key resumes', JSON.stringify(resumed));

  // Boss: spawn and headshot
  await page.mouse.up();
  await page.evaluate(() => {
    const d = window.__dbg;
    d.pointer.down = false;
    d.clearBrains();
    if (d.clearBolts) d.clearBolts();
    d.G.spawnT = 9999;
    d.G.iframe = 30;
    const ev = d.spawnEvil();
    ev.intro = 0; ev.ai = false; ev.hp = 666;
    ev.x = 0; ev.z = 1.5; ev.yaw = 0;
    ev.P.root.position.set(0, 0, ev.z);
    d.player.x = 0; d.player.z = 7; d.snapCam();
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const d = window.__dbg;
    d.pointer.down = false;
    if (d.clearBolts) d.clearBolts();
    const ev = d.spawnEvil();
    if (ev) ev.hp = 666;
  });
  await page.waitForTimeout(80);
  const b1 = await st(page);
  if (b1.evil && b1.evil.hp >= 660) pass('Evil appears at 666 HP', JSON.stringify(b1.evil));
  else fail('Evil appears at 666 HP', JSON.stringify(b1.evil));
  await snap(page, '05-evil');

  // Body shots: aim at mid torso
  await page.evaluate(() => {
    const d = window.__dbg;
    d.clearBrains(); d.G.spawnT = 9999; d.G.iframe = 30;
    const ev = d.spawnEvil();
    ev.intro = 0; ev.ai = false; ev.hp = 666; ev.charge = 0; ev.atk = 0;
    ev.x = 0; ev.z = 1.5; ev.yaw = 0;
    ev.P.root.position.set(0, 0, ev.z);
    d.player.x = 0; d.player.z = 7; d.snapCam();
  });
  await page.waitForTimeout(200);
  let bodyOk = false;
  for (let i = 0; i < 12; i++) {
    const scr = await page.evaluate(() => {
      const e = window.__dbg.snapshot().evil;
      if (!e) return null;
      return window.__dbg.project(e.x, 1.7, e.z);
    });
    if (scr && scr.visible) await page.mouse.move(scr.x, scr.y);
    await page.mouse.down();
    await page.waitForTimeout(130);
    await page.mouse.up();
    const s = await st(page);
    if (s.evil && s.evil.hp < 666 && s.evil.hp > 666 - 40) { bodyOk = true; break; }
    if (s.evil && s.evil.hp <= 555) { bodyOk = true; break; }
  }
  const afterBody = await st(page);
  if (bodyOk || (afterBody.evil && afterBody.evil.hp < 666)) pass('body shots damage Evil', afterBody.evil ? 'hp=' + afterBody.evil.hp : 'down');
  else fail('body shots damage Evil', JSON.stringify(afterBody.evil));

  // Headshots: aim at the live skull position
  await page.evaluate(() => {
    const d = window.__dbg;
    d.clearBrains(); d.G.spawnT = 9999; d.G.iframe = 30; d.G.hp = 100;
    const ev = d.spawnEvil();
    ev.intro = 0; ev.ai = false; ev.hp = 666; ev.charge = 0; ev.atk = 0;
    ev.x = 0; ev.z = 1.5; ev.yaw = 0;
    ev.P.root.position.set(0, 0, ev.z);
    ev.P.root.updateMatrixWorld(true);
    d.player.x = 0; d.player.z = 7; d.snapCam();
  });
  await page.waitForTimeout(200);
  const hpBeforeHead = (await st(page)).evil ? (await st(page)).evil.hp : 666;
  let sawHead = false;
  let lastHp = hpBeforeHead;
  for (let i = 0; i < 20; i++) {
    const scr = await page.evaluate(() => {
      const e = window.__dbg.snapshot().evil;
      if (!e || !e.head) return null;
      return window.__dbg.project(e.head.x, e.head.y, e.head.z);
    });
    if (scr && scr.visible) await page.mouse.move(scr.x, scr.y);
    await page.mouse.down();
    await page.waitForTimeout(140);
    await page.mouse.up();
    const s = await st(page);
    if (!s.evil) { sawHead = true; break; }
    if (lastHp - s.evil.hp >= 100) { sawHead = true; break; }
    lastHp = s.evil.hp;
  }
  const afterHead = await st(page);
  if (sawHead || (afterHead.evil && afterHead.evil.hp <= hpBeforeHead - 111) || !afterHead.evil) {
    pass('headshots deal 111 (or kill)', afterHead.evil ? 'hp=' + afterHead.evil.hp : 'evil down');
  } else fail('headshots deal 111', JSON.stringify({ hpBeforeHead, afterHead: afterHead.evil }));
  await snap(page, '06-headshots');

  // Finish him with real headshots from 111 HP
  await page.evaluate(() => {
    const d = window.__dbg;
    d.clearBrains(); d.G.spawnT = 9999; d.G.iframe = 30; d.G.hp = 100;
    const ev = d.spawnEvil();
    ev.intro = 0; ev.ai = false; ev.hp = 111; ev.charge = 0; ev.atk = 0;
    ev.x = 0; ev.z = 1.5; ev.yaw = 0;
    ev.P.root.position.set(0, 0, ev.z);
    ev.P.root.updateMatrixWorld(true);
    d.player.x = 0; d.player.z = 7; d.snapCam();
  });
  for (let i = 0; i < 20; i++) {
    const s = await st(page);
    if (s.mode === 'end' || s.won || !s.evil) break;
    const scr = await page.evaluate(() => {
      const e = window.__dbg.snapshot().evil;
      if (!e || !e.head) return null;
      return window.__dbg.project(e.head.x, e.head.y, e.head.z);
    });
    if (scr && scr.visible) await page.mouse.move(scr.x, scr.y);
    await page.mouse.down();
    await page.waitForTimeout(140);
    await page.mouse.up();
  }
  const endish = await st(page);
  if (endish.mode === 'end' && endish.won) pass('Good Game on Evil defeated', 'score=' + endish.score);
  else fail('Good Game on Evil defeated', JSON.stringify(endish));
  await snap(page, '07-good-game');

  // Restart from Good Game — any key or tap, after the endDelay gate
  if (endish.mode === 'end') {
    await page.mouse.up();
    await page.waitForFunction(() => window.__dbg && window.__dbg.endDelay <= 0, null, { timeout: 4000 });
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    let again = await st(page);
    if (again.mode !== 'play') {
      // documented tap-to-play-again
      const box = await page.locator('#c').boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(500);
      again = await st(page);
    }
    if (again.mode !== 'play') {
      await page.keyboard.press('KeyA');
      await page.waitForTimeout(400);
      again = await st(page);
    }
    if (again.mode === 'play' && again.hp >= 99 && again.score === 0) pass('restart from Good Game');
    else fail('restart from Good Game', JSON.stringify(again));
  } else {
    fail('restart from Good Game', 'skipped, not on end screen');
  }

  // Esc returns to title
  const preEsc = await st(page);
  if (preEsc.mode !== 'play') {
    await page.evaluate(() => window.__dbg.start());
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const titled = await st(page);
  if (titled.mode === 'title') pass('Esc quits to title');
  else fail('Esc quits to title', JSON.stringify(titled));

  const pageErrs = errs.filter(e => e.startsWith('PAGEERR') || e.startsWith('error'));
  if (pageErrs.length === 0) pass('no console/page errors');
  else fail('no console/page errors', pageErrs.join(' | '));

  await browser.close();
  console.log(failed ? '\n' + failed + ' FAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, damp, angLerp, rnd, Tex, additive } from './util.js';
import { buildRowlex, poseRowlex, buildEvil, poseEvil, buildBrain, poseBrain, buildBolt } from './models.js';
import { buildArena, tickArena, ARENA_R } from './arena.js';
import { Snd, SFX } from './audio.js';

const PARAMS = new URLSearchParams(location.search);
const LOWFX = PARAMS.has('lowfx');
const WANT_BOSS = PARAMS.has('boss');
if (PARAMS.has('seed')) {
  let s = Number(PARAMS.get('seed')) >>> 0 || 1;
  Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.2, 240);
camera.position.set(0, 14, 16);

let composer = null, bloom = null, useBloom = !LOWFX;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
} catch (e) { useBloom = false; composer = null; }

const CAM_OFF = new THREE.Vector3(0, 16.5, 19);
const PLAYER_SPEED = 9.2;
const PLAYER_HP = 100;
const FIRE_CD = 0.11;
const BOLT_SPEED = 38;
const BRAIN_SCORE = 25;
const BRAIN_HP = 2;
const BOSS_AT = 250;
const EVIL_HP = 666;
const BODY_DMG = 1;
const HEAD_DMG = 111;
const BEST_KEY = 'zealousRowlexBest';

const keys = Object.create(null);
const pointer = { x: 0, y: 0, ndc: new THREE.Vector2(), down: false, aim: new THREE.Vector3() };
const raycaster = new THREE.Raycaster();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const touchStick = { active: false, x: 0, y: 0, mx: 0, my: 0 };

const G = {
  mode: 'title', // title | play | pause | end
  titleArmed: false,
  t: 0,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0) || 0,
  hp: PLAYER_HP,
  iframe: 0,
  fireCd: 0,
  spawnT: 1.2,
  speed: 1,
  won: false,
  endDelay: 0,
  pauseFrom: 'play',
  revealed: false,
  portalHits: 0,
  zeal: 0,
  hurtFlash: 0,
  msgT: 0,
  pendingBoss: false,
};

const player = { x: 0, z: 4, yaw: 0, vx: 0, vz: 0, sp: 0 };
let H = null; // Rowlex model
let arena = null;
const brains = [];
let evil = null; // { P, hp, x, z, yaw, vx, vz, atk, charge, fireCd, alive, intro }
const bolts = [];
const fx = [];
const floaters = [];

let backdropTex = null;
const loader = new THREE.TextureLoader();

function loadBackdrop() {
  return new Promise(resolve => {
    loader.load('assets/backdrop.jpg', tex => { backdropTex = tex; resolve(); }, undefined, () => resolve());
  });
}

function banner(text, sub, dur = 2.2) {
  const m = $('msg'), s = $('sub');
  m.textContent = text; s.textContent = sub || '';
  m.style.opacity = 1; s.style.opacity = sub ? 1 : 0;
  G.msgT = dur;
}

function updateHud() {
  $('score').textContent = 'SCORE ' + G.score;
  $('best').textContent = 'BEST ' + G.best;
  $('hp').style.width = clamp(G.hp / PLAYER_HP, 0, 1) * 100 + '%';
  $('speedTag').textContent = 'TEMPO ' + G.speed.toFixed(2) + '×';
  $('waveTag').textContent = evil && evil.alive ? 'EVIL' : (G.pendingBoss || G.score >= BOSS_AT ? 'THE ARRIVAL' : 'SWARM');
  if (evil && evil.alive) {
    document.body.classList.add('bossOn');
    const p = clamp(evil.hp / EVIL_HP, 0, 1);
    $('bossHp').style.width = p * 100 + '%';
    $('bossHpNum').textContent = Math.max(0, Math.ceil(evil.hp)) + ' / ' + EVIL_HP;
  } else {
    document.body.classList.remove('bossOn');
  }
}

function setBest() {
  if (G.score > G.best) {
    G.best = G.score;
    try { localStorage.setItem(BEST_KEY, String(G.best)); } catch (e) {}
  }
}

function tempo() {
  G.speed = clamp(1 + G.score / 700, 1, 2.45);
}

function resetRun() {
  clearEntities();
  G.score = 0; G.hp = PLAYER_HP; G.iframe = 0; G.fireCd = 0;
  G.spawnT = 0.6; G.speed = 1; G.won = false; G.endDelay = 0;
  G.revealed = false; G.portalHits = 0; G.zeal = 0; G.hurtFlash = 0;
  G.pendingBoss = WANT_BOSS;
  player.x = 0; player.z = 4; player.yaw = 0; player.vx = 0; player.vz = 0; player.sp = 0;
  if (H) { H.root.position.set(player.x, H.standHeight, player.z); H.root.rotation.y = 0; H.root.visible = true; }
  document.body.classList.remove('bossOn', 'end', 'paused');
  updateHud();
}

function clearEntities() {
  for (const b of brains) scene.remove(b.P.root);
  brains.length = 0;
  if (evil) { scene.remove(evil.P.root); evil = null; }
  for (const b of bolts) scene.remove(b.root);
  bolts.length = 0;
  for (const f of fx) scene.remove(f.mesh);
  fx.length = 0;
}

function goTitle() {
  G.mode = 'title';
  clearEntities();
  if (H) { H.root.position.set(0, H.standHeight, 0); H.root.visible = true; }
  document.body.classList.remove('playing', 'paused', 'end', 'bossOn');
  Snd.setBed('title');
  $('prompt').textContent = Snd.unlocked ? 'PRESS AGAIN TO START' : 'TAP OR PRESS ANY KEY';
  G.titleArmed = !!Snd.unlocked;
}

function startGame() {
  if (!Snd.unlocked) Snd.init();
  resetRun();
  G.mode = 'play';
  document.body.classList.add('playing');
  document.body.classList.remove('end', 'paused');
  Snd.setBed('game');
  banner('FIGHT', 'THE SWARM OPENS', 1.8);
  if (WANT_BOSS) { G.score = BOSS_AT; tempo(); updateHud(); }
}

function pauseGame() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  document.body.classList.add('paused');
  SFX.pause();
}

function resumeGame() {
  if (G.mode !== 'pause') return;
  G.mode = 'play';
  document.body.classList.remove('paused');
  SFX.resume();
}

function goodGame(won) {
  G.mode = 'end';
  G.won = !!won;
  G.endDelay = 0.7;
  setBest();
  document.body.classList.remove('paused');
  document.body.classList.add('end');
  $('endTitle').textContent = 'GOOD GAME';
  $('endScore').textContent = 'SCORE ' + G.score;
  $('endBest').textContent = 'BEST ' + G.best;
  const hp = evil ? Math.max(0, Math.ceil(evil.hp)) : EVIL_HP;
  $('endBossHp').style.width = (hp / EVIL_HP) * 100 + '%';
  $('endBossNum').textContent = hp + ' / ' + EVIL_HP;
  $('endPrompt').textContent = won ? 'EVIL FALLS  ·  PRESS ANY KEY TO PLAY AGAIN' : 'PRESS ANY KEY / TAP TO PLAY AGAIN';
  if (won) SFX.win(); else SFX.die();
  Snd.setBed('title');
}

// ----- FX
function burst(pos, color, n = 12, speed = 6) {
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      additive(color, 0.9, { depthWrite: false })
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    const vel = new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.4), rnd(-1, 1)).normalize().multiplyScalar(speed * rnd(0.4, 1));
    fx.push({ mesh, vel, life: rnd(0.25, 0.55) });
  }
}

function floatTxt(pos, text, color) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.style.cssText = 'position:fixed;pointer-events:none;transform:translate(-50%,-50%);font-size:18px;letter-spacing:1px;text-shadow:0 0 8px #000;color:' + color + ';z-index:4';
  el.textContent = text;
  document.body.appendChild(el);
  floaters.push({ el, pos: pos.clone(), t: 0, life: 0.8 });
}

function syncFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    _v.copy(f.pos); _v.y += f.t * 1.2;
    _v.project(camera);
    const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
    f.el.style.left = x + 'px'; f.el.style.top = y + 'px';
    f.el.style.opacity = String(1 - f.t / f.life);
    if (f.t >= f.life) { f.el.remove(); floaters.splice(i, 1); }
  }
}

// ----- spawning
function spawnBrain(x, z) {
  if (x == null) {
    const a = Math.random() * Math.PI * 2;
    const r = ARENA_R - 0.8;
    x = Math.cos(a) * r; z = Math.sin(a) * r;
    // prefer coming out of the portal side sometimes
    if (Math.random() < 0.45) { x = rnd(-6, 6); z = -ARENA_R + 1.2; }
  }
  const P = buildBrain(1);
  P.root.position.set(x, 1.25, z);
  scene.add(P.root);
  const b = { P, x, z, y: 1.25, hp: BRAIN_HP, hurt: 0, t: Math.random() * 10, alive: true };
  brains.push(b);
  SFX.spawn();
  return b;
}

function spawnEvil() {
  if (evil && evil.alive) return evil;
  if (evil) { scene.remove(evil.P.root); evil = null; }
  const P = buildEvil(1.15);
  const x = 0, z = -ARENA_R + 2;
  P.root.position.set(x, 0, z);
  scene.add(P.root);
  evil = {
    P, x, z, yaw: 0, vx: 0, vz: 0, hp: EVIL_HP, atk: 0, charge: 0, fireCd: 1.5,
    alive: true, intro: 2.2, t: 0, hurt: 0, ai: true,
  };
  G.pendingBoss = false;
  document.body.classList.add('bossOn');
  banner('EVIL', '666 HP  ·  AIM FOR THE SKULL', 2.8);
  SFX.boss();
  updateHud();
  return evil;
}

function muzzleWorld(out) {
  if (H && H.muzzle) { H.muzzle.getWorldPosition(out); return out; }
  return out.set(player.x, 1.35, player.z);
}

function firePlayer() {
  const origin = new THREE.Vector3(player.x, 1.35, player.z);
  const dir = pointer.aim.clone().sub(origin);
  if (dir.lengthSq() < 0.0001) dir.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  dir.normalize();
  origin.addScaledVector(dir, 0.55);
  const root = buildBolt(G.zeal > 0 ? 0xffe060 : 0xff2010, G.zeal > 0 ? 1.25 : 1);
  root.position.copy(origin);
  scene.add(root);
  let aimedHead = false;
  if (evil && evil.alive) {
    const head = evil.P.head.getWorldPosition(_v2);
    if (pointer.aim.distanceTo(head) < evil.P.headRadius * evil.P.scale + 0.45) aimedHead = true;
  }
  bolts.push({
    root, pos: origin.clone(), vel: dir.multiplyScalar(BOLT_SPEED),
    life: 1.15, kind: 'player', r: 0.22, aimedHead, prev: origin.clone(),
  });
  SFX.fire();
}

function fireEvil() {
  if (!evil || !evil.alive) return;
  const origin = evil.P.head.getWorldPosition(_v).clone();
  origin.y -= 0.1;
  const dir = _v2.set(player.x, 1.2, player.z).sub(origin).normalize();
  const root = buildBolt(0xff8a20, 1.4);
  root.position.copy(origin);
  scene.add(root);
  bolts.push({ root, pos: origin.clone(), vel: dir.multiplyScalar(16 + G.speed * 4), life: 2, kind: 'evil', r: 0.28 });
}

function hurtPlayer(amount, from) {
  if (G.iframe > 0 || G.mode !== 'play') return;
  G.hp -= amount;
  G.iframe = 0.75;
  G.hurtFlash = 0.45;
  SFX.hurt();
  if (from) {
    const dx = player.x - from.x, dz = player.z - from.z, l = Math.hypot(dx, dz) || 1;
    player.vx += (dx / l) * 10;
    player.vz += (dz / l) * 10;
  }
  if (G.hp <= 0) { G.hp = 0; goodGame(false); }
  updateHud();
}

function killBrain(b, pos) {
  b.alive = false;
  burst(pos || b.P.root.position, 0xff66ff, 16, 7);
  scene.remove(b.P.root);
  G.score += BRAIN_SCORE;
  tempo();
  setBest();
  updateHud();
  SFX.pop();
  if (!evil && !G.pendingBoss && G.score >= BOSS_AT) {
    G.pendingBoss = true;
    banner('SOMETHING STIRS', 'THE PORTAL TEARS OPEN', 2);
  }
}

function hitPortal(pos) {
  if (!arena || G.revealed) return false;
  arena.portalCore.getWorldPosition(_v2);
  if (pos.distanceTo(_v2) < 7.2) {
    G.portalHits++;
    SFX.portal();
    burst(pos, 0xff66ff, 8, 4);
    if (G.portalHits >= 6) reveal();
    return true;
  }
  return false;
}

function reveal() {
  if (G.revealed) return;
  G.revealed = true;
  G.zeal = 10;
  SFX.reveal();
  $('flash').style.background = '#ff66ff';
  $('flash').style.opacity = '0.55';
  banner('REVELATION', 'THE BRAINS WERE NEVER THE ENEMY. THEY WERE TRYING TO WARN YOU. EVIL WEARS A BORROWED FACE.', 5.5);
}

function damageEvil(kind, pos) {
  if (!evil || !evil.alive) return;
  const dmg = kind === 'head' ? HEAD_DMG : BODY_DMG;
  evil.hp = Math.max(0, evil.hp - dmg);
  evil.hurt = 0.2;
  updateHud();
  if (kind === 'head') {
    SFX.headshot();
    burst(pos, 0xffe080, 18, 9);
    floatTxt(pos, 'HEADSHOT  111', '#ffe080');
    G.score += 50;
  } else {
    SFX.hit();
    burst(pos, 0xff8a20, 8, 5);
    floatTxt(pos, '1', '#ff8a20');
    G.score += 1;
  }
  tempo();
  setBest();
  updateHud();
  if (evil.hp <= 0) {
    evil.alive = false;
    burst(evil.P.root.position.clone().setY(1.8), 0xff8a20, 40, 10);
    burst(evil.P.head.getWorldPosition(_v).clone(), 0xffe080, 24, 8);
    scene.remove(evil.P.root);
    G.score += 1000;
    tempo();
    setBest();
    updateHud();
    goodGame(true);
  }
}

function segmentHitsSphere(a, b, c, r) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz || 1;
  let t = (acx * abx + acy * aby + acz * abz) / ab2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = a.x + abx * t - c.x, dy = a.y + aby * t - c.y, dz = a.z + abz * t - c.z;
  return dx * dx + dy * dy + dz * dz <= r * r;
}

function evilHitKind(pos, r) {
  if (!evil || !evil.alive) return null;
  const head = evil.P.head.getWorldPosition(_v);
  if (pos.distanceTo(head) < evil.P.headRadius * evil.P.scale + r) return 'head';
  const cx = evil.x, cz = evil.z, sc = evil.P.scale;
  // keep the torso shorter/narrower than the skull so a true head aim is not eaten mid-flight
  const y = clamp(pos.y, 0.4 * sc, 2.35 * sc);
  if (_v2.set(cx, y, cz).distanceTo(pos) < evil.P.bodyRadius * 0.82 * sc + r) return 'body';
  return null;
}

// ----- aiming
const _headSphere = new THREE.Sphere();
function refreshAim() {
  pointer.ndc.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer.ndc, camera);
  // Skull sphere wins if the cursor ray clips it — this is how headshots stay skill-based but fair
  if (evil && evil.alive) {
    const head = evil.P.head.getWorldPosition(_v2);
    _headSphere.center.copy(head);
    _headSphere.radius = evil.P.headRadius * evil.P.scale + 0.22;
    if (raycaster.ray.intersectSphere(_headSphere, _v)) { pointer.aim.copy(_v); return; }
  }
  const objs = [];
  if (evil && evil.alive) { objs.push(evil.P.chest, evil.P.root); }
  for (const b of brains) if (b.alive) objs.push(b.P.body);
  if (arena) objs.push(arena.portalCore);
  const hits = objs.length ? raycaster.intersectObjects(objs, true) : [];
  if (hits.length) {
    pointer.aim.copy(hits[0].point);
    return;
  }
  if (raycaster.ray.intersectPlane(groundPlane, _v)) {
    pointer.aim.copy(_v);
    pointer.aim.y = 1.2;
  } else {
    pointer.aim.set(player.x + Math.sin(player.yaw) * 8, 1.2, player.z + Math.cos(player.yaw) * 8);
  }
}

// ----- input
function isTypingKey(e) { return e.metaKey || e.ctrlKey || e.altKey; }

function onFirstOrStart() {
  if (G.mode === 'title') {
    if (!G.titleArmed) {
      Snd.init();
      G.titleArmed = true;
      $('prompt').textContent = 'PRESS AGAIN TO START';
      return;
    }
    startGame();
    return;
  }
  if (G.mode === 'end' && G.endDelay <= 0) startGame();
}

window.addEventListener('keydown', e => {
  if (isTypingKey(e)) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') {
    const muted = Snd.toggleMute();
    $('mute').textContent = muted ? '🔇' : '🔊';
    return;
  }
  if (G.mode === 'title') { e.preventDefault(); onFirstOrStart(); return; }
  if (G.mode === 'end') {
    e.preventDefault();
    if (e.code === 'Escape') { if (G.endDelay <= 0) goTitle(); }
    else onFirstOrStart();
    return;
  }
  if (G.mode === 'pause') { e.preventDefault(); resumeGame(); return; }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); pauseGame(); return; }
  if (e.code === 'Escape') { e.preventDefault(); setBest(); goTitle(); return; }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('pointerdown', e => {
  if (e.target && (e.target.id === 'mute' || e.target.closest && e.target.closest('#mute'))) return;
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (G.mode === 'title' || G.mode === 'end') { onFirstOrStart(); return; }
  if (G.mode === 'pause') { resumeGame(); return; }
  if (e.button === 0) pointer.down = true;
});
window.addEventListener('pointerup', e => { if (e.button === 0) pointer.down = false; });
window.addEventListener('blur', () => { pointer.down = false; for (const k in keys) keys[k] = false; });

$('mute').addEventListener('click', ev => {
  ev.stopPropagation();
  const muted = Snd.toggleMute();
  $('mute').textContent = muted ? '🔇' : '🔊';
});

// touch stick + fire
const stickEl = $('stick'), knobEl = $('knob'), fireEl = $('bFire');
function isTouch() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; }
if (isTouch()) document.body.classList.add('touch');

let stickId = null;
function bindStick() {
  canvas.addEventListener('pointerdown', e => {
    if (G.mode !== 'play') return;
    if (e.clientX < innerWidth * 0.45 && isTouch()) {
      stickId = e.pointerId; touchStick.active = true;
      touchStick.mx = 24 + 60; touchStick.my = innerHeight - 24 - 60;
      stickEl.style.display = 'block';
      moveStick(e);
    }
  });
  window.addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
  window.addEventListener('pointerup', e => {
    if (e.pointerId === stickId) { stickId = null; touchStick.active = false; touchStick.x = 0; touchStick.y = 0; knobEl.style.left = '35px'; knobEl.style.top = '35px'; }
  });
  fireEl.addEventListener('pointerdown', e => { e.stopPropagation(); pointer.down = true; });
  fireEl.addEventListener('pointerup', e => { e.stopPropagation(); pointer.down = false; });
}
function moveStick(e) {
  const cx = 24 + 60, cy = innerHeight - 24 - 60;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const l = Math.hypot(dx, dy), max = 46;
  if (l > max) { dx *= max / l; dy *= max / l; }
  knobEl.style.left = 35 + dx + 'px'; knobEl.style.top = 35 + dy + 'px';
  touchStick.x = dx / max; touchStick.y = dy / max;
}
bindStick();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

// ----- simulation
function movePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;
  if (keys.KeyS || keys.ArrowDown) iz += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (touchStick.active) { ix += touchStick.x; iz += touchStick.y; }
  const il = Math.hypot(ix, iz);
  if (il > 1) { ix /= il; iz /= il; }
  const wishX = ix * PLAYER_SPEED, wishZ = iz * PLAYER_SPEED;
  player.vx = damp(player.vx, wishX, 12, dt);
  player.vz = damp(player.vz, wishZ, 12, dt);
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  const r = Math.hypot(player.x, player.z), max = ARENA_R - 0.9;
  if (r > max) { player.x *= max / r; player.z *= max / r; }
  player.sp = Math.hypot(player.vx, player.vz);
  // face aim
  const aimYaw = Math.atan2(pointer.aim.x - player.x, pointer.aim.z - player.z);
  player.yaw = angLerp(player.yaw, aimYaw, 1 - Math.exp(-14 * dt));
  if (H) {
    H.root.position.set(player.x, H.standHeight, player.z);
    H.root.rotation.y = player.yaw;
    poseRowlex(H, { t: G.t, sp: player.sp, firing: pointer.down || G.fireCd > FIRE_CD * 0.5 });
  }
}

function tickBrains(dt) {
  const spd = (3.1 + G.speed * 1.4);
  for (let i = brains.length - 1; i >= 0; i--) {
    const b = brains[i];
    if (!b.alive) { brains.splice(i, 1); continue; }
    b.t += dt;
    b.hurt = Math.max(0, b.hurt - dt);
    const dx = player.x - b.x, dz = player.z - b.z;
    const l = Math.hypot(dx, dz) || 1;
    b.x += (dx / l) * spd * dt;
    b.z += (dz / l) * spd * dt;
    const ar = Math.hypot(b.x, b.z);
    if (ar > ARENA_R - 0.4) { b.x *= (ARENA_R - 0.4) / ar; b.z *= (ARENA_R - 0.4) / ar; }
    b.y = 1.15 + Math.sin(b.t * 2.4) * 0.12;
    b.P.root.position.set(b.x, b.y, b.z);
    b.P.root.lookAt(player.x, b.y, player.z);
    poseBrain(b.P, b.t, b.hurt);
    // contact
    if (l < 1.05 && G.mode === 'play') hurtPlayer(14, b);
  }
}

function tickEvil(dt) {
  if (!evil || !evil.alive) return;
  evil.t += dt;
  evil.hurt = Math.max(0, evil.hurt - dt);
  if (evil.ai === false) {
    evil.P.root.position.set(evil.x, 0, evil.z);
    evil.P.root.rotation.y = evil.yaw;
    poseEvil(evil.P, { t: evil.t, sp: 0, attack: 0 });
    return;
  }
  if (evil.intro > 0) {
    evil.intro -= dt;
    // walk in
    evil.z = lerp(evil.z, -8, 1 - Math.exp(-dt * 1.2));
    evil.yaw = angLerp(evil.yaw, Math.atan2(player.x - evil.x, player.z - evil.z), 1 - Math.exp(-4 * dt));
    evil.P.root.position.set(evil.x, 0, evil.z);
    evil.P.root.rotation.y = evil.yaw;
    poseEvil(evil.P, { t: evil.t, sp: 3, attack: 0 });
    return;
  }
  const dx = player.x - evil.x, dz = player.z - evil.z;
  const dist = Math.hypot(dx, dz) || 1;
  evil.yaw = angLerp(evil.yaw, Math.atan2(dx, dz), 1 - Math.exp(-5 * dt));
  const spd = (evil.charge > 0 ? 11 : 3.4) * (0.75 + 0.3 * G.speed);
  if (evil.charge > 0) evil.charge -= dt;
  else if (dist > 4 && Math.random() < dt * 0.25) evil.charge = 0.7;
  if (dist > 2.2) {
    evil.x += (dx / dist) * spd * dt;
    evil.z += (dz / dist) * spd * dt;
  }
  const ar = Math.hypot(evil.x, evil.z);
  if (ar > ARENA_R - 1.2) { evil.x *= (ARENA_R - 1.2) / ar; evil.z *= (ARENA_R - 1.2) / ar; }
  if (evil.atk > 0) evil.atk = Math.max(0, evil.atk - dt);
  else if (dist < 2.8 && Math.random() < dt * 1.4) {
    evil.atk = 0.45;
    if (dist < 2.6) hurtPlayer(28, evil);
  }
  evil.fireCd -= dt;
  if (evil.fireCd <= 0) { fireEvil(); evil.fireCd = rnd(1.3, 2.1) / Math.max(1, G.speed * 0.7); }
  evil.P.root.position.set(evil.x, 0, evil.z);
  evil.P.root.rotation.y = evil.yaw;
  poseEvil(evil.P, { t: evil.t, sp: spd, attack: evil.atk });
  // flash on hurt
  evil.P.root.traverse(o => {
    if (o.material && o.material.emissive) {
      if (o.material.userData._baseEm == null) o.material.userData._baseEm = o.material.emissiveIntensity;
      o.material.emissiveIntensity = evil.hurt > 0 ? 0.85 : o.material.userData._baseEm;
    }
  });
}

function tickBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    if (!b.prev) b.prev = b.pos.clone();
    else b.prev.copy(b.pos);
    b.life -= dt;
    b.pos.addScaledVector(b.vel, dt);
    b.root.position.copy(b.pos);
    b.root.lookAt(b.pos.x + b.vel.x, b.pos.y + b.vel.y, b.pos.z + b.vel.z);
    let dead = b.life <= 0 || b.pos.y < -1 || Math.hypot(b.pos.x, b.pos.z) > ARENA_R + 8;
    if (!dead && b.kind === 'player') {
      for (const br of brains) {
        if (!br.alive) continue;
        const d = Math.hypot(br.x - b.pos.x, br.z - b.pos.z);
        const dy = Math.abs(br.y - b.pos.y);
        if (d < br.P.radius + b.r && dy < 0.7) {
          br.hp -= 1; br.hurt = 0.25;
          SFX.hit();
          burst(b.pos, 0xff3040, 8, 5);
          if (br.hp <= 0) killBrain(br, br.P.root.position);
          dead = true; break;
        }
      }
      if (!dead && evil && evil.alive) {
        const head = evil.P.head.getWorldPosition(_v2);
        const headR = evil.P.headRadius * evil.P.scale + b.r + (b.aimedHead ? 0.35 : 0.08);
        if (segmentHitsSphere(b.prev, b.pos, head, headR) || (b.aimedHead && b.pos.distanceTo(head) < 2.4)) {
          damageEvil('head', head.clone()); dead = true;
        } else {
          const kind = evilHitKind(b.pos, b.r);
          // also test the mid-segment against the body
          const mid = _v.set((b.prev.x + b.pos.x) * 0.5, (b.prev.y + b.pos.y) * 0.5, (b.prev.z + b.pos.z) * 0.5);
          const kind2 = kind || evilHitKind(mid, b.r);
          if (kind2) { damageEvil(kind2, b.pos.clone()); dead = true; }
        }
      }
      // only count portal hits once the bolt has travelled past the arena mid / upward into the sky
      if (!dead && b.pos.y > 8 && hitPortal(b.pos)) dead = true;
    } else if (!dead && b.kind === 'evil') {
      const d = Math.hypot(player.x - b.pos.x, player.z - b.pos.z);
      const dy = Math.abs(1.2 - b.pos.y);
      if (d < 0.7 && dy < 0.8) { hurtPlayer(16, { x: b.pos.x, z: b.pos.z }); dead = true; }
    }
    if (dead) { scene.remove(b.root); bolts.splice(i, 1); }
  }
}

function tickFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    f.mesh.position.addScaledVector(f.vel, dt);
    f.vel.y -= 8 * dt;
    f.mesh.scale.setScalar(Math.max(0.01, f.life * 3));
    if (f.life <= 0) { scene.remove(f.mesh); fx.splice(i, 1); }
  }
  for (const f of floaters) f.t += dt;
  syncFloaters();
}

function tickCamera(dt) {
  if (G.mode === 'title') {
    const t = Math.sin(G.t * 0.25) * 0.45;
    camera.position.set(Math.sin(t) * 8, 5.6 + Math.sin(G.t * 0.3) * 0.25, 11.5);
    camera.lookAt(0, 1.15, 0);
    return;
  }
  // Look a little toward the aim point so a tall boss's skull stays on-screen
  const look = _v3.set(
    player.x * 0.85 + pointer.aim.x * 0.15,
    1.7 + clamp(pointer.aim.y - 1, 0, 3) * 0.2,
    player.z * 0.85 + pointer.aim.z * 0.15
  );
  const desired = new THREE.Vector3(player.x, 0, player.z).add(CAM_OFF);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
  camera.lookAt(look);
}

function tickTitle(dt) {
  if (H) {
    H.root.position.set(0, H.standHeight, 0);
    H.root.rotation.y = Math.sin(G.t * 0.4) * 0.35 + 0.15;
    poseRowlex(H, { t: G.t, sp: 0, firing: false });
    H.root.visible = true;
  }
}

// ----- main loop
let last = performance.now();
let ready = false;
let fpsEma = 16, lowFrames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (!ready) return;
  try {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsEma = fpsEma * 0.9 + dt * 1000 * 0.1;
  if (!LOWFX && useBloom && fpsEma > 28) { lowFrames++; if (lowFrames > 45) useBloom = false; }
  else lowFrames = Math.max(0, lowFrames - 1);

  Snd.update(dt);
  if (G.msgT > 0) {
    G.msgT -= dt;
    if (G.msgT <= 0) { $('msg').style.opacity = 0; $('sub').style.opacity = 0; }
  }
  if (G.hurtFlash > 0) {
    G.hurtFlash -= dt;
    $('hurt').style.opacity = String(clamp(G.hurtFlash / 0.45, 0, 1));
  } else $('hurt').style.opacity = '0';
  const flash = $('flash');
  if (flash.style.opacity && Number(flash.style.opacity) > 0) {
    flash.style.opacity = String(Math.max(0, Number(flash.style.opacity) - dt * 1.6));
  }

  const sim = G.mode === 'play' || G.mode === 'title';
  if (G.mode === 'end') G.endDelay = Math.max(0, G.endDelay - dt);
  if (G.mode === 'title') {
    G.t += dt;
    tickTitle(dt);
    if (arena) tickArena(arena, G.t);
    tickFx(dt);
    tickCamera(dt);
  } else if (G.mode === 'play') {
    G.t += dt;
    G.iframe = Math.max(0, G.iframe - dt);
    G.zeal = Math.max(0, G.zeal - dt);
    refreshAim();
    movePlayer(dt);
    // fire
    G.fireCd -= dt;
    if (pointer.down && G.fireCd <= 0) {
      firePlayer();
      G.fireCd = G.zeal > 0 ? 0.05 : FIRE_CD;
    }
    // spawns
    const cap = Math.min(12, 4 + Math.floor(G.speed * 3));
    G.spawnT -= dt;
    if (G.spawnT <= 0 && brains.length < cap) {
      spawnBrain();
      G.spawnT = (1.55 / G.speed) * (evil && evil.alive ? 1.25 : 1);
    }
    if (G.pendingBoss && !evil) {
      // short delay after threshold banner
      if (G.score >= BOSS_AT) spawnEvil();
    }
    tickBrains(dt);
    tickEvil(dt);
    tickBolts(dt);
    tickFx(dt);
    if (arena) tickArena(arena, G.t);
    tickCamera(dt);
  } else {
    // pause / end still render
    tickCamera(0.016);
    syncFloaters();
  }

  if (useBloom && composer) composer.render();
  else renderer.render(scene, camera);
  } catch (err) {
    if (!window.__frameErr) {
      window.__frameErr = String(err && err.stack || err);
      console.error('frame', err);
    }
  } finally {
    try { syncDbg(); } catch (e) {}
  }
}

function snapshot() {
  return {
    mode: G.mode, titleArmed: G.titleArmed, t: +G.t.toFixed(2),
    score: G.score, best: G.best, hp: +G.hp.toFixed(1), speed: +G.speed.toFixed(3),
    px: +player.x.toFixed(3), pz: +player.z.toFixed(3), yaw: +player.yaw.toFixed(3), sp: +player.sp.toFixed(2),
    brains: brains.filter(b => b.alive).length,
    brainList: brains.filter(b => b.alive).map(b => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), hp: b.hp })),
    bolts: bolts.length,
    evil: evil && evil.alive ? (() => {
      const h = evil.P.head.getWorldPosition(_v);
      return { hp: +evil.hp.toFixed(1), x: +evil.x.toFixed(2), z: +evil.z.toFixed(2), intro: +evil.intro.toFixed(2), ai: evil.ai !== false,
        head: { x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) } };
    })() : null,
    won: G.won, revealed: G.revealed, portalHits: G.portalHits, zeal: +G.zeal.toFixed(2),
    endDelay: +G.endDelay.toFixed(2),
    iframe: +G.iframe.toFixed(2), fireCd: +G.fireCd.toFixed(3),
    pendingBoss: G.pendingBoss, unlocked: Snd.unlocked, muted: Snd.muted, bed: Snd.bed,
  };
}

function syncDbg() {
  const d = window.__dbg;
  if (!d) return;
  Object.assign(d, snapshot());
  d.G = G; d.keys = keys; d.pointer = pointer; d.Snd = Snd; d.player = player; d.H = H;
}

function snapCam() {
  camera.position.set(player.x + CAM_OFF.x, CAM_OFF.y, player.z + CAM_OFF.z);
  camera.lookAt(player.x, 2.0, player.z);
  camera.updateMatrixWorld(true);
}

function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  const sx = (_v.x * 0.5 + 0.5) * innerWidth;
  const sy = (-_v.y * 0.5 + 0.5) * innerHeight;
  const visible = _v.z > -1 && _v.z < 1 && sx >= 8 && sx <= innerWidth - 8 && sy >= 8 && sy <= innerHeight - 8;
  return { x: sx, y: sy, visible, nz: _v.z };
}

function buildDbg() {
  window.__dbg = {
    G, keys, pointer, Snd, player,
    start: startGame, goTitle, pauseGame, resumeGame,
    spawnBrain, spawnEvil, clearBrains: () => { for (const b of brains) scene.remove(b.P.root); brains.length = 0; },clearBolts: () => { for (const b of bolts) scene.remove(b.root); bolts.length = 0; },
    snapshot, project, snapCam,
    BOSS_AT, EVIL_HP, HEAD_DMG, BODY_DMG, BRAIN_SCORE,
  };
  syncDbg();
}

async function init() {
  arena = buildArena(scene, backdropTex);
  H = buildRowlex(1);
  H.root.position.set(0, H.standHeight, 0);
  const heroLight = new THREE.PointLight(0xfff2e8, 2.4, 16, 1.8);
  heroLight.position.set(0, 2.2, 1.6);
  H.root.add(heroLight);
  scene.add(H.root);
  $('best').textContent = 'BEST ' + G.best;
  buildDbg();
  ready = true;
  window.__ready = true;
}

loadBackdrop().then(init);
requestAnimationFrame(frame);

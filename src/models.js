// Low-poly characters, faithful to John's art.
// Rowlex: dark-green armored sphere, gear-ringed red eye, amber lamps, rivet spikes, clawed arms, bird legs.
// Evil: tall chunky orange/rust armor, pale skull, blue eyes, metal mask, spiked shoulders, red feet.
// Brains: purple floating brains, pink/white glowing eyes, dripping tendrils.
import * as THREE from 'three';
import { std, glow, additive, part, grp, Tex } from './util.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 16, 12),
  sphLo: new THREE.SphereGeometry(1, 10, 8),
  sphHi: new THREE.SphereGeometry(1, 22, 16),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  tor: new THREE.TorusGeometry(1, 0.2, 8, 20),
};
export { G as GEO };

const B = (p, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => part(p, G.box, m, x, y, z, rx, ry, rz, sx, sy, sz);
const S = (p, m, x, y, z, r, sy = 1, sz = 1) => part(p, G.sph, m, x, y, z, 0, 0, 0, r, r * sy, r * sz);
const C = (p, m, x, y, z, r, h, rx = 0, ry = 0, rz = 0, r2) => part(p, G.cyl, m, x, y, z, rx, ry, rz, r, h, r2 ?? r);
const K = (p, m, x, y, z, r, h, rx = 0, ry = 0, rz = 0, geo = G.cone) => part(p, geo, m, x, y, z, rx, ry, rz, r, h, r);

function clawHand(parent, mat, scale = 1) {
  const h = grp(parent);
  S(h, mat, 0, 0, 0, 0.055 * scale, 0.7, 0.85);
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.45;
    const f = grp(h, Math.sin(a) * 0.04 * scale, 0, 0.04 * scale);
    C(f, mat, 0, 0, 0.06 * scale, 0.014 * scale, 0.11 * scale, Math.PI / 2);
    K(f, mat, 0, 0, 0.13 * scale, 0.016 * scale, 0.07 * scale, Math.PI / 2);
  }
  const th = grp(h, 0.05 * scale, 0, 0);
  C(th, mat, 0, 0, 0.04 * scale, 0.013 * scale, 0.08 * scale, Math.PI / 2, 0, 0.8);
  return h;
}

function birdFoot(parent, mat, scale = 1) {
  const f = grp(parent);
  S(f, mat, 0, 0, 0, 0.06 * scale, 0.6, 1.1);
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.5;
    const t = grp(f, Math.sin(a) * 0.06 * scale, -0.01, Math.cos(a) * 0.02 * scale + 0.05 * scale);
    C(t, mat, 0, 0, 0.07 * scale, 0.016 * scale, 0.14 * scale, Math.PI / 2);
    K(t, mat, 0, -0.01, 0.15 * scale, 0.02 * scale, 0.08 * scale, Math.PI / 2);
  }
  const back = grp(f, 0, 0, -0.05 * scale);
  C(back, mat, 0, 0, -0.05 * scale, 0.014 * scale, 0.1 * scale, Math.PI / 2);
  K(back, mat, 0, -0.01, -0.11 * scale, 0.016 * scale, 0.07 * scale, -Math.PI / 2);
  return f;
}

function limbSeg(parent, mat, len, r, r2) {
  const g = grp(parent);
  C(g, mat, 0, -len / 2, 0, r, len, 0, 0, 0, r2 ?? r * 0.85);
  S(g, mat, 0, 0, 0, r * 1.15);
  return g;
}

export function buildRowlex(scale = 1) {
  const armorMap = Tex.armor();
  const hide = std(0x3a6a48, { roughness: 0.5, metalness: 0.38, map: armorMap, color: 0x4a8a5c, emissive: 0x163820, emissiveIntensity: 0.45 });
  const plate = std(0x101a14, { roughness: 0.5, metalness: 0.7 });
  const rust = std(0x2e241c, { roughness: 0.62, metalness: 0.65 });
  const iron = std(0x2a2c2a, { roughness: 0.45, metalness: 0.85 });
  const steel = std(0x4a4c4a, { roughness: 0.4, metalness: 0.88 });
  const nail = std(0x3a3834, { roughness: 0.45, metalness: 0.8 });
  const eyeLens = new THREE.MeshBasicMaterial({ color: 0x4a0000, toneMapped: false });
  const eyeCore = new THREE.MeshBasicMaterial({ color: 0xe01000, toneMapped: false });
  const amber = new THREE.MeshBasicMaterial({ color: 0xc87814, toneMapped: false });

  const root = new THREE.Group();
  const body = grp(root, 0, 0, 0);
  const shell = grp(body);

  part(shell, G.sphHi, hide, 0, 0, 0, 0, 0, 0, 0.55, 0.55, 0.55);
  part(shell, new THREE.TorusGeometry(0.515, 0.01, 6, 24), iron, 0, -0.30, 0, Math.PI / 2);
  part(shell, new THREE.TorusGeometry(0.53, 0.008, 6, 20), iron, 0, 0.28, -0.22, 1.15, 0, 0.25);

  const nailPts = [
    [0.15, 0.52, 0.08, 0.14], [-0.22, 0.48, 0.18, 0.18], [0.28, 0.44, -0.16, 0.12],
    [-0.08, 0.50, -0.22, 0.16], [0.38, 0.36, 0.12, 0.11], [-0.36, 0.38, -0.08, 0.13],
    [0.10, 0.46, 0.32, 0.10], [-0.30, 0.34, 0.30, 0.12], [0.32, 0.30, 0.30, 0.09],
    [-0.12, 0.42, -0.36, 0.11], [0.02, 0.54, -0.05, 0.15]
  ];
  for (const [x, y, z, len] of nailPts) {
    const n = grp(shell, x, y, z);
    const dir = new THREE.Vector3(x, y, z).normalize();
    n.lookAt(n.position.clone().add(dir));
    C(n, nail, 0, 0, len * 0.35, 0.018, len * 0.7, Math.PI / 2);
    C(n, steel, 0, 0, 0, 0.032, 0.02, Math.PI / 2);
  }

  const eye = grp(shell, 0, 0.02, 0.505);
  part(eye, new THREE.CylinderGeometry(0.2, 0.22, 0.07, 20), plate, 0, 0, -0.08, Math.PI / 2);
  part(eye, new THREE.CircleGeometry(0.2, 20), plate, 0, 0, -0.12);
  part(eye, new THREE.TorusGeometry(0.2, 0.014, 8, 24), iron, 0, 0, -0.015);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    B(eye, iron, Math.cos(a) * 0.215, Math.sin(a) * 0.215, -0.015, 0.026, 0.014, 0.02, 0, 0, a);
  }
  part(eye, new THREE.SphereGeometry(0.16, 18, 14), eyeLens, 0, 0, 0.05, 0, 0, 0, 1, 1, 0.78);
  part(eye, new THREE.SphereGeometry(0.075, 14, 10), eyeCore, 0, 0, 0.115);
  const eyeHalo = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), additive(0xff1408, 0.22, { map: Tex.dot(), side: THREE.DoubleSide, depthWrite: false }));
  eyeHalo.position.z = 0.12; eye.add(eyeHalo);
  const eyeLight = new THREE.PointLight(0xff1808, 0.12, 2.4, 2); eyeLight.position.set(0, 0, 0.2); eye.add(eyeLight);
  const muzzle = grp(eye, 0, 0, 0.22);

  const lamps = [];
  for (const s of [-1, 1]) {
    const lamp = grp(shell, s * 0.29, 0.11, 0.41);
    part(lamp, new THREE.CylinderGeometry(0.05, 0.055, 0.045, 10), iron, 0, 0, 0, Math.PI / 2);
    part(lamp, G.sph, amber, 0, 0, 0.02, 0, 0, 0, 0.038, 0.038, 0.038);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), additive(0xffaa22, 0.28, { map: Tex.dot(), side: THREE.DoubleSide, depthWrite: false }));
    halo.position.z = 0.04; lamp.add(halo);
    lamps.push({ lamp, halo });
  }

  const limbs = grp(root);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(limbs, s * 0.48, -0.05, 0.05);
    sh.rotation.z = s * 0.55;
    sh.rotation.x = 0.25;
    const upper = limbSeg(sh, rust, 0.42, 0.045, 0.035);
    const el = grp(upper, 0, -0.42, 0);
    el.rotation.x = -0.35;
    const lower = limbSeg(el, rust, 0.38, 0.032, 0.026);
    const wrist = grp(lower, 0, -0.38, 0);
    wrist.rotation.x = 0.2;
    const hand = clawHand(wrist, iron, 1.15);
    hand.rotation.x = -Math.PI / 2;
    arms.push({ sh, upper, el, lower, wrist, hand, side: s });
  }

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = grp(limbs, s * 0.28, -0.42, 0.0);
    hip.rotation.z = s * 0.15;
    hip.rotation.x = 0.15;
    const thigh = limbSeg(hip, rust, 0.42, 0.07, 0.055);
    const knee = grp(thigh, 0, -0.42, 0);
    knee.rotation.x = 0.55;
    const shin = limbSeg(knee, rust, 0.46, 0.05, 0.04);
    const ankle = grp(shin, 0, -0.46, 0);
    ankle.rotation.x = -0.55;
    const foot = birdFoot(ankle, iron, 1.2);
    foot.rotation.x = Math.PI / 2;
    legs.push({ hip, thigh, knee, shin, ankle, foot, side: s });
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.05; root.add(shadow);
  root.scale.setScalar(scale);

  const P = {
    root, body, shell, eye, eyeHalo, eyeLight, lamps, limbs, arms, legs, muzzle, shadow,
    standHeight: 1.05 * scale,
  };
  return P;
}

export function poseRowlex(P, opt = {}) {
  const t = opt.t || 0, sp = opt.sp || 0, firing = !!opt.firing;
  const pulse = 0.85 + Math.sin(t * 3.4) * 0.15;
  if (P.eyeLight) P.eyeLight.intensity = (firing ? 0.55 : 0.10) + pulse * 0.06;
  if (P.eyeHalo) P.eyeHalo.material.opacity = (firing ? 0.55 : 0.16) + pulse * 0.07;
  for (const L of P.lamps) L.halo.material.opacity = 0.2 + Math.sin(t * 2.6 + 1) * 0.06;

  const amt = Math.min(1, sp / 7);
  const phase = opt.phase || t * (3 + amt * 5);
  if (amt < 0.08) {
    P.body.position.y = Math.sin(t * 2.2) * 0.03;
    for (let i = 0; i < 2; i++) {
      const L = P.legs[i], A = P.arms[i];
      L.hip.rotation.x = 0.15 + Math.sin(t * 1.6 + i) * 0.04;
      L.knee.rotation.x = 0.55;
      A.sh.rotation.x = 0.25 + Math.sin(t * 1.6 + i + 1) * 0.06;
      A.el.rotation.x = -0.35;
    }
  } else {
    P.body.position.y = Math.abs(Math.sin(phase)) * 0.05 * amt;
    for (let i = 0; i < 2; i++) {
      const sw = Math.sin(phase + (i === 0 ? 0 : Math.PI)) * amt;
      P.legs[i].hip.rotation.x = 0.15 + sw * 0.7;
      P.legs[i].knee.rotation.x = 0.45 + Math.max(0, -sw) * 0.7;
      P.legs[i].ankle.rotation.x = -0.5 - sw * 0.2;
      P.arms[i].sh.rotation.x = 0.25 - sw * 0.5;
      P.arms[i].el.rotation.x = -0.35 - Math.max(0, sw) * 0.25;
    }
  }
  if (firing) {
    for (const A of P.arms) {
      A.sh.rotation.x = -0.85;
      A.sh.rotation.z = A.side * 0.35;
      A.el.rotation.x = -0.15;
    }
  }
}

// ---------------------------------------------------------------- EVIL (boss) — chunky Quake-era armor, distinct head group for 111 dmg headshots
export function buildEvil(scale = 1) {
  const plateMap = Tex.rustPlate();
  const orange = std(0xd26018, { roughness: 0.48, metalness: 0.55, map: plateMap, emissive: 0x3a1204, emissiveIntensity: 0.25 });
  const orangeHi = std(0xe87820, { roughness: 0.42, metalness: 0.6, map: plateMap, emissive: 0x4a1604, emissiveIntensity: 0.18 });
  const copper = std(0x8a5a40, { roughness: 0.5, metalness: 0.75 });
  const steel = std(0x7a7068, { roughness: 0.4, metalness: 0.85 });
  const dark = std(0x2a2420, { roughness: 0.55, metalness: 0.7 });
  const skin = std(0xd8c8b0, { roughness: 0.7, metalness: 0.05 });
  const redFoot = std(0xc01010, { roughness: 0.45, metalness: 0.35, emissive: 0x5a0000, emissiveIntensity: 0.45 });
  const emblem = std(0x7a1408, { roughness: 0.5, metalness: 0.4, emissive: 0x4a0800, emissiveIntensity: 0.5 });
  const eyeBlue = new THREE.MeshBasicMaterial({ color: 0x2266ff, toneMapped: false });
  const eyeGlow = additive(0x4488ff, 0.7, { map: Tex.dot(), side: THREE.DoubleSide, depthWrite: false });

  const root = new THREE.Group();
  // hip / pelvis at ~1.85
  const hips = grp(root, 0, 1.85, 0);

  // Midsection — silver ribs
  const mid = grp(hips, 0, 0.28, 0);
  B(mid, steel, 0, 0, 0, 0.55, 0.55, 0.4);
  for (let i = 0; i < 4; i++) {
    const y = -0.22 + i * 0.14;
    B(mid, copper, 0, y, 0.22, 0.5 - i * 0.02, 0.06, 0.08);
  }

  // Chest — huge orange plates
  const chest = grp(hips, 0, 0.85, 0);
  B(chest, orange, 0, 0.05, 0.05, 1.35, 0.95, 0.7);
  B(chest, orangeHi, 0, 0.15, 0.38, 1.05, 0.7, 0.22);
  // red emblems
  B(chest, emblem, -0.28, 0.22, 0.50, 0.22, 0.22, 0.04);
  B(chest, emblem, 0.28, 0.22, 0.50, 0.22, 0.22, 0.04);
  // dark glyph
  B(chest, dark, 0, 0.18, 0.50, 0.16, 0.28, 0.05);
  B(chest, emblem, 0, 0.22, 0.54, 0.08, 0.14, 0.03);

  // Spiked shoulders
  for (const s of [-1, 1]) {
    const sh = grp(chest, s * 0.85, 0.35, -0.05);
    B(sh, orangeHi, 0, 0, 0, 0.7, 0.55, 0.7);
    B(sh, emblem, s * 0.2, 0.05, 0.36, 0.28, 0.28, 0.04);
    K(sh, orange, s * 0.15, 0.42, -0.1, 0.12, 0.45, 0, 0, s * -0.25, G.cone4);
    K(sh, orange, s * 0.05, 0.38, 0.2, 0.08, 0.32, 0.2, 0, s * -0.2, G.cone4);
  }

  // Arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(chest, s * 0.95, 0.05, 0);
    sh.rotation.z = s * 0.25;
    const upper = B(sh, orange, 0, -0.45, 0, 0.42, 0.9, 0.42);
    const el = grp(sh, 0, -0.95, 0);
    el.rotation.x = -0.2;
    const lower = B(el, copper, 0, -0.4, 0, 0.38, 0.8, 0.38);
    const hand = grp(el, 0, -0.85, 0);
    // chunky fist / plate-hand
    B(hand, orange, 0, -0.1, 0.05, 0.45, 0.28, 0.5);
    B(hand, dark, 0, -0.22, 0.22, 0.2, 0.12, 0.18);
    arms.push({ sh, el, hand, side: s });
  }

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = grp(hips, s * 0.32, -0.15, 0);
    hip.rotation.z = s * 0.05;
    // huge thigh plate
    const thigh = B(hip, orange, 0, -0.5, 0.05, 0.7, 1.05, 0.75);
    const knee = grp(hip, 0, -1.05, 0);
    B(knee, copper, 0, 0, 0, 0.45, 0.28, 0.4);
    const shin = B(knee, copper, 0, -0.45, 0, 0.42, 0.85, 0.42);
    const ankle = grp(knee, 0, -0.9, 0);
    // red rock-like feet
    const foot = B(ankle, redFoot, 0, -0.12, 0.12, 0.7, 0.28, 0.95);
    B(ankle, redFoot, 0, -0.02, -0.25, 0.4, 0.2, 0.3);
    legs.push({ hip, knee, ankle, foot, side: s });
  }

  // HEAD — distinct group, small hitbox lives here
  const head = grp(chest, 0, 0.72, 0.08);
  // pale skull
  S(head, skin, 0, 0.08, 0.02, 0.28, 1.1, 1.05);
  // cranium slightly larger
  S(head, skin, 0, 0.14, -0.02, 0.26, 0.9, 0.95);
  // metal mouth mask / grille
  B(head, steel, 0, -0.08, 0.18, 0.28, 0.16, 0.12);
  for (let i = 0; i < 3; i++) B(head, dark, (i - 1) * 0.07, -0.08, 0.25, 0.03, 0.12, 0.02);
  // brow
  B(head, skin, 0, 0.16, 0.22, 0.3, 0.06, 0.08);
  // blue eyes
  const eyes = [];
  for (const s of [-1, 1]) {
    S(head, eyeBlue, s * 0.09, 0.08, 0.24, 0.045);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), eyeGlow.clone());
    halo.position.set(s * 0.09, 0.08, 0.28); head.add(halo);
    eyes.push(halo);
  }
  // side spikes on helmet-less skull
  K(head, steel, 0.26, 0.18, -0.02, 0.05, 0.22, 0, 0, -1.1, G.cone4);
  K(head, steel, -0.26, 0.18, -0.02, 0.05, 0.22, 0, 0, 1.1, G.cone4);
  // neck
  C(head, steel, 0, -0.22, 0, 0.12, 0.18);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  root.scale.setScalar(scale);

  return {
    root, hips, chest, head, arms, legs, eyes, shadow,
    // local-space hit data (unscaled); callers multiply by scale
    headRadius: 0.42,
    bodyRadius: 0.95,
    bodyHeight: 2.5,
    standHeight: 0,
    scale,
  };
}

export function poseEvil(P, opt = {}) {
  const t = opt.t || 0, sp = opt.sp || 0, atk = opt.attack || 0;
  const amt = Math.min(1, sp / 4);
  const phase = t * (2.2 + amt * 3);
  P.hips.position.y = 1.85 + Math.abs(Math.sin(phase)) * 0.06 * Math.max(0.2, amt);
  for (let i = 0; i < 2; i++) {
    const sw = Math.sin(phase + (i === 0 ? 0 : Math.PI)) * (0.15 + amt * 0.55);
    P.legs[i].hip.rotation.x = sw;
    P.legs[i].knee.rotation.x = Math.max(0, -sw) * 0.5;
    P.arms[i].sh.rotation.x = -sw * 0.5 + (atk > 0 && i === 1 ? -1.2 * Math.sin(atk * Math.PI) : 0);
    P.arms[i].el.rotation.x = -0.2 - Math.max(0, sw) * 0.3;
  }
  P.head.rotation.y = Math.sin(t * 0.8) * 0.15;
  P.chest.rotation.y = Math.sin(t * 0.5) * 0.04;
  for (const e of P.eyes) e.material.opacity = 0.5 + Math.sin(t * 6) * 0.25;
}

// ---------------------------------------------------------------- BRAIN enemies
let _brainMat = null, _tendrilMat = null, _wrinkle = null;
function brainMats() {
  if (_brainMat) return { brain: _brainMat, tendril: _tendrilMat, wrinkle: _wrinkle };
  _wrinkle = Tex.brain();
  _brainMat = std(0x8a28a0, {
    roughness: 0.55, metalness: 0.15, map: _wrinkle,
    emissive: 0x3a0860, emissiveIntensity: 0.45,
  });
  _tendrilMat = std(0x6a1a80, { roughness: 0.4, metalness: 0.1, emissive: 0x2a0440, emissiveIntensity: 0.3, transparent: true, opacity: 0.92 });
  return { brain: _brainMat, tendril: _tendrilMat, wrinkle: _wrinkle };
}

export function buildBrain(scale = 1) {
  const { brain, tendril } = brainMats();
  const root = new THREE.Group();
  const body = grp(root, 0, 0, 0);
  // wrinkled sphere + a slightly offset lobe
  S(body, brain, 0, 0.02, 0, 0.55, 0.9, 0.95);
  S(body, brain, 0.08, 0.06, -0.05, 0.42, 0.85, 0.8);
  // shallow grooves as thin torus rings
  const groove = std(0x4a1070, { roughness: 0.6, metalness: 0.1, emissive: 0x2a0448, emissiveIntensity: 0.25 });
  part(body, new THREE.TorusGeometry(0.42, 0.04, 6, 16), groove, 0, 0.08, 0, 0.6, 0.2, 0);
  part(body, new THREE.TorusGeometry(0.36, 0.035, 6, 14), groove, 0, -0.05, 0.05, 1.2, -0.4, 0.3);

  const eyeW = new THREE.MeshBasicMaterial({ color: 0xfff0ff, toneMapped: false });
  const eyeP = new THREE.MeshBasicMaterial({ color: 0xff44ee, toneMapped: false });
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = grp(body, s * 0.18, 0.06, 0.42);
    S(eg, eyeP, 0, 0, 0, 0.11);
    S(eg, eyeW, 0, 0, 0.04, 0.055);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), additive(0xff66ff, 0.55, { map: Tex.dot(), side: THREE.DoubleSide, depthWrite: false }));
    halo.position.z = 0.08; eg.add(halo);
    eyes.push({ eg, halo });
  }

  const tendrils = [];
  const tpts = [
    [-0.2, -0.4, 0.05, 0.42], [0.18, -0.45, -0.02, 0.5],
    [0.02, -0.48, 0.12, 0.38], [-0.08, -0.42, -0.16, 0.46],
    [0.28, -0.38, 0.1, 0.34], [-0.3, -0.36, -0.08, 0.36],
  ];
  for (const [x, y, z, len] of tpts) {
    const t = grp(body, x, y, z);
    C(t, tendril, 0, -len * 0.35, 0, 0.045, len * 0.7, 0, 0, 0, 0.02);
    S(t, tendril, 0, -len * 0.72, 0, 0.04, 1.4, 1.4);
    tendrils.push({ t, len, ox: x, oy: y, oz: z });
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.1; root.add(shadow);
  root.scale.setScalar(scale);

  return { root, body, eyes, tendrils, shadow, radius: 0.55 * scale };
}

export function poseBrain(P, t, hurt = 0) {
  P.body.rotation.y = Math.sin(t * 0.7) * 0.25;
  P.body.position.y = Math.sin(t * 2.4) * 0.08;
  P.body.rotation.z = Math.sin(t * 1.6) * 0.08 + hurt * 0.4;
  for (let i = 0; i < P.tendrils.length; i++) {
    const T = P.tendrils[i];
    T.t.rotation.x = Math.sin(t * 3 + i) * 0.35;
    T.t.rotation.z = Math.cos(t * 2.2 + i * 1.3) * 0.3;
  }
  for (const e of P.eyes) e.halo.material.opacity = 0.4 + Math.sin(t * 5) * 0.2;
}

export function buildBolt(color = 0xff2010, scale = 1) {
  const g = new THREE.Group();
  const core = part(g, G.sph, glow(color, 2.2), 0, 0, 0, 0, 0, 0, 0.09 * scale, 0.09 * scale, 0.16 * scale);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.55 * scale, 0.55 * scale), additive(color, 0.7, { map: Tex.dot(), side: THREE.DoubleSide, depthWrite: false }));
  g.add(halo);
  const trail = part(g, G.sph, additive(color, 0.45), 0, 0, -0.12 * scale, 0, 0, 0, 0.06 * scale, 0.06 * scale, 0.22 * scale);
  g.userData.halo = halo;
  g.userData.core = core;
  g.userData.trail = trail;
  return g;
}

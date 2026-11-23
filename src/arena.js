import * as THREE from 'three';
import { std, glow, additive, part, grp, Tex, instanced, rnd } from './util.js';

export const ARENA_R = 18;

export function buildArena(scene, backdropTex) {
  const fogCol = new THREE.Color(0x0b0818);
  scene.fog = new THREE.FogExp2(fogCol, 0.016);
  scene.background = new THREE.Color(0x070614);

  // Wide painted backdrop of John's portal/mountain art (GameStop mark kept, as he chose)
  if (backdropTex) {
    backdropTex.colorSpace = THREE.SRGBColorSpace;
    backdropTex.anisotropy = 4;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 90),
      new THREE.MeshBasicMaterial({ map: backdropTex, fog: false, depthWrite: false })
    );
    wall.position.set(0, 24, -50);
    wall.scale.set(1.2, 1.15, 1);
    scene.add(wall);
  }

  // Ground
  const rock = Tex.rock();
  rock.wrapS = rock.wrapT = THREE.RepeatWrapping;
  rock.repeat.set(8, 8);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_R + 1.2, 64),
    std(0x1a1224, { map: rock, roughness: 0.92, metalness: 0.08, emissive: 0x140820, emissiveIntensity: 0.18 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);
  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    std(0x14081c, { roughness: 1, metalness: 0, emissive: 0x100818, emissiveIntensity: 0.35 })
  );
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.08; scene.add(apron);

  // Inner ring etch
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA_R - 0.35, ARENA_R + 0.15, 64),
    glow(0xc040ff, 0.55)
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);

  // Purple fog floor glow
  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_R * 0.7, 32),
    additive(0xa020c0, 0.18, { map: Tex.dot(), depthWrite: false, side: THREE.DoubleSide })
  );
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.04; scene.add(floorGlow);

  // Scattered rocks
  const rockMat = std(0x4a3a62, { roughness: 0.86, metalness: 0.12, map: rock, emissive: 0x2a1838, emissiveIntensity: 0.28 });
  const poses = [];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * (ARENA_R - 6);
    poses.push({
      x: Math.cos(a) * r, y: 0.15 + Math.random() * 0.4, z: Math.sin(a) * r,
      rx: Math.random() * 0.5, ry: Math.random() * 6, rz: Math.random() * 0.4,
      sx: 0.4 + Math.random() * 1.1, sy: 0.25 + Math.random() * 0.7, sz: 0.4 + Math.random() * 1.1,
    });
  }
  // Keep the very center mostly clear for starting
  const rocks = instanced(new THREE.DodecahedronGeometry(1, 0), rockMat, poses);
  scene.add(rocks);


  // Physical portal disc in the sky (shootable secret target + centerpiece)
  const portal = grp(scene, 0, 22, -28);
  const pRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.28, 12, 48), glow(0xff66ff, 2.4));
  portal.add(pRing);
  const pRing2 = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.08, 8, 40), glow(0xffe6ff, 2.0));
  portal.add(pRing2);
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 40),
    new THREE.MeshBasicMaterial({ color: 0x050010, fog: false, side: THREE.DoubleSide })
  );
  portal.add(core);
  // vertical beam
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 40),
    additive(0xe8f0ff, 0.45, { side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.set(0, 8, 0); portal.add(beam);
  const pHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    additive(0xff44ee, 0.35, { map: Tex.ring(), side: THREE.DoubleSide, depthWrite: false })
  );
  portal.add(pHalo);
  const pLight = new THREE.PointLight(0xff44cc, 2.2, 70, 1.6); pLight.position.set(0, 0, 6); portal.add(pLight);

  // GameStop-style mark on the portal — John kept the logo in the source art
  const mark = makeMark();
  mark.position.set(0, 0.2, 0.05); portal.add(mark);

  // Pterodactyl silhouettes circling the horizon
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x050308, fog: true, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const b = makePtero(birdMat);
    const r = ARENA_R + 10 + Math.random() * 16;
    const y = 6 + Math.random() * 10;
    const a0 = Math.random() * Math.PI * 2;
    Object.assign(b.userData, { r, y, a0, spd: 0.08 + Math.random() * 0.12, flap: Math.random() * 6 });
    scene.add(b);
    birds.push(b);
  }

  // Lights — keep characters readable against the dark arena
  const hemi = new THREE.HemisphereLight(0xc8e8ff, 0x3a1848, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8ff, 1.35);
  sun.position.set(8, 24, 18); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x80c8ff, 0.7);
  fill.position.set(-12, 10, 16); scene.add(fill);
  const rim = new THREE.PointLight(0x40ffe0, 1.6, 55, 2); rim.position.set(0, 4, 12); scene.add(rim);
  const key = new THREE.PointLight(0xfff0e0, 1.8, 30, 1.6); key.position.set(0, 6, 6); scene.add(key);

  // Teal horizon haze
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(70, 70, 10, 32, 1, true),
    additive(0x30ffe0, 0.12, { side: THREE.BackSide, depthWrite: false, fog: false })
  );
  haze.position.y = 2; scene.add(haze);

  return { portal, portalCore: core, portalRing: pRing, birds, floorGlow };
}

function makeMark() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 160);
  g.font = 'bold italic 88px "Arial Black", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#fff'; g.shadowBlur = 12;
  g.fillStyle = '#f4f4f4'; g.fillText('Game', 200, 88);
  g.fillStyle = '#e10600'; g.fillText('Stop', 355, 88);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  return m;
}

function makePtero(mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 4), mat);
  body.rotation.x = Math.PI / 2; g.add(body);
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), mat);
  const wingR = wingL.clone();
  wingL.position.set(-0.7, 0, 0); wingR.position.set(0.7, 0, 0);
  g.add(wingL); g.add(wingR);
  g.userData.wingL = wingL; g.userData.wingR = wingR;
  return g;
}

export function tickArena(A, t) {
  if (A.portalRing) A.portalRing.rotation.z = t * 0.15;
  if (A.floorGlow) A.floorGlow.material.opacity = 0.12 + Math.sin(t * 0.8) * 0.05;
  for (const b of A.birds) {
    const u = b.userData;
    const a = u.a0 + t * u.spd;
    b.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.6 + u.flap) * 0.4, Math.sin(a) * u.r);
    b.rotation.y = -a + Math.PI / 2;
    const flap = Math.sin(t * 6 + u.flap) * 0.45;
    u.wingL.rotation.z = 0.25 + flap;
    u.wingR.rotation.z = -0.25 - flap;
  }
}

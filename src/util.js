import * as THREE from 'three';
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};

export function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o }); }
export function glow(color, intensity = 2) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }); }
export function additive(color, opacity = 0.5, o = {}) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...o }); }

export function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m;
}
export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

export const Tex = {
  dot() {
    return canvasTex(64, 64, (g, w) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
  },
  ring() {
    return canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.55, 'rgba(255,255,255,1)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.4)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
  },
  rock() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#121018'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const v = 30 + Math.random() * 50 | 0;
        g.fillStyle = `rgba(${v + 8},${v - 6},${v + 16},0.45)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2);
      }
      for (let i = 0; i < 16; i++) {
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += Math.random() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    });
  },
  armor() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#2a4a36'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8000; i++) {
        const v = 14 + Math.random() * 28 | 0;
        g.fillStyle = `rgba(${v - 4},${v + 6},${v - 2},0.28)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      const cols = 6, rows = 5, pw = w / cols, ph = h / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * pw + 6, y = j * ph + 6;
        const lift = 10 + Math.random() * 18 | 0;
        g.fillStyle = `rgba(${28 + lift},${50 + lift},${34 + lift},0.5)`;
        g.fillRect(x, y, pw - 12, ph - 12);
        g.strokeStyle = 'rgba(6,10,8,0.85)'; g.lineWidth = 3;
        g.strokeRect(x, y, pw - 12, ph - 12);
        g.fillStyle = 'rgba(30,36,32,0.9)';
        for (const [rx, ry] of [[8, 8], [pw - 20, 8], [8, ph - 20], [pw - 20, ph - 20]]) {
          g.beginPath(); g.arc(x + rx, y + ry, 2.4, 0, 6.28); g.fill();
        }
      }
      g.strokeStyle = 'rgba(8,14,10,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.arc(w * 0.5, h * 0.55, 180, 0.2, 2.6); g.stroke();
      g.beginPath(); g.arc(w * 0.5, h * 0.4, 200, 3.4, 5.9); g.stroke();
    });
  },
  rustPlate() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f08a20'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        const r = 210 + Math.random() * 45 | 0;
        const gg = 100 + Math.random() * 70 | 0;
        const b = 16 + Math.random() * 18 | 0;
        g.fillStyle = `rgba(${r},${gg},${b},0.35)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2);
      }
      g.strokeStyle = 'rgba(40,16,4,0.7)'; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        g.strokeRect(8 + Math.random() * 40, 8 + Math.random() * 40, 80 + Math.random() * 80, 60 + Math.random() * 80);
      }
      // weathering streaks
      for (let i = 0; i < 20; i++) {
        g.fillStyle = `rgba(80,30,10,${0.12 + Math.random() * 0.2})`;
        g.fillRect(Math.random() * w, 0, 3 + Math.random() * 6, h);
      }
    });
  },
  brain() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6a1a7a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(${80 + Math.random() * 80 | 0},${20 + Math.random() * 40 | 0},${120 + Math.random() * 80 | 0},0.85)`;
        g.lineWidth = 3 + Math.random() * 5;
        g.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (Math.random() - 0.5) * 40;
          y += (Math.random() - 0.35) * 36;
          g.quadraticCurveTo(x + 10, y - 8, x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 2000; i++) {
        const v = 80 + Math.random() * 60 | 0;
        g.fillStyle = `rgba(${v},${v * 0.3 | 0},${v + 40},0.25)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  },
};

export function instanced(geo, mat, poses) {
  const mesh = new THREE.InstancedMesh(geo, mat, poses.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < poses.length; i++) {
    const o = poses[i];
    p.set(o.x, o.y, o.z);
    e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    q.setFromEuler(e);
    s.set(o.s || o.sx || 1, o.sy || o.s || 1, o.sz || o.s || 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

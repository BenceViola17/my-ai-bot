// MyAI 3D UI — Three.js háttér + multi-model párhuzamos chat
import * as THREE from 'three';

/* ---------- 3D háttér: lebegő neurálsgömb ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.06);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 14;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('bg3d').appendChild(renderer.domElement);

// "Agy" — pontfelhő gömb
const COUNT = 1600;
const positions = new Float32Array(COUNT * 3);
const colors = new Float32Array(COUNT * 3);
const c1 = new THREE.Color(0x2563eb), c2 = new THREE.Color(0x7c3aed), c3 = new THREE.Color(0x22d3aa);
for (let i = 0; i < COUNT; i++) {
  const r = 7 + Math.random() * 2.2;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
  positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
  positions[i * 3 + 2] = r * Math.cos(ph);
  const c = [c1, c2, c3][i % 3];
  colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const brain = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.85 }));
scene.add(brain);

// forgó gyűrűk
const rings = [];
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9 + i * 1.6, 0.02, 8, 120),
    new THREE.MeshBasicMaterial({ color: [0x2563eb, 0x7c3aed, 0x22d3aa][i], transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2 + i * 0.5;
  scene.add(ring); rings.push(ring);
}

let mouse = { x: 0, y: 0 };
addEventListener('mousemove', (e) => { mouse.x = (e.clientX / innerWidth - .5); mouse.y = (e.clientY / innerHeight - .5); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let pulse = 0;
function animate(t) {
  requestAnimationFrame(animate);
  brain.rotation.y = t * 0.00012;
  brain.rotation.x = mouse.y * 0.3;
  brain.scale.setScalar(1 + pulse * 0.06);
  rings.forEach((r, i) => { r.rotation.z = t * (0.0002 + i * 0.0001) * (i % 2 ? -1 : 1); });
  camera.position.x += (mouse.x * 2 - camera.position.x) * 0.03;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

/* ---------- Chat logika: párhuzamos multi-model ---------- */
const chatEl = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

function addMsg(cls, tag, text) {
  const row = document.createElement('div'); row.className = 'row';
  if (tag) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = tag; row.appendChild(t); }
  const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text;
  row.appendChild(d); chatEl.appendChild(row); chatEl.scrollTop = chatEl.scrollHeight;
  return d;
}

// elérhető modellek
let models = ['llama3.2'];
fetch('/v1/models').then(r => r.json()).then(j => {
  const set = [...new Set(j.data.map(m => m.id))];
  models = set.length ? set : models;
  statusEl.textContent = `${models.length} modell aktív`;
  addMsg('bot', 'rendszer', `Üdv! Aktív modellek: ${models.join(', ')}\nMinden kérdésre párhuzamosan válaszolnak.`);
}).catch(() => { statusEl.textContent = 'szerver nem elérhető'; });

async function send() {
  const q = input.value.trim();
  if (!q) return;
  input.value = ''; sendBtn.disabled = true;
  pulse = 1;
  addMsg('user', null, q);

  // modellenkénti válaszpanelek
  const panes = new Map(models.map(m => [m, addMsg('bot', m, '…')]));
  const got = new Set(models.map(() => ''));

  try {
    const res = await fetch('/v1/parallel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, models }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === 'delta') {
            got.set(ev.key.replace('ollama/', ''), (got.get(ev.key.replace('ollama/', '')) || '') + ev.delta);
            const el = panes.get(ev.key.replace('ollama/', ''));
            if (el) { el.textContent = got.get(ev.key.replace('ollama/', '')); chatEl.scrollTop = chatEl.scrollHeight; }
          } else if (ev.type === 'done' && !ev.ok) {
            const el = panes.get(ev.model);
            if (el) el.textContent = `⚠ ${ev.error}`;
          }
        } catch { /* ignore */ }
      }
    }
  } catch (e) {
    addMsg('bot', 'hiba', '⚠ Szerver hiba: futtasd `pnpm run serve`!');
  }
  pulse = 0;
  sendBtn.disabled = false;
  input.focus();
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

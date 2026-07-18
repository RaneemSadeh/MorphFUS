/* ═══════════════════════════════════════════════════════════
   PATIENT PAGE — Three.js 3D Body Model + Vitals
   ═══════════════════════════════════════════════════════════ */

// ─── Time Display ──────────────────────────────────────────
function updateTime() {
  const d = document.getElementById('timeDisplay');
  if (d) d.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}
updateTime(); setInterval(updateTime, 1000);

// ─── Theme Toggle ─────────────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// ─── Three.js Body Scene ──────────────────────────────────
let bodyRenderer, bodyScene, bodyCamera, bodyAnimId;
let bodyMesh, tumorMesh, tumorGlow, targetRings = [], bodyGroup;
let currentView = 'front';

function initBodyScene() {
  const canvas = document.getElementById('bodyCanvas');
  const wrap   = document.getElementById('bodyCanvasWrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;

  bodyRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  bodyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  bodyRenderer.setSize(W, H);
  bodyRenderer.shadowMap.enabled = true;
  bodyRenderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  bodyScene = new THREE.Scene();

  bodyCamera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
  bodyCamera.position.set(0, 0.5, 4.5);

  // Lighting
  const ambient = new THREE.AmbientLight(0xe8edf8, 0.8);
  bodyScene.add(ambient);

  const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
  dir1.position.set(2, 4, 3);
  dir1.castShadow = true;
  bodyScene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0xd0d8f0, 0.5);
  dir2.position.set(-2, 1, -2);
  bodyScene.add(dir2);

  const fill = new THREE.PointLight(0x4488ff, 0.3, 20);
  fill.position.set(3, 0, 2);
  bodyScene.add(fill);

  // ─── Build Body from Primitives ──────────────────────────
  bodyGroup = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd8dde8,
    roughness: 0.45,
    metalness: 0.05,
    envMapIntensity: 0.5,
  });

  // Torso
  const torsoGeo = new THREE.CylinderGeometry(0.48, 0.42, 1.6, 32, 4, false);
  const torso    = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.y = 0;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Chest bump
  const chestGeo = new THREE.SphereGeometry(0.55, 32, 24, 0, Math.PI*2, 0, Math.PI/2);
  const chest = new THREE.Mesh(chestGeo, bodyMat);
  chest.position.set(0, 0.55, 0.1);
  chest.scale.set(1, 0.7, 0.85);
  bodyGroup.add(chest);

  // Abdomen
  const abdGeo = new THREE.SphereGeometry(0.46, 32, 24, 0, Math.PI*2, Math.PI/2, Math.PI/2);
  const abd = new THREE.Mesh(abdGeo, bodyMat);
  abd.position.set(0, -0.1, 0.06);
  abd.scale.set(1, 1.1, 0.9);
  bodyGroup.add(abd);

  // Hips
  const hipGeo = new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI*2, 0, Math.PI/2);
  const hips = new THREE.Mesh(hipGeo, bodyMat);
  hips.position.set(0, -0.78, 0);
  hips.scale.set(1.1, 0.6, 0.9);
  bodyGroup.add(hips);

  // Head
  const headGeo = new THREE.SphereGeometry(0.28, 32, 32);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 1.35, 0);
  head.castShadow = true;
  bodyGroup.add(head);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 16);
  const neck = new THREE.Mesh(neckGeo, bodyMat);
  neck.position.set(0, 1.05, 0);
  bodyGroup.add(neck);

  // Shoulders
  const shGeo = new THREE.SphereGeometry(0.17, 24, 20);
  [-0.65, 0.65].forEach(x => {
    const sh = new THREE.Mesh(shGeo, bodyMat);
    sh.position.set(x, 0.72, 0);
    bodyGroup.add(sh);
  });

  // Upper Arms
  const uaGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.55, 16);
  [-0.72, 0.72].forEach(x => {
    const ua = new THREE.Mesh(uaGeo, bodyMat);
    ua.position.set(x, 0.38, 0);
    ua.rotation.z = x < 0 ? 0.3 : -0.3;
    bodyGroup.add(ua);
  });

  // Forearms
  const faGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.5, 16);
  [-0.85, 0.85].forEach(x => {
    const fa = new THREE.Mesh(faGeo, bodyMat);
    fa.position.set(x, 0.02, 0);
    fa.rotation.z = x < 0 ? 0.6 : -0.6;
    bodyGroup.add(fa);
  });

  // Legs
  const thighGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.65, 20);
  const shinGeo  = new THREE.CylinderGeometry(0.10, 0.08, 0.55, 16);
  [-0.22, 0.22].forEach(x => {
    const th = new THREE.Mesh(thighGeo, bodyMat);
    th.position.set(x, -1.18, 0);
    bodyGroup.add(th);
    const sh = new THREE.Mesh(shinGeo, bodyMat);
    sh.position.set(x, -1.73, 0);
    bodyGroup.add(sh);
  });

  // Feet
  const footGeo = new THREE.BoxGeometry(0.18, 0.08, 0.28);
  [-0.22, 0.22].forEach(x => {
    const foot = new THREE.Mesh(footGeo, bodyMat);
    foot.position.set(x, -2.06, 0.05);
    bodyGroup.add(foot);
  });

  bodyGroup.position.y = 0.4;
  bodyScene.add(bodyGroup);

  // ─── Tumor Marker ──────────────────────────────────────
  createTumorMarker();

  // ─── Ground shadow plane ──────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(6, 6);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.06 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.8;
  ground.receiveShadow = true;
  bodyScene.add(ground);

  animateBody();
  window.addEventListener('resize', onBodyResize);
}

function createTumorMarker() {
  // Remove old
  if (tumorMesh) bodyGroup.remove(tumorMesh);
  if (tumorGlow) bodyGroup.remove(tumorGlow);
  targetRings.forEach(r => bodyGroup.remove(r));
  targetRings = [];

  const x = parseFloat(document.getElementById('coordX').value) * 0.1 || 0;
  const y = parseFloat(document.getElementById('coordY').value) * 0.1 || 0;
  const z = parseFloat(document.getElementById('coordZ').value) * 0.05 || 0;
  const size = parseFloat(document.getElementById('tumorSize').value) * 0.004 || 0.1;

  // Tumor sphere
  const tumorGeo = new THREE.SphereGeometry(size, 24, 24);
  const tumorMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0xff0000,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  tumorMesh = new THREE.Mesh(tumorGeo, tumorMat);
  tumorMesh.position.set(x, y, z);
  bodyGroup.add(tumorMesh);

  // Glow sphere
  const glowGeo = new THREE.SphereGeometry(size * 1.8, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff3333,
    transparent: true, opacity: 0.12,
    side: THREE.BackSide,
  });
  tumorGlow = new THREE.Mesh(glowGeo, glowMat);
  tumorGlow.position.copy(tumorMesh.position);
  bodyGroup.add(tumorGlow);

  // Pulsing rings
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.RingGeometry(size * (1.5 + i), size * (1.6 + i), 32);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb, transparent: true, opacity: 0.25 - i * 0.07,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.position.copy(tumorMesh.position);
    ring.lookAt(bodyCamera.position);
    ring.userData.delay = i * 0.4;
    bodyGroup.add(ring);
    targetRings.push(ring);
  }

  updateBodyLabel(x, y, z);
}

function updateBodyLabel(x, y, z) {
  const label = document.getElementById('tumorLabel');
  const coords = document.getElementById('labelCoords');
  const cx = document.getElementById('coordX').value;
  const cy = document.getElementById('coordY').value;
  const cz = document.getElementById('coordZ').value;
  label.style.display = 'flex';
  label.style.left = '55%';
  label.style.top  = '40%';
  coords.textContent = `X:${cx} Y:${cy} Z:${cz}`;
  document.getElementById('labelCoords').textContent = `X:${cx} Y:${cy} Z:${cz}`;
  document.getElementById('depthLabel').textContent = document.getElementById('tumorDepth').value + ' mm';
  document.getElementById('diameterLabel').textContent = document.getElementById('tumorSize').value + ' mm';
}

function setBodyView(view) {
  currentView = view;
  document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1)).classList.add('active');

  const dur = 800;
  let targetPos;
  if (view === 'front') targetPos = new THREE.Vector3(0, 0.5, 4.5);
  if (view === 'side')  targetPos = new THREE.Vector3(4, 0.5, 0);
  if (view === 'top')   targetPos = new THREE.Vector3(0, 5, 0.01);

  animateCameraTo(targetPos);
}

function animateCameraTo(target) {
  const start = bodyCamera.position.clone();
  const startTime = performance.now();
  const dur = 700;
  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    bodyCamera.position.lerpVectors(start, target, ease);
    bodyCamera.lookAt(0, 0, 0);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

let bodyRot = 0;
function animateBody() {
  bodyAnimId = requestAnimationFrame(animateBody);
  bodyRot += 0.004;
  if (currentView === 'front') {
    bodyGroup.rotation.y = Math.sin(bodyRot) * 0.12;
  }
  // Tumor pulse
  if (tumorMesh) {
    const s = 1 + 0.08 * Math.sin(Date.now() * 0.003);
    tumorMesh.scale.setScalar(s);
    if (tumorGlow) tumorGlow.scale.setScalar(s * 1.05);
  }
  // Ring pulse
  targetRings.forEach((r, i) => {
    const t = Date.now() * 0.002 + r.userData.delay;
    r.material.opacity = 0.15 + 0.15 * Math.sin(t);
    const s = 1 + 0.12 * Math.sin(t);
    r.scale.setScalar(s);
  });

  bodyRenderer.render(bodyScene, bodyCamera);
}

function onBodyResize() {
  const wrap = document.getElementById('bodyCanvasWrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  bodyCamera.aspect = W / H;
  bodyCamera.updateProjectionMatrix();
  bodyRenderer.setSize(W, H);
}

// ─── Mini Vitals Wave (Patient Page) ──────────────────────
function initVitalsCanvas() {
  const canvas = document.getElementById('vitalsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = 60 * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  let offset = 0;

  function drawVitals() {
    const W = canvas.offsetWidth, H = 60;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 15) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ECG wave
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x++) {
      const phase = (x + offset) / W * Math.PI * 8;
      let y = H / 2;
      // ECG-like shape
      const beat = Math.floor((x + offset) % (W / 3));
      const cycle = W / 3;
      const pos = beat / cycle;
      if (pos < 0.1) y = H / 2;
      else if (pos < 0.15) y = H / 2 - 8;
      else if (pos < 0.2) y = H / 2 + 5;
      else if (pos < 0.25) y = H / 2 - 25;
      else if (pos < 0.32) y = H / 2 + 12;
      else if (pos < 0.38) y = H / 2 - 5;
      else y = H / 2 + Math.sin(phase * 0.3) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    offset += 1.5;
    requestAnimationFrame(drawVitals);
  }
  drawVitals();
}

// ─── Tumor location update ─────────────────────────────────
function updateLocation() {
  const type = document.getElementById('tumorType')?.value || '';
  const labels = {
    'Hepatocellular Carcinoma': 'Liver — Right Lobe',
    'Breast Carcinoma':         'Breast — Upper Outer',
    'Prostate Adenocarcinoma':  'Prostate — Peripheral',
    'Pancreatic Ductal Carcinoma': 'Pancreas — Head',
    'Renal Cell Carcinoma':     'Kidney — Left',
    'Uterine Fibroid (Benign)': 'Uterus — Posterior',
    'Brain Glioblastoma':       'Brain — Frontal Lobe',
  };
  document.getElementById('locationLabel').textContent = labels[type] || '—';

  const size = parseFloat(document.getElementById('tumorSize')?.value) || 0;
  const risk = size > 40 ? 'High' : size > 20 ? 'Medium' : 'Low';
  const riskEl = document.getElementById('riskLabel');
  riskEl.textContent = risk;
  riskEl.className = 'bstat-val risk-' + risk.toLowerCase();
}

// ─── Navigate to Machine ──────────────────────────────────
function launchSession() {
  const name  = document.getElementById('patientName')?.value.trim();
  const id    = document.getElementById('patientId')?.value.trim();
  const doc   = document.getElementById('doctorName')?.value.trim();
  const type  = document.getElementById('tumorType')?.value;
  const size  = document.getElementById('tumorSize')?.value;
  const depth = document.getElementById('tumorDepth')?.value;
  const freq  = document.getElementById('freq')?.value;
  const inten = document.getElementById('intensity')?.value;
  const duty  = document.getElementById('dutyCycle')?.value;
  const dur   = document.getElementById('sessionDuration')?.value;
  const x     = document.getElementById('coordX')?.value;
  const y     = document.getElementById('coordY')?.value;
  const z     = document.getElementById('coordZ')?.value;

  if (!name) { highlightField('patientName'); return; }
  if (!type) { highlightField('tumorType'); return; }

  const params = { name, id, doc, type, size, depth, freq, inten, duty, dur, x, y, z };
  localStorage.setItem('hifuSession', JSON.stringify(params));

  // Launch animation
  const btn = document.getElementById('launchBtn');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Loading Session…`;
  btn.disabled = true;
  btn.style.opacity = '0.7';

  setTimeout(() => {
    window.location.href = 'machine.html';
  }, 800);
}

function highlightField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  el.style.borderColor = 'var(--danger)';
  el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 2000);
}

// ─── Coordinate live update ────────────────────────────────
['coordX','coordY','coordZ','tumorSize'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    createTumorMarker();
  });
});
document.getElementById('tumorType')?.addEventListener('change', updateLocation);
document.getElementById('tumorDepth')?.addEventListener('input', () => {
  document.getElementById('depthLabel').textContent = document.getElementById('tumorDepth').value + ' mm';
});

// ─── Init ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  initBodyScene();
  initVitalsCanvas();
  updateLocation();
});

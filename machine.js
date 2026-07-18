/* ═══════════════════════════════════════════════════════════
   MACHINE CONSOLE — Three.js 3D Tumor + Wave Monitor
   ═══════════════════════════════════════════════════════════ */

// ─── Session Data ──────────────────────────────────────────
let session = {
  name: 'Michael Robertson', id: 'PT-2024-0011', doc: 'Dr. Ahmed Hassan',
  type: 'Hepatocellular Carcinoma', size: 24, depth: 45,
  freq: 1.1, inten: 1500, duty: 80, dur: 45,
  x: -2.3, y: 1.5, z: 4.5
};
try {
  const saved = JSON.parse(localStorage.getItem('hifuSession') || '{}');
  if (saved.name) {
    session.name  = saved.name;
    session.id    = saved.id || session.id;
    session.doc   = saved.doc || session.doc;
    session.type  = saved.type || session.type;
    session.size  = parseFloat(saved.size) || session.size;
    session.depth = parseFloat(saved.depth) || session.depth;
    session.freq  = parseFloat(saved.freq) || session.freq;
    session.inten = parseFloat(saved.inten) || session.inten;
    session.duty  = parseFloat(saved.duty) || session.duty;
    session.dur   = parseFloat(saved.dur) || session.dur;
    session.x     = parseFloat(saved.x) || session.x;
    session.y     = parseFloat(saved.y) || session.y;
    session.z     = parseFloat(saved.z) || session.z;
  }
} catch(e) {}

// ─── Fill Header ──────────────────────────────────────────
document.getElementById('mhPatient').textContent = session.name;
document.getElementById('mhId').textContent      = session.id;
document.getElementById('mhDoc').textContent     = session.doc;

// ─── Fill Sliders from session ────────────────────────────
document.getElementById('slFreq').value     = session.freq;
document.getElementById('slIntensity').value= session.inten;
document.getElementById('slDuty').value     = session.duty;
document.getElementById('slDepth').value    = session.depth;

// ─── Session State ─────────────────────────────────────────
let sessionStart  = Date.now();
let sessionPaused = false;
let sessionActive = true;
let elapsedMs     = 0;
let lastTick      = Date.now();
let currentSize   = session.size;
let energyDel     = 0;
let treatmentCov  = 0;
let tissueTemp    = 37.0;
let logCount      = 0;

// Params (live)
let P = {
  freq:    session.freq,
  inten:   session.inten,
  duty:    session.duty,
  pulse:   20,
  depth:   session.depth,
  angle:   0,
};

// ─── Param Sliders ────────────────────────────────────────
function updateParams() {
  P.freq  = parseFloat(document.getElementById('slFreq').value);
  P.inten = parseFloat(document.getElementById('slIntensity').value);
  P.duty  = parseFloat(document.getElementById('slDuty').value);
  P.pulse = parseFloat(document.getElementById('slPulse').value);
  P.depth = parseFloat(document.getElementById('slDepth').value);
  P.angle = parseFloat(document.getElementById('slAngle').value);

  document.getElementById('valFreq').textContent    = P.freq.toFixed(1) + ' MHz';
  document.getElementById('valIntensity').textContent= P.inten + ' W/cm²';
  document.getElementById('valDuty').textContent    = P.duty + '%';
  document.getElementById('valPulse').textContent   = P.pulse + ' ms';
  document.getElementById('valDepth').textContent   = P.depth + ' mm';
  document.getElementById('valAngle').textContent   = P.angle + '°';

  // HUD sync
  document.getElementById('hudFreq').textContent  = P.freq.toFixed(1) + ' MHz';
  document.getElementById('hudDepth').textContent = P.depth + 'mm';
  document.getElementById('wfFreq').textContent   = P.freq.toFixed(2) + ' MHz';
  document.getElementById('wfPeriod').textContent = Math.round(1000/P.freq) + ' ns';
  document.getElementById('wfPower').textContent  = P.inten + ' W';
  document.getElementById('sf3dZ').textContent    = (P.depth/10).toFixed(1);

  addLog('info', `Params updated — Freq:${P.freq}MHz Int:${P.inten}W/cm² Duty:${P.duty}%`);
}

// ─── Session Timer ────────────────────────────────────────
function updateTimer() {
  if (!sessionActive || sessionPaused) return;
  const now = Date.now();
  elapsedMs += now - lastTick;
  lastTick = now;

  const secs = Math.floor(elapsedMs / 1000);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  document.getElementById('sessionTimer').textContent = `${h}:${m}:${s}`;

  // Progress
  const durSec = session.dur * 60;
  const pct = Math.min((elapsedMs / 1000) / durSec * 100, 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = Math.floor(pct) + '%';

  // Energy
  const power = P.inten * (P.duty / 100);
  energyDel += power * 0.001;
  document.getElementById('energyDel').textContent = (energyDel / 1000).toFixed(2) + ' kJ';

  // Tissue Temp (rises during treatment)
  tissueTemp = 37 + (pct / 100) * 30 * (P.inten / 1500);
  tissueTemp += (Math.random() - 0.5) * 0.2;
  document.getElementById('tissueTemp').textContent = tissueTemp.toFixed(1) + '°C';
  document.getElementById('hudTemp').textContent    = tissueTemp.toFixed(1) + '°C';

  // Tumor shrinkage simulation
  const shrinkRate = (P.inten / 15000) * (P.duty / 100) * 0.0002;
  currentSize = Math.max(session.size * 0.3, currentSize - shrinkRate);
  const reduction = ((session.size - currentSize) / session.size * 100);
  document.getElementById('trsCurrent').textContent = currentSize.toFixed(1) + ' mm';
  document.getElementById('trsReduc').textContent   = reduction.toFixed(1) + '%';

  // Ablation zone
  const ablVol = Math.floor(reduction * 0.8 * session.size);
  document.getElementById('ablationZone').textContent = ablVol + ' mm³';

  // Tumor size in HUD
  document.getElementById('hudSize').textContent = currentSize.toFixed(0) + 'mm';

  // AI bars drift
  const acc  = Math.min(99, 90 + reduction * 0.3 + (Math.random() - 0.5) * 2);
  const safe = Math.max(85, 98 - reduction * 0.05 + (Math.random() - 0.5));
  const cov  = Math.min(99, 40 + pct * 0.6);
  document.getElementById('aiAccBar').style.width  = acc + '%';
  document.getElementById('aiSafeBar').style.width = safe + '%';
  document.getElementById('aiCovBar').style.width  = cov + '%';
  document.getElementById('aiAcc').textContent  = Math.floor(acc) + '%';
  document.getElementById('aiSafe').textContent = Math.floor(safe) + '%';
  document.getElementById('aiCov').textContent  = Math.floor(cov) + '%';

  // Alerts
  if (tissueTemp > 58) {
    document.getElementById('ledWarn').classList.add('active');
    if (logCount % 60 === 0) addLog('warn', 'High tissue temperature detected: ' + tissueTemp.toFixed(1) + '°C');
  } else {
    document.getElementById('ledWarn').classList.remove('active');
  }

  logCount++;
  if (logCount % 90 === 0) addLog('info', `Treatment at ${Math.floor(pct)}% — Coverage: ${Math.floor(cov)}%`);
  if (logCount % 150 === 0) addLog('success', `Tumor reduction: ${reduction.toFixed(1)}% — AI targeting stable`);

  // Auto-end
  if (pct >= 100) { endSession(); return; }
}
setInterval(updateTimer, 100);
lastTick = Date.now();

// ─── Toggle Pause ─────────────────────────────────────────
function togglePause() {
  sessionPaused = !sessionPaused;
  lastTick = Date.now();
  const btn = document.getElementById('btnPause');
  if (sessionPaused) {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume Treatment`;
    btn.className = 'ctrl-action-btn danger';
    addLog('warn', 'Session PAUSED by operator');
  } else {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause Treatment`;
    btn.className = 'ctrl-action-btn primary';
    addLog('info', 'Session RESUMED');
  }
}

// ─── Emergency Stop ───────────────────────────────────────
function emergencyStop() {
  sessionPaused = true;
  sessionActive = false;
  document.getElementById('ledAlert').classList.add('active');
  addLog('warn', '⚠ EMERGENCY STOP ACTIVATED');
  // Flash red overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(239,68,68,0.15);z-index:999;pointer-events:none;';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 800);
}

// ─── End Session ──────────────────────────────────────────
function endSession() {
  sessionActive = false;
  addLog('success', 'Session completed. Report generated.');
  const pct    = Math.min(((elapsedMs / 1000) / (session.dur * 60)) * 100, 100);
  const reduc  = ((session.size - currentSize) / session.size * 100);
  const modal  = document.getElementById('resultModal');
  const body   = document.getElementById('rmBody');
  const elapsed = document.getElementById('sessionTimer').textContent;

  body.innerHTML = `
    <div class="rm-stat"><span>Patient</span><strong>${session.name}</strong></div>
    <div class="rm-stat"><span>Session Duration</span><strong>${elapsed}</strong></div>
    <div class="rm-stat"><span>Energy Delivered</span><strong>${(energyDel/1000).toFixed(2)} kJ</strong></div>
    <div class="rm-stat"><span>Avg. Frequency</span><strong>${P.freq.toFixed(1)} MHz</strong></div>
    <div class="rm-stat"><span>Avg. Intensity</span><strong>${P.inten} W/cm²</strong></div>
    <div class="rm-stat"><span>Initial Tumor Ø</span><strong>${session.size} mm</strong></div>
    <div class="rm-stat"><span>Final Tumor Ø</span><strong>${currentSize.toFixed(1)} mm</strong></div>
    <div class="rm-stat"><span>Tumor Reduction</span><strong style="color:var(--m-green)">${reduc.toFixed(1)}%</strong></div>
    <div class="rm-stat"><span>Coverage Achieved</span><strong>${Math.floor(Math.min(pct*0.9,99))}%</strong></div>
    <div class="rm-stat"><span>Treatment Status</span><strong style="color:var(--m-green)">✓ COMPLETE</strong></div>
  `;
  modal.style.display = 'flex';
}

function saveReport() {
  addLog('success', 'Session report saved to patient record.');
  document.getElementById('resultModal').style.display = 'none';
  setTimeout(() => window.location.href = 'index.html', 1000);
}

function captureSnapshot() {
  addLog('info', 'Snapshot captured and saved.');
}

// ─── Session Log ──────────────────────────────────────────
document.getElementById('logStartTime').textContent = new Date().toLocaleTimeString('en-US', { hour12: false });

function addLog(type, msg) {
  const log = document.getElementById('sessionLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;
  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = document.getElementById('sessionTimer').textContent;
  const m = document.createElement('span');
  m.className = 'log-msg';
  m.textContent = msg;
  entry.appendChild(time);
  entry.appendChild(m);
  log.insertBefore(entry, log.firstChild);
  // Max 30 entries
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

// ─── Thermal Grid ─────────────────────────────────────────
function initThermalGrid() {
  const grid = document.getElementById('thermalGrid');
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'therm-cell';
    cell.dataset.idx = i;
    grid.appendChild(cell);
  }
}

function updateThermalGrid() {
  const cells = document.querySelectorAll('.therm-cell');
  const cx = 3.5, cy = 3.5; // center of 8x8
  cells.forEach((cell, idx) => {
    const row = Math.floor(idx / 8), col = idx % 8;
    const dist = Math.sqrt((row - cy) ** 2 + (col - cx) ** 2);
    const maxDist = 5.5;
    const heat = Math.max(0, 1 - dist / maxDist);
    const noise = Math.random() * 0.05;
    const t = Math.min(1, heat * (1 + (tissueTemp - 37) / 40) + noise);
    const r = Math.round(59 + t * 196);
    const g = Math.round(130 - t * 130 + (1 - t) * 59);
    const b = Math.round(246 - t * 246);
    cell.style.background = `rgb(${r},${g},${b})`;
  });
}
setInterval(updateThermalGrid, 300);

// ─── Real-time Vitals Simulation ──────────────────────────
let hrBase = 72, bpBase = 120, o2Base = 98, tempBase = 36.6;
function updateVitals() {
  hrBase   += (Math.random() - 0.5) * 2;
  hrBase    = Math.max(60, Math.min(95, hrBase));
  bpBase   += (Math.random() - 0.5) * 3;
  bpBase    = Math.max(100, Math.min(140, bpBase));
  o2Base   += (Math.random() - 0.5) * 0.5;
  o2Base    = Math.max(94, Math.min(100, o2Base));
  tempBase += (Math.random() - 0.5) * 0.05;
  tempBase  = Math.max(36, Math.min(37.5, tempBase));

  document.getElementById('rtHRVal').textContent   = Math.round(hrBase);
  document.getElementById('rtBPVal').textContent   = Math.round(bpBase) + '/' + Math.round(bpBase * 0.67);
  document.getElementById('rtO2Val').textContent   = Math.round(o2Base);
  document.getElementById('rtTempVal').textContent = tempBase.toFixed(1);
}
setInterval(updateVitals, 1200);

// ─── Tumor Response Chart ────────────────────────────────
let tumorHistory = [session.size];
function initTumorRespChart() {
  const canvas = document.getElementById('tumorRespCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function draw() {
    canvas.width  = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(56,189,248,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    if (tumorHistory.length < 2) return;
    const maxVal = session.size;
    const minVal = session.size * 0.3;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(239,68,68,0.3)');
    grad.addColorStop(1, 'rgba(239,68,68,0.02)');

    ctx.beginPath();
    tumorHistory.forEach((v, i) => {
      const x = (i / (tumorHistory.length - 1)) * W;
      const y = H - ((v - minVal) / (maxVal - minVal)) * (H * 0.8) - H * 0.1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    tumorHistory.forEach((v, i) => {
      const x = (i / (tumorHistory.length - 1)) * W;
      const y = H - ((v - minVal) / (maxVal - minVal)) * (H * 0.8) - H * 0.1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  setInterval(() => {
    tumorHistory.push(currentSize);
    if (tumorHistory.length > 120) tumorHistory.shift();
    draw();
  }, 500);
  draw();
}
document.getElementById('trsInit').textContent = session.size.toFixed(1) + ' mm';

// ─── HR Mini Canvas ───────────────────────────────────────
function initHRMini() {
  const canvas = document.getElementById('hrMiniCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let offset = 0;

  function draw() {
    canvas.width  = 50 * window.devicePixelRatio;
    canvas.height = 30 * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = 50, H = 30;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth   = 1.5;
    for (let x = 0; x < W; x++) {
      const beat = Math.floor((x + offset) % 30);
      let y = H / 2;
      if (beat < 3) y = H / 2;
      else if (beat < 5) y = H / 2 - 10;
      else if (beat < 7) y = H / 2 + 4;
      else if (beat < 10) y = H / 2 - 22;
      else if (beat < 13) y = H / 2 + 8;
      else y = H / 2 + (Math.random() - 0.5) * 1.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    offset += 1;
  }
  setInterval(draw, 50);
}

// ═══════════════════════════════════════════════════════════
//  THREE.JS — 3D TUMOR SCENE
// ═══════════════════════════════════════════════════════════
let tumorRenderer, tumorScene, tumorCamera;
let tumorSphere, tumorGlowMesh, ablationZone;
let grid3dVisible = true;
let frameCount = 0, lastFPSTime = Date.now(), fps = 60;
let scanPlane, beamCone;
let particleSystem, particlePositions;
let waveRings = [];

function initTumorScene() {
  const canvas = document.getElementById('tumorCanvas');
  const vp = document.getElementById('screen3d').querySelector('.screen-viewport');
  const W = vp.clientWidth, H = vp.clientHeight;

  tumorRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  tumorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  tumorRenderer.setSize(W, H);
  tumorRenderer.setClearColor(0x000d1a, 1);

  tumorScene = new THREE.Scene();
  tumorScene.fog = new THREE.FogExp2(0x000d1a, 0.15);

  tumorCamera = new THREE.PerspectiveCamera(50, W / H, 0.01, 50);
  tumorCamera.position.set(3, 2, 4);
  tumorCamera.lookAt(0, 0, 0);

  // ── Lights ──
  tumorScene.add(new THREE.AmbientLight(0x0a1530, 0.6));
  const pt1 = new THREE.PointLight(0x2255ff, 2, 10);
  pt1.position.set(2, 2, 2); tumorScene.add(pt1);
  const pt2 = new THREE.PointLight(0xff2244, 1.5, 8);
  pt2.position.set(-2, -1, -2); tumorScene.add(pt2);
  const pt3 = new THREE.PointLight(0x00ffaa, 0.8, 8);
  pt3.position.set(0, 3, 0); tumorScene.add(pt3);

  // ── Grid ──
  const gridHelper = new THREE.GridHelper(6, 12, 0x1a3050, 0x0d1e30);
  gridHelper.position.y = -1.5;
  tumorScene.add(gridHelper);

  // ── Axis lines ──
  const axisGeo = new THREE.BufferGeometry();
  const axisVerts = new Float32Array([
    -2,0,0, 2,0,0,
    0,-2,0, 0,2,0,
    0,0,-2, 0,0,2,
  ]);
  axisGeo.setAttribute('position', new THREE.BufferAttribute(axisVerts, 3));
  const axisMat = new THREE.LineBasicMaterial({ color: 0x1a3050, linewidth: 1 });
  // ── Tumor Core ──
  const tSize = Math.max(0.1, session.size * 0.025);
  const tumorGeo = new THREE.SphereGeometry(tSize, 32, 32);
  const tumorMat = new THREE.MeshPhongMaterial({
    color: 0xcc2200,
    emissive: 0xff1100,
    emissiveIntensity: 0.5,
    specular: 0xff6644,
    shininess: 60,
    transparent: true,
    opacity: 0.92,
  });
  tumorSphere = new THREE.Mesh(tumorGeo, tumorMat);
  tumorSphere.position.set(
    session.x * 0.1,
    session.y * 0.1,
    session.z * 0.05
  );
  tumorScene.add(tumorSphere);

  // ── Tumor Glow ──
  const glowGeo = new THREE.SphereGeometry(tSize * 2.0, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff3300, transparent: true, opacity: 0.06, side: THREE.BackSide,
  });
  tumorGlowMesh = new THREE.Mesh(glowGeo, glowMat);
  tumorGlowMesh.position.copy(tumorSphere.position);
  tumorScene.add(tumorGlowMesh);

  // ── Ablation Zone ──
  const abGeo = new THREE.SphereGeometry(tSize * 0.3, 24, 24);
  const abMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00, transparent: true, opacity: 0.3, wireframe: false,
  });
  ablationZone = new THREE.Mesh(abGeo, abMat);
  ablationZone.position.copy(tumorSphere.position);
  tumorScene.add(ablationZone);

  // ── HIFU Beam Cone ──
  const coneGeo = new THREE.ConeGeometry(0.08, 2.5, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x2563eb, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
  });
  beamCone = new THREE.Mesh(coneGeo, coneMat);
  beamCone.position.set(0, 1.8, 0);
  beamCone.rotation.z = 0;
  tumorScene.add(beamCone);

  // ── Scanning Plane ──
  const planeGeo = new THREE.PlaneGeometry(3, 3);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.04, side: THREE.DoubleSide,
  });
  scanPlane = new THREE.Mesh(planeGeo, planeMat);
  scanPlane.position.copy(tumorSphere.position);
  scanPlane.rotation.x = Math.PI / 2;
  tumorScene.add(scanPlane);

  // ── Wave Rings (emanating from tumor) ──
  for (let i = 0; i < 5; i++) {
    const rGeo = new THREE.RingGeometry(0.01, 0.05, 32);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.position.copy(tumorSphere.position);
    ring.userData.phase = (i / 5) * Math.PI * 2;
    ring.userData.speed = 0.8;
    tumorScene.add(ring);
    waveRings.push(ring);
  }

  // ── Particle System ──
  const pCount = 200;
  const pGeo = new THREE.BufferGeometry();
  particlePositions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    particlePositions[i * 3]     = (Math.random() - 0.5) * 4;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x38bdf8, size: 0.04, transparent: true, opacity: 0.4,
  });
  particleSystem = new THREE.Points(pGeo, pMat);
  tumorScene.add(particleSystem);

  // ── Surrounding tissue shell ──
  const tissueGeo = new THREE.SphereGeometry(tSize * 3.5, 24, 24);
  const tissueMat = new THREE.MeshPhongMaterial({
    color: 0x1a4060, transparent: true, opacity: 0.08, wireframe: false,
    side: THREE.BackSide,
  });
  const tissue = new THREE.Mesh(tissueGeo, tissueMat);
  tissue.position.copy(tumorSphere.position);
  tumorScene.add(tissue);

  // ── Wireframe overlay ──
  const wfGeo = new THREE.SphereGeometry(tSize * 3.52, 12, 12);
  const wfMat = new THREE.MeshBasicMaterial({
    color: 0x1a4060, transparent: true, opacity: 0.15, wireframe: true,
  });
  tumorScene.add(new THREE.Mesh(wfGeo, wfMat));

  animateTumorScene();
  window.addEventListener('resize', onTumorResize);
}

let tumorCamAngle = 0;
function animateTumorScene() {
  requestAnimationFrame(animateTumorScene);

  if (sessionActive && !sessionPaused) {
    tumorCamAngle += 0.004;
  }
  tumorCamera.position.x = 4 * Math.sin(tumorCamAngle);
  tumorCamera.position.z = 4 * Math.cos(tumorCamAngle);
  tumorCamera.position.y = 2 + Math.sin(tumorCamAngle * 0.3) * 0.5;
  tumorCamera.lookAt(tumorSphere.position);

  const t = Date.now() * 0.001;

  // Tumor pulse
  if (sessionActive && !sessionPaused) {
    const scaleFactor = currentSize / session.size;
    tumorSphere.scale.setScalar(scaleFactor * (1 + 0.05 * Math.sin(t * 3)));
    tumorGlowMesh.scale.setScalar(scaleFactor * (1 + 0.12 * Math.sin(t * 2)));

    // Ablation zone grows
    const abScale = (1 - scaleFactor) * 5 + 0.2;
    ablationZone.scale.setScalar(Math.max(0.1, abScale));
    ablationZone.material.opacity = 0.15 + 0.15 * Math.sin(t * 4);

    // Beam cone pulse
    beamCone.material.opacity = 0.04 + 0.08 * Math.abs(Math.sin(t * P.freq));
    beamCone.scale.x = 1 + 0.2 * Math.sin(t * 2);
    beamCone.scale.z = 1 + 0.2 * Math.sin(t * 2);
  }

  // Scanning plane oscillate
  scanPlane.position.y = tumorSphere.position.y + Math.sin(t * 0.8) * 0.3;
  scanPlane.material.opacity = 0.02 + 0.03 * Math.abs(Math.sin(t * 0.8));

  // Wave rings
  waveRings.forEach((ring, i) => {
    const phase = ring.userData.phase;
    const speed = ring.userData.speed;
    const r = ((t * speed + phase / (Math.PI * 2)) % 1) * 1.2;
    ring.scale.setScalar(r + 0.01);
    ring.material.opacity = Math.max(0, 0.5 - r * 0.4);
    ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.5 + i) * 0.2;
  });

  // Particles drift
  if (particleSystem && sessionActive && !sessionPaused) {
    for (let i = 0; i < particlePositions.length / 3; i++) {
      particlePositions[i * 3 + 1] += 0.005;
      if (particlePositions[i * 3 + 1] > 2) particlePositions[i * 3 + 1] = -2;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.rotation.y += 0.002;
  }

  // Tumor color based on temperature
  const tempRatio = Math.min(1, (tissueTemp - 37) / 40);
  tumorSphere.material.emissiveIntensity = 0.3 + tempRatio * 0.8;
  tumorSphere.material.color.setRGB(0.8 + tempRatio * 0.2, 0.1 * (1 - tempRatio), 0);

  // FPS counter
  frameCount++;
  const now = Date.now();
  if (now - lastFPSTime > 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFPSTime = now;
    document.getElementById('fpsCtr').textContent = fps + ' FPS';
  }

  tumorRenderer.render(tumorScene, tumorCamera);
}

function onTumorResize() {
  const vp = document.getElementById('screen3d').querySelector('.screen-viewport');
  if (!vp) return;
  const W = vp.clientWidth, H = vp.clientHeight;
  tumorCamera.aspect = W / H;
  tumorCamera.updateProjectionMatrix();
  tumorRenderer.setSize(W, H);
}

function toggleGrid3d() {
  grid3dVisible = !grid3dVisible;
  tumorScene.traverse(obj => {
    if (obj instanceof THREE.GridHelper) obj.visible = grid3dVisible;
  });
}

function resetCamera() {
  tumorCamAngle = 0;
}

// ═══════════════════════════════════════════════════════════
//  WAVE MONITOR CANVAS
// ═══════════════════════════════════════════════════════════
let waveCtx, waveCanvas, waveOffset = 0, waveMode = 'live';

function initWaveCanvas() {
  waveCanvas = document.getElementById('waveCanvas');
  const vp   = document.getElementById('screenWave').querySelector('.screen-viewport');
  waveCtx    = waveCanvas.getContext('2d');

  function resize() {
    waveCanvas.width  = vp.clientWidth  * Math.min(window.devicePixelRatio, 2);
    waveCanvas.height = vp.clientHeight * Math.min(window.devicePixelRatio, 2);
    waveCtx.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
  }
  resize();
  window.addEventListener('resize', resize);
  animateWave();
}

function animateWave() {
  requestAnimationFrame(animateWave);
  if (!waveCanvas || !waveCtx) return;

  const W  = waveCanvas.width  / Math.min(window.devicePixelRatio, 2);
  const H  = waveCanvas.height / Math.min(window.devicePixelRatio, 2);
  const t  = Date.now() * 0.001;

  waveCtx.clearRect(0, 0, W, H);

  // ── Background grid ──
  waveCtx.strokeStyle = 'rgba(56,189,248,0.06)';
  waveCtx.lineWidth   = 1;
  const gCols = Math.floor(W / 30), gRows = Math.floor(H / 20);
  for (let i = 0; i <= gCols; i++) {
    const x = (i / gCols) * W;
    waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, H); waveCtx.stroke();
  }
  for (let i = 0; i <= gRows; i++) {
    const y = (i / gRows) * H;
    waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(W, y); waveCtx.stroke();
  }

  // ── Center line ──
  waveCtx.strokeStyle = 'rgba(56,189,248,0.15)';
  waveCtx.lineWidth = 1;
  [H * 0.3, H * 0.6].forEach(y => {
    waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(W, y); waveCtx.stroke();
  });

  // ── Amplitude based on params ──
  const amp1 = H * 0.12 * (P.inten / 1500) * (P.duty / 100);
  const amp2 = amp1 * 0.7;
  const amp3 = amp1 * 0.4;
  const spd  = P.freq * 0.8;

  if (sessionPaused) { waveOffset; } else { waveOffset += spd; }

  // ── HIFU Wave (blue) ──
  drawWave(waveCtx, W, H * 0.3, W, amp1, '#3b82f6',
    x => Math.sin((x / W * 8 * Math.PI) + waveOffset * 0.12) +
         0.2 * Math.sin((x / W * 16 * Math.PI) + waveOffset * 0.24) +
         0.05 * (Math.random() - 0.5),
    true
  );

  // ── SDT Wave (purple) ──
  drawWave(waveCtx, W, H * 0.6, W, amp2, '#a855f7',
    x => Math.sin((x / W * 12 * Math.PI) + waveOffset * 0.08 + 0.8) +
         0.3 * Math.sin((x / W * 6 * Math.PI) + waveOffset * 0.04) +
         0.03 * (Math.random() - 0.5),
    false
  );

  // ── Reference Wave (green) ──
  drawWave(waveCtx, W, H * 0.3, W, amp3 * 0.6, '#22c55e',
    x => Math.sin((x / W * 8 * Math.PI)),
    false
  );

  // ── Envelope ──
  const envGrad = waveCtx.createLinearGradient(0, 0, W, 0);
  envGrad.addColorStop(0, 'rgba(37,99,235,0)');
  envGrad.addColorStop(0.5, 'rgba(37,99,235,0.05)');
  envGrad.addColorStop(1, 'rgba(37,99,235,0)');

  // ── Live amplitude indicator ──
  const curAmp = amp1 * (1 + 0.1 * Math.sin(t * 3));
  document.getElementById('wfAmp').textContent = (curAmp / (H * 0.06)).toFixed(1) + ' MPa';
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawWave(ctx, W, centerY, width, amp, color, fn, filled) {
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const y = centerY + fn(x) * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  if (filled) {
    ctx.save();
    // Glow effect for primary wave
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Fill under curve
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = centerY + fn(x) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, centerY - amp, 0, centerY + amp);
    grad.addColorStop(0, hexToRgba(color, 0.18));
    grad.addColorStop(1, hexToRgba(color, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function toggleWaveMode() {
  waveMode = waveMode === 'live' ? 'freeze' : 'live';
  if (waveMode === 'freeze') { sessionPaused = true; }
  else { sessionPaused = false; lastTick = Date.now(); }
  document.getElementById('waveModeBtn').textContent = waveMode === 'live' ? 'LIVE' : 'FREEZE';
}

// ─── HUD coords from session ──────────────────────────────
document.getElementById('sf3dX').textContent  = session.x;
document.getElementById('sf3dY').textContent  = session.y;
document.getElementById('sf3dZ').textContent  = (session.depth/10).toFixed(1);
const vol = (4/3 * Math.PI * Math.pow(session.size/20, 3)).toFixed(2);
document.getElementById('sf3dVol').textContent = vol;

// ─── Init All ─────────────────────────────────────────────
window.addEventListener('load', () => {
  initThermalGrid();
  initTumorScene();
  initWaveCanvas();
  initTumorRespChart();
  initHRMini();
  updateParams();
});

window.addEventListener('resize', () => {
  onTumorResize();
});

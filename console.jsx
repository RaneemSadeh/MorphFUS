import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  User, Crosshair, Play, Pause, Square, ChevronRight, CheckCircle2,
  AlertTriangle, RotateCcw, Printer, Activity, Radio, ArrowLeft
} from "lucide-react";

/* ---------------------------------------------------------------------
   DESIGN TOKENS

   Two palettes, one metaphor: a physical instrument. The chassis — every
   panel, form, and report page — is the light clinical shell (T), built
   from the four blues in the supplied palette. The two live readouts
   inside the console (volumetric tracking + energy waveform) are treated
   as actual instrument glass (S): dark, so a live trace still reads as
   "live" the way it would on any real ultrasound or oscilloscope screen,
   set inside a light, professional housing rather than a dashboard that
   is dark everywhere.
--------------------------------------------------------------------- */
const T = {
  bg: "#F3F9FB",
  panel: "#FFFFFF",
  panelAlt: "#EAF3F7",
  line: "#D7E6EC",
  lineStrong: "#B9D3DE",
  blue: "#226597",
  blueDim: "rgba(34,101,151,0.08)",
  teal: "#87C0CD",
  tealDim: "rgba(135,192,205,0.20)",
  navy: "#113F67",
  amber: "#B8763A",
  amberDim: "rgba(184,118,58,0.10)",
  red: "#B23A48",
  redDim: "rgba(178,58,72,0.09)",
  text: "#132B3D",
  textMuted: "#5C7A8C",
  textDim: "#93AEBB",
};

// Instrument-glass palette — used only inside the two live console
// screens and the chassis that houses them.
const S = {
  bg: "#0A2138",
  panel: "#0E2C46",
  line: "#1D4A66",
  cyan: "#8FDCEA",
  cyanDim: "rgba(143,220,234,0.16)",
  amber: "#F2A93B",
  amberDim: "rgba(242,169,59,0.18)",
  red: "#FF7A7A",
  text: "#EAF6FA",
  textMuted: "#7FA5B8",
  textDim: "#446277",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
`;

/* ---------------------------------------------------------------------
   GLOBAL STYLE
--------------------------------------------------------------------- */
function GlobalStyle() {
  return (
    <style>{`
      ${FONT_IMPORT}
      .oc-root {
        font-family: 'Inter', sans-serif;
        background: ${T.bg};
        color: ${T.text};
        min-height: 100vh;
        background-image:
          radial-gradient(ellipse 1000px 600px at 12% -10%, ${T.tealDim}, transparent 60%),
          radial-gradient(ellipse 800px 520px at 100% 0%, ${T.blueDim}, transparent 60%);
      }
      .oc-mono { font-family: 'IBM Plex Mono', monospace; }
      .oc-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
      .oc-root * { box-sizing: border-box; }
      .oc-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .oc-scrollbar::-webkit-scrollbar-thumb { background: ${T.lineStrong}; border-radius: 3px; }
      .oc-fade-in { animation: ocFadeIn 0.4s ease both; }
      @keyframes ocFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .oc-pulse { animation: ocPulse 2s ease-in-out infinite; }
      @keyframes ocPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
      .oc-spin-slow { animation: ocSpin 14s linear infinite; }
      @keyframes ocSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .oc-input {
        background: ${T.panel};
        border: 1px solid ${T.line};
        color: ${T.text};
        font-family: 'Inter', sans-serif;
        font-size: 13.5px;
        padding: 10px 12px;
        border-radius: 3px;
        width: 100%;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .oc-input:focus { border-color: ${T.blue}; box-shadow: 0 0 0 3px ${T.blueDim}; }
      .oc-input::placeholder { color: ${T.textDim}; }
      .oc-label {
        font-size: 10.5px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: ${T.textMuted};
        margin-bottom: 6px;
        display: block;
        font-weight: 600;
      }
      .oc-btn {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        border-radius: 3px;
        padding: 12px 22px;
        border: 1px solid transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.15s;
      }
      .oc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .oc-btn-primary { background: ${T.navy}; color: #FFFFFF; }
      .oc-btn-primary:hover:not(:disabled) { background: ${T.blue}; }
      .oc-btn-ghost { background: transparent; border-color: ${T.line}; color: ${T.text}; }
      .oc-btn-ghost:hover:not(:disabled) { border-color: ${T.blue}; color: ${T.blue}; background: ${T.blueDim}; }
      .oc-btn-danger { background: transparent; border-color: ${T.red}; color: ${T.red}; }
      .oc-btn-danger:hover:not(:disabled) { background: ${T.redDim}; }
    `}</style>
  );
}

/* ---------------------------------------------------------------------
   SHARED: top identity bar
--------------------------------------------------------------------- */
function SystemBar({ status, statusColor }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px", borderBottom: `1px solid ${T.line}`, background: T.panel,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: T.blue,
          boxShadow: `0 0 8px rgba(34,101,151,0.45)`,
        }} />
        <span className="oc-display" style={{ fontWeight: 600, fontSize: 15, letterSpacing: "0.01em", color: T.navy }}>ARC-7</span>
        <span style={{ color: T.textDim, fontSize: 12 }}>Adaptive Resonance Console</span>
      </div>
      {status && (
        <div className="oc-mono" style={{
          fontSize: 11, letterSpacing: "0.08em", color: statusColor || T.textMuted,
          border: `1px solid ${statusColor || T.line}`, padding: "5px 12px", borderRadius: 3,
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   PAGE 1 — PATIENT INTAKE
--------------------------------------------------------------------- */
const BODY_REGIONS = [
  { id: "liver", label: "Liver", cx: 0.42, cy: 0.365 },
  { id: "breast_l", label: "Breast (L)", cx: 0.565, cy: 0.30 },
  { id: "breast_r", label: "Breast (R)", cx: 0.435, cy: 0.30 },
  { id: "prostate", label: "Prostate", cx: 0.5, cy: 0.47 },
  { id: "kidney_l", label: "Kidney (L)", cx: 0.585, cy: 0.375 },
];

function BodyDiagram({ marker, onPlace }) {
  const svgRef = useRef(null);

  const handleClick = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPlace({ x: Math.max(0.04, Math.min(0.96, x)), y: Math.max(0.03, Math.min(0.97, y)) });
  };

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 200 400"
        onClick={handleClick}
        style={{ width: "100%", maxWidth: 260, cursor: "crosshair", display: "block", margin: "0 auto" }}
      >
        <defs>
          <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.panelAlt} />
            <stop offset="100%" stopColor="#DCEBF1" />
          </linearGradient>
        </defs>
        {/* head */}
        <circle cx="100" cy="28" r="22" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />
        {/* torso */}
        <path
          d="M 66 52 Q 100 44 134 52 L 142 168 Q 100 182 58 168 Z"
          fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2"
        />
        {/* pelvis */}
        <path d="M 58 168 Q 100 182 142 168 L 132 210 Q 100 222 68 210 Z" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />
        {/* arms */}
        <path d="M 66 55 Q 40 90 36 160 L 48 164 Q 54 100 74 60 Z" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />
        <path d="M 134 55 Q 160 90 164 160 L 152 164 Q 146 100 126 60 Z" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />
        {/* legs */}
        <path d="M 68 210 L 62 380 L 82 380 L 96 224 Z" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />
        <path d="M 132 210 L 138 380 L 118 380 L 104 224 Z" fill="url(#bodyFill)" stroke={T.lineStrong} strokeWidth="1.2" />

        {/* anatomical reference points */}
        {BODY_REGIONS.map((r) => (
          <circle key={r.id} cx={r.cx * 200} cy={r.cy * 400} r="2.2" fill={T.textDim} opacity="0.7" />
        ))}

        {marker && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={marker.x * 200} cy={marker.y * 400} r="10" fill="none" stroke={T.blue} strokeWidth="1" opacity="0.5">
              <animate attributeName="r" values="7;13;7" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0.05;0.6" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={marker.x * 200} cy={marker.y * 400} r="3.5" fill={T.blue} />
            <line x1={marker.x * 200 - 9} y1={marker.y * 400} x2={marker.x * 200 + 9} y2={marker.y * 400} stroke={T.blue} strokeWidth="0.75" />
            <line x1={marker.x * 200} y1={marker.y * 400 - 9} x2={marker.x * 200} y2={marker.y * 400 + 9} stroke={T.blue} strokeWidth="0.75" />
          </g>
        )}
      </svg>
      <p style={{ textAlign: "center", fontSize: 11, color: T.textDim, marginTop: 10 }}>
        Click the diagram to mark the target site
      </p>
    </div>
  );
}

function IntakeForm({ onBegin }) {
  const [form, setForm] = useState({
    name: "", age: "", sex: "F", patientId: "PT-" + Math.floor(1000 + Math.random() * 9000),
    tumorType: "Breast carcinoma", sizeMm: "18", depthMm: "22", notes: "",
  });
  const [marker, setMarker] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready = form.name && form.age && marker && form.sizeMm;

  const nearestRegion = marker
    ? BODY_REGIONS.reduce((best, r) => {
        const d = Math.hypot(r.cx - marker.x, r.cy - marker.y);
        return d < best.d ? { r, d } : best;
      }, { r: null, d: Infinity }).r
    : null;

  return (
    <div className="oc-fade-in" style={{ maxWidth: 980, margin: "0 auto", padding: "40px 28px 80px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", color: T.blue, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
          New session · Step 1 of 2
        </div>
        <h1 className="oc-display" style={{ fontSize: 30, fontWeight: 600, margin: 0, color: T.navy }}>Patient &amp; Target Intake</h1>
        <p style={{ color: T.textMuted, fontSize: 13.5, marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
          Enter patient details and mark the tumor location. This defines the treatment reference
          the adaptive controller will track against for the entire session.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
        {/* left: patient + tumor data */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: 22, boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <User size={14} color={T.blue} />
              <span style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted, fontWeight: 600 }}>
                Patient identity
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="oc-label">Full name</label>
                <input className="oc-input" placeholder="e.g. Layla Haddad" value={form.name} onChange={set("name")} />
              </div>
              <div>
                <label className="oc-label">Age</label>
                <input className="oc-input" type="number" placeholder="54" value={form.age} onChange={set("age")} />
              </div>
              <div>
                <label className="oc-label">Sex</label>
                <select className="oc-input" value={form.sex} onChange={set("sex")}>
                  <option>F</option><option>M</option>
                </select>
              </div>
            </div>
            <div>
              <label className="oc-label">Patient ID</label>
              <input className="oc-input oc-mono" value={form.patientId} onChange={set("patientId")} />
            </div>
          </div>

          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: 22, boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Crosshair size={14} color={T.amber} />
              <span style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted, fontWeight: 600 }}>
                Tumor parameters
              </span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="oc-label">Tumor type / classification</label>
              <input className="oc-input" value={form.tumorType} onChange={set("tumorType")} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="oc-label">Current size — radius (mm)</label>
                <input className="oc-input oc-mono" type="number" value={form.sizeMm} onChange={set("sizeMm")} />
              </div>
              <div>
                <label className="oc-label">Depth from skin (mm)</label>
                <input className="oc-input oc-mono" type="number" value={form.depthMm} onChange={set("depthMm")} />
              </div>
            </div>
            <div>
              <label className="oc-label">Clinical notes</label>
              <textarea className="oc-input" rows={3} placeholder="Optional" value={form.notes} onChange={set("notes")} style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>

        {/* right: body diagram */}
        <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: 22, display: "flex", flexDirection: "column", boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Radio size={14} color={T.blue} />
            <span style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted, fontWeight: 600 }}>
              Target coordinates
            </span>
          </div>
          <BodyDiagram marker={marker} onPlace={setMarker} />
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
            {marker ? (
              <div className="oc-mono" style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.9 }}>
                <div>X&nbsp;&nbsp;{(marker.x * 100).toFixed(1)}%&nbsp;&nbsp;&nbsp;Y&nbsp;&nbsp;{(marker.y * 100).toFixed(1)}%</div>
                <div>NEAREST&nbsp;&nbsp;<span style={{ color: T.blue }}>{nearestRegion ? nearestRegion.label.toUpperCase() : "—"}</span></div>
                <div>DEPTH&nbsp;&nbsp;{form.depthMm || "—"} mm</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textDim }}>No target placed yet</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
        <button
          className="oc-btn oc-btn-primary"
          disabled={!ready}
          onClick={() => onBegin({ ...form, marker, region: nearestRegion?.label || "Unspecified" })}
        >
          Proceed to console <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   SIMULATION ENGINE (mirrors the Python closed-loop prototype)
--------------------------------------------------------------------- */
function makeSimState(initialRadius) {
  return {
    radius: initialRadius,
    reference: initialRadius,
    t: 0,
    power: 0,
    focal: initialRadius,
    confidence: 0.9,
    done: false,
  };
}

const LIMITS = { maxPower: 40, minPower: 2, stopRadius: 1.5, focalMargin: -0.5, minConfidence: 0.35, maxFocal: 25 };

function stepSim(s, dt) {
  if (s.done) return s;
  const confidence = Math.max(0.15, Math.min(0.99, 0.88 + (Math.random() - 0.5) * 0.3));
  let power, focal, reason;

  if (s.radius <= LIMITS.stopRadius) {
    return { ...s, power: 0, done: true, confidence, reason: "Target below stop threshold — session complete" };
  }

  if (confidence < LIMITS.minConfidence) {
    power = LIMITS.minPower;
    focal = Math.max(1, s.radius + LIMITS.focalMargin);
    reason = `Low tracking confidence (${confidence.toFixed(2)}) — power reduced to minimum`;
  } else {
    const volFrac = Math.pow(s.radius / s.reference, 3);
    let target = LIMITS.minPower + (LIMITS.maxPower - LIMITS.minPower) * volFrac;
    const taperZone = LIMITS.stopRadius * 4;
    if (s.radius < taperZone) target *= Math.max(0.25, s.radius / taperZone);
    power = Math.min(LIMITS.maxPower, Math.max(LIMITS.minPower, target));
    focal = Math.min(LIMITS.maxFocal, Math.max(1, s.radius + LIMITS.focalMargin));
    reason = "Nominal closed-loop adjustment";
  }

  const coupling = focal <= s.radius ? 1 : Math.max(0.15, 1 - (focal - s.radius) / s.radius);
  const ablationRate = 0.11 * power * coupling; // tuned for a ~45s demo session
  const radius = Math.max(0, s.radius - ablationRate * dt);

  return { ...s, radius, power, focal, confidence, t: s.t + dt, reason, done: radius <= LIMITS.stopRadius };
}

/* ---------------------------------------------------------------------
   SCREEN A — volumetric tracking (pseudo-3D)
   Instrument glass: uses S (dark) tokens deliberately, regardless of
   the light shell around it — this is meant to read as an active
   display, not another panel.
--------------------------------------------------------------------- */
function TrackingScreen({ radius, reference, confidence, elapsed, region }) {
  const scale = 0.35 + 0.65 * (radius / reference);
  const rings = [0, 1, 2, 3, 4];

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      {/* scan grid */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke={S.line} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* rotating volumetric render */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div className="oc-spin-slow" style={{ width: 190 * scale, height: 190 * scale, position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `radial-gradient(circle at 38% 32%, rgba(143,220,234,0.55), rgba(143,220,234,0.08) 60%, transparent 75%)`,
            boxShadow: `0 0 ${40 * scale}px ${S.cyanDim}`,
          }} />
          <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0 }}>
            {rings.map((i) => (
              <ellipse
                key={i}
                cx="100" cy="100" rx="95" ry={95 - i * 18}
                fill="none" stroke={S.cyan} strokeWidth="0.7"
                opacity={0.5 - i * 0.07}
              />
            ))}
            <circle cx="100" cy="100" r="95" fill="none" stroke={S.cyan} strokeWidth="1" opacity="0.7" />
          </svg>
        </div>
      </div>

      {/* sweep line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, ${S.cyan}, transparent)`,
        animation: "ocSweep 2.6s linear infinite", opacity: 0.55,
      }} />
      <style>{`@keyframes ocSweep { 0% { top: 4%; } 100% { top: 96%; } }`}</style>

      {/* readouts */}
      <div style={{ position: "absolute", top: 14, left: 16, right: 16, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.09em", color: S.textMuted, textTransform: "uppercase" }}>
          Volumetric tracking
        </span>
        <span className="oc-mono oc-pulse" style={{ fontSize: 10.5, color: S.cyan }}>● LIVE</span>
      </div>

      <div className="oc-mono" style={{
        position: "absolute", bottom: 14, left: 16, right: 16, display: "flex", justifyContent: "space-between",
        fontSize: 12, color: S.text,
      }}>
        <div>
          <div style={{ color: S.textDim, fontSize: 9.5 }}>RADIUS</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{radius.toFixed(2)}<span style={{ fontSize: 10, color: S.textMuted }}> mm</span></div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: S.textDim, fontSize: 9.5 }}>SITE</div>
          <div style={{ fontSize: 12.5, color: S.textMuted }}>{region}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: S.textDim, fontSize: 9.5 }}>CONFIDENCE</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: confidence < LIMITS.minConfidence ? S.red : S.cyan }}>
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   SCREEN B — energy waveform (live oscilloscope + trend)
   Instrument glass: also uses S tokens, matching Screen A.
--------------------------------------------------------------------- */
function WaveformScreen({ power, focal, history }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 60);
    return () => clearInterval(id);
  }, []);

  const points = 80;
  const amp = 3 + (power / LIMITS.maxPower) * 26;
  const path = Array.from({ length: points }, (_, i) => {
    const x = (i / (points - 1)) * 300;
    const y = 50 + Math.sin(i * 0.45 + phase * 0.35) * amp * Math.sin(i * 0.06 + phase * 0.05);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 0", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.09em", color: S.textMuted, textTransform: "uppercase" }}>
          Energy waveform
        </span>
        <span className="oc-mono" style={{ fontSize: 10.5, color: S.amber }}>{power.toFixed(1)} W</span>
      </div>

      <div style={{ height: 100, padding: "6px 10px" }}>
        <svg viewBox="0 0 300 100" width="100%" height="100%" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="300" y2="50" stroke={S.line} strokeWidth="0.6" />
          <path d={path} fill="none" stroke={S.amber} strokeWidth="1.6" opacity="0.9" />
        </svg>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "0 8px 8px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={S.amber} stopOpacity={0.35} />
                <stop offset="100%" stopColor={S.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={S.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: S.textDim, fontSize: 9 }} axisLine={{ stroke: S.line }} tickLine={false} />
            <YAxis tick={{ fill: S.textDim, fontSize: 9 }} axisLine={false} tickLine={false} width={26} />
            <Tooltip
              contentStyle={{ background: S.panel, border: `1px solid ${S.line}`, borderRadius: 4, fontSize: 11, color: S.text }}
              labelStyle={{ color: S.textMuted }}
            />
            <Area type="monotone" dataKey="power" stroke={S.amber} fill="url(#powerFill)" strokeWidth={1.6} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="oc-mono" style={{ display: "flex", justifyContent: "space-between", padding: "0 16px 14px", fontSize: 12 }}>
        <div><span style={{ color: S.textDim, fontSize: 9.5 }}>FOCAL SPOT </span><span style={{ color: S.text }}>{focal.toFixed(2)} mm</span></div>
        <div><span style={{ color: S.textDim, fontSize: 9.5 }}>MODE </span><span style={{ color: S.text }}>HIFU / SDT</span></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   PAGE 2 — CONSOLE
--------------------------------------------------------------------- */
function Console({ patient, onComplete, onAbort }) {
  const initialRadius = parseFloat(patient.sizeMm) || 18;
  const [running, setRunning] = useState(true);
  const [sim, setSim] = useState(() => makeSimState(initialRadius));
  const [history, setHistory] = useState([{ t: 0, power: 0, radius: initialRadius }]);
  const [log, setLog] = useState([{ t: 0, msg: "Session initialized — target acquired", tone: "blue" }]);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSim((prev) => {
        const next = stepSim(prev, 0.9);
        setHistory((h) => [...h.slice(-59), { t: Number(next.t.toFixed(1)), power: Number(next.power.toFixed(1)), radius: Number(next.radius.toFixed(2)) }]);
        if (next.reason && next.reason !== prev.reason) {
          setLog((l) => [{ t: Number(next.t.toFixed(1)), msg: next.reason, tone: next.reason.includes("Low") ? "amber" : next.reason.includes("complete") ? "blue" : "muted" }, ...l].slice(0, 8));
        }
        if (next.done && !finishedRef.current) {
          finishedRef.current = true;
          setRunning(false);
        }
        return next;
      });
    }, 220);
    return () => clearInterval(id);
  }, [running]);

  const pctDone = Math.min(100, 100 * (1 - sim.radius / initialRadius));
  const elapsedReal = ((Date.now() - startRef.current) / 1000).toFixed(0);

  return (
    <div className="oc-fade-in" style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", color: T.blue, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
            Session · {patient.patientId}
          </div>
          <h1 className="oc-display" style={{ fontSize: 26, fontWeight: 600, margin: 0, color: T.navy }}>{patient.name} <span style={{ color: T.textMuted, fontWeight: 400, fontFamily: "'Inter', sans-serif", fontSize: 20 }}>· {patient.age}{patient.sex}</span></h1>
          <p style={{ color: T.textMuted, fontSize: 12.5, marginTop: 4 }}>{patient.tumorType} · {patient.region}</p>
        </div>
        <div className="oc-mono" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Elapsed</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{elapsedReal}s</div>
        </div>
      </div>

      {/* progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
          <span>Ablation progress</span>
          <span className="oc-mono">{pctDone.toFixed(0)}%</span>
        </div>
        <div style={{ height: 4, background: T.line, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pctDone}%`, background: T.blue, transition: "width 0.2s linear" }} />
        </div>
      </div>

      {/* dual screens in a machine bezel — the one deliberately dark
          element in the page, styled as instrument housing */}
      <div style={{
        background: "#0B2033", border: `1px solid ${T.lineStrong}`, borderRadius: 8, padding: 14,
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.35), 0 4px 16px rgba(17,63,103,0.10)",
      }}>
        <div className="oc-mono" style={{ fontSize: 9.5, letterSpacing: "0.14em", color: S.textDim, textTransform: "uppercase", padding: "2px 4px 12px" }}>
          Arc-7 · Dual-channel imaging / energy module
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: S.bg, border: `1px solid ${S.line}`, borderRadius: 5, height: 340 }}>
            <TrackingScreen radius={sim.radius} reference={initialRadius} confidence={sim.confidence} elapsed={sim.t} region={patient.region} />
          </div>
          <div style={{ background: S.bg, border: `1px solid ${S.line}`, borderRadius: 5, height: 340 }}>
            <WaveformScreen power={sim.power} focal={sim.focal} history={history} />
          </div>
        </div>

        {/* control strip */}
        <div style={{
          marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.panel, border: `1px solid ${T.line}`, borderRadius: 5, padding: "12px 18px",
        }}>
          <div style={{ display: "flex", gap: 28 }} className="oc-mono">
            <ReadoutMini label="POWER" value={`${sim.power.toFixed(1)} W`} color={T.amber} />
            <ReadoutMini label="FOCAL" value={`${sim.focal.toFixed(1)} mm`} color={T.blue} />
            <ReadoutMini label="TARGET R" value={`${sim.radius.toFixed(2)} mm`} color={T.text} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!sim.done && (
              <button className="oc-btn oc-btn-ghost" onClick={() => setRunning((r) => !r)}>
                {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
              </button>
            )}
            {!sim.done && (
              <button className="oc-btn oc-btn-danger" onClick={() => onAbort({ patient, history, sim, elapsedReal })}>
                <Square size={14} /> Abort
              </button>
            )}
            {sim.done && (
              <button className="oc-btn oc-btn-primary" onClick={() => onComplete({ patient, history, sim, elapsedReal })}>
                View session report <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* controller log */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: T.textMuted, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
          Controller log
        </div>
        <div className="oc-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
          {log.map((l, i) => (
            <div key={i} className="oc-mono" style={{
              fontSize: 11.5, color: l.tone === "amber" ? T.amber : l.tone === "blue" ? T.blue : T.textMuted,
              display: "flex", gap: 10,
            }}>
              <span style={{ color: T.textDim, minWidth: 42 }}>{l.t.toFixed(1)}s</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadoutMini({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: T.textDim, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   PAGE 3 — RESULTS
--------------------------------------------------------------------- */
function Results({ session, onNewSession, aborted }) {
  const { patient, history, sim, elapsedReal } = session;
  const initial = history[0]?.radius ?? 0;
  const final = sim.radius;
  const reduction = initial > 0 ? (100 * (1 - final / initial)) : 0;
  const avgPower = history.length ? (history.reduce((a, h) => a + h.power, 0) / history.length) : 0;
  const peakPower = history.reduce((a, h) => Math.max(a, h.power), 0);
  const energy = history.reduce((a, h) => a + h.power, 0) * 0.9; // approx joules given dt≈0.9s

  return (
    <div className="oc-fade-in" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {aborted ? <AlertTriangle size={18} color={T.red} /> : <CheckCircle2 size={18} color={T.blue} />}
        <span style={{ fontSize: 11, letterSpacing: "0.1em", color: aborted ? T.red : T.blue, textTransform: "uppercase", fontWeight: 600 }}>
          {aborted ? "Session aborted" : "Session complete"}
        </span>
      </div>
      <h1 className="oc-display" style={{ fontSize: 30, fontWeight: 600, margin: "0 0 6px", color: T.navy }}>Treatment Report</h1>
      <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 32 }}>
        {patient.name} · {patient.patientId} · {patient.tumorType} · {patient.region}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Initial radius" value={`${initial.toFixed(1)}`} unit="mm" />
        <StatCard label="Final radius" value={`${final.toFixed(2)}`} unit="mm" accent={T.blue} />
        <StatCard label="Volume reduction" value={`${reduction.toFixed(0)}`} unit="%" accent={T.blue} />
        <StatCard label="Session duration" value={elapsedReal} unit="s" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
        <StatCard label="Average power" value={avgPower.toFixed(1)} unit="W" accent={T.amber} />
        <StatCard label="Peak power" value={peakPower.toFixed(1)} unit="W" accent={T.amber} />
        <StatCard label="Energy delivered" value={energy.toFixed(0)} unit="J (approx.)" />
      </div>

      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: 20, marginBottom: 16, boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: T.textMuted, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
          Tumor radius over session
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: T.textDim, fontSize: 10 }} axisLine={{ stroke: T.line }} tickLine={false} label={{ value: "seconds", position: "insideBottomRight", offset: -4, fill: T.textDim, fontSize: 10 }} />
              <YAxis tick={{ fill: T.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <ReferenceLine y={LIMITS.stopRadius} stroke={T.textDim} strokeDasharray="3 3" />
              <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.line}`, borderRadius: 4, fontSize: 11, color: T.text }} labelStyle={{ color: T.textMuted }} />
              <Line type="monotone" dataKey="radius" stroke={T.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: 20, marginBottom: 32, boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: T.textMuted, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
          Applied power over session
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="powerFillResult" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.amber} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: T.textDim, fontSize: 10 }} axisLine={{ stroke: T.line }} tickLine={false} />
              <YAxis tick={{ fill: T.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.line}`, borderRadius: 4, fontSize: 11, color: T.text }} labelStyle={{ color: T.textMuted }} />
              <Area type="monotone" dataKey="power" stroke={T.amber} fill="url(#powerFillResult)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="oc-btn oc-btn-primary" onClick={onNewSession}><RotateCcw size={14} /> New session</button>
        <button className="oc-btn oc-btn-ghost" onClick={() => window.print()}><Printer size={14} /> Print report</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, accent }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 5, padding: "16px 16px", boxShadow: "0 1px 2px rgba(17,63,103,0.04)" }}>
      <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div className="oc-mono" style={{ fontSize: 22, fontWeight: 600, color: accent || T.navy }}>
        {value}<span style={{ fontSize: 12, color: T.textMuted, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   APP
--------------------------------------------------------------------- */
export default function App() {
  const [page, setPage] = useState("intake");
  const [patient, setPatient] = useState(null);
  const [session, setSession] = useState(null);
  const [aborted, setAborted] = useState(false);

  const begin = (p) => { setPatient(p); setPage("console"); };
  const complete = (s) => { setSession(s); setAborted(false); setPage("results"); };
  const abort = (s) => { setSession(s); setAborted(true); setPage("results"); };
  const reset = () => { setPatient(null); setSession(null); setPage("intake"); };

  const statusMap = {
    intake: null,
    console: ["ACTIVE", T.blue],
    results: aborted ? ["ABORTED", T.red] : ["COMPLETE", T.blue],
  };

  return (
    <div className="oc-root">
      <GlobalStyle />
      <SystemBar status={statusMap[page]?.[0]} statusColor={statusMap[page]?.[1]} />
      {page !== "intake" && (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 28px 0" }}>
          <button
            className="oc-btn oc-btn-ghost"
            style={{ padding: "6px 12px", fontSize: 11.5 }}
            onClick={reset}
          >
            <ArrowLeft size={12} /> New patient
          </button>
        </div>
      )}
      {page === "intake" && <IntakeForm onBegin={begin} />}
      {page === "console" && <Console patient={patient} onComplete={complete} onAbort={abort} />}
      {page === "results" && <Results session={session} aborted={aborted} onNewSession={reset} />}
    </div>
  );
}

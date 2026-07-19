import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';
import ejectorWords from './ejector_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 995;

const C = {
  bg:        '#0a1020',
  bgMid:     '#0f1d33',
  accent:    '#FFD23F',
  key:       '#ff5b4d',
  rocket:    '#ff8c2e',
  rocketCore:'#fff2b0',
  sky:       '#3aa0ff',
  skyLite:   '#8fd0ff',
  steel:     '#cdd5e0',
  steelDk:   '#8b97a8',
  chute:     '#ff7a3d',
  spine:     '#9fd0ff',
  white:     '#FFFFFF',
  danger:    '#ff3b30',
  ink:       '#0a1020',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Scene starts (frames @30, from make_narration sentence ends)
const S = { hook: 0, problem: 173, bolts: 334, rocket: 495, drogue: 740, canopy: 830 };

function usePop(delay: number, damping = 110) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.55, stiffness: 185 } });
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>
      {children}
    </div>
  );
}

// ─── BG: navy gradient + drifting specks + top glow ───────────────────────────
const SPECKS = Array.from({ length: 36 }, (_, i) => ({
  x: ((i * underscoreHash(i)) % 1080),
  y: ((i * 53 + 90) % 1820) + 40,
  r: (i % 3) + 1,
  sp: 0.2 + (i % 5) * 0.08,
}));
function underscoreHash(i: number) { return (i * 97 + 31) % 211 + 60; }

function Bg() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 0%, ${C.bgMid} 0%, ${C.bg} 62%)` }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {SPECKS.map((s, i) => {
          const y = (s.y - f * s.sp) % 1860;
          const yy = y < 0 ? y + 1860 : y;
          return <circle key={i} cx={s.x} cy={yy} r={s.r} fill={C.skyLite} opacity={0.12 + (i % 4) * 0.04} />;
        })}
      </svg>
    </AbsoluteFill>
  );
}

// ─── CAPTIONS (loaded from words.json, 3-word karaoke) ─────────────────────────
const WRAW: { w: string; s: number }[] = (ejectorWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
type Page = { words: string[]; startF: number };
const PAGES: Page[] = [];
for (let i = 0; i < WRAW.length; i += 3) {
  const chunk = WRAW.slice(i, i + 3);
  PAGES.push({ words: chunk.map((x) => x.w), startF: chunk[0].s * FPS });
}
function Captions() {
  const frame = useCurrentFrame();
  let pi = -1;
  for (let i = PAGES.length - 1; i >= 0; i--) {
    if (frame >= PAGES[i].startF) { pi = i; break; }
  }
  if (pi < 0) return null;
  const page = PAGES[pi];
  return (
    <div style={{ position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span key={wi} style={{
            color: active ? C.accent : '#fff', fontSize: 62, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif",
            textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 15px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

// ─── Reusable props ───────────────────────────────────────────────────────────
function PilotSeat({ scale = 1, rocketBurn = 0 }: { scale?: number; rocketBurn?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* Seat back + base */}
      <rect x={-70} y={-150} width={140} height={210} rx={20} fill={C.steelDk} />
      <rect x={-58} y={-138} width={116} height={150} rx={14} fill={C.steel} />
      <rect x={-80} y={50} width={160} height={40} rx={12} fill={C.steelDk} />
      {/* Pilot torso */}
      <rect x={-44} y={-110} width={88} height={120} rx={26} fill={C.key} opacity={0.92} />
      {/* Helmet */}
      <circle cx={0} cy={-128} r={42} fill={C.steel} />
      <path d="M -36,-128 a 36 26 0 0 1 72 0 Z" fill={C.sky} opacity={0.85} />
      {/* Rocket plume under seat */}
      {rocketBurn > 0 && (
        <g>
          <path d={`M -42,90 Q 0,${110 + rocketBurn * 230} 42,90 Z`} fill={C.rocket} opacity={0.92} />
          <path d={`M -24,90 Q 0,${110 + rocketBurn * 150} 24,90 Z`} fill={C.rocketCore} />
          {[0, 1, 2, 3, 4].map((k) => (
            <circle key={k} cx={-30 + k * 15} cy={120 + rocketBurn * (60 + k * 18)} r={10 - k} fill={C.rocket} opacity={0.5} />
          ))}
        </g>
      )}
    </g>
  );
}

function Stopwatch({ t, lock = 0 }: { t: number; lock?: number }) {
  const a = interpolate(t, [0, 4], [0, 1], clamp);
  const circ = 2 * Math.PI * 70;
  return (
    <g transform="translate(880,300)">
      <circle cx={0} cy={0} r={70} fill={C.ink} stroke={C.steelDk} strokeWidth={8} />
      <circle cx={0} cy={0} r={70} fill="none" stroke={lock > 0 ? C.accent : C.sky} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - a)} transform="rotate(-90)" strokeLinecap="round" />
      <text x={0} y={14} textAnchor="middle" fill={lock > 0 ? C.accent : C.white} fontSize={42} fontWeight={900}
        fontFamily="Poppins,Arial Black,sans-serif">{t.toFixed(1)}</text>
      <text x={0} y={44} textAnchor="middle" fill={C.steel} fontSize={18} fontWeight={700} fontFamily="Poppins,sans-serif">SEC</text>
    </g>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <g transform="translate(150,250)">
      <rect x={-70} y={-46} width={140} height={92} rx={18} fill={C.accent} />
      <text x={0} y={6} textAnchor="middle" fill={C.ink} fontSize={50} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{n}</text>
      <text x={0} y={34} textAnchor="middle" fill={C.ink} fontSize={22} fontWeight={800} fontFamily="Poppins,sans-serif">/ 4</text>
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 110, mass: 0.6, stiffness: 180 } });
  const yank = frame > 26 ? interpolate(frame, [26, 32, 44], [0, 26, 22], clamp) : 0;
  const jolt = frame > 26 && frame < 42 ? Math.sin((frame - 26) * 1.5) * 5 : 0;
  const timer = interpolate(frame, [22, 120], [0, 4], clamp);
  const ghost = 0.5 + 0.3 * Math.sin(frame * 0.12);
  const title = spring({ frame: frame - 50, fps, config: { damping: 120, mass: 0.5, stiffness: 200 } });
  const spark = frame > 28 && frame < 46 ? 1 - (frame - 28) / 18 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* ghost parachute teaser */}
          <path d="M 380,360 a 160 110 0 0 1 320 0 Z" fill={C.chute} opacity={ghost * 0.25} />
          <line x1={420} y1={400} x2={520} y2={620} stroke={C.chute} strokeWidth={3} opacity={ghost * 0.25} />
          <line x1={660} y1={400} x2={560} y2={620} stroke={C.chute} strokeWidth={3} opacity={ghost * 0.25} />

          <g transform={`translate(540,1180) translate(${jolt},0)`} style={{ transformOrigin: '540px 1180px' }}>
            <g transform={`scale(${pop})`}>
              {/* canopy bubble */}
              <path d="M -250,40 a 250 260 0 0 1 500 0" fill="none" stroke={C.skyLite} strokeWidth={10} opacity={0.6} />
              <path d="M -250,40 a 250 260 0 0 1 500 0 L 250,40 Z" fill={C.sky} opacity={0.12} />
              <PilotSeat scale={1.25} />
              {/* EJECT handle (between knees) */}
              <g transform={`translate(0,${70 + yank})`}>
                <rect x={-34} y={-10} width={68} height={42} rx={8} fill={C.accent} />
                <rect x={-34} y={-10} width={68} height={42} rx={8} fill="url(#stripeY)" opacity={0.5} />
                <rect x={-10} y={28} width={20} height={36} fill={C.steelDk} />
              </g>
              {spark > 0 && <circle cx={0} cy={90 + yank} r={26 * spark + 6} fill={C.accent} opacity={spark} />}
            </g>
          </g>

          <defs>
            <pattern id="stripeY" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="8" height="16" fill={C.ink} />
            </pattern>
          </defs>

          <Stopwatch t={timer} />
          {/* EJECT title */}
          <g transform={`translate(540,760) scale(${title})`} opacity={title}>
            <text x={0} y={0} textAnchor="middle" fill={C.accent} fontSize={140} fontWeight={900}
              fontFamily="Poppins,Arial Black,sans-serif" stroke={C.ink} strokeWidth={6} paintOrder="stroke">EJECT</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: PROBLEM (600mph should snap spine) ──────────────────────────────
function SceneProblem() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SNAP = 300 - S.problem; // ~127 within scene
  const needle = spring({ frame: frame - 6, fps, config: { damping: 60, mass: 0.6, stiffness: 150 } });
  const forceDrop = frame > SNAP - 24 ? interpolate(frame, [SNAP - 24, SNAP], [0, 1], clamp) : 0;
  const crack = interpolate(frame, [SNAP, SNAP + 6, SNAP + 16], [0, 1, 0], clamp);
  const compress = frame > SNAP - 8 ? interpolate(frame, [SNAP - 8, SNAP, SNAP + 12], [0, 8, 3], clamp) : 0;
  const shake = frame >= SNAP && frame < SNAP + 8 ? [0, 5, -5, 4, -4, 2, -2, 1][frame - SNAP] ?? 0 : 0;
  const q = spring({ frame: frame - (SNAP + 18), fps, config: { damping: 90, mass: 0.6, stiffness: 160 } });
  const qPulse = 1 + 0.05 * Math.sin(frame * 0.16);
  const VERTS = 7;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0, transform: `translateX(${shake}px)` }}>
          {/* torso silhouette */}
          <path d="M 430,620 q 120,-60 230,0 l 30,520 q -145,70 -290,0 Z" fill={C.steelDk} opacity={0.5} />
          {/* spine */}
          {Array.from({ length: VERTS }).map((_, i) => {
            const sp = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 120, mass: 0.5, stiffness: 200 } });
            const y = 700 + i * 64 + compress * (i / VERTS);
            const cracked = i === 3;
            const red = cracked ? crack : (forceDrop > 0.3 ? forceDrop * 0.5 : 0);
            return (
              <g key={i} opacity={sp}>
                <rect x={530} y={y} width={56} height={42} rx={12}
                  fill={`rgb(${159 + red * 96},${208 - red * 160},${255 - red * 210})`} />
                <rect x={520} y={y + 14} width={76} height={14} rx={7} fill={C.spine} opacity={0.5} />
              </g>
            );
          })}
          {/* SNAP crack */}
          {crack > 0 && (
            <g opacity={crack}>
              <path d="M 500,892 L 540,880 L 525,905 L 575,892 L 600,900" fill="none" stroke={C.danger} strokeWidth={7} strokeLinecap="round" />
              <text x={420} y={900} textAnchor="middle" fill={C.danger} fontSize={56} fontWeight={900}
                fontFamily="Poppins,Arial Black,sans-serif">SNAP!</text>
            </g>
          )}
          {/* G-FORCE arrow */}
          <g opacity={forceDrop} transform={`translate(558,${560 + forceDrop * 60})`}>
            <line x1={0} y1={-60} x2={0} y2={70} stroke={C.danger} strokeWidth={14} strokeLinecap="round" markerEnd="url(#aRed)" />
            <text x={120} y={0} textAnchor="middle" fill={C.danger} fontSize={34} fontWeight={900} fontFamily="Poppins,sans-serif">G-FORCE</text>
          </g>
          {/* speed gauge */}
          <g transform="translate(230,560)">
            <path d="M -90,40 A 100 100 0 0 1 90,40" fill="none" stroke={C.steelDk} strokeWidth={14} />
            <line x1={0} y1={40} x2={Math.cos((180 - needle * 180) * Math.PI / 180) * 80} y2={40 - Math.sin((180 - needle * 180) * Math.PI / 180) * 80}
              stroke={C.key} strokeWidth={8} strokeLinecap="round" />
            <text x={0} y={92} textAnchor="middle" fill={C.white} fontSize={40} fontWeight={900} fontFamily="Poppins,sans-serif">{Math.round(needle * 600)}</text>
            <text x={0} y={120} textAnchor="middle" fill={C.steel} fontSize={22} fontWeight={700} fontFamily="Poppins,sans-serif">MPH</text>
          </g>
          {/* ? */}
          <text x={780} y={1000} textAnchor="middle" fill={C.accent} fontSize={200} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={q}
            transform={`translate(780,1000) scale(${q * qPulse}) translate(-780,-1000)`}>?</text>
          <defs>
            <marker id="aRed" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.danger} /></marker>
          </defs>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: BOLTS (canopy blown clear) ──────────────────────────────────────
function SceneBolts() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = usePop(2);
  const boltFlash = (k: number) => interpolate(frame, [16 + k * 5, 22 + k * 5, 34 + k * 5], [0, 1, 0], clamp);
  const launch = frame > 40 ? interpolate(frame, [40, 80], [0, 1], clamp) : 0;
  const arc = interpolate(frame, [40, 95], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540,1180)">
            <PilotSeat scale={1.2} />
            {/* canopy launching up */}
            <g transform={`translate(${launch * 240},${-260 - launch * 1600}) rotate(${launch * 40})`}>
              <path d="M -240,40 a 240 250 0 0 1 480 0 L 240,40 Z" fill={C.sky} opacity={0.18 + 0.1 * (1 - launch)} />
              <path d="M -240,40 a 240 250 0 0 1 480 0" fill="none" stroke={C.skyLite} strokeWidth={10} opacity={0.7} />
              {/* speed lines */}
              {launch > 0.05 && [0, 1, 2].map((k) => (
                <line key={k} x1={-120 + k * 120} y1={70} x2={-120 + k * 120} y2={70 + 120 * launch} stroke={C.skyLite} strokeWidth={5} opacity={0.5 * (1 - launch)} />
              ))}
            </g>
            {/* 4 bolts */}
            {[[-230, -180], [230, -180], [-210, 30], [210, 30]].map((p, k) => (
              <g key={k}>
                <circle cx={p[0]} cy={p[1]} r={12} fill={C.steel} />
                <circle cx={p[0]} cy={p[1]} r={20 + boltFlash(k) * 26} fill={C.rocket} opacity={boltFlash(k) * 0.8} />
              </g>
            ))}
          </g>
          {/* dashed arc */}
          <path d="M 600,920 Q 820,520 980,560" fill="none" stroke={C.skyLite} strokeWidth={5}
            strokeDasharray="16 14" strokeDashoffset={520 * (1 - arc)} opacity={0.7} />
          <StepBadge n={1} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: ROCKET (hero ignition + force-spread) ───────────────────────────
function SceneRocket() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = usePop(2);
  const burn = interpolate(frame, [10, 30], [0, 1], clamp);
  const climb = interpolate(frame, [24, 200], [0, -560], clamp);
  const shake = frame > 12 && frame < 60 ? Math.sin(frame * 2.1) * 4 : 0;
  const morph = interpolate(frame, [120, 175], [0, 1], clamp); // red->green spread
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0, transform: `translateX(${shake}px)` }}>
          {/* guide rails */}
          <rect x={398} y={300} width={16} height={1100} rx={8} fill={C.steelDk} opacity={0.7} />
          <rect x={666} y={300} width={16} height={1100} rx={8} fill={C.steelDk} opacity={0.7} />
          <g transform={`translate(540,${1140 + climb})`}>
            <PilotSeat scale={1.2} rocketBurn={burn} />
          </g>
          {/* force-spread inset */}
          <g transform="translate(820,1180)">
            <rect x={-150} y={-160} width={300} height={360} rx={20} fill={C.ink} opacity={0.82} stroke={C.steelDk} strokeWidth={4} />
            {/* curved seat-back */}
            <path d="M -70,-130 q -40,150 0,300" fill="none" stroke={C.steel} strokeWidth={10} />
            {/* one red concentrated arrow (fades out) */}
            <g opacity={1 - morph}>
              <line x1={70} y1={20} x2={-30} y2={20} stroke={C.danger} strokeWidth={12} markerEnd="url(#aR2)" />
            </g>
            {/* fan of green arrows (fades in) */}
            <g opacity={morph}>
              {[-120, -70, -20, 30, 80, 130].map((y, k) => (
                <line key={k} x1={80} y1={y} x2={-25} y2={y} stroke={C.skyLite} strokeWidth={6} markerEnd="url(#aG2)" />
              ))}
            </g>
            <text x={0} y={-130} textAnchor="middle" fill={morph > 0.5 ? C.skyLite : C.danger} fontSize={26} fontWeight={900}
              fontFamily="Poppins,sans-serif">{morph > 0.5 ? 'SPREAD' : 'FORCE'}</text>
          </g>
          <defs>
            <marker id="aR2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.danger} /></marker>
            <marker id="aG2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.skyLite} /></marker>
          </defs>
          <StepBadge n={2} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DROGUE (small chute yanks pilot free) ───────────────────────────
function SceneDrogue() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = usePop(6);
  const chute = spring({ frame: frame - 16, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const pull = interpolate(frame, [22, 60], [0, -120], clamp);
  const seatFall = frame > 26 ? interpolate(frame, [26, 80], [0, 700], clamp) : 0;
  const seatSpin = seatFall * 0.18;
  const cloud = (frame * 0.6) % 1200;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* clouds */}
          {[0, 1, 2].map((k) => {
            const cx = ((300 + k * 400 - cloud) % 1400) - 100;
            return <ellipse key={k} cx={cx} cy={500 + k * 380} rx={150} ry={50} fill={C.skyLite} opacity={0.1} />;
          })}
          {/* drogue chute */}
          <g transform={`translate(540,${560 + pull}) scale(${chute})`} opacity={chute}>
            <path d="M -110,40 a 110 80 0 0 1 220 0 Z" fill={C.chute} />
            <path d="M -110,40 a 110 80 0 0 1 220 0" fill="none" stroke={C.white} strokeWidth={4} opacity={0.6} />
            <line x1={-70} y1={70} x2={-20} y2={200} stroke={C.white} strokeWidth={3} />
            <line x1={70} y1={70} x2={20} y2={200} stroke={C.white} strokeWidth={3} />
          </g>
          {/* pilot pulled up */}
          <g transform={`translate(540,${860 + pull})`}>
            <g transform="scale(0.95)">
              {/* pilot only (helmet+torso) */}
              <rect x={-44} y={-90} width={88} height={120} rx={26} fill={C.key} />
              <circle cx={0} cy={-110} r={40} fill={C.steel} />
              <path d="M -34,-110 a 34 24 0 0 1 68 0 Z" fill={C.sky} opacity={0.85} />
            </g>
          </g>
          {/* empty seat falling away */}
          <g transform={`translate(540,${980 + seatFall}) rotate(${seatSpin * 57}) scale(${1 - seatFall / 1400})`} opacity={1 - seatFall / 800}>
            <rect x={-60} y={-120} width={120} height={180} rx={18} fill={C.steelDk} />
            <rect x={-70} y={50} width={140} height={34} rx={10} fill={C.steel} />
            <text x={0} y={130} textAnchor="middle" fill={C.steel} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">SEAT</text>
          </g>
          <StepBadge n={3} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: CANOPY (main chute payoff) ──────────────────────────────────────
function SceneCanopy() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = spring({ frame: frame - 8, fps, config: { damping: 80, mass: 0.7, stiffness: 140 } });
  const sway = Math.sin(frame * 0.06) * 14;
  const jet = interpolate(frame, [10, 90], [0, 1], clamp);
  const lock = spring({ frame: frame - 96, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } });
  const w1 = spring({ frame: frame - 104, fps, config: { damping: 85, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 122, fps, config: { damping: 85, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* tiny jet flying off */}
          <g transform={`translate(${interpolate(jet, [0, 1], [600, 1020])},${interpolate(jet, [0, 1], [560, 460])}) scale(${1 - jet * 0.6})`} opacity={1 - jet * 0.5}>
            <path d="M -40,0 L 30,-6 L 50,0 L 30,6 Z" fill={C.steel} />
            <path d="M -10,0 L -30,-20 L -5,-6 Z" fill={C.steelDk} />
          </g>
          <g transform={`translate(${540 + sway},760)`}>
            {/* main canopy */}
            <g transform={`scale(${bloom})`} style={{ transformOrigin: '540px 760px' }}>
              <path d="M -300,120 a 300 220 0 0 1 600 0 Z" fill={C.chute} />
              <path d="M -300,120 a 300 220 0 0 1 600 0" fill="none" stroke={C.white} strokeWidth={6} opacity={0.6} />
              {[-200, -70, 70, 200].map((x, k) => <line key={k} x1={x} y1={150} x2={x * 0.18} y2={380} stroke={C.white} strokeWidth={3} opacity={0.7} />)}
            </g>
            {/* pilot in harness */}
            <g transform="translate(0,420)">
              <rect x={-40} y={-30} width={80} height={110} rx={24} fill={C.key} />
              <circle cx={0} cy={-50} r={36} fill={C.steel} />
              <path d="M -30,-50 a 30 22 0 0 1 60 0 Z" fill={C.sky} opacity={0.85} />
            </g>
          </g>
          <Stopwatch t={4.0} lock={lock} />
          {/* payoff text */}
          <text x={540} y={1420} textAnchor="middle" fill={C.accent} fontSize={104} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={w1}
            transform={`translate(540,1420) scale(${w1}) translate(-540,-1420)`}>FOUR SECONDS.</text>
          <text x={540} y={1540} textAnchor="middle" fill={C.white} fontSize={84} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={w2}
            transform={`translate(540,1540) scale(${w2}) translate(-540,-1540)`}>SPINE INTACT.</text>
          <rect x={250} y={1564} width={580 * w2} height={8} rx={4} fill={C.accent} opacity={w2} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Ejector: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('ejector_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* aerospace sound design (baked, frame-accurate) */}
      <Sequence from={300}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.rocket + 6}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.canopy + 96}><Audio src={staticFile('sfx_chime.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.problem - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.problem} durationInFrames={S.bolts - S.problem}><SceneProblem /></Sequence>
      <Sequence from={S.bolts} durationInFrames={S.rocket - S.bolts}><SceneBolts /></Sequence>
      <Sequence from={S.rocket} durationInFrames={S.drogue - S.rocket}><SceneRocket /></Sequence>
      <Sequence from={S.drogue} durationInFrames={S.canopy - S.drogue}><SceneDrogue /></Sequence>
      <Sequence from={S.canopy} durationInFrames={DURATION_IN_FRAMES - S.canopy}><SceneCanopy /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

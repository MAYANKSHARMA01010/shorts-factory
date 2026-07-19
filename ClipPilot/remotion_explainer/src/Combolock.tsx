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
import clWords from './combolock_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1034;

const C = {
  bg:      '#0b0e14',
  panel:   '#12161f',
  gold:    '#FFD23F',
  steelK:  '#9fb3c8',
  steelD:  '#5a6b7d',
  steelL:  '#cdd9e5',
  red:     '#ff5d5d',
  green:   '#4fd6a8',
  cyan:    '#7fe3ff',
  ink:     '#06080d',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, open: 144, notches: 251, catch: 444, slot: 721, shackle: 940 };

function usePop(delay: number, damping = 110) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.55, stiffness: 185 } });
}
function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (clWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
type Page = { words: string[]; startF: number };
const PAGES: Page[] = [];
for (let i = 0; i < WRAW.length; i += 3) {
  const chunk = WRAW.slice(i, i + 3);
  PAGES.push({ words: chunk.map((x) => x.w), startF: chunk[0].s * FPS });
}
function Captions() {
  const frame = useCurrentFrame();
  let pi = -1;
  for (let i = PAGES.length - 1; i >= 0; i--) { if (frame >= PAGES[i].startF) { pi = i; break; } }
  if (pi < 0) return null;
  const page = PAGES[pi];
  return (
    <div style={{ position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span key={wi} style={{
            color: active ? C.gold : '#fff', fontSize: 62, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 15px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 32%, ${C.panel} 0%, ${C.bg} 72%)` }} />;

// ─── Padlock ──────────────────────────────────────────────────────────────────
function Padlock({ shackleLift = 0, dialSpin = 0, scale = 1 }: { shackleLift?: number; dialSpin?: number; scale?: number }) {
  return (
    <g transform={`translate(540,920) scale(${scale}) translate(-540,-920)`}>
      {/* shackle */}
      <g transform={`translate(0,${-shackleLift}) rotate(${shackleLift * 0.06} 410 760)`}>
        <path d="M 410,760 L 410,604 A 130 130 0 0 1 670,604 L 670,760" fill="none" stroke={C.steelL} strokeWidth={42} strokeLinecap="round" />
        <path d="M 410,760 L 410,604 A 130 130 0 0 1 670,604" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={0.3} />
      </g>
      {/* body */}
      <circle cx={540} cy={920} r={240} fill="url(#bodyGrad)" stroke={C.steelD} strokeWidth={6} />
      <circle cx={540} cy={920} r={182} fill={C.panel} stroke={C.steelD} strokeWidth={5} />
      {/* dial ticks */}
      <g transform={`rotate(${dialSpin} 540 920)`}>
        {Array.from({ length: 40 }).map((_, i) => {
          const a = (i * 9 - 90) * Math.PI / 180;
          const big = i % 5 === 0;
          const r0 = big ? 150 : 162;
          return <line key={i} x1={540 + Math.cos(a) * r0} y1={920 + Math.sin(a) * r0}
            x2={540 + Math.cos(a) * 174} y2={920 + Math.sin(a) * 174}
            stroke={big ? C.steelL : C.steelD} strokeWidth={big ? 4 : 2} />;
        })}
        <text x={540} y={810} textAnchor="middle" fill={C.steelL} fontSize={34} fontWeight={800} fontFamily="Poppins,sans-serif">0</text>
      </g>
      <circle cx={540} cy={920} r={22} fill={C.steelL} />
      {/* 12 o'clock reference */}
      <path d="M 540,724 l -12,-20 l 24,0 z" fill={C.gold} />
      <defs>
        <radialGradient id="bodyGrad" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor={C.steelL} />
          <stop offset="100%" stopColor={C.steelD} />
        </radialGradient>
      </defs>
    </g>
  );
}

// a single wheel seen top-down with a notch + radial pointer
function Wheel({ cx, cy, r, angle, label, showPointer = true }:
  { cx: number; cy: number; r: number; angle: number; label?: string; showPointer?: boolean }) {
  const a = (angle) * Math.PI / 180;
  const nx = cx + Math.cos(a) * r;
  const ny = cy + Math.sin(a) * r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.steelD} stroke={C.steelK} strokeWidth={5} />
      <circle cx={cx} cy={cy} r={r * 0.66} fill={C.panel} />
      <circle cx={cx} cy={cy} r={10} fill={C.gold} />
      {/* red V-notch */}
      <g transform={`rotate(${angle + 90} ${nx} ${ny})`}>
        <path d={`M ${nx - 16},${ny} L ${nx},${ny + 26} L ${nx + 16},${ny} Z`} fill={C.red} />
      </g>
      {showPointer && <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.gold} strokeWidth={3} opacity={0.8} />}
      {label && <text x={cx} y={cy + r + 50} textAnchor="middle" fill={C.steelK} fontSize={30} fontWeight={800} fontFamily="Poppins,sans-serif">{label}</text>}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 80, mass: 0.6, stiffness: 200 } });
  const dialSpin = interpolate(frame, [6, 30, 40], [0, 320, 300], clamp);
  const scan = interpolate(frame, [30, 70], [660, 1160], clamp);
  const pcbFade = interpolate(frame, [30, 45, 70], [0, 0.3, 0], clamp);
  const badge = spring({ frame: frame - 60, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const pills = [0, 1, 2].map((k) => spring({ frame: frame - 40 - k * 8, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`scale(${pop})`} style={{ transformOrigin: '540px 920px' }}>
            <Padlock dialSpin={dialSpin} />
            {/* ghost PCB being wiped */}
            <rect x={460} y={860} width={160} height={120} rx={8} fill={C.green} opacity={pcbFade} />
            {/* xray scan line */}
            {frame > 28 && frame < 74 && <line x1={300} y1={scan} x2={780} y2={scan} stroke={C.cyan} strokeWidth={5} opacity={0.8} />}
          </g>
          {/* combo pills */}
          {['24', '08', '15'].map((n, k) => (
            <g key={k} transform={`translate(${360 + k * 180},1300) scale(${pills[k]})`} opacity={pills[k]}>
              <rect x={-44} y={-30} width={88} height={60} rx={16} fill={C.gold} />
              <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{n}</text>
            </g>
          ))}
          {/* NO CHIP INSIDE? badge */}
          <g transform={`translate(800,560) scale(${badge})`} opacity={badge}>
            <rect x={-180} y={-46} width={360} height={92} rx={46} fill={C.gold} />
            <text x={0} y={11} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NO CHIP INSIDE?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: OPEN → stack of wheels ──────────────────────────────────────────
function SceneOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hinge = interpolate(frame, [6, 36], [0, 1], clamp);
  const drops = [0, 1, 2].map((k) => spring({ frame: frame - 30 - k * 9, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } }));
  const pin = interpolate(frame, [58, 84], [0, 1], clamp);
  const label = spring({ frame: frame - 80, fps, config: { damping: 90, mass: 0.5, stiffness: 190 } });
  const xDraw = interpolate(frame, [40, 62], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* crossed-out dead PCB */}
          <g transform="translate(840,560)" opacity={0.5}>
            <rect x={-70} y={-50} width={140} height={100} rx={8} fill={C.green} opacity={0.4} />
            <line x1={-70} y1={-50} x2={70} y2={50} stroke={C.gold} strokeWidth={7} strokeDasharray={200} strokeDashoffset={200 * (1 - xDraw)} />
            <line x1={70} y1={-50} x2={-70} y2={50} stroke={C.gold} strokeWidth={7} strokeDasharray={200} strokeDashoffset={200 * (1 - xDraw)} />
          </g>
          {/* spindle pin */}
          <rect x={533} y={660} width={14} height={620 * pin} rx={7} fill={C.gold} />
          {/* three stacked wheels (iso ellipses) */}
          {[0, 1, 2].map((k) => {
            const cy = 760 + k * 170;
            return (
              <g key={k} transform={`translate(540,${cy}) scale(${drops[k]})`} opacity={drops[k]}>
                <ellipse cx={0} cy={0} rx={210} ry={66} fill={C.steelD} />
                <ellipse cx={0} cy={-14} rx={210} ry={66} fill={C.steelL} />
                <ellipse cx={0} cy={-14} rx={210} ry={66} fill="none" stroke={C.steelK} strokeWidth={4} />
                {/* hinted notch */}
                <rect x={-10} y={-78} width={20} height={20} rx={3} fill={C.red} opacity={0.7} />
              </g>
            );
          })}
          {/* just metal label */}
          <g transform="translate(820,1180)" opacity={label}>
            <rect x={-110} y={-32} width={220} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">just metal</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: NOTCHES point different ways ────────────────────────────────────
function SceneNotches() {
  const frame = useCurrentFrame();
  const draws = [0, 1, 2].map((k) => interpolate(frame, [8 + k * 8, 30 + k * 8], [0, 1], clamp));
  const cut = [0, 1, 2].map((k) => interpolate(frame, [34 + k * 8, 40 + k * 8, 50 + k * 8], [0, 1, 0], clamp));
  const angles = [30, 210, 130];
  const wobble = (k: number) => Math.sin(frame * 0.18 + k) * 4;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {[0, 1, 2].map((k) => {
            const cx = 300 + k * 240;
            const cy = 920;
            const r = 120;
            return (
              <g key={k} opacity={draws[k]}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.steelK} strokeWidth={6}
                  pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draws[k])} />
                <circle cx={cx} cy={cy} r={r} fill={C.steelD} opacity={draws[k] > 0.95 ? 1 : 0} />
                <circle cx={cx} cy={cy} r={r * 0.62} fill={C.panel} opacity={draws[k] > 0.95 ? 1 : 0} />
                <circle cx={cx} cy={cy} r={9} fill={C.gold} opacity={draws[k] > 0.95 ? 1 : 0} />
                {draws[k] > 0.9 && (
                  <Wheel cx={cx} cy={cy} r={r} angle={angles[k] + wobble(k)} label={`Wheel ${k + 1}`} />
                )}
                {/* chisel spark */}
                {cut[k] > 0 && <circle cx={cx + Math.cos(angles[k] * Math.PI / 180) * r} cy={cy + Math.sin(angles[k] * Math.PI / 180) * r} r={18 * cut[k] + 4} fill={C.red} opacity={cut[k]} />}
              </g>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CATCH — rotate notches up one at a time ─────────────────────────
function SceneCatch() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startAngles = [30, 210, 130];
  const snapAt = [40, 110, 180];
  const angle = (k: number) => {
    const sp = spring({ frame: frame - snapAt[k], fps, config: { damping: 60, mass: 0.5, stiffness: 150 } });
    return startAngles[k] + (-90 - startAngles[k]) * sp;
  };
  const done = (k: number) => (frame > snapAt[k] + 18 ? 1 : 0);
  const count = done(0) + done(1) + done(2);
  const catchSpark = (k: number) => interpolate(frame, [snapAt[k], snapAt[k] + 8, snapAt[k] + 20], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* dial ring overlay + top marker */}
          <circle cx={540} cy={920} r={360} fill="none" stroke={C.steelD} strokeWidth={3} opacity={0.4} strokeDasharray="8 10" />
          <path d="M 540,548 l -12,-22 l 24,0 z" fill={C.gold} />
          {[0, 1, 2].map((k) => {
            const cx = 300 + k * 240;
            return (
              <g key={k}>
                <Wheel cx={cx} cy={920} r={120} angle={angle(k)} label={`Wheel ${k + 1}`} showPointer />
                {catchSpark(k) > 0 && <circle cx={cx} cy={800} r={16 * catchSpark(k) + 4} fill={C.gold} opacity={catchSpark(k)} />}
                {done(k) > 0 && <text x={cx} y={812} textAnchor="middle" fill={C.green} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">▲</text>}
              </g>
            );
          })}
          {/* counter pill */}
          <g transform="translate(540,1320)">
            <rect x={-90} y={-36} width={180} height={72} rx={36} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{count}/3</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: SLOT (hero) ─────────────────────────────────────────────────────
function SceneSlot() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const align = interpolate(frame, [10, 60], [0, 1], clamp);
  const channel = interpolate(frame, [60, 90], [0, 1], clamp);
  const pulse = frame > 60 ? 1 + 0.05 * Math.sin(frame * 0.2) : 1;
  const drop = spring({ frame: frame - 175, fps, config: { damping: 60, mass: 0.9, stiffness: 160 } });
  const ring = interpolate(frame, [196, 230], [0, 1], clamp);
  const bands = [820, 900, 980];
  const startX = [430, 640, 520];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.ink }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* spotlight */}
          <ellipse cx={540} cy={900} rx={420} ry={300} fill={C.panel} opacity={0.8} />
          {/* three edge-on bands with red notches sliding to center */}
          {bands.map((by, k) => {
            const nx = interpolate(align, [0, 1], [startX[k], 540]);
            return (
              <g key={k}>
                <rect x={280} y={by - 28} width={520} height={56} rx={14} fill={C.steelD} stroke={C.steelK} strokeWidth={3} />
                {/* notch gap (red) */}
                <rect x={nx - 18} y={by - 28} width={36} height={56} fill={C.ink} />
                <rect x={nx - 18} y={by - 28} width={36} height={6} fill={C.red} />
                <rect x={nx - 18} y={by + 22} width={36} height={6} fill={C.red} />
              </g>
            );
          })}
          {/* fused gold channel */}
          <rect x={522} y={792} width={36} height={216} fill="none" stroke={C.gold} strokeWidth={5}
            opacity={channel} transform={`scale(${pulse})`} style={{ transformOrigin: '540px 900px' }} />
          <rect x={528} y={792} width={24} height={216 * channel} fill={C.gold} opacity={0.25} />
          {/* latch bar dropping in */}
          <g transform={`translate(0,${interpolate(drop, [0, 1], [-260, 0], clamp)})`}>
            <rect x={516} y={620} width={48} height={180} rx={8} fill={C.steelL} />
            <rect x={516} y={780} width={48} height={20} rx={6} fill={C.gold} />
          </g>
          {/* impact ring */}
          {ring > 0 && <circle cx={540} cy={1000} r={ring * 180} fill="none" stroke={C.gold} strokeWidth={6 * (1 - ring) + 1} opacity={1 - ring} />}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: SHACKLE opens (payoff) ──────────────────────────────────────────
function SceneShackle() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lift = spring({ frame: frame - 6, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } }) * 90;
  const flick = interpolate(frame, [6, 22], [1, 0], clamp);
  const w = [0, 1, 2, 3].map((k) => spring({ frame: frame - 16 - k * 14, fps, config: { damping: 78, mass: 0.5, stiffness: 210 } }));
  const openBadge = spring({ frame: frame - 70, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="scale(0.82)" style={{ transformOrigin: '540px 920px' }}>
            <Padlock shackleLift={lift} />
            {/* green flick lines at hinge */}
            {flick > 0 && [0, 1, 2].map((k) => (
              <line key={k} x1={670} y1={700} x2={670 + 40 + k * 14} y2={680 - k * 18} stroke={C.green} strokeWidth={6} opacity={flick} strokeLinecap="round" />
            ))}
            {/* OPEN badge where shackle latched */}
            <g transform="translate(670,760)" opacity={openBadge}>
              <rect x={-60} y={-28} width={120} height={56} rx={28} fill={C.green} />
              <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">OPEN</text>
            </g>
          </g>
          {/* payoff text word-by-word */}
          <text x={540} y={1410} textAnchor="middle" fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w[0]}>THREE </tspan><tspan fill="#fff" opacity={w[1]}>NOTCHES.</tspan>
          </text>
          <text x={540} y={1530} textAnchor="middle" fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w[2]}>ONE </tspan><tspan fill="#fff" opacity={w[3]}>SLOT.</tspan>
          </text>
          <rect x={300} y={1556} width={480 * w[3]} height={8} rx={4} fill={C.gold} opacity={w[3]} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Combolock: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('combolock_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* mechanical lock sound design (baked) */}
      <Sequence from={S.catch + 40}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.catch + 110}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.catch + 180}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.slot + 175}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.shackle + 4}><Audio src={staticFile('sfx_boing.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.open - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.open} durationInFrames={S.notches - S.open}><SceneOpen /></Sequence>
      <Sequence from={S.notches} durationInFrames={S.catch - S.notches}><SceneNotches /></Sequence>
      <Sequence from={S.catch} durationInFrames={S.slot - S.catch}><SceneCatch /></Sequence>
      <Sequence from={S.slot} durationInFrames={S.shackle - S.slot}><SceneSlot /></Sequence>
      <Sequence from={S.shackle} durationInFrames={DURATION_IN_FRAMES - S.shackle}><SceneShackle /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

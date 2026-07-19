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
import bpWords from './ballpoint_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 962;

const C = {
  bg:      '#0c1018',
  panel:   '#141a26',
  gold:    '#FFD23F',
  ink:     '#2B6CFF',
  ball:    '#C7D0DC',
  steelD:  '#5A6678',
  paper:   '#F2E9D8',
  inkD:    '#14213A',
  white:   '#F2F5F8',
  bgink:   '#060a10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, zoom: 196, ball: 284, pickup: 460, roll: 617, balance: 726 };

function spiralPath(cx: number, cy: number, r0: number, rStep: number, turns: number, phase = 0, steps = 200) {
  let d = '';
  const total = turns * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const t = (total * i) / steps;
    const r = r0 + (rStep * t) / (Math.PI * 2);
    const x = cx + r * Math.cos(t + phase);
    const y = cy + r * Math.sin(t + phase);
    d += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return d;
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (bpWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 34%, ${C.panel} 0%, ${C.bg} 70%)` }} />;

const Defs = () => (
  <defs>
    <radialGradient id="ballGrad" cx="38%" cy="34%" r="68%">
      <stop offset="0%" stopColor="#eef2f7" />
      <stop offset="100%" stopColor={C.steelD} />
    </radialGradient>
    <linearGradient id="inkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#4d86ff" />
      <stop offset="100%" stopColor={C.ink} />
    </linearGradient>
  </defs>
);

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 65, mass: 0.5, stiffness: 210 } });
  const tag = spring({ frame: frame - 16, fps, config: { damping: 60, mass: 0.5, stiffness: 210 } });
  const line = interpolate(frame, [22, 110], [0, 1], clamp);
  const badge = spring({ frame: frame - 96, fps, config: { damping: 60, mass: 0.5, stiffness: 220 } });
  const odo = (interpolate(frame, [96, 130], [0, 2], clamp)).toFixed(1);
  const spiral = spiralPath(540, 1180, 20, 40, 3.2);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* ink spiral */}
          <path d={spiral} fill="none" stroke={C.ink} strokeWidth={9} strokeLinecap="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - line)} />
          {/* ruler ticks */}
          {Array.from({ length: 18 }).map((_, i) => <line key={i} x1={60 + i * 56} y1={1700} x2={60 + i * 56} y2={1720} stroke={C.steelD} strokeWidth={3} />)}
          {/* pen tilted */}
          <g transform={`translate(540,640) rotate(28) scale(${pop})`}>
            {/* barrel */}
            <rect x={-60} y={-26} width={340} height={52} rx={26} fill={C.ink} />
            <rect x={-60} y={-26} width={340} height={20} rx={10} fill="#5d92ff" opacity={0.5} />
            {/* clicker */}
            <rect x={250} y={-20} width={70} height={40} rx={14} fill={C.steelD} />
            <rect x={310} y={-14} width={26} height={28} rx={8} fill={C.ball} />
            {/* cone tip */}
            <path d="M -60,-26 L -150,0 L -60,26 Z" fill="url(#ballGrad)" />
            <circle cx={-150} cy={0} r={9} fill={C.ball} />
          </g>
          {/* 2 MILES badge */}
          <g transform={`translate(840,470) scale(${badge})`} opacity={badge}>
            <rect x={-110} y={-46} width={220} height={92} rx={20} fill={C.gold} />
            <text x={0} y={-2} textAnchor="middle" fill={C.inkD} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">2 MILES</text>
            <text x={0} y={32} textAnchor="middle" fill={C.inkD} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">{odo} mi</text>
          </g>
          {/* NEVER LEAKS? tag */}
          <g transform={`translate(540,960) scale(${tag})`} opacity={tag}>
            <rect x={-180} y={-40} width={360} height={80} rx={40} fill="none" stroke={C.gold} strokeWidth={5} />
            <text x={0} y={14} textAnchor="middle" fill={C.gold} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NEVER LEAKS?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: ZOOM (loupe) ────────────────────────────────────────────────────
function SceneZoom() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ring = interpolate(frame, [4, 34], [0, 1], clamp);
  const q = spring({ frame: frame - 30, fps, config: { damping: 70, mass: 0.5, stiffness: 190 } });
  const qP = 1 + 0.06 * Math.sin(frame * 0.18);
  const guide = (k: number) => interpolate(frame, [20 + k * 4, 40 + k * 4], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* dim pen silhouette top */}
          <g transform="translate(540,360) rotate(28) scale(0.7)" opacity={0.25}>
            <rect x={-60} y={-26} width={340} height={52} rx={26} fill={C.ink} />
            <path d="M -60,-26 L -150,0 L -60,26 Z" fill={C.steelD} />
          </g>
          {/* loupe ring */}
          <circle cx={540} cy={920} r={300} fill={C.panel} stroke={C.gold} strokeWidth={8}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - ring)} />
          {/* magnified tip inside */}
          <g opacity={ring} transform="translate(540,1000)">
            <path d="M -40,-120 L 40,-120 L 12,80 L -12,80 Z" fill="url(#ballGrad)" />
            <circle cx={0} cy={90} r={26} fill="url(#ballGrad)" />
          </g>
          {/* ? */}
          <text x={540} y={840} textAnchor="middle" fill={C.ink} fontSize={150} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={q}
            transform={`translate(540,840) scale(${q * qP}) translate(-540,-840)`}>?</text>
          {/* guide lines */}
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k * 60 - 90) * Math.PI / 180;
            return <line key={k} x1={540 + Math.cos(a) * 320} y1={920 + Math.sin(a) * 320} x2={540 + Math.cos(a) * 380} y2={920 + Math.sin(a) * 380} stroke={C.gold} strokeWidth={4} opacity={guide(k) * 0.7} />;
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: BALL in socket ──────────────────────────────────────────────────
function SceneBall() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [6, 36], [0, 1], clamp);
  const drop = spring({ frame: frame - 30, fps, config: { damping: 60, mass: 0.6, stiffness: 200 } });
  const arrow = interpolate(frame, [44, 70], [0, 1], clamp);
  const label = spring({ frame: frame - 60, fps, config: { damping: 75, mass: 0.5, stiffness: 200 } });
  const specA = frame * 6;
  const ballY = interpolate(drop, [0, 1], [760, 960], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* chrome conical housing */}
          <path d="M 340,700 L 740,700 L 660,1060 L 420,1060 Z" fill="none" stroke={C.steelD} strokeWidth={8}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
          <path d="M 340,700 L 740,700 L 660,1060 L 420,1060 Z" fill={C.panel} opacity={draw > 0.9 ? 0.7 : 0} />
          {/* socket */}
          <path d="M 420,1010 A 130 130 0 0 0 660,1010" fill="none" stroke={C.steelD} strokeWidth={10} opacity={draw} />
          {/* retaining lips */}
          {[-1, 0, 1].map((k) => <rect key={k} x={540 + k * 110 - 8} y={948} width={16} height={30} rx={4} fill={C.steelD} opacity={draw} />)}
          {/* ball */}
          <g opacity={drop}>
            <circle cx={540} cy={ballY} r={120} fill="url(#ballGrad)" />
            <circle cx={540 + Math.cos(specA * Math.PI / 180) * 60} cy={ballY + Math.sin(specA * Math.PI / 180) * 60} r={22} fill="#fff" opacity={0.7} />
          </g>
          {/* rotation arrow */}
          <path d="M 660,900 A 130 130 0 0 1 540,820" fill="none" stroke={C.gold} strokeWidth={6} markerEnd="url(#aGoldB)"
            strokeDasharray={260} strokeDashoffset={260 * (1 - arrow)} />
          <defs><marker id="aGoldB" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.gold} /></marker></defs>
          {/* FREE TO SPIN */}
          <g transform="translate(540,1240)" opacity={label}>
            <rect x={-150} y={-32} width={300} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.inkD} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FREE TO SPIN</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: PICKUP (hero) ───────────────────────────────────────────────────
function ScenePickup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fill = interpolate(frame, [10, 80], [0, 1], clamp);
  const coat = interpolate(frame, [40, 120], [0, 1], clamp);
  const specA = frame * 5;
  const thread = (k: number) => {
    const t = ((frame * 3 + k * 30) % 90) / 90;
    return t;
  };
  const label = spring({ frame: frame - 96, fps, config: { damping: 50, mass: 0.6, stiffness: 230 } });
  const glow = interpolate(frame, [96, 110, 140], [0, 1, 0.3], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(70% 55% at 64% 52%, #0e1a33 0%, ${C.bg} 72%)` }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* reservoir tube (left/behind) */}
          <g>
            <rect x={210} y={560} width={150} height={620} rx={40} fill={C.panel} stroke={C.steelD} strokeWidth={4} />
            <clipPath id="resClip"><rect x={210} y={560} width={150} height={620} rx={40} /></clipPath>
            <g clipPath="url(#resClip)">
              <rect x={210} y={1180 - 620 * fill} width={150} height={620 * fill} fill="url(#inkGrad)" />
              <rect x={210} y={1180 - 620 * fill} width={150} height={10} fill="#6a9bff" />
            </g>
            <text x={285} y={520} textAnchor="middle" fill={C.ink} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">INK</text>
          </g>
          {/* paper strip */}
          <rect x={360} y={1190} width={620} height={70} fill={C.paper} />
          {/* the ball */}
          <g transform="translate(680,1080)">
            <circle cx={0} cy={0} r={150} fill="url(#ballGrad)" />
            {/* ink coating on back hemisphere (rotating wet film) */}
            <g opacity={coat}>
              <path d="M -150,0 A 150 150 0 0 1 0,-150 L 0,0 Z" fill={C.ink} opacity={0.85}
                transform={`rotate(${specA * 0.6})`} />
            </g>
            <circle cx={Math.cos(specA * Math.PI / 180) * 80} cy={Math.sin(specA * Math.PI / 180) * 80} r={24} fill="#fff" opacity={0.6} />
          </g>
          {/* sticky ink threads reservoir->ball */}
          {[0, 1, 2].map((k) => {
            const t = thread(k);
            const x2 = interpolate(t, [0, 1], [360, 540]);
            const w = interpolate(t, [0, 0.7, 1], [10, 4, 0]);
            return <path key={k} d={`M 360,${980 + k * 40} Q ${x2 + 20},${1010 + k * 30} ${x2},${1040 + k * 20}`} fill="none" stroke={C.ink} strokeWidth={w} opacity={0.8 * (1 - t)} />;
          })}
          {/* PICKS UP INK */}
          <g transform={`translate(700,640) scale(${label})`} opacity={label}>
            <circle cx={0} cy={0} r={160 * glow} fill={C.gold} opacity={glow * 0.2} />
            <rect x={-150} y={-36} width={300} height={72} rx={36} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.inkD} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PICKS UP INK</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: ROLL ────────────────────────────────────────────────────────────
function SceneRoll() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const travel = interpolate(frame, [10, 100], [180, 900], clamp);
  const rot = (travel - 180) * 1.4;
  const label = spring({ frame: frame - 50, fps, config: { damping: 75, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* paper baseline */}
          <rect x={80} y={1020} width={920} height={90} fill={C.paper} />
          {/* ink trail behind ball */}
          <rect x={180} y={1010} width={Math.max(0, travel - 180)} height={14} fill={C.ink} />
          {/* ghost paint roller above */}
          <g transform={`translate(${travel},760)`} opacity={0.4}>
            <rect x={-50} y={-20} width={100} height={40} rx={18} fill={C.steelD} />
            <line x1={0} y1={20} x2={0} y2={70} stroke={C.steelD} strokeWidth={8} />
          </g>
          <rect x={180} y={820} width={Math.max(0, travel - 180)} height={14} fill={C.ink} opacity={0.3} />
          {/* rolling ball */}
          <g transform={`translate(${travel},990) rotate(${rot})`}>
            <circle cx={0} cy={0} r={64} fill="url(#ballGrad)" />
            <line x1={0} y1={0} x2={0} y2={-50} stroke={C.steelD} strokeWidth={5} />
            <line x1={0} y1={0} x2={44} y2={0} stroke={C.steelD} strokeWidth={5} />
          </g>
          {/* LIKE A ROLLER */}
          <g transform="translate(540,560)" opacity={label}>
            <rect x={-160} y={-34} width={320} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.inkD} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">LIKE A ROLLER</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: BALANCE (payoff) ────────────────────────────────────────────────
function SceneBalance() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dropsIn = spring({ frame: frame - 6, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  const tip = frame < 100 ? Math.sin(frame * 0.12) * 10 * Math.max(0, 1 - frame / 100) : 0;
  const w1 = spring({ frame: frame - 96, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 114, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 132, fps, config: { damping: 58, mass: 0.55, stiffness: 220 } });
  const glow = interpolate(frame, [132, 144, 170], [0, 1, 0.3], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {/* balance beam */}
          <g transform={`rotate(${tip} 540 700)`} opacity={dropsIn}>
            <rect x={200} y={694} width={680} height={12} rx={6} fill={C.gold} />
            <line x1={300} y1={700} x2={300} y2={800} stroke={C.steelD} strokeWidth={4} />
            <line x1={780} y1={700} x2={780} y2={800} stroke={C.steelD} strokeWidth={4} />
            {/* sticky droplet (left) */}
            <g transform="translate(300,860)">
              <path d="M 0,-60 Q 40,0 0,40 Q -40,0 0,-60 Z" fill={C.ink} />
              <line x1={0} y1={40} x2={0} y2={90} stroke={C.ink} strokeWidth={4} strokeDasharray="6 8" />
              <text x={0} y={140} textAnchor="middle" fill={C.gold} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">STICKY</text>
            </g>
            {/* thin flowing droplet (right) */}
            <g transform="translate(780,860)">
              <path d="M 0,-50 Q 30,10 0,40 Q -30,10 0,-50 Z" fill="#5d92ff" />
              <path d="M 0,40 Q 14,90 0,140" fill="none" stroke="#5d92ff" strokeWidth={6} />
              <text x={0} y={190} textAnchor="middle" fill={C.gold} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">THIN</text>
            </g>
          </g>
          {/* center fulcrum */}
          <polygon points="540,700 580,820 500,820" fill={C.steelD} opacity={dropsIn} />
          {/* payoff */}
          <text x={540} y={1280} textAnchor="middle" fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w1}>STICKY, </tspan><tspan fill={C.white} opacity={w2}>YET</tspan>
          </text>
          <g opacity={w3} transform={`translate(540,1410) scale(${w3}) translate(-540,-1410)`}>
            <circle cx={540} cy={1378} r={150 * glow} fill={C.gold} opacity={glow * 0.25} />
            <text x={540} y={1410} textAnchor="middle" fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}>FLOWS.</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Ballpoint: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('ballpoint_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* pen/ink sound design (baked) */}
      <Sequence from={S.zoom + 10} durationInFrames={60}><Audio src={staticFile('sfx_chime.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.ball + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.pickup + 12} durationInFrames={120}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.balance + 132}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.zoom - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.zoom} durationInFrames={S.ball - S.zoom}><SceneZoom /></Sequence>
      <Sequence from={S.ball} durationInFrames={S.pickup - S.ball}><SceneBall /></Sequence>
      <Sequence from={S.pickup} durationInFrames={S.roll - S.pickup}><ScenePickup /></Sequence>
      <Sequence from={S.roll} durationInFrames={S.balance - S.roll}><SceneRoll /></Sequence>
      <Sequence from={S.balance} durationInFrames={DURATION_IN_FRAMES - S.balance}><SceneBalance /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

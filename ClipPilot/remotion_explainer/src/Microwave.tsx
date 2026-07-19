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
import mwWords from './microwave_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1061;

const C = {
  bg:      '#0b0e14',
  panel:   '#121826',
  gold:    '#FFD23F',
  red:     '#FF5A3C',
  water:   '#3FC8FF',
  teal:    '#5EEAD4',
  violet:  '#A78BFA',
  heat:    '#FF8A3D',
  silver:  '#C8D2E0',
  grey:    '#5A6680',
  white:   '#F4F7FF',
  ink:     '#070a0f',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, magnetron: 203, target: 437, flip: 563, friction: 733, payoff: 892 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (mwWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
    <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

const Bg = ({ warm = 0 }: { warm?: number }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 46%, ${warm > 0 ? `rgba(255,138,61,${0.12 * warm})` : C.panel} 0%, ${C.bg} 68%)` }} />
);

// water molecule (bent), origin at oxygen center
function WaterMol({ scale = 1, showCharge = false, blur = 0 }: { scale?: number; showCharge?: boolean; blur?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      {blur > 0 && [-1, 1].map((s) => (
        <circle key={s} cx={s * 52} cy={-46} r={26} fill={C.teal} opacity={0.2 * blur} />
      ))}
      {/* bonds */}
      <line x1={0} y1={0} x2={-52} y2={-46} stroke={C.silver} strokeWidth={10} />
      <line x1={0} y1={0} x2={52} y2={-46} stroke={C.silver} strokeWidth={10} />
      {/* hydrogens */}
      <circle cx={-52} cy={-46} r={28} fill={C.teal} />
      <circle cx={52} cy={-46} r={28} fill={C.teal} />
      {/* oxygen */}
      <circle cx={0} cy={0} r={48} fill={C.water} />
      <circle cx={-16} cy={-16} r={14} fill="#bfeeff" opacity={0.7} />
      {showCharge && (
        <>
          <g transform="translate(0,72)"><circle r={22} fill={C.red} /><text y={9} textAnchor="middle" fill="#fff" fontSize={34} fontWeight={900} fontFamily="Poppins,sans-serif">−</text></g>
          <g transform="translate(0,-92)"><circle r={22} fill={C.water} /><text y={11} textAnchor="middle" fill={C.ink} fontSize={34} fontWeight={900} fontFamily="Poppins,sans-serif">+</text></g>
        </>
      )}
    </g>
  );
}

function Mug({ boil = 0, steam = 0, inner = 0 }: { boil?: number; steam?: number; inner?: number }) {
  return (
    <g>
      {/* steam */}
      {steam > 0 && [0, 1, 2].map((k) => {
        const f = (k * 30);
        return <path key={k} d={`M ${500 + k * 40},700 q 20,-40 0,-80 q -20,-40 0,-80`} fill="none" stroke={C.teal} strokeWidth={6} opacity={0.4 * steam} />;
      })}
      {/* cup */}
      <path d="M 410,720 L 440,1080 Q 450,1130 540,1130 Q 630,1130 640,1080 L 670,720 Z" fill={C.silver} />
      <path d="M 410,720 L 440,1080 Q 450,1130 540,1130 Q 630,1130 640,1080 L 670,720 Z" fill={C.panel} opacity={0.25} />
      {/* handle */}
      <path d="M 670,780 q 90,10 80,120 q -6,70 -86,70" fill="none" stroke={C.silver} strokeWidth={22} />
      {/* coffee */}
      <ellipse cx={540} cy={726} rx={130} ry={28} fill="#3b2a1d" />
      {/* boil bubbles */}
      {boil > 0 && [0, 1, 2, 3, 4].map((k) => {
        const ph = (k * 24);
        const r = 6 + (k % 3) * 4;
        return <circle key={k} cx={470 + k * 32} cy={720 - (r * boil)} r={r * boil} fill={C.water} opacity={0.8 * boil} />;
      })}
      {/* inner glowing droplets (payoff) */}
      {inner > 0 && [[490, 900], [560, 960], [600, 860], [510, 1010], [580, 1050]].map((p, k) => (
        <circle key={k} cx={p[0]} cy={p[1]} r={14} fill={C.heat} opacity={inner} />
      ))}
      {/* turntable */}
      <ellipse cx={540} cy={1150} rx={180} ry={30} fill={C.grey} opacity={0.5} />
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 65, mass: 0.5, stiffness: 210 } });
  const boil = interpolate(frame, [16, 40], [0, 1], clamp);
  const pills = spring({ frame: frame - 24, fps, config: { damping: 60, mass: 0.5, stiffness: 210 } });
  const med = spring({ frame: frame - 40, fps, config: { damping: 55, mass: 0.5, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={540} y1={420} x2={540} y2={1240} stroke={C.grey} strokeWidth={3} strokeDasharray="10 10" opacity={0.5} />
          <g transform={`scale(${pop})`} style={{ transformOrigin: '540px 920px' }}>
            <Mug boil={boil} steam={boil} />
          </g>
          {/* OK pinch hand */}
          <g transform="translate(720,1000)" opacity={pop}>
            <circle cx={0} cy={0} r={30} fill="none" stroke={C.silver} strokeWidth={10} />
            <line x1={26} y1={-22} x2={70} y2={-50} stroke={C.silver} strokeWidth={10} strokeLinecap="round" />
          </g>
          {/* pills */}
          <g transform={`translate(250,470) scale(${pills})`} opacity={pills}>
            <rect x={-130} y={-34} width={260} height={68} rx={34} fill={C.water} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MUG: COOL</text>
          </g>
          <g transform={`translate(830,470) scale(${pills})`} opacity={pills}>
            <rect x={-150} y={-34} width={300} height={68} rx={34} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={28} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">COFFEE: BOILING</text>
          </g>
          {/* ? medallion */}
          <g transform={`translate(540,640) scale(${med})`} opacity={med}>
            <circle cx={0} cy={0} r={56} fill={C.gold} />
            <text x={0} y={22} textAnchor="middle" fill={C.ink} fontSize={72} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: MAGNETRON ───────────────────────────────────────────────────────
function SceneMagnetron() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [4, 34], [0, 1], clamp);
  const redPulse = 0.6 + 0.4 * Math.sin(frame * 0.25);
  const ray = (k: number) => interpolate(frame, [30 + k * 12, 60 + k * 12], [0, 1], clamp);
  const label = spring({ frame: frame - 36, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  // ricochet polyline points
  const path = 'M 280,560 L 760,860 L 320,1060 L 800,820 L 360,640';
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* chamber */}
          <rect x={200} y={500} width={680} height={680} rx={24} fill={C.panel} stroke={C.silver} strokeWidth={6}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
          {/* hatched walls hint */}
          {draw > 0.9 && [0, 1, 2, 3, 4, 5].map((k) => <line key={k} x1={200} y1={520 + k * 110} x2={232} y2={500 + k * 110} stroke={C.silver} strokeWidth={2} opacity={0.4} />)}
          {/* magnetron */}
          <g transform="translate(230,440)">
            <rect x={-70} y={-40} width={140} height={80} rx={16} fill={C.red} opacity={redPulse} />
            {[-50, -25, 0, 25, 50].map((x, k) => <line key={k} x1={x} y1={-40} x2={x} y2={40} stroke={C.ink} strokeWidth={4} opacity={0.5} />)}
            <rect x={50} y={-12} width={60} height={24} fill={C.red} opacity={redPulse} />
          </g>
          <g transform="translate(230,360)" opacity={label}>
            <rect x={-110} y={-30} width={220} height={56} rx={28} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MAGNETRON</text>
          </g>
          {/* violet rays ricocheting */}
          <path d={path} fill="none" stroke={C.violet} strokeWidth={6} strokeLinejoin="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - ray(0))} opacity={0.9} />
          <path d="M 320,540 L 780,760 L 300,980 L 820,900" fill="none" stroke={C.violet} strokeWidth={5}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - ray(1))} opacity={0.7} />
          {/* mug at floor */}
          <g transform="translate(0,120) scale(0.6)" style={{ transformOrigin: '540px 920px' }}>
            <Mug />
          </g>
          <text x={540} y={1250} textAnchor="middle" fill={C.violet} fontSize={32} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={label}>INVISIBLE WAVES</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TARGET water ────────────────────────────────────────────────────
function SceneTarget() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reticle = interpolate(frame, [10, 90], [120, 960], clamp);
  const waters = [[300, 760], [620, 700], [820, 900], [440, 1000], [700, 1080]];
  const greys = [[420, 720], [560, 860], [760, 760], [340, 920], [620, 1020], [880, 1000]];
  const label = spring({ frame: frame - 60, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* grey blobs (fade as reticle passes) */}
          {greys.map((p, k) => {
            const dim = reticle > p[0] ? 0.25 : 0.6;
            return <circle key={k} cx={p[0]} cy={p[1]} r={34} fill={C.grey} opacity={dim} />;
          })}
          {/* water molecules with selection rings */}
          {waters.map((p, k) => {
            const locked = reticle > p[0];
            return (
              <g key={k} transform={`translate(${p[0]},${p[1]}) scale(0.7)`}>
                {locked && <circle cx={0} cy={-16} r={90} fill="none" stroke={C.gold} strokeWidth={5} />}
                <WaterMol scale={1} />
              </g>
            );
          })}
          {/* violet reticle sweep */}
          <line x1={reticle} y1={620} x2={reticle} y2={1140} stroke={C.violet} strokeWidth={5} opacity={0.8} />
          <circle cx={reticle} cy={880} r={30} fill="none" stroke={C.violet} strokeWidth={4} />
          {/* TARGET: H2O */}
          <g transform="translate(540,560)" opacity={label}>
            <rect x={-150} y={-34} width={300} height={68} rx={34} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">TARGET: H₂O</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FLIP (hero) ─────────────────────────────────────────────────────
function SceneFlip() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  // accelerating flips
  const prog = interpolate(frame, [10, 150], [0, 1], clamp);
  const flips = Math.floor(prog * prog * 20);
  const angle = flips * 180;
  const dir = flips % 2 === 0 ? 1 : -1;
  const blur = interpolate(frame, [60, 120], [0, 1], clamp);
  const odo = frame > 140 ? 'BILLIONS' : Math.min(999, Math.round(prog * prog * 1400)).toString();
  return (
    <AbsoluteFill>
      <Bg warm={0.2} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* oscillating field arrow */}
          <g transform={`translate(540,900)`}>
            <line x1={-480} y1={0} x2={480} y2={0} stroke={C.violet} strokeWidth={10} opacity={0.6} />
            <path d={dir > 0 ? 'M 470,0 L 430,-22 L 430,22 Z' : 'M -470,0 L -430,-22 L -430,22 Z'} fill={C.violet} />
            <text x={dir > 0 ? 430 : -430} y={-40} textAnchor="middle" fill={C.violet} fontSize={40} fontWeight={900} fontFamily="Poppins,sans-serif">{dir > 0 ? '+' : '−'}</text>
          </g>
          {/* the molecule */}
          <g transform={`translate(540,900) rotate(${angle}) scale(${Math.min(1.4, pop * 1.4)})`}>
            <WaterMol scale={1.7} showCharge blur={blur} />
          </g>
          {/* odometer */}
          <g transform="translate(540,500)">
            <rect x={-180} y={-44} width={360} height={88} rx={18} fill={C.panel} stroke={C.gold} strokeWidth={3} />
            <text x={0} y={14} textAnchor="middle" fill={C.gold} fontSize={frame > 140 ? 52 : 60} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{odo}</text>
            <text x={0} y={40} textAnchor="middle" fill={C.white} fontSize={18} fontWeight={700} fontFamily="Poppins,sans-serif">FLIPS / SEC</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: FRICTION ────────────────────────────────────────────────────────
function SceneFriction() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = interpolate(frame, [20, 110], [0, 1], clamp);
  const therm = interpolate(frame, [20, 120], [0, 1], clamp);
  const cluster = [[440, 820], [600, 800], [520, 920], [680, 920], [460, 1020], [620, 1010]];
  const w1 = spring({ frame: frame - 90, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 108, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg warm={glow} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* heat glow */}
          <circle cx={560} cy={900} r={glow * 360} fill={C.heat} opacity={glow * 0.12} />
          {cluster.map((p, k) => {
            const jx = Math.sin(frame * 0.8 + k) * 8;
            const jy = Math.cos(frame * 0.9 + k) * 8;
            return (
              <g key={k} transform={`translate(${p[0] + jx},${p[1] + jy}) rotate(${(frame * 12 + k * 60) % 360}) scale(0.55)`}>
                <WaterMol scale={1} />
              </g>
            );
          })}
          {/* friction sparks */}
          {[0, 1, 2, 3].map((k) => {
            const fl = interpolate((frame + k * 9) % 24, [0, 6, 24], [0, 1, 0], clamp);
            return <circle key={k} cx={500 + k * 60} cy={880 + (k % 2) * 60} r={10 * fl} fill={C.gold} opacity={fl} />;
          })}
          {/* thermometer */}
          <g transform="translate(900,900)">
            <rect x={-18} y={-200} width={36} height={360} rx={18} fill={C.panel} stroke={C.grey} strokeWidth={3} />
            <circle cx={0} cy={160} r={30} fill={C.red} />
            <rect x={-11} y={160 - 340 * therm} width={22} height={340 * therm} rx={11} fill={C.red} />
          </g>
          {/* FRICTION = HEAT */}
          <text x={540} y={620} textAnchor="middle" fontSize={76} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w1}>FRICTION </tspan><tspan fill={C.heat} opacity={w2}>= HEAT</tspan>
          </text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inner = interpolate(frame, [10, 70], [0, 1], clamp);
  const w1 = spring({ frame: frame - 50, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 66, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 84, fps, config: { damping: 58, mass: 0.55, stiffness: 220 } });
  const glow = interpolate(frame, [84, 96, 130], [0, 1, 0.3], clamp);
  return (
    <AbsoluteFill>
      <Bg warm={0.5} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="scale(0.92)" style={{ transformOrigin: '540px 920px' }}>
            <Mug steam={1} inner={inner} />
          </g>
          <text x={540} y={1340} textAnchor="middle" fontSize={86} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.white} opacity={w1}>YOUR </tspan><tspan fill={C.white} opacity={w2}>FOOD</tspan>
          </text>
          <g opacity={w3} transform={`translate(540,1460) scale(${w3}) translate(-540,-1460)`}>
            <circle cx={540} cy={1428} r={160 * glow} fill={C.gold} opacity={glow * 0.22} />
            <text x={540} y={1460} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}>COOKS ITSELF</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Microwave: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('microwave_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* microwave/electric/water sound design (baked) */}
      <Sequence from={S.hook + 6}><Audio src={staticFile('sfx_click.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.hook + 30} durationInFrames={90}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.magnetron + 10} durationInFrames={60}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.target + 18}><Audio src={staticFile('sfx_chime.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.flip + 10} durationInFrames={120}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 84}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.magnetron - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.magnetron} durationInFrames={S.target - S.magnetron}><SceneMagnetron /></Sequence>
      <Sequence from={S.target} durationInFrames={S.flip - S.target}><SceneTarget /></Sequence>
      <Sequence from={S.flip} durationInFrames={S.friction - S.flip}><SceneFlip /></Sequence>
      <Sequence from={S.friction} durationInFrames={S.payoff - S.friction}><SceneFriction /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

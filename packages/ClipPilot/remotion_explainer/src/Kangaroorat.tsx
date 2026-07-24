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
import krWords from './kangaroorat_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1044;

const C = {
  bgDeep:  '#0f0d0a',
  bgWarm:  '#1a140d',
  gold:    '#FFD23F',
  off:     '#f4ecdd',
  fur:     '#d99a4e',
  dune:    '#c98b3a',
  husk:    '#8a5a2b',
  water:   '#3fb8e6',
  kidney:  '#e0563f',
  paste:   '#b9852f',
  burrow:  '#0a0806',
  ink:     '#080604',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, seeds: 262, metabolic: 392, kidney: 581, burrow: 776, payoff: 949 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (krWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
            color: active ? C.gold : '#fff', fontSize: 60, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 14px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 42%, ${C.bgWarm} 0%, ${C.bgDeep} 76%)` }} />;

function Krat({ scale = 1, curled = false }: { scale?: number; curled?: boolean }) {
  if (curled) {
    return (
      <g transform={`scale(${scale})`}>
        <circle cx={0} cy={0} r={90} fill={C.fur} />
        <path d="M 70,-30 Q 180,-60 200,40 Q 160,30 120,40" fill="none" stroke={C.fur} strokeWidth={14} strokeLinecap="round" />
        <circle cx={-40} cy={-10} r={10} fill={C.ink} />
      </g>
    );
  }
  return (
    <g transform={`scale(${scale})`}>
      {/* tail */}
      <path d="M -140,0 Q -320,-60 -360,80" fill="none" stroke={C.fur} strokeWidth={14} strokeLinecap="round" />
      <circle cx={-360} cy={80} r={20} fill={C.fur} />
      {/* body */}
      <ellipse cx={0} cy={0} rx={150} ry={120} fill={C.fur} />
      {/* hind foot */}
      <path d="M 30,100 L 120,150 L 30,150 Z" fill={C.fur} />
      <line x1={-40} y1={110} x2={-40} y2={160} stroke={C.fur} strokeWidth={14} strokeLinecap="round" />
      {/* head */}
      <circle cx={140} cy={-40} r={86} fill={C.fur} />
      {/* ear */}
      <ellipse cx={120} cy={-120} rx={26} ry={40} fill={C.fur} />
      {/* eye */}
      <circle cx={175} cy={-50} r={28} fill={C.ink} />
      <circle cx={185} cy={-58} r={9} fill={C.gold} />
      {/* nose */}
      <circle cx={220} cy={-20} r={10} fill={C.ink} />
      {/* whiskers */}
      {[-8, 6, 20].map((wy, k) => <line key={k} x1={222} y1={-20 + wy} x2={300} y2={-30 + wy * 2} stroke={C.off} strokeWidth={2} opacity={0.5} />)}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 12, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const slash = interpolate(frame, [26, 44], [0, 1], clamp);
  const days = Math.round(interpolate(frame, [40, 110], [0, 9200], clamp));
  const dunes = interpolate(frame, [6, 40], [200, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* dunes */}
          <path d={`M 0,${1500 + dunes} Q 300,${1420 + dunes} 540,${1480 + dunes} Q 800,${1540 + dunes} 1080,${1460 + dunes} L 1080,1920 L 0,1920 Z`} fill={C.dune} opacity={0.3} />
          <path d={`M 0,${1620 + dunes} Q 400,${1560 + dunes} 1080,${1600 + dunes} L 1080,1920 L 0,1920 Z`} fill={C.dune} opacity={0.5} />
          <g transform={`translate(540,1040) scale(${Math.min(1, pop) * 1.2})`}><Krat /></g>
          {/* badge */}
          <g transform={`translate(540,420) scale(${badge})`} opacity={badge}>
            <rect x={-290} y={-50} width={580} height={100} rx={26} fill={C.gold} />
            <text x={-30} y={14} textAnchor="middle" fill={C.ink} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NEVER DRINKS WATER</text>
            <circle cx={210} cy={0} r={32} fill={C.water} />
            <path d="M 210,-24 Q 226,-4 210,16 Q 194,-4 210,-24 Z" fill={C.bgDeep} />
            <line x1={172} y1={-30} x2={250} y2={30} stroke={C.ink} strokeWidth={7} strokeLinecap="round" opacity={slash} />
          </g>
          {/* days counter */}
          <g transform="translate(540,1340)">
            <text x={0} y={0} textAnchor="middle" fill={C.off} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">DAYS WITHOUT A DRINK</text>
            <text x={0} y={56} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{days.toLocaleString()}+</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SEEDS ───────────────────────────────────────────────────────────
function SceneSeeds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pct = Math.round(interpolate(frame, [16, 70], [0, 90], clamp));
  const arrow = interpolate(frame, [50, 90], [0, 1], clamp);
  const dropFill = interpolate(frame, [70, 100], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(180,980) scale(0.8)"><Krat /></g>
          {/* seeds */}
          {[0, 1, 2, 3, 4].map((k) => {
            const pop = spring({ frame: frame - 10 - k * 6, fps, config: { damping: 50, mass: 0.5, stiffness: 220 } });
            return <g key={k} transform={`translate(${620 + (k % 3) * 70},${1040 + Math.floor(k / 3) * 60}) scale(${pop})`}>
              <ellipse cx={0} cy={0} rx={36} ry={24} fill={C.husk} />
              <line x1={-24} y1={0} x2={24} y2={0} stroke={C.ink} strokeWidth={2} opacity={0.4} />
            </g>;
          })}
          {/* counter */}
          <text x={680} y={620} textAnchor="middle" fill={C.gold} fontSize={80} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{pct}% WATER</text>
          {/* arrow to drop */}
          <path d="M 700,1000 Q 760,820 760,720" fill="none" stroke={C.gold} strokeWidth={5} markerEnd="url(#aGoldK)"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - arrow)} />
          <defs><marker id="aGoldK" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.gold} /></marker></defs>
          <g transform="translate(760,680)">
            <path d="M 0,-40 Q 30,0 0,34 Q -30,0 0,-40 Z" fill="none" stroke={C.water} strokeWidth={4} />
            <clipPath id="dropK"><path d="M 0,-40 Q 30,0 0,34 Q -30,0 0,-40 Z" /></clipPath>
            <g clipPath="url(#dropK)"><rect x={-34} y={34 - 74 * dropFill} width={68} height={74 * dropFill} fill={C.water} /></g>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: METABOLIC ───────────────────────────────────────────────────────
function SceneMetabolic() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const split = interpolate(frame, [10, 40], [0, 1], clamp);
  const squeeze = interpolate(frame, [50, 110], [0, 1], clamp);
  const label = spring({ frame: frame - 70, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <radialGradient id="warmK" cx="50%" cy="40%" r="50%"><stop offset="0%" stopColor={C.bgWarm} /><stop offset="100%" stopColor={C.bgDeep} /></radialGradient>
          {/* husk halves */}
          <g transform={`translate(${540 - split * 90},860)`}><path d="M 0,-160 Q -130,-160 -130,0 Q -130,160 0,160 Z" fill={C.husk} /></g>
          <g transform={`translate(${540 + split * 90 - squeeze * 30},860)`}><path d="M 0,-160 Q 130,-160 130,0 Q 130,160 0,160 Z" fill={C.husk} /></g>
          {/* honeycomb cells */}
          {Array.from({ length: 9 }).map((_, k) => {
            const col = k % 3, row = Math.floor(k / 3);
            return <polygon key={k} points="0,-26 22,-13 22,13 0,26 -22,13 -22,-13"
              transform={`translate(${480 + col * 60},${780 + row * 56})`} fill={C.gold} opacity={0.4} />;
          })}
          {/* molecules */}
          {[0, 1].map((k) => <g key={k} transform={`translate(${360 + k * 360},700) rotate(${frame * 4})`}>
            <polygon points="0,-24 21,-12 21,12 0,24 -21,12 -21,-12" fill="none" stroke={C.water} strokeWidth={3} />
            <circle cx={0} cy={-24} r={5} fill={C.water} />
          </g>)}
          {/* water beads trickling */}
          {squeeze > 0.1 && [0, 1, 2, 3].map((k) => {
            const t = ((frame * 3 + k * 30) % 120) / 120;
            return <circle key={k} cx={540 + Math.sin(k) * 30} cy={900 + t * 360} r={8 * squeeze} fill={C.water} opacity={(1 - t) * 0.9} />;
          })}
          {/* label */}
          <g transform="translate(540,1340)" opacity={label}>
            <rect x={-200} y={-34} width={400} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">METABOLIC WATER</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: KIDNEY (hero) ───────────────────────────────────────────────────
function SceneKidney() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const popIn = spring({ frame, fps, config: { damping: 45, mass: 0.6, stiffness: 160 } });
  const throb = 1 + 0.04 * Math.sin(frame * 0.12);
  const inlet = interpolate(frame, [20, 50], [0, 1], clamp);
  const loops = (k: number) => interpolate(frame, [50 + k * 14, 75 + k * 14], [0, 1], clamp);
  const paste = interpolate(frame, [130, 175], [0, 1], clamp);
  const gauge = spring({ frame: frame - 150, fps, config: { damping: 50, mass: 0.5, stiffness: 200 } });
  const stamp = spring({ frame: frame - 160, fps, config: { damping: 45, mass: 0.6, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 42% 50%, ${C.bgWarm} 0%, ${C.bgDeep} 70%)` }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* inlet stream (blue) */}
          <path d="M 440,520 L 440,720" fill="none" stroke={C.water} strokeWidth={16} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - inlet)} />
          {/* kidney */}
          <g transform={`translate(440,960) scale(${popIn * throb})`}>
            <path d="M 60,-240 Q -160,-240 -160,0 Q -160,240 60,240 Q -20,120 -20,0 Q -20,-120 60,-240 Z" fill={C.kidney} />
            <path d="M 60,-240 Q -160,-240 -160,0 Q -160,240 60,240 Q -20,120 -20,0 Q -20,-120 60,-240 Z" fill="none" stroke="#ff7a63" strokeWidth={4} opacity={0.5} />
            {/* nephron loops */}
            {[0, 1, 2, 3, 4].map((k) => (
              <g key={k} opacity={loops(k)}>
                <path d={`M ${-30 - k * 22},${-120 + k * 50} q -50,40 0,90`} fill="none" stroke={C.water} strokeWidth={5} />
                <line x1={-30 - k * 22} y1={-120 + k * 50} x2={-10 - k * 22} y2={-180 + k * 50} stroke={C.water} strokeWidth={3} opacity={0.7} />
              </g>
            ))}
          </g>
          {/* paste spout (bottom) */}
          <g transform="translate(440,1230)">
            <ellipse cx={0} cy={interpolate(paste, [0, 1], [0, 60])} rx={interpolate(paste, [0, 1], [10, 46])} ry={interpolate(paste, [0, 1], [8, 30])} fill={C.paste} />
            {paste > 0.9 && <ellipse cx={0} cy={120} rx={50} ry={16} fill={C.paste} opacity={(paste - 0.9) * 10} />}
          </g>
          {/* gauge */}
          <g transform="translate(840,720)">
            <path d="M -90,40 A 90 90 0 0 1 90,40" fill="none" stroke="#3a2a26" strokeWidth={12} />
            <line x1={0} y1={40} x2={Math.cos((180 - gauge * 160) * Math.PI / 180) * 76} y2={40 - Math.sin((180 - gauge * 160) * Math.PI / 180) * 76} stroke={C.gold} strokeWidth={8} strokeLinecap="round" />
            <text x={0} y={100} textAnchor="middle" fill={C.gold} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">MAX</text>
          </g>
          {/* WATER SAVED meter */}
          <g transform="translate(900,960)">
            <rect x={-20} y={-160} width={40} height={320} rx={20} fill="#2a201c" />
            <rect x={-20} y={160 - 300 * gauge} width={40} height={300 * gauge} rx={20} fill={C.water} />
            <text x={0} y={210} textAnchor="middle" fill={C.water} fontSize={20} fontWeight={800} fontFamily="Poppins,sans-serif">SAVED</text>
          </g>
          {/* PASTE NOT PEE */}
          <g transform={`translate(540,460) scale(${stamp})`} opacity={stamp}>
            <rect x={-200} y={-36} width={400} height={72} rx={16} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PASTE, NOT PEE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: BURROW ──────────────────────────────────────────────────────────
function SceneBurrow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = interpolate(frame, [6, 40], [0, 1], clamp);
  const plug = spring({ frame: frame - 40, fps, config: { damping: 55, mass: 0.6, stiffness: 200 } });
  const hotT = interpolate(frame, [40, 110], [0, 1], clamp);
  const pill = spring({ frame: frame - 70, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bgDeep }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* sky above */}
          <rect x={0} y={0} width={1080 * wipe} height={760} fill="#2a2012" opacity={0.5} />
          <circle cx={840} cy={300} r={70} fill="#ffcf6e" opacity={wipe * 0.7} />
          {[0, 1, 2].map((k) => <path key={k} d={`M ${300 + k * 160},700 q 20,-30 0,-60`} fill="none" stroke="#ff8a3d" strokeWidth={4} opacity={wipe * 0.4} />)}
          {/* ground */}
          <rect x={0} y={760} width={1080 * wipe} height={1160} fill={C.husk} opacity={0.4} />
          {/* burrow */}
          <path d="M 300,760 Q 200,1050 540,1150 Q 800,1230 760,1450" fill="none" stroke={C.burrow} strokeWidth={140} strokeLinecap="round" opacity={wipe} />
          <g transform="translate(560,1180)"><Krat scale={0.5} curled /></g>
          {/* moisture dots */}
          {Array.from({ length: 6 }).map((_, k) => {
            const a = (frame * 2 + k * 60) % 360;
            return <circle key={k} cx={560 + Math.cos(a * Math.PI / 180) * 90} cy={1180 + Math.sin(a * Math.PI / 180) * 60} r={5} fill={C.water} opacity={0.5} />;
          })}
          {/* sand plug */}
          <circle cx={interpolate(plug, [0, 1], [180, 300])} cy={760} r={50} fill={C.dune} />
          {/* thermometers */}
          <g transform="translate(120,400)"><rect x={-12} y={-100} width={24} height={200} rx={12} fill="#2a201c" /><rect x={-7} y={100 - 180 * hotT} width={14} height={180 * hotT} rx={7} fill="#ff5a3d" /></g>
          <g transform="translate(120,1300)"><rect x={-12} y={-100} width={24} height={200} rx={12} fill="#2a201c" /><rect x={-7} y={40} width={14} height={60} rx={7} fill={C.water} /></g>
          {/* SEALED IN */}
          <g transform="translate(540,560)" opacity={pill}>
            <rect x={-130} y={-34} width={260} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">SEALED IN</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camelBar = interpolate(frame, [10, 50], [0, 0.45], clamp);
  const ratBar = interpolate(frame, [10, 60], [0, 0.95], clamp);
  const crown = spring({ frame: frame - 60, fps, config: { damping: 45, mass: 0.5, stiffness: 210 } });
  const lines = [['BEATS', false], ['A CAMEL.', true], ['DRINKS', false], ['NOTHING.', true]];
  const ws = lines.map((_, k) => spring({ frame: frame - 80 - k * 11, fps, config: { damping: k % 2 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* camel */}
          <g transform="translate(280,560)" opacity={1 - Math.min(1, ws[0])}>
            <ellipse cx={0} cy={0} rx={110} ry={50} fill={C.dune} /><circle cx={70} cy={-50} r={28} fill={C.dune} /><path d="M -20,-40 l 20,-30 l 20,30 Z" fill={C.dune} />
            <rect x={-140} y={70} width={300} height={20} rx={10} fill="#3a2e1c" /><rect x={-140} y={70} width={300 * camelBar} height={20} rx={10} fill={C.dune} />
          </g>
          {/* rat */}
          <g transform="translate(800,560)" opacity={1 - Math.min(1, ws[0])}>
            <g transform="scale(0.5)"><Krat /></g>
            <rect x={-140} y={120} width={300} height={20} rx={10} fill="#3a2e1c" /><rect x={-140} y={120} width={300 * ratBar} height={20} rx={10} fill={C.gold} />
            <text x={0} y={-150} textAnchor="middle" fontSize={44} opacity={crown}>👑</text>
          </g>
          {/* payoff */}
          {lines.map((ln, k) => (
            <text key={k} x={540} y={1000 + k * 130} textAnchor="middle" fontSize={k % 2 ? 96 : 76} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
              fill={ln[1] ? C.gold : C.off} opacity={ws[k]} transform={`translate(540,${1000 + k * 130}) scale(${ws[k]}) translate(-540,-${1000 + k * 130})`}>{ln[0]}</text>
          ))}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Kangaroorat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('kangaroorat_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* desert/dry sound design (baked) */}
      <Sequence from={S.hook + 4} durationInFrames={60}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.3} /></Sequence>
      <Sequence from={S.hook + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.seeds + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.metabolic + 30}><Audio src={staticFile('sfx_digital.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.metabolic + 70}><Audio src={staticFile('sfx_plip.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.kidney + 40} durationInFrames={90}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.kidney + 150}><Audio src={staticFile('sfx_plip.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.kidney + 162}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.burrow + 36}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.payoff + 78}><Audio src={staticFile('sfx_success.wav')} volume={0.46} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.seeds - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.seeds} durationInFrames={S.metabolic - S.seeds}><SceneSeeds /></Sequence>
      <Sequence from={S.metabolic} durationInFrames={S.kidney - S.metabolic}><SceneMetabolic /></Sequence>
      <Sequence from={S.kidney} durationInFrames={S.burrow - S.kidney}><SceneKidney /></Sequence>
      <Sequence from={S.burrow} durationInFrames={S.payoff - S.burrow}><SceneBurrow /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

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
import msWords from './mantisshrimp_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1047;

const C = {
  bg:      '#0a1622',
  ocean:   '#0f2436',
  gold:    '#FFD23F',
  shrimp:  '#FF5C3D',
  teal:    '#3FE0D0',
  cav:     '#F4FBFF',
  cyan:    '#5FC8FF',
  amber:   '#E89B3C',
  red:     '#FF3B30',
  ink:     '#06101a',
  white:   '#F4FBFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, fire: 104, cavitation: 355, miss: 554, crack: 726, payoff: 958 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (msWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.ocean} 0%, ${C.bg} 75%)` }}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <Caustics />
    </svg>
  </AbsoluteFill>
);
function Caustics() {
  const f = useCurrentFrame();
  return (
    <g opacity={0.06}>
      {Array.from({ length: 8 }).map((_, i) => (
        <path key={i} d={`M ${(i * 150 + f * 0.4) % 1200 - 60},${120 + i * 200} q 60,-40 120,0 q 60,40 120,0`} fill="none" stroke={C.cyan} strokeWidth={6} />
      ))}
    </g>
  );
}

// stylized mantis shrimp facing right, origin at body center
function Shrimp({ scale = 1, clubAngle = 0, flex = 0 }: { scale?: number; clubAngle?: number; flex?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* tail fan */}
      <g transform="translate(-220,10)">
        {[-30, -10, 10, 30].map((a, k) => <path key={k} d={`M 0,0 L -70,${a} L -64,${a + 8} Z`} fill={C.shrimp} opacity={0.9} />)}
      </g>
      {/* body segments */}
      {[-180, -130, -80, -30, 20].map((x, k) => (
        <rect key={k} x={x} y={-46} width={56} height={92} rx={20} fill={C.shrimp} opacity={0.92 - k * 0.02} stroke={C.ink} strokeWidth={2} />
      ))}
      {/* head */}
      <ellipse cx={80} cy={0} rx={70} ry={58} fill={C.shrimp} />
      {/* eyes on stalks */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(110,${-40 + s * 8})`}>
          <line x1={0} y1={0} x2={36} y2={-30 - s * 6} stroke={C.shrimp} strokeWidth={12} />
          <circle cx={40} cy={-34 - s * 6} r={20} fill={C.teal} />
          <circle cx={44} cy={-38 - s * 6} r={8} fill={C.ink} />
        </g>
      ))}
      {/* antennae */}
      <path d="M 140,20 q 50,10 80,-20" fill="none" stroke={C.shrimp} strokeWidth={5} />
      {/* club arm (the weapon) */}
      <g transform={`translate(60,40) rotate(${clubAngle})`}>
        <rect x={0} y={-14} width={90 + flex * 30} height={28} rx={14} fill="#ff7a5e" stroke={C.ink} strokeWidth={2} />
        <ellipse cx={96 + flex * 30} cy={0} rx={36} ry={30} fill="#ff8a6e" stroke={C.ink} strokeWidth={2} />
      </g>
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 170 } });
  const badge = spring({ frame: frame - 8, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  const outline = interpolate(frame, [18, 44], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,1000) scale(${Math.min(1, pop)})`}>
            <Shrimp scale={2.0} clubAngle={20} />
            {/* gold danger outline on club */}
            <g transform="translate(120,80)">
              <ellipse cx={0} cy={0} rx={120} ry={80} fill="none" stroke={C.gold} strokeWidth={5}
                pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - outline)} />
              {outline > 0.9 && [-1, 1].map((s) => <circle key={s} cx={s * 40} cy={-30} r={6} fill={C.gold} />)}
            </g>
          </g>
          {/* badge */}
          <g transform={`translate(540,400) scale(${badge})`} opacity={badge}>
            <rect x={-330} y={-54} width={660} height={108} rx={28} fill={C.gold} />
            <text x={30} y={12} textAnchor="middle" fill={C.ink} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PACKS A 1500 N PUNCH</text>
            <text x={-280} y={16} textAnchor="middle" fill={C.ink} fontSize={56} fontWeight={900} fontFamily="Poppins,sans-serif">👊</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: FIRE (faster than bullet) ───────────────────────────────────────
function SceneFire() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const armX = interpolate(frame, [20, 70], [-200, 360], clamp);
  const bulletX = interpolate(frame, [20, 80], [-300, 280], clamp);
  const trail = interpolate(frame, [20, 60], [0, 1], clamp);
  const readout = frame > 30 ? (Math.min(0.003, interpolate(frame, [30, 60], [0, 0.003], clamp))).toFixed(3) : '0.000';
  const faster = spring({ frame: frame - 72, fps, config: { damping: 55, mass: 0.5, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* shrimp anchored left */}
          <g transform="translate(220,760) scale(1.1)"><Shrimp scale={1.4} clubAngle={5} /></g>
          {/* club streak */}
          <g transform={`translate(${armX},820)`}>
            <path d={`M ${-180 * trail},0 L 0,0`} stroke={C.shrimp} strokeWidth={26} strokeLinecap="round" opacity={0.5} />
            <ellipse cx={0} cy={0} rx={40} ry={30} fill="#ff8a6e" />
          </g>
          {/* readout */}
          <g transform="translate(820,520)">
            <rect x={-150} y={-44} width={300} height={88} rx={16} fill={C.ink} stroke={C.gold} strokeWidth={3} />
            <text x={0} y={14} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{readout}s</text>
          </g>
          {/* ghost gun + bullet */}
          <g transform="translate(120,1120)" opacity={0.5}>
            <rect x={-60} y={-14} width={120} height={28} rx={6} fill="#5b6680" />
            <rect x={40} y={-8} width={40} height={16} rx={4} fill="#5b6680" />
          </g>
          <circle cx={bulletX} cy={1112} r={14} fill="#9fb0c2" />
          <path d={`M ${bulletX - 60},1112 L ${bulletX},1112`} stroke="#9fb0c2" strokeWidth={6} opacity={0.5} />
          {/* dashed compare line */}
          <line x1={armX} y1={820} x2={armX} y2={1112} stroke={C.gold} strokeWidth={3} strokeDasharray="8 10" opacity={0.6} />
          {/* FASTER */}
          <g transform={`translate(${armX},680) scale(${faster})`} opacity={faster}>
            <rect x={-110} y={-34} width={220} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FASTER</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: CAVITATION (hero) ───────────────────────────────────────────────
function SceneCavitation() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ring = (k: number) => interpolate(frame, [14 + k * 3, 95 + k * 3], [0, 1], clamp);
  const bloom = frame < 122 ? interpolate(frame, [30, 66, 120], [0, 1.15, 1], clamp) : interpolate(frame, [122, 130], [1, 0], clamp);
  const explode = interpolate(frame, [130, 199], [0, 1], clamp);
  const labelFlash = interpolate(frame, [128, 138, 178], [0, 1, 0.5], clamp);
  const sparkSeed = Math.floor(frame / 2);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* pressure rings */}
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={540} cy={900} r={60 + ring(k) * 300} fill="none"
              stroke={k % 2 ? C.cyan : C.shrimp} strokeWidth={8} opacity={0.5 * (1 - ring(k))} />
          ))}
          {/* shockwave on explode */}
          {explode > 0 && <circle cx={540} cy={900} r={explode * 460} fill="none" stroke={C.cyan} strokeWidth={10 * (1 - explode) + 1} opacity={1 - explode} />}
          {/* cavitation bubble */}
          {bloom > 0 && (
            <g transform={`translate(540,900) scale(${bloom})`}>
              <circle cx={0} cy={0} r={150} fill={C.cyan} opacity={0.4} />
              <circle cx={0} cy={0} r={110} fill={C.cav} />
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const a = ((k * 60 + sparkSeed * 23) % 360) * Math.PI / 180;
                return <line key={k} x1={0} y1={0} x2={Math.cos(a) * 90} y2={Math.sin(a) * 90} stroke={C.cyan} strokeWidth={4} />;
              })}
            </g>
          )}
          {/* explosion particles */}
          {explode > 0 && Array.from({ length: 24 }).map((_, k) => {
            const a = (k * 15) * Math.PI / 180;
            const r = explode * (200 + (k % 5) * 30);
            return <circle key={k} cx={540 + Math.cos(a) * r} cy={900 + Math.sin(a) * r} r={(1 - explode) * 8 + 2} fill={C.cav} opacity={1 - explode} />;
          })}
          {/* 4500 C label */}
          <g transform="translate(540,560)" opacity={labelFlash}>
            <circle cx={0} cy={0} r={120 * labelFlash} fill={C.gold} opacity={labelFlash * 0.2} />
            <rect x={-110} y={-36} width={220} height={72} rx={16} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">4500°C</text>
          </g>
          {/* ~BULLET FORCE */}
          <g transform="translate(540,1280)" opacity={interpolate(frame, [136, 152], [0, 1], clamp)}>
            <rect x={-160} y={-32} width={320} height={64} rx={16} fill={C.ink} stroke={C.red} strokeWidth={4} />
            <text x={0} y={10} textAnchor="middle" fill={C.red} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">~BULLET FORCE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: MISS (shockwave KO) ─────────────────────────────────────────────
function SceneMiss() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wave = interpolate(frame, [16, 80], [0, 1], clamp);
  const flip = frame > 70 ? interpolate(frame, [70, 90], [0, 180], clamp) : 0;
  const bob = flip >= 180 ? Math.sin(frame * 0.2) * 12 : 0;
  const pill = spring({ frame: frame - 80, fps, config: { damping: 60, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* shrimp left */}
          <g transform="translate(200,900) scale(0.95)"><Shrimp scale={1.2} clubAngle={-8} /></g>
          {/* MISS bracket */}
          <g opacity={interpolate(frame, [6, 24], [0, 1], clamp)}>
            <line x1={420} y1={820} x2={760} y2={820} stroke={C.gold} strokeWidth={4} strokeDasharray="10 10" />
            <text x={590} y={800} textAnchor="middle" fill={C.gold} fontSize={34} fontWeight={900} fontFamily="Poppins,sans-serif">MISS</text>
          </g>
          {/* shockwave ring */}
          <circle cx={360} cy={900} r={wave * 560} fill="none" stroke={C.cyan} strokeWidth={12 * (1 - wave) + 2} opacity={(1 - wave) * 0.9} />
          {/* fish right */}
          <g transform={`translate(840,${900 + bob}) rotate(${flip})`}>
            <ellipse cx={0} cy={0} rx={70} ry={44} fill={C.teal} />
            <path d="M 60,0 L 110,-34 L 110,34 Z" fill={C.teal} />
            <circle cx={-30} cy={-8} r={9} fill={C.ink} />
            {flip >= 180 && <>
              <line x1={-38} y1={-14} x2={-22} y2={-2} stroke={C.ink} strokeWidth={4} />
              <line x1={-38} y1={-2} x2={-22} y2={-14} stroke={C.ink} strokeWidth={4} />
            </>}
          </g>
          {/* dizzy spirals */}
          {flip >= 180 && [0, 1].map((k) => (
            <path key={k} d={`M ${810 + k * 60},${800} q 20,-20 0,-40 q -20,-20 0,-30`} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.7} />
          ))}
          {/* NO CONTACT */}
          <g transform="translate(840,720)" opacity={pill}>
            <rect x={-130} y={-32} width={260} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NO CONTACT</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: CRACK (crab + glass) ────────────────────────────────────────────
function SceneCrack() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const crabHit = spring({ frame: frame - 10, fps, config: { damping: 50, mass: 0.5, stiffness: 230 } });
  const crabCrack = interpolate(frame, [16, 50], [0, 1], clamp);
  const glassCrack = interpolate(frame, [70, 110], [0, 1], clamp);
  const shard = interpolate(frame, [100, 140], [0, 1], clamp);
  const meter = interpolate(frame, [10, 60], [0, 1], clamp);
  const pill = spring({ frame: frame - 50, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* force meter top */}
          <g transform="translate(540,420)">
            <rect x={-280} y={-22} width={560} height={44} rx={22} fill={C.ink} stroke={C.gold} strokeWidth={3} />
            <rect x={-276} y={-18} width={552 * meter} height={36} rx={18} fill={C.red} />
          </g>
          <g transform={`translate(540,360) scale(${pill})`} opacity={pill}>
            <rect x={-130} y={-30} width={260} height={60} rx={30} fill={C.red} />
            <text x={0} y={10} textAnchor="middle" fill="#fff" fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">RIFLE ROUND</text>
          </g>
          {/* crab left */}
          <g transform="translate(330,1000)">
            <ellipse cx={0} cy={0} rx={130} ry={90} fill={C.teal} />
            {[-1, 1].map((s) => <ellipse key={s} cx={s * 150} cy={-30} rx={40} ry={26} fill={C.amber} transform={`rotate(${s * 20} ${s * 150} -30)`} />)}
            {[-1, 1].map((s) => [0, 1, 2].map((k) => <line key={`${s}-${k}`} x1={s * 90} y1={20 + k * 20} x2={s * 170} y2={40 + k * 30} stroke={C.amber} strokeWidth={8} />))}
            {/* impact star */}
            <g opacity={crabHit}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                const a = (k * 45) * Math.PI / 180;
                return <line key={k} x1={0} y1={-10} x2={Math.cos(a) * 50 * crabHit} y2={-10 + Math.sin(a) * 50 * crabHit} stroke={C.shrimp} strokeWidth={6} />;
              })}
            </g>
            {/* fracture lines */}
            {crabCrack > 0 && [0, 1, 2, 3].map((k) => {
              const a = (k * 90 + 20) * Math.PI / 180;
              return <line key={k} x1={0} y1={-10} x2={Math.cos(a) * 110 * crabCrack} y2={-10 + Math.sin(a) * 70 * crabCrack} stroke={C.white} strokeWidth={3} />;
            })}
          </g>
          {/* glass right */}
          <g transform="translate(800,1060)">
            <rect x={-120} y={-160} width={240} height={320} rx={8} fill={C.cyan} opacity={0.12} stroke={C.cyan} strokeWidth={3} />
            {glassCrack > 0 && [0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k * 60) * Math.PI / 180;
              return <line key={k} x1={0} y1={0} x2={Math.cos(a) * 150 * glassCrack} y2={Math.sin(a) * 150 * glassCrack} stroke={C.white} strokeWidth={3} />;
            })}
            {/* shards */}
            {shard > 0 && [0, 1].map((k) => (
              <polygon key={k} points="0,0 24,8 10,28" fill={C.cyan} opacity={(1 - shard) * 0.8}
                transform={`translate(${k * 40 - 20},${shard * 160}) rotate(${shard * 120})`} />
            ))}
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
  const hand = interpolate(frame, [6, 40], [0, 1], clamp);
  const flex = frame > 60 ? interpolate(frame, [60, 68, 78], [0, 1, 0], clamp) : 0;
  const w1 = spring({ frame: frame - 30, fps, config: { damping: 60, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 48, fps, config: { damping: 55, mass: 0.55, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* hand outline */}
          <path d="M 360,1080 q -20,-180 30,-200 q 20,-6 24,40 q 8,-90 36,-90 q 24,0 24,80 q 10,-70 36,-66 q 24,4 22,84 q 16,-40 38,-30 q 24,8 4,120 q 30,80 -40,150 q -120,90 -236,-12 Z"
            fill="none" stroke={C.gold} strokeWidth={4} opacity={hand} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - hand)} />
          <g transform="translate(460,940) scale(0.85)"><Shrimp scale={0.95} clubAngle={20} flex={flex} /></g>
          {flex > 0.5 && <text x={600} y={900} fontSize={48} opacity={flex}>✨</text>}
          {/* payoff */}
          <text x={540} y={1360} textAnchor="middle" fontSize={88} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w1}>TINY </tspan><tspan fill="#fff" opacity={w1}>SHRIMP.</tspan>
          </text>
          <text x={540} y={1480} textAnchor="middle" fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
            opacity={w2} transform={`translate(540,1480) scale(${w2}) translate(-540,-1480)`} fill={C.gold}>BULLET FISTS.</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Mantisshrimp: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('mantisshrimp_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* underwater/impact sound design (baked) */}
      <Sequence from={S.hook + 4}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.fire + 20}><Audio src={staticFile('sfx_smack.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.cavitation + 128}><Audio src={staticFile('sfx_glass.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.cavitation + 130} durationInFrames={50}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.miss + 14} durationInFrames={70}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.4} /></Sequence>
      <Sequence from={S.miss + 72}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.crack + 70}><Audio src={staticFile('sfx_glass.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.crack + 10}><Audio src={staticFile('sfx_smack.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 30}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.fire - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.fire} durationInFrames={S.cavitation - S.fire}><SceneFire /></Sequence>
      <Sequence from={S.cavitation} durationInFrames={S.miss - S.cavitation}><SceneCavitation /></Sequence>
      <Sequence from={S.miss} durationInFrames={S.crack - S.miss}><SceneMiss /></Sequence>
      <Sequence from={S.crack} durationInFrames={S.payoff - S.crack}><SceneCrack /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

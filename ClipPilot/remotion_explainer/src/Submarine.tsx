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
import subWords from './submarine_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1046;

const C = {
  bg:      '#0a1626',
  abyss:   '#0d1f33',
  gold:    '#FFD23F',
  steel:   '#9fb3c8',
  ocean:   '#2e6fb0',
  sea:     '#1d8fa3',
  air:     '#eaf4ff',
  red:     '#e0533d',
  hullSh:  '#16334a',
  ink:     '#08111e',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, choice: 184, tanks: 269, dive: 370, rise: 668, payoff: 826 };

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
const WRAW: { w: string; s: number }[] = (subWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ─── Submarine props ──────────────────────────────────────────────────────────
function SubExterior({ bob = 0 }: { bob?: number }) {
  return (
    <g transform={`translate(0,${bob})`}>
      {/* propeller */}
      <g transform="translate(860,900)">
        <circle cx={0} cy={0} r={10} fill={C.steel} />
        <ellipse cx={0} cy={-22} rx={8} ry={22} fill={C.hullSh} />
        <ellipse cx={0} cy={22} rx={8} ry={22} fill={C.hullSh} />
      </g>
      {/* hull */}
      <rect x={220} y={812} width={620} height={176} rx={88} fill={C.steel} />
      <rect x={220} y={900} width={620} height={88} rx={44} fill={C.hullSh} opacity={0.55} />
      {/* conning tower */}
      <rect x={470} y={716} width={130} height={108} rx={20} fill={C.steel} />
      <rect x={470} y={716} width={40} height={108} rx={18} fill={C.hullSh} opacity={0.4} />
      <line x1={535} y1={716} x2={535} y2={650} stroke={C.steel} strokeWidth={9} strokeLinecap="round" />
      <circle cx={535} cy={648} r={9} fill={C.gold} />
      {/* portholes */}
      {[320, 400, 660, 740].map((x, i) => <circle key={i} cx={x} cy={888} r={15} fill={C.abyss} stroke={C.air} strokeWidth={3} />)}
    </g>
  );
}

// cutaway: hull outline + two ballast tanks with fill
function SubCutaway({ fill = 0, valveOpen = 0, valveColor = C.steel, bubbleUp = 0, airJet = 0 }:
  { fill?: number; valveOpen?: number; valveColor?: string; bubbleUp?: number; airJet?: number }) {
  const tankY = 836, tankH = 120;
  const lvl = tankH * fill;
  const tanks = [{ x: 300 }, { x: 600 }]; // each width 180
  return (
    <g>
      {/* hull outline */}
      <rect x={220} y={812} width={620} height={176} rx={88} fill="none" stroke={C.steel} strokeWidth={8} />
      <rect x={470} y={716} width={130} height={108} rx={20} fill="none" stroke={C.steel} strokeWidth={8} />
      <line x1={535} y1={716} x2={535} y2={650} stroke={C.steel} strokeWidth={9} strokeLinecap="round" />
      {/* compressed-air spine glyph */}
      <g opacity={airJet > 0 ? 1 : 0.5}>
        <rect x={500} y={838} width={80} height={26} rx={13} fill={airJet > 0 ? C.air : C.hullSh} />
        <text x={540} y={858} textAnchor="middle" fill={airJet > 0 ? C.ink : C.air} fontSize={16} fontWeight={900} fontFamily="Poppins,sans-serif">AIR</text>
      </g>
      {tanks.map((t, i) => {
        const cx = t.x + 90;
        return (
          <g key={i}>
            <clipPath id={`tank${i}`}><rect x={t.x} y={tankY} width={180} height={tankH} rx={20} /></clipPath>
            {/* air fill (white) */}
            <rect x={t.x} y={tankY} width={180} height={tankH} rx={20} fill={C.air} opacity={0.9} />
            {/* seawater fill rising from bottom */}
            <g clipPath={`url(#tank${i})`}>
              <rect x={t.x} y={tankY + tankH - lvl} width={180} height={lvl} fill={C.sea} />
              <rect x={t.x} y={tankY + tankH - lvl} width={180} height={6} fill={C.ocean} />
            </g>
            {/* tank outline */}
            <rect x={t.x} y={tankY} width={180} height={tankH} rx={20} fill="none" stroke={C.gold} strokeWidth={5} />
            {/* bottom valve */}
            <g transform={`translate(${cx},${tankY + tankH + 6})`}>
              <rect x={-16} y={-6} width={32} height={14} rx={4} fill={valveOpen > 0 ? C.red : C.steel}
                transform={`rotate(${valveOpen * 35})`} />
            </g>
            {/* air-jet into tank (rise) */}
            {airJet > 0 && <line x1={cx} y1={tankY + 4} x2={cx} y2={tankY + 4 + airJet * 60} stroke={C.air} strokeWidth={7} opacity={0.9} />}
            {/* bubbles escaping top vent */}
            {bubbleUp > 0 && [0, 1, 2].map((k) => {
              const t2 = ((bubbleUp * 80 + k * 30) % 90) / 90;
              return <circle key={k} cx={cx - 10 + k * 10} cy={tankY - t2 * 70} r={5 - k} fill={C.air} opacity={0.7 * (1 - t2)} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function WeightGauge({ pct }: { pct: number }) {
  const ang = interpolate(pct, [0, 1], [-80, 80], clamp);
  const rad = (ang - 90) * Math.PI / 180;
  return (
    <g transform="translate(900,1180)">
      <path d="M -90,0 A 90 90 0 0 1 90,0" fill="none" stroke={C.hullSh} strokeWidth={14} />
      <text x={-92} y={28} textAnchor="middle" fill={C.air} fontSize={20} fontWeight={800} fontFamily="Poppins,sans-serif">LIGHT</text>
      <text x={92} y={28} textAnchor="middle" fill={C.red} fontSize={20} fontWeight={800} fontFamily="Poppins,sans-serif">HEAVY</text>
      <line x1={0} y1={0} x2={Math.cos(rad) * 76} y2={Math.sin(rad) * 76} stroke={C.gold} strokeWidth={8} strokeLinecap="round" />
      <circle cx={0} cy={0} r={10} fill={C.gold} />
    </g>
  );
}

const Bg = ({ abyss = 0 }: { abyss?: number }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg} 0%, ${interpMix(C.sea, C.abyss, abyss)} 60%, ${C.abyss} 100%)` }} />
);
function interpMix(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 95, mass: 0.6, stiffness: 175 } });
  const human = usePop(16);
  const badge = spring({ frame: frame - 26, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  const shimmer = interpolate((frame * 3) % 110, [0, 55, 110], [0, 1, 0], clamp);
  const waterline = interpolate(frame, [10, 40], [0, 1], clamp);
  const bob = Math.sin(frame * 0.08) * 4;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* waterline */}
          <line x1={0} y1={560} x2={1080 * waterline} y2={560} stroke={C.ocean} strokeWidth={4} opacity={0.6} />
          <g transform={`scale(${pop})`} style={{ transformOrigin: '540px 870px' }}>
            <SubExterior bob={bob} />
            {/* tiny human for scale on hull */}
            <g opacity={human} transform="translate(300,792)">
              <circle cx={0} cy={-18} r={7} fill={C.air} />
              <rect x={-5} y={-12} width={10} height={20} rx={4} fill={C.air} />
            </g>
          </g>
          {/* badge */}
          <g transform={`translate(540,470) scale(${badge})`} opacity={badge}>
            <rect x={-280} y={-46} width={560} height={92} rx={46} fill={C.gold} />
            <text x={0} y={11} textAnchor="middle" fill={C.ink} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">40,000,000 LBS — FLOATS</text>
            <rect x={-280 + 560 * shimmer} y={-46} width={60} height={92} fill="rgba(255,255,255,0.5)" opacity={shimmer} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: CHOICE ──────────────────────────────────────────────────────────
function SceneChoice() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame, fps, config: { damping: 110, mass: 0.6, stiffness: 160 } });
  const q = spring({ frame: frame - 14, fps, config: { damping: 80, mass: 0.5, stiffness: 190 } });
  const qP = 1 + 0.07 * Math.sin(frame * 0.18);
  const down = interpolate(frame, [18, 44], [0, 1], clamp);
  const up = interpolate(frame, [34, 60], [0, 1], clamp);
  const glow = 0.4 + 0.4 * Math.sin(frame * 0.15);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <marker id="aDn" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.ocean} /></marker>
            <marker id="aUp" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.air} /></marker>
          </defs>
          <g transform={`translate(${-200 * slide},0) scale(0.8)`} style={{ transformOrigin: '540px 870px' }}>
            <SubExterior />
            {/* faint chambers glowing */}
            <rect x={300} y={836} width={180} height={120} rx={20} fill="none" stroke={C.gold} strokeWidth={4} strokeDasharray="10 8" opacity={glow} />
            <rect x={600} y={836} width={180} height={120} rx={20} fill="none" stroke={C.gold} strokeWidth={4} strokeDasharray="10 8" opacity={glow} />
          </g>
          {/* ? + choice arrows */}
          <text x={760} y={900} textAnchor="middle" fill={C.gold} fontSize={200} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={q}
            transform={`translate(760,900) scale(${q * qP}) translate(-760,-900)`}>?</text>
          <path d="M 760,990 Q 920,1120 900,1320" fill="none" stroke={C.ocean} strokeWidth={6} markerEnd="url(#aDn)"
            strokeDasharray={400} strokeDashoffset={400 * (1 - down)} />
          <path d="M 760,800 Q 920,640 900,480" fill="none" stroke={C.air} strokeWidth={6} markerEnd="url(#aUp)"
            strokeDasharray={400} strokeDashoffset={400 * (1 - up)} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TANKS reveal ────────────────────────────────────────────────────
function SceneTanks() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = interpolate(frame, [6, 40], [0, 1], clamp);
  const label = spring({ frame: frame - 44, fps, config: { damping: 90, mass: 0.5, stiffness: 190 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* solid hull fading to cutaway via wipe */}
          <g opacity={1 - wipe}><SubExterior /></g>
          <g clipPath="url(#revealW)"><SubCutaway fill={0} /></g>
          <clipPath id="revealW"><rect x={120} y={600} width={840 * wipe} height={520} /></clipPath>
          {/* BALLAST TANK label */}
          <g opacity={label}>
            <line x1={390} y1={836} x2={300} y2={700} stroke={C.gold} strokeWidth={4} />
            <rect x={150} y={648} width={320} height={62} rx={31} fill={C.gold} />
            <text x={310} y={689} textAnchor="middle" fill={C.ink} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BALLAST TANK</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: DIVE (hero flood) ───────────────────────────────────────────────
function SceneDive() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const valve = spring({ frame: frame - 8, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  const fill = interpolate(frame, [24, 200], [0, 1], clamp);
  const abyssFill = interpolate(frame, [180, 280], [0, 1], clamp);
  const sink = interpolate(frame, [180, 280], [0, 120], clamp);
  const waterWipe = interpolate(frame, [190, 280], [1120, 520], clamp);
  const tonnage = Math.round(interpolate(fill, [0, 1], [0, 18000], clamp));
  return (
    <AbsoluteFill>
      <Bg abyss={abyssFill} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(0,${sink})`}>
            <SubCutaway fill={fill} valveOpen={valve} bubbleUp={fill > 0.1 && fill < 0.98 ? fill : 0} />
          </g>
          {/* descending waterline over the tower */}
          <line x1={0} y1={waterWipe} x2={1080} y2={waterWipe} stroke={C.ocean} strokeWidth={5} opacity={0.5} />
          <WeightGauge pct={fill} />
          {/* tonnage counter */}
          <g transform="translate(180,1180)">
            <rect x={-100} y={-40} width={200} height={80} rx={16} fill={C.ink} stroke={C.gold} strokeWidth={3} />
            <text x={0} y={-4} textAnchor="middle" fill={C.gold} fontSize={40} fontWeight={900} fontFamily="Poppins,sans-serif">+{tonnage}</text>
            <text x={0} y={26} textAnchor="middle" fill={C.air} fontSize={20} fontWeight={700} fontFamily="Poppins,sans-serif">TONS WATER</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: RISE (compressed air) ───────────────────────────────────────────
function SceneRise() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const airFlash = spring({ frame: frame - 6, fps, config: { damping: 70, mass: 0.5, stiffness: 220 } });
  const drain = interpolate(frame, [16, 120], [1, 0], clamp);
  const lift = interpolate(frame, [40, 150], [0, -120], clamp);
  const glow = interpolate(frame, [60, 150], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg abyss={1} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* surface glow at top */}
          <ellipse cx={540} cy={120} rx={600 * glow} ry={120 * glow} fill={C.air} opacity={0.12 * glow} />
          <g transform={`translate(0,${lift})`}>
            <SubCutaway fill={drain} airJet={airFlash} bubbleUp={0} />
            {/* expelled water jets out bottom valves */}
            {[390, 690].map((cx, k) => drain < 0.95 && (
              <g key={k}>
                {[0, 1, 2].map((j) => {
                  const t = ((frame * 4 + j * 24 + k * 12) % 70) / 70;
                  return <circle key={j} cx={cx + (k === 0 ? -1 : 1) * t * 60} cy={968 + t * 120} r={6 * (1 - t) + 2} fill={C.sea} opacity={0.7 * (1 - t)} />;
                })}
              </g>
            ))}
          </g>
          <WeightGauge pct={drain} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leftWipe = interpolate(frame, [6, 36], [0, 1], clamp);
  const rightWipe = interpolate(frame, [6, 36], [0, 1], clamp);
  const floor = interpolate(frame, [20, 60], [0, 1], clamp);
  const bob = Math.sin(frame * 0.08) * 5;
  const w1 = spring({ frame: frame - 50, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 66, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 86, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w4 = spring({ frame: frame - 102, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg abyss={0.4} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* half water / half air panels */}
          <rect x={0} y={620} width={540 * leftWipe} height={520} fill={C.sea} opacity={0.25} />
          <rect x={1080 - 540 * rightWipe} y={620} width={540 * rightWipe} height={520} fill={C.air} opacity={0.16} />
          <rect x={538} y={620} width={5} height={520} fill={C.gold} opacity={Math.min(leftWipe, rightWipe)} />
          <circle cx={250} cy={700} r={16} fill={C.sea} opacity={leftWipe} />
          <circle cx={830} cy={700} r={16} fill={C.air} opacity={rightWipe} />
          {/* surface line */}
          <line x1={0} y1={560} x2={1080} y2={560} stroke={C.ocean} strokeWidth={4} opacity={0.6} />
          <g transform={`scale(0.82)`} style={{ transformOrigin: '540px 880px' }}>
            <SubExterior bob={bob} />
          </g>
          {/* jagged seafloor */}
          <path d={`M 0,1620 L 120,1540 L 260,1610 L 420,1520 L 600,1600 L 780,1530 L 980,1605 L 1080,1545 L 1080,1700 L 0,1700 Z`}
            fill={C.hullSh} opacity={floor} />
          {/* payoff text */}
          <text x={540} y={1300} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w1} >WATER </tspan>
            <tspan fill={C.air} opacity={w2}>DOWN.</tspan>
          </text>
          <text x={540} y={1430} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={w3}>AIR </tspan>
            <tspan fill={C.air} opacity={w4}>UP.</tspan>
          </text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Submarine: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('submarine_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* ocean/submarine sound design (baked) */}
      <Sequence from={8} durationInFrames={70}><Audio src={staticFile('sfx_chime.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.dive + 20} durationInFrames={160}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.dive + 14}><Audio src={staticFile('sfx_splash_big.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.rise + 6}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.5} /></Sequence>
      <Sequence from={S.payoff + 100}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.choice - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.choice} durationInFrames={S.tanks - S.choice}><SceneChoice /></Sequence>
      <Sequence from={S.tanks} durationInFrames={S.dive - S.tanks}><SceneTanks /></Sequence>
      <Sequence from={S.dive} durationInFrames={S.rise - S.dive}><SceneDive /></Sequence>
      <Sequence from={S.rise} durationInFrames={S.payoff - S.rise}><SceneRise /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

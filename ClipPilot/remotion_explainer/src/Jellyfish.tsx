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
import jfWords from './jellyfish_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1163;

const C = {
  bg:      '#0a1018',
  abyss:   '#0d1622',
  gold:    '#FFD23F',
  jelly:   '#7FE7E0',
  glow:    '#4FC3D9',
  tent:    '#FF8FB1',
  polyp:   '#E86A5C',
  cell:    '#9D7BE8',
  stem:    '#C9B3FF',
  sand:    '#5C6B7A',
  red:     '#FF5A6E',
  ink:     '#060b12',
  white:   '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, scale: 148, collapse: 324, hero: 618, cycle: 862, payoff: 1070 };

function mix(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (jfWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
            color: active ? C.gold : '#fff', fontSize: 60, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 14px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => (
  <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 50% 40%, ${C.abyss} 0%, ${C.bg} 76%)` }}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}><Snow /></svg>
  </AbsoluteFill>
);
function Snow() {
  const f = useCurrentFrame();
  return (
    <g opacity={0.3}>
      {Array.from({ length: 24 }).map((_, i) => {
        const x = (i * 47) % 1080;
        const y = ((i * 80 + f * 0.6) % 1900);
        return <circle key={i} cx={x} cy={y} r={(i % 3) + 1} fill={C.glow} opacity={0.3} />;
      })}
    </g>
  );
}

function Jelly({ scale = 1, pulse = 0, glowHalo = 0 }: { scale?: number; pulse?: number; glowHalo?: number }) {
  const f = useCurrentFrame();
  const squash = 1 + 0.06 * Math.sin(pulse);
  return (
    <g transform={`scale(${scale})`}>
      {glowHalo > 0 && <circle cx={0} cy={-60} r={200} fill={C.jelly} opacity={0.12 * glowHalo} />}
      {/* tentacles */}
      {Array.from({ length: 9 }).map((_, k) => {
        const tx = -100 + k * 25;
        const sway = Math.sin(f * 0.08 + k) * 16;
        return <path key={k} d={`M ${tx},20 q ${sway},80 ${sway * 0.5},220 q ${-sway},60 0,140`} fill="none" stroke={C.tent} strokeWidth={4} opacity={0.7} />;
      })}
      {/* oral arms */}
      {[-40, -14, 14, 40].map((ox, k) => <path key={k} d={`M ${ox},10 q ${Math.sin(f * 0.1 + k) * 10},90 0,180`} fill="none" stroke={C.tent} strokeWidth={8} opacity={0.85} />)}
      {/* bell */}
      <g transform={`scale(${squash} ${2 - squash})`}>
        <path d="M -130,10 Q -130,-150 0,-150 Q 130,-150 130,10 Q 65,40 0,40 Q -65,40 -130,10 Z" fill={C.jelly} opacity={0.45} />
        <path d="M -130,10 Q -130,-150 0,-150 Q 130,-150 130,10" fill="none" stroke={C.gold} strokeWidth={4} opacity={0.7} />
        <ellipse cx={0} cy={-50} rx={70} ry={70} fill={C.glow} opacity={0.5} />
        <ellipse cx={-30} cy={-80} rx={24} ry={30} fill={C.white} opacity={0.35} />
      </g>
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 170 } });
  const w = ['IT', "CAN'T", 'DIE.'].map((_, k) => spring({ frame: frame - 8 - k * 12, fps, config: { damping: k === 1 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  const badge = spring({ frame: frame - 30, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const ring = interpolate(frame, [16, 60], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {ring > 0 && <circle cx={540} cy={1000} r={ring * 400} fill="none" stroke={C.gold} strokeWidth={3} opacity={(1 - ring) * 0.5} />}
          <g transform={`translate(540,1000) scale(${Math.min(1, pop)})`}><Jelly scale={1.7} pulse={frame * 0.1} glowHalo={1} /></g>
          {/* hook words */}
          <text x={540} y={460} textAnchor="middle" fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.white} opacity={w[0]}>IT </tspan><tspan fill={C.gold} opacity={w[1]}>CAN'T </tspan><tspan fill={C.white} opacity={w[2]}>DIE.</tspan>
          </text>
          {/* ? badge */}
          <g transform={`translate(760,720) scale(${badge})`} opacity={badge}>
            <circle cx={0} cy={0} r={56} fill={C.gold} />
            <text x={0} y={22} textAnchor="middle" fill={C.ink} fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SCALE ───────────────────────────────────────────────────────────
function SceneScale() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nail = interpolate(frame, [6, 40], [0, 1], clamp);
  const bracket = interpolate(frame, [30, 60], [0, 1], clamp);
  const label = spring({ frame: frame - 56, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* fingertip */}
          <g transform="translate(360,960)">
            <path d="M -120,160 Q -140,-40 -40,-120 Q 60,-180 140,-120 L 140,200 Z" fill="none" stroke={C.sand} strokeWidth={5}
              pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - nail)} />
            <path d="M -40,-120 Q 60,-180 130,-118 Q 70,-70 -10,-60 Q -50,-90 -40,-120 Z" fill={C.sand} opacity={0.3 * nail} />
          </g>
          {/* tiny jelly */}
          <g transform="translate(620,900)"><Jelly scale={0.32} pulse={frame * 0.15} glowHalo={1} /></g>
          {/* dimension bracket */}
          <g opacity={bracket}>
            <line x1={560} y1={760} x2={680} y2={760} stroke={C.gold} strokeWidth={3} />
            <line x1={560} y1={748} x2={560} y2={772} stroke={C.gold} strokeWidth={3} />
            <line x1={680} y1={748} x2={680} y2={772} stroke={C.gold} strokeWidth={3} />
          </g>
          <g transform="translate(620,680)" opacity={label}>
            <rect x={-80} y={-32} width={160} height={64} rx={16} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">~4mm</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: COLLAPSE ────────────────────────────────────────────────────────
function SceneCollapse() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icons = [0, 1, 2].map((k) => spring({ frame: frame - 10 - k * 16, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } }));
  const morph = interpolate(frame, [70, 130], [0, 1], clamp);
  const sink = interpolate(frame, [120, 240], [0, 700], clamp);
  const puff = frame > 235 ? interpolate(frame, [235, 260], [0, 1], clamp) : 0;
  const labels = [['INJURED', C.red], ['STARVING', C.glow], ['OLD', C.sand]];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* condition icons */}
          {labels.map((lb, k) => (
            <g key={k} transform={`translate(${240 + k * 300},440) scale(${icons[k]})`} opacity={icons[k] * (morph > 0.5 ? 0.4 : 1)}>
              <path d="M -50,10 Q -50,-60 0,-60 Q 50,-60 50,10 Q 25,24 0,24 Q -25,24 -50,10 Z" fill="none" stroke={lb[1] as string} strokeWidth={5} />
              <text x={0} y={70} textAnchor="middle" fill={lb[1] as string} fontSize={26} fontWeight={900} fontFamily="Poppins,sans-serif">{lb[0]}</text>
            </g>
          ))}
          {/* seafloor */}
          <path d="M 0,1620 Q 300,1560 540,1600 Q 800,1640 1080,1580 L 1080,1700 L 0,1700 Z" fill={C.sand} opacity={0.5} />
          {/* jelly morphing to blob + sinking */}
          <g transform={`translate(540,${760 + sink})`}>
            <g opacity={1 - morph}><Jelly scale={1.1} pulse={frame * 0.1} /></g>
            {morph > 0 && <ellipse cx={0} cy={0} rx={90 * morph} ry={70 * morph} fill={mix(C.jelly, C.glow, 0.5)} opacity={0.7 * morph} />}
          </g>
          {puff > 0 && [0, 1, 2, 3, 4].map((k) => {
            const a = (k * 40 - 80) * Math.PI / 180;
            return <circle key={k} cx={540 + Math.cos(a) * puff * 90} cy={1500 + Math.sin(a) * puff * 40} r={(1 - puff) * 10 + 2} fill={C.sand} opacity={(1 - puff) * 0.6} />;
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO (cell rewind) ──────────────────────────────────────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iris = spring({ frame, fps, config: { damping: 80, mass: 0.6, stiffness: 150 } });
  const dediff = interpolate(frame, [30, 150], [0, 1], clamp);
  const rewind = interpolate(frame, [20, 60], [0, 1], clamp);
  const scrub = interpolate(frame, [60, 180], [1, 0], clamp); // medusa->polyp
  const cells = Array.from({ length: 14 });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* lens */}
          <g transform={`translate(420,920) scale(${iris})`}>
            <circle cx={0} cy={0} r={300} fill={C.abyss} stroke={C.gold} strokeWidth={8} />
            <clipPath id="lensClip"><circle cx={0} cy={0} r={290} /></clipPath>
            <g clipPath="url(#lensClip)">
              {cells.map((_, k) => {
                const col = k % 4, row = Math.floor(k / 4);
                const cx = -200 + col * 130 + (row % 2) * 65;
                const cy = -180 + row * 120;
                const jitter = Math.sin(frame * 0.2 + k) * 6 * dediff;
                const fill = mix(C.cell, C.stem, dediff);
                return (
                  <g key={k} transform={`translate(${cx + jitter},${cy + jitter})`}>
                    <polygon points="0,-52 45,-26 45,26 0,52 -45,26 -45,-26" fill={fill} opacity={0.85} />
                    {dediff < 0.5 && <circle cx={0} cy={0} r={14} fill={C.ink} opacity={(0.5 - dediff) * 2} />}
                  </g>
                );
              })}
              {dediff > 0.6 && <circle cx={0} cy={0} r={290} fill={C.stem} opacity={(dediff - 0.6) * 0.3 * Math.abs(Math.sin(frame * 0.15))} />}
            </g>
          </g>
          {/* REWIND arrow */}
          <g opacity={rewind} transform="translate(420,920)">
            <path d="M 0,-340 A 340 340 0 0 1 240,240" fill="none" stroke={C.gold} strokeWidth={6}
              pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - rewind)} />
            <text x={0} y={-360} textAnchor="middle" fill={C.gold} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">◄◄ REWIND</text>
          </g>
          {/* timeline medusa->polyp */}
          <g transform="translate(900,700)">
            <g opacity={scrub}><Jelly scale={0.3} pulse={frame * 0.1} /></g>
            <g opacity={1 - scrub} transform="translate(0,40)">
              <rect x={-8} y={-40} width={16} height={120} fill={C.polyp} />
              <circle cx={0} cy={-50} r={28} fill={C.polyp} />
              {[-1, 0, 1].map((s) => <line key={s} x1={0} y1={-60} x2={s * 24} y2={-90} stroke={C.polyp} strokeWidth={4} />)}
            </g>
          </g>
          {/* butterfly -> caterpillar */}
          <g transform="translate(900,1180)">
            <g opacity={scrub} stroke={C.gold} strokeWidth={3} fill="none"><path d="M 0,0 Q -40,-30 -40,10 Q -40,40 0,10 Q 40,40 40,10 Q 40,-30 0,0 Z" /></g>
            <g opacity={1 - scrub}>{[0, 1, 2, 3].map((k) => <circle key={k} cx={-30 + k * 20} cy={0} r={12} fill={C.gold} opacity={0.8} />)}</g>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: CYCLE ───────────────────────────────────────────────────────────
function SceneCycle() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodes = [['POLYP', -90], ['JUVENILE', 0], ['ADULT', 90], ['COLLAPSE', 180]];
  const nodePop = (k: number) => spring({ frame: frame - 10 - k * 10, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const tracer = ((frame * 4) % 360);
  const cx = 540, cy = 920, r = 300;
  const trAng = (tracer - 90) * Math.PI / 180;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.5} />
          {/* infinity hint */}
          <text x={cx} y={cy + 18} textAnchor="middle" fill={C.gold} fontSize={80} fontWeight={900} fontFamily="Poppins,sans-serif" opacity={0.25}>∞</text>
          {/* nodes */}
          {nodes.map((n, k) => {
            const a = ((n[1] as number) - 90) * Math.PI / 180;
            const nx = cx + Math.cos(a) * r, ny = cy + Math.sin(a) * r;
            const near = Math.abs(((tracer - 90) - (n[1] as number) + 360) % 360) < 30;
            return (
              <g key={k} transform={`translate(${nx},${ny}) scale(${nodePop(k)})`} opacity={nodePop(k)}>
                <circle cx={0} cy={0} r={near ? 28 : 22} fill={k < 2 ? C.polyp : C.jelly} />
                <text x={0} y={56} textAnchor="middle" fill={C.gold} fontSize={24} fontWeight={900} fontFamily="Poppins,sans-serif">{n[0]}</text>
              </g>
            );
          })}
          {/* tracer */}
          <circle cx={cx + Math.cos(trAng) * r} cy={cy + Math.sin(trAng) * r} r={12} fill={C.white} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ['IT', 'NEVER', 'TRULY', 'DIES'];
  const ws = words.map((_, k) => spring({ frame: frame - 14 - k * 12, fps, config: { damping: k === 1 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  const inf = interpolate(frame, [50, 90], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540,1100)"><Jelly scale={1.5} pulse={frame * 0.12} glowHalo={1} /></g>
          <text x={540} y={560} textAnchor="middle" fontSize={100} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.white} opacity={ws[0]}>IT </tspan><tspan fill={C.gold} opacity={ws[1]}>NEVER</tspan>
          </text>
          <text x={540} y={690} textAnchor="middle" fontSize={100} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.white} opacity={ws[2]}>TRULY </tspan><tspan fill={C.white} opacity={ws[3]}>DIES</tspan>
          </text>
          <text x={540} y={820} textAnchor="middle" fill={C.gold} fontSize={90} fontWeight={900} fontFamily="Poppins,sans-serif" opacity={inf}>∞</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Jellyfish: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('jellyfish_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* underwater/bio sound design (baked) */}
      <Sequence from={S.hook + 4} durationInFrames={60}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.28} /></Sequence>
      <Sequence from={S.hook + 8}><Audio src={staticFile('sfx_chime.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.scale + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.collapse + 30} durationInFrames={80}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.collapse + 236}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.hero + 20} durationInFrames={90}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.4} /></Sequence>
      <Sequence from={S.hero + 40} durationInFrames={80}><Audio src={staticFile('sfx_digital.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.cycle + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.payoff + 26}><Audio src={staticFile('sfx_success.wav')} volume={0.48} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.scale - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.scale} durationInFrames={S.collapse - S.scale}><SceneScale /></Sequence>
      <Sequence from={S.collapse} durationInFrames={S.hero - S.collapse}><SceneCollapse /></Sequence>
      <Sequence from={S.hero} durationInFrames={S.cycle - S.hero}><SceneHero /></Sequence>
      <Sequence from={S.cycle} durationInFrames={S.payoff - S.cycle}><SceneCycle /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

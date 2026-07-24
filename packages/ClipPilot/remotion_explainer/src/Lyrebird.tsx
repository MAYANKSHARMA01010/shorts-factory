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
import lbWords from './lyrebird_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1145;

const C = {
  bg:      '#0c1410',
  forest:  '#11201a',
  gold:    '#FFD23F',
  bird:    '#C8763C',
  leaf:    '#3FA66A',
  cyan:    '#46D5E0',
  red:     '#E5544B',
  grey:    '#9AA7B0',
  cream:   '#F2E9D8',
  ink:     '#070d0a',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, birds: 162, machines: 386, identical: 546, mixtape: 695, payoff: 904 };

function wavePath(x0: number, x1: number, y: number, amp: number, n: number, jag = 1) {
  let d = `M ${x0},${y}`;
  const step = (x1 - x0) / n;
  for (let i = 1; i <= n; i++) {
    const x = x0 + i * step;
    const yy = y + (i % 2 ? -amp : amp) * (jag === 1 ? 1 : (0.5 + 0.5 * Math.sin(i)));
    d += ` L ${x.toFixed(1)},${yy.toFixed(1)}`;
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
const WRAW: { w: string; s: number }[] = (lbWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 36%, ${C.forest} 0%, ${C.bg} 74%)` }} />;

function Bird({ scale = 1, fan = 1, beak = 0 }: { scale?: number; fan?: number; beak?: number }) {
  const f = useCurrentFrame();
  return (
    <g transform={`scale(${scale})`}>
      {/* lyre tail behind */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={`M 0,40 Q ${s * 60 * fan},-120 ${s * 150 * fan},-260 Q ${s * 220 * fan},-360 ${s * 130 * fan},-420`}
            fill="none" stroke={C.bird} strokeWidth={16} strokeLinecap="round" opacity={0.9} />
          {[0, 1, 2, 3, 4].map((k) => (
            <line key={k} x1={s * (40 + k * 22) * fan} y1={-80 - k * 60} x2={s * (70 + k * 30) * fan} y2={-90 - k * 60}
              stroke={C.cyan} strokeWidth={3} opacity={0.4} />
          ))}
        </g>
      ))}
      {/* body */}
      <ellipse cx={0} cy={20} rx={70} ry={90} fill={C.bird} />
      <ellipse cx={0} cy={20} rx={70} ry={90} fill={C.ink} opacity={0.12} />
      {/* legs */}
      <line x1={-18} y1={100} x2={-18} y2={150} stroke={C.grey} strokeWidth={5} />
      <line x1={18} y1={100} x2={18} y2={150} stroke={C.grey} strokeWidth={5} />
      {/* head */}
      <circle cx={36} cy={-50} r={36} fill={C.bird} />
      <circle cx={48} cy={-58} r={7} fill={C.ink} />
      {/* beak open */}
      <path d={`M 66,-52 L 130,${-58 - beak * 14} L 70,-44 Z`} fill={C.gold} />
      <path d={`M 66,-44 L 128,${-40 + beak * 14} L 70,-38 Z`} fill="#d9a23a" />
    </g>
  );
}

const SoundWave = ({ x, y, amp, len, color, draw = 1, n = 14 }: { x: number; y: number; amp: number; len: number; color: string; draw?: number; n?: number }) => (
  <path d={wavePath(x, x + len, y, amp, n)} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round"
    pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
);

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const fan = interpolate(frame, [8, 40], [0.2, 1], clamp);
  const badge = spring({ frame: frame - 20, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const wave = interpolate(frame, [30, 60], [0, 1], clamp);
  const beak = 0.5 + 0.5 * Math.sin(frame * 0.2);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* eucalyptus */}
          <path d="M 80,1920 Q 100,1200 60,700" fill="none" stroke={C.leaf} strokeWidth={6} opacity={0.2} />
          <path d="M 1000,1920 Q 980,1200 1020,700" fill="none" stroke={C.leaf} strokeWidth={6} opacity={0.2} />
          <g transform={`translate(480,1080) scale(${Math.min(1, pop) * 1.6})`}><Bird fan={fan} beak={beak} /></g>
          {/* cyan soundwave from beak */}
          <g opacity={wave}><SoundWave x={700} y={920} amp={26} len={300} color={C.cyan} draw={wave} /></g>
          {/* badge */}
          <g transform={`translate(540,420) scale(${badge})`} opacity={badge}>
            <rect x={-280} y={-50} width={560} height={100} rx={26} fill={C.gold} />
            <text x={-26} y={14} textAnchor="middle" fill={C.ink} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">COPIES ANY SOUND</text>
            <circle cx={232} cy={0} r={40} fill={C.ink} transform={`rotate(${frame * 6} 232 0)`} />
            <text x={232} y={14} textAnchor="middle" fill={C.gold} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: BIRDS (timeline) ────────────────────────────────────────────────
function SceneBirds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.min(12, Math.floor(interpolate(frame, [16, 100], [0, 12], clamp)));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(250,1300) scale(0.7)"><Bird fan={0.7} beak={0.6 + 0.4 * Math.sin(frame * 0.3)} /></g>
          {/* ribbon timeline */}
          <line x1={120} y1={860} x2={1000} y2={860} stroke={C.cyan} strokeWidth={3} opacity={0.3} />
          {Array.from({ length: 12 }).map((_, k) => {
            if (k >= count) return null;
            const bx = 160 + k * 72;
            const col = k % 2 ? C.leaf : C.cyan;
            const pop = spring({ frame: frame - 16 - k * 7, fps, config: { damping: 45, mass: 0.5, stiffness: 220 } });
            return (
              <g key={k} transform={`translate(${bx},${800 + (k % 2) * 60}) scale(${pop})`}>
                <circle cx={0} cy={0} r={28} fill={col} opacity={0.85} />
                {/* tiny bird head silhouette */}
                <circle cx={4} cy={-4} r={12} fill={C.ink} opacity={0.5} />
                <path d="M 14,-6 L 26,-2 L 14,2 Z" fill={C.ink} opacity={0.5} />
              </g>
            );
          })}
          {/* counter */}
          <g transform="translate(840,520)">
            <rect x={-100} y={-36} width={200} height={72} rx={16} fill={C.ink} stroke={C.gold} strokeWidth={3} />
            <text x={0} y={12} textAnchor="middle" fill={C.gold} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{count} CALLS</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: MACHINES ────────────────────────────────────────────────────────
function SceneMachines() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pops = [0, 1, 2].map((k) => spring({ frame: frame - 10 - k * 18, fps, config: { damping: 45, mass: 0.5, stiffness: 220 } }));
  const tag = spring({ frame: frame - 70, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* camera */}
          <g transform={`translate(280,780) scale(${pops[0]})`}>
            <rect x={-70} y={-50} width={140} height={100} rx={12} fill={C.grey} />
            <circle cx={0} cy={0} r={34} fill={C.ink} stroke={C.gold} strokeWidth={5} />
            <g opacity={pops[0]}><SoundWave x={-60} y={120} amp={18} len={120} color={C.grey} draw={pops[0]} /></g>
            <text x={0} y={200} textAnchor="middle" fill={C.grey} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">SHUTTER</text>
          </g>
          {/* car */}
          <g transform={`translate(560,780) scale(${pops[1]})`}>
            <path d="M -70,30 L -50,-20 L 50,-20 L 70,30 Z" fill={C.grey} />
            <circle cx={-40} cy={36} r={16} fill={C.ink} /><circle cx={40} cy={36} r={16} fill={C.ink} />
            {[40, 70, 100].map((r, k) => <path key={k} d={`M ${r},-60 A ${r} ${r} 0 0 1 ${r * 0.7},${-r * 0.7}`} fill="none" stroke={C.red} strokeWidth={5} opacity={pops[1] * (1 - k * 0.2)} transform="translate(0,-20)" />)}
            <text x={0} y={200} textAnchor="middle" fill={C.red} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">CAR ALARM</text>
          </g>
          {/* chainsaw */}
          <g transform={`translate(840,780) scale(${pops[2]})`}>
            <rect x={-70} y={-20} width={70} height={44} rx={10} fill={C.bird} />
            <rect x={0} y={-12} width={90} height={24} rx={4} fill={C.grey} />
            {Array.from({ length: 10 }).map((_, k) => <path key={k} d={`M ${k * 9},-12 l 4,-8 l 4,8`} fill={C.grey} />)}
            <g opacity={pops[2]}><SoundWave x={-60} y={120} amp={26} len={120} color={C.red} draw={pops[2]} n={20} /></g>
            <text x={0} y={200} textAnchor="middle" fill={C.red} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">CHAINSAW</text>
          </g>
          {/* NONE ARE REAL */}
          <g transform="translate(540,1180)" opacity={tag}>
            <rect x={-170} y={-36} width={340} height={72} rx={36} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NONE ARE REAL</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: IDENTICAL (hero) ────────────────────────────────────────────────
function SceneIdentical() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = interpolate(frame, [4, 30], [0, 1], clamp);
  const draw = interpolate(frame, [20, 70], [0, 1], clamp);
  const scan = interpolate(frame, [60, 100], [400, 1300], clamp);
  const merge = interpolate(frame, [90, 120], [0, 1], clamp);
  const stamp = spring({ frame: frame - 110, fps, config: { damping: 45, mass: 0.6, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* seam */}
          <line x1={540} y1={400} x2={540} y2={1300} stroke={C.gold} strokeWidth={3} opacity={0.4 * wipe} />
          {/* labels */}
          <text x={270} y={520} textAnchor="middle" fill={C.grey} fontSize={36} fontWeight={900} fontFamily="Poppins,sans-serif" opacity={wipe}>REAL CHAINSAW</text>
          <text x={810} y={520} textAnchor="middle" fill={C.gold} fontSize={36} fontWeight={900} fontFamily="Poppins,sans-serif" opacity={wipe}>LYREBIRD</text>
          {/* icons */}
          <g transform="translate(270,680)" opacity={wipe}><rect x={-50} y={-16} width={56} height={36} rx={8} fill={C.grey} /><rect x={0} y={-10} width={70} height={20} fill={C.grey} /></g>
          <g transform="translate(810,650) scale(0.5)" opacity={wipe}><Bird fan={0.8} /></g>
          {/* waveforms (slide to center on merge) */}
          <g transform={`translate(${merge * 130},0)`} opacity={1 - merge}>
            <SoundWave x={120} y={960} amp={50} len={340} color={C.grey} draw={draw} n={16} />
          </g>
          <g transform={`translate(${-merge * 130},0)`} opacity={1 - merge}>
            <SoundWave x={620} y={960} amp={50} len={340} color={C.cyan} draw={draw} n={16} />
          </g>
          {/* merged waveform */}
          {merge > 0 && <g opacity={merge}><SoundWave x={250} y={960} amp={50} len={580} color={C.cyan} draw={1} n={26} /></g>}
          {merge > 0.5 && <rect x={0} y={0} width={1080} height={1920} fill="#fff" opacity={(merge - 0.5) * 0.2 * Math.max(0, 1 - (frame - 110) / 10)} />}
          {/* scan line */}
          {frame < 105 && <line x1={120} y1={scan} x2={960} y2={scan} stroke={C.gold} strokeWidth={4} opacity={0.7} />}
          {/* IDENTICAL stamp + = */}
          <g transform={`translate(540,760) scale(${stamp})`} opacity={stamp}>
            <text x={0} y={0} textAnchor="middle" fill={C.gold} fontSize={88} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" stroke={C.ink} strokeWidth={5} paintOrder="stroke">IDENTICAL</text>
            <text x={0} y={120} textAnchor="middle" fill={C.cyan} fontSize={100} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">=</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: MIXTAPE ─────────────────────────────────────────────────────────
function SceneMixtape() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fanOpen = interpolate(frame, [6, 50], [0.4, 1.2], clamp);
  const layers = interpolate(frame, [30, 130], [0, 1], clamp);
  const female = spring({ frame: frame - 60, fps, config: { damping: 50, mass: 0.5, stiffness: 200 } });
  const bands = [C.leaf, C.cyan, C.red];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* FOREST MIXTAPE bar */}
          <text x={540} y={460} textAnchor="middle" fill={C.gold} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FOREST MIXTAPE</text>
          {bands.map((col, k) => (
            <g key={k} opacity={interpolate(layers, [k / 3, k / 3 + 0.33], [0, 1], clamp)}>
              <SoundWave x={180} y={560 + k * 70} amp={22} len={720} color={col} draw={interpolate(layers, [k / 3, k / 3 + 0.33], [0, 1], clamp)} n={20} />
            </g>
          ))}
          {/* male lyrebird */}
          <g transform="translate(440,1280) scale(1.1)"><Bird fan={fanOpen} beak={0.5 + 0.5 * Math.sin(frame * 0.3)} /></g>
          {/* sparkles */}
          {Array.from({ length: 8 }).map((_, k) => {
            const sy = 900 - ((frame * 2 + k * 40) % 300);
            return <circle key={k} cx={300 + k * 40} cy={sy} r={4} fill={C.gold} opacity={0.6} />;
          })}
          {/* female + heart */}
          <g transform={`translate(820,1320) scale(${female * 0.7})`} opacity={female}>
            <Bird fan={0.3} />
            <text x={0} y={-460} textAnchor="middle" fontSize={50}>💛</text>
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
  const ghost = interpolate(frame, [10, 70], [0, 1], clamp);
  const flicker = frame > 130 ? interpolate(frame, [130, 150], [1, 0], clamp) : 1;
  const words = ['ONE', 'BIRD.', 'A', 'WHOLE', 'WORKSITE.'];
  const ws = words.map((_, k) => spring({ frame: frame - 70 - k * 11, fps, config: { damping: k === 4 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* ghost construction */}
          <g opacity={ghost * flicker * 0.5} stroke={C.gold} strokeWidth={3} fill="none">
            {/* crane */}
            <line x1={300} y1={700} x2={300} y2={300} /><line x1={300} y1={320} x2={600} y2={320} /><line x1={560} y1={320} x2={560} y2={400} />
            {/* scaffold */}
            <rect x={680} y={400} width={160} height={300} /><line x1={680} y1={500} x2={840} y2={500} /><line x1={760} y1={400} x2={760} y2={700} />
            {/* hard hat */}
            <path d="M 420,640 a 50 40 0 0 1 100 0 Z" /><line x1={400} y1={640} x2={540} y2={640} />
            {/* connector lines from beak */}
            <line x1={540} y1={1180} x2={300} y2={700} opacity={0.4} /><line x1={540} y1={1180} x2={760} y2={700} opacity={0.4} />
          </g>
          {/* lyrebird */}
          <g transform="translate(540,1340) scale(0.7)"><Bird fan={0.7} beak={0.8} /></g>
          {/* payoff */}
          <text x={540} y={900} textAnchor="middle" fontSize={88} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.cream} opacity={ws[0]}>ONE </tspan><tspan fill={C.gold} opacity={ws[1]}>BIRD.</tspan>
          </text>
          <text x={540} y={1020} textAnchor="middle" fontSize={84} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.cream} opacity={ws[2]}>A </tspan><tspan fill={C.cream} opacity={ws[3]}>WHOLE </tspan><tspan fill={C.gold} opacity={ws[4]}>WORKSITE.</tspan>
          </text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Lyrebird: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('lyrebird_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* bird/sound/mimic sound design (baked) */}
      <Sequence from={S.hook + 6}><Audio src={staticFile('sfx_chime.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.birds + 20}><Audio src={staticFile('sfx_chime.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.machines + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.machines + 70}><Audio src={staticFile('sfx_digital.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.machines + 110}><Audio src={staticFile('sfx_smack.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.identical + 60}><Audio src={staticFile('sfx_chime.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.identical + 90}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.mixtape + 40}><Audio src={staticFile('sfx_success.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 118}><Audio src={staticFile('sfx_smack.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 150}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.birds - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.birds} durationInFrames={S.machines - S.birds}><SceneBirds /></Sequence>
      <Sequence from={S.machines} durationInFrames={S.identical - S.machines}><SceneMachines /></Sequence>
      <Sequence from={S.identical} durationInFrames={S.mixtape - S.identical}><SceneIdentical /></Sequence>
      <Sequence from={S.mixtape} durationInFrames={S.payoff - S.mixtape}><SceneMixtape /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

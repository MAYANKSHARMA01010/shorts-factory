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
import hpWords from './headphones_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1112;

const C = {
  bg:       '#0b1220',
  panel:    '#121a2b',
  bgMid:    '#16203a',
  gold:     '#FFD23F',
  cyan:     '#36E0D6',
  red:      '#FF5A52',
  violet:   '#9B6CFF',
  silence:  '#EAF2FF',
  steel:    '#5C7793',
  steelDk:  '#3c5066',
  white:    '#FFFFFF',
  ink:      '#070b14',
  spark:    '#FFE680',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, blockErase: 170, mic: 287, chip: 469, cancel: 650, payoff: 814 };

function sinePath(x0: number, x1: number, yMid: number, A: number, L: number, phase: number, steps = 72) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = yMid - A * Math.sin(((x - x0) / L) * Math.PI * 2 + phase);
    d += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return d;
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

const Bg = ({ panel = false }: { panel?: boolean }) => (
  <AbsoluteFill style={{ background: panel
    ? `radial-gradient(120% 80% at 50% 30%, ${C.panel} 0%, ${C.bg} 75%)`
    : `radial-gradient(120% 80% at 35% 25%, ${C.bgMid} 0%, ${C.bg} 65%)` }} />
);

// ─── CAPTIONS (from words.json) ───────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (hpWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
    <div style={{ position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span key={wi} style={{
            color: active ? C.gold : '#fff', fontSize: 62, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif",
            textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 15px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

// ─── Headphones SVG (reused scenes 1 + 6) ─────────────────────────────────────
function Cans({ rim = 1, halo = 0 }: { rim?: number; halo?: number }) {
  return (
    <g>
      {halo > 0 && <ellipse cx={540} cy={880} rx={360 * halo} ry={300 * halo} fill={C.cyan} opacity={0.10 * halo} />}
      <path d="M 340,880 C 340,500 740,500 740,880" fill="none" stroke={C.steel} strokeWidth={40} strokeLinecap="round" />
      {[340, 740].map((cx, i) => (
        <g key={i}>
          <ellipse cx={cx} cy={880} rx={100} ry={134} fill={C.steel} />
          <ellipse cx={cx} cy={880} rx={100} ry={134} fill={C.steelDk} opacity={0.4} />
          <ellipse cx={cx} cy={880} rx={66} ry={96} fill={C.steelDk} />
          <ellipse cx={cx} cy={880} rx={100} ry={134} fill="none" stroke={C.cyan} strokeWidth={8}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - rim)} opacity={0.85} />
        </g>
      ))}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 90, mass: 0.6, stiffness: 180 } });
  const rim = interpolate(frame, [12, 40], [0, 1], clamp);
  const badge = spring({ frame: frame - 24, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  const qP = 1 + 0.08 * Math.sin(frame * 0.18);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* turbine + red jet rings dying at the cups */}
          <g transform="translate(150,880)">
            <circle cx={0} cy={0} r={70} fill={C.steelDk} />
            <circle cx={0} cy={0} r={40} fill={C.ink} />
            {[0, 1, 2].map((k) => {
              const t = ((frame * 2.2 + k * 26) % 80) / 80; // 0..1 sweep
              const rr = interpolate(t, [0, 1], [40, 230]);
              const op = t < 0.7 ? 0.7 * (1 - t) : 0; // die before reaching cups
              return <circle key={k} cx={0} cy={0} r={rr} fill="none" stroke={C.red} strokeWidth={9} opacity={op} />;
            })}
          </g>
          <g transform={`scale(${0.82 + 0.18 * pop})`} style={{ transformOrigin: '540px 820px' }}>
            <Cans rim={rim} />
          </g>
          {/* SCREAMING? badge */}
          <g transform={`translate(770,640) scale(${badge})`} opacity={badge}>
            <rect x={-150} y={-44} width={300} height={88} rx={44} fill={C.gold} />
            <text x={-14} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">SCREAMING</text>
            <text x={120} y={14} textAnchor="middle" fill={C.ink} fontSize={52} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
              transform={`translate(120,0) scale(${qP}) translate(-120,0)`}>?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: BLOCK vs ERASE ──────────────────────────────────────────────────
function SceneBlockErase() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seam = interpolate(frame, [6, 30], [0, 1], clamp);
  const strike = interpolate(frame, [40, 62], [0, 1], clamp);
  const erase = spring({ frame: frame - 30, fps, config: { damping: 80, mass: 0.5, stiffness: 190 } });
  const arrowIn = interpolate(frame, [34, 64], [0, 1], clamp);
  const dissolve = interpolate(frame, [60, 92], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg panel />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* seam */}
          <rect x={538} y={300} width={5} height={1320 * seam} fill={C.cyan} opacity={0.8} />
          {/* LEFT: BLOCK */}
          <text x={270} y={560} textAnchor="middle" fill={C.gold} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BLOCK</text>
          <line x1={150} y1={545} x2={390} y2={545} stroke={C.red} strokeWidth={9} strokeDasharray={240} strokeDashoffset={240 * (1 - strike)} />
          {/* brick wall */}
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 3 }).map((_, c) => (
              <rect key={`${r}-${c}`} x={150 + c * 80 + (r % 2) * 20} y={680 + r * 70} width={72} height={60} rx={6} fill={C.steelDk} stroke={C.steel} strokeWidth={3} />
            ))
          )}
          {/* red arrows piling against wall */}
          {[0, 1, 2, 3].map((k) => {
            const t = interpolate(frame, [10 + k * 6, 30 + k * 6], [0, 1], clamp);
            const x = interpolate(t, [0, 1], [60, 120]);
            const jit = t > 0.9 ? Math.sin(frame * 0.8 + k) * 2 : 0;
            return <line key={k} x1={x + jit} y1={720 + k * 70} x2={x + 50} y2={720 + k * 70} stroke={C.red} strokeWidth={10} strokeLinecap="round" markerEnd="url(#aRedH)" opacity={t} />;
          })}
          {/* RIGHT: ERASE */}
          <text x={810} y={560} textAnchor="middle" fill={C.gold} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
            opacity={erase} transform={`translate(810,560) scale(${erase}) translate(-810,-560)`}>ERASE</text>
          {/* cyan earcup */}
          <ellipse cx={860} cy={900} rx={84} ry={112} fill={C.steelDk} stroke={C.cyan} strokeWidth={7} />
          <ellipse cx={860} cy={900} rx={50} ry={74} fill={C.ink} />
          {/* arrow gliding into earcup + dissolve */}
          <line x1={interpolate(arrowIn, [0, 1], [600, 770])} y1={900} x2={interpolate(arrowIn, [0, 1], [660, 800])} y2={900}
            stroke={C.red} strokeWidth={10} strokeLinecap="round" opacity={(1 - dissolve) * arrowIn} markerEnd="url(#aRedH)" />
          {dissolve > 0 && [0, 1, 2, 3, 4, 5].map((k) => {
            const ang = k * 60;
            const rad = (ang * Math.PI) / 180;
            const r = dissolve * 60;
            return <circle key={k} cx={840 + Math.cos(rad) * r} cy={900 + Math.sin(rad) * r} r={(1 - dissolve) * 7 + 2} fill={C.cyan} opacity={(1 - dissolve) * 0.8} />;
          })}
          <defs><marker id="aRedH" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.red} /></marker></defs>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: MIC ─────────────────────────────────────────────────────────────
function SceneMic() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cup = interpolate(frame, [6, 26], [0, 1], clamp);
  const tag = spring({ frame: frame - 34, fps, config: { damping: 90, mass: 0.5, stiffness: 190 } });
  const slide = (frame * 6) % 260;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* earcup shell */}
          <ellipse cx={620} cy={920} rx={240 * cup} ry={300 * cup} fill={C.steel} opacity={0.9} />
          <ellipse cx={620} cy={920} rx={170} ry={230} fill={C.steelDk} opacity={cup} />
          {/* mic capsule with cyan grille */}
          <g opacity={cup}>
            <circle cx={430} cy={760} r={52} fill={C.ink} stroke={C.cyan} strokeWidth={5} />
            {[0, 1, 2, 3].map((r) => <line key={r} x1={398} y1={742 + r * 12} x2={462} y2={742 + r * 12} stroke={C.cyan} strokeWidth={3} opacity={0.7} />)}
            {/* listening ripples */}
            {[0, 1, 2].map((k) => {
              const t = ((frame * 3 + k * 30) % 90) / 90;
              return <circle key={k} cx={430} cy={760} r={52 + t * 90} fill="none" stroke={C.cyan} strokeWidth={4} opacity={0.6 * (1 - t)} />;
            })}
          </g>
          {/* incoming red noise wave */}
          <path d={sinePath(40, 380, 760, 40, 70, (slide / 260) * Math.PI * 2)} fill="none" stroke={C.red} strokeWidth={9} strokeLinecap="round" />
          {/* MIC tag */}
          <g opacity={tag}>
            <line x1={430} y1={680} x2={430} y2={620} stroke={C.gold} strokeWidth={4} />
            <rect x={350} y={566} width={160} height={58} rx={29} fill={C.gold} />
            <text x={430} y={604} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MIC</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CHIP builds anti-wave ───────────────────────────────────────────
function SceneChip() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chipIn = spring({ frame, fps, config: { damping: 90, mass: 0.6, stiffness: 180 } });
  const redDraw = interpolate(frame, [16, 56], [0, 1], clamp);
  const antiDraw = interpolate(frame, [56, 104], [0, 1], clamp);
  const label = spring({ frame: frame - 100, fps, config: { damping: 90, mass: 0.5, stiffness: 190 } });
  const pulse = frame > 104 ? interpolate(frame, [104, 114, 130], [0, 1, 0], clamp) : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* red wave in (top), violet anti-wave out (bottom) on shared axis */}
          <line x1={80} y1={920} x2={1000} y2={920} stroke={C.steelDk} strokeWidth={2} strokeDasharray="12 10" opacity={0.5} />
          <g clipPath="url(#redClipH)">
            <path d={sinePath(80, 1000, 820, 60, 150, 0)} fill="none" stroke={C.red} strokeWidth={9} />
          </g>
          <g clipPath="url(#antiClipH)">
            <path d={sinePath(80, 1000, 1020, 60, 150, Math.PI)} fill="none" stroke={C.violet} strokeWidth={9} />
          </g>
          <clipPath id="redClipH"><rect x={80} y={700} width={920 * redDraw} height={260} /></clipPath>
          <clipPath id="antiClipH"><rect x={80} y={960} width={920 * antiDraw} height={260} /></clipPath>
          {/* chip */}
          <g transform={`translate(540,920) scale(${chipIn})`}>
            <circle cx={0} cy={0} r={150 + 30 * pulse} fill={C.violet} opacity={pulse * 0.3} />
            <rect x={-90} y={-90} width={180} height={180} rx={20} fill={C.violet} />
            <rect x={-66} y={-66} width={132} height={132} rx={10} fill={C.ink} opacity={0.6} />
            {[-60, -20, 20, 60].map((g, k) => (
              <g key={k}>
                <line x1={-90} y1={g} x2={-120} y2={g} stroke={C.gold} strokeWidth={6} />
                <line x1={90} y1={g} x2={120} y2={g} stroke={C.gold} strokeWidth={6} />
              </g>
            ))}
            {/* circuit traces lighting */}
            {[0, 1, 2].map((k) => (
              <line key={k} x1={-50} y1={-40 + k * 40} x2={50} y2={-40 + k * 40} stroke={C.cyan} strokeWidth={4}
                opacity={interpolate(frame, [30 + k * 8, 44 + k * 8], [0, 0.9], clamp)} />
            ))}
          </g>
          {/* ANTI-NOISE label */}
          <g transform="translate(540,1180)" opacity={label}>
            <rect x={-160} y={-34} width={320} height={68} rx={34} fill={C.violet} />
            <text x={0} y={12} textAnchor="middle" fill={C.white} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">ANTI-NOISE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: CANCEL (hero) ───────────────────────────────────────────────────
function SceneCancel() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const yMid = 880;
  const cancelW = interpolate(frame, [18, 92], [0, 470], clamp);
  const slam = spring({ frame: frame - 70, fps, config: { damping: 70, mass: 0.5, stiffness: 220 } });
  const linePulse = frame > 92 ? 1 + 0.04 * Math.sin(frame * 0.3) : 1;
  return (
    <AbsoluteFill>
      <Bg panel />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* red + violet waves full width, out of phase */}
          <path d={sinePath(70, 1010, yMid, 90, 160, (frame * 0.06))} fill="none" stroke={C.red} strokeWidth={11} opacity={0.95} />
          <path d={sinePath(70, 1010, yMid, 90, 160, Math.PI + (frame * 0.06))} fill="none" stroke={C.violet} strokeWidth={11} opacity={0.95} />
          {/* cancelled center region: cover waves + draw flat silence line */}
          <rect x={540 - cancelW} y={yMid - 130} width={2 * cancelW} height={260} fill={C.panel} />
          <rect x={540 - cancelW} y={yMid - 3} width={2 * cancelW} height={6 * linePulse} rx={3} fill={C.silence} />
          {/* gold sparks at the moving cancel fronts */}
          {cancelW > 4 && [540 - cancelW, 540 + cancelW].map((x, k) => (
            <g key={k}>
              <circle cx={x} cy={yMid} r={16} fill={C.spark} opacity={0.9} />
              {[0, 1, 2, 3].map((s) => {
                const ang = s * 90 + (k * 45);
                const rad = (ang * Math.PI) / 180;
                return <line key={s} x1={x} y1={yMid} x2={x + Math.cos(rad) * 28} y2={yMid + Math.sin(rad) * 28} stroke={C.spark} strokeWidth={4} opacity={0.8} />;
              })}
            </g>
          ))}
          {/* SILENCE wordmark */}
          <g transform={`translate(540,560) scale(${slam})`} opacity={slam}>
            <text x={0} y={0} textAnchor="middle" fill={C.gold} fontSize={150} fontWeight={900}
              fontFamily="Poppins,Arial Black,sans-serif" stroke={C.ink} strokeWidth={5} paintOrder="stroke">SILENCE</text>
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
  const breathe = 1 + 0.015 * Math.sin(frame * 0.08);
  const halo = interpolate(frame, [4, 40], [0, 1], clamp);
  const flat = interpolate(frame, [16, 56], [0, 1], clamp);
  const w1 = spring({ frame: frame - 60, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 78, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 96, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  const w4 = spring({ frame: frame - 114, fps, config: { damping: 80, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* ghost red noise flatlining to white */}
          <g clipPath="url(#noiseClipH)">
            <path d={sinePath(120, 960, 700, 36, 70, frame * 0.1)} fill="none" stroke={C.red} strokeWidth={7} opacity={0.5} />
          </g>
          <rect x={120 + 840 * flat} y={697} width={840 * (1 - flat)} height={6} fill={C.silence} opacity={0.8} />
          <clipPath id="noiseClipH"><rect x={120} y={620} width={840 * (1 - flat)} height={160} /></clipPath>
          <g transform={`scale(${breathe})`} style={{ transformOrigin: '540px 1000px' }}>
            <g transform="translate(0,120)"><Cans rim={1} halo={halo} /></g>
          </g>
          {/* punchline — 3 clean centered lines */}
          <text x={540} y={1410} textAnchor="middle" fontSize={78} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
            opacity={w1} transform={`translate(540,1410) scale(${w1}) translate(-540,-1410)`}>
            <tspan fill={C.silence}>It </tspan><tspan fill={C.gold}>SCREAMS</tspan>
          </text>
          <text x={540} y={1512} textAnchor="middle" fontSize={78} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
            opacity={w2} transform={`translate(540,1512) scale(${w2}) translate(-540,-1512)`}>
            <tspan fill={C.silence}>the </tspan><tspan fill={C.gold}>OPPOSITE</tspan>
          </text>
          <text x={540} y={1648} textAnchor="middle" fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
            opacity={w3} transform={`translate(540,1648) scale(${w3}) translate(-540,-1648)`}>
            <tspan fill={C.silence}>into </tspan><tspan fill={C.gold} fontSize={104}>SILENCE</tspan>
          </text>
          <rect x={270} y={1672} width={540 * w4} height={8} rx={4} fill={C.gold} opacity={w4} />
          {/* keep w4 referenced for the underline */}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Headphones: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('headphones_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* electronic/anti-noise sound design (baked) */}
      <Sequence from={S.chip + 16} durationInFrames={90}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.cancel + 68}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.payoff + 110}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.blockErase - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.blockErase} durationInFrames={S.mic - S.blockErase}><SceneBlockErase /></Sequence>
      <Sequence from={S.mic} durationInFrames={S.chip - S.mic}><SceneMic /></Sequence>
      <Sequence from={S.chip} durationInFrames={S.cancel - S.chip}><SceneChip /></Sequence>
      <Sequence from={S.cancel} durationInFrames={S.payoff - S.cancel}><SceneCancel /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

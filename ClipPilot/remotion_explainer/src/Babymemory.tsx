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
import babyWords from './babymemory_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1251;

// S2 Blueprint palette (navy grid + cyan schematic linework + gold headline)
const C = {
  navy: '#0a1a2f',
  navyDeep: '#050d1a',
  grid: '#1a3a66',
  cyan: '#39D2FF',
  cyanSoft: '#8fe4ff',
  white: '#ffffff',
  gold: '#FFD23F',
  red: '#FF5A4D',
  ink: '#0a1a2f',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// sentence-boundary scene starts (frames @30 fps) — derived from babymemory_words.json
const S = { hook: 0, yale: 211, reveal: 393, twist: 620, mechanism: 762, payoff: 1082 };

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

// Blueprint background: dark navy + faint square grid + subtle vignette
const Bg = () => (
  <AbsoluteFill style={{ backgroundColor: C.navy }}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="bpVig" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor={C.navy} stopOpacity={0} />
          <stop offset="100%" stopColor={C.navyDeep} stopOpacity={1} />
        </radialGradient>
      </defs>
      {/* grid lines */}
      {Array.from({ length: 19 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={1920} stroke={C.grid} strokeWidth={i % 5 === 0 ? 1.2 : 0.5} opacity={0.35} />
      ))}
      {Array.from({ length: 33 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 60} x2={1080} y2={i * 60} stroke={C.grid} strokeWidth={i % 5 === 0 ? 1.2 : 0.5} opacity={0.35} />
      ))}
      {/* corner tick marks */}
      {[
        [40, 40],
        [1040, 40],
        [40, 1880],
        [1040, 1880],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`} stroke={C.cyan} strokeWidth={2} opacity={0.5}>
          <line x1={-20} y1={0} x2={20} y2={0} />
          <line x1={0} y1={-20} x2={0} y2={20} />
        </g>
      ))}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#bpVig)" />
    </svg>
  </AbsoluteFill>
);

// ── CAPTIONS (root, 3-word karaoke pages; gold active per hard rule 7) ─────
const WRAW: { w: string; s: number }[] = (babyWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
    <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span
            key={wi}
            style={{
              color: active ? C.gold : C.white,
              fontSize: 86,
              fontWeight: 900,
              fontFamily: "'Poppins','Arial Black','Impact',sans-serif",
              letterSpacing: 1.5,
              transform: active ? 'scale(1.13) translateY(-3px)' : 'scale(1)',
              display: 'inline-block',
              margin: '0 14px',
              textTransform: 'uppercase',
              textShadow: '0 3px 16px rgba(0,0,0,.9)',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────
function Baby({ scale = 1, colour = C.cyan, mouth = 'happy' }: { scale?: number; colour?: string; mouth?: 'happy' | 'o' }) {
  return (
    <g transform={`scale(${scale})`} stroke={colour} strokeWidth={4} fill="none">
      {/* head */}
      <circle cx={0} cy={0} r={150} />
      {/* eyes */}
      <circle cx={-52} cy={-20} r={10} fill={colour} />
      <circle cx={52} cy={-20} r={10} fill={colour} />
      {/* mouth */}
      {mouth === 'happy' ? (
        <path d="M -40,50 Q 0,90 40,50" strokeWidth={5} />
      ) : (
        <ellipse cx={0} cy={60} rx={22} ry={28} strokeWidth={4} />
      )}
      {/* single hair curl */}
      <path d="M -30,-140 Q -20,-165 0,-160" strokeWidth={4} />
    </g>
  );
}

function BrainDiagram({ hippoOn = false, glowPct = 0 }: { hippoOn?: boolean; glowPct?: number }) {
  // schematic side-profile brain (line-art)
  return (
    <g>
      {/* brain outline */}
      <path
        d="M -280,0 Q -300,-180 -160,-240 Q -60,-290 60,-280 Q 200,-270 260,-180 Q 320,-80 300,60 Q 280,180 180,220 Q 60,260 -60,240 Q -180,220 -240,160 Q -300,80 -280,0 Z"
        fill="none"
        stroke={C.cyan}
        strokeWidth={5}
      />
      {/* sulci lines */}
      <path d="M -180,-120 Q -60,-100 40,-160" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.7} />
      <path d="M -120,-40 Q 20,-20 160,-80" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.7} />
      <path d="M -160,60 Q -40,90 140,50" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.7} />
      <path d="M -100,140 Q 40,170 200,140" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.5} />
      {/* central fissure */}
      <path d="M 0,-260 Q -10,-100 20,80 Q 40,180 60,240" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.4} />
      {/* stem hint */}
      <path d="M -20,220 Q 20,300 80,320" stroke={C.cyan} strokeWidth={4} fill="none" opacity={0.7} />

      {/* hippocampus (seahorse curl) inside */}
      <g transform="translate(-30,60)">
        {glowPct > 0 && (
          <circle cx={0} cy={0} r={70 + 30 * Math.min(1, glowPct)} fill={C.gold} opacity={0.15 * Math.min(1, glowPct)} />
        )}
        <path
          d="M -50,-20 Q -60,20 -30,40 Q 0,50 20,20 Q 40,-10 20,-30 Q 0,-40 -10,-20"
          fill={hippoOn ? C.gold : 'none'}
          stroke={hippoOn ? C.gold : C.cyan}
          strokeWidth={4}
          opacity={hippoOn ? 0.95 : 0.85}
        />
      </g>
    </g>
  );
}

// ─── SCENE 1: HOOK — "Why can't you remember being a baby?" + reveal LIE ───
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // qPop starts pre-visible so frame 0 already shows the hook (cover-frame rule).
  const qPop = interpolate(frame, [0, 8], [0.92, 1.0], clamp);
  const babyPop = interpolate(frame, [0, 12], [0.9, 1.0], clamp);
  const lie = spring({ frame: frame - 150, fps, config: { damping: 12, mass: 0.4, stiffness: 260 } });
  const brainPop = spring({ frame: frame - 90, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const brainOffLineDraw = interpolate(frame, [110, 145], [0, 1], clamp);
  const stampLine = interpolate(frame, [156, 190], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      {/* Frame-0 burned-in hero cover — OUTSIDE SceneWrap so it's fully visible on frame 0 */}
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(540,300) scale(${qPop})`} opacity={1}>
          <text x={0} y={-40} textAnchor="middle" fill={C.cyan} fontSize={54} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3}>WHY CAN'T YOU</text>
          <text x={0} y={30} textAnchor="middle" fill={C.white} fontSize={82} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3}>REMEMBER BEING</text>
          <text x={-140} y={130} textAnchor="middle" fill={C.gold} fontSize={110} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} style={{ filter: `drop-shadow(0 0 22px ${C.gold})` }}>A BABY</text>
          <text x={100} y={130} textAnchor="middle" fill={C.gold} fontSize={110} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} style={{ filter: `drop-shadow(0 0 22px ${C.gold})` }}>?</text>
        </g>
        {/* Baby silhouette centered — visible from frame 0 */}
        <g transform={`translate(540,900) scale(${1.35 * babyPop})`}>
          <Baby colour={C.cyan} scale={1} mouth="o" />
        </g>
      </svg>

      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>

          {/* brain schematic above the head (thought bubble) fading in after ~3s */}
          {frame > 80 && (
            <g transform={`translate(540,540) scale(${0.55 * brainPop})`}>
              <BrainDiagram />
              {/* dashed "OFF / NOT RECORDING" strike-through line drawing on */}
              <path
                d={`M -300,-200 L 300,200`}
                stroke={C.red}
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={700}
                strokeDashoffset={700 * (1 - brainOffLineDraw)}
                opacity={0.85}
              />
            </g>
          )}

          {/* "THAT'S A LIE" reveal after ~5s (frame 150+) — pushes the myth */}
          {frame > 150 && (
            <g transform={`translate(540,1520) scale(${lie}) rotate(-4)`}>
              <rect x={-360} y={-100} width={720} height={200} rx={18} fill="none" stroke={C.gold} strokeWidth={10} strokeDasharray={1840} strokeDashoffset={1840 * (1 - stampLine)} />
              <text x={0} y={30} textAnchor="middle" fill={C.gold} fontSize={130} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={6} style={{ filter: `drop-shadow(0 0 20px ${C.gold})` }}>THAT'S A LIE</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: YALE 2025 — scanner + baby + "1 YEAR OLD" ─────────────────────
function SceneYale() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const yearPop = spring({ frame: frame - 0, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const scannerPop = spring({ frame: frame - 16, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const babyIn = interpolate(frame, [40, 80], [420, 0], clamp);
  const scanBeam = interpolate(frame, [80, 130], [0, 1], clamp);
  const yrPop = spring({ frame: frame - 105, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.28);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* YALE 2025 big year card */}
          <g transform={`translate(540,300) scale(${yearPop})`}>
            <text x={0} y={-24} textAnchor="middle" fill={C.cyan} fontSize={64} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={6}>YALE</text>
            <text x={0} y={104} textAnchor="middle" fill={C.gold} fontSize={190} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={6} style={{ filter: `drop-shadow(0 0 24px ${C.gold})` }}>2025</text>
            <text x={0} y={168} textAnchor="middle" fill={C.cyanSoft} fontSize={32} fontWeight={800} fontFamily="'Poppins','Arial Black',sans-serif" letterSpacing={2}>Turk-Browne et al. · Science</text>
          </g>

          {/* Schematic fMRI scanner tube */}
          <g transform={`translate(540,1120) scale(${scannerPop})`}>
            {/* main donut */}
            <ellipse cx={0} cy={0} rx={340} ry={190} fill="none" stroke={C.cyan} strokeWidth={7} />
            <ellipse cx={0} cy={0} rx={230} ry={130} fill={C.navyDeep} stroke={C.cyan} strokeWidth={5} />
            {/* platform / bed */}
            <rect x={-450} y={130} width={900} height={40} rx={8} fill="none" stroke={C.cyan} strokeWidth={5} />
            <rect x={-450} y={170} width={900} height={30} fill="none" stroke={C.cyan} strokeWidth={3} opacity={0.6} />
            {/* MRI ticks */}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={i} x1={-330 + i * 60} y1={-30} x2={-330 + i * 60} y2={30} stroke={C.cyan} strokeWidth={2} opacity={0.5} />
            ))}
            {/* pulse indicator */}
            <circle cx={310} cy={-160} r={12} fill={C.gold} opacity={0.6 + 0.4 * pulse} />
            <text x={310} y={-190} textAnchor="middle" fill={C.cyan} fontSize={18} fontWeight={800} fontFamily="'Poppins',monospace">fMRI</text>
          </g>

          {/* Baby sliding into scanner */}
          {frame > 40 && (
            <g transform={`translate(${540 - babyIn},1180) scale(0.5)`}>
              <Baby colour={C.cyanSoft} mouth="happy" />
            </g>
          )}

          {/* Scan-beam sweeps across */}
          {frame > 80 && (
            <g transform="translate(540,1120)">
              <rect x={-230} y={-130} width={460 * scanBeam} height={260} fill={C.gold} opacity={0.18} />
              <line x1={-230 + 460 * scanBeam} y1={-130} x2={-230 + 460 * scanBeam} y2={130} stroke={C.gold} strokeWidth={4} opacity={0.9} />
            </g>
          )}

          {/* "1 YEAR OLD" callout */}
          {frame > 100 && (
            <g transform={`translate(540,1560) scale(${yrPop})`}>
              <rect x={-260} y={-70} width={520} height={140} rx={16} fill={C.navyDeep} stroke={C.gold} strokeWidth={6} />
              <text x={0} y={30} textAnchor="middle" fill={C.gold} fontSize={90} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={4}>1 YEAR OLD</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: HERO REVEAL — familiar face → hippocampus lights up ──────────
function SceneReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const facePop = spring({ frame: frame - 0, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const brainPop = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const hippoGlow = interpolate(frame, [70, 130], [0, 1], clamp);
  const hippoOn = frame > 75;
  const arrowDraw = interpolate(frame, [110, 150], [0, 1], clamp);
  const labelPop = spring({ frame: frame - 130, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const adultsPop = spring({ frame: frame - 175, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Familiar face on the left — a photo-frame schematic */}
          <g transform={`translate(280,540) scale(${facePop})`}>
            <rect x={-140} y={-170} width={280} height={340} rx={12} fill="none" stroke={C.cyan} strokeWidth={6} />
            {/* silhouette face */}
            <circle cx={0} cy={-30} r={70} fill="none" stroke={C.cyanSoft} strokeWidth={4} />
            <path d="M -100,120 Q 0,40 100,120" fill="none" stroke={C.cyanSoft} strokeWidth={4} />
            <text x={0} y={200} textAnchor="middle" fill={C.cyanSoft} fontSize={26} fontWeight={800} fontFamily="'Poppins',monospace" letterSpacing={2}>MUM · DAD</text>
          </g>

          {/* Arrow → brain */}
          {frame > 100 && (
            <g>
              <path
                d="M 460,540 Q 640,540 780,540"
                fill="none"
                stroke={C.gold}
                strokeWidth={7}
                strokeDasharray={340}
                strokeDashoffset={340 * (1 - arrowDraw)}
              />
              {arrowDraw > 0.95 && (
                <path d="M 770,520 L 800,540 L 770,560 Z" fill={C.gold} />
              )}
            </g>
          )}

          {/* Brain diagram (large center-right) */}
          <g transform={`translate(700,540) scale(${0.7 * brainPop})`}>
            <BrainDiagram hippoOn={hippoOn} glowPct={hippoGlow} />
          </g>

          {/* HIPPOCAMPUS gold label */}
          {frame > 130 && (
            <g transform={`translate(540,1100) scale(${labelPop})`}>
              <rect x={-320} y={-70} width={640} height={140} rx={16} fill={C.navyDeep} stroke={C.gold} strokeWidth={6} />
              <text x={0} y={30} textAnchor="middle" fill={C.gold} fontSize={92} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} style={{ filter: `drop-shadow(0 0 16px ${C.gold})` }}>HIPPOCAMPUS</text>
            </g>
          )}

          {/* "SAME REGION ADULTS USE" — two silhouettes with matching glow */}
          {frame > 175 && (
            <g transform={`translate(540,1520) scale(${adultsPop})`}>
              {/* baby head */}
              <g transform="translate(-260,0)">
                <Baby colour={C.cyanSoft} scale={0.55} mouth="happy" />
                <circle cx={-10} cy={30} r={20} fill={C.gold} opacity={0.9} style={{ filter: `drop-shadow(0 0 12px ${C.gold})` }} />
                <text x={0} y={200} textAnchor="middle" fill={C.cyan} fontSize={38} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif">BABY</text>
              </g>
              {/* equals */}
              <text x={0} y={-10} textAnchor="middle" fill={C.gold} fontSize={130} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif">=</text>
              {/* adult head (larger circle) */}
              <g transform="translate(260,0)">
                <circle cx={0} cy={-10} r={95} fill="none" stroke={C.cyan} strokeWidth={4} />
                <circle cx={-32} cy={-30} r={7} fill={C.cyan} />
                <circle cx={32} cy={-30} r={7} fill={C.cyan} />
                <path d="M -25,20 Q 0,35 25,20" stroke={C.cyan} strokeWidth={4} fill="none" />
                <circle cx={-10} cy={20} r={20} fill={C.gold} opacity={0.9} style={{ filter: `drop-shadow(0 0 12px ${C.gold})` }} />
                <text x={0} y={200} textAnchor="middle" fill={C.cyan} fontSize={38} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif">ADULT</text>
              </g>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: TWIST — memories ARE there · can't retrieve them ─────────────
function SceneTwist() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cabinetPop = spring({ frame: frame - 0, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const drawerSlide = interpolate(frame, [10, 40], [0, 1], clamp);
  const foldersPop = (i: number) => spring({ frame: frame - (30 + i * 6), fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const lockPop = spring({ frame: frame - 70, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const shakeX = frame > 90 ? Math.sin(frame * 0.9) * 6 : 0;
  const pulse = 0.6 + 0.4 * Math.sin(frame * 0.32);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Big label at top */}
          <g transform="translate(540,240)">
            <text x={0} y={0} textAnchor="middle" fill={C.gold} fontSize={78} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} style={{ filter: `drop-shadow(0 0 16px ${C.gold})` }}>MEMORY IS IN THERE</text>
          </g>

          {/* Filing cabinet */}
          <g transform={`translate(${540 + shakeX},1080) scale(${cabinetPop})`}>
            <rect x={-340} y={-380} width={680} height={760} rx={10} fill={C.navyDeep} stroke={C.cyan} strokeWidth={6} />
            {/* three drawers */}
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={-320} y={-360 + i * 250} width={640} height={230} rx={6} fill="none" stroke={C.cyan} strokeWidth={4} opacity={0.7} />
                <rect x={-40} y={-260 + i * 250} width={80} height={20} fill={C.cyan} opacity={0.6} />
              </g>
            ))}
            {/* Top drawer open, folders coming out */}
            <g transform={`translate(0,${-360 + drawerSlide * -20})`}>
              {/* folders */}
              {[0, 1, 2, 3, 4].map((i) => {
                const p = foldersPop(i);
                if (p < 0.02) return null;
                return (
                  <g key={i} transform={`translate(${-180 + i * 90},${-40 * p})`}>
                    <rect x={-38} y={-70} width={76} height={100} rx={4} fill={C.cyan} stroke={C.gold} strokeWidth={3} opacity={0.9 * p} />
                    <rect x={-38} y={-70} width={40} height={14} fill={C.gold} opacity={p} />
                  </g>
                );
              })}
            </g>
          </g>

          {/* Lock + "CAN'T RETRIEVE" overlay after ~2s */}
          {frame > 70 && (
            <g transform={`translate(540,1580) scale(${lockPop})`}>
              <g transform="translate(-180,0)">
                {/* padlock */}
                <path d="M -50,-40 Q -50,-90 0,-90 Q 50,-90 50,-40 L 50,-10 L -50,-10 Z" fill="none" stroke={C.red} strokeWidth={7} />
                <rect x={-60} y={-10} width={120} height={90} rx={10} fill={C.navyDeep} stroke={C.red} strokeWidth={6} opacity={0.9 + 0.1 * pulse} />
                <circle cx={0} cy={30} r={14} fill={C.red} />
                <rect x={-6} y={30} width={12} height={30} fill={C.red} />
              </g>
              <text x={140} y={20} textAnchor="middle" fill={C.red} fontSize={78} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={2} style={{ filter: `drop-shadow(0 0 12px rgba(255,90,77,0.7))` }}>CAN'T RETRIEVE</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: MECHANISM — neurons overwrite · hard-drive index rewriting ──
function SceneMechanism() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const whyPop = spring({ frame: frame - 0, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const neuronsPop = (i: number) => spring({ frame: frame - (20 + i * 4), fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const pathDraw = interpolate(frame, [45, 100], [0, 1], clamp);
  const overwriteDraw = interpolate(frame, [110, 190], [0, 1], clamp);
  const hddPop = spring({ frame: frame - 210, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const indexSwap = interpolate(frame, [235, 305], [0, 1], clamp);

  // deterministic pseudo-random positions
  const rng = (seed: number) => {
    const v = Math.sin(seed) * 10000;
    return v - Math.floor(v);
  };
  const neurons = Array.from({ length: 26 }).map((_, i) => ({
    x: (rng(i * 3.9) - 0.5) * 800,
    y: (rng(i * 5.7) - 0.5) * 520,
    r: 6 + rng(i * 7.3) * 8,
  }));

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* "WHY?" big at top */}
          <g transform={`translate(540,220) scale(${whyPop})`}>
            <text x={0} y={0} textAnchor="middle" fill={C.gold} fontSize={180} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={6} style={{ filter: `drop-shadow(0 0 24px ${C.gold})` }}>WHY?</text>
          </g>

          {/* Upper block: brain schematic + neurons growing + memory path being overwritten */}
          <g transform="translate(540,700)">
            {/* brain outline */}
            <g transform="scale(0.65)">
              <BrainDiagram />
            </g>
            {/* the ORIGINAL memory path (drawn early) */}
            <path
              d="M -180,-80 Q -80,-40 -20,20 Q 40,80 140,60"
              fill="none"
              stroke={C.gold}
              strokeWidth={6}
              strokeDasharray={520}
              strokeDashoffset={520 * (1 - pathDraw)}
              opacity={0.9}
            />
            {/* neurons popping onto the brain */}
            {neurons.map((n, i) => {
              const p = neuronsPop(i);
              if (p < 0.02) return null;
              return (
                <g key={i} transform={`translate(${n.x},${n.y}) scale(${p})`}>
                  <circle cx={0} cy={0} r={n.r} fill={C.cyan} opacity={0.85} />
                  {/* axons */}
                  <line x1={0} y1={0} x2={n.r * 2.5} y2={n.r * 0.8} stroke={C.cyan} strokeWidth={2} opacity={0.6} />
                  <line x1={0} y1={0} x2={-n.r * 2.2} y2={-n.r * 1.1} stroke={C.cyan} strokeWidth={2} opacity={0.6} />
                </g>
              );
            })}
            {/* overwrite: cyan overwrites the gold path */}
            <path
              d="M -180,-80 Q -80,-40 -20,20 Q 40,80 140,60"
              fill="none"
              stroke={C.cyan}
              strokeWidth={8}
              strokeDasharray={520}
              strokeDashoffset={520 * (1 - overwriteDraw)}
              opacity={0.95}
            />
          </g>

          {/* Lower block: hard drive analogy */}
          {frame > 205 && (
            <g transform={`translate(540,1420) scale(${hddPop})`}>
              {/* hdd chassis */}
              <rect x={-320} y={-180} width={640} height={360} rx={22} fill={C.navyDeep} stroke={C.cyan} strokeWidth={6} />
              {/* platter */}
              <circle cx={-120} cy={0} r={130} fill="none" stroke={C.cyan} strokeWidth={5} />
              <circle cx={-120} cy={0} r={90} fill="none" stroke={C.cyan} strokeWidth={2} opacity={0.5} />
              <circle cx={-120} cy={0} r={50} fill="none" stroke={C.cyan} strokeWidth={2} opacity={0.5} />
              <circle cx={-120} cy={0} r={16} fill={C.cyan} />
              {/* rotating head arm */}
              <g transform={`translate(60,-130) rotate(${(-20 + indexSwap * 40).toFixed(2)})`}>
                <rect x={0} y={-8} width={200} height={16} rx={4} fill={C.cyan} opacity={0.85} />
                <circle cx={0} cy={0} r={12} fill={C.cyan} />
              </g>
              {/* index label */}
              <g transform="translate(160,20)">
                <text x={0} y={-30} textAnchor="middle" fill={C.cyanSoft} fontSize={30} fontWeight={800} fontFamily="'Poppins',monospace" letterSpacing={2}>INDEX</text>
                <rect x={-70} y={0} width={140} height={40} rx={6} fill="none" stroke={C.gold} strokeWidth={3} />
                {/* old text fading out, new fading in */}
                <text x={0} y={32} textAnchor="middle" fill={C.gold} fontSize={30} fontWeight={900} fontFamily="'Poppins',monospace" opacity={1 - indexSwap}>0xB4B7</text>
                <text x={0} y={32} textAnchor="middle" fill={C.red} fontSize={30} fontWeight={900} fontFamily="'Poppins',monospace" opacity={indexSwap}>???????</text>
              </g>
              <text x={0} y={230} textAnchor="middle" fill={C.cyan} fontSize={32} fontWeight={800} fontFamily="'Poppins',monospace" letterSpacing={2}>REWRITES ITS OWN INDEX</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — word-by-word slam ───────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brainPop = spring({ frame: frame - 0, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const w1 = spring({ frame: frame - 8, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w2 = spring({ frame: frame - 24, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w3 = spring({ frame: frame - 42, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w4 = spring({ frame: frame - 62, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const glow = 0.6 + 0.4 * Math.sin(frame * 0.24);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Background brain, faint, glowing */}
          <g transform={`translate(540,1200) scale(${1.7 * brainPop})`} opacity={0.8}>
            <BrainDiagram hippoOn glowPct={glow} />
          </g>

          {/* Payoff word slam — vertically spaced so lines don't collide */}
          <g transform="translate(540,440)">
            {w1 > 0.01 && (
              <text x={0} y={-150} textAnchor="middle" fill={C.white} fontSize={88} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} transform={`scale(${w1})`} style={{ filter: `drop-shadow(0 4px 22px rgba(0,0,0,0.9))` }}>BABIES DON'T</text>
            )}
            {w2 > 0.01 && (
              <text x={0} y={20} textAnchor="middle" fill={C.gold} fontSize={190} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={6} transform={`scale(${w2})`} style={{ filter: `drop-shadow(0 0 26px ${C.gold})` }}>FORGET</text>
            )}
            {w3 > 0.01 && (
              <text x={0} y={200} textAnchor="middle" fill={C.cyanSoft} fontSize={66} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} transform={`scale(${w3})`}>ADULTS JUST</text>
            )}
            {w4 > 0.01 && (
              <text x={0} y={370} textAnchor="middle" fill={C.gold} fontSize={92} fontWeight={900} fontFamily="'Anton','Impact','Arial Black',sans-serif" letterSpacing={3} transform={`scale(${w4})`} style={{ filter: `drop-shadow(0 0 22px ${C.gold})` }}>CAN'T FIND THE FILE</text>
            )}
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────
export const Babymemory: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      <Audio src={staticFile('babymemory_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.10} />

      {/* baked scene-matched SFX (topic: brain / discovery / memory-file) */}
      <Sequence from={S.hook + 0}><Audio src={staticFile('sfx_plip.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.hook + 90}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.hook + 150}><Audio src={staticFile('sfx_smack.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.hook + 158}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.yale + 0}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.5} /></Sequence>
      <Sequence from={S.yale + 40}><Audio src={staticFile('sfx_digital.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.yale + 100}><Audio src={staticFile('sfx_click.wav')} volume={0.55} /></Sequence>

      <Sequence from={S.reveal + 0}><Audio src={staticFile('sfx_glass.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.reveal + 70}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.55} /></Sequence>
      <Sequence from={S.reveal + 130}><Audio src={staticFile('sfx_chime.wav')} volume={0.55} /></Sequence>

      <Sequence from={S.twist + 0}><Audio src={staticFile('sfx_click.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.twist + 30}><Audio src={staticFile('sfx_plip.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.twist + 70}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.45} /></Sequence>

      <Sequence from={S.mechanism + 0}><Audio src={staticFile('sfx_smack.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.mechanism + 20}><Audio src={staticFile('sfx_boing.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.mechanism + 110}><Audio src={staticFile('sfx_digital.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.mechanism + 210}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.mechanism + 240}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.35} /></Sequence>

      <Sequence from={S.payoff + 8}><Audio src={staticFile('sfx_smack.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.payoff + 24}><Audio src={staticFile('sfx_smack.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.payoff + 62}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.65} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.yale - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.yale} durationInFrames={S.reveal - S.yale}><SceneYale /></Sequence>
      <Sequence from={S.reveal} durationInFrames={S.twist - S.reveal}><SceneReveal /></Sequence>
      <Sequence from={S.twist} durationInFrames={S.mechanism - S.twist}><SceneTwist /></Sequence>
      <Sequence from={S.mechanism} durationInFrames={S.payoff - S.mechanism}><SceneMechanism /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

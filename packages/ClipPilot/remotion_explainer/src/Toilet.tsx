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

export const FPS = 30;
export const DURATION_IN_FRAMES = 1025;

const C = {
  bg:        '#0a1426',
  bgMid:     '#10223f',
  accent:    '#FFD23F',
  key:       '#3aa0ff',
  water:     '#36a8e0',
  waterDk:   '#1d6fa8',
  waterLt:   '#6fd0f5',
  porc:      '#eef3f8',
  porcSh:    '#b9c6d6',
  danger:    '#ff5b4d',
  snap:      '#7CFFB2',
  ink:       '#0a1426',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Scene starts (frames @30, from make_narration sentence ends)
const S = { flush: 0, howq: 149, siphon: 205, fill: 395, drag: 562, gurgle: 794 };

// Inverted-U siphon centerline: throat -> up riser -> over crest -> down long leg -> drain
const SIPHON_D = 'M 440,1000 L 440,640 C 440,540 660,540 660,640 L 660,1520';
const PATHLEN = 1520;
// Bowl basin interior (a cup narrowing to the throat at 440,1000)
const BOWL_INNER = 'M 300,690 C 300,900 360,1000 440,1000 C 520,1000 560,900 560,690 Z';

function usePop(delay: number, damping = 120) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.55, stiffness: 180 } });
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

// ─── CAPTIONS (real whisper timings, 3-word karaoke) ──────────────────────────
const WRAW: { w: string; s: number }[] = [
  {w:'Press',s:0.0},{w:'the',s:0.36},{w:'handle,',s:0.54},
  {w:'and',s:1.34},{w:'your',s:1.4},{w:'toilet',s:1.52},
  {w:'empties',s:1.86},{w:'itself',s:2.38},{w:'in',s:2.88},
  {w:'seconds',s:3.34},{w:'with',s:3.8},{w:'no',s:4.02},
  {w:'pump',s:4.36},{w:'at',s:4.6},{w:'all.',s:4.72},
  {w:'So',s:5.54},{w:'how',s:5.58},{w:'does',s:5.68},
  {w:'it',s:5.8},{w:'suck',s:5.96},{w:'everything',s:6.14},
  {w:'down?',s:6.46},{w:'Well,',s:7.36},{w:'hidden',s:7.96},
  {w:'behind',s:8.16},{w:'the',s:8.54},{w:'bowl',s:8.72},
  {w:'is',s:8.88},{w:'a',s:9.22},{w:'curved',s:9.44},
  {w:'tube',s:9.66},{w:'shaped',s:10.06},{w:'like',s:10.58},
  {w:'an',s:11.0},{w:'upside',s:11.12},{w:'down',s:11.56},
  {w:'U',s:11.86},{w:'called',s:12.38},{w:'the',s:12.52},
  {w:'siphon.',s:12.72},{w:'When',s:13.54},{w:'you',s:13.72},
  {w:'flush,',s:13.88},{w:'water',s:14.72},{w:'rushes',s:15.0},
  {w:'in',s:15.42},{w:'fast',s:15.64},{w:'and',s:16.18},
  {w:'fills',s:16.94},{w:'that',s:17.28},{w:'tube',s:17.62},
  {w:'completely.',s:18.08},{w:'Then',s:19.44},{w:'gravity',s:19.64},
  {w:'drags',s:20.18},{w:'the',s:20.86},{w:'water',s:21.02},
  {w:'down',s:21.38},{w:'the',s:21.9},{w:'long',s:22.1},
  {w:'side',s:22.34},{w:'and',s:22.88},{w:'this',s:23.62},
  {w:'pulls',s:23.78},{w:'the',s:24.12},{w:'bowl',s:24.34},
  {w:'water',s:24.58},{w:'up',s:24.88},{w:'and',s:25.22},
  {w:'over',s:25.58},{w:'the',s:25.78},{w:'bend',s:25.9},
  {w:'with',s:26.08},{w:'it.',s:26.26},{w:'The',s:26.96},
  {w:'whole',s:27.04},{w:'bowl',s:27.22},{w:'empties',s:27.62},
  {w:'until',s:28.16},{w:'air',s:28.64},{w:'finally',s:28.84},
  {w:'breaks',s:29.42},{w:'the',s:29.8},{w:'chain,',s:30.02},
  {w:'making',s:30.8},{w:'that',s:31.06},{w:'gurgle',s:31.34},
  {w:'you',s:31.86},{w:'hear',s:31.98},{w:'at',s:32.22},
  {w:'the',s:32.32},{w:'end',s:32.42},{w:'every',s:32.8},
  {w:'single',s:33.24},{w:'time.',s:33.5},
];
type Page = { words: string[]; startF: number };
const PAGES: Page[] = [];
for (let i = 0; i < WRAW.length; i += 3) {
  const chunk = WRAW.slice(i, i + 3);
  PAGES.push({ words: chunk.map((x) => x.w), startF: chunk[0].s * FPS });
}

function Captions() {
  const frame = useCurrentFrame();
  let page: Page | null = null;
  let pi = 0;
  for (let i = PAGES.length - 1; i >= 0; i--) {
    if (frame >= PAGES[i].startF) { page = PAGES[i]; pi = i; break; }
  }
  if (!page) return null;
  return (
    <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span key={wi} style={{
            color: active ? C.accent : '#fff',
            fontSize: 62, fontWeight: 900,
            fontFamily: "'Inter','Arial Black',sans-serif",
            textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)',
            display: 'inline-block', margin: '0 16px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const BG = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 28%, ${C.bgMid} 0%, ${C.bg} 70%)` }} />
);

// ─── TOILET EXTERIOR (scenes 1-2) ─────────────────────────────────────────────
function ToiletBody({ handleDeg = 0, dim = 1, waterRy = 44, swirl = 0 }:
  { handleDeg?: number; dim?: number; waterRy?: number; swirl?: number }) {
  return (
    <g opacity={dim}>
      {/* Pedestal */}
      <path d="M 470,1000 L 430,1320 L 650,1320 L 610,1000 Z" fill={C.porcSh} />
      <path d="M 470,1000 L 445,1320 L 560,1320 L 540,1000 Z" fill={C.porc} />
      {/* Bowl body */}
      <path d="M 320,720 C 320,1010 430,1050 540,1050 C 650,1050 760,1010 760,720 Z" fill={C.porcSh} />
      <path d="M 340,710 C 345,980 440,1030 540,1030 C 640,1030 735,980 740,710 Z" fill={C.porc} />
      {/* Seat rim oval */}
      <ellipse cx={540} cy={720} rx={212} ry={74} fill={C.porc} stroke={C.porcSh} strokeWidth={10} />
      <ellipse cx={540} cy={726} rx={158} ry={50} fill={C.bgMid} />
      {/* Bowl water */}
      <ellipse cx={540} cy={738} rx={138} ry={waterRy} fill={C.water} />
      <ellipse cx={540} cy={738} rx={138} ry={waterRy} fill="none" stroke={C.waterLt} strokeWidth={3} opacity={0.6} />
      {/* Swirl arrows on the water */}
      {[0, 1, 2].map((k) => {
        const a = swirl + k * 120;
        const rad = (a * Math.PI) / 180;
        const rx = 92, ry = Math.max(10, waterRy - 10);
        const x = 540 + Math.cos(rad) * rx;
        const y = 738 + Math.sin(rad) * ry;
        return <circle key={k} cx={x} cy={y} r={7} fill={C.waterLt} opacity={swirl > 0 ? 0.85 : 0} />;
      })}
      {/* Tank */}
      <rect x={372} y={384} width={336} height={250} rx={26} fill={C.porc} />
      <rect x={372} y={384} width={40} height={250} rx={20} fill={C.porcSh} opacity={0.6} />
      <rect x={360} y={360} width={360} height={44} rx={14} fill={C.porc} stroke={C.porcSh} strokeWidth={4} />
      {/* Handle */}
      <g transform={`rotate(${handleDeg} 372 432)`}>
        <rect x={330} y={422} width={56} height={20} rx={7} fill="#9fb0c2" />
        <circle cx={386} cy={432} r={11} fill="#7d90a6" />
      </g>
    </g>
  );
}

function SceneFlush() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 90, mass: 0.6, stiffness: 170 } });
  const press = frame > 18 ? interpolate(frame, [18, 24, 34], [0, 14, 11], clamp) : 0;
  const drain = interpolate(frame, [34, 120], [44, 16], clamp);
  const swirl = frame > 30 ? (frame - 30) * 9 : 0;
  const badge = spring({ frame: frame - 70, fps, config: { damping: 120, mass: 0.5, stiffness: 190 } });
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`scale(${pop})`} style={{ transformOrigin: '540px 850px' }}>
            <ToiletBody handleDeg={press} waterRy={drain} swirl={swirl} />
          </g>
          {/* NO PUMP badge */}
          <g transform={`translate(820,470) scale(${badge})`} opacity={badge}>
            <rect x={-150} y={-46} width={300} height={92} rx={20} fill={C.danger} />
            <text x={0} y={-2} textAnchor="middle" fill="white" fontSize={44} fontWeight={900} fontFamily="Arial Black,sans-serif">NO</text>
            <text x={0} y={36} textAnchor="middle" fill="white" fontSize={40} fontWeight={900} fontFamily="Arial Black,sans-serif">PUMP</text>
            {/* crossed-out pump glyph */}
            <circle cx={108} cy={-44} r={30} fill={C.ink} />
            <rect x={94} y={-58} width={28} height={26} rx={4} fill="#9fb0c2" />
            <line x1={86} y1={-66} x2={130} y2={-22} stroke={C.danger} strokeWidth={7} strokeLinecap="round" />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function SceneHowq() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = spring({ frame: frame - 4, fps, config: { damping: 90, mass: 0.6, stiffness: 160 } });
  const qPulse = 1 + 0.05 * Math.sin(frame * 0.16);
  const arrow = interpolate(frame, [10, 46], [0, 1], clamp);
  const dropOff = (frame * 6) % 120;
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <marker id="aDown" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.key} />
            </marker>
          </defs>
          <g transform="scale(0.92)" style={{ transformOrigin: '540px 850px' }}>
            <ToiletBody dim={0.32} waterRy={16} />
          </g>
          {/* Curiosity arrow from bowl down toward hidden drain */}
          <path d="M 540,760 C 560,1050 720,1150 720,1450" fill="none" stroke={C.key}
            strokeWidth={6} strokeDasharray="14 12" markerEnd="url(#aDown)"
            strokeDashoffset={1100 * (1 - arrow)} opacity={0.85} />
          {[0, 1, 2].map((k) => {
            const t = ((dropOff + k * 40) % 120) / 120;
            const x = interpolate(t, [0, 1], [540, 720]);
            const y = interpolate(t, [0, 1], [760, 1450]);
            return <circle key={k} cx={x} cy={y} r={9 * (1 - t) + 3} fill={C.waterLt} opacity={0.8 * (1 - t)} />;
          })}
          {/* Big ? */}
          <text x={540} y={560} textAnchor="middle" fill={C.accent} fontSize={230} fontWeight={900}
            fontFamily="Arial Black,sans-serif" opacity={q}
            transform={`translate(540,560) scale(${q * qPulse}) translate(-540,-560)`}>?</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── CROSS-SECTION SHARED BASE (scenes 3-6) ───────────────────────────────────
function CrossBase({ pipeDraw = 1, showWater = false, bowlLevel = 760, tubeFill = 0 }:
  { pipeDraw?: number; showWater?: boolean; bowlLevel?: number; tubeFill?: number }) {
  return (
    <g>
      {/* faint exterior silhouette */}
      <path d="M 300,690 C 300,1040 460,1080 540,1080 C 640,1080 760,1010 760,690 Z"
        fill={C.porc} opacity={0.07} />
      <rect x={372} y={420} width={336} height={210} rx={24} fill={C.porc} opacity={0.06} />
      {/* Bowl basin outline */}
      <path d={BOWL_INNER} fill="none" stroke={C.porcSh} strokeWidth={6} opacity={0.7} />
      {/* Bowl water */}
      {showWater && (
        <g clipPath="url(#bowlClip)">
          <rect x={290} y={bowlLevel} width={280} height={1010 - bowlLevel} fill={C.water} />
          <rect x={290} y={bowlLevel} width={280} height={8} fill={C.waterLt} opacity={0.7} />
        </g>
      )}
      {/* Pipe (the siphon) */}
      <path d={SIPHON_D} fill="none" stroke={C.porcSh} strokeWidth={72} strokeLinecap="round" opacity={0.28}
        strokeDasharray={PATHLEN} strokeDashoffset={PATHLEN * (1 - pipeDraw)} />
      <path d={SIPHON_D} fill="none" stroke={C.key} strokeWidth={72} strokeLinecap="round" opacity={0.5}
        strokeDasharray={PATHLEN} strokeDashoffset={PATHLEN * (1 - pipeDraw)} />
      {/* Tube water fill */}
      {tubeFill > 0 && (
        <path d={SIPHON_D} fill="none" stroke={C.water} strokeWidth={54} strokeLinecap="round"
          strokeDasharray={PATHLEN} strokeDashoffset={PATHLEN * (1 - tubeFill)} />
      )}
      {/* Drain mouth */}
      <path d="M 624,1500 L 696,1500 L 712,1580 L 608,1580 Z" fill={C.ink} stroke={C.porcSh} strokeWidth={5} opacity={pipeDraw} />
    </g>
  );
}

const Defs = () => (
  <defs>
    <clipPath id="bowlClip"><path d={BOWL_INNER} /></clipPath>
    <marker id="aKey" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill={C.key} />
    </marker>
    <marker id="aGold" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill={C.accent} />
    </marker>
    <marker id="aWhite" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#fff" />
    </marker>
  </defs>
);

// ─── SCENE 3: SIPHON REVEAL (hero structure) ──────────────────────────────────
function SceneSiphon() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [8, 56], [0, 1], clamp);
  const uFlip = spring({ frame: frame - 44, fps, config: { damping: 90, mass: 0.6, stiffness: 160 } });
  const label = spring({ frame: frame - 60, fps, config: { damping: 120, mass: 0.5, stiffness: 190 } });
  const shimmer = interpolate((frame * 3) % 100, [0, 50, 100], [0.1, 0.6, 0.1], clamp);
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          <CrossBase pipeDraw={draw} showWater bowlLevel={760} />
          {/* glint along crest */}
          <circle cx={550} cy={552} r={16} fill="#fff" opacity={shimmer} />
          {/* Upside-down U letter flipping onto the bend */}
          <text x={550} y={470} textAnchor="middle" fill={C.accent} fontSize={120} fontWeight={900}
            fontFamily="Arial Black,sans-serif" opacity={uFlip}
            transform={`translate(550,452) rotate(${180 * uFlip}) scale(${uFlip}) translate(-550,-452)`}>U</text>
          {/* THE SIPHON label brace -> crest */}
          <g opacity={label}>
            <line x1={760} y1={552} x2={660} y2={552} stroke={C.accent} strokeWidth={4} markerEnd="url(#aGold)"
              transform={`translate(${60 * (1 - label)},0)`} />
            <rect x={758} y={520} width={286} height={64} rx={14} fill={C.accent}
              transform={`translate(${60 * (1 - label)},0)`} />
            <text x={901} y={563} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900}
              fontFamily="Arial Black,sans-serif" transform={`translate(${60 * (1 - label)},0)`}>THE SIPHON</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FILL — water rushes in, packs the tube ──────────────────────────
function SceneFill() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = interpolate(frame, [10, 60], [760, 716], clamp);
  const fill = interpolate(frame, [40, 130], [0, 1], clamp);
  const gauge = spring({ frame: frame - 132, fps, config: { damping: 80, mass: 0.5, stiffness: 220 } });
  const jet = (frame * 7) % 90;
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          <CrossBase pipeDraw={1} showWater bowlLevel={rise} tubeFill={fill} />
          {/* rim-jet inflow arrows from tank */}
          {[0, 1, 2].map((k) => {
            const t = ((jet + k * 30) % 90) / 90;
            const y = interpolate(t, [0, 1], [560, 690]);
            return <line key={k} x1={460} y1={y - 24} x2={470} y2={y} stroke={C.waterLt} strokeWidth={8}
              strokeLinecap="round" opacity={0.85 * (1 - t)} markerEnd="url(#aKey)" />;
          })}
          {/* bubbles in tube */}
          {[0, 1, 2, 3].map((k) => {
            const bt = ((frame * 4 + k * 28) % 120) / 120;
            if (fill < 0.4) return null;
            const py = interpolate(bt, [0, 1], [1000, 600]);
            return <circle key={k} cx={440 + Math.sin(bt * 9 + k) * 8} cy={py} r={6} fill="#fff" opacity={0.5 * (1 - bt)} />;
          })}
          {/* FULL gauge */}
          <g transform="translate(540,1660)" opacity={gauge}>
            <rect x={-120} y={-34} width={240} height={68} rx={34} fill={C.snap} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Arial Black,sans-serif">TUBE FULL</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DRAG — gravity pulls bowl water up & over (payoff mechanism) ─────
function SceneDrag() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drainLevel = interpolate(frame, [10, 180], [716, 988], clamp);
  const flow = (frame * 26) % 80;
  const gArrow = 1 + 0.08 * Math.sin(frame * 0.18);
  const gLabel = spring({ frame: frame - 12, fps, config: { damping: 120, mass: 0.5, stiffness: 190 } });
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          <CrossBase pipeDraw={1} showWater bowlLevel={drainLevel} tubeFill={1} />
          {/* Downward flow streaks on the long (right) leg */}
          {[0, 1, 2, 3].map((k) => {
            const y = 660 + ((flow + k * 80 / 4 * 4 + k * 70) % 820);
            return <rect key={k} x={648} y={y} width={24} height={46} rx={12} fill={C.waterLt}
              opacity={0.55} />;
          })}
          {/* Chasing arrows: bowl water up riser, over crest, down */}
          <path d={SIPHON_D} fill="none" stroke={C.snap} strokeWidth={10} strokeLinecap="round"
            strokeDasharray="26 40" strokeDashoffset={-(frame * 12) % 66} opacity={0.85} />
          {/* GRAVITY arrow on long side */}
          <g transform="translate(820,1040)" opacity={gLabel}>
            <line x1={0} y1={-120} x2={0} y2={120} stroke={C.accent} strokeWidth={12}
              markerEnd="url(#aGold)" strokeLinecap="round"
              transform={`scale(1 ${gArrow})`} />
            <text x={40} y={-40} fill={C.accent} fontSize={70} fontWeight={900} fontFamily="Arial Black,sans-serif">g</text>
            <text x={40} y={10} fill={C.accent} fontSize={30} fontWeight={900} fontFamily="Arial Black,sans-serif">GRAVITY</text>
            {[0, 1, 2].map((k) => <circle key={k} cx={-2} cy={-60 + ((frame * 5 + k * 50) % 180)} r={7} fill={C.waterLt} opacity={0.7} />)}
          </g>
          {/* PULLS label near bowl */}
          <g transform="translate(250,560)" opacity={gLabel}>
            <rect x={-90} y={-30} width={210} height={60} rx={30} fill={C.key} />
            <text x={15} y={11} textAnchor="middle" fill="white" fontSize={30} fontWeight={900} fontFamily="Arial Black,sans-serif">PULLED UP</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: GURGLE — air breaks the chain, payoff ───────────────────────────
function SceneGurgle() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SNAP = 70;
  const ribbonFill = frame < SNAP ? 1 : 0; // chain intact then broken
  const airY = interpolate(frame, [20, SNAP], [1000, 560], clamp);
  const glug = spring({ frame: frame - SNAP - 2, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  // payoff swaps in late
  const showPayoff = frame > 120;
  const calm = interpolate(frame, [120, 138], [0, 1], clamp);
  const w1 = spring({ frame: frame - 132, fps, config: { damping: 85, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 150, fps, config: { damping: 85, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <BG />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          {!showPayoff && (
            <>
              <CrossBase pipeDraw={1} showWater bowlLevel={978} tubeFill={ribbonFill} />
              {/* thin water ribbon when intact */}
              {frame < SNAP && (
                <path d={SIPHON_D} fill="none" stroke={C.waterLt} strokeWidth={14} strokeLinecap="round" opacity={0.9} />
              )}
              {/* air bubble rushing up to snap the chain */}
              {frame < SNAP + 6 && <circle cx={440} cy={airY} r={20} fill="#fff" opacity={0.92} />}
              {/* snap recoil + gurgle bubbles */}
              {frame >= SNAP && (
                <g>
                  {[0, 1, 2, 3, 4, 5].map((k) => {
                    const t = interpolate(frame, [SNAP, SNAP + 40], [0, 1], clamp);
                    const ang = k * 60 + 20;
                    const rad = (ang * Math.PI) / 180;
                    const r = t * (70 + k * 14);
                    return <circle key={k} cx={460 + Math.cos(rad) * r} cy={620 + Math.sin(rad) * r}
                      r={(1 - t) * 18 + 5} fill={C.waterLt} opacity={(1 - t) * 0.85} />;
                  })}
                  <text x={540} y={420} textAnchor="middle" fill={C.accent} fontSize={70} fontWeight={900}
                    fontFamily="Arial Black,sans-serif" opacity={glug}
                    transform={`translate(540,420) scale(${glug}) translate(-540,-420)`}>GLUG GLUG</text>
                </g>
              )}
            </>
          )}
          {showPayoff && (
            <g opacity={calm}>
              {/* calm refilled bowl */}
              <CrossBase pipeDraw={1} showWater bowlLevel={836} tubeFill={0} />
              <text x={540} y={1180} textAnchor="middle" fill={C.danger} fontSize={104} fontWeight={900}
                fontFamily="Arial Black,sans-serif" opacity={w1}
                transform={`translate(540,1180) scale(${w1}) translate(-540,-1180)`}>NO PUMP.</text>
              <text x={540} y={1300} textAnchor="middle" fill="#fff" fontSize={64} fontWeight={900}
                fontFamily="Arial Black,sans-serif" opacity={w2}
                transform={`translate(540,1300) scale(${w2}) translate(-540,-1300)`}>JUST A HIDDEN U-BEND.</text>
              <rect x={210} y={1322} width={660 * w2} height={8} rx={4} fill={C.danger} opacity={w2} />
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Toilet: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('toilet_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* scene-matched water sound design (frame-accurate, baked) */}
      <Sequence from={34} durationInFrames={90}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.siphon + 2} durationInFrames={80}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.fill + 4}><Audio src={staticFile('sfx_splash_big.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.drag + 4}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.gurgle + 6}><Audio src={staticFile('sfx_toilet_flush.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.flush} durationInFrames={S.howq - S.flush}><SceneFlush /></Sequence>
      <Sequence from={S.howq} durationInFrames={S.siphon - S.howq}><SceneHowq /></Sequence>
      <Sequence from={S.siphon} durationInFrames={S.fill - S.siphon}><SceneSiphon /></Sequence>
      <Sequence from={S.fill} durationInFrames={S.drag - S.fill}><SceneFill /></Sequence>
      <Sequence from={S.drag} durationInFrames={S.gurgle - S.drag}><SceneDrag /></Sequence>
      <Sequence from={S.gurgle} durationInFrames={DURATION_IN_FRAMES - S.gurgle}><SceneGurgle /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

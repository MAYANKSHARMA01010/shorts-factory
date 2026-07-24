/**
 * "Your Mirror Is Lying To You" — a polished animated explainer (Remotion).
 * Transcript #001 (mirror-is-really-silver). Voice: edge-tts AndrewMultilingual.
 * Captions + scene timing are driven by the real per-word timestamps in
 * mirror_words.json. Ambient pad bed under the narration.
 */
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Poppins';
import wordsData from './mirror_words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1035; // 34.5s (audio 34.04s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

// scene starts in frames (sentence ends from mirror_words.json @30fps)
const S = {hook: 0, glass: 85, silver: 284, bounce: 469, seal: 597, reveal: 776};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// palette — cool metal + cyan glass + warm copper accent
const C = {
  ink: '#080d1c',
  white: '#FFFFFF',
  gold: '#FFD23F',
  silver: '#dfe6f0',
  silverDk: '#8b97a8',
  glass: '#7fd6ff',
  copper: '#e08b4e',
  copperDk: '#b5651d',
  paint: '#243149',
};

const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => v + (pb[i] - v) * t);
  return `#${hx(c[0])}${hx(c[1])}${hx(c[2])}`;
};
const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, mass: 0.9}});
};

// ── shared defs (glow + metallic gradients) ───────────────────────────────────
const Defs: React.FC = () => (
  <defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="9" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="24" />
    </filter>
    <linearGradient id="silverG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#ffffff" />
      <stop offset="28%" stopColor="#dfe6f0" />
      <stop offset="50%" stopColor="#aeb9c9" />
      <stop offset="72%" stopColor="#d6dde8" />
      <stop offset="100%" stopColor="#8b97a8" />
    </linearGradient>
    <linearGradient id="glassG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#bdeaff" stopOpacity="0.55" />
      <stop offset="50%" stopColor="#7fd6ff" stopOpacity="0.28" />
      <stop offset="100%" stopColor="#3aa0ff" stopOpacity="0.42" />
    </linearGradient>
    <linearGradient id="copperG" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#f4b078" />
      <stop offset="50%" stopColor="#e08b4e" />
      <stop offset="100%" stopColor="#b5651d" />
    </linearGradient>
    <radialGradient id="topGlow" cx="50%" cy="22%" r="60%">
      <stop offset="0%" stopColor="#bcd6ff" stopOpacity="0.30" />
      <stop offset="100%" stopColor="#bcd6ff" stopOpacity="0" />
    </radialGradient>
  </defs>
);
const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
    <Defs />
    {children}
  </svg>
);

// ── animated metallic background ──────────────────────────────────────────────
const DUST = Array.from({length: 46}).map((_, i) => ({
  x: random('x' + i) * W,
  y: random('y' + i) * H,
  r: 1.2 + random('r' + i) * 2.6,
  sp: 4 + random('s' + i) * 13,
  o: 0.05 + random('o' + i) * 0.14,
}));
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  // warm a touch during the copper/seal beat, brighten on the reveal
  const warm = interpolate(frame, [S.seal, S.seal + 70, S.reveal - 20, S.reveal + 40], [0, 0.18, 0.18, 0], clamp);
  const bright = interpolate(frame, [S.reveal, S.reveal + 120], [0, 0.12], clamp);
  const top = mix(mix('#0a1024', '#101a33', bright), '#241a2c', warm);
  const mid = mix(mix('#14233f', '#1b2e50', bright), '#332033', warm);
  const bot = mix('#0c1428', '#1a1422', warm);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bot} 100%)`}}>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill="url(#topGlow)" />
        {DUST.map((p, i) => {
          const y = (((p.y - (frame * p.sp) / 30) % H) + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="#dfe9ff" opacity={p.o} />;
        })}
      </Svg>
    </AbsoluteFill>
  );
};

// ── scene wrapper ─────────────────────────────────────────────────────────────
const SceneWrap: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const fin = interpolate(f, [0, 14], [0, 1], clamp);
  const fout = interpolate(f, [dur - 12, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{opacity: Math.min(fin, fout), transform: `scale(${interpolate(fin, [0, 1], [1.04, 1])})`}}>
      {children}
    </AbsoluteFill>
  );
};

// label pill
const Label: React.FC<{children: React.ReactNode; y?: number; delay?: number}> = ({children, y = 250, delay = 6}) => {
  const e = useEnter(delay);
  return (
    <div style={{position: 'absolute', top: y, width: W, textAlign: 'center', opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-26, 0])}px)`}}>
      <span style={{display: 'inline-block', padding: '14px 38px', borderRadius: 999, background: 'rgba(10,18,40,0.5)', border: '2px solid rgba(190,214,255,0.32)', color: 'white', fontSize: 46, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.35)'}}>{children}</span>
    </div>
  );
};

// a simple person bust (head + shoulders) used as the reflection / viewer
const Bust: React.FC<{cx: number; cy: number; s?: number; fill?: string; op?: number}> = ({cx, cy, s = 1, fill = '#cfe0ff', op = 1}) => (
  <g transform={`translate(${cx} ${cy}) scale(${s})`} opacity={op}>
    <circle cx={0} cy={-60} r={52} fill={fill} />
    <path d={`M -96 96 Q -96 6 0 6 Q 96 6 96 96 Z`} fill={fill} />
  </g>
);

// ── Scene 1: HOOK — mirror + ghost reflection ─────────────────────────────────
const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const e = useEnter(2, 220);
  const mx = 540, my = 760, mw = 460, mh = 660;
  const sheen = interpolate((f % 75) / 75, [0, 1], [-mw, mw * 1.4]);
  const q = 0.7 + 0.3 * Math.sin(f / 8);
  const zoom = interpolate(f, [55, 85], [1, 1.18], clamp); // lead into next scene
  return (
    <AbsoluteFill style={{transform: `scale(${zoom})`}}>
      <Svg>
        {/* mirror frame */}
        <g transform={`translate(${mx} ${my})`} opacity={e}>
          <rect x={-mw / 2 - 26} y={-mh / 2 - 26} width={mw + 52} height={mh + 52} rx={40} fill="#2a3550" />
          <rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} rx={26} fill="url(#silverG)" />
          {/* glass tint + ghost reflection (clipped to mirror) */}
          <clipPath id="mclip">
            <rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} rx={26} />
          </clipPath>
          <g clipPath="url(#mclip)">
            <rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} fill="url(#glassG)" />
            <Bust cx={0} cy={120} s={1.5} fill="#aebfe0" op={0.5} />
            {/* moving sheen */}
            <rect x={sheen} y={-mh / 2} width={120} height={mh} fill="white" opacity={0.22} transform={`skewX(-18)`} />
          </g>
        </g>
        {/* pulsing question mark */}
        <text x={mx + mw / 2 - 20} y={my - mh / 2 + 30} fontFamily={FONT} fontSize={120} fontWeight={900} fill={C.gold} opacity={q} filter="url(#glow)" textAnchor="middle">?</text>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 2: FLAT GLASS — wipe clean ──────────────────────────────────────────
const SPECKS = Array.from({length: 18}).map((_, i) => ({
  x: 320 + random('sx' + i) * 440,
  y: 560 + random('sy' + i) * 700,
  r: 3 + random('sr' + i) * 6,
}));
const SceneGlass: React.FC = () => {
  const f = useCurrentFrame();
  const gx = 300, gy = 520, gw = 480, gh = 760;
  const wipe = interpolate(f, [28, 110], [gx - 60, gx + gw + 60], clamp); // cloth sweeps left→right
  return (
    <AbsoluteFill>
      <Label delay={2}>Perfectly flat glass</Label>
      <Svg>
        {/* glass pane */}
        <rect x={gx} y={gy} width={gw} height={gh} rx={14} fill="url(#glassG)" stroke="#bfe6ff" strokeWidth={4} />
        {/* highlight streaks */}
        <rect x={gx + 60} y={gy} width={40} height={gh} fill="white" opacity={0.12} transform="skewX(-12)" />
        {/* specks — fade as the cloth passes them */}
        {SPECKS.map((s, i) => {
          const gone = interpolate(wipe, [s.x - 30, s.x + 30], [1, 0], clamp);
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#9fb2cc" opacity={0.7 * gone} />;
        })}
        {/* sparkle trail at the cloth edge */}
        {f > 24 && f < 118 && Array.from({length: 5}).map((_, i) => {
          const yy = gy + 80 + i * 150 + 18 * Math.sin(f / 5 + i);
          return <g key={i} transform={`translate(${wipe} ${yy})`} opacity={0.9}>
            <path d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="#fff7cf" filter="url(#glow)" />
          </g>;
        })}
        {/* the cloth/squeegee */}
        <g transform={`translate(${wipe} ${gy + gh / 2})`}>
          <rect x={-26} y={-gh / 2 - 6} width={52} height={gh + 12} rx={16} fill="#e7edf6" stroke="#aeb9c9" strokeWidth={4} opacity={0.96} />
          <rect x={-10} y={-gh / 2 - 6} width={20} height={gh + 12} fill="#cfd8e6" opacity={0.8} />
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: SILVER spray → atom zoom ─────────────────────────────────────────
const ATOMS = Array.from({length: 22}).map((_, i) => ({
  x: 360 + (i % 11) * 36,
  row: Math.floor(i / 11),
}));
const SceneSilver: React.FC = () => {
  const f = useCurrentFrame();
  const gx = 300, gy = 520, gw = 480, gh = 760;
  const coat = interpolate(f, [16, 88], [0, 1], clamp); // silver fills the pane
  const zoomIn = interpolate(f, [120, 170], [0, 1], clamp); // zoom to atomic inset
  return (
    <AbsoluteFill>
      <Label delay={2}>A layer of liquid silver</Label>
      <Svg>
        {/* glass pane being coated with silver */}
        <rect x={gx} y={gy} width={gw} height={gh} rx={14} fill="url(#glassG)" stroke="#bfe6ff" strokeWidth={4} />
        <clipPath id="coatclip"><rect x={gx} y={gy} width={gw} height={gh} rx={14} /></clipPath>
        <g clipPath="url(#coatclip)">
          <rect x={gx} y={gy + gh * (1 - coat)} width={gw} height={gh * coat} fill="url(#silverG)" opacity={0.95} />
          <rect x={gx + 70} y={gy} width={36} height={gh} fill="white" opacity={0.16 * coat} transform="skewX(-12)" />
        </g>
        {/* spray nozzle + droplets (top) */}
        <g transform={`translate(${gx + gw / 2} ${gy - 70})`} opacity={interpolate(f, [0, 12], [0, 1], clamp)}>
          <rect x={-26} y={-46} width={52} height={56} rx={10} fill="#c3ccd9" stroke="#8b97a8" strokeWidth={3} />
          <rect x={-10} y={10} width={20} height={20} fill="#8b97a8" />
        </g>
        {f < 120 && Array.from({length: 16}).map((_, i) => {
          const t = ((f * 1.3 + i * 7) % 40) / 40;
          const dx = (random('dx' + i) - 0.5) * gw * 0.8;
          const yy = gy - 30 + t * (gh * 0.9);
          return <circle key={i} cx={gx + gw / 2 + dx * t} cy={yy} r={5} fill="#eef2f8" opacity={(1 - t) * 0.9} filter="url(#glow)" />;
        })}

        {/* atomic-scale inset that zooms up */}
        <g transform={`translate(${540} ${1300}) scale(${0.2 + 0.8 * zoomIn})`} opacity={zoomIn} style={{transformBox: 'fill-box'} as any}>
          <g transform="translate(-340 -120)">
            <rect x={300} y={40} width={460} height={210} rx={18} fill="rgba(10,18,40,0.55)" stroke="#bcd6ff" strokeWidth={2} />
            {ATOMS.map((a, i) => (
              <circle key={i} cx={a.x} cy={120 + a.row * 40} r={15} fill="url(#silverG)" stroke="#8b97a8" strokeWidth={2} opacity={interpolate(f, [130 + i, 150 + i], [0, 1], clamp)} />
            ))}
            {/* caliper: a few atoms thick */}
            <line x1={336} y1={104} x2={336} y2={200} stroke={C.gold} strokeWidth={4} />
            <path d="M328 104 L336 96 L344 104 Z" fill={C.gold} />
            <path d="M328 200 L336 208 L344 200 Z" fill={C.gold} />
            <text x={300} y={84} fontFamily={FONT} fontSize={30} fontWeight={800} fill={C.gold}>≈ a few atoms thick</text>
          </g>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: BOUNCE — light reflects off silver back to the eye ───────────────
const SceneBounce: React.FC = () => {
  const f = useCurrentFrame();
  const wallX = 700; // the silvered surface
  const eyeX = 250, eyeY = 760;
  const hitY = 760;
  const out = (f % 46) / 46; // outgoing ray progress
  const back = ((f + 23) % 46) / 46; // returning ray progress
  return (
    <AbsoluteFill>
      <Label delay={2}>It bounces your image back</Label>
      <Svg>
        {/* the silvered wall (glass + silver) */}
        <rect x={wallX} y={420} width={26} height={680} fill="url(#glassG)" />
        <rect x={wallX + 26} y={420} width={20} height={680} fill="url(#silverG)" />
        {/* eye / viewer */}
        <Bust cx={eyeX} cy={1180} s={1.05} fill="#cfe0ff" op={0.95} />
        <g>
          <ellipse cx={eyeX} cy={eyeY} rx={70} ry={42} fill="white" stroke="#1d3a6b" strokeWidth={5} />
          <circle cx={eyeX + 6} cy={eyeY} r={22} fill="#2b6fd6" />
          <circle cx={eyeX + 6} cy={eyeY} r={9} fill="#0b1f44" />
        </g>
        {/* outgoing ray (eye → wall) */}
        <line x1={eyeX + 70} y1={eyeY} x2={interpolate(out, [0, 1], [eyeX + 70, wallX])} y2={interpolate(out, [0, 1], [eyeY, hitY])} stroke="#fff7cf" strokeWidth={10} opacity={0.85} filter="url(#glow)" strokeLinecap="round" />
        {/* glint where it hits */}
        <circle cx={wallX} cy={hitY} r={interpolate((f % 46), [20, 28, 40], [0, 16, 0], clamp)} fill="#ffffff" filter="url(#glow)" />
        {/* returning ray (wall → eye), tinted as "your image" */}
        <line x1={wallX} y1={hitY} x2={interpolate(back, [0, 1], [wallX, eyeX + 70])} y2={interpolate(back, [0, 1], [hitY, eyeY - 60])} stroke="#9fd0ff" strokeWidth={10} opacity={0.9} filter="url(#glow)" strokeLinecap="round" />
        {/* tiny reflected bust traveling back */}
        <Bust cx={interpolate(back, [0, 1], [wallX, eyeX + 130])} cy={interpolate(back, [0, 1], [hitY, eyeY - 60])} s={0.32} fill="#bfe0ff" op={0.85 * (1 - back)} />
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: SEAL — the layer cross-section (HERO) ────────────────────────────
type Layer = {label: string; w: number; fill: string; sub?: string};
const LAYERS: Layer[] = [
  {label: 'GLASS', w: 150, fill: 'url(#glassG)', sub: 'you look through this'},
  {label: 'SILVER', w: 34, fill: 'url(#silverG)', sub: 'the real mirror'},
  {label: 'COPPER', w: 30, fill: 'url(#copperG)'},
  {label: 'PAINT', w: 56, fill: '#243149'},
];
const SceneSeal: React.FC = () => {
  const f = useCurrentFrame();
  const baseX = 250, topY = 560, stackH = 720;
  let acc = 0;
  const lefts = LAYERS.map((l) => {
    const x = baseX + acc;
    acc += l.w;
    return x;
  });
  const totalW = acc;
  return (
    <AbsoluteFill>
      <Label delay={2}>Sealed so it can't scratch away</Label>
      <Svg>
        {/* incoming light arrow from the left */}
        <line x1={90} y1={topY + stackH / 2} x2={baseX - 10} y2={topY + stackH / 2} stroke="#fff7cf" strokeWidth={8} opacity={0.7} filter="url(#glow)" />
        {LAYERS.map((l, i) => {
          const e = interpolate(f, [10 + i * 16, 34 + i * 16], [0, 1], clamp);
          const x = lefts[i];
          return (
            <g key={i} opacity={e} transform={`translate(${interpolate(e, [0, 1], [140, 0])} 0)`}>
              <rect x={x} y={topY} width={l.w} height={stackH} fill={l.fill} stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
              {/* label below, rotated for thin layers */}
              <text
                x={x + l.w / 2}
                y={topY + stackH + 56}
                fontFamily={FONT}
                fontSize={l.w < 60 ? 26 : 34}
                fontWeight={800}
                fill={i === 1 ? C.gold : 'white'}
                textAnchor="middle"
                transform={l.w < 60 ? `rotate(40 ${x + l.w / 2} ${topY + stackH + 56})` : undefined}
              >{l.label}</text>
            </g>
          );
        })}
        {/* brace + caption for the silver = real mirror */}
        {(() => {
          const e = interpolate(f, [80, 110], [0, 1], clamp);
          const sx = lefts[1] + LAYERS[1].w / 2;
          return (
            <g opacity={e}>
              <line x1={sx} y1={topY - 70} x2={sx} y2={topY - 16} stroke={C.gold} strokeWidth={4} />
              <path d={`M${sx - 8} ${topY - 16} L${sx} ${topY - 4} L${sx + 8} ${topY - 16} Z`} fill={C.gold} />
              <text x={sx} y={topY - 86} fontFamily={FONT} fontSize={34} fontWeight={900} fill={C.gold} textAnchor="middle">THE actual mirror</text>
            </g>
          );
        })()}
        {/* scratch-shield: a scratch arrow blocked at the paint */}
        {(() => {
          const e = interpolate(f, [120, 150], [0, 1], clamp);
          const px = baseX + totalW;
          const sct = interpolate(f, [130, 158], [px + 150, px + 8], clamp);
          return (
            <g opacity={e}>
              <line x1={px + 160} y1={topY + 140} x2={sct} y2={topY + 140} stroke="#ff6a5a" strokeWidth={8} strokeLinecap="round" />
              <path d={`M${sct} ${topY + 140} l24 -12 l0 24 Z`} fill="#ff6a5a" />
              <circle cx={px} cy={topY + 140} r={interpolate(f % 30, [10, 18, 30], [0, 22, 0], clamp)} fill="none" stroke="#ff6a5a" strokeWidth={4} />
              <text x={px + 70} y={topY + 230} fontFamily={FONT} fontSize={28} fontWeight={800} fill="#ffb3aa" textAnchor="middle">no scratches</text>
            </g>
          );
        })()}
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: REVEAL — cutaway to the wall of silver ───────────────────────────
const SceneReveal: React.FC = () => {
  const f = useCurrentFrame();
  const e = useEnter(8, 200);
  const mx = 540, my = 700, mw = 440, mh = 640;
  // the GLASS sheet lifts off the front, sliding up-right + fading, revealing
  // the bright SILVER wall that was behind it the whole time.
  const peel = interpolate(f, [38, 118], [0, 1], clamp);
  const textE = interpolate(f, [128, 165], [0, 1], clamp);
  const gShift = interpolate(peel, [0, 1], [0, 360]);
  return (
    <AbsoluteFill>
      <Svg>
        <g transform={`translate(${mx} ${my})`} opacity={e}>
          {/* frame */}
          <rect x={-mw / 2 - 24} y={-mh / 2 - 24} width={mw + 48} height={mh + 48} rx={36} fill="#2a3550" />
          <clipPath id="rclip"><rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} rx={24} /></clipPath>
          <g clipPath="url(#rclip)">
            {/* the silver wall behind — always present, brightening as glass leaves */}
            <rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} fill="url(#silverG)" />
            {/* sweeping glints across the silver */}
            {Array.from({length: 3}).map((_, i) => {
              const sweep = interpolate(((f + i * 40) % 90) / 90, [0, 1], [-mw, mw]);
              return <rect key={i} x={sweep} y={-mh / 2} width={90} height={mh} fill="white" opacity={0.18 * peel} transform="skewX(-18)" />;
            })}
            {/* the glass sheet (with reflection) sliding away up-right */}
            <g opacity={1 - peel * 0.9} transform={`translate(${gShift} ${-gShift * 0.9}) rotate(${peel * 8})`}>
              <rect x={-mw / 2} y={-mh / 2} width={mw} height={mh} fill="url(#glassG)" />
              <rect x={-mw / 2 + 70} y={-mh / 2} width={50} height={mh} fill="white" opacity={0.16} transform="skewX(-12)" />
              <Bust cx={0} cy={110} s={1.35} fill="#aebfe0" op={0.55} />
            </g>
          </g>
          {/* GLASS tag on the departing sheet */}
          <text x={gShift} y={-mh / 2 - 40} fontFamily={FONT} fontSize={30} fontWeight={800} fill={C.glass} textAnchor="middle" opacity={peel * (1 - peel * 0.4)}>glass lifts off →</text>
        </g>
        {/* sparkle accents on the revealed silver */}
        {peel > 0.35 &&
          Array.from({length: 7}).map((_, i) => {
            const tt = (f / 5 + i * 1.3) % 7;
            const px = mx - mw / 2 + 50 + (i * 53) % (mw - 80);
            const py = my - mh / 2 + 60 + ((i * 97) % (mh - 120));
            return <path key={i} d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" transform={`translate(${px} ${py})`} fill="#fff" opacity={interpolate(tt, [0, 1, 2], [0, 0.9, 0], clamp)} filter="url(#glow)" />;
          })}
      </Svg>
      {/* closing line */}
      <div style={{position: 'absolute', top: 1180, width: W, textAlign: 'center', fontFamily: FONT, opacity: textE, transform: `translateY(${interpolate(textE, [0, 1], [40, 0])}px)`}}>
        <div style={{color: 'white', fontSize: 64, fontWeight: 800, lineHeight: 1.05, textShadow: '0 8px 28px rgba(0,0,0,0.45)'}}>It's a wall of</div>
        <div style={{color: C.silver, fontSize: 128, fontWeight: 900, lineHeight: 1.0, textShadow: '0 8px 28px rgba(0,0,0,0.5)'}}>SILVER</div>
        <div style={{color: C.gold, fontSize: 44, fontWeight: 700, marginTop: 18}}>hiding behind the glass.</div>
      </div>
    </AbsoluteFill>
  );
};

// ── karaoke captions (3-word pages) ───────────────────────────────────────────
const PAGES: {start: number; end: number; words: typeof WORDS}[] = [];
for (let i = 0; i < WORDS.length; i += 3) {
  const ch = WORDS.slice(i, i + 3);
  PAGES.push({start: ch[0].start, end: ch[ch.length - 1].end, words: ch});
}
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let page = PAGES[0];
  for (let i = 0; i < PAGES.length; i++) {
    const next = PAGES[i + 1];
    if (t >= PAGES[i].start && (!next || t < next.start)) {
      page = PAGES[i];
      break;
    }
  }
  if (!page || t < page.start - 0.05) return null;
  const pageIn = interpolate(t, [page.start - 0.08, page.start + 0.12], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', bottom: 250, left: 60, width: W - 120, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 76, lineHeight: 1.1, opacity: pageIn, transform: `translateY(${interpolate(pageIn, [0, 1], [16, 0])}px)`}}>
      <span style={{background: 'rgba(8,16,34,0.5)', padding: '12px 26px', borderRadius: 22, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
        {page.words.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.05;
          return (
            <span key={i} style={{display: 'inline-block', color: active ? C.gold : 'white', textShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 16px rgba(0,0,0,0.45)', margin: '0 16px', transform: `scale(${active ? 1.12 : 1})`}}>{w.text}</span>
          );
        })}
      </span>
    </div>
  );
};

// ── root ──────────────────────────────────────────────────────────────────────
export const Mirror: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('mirror_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.14} />

      <Sequence from={S.hook} durationInFrames={S.glass - S.hook}><SceneWrap dur={S.glass - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.glass} durationInFrames={S.silver - S.glass}><SceneWrap dur={S.silver - S.glass}><SceneGlass /></SceneWrap></Sequence>
      <Sequence from={S.silver} durationInFrames={S.bounce - S.silver}><SceneWrap dur={S.bounce - S.silver}><SceneSilver /></SceneWrap></Sequence>
      <Sequence from={S.bounce} durationInFrames={S.seal - S.bounce}><SceneWrap dur={S.seal - S.bounce}><SceneBounce /></SceneWrap></Sequence>
      <Sequence from={S.seal} durationInFrames={S.reveal - S.seal}><SceneWrap dur={S.reveal - S.seal}><SceneSeal /></SceneWrap></Sequence>
      <Sequence from={S.reveal} durationInFrames={DURATION_IN_FRAMES - S.reveal}><SceneWrap dur={DURATION_IN_FRAMES - S.reveal}><SceneReveal /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

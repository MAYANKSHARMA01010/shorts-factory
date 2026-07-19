/**
 * "A Real Diamond Grown In A Microwave" — fast snappy explainer (Remotion). Transcript #007.
 * Voice: edge-tts AndrewMultilingual. Calm-but-fast recut downstream.
 * Captions + scene timing driven by diamond_words.json.
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
import wordsData from './diamond_words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1150; // 38.3s (audio 38.12s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

const S = {hook: 0, everyday: 87, seed: 184, plasma: 377, rain: 562, grow: 753, reveal: 977};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const C = {
  ink: '#070a16',
  white: '#FFFFFF',
  gold: '#FFD23F',
  accent: '#8a5bff',
  accentLite: '#c9a8ff',
  plasma: '#b06bff',
  plasmaHot: '#ff66e0',
  diamond: '#bfefff',
  diamondEdge: '#7fe9ff',
  carbon: '#6f7d96',
  earth: '#7a4a2c',
  earthDk: '#4a2c18',
  green: '#41d77a',
};

const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => v + (pb[i] - v) * t);
  return `#${hx(c[0])}${hx(c[1])}${hx(c[2])}`;
};
const usePop = (delay = 0, damping = 120) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, mass: 0.55, stiffness: 180}});
};

const Defs: React.FC = () => (
  <defs>
    <filter id="glow" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="9" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="26" />
    </filter>
    <linearGradient id="steelG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#5a6273" />
      <stop offset="50%" stopColor="#3a4150" />
      <stop offset="100%" stopColor="#222834" />
    </linearGradient>
    <radialGradient id="plasmaG" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stopColor="#fff0ff" />
      <stop offset="35%" stopColor="#ff66e0" />
      <stop offset="70%" stopColor="#8a5bff" />
      <stop offset="100%" stopColor="#3a1f7a" />
    </radialGradient>
    <linearGradient id="gemG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#eafcff" />
      <stop offset="60%" stopColor="#bfefff" />
      <stop offset="100%" stopColor="#7fe9ff" />
    </linearGradient>
    <radialGradient id="vGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stopColor="#8a5bff" stopOpacity="0.22" />
      <stop offset="100%" stopColor="#8a5bff" stopOpacity="0" />
    </radialGradient>
  </defs>
);
const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
    <Defs />
    {children}
  </svg>
);

const DUST = Array.from({length: 36}).map((_, i) => ({
  x: random('x' + i) * W,
  y: random('y' + i) * H,
  r: 1.2 + random('r' + i) * 2.3,
  sp: 4 + random('s' + i) * 12,
  o: 0.05 + random('o' + i) * 0.13,
}));
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  // warm cold-indigo -> electric violet during the plasma scene
  const heat = interpolate(frame, [S.plasma, S.plasma + 60, S.rain, S.rain + 60], [0, 1, 1, 0.3], clamp);
  const top = mix('#0a0f22', '#2a1255', heat);
  const mid = mix('#101a33', '#3a1f6a', heat);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, #070a16 100%)`}}>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill="url(#vGlow)" />
        {DUST.map((p, i) => {
          const y = (((p.y - (frame * p.sp) / 30) % H) + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="#cdd8ff" opacity={p.o} />;
        })}
      </Svg>
    </AbsoluteFill>
  );
};

const SceneWrap: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const fin = interpolate(f, [0, 8], [0, 1], clamp);
  const fout = interpolate(f, [dur - 8, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{opacity: Math.min(fin, fout), transform: `scale(${interpolate(fin, [0, 1], [1.06, 1])})`}}>
      {children}
    </AbsoluteFill>
  );
};

const Label: React.FC<{children: React.ReactNode; y?: number; delay?: number}> = ({children, y = 250, delay = 3}) => {
  const e = usePop(delay);
  return (
    <div style={{position: 'absolute', top: y, width: W, textAlign: 'center', opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-26, 0])}px) scale(${interpolate(e, [0, 1], [0.9, 1])})`}}>
      <span style={{display: 'inline-block', padding: '14px 38px', borderRadius: 999, background: 'rgba(10,15,34,0.62)', border: '2px solid rgba(138,91,255,0.4)', color: 'white', fontSize: 46, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.45)'}}>{children}</span>
    </div>
  );
};

// brilliant-cut gem (points down)
const Gem: React.FC<{cx: number; cy: number; s?: number; fill?: string}> = ({cx, cy, s = 1, fill = 'url(#gemG)'}) => (
  <g transform={`translate(${cx} ${cy}) scale(${s})`}>
    <path d="M-44 -34 L44 -34 L66 -8 L0 60 L-66 -8 Z" fill={fill} stroke={C.diamondEdge} strokeWidth={3} />
    <line x1={-44} y1={-34} x2={-20} y2={-8} stroke="#fff" strokeWidth={2} opacity={0.6} />
    <line x1={44} y1={-34} x2={20} y2={-8} stroke="#fff" strokeWidth={2} opacity={0.6} />
    <line x1={-66} y1={-8} x2={66} y2={-8} stroke="#fff" strokeWidth={2} opacity={0.5} />
    <line x1={-20} y1={-8} x2={0} y2={60} stroke="#fff" strokeWidth={2} opacity={0.4} />
    <line x1={20} y1={-8} x2={0} y2={60} stroke="#fff" strokeWidth={2} opacity={0.4} />
  </g>
);

const ChamberBox: React.FC<{cx: number; cy: number; s?: number; viewport?: React.ReactNode}> = ({cx, cy, s = 1, viewport}) => (
  <g transform={`translate(${cx} ${cy}) scale(${s})`}>
    <rect x={-150} y={-150} width={300} height={300} rx={26} fill="url(#steelG)" stroke="#1a1f2a" strokeWidth={5} />
    {[-1, 1].map((sx) => [-1, 1].map((sy) => <circle key={`${sx}${sy}`} cx={sx * 120} cy={sy * 120} r={9} fill="#1a1f2a" />))}
    <circle cx={0} cy={0} r={96} fill="#0a1024" />
    <circle cx={0} cy={0} r={96} fill="none" stroke="#5a6273" strokeWidth={8} />
    {viewport}
  </g>
);

const sparkle = (x: number, y: number, r: number, op: number, key?: React.Key) => (
  <path key={key} d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" transform={`translate(${x} ${y}) scale(${r / 14})`} fill="#fff" opacity={op} filter="url(#glow)" />
);

// plasma ball
const PlasmaBall: React.FC<{cx: number; cy: number; r: number; frame: number}> = ({cx, cy, r, frame}) => (
  <g transform={`translate(${cx} ${cy})`} filter="url(#glow)">
    <circle cx={0} cy={0} r={r * 1.6} fill={C.plasma} opacity={0.18} filter="url(#soft)" />
    <circle cx={0} cy={0} r={r * (1 + 0.05 * Math.sin(frame / 4))} fill="url(#plasmaG)" />
    {Array.from({length: 7}).map((_, i) => {
      const a = (i / 7) * Math.PI * 2 + frame / 14;
      const seg = `M0 0 L ${Math.cos(a) * r * 0.6} ${Math.sin(a) * r * 0.6} L ${Math.cos(a + 0.3) * r * 1.1} ${Math.sin(a + 0.3) * r * 1.1}`;
      return <path key={i} d={seg} fill="none" stroke="#fff0ff" strokeWidth={3} opacity={0.4 + 0.4 * Math.abs(Math.sin(frame / 3 + i))} />;
    })}
  </g>
);

// ── Scene 1: HOOK ─────────────────────────────────────────────────────────────
const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const pop = usePop(2, 110);
  const q = 0.7 + 0.3 * Math.sin(f / 7);
  return (
    <AbsoluteFill>
      <Svg>
        <g transform={`scale(${interpolate(pop, [0, 1], [0.4, 1])})`} opacity={pop} style={{transformOrigin: '540px 740px'} as any}>
          <ChamberBox cx={540} cy={740} s={1} viewport={<>
            <Gem cx={0} cy={6} s={0.7} />
            {f % 26 < 3 && sparkle(30, -20, 16, 0.9)}
          </>} />
        </g>
        <text x={820} y={520} fontFamily={FONT} fontSize={150} fontWeight={900} fill={C.gold} textAnchor="middle" opacity={q} filter="url(#glow)">?</text>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 2: EVERYDAY ─────────────────────────────────────────────────────────
const SceneEveryday: React.FC = () => {
  const f = useCurrentFrame();
  const check = usePop(40, 150);
  return (
    <AbsoluteFill>
      <Label delay={2}>Scientists do it daily</Label>
      <Svg>
        {[-1, 0, 1].map((k, i) => {
          const e = usePop(6 + i * 8, 130);
          return (
            <g key={i} transform={`scale(${e})`} opacity={e} style={{transformOrigin: `${540 + k * 300}px 820px`} as any}>
              <ChamberBox cx={540 + k * 300} cy={820} s={0.62} viewport={<circle cx={0} cy={0} r={60} fill={C.plasma} opacity={0.4 + 0.2 * Math.sin(f / 6 + i)} />} />
            </g>
          );
        })}
        {/* calendar flipping */}
        <g transform="translate(540 470)" opacity={interpolate(f, [10, 24], [0, 1], clamp)}>
          <rect x={-90} y={-70} width={180} height={150} rx={14} fill="#e8ecf4" />
          <rect x={-90} y={-70} width={180} height={40} rx={14} fill={C.accent} />
          <text x={0} y={42} fontFamily={FONT} fontSize={70} fontWeight={900} fill="#1a2235" textAnchor="middle">{(Math.floor(f / 2) % 28) + 1}</text>
        </g>
        {/* green check */}
        <g transform={`translate(820 470) scale(${check})`} opacity={check}>
          <circle cx={0} cy={0} r={50} fill={C.green} />
          <path d="M-22 2 L-7 19 L26 -20" fill="none" stroke="#06301a" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: SEED ─────────────────────────────────────────────────────────────
const SceneSeed: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const drop = interpolate(f, [14, 40], [-260, 0], clamp);
  const gas = interpolate(f, [55, 120], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>A seed in carbon gas</Label>
      <Svg>
        {/* chamber cutaway */}
        <g transform="translate(540 800)" opacity={e}>
          <rect x={-240} y={-260} width={480} height={520} rx={24} fill="#0a1226" stroke="url(#steelG)" strokeWidth={10} />
          <clipPath id="chc"><rect x={-230} y={-250} width={460} height={500} rx={18} /></clipPath>
          <g clipPath="url(#chc)">
            {/* carbon gas fill */}
            <rect x={-230} y={250 - gas * 500} width={460} height={gas * 500} fill={C.accent} opacity={0.18} />
            {Array.from({length: 14}).map((_, i) => {
              const cx = -180 + (i * 53) % 380;
              const cy = 230 - ((f * 1.2 + i * 30) % (gas * 480 + 1));
              return <g key={i} opacity={gas}><circle cx={cx} cy={cy} r={12} fill="#1a2540" stroke={C.accentLite} strokeWidth={2} /><text x={cx} y={cy + 5} fontFamily={FONT} fontSize={14} fontWeight={800} fill={C.accentLite} textAnchor="middle">C</text></g>;
            })}
            {/* substrate + seed */}
            <rect x={-90} y={210} width={180} height={20} rx={6} fill="#3a4150" />
            <Gem cx={0} cy={170 + Math.max(0, -drop) * 0.0} s={0.5} />
          </g>
          {/* tweezer */}
          {f < 46 && (
            <g transform={`translate(0 ${drop})`}>
              <rect x={-6} y={-260} width={12} height={200} fill="#5a6273" />
              <path d="M-20 -60 L-6 -10 L0 -20 Z" fill="#8b97a8" />
              <path d="M20 -60 L6 -10 L0 -20 Z" fill="#8b97a8" />
            </g>
          )}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: PLASMA ───────────────────────────────────────────────────────────
const ScenePlasma: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const ball = usePop(18, 130);
  return (
    <AbsoluteFill>
      <Label delay={2}>Blasted into a purple star</Label>
      <Svg>
        <g transform="translate(540 800)" opacity={e}>
          <rect x={-240} y={-260} width={480} height={520} rx={24} fill="#0a1226" stroke="url(#steelG)" strokeWidth={10} />
          {/* microwave emitter on the left firing wave rings */}
          <g transform="translate(-240 -120)">
            <rect x={-60} y={-40} width={70} height={80} rx={10} fill="url(#steelG)" />
            {Array.from({length: 4}).map((_, i) => {
              const p = ((f / 8 + i / 4) % 1);
              return <path key={i} d={`M ${10 + p * 200} ${-60} A 60 60 0 0 1 ${10 + p * 200} 60`} fill="none" stroke={C.plasmaHot} strokeWidth={4} opacity={(1 - p) * 0.7} />;
            })}
          </g>
          {/* seed below */}
          <Gem cx={0} cy={190} s={0.5} />
          {/* plasma ball */}
          {ball > 0.02 && <PlasmaBall cx={0} cy={20} r={110 * ball} frame={f} />}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: RAIN ─────────────────────────────────────────────────────────────
const SceneRain: React.FC = () => {
  const f = useCurrentFrame();
  const layers = Math.min(7, Math.floor(interpolate(f, [16, 140], [0, 7], clamp)));
  return (
    <AbsoluteFill>
      <Label delay={2}>Atoms rain, layer by layer</Label>
      <Svg>
        {/* plasma above */}
        <PlasmaBall cx={540} cy={520} r={90} frame={f} />
        {/* raining carbon atoms */}
        {Array.from({length: 14}).map((_, i) => {
          const t = ((f * 1.6 + i * 7) % 46) / 46;
          const x = 420 + (i * 31) % 240;
          return <circle key={i} cx={x} cy={600 + t * 360} r={7} fill={C.accentLite} opacity={(1 - t) * 0.9} filter="url(#glow)" />;
        })}
        {/* growing lattice on the seed */}
        <g transform="translate(540 1040)">
          <Gem cx={0} cy={40} s={0.5} />
          {Array.from({length: layers}).map((_, i) => (
            <rect key={i} x={-70 + i * 4} y={20 - i * 18} width={140 - i * 8} height={16} rx={4} fill="url(#gemG)" opacity={0.92} stroke={C.diamondEdge} strokeWidth={1.5} />
          ))}
        </g>
        {/* layer counter */}
        <g transform="translate(840 980)">
          <rect x={-70} y={-40} width={140} height={80} rx={14} fill="rgba(10,15,34,0.7)" stroke={C.accent} strokeWidth={3} />
          <text x={0} y={14} fontFamily={FONT} fontSize={50} fontWeight={900} fill={C.gold} textAnchor="middle">{layers}</text>
          <text x={0} y={-46} fontFamily={FONT} fontSize={26} fontWeight={800} fill={C.accentLite} textAnchor="middle">layers</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: GROW — lab vs earth, identical ───────────────────────────────────
const SceneGrow: React.FC = () => {
  const f = useCurrentFrame();
  const week = interpolate(f, [14, 90], [0, 1], clamp);
  const stamp = usePop(96, 150);
  const crack = f > 70;
  return (
    <AbsoluteFill>
      <Label delay={2}>Identical to natural ones</Label>
      <Svg>
        {/* LEFT: lab crystal growing */}
        <g transform="translate(290 760)">
          <text x={0} y={-180} fontFamily={FONT} fontSize={34} fontWeight={800} fill={C.accentLite} textAnchor="middle">LAB</text>
          <Gem cx={0} cy={0} s={0.5 + week * 0.7} />
          {/* week bar */}
          <rect x={-110} y={170} width={220} height={20} rx={10} fill="#1a2540" />
          <rect x={-110} y={170} width={220 * week} height={20} rx={10} fill={C.accent} />
          <text x={0} y={230} fontFamily={FONT} fontSize={28} fontWeight={800} fill={C.white} textAnchor="middle">WEEK {Math.ceil(week * 6) || 1}</text>
        </g>
        {/* RIGHT: earth cross-section */}
        <g transform="translate(790 760)">
          <text x={0} y={-180} fontFamily={FONT} fontSize={34} fontWeight={800} fill={C.earth} textAnchor="middle">EARTH</text>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={-130} y={-120 + i * 70} width={260} height={70} fill={mix(C.earth, C.earthDk, i / 3)} />)}
          <g transform={`translate(${crack ? (random('s' + (f % 5)) - 0.5) * 8 : 0} 40)`}><Gem cx={0} cy={0} s={0.6} /></g>
          {crack && <path d="M-130 -10 L-40 30 L20 -10 L130 40" fill="none" stroke="#1a1008" strokeWidth={4} opacity={0.6} />}
        </g>
        {/* IDENTICAL stamp */}
        <g transform={`translate(540 1160) scale(${stamp})`} opacity={stamp}>
          <rect x={-200} y={-46} width={400} height={92} rx={18} fill={C.gold} />
          <text x={0} y={18} fontFamily={FONT} fontSize={48} fontWeight={900} fill="#3a2f00" textAnchor="middle">100% IDENTICAL</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 7: REVEAL — cut + polished payoff ───────────────────────────────────
const SceneReveal: React.FC = () => {
  const f = useCurrentFrame();
  const cut = interpolate(f, [10, 50], [0, 1], clamp);
  const loupe = usePop(40, 130);
  const txt = usePop(70, 130);
  return (
    <AbsoluteFill>
      <Svg>
        {/* spotlight */}
        <ellipse cx={540} cy={700} rx={300} ry={120} fill={C.accent} opacity={0.2} filter="url(#soft)" />
        <g transform={`translate(540 680) scale(${interpolate(cut, [0, 1], [0.9, 1.5])})`}>
          <Gem cx={0} cy={0} s={1} />
        </g>
        {/* facet-cut sweep lines */}
        {cut < 1 && Array.from({length: 5}).map((_, i) => (
          <line key={i} x1={300} y1={560 + i * 60} x2={300 + cut * 480} y2={560 + i * 60} stroke="#fff" strokeWidth={2} opacity={0.4} />
        ))}
        {/* sparkle burst */}
        {cut > 0.7 && Array.from({length: 8}).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const t = ((f) % 20) / 20;
          return <line key={i} x1={540} y1={680} x2={540 + Math.cos(a) * (60 + t * 80)} y2={680 + Math.sin(a) * (60 + t * 80)} stroke="#fff" strokeWidth={3} opacity={(1 - t) * 0.7} />;
        })}
        {/* loupe */}
        <g transform={`translate(800 560) scale(${loupe})`} opacity={loupe}>
          <circle cx={0} cy={0} r={70} fill="rgba(190,239,255,0.1)" stroke="url(#steelG)" strokeWidth={10} />
          <line x1={50} y1={50} x2={110} y2={110} stroke="url(#steelG)" strokeWidth={14} strokeLinecap="round" />
          <text x={0} y={8} fontFamily={FONT} fontSize={28} fontWeight={900} fill={C.gold} textAnchor="middle">?!</text>
        </g>
      </Svg>
      <div style={{position: 'absolute', top: 1050, width: W, textAlign: 'center', fontFamily: FONT, opacity: txt, transform: `translateY(${interpolate(txt, [0, 1], [40, 0])}px)`}}>
        <div style={{color: 'white', fontSize: 56, fontWeight: 800}}>Grown in a microwave.</div>
        <div style={{color: C.diamondEdge, fontSize: 70, fontWeight: 900, lineHeight: 1.0}}>Real as the ones</div>
        <div style={{color: C.gold, fontSize: 70, fontWeight: 900}}>underground.</div>
      </div>
    </AbsoluteFill>
  );
};

// ── karaoke captions ──────────────────────────────────────────────────────────
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
  const pageIn = interpolate(t, [page.start - 0.08, page.start + 0.1], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', bottom: 250, left: 60, width: W - 120, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 76, lineHeight: 1.1, opacity: pageIn, transform: `translateY(${interpolate(pageIn, [0, 1], [16, 0])}px)`}}>
      <span style={{background: 'rgba(7,10,22,0.58)', padding: '12px 26px', borderRadius: 22, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
        {page.words.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.05;
          return (
            <span key={i} style={{display: 'inline-block', color: active ? C.gold : 'white', textShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 16px rgba(0,0,0,0.45)', margin: '0 16px', transform: `scale(${active ? 1.13 : 1})`}}>{w.text}</span>
          );
        })}
      </span>
    </div>
  );
};

export const Diamond: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('diamond_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.13} />

      <Sequence from={S.hook} durationInFrames={S.everyday - S.hook}><SceneWrap dur={S.everyday - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.everyday} durationInFrames={S.seed - S.everyday}><SceneWrap dur={S.seed - S.everyday}><SceneEveryday /></SceneWrap></Sequence>
      <Sequence from={S.seed} durationInFrames={S.plasma - S.seed}><SceneWrap dur={S.plasma - S.seed}><SceneSeed /></SceneWrap></Sequence>
      <Sequence from={S.plasma} durationInFrames={S.rain - S.plasma}><SceneWrap dur={S.rain - S.plasma}><ScenePlasma /></SceneWrap></Sequence>
      <Sequence from={S.rain} durationInFrames={S.grow - S.rain}><SceneWrap dur={S.grow - S.rain}><SceneRain /></SceneWrap></Sequence>
      <Sequence from={S.grow} durationInFrames={S.reveal - S.grow}><SceneWrap dur={S.reveal - S.grow}><SceneGrow /></SceneWrap></Sequence>
      <Sequence from={S.reveal} durationInFrames={DURATION_IN_FRAMES - S.reveal}><SceneWrap dur={DURATION_IN_FRAMES - S.reveal}><SceneReveal /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

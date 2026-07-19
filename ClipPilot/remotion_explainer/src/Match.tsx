/**
 * "A Match Is A Tiny Bomb You Hold" — fast snappy explainer (Remotion). Transcript #004.
 * Voice: edge-tts AndrewMultilingual. Energy from fast in-comp animation; calm recut.
 * Captions + scene timing driven by match_words.json.
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
import wordsData from './match_words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1060; // 35.3s (audio 35.10s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

const S = {hook: 0, soak: 104, paste: 331, strike: 467, phos: 646, twist: 807, erupt: 901};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const C = {
  ink: '#0c0907',
  white: '#FFFFFF',
  gold: '#ffd23f',
  accent: '#ff7a1a',
  key: '#ff3b1f',
  wood: '#c98a4b',
  woodDk: '#8a5a2b',
  sulfur: '#e8c14a',
  glass: '#bfe6ff',
  phos: '#a3372b',
  ember: '#ff5b2e',
  red: '#ff5b4d',
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
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="9" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="24" />
    </filter>
    <linearGradient id="woodG" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#e0a861" />
      <stop offset="50%" stopColor="#c98a4b" />
      <stop offset="100%" stopColor="#8a5a2b" />
    </linearGradient>
    <radialGradient id="headG" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stopColor="#d9583f" />
      <stop offset="100%" stopColor="#7e261c" />
    </radialGradient>
    <radialGradient id="flameG" cx="50%" cy="75%" r="70%">
      <stop offset="0%" stopColor="#fff6cf" />
      <stop offset="40%" stopColor="#ffd23f" />
      <stop offset="75%" stopColor="#ff7a1a" />
      <stop offset="100%" stopColor="#ff3b1f" />
    </radialGradient>
    <linearGradient id="sulfurG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#f3da66" />
      <stop offset="100%" stopColor="#c79a2e" />
    </linearGradient>
    <radialGradient id="topGlow" cx="50%" cy="26%" r="60%">
      <stop offset="0%" stopColor="#ff9d4d" stopOpacity="0.16" />
      <stop offset="100%" stopColor="#ff9d4d" stopOpacity="0" />
    </radialGradient>
  </defs>
);
const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
    <Defs />
    {children}
  </svg>
);

const SPECK = Array.from({length: 30}).map((_, i) => ({
  x: random('x' + i) * W,
  y: random('y' + i) * H,
  r: 1.3 + random('r' + i) * 2.2,
  sp: 5 + random('s' + i) * 13,
  o: 0.05 + random('o' + i) * 0.12,
}));
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  // warm flare at the climax
  const flare = interpolate(frame, [S.erupt, S.erupt + 40, S.erupt + 120], [0, 0.18, 0.08], clamp);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${mix('#14100c', '#3a1e10', flare)} 0%, #1c1410 55%, #0c0907 100%)`}}>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill="url(#topGlow)" />
        {SPECK.map((p, i) => {
          const y = (((p.y - (frame * p.sp) / 30) % H) + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="#ffce9a" opacity={p.o} />;
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
      <span style={{display: 'inline-block', padding: '14px 38px', borderRadius: 999, background: 'rgba(20,16,12,0.6)', border: '2px solid rgba(255,154,77,0.36)', color: 'white', fontSize: 46, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.45)'}}>{children}</span>
    </div>
  );
};

// matchstick (vertical), head at top
const Match: React.FC<{cx: number; cy: number; s?: number; lit?: number}> = ({cx, cy, s = 1, lit = 0}) => (
  <g transform={`translate(${cx} ${cy}) scale(${s})`}>
    <rect x={-12} y={-30} width={24} height={300} rx={12} fill="url(#woodG)" />
    <rect x={-5} y={-20} width={5} height={280} rx={3} fill="#fff" opacity={0.18} />
    <ellipse cx={0} cy={-44} rx={30} ry={42} fill={lit ? mix('#7e261c', '#2a1208', lit) : 'url(#headG)'} />
  </g>
);

// layered flame (teardrop), flickers with frame
const Flame: React.FC<{cx: number; cy: number; scale: number; frame: number}> = ({cx, cy, scale, frame}) => {
  const w = 6 * Math.sin(frame / 3);
  const w2 = 4 * Math.sin(frame / 2.2 + 1);
  const tongue = (k: number) =>
    `M0 60 C ${-46 + w} ${18}, ${-30 + w2} ${-44}, ${0 + w2} ${-96 - k} C ${30 - w2} ${-44}, ${46 - w} 18, 0 60 Z`;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} filter="url(#glow)">
      <path d={tongue(0)} fill="url(#flameG)" />
      <path d={tongue(-18)} fill="#ffb347" opacity={0.9} transform="scale(0.68)" />
      <path d={tongue(-30)} fill="#fff6cf" opacity={0.95} transform="scale(0.4) translate(0 30)" />
    </g>
  );
};

// ── Scene 1: HOOK — match + danger badge ──────────────────────────────────────
const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const pop = usePop(2, 110);
  const badge = usePop(14, 150);
  const wob = f > 18 ? 1.6 * Math.sin(f / 3) : 0;
  return (
    <AbsoluteFill>
      <Svg>
        <g transform={`translate(540 760) rotate(${wob}) scale(${interpolate(pop, [0, 1], [0.4, 1])})`} opacity={pop}>
          <Match cx={0} cy={-120} s={1.3} />
          {/* shock-ring glyph in the head */}
          {Array.from({length: 3}).map((_, i) => {
            const p = ((f / 14 + i / 3) % 1);
            return <circle key={i} cx={0} cy={-176} r={10 + p * 34} fill="none" stroke={C.gold} strokeWidth={3} opacity={(1 - p) * 0.7} />;
          })}
        </g>
        {/* caution badge */}
        <g transform={`translate(760 470) scale(${badge})`} opacity={badge}>
          <path d="M0 -64 L60 44 L-60 44 Z" fill={C.key} stroke="#fff" strokeWidth={4} filter="url(#glow)" />
          <text x={0} y={36} fontFamily={FONT} fontSize={70} fontWeight={900} fill="white" textAnchor="middle">!</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 2: SOAK — chemical bath + smolder vs flame ──────────────────────────
const SceneSoak: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const level = interpolate(f, [16, 70], [980, 880], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Soaked so it smolders</Label>
      <Svg>
        {/* tank */}
        <g opacity={e}>
          <rect x={150} y={620} width={420} height={420} rx={18} fill="#123" opacity={0.5} stroke="#2a4a55" strokeWidth={5} />
          <rect x={156} y={level} width={408} height={1040 - level} rx={10} fill="#2aa0b0" opacity={0.45} />
          {/* sticks dipping */}
          {[0, 1, 2, 3].map((i) => {
            const dx = 230 + i * 80;
            const dy = interpolate(f, [10 + i * 6, 50 + i * 6], [560, 760], clamp);
            return (
              <g key={i}>
                <rect x={dx - 9} y={dy} width={18} height={260} rx={9} fill="url(#woodG)" />
                {/* absorption dots rising */}
                {Array.from({length: 3}).map((_, k) => {
                  const t = ((f * 1.6 + k * 12 + i * 5) % 60) / 60;
                  return <circle key={k} cx={dx} cy={dy + 250 - t * 230} r={4} fill="#7fe0d0" opacity={(1 - t) * 0.8} />;
                })}
              </g>
            );
          })}
        </g>
        {/* comparison: smolder (good) vs flame (crossed out) */}
        <g transform="translate(720 760)" opacity={interpolate(f, [60, 90], [0, 1], clamp)}>
          {/* smolder stick */}
          <rect x={-12} y={-120} width={24} height={260} rx={12} fill="url(#woodG)" />
          <circle cx={0} cy={-120} r={14 + 4 * Math.sin(f / 5)} fill={C.ember} filter="url(#glow)" opacity={0.9} />
          {Array.from({length: 3}).map((_, k) => {
            const t = ((f + k * 20) % 60) / 60;
            return <circle key={k} cx={4 * Math.sin(f / 6 + k)} cy={-150 - t * 80} r={6} fill={'#9a9a9a'} opacity={(1 - t) * 0.3} />;
          })}
          <text x={0} y={180} fontFamily={FONT} fontSize={30} fontWeight={800} fill={C.gold} textAnchor="middle">slow smolder</text>
          {/* crossed-out fast flame */}
          <g transform="translate(220 0)">
            <rect x={-12} y={-120} width={24} height={260} rx={12} fill="url(#woodG)" />
            <Flame cx={0} cy={-160} scale={0.7} frame={f} />
            <line x1={-90} y1={-220} x2={90} y2={20} stroke={C.red} strokeWidth={12} strokeLinecap="round" />
            <text x={0} y={180} fontFamily={FONT} fontSize={30} fontWeight={800} fill="#ffb3aa" textAnchor="middle">no burst</text>
          </g>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: PASTE — dunk in sulfur + glass ───────────────────────────────────
const ScenePaste: React.FC = () => {
  const f = useCurrentFrame();
  const dip = interpolate(f, [12, 46], [0, 1], clamp);
  const lens = usePop(50, 130);
  const headY = 560 + 120 * Math.sin(Math.min(1, dip) * Math.PI); // dip down then up
  return (
    <AbsoluteFill>
      <Label delay={2}>Dunked in sulfur paste</Label>
      <Svg>
        {/* paste pot */}
        <rect x={360} y={720} width={360} height={220} rx={20} fill="#3a2e10" stroke="#5a4a1a" strokeWidth={5} />
        <ellipse cx={540} cy={720} rx={180} ry={36} fill="url(#sulfurG)" />
        {/* match dipping tip-first */}
        <g transform={`translate(540 ${headY})`}>
          <rect x={-12} y={-300} width={24} height={300} rx={12} fill="url(#woodG)" />
          <ellipse cx={0} cy={0} rx={32} ry={44} fill={dip > 0.5 ? 'url(#sulfurG)' : 'url(#headG)'} />
        </g>
        {/* magnifier inset: sulfur blobs + glass shards */}
        <g transform={`translate(760 1080) scale(${lens})`} opacity={lens}>
          <circle cx={0} cy={0} r={130} fill="#1c1208" stroke={C.gold} strokeWidth={8} />
          {Array.from({length: 7}).map((_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return <circle key={i} cx={Math.cos(a) * 55} cy={Math.sin(a) * 55} r={20} fill="url(#sulfurG)" />;
          })}
          {/* glass shards twinkle */}
          {Array.from({length: 6}).map((_, i) => {
            const a = (i / 6) * Math.PI * 2 + 0.4;
            const tw = Math.abs(Math.sin(f / 4 + i));
            return <path key={i} d="M0 -12 L4 -3 L12 0 L4 3 L0 12 L-4 3 L-12 0 L-4 -3 Z" transform={`translate(${Math.cos(a) * 80} ${Math.sin(a) * 80}) scale(${0.6 + tw * 0.6})`} fill={C.glass} opacity={0.5 + tw * 0.5} />;
          })}
        </g>
        <g transform="translate(310 1150)" opacity={interpolate(f, [40, 60], [0, 1], clamp)}>
          <text x={0} y={0} fontFamily={FONT} fontSize={34} fontWeight={800} fill={C.sulfur}>sulfur +</text>
          <text x={0} y={42} fontFamily={FONT} fontSize={34} fontWeight={900} fill={C.glass}>powdered glass</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: STRIKE — friction = heat (KEY REVEAL) ────────────────────────────
const SceneStrike: React.FC = () => {
  const f = useCurrentFrame();
  const drag = interpolate(f, [10, 40], [-260, 240], clamp);
  const contact = f > 36;
  const stamp = usePop(56, 150);
  const merc = interpolate(f, [38, 75], [0, 220], clamp);
  const flash = interpolate(f, [40, 48, 60], [0, 0.5, 0], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Friction makes instant heat</Label>
      <Svg>
        {flash > 0 && <rect x={0} y={0} width={W} height={H} fill="#fff" opacity={flash} />}
        {/* striker strip */}
        <rect x={200} y={760} width={520} height={40} rx={12} fill="#5a3a2a" stroke="#3a241a" strokeWidth={4} />
        {/* dragging match head */}
        <g transform={`translate(${540 + drag} 720)`}>
          {/* speed lines */}
          {Array.from({length: 5}).map((_, i) => (
            <line key={i} x1={-60 - i * 30} y1={20 + i * 8} x2={-20 - i * 30} y2={20 + i * 8} stroke="#fff" strokeWidth={4} opacity={0.3} />
          ))}
          <rect x={-12} y={-180} width={24} height={200} rx={12} fill="url(#woodG)" />
          <ellipse cx={0} cy={36} rx={30} ry={40} fill="url(#headG)" />
        </g>
        {/* friction sparks at contact */}
        {contact && Array.from({length: 16}).map((_, i) => {
          const a = -Math.PI / 2 + (random('a' + i) - 0.5) * 2.4;
          const t = ((f * 1.6 + i * 3) % 18) / 18;
          const r = t * 150;
          return <line key={i} x1={540 + drag} y1={760} x2={540 + drag + Math.cos(a) * r} y2={760 + Math.sin(a) * r} stroke={i % 2 ? C.gold : '#fff'} strokeWidth={4} opacity={(1 - t) * 0.95} strokeLinecap="round" />;
        })}
        {contact && <circle cx={540 + drag} cy={760} r={interpolate(f % 20, [0, 6, 20], [0, 50, 0], clamp)} fill="none" stroke={C.accent} strokeWidth={6} opacity={0.5} />}
        {/* thermometer */}
        <g transform="translate(900 720)">
          <rect x={-16} y={-220} width={32} height={240} rx={16} fill="#222" stroke="#555" strokeWidth={3} />
          <circle cx={0} cy={40} r={34} fill="#222" stroke="#555" strokeWidth={3} />
          <rect x={-9} y={20 - merc} width={18} height={merc + 20} rx={9} fill={C.key} />
          <circle cx={0} cy={40} r={24} fill={C.key} />
        </g>
        {/* stamp */}
        <g transform={`translate(540 1120) scale(${interpolate(stamp, [0, 1], [1.6, 1])})`} opacity={interpolate(f, [56, 62], [0, 1], clamp)}>
          <text x={0} y={0} fontFamily={FONT} fontSize={72} fontWeight={900} fill={C.gold} textAnchor="middle" filter="url(#glow)">FRICTION = HEAT</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: PHOS — red phosphorus on the box ─────────────────────────────────
const ScenePhos: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const lens = usePop(28, 130);
  return (
    <AbsoluteFill>
      <Label delay={2}>It lights the box's strip</Label>
      <Svg>
        {/* matchbox */}
        <g transform="translate(480 740)" opacity={e}>
          <rect x={-220} y={-130} width={440} height={300} rx={18} fill="#7a4a2a" stroke="#5a3520" strokeWidth={5} />
          <rect x={-150} y={-90} width={300} height={220} rx={10} fill="#9a6038" />
          {/* striker strip on the side */}
          <rect x={-250} y={-130} width={40} height={300} rx={8} fill="#3a241a" />
        </g>
        {/* magnified strip: grainy red phosphorus */}
        <g transform={`translate(820 760) scale(${lens})`} opacity={lens}>
          <circle cx={0} cy={0} r={130} fill="#1a0d0a" stroke={C.gold} strokeWidth={8} />
          {Array.from({length: 40}).map((_, i) => (
            <circle key={i} cx={(random('px' + i) - 0.5) * 200} cy={(random('py' + i) - 0.5) * 200} r={5 + random('pr' + i) * 4} fill={interpolate(f, [30 + i, 50 + i], [0, 1], clamp) > 0.5 ? mix(C.phos, '#e8d0c0', interpolate(f, [40, 70], [0, 1], clamp)) : C.phos} />
          ))}
          {/* ignite sparkle */}
          <circle cx={0} cy={0} r={interpolate(f % 24, [0, 8, 24], [0, 30, 0], clamp)} fill={C.gold} opacity={0.7} filter="url(#glow)" />
          <text x={0} y={170} fontFamily={FONT} fontSize={34} fontWeight={900} fill={C.phos} textAnchor="middle">red phosphorus</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: TWIST — the fire isn't in the match ──────────────────────────────
const SceneTwist: React.FC = () => {
  const f = useCurrentFrame();
  const noPop = usePop(8, 150);
  const ball = ((f) % 50) / 50;
  // arc from strip (right) to match (left)
  const ax = (t: number) => 760 - t * 420;
  const ay = (t: number) => 700 - Math.sin(t * Math.PI) * 180;
  return (
    <AbsoluteFill>
      <Svg>
        {/* match (left) with crossed flame */}
        <g transform="translate(360 720)">
          <Match cx={0} cy={-60} s={1.1} />
          <g transform={`scale(${noPop})`} opacity={noPop}>
            <Flame cx={0} cy={-150} scale={0.5} frame={f} />
            <line x1={-70} y1={-210} x2={70} y2={-70} stroke={C.red} strokeWidth={12} strokeLinecap="round" />
          </g>
          <text x={0} y={120} fontFamily={FONT} fontSize={36} fontWeight={900} fill="#ffb3aa" textAnchor="middle">NOT here</text>
        </g>
        {/* strip (right) glowing = true origin */}
        <g transform="translate(800 720)">
          <rect x={-30} y={-120} width={60} height={260} rx={12} fill="#3a241a" stroke={C.accent} strokeWidth={4} />
          <circle cx={0} cy={0} r={40 + 8 * Math.sin(f / 5)} fill={C.accent} opacity={0.45} filter="url(#glow)" />
          <text x={0} y={200} fontFamily={FONT} fontSize={36} fontWeight={900} fill={C.gold} textAnchor="middle">STARTS here</text>
        </g>
        {/* dashed arc + traveling fireball */}
        <path d={`M760 700 Q 550 480 360 660`} fill="none" stroke={C.accent} strokeWidth={4} strokeDasharray="10 12" opacity={0.6} />
        <circle cx={ax(ball)} cy={ay(ball)} r={12} fill={C.ember} filter="url(#glow)" />
      </Svg>
      <div style={{position: 'absolute', top: 1080, width: W, textAlign: 'center', fontFamily: FONT, opacity: interpolate(f, [20, 40], [0, 1], clamp)}}>
        <div style={{color: 'white', fontSize: 56, fontWeight: 800}}>The fire was never</div>
        <div style={{color: C.gold, fontSize: 84, fontWeight: 900}}>in the match.</div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 7: ERUPT — payoff flame ─────────────────────────────────────────────
const SceneErupt: React.FC = () => {
  const f = useCurrentFrame();
  const zip = interpolate(f, [4, 18], [0, 1], clamp);
  const bloom = usePop(18, 130);
  const txt = usePop(50, 130);
  const flash = interpolate(f, [18, 26, 44], [0, 0.45, 0], clamp);
  return (
    <AbsoluteFill>
      <Svg>
        {flash > 0 && <rect x={0} y={0} width={W} height={H} fill="#ffe6b0" opacity={flash} />}
        <Match cx={540} cy={820} s={1.4} lit={interpolate(f, [18, 40], [0, 0.7], clamp)} />
        {/* zipping spark before bloom */}
        {zip < 1 && <circle cx={interpolate(zip, [0, 1], [820, 540])} cy={interpolate(zip, [0, 1], [640, 700])} r={12} fill={C.ember} filter="url(#glow)" />}
        {bloom > 0.02 && <Flame cx={540} cy={680} scale={1.4 * bloom} frame={f} />}
        {/* embers rising */}
        {bloom > 0.2 && Array.from({length: 12}).map((_, i) => {
          const t = ((f + i * 9) % 60) / 60;
          return <circle key={i} cx={540 + (random('e' + i) - 0.5) * 200 * t} cy={680 - t * 360} r={4} fill={C.gold} opacity={(1 - t) * 0.9} filter="url(#glow)" />;
        })}
      </Svg>
      <div style={{position: 'absolute', top: 1140, width: W, textAlign: 'center', fontFamily: FONT, opacity: txt, transform: `translateY(${interpolate(txt, [0, 1], [40, 0])}px)`}}>
        <div style={{color: 'white', fontSize: 54, fontWeight: 800, lineHeight: 1.1}}>Friction. Glass.</div>
        <div style={{color: C.accent, fontSize: 64, fontWeight: 900}}>A chemical on the box.</div>
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
      <span style={{background: 'rgba(12,9,7,0.58)', padding: '12px 26px', borderRadius: 22, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
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

export const MatchVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('match_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.13} />

      <Sequence from={S.hook} durationInFrames={S.soak - S.hook}><SceneWrap dur={S.soak - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.soak} durationInFrames={S.paste - S.soak}><SceneWrap dur={S.paste - S.soak}><SceneSoak /></SceneWrap></Sequence>
      <Sequence from={S.paste} durationInFrames={S.strike - S.paste}><SceneWrap dur={S.strike - S.paste}><ScenePaste /></SceneWrap></Sequence>
      <Sequence from={S.strike} durationInFrames={S.phos - S.strike}><SceneWrap dur={S.phos - S.strike}><SceneStrike /></SceneWrap></Sequence>
      <Sequence from={S.phos} durationInFrames={S.twist - S.phos}><SceneWrap dur={S.twist - S.phos}><ScenePhos /></SceneWrap></Sequence>
      <Sequence from={S.twist} durationInFrames={S.erupt - S.twist}><SceneWrap dur={S.erupt - S.twist}><SceneTwist /></SceneWrap></Sequence>
      <Sequence from={S.erupt} durationInFrames={DURATION_IN_FRAMES - S.erupt}><SceneWrap dur={DURATION_IN_FRAMES - S.erupt}><SceneErupt /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

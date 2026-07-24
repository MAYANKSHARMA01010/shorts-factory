/**
 * "Your Pencil Has Been Lying To You" — fast snappy explainer (Remotion). Transcript #006.
 * Voice: edge-tts AndrewMultilingual. Calm-but-fast recut downstream.
 * Captions + scene timing driven by pencil_words.json.
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
import wordsData from './pencil_words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1098; // 36.6s (audio 36.34s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

const S = {hook: 0, grind: 123, extrude: 325, bake: 498, sandwich: 626, finish: 829};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const C = {
  ink: '#120d08',
  white: '#FFFFFF',
  gold: '#FFD23F',
  graphite: '#3a3f4a',
  graphiteLite: '#5d6470',
  clay: '#a8895f',
  clayWet: '#7a5c38',
  cedar: '#d9a066',
  cedarDk: '#a8632f',
  yellow: '#FFC21E',
  yellowDk: '#e0a000',
  eraser: '#ff6f8e',
  ferrule: '#cdd5e0',
  oven: '#ff7a3c',
  red: '#ff5b4d',
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
const sinePath = (x0: number, y0: number, len: number, amp: number, wl: number, ph: number) => {
  let d = `M ${x0} ${y0}`;
  for (let x = 6; x <= len; x += 6) d += ` L ${(x0 + x).toFixed(1)} ${(y0 + amp * Math.sin((x / wl) * Math.PI * 2 + ph)).toFixed(1)}`;
  return d;
};

const Defs: React.FC = () => (
  <defs>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="8" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="22" />
    </filter>
    <linearGradient id="yellowG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#ffd24a" />
      <stop offset="100%" stopColor="#e0a000" />
    </linearGradient>
    <linearGradient id="graphiteG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#5d6470" />
      <stop offset="100%" stopColor="#2a2e36" />
    </linearGradient>
    <linearGradient id="cedarG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#e3ad72" />
      <stop offset="100%" stopColor="#a8632f" />
    </linearGradient>
    <linearGradient id="metalG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f1f4f9" />
      <stop offset="50%" stopColor="#bcc6d3" />
      <stop offset="100%" stopColor="#8b97a8" />
    </linearGradient>
    <radialGradient id="topGlow" cx="50%" cy="24%" r="62%">
      <stop offset="0%" stopColor="#ffb066" stopOpacity="0.14" />
      <stop offset="100%" stopColor="#ffb066" stopOpacity="0" />
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
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #241a10 0%, #1a140d 52%, #120d08 100%)'}}>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill="url(#topGlow)" />
        {SPECK.map((p, i) => {
          const y = (((p.y - (frame * p.sp) / 30) % H) + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="#e8c79a" opacity={p.o} />;
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
      <span style={{display: 'inline-block', padding: '14px 38px', borderRadius: 999, background: 'rgba(18,13,8,0.62)', border: '2px solid rgba(255,176,102,0.36)', color: 'white', fontSize: 46, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.45)'}}>{children}</span>
    </div>
  );
};

// the iconic pencil (tip points left)
const Pencil: React.FC<{cx: number; cy: number; s?: number; rot?: number; painted?: number}> = ({cx, cy, s = 1, rot = 0, painted = 1}) => (
  <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${s})`}>
    {/* cedar tip cone */}
    <path d="M-280 0 L-210 -30 L-210 30 Z" fill="url(#cedarG)" />
    {/* graphite point (SLATE, not silver) */}
    <path d="M-280 0 L-250 -11 L-250 11 Z" fill={C.graphite} />
    {/* body */}
    <rect x={-210} y={-32} width={400} height={64} rx={8} fill={painted ? 'url(#yellowG)' : 'url(#cedarG)'} />
    <rect x={-210} y={-28} width={400} height={10} rx={5} fill="#fff" opacity={0.18} />
    {/* ferrule */}
    <rect x={190} y={-32} width={46} height={64} fill="url(#metalG)" />
    {/* eraser */}
    <rect x={236} y={-30} width={44} height={60} rx={22} fill={C.eraser} />
  </g>
);

// ── Scene 1: HOOK — no lead, it's graphite ────────────────────────────────────
const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const pop = usePop(2, 110);
  const lens = usePop(16, 130);
  const flip = interpolate(f, [44, 60], [0, 1], clamp);
  const badge = usePop(40, 150);
  const wob = f > 50 ? 1.8 * Math.sin(f / 2.6) : 0;
  return (
    <AbsoluteFill>
      <Svg>
        <g transform={`translate(540 700) rotate(${-18 + wob}) scale(${interpolate(pop, [0, 1], [0.4, 1])})`} opacity={pop}>
          <Pencil cx={0} cy={0} s={1.0} />
        </g>
        {/* magnifier over the tip */}
        <g transform={`translate(${interpolate(lens, [0, 1], [-200, 320])} 800)`} opacity={lens}>
          <circle cx={0} cy={0} r={120} fill="rgba(180,210,255,0.12)" stroke="url(#metalG)" strokeWidth={10} />
          {/* cross-section: cedar ring + graphite core */}
          <circle cx={0} cy={0} r={70} fill="url(#cedarG)" />
          <circle cx={0} cy={0} r={34} fill={C.graphite} />
          <line x1={70} y1={70} x2={130} y2={130} stroke="url(#metalG)" strokeWidth={16} strokeLinecap="round" />
        </g>
        {/* tag flip LEAD -> GRAPHITE */}
        <g transform="translate(540 1120)">
          <rect x={-230} y={-52} width={460} height={104} rx={20} fill={flip > 0.5 ? '#2a2e36' : '#3a1a18'} />
          {flip < 0.5 ? (
            <>
              <text x={0} y={20} fontFamily={FONT} fontSize={64} fontWeight={900} fill={C.red} textAnchor="middle">"LEAD"</text>
              <line x1={-160} y1={0} x2={interpolate(f, [30, 44], [-160, 160], clamp)} y2={0} stroke={C.red} strokeWidth={10} strokeLinecap="round" />
            </>
          ) : (
            <text x={0} y={20} fontFamily={FONT} fontSize={64} fontWeight={900} fill={C.gold} textAnchor="middle">it's GRAPHITE</text>
          )}
        </g>
        {/* warning badge at eraser */}
        <g transform={`translate(820 470) scale(${badge})`} opacity={badge}>
          <circle cx={0} cy={0} r={56} fill={C.red} filter="url(#glow)" />
          <text x={0} y={22} fontFamily={FONT} fontSize={70} fontWeight={900} fill="white" textAnchor="middle">!</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 2: GRIND — graphite + clay ──────────────────────────────────────────
const SceneGrind: React.FC = () => {
  const f = useCurrentFrame();
  const slam = interpolate(f, [16, 26], [-120, 0], clamp);
  const paste = interpolate(f, [40, 100], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Graphite + wet clay</Label>
      <Svg>
        {/* crusher piston */}
        <g transform={`translate(420 ${560 + slam})`}>
          <rect x={-90} y={-120} width={180} height={120} rx={10} fill="url(#metalG)" stroke={C.graphite} strokeWidth={4} />
        </g>
        {/* graphite rock under piston (before powder) */}
        {f < 30 && <path d="M340 620 L420 600 L500 630 L470 690 L370 685 Z" fill="url(#graphiteG)" stroke="#23272f" strokeWidth={3} />}
        {/* powder shower */}
        {f >= 24 && f < 90 && Array.from({length: 16}).map((_, i) => {
          const t = ((f * 1.5 + i * 6) % 50) / 50;
          return <circle key={i} cx={420 + (random('p' + i) - 0.5) * 200} cy={640 + t * 220} r={4} fill={C.graphiteLite} opacity={(1 - t) * 0.85} />;
        })}
        {/* clay pour */}
        <path d={`M 760 560 Q 700 700 640 800`} fill="none" stroke={C.clayWet} strokeWidth={18} strokeLinecap="round" opacity={interpolate(f, [30, 50], [0, 1], clamp) * (1 - paste * 0.6)} />
        {/* mixing bowl + paddle */}
        <g transform="translate(540 940)">
          <path d="M-200 -40 L200 -40 L160 140 L-160 140 Z" fill="#2a2218" stroke={C.cedarDk} strokeWidth={5} />
          <clipPath id="bowlc"><path d="M-194 -34 L194 -34 L156 134 L-156 134 Z" /></clipPath>
          <g clipPath="url(#bowlc)">
            <rect x={-194} y={interpolate(paste, [0, 1], [134, -20])} width={388} height={200} fill={mix('#4a4a48', C.clay, paste)} />
          </g>
          {/* paddle spinning fast */}
          <g transform={`rotate(${f * 10})`}>
            <rect x={-8} y={-120} width={16} height={200} rx={8} fill="url(#metalG)" />
            <rect x={-70} y={60} width={140} height={16} rx={8} fill="url(#metalG)" />
          </g>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: EXTRUDE — spaghetti strands ──────────────────────────────────────
const SceneExtrude: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const grow = interpolate(f, [12, 90], [0, 620], clamp);
  const plunge = interpolate(f, [12, 90], [120, 360], clamp);
  const lens = usePop(40, 130);
  return (
    <AbsoluteFill>
      <Label delay={2}>Squeezed like spaghetti</Label>
      <Svg>
        {/* extruder cylinder */}
        <g transform="translate(300 760)" opacity={e}>
          <rect x={-140} y={-90} width={280} height={180} rx={20} fill="url(#metalG)" stroke={C.graphite} strokeWidth={5} />
          {/* paste reservoir */}
          <rect x={interpolate(plunge, [120, 360], [-130, 100], clamp)} y={-80} width={230} height={160} rx={12} fill={C.clay} opacity={0.8} />
          {/* plunger */}
          <rect x={interpolate(plunge, [120, 360], [-260, -20], clamp)} y={-70} width={40} height={140} rx={8} fill={C.graphite} />
          {/* die plate */}
          <rect x={130} y={-90} width={20} height={180} fill="#1a1410" />
          <circle cx={140} cy={0} r={10} fill={C.gold} />
        </g>
        {/* strands extruding out */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={sinePath(450, 740 + i * 18 - 18, grow, 24, 110, f / 4 + i)} stroke="url(#graphiteG)" strokeWidth={14} fill="none" strokeLinecap="round" />
        ))}
        {/* die callout */}
        <g transform={`translate(760 1120) scale(${lens})`} opacity={lens}>
          <circle cx={0} cy={0} r={90} fill="#1a1410" stroke={C.gold} strokeWidth={6} />
          <circle cx={0} cy={0} r={12} fill={C.gold} filter="url(#glow)" />
          <text x={0} y={130} fontFamily={FONT} fontSize={30} fontWeight={800} fill={C.gold} textAnchor="middle">one tiny hole</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: BAKE — harden in oven ────────────────────────────────────────────
const SceneBake: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const heat = interpolate(f, [10, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Baked rock-hard</Label>
      <Svg>
        {/* oven chamber */}
        <g transform="translate(540 780)" opacity={e}>
          <rect x={-260} y={-180} width={520} height={360} rx={20} fill="#1a1208" stroke="url(#metalG)" strokeWidth={6} />
          <rect x={-240} y={120} width={480} height={40} rx={8} fill={C.oven} opacity={0.5 + 0.3 * Math.sin(f / 5)} filter="url(#glow)" />
          {/* interior glow */}
          <rect x={-240} y={-160} width={480} height={300} rx={12} fill={C.oven} opacity={0.18 * heat} filter="url(#soft)" />
          {/* rods on rack, hardening (dull -> glossy) */}
          {[0, 1, 2, 3].map((i) => {
            const y = -80 + i * 56;
            return (
              <g key={i}>
                <rect x={-200} y={y} width={400} height={20} rx={10} fill={mix('#4a4a48', '#23272f', heat)} />
                <rect x={-200 + ((f * 9 + i * 40) % 480)} y={y + 2} width={60} height={6} fill="#fff" opacity={0.5 * heat} />
              </g>
            );
          })}
          {/* heat shimmer */}
          {Array.from({length: 4}).map((_, i) => (
            <path key={i} d={sinePath(-180 + i * 120, -160 - ((f * 3) % 60), 120, 8, 30, f / 4)} stroke={C.oven} strokeWidth={3} fill="none" opacity={0.2 * heat} />
          ))}
        </g>
        {/* temp gauge */}
        <g transform="translate(540 1140)">
          <path d="M-90 0 A 90 90 0 0 1 90 0" fill="none" stroke="#333" strokeWidth={14} />
          <line x1={0} y1={0} x2={0} y2={-80} stroke={C.red} strokeWidth={8} strokeLinecap="round" transform={`rotate(${interpolate(heat, [0, 1], [-80, 80])})`} />
          <text x={0} y={50} fontFamily={FONT} fontSize={30} fontWeight={800} fill={heat > 0.7 ? C.gold : '#888'} textAnchor="middle">HARD + SMOOTH</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: SANDWICH — cedar grooves + glue ──────────────────────────────────
const SceneSandwich: React.FC = () => {
  const f = useCurrentFrame();
  const top = interpolate(f, [70, 110], [-300, 0], clamp);
  const topRot = interpolate(f, [70, 110], [-26, 0], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Sealed inside cedar wood</Label>
      <Svg>
        {/* bottom cedar slab with grooves */}
        <g transform="translate(540 860)">
          <rect x={-300} y={-30} width={600} height={90} rx={10} fill="url(#cedarG)" />
          {/* woodgrain */}
          {[0, 1, 2].map((i) => <path key={i} d={sinePath(-290, -10 + i * 24, 580, 4, 200, i)} stroke={C.cedarDk} strokeWidth={2} fill="none" opacity={0.4} />)}
          {/* grooves + rods snapping in */}
          {[-220, -110, 0, 110, 220].map((gx, i) => {
            const rod = usePop(10 + i * 8, 140);
            return (
              <g key={i}>
                <circle cx={gx} cy={-30} r={14} fill="#1a1410" opacity={0.5} />
                <rect x={gx - 60} y={-44} width={120} height={18} rx={9} fill={C.graphite} opacity={rod} transform={`translate(0 ${interpolate(rod, [0, 1], [-120, 0])})`} />
              </g>
            );
          })}
        </g>
        {/* top cedar slab swinging down */}
        <g transform={`translate(540 ${720 + top}) rotate(${topRot})`}>
          <rect x={-300} y={-60} width={600} height={90} rx={10} fill="url(#cedarG)" />
          {[0, 1, 2].map((i) => <path key={i} d={sinePath(-290, -42 + i * 24, 580, 4, 200, i + 1)} stroke={C.cedarDk} strokeWidth={2} fill="none" opacity={0.4} />)}
        </g>
        {/* cross-section inset */}
        <g transform={`translate(540 1180) scale(${usePop(115, 140)})`} opacity={interpolate(f, [115, 130], [0, 1], clamp)}>
          <circle cx={0} cy={0} r={60} fill="url(#cedarG)" />
          <circle cx={0} cy={0} r={22} fill={C.graphite} />
          <text x={90} y={8} fontFamily={FONT} fontSize={30} fontWeight={800} fill={C.cedar}>core hugged in wood</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: FINISH — slice, paint, eraser, payoff ────────────────────────────
const SceneFinish: React.FC = () => {
  const f = useCurrentFrame();
  const paint = interpolate(f, [20, 70], [0, 1], clamp);
  const hero = usePop(78, 120);
  const txt = usePop(110, 130);
  return (
    <AbsoluteFill>
      <Svg>
        {/* paint curtain + bare->yellow pencil (first half) */}
        {f < 84 && (
          <g transform="translate(540 640)">
            {/* spinning saw blade */}
            <g transform={`translate(-280 0) rotate(${f * 14})`}>
              <circle cx={0} cy={0} r={60} fill="url(#metalG)" />
              {Array.from({length: 12}).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return <path key={i} d={`M${Math.cos(a) * 60} ${Math.sin(a) * 60} L${Math.cos(a + 0.2) * 78} ${Math.sin(a + 0.2) * 78} L${Math.cos(a + 0.4) * 60} ${Math.sin(a + 0.4) * 60} Z`} fill="#8b97a8" />;
              })}
            </g>
            {/* pencil filling yellow via wipe */}
            <Pencil cx={40} cy={0} s={1.0} painted={0} />
            <clipPath id="paintc"><rect x={-170} y={-40} width={paint * 420} height={80} /></clipPath>
            <g clipPath="url(#paintc)"><Pencil cx={40} cy={0} s={1.0} painted={1} /></g>
            {/* paint curtain */}
            <rect x={20} y={-160} width={50} height={320} fill={C.yellow} opacity={0.5} />
          </g>
        )}
        {/* hero finished pencil */}
        {f >= 70 && (
          <g transform={`translate(540 640) rotate(-16) scale(${interpolate(hero, [0, 1], [0.4, 1])})`} opacity={hero}>
            <Pencil cx={0} cy={0} s={1.05} />
          </g>
        )}
      </Svg>
      <div style={{position: 'absolute', top: 1010, width: W, textAlign: 'center', fontFamily: FONT, opacity: txt, transform: `translateY(${interpolate(txt, [0, 1], [40, 0])}px)`}}>
        <div style={{color: 'white', fontSize: 56, fontWeight: 800}}>Never lead.</div>
        <div style={{color: C.graphiteLite, fontSize: 92, fontWeight: 900, lineHeight: 1.0}}>Baked ROCK in wood.</div>
        <div style={{color: C.gold, fontSize: 40, fontWeight: 700, marginTop: 14}}>+ an eraser nobody asked for.</div>
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
      <span style={{background: 'rgba(18,13,8,0.58)', padding: '12px 26px', borderRadius: 22, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
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

export const Pencil2: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('pencil_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.13} />

      <Sequence from={S.hook} durationInFrames={S.grind - S.hook}><SceneWrap dur={S.grind - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.grind} durationInFrames={S.extrude - S.grind}><SceneWrap dur={S.extrude - S.grind}><SceneGrind /></SceneWrap></Sequence>
      <Sequence from={S.extrude} durationInFrames={S.bake - S.extrude}><SceneWrap dur={S.bake - S.extrude}><SceneExtrude /></SceneWrap></Sequence>
      <Sequence from={S.bake} durationInFrames={S.sandwich - S.bake}><SceneWrap dur={S.sandwich - S.bake}><SceneBake /></SceneWrap></Sequence>
      <Sequence from={S.sandwich} durationInFrames={S.finish - S.sandwich}><SceneWrap dur={S.finish - S.sandwich}><SceneSandwich /></SceneWrap></Sequence>
      <Sequence from={S.finish} durationInFrames={DURATION_IN_FRAMES - S.finish}><SceneWrap dur={DURATION_IN_FRAMES - S.finish}><SceneFinish /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

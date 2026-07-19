/**
 * "Why is the sky blue?" — a polished animated explainer (Remotion).
 * Voice: edge-tts en-US-AndrewNeural. Captions + scene timing are driven by the
 * real per-word timestamps in words.json. Ambient pad bed under the narration.
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
import wordsData from './words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1335; // 44.5s (audio 44.23s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

const S = {hook: 0, colors: 209, atmos: 390, key: 552, everywhere: 787, sunset: 967, closer: 1209};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// palette
const C = {
  ink: '#0a1430',
  white: '#FFFFFF',
  gold: '#FFD23F',
  blue: '#3aa0ff',
  blueLite: '#8fd0ff',
  red: '#ff5b4d',
};

const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
// returns a #RRGGBB string so results can be fed back into mix() (nested morphs)
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => v + (pb[i] - v) * t);
  return `#${hx(c[0])}${hx(c[1])}${hx(c[2])}`;
};
const sinePath = (x0: number, y0: number, len: number, amp: number, wl: number, ph: number) => {
  let d = `M ${x0} ${y0}`;
  for (let x = 4; x <= len; x += 4) d += ` L ${(x0 + x).toFixed(1)} ${(y0 + amp * Math.sin((x / wl) * Math.PI * 2 + ph)).toFixed(1)}`;
  return d;
};
const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, mass: 0.9}});
};

// shared svg <defs> (glow + gradients)
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
      <feGaussianBlur stdDeviation="22" />
    </filter>
    <filter id="cloud" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" />
    </filter>
    <radialGradient id="sunG" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#FFF6CF" />
      <stop offset="55%" stopColor="#FFD23F" />
      <stop offset="100%" stopColor="#FFB02E" />
    </radialGradient>
    <radialGradient id="sunWarm" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#FFE3A8" />
      <stop offset="55%" stopColor="#FF9D3C" />
      <stop offset="100%" stopColor="#FF6A3C" />
    </radialGradient>
  </defs>
);
const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
    <Defs />
    {children}
  </svg>
);

// ── glowing sun ─────────────────────────────────────────────────────────────
const Sun: React.FC<{cx: number; cy: number; r: number; warm?: boolean; rays?: boolean}> = ({cx, cy, r, warm, rays = true}) => {
  const frame = useCurrentFrame();
  const grad = warm ? 'url(#sunWarm)' : 'url(#sunG)';
  const glow = warm ? '#FF9D3C' : '#FFD23F';
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 2.6} fill={glow} opacity={0.16} filter="url(#soft)" />
      {rays &&
        Array.from({length: 14}).map((_, i) => {
          const a = (i / 14) * Math.PI * 2 + frame / 140;
          const r1 = r * 1.45;
          const r2 = r * (2.0 + 0.14 * Math.sin(frame / 11 + i));
          return (
            <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke={glow} strokeWidth={7} strokeLinecap="round" opacity={0.55} />
          );
        })}
      <circle cx={cx} cy={cy} r={r * (1 + 0.03 * Math.sin(frame / 12))} fill={grad} filter="url(#glow)" />
    </g>
  );
};

// ── background: morphing sky + dust + hills (absolute frame) ──────────────────
const PARTICLES = Array.from({length: 50}).map((_, i) => ({
  x: random('x' + i) * W,
  y: random('y' + i) * H,
  r: 1.4 + random('r' + i) * 3.0,
  sp: 5 + random('s' + i) * 16,
  o: 0.07 + random('o' + i) * 0.16,
}));
const hillPath = (base: number, amp: number, seed: string, step = 90) => {
  let d = `M 0 ${H}`;
  for (let x = 0; x <= W; x += step) d += ` L ${x} ${(base - amp * (0.35 + 0.65 * random(seed + '-' + x))).toFixed(1)}`;
  return d + ` L ${W} ${H} Z`;
};
const FAR = hillPath(1840, 120, 'far');
const NEAR = hillPath(1880, 90, 'near');

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [S.sunset + 10, S.sunset + 190], [0, 1], clamp); // day→sunset
  // per-scene brightness: bright sky for the "real sky" beats (hook/atmos/everywhere),
  // richer & darker for the diagram beats (prism/scatter) so the glow pops.
  const b = interpolate(
    frame,
    [150, 209, 300, 390, 470, 552, 670, 787, 880, 967],
    [1, 1, 0.22, 0.22, 0.85, 0.85, 0.18, 0.18, 1, 1],
    clamp
  );
  const dayTop = mix('#163F92', '#3E92FF', b);
  const dayMid = mix('#245FBE', '#62ADFF', b);
  const dayBot = mix('#79B4EE', '#CDEBFF', b);
  const top = mix(dayTop, '#1b1d52', s);
  const mid = mix(dayMid, mix('#7A2E8C', '#ff6a4d', 0.5), s);
  const bot = mix(dayBot, '#FFB36B', s);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`}}>
      <Svg>
        {/* ambient top glow */}
        <ellipse cx={540} cy={300} rx={760} ry={520} fill={mix('#dcefff', '#ffd9a8', s)} opacity={0.2} filter="url(#soft)" />
        {/* dust */}
        {PARTICLES.map((p, i) => {
          const y = ((p.y - (frame * p.sp) / 30) % H + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="white" opacity={p.o * (1 - s * 0.5)} />;
        })}
        {/* distant hills (hazy blue by day, dusk-purple at sunset) */}
        <path d={FAR} fill={mix(mix('#39568f', '#7fabe6', b), '#3a1f57', s)} opacity={0.45} />
        <path d={NEAR} fill={mix(mix('#2c4a86', '#5d92d6', b), '#241133', s)} opacity={0.8} />
      </Svg>
    </AbsoluteFill>
  );
};

// ── scene wrapper: fade/scale in + out so cuts breathe ────────────────────────
const SceneWrap: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const fin = interpolate(f, [0, 14], [0, 1], clamp);
  const fout = interpolate(f, [dur - 12, dur], [1, 0], clamp);
  return <AbsoluteFill style={{opacity: Math.min(fin, fout), transform: `scale(${interpolate(fin, [0, 1], [1.05, 1])})`}}>{children}</AbsoluteFill>;
};

// label pill
const Label: React.FC<{children: React.ReactNode; y?: number; delay?: number}> = ({children, y = 250, delay = 6}) => {
  const e = useEnter(delay);
  return (
    <div style={{position: 'absolute', top: y, width: W, textAlign: 'center', opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-26, 0])}px)`}}>
      <span style={{display: 'inline-block', padding: '16px 40px', borderRadius: 999, background: 'rgba(8,18,40,0.42)', border: '2px solid rgba(255,255,255,0.28)', color: 'white', fontSize: 48, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.25)'}}>{children}</span>
    </div>
  );
};

// ── Scene 1: hook ─────────────────────────────────────────────────────────────
const Cloud: React.FC<{x: number; y: number; s: number; sp: number; o: number}> = ({x, y, s, sp, o}) => {
  const f = useCurrentFrame();
  const dx = ((f * sp) % (W + 500)) - 250;
  return (
    <g transform={`translate(${x + dx} ${y}) scale(${s})`} opacity={o} filter="url(#cloud)">
      <ellipse cx={0} cy={0} rx={150} ry={54} fill="white" />
      <ellipse cx={95} cy={16} rx={112} ry={46} fill="white" opacity={0.96} />
      <ellipse cx={-95} cy={20} rx={96} ry={40} fill="white" opacity={0.94} />
      <ellipse cx={20} cy={-30} rx={84} ry={40} fill="white" opacity={0.96} />
    </g>
  );
};
const Bird: React.FC<{y: number; sp: number; o: number}> = ({y, sp, o}) => {
  const f = useCurrentFrame();
  const x = ((f * sp) % (W + 200)) - 100;
  const flap = 10 * Math.sin(f / 5 + y);
  return (
    <g transform={`translate(${x} ${y + 8 * Math.sin(f / 30)})`} opacity={o} stroke="#16335f" strokeWidth={5} fill="none" strokeLinecap="round">
      <path d={`M -26 0 Q -10 ${-14 - flap} 0 0`} />
      <path d={`M 26 0 Q 10 ${-14 - flap} 0 0`} />
    </g>
  );
};
const SceneHook: React.FC = () => {
  const e = useEnter(2, 220);
  const w1 = useEnter(8, 180);
  const w2 = useEnter(16, 180);
  const line = useEnter(24);
  return (
    <AbsoluteFill>
      <Svg>
        <Sun cx={540} cy={420} r={120 * e} />
        <Cloud x={220} y={780} s={1} sp={0.35} o={0.95} />
        <Cloud x={780} y={930} s={0.8} sp={0.22} o={0.85} />
        <Cloud x={420} y={1080} s={0.6} sp={0.5} o={0.7} />
        <Bird y={640} sp={1.7} o={0.85} />
        <Bird y={700} sp={1.4} o={0.7} />
      </Svg>
      <div style={{position: 'absolute', top: 1200, width: W, textAlign: 'center', fontFamily: FONT}}>
        <div style={{color: 'white', fontSize: 116, fontWeight: 800, lineHeight: 1.0, opacity: w1, transform: `translateY(${interpolate(w1, [0, 1], [50, 0])}px)`, textShadow: '0 8px 34px rgba(0,0,0,0.35)'}}>WHY IS THE</div>
        <div style={{fontSize: 150, fontWeight: 900, lineHeight: 1.05, opacity: w2, transform: `translateY(${interpolate(w2, [0, 1], [60, 0])}px) scale(${interpolate(w2, [0, 1], [0.8, 1])})`, color: C.gold, textShadow: '0 8px 34px rgba(0,0,0,0.35)'}}>SKY BLUE?</div>
        <div style={{height: 8, width: interpolate(line, [0, 1], [0, 360]), background: C.gold, borderRadius: 8, margin: '34px auto 0'}} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: white light → colours ───────────────────────────────────────────
const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#3a47e0', '#a838e0'];
const SceneColors: React.FC = () => {
  const f = useCurrentFrame();
  const beam = interpolate(f, [8, 34], [0, 1], clamp);
  const split = interpolate(f, [34, 80], [0, 1], clamp);
  const px = 560, py = 720;
  return (
    <AbsoluteFill>
      <Label delay={2}>Sunlight is every colour mixed</Label>
      <Svg>
        <Sun cx={170} cy={py} r={88} rays={false} />
        <line x1={258} y1={py} x2={interpolate(beam, [0, 1], [258, px])} y2={py} stroke="white" strokeWidth={26} opacity={0.95} filter="url(#glow)" />
        {/* prism */}
        <polygon points={`${px - 78},${py + 150} ${px + 78},${py + 150} ${px},${py - 150}`} fill="rgba(255,255,255,0.16)" stroke="white" strokeWidth={4} />
        <polygon points={`${px - 78},${py + 150} ${px},${py - 150} ${px - 30},${py + 150}`} fill="rgba(255,255,255,0.12)" />
        {RAINBOW.map((c, i) => {
          const spread = (i - 3) * 26;
          const x2 = 1030, y2 = py + 60 + spread * 7;
          const wob = 8 * Math.sin(f / 9 + i);
          return <line key={i} x1={px} y1={py} x2={interpolate(split, [0, 1], [px, x2])} y2={interpolate(split, [0, 1], [py, y2 + wob])} stroke={c} strokeWidth={16} strokeLinecap="round" opacity={0.92} filter="url(#glow)" />;
        })}
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: atmosphere + molecules ──────────────────────────────────────────
const Molecule: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) => {
  const f = useCurrentFrame();
  const rot = f / 18 + x;
  return (
    <g transform={`translate(${x} ${y + 10 * Math.sin(f / 16 + x)}) rotate(${(rot * 12) % 360})`}>
      <circle cx={-13 * s} cy={0} r={16 * s} fill="#cfe8ff" stroke="#7fb6ff" strokeWidth={3} />
      <circle cx={13 * s} cy={0} r={16 * s} fill="#bfe0ff" stroke="#7fb6ff" strokeWidth={3} />
      <rect x={-13 * s} y={-4 * s} width={26 * s} height={8 * s} fill="#9fccff" />
    </g>
  );
};
const A_MOLS = Array.from({length: 12}).map((_, i) => ({x: 130 + ((i * 173) % 820), y: 360 + ((i * 233) % 560), s: 0.85 + (i % 3) * 0.25}));
const SceneAtmos: React.FC = () => {
  const f = useCurrentFrame();
  const beam = interpolate(f, [10, 56], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Sunlight pours into our air</Label>
      <Svg>
        <circle cx={540} cy={3200} r={2000} fill="#2c6e8f" />
        <circle cx={540} cy={3200} r={2000} fill="none" stroke="#7fd6ff" strokeWidth={70} opacity={0.18} filter="url(#soft)" />
        <line x1={540} y1={-20} x2={540} y2={interpolate(beam, [0, 1], [-20, 1180])} stroke="#fff7cf" strokeWidth={20} opacity={0.9} filter="url(#glow)" />
        {A_MOLS.map((m, i) => (<Molecule key={i} x={m.x} y={m.y} s={m.s} />))}
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: the key — blue scatters most ────────────────────────────────────
const SceneKey: React.FC = () => {
  const f = useCurrentFrame();
  const mx = 540, my = 640;
  const photon = (f % 50) / 50; // travels in along the incoming beam
  return (
    <AbsoluteFill>
      <Label delay={2}>Short blue waves scatter the most</Label>
      <Svg>
        <line x1={120} y1={250} x2={mx} y2={my} stroke="white" strokeWidth={16} opacity={0.85} />
        <circle cx={interpolate(photon, [0, 1], [120, mx])} cy={interpolate(photon, [0, 1], [250, my])} r={14} fill="white" filter="url(#glow)" />
        {/* red passes through */}
        <line x1={mx} y1={my} x2={1010} y2={my + 380} stroke={C.red} strokeWidth={13} strokeLinecap="round" opacity={0.85} filter="url(#glow)" />
        {/* blue scattering bursts */}
        {Array.from({length: 12}).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const ph = (f / 8 + i) % (Math.PI * 2);
          const reach = 140 + 130 * ((Math.sin(ph) + 1) / 2);
          const op = 0.35 + 0.55 * ((Math.sin(ph) + 1) / 2);
          return (
            <g key={i} opacity={op}>
              <line x1={mx} y1={my} x2={mx + Math.cos(a) * reach} y2={my + Math.sin(a) * reach} stroke="#6bbcff" strokeWidth={7} strokeLinecap="round" />
              <circle cx={mx + Math.cos(a) * reach} cy={my + Math.sin(a) * reach} r={12} fill="#f0f8ff" filter="url(#glow)" />
            </g>
          );
        })}
        <circle cx={mx} cy={my} r={42} fill="#eaf5ff" stroke="#7fb6ff" strokeWidth={5} filter="url(#glow)" />
        {/* wave comparison */}
        <g transform="translate(0,1120)">
          <text x={150} y={-12} fill={C.blueLite} fontSize={42} fontWeight={800} fontFamily={FONT}>BLUE · short waves</text>
          <path d={sinePath(150, 56, 800, 36, 60, f / 3.5)} stroke={C.blue} strokeWidth={10} fill="none" filter="url(#glow)" />
          <text x={150} y={186} fill="#ffb3aa" fontSize={42} fontWeight={800} fontFamily={FONT}>RED · long waves</text>
          <path d={sinePath(150, 250, 800, 36, 190, f / 3.5)} stroke={C.red} strokeWidth={10} fill="none" filter="url(#glow)" />
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: blue everywhere ─────────────────────────────────────────────────
const GRID = Array.from({length: 12}).map((_, i) => ({x: 170 + (i % 4) * 246, y: 300 + Math.floor(i / 4) * 215, d: (i * 9) % 40}));
const SceneEverywhere: React.FC = () => {
  const f = useCurrentFrame();
  const eyeX = 540, eyeY = 1230;
  const tint = interpolate(f, [20, 90], [0, 0.32], clamp);
  const blink = f % 96 < 4 ? 0.14 : 1;
  return (
    <AbsoluteFill>
      <Label delay={2}>Blue arrives from every direction</Label>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill={C.blue} opacity={tint} />
        {GRID.map((m, i) => {
          const t = ((f + m.d) % 46) / 46;
          return (
            <g key={i}>
              <Molecule x={m.x} y={m.y} s={0.8} />
              <circle cx={interpolate(t, [0, 1], [m.x, eyeX])} cy={interpolate(t, [0, 1], [m.y, eyeY])} r={9} fill="#5bb2ff" opacity={(1 - t) * 0.9} filter="url(#glow)" />
            </g>
          );
        })}
        <g>
          <ellipse cx={eyeX} cy={eyeY} rx={130} ry={78 * blink} fill="white" stroke="#1d3a6b" strokeWidth={6} />
          {blink > 0.5 && (<>
            <circle cx={eyeX} cy={eyeY} r={46} fill="#2b6fd6" />
            <circle cx={eyeX} cy={eyeY} r={20} fill="#0b1f44" />
            <circle cx={eyeX + 14} cy={eyeY - 14} r={9} fill="white" />
          </>)}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: sunset ──────────────────────────────────────────────────────────
const SceneSunset: React.FC = () => {
  const f = useCurrentFrame();
  const sunX = 860, sunY = 1000, eyeX = 190, eyeY = 1010;
  return (
    <AbsoluteFill>
      <Label delay={2}>At sunset, light travels much farther</Label>
      <Svg>
        <Sun cx={sunX} cy={sunY} r={104} warm />
        {/* long path beam */}
        <line x1={sunX} y1={sunY} x2={eyeX} y2={eyeY} stroke="#ff9a4d" strokeWidth={16} strokeLinecap="round" opacity={0.9} filter="url(#glow)" />
        {/* blue peeling away upward */}
        {Array.from({length: 11}).map((_, i) => {
          const t = i / 11;
          const bx = interpolate(t, [0, 1], [sunX, eyeX]);
          const by = interpolate(t, [0, 1], [sunY, eyeY]);
          const lift = (f + i * 7) % 46;
          return <circle key={i} cx={bx} cy={by - lift} r={9} fill="#5bb2ff" opacity={interpolate(lift, [0, 46], [0.85, 0])} filter="url(#glow)" />;
        })}
        <g>
          <ellipse cx={eyeX} cy={eyeY} rx={96} ry={58} fill="white" stroke="#3a1d1d" strokeWidth={5} />
          <circle cx={eyeX} cy={eyeY} r={32} fill="#c25a23" />
          <circle cx={eyeX} cy={eyeY} r={14} fill="#2a0f0f" />
          <circle cx={eyeX + 10} cy={eyeY - 10} r={6} fill="white" />
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 7: closer ──────────────────────────────────────────────────────────
const SceneCloser: React.FC = () => {
  const e = useEnter(6, 200);
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Svg>
        <Sun cx={540} cy={interpolate(f, [0, 120], [560, 640], clamp)} r={108} warm />
      </Svg>
      <div style={{position: 'absolute', top: 900, width: W, textAlign: 'center', fontFamily: FONT, color: 'white', opacity: e}}>
        <div style={{fontSize: 100, fontWeight: 900, lineHeight: 1.15, textShadow: '0 8px 28px rgba(0,0,0,0.4)'}}>Same sun.<br />Same sky.</div>
        <div style={{fontSize: 62, fontWeight: 700, marginTop: 26, color: C.gold}}>Just a longer path.</div>
      </div>
    </AbsoluteFill>
  );
};

// ── karaoke captions ─────────────────────────────────────────────────────────
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
            <span key={i} style={{display: 'inline-block', color: active ? C.gold : 'white', textShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 16px rgba(0,0,0,0.45)', margin: '0 9px', transform: `scale(${active ? 1.12 : 1})`}}>{w.text}</span>
          );
        })}
      </span>
    </div>
  );
};

// ── root ─────────────────────────────────────────────────────────────────────
export const SkyBlue: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.16} />

      <Sequence from={S.hook} durationInFrames={S.colors - S.hook}><SceneWrap dur={S.colors - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.colors} durationInFrames={S.atmos - S.colors}><SceneWrap dur={S.atmos - S.colors}><SceneColors /></SceneWrap></Sequence>
      <Sequence from={S.atmos} durationInFrames={S.key - S.atmos}><SceneWrap dur={S.key - S.atmos}><SceneAtmos /></SceneWrap></Sequence>
      <Sequence from={S.key} durationInFrames={S.everywhere - S.key}><SceneWrap dur={S.everywhere - S.key}><SceneKey /></SceneWrap></Sequence>
      <Sequence from={S.everywhere} durationInFrames={S.sunset - S.everywhere}><SceneWrap dur={S.sunset - S.everywhere}><SceneEverywhere /></SceneWrap></Sequence>
      <Sequence from={S.sunset} durationInFrames={S.closer - S.sunset}><SceneWrap dur={S.closer - S.sunset}><SceneSunset /></SceneWrap></Sequence>
      <Sequence from={S.closer} durationInFrames={DURATION_IN_FRAMES - S.closer}><SceneWrap dur={DURATION_IN_FRAMES - S.closer}><SceneCloser /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.16) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

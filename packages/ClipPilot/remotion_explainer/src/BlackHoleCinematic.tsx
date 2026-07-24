/**
 * "How Black Holes Work | The Most Terrifying Object in the Universe"
 * CINEMATIC redesign — real NASA/ESO public-domain footage composited under
 * Remotion motion-graphics overlays, hook + kinetic labels + karaoke captions.
 * Audio: Chatterbox male, pitch-deepened + EQ/reverb, narration at 1.2x speed.
 * Footage credits: NASA Goddard / NASA SVS / ESO / EHT (public domain & CC-BY).
 */
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  Easing,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import wordsData from './v2_words.json';

const {fontFamily: ANTON} = loadAnton();
const {fontFamily: POP} = loadPoppins('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 921; // 30.7s (narration ends 29.36s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.4, 0, 0.2, 1);

const C = {
  amber: '#ff9d2e',
  hot: '#ffd58a',
  red: '#ff3b30',
  cyan: '#6fd2ff',
  white: '#ffffff',
};

// ── background footage with slow push-in + cinematic grade ─────────────────────
const Bg: React.FC<{
  src: string;
  trim: number;
  dur: number;
  zoom?: [number, number];
  originY?: number;
  grade?: string;
  stretchY?: number;
}> = ({src, trim, dur, zoom = [1.04, 1.16], originY = 50, grade, stretchY = 1}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], zoom, {...clamp, easing: ease});
  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={trim}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${s}) scaleY(${stretchY})`,
          transformOrigin: `50% ${originY}%`,
          filter: grade ?? 'contrast(1.12) saturate(1.08) brightness(0.92)',
        }}
      />
    </AbsoluteFill>
  );
};

// ── cinematic grade overlays: vignette + bottom scrim + grain ──────────────────
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity: 0.06, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <svg width={W} height={H}>
        <filter id="gr">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 50} />
        </filter>
        <rect width={W} height={H} filter="url(#gr)" />
      </svg>
    </AbsoluteFill>
  );
};
const Grade: React.FC = () => (
  <>
    <AbsoluteFill style={{background: 'radial-gradient(120% 75% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none'}} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.78) 100%)', pointerEvents: 'none'}} />
    <Grain />
  </>
);

// ── kinetic hero label (the trailer "card" word) ──────────────────────────────
const Hero: React.FC<{text: string; dur: number; delay?: number; variant?: 'title' | 'top'; color?: string; sub?: string}> = ({
  text,
  dur,
  delay = 4,
  variant = 'top',
  color = C.white,
  sub,
}) => {
  const f = useCurrentFrame();
  const inn = spring({frame: f - delay, fps: FPS, config: {damping: 170, mass: 0.7}});
  const out = interpolate(f, [dur - 16, dur - 4], [1, 0], clamp);
  const op = Math.min(inn, out);
  const isTitle = variant === 'title';
  return (
    <div
      style={{
        position: 'absolute',
        top: isTitle ? 760 : 250,
        width: W,
        textAlign: 'center',
        opacity: op,
        transform: `translateY(${interpolate(inn, [0, 1], [40, 0])}px)`,
        fontFamily: ANTON,
      }}
    >
      <div
        style={{
          color,
          fontSize: isTitle ? 168 : 92,
          letterSpacing: isTitle ? 4 : 2,
          lineHeight: 1.0,
          textTransform: 'uppercase',
          textShadow: `0 0 36px rgba(0,0,0,0.9), 0 8px 30px rgba(0,0,0,0.7)`,
          padding: '0 40px',
        }}
      >
        {text}
      </div>
      {sub ? <div style={{color: C.amber, fontFamily: POP, fontWeight: 800, fontSize: 46, marginTop: 14, letterSpacing: 6, textShadow: '0 4px 18px rgba(0,0,0,0.9)'}}>{sub}</div> : null}
    </div>
  );
};

// ── per-beat FX overlays ──────────────────────────────────────────────────────
const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>{children}</svg>
);

// hook: light streaks dragged into centre + title flash
const FxHook: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [74, 82, 96], [0, 0.5, 0], clamp); // title impact
  return (
    <>
      <Svg>
        {Array.from({length: 22}).map((_, i) => {
          const a = (i / 22) * Math.PI * 2;
          const t = ((f / 1.5 + i * 9) % 120) / 120;
          const rr = interpolate(t, [0, 1], [820, 120]);
          return <circle key={i} cx={540 + Math.cos(a + t) * rr} cy={760 + Math.sin(a + t) * rr} r={interpolate(t, [0, 1], [3.5, 0.5])} fill={i % 3 === 0 ? C.cyan : '#fff'} opacity={(1 - t) * 0.6} />;
        })}
      </Svg>
      <AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}} />
    </>
  );
};

// birth: inward collapse arrows + implosion white flash
const FxBirth: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [dur - 34, dur - 26, dur - 8], [0, 0.85, 0], clamp);
  const shock = interpolate(f, [dur - 30, dur], [0, 1], clamp);
  return (
    <>
      <Svg>
        {f < dur - 28 &&
          Array.from({length: 16}).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const t = ((f + i * 4) % 34) / 34;
            const rr = interpolate(t, [0, 1], [360, 70]);
            return <circle key={i} cx={540 + Math.cos(a) * rr} cy={760 + Math.sin(a) * rr} r={4} fill={C.hot} opacity={(1 - t) * 0.85} />;
          })}
        {shock > 0 && <circle cx={540} cy={760} r={interpolate(shock, [0, 1], [20, 720])} fill="none" stroke={C.amber} strokeWidth={interpolate(shock, [0, 1], [36, 2])} opacity={(1 - shock) * 0.8} />}
      </Svg>
      <AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}} />
    </>
  );
};

// light trapped: streaks bend toward centre, dim to black on "leave"
const FxLight: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [dur - 22, dur - 2], [0, 0.7], clamp);
  return (
    <>
      <Svg>
        {Array.from({length: 14}).map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const t = ((f + i * 6) % 50) / 50;
          const rr = interpolate(t, [0, 1], [640, 110]);
          const sw = a + t * 1.4;
          return <circle key={i} cx={540 + Math.cos(sw) * rr} cy={760 + Math.sin(sw) * rr} r={interpolate(t, [0, 1], [5, 1])} fill={C.cyan} opacity={(1 - t) * 0.7} />;
        })}
      </Svg>
      <AbsoluteFill style={{background: '#000', opacity: dim, pointerEvents: 'none'}} />
    </>
  );
};

// event horizon: red sweep line + lock
const FxHorizon: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const sweep = interpolate(f, [6, 40], [-200, H + 200], {...clamp, easing: ease});
  const drop = interpolate(f, [dur - 20, dur - 6], [0, 0.6], clamp);
  return (
    <>
      <Svg>
        <line x1={0} y1={sweep} x2={W} y2={sweep} stroke={C.red} strokeWidth={6} opacity={0.85} />
        <rect x={0} y={sweep - 60} width={W} height={120} fill={C.red} opacity={0.12} />
      </Svg>
      <AbsoluteFill style={{background: '#000', opacity: drop, pointerEvents: 'none'}} />
    </>
  );
};

// spaghettification: vertical stretch streak lines
const FxSpaghetti: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  return (
    <Svg>
      {Array.from({length: 26}).map((_, i) => {
        const x = 60 + (i / 25) * (W - 120);
        const len = interpolate(f, [0, dur], [80, 520], clamp) * (0.6 + random('l' + i) * 0.8);
        const y0 = 500 + random('y' + i) * 500;
        return <line key={i} x1={x} y1={y0} x2={x} y2={y0 + len} stroke={i % 4 === 0 ? C.red : '#cfe0ff'} strokeWidth={2.5} opacity={0.35} strokeLinecap="round" />;
      })}
    </Svg>
  );
};

// first image: scanning bracket + 2019 stamp handled by Hero sub
const FxImage: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const e = interpolate(f, [4, 24], [0, 1], clamp);
  const b = 250;
  const cx = 540, cy = 860, s = 360;
  const Corner = (dx: number, dy: number, sx: number, sy: number) => (
    <path d={`M ${cx + dx} ${cy + dy + sy * 60} L ${cx + dx} ${cy + dy} L ${cx + dx + sx * 60} ${cy + dy}`} stroke={C.cyan} strokeWidth={5} fill="none" opacity={0.8 * e} />
  );
  return (
    <Svg>
      {Corner(-s, -s, 1, 1)}
      {Corner(s, -s, -1, 1)}
      {Corner(-s, s, 1, -1)}
      {Corner(s, s, -1, -1)}
    </Svg>
  );
};

// singularity: spacetime grid warps + collapse to a point -> black
const FxSingularity: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const collapse = interpolate(f, [dur - 70, dur - 18], [0, 1], {...clamp, easing: ease});
  const black = interpolate(f, [dur - 26, dur - 6], [0, 1], clamp);
  const cx = 540, cy = 760;
  return (
    <>
      <Svg>
        {Array.from({length: 30}).map((_, i) => {
          const a = (i / 30) * Math.PI * 2;
          const r1 = interpolate(collapse, [0, 1], [900, 8]);
          return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx} y2={cy} stroke={C.amber} strokeWidth={1.5} opacity={0.18 * (1 - black)} />;
        })}
        <circle cx={cx} cy={cy} r={interpolate(collapse, [0, 1], [0, 40])} fill="#000" opacity={collapse} />
      </Svg>
      <AbsoluteFill style={{background: '#000', opacity: black, pointerEvents: 'none'}} />
    </>
  );
};

// ── karaoke captions (cinematic, lower third) ─────────────────────────────────
const PAGES: {start: number; end: number; words: typeof WORDS}[] = [];
for (let i = 0; i < WORDS.length; i += 3) {
  const ch = WORDS.slice(i, i + 3);
  PAGES.push({start: ch[0].start, end: ch[ch.length - 1].end, words: ch});
}
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t > WORDS[WORDS.length - 1].end + 0.1) return null;
  let page = PAGES[0];
  for (let i = 0; i < PAGES.length; i++) {
    const next = PAGES[i + 1];
    if (t >= PAGES[i].start && (!next || t < next.start)) {
      page = PAGES[i];
      break;
    }
  }
  if (!page || t < page.start - 0.05) return null;
  const pin = interpolate(t, [page.start - 0.08, page.start + 0.1], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', bottom: 250, left: 50, width: W - 100, textAlign: 'center', fontFamily: POP, fontWeight: 900, fontSize: 66, lineHeight: 1.1, textTransform: 'uppercase', opacity: pin, transform: `translateY(${interpolate(pin, [0, 1], [18, 0])}px)`}}>
      {page.words.map((w, i) => {
        const active = t >= w.start && t <= w.end + 0.06;
        return (
          <span key={i} style={{display: 'inline-block', color: active ? C.amber : '#fff', textShadow: '0 4px 0 rgba(0,0,0,0.6), 0 0 22px rgba(0,0,0,0.85)', margin: '0 10px', transform: `scale(${active ? 1.1 : 1})`}}>{w.text.replace(/[.,]$/, '')}</span>
        );
      })}
    </div>
  );
};

// birth: a crisp Remotion giant star that collapses + implodes (replaces soft footage)
const BirthStar: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const cx = 540, cy = 760;
  const grow = interpolate(f, [0, 66], [50, 215], {...clamp, easing: ease});
  const shrink = interpolate(f, [66, 96], [1, 0.05], {...clamp, easing: ease});
  const r = grow * (f < 66 ? 1 : shrink) * (1 + 0.03 * Math.sin(f / 5));
  const gone = f > 99;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <defs>
        <radialGradient id="bstar" cx="44%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#fffdf5" />
          <stop offset="36%" stopColor="#ffe27a" />
          <stop offset="72%" stopColor="#ff9a2e" />
          <stop offset="100%" stopColor="#ff5a1f" />
        </radialGradient>
        <filter id="bsoft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30" /></filter>
      </defs>
      {!gone && (
        <>
          <circle cx={cx} cy={cy} r={r * 2.3} fill="#ff8a2b" opacity={0.22} filter="url(#bsoft)" />
          {Array.from({length: 12}).map((_, i) => {
            const a = (i / 12) * Math.PI * 2 + f / 60;
            const r2 = r * (1.5 + 0.18 * Math.sin(f / 8 + i));
            return <line key={i} x1={cx + Math.cos(a) * r * 1.2} y1={cy + Math.sin(a) * r * 1.2} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke="#ffb84a" strokeWidth={5} strokeLinecap="round" opacity={0.5} />;
          })}
          <circle cx={cx} cy={cy} r={r} fill="url(#bstar)" />
        </>
      )}
      {f > 96 && <circle cx={cx} cy={cy} r={interpolate(f, [96, 108, dur], [6, 30, 22], clamp)} fill="#000" />}
      {f > 102 && <circle cx={cx} cy={cy} r={interpolate(f, [102, dur], [10, 34], clamp)} fill="none" stroke="#ffce8f" strokeWidth={4} opacity={0.9} />}
    </svg>
  );
};

// ── scenes ────────────────────────────────────────────────────────────────────
type Scene = {key: string; from: number; dur: number};
const S: Scene[] = [
  {key: 'hook', from: 0, dur: 150},
  {key: 'birth', from: 150, dur: 126},
  {key: 'light', from: 276, dur: 78},
  {key: 'horizon', from: 354, dur: 138},
  {key: 'spaghetti', from: 492, dur: 90},
  {key: 'disk', from: 582, dur: 111},
  {key: 'image', from: 693, dur: 84},
  {key: 'singularity', from: 777, dur: 144},
];

const SceneBody: React.FC<{k: string; dur: number}> = ({k, dur}) => {
  switch (k) {
    case 'hook':
      return (<>
        <Bg src="footage/h264/warped_disk.mp4" trim={240} dur={dur} zoom={[1.0, 1.14]} />
        <Grade />
        <FxHook dur={dur} />
        <Hero text="BLACK HOLE" dur={dur} delay={72} variant="title" />
      </>);
    case 'birth':
      return (<>
        <Bg src="footage/h264/deep_field.mp4" trim={0} dur={dur} zoom={[1.02, 1.1]} grade="contrast(1.25) saturate(0.7) brightness(0.45)" />
        <BirthStar dur={dur} />
        <Grade />
        <FxBirth dur={dur} />
        <Hero text="A Star Dies" dur={dur} color={C.hot} />
      </>);
    case 'light':
      return (<>
        <Bg src="footage/h264/accretion.mp4" trim={60} dur={dur} zoom={[1.05, 1.2]} />
        <Grade />
        <FxLight dur={dur} />
        <Hero text="Light Can't Escape" dur={dur} color={C.cyan} />
      </>);
    case 'horizon':
      return (<>
        <Bg src="footage/h264/sgra_zoom.mp4" trim={840} dur={dur} zoom={[1.08, 1.3]} grade="contrast(1.2) saturate(0.82) brightness(0.74)" />
        <Grade />
        <FxHorizon dur={dur} />
        <Hero text="Point of No Return" dur={dur} color={C.red} />
      </>);
    case 'spaghetti':
      return (<>
        <Bg src="footage/h264/shredder.mp4" trim={450} dur={dur} zoom={[1.06, 1.22]} stretchY={1.06} />
        <Grade />
        <FxSpaghetti dur={dur} />
        <Hero text="Spaghettification" dur={dur} color={C.cyan} />
      </>);
    case 'disk':
      return (<>
        <Bg src="footage/h264/accretion.mp4" trim={270} dur={dur} zoom={[1.04, 1.18]} />
        <Grade />
        <Hero text="We See the Fire" dur={dur} color={C.amber} />
      </>);
    case 'image':
      return (<>
        <Bg src="footage/h264/m87.mp4" trim={1290} dur={dur} zoom={[1.12, 1.0]} />
        <Grade />
        <FxImage dur={dur} />
        <Hero text="The First Real Image" dur={dur} delay={6} color={C.white} sub="M87*  ·  2019" />
      </>);
    case 'singularity':
      return (<>
        <Bg src="footage/h264/warped_disk.mp4" trim={840} dur={dur} zoom={[1.06, 1.5]} />
        <Grade />
        <FxSingularity dur={dur} />
        <Hero text="Singularity" dur={dur} delay={6} variant="title" color={C.white} />
        <EndCard dur={dur} />
      </>);
    default:
      return null;
  }
};

const EndCard: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const e = interpolate(f, [dur - 20, dur - 6], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', top: 880, width: W, textAlign: 'center', opacity: e, fontFamily: ANTON}}>
      <div style={{color: '#fff', fontSize: 70, letterSpacing: 3, textTransform: 'uppercase'}}>Black Holes</div>
      <div style={{color: C.amber, fontFamily: POP, fontWeight: 700, fontSize: 34, letterSpacing: 4, marginTop: 12}}>THE UNIVERSE'S MOST EXTREME OBJECT</div>
    </div>
  );
};

// ── root ──────────────────────────────────────────────────────────────────────
export const BlackHoleCinematic: React.FC = () => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 16], [0, 1], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <Audio src={staticFile('v2_narration.wav')} />
      {S.map((s) => (
        <Sequence key={s.key} from={s.from} durationInFrames={s.dur}>
          <SceneBody k={s.key} dur={s.dur} />
        </Sequence>
      ))}
      <Captions />
      {/* credits ticker */}
      <div style={{position: 'absolute', bottom: 40, width: W, textAlign: 'center', fontFamily: POP, fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1}}>
        Footage: NASA / NASA Goddard / ESO / EHT
      </div>
      <AbsoluteFill style={{background: '#000', opacity: 1 - fadeIn, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

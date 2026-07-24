/**
 * "You're Chewing Plastic" — fast snappy explainer (Remotion). Transcript #003.
 * Voice: edge-tts AndrewMultilingual. Energy from fast in-comp animation; calm recut.
 * Captions + scene timing driven by gum_words.json.
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
import wordsData from './gum_words.json';

const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '700', '800', '900']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1110; // 37s (audio 36.76s)
const W = 1080;
const H = 1920;
const WORDS: {text: string; start: number; end: number}[] = (wordsData as any).words;

const S = {hook: 0, poly: 142, melt: 379, mix: 512, never: 738, wrap: 893};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const C = {
  ink: '#0b1a1c',
  white: '#FFFFFF',
  gold: '#FFD23F',
  gum: '#ff8fb0',
  gumDk: '#ff5e90',
  mint: '#5fe0c0',
  plastic: '#4aa3ff',
  goo: '#ffc0d4',
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
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="8" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="22" />
    </filter>
    <linearGradient id="gumG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#ffc0d4" />
      <stop offset="100%" stopColor="#ff5e90" />
    </linearGradient>
    <linearGradient id="plasticG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#9fd0ff" />
      <stop offset="100%" stopColor="#2b7fe0" />
    </linearGradient>
    <linearGradient id="steelG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f1f4f9" />
      <stop offset="50%" stopColor="#bcc6d3" />
      <stop offset="100%" stopColor="#8b97a8" />
    </linearGradient>
    <radialGradient id="topGlow" cx="50%" cy="22%" r="60%">
      <stop offset="0%" stopColor="#7ff0d8" stopOpacity="0.18" />
      <stop offset="100%" stopColor="#7ff0d8" stopOpacity="0" />
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
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #0e2024 0%, #12262b 52%, #0a1618 100%)'}}>
      <Svg>
        <rect x={0} y={0} width={W} height={H} fill="url(#topGlow)" />
        {SPECK.map((p, i) => {
          const y = (((p.y - (frame * p.sp) / 30) % H) + H) % H;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill="#aef0e0" opacity={p.o} />;
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
      <span style={{display: 'inline-block', padding: '14px 38px', borderRadius: 999, background: 'rgba(8,24,26,0.6)', border: '2px solid rgba(95,224,192,0.34)', color: 'white', fontSize: 46, fontWeight: 700, fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.4)'}}>{children}</span>
    </div>
  );
};

// ── Scene 1: HOOK — mouth chewing, gum = rubber/plastic ───────────────────────
const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const pop = usePop(2, 110);
  const chew = 1 + 0.06 * Math.sin(f / 4); // fast chew bob
  const reveal = usePop(58, 150);
  return (
    <AbsoluteFill>
      <Svg>
        {/* mouth */}
        <g transform={`translate(540 700) scale(${pop})`} opacity={pop}>
          <path d="M-230 0 Q 0 -120 230 0 Q 0 120 -230 0 Z" fill="#5a2230" />
          <path d="M-230 0 Q 0 -120 230 0 L 230 0 Q 0 -40 -230 0 Z" fill="#ff9fb0" />
          {/* teeth */}
          <rect x={-150} y={-44} width={300} height={30} rx={8} fill="white" />
          {/* gum blob being chewed */}
          <g transform={`scale(${chew})`}>
            <circle cx={0} cy={18} r={56} fill="url(#gumG)" />
            <circle cx={-20} cy={6} r={14} fill="#fff" opacity={0.3} />
          </g>
        </g>
        {/* reveal badge: = PLASTIC */}
        <g transform={`translate(540 1080) scale(${reveal})`} opacity={reveal}>
          <rect x={-250} y={-52} width={500} height={104} rx={20} fill={C.plastic} />
          <text x={0} y={20} fontFamily={FONT} fontSize={58} fontWeight={900} fill="#06243f" textAnchor="middle">it's basically RUBBER</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 2: POLYMERS — chain of monomers, plastics + glue ────────────────────
const ScenePoly: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  return (
    <AbsoluteFill>
      <Label delay={2}>Same stuff as plastic + glue</Label>
      <Svg>
        {/* polymer chain links springing in */}
        <g transform="translate(540 700)">
          {Array.from({length: 9}).map((_, i) => {
            const lk = usePop(10 + i * 4, 130);
            const x = (i - 4) * 100;
            return (
              <g key={i} opacity={lk}>
                {i > 0 && <line x1={x - 100} y1={0} x2={x} y2={0} stroke={C.mint} strokeWidth={10} />}
                <circle cx={x} cy={0} r={36 * lk} fill="url(#plasticG)" stroke="#bfe2ff" strokeWidth={4} />
              </g>
            );
          })}
          <text x={0} y={120} fontFamily={FONT} fontSize={40} fontWeight={800} fill={C.mint} textAnchor="middle" opacity={interpolate(f, [40, 60], [0, 1], clamp)}>synthetic polymers = long chains</text>
        </g>
        {/* plastic bottle + glue tube icons */}
        <g transform="translate(280 1080)" opacity={interpolate(f, [60, 80], [0, 1], clamp)}>
          <rect x={-44} y={-90} width={88} height={170} rx={26} fill="url(#plasticG)" />
          <rect x={-22} y={-120} width={44} height={36} rx={8} fill="#2b7fe0" />
          <text x={0} y={130} fontFamily={FONT} fontSize={32} fontWeight={800} fill="white" textAnchor="middle">plastic</text>
        </g>
        <g transform="translate(800 1080)" opacity={interpolate(f, [72, 92], [0, 1], clamp)}>
          <path d="M-40 80 L40 80 L26 -70 L-26 -70 Z" fill="#e8d8b0" />
          <rect x={-14} y={-104} width={28} height={40} rx={6} fill="#c9a14a" />
          <text x={0} y={130} fontFamily={FONT} fontSize={32} fontWeight={800} fill="white" textAnchor="middle">glue</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 3: MELT — heat into stretchy goo ────────────────────────────────────
const SceneMelt: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const melt = interpolate(f, [12, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Heated into stretchy goo</Label>
      <Svg>
        {/* pot */}
        <g transform="translate(540 720)" opacity={e}>
          <path d="M-200 -120 L200 -120 L170 160 L-170 160 Z" fill="url(#steelG)" stroke="#8b97a8" strokeWidth={6} />
          <ellipse cx={0} cy={-120} rx={200} ry={34} fill="#3a2a30" />
          {/* melting goo surface */}
          <ellipse cx={0} cy={-120} rx={180} ry={28} fill="url(#gumG)" opacity={melt} />
          {/* stretchy strand drooping */}
          <path d={`M -40 -120 q 20 ${80 * melt} 0 ${160 * melt} q -20 40 10 70`} fill="none" stroke={C.goo} strokeWidth={18 * melt + 2} strokeLinecap="round" />
          <circle cx={-30} cy={-120 + 230 * melt} r={16 * melt} fill={C.goo} />
        </g>
        {/* flames under the pot */}
        {Array.from({length: 7}).map((_, i) => {
          const fx = 380 + i * 56;
          const h = 60 + 40 * Math.abs(Math.sin(f / 4 + i));
          return <path key={i} d={`M${fx} 920 q -16 -${h} 0 -${h + 20} q 16 ${h} 0 ${h + 20} Z`} fill={i % 2 ? '#ff8a3c' : '#ffd23f'} opacity={0.9} filter="url(#glow)" />;
        })}
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 4: MIX — ingredients folded, rolled into sheets ─────────────────────
const SceneMix: React.FC = () => {
  const f = useCurrentFrame();
  const roll = interpolate(f, [70, 150], [300, 880], clamp);
  const sheet = interpolate(f, [70, 150], [0, 580], clamp);
  return (
    <AbsoluteFill>
      <Label delay={2}>Sweeteners + flavor, rolled flat</Label>
      <Svg>
        {/* falling ingredients into a bowl (first half) */}
        {f < 76 && Array.from({length: 8}).map((_, i) => {
          const t = ((f * 24 + i * 70) % 320) / 320;
          const x = 360 + (i * 60) % 360;
          const kinds = ['#bfe6ff', C.gold, C.gum, '#ffffff'];
          return <rect key={i} x={x} y={360 + t * 320} width={22} height={22} rx={6} fill={kinds[i % 4]} transform={`rotate(${i * 40} ${x} ${360 + t * 320})`} />;
        })}
        {f < 80 && <ellipse cx={540} cy={760} rx={210} ry={70} fill="url(#gumG)" />}
        {/* rolling pin flattening into a long sheet (second half) */}
        {f >= 70 && (
          <g>
            <rect x={200} y={720} width={sheet} height={90} rx={12} fill="url(#gumG)" />
            <rect x={200} y={720} width={sheet} height={20} rx={10} fill="#fff" opacity={0.2} />
            <g transform={`translate(${roll} 700)`}>
              <rect x={-90} y={0} width={180} height={70} rx={35} fill="url(#steelG)" stroke="#8b97a8" strokeWidth={5} />
              <rect x={-120} y={20} width={30} height={30} rx={8} fill="#8b97a8" />
              <rect x={90} y={20} width={30} height={30} rx={8} fill="#8b97a8" />
            </g>
          </g>
        )}
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 5: NEVER DISSOLVES — water + clock, gum intact ──────────────────────
const SceneNever: React.FC = () => {
  const f = useCurrentFrame();
  const e = usePop(2, 120);
  const x = usePop(50, 150);
  return (
    <AbsoluteFill>
      <Label delay={2}>It never dissolves</Label>
      <Svg>
        {/* glass of water with gum at the bottom */}
        <g transform="translate(420 760)" opacity={e}>
          <path d="M-120 -200 L120 -200 L96 200 L-96 200 Z" fill="#bfe6ff" opacity={0.22} stroke="#bfe6ff" strokeWidth={5} />
          {/* water line wobble */}
          <path d={`M-114 ${-150 + 4 * Math.sin(f / 6)} L114 ${-150 - 4 * Math.sin(f / 6)} L108 200 L-108 200 Z`} fill="#7fd0ff" opacity={0.3} />
          {/* gum lump intact at bottom */}
          <ellipse cx={0} cy={150} rx={70} ry={40} fill="url(#gumG)" />
        </g>
        {/* fast-spinning clock = lots of time passing */}
        <g transform="translate(800 700)">
          <circle cx={0} cy={0} r={120} fill="#0e2024" stroke={C.mint} strokeWidth={8} />
          <line x1={0} y1={0} x2={0} y2={-90} stroke="white" strokeWidth={8} strokeLinecap="round" transform={`rotate(${f * 9})`} />
          <line x1={0} y1={0} x2={0} y2={-60} stroke={C.gold} strokeWidth={10} strokeLinecap="round" transform={`rotate(${f * 1.5})`} />
          <circle cx={0} cy={0} r={10} fill="white" />
        </g>
        {/* big X over "dissolve" */}
        <g transform={`translate(540 1120) scale(${x})`} opacity={x}>
          <rect x={-240} y={-50} width={480} height={100} rx={18} fill="rgba(8,24,26,0.7)" stroke={C.red} strokeWidth={3} />
          <text x={-30} y={18} fontFamily={FONT} fontSize={50} fontWeight={900} fill="white" textAnchor="middle">won't dissolve</text>
          <text x={200} y={26} fontFamily={FONT} fontSize={70} fontWeight={900} fill={C.red} textAnchor="middle">✗</text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// ── Scene 6: WRAP — cut, wrapped, payoff ──────────────────────────────────────
const SceneWrapUp: React.FC = () => {
  const f = useCurrentFrame();
  const cut = interpolate(f, [10, 50], [0, 1], clamp);
  const txt = usePop(78, 130);
  return (
    <AbsoluteFill>
      <Svg>
        {/* a strip of gum being cut into sticks */}
        <g transform="translate(540 620)">
          <rect x={-300} y={-50} width={600} height={100} rx={16} fill="url(#gumG)" />
          {[-180, -60, 60, 180].map((gx, i) => (
            <line key={i} x1={gx} y1={-50} x2={gx} y2={50} stroke="#0e2024" strokeWidth={6} opacity={interpolate(cut, [i / 4, (i + 1) / 4], [0, 1], clamp)} />
          ))}
          {/* foil wrap sliding over the leftmost stick */}
          <rect x={-300} y={-54} width={120 * cut} height={108} rx={14} fill="#d7dde6" opacity={0.92} />
          <rect x={-300} y={-54} width={120 * cut} height={20} rx={10} fill="#fff" opacity={0.5} />
        </g>
      </Svg>
      <div style={{position: 'absolute', top: 980, width: W, textAlign: 'center', fontFamily: FONT, opacity: txt, transform: `translateY(${interpolate(txt, [0, 1], [40, 0])}px)`}}>
        <div style={{color: 'white', fontSize: 58, fontWeight: 800, lineHeight: 1.05}}>You chew it forever</div>
        <div style={{color: C.plastic, fontSize: 116, fontWeight: 900, lineHeight: 1.0, textShadow: '0 8px 28px rgba(0,0,0,0.5)'}}>IT'S PLASTIC.</div>
        <div style={{color: C.gold, fontSize: 42, fontWeight: 700, marginTop: 14}}>never swallow it.</div>
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
      <span style={{background: 'rgba(8,24,26,0.55)', padding: '12px 26px', borderRadius: 22, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
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

export const Gum: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <Audio src={staticFile('gum_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.13} />

      <Sequence from={S.hook} durationInFrames={S.poly - S.hook}><SceneWrap dur={S.poly - S.hook}><SceneHook /></SceneWrap></Sequence>
      <Sequence from={S.poly} durationInFrames={S.melt - S.poly}><SceneWrap dur={S.melt - S.poly}><ScenePoly /></SceneWrap></Sequence>
      <Sequence from={S.melt} durationInFrames={S.mix - S.melt}><SceneWrap dur={S.mix - S.melt}><SceneMelt /></SceneWrap></Sequence>
      <Sequence from={S.mix} durationInFrames={S.never - S.mix}><SceneWrap dur={S.never - S.mix}><SceneMix /></SceneWrap></Sequence>
      <Sequence from={S.never} durationInFrames={S.wrap - S.never}><SceneWrap dur={S.wrap - S.never}><SceneNever /></SceneWrap></Sequence>
      <Sequence from={S.wrap} durationInFrames={DURATION_IN_FRAMES - S.wrap}><SceneWrap dur={DURATION_IN_FRAMES - S.wrap}><SceneWrapUp /></SceneWrap></Sequence>

      <Captions />
      <AbsoluteFill style={{background: 'radial-gradient(125% 82% at 50% 34%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

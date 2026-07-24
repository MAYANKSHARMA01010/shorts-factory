/**
 * StyledReel — Remotion composition that replicates the "Punjab Roots Realty"
 * stacked-kinetic-caption reel style (ref: Harsh/IMG_3281 (2).mp4).
 *
 * Renders: source video (OffthreadVideo, keeps its audio) + stacked, multi-colour,
 * gradient-filled, heavy ALL-CAPS captions that pop in word-by-word and stagger-stack.
 *
 * Driven entirely by inputProps (see reel-index.ts calculateMetadata):
 *   { videoSrc, phrases:[{start,end,words:[{text,color}]}], width, height, fps }
 */
import {
  AbsoluteFill, OffthreadVideo, Sequence, staticFile,
  interpolate, spring, useCurrentFrame, useVideoConfig, Img,
} from 'remotion';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';

const {fontFamily: ANTON} = loadAnton();
const {fontFamily: POP} = loadPoppins('normal', {weights: ['700', '800', '900']});

// vertical gradient pairs (top -> bottom) tuned to the reference palette
const GRAD: Record<string, [string, string]> = {
  red:    ['#E85B4D', '#9C1B10'],
  blue:   ['#CDE8FF', '#1F6FD6'],
  yellow: ['#FFE862', '#E0A100'],
  white:  ['#FFFFFF', '#D7E2EE'],
  green:  ['#8DE96D', '#1F9E18'],
};

type Word = {text: string; color: string};
type Phrase = {start: number; end: number; words: Word[]; pos?: string}; // pos: 'top'|'mid'|'bottom'
type Props = {
  videoSrc: string;
  phrases: Phrase[];
  contact?: string[];   // optional outro lines (first = highlighted)
  logoSrc?: string;     // brand logo PNG shown as a clean intro card (first ~2.4s)
  punchFrames?: number[]; // frames to apply a subtle zoom-punch (caption beats → snappier feel)
};

const chunkLines = (words: Word[]): Word[][] => {
  // pack by char budget: long words go solo, short words pair (matches the reference stack).
  // budget 14 keeps blocks to ~3 lines max so a 5-word phrase never towers down onto the face.
  const out: Word[][] = [];
  let line: Word[] = [];
  let len = 0;
  const BUDGET = 14;
  for (const w of words) {
    const wl = w.text.length;
    if (line.length && len + 1 + wl > BUDGET) {
      out.push(line);
      line = [];
      len = 0;
    }
    line.push(w);
    len += (len ? 1 : 0) + wl;
  }
  if (line.length) out.push(line);
  return out;
};

const WordSpan: React.FC<{w: Word; appearFrame: number; fontSize: number}> = ({
  w, appearFrame, fontSize,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({
    frame: frame - appearFrame, fps,
    config: {damping: 13, stiffness: 140, mass: 0.7},
  });
  const scale = interpolate(s, [0, 1], [0.55, 1]);
  const ty = interpolate(s, [0, 1], [fontSize * 0.25, 0]);
  const opacity = interpolate(frame - appearFrame, [0, 4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const [g0, g1] = GRAD[w.color] ?? GRAD.white;
  return (
    <span
      style={{
        display: 'inline-block',
        margin: `0 ${fontSize * 0.06}px`,
        transform: `translateY(${ty}px) scale(${scale})`,
        opacity,
        fontFamily: ANTON,
        fontSize,
        lineHeight: 0.9,
        letterSpacing: fontSize * 0.005,
        textTransform: 'uppercase',
        backgroundImage: `linear-gradient(180deg, ${g0} 0%, ${g1} 100%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        // client feedback: NO stroke — use a strong, layered drop-shadow instead for depth + legibility
        filter:
          `drop-shadow(0 ${fontSize * 0.045}px ${fontSize * 0.05}px rgba(0,0,0,0.95)) ` +
          `drop-shadow(0 ${fontSize * 0.09}px ${fontSize * 0.07}px rgba(0,0,0,0.7)) ` +
          `drop-shadow(0 0 ${fontSize * 0.02}px rgba(0,0,0,0.8))`,
      }}
    >
      {w.text}
    </span>
  );
};

const PhraseBlock: React.FC<{phrase: Phrase; fontSize: number}> = ({phrase, fontSize}) => {
  // NOTE: this block is rendered inside <Sequence from=...>, so useCurrentFrame() (used in
  // WordSpan) is RELATIVE to the sequence start. appearFrame must therefore be relative too —
  // just the per-word stagger, NOT phrase.start*fps (that double-counts the offset and hides text).
  const lines = chunkLines(phrase.words);
  let wi = 0;
  // the "punch" lives on the CAPTION (not the video): the whole block hits in with a quick
  // scale pulse on each caption beat → energy without zooming the footage.
  const f = useCurrentFrame();
  const punch = interpolate(f, [0, 5], [1.07, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // scene-aware vertical placement: top (open sky above subject), bottom (busy top / clean
  // foreground, e.g. gazebo roof or parking ramp), or mid (default upper-middle, the reference).
  const pos = phrase.pos || 'mid';
  // Place captions inside an explicit vertical BAND (a plain positioned div — NOT AbsoluteFill,
  // whose height:100% ignores top/bottom overrides) and center the block within it. The band is
  // sized so even a tall block never reaches the speaker's face:
  //   top    -> [0%, 33%]  (above the head, in open sky)
  //   bottom -> [58%, 98%] (lower third, over clean foreground / where the top is busy)
  //   mid    -> [6%, 44%]  (reference upper-middle)
  const band =
    pos === 'bottom'
      ? {top: '58%', height: '40%'}
      : pos === 'top'
      ? {top: '0%', height: '33%'}
      : {top: '6%', height: '38%'};
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...band,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${punch})`}}>
        {lines.map((ln, li) => {
          const offset = (li % 2 === 0 ? -1 : 1) * fontSize * 0.16;
          return (
            <div
              key={li}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'baseline',
                marginTop: li === 0 ? 0 : -fontSize * 0.14, // tight overlap = collage stack
                transform: `translateX(${offset}px)`,
                whiteSpace: 'nowrap',
              }}
            >
              {ln.map((w) => {
                const appearFrame = wi * 3; // sequence-relative stagger (3 frames per word)
                wi += 1;
                return <WordSpan key={wi} w={w} appearFrame={appearFrame} fontSize={fontSize} />;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ContactCard: React.FC<{lines: string[]; startFrame: number; W: number; H: number}> = ({
  lines, startFrame, W, H,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - startFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const fs = Math.max(20, H * 0.024);
  return (
    <AbsoluteFill style={{opacity: op}}>
      <div style={{position: 'absolute', bottom: H * 0.06, width: W, textAlign: 'center'}}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: POP, fontWeight: i === 0 ? 900 : 700,
              fontSize: i === 0 ? fs * 1.25 : fs, color: '#fff',
              letterSpacing: 0.5, marginTop: i === 0 ? 0 : fs * 0.35,
              textShadow: '0 2px 6px rgba(0,0,0,0.8)',
              display: 'inline-block', padding: i === 0 ? '4px 16px' : 0,
              background: i === 0 ? 'rgba(40,204,46,0.88)' : 'transparent',
              borderRadius: i === 0 ? 6 : 0,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// brand logo on a clean white card, springs in and fades out — the intro hook
const LogoIntro: React.FC<{logoSrc: string; toFrame: number; W: number}> = ({logoSrc, toFrame, W}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame > toFrame) return null;
  const inS = spring({frame: frame - 2, fps, config: {damping: 14, stiffness: 110, mass: 0.8}});
  const scale = interpolate(inS, [0, 1], [0.82, 1]);
  const op = interpolate(frame, [toFrame - 10, toFrame], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: op}}>
      <div
        style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 30,
          padding: `${W * 0.05}px ${W * 0.055}px`,
          width: W * 0.76,
          transform: `scale(${scale})`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Img src={logoSrc} style={{width: '100%', height: 'auto'}} />
      </div>
    </AbsoluteFill>
  );
};

export const StyledReel: React.FC<Props> = ({videoSrc, phrases, contact, logoSrc}) => {
  const {width, height, durationInFrames, fps} = useVideoConfig();
  const fontSize = Math.round(width * 0.12);
  const contactStart = durationInFrames - Math.round(4 * fps);
  const src = videoSrc.startsWith('http') ? videoSrc : staticFile(videoSrc);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <OffthreadVideo src={src} />
      {phrases.map((p, i) => {
        const from = Math.floor(p.start * fps);
        const dur = Math.max(1, Math.ceil((p.end - p.start) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <PhraseBlock phrase={p} fontSize={fontSize} />
          </Sequence>
        );
      })}
      {logoSrc ? (
        <LogoIntro logoSrc={staticFile(logoSrc)} toFrame={Math.round(2.4 * fps)} W={width} />
      ) : null}
      {contact && contact.length ? (
        <ContactCard lines={contact} startFrame={contactStart} W={width} H={height} />
      ) : null}
    </AbsoluteFill>
  );
};

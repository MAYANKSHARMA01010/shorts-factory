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
import tongueWords from './tonguemap_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 641;

// S3 Bright Pop palette
const C = {
  cream: '#FDF6E3',
  paper: '#F5EBC8',
  ink: '#111111',
  red: '#E63946',
  blue: '#1D3557',
  yellow: '#FFD23F',
  pink: '#FF7BA3',
  tongue: '#FF8FA8',
  tongueDeep: '#D46079',
  green: '#3AA35B',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// sentence boundaries derived from tonguemap_words.json
const S = { hook: 0, zones: 60, myth: 146, origin: 317, proofpaper: 400, proof: 461, payoff: 558 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.05, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

const Bg = ({ color = C.cream }: { color?: string }) => (
  <AbsoluteFill style={{ backgroundColor: color }}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 60 }).map((_, i) => (
        <circle key={i} cx={(i * 173) % 1080} cy={(i * 251) % 1920} r={2} fill={C.ink} opacity={0.06} />
      ))}
    </svg>
  </AbsoluteFill>
);

// ── CAPTIONS (root, 3-word karaoke pages, RED active — Bright Pop skin) ─────
const WRAW: { w: string; s: number }[] = (tongueWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
type Page = { words: string[]; startF: number };
const PAGES: Page[] = [];
for (let i = 0; i < WRAW.length; i += 3) {
  const chunk = WRAW.slice(i, i + 3);
  PAGES.push({ words: chunk.map((x) => x.w), startF: chunk[0].s * FPS });
}
function Captions() {
  const frame = useCurrentFrame();
  let pi = -1;
  for (let i = PAGES.length - 1; i >= 0; i--) { if (frame >= PAGES[i].startF) { pi = i; break; } }
  if (pi < 0) return null;
  const page = PAGES[pi];
  return (
    <div style={{ position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd = (WRAW[absIdx + 1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 0.5) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span
            key={wi}
            style={{
              color: active ? C.red : C.ink,
              WebkitTextStroke: active ? `4px ${C.ink}` : `3px ${C.ink}`,
              fontSize: 82,
              fontWeight: 900,
              fontFamily: "'Anton','Impact','Arial Black',sans-serif",
              letterSpacing: 1.5,
              transform: active ? 'scale(1.15) translateY(-4px)' : 'scale(1)',
              display: 'inline-block',
              margin: '0 14px',
              textTransform: 'uppercase',
              textShadow: `0 6px 0 ${C.ink}`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

// ── Tongue silhouette helper (with optional zone colouring) ──────────────────
function TongueShape({ zones, mapMode }: { zones?: { tip: string; midL: string; midR: string; back: string }; mapMode?: boolean }) {
  return (
    <g>
      <path
        d="M -300,-260 Q -260,-420 -80,-420 Q 0,-460 80,-420 Q 260,-420 300,-260 Q 340,-40 260,180 Q 140,380 0,400 Q -140,380 -260,180 Q -340,-40 -300,-260 Z"
        fill={mapMode && zones ? C.pink : C.tongue}
        stroke={C.ink}
        strokeWidth={10}
      />
      <path d="M 0,-400 L 0,300" stroke={C.ink} strokeWidth={4} opacity={0.35} />
      {zones && (
        <>
          <ellipse cx={0} cy={200} rx={200} ry={80} fill={zones.tip} opacity={0.85} />
          <ellipse cx={-190} cy={0} rx={100} ry={140} fill={zones.midL} opacity={0.85} />
          <ellipse cx={190} cy={0} rx={100} ry={140} fill={zones.midR} opacity={0.85} />
          <ellipse cx={0} cy={-330} rx={220} ry={70} fill={zones.back} opacity={0.85} />
        </>
      )}
    </g>
  );
}

// ─── SCENE 1: HOOK — "the tongue map" with big burned-in claim ──────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headPop = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const tonguePop = spring({ frame: frame - 6, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const lieOpacity = interpolate(frame, [24, 34], [0, 1], clamp);
  const liePop = spring({ frame: frame - 24, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const xDraw = interpolate(frame, [32, 46], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* headline claim */}
          <g transform={`translate(540,340) scale(${0.86 + 0.14 * Math.min(1, headPop)})`} opacity={Math.min(1, headPop)}>
            <text x={0} y={-40} textAnchor="middle" fill={C.ink} fontSize={78} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={2}>THE TONGUE MAP</text>
            <text x={0} y={70} textAnchor="middle" fill={C.red} fontSize={140} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={4} style={{ filter: `drop-shadow(0 6px 0 ${C.ink})` }} opacity={lieOpacity} transform={`scale(${liePop})`}>IS A LIE</text>
          </g>

          {/* the fake textbook tongue with zones */}
          <g transform={`translate(540,1150) scale(${0.86 + 0.20 * Math.min(1, tonguePop)}) rotate(${Math.sin(frame * 0.08) * 2})`}>
            <TongueShape zones={{ tip: C.red, midL: C.yellow, midR: C.yellow, back: C.blue }} mapMode />
            <text x={0} y={220} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">SWEET</text>
            <text x={0} y={-320} textAnchor="middle" fill={C.white} fontSize={38} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">BITTER</text>
            <text x={-190} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">SOUR</text>
            <text x={190} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">SALT</text>
          </g>

          {/* big red X drawn over it */}
          {frame > 32 && (
            <g transform="translate(540,1150)">
              <path d="M -360,-380 L 360,380" fill="none" stroke={C.red} strokeWidth={30} strokeLinecap="round" strokeDasharray={1100} strokeDashoffset={1100 * (1 - xDraw)} />
              <path d="M 360,-380 L -360,380" fill="none" stroke={C.red} strokeWidth={30} strokeLinecap="round" strokeDasharray={1100} strokeDashoffset={1100 * (1 - Math.max(0, xDraw - 0.2))} />
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: ZONES — "sweet at tip, bitter at back" ─────────────────────────
function SceneZones() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sweetPop = spring({ frame: frame - 4, fps, config: { damping: 12, mass: 0.5, stiffness: 240 } });
  const bitterPop = spring({ frame: frame - 40, fps, config: { damping: 12, mass: 0.5, stiffness: 240 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* big diagram tongue center */}
          <g transform={`translate(540,960) scale(1.3)`}>
            <TongueShape zones={{ tip: C.red, midL: C.paper, midR: C.paper, back: C.blue }} mapMode />
          </g>

          {/* SWEET arrow at tip */}
          <g transform={`translate(540,1500) scale(${sweetPop})`}>
            <rect x={-260} y={-70} width={520} height={140} rx={30} fill={C.red} stroke={C.ink} strokeWidth={8} />
            <text x={0} y={22} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={2}>SWEET → TIP</text>
          </g>

          {/* BITTER arrow at back */}
          <g transform={`translate(540,440) scale(${bitterPop})`}>
            <rect x={-280} y={-70} width={560} height={140} rx={30} fill={C.blue} stroke={C.ink} strokeWidth={8} />
            <text x={0} y={22} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={2}>BITTER → BACK</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: MYTH — 10k taste buds detect all 5 tastes ─────────────────────
function SceneMyth() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const smash = spring({ frame: frame - 4, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const num = Math.round(interpolate(frame, [30, 90], [0, 10000], clamp));
  const budsFade = interpolate(frame, [60, 100], [0, 1], clamp);
  // 5 tastes cascade in
  const tasteIn = (i: number) => spring({ frame: frame - (100 + i * 12), fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const tastes = [
    { icon: '🍭', label: 'SWEET', color: C.red },
    { icon: '🍋', label: 'SOUR', color: C.yellow },
    { icon: '🧂', label: 'SALTY', color: C.blue },
    { icon: '☕', label: 'BITTER', color: '#5A3820' },
    { icon: '🍜', label: 'UMAMI', color: C.green },
  ];

  // pseudo-random taste buds sprinkled across the tongue
  const buds: { x: number; y: number; c: string }[] = [];
  const rng = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 60; i++) {
    const ang = rng(i * 3.7) * Math.PI * 2;
    const rad = 60 + rng(i * 5.1) * 240;
    buds.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 1.15, c: tastes[i % 5].color });
  }

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* "TOTAL MYTH" stamp */}
          <g transform={`translate(540,300) scale(${smash}) rotate(-6)`}>
            <rect x={-380} y={-90} width={760} height={180} rx={30} fill={C.red} stroke={C.ink} strokeWidth={10} />
            <text x={0} y={38} textAnchor="middle" fill={C.white} fontSize={130} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={4}>TOTAL MYTH</text>
          </g>

          {/* tongue with ALL taste buds (all colors, everywhere) */}
          <g transform="translate(540,1080)" opacity={budsFade}>
            <TongueShape />
            {buds.map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={10} fill={b.c} stroke={C.ink} strokeWidth={1.5} />
            ))}
          </g>

          {/* 10,000 counter */}
          <g transform="translate(540,690)">
            <text x={0} y={0} textAnchor="middle" fill={C.blue} fontSize={110} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={3}>{num.toLocaleString()}</text>
            <text x={0} y={54} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={800} fontFamily="Anton,Impact,Arial Black,sans-serif">TASTE BUDS</text>
          </g>

          {/* 5 taste pills across bottom */}
          {tastes.map((t, i) => {
            const sc = tasteIn(i);
            if (sc < 0.01) return null;
            return (
              <g key={i} transform={`translate(${140 + i * 190},1660) scale(${sc})`}>
                <circle cx={0} cy={0} r={70} fill={t.color} stroke={C.ink} strokeWidth={6} />
                <text x={0} y={16} textAnchor="middle" fill={C.white} fontSize={26} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">{t.label}</text>
              </g>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: ORIGIN — 1942 mistranslation of a German paper ────────────────
function SceneOrigin() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const paperPop = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const stampPop = spring({ frame: frame - 50, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const redCircle = interpolate(frame, [60, 90], [0, 1], clamp);
  const yearPop = spring({ frame: frame - 24, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });

  return (
    <AbsoluteFill>
      <Bg color={C.cream} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Vintage paper */}
          <g transform={`translate(540,960) scale(${paperPop}) rotate(-3)`}>
            <rect x={-380} y={-500} width={760} height={1000} fill={C.paper} stroke={C.ink} strokeWidth={8} rx={4} />
            {/* page lines */}
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={-320} y={-380 + i * 60} width={640 - (i === 0 ? 200 : 0)} height={16} fill={C.ink} opacity={0.15} rx={4} />
            ))}
            {/* header */}
            <text x={0} y={-420} textAnchor="middle" fill={C.ink} fontSize={44} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">EDWIN G. BORING · 1942</text>
            {/* translation error highlight */}
            <rect x={-260} y={-100} width={520} height={80} fill={C.yellow} opacity={0.7} />
            <text x={0} y={-40} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">"MISREAD HÄNIG"</text>
          </g>

          {/* 1942 big year */}
          <g transform={`translate(540,340) scale(${yearPop})`}>
            <text x={0} y={0} textAnchor="middle" fill={C.red} fontSize={180} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={6} style={{ filter: `drop-shadow(0 6px 0 ${C.ink})` }}>1942</text>
          </g>

          {/* MISTRANSLATION rubber stamp */}
          <g transform={`translate(540,1500) scale(${stampPop}) rotate(-10)`}>
            <rect x={-380} y={-80} width={760} height={160} rx={16} fill="none" stroke={C.red} strokeWidth={10} />
            <text x={0} y={36} textAnchor="middle" fill={C.red} fontSize={80} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={4}>MISTRANSLATION</text>
          </g>

          {/* red circle scribble around the error */}
          {frame > 60 && (
            <g transform="translate(540,860)">
              <ellipse cx={0} cy={0} rx={280} ry={70} fill="none" stroke={C.red} strokeWidth={10} strokeDasharray={1800} strokeDashoffset={1800 * (1 - redCircle)} />
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: PROOF — 1999 scientists proved it wrong ───────────────────────
function SceneProof() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const yearPop = spring({ frame: frame - 2, fps, config: { damping: 10, mass: 0.4, stiffness: 260 } });
  const checkDraw = interpolate(frame, [30, 60], [0, 1], clamp);
  const checkPop = spring({ frame: frame - 30, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const bookPop = spring({ frame: frame - 22, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });

  return (
    <AbsoluteFill>
      <Bg color={C.cream} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* 1999 big year */}
          <g transform={`translate(540,420) scale(${yearPop})`}>
            <text x={0} y={0} textAnchor="middle" fill={C.blue} fontSize={200} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={6} style={{ filter: `drop-shadow(0 6px 0 ${C.ink})` }}>1999</text>
            <text x={0} y={70} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={800} fontFamily="Anton,Impact,Arial Black,sans-serif">CHANDRASHEKAR ET AL.</text>
          </g>

          {/* Journal / paper */}
          <g transform={`translate(540,1140) scale(${bookPop})`}>
            <rect x={-320} y={-260} width={640} height={520} fill={C.white} stroke={C.ink} strokeWidth={8} rx={12} />
            <rect x={-320} y={-260} width={640} height={90} fill={C.yellow} stroke={C.ink} strokeWidth={8} rx={12} />
            <text x={0} y={-205} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif">JOURNAL OF NEUROSCIENCE</text>
            <text x={0} y={-100} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={800} fontFamily="Anton,Impact,Arial Black,sans-serif">"TASTE BUDS RESPOND</text>
            <text x={0} y={-40} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={800} fontFamily="Anton,Impact,Arial Black,sans-serif">TO ALL FIVE TASTES</text>
            <text x={0} y={20} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={800} fontFamily="Anton,Impact,Arial Black,sans-serif">ACROSS THE TONGUE"</text>

            {/* Green check */}
            <g transform={`translate(0,180) scale(${checkPop})`}>
              <circle cx={0} cy={0} r={80} fill={C.green} stroke={C.ink} strokeWidth={8} />
              <path d="M -30,0 L -8,26 L 38,-24" fill="none" stroke={C.white} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={200} strokeDashoffset={200 * (1 - checkDraw)} />
            </g>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — "Your whole tongue tastes everything" ────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tonguePop = spring({ frame: frame - 0, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  // Word slams
  const w1 = spring({ frame: frame - 8, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w2 = spring({ frame: frame - 22, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w3 = spring({ frame: frame - 36, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  const w4 = spring({ frame: frame - 50, fps, config: { damping: 12, mass: 0.4, stiffness: 240 } });
  // pulsing dots on tongue (all colors)
  const dotColors = [C.red, C.yellow, C.blue, '#5A3820', C.green];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Whole tongue, all colors */}
          <g transform={`translate(540,1200) scale(${1.05 * tonguePop})`}>
            <TongueShape />
            {Array.from({ length: 40 }).map((_, i) => {
              const seed = i * 5.7;
              const ang = (Math.sin(seed) * 0.5 + 0.5) * Math.PI * 2;
              const rad = 40 + (Math.cos(seed * 1.3) * 0.5 + 0.5) * 220;
              const x = Math.cos(ang) * rad;
              const y = Math.sin(ang) * rad * 1.15;
              const pulse = 0.7 + 0.3 * Math.sin(frame * 0.2 + i);
              return <circle key={i} cx={x} cy={y} r={12 * pulse} fill={dotColors[i % 5]} stroke={C.ink} strokeWidth={2} />;
            })}
          </g>

          {/* Payoff word slam */}
          <g transform="translate(540,500)">
            {w1 > 0.01 && (
              <text x={0} y={-80} textAnchor="middle" fill={C.ink} fontSize={90} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={2} transform={`scale(${w1})`}>YOUR WHOLE</text>
            )}
            {w2 > 0.01 && (
              <text x={0} y={30} textAnchor="middle" fill={C.red} fontSize={140} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" letterSpacing={4} transform={`scale(${w2})`} style={{ filter: `drop-shadow(0 6px 0 ${C.ink})` }}>TONGUE</text>
            )}
            {w3 > 0.01 && (
              <text x={-160} y={150} textAnchor="middle" fill={C.blue} fontSize={80} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" transform={`scale(${w3})`}>TASTES</text>
            )}
            {w4 > 0.01 && (
              <text x={140} y={150} textAnchor="middle" fill={C.ink} fontSize={80} fontWeight={900} fontFamily="Anton,Impact,Arial Black,sans-serif" transform={`scale(${w4})`}>EVERYTHING</text>
            )}
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Tonguemap: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.cream }}>
      <Audio src={staticFile('tonguemap_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.10} />

      {/* baked scene-matched SFX */}
      <Sequence from={S.hook + 24}><Audio src={staticFile('sfx_smack.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.hook + 32}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.zones + 4}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.zones + 40}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.myth + 4}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.55} /></Sequence>
      <Sequence from={S.myth + 62}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.myth + 100}><Audio src={staticFile('sfx_boing.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.myth + 130}><Audio src={staticFile('sfx_boing.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.origin + 4}><Audio src={staticFile('sfx_glass.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.origin + 24}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.origin + 60}><Audio src={staticFile('sfx_click.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.proof + 2}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.5} /></Sequence>
      <Sequence from={S.proof + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.55} /></Sequence>

      <Sequence from={S.payoff + 8}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.payoff + 22}><Audio src={staticFile('sfx_smack.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.payoff + 50}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.6} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.zones - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.zones} durationInFrames={S.myth - S.zones}><SceneZones /></Sequence>
      <Sequence from={S.myth} durationInFrames={S.origin - S.myth}><SceneMyth /></Sequence>
      <Sequence from={S.origin} durationInFrames={S.proof - S.origin}><SceneOrigin /></Sequence>
      <Sequence from={S.proof} durationInFrames={S.payoff - S.proof}><SceneProof /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

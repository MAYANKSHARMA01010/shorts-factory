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
import sfWords from './starfish_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1056;

const C = {
  bg:      '#0b1620',
  mid:     '#13212e',
  gold:    '#FFD23F',
  orange:  '#FF7A3D',
  shadow:  '#C8552A',
  shell:   '#E8D9B5',
  flesh:   '#F2A6B8',
  teal:    '#3FE0C5',
  green:   '#9BE564',
  water:   '#2E8FD6',
  memb:    '#FBEFF2',
  ink:     '#070e15',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, grip: 124, pry: 309, stomach: 483, digest: 728, payoff: 900 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (sfWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
          <span key={wi} style={{
            color: active ? C.gold : '#fff', fontSize: 62, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 15px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 50% 42%, ${C.mid} 0%, ${C.bg} 72%)` }} />;

function Star({ scale = 1, rot = 0 }: { scale?: number; rot?: number }) {
  return (
    <g transform={`scale(${scale}) rotate(${rot})`}>
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k} transform={`rotate(${k * 72})`}>
          <path d="M 0,0 Q 56,-90 0,-220 Q -56,-90 0,0 Z" fill={C.orange} stroke={C.shadow} strokeWidth={4} />
          <line x1={0} y1={-20} x2={0} y2={-190} stroke={C.shadow} strokeWidth={6} opacity={0.5} />
          {[0, 1, 2].map((d) => <circle key={d} cx={(d - 1) * 14} cy={-80 - d * 36} r={5} fill={C.shadow} opacity={0.6} />)}
        </g>
      ))}
      <circle cx={0} cy={0} r={56} fill={C.shadow} />
      <circle cx={0} cy={0} r={30} fill={C.ink} />
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 8, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const qLoop = interpolate(frame, [22, 44], [0, 1], clamp);
  const icons = [0, 1, 2].map((k) => spring({ frame: frame - 30 - k * 8, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,980) scale(${Math.min(1, pop)}) rotate(${frame * 0.3})`}>
            <Star scale={1.9} />
          </g>
          {/* ? loop around mouth */}
          <circle cx={540} cy={980} r={90} fill="none" stroke={C.gold} strokeWidth={5} strokeDasharray="200 60"
            pathLength={100} strokeDashoffset={100 * (1 - qLoop)} opacity={0.9} transform={`rotate(${frame * 1.5} 540 980)`} />
          {/* badge */}
          <g transform={`translate(540,420) scale(${badge})`} opacity={badge}>
            <rect x={-300} y={-50} width={600} height={100} rx={26} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NO TEETH. NO JAW.</text>
          </g>
          {/* crossed icons */}
          {[['🦷', 220], ['🍴', 540], ['😬', 860]].map((ic, k) => (
            <g key={k} transform={`translate(${ic[1]},1560) scale(${icons[k]})`} opacity={icons[k] * 0.6}>
              <text x={0} y={0} textAnchor="middle" fontSize={50}>{ic[0]}</text>
              <line x1={-30} y1={-30} x2={30} y2={20} stroke={C.orange} strokeWidth={5} />
            </g>
          ))}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Clam({ open = 0, x = 540, y = 1100, scale = 1, flesh = 0 }: { open?: number; x?: number; y?: number; scale?: number; flesh?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* flesh */}
      {flesh > 0 && <ellipse cx={0} cy={0} rx={120} ry={50} fill={C.flesh} opacity={flesh} />}
      {/* bottom half */}
      <path d="M -180,0 Q 0,90 180,0 Q 0,40 -180,0 Z" fill={C.shell} stroke={C.shadow} strokeWidth={3} />
      {/* top half (hinged right) */}
      <g transform={`rotate(${-open * 14} 180 0)`}>
        <path d="M -180,0 Q 0,-90 180,0 Q 0,-40 -180,0 Z" fill={C.shell} stroke={C.shadow} strokeWidth={3} />
        {[40, 80, 120].map((r, k) => <path key={k} d={`M -${r},${-r * 0.18} Q 0,${-r * 0.5} ${r},${-r * 0.18}`} fill="none" stroke={C.shadow} strokeWidth={2} opacity={0.4} />)}
      </g>
    </g>
  );
}

// ─── SCENE 2: GRIP ────────────────────────────────────────────────────────────
function SceneGrip() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arc = spring({ frame, fps, config: { damping: 60, mass: 0.6, stiffness: 150 } });
  const feet = interpolate(frame, [30, 90], [0, 1], clamp);
  const count = Math.round(interpolate(feet, [0, 1], [0, 250], clamp));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Clam x={540} y={1180} scale={1.1} />
          {/* tube feet */}
          {Array.from({ length: 30 }).map((_, k) => {
            const on = feet > k / 30;
            const fx = 340 + (k % 10) * 40;
            const fy = 1120 + Math.floor(k / 10) * 26;
            return on ? <g key={k}><line x1={fx} y1={fy - 40} x2={fx} y2={fy} stroke={C.teal} strokeWidth={5} /><circle cx={fx} cy={fy} r={8} fill={C.teal} opacity={0.9} /></g> : null;
          })}
          {/* starfish over clam */}
          <g transform={`translate(540,${interpolate(arc, [0, 1], [600, 940])}) scale(1.2) rotate(${interpolate(arc, [0, 1], [-20, 0])})`}>
            <Star scale={1.1} />
          </g>
          {/* counter */}
          <g transform="translate(840,520)">
            <rect x={-110} y={-36} width={220} height={72} rx={16} fill={C.ink} stroke={C.gold} strokeWidth={3} />
            <text x={0} y={2} textAnchor="middle" fill={C.gold} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{count}</text>
            <text x={0} y={28} textAnchor="middle" fill={C.teal} fontSize={18} fontWeight={700} fontFamily="Poppins,sans-serif">SUCTION FEET</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: PRY ─────────────────────────────────────────────────────────────
function ScenePry() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = interpolate(frame, [20, 120], [0, 1], clamp);
  const strain = 1 + 0.02 * Math.sin(frame * 0.5);
  const label = spring({ frame: frame - 90, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="scale(1.5)" style={{ transformOrigin: '540px 960px' }}>
            <Clam open={open} x={540} y={960} scale={1} flesh={open * 0.6} />
            {/* tube-foot tethers straining */}
            {[-120, -60, 60, 120].map((tx, k) => (
              <g key={k} transform={`scale(1 ${strain})`}>
                <line x1={540 + tx} y1={900} x2={540 + tx} y2={960 + (k < 2 ? -open * 30 : 0)} stroke={C.teal} strokeWidth={5} />
                <circle cx={540 + tx} cy={900} r={7} fill={C.teal} />
              </g>
            ))}
          </g>
          {/* gold gap sliver */}
          <rect x={300} y={930} width={6} height={60 * open} fill={C.gold} opacity={0.9} />
          {/* caliper */}
          <g transform="translate(240,940)" opacity={label}>
            <line x1={0} y1={-30} x2={0} y2={30} stroke={C.gold} strokeWidth={3} />
            <rect x={-180} y={-30} width={160} height={60} rx={14} fill={C.gold} />
            <text x={-100} y={8} textAnchor="middle" fill={C.ink} fontSize={28} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">A HAIR WIDE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: STOMACH (hero evert) ────────────────────────────────────────────
function SceneStomach() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const evert = interpolate(frame, [20, 140], [0, 1], clamp);
  const wobble = 1 + 0.04 * Math.sin(frame * 0.18);
  const sheen = interpolate((frame * 3) % 110, [0, 55, 110], [0, 1, 0], clamp);
  const label = spring({ frame: frame - 150, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <radialGradient id="stoG" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor={C.memb} stopOpacity={0.9} />
              <stop offset="100%" stopColor={C.flesh} stopOpacity={0.75} />
            </radialGradient>
          </defs>
          {/* starfish body cross-section (top) */}
          <g transform="translate(540,560) scale(1.0)"><Star scale={1.0} /></g>
          {/* mouth ring emphasized */}
          <circle cx={540} cy={560} r={40} fill={C.ink} stroke={C.gold} strokeWidth={4} />
          {/* clam below */}
          <Clam open={1} x={540} y={1200} scale={1.2} flesh={0.7} />
          {/* everting stomach */}
          {evert > 0 && (
            <g transform={`scale(${wobble})`} style={{ transformOrigin: '540px 800px' }}>
              {/* pinched waist through gap */}
              <path d={`M 500,560 C 480,${600 + evert * 100} 470,${760} 510,${860}
                        C 480,${900 + evert * 120} 470,${1080} 540,${1140}
                        C 610,${1080} 600,${900 + evert * 120} 570,${860}
                        C 610,${760} 600,${600 + evert * 100} 580,560 Z`}
                fill="url(#stoG)" stroke={C.flesh} strokeWidth={3} opacity={0.92} />
              {/* digestive channels */}
              {evert > 0.5 && [0, 1, 2].map((k) => (
                <path key={k} d={`M ${520 + k * 12},620 q 10,200 0,420`} fill="none" stroke={C.green} strokeWidth={3} opacity={0.6} />
              ))}
              {/* wet sheen */}
              <ellipse cx={510} cy={interpolate(sheen, [0, 1], [700, 1000])} rx={20} ry={60} fill="#fff" opacity={sheen * 0.4} />
            </g>
          )}
          {/* label */}
          <g transform="translate(540,1420)" opacity={label}>
            <rect x={-280} y={-34} width={560} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">STOMACH = OUTSIDE ITS BODY</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DIGEST ──────────────────────────────────────────────────────────
function SceneDigest() {
  const frame = useCurrentFrame();
  const melt = interpolate(frame, [10, 110], [0, 1], clamp);
  const slosh = Math.sin(frame * 0.12) * 14;
  const aliveThrob = 0.5 + 0.5 * Math.sin(frame * 0.16);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* shell gap frame */}
          <ellipse cx={540} cy={960} rx={320} ry={240} fill={C.mid} stroke={C.shell} strokeWidth={6} />
          {/* dissolving flesh → soup */}
          <g transform={`translate(${540 + slosh},960)`}>
            <ellipse cx={0} cy={0} rx={interpolate(melt, [0, 1], [180, 240])} ry={interpolate(melt, [0, 1], [120, 150])}
              fill={`rgb(${Math.round(242 - melt * 90)},${Math.round(166 + melt * 60)},${Math.round(184 - melt * 80)})`} opacity={0.85} />
            {/* enzyme bubbles */}
            {Array.from({ length: 14 }).map((_, k) => {
              const t = ((frame * 3 + k * 30) % 120) / 120;
              return <circle key={k} cx={((k * 53) % 360) - 180} cy={120 - t * 240} r={8 * (1 - t) + 3} fill={C.green} opacity={(1 - t) * 0.7 * melt} />;
            })}
          </g>
          {/* ALIVE */}
          <text x={540} y={560} textAnchor="middle" fill={C.green} fontSize={64} fontWeight={900}
            fontFamily="Poppins,Arial Black,sans-serif" opacity={0.5 + aliveThrob * 0.5}>ALIVE</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const retract = interpolate(frame, [6, 60], [1, 0], clamp);
  const words = ['IT', 'EATS', 'INSIDE-OUT'];
  const ws = words.map((_, k) => spring({ frame: frame - 50 - k * 14, fps, config: { damping: k === 2 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* empty clean shell */}
          <Clam open={0.2} x={540} y={1240} scale={1.0} />
          {/* retracting stomach streamline */}
          {retract > 0.05 && <path d={`M 540,1180 C 540,${1180 - retract * 400} 540,${1000 - retract * 200} 540,720`} fill="none" stroke={C.green} strokeWidth={20 * retract} opacity={retract * 0.6} strokeLinecap="round" />}
          {/* starfish */}
          <g transform={`translate(540,820) scale(1.0) rotate(${frame * 0.2})`}><Star scale={1.0} /></g>
          {/* payoff */}
          <text x={540} y={500} textAnchor="middle" fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill="#fff" opacity={ws[0]}>IT </tspan><tspan fill="#fff" opacity={ws[1]}>EATS</tspan>
          </text>
          <text x={540} y={620} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}
            opacity={ws[2]} transform={`translate(540,620) scale(${ws[2]}) translate(-540,-620)`}>INSIDE-OUT</text>
          <rect x={250} y={648} width={580 * ws[2]} height={8} rx={4} fill={C.gold} opacity={ws[2]} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Starfish: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('starfish_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* underwater/organic sound design (baked) */}
      <Sequence from={S.hook + 4} durationInFrames={60}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.28} /></Sequence>
      <Sequence from={S.hook + 12}><Audio src={staticFile('sfx_chime.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.grip + 34}><Audio src={staticFile('sfx_plip.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.pry + 20} durationInFrames={70}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.3} /></Sequence>
      <Sequence from={S.stomach + 46} durationInFrames={110}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.digest + 16} durationInFrames={90}><Audio src={staticFile('sfx_digital.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.payoff + 24}><Audio src={staticFile('sfx_plip.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 78}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.grip - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.grip} durationInFrames={S.pry - S.grip}><SceneGrip /></Sequence>
      <Sequence from={S.pry} durationInFrames={S.stomach - S.pry}><ScenePry /></Sequence>
      <Sequence from={S.stomach} durationInFrames={S.digest - S.stomach}><SceneStomach /></Sequence>
      <Sequence from={S.digest} durationInFrames={S.payoff - S.digest}><SceneDigest /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

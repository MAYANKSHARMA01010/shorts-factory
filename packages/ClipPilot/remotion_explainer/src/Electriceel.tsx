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
import eeWords from './electriceel_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1071;

const C = {
  bg:      '#0b1014',
  river:   '#0e1a1f',
  gold:    '#FFD23F',
  eel:     '#3FE0C8',
  spine:   '#1c6b63',
  volt:    '#5AB8FF',
  red:     '#FF4D5E',
  amber:   '#FF9F4A',
  teal:    '#1FA0A8',
  sparkW:  '#EAF6FF',
  ink:     '#06090b',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, batteries: 153, fire: 342, lock: 535, swallow: 775, payoff: 893 };

function eelPath(phase: number, amp = 60) {
  const pts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = -320 + i * 53;
    const y = Math.sin(i * 0.6 + phase) * amp;
    pts.push(i === 0 ? `M ${x},${y.toFixed(1)}` : `L ${x},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (eeWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 40%, ${C.river} 0%, ${C.bg} 74%)` }} />;

// horizontal eel, head at right; draw at a translate/rotate
function Eel({ phase = 0, amp = 60, headGlow = 0 }: { phase?: number; amp?: number; headGlow?: number }) {
  const d = eelPath(phase, amp);
  const hy = Math.sin(12 * 0.6 + phase) * amp;
  return (
    <g>
      <path d={d} fill="none" stroke={C.eel} strokeWidth={68} strokeLinecap="round" />
      <path d={d} fill="none" stroke={C.spine} strokeWidth={20} strokeLinecap="round" opacity={0.5} transform="translate(0,-20)" />
      {/* head */}
      <circle cx={316} cy={hy} r={42} fill={C.eel} />
      {headGlow > 0 && <circle cx={316} cy={hy} r={42 + headGlow * 30} fill={C.sparkW} opacity={headGlow * 0.5} />}
      <circle cx={330} cy={hy - 12} r={8} fill={C.sparkW} />
    </g>
  );
}

function BatteryRow({ count = 16, flash = 0, fillTo = 1 }: { count?: number; flash?: number; fillTo?: number }) {
  return (
    <g>
      {Array.from({ length: count }).map((_, k) => {
        if (k / count > fillTo) return null;
        const x = -360 + k * 46;
        const col = k % 2 ? C.volt : C.amber;
        return (
          <g key={k} transform={`translate(${x},0)`}>
            <rect x={-16} y={-44} width={32} height={88} rx={6} fill={flash > 0.5 ? C.sparkW : col} />
            <rect x={-7} y={-54} width={14} height={12} rx={3} fill={flash > 0.5 ? C.sparkW : col} />
          </g>
        );
      })}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [4, 30], [0, 1], clamp);
  const badge = spring({ frame: frame - 14, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const foot = interpolate(frame, [20, 40], [-120, 60], clamp);
  const ripple = interpolate(frame, [38, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* foot dipping */}
          <g transform={`translate(700,${foot})`}>
            <rect x={-30} y={-180} width={60} height={180} rx={20} fill="#2a3640" />
            <ellipse cx={0} cy={0} rx={50} ry={24} fill="#2a3640" />
          </g>
          {ripple > 0 && <ellipse cx={700} cy={70} rx={ripple * 220} ry={ripple * 50} fill="none" stroke={C.teal} strokeWidth={4} opacity={(1 - ripple) * 0.6} />}
          {/* eel */}
          <g transform={`translate(540,960) rotate(-12) scale(1.5)`}>
            <g style={{ clipPath: 'none' }}>
              <g opacity={draw}><Eel phase={frame * 0.08} amp={66} /></g>
            </g>
          </g>
          {/* badge */}
          <g transform={`translate(540,420) scale(${badge})`} opacity={badge}>
            <rect x={-290} y={-54} width={580} height={108} rx={28} fill={C.gold} />
            <text x={40} y={14} textAnchor="middle" fill={C.ink} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">STOPS YOUR HEART?</text>
            <path d="M -250,-20 L -270,6 L -254,6 L -266,30 L -234,-4 L -250,-4 Z" fill={C.ink} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: BATTERIES ───────────────────────────────────────────────────────
function SceneBatteries() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fillTo = interpolate(frame, [10, 90], [0, 1], clamp);
  const wire = interpolate(frame, [20, 110], [0, 1], clamp);
  const count = frame < 30 ? 12 : frame < 70 ? 340 : 6000;
  const label = spring({ frame: frame - 96, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* ghost eel channel */}
          <rect x={150} y={840} width={780} height={160} rx={80} fill="none" stroke={C.spine} strokeWidth={5} opacity={0.5} />
          <circle cx={930} cy={920} r={48} fill="none" stroke={C.spine} strokeWidth={5} opacity={0.5} />
          {/* battery row */}
          <g transform="translate(540,920)">
            <BatteryRow count={16} fillTo={fillTo} />
            {/* wire */}
            <path d="M -360,60 L 320,60" fill="none" stroke={C.gold} strokeWidth={5}
              pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - wire)} />
          </g>
          {/* counter */}
          <text x={540} y={620} textAnchor="middle" fill={C.volt} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{count.toLocaleString()} cells</text>
          {/* BATTERIES pill */}
          <g transform="translate(540,1180)" opacity={label}>
            <rect x={-130} y={-32} width={260} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BATTERIES</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: FIRE (hero 600V) ────────────────────────────────────────────────
function SceneFire() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SLAM = 40;
  const charge = interpolate(frame, [4, SLAM - 4], [0, 1], clamp);
  const flash = frame >= SLAM && frame < SLAM + 4 ? 1 : 0;
  const bolt = interpolate(frame, [SLAM, SLAM + 6], [0, 1], clamp);
  const counter = spring({ frame: frame - SLAM, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } });
  const shock = interpolate(frame, [SLAM, SLAM + 30], [0, 1], clamp);
  const vNum = Math.round(interpolate(counter, [0, 1], [0, 600], clamp));
  const screenBloom = frame >= SLAM && frame < SLAM + 3 ? 1 : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      {screenBloom > 0 && <AbsoluteFill style={{ background: C.sparkW, opacity: 0.5 }} />}
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* eel channel + terminals */}
          <rect x={150} y={1100} width={780} height={150} rx={75} fill="none" stroke={C.spine} strokeWidth={5} opacity={0.5} />
          <g transform="translate(540,1175)">
            <BatteryRow count={16} flash={charge > 0.7 ? 1 : 0} fillTo={1} />
          </g>
          <text x={180} y={1090} fill={C.red} fontSize={40} fontWeight={900} fontFamily="Poppins,sans-serif">+</text>
          <text x={900} y={1090} fill={C.volt} fontSize={40} fontWeight={900} fontFamily="Poppins,sans-serif">−</text>
          {/* forked lightning from head (left +) toward prey (top) */}
          {bolt > 0 && (
            <g opacity={bolt}>
              <path d="M 200,1140 L 320,820 L 260,840 L 420,520 L 360,540 L 500,300" fill="none" stroke={C.sparkW} strokeWidth={12} strokeLinejoin="round" />
              <path d="M 200,1140 L 320,820 L 260,840 L 420,520 L 360,540 L 500,300" fill="none" stroke={C.volt} strokeWidth={5} strokeLinejoin="round" />
              <path d="M 420,520 L 560,560 L 640,460" fill="none" stroke={C.sparkW} strokeWidth={7} />
            </g>
          )}
          {/* prey */}
          <g transform="translate(540,300)" opacity={1 - shock * 0.5}>
            <ellipse cx={0} cy={0} rx={40} ry={24} fill="none" stroke={C.red} strokeWidth={4} />
          </g>
          {/* 600 V counter */}
          <g transform={`translate(540,720) scale(${counter})`} opacity={counter}>
            <circle cx={0} cy={0} r={150} fill="none" stroke={C.gold} strokeWidth={8} />
            {Array.from({ length: 16 }).map((_, k) => {
              const a = (k * 22.5) * Math.PI / 180;
              return <line key={k} x1={Math.cos(a) * 160} y1={Math.sin(a) * 160} x2={Math.cos(a) * 180} y2={Math.sin(a) * 180} stroke={C.gold} strokeWidth={4} />;
            })}
            <text x={0} y={24} textAnchor="middle" fill={C.gold} fontSize={84} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{vNum}V</text>
          </g>
          {/* shockwave ring */}
          {shock > 0 && <circle cx={540} cy={720} r={shock * 420} fill="none" stroke={C.gold} strokeWidth={6 * (1 - shock) + 1} opacity={1 - shock} />}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: LOCK (current locks fish) ───────────────────────────────────────
function SceneLock() {
  const frame = useCurrentFrame();
  const fishes = [[760, 700], [840, 920], [720, 1080]];
  const ring = (k: number) => interpolate(frame, [10 + k * 16, 70 + k * 16], [0, 1], clamp);
  const locked = (i: number) => frame > 40 + i * 30 ? 1 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* eel small left */}
          <g transform="translate(260,900) rotate(8) scale(0.8)"><Eel phase={frame * 0.1} amp={50} headGlow={0.4 + 0.4 * Math.sin(frame * 0.3)} /></g>
          {/* field rings */}
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={300} cy={900} r={ring(k) * 700} fill="none" stroke={C.volt} strokeWidth={6} opacity={(1 - ring(k)) * 0.6} />
          ))}
          {/* fish */}
          {fishes.map((p, i) => {
            const lk = locked(i);
            return (
              <g key={i} transform={`translate(${p[0]},${p[1]})`}>
                {lk ? (
                  <g stroke={C.amber} strokeWidth={5} fill="none">
                    <rect x={-44} y={-26} width={88} height={52} />
                    <path d="M 44,0 L 80,-24 L 80,24 Z" />
                  </g>
                ) : (
                  <g fill={C.amber} opacity={0.7}>
                    <ellipse cx={0} cy={0} rx={44} ry={26} />
                    <path d="M 44,0 L 80,-24 L 80,24 Z" />
                  </g>
                )}
                {lk > 0 && i < 2 && (
                  <g transform="translate(0,-60)">
                    <circle r={20} fill="none" stroke={C.red} strokeWidth={4} />
                    <line x1={-14} y1={-14} x2={14} y2={14} stroke={C.red} strokeWidth={4} />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: SWALLOW ─────────────────────────────────────────────────────────
function SceneSwallow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mouth = spring({ frame: frame - 6, fps, config: { damping: 80, mass: 0.5, stiffness: 180 } });
  const fishX = interpolate(frame, [10, 60], [200, 0], clamp);
  const fishGone = frame > 60 ? interpolate(frame, [60, 72], [1, 0], clamp) : 1;
  const pill = spring({ frame: frame - 20, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  const eyeGlint = interpolate(frame % 60, [0, 4, 8], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* eel head lower frame */}
          <g transform="translate(420,1240)">
            <ellipse cx={0} cy={0} rx={300} ry={220} fill={C.eel} />
            {/* mouth cavity */}
            <path d={`M 120,${-40 - mouth * 50} Q 320,0 120,${40 + mouth * 50} Q 220,0 120,${-40 - mouth * 50} Z`} fill={C.ink} />
            <circle cx={-60} cy={-90} r={16} fill={C.sparkW} opacity={0.5 + eyeGlint * 0.5} />
          </g>
          {/* paralyzed fish drifting in */}
          <g transform={`translate(${720 + fishX},1100)`} opacity={fishGone}>
            <g stroke={C.amber} strokeWidth={5} fill="none">
              <rect x={-40} y={-24} width={80} height={48} />
              <path d="M 40,0 L 72,-20 L 72,20 Z" />
            </g>
          </g>
          {/* PARALYZED */}
          <g transform="translate(700,640)" opacity={pill * fishGone}>
            <rect x={-130} y={-32} width={260} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PARALYZED</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF (leap) ───────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leap = spring({ frame, fps, config: { damping: 40, mass: 0.6, stiffness: 130 } });
  const spark = frame > 40 ? interpolate(frame, [40, 48, 70], [0, 1, 0.3], clamp) : 0;
  const words = ['600', 'VOLTS.', 'NO', 'ESCAPE.'];
  const ws = words.map((_, k) => spring({ frame: frame - 54 - k * 12, fps, config: { damping: 55, mass: 0.5, stiffness: 220 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* water surface */}
          <line x1={0} y1={1280} x2={1080} y2={1280} stroke={C.teal} strokeWidth={5} opacity={0.6} />
          {/* predator leg top */}
          <rect x={620} y={0} width={90} height={360} rx={30} fill="#2a3640" />
          {/* eel leaping arc */}
          <g transform={`translate(${interpolate(leap, [0, 1], [400, 600])},${interpolate(leap, [0, 1], [1300, 420])}) rotate(${interpolate(leap, [0, 1], [10, -70])}) scale(0.9)`}>
            <Eel phase={frame * 0.12} amp={54} headGlow={spark} />
          </g>
          {/* spark burst at contact */}
          {spark > 0 && [0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k * 60) * Math.PI / 180;
            return <line key={k} x1={650} y1={400} x2={650 + Math.cos(a) * 60 * spark} y2={400 + Math.sin(a) * 60 * spark} stroke={C.gold} strokeWidth={5} opacity={spark} />;
          })}
          {/* payoff */}
          <text x={540} y={760} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.gold} opacity={ws[0]}>600 </tspan><tspan fill={C.sparkW} opacity={ws[1]}>VOLTS.</tspan>
          </text>
          <text x={540} y={890} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.sparkW} opacity={ws[2]}>NO </tspan><tspan fill={C.gold} opacity={ws[3]}>ESCAPE.</tspan>
          </text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Electriceel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('electriceel_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* electric/water sound design (baked) */}
      <Sequence from={S.hook + 4} durationInFrames={70}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.hook + 14}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.batteries + 96}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.fire + 40}><Audio src={staticFile('sfx_digital.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.fire + 42}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.lock + 12} durationInFrames={60}><Audio src={staticFile('sfx_digital.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.swallow + 40}><Audio src={staticFile('sfx_plip.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.payoff + 44}><Audio src={staticFile('sfx_digital.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.payoff + 54}><Audio src={staticFile('sfx_success.wav')} volume={0.48} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.batteries - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.batteries} durationInFrames={S.fire - S.batteries}><SceneBatteries /></Sequence>
      <Sequence from={S.fire} durationInFrames={S.lock - S.fire}><SceneFire /></Sequence>
      <Sequence from={S.lock} durationInFrames={S.swallow - S.lock}><SceneLock /></Sequence>
      <Sequence from={S.swallow} durationInFrames={S.payoff - S.swallow}><SceneSwallow /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

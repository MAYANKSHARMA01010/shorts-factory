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
import bbWords from './bombardier_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1104;

const C = {
  bg:      '#0d1117',
  panel:   '#161b22',
  gold:    '#FFD23F',
  shell:   '#3a2f1c',
  glint:   '#6b5a33',
  blue:    '#4FC3F7',
  amber:   '#FF9E3D',
  red:     '#FF4D3D',
  steam:   '#E8F1F2',
  glow:    '#FF6B4A',
  frog:    '#5BD17A',
  ink:     '#070a0e',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, chambers: 172, mix: 331, fire: 511, aim: 709, payoff: 932 };

function mix(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (bbWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 38%, ${C.panel} 0%, ${C.bg} 72%)` }} />;

// beetle facing left, abdomen right with up-right nozzle
function Beetle({ scale = 1, muzzle = 0 }: { scale?: number; muzzle?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* legs */}
      {[-120, -40, 60].map((lx, k) => [-1, 1].map((s) => (
        <line key={`${k}-${s}`} x1={lx} y1={50} x2={lx + s * 36} y2={110} stroke={C.shell} strokeWidth={8} strokeLinecap="round" />
      )))}
      {/* abdomen */}
      <ellipse cx={120} cy={0} rx={170} ry={120} fill={C.shell} />
      {/* thorax */}
      <ellipse cx={-90} cy={-6} rx={90} ry={86} fill={C.shell} />
      {/* head */}
      <circle cx={-200} cy={-10} r={56} fill={C.shell} />
      {/* glint ridge */}
      <path d="M -250,-50 Q -90,-110 270,-70" fill="none" stroke={C.glint} strokeWidth={14} strokeLinecap="round" opacity={0.8} />
      {/* segment lines */}
      {[40, 110, 180].map((sx, k) => <path key={k} d={`M ${sx},${-110} Q ${sx + 6},0 ${sx},110`} fill="none" stroke={C.ink} strokeWidth={3} opacity={0.4} />)}
      {/* antennae */}
      <path d="M -240,-40 Q -320,-120 -360,-90" fill="none" stroke={C.shell} strokeWidth={6} />
      <path d="M -230,-20 Q -310,-70 -350,-40" fill="none" stroke={C.shell} strokeWidth={6} />
      {/* eye */}
      <circle cx={-216} cy={-14} r={9} fill={C.ink} />
      {/* nozzle (abdomen tip, up-right) */}
      <g transform="translate(270,-40) rotate(-35)">
        <rect x={0} y={-16} width={70} height={32} rx={8} fill="#2a2a30" />
        {muzzle > 0 && <circle cx={70} cy={0} r={14 + muzzle * 16} fill={C.glow} opacity={muzzle} />}
      </g>
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 12, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  const sweep = interpolate((frame * 3) % 90, [0, 45, 90], [0, 1, 0], clamp);
  const muzzle = 0.4 + 0.4 * Math.sin(frame * 0.2);
  const shimmer = interpolate(frame, [30, 60], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,980) scale(${Math.min(1, pop)})`}>
            <Beetle scale={1.5} muzzle={muzzle} />
            {/* heat shimmer arc above nozzle */}
            <path d="M 470,720 q 30,-30 60,0 q 30,30 60,0" fill="none" stroke={C.glow} strokeWidth={4} opacity={shimmer * 0.6} transform="translate(-540,-980)" />
          </g>
          {/* sweeping specular */}
          <rect x={200 + sweep * 600} y={760} width={60} height={120} fill="rgba(255,255,255,0.18)" opacity={sweep} transform="skewX(-20)" />
          {/* ? badge */}
          <g transform={`translate(820,560) scale(${badge})`} opacity={badge}>
            <circle cx={0} cy={0} r={80} fill={C.gold} />
            <text x={0} y={30} textAnchor="middle" fill={C.ink} fontSize={100} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: CHAMBERS ────────────────────────────────────────────────────────
function SceneChambers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const outline = interpolate(frame, [6, 40], [0, 1], clamp);
  const blueFill = interpolate(frame, [30, 70], [0, 1], clamp);
  const amberFill = interpolate(frame, [40, 80], [0, 1], clamp);
  const divider = interpolate(frame, [20, 50], [0, 1], clamp);
  const pill = spring({ frame: frame - 70, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* abdomen panel */}
          <rect x={220} y={620} width={640} height={560} rx={60} fill={C.panel} stroke={C.gold} strokeWidth={5}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - outline)} />
          {/* chambers */}
          <g>
            <clipPath id="chL"><rect x={270} y={680} width={250} height={440} rx={40} /></clipPath>
            <clipPath id="chR"><rect x={560} y={680} width={250} height={440} rx={40} /></clipPath>
            <rect x={270} y={680} width={250} height={440} rx={40} fill="none" stroke={C.blue} strokeWidth={4} opacity={outline} />
            <rect x={560} y={680} width={250} height={440} rx={40} fill="none" stroke={C.amber} strokeWidth={4} opacity={outline} />
            <g clipPath="url(#chL)"><rect x={270} y={1120 - 440 * blueFill} width={250} height={440 * blueFill} fill={C.blue} opacity={0.85} /></g>
            <g clipPath="url(#chR)"><rect x={560} y={1120 - 440 * amberFill} width={250} height={440 * amberFill} fill={C.amber} opacity={0.85} /></g>
            {/* bubbles */}
            {[0, 1, 2].map((k) => <circle key={`bl${k}`} cx={340 + k * 60} cy={1080 - ((frame * 3 + k * 40) % 360)} r={6} fill={C.steam} opacity={blueFill * 0.5} />)}
            {[0, 1, 2].map((k) => <circle key={`br${k}`} cx={630 + k * 60} cy={1080 - ((frame * 3 + k * 50) % 360)} r={6} fill={C.steam} opacity={amberFill * 0.5} />)}
          </g>
          {/* divider */}
          <rect x={536} y={680} width={8} height={440 * divider} fill={C.gold} />
          {/* SEPARATE pill */}
          <g transform="translate(540,560)" opacity={pill}>
            <rect x={-120} y={-32} width={240} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">SEPARATE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: MIX ─────────────────────────────────────────────────────────────
function SceneMix() {
  const frame = useCurrentFrame();
  const fang = interpolate(frame, [6, 26], [1080, 720], clamp);
  const shatter = frame > 26 ? interpolate(frame, [26, 50], [0, 1], clamp) : 0;
  const surge = interpolate(frame, [30, 70], [0, 1], clamp);
  const border = interpolate(frame, [26, 56], [0, 1], clamp);
  const shake = frame >= 26 && frame < 34 ? [0, 4, -4, 3, -3, 2, -2, 1][frame - 26] ?? 0 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0, transform: `translateX(${shake}px)` }}>
          <rect x={220} y={620} width={640} height={560} rx={60} fill={C.panel} stroke={mix(C.gold, C.red, border)} strokeWidth={6} />
          {/* liquids surging to center */}
          <rect x={270} y={680} width={250 - surge * 130} height={440} rx={40} fill={C.blue} opacity={0.7} />
          <rect x={560 + surge * 130} y={680} width={250 - surge * 130} height={440} rx={40} fill={C.amber} opacity={0.7} />
          {/* central mixing swirl */}
          {surge > 0.2 && (
            <g transform={`translate(540,900) rotate(${frame * 8})`} opacity={surge}>
              <circle cx={0} cy={0} r={90} fill={mix(C.amber, C.red, surge)} />
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const a = (k * 60) * Math.PI / 180;
                return <line key={k} x1={Math.cos(a) * 90} y1={Math.sin(a) * 90} x2={Math.cos(a) * 130} y2={Math.sin(a) * 130} stroke={C.red} strokeWidth={5} opacity={surge} />;
              })}
            </g>
          )}
          {/* shatter shards */}
          {shatter > 0 && [0, 1, 2, 3].map((k) => {
            const a = (k * 90 - 45) * Math.PI / 180;
            return <polygon key={k} points="0,-12 10,8 -8,10" fill={C.gold}
              transform={`translate(${540 + Math.cos(a) * shatter * 120},${900 + Math.sin(a) * shatter * 120}) rotate(${shatter * 200})`} opacity={1 - shatter} />;
          })}
          {/* red fang */}
          <g transform={`translate(${fang},760)`}>
            <path d="M 120,0 L 0,-40 L 30,0 L 0,40 Z" fill={C.red} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FIRE (hero boiling jet) ─────────────────────────────────────────
function SceneFire() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const heat = interpolate(frame, [6, 50], [0, 1], clamp);
  const temp = Math.round(interpolate(frame, [6, 56], [20, 100], clamp));
  const FIRE = 56;
  const flash = spring({ frame: frame - FIRE, fps, config: { damping: 9, mass: 0.5, stiffness: 200 } });
  const jet = interpolate(frame, [FIRE, FIRE + 30], [0, 1], clamp);
  const shock = interpolate(frame, [FIRE, FIRE + 36], [0, 1], clamp);
  const pill = spring({ frame: frame - FIRE - 8, fps, config: { damping: 60, mass: 0.5, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* incandescent core */}
          <circle cx={420} cy={1180} r={90} fill={mix(C.amber, C.steam, heat)} />
          {/* temperature gauge */}
          <g transform="translate(200,800)">
            <path d="M -70,80 A 90 90 0 0 1 90,0" fill="none" stroke={C.gold} strokeWidth={10} />
            <text x={0} y={150} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{temp}°C</text>
          </g>
          {/* beetle nozzle firing */}
          <g transform="translate(420,1180)"><Beetle scale={0.8} muzzle={1} /></g>
          {/* boiling jet up-right */}
          {jet > 0 && (
            <g>
              {Array.from({ length: 14 }).map((_, k) => {
                const t = (k / 14) * jet;
                const x = 480 + t * 620;
                const y = 1120 - t * 900;
                return <g key={k}>
                  <path d={`M ${x},${y} q 10,16 0,30 q -10,-14 0,-30 Z`} fill={mix(C.red, C.steam, k / 14)} opacity={jet} transform={`translate(0,0)`} />
                </g>;
              })}
              {/* steam ribbons */}
              {[0, 1, 2].map((k) => <path key={k} d={`M ${600 + k * 120},${900 - k * 120} q 30,-50 0,-100`} fill="none" stroke={C.steam} strokeWidth={6} opacity={jet * 0.4} />)}
            </g>
          )}
          {/* muzzle star-burst */}
          {flash > 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const a = (k * 45) * Math.PI / 180;
            return <line key={k} x1={480} y1={1120} x2={480 + Math.cos(a) * 70 * flash} y2={1120 + Math.sin(a) * 70 * flash} stroke={C.gold} strokeWidth={6} opacity={Math.min(1, flash)} />;
          })}
          {/* shockwave */}
          {shock > 0 && <circle cx={480} cy={1120} r={shock * 300} fill="none" stroke={C.gold} strokeWidth={6 * (1 - shock) + 1} opacity={1 - shock} />}
          {/* BOILING pill */}
          <g transform={`translate(740,640) scale(${pill})`} opacity={pill}>
            <rect x={-120} y={-36} width={240} height={72} rx={36} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BOILING</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: AIM (swivel frog/ant) ───────────────────────────────────────────
function SceneAim() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arc = interpolate(frame, [6, 50], [0, 1], clamp);
  const aim1 = interpolate(frame, [40, 60], [0, 1], clamp);
  const hit1 = frame > 58 ? 1 : 0;
  const aim2 = interpolate(frame, [80, 100], [0, 1], clamp);
  const hit2 = frame > 98 ? 1 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* protractor arc */}
          <path d="M 540,920 m -300,0 a 300 300 0 1 1 360,250" fill="none" stroke={C.gold} strokeWidth={4}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - arc)} opacity={0.5} />
          {/* beetle center */}
          <g transform="translate(540,960) scale(0.85)"><Beetle scale={1} muzzle={0.5} /></g>
          {/* frog target upper-left */}
          <g transform="translate(260,540)" opacity={interpolate(frame, [34, 50], [0, 1], clamp)}>
            <ellipse cx={0} cy={0} rx={50} ry={38} fill={C.frog} />
            <circle cx={-18} cy={-26} r={14} fill={C.frog} /><circle cx={18} cy={-26} r={14} fill={C.frog} />
            <circle cx={-18} cy={-28} r={6} fill={C.ink} /><circle cx={18} cy={-28} r={6} fill={C.ink} />
            {hit1 > 0 && <g><circle r={40} fill="none" stroke={C.gold} strokeWidth={4} /><text x={60} y={6} fill={C.gold} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">HIT</text></g>}
          </g>
          {/* ant target lower-right */}
          <g transform="translate(840,1240)" opacity={interpolate(frame, [74, 90], [0, 1], clamp)}>
            <circle cx={-30} cy={0} r={16} fill={C.amber} /><circle cx={0} cy={0} r={20} fill={C.amber} /><circle cx={34} cy={0} r={18} fill={C.amber} />
            {hit2 > 0 && <g><circle r={40} fill="none" stroke={C.gold} strokeWidth={4} /><text x={-66} y={6} textAnchor="end" fill={C.gold} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">HIT</text></g>}
          </g>
          {/* jet lines */}
          {aim1 > 0 && <line x1={620} y1={840} x2={620 - aim1 * 360} y2={840 - aim1 * 300} stroke={C.red} strokeWidth={6} opacity={hit2 ? 0.3 : 1} />}
          {aim2 > 0 && <line x1={640} y1={900} x2={640 + aim2 * 200} y2={900 + aim2 * 340} stroke={C.red} strokeWidth={6} />}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ['IT', 'LITERALLY', 'EXPLODES', 'ON', 'YOU'];
  const ws = words.map((_, k) => spring({ frame: frame - 14 - k * 11, fps, config: { damping: k === 2 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  const burst = interpolate(frame, [36, 50], [0, 1], clamp);
  const bob = frame > 70 ? Math.sin(frame * 0.3) * 6 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* beetle small */}
          <g transform={`translate(540,${1360 + bob}) scale(0.6)`}><Beetle scale={1} muzzle={0.3} /></g>
          {/* spark burst behind EXPLODES */}
          {burst > 0 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => {
            const a = (k * 30) * Math.PI / 180;
            return <line key={k} x1={540} y1={840} x2={540 + Math.cos(a) * 200 * burst} y2={840 + Math.sin(a) * 200 * burst} stroke={C.gold} strokeWidth={5} opacity={(1 - burst) * 0.8} />;
          })}
          {/* payoff */}
          <text x={540} y={700} textAnchor="middle" fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.steam} opacity={ws[0]}>IT </tspan><tspan fill={C.steam} opacity={ws[1]}>LITERALLY</tspan>
          </text>
          <text x={540} y={860} textAnchor="middle" fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}
            opacity={ws[2]} transform={`translate(540,860) scale(${ws[2]}) translate(-540,-860)`}>EXPLODES</text>
          <text x={540} y={990} textAnchor="middle" fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.steam} opacity={ws[3]}>ON </tspan><tspan fill={C.steam} opacity={ws[4]}>YOU</tspan>
          </text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Bombardier: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('bombardier_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* chemical/explosion sound design (baked) */}
      <Sequence from={S.hook + 4}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.chambers + 12} durationInFrames={70}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.mix + 30} durationInFrames={50}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.fire + 56}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.fire + 58} durationInFrames={60}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.42} /></Sequence>
      <Sequence from={S.aim + 44}><Audio src={staticFile('sfx_chime.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.aim + 84}><Audio src={staticFile('sfx_digital.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 36}><Audio src={staticFile('sfx_success.wav')} volume={0.48} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.chambers - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.chambers} durationInFrames={S.mix - S.chambers}><SceneChambers /></Sequence>
      <Sequence from={S.mix} durationInFrames={S.fire - S.mix}><SceneMix /></Sequence>
      <Sequence from={S.fire} durationInFrames={S.aim - S.fire}><SceneFire /></Sequence>
      <Sequence from={S.aim} durationInFrames={S.payoff - S.aim}><SceneAim /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

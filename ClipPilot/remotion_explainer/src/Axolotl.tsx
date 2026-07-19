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
import axWords from './axolotl_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1158;

const C = {
  bg:      '#0c1418',
  panel:   '#101d22',
  gold:    '#FFD23F',
  pink:    '#FF8FB1',
  gill:    '#FF5C8A',
  teal:    '#3FE0C5',
  ivory:   '#F2ECDD',
  violet:  '#9B8CFF',
  red:     '#FF5A4D',
  ink:     '#070d10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, neoteny: 118, regen: 314, organs: 655, lab: 882, payoff: 1058 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (axWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
            color: active ? C.gold : '#fff', fontSize: 60, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 14px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 40%, ${C.panel} 0%, ${C.bg} 74%)` }} />;

function Axo({ scale = 1, missingLeg = false, transparent = false, smile = 1 }: { scale?: number; missingLeg?: boolean; transparent?: boolean; smile?: number }) {
  const f = useCurrentFrame();
  const op = transparent ? 0.32 : 1;
  return (
    <g transform={`scale(${scale})`}>
      {/* tail */}
      <path d="M -180,0 L -300,-50 L -300,50 Z" fill={C.pink} opacity={op} />
      {/* body */}
      <ellipse cx={0} cy={0} rx={200} ry={110} fill={C.pink} opacity={op} />
      {/* legs */}
      {[[-90, 1], [60, 1], [-90, 0], [60, 0]].map((lg, k) => {
        if (missingLeg && k === 2) return null;
        const sway = Math.sin(f * 0.1 + k) * 4;
        return <rect key={k} x={(lg[0] as number) - 12} y={lg[1] ? -130 : 100} width={24} height={50} rx={10} fill={C.pink} opacity={op} transform={`translate(${sway},0)`} />;
      })}
      {missingLeg && <rect x={-102} y={100} width={50} height={14} rx={6} fill="#d96f8e" opacity={op} />}
      {/* head */}
      <circle cx={170} cy={0} r={110} fill={C.pink} opacity={op} />
      {/* smile */}
      <path d={`M 140,40 Q 200,${40 + smile * 30} 250,30`} fill="none" stroke={C.ink} strokeWidth={5} opacity={op} />
      <circle cx={150} cy={-30} r={10} fill={C.ink} opacity={op} /><circle cx={230} cy={-30} r={10} fill={C.ink} opacity={op} />
      <circle cx={160} cy={-20} r={16} fill={C.pink} opacity={op * 0.4} /><circle cx={240} cy={-20} r={16} fill={C.pink} opacity={op * 0.4} />
      {/* gills (3 each side) */}
      {[-1, 1].map((s) => [0, 1, 2].map((g) => (
        <g key={`${s}-${g}`}>
          <path d={`M 170,${s * 80} q ${60 + g * 20},${s * (40 + g * 30)} ${120 + g * 30},${s * (30 + g * 50)}`} fill="none" stroke={C.gill} strokeWidth={8} strokeLinecap="round" opacity={op} />
          {[0, 1, 2].map((b) => <circle key={b} cx={200 + g * 25 + b * 25} cy={s * (90 + g * 30 + b * 12)} r={5} fill={C.gill} opacity={op * 0.8} />)}
        </g>
      )))}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 12, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const snip = frame > 40 ? interpolate(frame, [40, 46], [0, 1], clamp) : 0;
  const gone = frame > 46;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,1020) scale(${Math.min(1, pop) * 1.2})`}><Axo missingLeg={gone} /></g>
          {/* scissors */}
          {!gone && (
            <g transform={`translate(430,1180) rotate(${-snip * 30})`}>
              <line x1={0} y1={0} x2={-60} y2={-40} stroke={C.gold} strokeWidth={8} />
              <line x1={0} y1={0} x2={-60} y2={40} stroke={C.gold} strokeWidth={8} transform={`rotate(${snip * 30})`} />
              <circle cx={-60} cy={-40} r={14} fill="none" stroke={C.gold} strokeWidth={6} />
              <circle cx={-60} cy={40} r={14} fill="none" stroke={C.gold} strokeWidth={6} />
            </g>
          )}
          {/* dropped leg */}
          {gone && <rect x={440} y={interpolate(frame, [46, 70], [1200, 1500], clamp)} width={24} height={50} rx={10} fill={C.pink} opacity={interpolate(frame, [46, 70], [1, 0], clamp)} />}
          {/* badge */}
          <g transform={`translate(540,440) scale(${badge})`} opacity={badge}>
            <rect x={-180} y={-50} width={360} height={100} rx={26} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={52} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">CUT IT OFF</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: NEOTENY ─────────────────────────────────────────────────────────
function SceneNeoteny() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grey = interpolate(frame, [10, 50], [0, 1], clamp);
  const pill = spring({ frame: frame - 50, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const iconBack = frame > 80 ? interpolate(frame, [80, 100, 120], [1, 0.2, 0], clamp) : interpolate(frame, [40, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* LEFT grey adult salamander */}
          <g transform="translate(280,860)" opacity={1 - grey * 0.3}>
            <ellipse cx={0} cy={0} rx={140} ry={50} fill={`rgb(${Math.round(255 - grey * 110)},${Math.round(143 - grey * 30)},${Math.round(177 - grey * 60)})`} />
            <circle cx={120} cy={0} r={56} fill={`rgb(${Math.round(255 - grey * 110)},${Math.round(143 - grey * 30)},${Math.round(177 - grey * 60)})`} />
            {[-90, -30, 40].map((lx, k) => <rect key={k} x={lx} y={40} width={18} height={40} rx={8} fill="#8a8f95" opacity={grey} />)}
            <circle cx={300} cy={-200} r={30} fill="#cbb24a" opacity={grey * 0.5} />
            <text x={60} y={130} textAnchor="middle" fill="#8a8f95" fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">grows up</text>
          </g>
          {/* RIGHT axolotl in water */}
          <ellipse cx={800} cy={880} rx={240} ry={300} fill={C.teal} opacity={0.08} />
          <g transform="translate(760,880) scale(0.6)"><Axo /></g>
          {/* NEVER GROWS UP */}
          <g transform="translate(540,1320)" opacity={pill}>
            <rect x={-200} y={-36} width={400} height={72} rx={36} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">NEVER GROWS UP</text>
          </g>
          {/* timeline */}
          <line x1={200} y1={1480} x2={880} y2={1480} stroke={C.gold} strokeWidth={3} opacity={0.5} />
          <text x={200} y={1530} textAnchor="middle" fill={C.gold} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">BABY</text>
          <text x={880} y={1530} textAnchor="middle" fill={C.gold} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">ADULT</text>
          <circle cx={interpolate(iconBack, [0, 1], [200, 880])} cy={1480} r={14} fill={C.pink} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: REGEN (hero) ────────────────────────────────────────────────────
function SceneRegen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dome = spring({ frame: frame - 10, fps, config: { damping: 40, mass: 0.6, stiffness: 150 } });
  const bones = (k: number) => interpolate(frame, [60 + k * 14, 80 + k * 14], [0, 1], clamp);
  const muscle = interpolate(frame, [130, 200], [0, 1], clamp);
  const nerve = interpolate(frame, [200, 270], [0, 1], clamp);
  const week = Math.min(4, 1 + Math.floor(interpolate(frame, [60, 270], [0, 3], clamp)));
  const arc = interpolate(frame, [60, 270], [0, 1], clamp);
  const stamp = spring({ frame: frame - 280, fps, config: { damping: 45, mass: 0.6, stiffness: 210 } });
  const wiggle = frame > 300 ? Math.sin(frame * 0.6) * 6 : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* stump */}
          <rect x={420} y={1180} width={240} height={120} rx={20} fill={C.pink} />
          {/* blastema dome */}
          <g transform={`translate(540,1180)`}>
            <path d={`M -180,0 Q -180,${-420 * dome} 0,${-420 * dome} Q 180,${-420 * dome} 180,0 Z`} fill={C.teal} opacity={0.25} />
            {/* particles */}
            {dome > 0.5 && Array.from({ length: 8 }).map((_, k) => {
              const py = -((frame * 3 + k * 40) % 400) * dome;
              return <circle key={k} cx={-120 + k * 34} cy={py} r={4} fill={C.teal} opacity={0.5} />;
            })}
            {/* bones (hand skeleton) */}
            <g transform="translate(0,-260)">
              <rect x={-20} y={0} width={40} height={120} rx={10} fill={C.ivory} opacity={bones(0)} />
              {[-1, 0, 1, 2].map((fb, k) => (
                <rect key={k} x={-60 + (k) * 34} y={-90} width={18} height={100} rx={8} fill={C.ivory} opacity={bones(k + 1)} />
              ))}
              {/* muscle wrap */}
              <g clipPath="url(#mClip)"><rect x={-80} y={-100} width={160 * muscle} height={230} fill={C.pink} opacity={0.5} /></g>
              <clipPath id="mClip"><rect x={-70} y={-100} width={140} height={230} rx={20} /></clipPath>
              {/* nerves */}
              {nerve > 0 && [-1, 0, 1, 2].map((fb, k) => (
                <line key={k} x1={0} y1={120} x2={-52 + k * 34} y2={interpolate(nerve, [0, 1], [120, -80], clamp)} stroke={C.violet} strokeWidth={3} opacity={0.7} />
              ))}
            </g>
          </g>
          {/* week arc + counter */}
          <g transform="translate(540,640)">
            <path d="M -120,40 A 120 120 0 0 1 120,40" fill="none" stroke="#2a3a3a" strokeWidth={10} />
            <path d="M -120,40 A 120 120 0 0 1 120,40" fill="none" stroke={C.gold} strokeWidth={10} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - arc * 0.5)} />
            <text x={0} y={0} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WEEK {week}</text>
          </g>
          {/* GOOD AS NEW */}
          <g transform={`translate(540,560) scale(${stamp})`} opacity={stamp}>
            <rect x={-200} y={-36} width={400} height={72} rx={16} fill={C.gold} transform={`translate(${wiggle},0)`} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">GOOD AS NEW</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: ORGANS ──────────────────────────────────────────────────────────
function SceneOrgans() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const organs = [
    { name: 'HEART', x: 480, y: 920, col: C.teal },
    { name: 'SPINE', x: 540, y: 1040, col: C.ivory },
    { name: 'BRAIN', x: 680, y: 760, col: C.violet },
  ];
  const heal = (k: number) => interpolate(frame, [20 + k * 50, 60 + k * 50], [0, 1], clamp);
  const banner = interpolate(frame, [150, 200], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540,960) scale(1.1)"><Axo transparent /></g>
          {organs.map((o, k) => {
            const h = heal(k);
            const cracked = h > 0.1 && h < 0.6;
            return (
              <g key={k}>
                {o.name === 'BRAIN' && <circle cx={o.x} cy={o.y} r={36} fill={o.col} opacity={0.7 + 0.3 * Math.sin(frame * 0.2)} />}
                {o.name === 'HEART' && <path d={`M ${o.x},${o.y + 14} l -22,-24 a 14 14 0 0 1 22,-6 a 14 14 0 0 1 22,6 Z`} fill={o.col} opacity={0.85} />}
                {o.name === 'SPINE' && <rect x={o.x - 8} y={o.y - 80} width={16} height={200} rx={8} fill={o.col} opacity={0.8} />}
                {cracked && <line x1={o.x - 20} y1={o.y - 20} x2={o.x + 20} y2={o.y + 20} stroke={C.red} strokeWidth={5} />}
                {h > 0.6 && [0, 1].map((p) => <text key={p} x={o.x + 30} y={o.y - 30 - ((frame * 2) % 40)} fill={C.teal} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif" opacity={0.6}>+</text>)}
                <text x={o.x} y={o.y + 70} textAnchor="middle" fill={o.col} fontSize={22} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={h}>{o.name}</text>
              </g>
            );
          })}
          {/* NO SCAR banner */}
          <g transform="translate(540,1400)" opacity={banner}>
            <rect x={-200 * banner} y={-36} width={400 * banner} height={72} rx={36} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" opacity={banner > 0.7 ? 1 : 0}>NO SCAR</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: LAB ─────────────────────────────────────────────────────────────
function SceneLab() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dish = spring({ frame, fps, config: { damping: 60, mass: 0.5, stiffness: 180 } });
  const arrow = interpolate(frame, [30, 80], [0, 1], clamp);
  const wound = spring({ frame: frame - 76, fps, config: { damping: 45, mass: 0.5, stiffness: 200 } });
  const pill = spring({ frame: frame - 90, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* petri dish */}
          <g transform={`translate(280,980) scale(${dish})`}>
            <ellipse cx={0} cy={0} rx={150} ry={150} fill={C.teal} opacity={0.18} stroke={C.teal} strokeWidth={4} />
            <g transform="scale(0.28)"><Axo /></g>
          </g>
          {/* dashed arrow */}
          <path d="M 440,960 Q 620,880 760,960" fill="none" stroke={C.gold} strokeWidth={5} 
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - arrow)} markerEnd="url(#aGoldX)" />
          <defs><marker id="aGoldX" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.gold} /></marker></defs>
          {/* human arm */}
          <g transform="translate(840,1000)">
            <rect x={-40} y={-30} width={260} height={120} rx={50} fill="#e0b48a" opacity={0.5} stroke="#c89a6e" strokeWidth={3} />
            <circle cx={70} cy={30} r={30 * wound} fill={C.teal} opacity={0.5 * wound} />
          </g>
          {/* COPY THE TRICK */}
          <g transform="translate(540,560)" opacity={pill}>
            <rect x={-220} y={-40} width={440} height={80} rx={40} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">COPY THE TRICK?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = [['IT', false], ['HEALS', true], ['WHAT WE', false], ["CAN'T", true]];
  const ws = lines.map((_, k) => spring({ frame: frame - 16 - k * 12, fps, config: { damping: k === 3 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  const limb = interpolate(frame, [60, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540,1340) scale(0.7)" opacity={0.3}><Axo /></g>
          {/* glowing regrown limb hint */}
          <circle cx={420} cy={1480} r={30 * limb} fill={C.teal} opacity={0.5 * limb} />
          {lines.map((ln, k) => (
            <text key={k} x={540} y={620 + k * 130} textAnchor="middle" fontSize={k === 3 ? 130 : 90} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif"
              fill={ln[1] ? C.gold : '#fff'} opacity={ws[k]} transform={`translate(540,${620 + k * 130}) scale(${ws[k]}) translate(-540,-${620 + k * 130})`}>{ln[0]}</text>
          ))}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Axolotl: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('axolotl_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* organic/regen/medical sound design (baked) */}
      <Sequence from={S.hook + 40}><Audio src={staticFile('sfx_click.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.hook + 48}><Audio src={staticFile('sfx_plip.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.neoteny + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.regen + 30} durationInFrames={120}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.36} /></Sequence>
      <Sequence from={S.regen + 280}><Audio src={staticFile('sfx_chime.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.organs + 30}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.organs + 80} durationInFrames={60}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.lab + 40}><Audio src={staticFile('sfx_chime.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.payoff + 50}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.payoff + 55}><Audio src={staticFile('sfx_success.wav')} volume={0.42} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.neoteny - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.neoteny} durationInFrames={S.regen - S.neoteny}><SceneNeoteny /></Sequence>
      <Sequence from={S.regen} durationInFrames={S.organs - S.regen}><SceneRegen /></Sequence>
      <Sequence from={S.organs} durationInFrames={S.lab - S.organs}><SceneOrgans /></Sequence>
      <Sequence from={S.lab} durationInFrames={S.payoff - S.lab}><SceneLab /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

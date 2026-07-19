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
import tsWords from './treestalk_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1204;

const C = {
  bgDeep:  '#0c1410',
  bgForest:'#10201a',
  gold:    '#FFD23F',
  fungus:  '#E8C8FF',
  root:    '#8A5A3C',
  leaf:    '#5FD08A',
  sugar:   '#F2A65A',
  alarm:   '#FF5C5C',
  water:   '#5FC8E8',
  off:     '#F4F1E8',
  ink:     '#070d0a',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, fungus: 137, internet: 341, alarm: 551, web: 909, payoff: 1114 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (tsWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
    <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${C.bgForest} 0%, ${C.bgDeep} 74%)` }} />;

function Tree({ x, y, scale = 1, shield = 0, alarm = 0 }: { x: number; y: number; scale?: number; shield?: number; alarm?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* trunk */}
      <rect x={-22} y={-40} width={44} height={200} rx={10} fill={C.root} />
      {/* canopy blobs */}
      {alarm > 0 && <circle cx={0} cy={-130} r={120 * (1 + alarm * 0.12)} fill="none" stroke={C.alarm} strokeWidth={6} opacity={alarm} />}
      {shield > 0 && <circle cx={0} cy={-130} r={120} fill="none" stroke={C.leaf} strokeWidth={8} opacity={shield} />}
      <circle cx={-50} cy={-110} r={68} fill={C.leaf} />
      <circle cx={50} cy={-120} r={72} fill={C.leaf} />
      <circle cx={0} cy={-170} r={80} fill={C.leaf} />
      {shield > 0 && [-1, 0, 1].map((s) => (
        <path key={s} d={`M ${s * 70},${-200} l -10,-22 l 20,0 z`} fill={C.leaf} opacity={shield} />
      ))}
    </g>
  );
}

// fungal web threads across a span; alarmFront = x position of red sweep (or -1)
function Web({ y, leftX, rightX, glow = 1, alarmFront = -1 }: { y: number; leftX: number; rightX: number; glow?: number; alarmFront?: number }) {
  const threads = 6;
  return (
    <g>
      {Array.from({ length: threads }).map((_, k) => {
        const ty = y + k * 44;
        const wob = 14 * Math.sin(k);
        const red = alarmFront >= 0 && alarmFront > leftX + 50;
        return (
          <g key={k}>
            <path d={`M ${leftX},${ty} Q ${(leftX + rightX) / 2},${ty + wob} ${rightX},${ty}`} fill="none"
              stroke={C.fungus} strokeWidth={3} opacity={(0.3 + 0.3 * glow)} />
            {/* red alarm portion */}
            {red && (
              <path d={`M ${leftX},${ty} Q ${(leftX + rightX) / 2},${ty + wob} ${rightX},${ty}`} fill="none"
                stroke={C.alarm} strokeWidth={5}
                pathLength={100} strokeDasharray={100}
                strokeDashoffset={100 * (1 - interpolate(alarmFront, [leftX, rightX], [0, 1], clamp))} opacity={0.9} />
            )}
          </g>
        );
      })}
      {/* crossing nodes */}
      {Array.from({ length: 10 }).map((_, k) => {
        const nx = leftX + ((k + 1) / 11) * (rightX - leftX);
        const ny = y + ((k * 3) % 6) * 44;
        const lit = alarmFront < 0 ? glow : (alarmFront > nx ? 1 : glow);
        return <circle key={k} cx={nx} cy={ny} r={5} fill={alarmFront > nx && alarmFront >= 0 ? C.alarm : C.fungus} opacity={0.4 + 0.5 * lit} />;
      })}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const trunk = interpolate(frame, [4, 22], [0, 1], clamp);
  const canopy = spring({ frame: frame - 16, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 24, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const whisper = interpolate(frame, [34, 64], [0, 1], clamp);
  const glint = interpolate(frame % 60, [0, 8, 16], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* soil line */}
          <line x1={0} y1={1240} x2={1080} y2={1240} stroke={C.root} strokeWidth={4} opacity={0.6} />
          <rect x={0} y={1244} width={1080} height={676} fill="#0a0f0b" opacity={0.5} />
          {/* tree */}
          <g transform="translate(540,1240)">
            <g style={{ transformOrigin: '0px 0px' }}>
              <rect x={-30} y={-260 * trunk} width={60} height={260 * trunk} rx={14} fill={C.root} />
              <g transform={`scale(${canopy})`} style={{ transformOrigin: '0px -260px' }}>
                <circle cx={-70} cy={-230} r={90} fill={C.leaf} />
                <circle cx={70} cy={-250} r={96} fill={C.leaf} />
                <circle cx={0} cy={-320} r={106} fill={C.leaf} />
              </g>
            </g>
            {/* root glint */}
            <circle cx={-40} cy={120} r={10 + glint * 8} fill={C.fungus} opacity={0.5 + glint * 0.5} />
          </g>
          {/* whisper arcs into soil */}
          <path d="M 560,1180 q 40,60 10,120" fill="none" stroke={C.gold} strokeWidth={4} 
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - whisper)} opacity={0.7} />
          {/* SHHH badge */}
          <g transform={`translate(800,560) scale(${badge})`} opacity={badge}>
            <rect x={-130} y={-46} width={260} height={92} rx={46} fill={C.gold} />
            <text x={10} y={14} textAnchor="middle" fill={C.ink} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">SHHH…</text>
            <path d="M -110,-10 q -20,0 -20,18 q 0,14 14,16 l 0,12 l 14,-12 q 12,-2 12,-16 q 0,-18 -20,-18 Z" fill={C.ink} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: FUNGUS ──────────────────────────────────────────────────────────
function SceneFungus() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const roots = interpolate(frame, [6, 40], [0, 1], clamp);
  const spread = interpolate(frame, [30, 100], [0, 1], clamp);
  const label = spring({ frame: frame - 96, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={0} y1={520} x2={1080} y2={520} stroke={C.root} strokeWidth={4} opacity={0.5} />
          {/* trunk base */}
          <rect x={500} y={380} width={80} height={150} rx={12} fill={C.root} />
          {/* roots forking */}
          {[-1, 0, 1].map((s) => (
            <path key={s} d={`M 540,520 Q ${540 + s * 150},${680} ${540 + s * 280},${900}`} fill="none" stroke={C.root} strokeWidth={12}
              pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - roots)} />
          ))}
          {/* fungal filaments radiating */}
          {Array.from({ length: 40 }).map((_, k) => {
            const side = k % 2 ? 1 : -1;
            const baseX = 540 + side * ((k % 10) / 10) * 60;
            const ang = (k * 23) % 70 + 10;
            const len = spread * (300 + (k % 5) * 80);
            const ex = baseX + side * Math.cos(ang * Math.PI / 180) * len;
            const ey = 760 + Math.sin(ang * Math.PI / 180) * len * 0.6;
            return <line key={k} x1={baseX} y1={760} x2={ex} y2={ey} stroke={C.fungus} strokeWidth={2} opacity={0.4 * spread} />;
          })}
          {/* glow nodes */}
          {Array.from({ length: 8 }).map((_, k) => {
            const nx = 120 + k * 120;
            const pulse = interpolate((frame - k * 6) % 60, [0, 10, 20], [0.3, 1, 0.3], clamp);
            return spread > k / 8 ? <circle key={k} cx={nx} cy={820 + (k % 3) * 40} r={6} fill={C.fungus} opacity={pulse} /> : null;
          })}
          <text x={960} y={760} textAnchor="end" fill={C.gold} fontSize={36} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={label}>…miles…</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: INTERNET (packets) ──────────────────────────────────────────────
function SceneInternet() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tree2 = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const packet = (k: number) => interpolate(frame, [30 + k * 18, 90 + k * 18], [0, 1], clamp);
  const px = (k: number) => interpolate(packet(k), [0, 1], [280, 800]);
  const labels = [['SUGAR', C.sugar], ['WATER', C.water], ['SIGNAL', C.gold]];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={0} y1={920} x2={1080} y2={920} stroke={C.root} strokeWidth={4} opacity={0.5} />
          <Web y={970} leftX={120} rightX={960} glow={0.8} />
          <Tree x={280} y={920} scale={0.85} />
          <g opacity={tree2}><Tree x={800} y={920} scale={0.85} /></g>
          {/* packets */}
          {[0, 1, 2].map((k) => packet(k) > 0 && (
            <g key={k} transform={`translate(${px(k)},${1010 + k * 30})`} opacity={packet(k) < 1 ? 1 : 0.2}>
              {k === 0 && <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill={labels[k][1] as string} />}
              {k === 1 && <path d="M 0,-24 Q 18,4 0,22 Q -18,4 0,-24 Z" fill={labels[k][1] as string} />}
              {k === 2 && <circle r={18} fill={labels[k][1] as string} />}
              <text x={0} y={-34} textAnchor="middle" fill={labels[k][1] as string} fontSize={24} fontWeight={900} fontFamily="Poppins,sans-serif">{labels[k][0]}</text>
            </g>
          ))}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: ALARM (hero) ────────────────────────────────────────────────────
function SceneAlarm() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beetles = spring({ frame: frame - 10, fps, config: { damping: 40, mass: 0.5, stiffness: 200 } });
  const alarmRing = interpolate(frame, [40, 70], [0, 1], clamp);
  const badge = spring({ frame: frame - 50, fps, config: { damping: 45, mass: 0.5, stiffness: 220 } });
  // red wavefront across web 70..230
  const front = interpolate(frame, [70, 230], [140, 980], clamp);
  const shield = (i: number) => interpolate(front, [400 + i * 260, 480 + i * 260], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* edge red flash */}
          {alarmRing > 0 && alarmRing < 1 && <rect x={0} y={0} width={1080} height={1920} fill={C.alarm} opacity={(1 - alarmRing) * 0.12} />}
          <line x1={0} y1={920} x2={1080} y2={920} stroke={C.root} strokeWidth={4} opacity={0.5} />
          <Web y={970} leftX={120} rightX={980} glow={0.7} alarmFront={front} />
          {/* attacked tree left */}
          <Tree x={220} y={920} scale={0.8} alarm={alarmRing} />
          {/* red pulse down trunk */}
          <rect x={210} y={780} width={20} height={interpolate(interpolate(frame, [60, 80], [0, 1], clamp), [0, 1], [0, 140])} fill={C.alarm} opacity={0.8} />
          {/* beetles */}
          {beetles > 0 && [0, 1, 2, 3].map((k) => (
            <ellipse key={k} cx={180 + k * 40} cy={690 + (k % 2) * 30} rx={18} ry={12} fill={C.ink} stroke={C.alarm} strokeWidth={2} opacity={beetles} />
          ))}
          {/* neighbor trees defending */}
          <Tree x={540} y={920} scale={0.78} shield={shield(0)} />
          <Tree x={860} y={920} scale={0.78} shield={shield(1)} />
          {/* ! badge */}
          <g transform={`translate(220,560) scale(${badge})`} opacity={badge}>
            <circle cx={0} cy={0} r={60} fill={C.alarm} />
            <text x={0} y={26} textAnchor="middle" fill="#fff" fontSize={80} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">!</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: WEB (wood wide web) ─────────────────────────────────────────────
function SceneWeb() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const trees = [180, 360, 540, 720, 900];
  const pulse = 0.6 + 0.4 * Math.sin(frame * 0.12);
  const plate = interpolate(frame, [30, 70], [0, 1], clamp);
  const breathe = 1 + 0.03 * Math.sin(frame * 0.1);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={0} y1={980} x2={1080} y2={980} stroke={C.root} strokeWidth={4} opacity={0.5} />
          <Web y={1030} leftX={80} rightX={1000} glow={pulse} />
          {trees.map((tx, k) => {
            const pop = spring({ frame: frame - k * 5, fps, config: { damping: 14, mass: 0.5, stiffness: 180 } });
            return <g key={k} transform={`scale(${Math.min(1, pop) * breathe})`} style={{ transformOrigin: `${tx}px 980px` }}>
              <Tree x={tx} y={980} scale={0.6} shield={0.3 + 0.2 * Math.sin(frame * 0.1 + k)} />
            </g>;
          })}
          {/* nameplate */}
          <g transform="translate(540,560)" opacity={plate}>
            <rect x={-300 * plate} y={36} width={600 * plate} height={6} rx={3} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">THE WOOD WIDE WEB</text>
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
  const words = ['THE', 'FOREST', 'IS', 'TALKING'];
  const ws = words.map((_, k) => spring({ frame: frame - 14 - k * 13, fps, config: { damping: k === 3 ? 45 : 60, mass: 0.5, stiffness: 220 } }));
  const burst = interpolate(frame, [54, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.bgDeep }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Web y={1300} leftX={120} rightX={960} glow={0.4} />
          <text x={540} y={720} textAnchor="middle" fontSize={84} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            <tspan fill={C.off} opacity={ws[0]}>THE </tspan><tspan fill={C.off} opacity={ws[1]}>FOREST</tspan>
          </text>
          <text x={540} y={840} textAnchor="middle" fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.off} opacity={ws[2]}>IS</text>
          {/* burst behind TALKING */}
          {burst > 0 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => {
            const a = (k * 36) * Math.PI / 180;
            return <line key={k} x1={540} y1={1000} x2={540 + Math.cos(a) * 220 * burst} y2={1000 + Math.sin(a) * 220 * burst} stroke={C.gold} strokeWidth={5} opacity={(1 - burst) * 0.7} />;
          })}
          <text x={540} y={1030} textAnchor="middle" fontSize={140} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}
            opacity={ws[3]} transform={`translate(540,1030) scale(${ws[3]}) translate(-540,-1030)`}>TALKING</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Treestalk: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('treestalk_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* forest/nature sound design (baked) */}
      <Sequence from={S.hook + 4} durationInFrames={50}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.3} /></Sequence>
      <Sequence from={S.fungus + 20} durationInFrames={60}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.internet + 30}><Audio src={staticFile('sfx_chime.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.internet + 66}><Audio src={staticFile('sfx_plip.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.internet + 102}><Audio src={staticFile('sfx_digital.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.alarm + 60}><Audio src={staticFile('sfx_digital.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.alarm + 50}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.web + 30}><Audio src={staticFile('sfx_success.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 53}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.fungus - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.fungus} durationInFrames={S.internet - S.fungus}><SceneFungus /></Sequence>
      <Sequence from={S.internet} durationInFrames={S.alarm - S.internet}><SceneInternet /></Sequence>
      <Sequence from={S.alarm} durationInFrames={S.web - S.alarm}><SceneAlarm /></Sequence>
      <Sequence from={S.web} durationInFrames={S.payoff - S.web}><SceneWeb /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

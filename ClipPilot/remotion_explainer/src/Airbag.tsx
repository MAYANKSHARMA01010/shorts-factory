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
import abWords from './airbag_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1085;

const C = {
  bg:      '#0d1117',
  panel:   '#141b24',
  gold:    '#FFD23F',
  fire:    '#FF5722',
  n2:      '#4FC3F7',
  sparkW:  '#FFF8E1',
  nylon:   '#E8DCC4',
  ember:   '#FF9233',
  steel:   '#5A6675',
  red:     '#E03A2F',
  ink:     '#070b10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, blast: 227, sensor: 308, burn: 542, slam: 705, payoff: 873 };

function usePop(delay: number, damping = 110) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.55, stiffness: 185 } });
}
function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (abWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(125% 85% at 50% 36%, ${C.panel} 0%, ${C.bg} 70%)` }} />;

// reusable airbag balloon
function Bag({ scale = 1, cx = 540, cy = 840, warn = false, sheen = true }:
  { scale?: number; cx?: number; cy?: number; warn?: boolean; sheen?: boolean }) {
  return (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      <ellipse cx={0} cy={0} rx={290} ry={250} fill={C.nylon} />
      <ellipse cx={0} cy={0} rx={290} ry={250} fill="none" stroke="#cdbfa0" strokeWidth={4} />
      {sheen && <ellipse cx={-90} cy={-110} rx={90} ry={55} fill="#fff" opacity={0.35} />}
      {/* seams */}
      <path d="M -240,-40 Q 0,60 240,-40" fill="none" stroke="#cdbfa0" strokeWidth={3} opacity={0.6} />
      <path d="M -200,90 Q 0,170 200,90" fill="none" stroke="#cdbfa0" strokeWidth={3} opacity={0.6} />
      {warn && (
        <g transform="translate(0,-10)">
          <path d="M 0,-54 L 48,30 L -48,30 Z" fill={C.gold} stroke={C.ink} strokeWidth={5} />
          <rect x={-6} y={-30} width={12} height={36} rx={3} fill={C.ink} />
          <circle cx={0} cy={18} r={7} fill={C.ink} />
        </g>
      )}
    </g>
  );
}
const Hub = () => (
  <g>
    <rect x={400} y={1080} width={280} height={120} rx={24} fill={C.steel} />
    <ellipse cx={540} cy={1080} rx={150} ry={40} fill={C.steel} />
    <circle cx={540} cy={1080} r={40} fill="#454f5c" />
  </g>
);

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 60, mass: 0.5, stiffness: 240 } });
  const sc = interpolate(pop, [0, 1], [0.8, 1], clamp);
  const badge = spring({ frame: frame - 14, fps, config: { damping: 65, mass: 0.5, stiffness: 220 } });
  const ring = (k: number) => interpolate(frame, [6 + k * 6, 50 + k * 6], [0, 1], clamp);
  // blink eyelids around frame 60
  const blink = interpolate(frame, [58, 66, 74], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* shock rings */}
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={540} cy={1080} r={120 + ring(k) * 420} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.5 * (1 - ring(k))} />
          ))}
          <Hub />
          <g transform={`scale(${sc})`} style={{ transformOrigin: '540px 840px' }}>
            <Bag warn />
          </g>
          {/* 30 ms badge */}
          <g transform={`translate(540,440) scale(${badge})`} opacity={badge}>
            <rect x={-150} y={-54} width={300} height={108} rx={24} fill={C.gold} />
            <text x={20} y={2} textAnchor="middle" fill={C.ink} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">30 ms</text>
            <circle cx={-110} cy={-6} r={26} fill="none" stroke={C.ink} strokeWidth={5} />
            <line x1={-110} y1={-6} x2={-110} y2={-24} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
            <line x1={-110} y1={-6} x2={-96} y2={-6} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
            <text x={20} y={40} textAnchor="middle" fill={C.ink} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">ONE BLINK</text>
          </g>
          {/* blink eyelids */}
          <rect x={0} y={0} width={1080} height={960 * blink} fill={C.ink} />
          <rect x={0} y={1920 - 960 * blink} width={1080} height={960 * blink} fill={C.ink} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: BLAST (pump vs explosion) ───────────────────────────────────────
function SceneBlast() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seam = interpolate(frame, [4, 22], [0, 1], clamp);
  const slash = interpolate(frame, [16, 34], [0, 1], clamp);
  const burst = spring({ frame: frame - 24, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  const pumpThrob = 1 + 0.05 * Math.sin(frame * 0.5);
  const label = spring({ frame: frame - 40, fps, config: { damping: 75, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.panel }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <rect x={538} y={420} width={5} height={1080 * seam} fill={C.gold} />
          {/* LEFT: pump (crossed out) */}
          <g transform={`translate(270,900) scale(${pumpThrob})`}>
            <ellipse cx={0} cy={40} rx={120} ry={70} fill={C.nylon} opacity={0.5} />
            <rect x={-30} y={-90} width={60} height={70} rx={10} fill={C.steel} />
            <rect x={-20} y={-130} width={40} height={50} rx={8} fill="#454f5c" />
          </g>
          <line x1={130} y1={700} x2={420} y2={1100} stroke={C.red} strokeWidth={16} strokeLinecap="round"
            strokeDasharray={520} strokeDashoffset={520 * (1 - slash)} />
          <text x={270} y={1260} textAnchor="middle" fill={C.red} fontSize={34} fontWeight={900} fontFamily="Poppins,sans-serif">NOT A PUMP</text>
          {/* RIGHT: explosion bag */}
          <g opacity={burst}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
              const a = (k * 45) * Math.PI / 180;
              return <line key={k} x1={810} y1={900} x2={810 + Math.cos(a) * 200 * burst} y2={900 + Math.sin(a) * 200 * burst} stroke={C.fire} strokeWidth={12} strokeLinecap="round" />;
            })}
            <Bag scale={0.55} cx={810} cy={900} />
          </g>
          <g transform="translate(810,1230)" opacity={label}>
            <rect x={-150} y={-32} width={300} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">CONTROLLED BLAST</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: SENSOR (spark into pellet) ──────────────────────────────────────
function SceneSensor() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrowIn = interpolate(frame, [10, 60], [0, 1], clamp);
  const hit = frame > 60 ? 1 : 0;
  const crack = interpolate(frame, [60, 68, 86], [0, 1, 0.4], clamp);
  const pulse = interpolate(frame, [66, 100], [0, 1], clamp);
  const spark = interpolate(frame, [96, 104, 120], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* hub housing */}
          <rect x={180} y={760} width={720} height={420} rx={28} fill={C.panel} stroke={C.steel} strokeWidth={4} />
          {/* accelerometer chip */}
          <g transform="translate(330,940)">
            <rect x={-70} y={-70} width={140} height={140} rx={12} fill={C.steel} />
            <rect x={-50} y={-50} width={100} height={100} rx={6} fill={C.ink} />
            {[-50, -16, 18, 52].map((g, k) => <line key={k} x1={70} y1={g} x2={104} y2={g} stroke={C.gold} strokeWidth={5} opacity={hit ? 1 : 0.4} />)}
            <text x={0} y={108} textAnchor="middle" fill={C.steel} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">SENSOR</text>
          </g>
          {/* gold wire trace */}
          <path d="M 434,940 Q 580,940 660,940" fill="none" stroke={C.gold} strokeWidth={6} opacity={0.4} />
          <path d="M 434,940 Q 580,940 660,940" fill="none" stroke={C.sparkW} strokeWidth={6}
            strokeDasharray={240} strokeDashoffset={240 * (1 - pulse)} />
          {/* canister + pellets */}
          <g transform="translate(740,940)">
            <rect x={-50} y={-90} width={100} height={180} rx={20} fill={C.steel} stroke={C.gold} strokeWidth={4} />
            {[0, 1, 2, 3].map((k) => <circle key={k} cx={-18 + (k % 2) * 36} cy={-40 + Math.floor(k / 2) * 50} r={16} fill="#7a8493" />)}
            {spark > 0 && <circle cx={-18} cy={-40} r={26 * spark + 4} fill={C.sparkW} opacity={spark} />}
            <text x={0} y={130} textAnchor="middle" fill={C.gold} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">PELLET</text>
          </g>
          {/* red velocity arrow hitting wall */}
          <g transform={`translate(${interpolate(arrowIn, [0, 1], [300, 540], clamp)},560)`}>
            <line x1={-80} y1={0} x2={70} y2={0} stroke={C.red} strokeWidth={14} markerEnd="url(#aRedA)" strokeLinecap="round" />
            <text x={-20} y={-30} textAnchor="middle" fill={C.red} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">CRASH</text>
          </g>
          {crack > 0 && [0, 1, 2, 3].map((k) => {
            const a = (k * 50 - 75) * Math.PI / 180;
            return <line key={k} x1={620} y1={560} x2={620 + Math.cos(a) * 60} y2={560 + Math.sin(a) * 60} stroke={C.sparkW} strokeWidth={4} opacity={crack} />;
          })}
          <rect x={620} y={440} width={10} height={240} fill={C.steel} opacity={hit ? 0.8 : 0.3} />
          <defs><marker id="aRedA" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.red} /></marker></defs>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: BURN (hero nitrogen flood) ──────────────────────────────────────
function SceneBurn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = spring({ frame, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const membrane = interpolate(frame, [20, 130], [0.2, 1], clamp);
  const vol = Math.round(interpolate(frame, [20, 150], [0, 60], clamp));
  const shimmer = Math.sin(frame * 0.4) * 4;
  const N = 44;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 50% 56%, #2a1208 0%, ${C.bg} 70%)` }} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* cream membrane filling */}
          <ellipse cx={540} cy={900} rx={300 * membrane} ry={270 * membrane} fill={C.nylon} opacity={0.22} stroke="#cdbfa0" strokeWidth={4} />
          {/* nitrogen N2 glyphs streaming out */}
          {Array.from({ length: N }).map((_, k) => {
            const ang = (k * 360 / N) * Math.PI / 180;
            const t = ((frame * 4 + k * 13) % 120) / 120;
            const dist = t * 280 * membrane;
            const x = 540 + Math.cos(ang) * dist * (0.6 + (k % 3) * 0.2);
            const y = 900 + Math.sin(ang) * dist * 0.9 - t * 30;
            return (
              <g key={k} opacity={(1 - t) * 0.9}>
                <circle cx={x - 6} cy={y} r={7} fill={C.n2} />
                <circle cx={x + 6} cy={y} r={7} fill={C.n2} />
              </g>
            );
          })}
          {/* combustion core */}
          <g transform={`translate(540,${900 + shimmer}) scale(${bloom})`}>
            <circle cx={0} cy={0} r={70} fill={C.fire} />
            <circle cx={0} cy={0} r={44} fill={C.gold} />
            <circle cx={0} cy={0} r={22} fill={C.sparkW} />
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k * 60 + frame * 4) * Math.PI / 180;
              return <line key={k} x1={Math.cos(a) * 60} y1={Math.sin(a) * 60} x2={Math.cos(a) * 95} y2={Math.sin(a) * 95} stroke={C.ember} strokeWidth={6} strokeLinecap="round" />;
            })}
          </g>
          {/* N2 tag + volume counter */}
          <g transform="translate(820,560)">
            <rect x={-60} y={-30} width={120} height={60} rx={18} fill={C.n2} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">N₂</text>
          </g>
          <text x={250} y={580} textAnchor="middle" fill={C.gold} fontSize={48} fontWeight={900} fontFamily="Poppins,sans-serif">{vol}L</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: SLAM (face arrives) ─────────────────────────────────────────────
function SceneSlam() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const expand = spring({ frame, fps, config: { damping: 65, mass: 0.5, stiffness: 200 } });
  const headY = interpolate(frame, [10, 50], [-300, 120], clamp);
  const cushion = frame > 48 ? interpolate(frame, [48, 58, 70], [0, 1, 0], clamp) : 0;
  const pill = spring({ frame: frame - 50, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const vent = interpolate(frame, [70, 150], [1, 0.86], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Hub />
          <g transform={`scale(${(0.9 + 0.1 * expand) * vent})`} style={{ transformOrigin: '540px 900px' }}>
            <Bag cx={540} cy={900} />
            {/* nitrogen pressure arrows */}
            {[ -1, 0, 1].map((k) => (
              <line key={k} x1={540 + k * 120} y1={780} x2={540 + k * 120} y2={700} stroke={C.n2} strokeWidth={7} markerEnd="url(#aN2)" />
            ))}
          </g>
          {/* head silhouette lunging */}
          <g transform={`translate(540,${headY})`}>
            <circle cx={0} cy={0} r={70} fill={C.steel} />
            <rect x={-80} y={60} width={160} height={120} rx={40} fill={C.steel} />
          </g>
          {/* cushion ripple */}
          {cushion > 0 && [0, 1, 2].map((k) => (
            <circle key={k} cx={540} cy={760} r={(cushion + k * 0.2) * 120} fill="none" stroke={C.gold} strokeWidth={4} opacity={(1 - cushion) * 0.7} />
          ))}
          <g transform="translate(820,560)" opacity={pill}>
            <rect x={-130} y={-32} width={260} height={64} rx={32} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">JUST IN TIME</text>
          </g>
          <defs><marker id="aN2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.n2} /></marker></defs>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [4, 30], [1, 0], clamp);
  const w1 = spring({ frame: frame - 36, fps, config: { damping: 75, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 54, fps, config: { damping: 75, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 74, fps, config: { damping: 60, mass: 0.55, stiffness: 220 } });
  const bar = interpolate(frame, [80, 110, 140], [0, 1, 0], clamp);
  const flash = interpolate(frame, [74, 82, 100], [0, 1, 0.3], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g opacity={fade}><Hub /><Bag cx={540} cy={900} scale={0.9} /></g>
          {/* payoff text */}
          <text x={540} y={840} textAnchor="middle" fontSize={96} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" opacity={w1}
            transform={`translate(540,840) scale(${w1}) translate(-540,-840)`} fill={C.sparkW}>A BLINK-FAST</text>
          <g opacity={w3} transform={`translate(540,990) scale(${w3}) translate(-540,-990)`}>
            <circle cx={540} cy={960} r={150 * flash} fill={C.gold} opacity={flash * 0.3} />
            <text x={540} y={990} textAnchor="middle" fontSize={150} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}>BOMB</text>
          </g>
          {/* inflate/deflate timeline bar */}
          <g transform="translate(540,1140)">
            <rect x={-300} y={-6} width={600} height={12} rx={6} fill={C.panel} stroke={C.steel} strokeWidth={2} />
            <rect x={-300} y={-6} width={600 * bar} height={12} rx={6} fill={C.fire} />
          </g>
          <rect x={300} y={1024} width={480 * Math.min(1, w3)} height={9} rx={4} fill={C.gold} opacity={w3} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Airbag: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('airbag_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* explosion/chemical sound design (baked) */}
      <Sequence from={S.blast + 22}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.sensor + 96} durationInFrames={50}><Audio src={staticFile('sfx_digital.wav')} volume={0.45} /></Sequence>
      <Sequence from={S.burn + 4}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.burn + 10} durationInFrames={120}><Audio src={staticFile('sfx_airblast.mp3')} volume={0.4} /></Sequence>
      <Sequence from={S.slam + 46}><Audio src={staticFile('sfx_smack.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 74}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.blast - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.blast} durationInFrames={S.sensor - S.blast}><SceneBlast /></Sequence>
      <Sequence from={S.sensor} durationInFrames={S.burn - S.sensor}><SceneSensor /></Sequence>
      <Sequence from={S.burn} durationInFrames={S.slam - S.burn}><SceneBurn /></Sequence>
      <Sequence from={S.slam} durationInFrames={S.payoff - S.slam}><SceneSlam /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

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
import tgWords from './tardigrade_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1210;

const C = {
  bg:      '#0b1016',
  panel:   '#121a24',
  gold:    '#FFD23F',
  moss:    '#7FE08A',
  ice:     '#5FD0E8',
  ember:   '#E8553F',
  violet:  '#7C6CF0',
  water:   '#3FA7E8',
  bone:    '#C9D2DC',
  white:   '#F2F6FA',
  ink:     '#070b0f',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, tun: 313, extreme: 633, frozen: 851, revive: 976, payoff: 1114 };

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
const WRAW: { w: string; s: number }[] = (tgWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 38%, ${C.panel} 0%, ${C.bg} 72%)` }} />;

// water bear (facing right). curl 0=plump, 1=tun husk. green 1=moss, 0=grey
function Bear({ scale = 1, curl = 0, green = 1, legWiggle = 0 }: { scale?: number; curl?: number; green?: number; legWiggle?: number }) {
  const col = mix(C.bone, C.moss, green);
  const rx = 200 - curl * 70;
  const ry = 130 - curl * 14;
  const legLen = 40 * (1 - curl * 0.7);
  return (
    <g transform={`scale(${scale})`}>
      {/* legs */}
      {[-150, -70, 20, 110].map((lx, k) => {
        const wig = Math.sin(legWiggle + k) * 6 * (1 - curl);
        return (
          <g key={k}>
            <rect x={lx - 14} y={ry - 20} width={28} height={legLen + 30} rx={14} fill={col} />
            <circle cx={lx} cy={ry + legLen + 6 + wig} r={12} fill={mix(C.ink, col, 0.5)} />
          </g>
        );
      })}
      {/* body */}
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={col} />
      {/* segment ridges */}
      {[-110, -40, 30, 100].map((sx, k) => (
        <path key={k} d={`M ${sx},${-ry + 10} Q ${sx + (curl ? 6 : 0)},0 ${sx},${ry - 10}`} fill="none" stroke={mix(C.ink, col, 0.6)} strokeWidth={curl > 0.4 ? 6 : 4} opacity={0.6} />
      ))}
      {/* wrinkles when tun */}
      {curl > 0.4 && [-80, 0, 80].map((wx, k) => (
        <path key={k} d={`M ${wx - 30},${-40} q 30,20 0,40 q -30,20 0,40`} fill="none" stroke={mix(C.ink, col, 0.7)} strokeWidth={3} opacity={curl * 0.6} />
      ))}
      {/* snout + mouth */}
      <ellipse cx={rx - 20} cy={0} rx={50} ry={ry * 0.7} fill={col} />
      <circle cx={rx + 14} cy={0} r={18 * (1 - curl * 0.5)} fill={mix(C.ink, col, 0.4)} />
      {/* eyes */}
      {green > 0.4 && [-1, 1].map((s) => <circle key={s} cx={rx - 40} cy={s * 24} r={9} fill={C.ink} />)}
    </g>
  );
}

const Snowflake = ({ s = 1, color = C.ice }: { s?: number; color?: string }) => (
  <g transform={`scale(${s})`} stroke={color} strokeWidth={4} strokeLinecap="round">
    {[0, 60, 120].map((a) => <line key={a} x1={-22} y1={0} x2={22} y2={0} transform={`rotate(${a})`} />)}
  </g>
);
const Flame = ({ s = 1, color = C.ember }: { s?: number; color?: string }) => (
  <path d="M 0,-26 Q 18,-6 10,12 Q 0,26 -10,12 Q -18,-6 0,-26 Z" fill={color} transform={`scale(${s})`} />
);
const Rocket = ({ s = 1, color = C.violet }: { s?: number; color?: string }) => (
  <g transform={`scale(${s})`}><path d="M 0,-26 Q 12,-10 12,12 L -12,12 Q -12,-10 0,-26 Z" fill={color} /><path d="M -12,12 L -20,24 L -6,16 Z M 12,12 L 20,24 L 6,16 Z" fill={color} /></g>
);

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 10, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  const haz = [0, 1, 2].map((k) => spring({ frame: frame - 60 - k * 12, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } }));
  const caliper = interpolate(frame, [110, 150], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* orbit ring */}
          <circle cx={540} cy={940} r={460} fill="none" stroke={C.bone} strokeWidth={2} strokeDasharray="6 12" opacity={0.25} />
          <g transform={`translate(540,940) scale(${Math.min(1, pop)})`}>
            <Bear scale={1.9} legWiggle={frame * 0.3} />
          </g>
          {/* hazards on orbit */}
          <g transform="translate(180,640)" opacity={haz[0]}><circle r={42} fill="none" stroke={C.ice} strokeWidth={3} /><Snowflake s={1} /></g>
          <g transform="translate(900,640)" opacity={haz[1]}><circle r={42} fill="none" stroke={C.ember} strokeWidth={3} /><Flame s={1} /></g>
          <g transform="translate(540,440)" opacity={haz[2]}><circle r={42} fill="none" stroke={C.violet} strokeWidth={3} /><Rocket s={1} /></g>
          {/* badge */}
          <g transform={`translate(540,300) scale(${badge})`} opacity={badge}>
            <rect x={-280} y={-50} width={560} height={100} rx={26} fill={C.gold} />
            <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">CAN'T BE KILLED?</text>
          </g>
          {/* scale caliper */}
          <g opacity={caliper}>
            <line x1={780} y1={1280} x2={900} y2={1280} stroke={C.gold} strokeWidth={3} />
            <circle cx={920} cy={1280} r={5} fill={C.bone} />
            <text x={840} y={1330} textAnchor="middle" fill={C.gold} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">&lt; 1 mm</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: TUN (hero transformation) ───────────────────────────────────────
function SceneTun() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const morph = interpolate(frame, [30, 200], [0, 1], clamp);
  const pct = Math.round(interpolate(morph, [0, 1], [96, 3], clamp));
  const needle = interpolate(frame, [60, 200], [0, 0.5], clamp);
  const dots = 44;
  const label = interpolate(frame, [205, 240], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* baseline grid */}
          <line x1={120} y1={1080} x2={760} y2={1080} stroke={C.bone} strokeWidth={2} opacity={0.2} />
          {/* the bear morphing */}
          <g transform="translate(420,920) scale(1.2)">
            <Bear scale={1} curl={morph} green={1 - morph} legWiggle={frame * 0.2} />
            {/* water dots inside (draining) */}
            {Array.from({ length: dots }).map((_, k) => {
              const cohort = (k % 3) / 3;
              const drained = interpolate(morph, [cohort * 0.5, cohort * 0.5 + 0.4], [0, 1], clamp);
              const bx = ((k * 53) % 320) - 160;
              const by = ((k * 31) % 200) - 100;
              const riseY = by - drained * 200;
              return <circle key={k} cx={bx} cy={riseY} r={7} fill={C.water} opacity={(1 - drained) * 0.9} />;
            })}
          </g>
          {/* water counter */}
          <g transform="translate(420,560)">
            <text x={0} y={0} textAnchor="middle" fill={C.water} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{pct}% WATER</text>
          </g>
          {/* LIFE/DEATH gauge */}
          <g transform="translate(900,900)">
            <rect x={-14} y={-300} width={28} height={600} rx={14} fill={C.panel} stroke={C.bone} strokeWidth={3} />
            <text x={0} y={-320} textAnchor="middle" fill={C.moss} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">LIFE</text>
            <text x={0} y={350} textAnchor="middle" fill={C.bone} fontSize={28} fontWeight={900} fontFamily="Poppins,sans-serif">DEATH</text>
            <polygon points="-40,0 -14,-16 -14,16" fill={C.gold} transform={`translate(0,${interpolate(needle, [0, 0.5], [-300, 0], clamp)})`} />
            <line x1={-14} y1={0} x2={14} y2={0} stroke={C.gold} strokeWidth={3} strokeDasharray="4 4" opacity={label} />
          </g>
          <text x={540} y={1320} textAnchor="middle" fill={C.gold} fontSize={36} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={label}>TUN — between life &amp; death</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: EXTREME (cold + radiation) ──────────────────────────────────────
function SceneExtreme() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frost = interpolate(frame, [10, 90], [0, 1], clamp);
  const temp = Math.round(interpolate(frame, [10, 90], [20, -272], clamp));
  const zap1 = interpolate(frame, [50, 56, 70], [0, 1, 0], clamp);
  const zap2 = interpolate(frame, [90, 96, 110], [0, 1, 0], clamp);
  const shield = Math.max(zap1, zap2);
  const recoil = (zap1 + zap2) * 6;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* frost from left */}
          {Array.from({ length: 10 }).map((_, k) => {
            const on = frost > k / 10;
            return on ? <path key={k} d={`M 0,${300 + k * 130} L ${60 + frost * 120},${280 + k * 130} L ${30},${340 + k * 130} Z`} fill={C.ice} opacity={0.5} /> : null;
          })}
          {/* radiation from right */}
          {zap1 + zap2 > 0 && [0, 1, 2].map((k) => (
            <path key={k} d={`M 1080,${700 + k * 80} L 760,${720 + k * 60} L 820,${740 + k * 60} L 700,${780 + k * 60}`} fill="none" stroke={C.ember} strokeWidth={7} opacity={shield} />
          ))}
          {/* tun husk center */}
          <g transform={`translate(${540 + recoil},940) scale(1.2)`}>
            {shield > 0.2 && <ellipse cx={0} cy={0} rx={210} ry={150} fill="none" stroke={C.gold} strokeWidth={5} opacity={shield} />}
            <Bear scale={1} curl={1} green={0} />
          </g>
          {/* thermometer */}
          <g transform="translate(220,520)">
            <rect x={-16} y={-120} width={32} height={220} rx={16} fill={C.panel} stroke={C.bone} strokeWidth={3} />
            <circle cx={0} cy={100} r={26} fill={C.ice} />
            <rect x={-9} y={100 - 200 * frost} width={18} height={200 * frost} rx={9} fill={C.ice} />
            <text x={0} y={-140} textAnchor="middle" fill={C.ice} fontSize={32} fontWeight={900} fontFamily="Poppins,sans-serif">{temp}°C</text>
          </g>
          {/* radiation trefoil + tag */}
          <g transform="translate(880,560)" opacity={interpolate(frame, [40, 60], [0, 1], clamp)}>
            <circle r={26} fill={C.ember} />
            {[0, 120, 240].map((a) => <path key={a} d="M 0,0 L 14,-30 A 32 32 0 0 1 -14,-30 Z" fill={C.bg} transform={`rotate(${a})`} />)}
            <circle r={8} fill={C.bg} />
          </g>
          <text x={880} y={650} textAnchor="middle" fill={C.ember} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={interpolate(frame, [40, 60], [0, 1], clamp)}>LETHAL RADIATION</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FROZEN 30 years ─────────────────────────────────────────────────
function SceneFrozen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ice = spring({ frame, fps, config: { damping: 80, mass: 0.5, stiffness: 180 } });
  const year = Math.round(interpolate(frame, [10, 70], [1990, 2020], clamp));
  const yLabel = spring({ frame: frame - 64, fps, config: { damping: 55, mass: 0.5, stiffness: 210 } });
  const graph = interpolate(frame, [14, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* ice block */}
          <g transform={`translate(540,920) scale(${ice})`}>
            <polygon points="-260,-200 260,-200 300,200 -300,200" fill={C.ice} opacity={0.22} stroke={C.ice} strokeWidth={4} />
            <line x1={-180} y1={-200} x2={-140} y2={200} stroke={C.ice} strokeWidth={3} opacity={0.4} />
            <line x1={120} y1={-200} x2={180} y2={200} stroke={C.ice} strokeWidth={3} opacity={0.4} />
          </g>
          <g transform="translate(540,940) scale(1.05)"><Bear scale={1} curl={1} green={0} /></g>
          {/* year counter */}
          <text x={540} y={520} textAnchor="middle" fill={C.gold} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{year}</text>
          <g transform={`translate(540,600) scale(${yLabel})`} opacity={yLabel}>
            <rect x={-110} y={-34} width={220} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">30 YEARS</text>
          </g>
          {/* flat dormant graph */}
          <g transform="translate(540,1320)">
            <line x1={-300} y1={0} x2={300} y2={0} stroke={C.bone} strokeWidth={2} opacity={0.3} />
            <line x1={-300} y1={0} x2={-300 + 600 * graph} y2={0} stroke={C.moss} strokeWidth={4} />
            <text x={0} y={50} textAnchor="middle" fill={C.bone} fontSize={24} fontWeight={700} fontFamily="Poppins,sans-serif">dormant — flatline</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: REVIVE ──────────────────────────────────────────────────────────
function SceneRevive() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dropY = interpolate(frame, [6, 34], [300, 880], clamp);
  const impact = frame >= 34 ? 1 : 0;
  const ripple = interpolate(frame, [34, 64], [0, 1], clamp);
  const revive = interpolate(frame, [40, 110], [1, 0], clamp); // curl 1->0
  const walk = interpolate(frame, [110, 150], [0, 320], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* falling droplet */}
          {frame < 36 && (
            <g transform={`translate(540,${dropY})`}>
              <path d="M 0,-30 Q 22,0 0,28 Q -22,0 0,-30 Z" fill={C.water} />
            </g>
          )}
          {/* ripple */}
          {impact > 0 && <circle cx={540} cy={900} r={ripple * 220} fill="none" stroke={C.water} strokeWidth={6 * (1 - ripple) + 1} opacity={(1 - ripple) * 0.8} />}
          {/* reviving bear walking */}
          <g transform={`translate(${440 + walk},940) scale(1.2)`}>
            <Bear scale={1} curl={revive} green={1 - revive} legWiggle={walk > 0 ? frame * 0.6 : frame * 0.2} />
            {/* water flooding back */}
            {revive > 0.1 && Array.from({ length: 20 }).map((_, k) => {
              const t = interpolate(frame, [40, 100], [0, 1], clamp);
              if (t < (k % 5) / 5) return null;
              return <circle key={k} cx={((k * 47) % 280) - 140} cy={((k * 29) % 160) - 80} r={6} fill={C.water} opacity={revive < 0.5 ? 0.8 : 0} />;
            })}
          </g>
          {/* walk path */}
          {walk > 0 && <line x1={440} y1={1090} x2={440 + walk} y2={1090} stroke={C.moss} strokeWidth={3} strokeDasharray="6 10" opacity={0.5} />}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ['NATURE', 'BUILT', 'SOMETHING', 'YOU', "CAN'T", 'KILL'];
  const ws = words.map((_, k) => spring({ frame: frame - 14 - k * 12, fps, config: { damping: k === 4 ? 50 : 65, mass: 0.5, stiffness: 220 } }));
  const strike = interpolate(frame, [90, 130], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* dimmed hazards struck through */}
          {[[300, C.ice], [540, C.ember], [780, C.violet]].map((h, k) => (
            <g key={k} transform={`translate(${h[0]},1200)`} opacity={0.4}>
              {k === 0 && <Snowflake s={1.4} color={h[1] as string} />}
              {k === 1 && <Flame s={1.4} color={h[1] as string} />}
              {k === 2 && <Rocket s={1.4} color={h[1] as string} />}
              {strike > k / 3 && <line x1={-40} y1={-40} x2={40} y2={40} stroke={C.gold} strokeWidth={6} strokeLinecap="round" />}
            </g>
          ))}
          {/* revived bear small */}
          <g transform="translate(540,1480) scale(0.7)"><Bear scale={1} green={1} legWiggle={frame * 0.4} /></g>
          {/* payoff words */}
          {(() => {
            const lines = [['NATURE', 'BUILT', 'SOMETHING'], ['YOU', "CAN'T", 'KILL']];
            return lines.map((ln, li) => (
              <text key={li} x={540} y={640 + li * 130} textAnchor="middle" fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
                {ln.map((w, wi) => {
                  const gi = li * 3 + wi;
                  const isGold = w === "CAN'T";
                  return <tspan key={wi} fill={isGold ? C.gold : C.white} opacity={ws[gi]}> {w}</tspan>;
                })}
              </text>
            ));
          })()}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Tardigrade: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('tardigrade_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* organic/survival sound design (baked) */}
      <Sequence from={S.hook + 4}><Audio src={staticFile('sfx_boing.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.tun + 24} durationInFrames={150}><Audio src={staticFile('sfx_water_ripples.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.extreme + 50} durationInFrames={30}><Audio src={staticFile('sfx_digital.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.extreme + 90} durationInFrames={30}><Audio src={staticFile('sfx_digital.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.frozen + 8}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.revive + 32}><Audio src={staticFile('sfx_plip.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.revive + 44}><Audio src={staticFile('sfx_chime.wav')} volume={0.35} /></Sequence>
      <Sequence from={S.payoff + 62}><Audio src={staticFile('sfx_success.wav')} volume={0.48} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.tun - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.tun} durationInFrames={S.extreme - S.tun}><SceneTun /></Sequence>
      <Sequence from={S.extreme} durationInFrames={S.frozen - S.extreme}><SceneExtreme /></Sequence>
      <Sequence from={S.frozen} durationInFrames={S.revive - S.frozen}><SceneFrozen /></Sequence>
      <Sequence from={S.revive} durationInFrames={S.payoff - S.revive}><SceneRevive /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

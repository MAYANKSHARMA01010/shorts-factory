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
import thWords from './thermostat_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1007;

const C = {
  bg:      '#0c1118',
  panel:   '#141b24',
  gold:    '#FFD23F',
  red:     '#FF5A3C',
  brass:   '#C98A3B',
  steelB:  '#5BA8D4',
  merc:    '#C7D0DA',
  ember:   '#FF8A3D',
  green:   '#3FE08A',
  ghost:   '#5b6675',
  white:   '#F2F5F8',
  ink:     '#060a0f',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, open: 265, twometals: 454, curl: 548, mercury: 737, payoff: 905 };

function spiralPath(cx: number, cy: number, r0: number, rStep: number, turns: number, phase = 0, steps = 200) {
  let d = '';
  const total = turns * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const t = (total * i) / steps;
    const r = r0 + (rStep * t) / (Math.PI * 2);
    const x = cx + r * Math.cos(t + phase);
    const y = cy + r * Math.sin(t + phase);
    d += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return d;
}
function spiralTip(cx: number, cy: number, r0: number, rStep: number, turns: number, phase = 0) {
  const t = turns * Math.PI * 2;
  const r = r0 + (rStep * t) / (Math.PI * 2);
  return { x: cx + r * Math.cos(t + phase), y: cy + r * Math.sin(t + phase) };
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (thWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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
            color: active ? C.gold : '#fff', fontSize: 62, fontWeight: 900,
            fontFamily: "'Poppins','Arial Black',sans-serif", textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)', display: 'inline-block', margin: '0 15px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 34%, ${C.panel} 0%, ${C.bg} 70%)` }} />;

// bimetal coil (brass edges + steel-blue core)
function Coil({ cx, cy, turns, phase = 0, scale = 1 }: { cx: number; cy: number; turns: number; phase?: number; scale?: number }) {
  const d = spiralPath(0, 0, 40, 46, turns, phase);
  return (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      <path d={d} fill="none" stroke={C.brass} strokeWidth={20} strokeLinecap="round" />
      <path d={d} fill="none" stroke={C.steelB} strokeWidth={9} strokeLinecap="round" />
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 60, mass: 0.5, stiffness: 220 } });
  const badge = spring({ frame: frame - 18, fps, config: { damping: 55, mass: 0.5, stiffness: 220 } });
  const needle = spring({ frame: frame - 30, fps, config: { damping: 70, mass: 0.6, stiffness: 150 } });
  const needleAng = interpolate(needle, [0, 1], [-130, -20], clamp);
  const bat = spring({ frame: frame - 56, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } });
  const chip = spring({ frame: frame - 70, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`scale(${pop})`} style={{ transformOrigin: '540px 880px' }}>
            {/* brass ring */}
            <circle cx={540} cy={880} r={300} fill={C.brass} />
            <circle cx={540} cy={880} r={260} fill="#f0e6cf" />
            {/* ticks */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i * 15 - 90) * Math.PI / 180;
              return <line key={i} x1={540 + Math.cos(a) * 232} y1={880 + Math.sin(a) * 232} x2={540 + Math.cos(a) * 252} y2={880 + Math.sin(a) * 252} stroke="#9b8a63" strokeWidth={i % 6 === 0 ? 6 : 3} />;
            })}
            <text x={540} y={770} textAnchor="middle" fill="#9b8a63" fontSize={40} fontWeight={800} fontFamily="Poppins,sans-serif">70</text>
            {/* needle */}
            <g transform={`rotate(${needleAng} 540 880)`}>
              <line x1={540} y1={880} x2={540 + 200} y2={880} stroke={C.red} strokeWidth={10} strokeLinecap="round" />
            </g>
            <circle cx={540} cy={880} r={22} fill="#7a6a45" />
          </g>
          {/* ? badge */}
          <g transform={`translate(800,640) scale(${badge})`} opacity={badge}>
            <circle cx={0} cy={0} r={70} fill={C.gold} />
            <text x={0} y={26} textAnchor="middle" fill={C.ink} fontSize={88} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
          {/* crossed battery */}
          <g transform="translate(220,1320)" opacity={bat}>
            <rect x={-50} y={-26} width={92} height={52} rx={8} fill={C.ghost} />
            <rect x={42} y={-12} width={12} height={24} rx={3} fill={C.ghost} />
            <line x1={-58} y1={-34} x2={58} y2={34} stroke={C.red} strokeWidth={7} strokeLinecap="round" />
            <text x={0} y={66} textAnchor="middle" fill={C.ghost} fontSize={24} fontWeight={700} fontFamily="Poppins,sans-serif">no battery</text>
          </g>
          {/* crossed chip */}
          <g transform="translate(860,1320)" opacity={chip}>
            <rect x={-40} y={-40} width={80} height={80} rx={8} fill={C.ghost} />
            {[-40, 40].map((s, i) => [-24, 0, 24].map((g, j) => <line key={`${i}-${j}`} x1={s} y1={g} x2={s + (i === 0 ? -16 : 16)} y2={g} stroke={C.ghost} strokeWidth={5} />))}
            <line x1={-52} y1={-52} x2={52} y2={52} stroke={C.red} strokeWidth={7} strokeLinecap="round" />
            <text x={0} y={80} textAnchor="middle" fill={C.ghost} fontSize={24} fontWeight={700} fontFamily="Poppins,sans-serif">no chip</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: OPEN (bimetal coil reveal) ──────────────────────────────────────
function SceneOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iris = interpolate(frame, [4, 30], [0, 1], clamp);
  const draw = interpolate(frame, [20, 90], [0, 1], clamp);
  const label = spring({ frame: frame - 92, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  const glint = interpolate((frame * 3) % 90, [0, 45, 90], [0, 1, 0], clamp);
  const d = spiralPath(540, 880, 40, 46, 3.4);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* faint thermostat outline */}
          <circle cx={540} cy={880} r={300 * (1 - iris) + 360 * iris} fill="none" stroke={C.ghost} strokeWidth={4} opacity={0.4} />
          {/* coil drawing on */}
          <path d={d} fill="none" stroke={C.brass} strokeWidth={20} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
          <path d={d} fill="none" stroke={C.steelB} strokeWidth={9} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
          {/* glint */}
          <circle cx={540 + Math.cos(glint * 6) * 90} cy={880 + Math.sin(glint * 6) * 90} r={8} fill="#fff" opacity={glint} />
          {/* label */}
          <g transform="translate(540,1340)" opacity={label}>
            <rect x={-170} y={-34} width={340} height={68} rx={34} fill={C.gold} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BIMETAL STRIP</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TWO METALS (expansion) ──────────────────────────────────────────
function SceneTwoMetals() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const barIn = spring({ frame, fps, config: { damping: 90, mass: 0.5, stiffness: 200 } });
  const heat = interpolate(frame, [14, 50], [0, 1], clamp);
  const brassLen = interpolate(frame, [24, 80], [0, 360], clamp);
  const steelLen = interpolate(frame, [24, 80], [0, 90], clamp);
  const gap = Math.round(interpolate(frame, [24, 80], [0, 12], clamp));
  const tag = spring({ frame: frame - 70, fps, config: { damping: 80, mass: 0.5, stiffness: 200 } });
  const shim = Math.sin(frame * 0.3) * 0.15 + 0.6;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <marker id="aBrass" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.brass} /></marker>
            <marker id="aSteel" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.steelB} /></marker>
            <radialGradient id="heatG3" cx="50%" cy="100%" r="75%">
              <stop offset="0%" stopColor={C.ember} stopOpacity={0.55} />
              <stop offset="100%" stopColor={C.ember} stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* heat glow */}
          <ellipse cx={540} cy={1010} rx={420} ry={150} fill="url(#heatG3)" opacity={heat * shim} />
          {/* ember licks rising */}
          {[0, 1, 2, 3, 4].map((k) => {
            const lx = 360 + k * 90;
            const lh = (40 + (k % 2) * 26) * heat * (0.7 + 0.3 * Math.sin(frame * 0.3 + k));
            return <path key={k} d={`M ${lx - 14},970 Q ${lx},${970 - lh} ${lx + 14},970 Z`} fill={C.ember} opacity={heat * 0.7} />;
          })}
          <g transform={`scale(${barIn})`} style={{ transformOrigin: '300px 860px' }}>
            {/* rivet */}
            <circle cx={250} cy={860} r={18} fill={C.ghost} />
            {/* brass top */}
            <rect x={250} y={822} width={520} height={38} fill={C.brass} />
            {/* steel bottom */}
            <rect x={250} y={860} width={520} height={38} fill={C.steelB} />
            <line x1={250} y1={860} x2={770} y2={860} stroke="#fff" strokeWidth={3} opacity={0.7} />
          </g>
          {/* brass arrow (long) */}
          <line x1={780} y1={830} x2={780 + brassLen} y2={830} stroke={C.brass} strokeWidth={8} markerEnd="url(#aBrass)" strokeLinecap="round" />
          {/* steel arrow (short) */}
          <line x1={780} y1={890} x2={780 + steelLen} y2={890} stroke={C.steelB} strokeWidth={8} markerEnd="url(#aSteel)" strokeLinecap="round" />
          {/* gap counter */}
          <text x={540} y={700} textAnchor="middle" fill={C.gold} fontSize={56} fontWeight={900} fontFamily="Poppins,sans-serif">+{gap} mm</text>
          {/* EXPANDS tag */}
          <g transform="translate(900,790)" opacity={tag}>
            <rect x={-90} y={-28} width={180} height={56} rx={28} fill={C.gold} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">EXPANDS</text>
          </g>
          <text x={870} y={960} textAnchor="middle" fill={C.steelB} fontSize={26} fontWeight={700} fontFamily="Poppins,sans-serif">barely moves</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CURL (hero) ─────────────────────────────────────────────────────
function SceneCurl() {
  const frame = useCurrentFrame();
  // wind 0 (cool) .. 1 (hot): heat up then cool down
  const wind = frame < 95
    ? interpolate(frame, [10, 95], [0, 1], clamp)
    : interpolate(frame, [95, 180], [1, 0.15], clamp);
  const turns = 3.0 + wind * 1.0;
  const phase = wind * 0.6;
  const tip = spiralTip(540, 880, 40, 46, turns, phase);
  // dotted arc endpoints (cool tip vs hot tip)
  const coolTip = spiralTip(540, 880, 40, 46, 3.0, 0);
  const hotTip = spiralTip(540, 880, 40, 46, 4.0, 0.6);
  const mercFill = interpolate(wind, [0, 1], [0.2, 0.95], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <radialGradient id="heatG4" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={C.ember} stopOpacity={0.4} />
              <stop offset="100%" stopColor={C.ember} stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* heat aura right */}
          <ellipse cx={910} cy={880} rx={150} ry={320} fill="url(#heatG4)" opacity={0.3 + wind * 0.5} />
          {/* thermometer left */}
          <g transform="translate(190,880)">
            <rect x={-22} y={-280} width={44} height={520} rx={22} fill={C.panel} stroke={C.ghost} strokeWidth={4} />
            <circle cx={0} cy={240} r={42} fill={C.ember} />
            <rect x={-14} y={240 - 480 * mercFill} width={28} height={480 * mercFill} rx={14} fill={C.ember} />
            <text x={0} y={-310} textAnchor="middle" fill={C.white} fontSize={32} fontWeight={800} fontFamily="Poppins,sans-serif">{Math.round(60 + wind * 25)}°</text>
          </g>
          {/* dotted arc */}
          <path d={`M ${coolTip.x},${coolTip.y} Q 760,560 ${hotTip.x},${hotTip.y}`} fill="none" stroke={C.ghost} strokeWidth={3} strokeDasharray="8 10" opacity={0.6} />
          {/* the coil */}
          <Coil cx={540} cy={880} turns={turns} phase={phase} />
          {/* tip marker + trail */}
          <circle cx={tip.x} cy={tip.y} r={14} fill={C.red} />
          <circle cx={tip.x} cy={tip.y} r={26} fill="none" stroke={C.red} strokeWidth={3} opacity={0.5} />
          {/* +HEAT / -COOL markers */}
          <g transform={`translate(${hotTip.x + 40},${hotTip.y - 10})`}>
            <rect x={-50} y={-24} width={100} height={48} rx={24} fill={C.red} />
            <text x={0} y={8} textAnchor="middle" fill="#fff" fontSize={26} fontWeight={900} fontFamily="Poppins,sans-serif">+HEAT</text>
          </g>
          <g transform={`translate(${coolTip.x - 60},${coolTip.y + 30})`}>
            <rect x={-50} y={-24} width={100} height={48} rx={24} fill={C.steelB} />
            <text x={0} y={8} textAnchor="middle" fill="#fff" fontSize={26} fontWeight={900} fontFamily="Poppins,sans-serif">-COOL</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: MERCURY closes circuit ──────────────────────────────────────────
function SceneMercury() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tilt = interpolate(frame, [10, 50], [0, 16], clamp);
  const roll = interpolate(frame, [20, 60], [-90, 70], clamp);
  const contact = frame > 58 ? 1 : 0;
  const green = interpolate(frame, [60, 100], [0, 1], clamp);
  const dots = (frame * 8) % 200;
  const onPill = spring({ frame: frame - 64, fps, config: { damping: 60, mass: 0.5, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* coil tip stub */}
          <path d={spiralPath(360, 700, 16, 22, 1.6)} fill="none" stroke={C.brass} strokeWidth={16} strokeLinecap="round" />
          <path d={spiralPath(360, 700, 16, 22, 1.6)} fill="none" stroke={C.steelB} strokeWidth={7} strokeLinecap="round" />
          {/* glass ampoule (tilts) */}
          <g transform={`rotate(${tilt} 600 920)`}>
            <rect x={430} y={870} width={360} height={120} rx={60} fill="#22303d" stroke={C.merc} strokeWidth={4} opacity={0.85} />
            <rect x={430} y={870} width={360} height={120} rx={60} fill="none" stroke="#9fb4c4" strokeWidth={3} opacity={0.5} />
            {/* contact pins (right end) */}
            <line x1={770} y1={910} x2={820} y2={910} stroke={contact ? C.green : C.ghost} strokeWidth={8} />
            <line x1={770} y1={950} x2={820} y2={950} stroke={contact ? C.green : C.ghost} strokeWidth={8} />
            {/* mercury bead */}
            <circle cx={600 + roll} cy={930} r={34} fill={C.merc} />
            <circle cx={590 + roll} cy={920} r={10} fill="#fff" opacity={0.7} />
          </g>
          {/* green circuit to furnace */}
          <path d="M 820,930 Q 940,930 940,1140" fill="none" stroke={C.green} strokeWidth={6}
            strokeDasharray={420} strokeDashoffset={420 * (1 - green)} />
          {green > 0.3 && [0, 1, 2].map((k) => {
            const t = ((dots + k * 66) % 200) / 200;
            return <circle key={k} cx={interpolate(t, [0, 0.5, 1], [820, 940, 940])} cy={interpolate(t, [0, 0.5, 1], [930, 930, 1140])} r={8} fill={C.green} />;
          })}
          {/* furnace icon */}
          <g transform="translate(940,1200)">
            <rect x={-50} y={-40} width={100} height={90} rx={10} fill={C.ghost} />
            <path d="M -20,30 Q 0,-20 20,30 Z" fill={green > 0.5 ? C.ember : '#3a4350'} />
          </g>
          {/* ON pill */}
          <g transform="translate(540,560)" opacity={onPill}>
            <rect x={-70} y={-34} width={140} height={68} rx={34} fill={C.green} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">ON</text>
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
  const flame = spring({ frame: frame - 4, fps, config: { damping: 70, mass: 0.5, stiffness: 200 } });
  const flick = 1 + 0.12 * Math.sin(frame * 0.5);
  const w1 = spring({ frame: frame - 24, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w2 = spring({ frame: frame - 42, fps, config: { damping: 70, mass: 0.5, stiffness: 210 } });
  const w3 = spring({ frame: frame - 62, fps, config: { damping: 60, mass: 0.55, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* furnace flame */}
          <g transform={`translate(540,1320) scale(${flame})`}>
            <path d={`M -90,0 Q -70,${-220 * flick} 0,${-300 * flick} Q 70,${-220 * flick} 90,0 Z`} fill={C.ember} />
            <path d={`M -50,0 Q -40,${-130 * flick} 0,${-190 * flick} Q 40,${-130 * flick} 50,0 Z`} fill={C.red} />
            <path d={`M -24,0 Q -18,${-70 * flick} 0,${-110 * flick} Q 18,${-70 * flick} 24,0 Z`} fill={C.gold} />
          </g>
          {/* payoff text */}
          <text x={540} y={760} textAnchor="middle" fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}
            opacity={w1} transform={`translate(540,760) scale(${w1}) translate(-540,-760)`}>METAL</text>
          <text x={540} y={890} textAnchor="middle" fontSize={56} fontWeight={800} fontFamily="Poppins,sans-serif" fill={C.white}
            opacity={w2} transform={`translate(540,890) scale(${w2}) translate(-540,-890)`}>that can</text>
          <text x={540} y={1010} textAnchor="middle" fontSize={104} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={C.gold}
            opacity={w3} transform={`translate(540,1010) scale(${w3}) translate(-540,-1010)`}>FEEL HEAT.</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export const Thermostat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('thermostat_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      {/* thermostat/metal/heat sound design (baked) */}
      <Sequence from={S.hook + 8}><Audio src={staticFile('sfx_click.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.curl + 24}><Audio src={staticFile('sfx_boing.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.mercury + 66}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.mercury + 74} durationInFrames={40}><Audio src={staticFile('sfx_digital.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.payoff + 4}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.payoff + 56}><Audio src={staticFile('sfx_success.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.open - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.open} durationInFrames={S.twometals - S.open}><SceneOpen /></Sequence>
      <Sequence from={S.twometals} durationInFrames={S.curl - S.twometals}><SceneTwoMetals /></Sequence>
      <Sequence from={S.curl} durationInFrames={S.mercury - S.curl}><SceneCurl /></Sequence>
      <Sequence from={S.mercury} durationInFrames={S.payoff - S.mercury}><SceneMercury /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

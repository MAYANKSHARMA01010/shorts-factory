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
import phonebillWords from './phonebill_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1162;

const C = {
  bg: '#0b1220',
  panel: '#13233e',
  paper: '#f4ecd6',
  paperShadow: '#cab988',
  gold: '#FFD23F',
  green: '#36E07A',
  teal: '#4ED1C4',
  red: '#FF5A4D',
  blue: '#4AA8FF',
  ivory: '#F2ECDD',
  slate: '#7C90A8',
  ink: '#070d10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// sentence-boundary frames from phonebill_words.json (@30fps)
// hook: ...taxes? @ f98 | setup: ...recovery. @ f405 | numbers: ...month. @ f661
// hero: ...80. @ f832 | app: ...about. @ f1097 | payoff: ...disguise. @ f1152
const S = { hook: 0, setup: 98, numbers: 405, hero: 661, app: 832, payoff: 1097 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ── CAPTIONS (root, 3-word karaoke pages) ────────────────────────────────────
const WRAW: { w: string; s: number }[] = (phonebillWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ── shared pill ──────────────────────────────────────────────────────────────
function Pill({ x, y, w, text, scale = 1, op = 1, fontSize = 40, fill = C.gold, textFill = C.ink }: { x: number; y: number; w: number; text: string; scale?: number; op?: number; fontSize?: number; fill?: string; textFill?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      <rect x={-w / 2} y={-42} width={w} height={84} rx={42} fill={fill} />
      <text x={0} y={15} textAnchor="middle" fill={textFill} fontSize={fontSize} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{text}</text>
    </g>
  );
}

// ── shared PhoneBill paper component ─────────────────────────────────────────
// Renders a cell-carrier bill: header band, plan line, then a stack of "fees & surcharges"
// lines that can be individually highlighted via the `hi` index array.
type FeeLine = { name: string; amt: string };
const FEES: FeeLine[] = [
  { name: 'PLAN', amt: '$65.00' },
  { name: 'FEDERAL TAX', amt: '$1.20' },
  { name: 'STATE TAX', amt: '$2.10' },
  { name: 'REGULATORY RECOVERY', amt: '$3.99' },
  { name: 'ADMIN CHARGE', amt: '$3.49' },
  { name: 'NETWORK COST RECOVERY', amt: '$4.25' },
];
function PhoneBillPaper({ x, y, scale = 1, op = 1, totalAmt = '$80.03', highlightIdx = [] as number[], highlightColor = C.gold, totalHi = false }: { x: number; y: number; scale?: number; op?: number; totalAmt?: string; highlightIdx?: number[]; highlightColor?: string; totalHi?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      {/* shadow */}
      <rect x={-360} y={-560} width={720} height={1100} rx={20} fill={C.paperShadow} opacity={0.5} transform="translate(14,18)" />
      {/* paper */}
      <rect x={-360} y={-560} width={720} height={1100} rx={20} fill={C.paper} stroke="#a89e7d" strokeWidth={3} />
      {/* header band */}
      <rect x={-360} y={-560} width={720} height={120} fill={C.panel} />
      <text x={-310} y={-490} textAnchor="start" fill={C.ivory} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MOBILE</text>
      <text x={-310} y={-450} textAnchor="start" fill={C.gold} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">monthly statement</text>
      <text x={310} y={-470} textAnchor="end" fill={C.ivory} fontSize={32} fontWeight={800} fontFamily="Poppins,Arial Black,sans-serif">JUN 2026</text>
      {/* fee lines */}
      {FEES.map((f, i) => {
        const ly = -380 + i * 110;
        const hi = highlightIdx.includes(i);
        return (
          <g key={i}>
            {hi && (
              <rect x={-340} y={ly - 50} width={680} height={94} rx={10} fill={highlightColor} opacity={0.22} />
            )}
            {hi && (
              <rect x={-340} y={ly - 50} width={680} height={94} rx={10} fill="none" stroke={highlightColor} strokeWidth={5} />
            )}
            <text x={-320} y={ly + 4} textAnchor="start" fill={C.ink} fontSize={34} fontWeight={i === 0 ? 900 : 700} fontFamily="Poppins,Arial Black,sans-serif">{f.name}</text>
            <text x={320} y={ly + 4} textAnchor="end" fill={C.ink} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{f.amt}</text>
            <line x1={-320} y1={ly + 30} x2={320} y2={ly + 30} stroke="#cdbf95" strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
          </g>
        );
      })}
      {/* total row */}
      <g>
        {totalHi && <rect x={-340} y={310} width={680} height={120} rx={14} fill={C.gold} opacity={0.18} />}
        <rect x={-340} y={310} width={680} height={120} rx={14} fill="none" stroke={totalHi ? C.gold : C.ink} strokeWidth={totalHi ? 6 : 3} />
        <text x={-320} y={376} textAnchor="start" fill={C.ink} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">TOTAL DUE</text>
        <text x={320} y={388} textAnchor="end" fill={totalHi ? '#a16500' : C.ink} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{totalAmt}</text>
      </g>
    </g>
  );
}

// ─── SCENE 1: HOOK ──────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const badgeWobble = Math.sin(frame * 0.15) * 6;
  const ringPulse = 0.55 + 0.45 * Math.sin(frame * 0.18);
  // gold "?" badge above bill; dashed gold box highlights the fees+surcharges block
  const ringOp = interpolate(frame, [10, 30], [0, 1], clamp);
  const subOp = interpolate(frame, [40, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* bill anchored center-low */}
          <g transform="translate(540,1080)">
            <PhoneBillPaper x={0} y={0} scale={0.78} op={1} highlightIdx={[3,4,5]} highlightColor={C.gold} />
          </g>
          {/* dashed pulsing ring around the suspicious lines */}
          <g opacity={ringOp}>
            <rect x={285} y={830} width={510} height={290} rx={16} fill="none" stroke={C.gold} strokeWidth={8} strokeDasharray="18 12" opacity={ringPulse} />
          </g>
          {/* "?" gold badge above bill */}
          <g transform={`translate(${540 + badgeWobble},390)`}>
            <circle cx={0} cy={0} r={92} fill={C.gold} />
            <text x={0} y={32} textAnchor="middle" fill={C.ink} fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
          {/* sub-label */}
          <g opacity={subOp}>
            <Pill x={540} y={540} w={620} text="ARE THESE TAXES?" fontSize={50} fill={C.gold} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SETUP — three culprit names ──────────────────────────────────────
function SceneSetup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const lines = [
    { name: 'REGULATORY RECOVERY', delay: 40 },
    { name: 'ADMINISTRATIVE CHARGE', delay: 110 },
    { name: 'NETWORK COST RECOVERY', delay: 180 },
  ];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,300) scale(${0.85 + 0.15 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FEES &amp; SURCHARGES</text>
            <text x={0} y={56} textAnchor="middle" fill={C.slate} fontSize={32} fontWeight={700} fontFamily="Poppins,sans-serif">scroll down — look for these</text>
          </g>
          {/* magnifier */}
          <g transform="translate(160,690) rotate(-22)" opacity={Math.min(1, head)}>
            <circle cx={0} cy={0} r={85} fill="none" stroke={C.gold} strokeWidth={10} />
            <circle cx={0} cy={0} r={75} fill={C.gold} opacity={0.1} />
            <line x1={60} y1={60} x2={130} y2={130} stroke={C.gold} strokeWidth={18} strokeLinecap="round" />
          </g>
          {/* 3 culprit lines staggered in */}
          {lines.map((ln, i) => {
            const sp = spring({ frame: frame - ln.delay, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
            const op = Math.min(1, sp);
            const yy = 720 + i * 200;
            return (
              <g key={i} transform={`translate(540,${yy}) scale(${0.86 + 0.14 * op})`} opacity={op}>
                <rect x={-440} y={-72} width={880} height={150} rx={20} fill={C.panel} stroke={C.gold} strokeWidth={5} />
                <rect x={-440} y={-72} width={880} height={150} rx={20} fill={C.gold} opacity={0.08} />
                <text x={-410} y={-12} textAnchor="start" fill={C.gold} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{ln.name}</text>
                <text x={-410} y={42} textAnchor="start" fill={C.ivory} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">looks official — set by carrier</text>
                {/* warning chip */}
                <g transform="translate(370,0)">
                  <circle cx={0} cy={0} r={48} fill={C.gold} />
                  <text x={0} y={20} textAnchor="middle" fill={C.ink} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">!</text>
                </g>
              </g>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: NUMBERS — government vs carrier ──────────────────────────────────
function SceneNumbers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = 1;
  const left = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const right = spring({ frame: frame - 40, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  // dollar counter on the right side
  const n = Math.round(interpolate(frame, [70, 150], [5, 15], clamp));
  const glow = interpolate(frame, [70, 130], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,280)`} opacity={head}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WHO SETS THEM?</text>
          </g>
          {/* LEFT — GOVERNMENT (teal/green) */}
          <g transform={`translate(280,1020) scale(${0.86 + 0.14 * Math.min(1, left)})`} opacity={Math.min(1, left)}>
            <rect x={-220} y={-380} width={440} height={760} rx={22} fill="#0d2820" stroke={C.teal} strokeWidth={5} />
            <text x={0} y={-310} textAnchor="middle" fill={C.teal} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">GOVERNMENT</text>
            <text x={0} y={-264} textAnchor="middle" fill={C.slate} fontSize={22} fontWeight={700} fontFamily="Poppins,sans-serif">real taxes</text>
            {/* capitol dome icon */}
            <g transform="translate(0,-100)">
              <rect x={-110} y={60} width={220} height={30} fill={C.teal} />
              <rect x={-100} y={-20} width={200} height={80} fill="#08362b" stroke={C.teal} strokeWidth={4} />
              {[-70,-35,0,35,70].map((cx, i) => (
                <rect key={i} x={cx - 6} y={-20} width={12} height={80} fill={C.teal} opacity={0.85} />
              ))}
              <ellipse cx={0} cy={-20} rx={70} ry={32} fill="#08362b" stroke={C.teal} strokeWidth={4} />
              <rect x={-4} y={-60} width={8} height={28} fill={C.teal} />
              <circle cx={0} cy={-66} r={8} fill={C.teal} />
            </g>
            <text x={0} y={140} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">fixed by law</text>
            {/* check */}
            <g transform="translate(0,250)">
              <circle cx={0} cy={0} r={48} fill={C.teal} opacity={0.18} stroke={C.teal} strokeWidth={4} />
              <polyline points="-18,2 -4,16 18,-12" fill="none" stroke={C.teal} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
          {/* RIGHT — CARRIER (gold, hero) */}
          <g transform={`translate(800,1020) scale(${0.86 + 0.14 * Math.min(1, right)})`} opacity={Math.min(1, right)}>
            <rect x={-220} y={-380} width={440} height={760} rx={22} fill={C.panel} stroke={C.gold} strokeWidth={7} />
            <rect x={-220} y={-380} width={440} height={760} rx={22} fill={C.gold} opacity={0.09 * glow} />
            <text x={0} y={-310} textAnchor="middle" fill={C.gold} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">CARRIER</text>
            <text x={0} y={-264} textAnchor="middle" fill={C.ivory} fontSize={22} fontWeight={700} fontFamily="Poppins,sans-serif">discretionary fees</text>
            {/* phone tower icon */}
            <g transform="translate(0,-100)">
              <rect x={-6} y={-40} width={12} height={140} fill={C.gold} />
              <polygon points="-60,100 60,100 0,-40" fill="none" stroke={C.gold} strokeWidth={6} />
              {/* signal arcs */}
              {[1,2,3].map((k) => (
                <path key={k} d={`M ${-30 - k * 22} ${-50} Q 0 ${-50 - k * 30} ${30 + k * 22} ${-50}`} fill="none" stroke={C.gold} strokeWidth={5} opacity={0.5 + 0.2 * k} />
              ))}
            </g>
            <text x={0} y={140} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">often adds</text>
            {/* dollar counter */}
            <text x={0} y={240} textAnchor="middle" fill={C.gold} fontSize={88} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${n}/mo</text>
            <text x={0} y={292} textAnchor="middle" fill={C.slate} fontSize={22} fontWeight={700} fontFamily="Poppins,sans-serif">$5 — $15 range</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO REVEAL — the stack ──────────────────────────────────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // four stacked bars: plan $65, fee +$3.99, fee +$3.49, fee +$4.25, total =$76.73 (and grow visually to ~$80)
  // counter rolls up
  const total = interpolate(frame, [10, 90], [65.0, 80.03], clamp);
  // each fee bar springs in
  const b0 = 1;
  const b1 = spring({ frame: frame - 18, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const b2 = spring({ frame: frame - 38, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const b3 = spring({ frame: frame - 58, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const totalPop = spring({ frame: frame - 80, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  // alert flash on total
  const flash = frame > 80 && frame < 110 ? interpolate(frame, [80, 95, 110], [0, 0.7, 0], clamp) : 0;
  const bars = [
    { label: 'PLAN', amt: '$65.00', op: b0, fill: C.blue },
    { label: '+ regulatory recovery', amt: '+ $3.99', op: Math.min(1, b1), fill: C.gold },
    { label: '+ admin charge', amt: '+ $3.49', op: Math.min(1, b2), fill: C.gold },
    { label: '+ network cost recovery', amt: '+ $4.25', op: Math.min(1, b3), fill: C.gold },
  ];
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <rect x={0} y={0} width={1080} height={1920} fill={C.gold} opacity={flash * 0.16} />
          <text x={540} y={340} textAnchor="middle" fill={C.ivory} fontSize={58} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">YOUR REAL BILL</text>
          <text x={540} y={388} textAnchor="middle" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">on a $65 plan</text>
          {/* stacked bars */}
          {bars.map((b, i) => {
            const yy = 500 + i * 150;
            return (
              <g key={i} transform={`translate(540,${yy}) scale(${0.86 + 0.14 * b.op})`} opacity={b.op}>
                <rect x={-440} y={-58} width={880} height={120} rx={16} fill={b.fill === C.gold ? '#2b2415' : '#0f1d36'} stroke={b.fill} strokeWidth={i === 0 ? 4 : 5} />
                {b.fill === C.gold && <rect x={-440} y={-58} width={880} height={120} rx={16} fill={C.gold} opacity={0.13} />}
                <text x={-410} y={12} textAnchor="start" fill={b.fill} fontSize={i === 0 ? 44 : 36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{b.label}</text>
                <text x={410} y={20} textAnchor="end" fill={b.fill} fontSize={i === 0 ? 56 : 48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{b.amt}</text>
              </g>
            );
          })}
          {/* total slams in */}
          <g transform={`translate(540,1280) scale(${Math.min(1, totalPop) * 1.04})`} opacity={Math.min(1, totalPop)}>
            <rect x={-360} y={-100} width={720} height={210} rx={24} fill={C.gold} />
            <text x={0} y={-20} textAnchor="middle" fill={C.ink} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={4}>YOU PAY</text>
            <text x={0} y={80} textAnchor="middle" fill={C.ink} fontSize={130} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${total.toFixed(2)}</text>
          </g>
          {/* arrow from plan to total */}
          <g opacity={Math.min(1, totalPop)}>
            <line x1={540} y1={1170} x2={540} y2={1180} stroke={C.gold} strokeWidth={9} />
            <polygon points={`540,1190 524,1162 556,1162`} fill={C.gold} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: APP — phone + AI scan ────────────────────────────────────────────
function SceneApp() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = 1;
  const aiBadge = 1;
  // 3 line items labeled by AI: tax=teal check, fee=gold flag
  const rows = [
    { name: 'federal tax', verdict: 'GOV TAX', ok: true, delay: 24 },
    { name: 'regulatory recovery', verdict: 'CARRIER FEE', ok: false, delay: 64 },
    { name: 'admin charge', verdict: 'CARRIER FEE', ok: false, delay: 104 },
  ];
  const pill = spring({ frame: frame - 160, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const alertOp = spring({ frame: frame - 130, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* phone */}
          <g transform={`translate(540,990) scale(${0.82 + 0.18 * phone})`} opacity={phone}>
            <rect x={-300} y={-560} width={600} height={1100} rx={56} fill="#0e1a30" stroke="#2b3f63" strokeWidth={6} />
            <rect x={-260} y={-500} width={520} height={980} rx={26} fill="#091123" />
            <rect x={-58} y={-500} width={116} height={28} rx={14} fill={C.ink} />
            {/* AI badge */}
            <g transform={`translate(190,-440) scale(${0.6 + 0.4 * aiBadge})`} opacity={aiBadge}>
              <rect x={-50} y={-32} width={100} height={64} rx={16} fill={C.gold} />
              <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">AI</text>
            </g>
            {/* mini bill thumbnail */}
            <g transform="translate(-180,-360) scale(0.85)" opacity={phone}>
              <rect x={-90} y={-110} width={180} height={220} rx={6} fill={C.paper} />
              <rect x={-90} y={-110} width={180} height={32} rx={6} fill={C.panel} />
              <text x={0} y={-88} textAnchor="middle" fill={C.ivory} fontSize={20} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BILL</text>
              {[0,1,2,3,4,5,6].map((i) => (<rect key={i} x={-70} y={-60 + i * 22} width={140} height={8} rx={3} fill="#bcb094" />))}
            </g>
            {/* scan beam from phone */}
            <g opacity={interpolate(frame, [0, 24], [0, 1], clamp)}>
              <rect x={-160} y={-200} width={320} height={6} rx={3} fill={C.gold} opacity={0.85} />
            </g>
            {/* labeled rows */}
            {rows.map((r, i) => {
              const sp = spring({ frame: frame - r.delay, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
              const op = Math.min(1, sp);
              const ry = -60 + i * 130;
              const okCol = C.teal;
              const badCol = C.gold;
              return (
                <g key={i} opacity={op} transform={`translate(0,${ry})`}>
                  <rect x={-240} y={-46} width={480} height={92} rx={14} fill={r.ok ? '#0d2820' : '#2b2415'} stroke={r.ok ? okCol : badCol} strokeWidth={4} />
                  {!r.ok && <rect x={-240} y={-46} width={480} height={92} rx={14} fill={badCol} opacity={0.1} />}
                  <text x={-220} y={-6} textAnchor="start" fill={C.ivory} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">{r.name}</text>
                  <text x={-220} y={28} textAnchor="start" fill={r.ok ? okCol : badCol} fontSize={26} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{r.verdict}</text>
                  {/* icon */}
                  {r.ok ? (
                    <g transform="translate(196,0)">
                      <circle cx={0} cy={0} r={28} fill={okCol} opacity={0.18} stroke={okCol} strokeWidth={3} />
                      <polyline points="-14,2 -4,12 14,-10" fill="none" stroke={okCol} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  ) : (
                    <g transform="translate(196,0)">
                      <polygon points="0,-26 24,18 -24,18" fill={badCol} />
                      <text x={0} y={14} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">!</text>
                    </g>
                  )}
                </g>
              );
            })}
            {/* footer alert */}
            <g opacity={Math.min(1, alertOp)}>
              <rect x={-260} y={420} width={520} height={70} rx={12} fill={C.gold} opacity={0.92} />
              <text x={0} y={464} textAnchor="middle" fill={C.ink} fontSize={28} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">ASK ABOUT FEES</text>
            </g>
          </g>
          {/* bottom pill */}
          <g transform={`translate(540,1660) scale(${0.85 + 0.15 * Math.min(1, pill)})`} opacity={Math.min(1, pill)}>
            <Pill x={0} y={0} w={620} text="TAX OR FEE?" fontSize={56} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — word-by-word ─────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines: [string, boolean, number][] = [
    ['STOP PAYING', false, 100],
    ['FOR THE', false, 100],
    ['DISGUISE.', true, 140],
  ];
  const ws = lines.map((_, k) => k === 0 ? 1 : spring({ frame: frame - 8 - (k - 1) * 18, fps, config: { damping: k === 2 ? 9 : 12, mass: 0.5, stiffness: 220 } }));
  const glow = interpolate(frame, [40, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* gold burst behind the final line */}
          <circle cx={540} cy={1240} r={480 * glow} fill={C.gold} opacity={0.13 * glow} />
          <circle cx={540} cy={1240} r={300 * glow} fill={C.gold} opacity={0.10 * glow} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <g key={i} transform={`translate(540,1240) rotate(${deg})`} opacity={glow * 0.45}>
              <rect x={140} y={-4} width={140 + 60 * glow} height={8} fill={C.gold} />
            </g>
          ))}
          {lines.map((ln, k) => {
            const yy = 800 + k * 220;
            const sc = Math.min(1, ws[k]);
            const opC = Math.min(1, ws[k]);
            return (
              <g key={k} transform={`translate(540,${yy}) scale(${0.86 + 0.14 * sc})`} opacity={opC}>
                <text x={0} y={0} textAnchor="middle" fontSize={ln[2]} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" fill={ln[1] ? C.gold : '#fff'}>{ln[0]}</text>
              </g>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ───────────────────────────────────────────────────────────────────────
export const Phonebill: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('phonebill_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* baked scene-matched SFX */}
      <Sequence from={S.hook + 20}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.hook + 52}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.setup + 8}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 44}><Audio src={staticFile('sfx_plip.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 114}><Audio src={staticFile('sfx_plip.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 184}><Audio src={staticFile('sfx_plip.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 230}><Audio src={staticFile('sfx_chime.wav')} volume={0.38} /></Sequence>

      <Sequence from={S.numbers + 4}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.numbers + 44}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.45} /></Sequence>
      <Sequence from={S.numbers + 80} durationInFrames={70}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.numbers + 150}><Audio src={staticFile('sfx_chime.wav')} volume={0.46} /></Sequence>

      <Sequence from={S.hero + 18}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.hero + 38}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.hero + 58}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.hero + 80}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.hero + 82}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.55} /></Sequence>

      <Sequence from={S.app + 14}><Audio src={staticFile('sfx_click.wav')} volume={0.44} /></Sequence>
      <Sequence from={S.app + 28}><Audio src={staticFile('sfx_success.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.app + 68}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.34} /></Sequence>
      <Sequence from={S.app + 108}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.34} /></Sequence>
      <Sequence from={S.app + 160}><Audio src={staticFile('sfx_glass.wav')} volume={0.46} /></Sequence>

      <Sequence from={S.payoff + 6}><Audio src={staticFile('sfx_smack.wav')} volume={0.46} /></Sequence>
      <Sequence from={S.payoff + 26}><Audio src={staticFile('sfx_smack.wav')} volume={0.46} /></Sequence>
      <Sequence from={S.payoff + 44}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.55} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.setup - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.setup} durationInFrames={S.numbers - S.setup}><SceneSetup /></Sequence>
      <Sequence from={S.numbers} durationInFrames={S.hero - S.numbers}><SceneNumbers /></Sequence>
      <Sequence from={S.hero} durationInFrames={S.app - S.hero}><SceneHero /></Sequence>
      <Sequence from={S.app} durationInFrames={S.payoff - S.app}><SceneApp /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

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
import debttrapWords from './debttrap_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 875;

const C = {
  bg: '#0b1220',
  panel: '#13233e',
  card: '#0e1a30',
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

// sentence-boundary frames from debttrap_words.json (@30fps)
// hook: ...decades? @ f110 | setup: ...amount. @ f279 | numbers: ...month. @ f498
// hero: ...clear. @ f655 | fix: ...11. @ f816 | payoff: ...minimum. @ f865
const S = { hook: 0, setup: 110, numbers: 279, hero: 498, fix: 655, payoff: 816 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ── CAPTIONS (root, 3-word karaoke pages) ────────────────────────────────────
const WRAW: { w: string; s: number }[] = (debttrapWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ─── SCENE 1: HOOK — calendar showing 28 years ────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // hero: a wall calendar with a "28 YEARS" gold banner; gold "?" badge above
  const cardPop = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const badge = spring({ frame: frame - 18, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const yearsCount = Math.round(interpolate(frame, [22, 80], [1, 28], clamp));
  const ringOp = interpolate(frame, [12, 32], [0, 1], clamp);
  const ringPulse = 0.55 + 0.45 * Math.sin(frame * 0.18);
  // chains around the calendar tighten
  const chainOp = interpolate(frame, [38, 70], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* HEADER */}
          <g transform="translate(540,330)" opacity={Math.min(1, cardPop)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$1,000 DEBT</text>
            <text x={0} y={56} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">pay only the minimum</text>
          </g>

          {/* CALENDAR CARD — anchored on screen from f0 */}
          <g transform={`translate(540,1100) scale(${0.86 + 0.14 * Math.min(1, cardPop)})`} opacity={Math.min(1, cardPop)}>
            {/* shadow */}
            <rect x={-340} y={-460} width={680} height={920} rx={26} fill="#000" opacity={0.45} transform="translate(14,18)" />
            {/* card body */}
            <rect x={-340} y={-460} width={680} height={920} rx={26} fill={C.ivory} stroke={C.gold} strokeWidth={6} />
            {/* header band */}
            <rect x={-340} y={-460} width={680} height={140} fill={C.panel} />
            <text x={0} y={-372} textAnchor="middle" fill={C.gold} fontSize={50} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PAYOFF CALENDAR</text>
            {/* big YEARS counter */}
            <text x={0} y={-160} textAnchor="middle" fill={C.red} fontSize={280} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{yearsCount}</text>
            <text x={0} y={-60} textAnchor="middle" fill={C.ink} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">YEARS</text>
            {/* mini month grid */}
            {Array.from({ length: 28 }).map((_, i) => {
              const col = i % 7, row = Math.floor(i / 7);
              const cx = -260 + col * 75, cy = 30 + row * 90;
              const filled = i < yearsCount;
              return (
                <g key={i}>
                  <rect x={cx} y={cy} width={64} height={70} rx={6} fill={filled ? C.red : '#dcd3b6'} opacity={filled ? 0.85 : 1} stroke={C.ink} strokeWidth={2} />
                  {filled && <text x={cx + 32} y={cy + 48} textAnchor="middle" fill="#fff" fontSize={28} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">X</text>}
                </g>
              );
            })}
          </g>

          {/* dashed pulsing ring around the years number */}
          <g opacity={ringOp}>
            <rect x={310} y={830} width={460} height={210} rx={20} fill="none" stroke={C.gold} strokeWidth={8} strokeDasharray="20 14" opacity={ringPulse} />
          </g>

          {/* gold "?" badge top */}
          <g transform={`translate(540,${165}) scale(${0.7 + 0.3 * Math.min(1, badge)})`} opacity={Math.min(1, badge)}>
            <circle cx={0} cy={0} r={86} fill={C.gold} />
            <text x={0} y={30} textAnchor="middle" fill={C.ink} fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>

          {/* chains tightening — two diagonal lines */}
          <g opacity={chainOp}>
            {[0, 1].map((side) => {
              const sx = side === 0 ? 90 : 990;
              const sy = side === 0 ? 1700 : 1700;
              const ex = 540, ey = 1430;
              return (
                <g key={side}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={C.gold} strokeWidth={14} strokeLinecap="round" opacity={0.7} />
                  {[0, 0.18, 0.36, 0.54, 0.72, 0.9].map((t, k) => {
                    const px = sx + (ex - sx) * t, py = sy + (ey - sy) * t;
                    return <ellipse key={k} cx={px} cy={py} rx={18} ry={12} fill="none" stroke={C.gold} strokeWidth={5} />;
                  })}
                </g>
              );
            })}
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SETUP — minimum payment formula (2% of balance) ─────────────────
function SceneSetup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const card1 = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const card2 = spring({ frame: frame - 90, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const xPop = spring({ frame: frame - 120, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  const chk = spring({ frame: frame - 140, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,280) scale(${0.85 + 0.15 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">HOW IT'S CALCULATED</text>
            <text x={0} y={56} textAnchor="middle" fill={C.slate} fontSize={32} fontWeight={700} fontFamily="Poppins,sans-serif">two ways your bank could do it</text>
          </g>

          {/* CARD 1 — % of balance (the trap) */}
          <g transform={`translate(540,720) scale(${0.86 + 0.14 * Math.min(1, card1)})`} opacity={Math.min(1, card1)}>
            <rect x={-440} y={-130} width={880} height={260} rx={22} fill={C.card} stroke={C.gold} strokeWidth={6} />
            <rect x={-440} y={-130} width={880} height={260} rx={22} fill={C.gold} opacity={0.1} />
            <text x={-410} y={-66} textAnchor="start" fill={C.gold} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WHAT BANKS DO</text>
            <text x={-410} y={-12} textAnchor="start" fill={C.ivory} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">~ 2% of balance</text>
            <text x={-410} y={48} textAnchor="start" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">shrinks as you pay → endless tail</text>
            {/* red X */}
            <g transform={`translate(360,0) scale(${Math.min(1, xPop)})`} opacity={Math.min(1, xPop)}>
              <circle cx={0} cy={0} r={58} fill={C.red} />
              <line x1={-22} y1={-22} x2={22} y2={22} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
              <line x1={22} y1={-22} x2={-22} y2={22} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
            </g>
          </g>

          {/* CARD 2 — flat dollar (the fix) */}
          <g transform={`translate(540,1060) scale(${0.86 + 0.14 * Math.min(1, card2)})`} opacity={Math.min(1, card2)}>
            <rect x={-440} y={-130} width={880} height={260} rx={22} fill={C.card} stroke={C.green} strokeWidth={6} />
            <rect x={-440} y={-130} width={880} height={260} rx={22} fill={C.green} opacity={0.08} />
            <text x={-410} y={-66} textAnchor="start" fill={C.green} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WHAT WORKS</text>
            <text x={-410} y={-12} textAnchor="start" fill={C.ivory} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">flat dollar amount</text>
            <text x={-410} y={48} textAnchor="start" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">same every month → real progress</text>
            {/* green check */}
            <g transform={`translate(360,0) scale(${Math.min(1, chk)})`} opacity={Math.min(1, chk)}>
              <circle cx={0} cy={0} r={58} fill={C.green} />
              <polyline points="-22,2 -6,18 22,-16" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>

          {/* sub-pill */}
          <g transform="translate(540,1380)" opacity={Math.min(1, head)}>
            <Pill x={0} y={0} w={700} text="TINY → INTEREST WINS" fontSize={46} fill={C.gold} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: NUMBERS — $1000 @ 22% APR, $25 min → $3 to principal ────────────
function SceneNumbers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = 1;
  const dollar = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const apr = spring({ frame: frame - 50, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const pie = spring({ frame: frame - 110, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  // pie split: $25 min → $22 interest (red) + $3 principal (green)
  const sliceProg = interpolate(frame, [130, 200], [0, 1], clamp);
  const pAmt = Math.round(interpolate(frame, [180, 220], [0, 3], clamp));
  const iAmt = Math.round(interpolate(frame, [130, 180], [0, 22], clamp));

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform="translate(540,250)" opacity={head}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WHERE YOUR $25 GOES</text>
          </g>

          {/* LEFT — $1000 balance */}
          <g transform={`translate(280,580) scale(${0.86 + 0.14 * Math.min(1, dollar)})`} opacity={Math.min(1, dollar)}>
            <rect x={-200} y={-120} width={400} height={240} rx={20} fill={C.card} stroke={C.gold} strokeWidth={5} />
            <text x={0} y={-50} textAnchor="middle" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">balance</text>
            <text x={0} y={50} textAnchor="middle" fill={C.gold} fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$1,000</text>
          </g>

          {/* RIGHT — 22% APR */}
          <g transform={`translate(800,580) scale(${0.86 + 0.14 * Math.min(1, apr)})`} opacity={Math.min(1, apr)}>
            <rect x={-200} y={-120} width={400} height={240} rx={20} fill={C.card} stroke={C.red} strokeWidth={5} />
            <text x={0} y={-50} textAnchor="middle" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">APR</text>
            <text x={0} y={50} textAnchor="middle" fill={C.red} fontSize={92} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">22%</text>
          </g>

          {/* PIE — $25 minimum payment split */}
          <g transform={`translate(540,1180) scale(${0.86 + 0.14 * Math.min(1, pie)})`} opacity={Math.min(1, pie)}>
            <text x={0} y={-300} textAnchor="middle" fill={C.ivory} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$25 MIN PAYMENT</text>
            {/* full red circle (interest), then green wedge sweeps in for principal */}
            <circle cx={0} cy={0} r={200} fill={C.red} />
            {/* principal wedge — small ~12% slice (3/25) */}
            {(() => {
              const sweepDeg = 360 * (3 / 25) * sliceProg;
              const r = 200;
              const a0 = -90 * (Math.PI / 180);
              const a1 = (-90 + sweepDeg) * (Math.PI / 180);
              const x1 = r * Math.cos(a0), y1 = r * Math.sin(a0);
              const x2 = r * Math.cos(a1), y2 = r * Math.sin(a1);
              const large = sweepDeg > 180 ? 1 : 0;
              const d = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
              return <path d={d} fill={C.green} />;
            })()}
            {/* legend */}
            <g transform="translate(-380,260)">
              <rect x={-10} y={-10} width={30} height={30} fill={C.red} />
              <text x={36} y={16} fill={C.ivory} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">INTEREST: ${iAmt}</text>
            </g>
            <g transform="translate(-380,320)">
              <rect x={-10} y={-10} width={30} height={30} fill={C.green} />
              <text x={36} y={16} fill={C.ivory} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PRINCIPAL: ${pAmt}</text>
            </g>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO REVEAL — 28 YEARS to clear ─────────────────────────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // counter rolls up from 1 → 28 years; principal bar grows tiny over time
  const yrs = Math.round(interpolate(frame, [4, 80], [1, 28], clamp));
  const headPop = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  // total paid counter rolls up
  const totalPaid = Math.round(interpolate(frame, [12, 90], [1000, 2434], clamp));
  // big number pop
  const reveal = spring({ frame: frame - 70, fps, config: { damping: 9, mass: 0.5, stiffness: 200 } });
  const flash = frame > 70 && frame < 110 ? interpolate(frame, [70, 88, 110], [0, 0.7, 0], clamp) : 0;
  // skyline of debt years
  const skylineOp = interpolate(frame, [10, 50], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <rect x={0} y={0} width={1080} height={1920} fill={C.red} opacity={flash * 0.18} />

          {/* header */}
          <g transform={`translate(540,290) scale(${0.86 + 0.14 * Math.min(1, headPop)})`} opacity={Math.min(1, headPop)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$1,000 → MINIMUM ONLY</text>
            <text x={0} y={52} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">22% APR, 2% min, source: CFPB</text>
          </g>

          {/* skyline of 28 year bars (rising) */}
          <g opacity={skylineOp}>
            {Array.from({ length: 28 }).map((_, i) => {
              const x = 80 + i * 33;
              const h = 60 + i * 18;
              const y = 1000 - h;
              const lit = i < yrs;
              return <rect key={i} x={x} y={y} width={26} height={h} rx={4} fill={lit ? C.red : '#1c2945'} stroke={lit ? '#ffb0aa' : '#22325a'} strokeWidth={2} />;
            })}
          </g>

          {/* GIANT YEARS COUNTER — the hero reveal */}
          <g transform={`translate(540,1280) scale(${0.86 + 0.20 * Math.min(1, reveal)})`} opacity={Math.min(1, reveal)}>
            <rect x={-440} y={-220} width={880} height={440} rx={28} fill={C.gold} />
            <text x={0} y={-100} textAnchor="middle" fill={C.ink} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={4}>TIME TO CLEAR</text>
            <text x={0} y={100} textAnchor="middle" fill={C.ink} fontSize={260} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{yrs} YRS</text>
            <text x={0} y={180} textAnchor="middle" fill={C.ink} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">total paid: ${totalPaid.toLocaleString()}</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: FIX — flat $100/mo → 11 months ──────────────────────────────────
function SceneFix() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const calc = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  // months counter rolls DOWN from 336 (28yrs) → 11
  const months = Math.round(interpolate(frame, [20, 100], [336, 11], clamp));
  // before/after bars: 28 yrs vs 11 mo
  const beforeOp = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const afterOp = spring({ frame: frame - 80, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const stampPop = spring({ frame: frame - 130, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  const beforeW = 700;
  const afterW = interpolate(frame, [80, 130], [40, 110], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,260) scale(${0.86 + 0.14 * Math.min(1, calc)})`} opacity={Math.min(1, calc)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={60} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PAY A FLAT $100/MO</text>
            <text x={0} y={52} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">same balance, same APR — just steady</text>
          </g>

          {/* BEFORE — 28 yrs in red */}
          <g transform="translate(540,720)" opacity={Math.min(1, beforeOp)}>
            <text x={-440} y={-30} textAnchor="start" fill={C.red} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MINIMUM ONLY</text>
            <text x={440} y={-30} textAnchor="end" fill={C.red} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">28 YRS</text>
            <rect x={-440} y={0} width={beforeW * Math.min(1, beforeOp) + 180} height={70} rx={14} fill={C.red} />
            <rect x={-440} y={0} width={880} height={70} rx={14} fill="none" stroke={C.red} strokeWidth={5} opacity={0.4} />
          </g>

          {/* AFTER — 11 months in green */}
          <g transform="translate(540,920)" opacity={Math.min(1, afterOp)}>
            <text x={-440} y={-30} textAnchor="start" fill={C.green} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FLAT $100/MO</text>
            <text x={440} y={-30} textAnchor="end" fill={C.green} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">11 MO</text>
            <rect x={-440} y={0} width={afterW} height={70} rx={14} fill={C.green} />
            <rect x={-440} y={0} width={880} height={70} rx={14} fill="none" stroke={C.green} strokeWidth={5} opacity={0.4} />
          </g>

          {/* calculator card showing months ticker */}
          <g transform={`translate(540,1280) scale(${0.86 + 0.14 * Math.min(1, calc)})`} opacity={Math.min(1, calc)}>
            <rect x={-380} y={-150} width={760} height={300} rx={24} fill={C.card} stroke={C.green} strokeWidth={6} />
            <rect x={-380} y={-150} width={760} height={300} rx={24} fill={C.green} opacity={0.08} />
            <text x={0} y={-70} textAnchor="middle" fill={C.slate} fontSize={32} fontWeight={700} fontFamily="Poppins,sans-serif">payoff in</text>
            <text x={0} y={60} textAnchor="middle" fill={C.green} fontSize={170} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{months} MO</text>
          </g>

          {/* GREEN STAMP */}
          <g transform={`translate(820,1280) rotate(-12) scale(${0.6 + 0.4 * Math.min(1, stampPop)})`} opacity={Math.min(1, stampPop)}>
            <rect x={-120} y={-50} width={240} height={100} rx={6} fill="none" stroke={C.green} strokeWidth={8} />
            <text x={0} y={20} textAnchor="middle" fill={C.green} fontSize={48} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FREE</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — word-by-word "STOP / PAYING THE / MINIMUM." ────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines: [string, boolean, number][] = [
    ['STOP', false, 180],
    ['PAYING THE', false, 110],
    ['MINIMUM.', true, 170],
  ];
  const ws = lines.map((_, k) => k === 0 ? 1 : spring({ frame: frame - 8 - (k - 1) * 14, fps, config: { damping: k === 2 ? 9 : 12, mass: 0.5, stiffness: 220 } }));
  const glow = interpolate(frame, [40, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* gold burst behind the final line */}
          <circle cx={540} cy={1240} r={500 * glow} fill={C.gold} opacity={0.14 * glow} />
          <circle cx={540} cy={1240} r={320 * glow} fill={C.gold} opacity={0.10 * glow} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <g key={i} transform={`translate(540,1240) rotate(${deg})`} opacity={glow * 0.45}>
              <rect x={140} y={-4} width={140 + 60 * glow} height={8} fill={C.gold} />
            </g>
          ))}
          {lines.map((ln, k) => {
            const yy = 820 + k * 220;
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
export const Debttrap: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('debttrap_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* baked scene-matched SFX — varied per scene */}
      <Sequence from={S.hook + 18}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} /></Sequence>
      <Sequence from={S.hook + 70}><Audio src={staticFile('sfx_digital.wav')} volume={0.35} /></Sequence>

      <Sequence from={S.setup + 8}><Audio src={staticFile('sfx_click.wav')} volume={0.44} /></Sequence>
      <Sequence from={S.setup + 120}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.setup + 140}><Audio src={staticFile('sfx_success.wav')} volume={0.42} /></Sequence>

      <Sequence from={S.numbers + 4}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.numbers + 50}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.numbers + 110}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.45} /></Sequence>
      <Sequence from={S.numbers + 180} durationInFrames={45}><Audio src={staticFile('sfx_digital.wav')} volume={0.34} /></Sequence>

      <Sequence from={S.hero + 4} durationInFrames={75}><Audio src={staticFile('sfx_digital.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.hero + 70}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.hero + 72}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.55} /></Sequence>

      <Sequence from={S.fix + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.fix + 80}><Audio src={staticFile('sfx_chime.wav')} volume={0.46} /></Sequence>
      <Sequence from={S.fix + 130}><Audio src={staticFile('sfx_success.wav')} volume={0.5} /></Sequence>

      <Sequence from={S.payoff + 6}><Audio src={staticFile('sfx_smack.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.payoff + 22}><Audio src={staticFile('sfx_smack.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.payoff + 40}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.58} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.setup - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.setup} durationInFrames={S.numbers - S.setup}><SceneSetup /></Sequence>
      <Sequence from={S.numbers} durationInFrames={S.hero - S.numbers}><SceneNumbers /></Sequence>
      <Sequence from={S.hero} durationInFrames={S.fix - S.hero}><SceneHero /></Sequence>
      <Sequence from={S.fix} durationInFrames={S.payoff - S.fix}><SceneFix /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

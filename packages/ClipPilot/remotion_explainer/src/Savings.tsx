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
import savingsWords from './savings_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1192;

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

// scene boundaries from savings_words.json (@30fps)
// hook ...day? @ f145 | setup ...$100 @ f333 | numbers ...4 @ f585
// hero ...value @ f847 | fix ...instead @ f1032 | payoff ...bank @ f1192
const S = { hook: 0, setup: 145, numbers: 333, hero: 585, fix: 847, payoff: 1032 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ── CAPTIONS (root, 3-word karaoke pages) ────────────────────────────────────
const WRAW: { w: string; s: number }[] = (savingsWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ─── SCENE 1: HOOK — piggy bank with money leaking out ─────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headPop = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const pigPop = spring({ frame: frame - 12, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const badge = spring({ frame: frame - 28, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  // coins drop out of pig over time
  const coinsPhase = frame - 40;
  const ringOp = interpolate(frame, [55, 90], [0, 1], clamp);
  const ringPulse = 0.55 + 0.45 * Math.sin(frame * 0.18);
  // savings shrinks: $10,000 → $9,987
  const bal = Math.round(interpolate(frame, [40, 130], [10000, 9987], clamp));

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* HEADER */}
          <g transform={`translate(540,340) scale(${0.86 + 0.14 * Math.min(1, headPop)})`} opacity={Math.min(1, headPop)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={68} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">YOUR SAVINGS</text>
            <text x={0} y={62} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">…is quietly leaking</text>
          </g>

          {/* PIGGY BANK — pink silhouette with slot */}
          <g transform={`translate(540,1060) scale(${0.86 + 0.20 * Math.min(1, pigPop)})`} opacity={Math.min(1, pigPop)}>
            {/* body */}
            <ellipse cx={0} cy={0} rx={320} ry={220} fill="#FFB4BF" stroke={C.ink} strokeWidth={6} />
            {/* snout */}
            <ellipse cx={230} cy={-30} rx={95} ry={80} fill="#FFA0AD" stroke={C.ink} strokeWidth={6} />
            <ellipse cx={260} cy={-45} rx={12} ry={16} fill={C.ink} />
            <ellipse cx={220} cy={-15} rx={12} ry={16} fill={C.ink} />
            {/* eye */}
            <circle cx={70} cy={-70} r={20} fill="#fff" />
            <circle cx={70} cy={-70} r={11} fill={C.ink} />
            {/* ear */}
            <path d={`M -110 -180 L -60 -220 L -50 -140 Z`} fill="#FFA0AD" stroke={C.ink} strokeWidth={5} />
            {/* legs */}
            <rect x={-220} y={180} width={70} height={90} rx={10} fill="#FFA0AD" stroke={C.ink} strokeWidth={5} />
            <rect x={-90} y={180} width={70} height={90} rx={10} fill="#FFA0AD" stroke={C.ink} strokeWidth={5} />
            <rect x={40} y={180} width={70} height={90} rx={10} fill="#FFA0AD" stroke={C.ink} strokeWidth={5} />
            <rect x={170} y={180} width={70} height={90} rx={10} fill="#FFA0AD" stroke={C.ink} strokeWidth={5} />
            {/* slot on top */}
            <rect x={-60} y={-225} width={120} height={20} rx={6} fill={C.ink} />
            {/* tail curl */}
            <path d="M -320 -20 q -30 -30 0 -60 q 30 -30 0 -60" stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" />
            {/* balance label on belly */}
            <text x={-30} y={40} textAnchor="middle" fill={C.ink} fontSize={68} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${bal.toLocaleString()}</text>
            <text x={-30} y={90} textAnchor="middle" fill={C.ink} fontSize={26} fontWeight={700} fontFamily="Poppins,sans-serif">real value</text>
          </g>

          {/* leaking coins under piggy */}
          <g>
            {[0, 1, 2, 3, 4].map((i) => {
              const t0 = 40 + i * 12;
              const p = coinsPhase - i * 12;
              if (p < 0) return null;
              const yy = 1240 + Math.min(500, p * 8);
              const opC = interpolate(p, [0, 8, 60], [0, 1, 0.9], clamp);
              const xx = 380 + i * 80 + Math.sin((p + i * 6) * 0.2) * 15;
              return (
                <g key={i} transform={`translate(${xx},${yy})`} opacity={opC}>
                  <circle cx={0} cy={0} r={26} fill={C.gold} stroke={C.ink} strokeWidth={4} />
                  <text x={0} y={9} textAnchor="middle" fill={C.ink} fontSize={26} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$</text>
                </g>
              );
            })}
          </g>

          {/* dashed pulsing ring around the piggy */}
          <g opacity={ringOp}>
            <ellipse cx={540} cy={1060} rx={380} ry={280} fill="none" stroke={C.gold} strokeWidth={8} strokeDasharray="20 14" opacity={ringPulse} />
          </g>

          {/* gold "?" badge top */}
          <g transform={`translate(540,${175}) scale(${0.7 + 0.3 * Math.min(1, badge)})`} opacity={Math.min(1, badge)}>
            <circle cx={0} cy={0} r={86} fill={C.gold} />
            <text x={0} y={30} textAnchor="middle" fill={C.ink} fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SETUP — big bank 0.01% APY card ────────────────────────────────
function SceneSetup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const card = spring({ frame: frame - 22, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const rateTick = Math.min(1, Math.max(0, (frame - 42) / 20));
  const stampPop = spring({ frame: frame - 110, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  const arrow = spring({ frame: frame - 130, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  // dollars digit: 1 cent per $100 = $0.01 / year
  const cents = Math.round(interpolate(frame, [140, 175], [0, 1], clamp));

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,290) scale(${0.86 + 0.14 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">WHAT YOUR BIG BANK PAYS</text>
          </g>

          {/* big card: bank facade */}
          <g transform={`translate(540,820) scale(${0.86 + 0.14 * Math.min(1, card)})`} opacity={Math.min(1, card)}>
            {/* shadow */}
            <rect x={-380} y={-260} width={760} height={520} rx={26} fill="#000" opacity={0.4} transform="translate(12,16)" />
            {/* body */}
            <rect x={-380} y={-260} width={760} height={520} rx={26} fill={C.card} stroke={C.red} strokeWidth={6} />
            {/* bank facade — 4 columns */}
            <g opacity={0.5}>
              <rect x={-320} y={-230} width={640} height={40} fill={C.slate} />
              {[-260, -130, 0, 130, 260].map((cx, i) => (
                <rect key={i} x={cx - 22} y={-190} width={44} height={200} fill={C.slate} opacity={0.35} />
              ))}
              <rect x={-320} y={10} width={640} height={22} fill={C.slate} opacity={0.5} />
            </g>
            {/* label */}
            <text x={0} y={-170} textAnchor="middle" fill={C.ivory} fontSize={34} fontWeight={800} fontFamily="Poppins,sans-serif">APY at your BIG BANK</text>
            {/* giant rate */}
            <text x={0} y={110} textAnchor="middle" fill={C.red} fontSize={220} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
              {(0.01 * rateTick).toFixed(2)}%
            </text>
            {/* sub-caption below */}
            <text x={0} y={210} textAnchor="middle" fill={C.slate} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">standard savings rate</text>
          </g>

          {/* arrow + $100 → 1¢/year */}
          <g transform={`translate(540,1360) scale(${0.86 + 0.14 * Math.min(1, arrow)})`} opacity={Math.min(1, arrow)}>
            {/* $100 pill */}
            <g transform="translate(-260,0)">
              <rect x={-130} y={-60} width={260} height={120} rx={20} fill={C.card} stroke={C.gold} strokeWidth={5} />
              <text x={0} y={20} textAnchor="middle" fill={C.gold} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$100</text>
            </g>
            {/* arrow */}
            <g>
              <line x1={-110} y1={0} x2={110} y2={0} stroke={C.slate} strokeWidth={8} strokeLinecap="round" />
              <polygon points="120,0 90,-18 90,18" fill={C.slate} />
            </g>
            {/* result pill */}
            <g transform="translate(260,0)">
              <rect x={-130} y={-60} width={260} height={120} rx={20} fill={C.card} stroke={C.red} strokeWidth={5} />
              <text x={0} y={20} textAnchor="middle" fill={C.red} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${(cents / 100).toFixed(2)}/yr</text>
            </g>
          </g>

          {/* red PENNIES stamp */}
          <g transform={`translate(830,820) rotate(-14) scale(${0.6 + 0.4 * Math.min(1, stampPop)})`} opacity={Math.min(1, stampPop)}>
            <rect x={-130} y={-52} width={260} height={104} rx={6} fill="none" stroke={C.red} strokeWidth={8} />
            <text x={0} y={24} textAnchor="middle" fill={C.red} fontSize={54} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PENNIES</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: NUMBERS — inflation 3% vs HYSA 4% gauge/race ────────────────────
function SceneNumbers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const infl = spring({ frame: frame - 26, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const hysa = spring({ frame: frame - 80, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const gapPop = spring({ frame: frame - 160, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });

  // bars: inflation (red) grows to ~60% width; hysa (green) grows to ~80% width
  const inflW = interpolate(frame, [26, 100], [0, 640], clamp) * 0.6;
  const hysaW = interpolate(frame, [80, 160], [0, 640], clamp) * 0.8;
  const inflVal = interpolate(frame, [26, 100], [0, 3], clamp);
  const hysaVal = interpolate(frame, [80, 160], [0, 4], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,290) scale(${0.86 + 0.14 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">THE RATE RACE</text>
            <text x={0} y={54} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">how far behind you actually are</text>
          </g>

          {/* INFLATION BAR — red */}
          <g transform="translate(540,680)" opacity={Math.min(1, infl)}>
            <text x={-380} y={-30} textAnchor="start" fill={C.red} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">INFLATION</text>
            <text x={380} y={-30} textAnchor="end" fill={C.red} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">~{inflVal.toFixed(1)}%</text>
            <rect x={-380} y={0} width={inflW} height={90} rx={16} fill={C.red} />
            <rect x={-380} y={0} width={760} height={90} rx={16} fill="none" stroke={C.red} strokeWidth={5} opacity={0.35} />
          </g>

          {/* BIG BANK bar — barely visible */}
          <g transform="translate(540,860)" opacity={Math.min(1, infl)}>
            <text x={-380} y={-30} textAnchor="start" fill={C.slate} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BIG BANK</text>
            <text x={380} y={-30} textAnchor="end" fill={C.slate} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">0.01%</text>
            <rect x={-380} y={0} width={6} height={90} rx={2} fill={C.slate} />
            <rect x={-380} y={0} width={760} height={90} rx={16} fill="none" stroke={C.slate} strokeWidth={5} opacity={0.35} />
          </g>

          {/* HYSA BAR — green */}
          <g transform="translate(540,1040)" opacity={Math.min(1, hysa)}>
            <text x={-380} y={-30} textAnchor="start" fill={C.green} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">HIGH YIELD</text>
            <text x={380} y={-30} textAnchor="end" fill={C.green} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">~{hysaVal.toFixed(1)}%</text>
            <rect x={-380} y={0} width={hysaW} height={90} rx={16} fill={C.green} />
            <rect x={-380} y={0} width={760} height={90} rx={16} fill="none" stroke={C.green} strokeWidth={5} opacity={0.35} />
          </g>

          {/* GAP PILL */}
          <g transform={`translate(540,1360) scale(${0.86 + 0.14 * Math.min(1, gapPop)})`} opacity={Math.min(1, gapPop)}>
            <rect x={-380} y={-70} width={760} height={140} rx={70} fill={C.gold} />
            <text x={0} y={-8} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={2}>400× BIGGER</text>
            <text x={0} y={44} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={800} fontFamily="Poppins,sans-serif">4% vs 0.01% APY</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO — $10,000 for 5 years: -$1,300 (real) big bank ────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headPop = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  // counter rolls down from 10000 → 8630 (real value in big bank)
  const realBal = Math.round(interpolate(frame, [10, 130], [10000, 8630], clamp));
  const loss = Math.round(interpolate(frame, [30, 140], [0, 1370], clamp));
  // giant reveal pop
  const reveal = spring({ frame: frame - 140, fps, config: { damping: 9, mass: 0.5, stiffness: 200 } });
  const flash = frame > 140 && frame < 180 ? interpolate(frame, [140, 158, 180], [0, 0.7, 0], clamp) : 0;

  // eroding bars over 5 years
  const yearsRevealed = interpolate(frame, [10, 110], [0, 5], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <rect x={0} y={0} width={1080} height={1920} fill={C.red} opacity={flash * 0.18} />

          {/* header */}
          <g transform={`translate(540,270) scale(${0.86 + 0.14 * Math.min(1, headPop)})`} opacity={Math.min(1, headPop)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$10,000 · 5 YEARS · BIG BANK</text>
            <text x={0} y={54} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">real purchasing power over time</text>
          </g>

          {/* 5-year eroding bars */}
          <g opacity={Math.min(1, headPop)}>
            {Array.from({ length: 5 }).map((_, i) => {
              const x = 130 + i * 180;
              const yr = i + 1;
              const done = yearsRevealed >= yr - 0.4;
              const rem = Math.max(0, 10000 * Math.pow(1 / 1.03, yr));
              const h = Math.max(30, (rem / 10000) * 300);
              const y = 900 - h;
              return (
                <g key={i} opacity={done ? 1 : 0.15}>
                  <rect x={x - 60} y={y} width={120} height={h} rx={8} fill={C.red} stroke="#ffb0aa" strokeWidth={3} />
                  <text x={x} y={950} textAnchor="middle" fill={C.slate} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">Y{yr}</text>
                  <text x={x} y={y - 12} textAnchor="middle" fill={C.ivory} fontSize={22} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${Math.round(rem).toLocaleString()}</text>
                </g>
              );
            })}
          </g>

          {/* GIANT REVEAL — real balance vs loss */}
          <g transform={`translate(540,1300) scale(${0.86 + 0.20 * Math.min(1, reveal)})`} opacity={Math.min(1, reveal)}>
            <rect x={-440} y={-220} width={880} height={440} rx={28} fill={C.gold} />
            <text x={0} y={-130} textAnchor="middle" fill={C.ink} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={3}>REAL VALUE LOST</text>
            <text x={0} y={70} textAnchor="middle" fill={C.red} fontSize={230} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">-${loss.toLocaleString()}</text>
            <text x={0} y={160} textAnchor="middle" fill={C.ink} fontSize={38} fontWeight={800} fontFamily="Poppins,sans-serif">balance still says ${realBal.toLocaleString()}*</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: FIX — move to HYSA, +$2,167 gain in 5 years ─────────────────────
function SceneFix() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame: frame - 0, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const beforeOp = spring({ frame: frame - 22, fps, config: { damping: 14, mass: 0.5, stiffness: 220 } });
  const afterOp = spring({ frame: frame - 70, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  const stampPop = spring({ frame: frame - 130, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  const gain = Math.round(interpolate(frame, [70, 150], [0, 2167], clamp));
  const beforeW = interpolate(frame, [22, 60], [30, 60], clamp);
  const afterW = interpolate(frame, [70, 140], [30, 720], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* header */}
          <g transform={`translate(540,290) scale(${0.86 + 0.14 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MOVE IT → HIGH YIELD</text>
            <text x={0} y={54} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">same $10k · same 5 years · ~4% APY</text>
          </g>

          {/* BEFORE bar (big bank) */}
          <g transform="translate(540,700)" opacity={Math.min(1, beforeOp)}>
            <text x={-380} y={-30} textAnchor="start" fill={C.red} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BIG BANK 5Y</text>
            <text x={380} y={-30} textAnchor="end" fill={C.red} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">+$5</text>
            <rect x={-380} y={0} width={beforeW} height={80} rx={14} fill={C.red} />
            <rect x={-380} y={0} width={760} height={80} rx={14} fill="none" stroke={C.red} strokeWidth={5} opacity={0.35} />
          </g>

          {/* AFTER bar (HYSA) */}
          <g transform="translate(540,880)" opacity={Math.min(1, afterOp)}>
            <text x={-380} y={-30} textAnchor="start" fill={C.green} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">HIGH YIELD 5Y</text>
            <text x={380} y={-30} textAnchor="end" fill={C.green} fontSize={38} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">+${gain.toLocaleString()}</text>
            <rect x={-380} y={0} width={afterW} height={80} rx={14} fill={C.green} />
            <rect x={-380} y={0} width={760} height={80} rx={14} fill="none" stroke={C.green} strokeWidth={5} opacity={0.35} />
          </g>

          {/* GAIN CARD */}
          <g transform={`translate(540,1250) scale(${0.86 + 0.14 * Math.min(1, afterOp)})`} opacity={Math.min(1, afterOp)}>
            <rect x={-380} y={-140} width={760} height={280} rx={24} fill={C.card} stroke={C.green} strokeWidth={6} />
            <rect x={-380} y={-140} width={760} height={280} rx={24} fill={C.green} opacity={0.08} />
            <text x={0} y={-70} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">extra in your pocket</text>
            <text x={0} y={70} textAnchor="middle" fill={C.green} fontSize={140} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">+${gain.toLocaleString()}</text>
          </g>

          {/* FDIC INSURED stamp — lower, safely below the hero gain card */}
          <g transform={`translate(540,1520) rotate(-6) scale(${0.7 + 0.3 * Math.min(1, stampPop)})`} opacity={Math.min(1, stampPop)}>
            <rect x={-220} y={-46} width={440} height={92} rx={8} fill="none" stroke={C.green} strokeWidth={7} />
            <text x={0} y={20} textAnchor="middle" fill={C.green} fontSize={46} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">FDIC INSURED · SAME RISK</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — word-by-word "STOP FEEDING / THE BIG BANK." ────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines: [string, boolean, number][] = [
    ['STOP FEEDING', false, 130],
    ['THE BIG', false, 130],
    ['BANK.', true, 200],
  ];
  const ws = lines.map((_, k) => k === 0 ? 1 : spring({ frame: frame - 8 - (k - 1) * 14, fps, config: { damping: k === 2 ? 9 : 12, mass: 0.5, stiffness: 220 } }));
  const glow = interpolate(frame, [40, 80], [0, 1], clamp);
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
export const Savings: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('savings_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* baked scene-matched SFX */}
      <Sequence from={S.hook + 28}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.44} /></Sequence>
      <Sequence from={S.hook + 40}><Audio src={staticFile('sfx_plip.wav')} volume={0.55} /></Sequence>
      <Sequence from={S.hook + 60}><Audio src={staticFile('sfx_plip.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.hook + 84}><Audio src={staticFile('sfx_plip.wav')} volume={0.45} /></Sequence>

      <Sequence from={S.setup + 22}><Audio src={staticFile('sfx_click.wav')} volume={0.44} /></Sequence>
      <Sequence from={S.setup + 42}><Audio src={staticFile('sfx_digital.wav')} volume={0.34} /></Sequence>
      <Sequence from={S.setup + 110}><Audio src={staticFile('sfx_smack.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.setup + 140}><Audio src={staticFile('sfx_click.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.numbers + 26}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.numbers + 80}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.numbers + 160}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.5} /></Sequence>

      <Sequence from={S.hero + 4} durationInFrames={110}><Audio src={staticFile('sfx_digital.wav')} volume={0.36} /></Sequence>
      <Sequence from={S.hero + 140}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.hero + 142}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.55} /></Sequence>

      <Sequence from={S.fix + 22}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.fix + 70}><Audio src={staticFile('sfx_chime.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.fix + 130}><Audio src={staticFile('sfx_success.wav')} volume={0.52} /></Sequence>

      <Sequence from={S.payoff + 6}><Audio src={staticFile('sfx_smack.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.payoff + 22}><Audio src={staticFile('sfx_smack.wav')} volume={0.48} /></Sequence>
      <Sequence from={S.payoff + 40}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.6} /></Sequence>

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

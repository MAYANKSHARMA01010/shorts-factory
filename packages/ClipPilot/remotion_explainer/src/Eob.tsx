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
import eobWords from './eob_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1040;

const C = {
  bg: '#0b1220',
  panel: '#13233e',
  paper: '#f4ecd6',
  paperShadow: '#cab988',
  gold: '#FFD23F',
  green: '#36E07A',
  red: '#FF5A4D',
  blue: '#4AA8FF',
  ivory: '#F2ECDD',
  slate: '#7C90A8',
  ink: '#070d10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// scene-boundary frames (from eob_words.json sentence ends @30fps)
const S = { hook: 0, setup: 138, numbers: 340, hero: 523, app: 724, payoff: 949 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// CAPTIONS (root, 3-word karaoke pages)
const WRAW: { w: string; s: number }[] = (eobWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ── shared hero ICONS ─────────────────────────────────────────────────────────
function Pill({ x, y, w, text, scale = 1, op = 1, fontSize = 40, fill = C.gold, textFill = C.ink }: { x: number; y: number; w: number; text: string; scale?: number; op?: number; fontSize?: number; fill?: string; textFill?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      <rect x={-w / 2} y={-42} width={w} height={84} rx={42} fill={fill} />
      <text x={0} y={15} textAnchor="middle" fill={textFill} fontSize={fontSize} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{text}</text>
    </g>
  );
}

// EOB paper sheet with header + lines + amount row, anchored from frame 0
function EobPaper({ x, y, scale = 1, op = 1, showStamp = false, stampOp = 1, showCoins = false, coinsT = 0 }: { x: number; y: number; scale?: number; op?: number; showStamp?: boolean; stampOp?: number; showCoins?: boolean; coinsT?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      {/* coins peeking from behind the paper (the "hiding money") */}
      {showCoins && (
        <g opacity={coinsT}>
          {[-260, -190, 220, 260].map((cx, i) => (
            <g key={i} transform={`translate(${cx},${260 - i * 6}) scale(${0.78 + 0.06 * coinsT})`}>
              <circle cx={0} cy={0} r={48} fill={C.gold} />
              <circle cx={0} cy={0} r={48} fill="none" stroke={C.ink} strokeWidth={5} opacity={0.45} />
              <text x={0} y={18} textAnchor="middle" fill={C.ink} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$</text>
            </g>
          ))}
        </g>
      )}
      {/* shadow */}
      <rect x={-380} y={-560} width={760} height={1100} rx={18} fill={C.paperShadow} opacity={0.45} transform="translate(14,18)" />
      {/* paper */}
      <rect x={-380} y={-560} width={760} height={1100} rx={18} fill={C.paper} stroke="#a89e7d" strokeWidth={3} />
      {/* perforation tear top */}
      <line x1={-380} y1={-498} x2={380} y2={-498} stroke="#bfa982" strokeWidth={2} strokeDasharray="10 6" />
      {/* header */}
      <text x={0} y={-440} textAnchor="middle" fill={C.ink} fontSize={50} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">YOUR EOB</text>
      <text x={0} y={-380} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={700} fontFamily="Poppins,sans-serif">Explanation of Benefits</text>
      {/* fake lines (text content) */}
      {[0,1,2,3,4,5,6].map((i) => (
        <rect key={i} x={-320} y={-300 + i * 56} width={640 - (i % 2 === 0 ? 0 : 90)} height={14} rx={4} fill="#bcb094" opacity={0.85} />
      ))}
      {/* a couple of numbers blocks */}
      <rect x={140} y={140} width={220} height={70} rx={6} fill="#e5dab9" stroke="#a89e7d" strokeWidth={2} />
      <text x={250} y={188} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$120</text>
      <rect x={-360} y={140} width={240} height={70} rx={6} fill="#e5dab9" stroke="#a89e7d" strokeWidth={2} />
      <text x={-240} y={188} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$480</text>
      <rect x={-110} y={140} width={220} height={70} rx={6} fill="#e5dab9" stroke="#a89e7d" strokeWidth={2} />
      <text x={0} y={188} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$24</text>
      {/* THIS IS NOT A BILL stamp */}
      {showStamp && (
        <g transform={`rotate(-14) scale(${0.85 + 0.15 * stampOp})`} opacity={stampOp}>
          <rect x={-330} y={-90} width={660} height={180} rx={12} fill="none" stroke={C.red} strokeWidth={9} />
          <text x={0} y={-10} textAnchor="middle" fill={C.red} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={4}>THIS IS NOT</text>
          <text x={0} y={64} textAnchor="middle" fill={C.red} fontSize={64} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={4}>A BILL</text>
        </g>
      )}
    </g>
  );
}

// A medical bill sheet (different look — header in red, "PAY $X")
function BillPaper({ x, y, scale = 1, op = 1, amount = 250, asksLine = false, asksOp = 0 }: { x: number; y: number; scale?: number; op?: number; amount?: number; asksLine?: boolean; asksOp?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      <rect x={-260} y={-380} width={520} height={760} rx={14} fill={C.paperShadow} opacity={0.45} transform="translate(10,12)" />
      <rect x={-260} y={-380} width={520} height={760} rx={14} fill={C.paper} stroke="#a89e7d" strokeWidth={3} />
      {/* red header bar */}
      <rect x={-260} y={-380} width={520} height={90} fill={C.red} />
      <text x={0} y={-322} textAnchor="middle" fill={C.ivory} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={3}>HOSPITAL BILL</text>
      <text x={0} y={-240} textAnchor="middle" fill={C.ink} fontSize={28} fontWeight={700} fontFamily="Poppins,sans-serif">Amount due:</text>
      <text x={0} y={-150} textAnchor="middle" fill={C.red} fontSize={130} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${amount}</text>
      {[0,1,2,3].map((i) => (
        <rect key={i} x={-220} y={-50 + i * 52} width={440 - (i%2===0?0:70)} height={12} rx={4} fill="#bcb094" opacity={0.85} />
      ))}
      <rect x={-220} y={250} width={440} height={70} rx={6} fill={C.red} opacity={0.16} stroke={C.red} strokeWidth={3} />
      <text x={0} y={295} textAnchor="middle" fill={C.red} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PLEASE PAY NOW</text>
      {asksLine && (
        <g opacity={asksOp}>
          <line x1={-260} y1={-150} x2={-340} y2={-150} stroke={C.red} strokeWidth={6} />
          <polygon points="-340,-150 -310,-164 -310,-136" fill={C.red} />
        </g>
      )}
    </g>
  );
}

// ─── SCENE 1: HOOK ──────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // paper + ? badge anchored fully from frame 0 (SceneWrap handles soft entrance)
  const stampOp = interpolate(frame, [16, 32], [0, 1], clamp);
  const stampShake = frame > 32 ? Math.sin(frame * 0.6) * (frame < 70 ? 4 : 0) : 0;
  const badgeWobble = Math.sin(frame * 0.15) * 6;
  const coin1 = interpolate(frame, [10, 50], [0, 1], clamp);
  const coin2 = interpolate(frame, [30, 70], [0, 1], clamp);
  const coin3 = interpolate(frame, [50, 90], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* coins OUTSIDE the paper bounds — peeking from the sides ("hiding money") */}
          {[
            { cx: 130, cy: 1180, op: coin1, sc: 0.95 + 0.05 * coin1 },
            { cx: 950, cy: 1240, op: coin1, sc: 0.95 + 0.05 * coin1 },
            { cx: 90, cy: 1430, op: coin2, sc: 0.92 + 0.08 * coin2 },
            { cx: 990, cy: 1450, op: coin2, sc: 0.92 + 0.08 * coin2 },
            { cx: 160, cy: 1660, op: coin3, sc: 0.92 + 0.08 * coin3 },
            { cx: 920, cy: 1670, op: coin3, sc: 0.92 + 0.08 * coin3 },
          ].map((c, i) => (
            <g key={i} transform={`translate(${c.cx},${c.cy}) scale(${c.sc})`} opacity={c.op}>
              <circle cx={0} cy={0} r={52} fill={C.gold} />
              <circle cx={0} cy={0} r={52} fill="none" stroke={C.ink} strokeWidth={5} opacity={0.5} />
              <text x={0} y={20} textAnchor="middle" fill={C.ink} fontSize={62} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$</text>
            </g>
          ))}
          {/* "?" gold badge anchored above the paper from frame 0 */}
          <g transform={`translate(${540 + badgeWobble},360)`}>
            <circle cx={0} cy={0} r={92} fill={C.gold} />
            <text x={0} y={32} textAnchor="middle" fill={C.ink} fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">?</text>
          </g>
          {/* the EOB paper with the "NOT A BILL" stamp — anchored from frame 0 */}
          <g transform={`translate(${540 + stampShake},1100)`}>
            <EobPaper x={0} y={0} scale={0.74} op={1} showStamp stampOp={stampOp} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SETUP — doctor → insurer → mailbox → EOB ─────────────────────────
function SceneSetup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // all 3 icons + 2 arrows anchored from frame 0 (SceneWrap handles entrance)
  const doc = 1;
  const ins = 1;
  const mail = 1;
  const arr1 = 1;
  const arr2 = 1;
  // envelope still slides in (a beat after icons land)
  const env = interpolate(frame, [30, 60], [0, 1], clamp);
  const envY = interpolate(frame, [30, 60], [-180, 0], clamp);
  const pill = spring({ frame: frame - 82, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const sub = spring({ frame: frame - 110, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* doctor */}
          <g transform={`translate(220,750) scale(${0.85 + 0.15 * doc})`} opacity={doc}>
            <rect x={-90} y={-90} width={180} height={180} rx={22} fill={C.blue} />
            <text x={0} y={28} textAnchor="middle" fill={C.ivory} fontSize={130} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">+</text>
            <text x={0} y={150} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">DOCTOR</text>
          </g>
          {/* insurer */}
          <g transform={`translate(540,750) scale(${0.85 + 0.15 * ins})`} opacity={ins}>
            <rect x={-110} y={-100} width={220} height={200} rx={10} fill="#1d3158" stroke={C.slate} strokeWidth={4} />
            {[0,1,2].map((r) => [0,1,2].map((c) => (
              <rect key={`${r}${c}`} x={-80 + c * 70} y={-70 + r * 56} width={36} height={32} fill={C.gold} opacity={0.85} />
            )))}
            <text x={0} y={150} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">INSURER</text>
          </g>
          {/* mailbox */}
          <g transform={`translate(860,750) scale(${0.85 + 0.15 * mail})`} opacity={mail}>
            <rect x={-90} y={-30} width={180} height={130} rx={20} fill={C.red} stroke={C.ink} strokeWidth={4} />
            <rect x={-90} y={-30} width={180} height={50} rx={20} fill="#c8463b" />
            <line x1={-30} y1={0} x2={30} y2={0} stroke={C.ivory} strokeWidth={6} />
            <rect x={-10} y={-110} width={20} height={90} fill={C.ink} />
            <polygon points={`30,-100 110,-90 30,-80`} fill={C.gold} />
            {/* envelope arriving */}
            <g transform={`translate(0,${envY})`} opacity={env}>
              <rect x={-50} y={-30} width={100} height={70} rx={6} fill={C.ivory} stroke={C.ink} strokeWidth={3} />
              <polyline points="-50,-30 0,15 50,-30" fill="none" stroke={C.ink} strokeWidth={3} />
            </g>
            <text x={0} y={150} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={800} fontFamily="Poppins,sans-serif">YOU</text>
          </g>
          {/* arrows */}
          <g opacity={arr1}>
            <line x1={320} y1={750} x2={420} y2={750} stroke={C.gold} strokeWidth={8} strokeLinecap="round" />
            <polygon points={`${420},750 ${396},738 ${396},762`} fill={C.gold} />
          </g>
          <g opacity={arr2}>
            <line x1={660} y1={750} x2={760} y2={750} stroke={C.gold} strokeWidth={8} strokeLinecap="round" />
            <polygon points={`${760},750 ${736},738 ${736},762`} fill={C.gold} />
          </g>
          {/* EOB label pill */}
          <g transform={`translate(540,1080) scale(${0.85 + 0.15 * Math.min(1, pill)})`} opacity={Math.min(1, pill)}>
            <Pill x={0} y={0} w={520} text="EOB" fontSize={64} />
          </g>
          <g transform={`translate(540,1220) scale(${0.85 + 0.15 * Math.min(1, sub)})`} opacity={Math.min(1, sub)}>
            <rect x={-380} y={-50} width={760} height={100} rx={20} fill="none" stroke={C.gold} strokeWidth={4} strokeDasharray="14 10" />
            <text x={0} y={18} textAnchor="middle" fill={C.ivory} fontSize={50} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">EXPLANATION OF BENEFITS</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: NUMBERS — three columns ──────────────────────────────────────────
function SceneNumbers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // headline + all 3 rows anchored from frame 0 (no spring entrance) — full table from open
  const head = 1;
  const r0 = 1;
  const r1 = 1;
  const r2 = 1;
  // counter values per row
  const n0 = Math.round(interpolate(frame, [16, 50], [0, 480], clamp));
  const n1 = Math.round(interpolate(frame, [46, 78], [0, 120], clamp));
  const n2 = Math.round(interpolate(frame, [78, 108], [0, 24], clamp));
  // ALLOWED glow + arrow callout (this column is the hero column — gold)
  const glow = interpolate(frame, [70, 130], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,300) scale(${0.85 + 0.15 * Math.min(1, head)})`} opacity={Math.min(1, head)}>
            <text x={0} y={0} textAnchor="middle" fill={C.ivory} fontSize={60} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">THREE NUMBERS</text>
            <text x={0} y={56} textAnchor="middle" fill={C.slate} fontSize={32} fontWeight={700} fontFamily="Poppins,sans-serif">per service</text>
          </g>
          {/* Row 0 — provider charge (RED, big) */}
          <g transform={`translate(540,640) scale(${0.85 + 0.15 * Math.min(1, r0)})`} opacity={Math.min(1, r0)}>
            <rect x={-420} y={-90} width={840} height={180} rx={18} fill="#221422" stroke={C.red} strokeWidth={3} />
            <text x={-400} y={-26} textAnchor="start" fill={C.red} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PROVIDER CHARGE</text>
            <text x={-400} y={26} textAnchor="start" fill={C.slate} fontSize={26} fontWeight={700} fontFamily="Poppins,sans-serif">the sticker price</text>
            <text x={380} y={48} textAnchor="end" fill={C.red} fontSize={86} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${n0}</text>
          </g>
          {/* Row 1 — ALLOWED AMOUNT (GOLD, hero) */}
          <g transform={`translate(540,920) scale(${0.85 + 0.15 * Math.min(1, r1)})`} opacity={Math.min(1, r1)}>
            <rect x={-420} y={-110} width={840} height={220} rx={20} fill={C.panel} stroke={C.gold} strokeWidth={6} />
            {/* gold glow */}
            <rect x={-420} y={-110} width={840} height={220} rx={20} fill={C.gold} opacity={0.08 * glow} />
            <text x={-400} y={-30} textAnchor="start" fill={C.gold} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">ALLOWED AMOUNT</text>
            <text x={-400} y={22} textAnchor="start" fill={C.ivory} fontSize={26} fontWeight={700} fontFamily="Poppins,sans-serif">the only number that counts</text>
            <text x={380} y={60} textAnchor="end" fill={C.gold} fontSize={110} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${n1}</text>
            {/* big gold arrow callout */}
            <g opacity={glow}>
              <polygon points={`-480,0 -440,-30 -440,30`} fill={C.gold} />
              <text x={-580} y={14} textAnchor="end" fill={C.gold} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">KEY</text>
            </g>
          </g>
          {/* Row 2 — what you owe (GREEN small) */}
          <g transform={`translate(540,1200) scale(${0.85 + 0.15 * Math.min(1, r2)})`} opacity={Math.min(1, r2)}>
            <rect x={-420} y={-90} width={840} height={180} rx={18} fill="#0d2820" stroke={C.green} strokeWidth={3} />
            <text x={-400} y={-26} textAnchor="start" fill={C.green} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">YOU OWE</text>
            <text x={-400} y={26} textAnchor="start" fill={C.slate} fontSize={26} fontWeight={700} fontFamily="Poppins,sans-serif">after insurance pays</text>
            <text x={380} y={48} textAnchor="end" fill={C.green} fontSize={86} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${n2}</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO REVEAL — THE GAP ($130) ─────────────────────────────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // both papers anchored at full opacity from frame 0 (SceneWrap handles entrance)
  const eobIn = 1;
  const billIn = 1;
  // bill amount rolls UP from 120 to 250 ($250 is the hospital bill)
  const billN = Math.round(interpolate(frame, [10, 50], [120, 250], clamp));
  // The "GAP $130" badge slams in
  const gap = spring({ frame: frame - 56, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
  const gapN = Math.round(interpolate(frame, [56, 86], [0, 130], clamp));
  // alert flash
  const flash = frame > 56 && frame < 84 ? interpolate(frame, [56, 70, 84], [0, 0.7, 0], clamp) : 0;
  // "ASK QUESTIONS" pill
  const ask = spring({ frame: frame - 130, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const asksArr = interpolate(frame, [56, 80], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* flash backdrop on reveal */}
          <rect x={0} y={0} width={1080} height={1920} fill={C.gold} opacity={flash * 0.16} />
          {/* EOB on left (anchored from f=0) */}
          <g transform={`translate(280,1000) scale(${(0.78 + 0.22 * eobIn) * 0.42})`} opacity={eobIn}>
            <EobPaper x={0} y={0} scale={1} op={1} />
            {/* highlight the allowed amount $120 */}
            <rect x={140} y={140} width={220} height={70} rx={8} fill="none" stroke={C.gold} strokeWidth={10} opacity={interpolate(frame, [20, 50], [0, 1], clamp)} />
          </g>
          <text x={280} y={1480} textAnchor="middle" fill={C.gold} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" opacity={eobIn}>EOB SAYS $120</text>
          {/* BILL on right */}
          <g transform={`translate(800,1000) scale(${0.78 + 0.22 * billIn})`} opacity={billIn}>
            <BillPaper x={0} y={0} scale={0.55} op={1} amount={billN} asksLine asksOp={interpolate(frame, [40, 56], [0, 1], clamp)} />
          </g>
          <text x={800} y={1480} textAnchor="middle" fill={C.red} fontSize={42} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" opacity={billIn}>BILL ASKS ${billN}</text>
          {/* GAP $130 badge — the money shot */}
          <g transform={`translate(540,500) scale(${Math.min(1, gap) * 1.06})`} opacity={Math.min(1, gap)}>
            <rect x={-300} y={-110} width={600} height={220} rx={22} fill={C.gold} />
            <text x={0} y={-20} textAnchor="middle" fill={C.ink} fontSize={50} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={4}>GAP</text>
            <text x={0} y={80} textAnchor="middle" fill={C.ink} fontSize={120} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">${gapN}</text>
          </g>
          {/* arrows from GAP down to both papers */}
          <g opacity={asksArr}>
            <line x1={420} y1={620} x2={300} y2={870} stroke={C.gold} strokeWidth={9} strokeLinecap="round" strokeDasharray="14 10" />
            <line x1={660} y1={620} x2={800} y2={870} stroke={C.gold} strokeWidth={9} strokeLinecap="round" strokeDasharray="14 10" />
          </g>
          {/* ASK QUESTIONS pill */}
          <g transform={`translate(540,1640) scale(${0.85 + 0.15 * Math.min(1, ask)})`} opacity={Math.min(1, ask)}>
            <Pill x={0} y={0} w={620} text="ASK QUESTIONS" fontSize={56} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DO-IT-NOW — phone + AI side-by-side compare ───────────────────────
function SceneApp() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // phone + AI badge + paper thumbnails anchored from frame 0 (SceneWrap handles entrance)
  const phone = 1;
  const scan = 1;
  const aiBadge = 1;
  // mismatch row lights up red, matches green (still spring entrance for the reveal beat)
  const matches = spring({ frame: frame - 40, fps, config: { damping: 60, mass: 0.5, stiffness: 200 } });
  const mismatch = spring({ frame: frame - 90, fps, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  // pill
  const pill = spring({ frame: frame - 130, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* phone */}
          <g transform={`translate(540,990) scale(${0.82 + 0.18 * Math.min(1, phone)})`} opacity={Math.min(1, phone)}>
            <rect x={-300} y={-560} width={600} height={1100} rx={56} fill="#0e1a30" stroke="#2b3f63" strokeWidth={6} />
            <rect x={-260} y={-500} width={520} height={980} rx={26} fill="#091123" />
            {/* notch */}
            <rect x={-58} y={-500} width={116} height={28} rx={14} fill={C.ink} />
            {/* AI badge in top corner */}
            <g transform={`translate(190,-440) scale(${0.6 + 0.4 * Math.min(1, aiBadge)})`} opacity={Math.min(1, aiBadge)}>
              <rect x={-50} y={-32} width={100} height={64} rx={16} fill={C.gold} />
              <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">AI</text>
            </g>
            {/* two mini paper thumbnails (EOB + BILL) */}
            <g transform="translate(-130,-280) scale(0.9)" opacity={scan}>
              <rect x={-90} y={-100} width={180} height={200} rx={6} fill={C.paper} />
              <text x={0} y={-60} textAnchor="middle" fill={C.ink} fontSize={22} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">EOB</text>
              {[0,1,2,3,4].map((i) => (<rect key={i} x={-70} y={-30 + i * 26} width={140} height={8} rx={3} fill="#bcb094" />))}
            </g>
            <g transform="translate(130,-280) scale(0.9)" opacity={scan}>
              <rect x={-90} y={-100} width={180} height={200} rx={6} fill={C.paper} />
              <rect x={-90} y={-100} width={180} height={32} rx={6} fill={C.red} />
              <text x={0} y={-78} textAnchor="middle" fill={C.ivory} fontSize={20} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">BILL</text>
              {[0,1,2,3,4].map((i) => (<rect key={i} x={-70} y={-30 + i * 26} width={140} height={8} rx={3} fill="#bcb094" />))}
            </g>
            {/* comparison rows — 3 lines, last one mismatch */}
            {[0,1,2].map((i) => {
              const ry = 80 + i * 110;
              const isMismatch = i === 2;
              const lit = isMismatch ? mismatch : matches;
              const litOp = Math.min(1, lit);
              return (
                <g key={i} opacity={litOp}>
                  <rect x={-240} y={ry - 42} width={480} height={84} rx={14} fill={isMismatch ? '#2a1414' : '#0f2417'} stroke={isMismatch ? C.red : C.green} strokeWidth={3} />
                  <text x={-220} y={ry + 12} textAnchor="start" fill={C.ivory} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">{i === 0 ? 'visit fee' : i === 1 ? 'lab work' : 'imaging'}</text>
                  <text x={50} y={ry + 12} textAnchor="middle" fill={C.slate} fontSize={22} fontFamily="Poppins,sans-serif">{i === 0 ? '$60 = $60' : i === 1 ? '$40 = $40' : '$120 ≠ $250'}</text>
                  {/* check or X */}
                  {isMismatch ? (
                    <g transform={`translate(196,${ry})`}>
                      <line x1={-16} y1={-16} x2={16} y2={16} stroke={C.red} strokeWidth={6} strokeLinecap="round" />
                      <line x1={-16} y1={16} x2={16} y2={-16} stroke={C.red} strokeWidth={6} strokeLinecap="round" />
                    </g>
                  ) : (
                    <g transform={`translate(196,${ry})`}>
                      <polyline points={`-18,2 -4,16 18,-12`} fill="none" stroke={C.green} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                </g>
              );
            })}
            {/* footer alert when mismatch lights */}
            <g opacity={Math.min(1, mismatch)}>
              <rect x={-260} y={420} width={520} height={70} rx={12} fill={C.red} opacity={0.85} />
              <text x={0} y={464} textAnchor="middle" fill={C.ivory} fontSize={28} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">$130 GAP — ASK</text>
            </g>
          </g>
          {/* pill */}
          <g transform={`translate(540,1660) scale(${0.85 + 0.15 * Math.min(1, pill)})`} opacity={Math.min(1, pill)}>
            <Pill x={0} y={0} w={620} text="SIDE BY SIDE" fontSize={50} />
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
    ['STOP THROWING', false, 92],
    ['IT OUT.', false, 92],
    ['READ THE GAP.', true, 124],
  ];
  // line 1 anchored from frame 0 (SceneWrap handles entrance); line 2 + 3 stagger in
  const ws = lines.map((_, k) => k === 0 ? 1 : spring({ frame: frame - 8 - (k - 1) * 22, fps, config: { damping: k === 2 ? 9 : 12, mass: 0.5, stiffness: 220 } }));
  const glow = interpolate(frame, [44, 80], [0, 1], clamp);
  // a clean gold burst behind the final line (no competing backdrop paper)
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* clean gold burst rings behind READ THE GAP */}
          <circle cx={540} cy={1240} r={480 * glow} fill={C.gold} opacity={0.13 * glow} />
          <circle cx={540} cy={1240} r={300 * glow} fill={C.gold} opacity={0.10 * glow} />
          {/* gold rays radiating out */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <g key={i} transform={`translate(540,1240) rotate(${deg})`} opacity={glow * 0.45}>
              <rect x={140} y={-4} width={140 + 60 * glow} height={8} fill={C.gold} />
            </g>
          ))}
          {lines.map((ln, k) => {
            const yy = 780 + k * 230;
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
export const Eob: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('eob_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* baked scene-matched SFX */}
      <Sequence from={S.hook + 22}><Audio src={staticFile('sfx_smack.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.hook + 50}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.hook + 100}><Audio src={staticFile('sfx_plip.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.setup + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 60}><Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.45} /></Sequence>
      <Sequence from={S.setup + 102}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>

      <Sequence from={S.numbers + 16} durationInFrames={48}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.numbers + 46}><Audio src={staticFile('sfx_chime.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.numbers + 78} durationInFrames={36}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>

      <Sequence from={S.hero + 40}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.34} /></Sequence>
      <Sequence from={S.hero + 56}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} /></Sequence>
      <Sequence from={S.hero + 58}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.55} /></Sequence>
      <Sequence from={S.hero + 130}><Audio src={staticFile('sfx_smack.wav')} volume={0.46} /></Sequence>

      <Sequence from={S.app + 12}><Audio src={staticFile('sfx_click.wav')} volume={0.44} /></Sequence>
      <Sequence from={S.app + 78}><Audio src={staticFile('sfx_digital.wav')} volume={0.38} /></Sequence>
      <Sequence from={S.app + 110}><Audio src={staticFile('sfx_glass.wav')} volume={0.46} /></Sequence>

      <Sequence from={S.payoff + 8}><Audio src={staticFile('sfx_success.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.payoff + 44}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 62}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.5} /></Sequence>

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

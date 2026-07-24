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
import csWords from './creditscore_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 820;

const C = {
  bg: '#0b1220',
  panel: '#13233e',
  gold: '#FFD23F',
  green: '#36E07A',
  red: '#FF5A4D',
  blue: '#4AA8FF',
  ivory: '#F2ECDD',
  slate: '#7C90A8',
  ink: '#070d10',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// scene-boundary frames (from creditscore_words.json sentence ends @30fps)
const S = { hook: 0, setup: 67, util: 227, hero: 365, app: 528, payoff: 662 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS (root, 3-word karaoke pages) ──────────────────────────────────────
const WRAW: { w: string; s: number }[] = (csWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

// ─── HERO HELPERS ───────────────────────────────────────────────────────────────
function dialXY(cx: number, cy: number, R: number, p: number) {
  const th = Math.PI * (1 - Math.max(0, Math.min(1, p)));
  return [cx + R * Math.cos(th), cy - R * Math.sin(th)] as const;
}
function band(cx: number, cy: number, R: number, p0: number, p1: number) {
  const n = 26; let s = '';
  for (let i = 0; i <= n; i++) { const p = p0 + (p1 - p0) * (i / n); const [x, y] = dialXY(cx, cy, R, p); s += `${x.toFixed(1)},${y.toFixed(1)} `; }
  return s.trim();
}
function scoreColor(score: number) { return score >= 720 ? C.green : score >= 640 ? C.gold : C.red; }

function ScoreDial({ cx, cy, R, score, glow = 0 }: { cx: number; cy: number; R: number; score: number; glow?: number }) {
  const p = (score - 300) / 550;
  const [nx, ny] = dialXY(cx, cy, R * 0.84, p);
  const col = scoreColor(score);
  return (
    <g>
      {glow > 0 && <circle cx={cx} cy={cy - R * 0.3} r={R * 0.95} fill={col} opacity={0.1 * glow} />}
      <polyline points={band(cx, cy, R, 0, 1)} fill="none" stroke="#22304a" strokeWidth={48} strokeLinecap="round" />
      <polyline points={band(cx, cy, R, 0, 0.5)} fill="none" stroke={C.red} strokeWidth={34} strokeLinecap="round" />
      <polyline points={band(cx, cy, R, 0.5, 0.73)} fill="none" stroke={C.gold} strokeWidth={34} strokeLinecap="round" />
      <polyline points={band(cx, cy, R, 0.73, 1)} fill="none" stroke={C.green} strokeWidth={34} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.ivory} strokeWidth={12} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={26} fill={C.ivory} />
      <circle cx={cx} cy={cy} r={12} fill={C.ink} />
      <text x={cx} y={cy + R * 0.52} textAnchor="middle" fill={col} fontSize={R * 0.5} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{Math.round(score)}</text>
      <text x={cx - R} y={cy + 42} textAnchor="middle" fill={C.slate} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">300</text>
      <text x={cx + R} y={cy + 42} textAnchor="middle" fill={C.slate} fontSize={24} fontWeight={800} fontFamily="Poppins,sans-serif">850</text>
    </g>
  );
}

function UtilBar({ cx, cy, w, fill, threshold = 0.3, thLabel = '30%' }: { cx: number; cy: number; w: number; fill: number; threshold?: number; thLabel?: string }) {
  const h = 74; const x0 = cx - w / 2;
  const over = fill > threshold + 0.001;
  const fillCol = over ? C.red : C.green;
  const fw = Math.max(0, Math.min(1, fill)) * w;
  const tx = x0 + threshold * w;
  return (
    <g>
      <rect x={x0} y={cy - h / 2} width={w} height={h} rx={h / 2} fill="#1b2c49" stroke="#2b3f63" strokeWidth={3} />
      <rect x={x0} y={cy - h / 2} width={fw} height={h} rx={h / 2} fill={fillCol} />
      <line x1={tx} y1={cy - h / 2 - 26} x2={tx} y2={cy + h / 2 + 26} stroke={C.gold} strokeWidth={5} strokeDasharray="10 9" />
      <text x={tx} y={cy - h / 2 - 36} textAnchor="middle" fill={C.gold} fontSize={34} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{thLabel}</text>
      <text x={x0} y={cy + h / 2 + 50} textAnchor="start" fill={C.slate} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">$0</text>
      <text x={x0 + w} y={cy + h / 2 + 50} textAnchor="end" fill={C.slate} fontSize={26} fontWeight={800} fontFamily="Poppins,sans-serif">LIMIT</text>
    </g>
  );
}

function CardIcon({ x, y, scale = 1, fill = C.blue, op = 1 }: { x: number; y: number; scale?: number; fill?: string; op?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      <rect x={-150} y={-95} width={300} height={190} rx={24} fill={fill} />
      <rect x={-150} y={-60} width={300} height={36} fill={C.ink} opacity={0.55} />
      <rect x={-118} y={18} width={70} height={52} rx={9} fill={C.gold} />
      {[0, 1, 2].map((i) => <circle key={i} cx={40 + i * 34} cy={56} r={9} fill={C.ivory} opacity={0.85} />)}
    </g>
  );
}

function Pill({ x, y, w, text, scale = 1, op = 1, fontSize = 40, fill = C.gold, textFill = C.ink }: { x: number; y: number; w: number; text: string; scale?: number; op?: number; fontSize?: number; fill?: string; textFill?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={op}>
      <rect x={-w / 2} y={-42} width={w} height={84} rx={42} fill={fill} />
      <text x={0} y={15} textAnchor="middle" fill={textFill} fontSize={fontSize} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{text}</text>
    </g>
  );
}

// ─── SCENE 1: HOOK ──────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const badge = spring({ frame: frame - 6, fps, config: { damping: 50, mass: 0.5, stiffness: 210 } });
  const score = interpolate(frame, [0, 28, 58], [788, 788, 556], clamp);   // crash into RED
  const arrow = interpolate(frame, [30, 52], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* gold "paid on time" badge — the irony */}
          <g transform={`translate(540,470) scale(${badge})`} opacity={badge}>
            <Pill x={0} y={0} w={520} text="PAID ON TIME ✓" fontSize={48} />
          </g>
          <g transform={`translate(540,1010) scale(${Math.min(1, pop)})`}>
            <ScoreDial cx={0} cy={0} R={300} score={score} glow={interpolate(frame, [30, 58], [0, 1], clamp)} />
          </g>
          {/* big red down arrow on the drop */}
          <g opacity={arrow} transform={`translate(890,${interpolate(frame, [30, 58], [940, 1150], clamp)})`}>
            <line x1={0} y1={-96} x2={0} y2={70} stroke={C.red} strokeWidth={28} strokeLinecap="round" />
            <polygon points="-46,46 46,46 0,124" fill={C.red} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SETUP — statement date ≠ due date ─────────────────────────────────
function SceneSetup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [2, 18], [0, 1], clamp);
  const card = interpolate(frame, [0, 12], [0, 1], clamp);               // card anchored from the start
  const stmtFlag = spring({ frame: frame - 8, fps, config: { damping: 50, mass: 0.5, stiffness: 200 } });
  const dueFlag = spring({ frame: frame - 18, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const snap = interpolate(frame, [22, 40], [0, 1], clamp);
  const flash = frame > 30 && frame < 48 ? interpolate(frame, [30, 38, 48], [0, 0.8, 0], clamp) : 0;
  const reported = spring({ frame: frame - 36, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const TLY = 980; const x0 = 150; const x1 = 930;
  const stmtX = x0 + (x1 - x0) * 0.2; const dueX = x0 + (x1 - x0) * 0.86;
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* billing-cycle timeline */}
          <line x1={x0} y1={TLY} x2={x0 + (x1 - x0) * line} y2={TLY} stroke={C.slate} strokeWidth={8} strokeLinecap="round" />
          {[0, 0.2, 0.4, 0.6, 0.86, 1].map((t, i) => (
            <circle key={i} cx={x0 + (x1 - x0) * t} cy={TLY} r={7} fill={C.slate} opacity={line} />
          ))}
          {/* card snapshots at statement date */}
          <CardIcon x={stmtX} y={TLY - 250} scale={0.72} op={card} />
          <g opacity={snap}>
            <line x1={stmtX} y1={TLY - 150} x2={stmtX} y2={TLY - 30} stroke={C.gold} strokeWidth={5} strokeDasharray="9 8" />
          </g>
          <circle cx={stmtX} cy={TLY - 250} r={150 * flash} fill={C.gold} opacity={flash} />

          {/* STATEMENT DATE flag (gold) */}
          <g transform={`translate(${stmtX},${TLY}) scale(${0.85 + 0.15 * Math.min(1, stmtFlag)})`} opacity={stmtFlag}>
            <line x1={0} y1={0} x2={0} y2={64} stroke={C.gold} strokeWidth={6} />
            <circle cx={0} cy={0} r={16} fill={C.gold} />
            <rect x={-150} y={70} width={300} height={64} rx={14} fill={C.gold} />
            <text x={0} y={112} textAnchor="middle" fill={C.ink} fontSize={32} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">STATEMENT</text>
          </g>
          {/* DUE DATE flag (slate, "too late") */}
          <g transform={`translate(${dueX},${TLY}) scale(${0.85 + 0.15 * Math.min(1, dueFlag)})`} opacity={dueFlag}>
            <line x1={0} y1={0} x2={0} y2={64} stroke={C.slate} strokeWidth={6} />
            <circle cx={0} cy={0} r={16} fill={C.slate} />
            <rect x={-130} y={70} width={260} height={64} rx={14} fill="#28384f" stroke={C.slate} strokeWidth={2} />
            <text x={0} y={104} textAnchor="middle" fill={C.slate} fontSize={30} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">DUE DATE</text>
            <text x={0} y={172} textAnchor="middle" fill={C.slate} fontSize={24} fontWeight={700} fontFamily="Poppins,sans-serif">you pay here</text>
          </g>

          {/* REPORTED TO BUREAUS pill */}
          <g transform={`translate(540,560) scale(${0.85 + 0.15 * Math.min(1, reported)})`} opacity={reported}>
            <Pill x={0} y={0} w={620} text="REPORTED TO BUREAUS" fontSize={42} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: UTILIZATION = balance ÷ limit ─────────────────────────────────────
function SceneUtil() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fill = interpolate(frame, [12, 70], [0, 0.26], clamp);   // settle GREEN, under 30% (hero owns the crossing)
  const pct = Math.round(fill * 100);
  const pill = spring({ frame: frame - 10, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  const formula = interpolate(frame, [44, 78], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,560) scale(${0.85 + 0.15 * Math.min(1, pill)})`} opacity={pill}>
            <Pill x={0} y={0} w={460} text="UTILIZATION" fontSize={46} />
          </g>
          <CardIcon x={540} y={820} scale={1.1} />
          {/* the fill meter = how much of the limit is used */}
          <UtilBar cx={540} cy={1120} w={760} fill={fill} threshold={0.3} />
          {/* rolling % */}
          <text x={540} y={1320} textAnchor="middle" fill={fill > 0.3 ? C.red : C.green} fontSize={150} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">{pct}%</text>
          {/* formula */}
          <text x={540} y={1440} textAnchor="middle" fill={C.ivory} fontSize={40} fontWeight={800} fontFamily="Poppins,sans-serif" opacity={formula}>balance ÷ limit</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: HERO REVEAL — >30% → score sinks even if paid in full ─────────────
function SceneHero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fill = interpolate(frame, [8, 55], [0.26, 0.54], clamp);    // continues from util 26%, crosses 30% early
  const crossed = fill > 0.3;
  const score = interpolate(frame, [34, 84], [744, 558], clamp);    // sinks right as it crosses → deep RED
  const dialGlow = interpolate(frame, [34, 84], [0, 1], clamp);
  const stamp = spring({ frame: frame - 88, fps, config: { damping: 9, mass: 0.5, stiffness: 200 } });    // PAID IN FULL slams
  const tooLate = spring({ frame: frame - 104, fps, config: { damping: 46, mass: 0.6, stiffness: 210 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <ScoreDial cx={540} cy={640} R={230} score={score} glow={dialGlow} />
          <UtilBar cx={540} cy={1080} w={800} fill={fill} threshold={0.3} />
          {/* over-limit warning when crossed */}
          {crossed && (
            <text x={540} y={1240} textAnchor="middle" fill={C.red} fontSize={44} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" opacity={interpolate(frame, [30, 46], [0, 1], clamp)}>OVER 30% → SCORE SINKS</text>
          )}
          {/* PAID IN FULL stamp — but too late */}
          <g transform={`translate(540,1470) scale(${0.7 + 0.3 * Math.min(1, stamp)}) rotate(-8)`} opacity={Math.min(1, stamp)}>
            <rect x={-260} y={-58} width={520} height={116} rx={16} fill="none" stroke={C.green} strokeWidth={9} />
            <text x={0} y={20} textAnchor="middle" fill={C.green} fontSize={56} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">PAID IN FULL ✓</text>
          </g>
          <g transform={`translate(540,1620) scale(${0.7 + 0.3 * Math.min(1, tooLate)})`} opacity={tooLate}>
            <Pill x={0} y={0} w={520} text="…BUT TOO LATE" fontSize={48} fill={C.red} textFill={C.ivory} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DO IT NOW — open card app, find statement date ─────────────────────
function SceneApp() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = spring({ frame, fps, config: { damping: 60, mass: 0.5, stiffness: 170 } });
  const ring = spring({ frame: frame - 24, fps, config: { damping: 50, mass: 0.5, stiffness: 200 } });
  const tap = frame > 22 ? interpolate(frame % 30, [0, 12, 24], [1, 0.7, 1], clamp) : 1;
  const ripple = frame > 24 ? ((frame - 24) % 40) / 40 : 0;
  const pill = spring({ frame: frame - 34, fps, config: { damping: 55, mass: 0.5, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540,940) scale(${0.82 + 0.18 * Math.min(1, phone)})`} opacity={Math.min(1, phone)}>
            {/* phone body */}
            <rect x={-250} y={-470} width={500} height={940} rx={56} fill="#0e1a30" stroke="#2b3f63" strokeWidth={6} />
            <rect x={-210} y={-410} width={420} height={820} rx={24} fill="#0a1426" />
            {/* app header card */}
            <rect x={-190} y={-388} width={380} height={150} rx={18} fill={C.blue} opacity={0.9} />
            <text x={0} y={-300} textAnchor="middle" fill={C.ivory} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">MY CARD</text>
            {/* rows */}
            {['Current balance', 'Due date', 'Statement date'].map((t, i) => {
              const ry = -180 + i * 130; const hot = i === 2;
              return (
                <g key={i}>
                  <rect x={-190} y={ry} width={380} height={104} rx={16} fill={hot ? '#1c2c49' : '#101e36'} />
                  <text x={-160} y={ry + 62} textAnchor="start" fill={hot ? C.gold : C.slate} fontSize={30} fontWeight={hot ? 900 : 700} fontFamily="Poppins,sans-serif">{t}</text>
                  {hot && <rect x={-190} y={ry} width={380} height={104} rx={16} fill="none" stroke={C.gold} strokeWidth={Math.round(6 * ring)} opacity={ring} />}
                </g>
              );
            })}
            {/* tapping finger */}
            <circle cx={120} cy={205} r={40 + ripple * 60} fill="none" stroke={C.gold} strokeWidth={5} opacity={(1 - ripple) * 0.8} />
            <circle cx={120} cy={205} r={30} fill={C.ivory} opacity={0.85} transform={`scale(${tap})`} style={{ transformOrigin: '120px 205px' } as any} />
          </g>
          <g transform={`translate(540,1560) scale(${pill})`} opacity={pill}>
            <Pill x={0} y={0} w={640} text="FIND THIS DATE — NOW" fontSize={42} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — under 10%, score climbs (word-by-word) ────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const score = interpolate(frame, [8, 72], [600, 792], clamp);
  const fill = interpolate(frame, [8, 64], [0.45, 0.08], clamp);
  const glow = interpolate(frame, [50, 100], [0, 1], clamp);
  const lines: [string, boolean][] = [['PAY EARLY', false], ['UNDER 10%', true], ['SCORE CLIMBS', true]];
  const ws = lines.map((_, k) => spring({ frame: frame - 34 - k * 12, fps, config: { damping: k === 2 ? 9 : 12, mass: 0.5, stiffness: 210 } }));
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <ScoreDial cx={540} cy={560} R={210} score={score} glow={glow} />
          <UtilBar cx={540} cy={960} w={720} fill={fill} threshold={0.1} thLabel="10%" />
          {lines.map((ln, k) => {
            const yy = 1240 + k * 168;
            return (
              <text key={k} x={540} y={yy} textAnchor="middle" fontSize={ln[1] ? 104 : 78} fontWeight={900}
                fontFamily="Poppins,Arial Black,sans-serif" fill={ln[1] ? C.gold : '#fff'} opacity={Math.min(1, ws[k])}
                transform={`translate(540,${yy}) scale(${ws[k]}) translate(-540,-${yy})`}>{ln[0]}</text>
            );
          })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT ───────────────────────────────────────────────────────────────────────
export const Creditscore: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('creditscore_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* baked scene-matched SFX (finance / alert / success) */}
      <Sequence from={S.hook + 6}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.3} /></Sequence>
      <Sequence from={S.hook + 44}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} /></Sequence>
      <Sequence from={S.setup + 30}><Audio src={staticFile('sfx_click.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.setup + 34} durationInFrames={60}><Audio src={staticFile('sfx_digital.wav')} volume={0.3} /></Sequence>
      <Sequence from={S.util + 14} durationInFrames={80}><Audio src={staticFile('sfx_digital.wav')} volume={0.32} /></Sequence>
      <Sequence from={S.hero + 10}><Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.34} /></Sequence>
      <Sequence from={S.hero + 48}><Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.5} /></Sequence>
      <Sequence from={S.hero + 52}><Audio src={staticFile('sfx_drag_boom.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.hero + 88}><Audio src={staticFile('sfx_smack.wav')} volume={0.46} /></Sequence>
      <Sequence from={S.app + 24}><Audio src={staticFile('sfx_click.wav')} volume={0.44} /></Sequence>
      <Sequence from={S.payoff + 30}><Audio src={staticFile('sfx_success.wav')} volume={0.42} /></Sequence>
      <Sequence from={S.payoff + 66}><Audio src={staticFile('sfx_chime.wav')} volume={0.4} /></Sequence>
      <Sequence from={S.payoff + 88}><Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.46} /></Sequence>

      <Sequence from={S.hook} durationInFrames={S.setup - S.hook}><SceneHook /></Sequence>
      <Sequence from={S.setup} durationInFrames={S.util - S.setup}><SceneSetup /></Sequence>
      <Sequence from={S.util} durationInFrames={S.hero - S.util}><SceneUtil /></Sequence>
      <Sequence from={S.hero} durationInFrames={S.app - S.hero}><SceneHero /></Sequence>
      <Sequence from={S.app} durationInFrames={S.payoff - S.app}><SceneApp /></Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}><ScenePayoff /></Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

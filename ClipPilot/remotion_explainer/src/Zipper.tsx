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

export const FPS = 30;
export const DURATION_IN_FRAMES = 960;

const C = {
  bg:      '#0b1020',
  bgMid:   '#13203b',
  accent:  '#FFD23F',
  key:     '#3aa0ff',
  metal:   '#cdd5e0',
  metalDk: '#8b97a8',
  teeth:   '#e3b34a',
  teethDk: '#b07d1f',
  fabA:    '#3a47e0',
  fabB:    '#d24a3d',
  danger:  '#ff5b4d',
  snap:    '#7CFFB2',
  ink:     '#0b1020',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Scene start frames (from make_narration.py output)
const S = { hook:0, mystery:137, anatomy:265, ychan:385, lockSnap:618, payoff:765 };

function usePop(delay: number, damping = 120) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.55, stiffness: 180 } });
}

// 8-frame fast fade-in + scale settle (house style)
function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return (
    <div style={{ position:'absolute', inset:0, opacity:fadeIn, transform:`scale(${sc})`, transformOrigin:'center' }}>
      {children}
    </div>
  );
}

// ─── CAPTIONS (3-word karaoke) ────────────────────────────────────────────────
const WRAW = [
  {w:'Look',s:0.00},{w:'closely',s:0.32},{w:'at',s:0.76},
  {w:'a',s:0.90},{w:'zipper,',s:1.00},{w:'and',s:1.44},
  {w:'the',s:1.66},{w:'only',s:1.78},{w:'moving',s:2.00},
  {w:'part',s:2.32},{w:'is',s:2.60},{w:'that',s:2.80},
  {w:'little',s:2.96},{w:'slider.',s:3.28},
  // sentence gap — fill to 4.56
  {w:'So',s:4.60},{w:'how',s:4.90},{w:'does',s:5.12},
  {w:'pulling',s:5.30},{w:'one',s:5.66},{w:'tab',s:5.84},
  {w:'lock',s:6.06},{w:'two',s:6.30},{w:'rows',s:6.52},
  {w:'of',s:6.70},{w:'teeth',s:6.84},{w:'shut?',s:7.14},
  // sentence gap — fill to 8.84
  {w:'You',s:8.88},{w:'see,',s:9.10},{w:'every',s:9.38},
  {w:'tooth',s:9.64},{w:'has',s:9.92},{w:'a',s:10.12},
  {w:'hook',s:10.24},{w:'on',s:10.52},{w:'top',s:10.70},
  {w:'and',s:10.96},{w:'a',s:11.12},{w:'hollow',s:11.26},
  {w:'on',s:11.62},{w:'the',s:11.80},{w:'bottom.',s:12.00},
  // sentence gap — fill to 12.84
  {w:'As',s:12.88},{w:'the',s:13.10},{w:'slider',s:13.24},
  {w:'glides',s:13.58},{w:'up,',s:13.86},{w:'its',s:14.20},
  {w:'Y-shaped',s:14.40},{w:'channel',s:14.82},{w:'forces',s:15.18},
  {w:'each',s:15.50},{w:'tooth',s:15.70},{w:'sideways',s:15.98},
  {w:'into',s:16.42},{w:'the',s:16.68},{w:'gap',s:16.86},
  {w:'of',s:17.04},{w:'the',s:17.18},{w:'one',s:17.32},
  {w:'across',s:17.50},{w:'from',s:17.80},{w:'it.',s:18.00},
  // sentence gap — fill to 20.60
  {w:'Then',s:20.64},{w:'the',s:20.94},{w:'hook',s:21.10},
  {w:'snaps',s:21.38},{w:'into',s:21.68},{w:'the',s:21.88},
  {w:'hollow,',s:22.04},{w:'and',s:22.38},{w:'the',s:22.58},
  {w:'tooth',s:22.72},{w:'behind',s:23.00},{w:'it',s:23.38},
  {w:'holds',s:23.56},{w:'the',s:23.82},{w:'whole',s:24.00},
  {w:'thing',s:24.24},{w:'locked.',s:24.56},
  // sentence gap — fill to 25.50
  {w:'And',s:25.54},{w:'this',s:25.74},{w:'is',s:25.90},
  {w:'why',s:26.06},{w:'one',s:26.20},{w:'single',s:26.38},
  {w:'broken',s:26.70},{w:'tooth',s:27.00},{w:'ruins',s:27.32},
  {w:'the',s:27.62},{w:'entire',s:27.80},{w:'zipper',s:28.10},
  {w:'for',s:28.48},{w:'good.',s:28.68},
];
type Page = { words:string[]; startF:number; endF:number };
const PAGES: Page[] = [];
for (let i=0; i<WRAW.length; i+=3) {
  const chunk = WRAW.slice(i, i+3);
  PAGES.push({ words:chunk.map(x=>x.w), startF:chunk[0].s*FPS, endF:(chunk[chunk.length-1].s+0.5)*FPS });
}

function Captions() {
  const frame = useCurrentFrame();
  let page: Page | null = null;
  for (let i=PAGES.length-1; i>=0; i--) {
    if (frame >= PAGES[i].startF) { page = PAGES[i]; break; }
  }
  if (!page) return null;
  const pi = PAGES.indexOf(page);
  return (
    <div style={{ position:'absolute', bottom:160, left:0, right:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
      {page.words.map((w, wi) => {
        const absIdx = pi * 3 + wi;
        const wStart = (WRAW[absIdx]?.s ?? 0) * FPS;
        const wEnd   = (WRAW[absIdx+1]?.s ?? (WRAW[absIdx]?.s ?? 0) + 15 / FPS) * FPS;
        const active = frame >= wStart && frame < wEnd;
        return (
          <span key={wi} style={{
            color: active ? C.accent : '#fff',
            fontSize: 62, fontWeight: 900,
            fontFamily: "'Inter','Arial Black',sans-serif",
            textShadow: '0 3px 16px rgba(0,0,0,0.9)',
            transform: active ? 'scale(1.13)' : 'scale(1)',
            display: 'inline-block',
            margin: '0 16px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

// ─── SCENE 1: HOOK — zipper appears, everything dims, slider glows gold ──────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zipPop   = spring({ frame, fps, config:{ damping:100, mass:0.5, stiffness:200 } });
  const spotGlow = 0.5 + 0.5 * Math.sin(frame * 0.09);
  const loupePop = spring({ frame:frame-28, fps, config:{ damping:90, mass:0.4, stiffness:220 } });
  const labelIn  = spring({ frame:frame-44, fps, config:{ damping:120, mass:0.55, stiffness:180 } });
  const NUM_TEETH = 16;

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position:'absolute', inset:0 }}>
          {/* Fabric tapes */}
          <rect x={130} y={210} width={180} height={1380} rx={10} fill={C.fabA} opacity={0.35} />
          <rect x={770} y={210} width={180} height={1380} rx={10} fill={C.fabB} opacity={0.35} />

          {/* Teeth cascade — staggered pop, all dimmed */}
          {Array.from({length:NUM_TEETH}).map((_,i) => {
            const tp = spring({ frame:frame-i*4, fps, config:{ damping:85, mass:0.4, stiffness:260 } });
            const ty = 260 + i * 85;
            return (
              <g key={i} transform={`scale(${tp * zipPop})`} style={{ transformOrigin:`540px ${ty}px` }}>
                <rect x={350} y={ty-18} width={60} height={36} rx={8} fill={C.teeth} opacity={0.22} />
                <circle cx={380} cy={ty-18} r={9} fill={C.teethDk} opacity={0.22} />
                <rect x={670} y={ty-18} width={60} height={36} rx={8} fill={C.teeth} opacity={0.22} />
                <circle cx={700} cy={ty-18} r={9} fill={C.teethDk} opacity={0.22} />
                {/* locked seam connector for lower half */}
                {i > 7 && <line x1={410} y1={ty} x2={670} y2={ty} stroke={C.teethDk} strokeWidth={3} opacity={0.12} />}
              </g>
            );
          })}

          {/* Glow ring behind slider */}
          <circle cx={540} cy={660} r={100 + 14*spotGlow} fill="none" stroke={C.accent} strokeWidth={5} opacity={0.3*spotGlow} />
          <circle cx={540} cy={660} r={80}  fill="none" stroke={C.accent} strokeWidth={7} opacity={0.55} />

          {/* SLIDER — gold, fully lit */}
          <g transform="translate(540,660)">
            <rect x={-68} y={-62} width={136} height={124} rx={16} fill={C.accent} />
            {/* Y opening */}
            <path d="M -32,-63 L 0,-22 L 32,-63" fill="none" stroke={C.bg} strokeWidth={9} strokeLinecap="round" />
            <line x1={0} y1={-22} x2={0} y2={63} stroke={C.bg} strokeWidth={9} />
            {/* Pull tab */}
            <rect x={-18} y={-120} width={36} height={68} rx={9} fill={C.metalDk} />
            <circle cx={0} cy={-120} r={14} fill={C.metalDk} />
          </g>

          {/* "ONLY moving part" label pill */}
          <g transform={`translate(${540 + 110*labelIn}, 590)`} opacity={labelIn}>
            <rect x={-10} y={-24} width={340} height={48} rx={24} fill={C.accent} />
            <text x={160} y={9} textAnchor="middle" fill={C.ink} fontSize={30} fontWeight={900}
              fontFamily="Arial Black,sans-serif">ONLY moving part</text>
          </g>

          {/* Loupe */}
          <g transform={`translate(540,660) scale(${loupePop})`}>
            <circle cx={0} cy={0} r={100} fill="none" stroke={C.key} strokeWidth={7} />
            <line x1={71} y1={71} x2={118} y2={118} stroke={C.key} strokeWidth={8} strokeLinecap="round" />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: MYSTERY — pull tab, teeth flowing in, big ? ────────────────────
function SceneMystery() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tabYank  = spring({ frame, fps, config:{ damping:70, mass:0.45, stiffness:260 } });
  const wobble   = Math.sin(frame * 0.3) * (frame < 12 ? 4 : 0.8);
  const qPop     = spring({ frame:frame-18, fps, config:{ damping:90, mass:0.6, stiffness:160 } });
  const qPulse   = 1 + 0.05 * Math.sin(frame * 0.1);
  const arrowPct = interpolate(frame, [28, 72], [0, 1], clamp);
  const labelIn  = spring({ frame:frame-50, fps, config:{ damping:120, mass:0.55, stiffness:180 } });
  const feedOff  = (frame * 5) % 100;

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position:'absolute', inset:0 }}>
          <defs>
            <marker id="arA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.key} />
            </marker>
          </defs>

          {/* Flowing left teeth */}
          {[0,1,2,3].map(i => {
            const ty = 1020 + i * 90 - feedOff;
            if (ty < 820 || ty > 1180) return null;
            return <g key={`l${i}`} transform={`translate(310,${ty})`}>
              <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.teeth} />
              <circle cx={-18} cy={-18} r={9} fill={C.teethDk} />
            </g>;
          })}
          {/* Flowing right teeth */}
          {[0,1,2,3].map(i => {
            const ty = 1020 + i * 90 - feedOff;
            if (ty < 820 || ty > 1180) return null;
            return <g key={`r${i}`} transform={`translate(770,${ty})`}>
              <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.teeth} />
              <circle cx={18} cy={-18} r={9} fill={C.teethDk} />
            </g>;
          })}

          {/* Fused seam below slider */}
          {[0,1,2,3].map(i => (
            <g key={`f${i}`} transform={`translate(540,${1220+i*80})`}>
              <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.snap} opacity={0.8} />
              <line x1={-140} y1={0} x2={140} y2={0} stroke={C.snap} strokeWidth={3} opacity={0.4} />
            </g>
          ))}

          {/* Slider being yanked */}
          <g transform={`translate(${540+wobble},${860-tabYank*50})`}>
            <rect x={-75} y={-68} width={150} height={136} rx={16} fill={C.accent} />
            <path d="M -35,-69 L 0,-26 L 35,-69" fill="none" stroke={C.bg} strokeWidth={9} strokeLinecap="round" />
            <line x1={0} y1={-26} x2={0} y2={69} stroke={C.bg} strokeWidth={9} />
            <rect x={-21} y={-140} width={42} height={80} rx={10} fill={C.metalDk} />
            <circle cx={0} cy={-140} r={16} fill={C.metalDk} />
          </g>

          {/* Big gold ? */}
          <text x={540} y={660} textAnchor="middle" fill={C.accent}
            fontSize={220} fontWeight={900} fontFamily="Arial Black,sans-serif"
            opacity={qPop * qPulse}
            transform={`translate(540,660) scale(${qPop * qPulse}) translate(-540,-660)`}
          >?</text>

          {/* Merge arrows */}
          <path d="M 310,1040 Q 310,920 540,870" fill="none" stroke={C.key} strokeWidth={6}
            strokeDasharray={340} strokeDashoffset={340*(1-arrowPct)} markerEnd="url(#arA)" />
          <path d="M 770,1040 Q 770,920 540,870" fill="none" stroke={C.key} strokeWidth={6}
            strokeDasharray={340} strokeDashoffset={340*(1-arrowPct)} markerEnd="url(#arA)" />

          {/* Label pill */}
          <g transform="translate(540,490)" opacity={labelIn}>
            <rect x={-190} y={-25} width={380} height={50} rx={25} fill={C.key} />
            <text x={0} y={9} textAnchor="middle" fill="white" fontSize={28} fontWeight={900}
              fontFamily="Arial Black,sans-serif">two rows → one lock</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: ANATOMY — giant tooth cross-section, HOOK + HOLLOW ──────────────
function SceneAnatomy() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toothPop  = spring({ frame, fps, config:{ damping:85, mass:0.5, stiffness:230 } });
  const hookIn    = spring({ frame:frame-22, fps, config:{ damping:120, mass:0.55, stiffness:180 } });
  const hollowIn  = spring({ frame:frame-42, fps, config:{ damping:120, mass:0.55, stiffness:180 } });
  const shimmer   = (frame * 2.5) % 100;
  const shimAlpha = interpolate(shimmer, [0, 50, 100], [0.1, 0.7, 0.1], clamp);

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position:'absolute', inset:0 }}>
          {/* Ghost neighbors */}
          <g opacity={0.1}>
            <g transform="translate(540,620) scale(2.4)">
              <rect x={-38} y={-55} width={76} height={110} rx={12} fill={C.teeth} />
            </g>
            <g transform="translate(540,1300) scale(2.4)">
              <rect x={-38} y={-55} width={76} height={110} rx={12} fill={C.teeth} />
            </g>
          </g>

          {/* Center dashed axis */}
          <line x1={540} y1={340} x2={540} y2={1620} stroke={C.metalDk} strokeWidth={2}
            strokeDasharray="14 9" opacity={0.28} />

          {/* HERO tooth — giant, 3.2× scale */}
          <g transform={`translate(540,960) scale(${toothPop * 3.2})`}>
            <rect x={-38} y={-55} width={76} height={110} rx={12} fill={C.teeth} />
            {/* Hook bump top */}
            <circle cx={0} cy={-55} r={20} fill={C.teethDk} />
            {/* Hollow scoop bottom */}
            <ellipse cx={0} cy={55} rx={17} ry={11} fill={C.bg} />
            {/* Shine sweep */}
            <rect x={-14} y={-50} width={10} height={90} rx={5} fill="rgba(255,255,255,0.28)"
              opacity={shimAlpha} />
          </g>

          {/* HOOK label — left side */}
          <g opacity={hookIn}>
            <line x1={480} y1={842} x2={540} y2={842} stroke={C.snap} strokeWidth={3}
              transform={`translate(${-30*(1-hookIn)},0)`} />
            <line x1={480} y1={842} x2={480} y2={900} stroke={C.snap} strokeWidth={3}
              transform={`translate(${-30*(1-hookIn)},0)`} />
            <rect x={180} y={812} width={290} height={58} rx={29} fill={C.snap}
              transform={`translate(${-30*(1-hookIn)},0)`} />
            <text x={325} y={848} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900}
              fontFamily="Arial Black,sans-serif" transform={`translate(${-30*(1-hookIn)},0)`}>HOOK ↑</text>
          </g>

          {/* HOLLOW label — right side */}
          <g opacity={hollowIn}>
            <line x1={600} y1={1078} x2={540} y2={1078} stroke={C.accent} strokeWidth={3}
              transform={`translate(${30*(1-hollowIn)},0)`} />
            <line x1={600} y1={1078} x2={600} y2={1020} stroke={C.accent} strokeWidth={3}
              transform={`translate(${30*(1-hollowIn)},0)`} />
            <rect x={610} y={1048} width={260} height={58} rx={29} fill={C.accent}
              transform={`translate(${30*(1-hollowIn)},0)`} />
            <text x={740} y={1084} textAnchor="middle" fill={C.ink} fontSize={36} fontWeight={900}
              fontFamily="Arial Black,sans-serif" transform={`translate(${30*(1-hollowIn)},0)`}>HOLLOW ↓</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: Y-CHANNEL — top-down schematic, teeth cammed sideways ───────────
function SceneYChannel() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entryPop = spring({ frame, fps, config:{ damping:100, mass:0.5, stiffness:200 } });
  const yGlow    = spring({ frame:frame-8, fps, config:{ damping:120, mass:0.6, stiffness:160 } });
  const feedOff  = (frame * 5) % 100;

  // Sideways push arrows pulse
  const pulse1 = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const pulse2 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 1.2);
  const pulse3 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 2.4);
  const pulse4 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 3.6);

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position:'absolute', inset:0 }}>
          <defs>
            <marker id="arD" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L5,3 L0,6 Z" fill={C.danger} />
            </marker>
          </defs>

          {/* Header */}
          <text x={540} y={200} textAnchor="middle" fill={C.key} fontSize={46} fontWeight={900}
            fontFamily="Arial Black,sans-serif" opacity={yGlow}>Y-CHANNEL (inside slider)</text>

          {/* Slider body top-down */}
          <g transform={`translate(540,960) scale(${entryPop})`}>
            <rect x={-210} y={-360} width={420} height={720} rx={32} fill={C.metalDk} opacity={0.75} />
            {/* Y channel carved out: two mouths → one stem */}
            <path d="M -100,-360 L -100,-110 L 0,0 L 100,-110 L 100,-360" fill={C.bg} />
            <rect x={-30} y={0} width={60} height={360} fill={C.bg} />
            {/* Y channel glow outline */}
            <path d="M -100,-360 L -100,-110 L 0,0 L 100,-110 L 100,-360" fill="none"
              stroke={C.key} strokeWidth={5} opacity={yGlow} />
            <rect x={-30} y={0} width={60} height={360} fill="none"
              stroke={C.key} strokeWidth={5} opacity={yGlow} />
          </g>

          {/* Left mouth teeth flowing in — deflecting right as they descend */}
          {[0,1,2].map(i => {
            const baseY = 630 + i * 95 - feedOff;
            if (baseY < 510 || baseY > 870) return null;
            const deflect = interpolate(baseY, [630, 870], [80, 0], clamp);
            return (
              <g key={`yl${i}`} transform={`translate(${440 - deflect},${baseY})`}>
                <rect x={-22} y={-14} width={44} height={28} rx={6} fill={C.teeth} opacity={0.9} />
                <circle cx={-12} cy={-14} r={7} fill={C.teethDk} opacity={0.9} />
              </g>
            );
          })}
          {/* Right mouth teeth flowing in — deflecting left */}
          {[0,1,2].map(i => {
            const baseY = 630 + i * 95 - feedOff;
            if (baseY < 510 || baseY > 870) return null;
            const deflect = interpolate(baseY, [630, 870], [80, 0], clamp);
            return (
              <g key={`yr${i}`} transform={`translate(${640 + deflect},${baseY})`}>
                <rect x={-22} y={-14} width={44} height={28} rx={6} fill={C.teeth} opacity={0.9} />
                <circle cx={12} cy={-14} r={7} fill={C.teethDk} opacity={0.9} />
              </g>
            );
          })}

          {/* Merged output — stem — snappy green */}
          {[0,1,2].map(i => {
            const baseY = 980 + i * 85 + feedOff;
            if (baseY > 1280) return null;
            return (
              <g key={`ym${i}`} transform={`translate(540,${baseY})`}>
                <rect x={-22} y={-14} width={44} height={28} rx={6} fill={C.snap} opacity={0.9} />
              </g>
            );
          })}

          {/* Sideways push arrows — 4 rows */}
          {[[700, pulse1],[762, pulse2],[824, pulse3],[886, pulse4]].map(([y,p],i) => (
            <g key={`pa${i}`} opacity={p as number}>
              <line x1={385} y1={y as number} x2={450} y2={y as number}
                stroke={C.danger} strokeWidth={5} markerEnd="url(#arD)" />
              <line x1={695} y1={y as number} x2={630} y2={y as number}
                stroke={C.danger} strokeWidth={5} markerEnd="url(#arD)" />
            </g>
          ))}

          {/* Labels */}
          <text x={330} y={490} textAnchor="middle" fill={C.teeth} fontSize={30} fontWeight={700}
            fontFamily="Arial Black,sans-serif" opacity={yGlow}>LEFT</text>
          <text x={750} y={490} textAnchor="middle" fill={C.teeth} fontSize={30} fontWeight={700}
            fontFamily="Arial Black,sans-serif" opacity={yGlow}>RIGHT</text>
          <text x={540} y={1320} textAnchor="middle" fill={C.snap} fontSize={30} fontWeight={700}
            fontFamily="Arial Black,sans-serif" opacity={yGlow}>FUSED ✓</text>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: SNAP-LOCK — hook drives into hollow, trail pin, recoil ──────────
function SceneLockSnap() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SNAP_F = 22;
  const snapIn    = spring({ frame:frame-SNAP_F, fps, config:{ damping:55, mass:0.5, stiffness:320 } });
  const flashAlph = interpolate(frame, [SNAP_F, SNAP_F+5, SNAP_F+13], [0,1,0], clamp);
  // screen shake: fixed offsets to avoid Math.random in render
  const shakeX    = frame >= SNAP_F && frame < SNAP_F+8 ? [0,4,-4,6,-6,3,-3,1][frame-SNAP_F] ?? 0 : 0;
  const lockedPop = spring({ frame:frame-SNAP_F-2, fps, config:{ damping:80, mass:0.5, stiffness:220 } });
  const pinPop    = spring({ frame:frame-44, fps, config:{ damping:100, mass:0.55, stiffness:200 } });
  const rejectPop = spring({ frame:frame-65, fps, config:{ damping:50, mass:0.7, stiffness:180 } });
  const rejectRec = frame >= 100 ? interpolate(frame, [100, 124], [1, 0], clamp) : 0;

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920}
          style={{ position:'absolute', inset:0, transform:`translateX(${shakeX}px)` }}>
          <defs>
            <radialGradient id="rg1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={C.snap} stopOpacity={flashAlph * 0.9} />
              <stop offset="100%" stopColor={C.snap} stopOpacity={0} />
            </radialGradient>
            <marker id="arR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.danger} />
            </marker>
          </defs>

          {/* Flash burst */}
          <ellipse cx={540} cy={880} rx={380} ry={260} fill="url(#rg1)" />

          {/* Spark lines on snap */}
          {frame >= SNAP_F && frame < SNAP_F+18 && [0,45,90,135,180,225,270,315].map((ang,i) => {
            const r = (frame - SNAP_F) * 22;
            const rad = ang * Math.PI / 180;
            return <line key={i}
              x1={540} y1={880} x2={540+Math.cos(rad)*r} y2={880+Math.sin(rad)*r}
              stroke={C.snap} strokeWidth={4} opacity={1 - (frame-SNAP_F)/18} />;
          })}

          {/* LEFT tooth driving in */}
          <g transform={`translate(${400 + snapIn * 130}, 880) scale(1.6)`}>
            <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.teeth} />
            {/* Hook glow on approach */}
            <circle cx={0} cy={-18} r={12} fill={C.snap} opacity={snapIn * 0.85} />
          </g>

          {/* RIGHT tooth — receiving */}
          <g transform="translate(680,880) scale(1.6)">
            <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.teeth} />
            {/* Hollow */}
            <ellipse cx={0} cy={18} rx={11} ry={7} fill={C.bg} opacity={0.8} />
          </g>

          {/* LOCKED burst label */}
          <g transform={`translate(540,770) scale(${lockedPop})`} opacity={lockedPop}>
            <rect x={-115} y={-32} width={230} height={64} rx={32} fill={C.snap} />
            <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={44} fontWeight={900}
              fontFamily="Arial Black,sans-serif">LOCKED ✓</text>
          </g>

          {/* PINNING tooth from behind (presses in lower) */}
          <g transform={`translate(540,${1000 - pinPop * 110}) scale(${pinPop * 1.15})`} opacity={pinPop}>
            <rect x={-30} y={-18} width={60} height={36} rx={8} fill={C.metalDk} />
            <text x={0} y={56} textAnchor="middle" fill={C.key} fontSize={26} fontWeight={900}
              fontFamily="Arial Black,sans-serif">PIN</text>
          </g>

          {/* Red pull-force arrow that recoils */}
          <g transform={`translate(${285 - rejectPop*90 + rejectRec*90}, 880)`}
            opacity={rejectPop * (1 - rejectRec * 0.5)}>
            <line x1={0} y1={0} x2={130} y2={0} stroke={C.danger} strokeWidth={9}
              markerEnd="url(#arR)" strokeLinecap="round" />
            <text x={65} y={-22} textAnchor="middle" fill={C.danger} fontSize={26} fontWeight={900}
              fontFamily="Arial Black,sans-serif">pull force</text>
          </g>

          {/* Shield stopper */}
          <g transform="translate(410,880)" opacity={pinPop}>
            <polygon points="0,-32 28,-16 28,16 0,32 -28,16 -28,-16" fill={C.key} />
            <text x={0} y={10} textAnchor="middle" fill={C.ink} fontSize={24} fontWeight={900}
              fontFamily="Arial Black,sans-serif">▮</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF — one tooth breaks, whole seam fails, punchline ──────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const CRACK_F = 28;
  const crackFlash  = interpolate(frame, [CRACK_F, CRACK_F+4, CRACK_F+11], [0,1,0], clamp);
  const brokenFly   = spring({ frame:frame-CRACK_F, fps, config:{ damping:55, mass:0.6, stiffness:220 } });
  const unzip       = interpolate(frame, [CRACK_F+5, CRACK_F+55], [0,1], clamp);
  const BROKEN_I    = 7;
  const NUM_T       = 14;

  const w1 = spring({ frame:frame-60, fps, config:{ damping:85, mass:0.5, stiffness:210 } });
  const w2 = spring({ frame:frame-76, fps, config:{ damping:85, mass:0.5, stiffness:210 } });
  const w3 = spring({ frame:frame-92, fps, config:{ damping:85, mass:0.5, stiffness:210 } });

  return (
    <AbsoluteFill style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.bgMid} 100%)` }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position:'absolute', inset:0 }}>
          {/* Danger flash */}
          <rect x={0} y={0} width={1080} height={1920} fill={C.danger} opacity={crackFlash * 0.28} />

          {/* Fabric tapes */}
          <rect x={80} y={270} width={150} height={1060} rx={10} fill={C.fabA}
            transform={`translate(${-unzip * 90}, 0)`} opacity={0.45} />
          <rect x={850} y={270} width={150} height={1060} rx={10} fill={C.fabB}
            transform={`translate(${unzip * 90}, 0)`} opacity={0.45} />

          {/* Teeth grid */}
          {Array.from({length:NUM_T}).map((_,i) => {
            const ty = 290 + i * 82;
            if (i === BROKEN_I) {
              return (
                <g key={i}>
                  {/* Broken tooth halves flying apart */}
                  <g transform={`translate(${390 - brokenFly*160},${ty - brokenFly*130}) rotate(${brokenFly*50})`}>
                    <rect x={-22} y={-14} width={44} height={28} rx={6} fill={C.danger} opacity={0.9} />
                    <line x1={-10} y1={-18} x2={10} y2={18} stroke={C.bg} strokeWidth={3} />
                  </g>
                  <g transform={`translate(${690 + brokenFly*160},${ty - brokenFly*130}) rotate(${-brokenFly*50})`}>
                    <rect x={-22} y={-14} width={44} height={28} rx={6} fill={C.danger} opacity={0.9} />
                    <line x1={-10} y1={-18} x2={10} y2={18} stroke={C.bg} strokeWidth={3} />
                  </g>
                  {/* Red gap circle */}
                  <circle cx={540} cy={ty} r={72} fill="none" stroke={C.danger} strokeWidth={7}
                    opacity={Math.min(1, brokenFly * 2.5)} strokeDasharray="16 9" />
                </g>
              );
            }
            const dist = Math.abs(i - BROKEN_I);
            const delay = dist * 0.1;
            const peel = i < BROKEN_I
              ? interpolate(unzip, [delay, Math.min(1, delay+0.28)], [0,1], clamp)
              : interpolate(unzip, [delay*0.6, Math.min(1, delay*0.6+0.28)], [0,1], clamp);
            return (
              <g key={i}>
                <g transform={`translate(${-peel*110}, 0)`}>
                  <rect x={368} y={ty-14} width={44} height={28} rx={6} fill={C.teeth} opacity={peel > 0.2 ? 0.3 : 0.88} />
                </g>
                <g transform={`translate(${peel*110}, 0)`}>
                  <rect x={668} y={ty-14} width={44} height={28} rx={6} fill={C.teeth} opacity={peel > 0.2 ? 0.3 : 0.88} />
                </g>
                {/* locked connector */}
                {peel < 0.15 && <line x1={412} y1={ty} x2={668} y2={ty} stroke={C.snap} strokeWidth={3} opacity={0.4} />}
              </g>
            );
          })}

          {/* Payoff text word-by-word */}
          <text x={540} y={1460} textAnchor="middle" fill={C.danger} fontSize={96} fontWeight={900}
            fontFamily="Arial Black,sans-serif"
            opacity={w1} transform={`translate(540,1460) scale(${w1}) translate(-540,-1460)`}>
            ONE TOOTH.
          </text>
          <text x={540} y={1570} textAnchor="middle" fill="white" fontSize={88} fontWeight={900}
            fontFamily="Arial Black,sans-serif"
            opacity={w2} transform={`translate(540,1570) scale(${w2}) translate(-540,-1570)`}>
            WHOLE ZIPPER.
          </text>
          <text x={540} y={1678} textAnchor="middle" fill={C.danger} fontSize={108} fontWeight={900}
            fontFamily="Arial Black,sans-serif"
            opacity={w3} transform={`translate(540,1678) scale(${w3}) translate(-540,-1678)`}>
            DEAD.
          </text>

          {/* Underline wipe */}
          <rect x={185} y={1684} width={710 * w3} height={8} rx={4} fill={C.danger} opacity={w3} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── ROOT COMPOSITION ─────────────────────────────────────────────────────────
export const Zipper: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio src={staticFile('zipper_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.13} />
      <Sequence from={S.hook}     durationInFrames={S.mystery - S.hook}>
        <SceneHook />
      </Sequence>
      <Sequence from={S.mystery}  durationInFrames={S.anatomy - S.mystery}>
        <SceneMystery />
      </Sequence>
      <Sequence from={S.anatomy}  durationInFrames={S.ychan - S.anatomy}>
        <SceneAnatomy />
      </Sequence>
      <Sequence from={S.ychan}    durationInFrames={S.lockSnap - S.ychan}>
        <SceneYChannel />
      </Sequence>
      <Sequence from={S.lockSnap} durationInFrames={S.payoff - S.lockSnap}>
        <SceneLockSnap />
      </Sequence>
      <Sequence from={S.payoff}   durationInFrames={DURATION_IN_FRAMES - S.payoff}>
        <ScenePayoff />
      </Sequence>

      <Captions />
    </AbsoluteFill>
  );
};

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
import bhWords from './bodyheat_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1169;

const C = {
  bgDeep: '#0c1118',
  bgPanel: '#141b26',
  gold: '#FFD23F',
  feverRed: '#FF4D3D',
  emberOrange: '#FF8A3D',
  coolBlue: '#3DB8FF',
  immuneTeal: '#2FE0C4',
  germViolet: '#9B6CFF',
  ashWhite: '#E8EEF5',
  ink: '#060b12',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const S = { hook: 0, pyrogens: 193, weapon: 485, kill: 576, hunt: 817, payoff: 959 };

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.06, 1.0], clamp);
  return <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>{children}</div>;
}

// ─── CAPTIONS ─────────────────────────────────────────────────────────────────
const WRAW: { w: string; s: number }[] = (bhWords as any).words.map((x: any) => ({ w: x.text, s: x.start }));
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

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 42%, ${C.bgPanel} 0%, ${C.bgDeep} 76%)` }} />;

// ─── SVG VECTOR COMPONENTS ───────────────────────────────────────────────────

function BodySilhouette({ scale = 1, cx = 540, cy = 960, stroke = C.immuneTeal, fill = 'none', strokeWidth = 8, opacity = 1 }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale}) translate(-540, -960)`} opacity={opacity}>
      {/* Head */}
      <circle cx={540} cy={760} r={45} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Neck */}
      <path d="M 525,805 L 525,825 L 555,825 L 555,805" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Shoulders / Torso */}
      <path d="M 460,845 Q 540,830 620,845 L 590,1040 Q 540,1050 490,1040 Z" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Arms */}
      <path d="M 460,845 Q 410,950 430,1060" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M 620,845 Q 670,950 650,1060" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Legs */}
      <path d="M 500,1040 Q 480,1200 500,1360" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M 580,1040 Q 600,1200 580,1360" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </g>
  );
}

function Thermometer({ cx = 540, cy = 960, scale = 1, fluidHeight = 0, fluidColor = C.coolBlue, glowColor = 'none', textVal = '' }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale}) translate(-540, -960)`}>
      {/* Glow */}
      {glowColor !== 'none' && <circle cx={540} cy={1100} r={180} fill={glowColor} opacity={0.16} />}
      {/* Outer Glass Tube */}
      <rect x={515} y={550} width={50} height={520} rx={25} fill="none" stroke={C.ashWhite} strokeWidth={6} />
      {/* Outer Bulb */}
      <circle cx={540} cy={1100} r={65} fill={C.bgDeep} stroke={C.ashWhite} strokeWidth={6} />
      <path d="M 517,1050 A 65 65 0 0 1 563,1050" fill={C.bgDeep} stroke={C.bgDeep} strokeWidth={8} /> {/* connection mask */}
      
      {/* Ticks 35 - 42 */}
      {Array.from({ length: 8 }).map((_, i) => {
        const ty = 980 - i * 55;
        const temp = 35 + i;
        return (
          <g key={i}>
            <line x1={545} y1={ty} x2={560} y2={ty} stroke={C.ashWhite} strokeWidth={2} />
            <text x={575} y={ty + 6} fill={C.ashWhite} fontSize={16} fontWeight={700} fontFamily="Poppins">{temp}°C</text>
          </g>
        );
      })}

      {/* Fluid Bulb */}
      <circle cx={540} cy={1100} r={50} fill={fluidColor} />
      {/* Fluid Column */}
      <rect x={527} y={1050 - fluidHeight} width={26} height={fluidHeight + 20} rx={13} fill={fluidColor} />

      {/* Digital Readout Pill */}
      {textVal && (
        <g transform="translate(680, 800)">
          <rect x={-80} y={-30} width={160} height={60} rx={15} fill={C.bgPanel} stroke={fluidColor} strokeWidth={3} />
          <text x={0} y={10} textAnchor="middle" fill={C.white} fontSize={28} fontWeight={900} fontFamily="Poppins">{textVal}</text>
        </g>
      )}
    </g>
  );
}

function Germ({ cx = 540, cy = 960, scale = 1, wobbly = 0, opacity = 1, cracked = false }) {
  const points = [];
  const numPoints = 10;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    const r = (50 + 10 * Math.sin(angle * 3 + wobbly)) * scale;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  const pathData = `M ${points.join(' L ')} Z`;

  return (
    <g opacity={opacity}>
      {/* Germ body */}
      <path d={pathData} fill={C.germViolet} stroke={C.white} strokeWidth={4} />
      {/* Eyes */}
      <circle cx={cx - 15 * scale} cy={cy - 10 * scale} r={6 * scale} fill={C.ink} />
      <circle cx={cx + 15 * scale} cy={cy - 10 * scale} r={6 * scale} fill={C.ink} />
      {/* Angry eyebrows */}
      <path d={`M ${cx - 25 * scale},${cy - 22 * scale} L ${cx - 5 * scale},${cy - 14 * scale}`} stroke={C.white} strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${cx + 25 * scale},${cy - 22 * scale} L ${cx + 5 * scale},${cy - 14 * scale}`} stroke={C.white} strokeWidth={3} strokeLinecap="round" />
      {/* Flagella */}
      <path d={`M ${cx - 45 * scale},${cy} Q ${cx - 80 * scale},${cy - 10 * scale} ${cx - 100 * scale},${cy + 10 * scale}`} fill="none" stroke={C.germViolet} strokeWidth={4} strokeLinecap="round" />
      <path d={`M ${cx - 35 * scale},${cy + 30 * scale} Q ${cx - 70 * scale},${cy + 40 * scale} ${cx - 85 * scale},${cy + 60 * scale}`} fill="none" stroke={C.germViolet} strokeWidth={4} strokeLinecap="round" />
      
      {/* Cracks */}
      {cracked && (
        <>
          <line x1={cx - 30 * scale} y1={cy} x2={cx + 30 * scale} y2={cy} stroke={C.feverRed} strokeWidth={4} strokeLinecap="round" />
          <line x1={cx} y1={cy - 30 * scale} x2={cx} y2={cy + 30 * scale} stroke={C.feverRed} strokeWidth={4} strokeLinecap="round" />
          <line x1={cx - 20 * scale} y1={cy - 20 * scale} x2={cx + 20 * scale} y2={cy + 20 * scale} stroke={C.feverRed} strokeWidth={4} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function GermRod({ cx = 540, cy = 960, scale = 1, angle = 0, opacity = 1, cracked = false }) {
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle}) scale(${scale})`} opacity={opacity}>
      <rect x={-50} y={-25} width={100} height={50} rx={25} fill={C.germViolet} stroke={C.white} strokeWidth={4} />
      {/* Angry face */}
      <circle cx={-15} cy={-5} r={5} fill={C.ink} />
      <circle cx={15} cy={-5} r={5} fill={C.ink} />
      <path d="M -22,-15 L -8,-10" stroke={C.white} strokeWidth={2} />
      <path d="M 22,-15 L 8,-10" stroke={C.white} strokeWidth={2} />
      {/* Cracks */}
      {cracked && (
        <>
          <path d="M -30,10 L 30,-10 M -10,-20 L 10,20" stroke={C.feverRed} strokeWidth={4} />
        </>
      )}
    </g>
  );
}

function ImmuneCell({ cx = 540, cy = 960, scale = 1 }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <circle cx={0} cy={0} r={50} fill={C.immuneTeal} stroke={C.white} strokeWidth={4} />
      {/* Surface bumps */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 2 * Math.PI) / 8;
        return <circle key={i} cx={50 * Math.cos(a)} cy={50 * Math.sin(a)} r={12} fill={C.immuneTeal} stroke={C.white} strokeWidth={2} />;
      })}
      {/* Inner nucleus */}
      <circle cx={0} cy={0} r={22} fill="#14beaa" opacity={0.6} />
    </g>
  );
}

function ShiveringFigure({ cx = 540, cy = 960, scale = 1, shiverOffset = 0, heatWaves = 0 }) {
  const sy = shiverOffset;
  return (
    <g transform={`translate(${cx + sy}, ${cy}) scale(${scale})`} stroke={C.ashWhite} strokeWidth={6} fill="none" strokeLinecap="round">
      {/* Head */}
      <circle cx={0} cy={-120} r={25} />
      {/* Torso */}
      <line x1={0} y1={-95} x2={0} y2={0} />
      {/* Arms */}
      <path d="M -50,-60 L 0,-80 L 50,-60" />
      {/* Legs */}
      <path d="M -30,80 L 0,0 L 30,80" />

      {/* Shiver motion ticks (light-blue) */}
      <path d="M -80,-120 L -60,-120 M -80,-70 L -60,-70 M 60,-120 L 80,-120 M 60,-70 L 80,-70" stroke={C.coolBlue} strokeWidth={3} opacity={0.6} />

      {/* Wavy ember-orange heat lines */}
      {heatWaves > 0 && Array.from({ length: 3 }).map((_, i) => {
        const hx = -30 + i * 30;
        const wave = Math.sin(heatWaves * 0.2 + i) * 10;
        return (
          <path key={i} d={`M ${hx},120 Q ${hx + wave},80 ${hx},-40 Q ${hx - wave},-100 ${hx},-160`} stroke={C.emberOrange} strokeWidth={4} opacity={0.5} />
        );
      })}
    </g>
  );
}

// ─── SCENE 1: HOOK (0 - 193) ──────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Thermometer draws-on (0 - 12 frames)
  const drawTherm = spring({ frame, fps, config: { damping: 15, mass: 0.5, stiffness: 180 } });
  
  // Body outlines traces on (10 - 25 frames)
  const drawBody = interpolate(frame, [10, 25], [0, 1], clamp);
  
  // Germ slams in from left (15 - 30 frames)
  const germX = interpolate(frame, [15, 30], [-150, 415], clamp);
  const germY = interpolate(frame, [15, 30], [900, 930], clamp);
  const germScale = spring({ frame: frame - 15, fps, config: { damping: 12, mass: 0.6, stiffness: 160 } });
  
  // Breach lines (30 - 45 frames)
  const breach = interpolate(frame, [30, 45], [0, 1], clamp);
  
  // Badge pop (21+ frames)
  const badgeScale = spring({ frame: frame - 21, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });

  // Fluid columns teases up two ticks (40 - 65 frames)
  const fluidHeight = interpolate(frame, [40, 65], [120, 180], clamp); // cool-blue level

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Body Silhouette */}
          {drawBody > 0 && <BodySilhouette scale={1.1} cx={540} cy={980} opacity={drawBody} />}
          
          {/* Thermometer */}
          {drawTherm > 0 && (
            <Thermometer 
              scale={drawTherm * 1.05} 
              cx={540} 
              cy={980} 
              fluidHeight={fluidHeight} 
              fluidColor={C.coolBlue}
              textVal="37°C"
            />
          )}

          {/* Jagged breach cracks on the body profile */}
          {breach > 0 && (
            <g stroke={C.feverRed} strokeWidth={6} fill="none" strokeLinecap="round" opacity={breach}>
              <path d="M 435,930 L 415,920 L 425,940 L 410,950" />
              <path d="M 445,950 L 455,970 L 440,980 L 450,995" />
            </g>
          )}

          {/* Germ */}
          {frame >= 15 && (
            <g transform={`translate(${germX}, ${germY}) scale(${germScale}) translate(-415, -930)`}>
              <Germ cx={415} cy={930} scale={0.7} wobbly={frame * 0.12} />
            </g>
          )}

          {/* Badge 'ON PURPOSE?!' */}
          {badgeScale > 0.01 && (
            <g transform={`translate(540, 420) scale(${badgeScale})`} opacity={badgeScale}>
              <rect x={-200} y={-45} width={400} height={90} rx={22} fill={C.gold} />
              <text x={0} y={12} textAnchor="middle" fill={C.ink} fontSize={40} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">ON PURPOSE?!</text>
              {/* Spark icon */}
              <path d="M 160,-20 L 175,-5 L 160,10 L 165,-5 Z" fill={C.gold} transform="scale(1.5) translate(-115, 5)" />
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: PYROGENS (193 - 485) ────────────────────────────────────────────
function ScenePyrogens() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Cells pop in (0 - 15)
  const cellScale = spring({ frame, fps, config: { damping: 15, mass: 0.6, stiffness: 170 } });
  
  // Pyrogen labels pops (25+)
  const pyrogenPill = spring({ frame: frame - 25, fps, config: { damping: 14, mass: 0.5, stiffness: 180 } });

  // Signal dotted line traces up to brain (30 - 90 frames)
  const signalProgress = interpolate(frame, [30, 90], [0, 1], clamp);

  // Brain knob pulses gold (90+)
  const brainKnobScale = spring({ frame: frame - 90, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  // Stick figure shivers continually
  const shiverOffset = Math.sin(frame * 1.5) * 6;
  const heatWaves = frame;

  // Head Profile drawing
  const headOutline = interpolate(frame, [15, 45], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Head Profile Silhouette (upper right) */}
          <g opacity={headOutline} stroke={C.ashWhite} strokeWidth={5} fill="none" strokeLinecap="round" transform="translate(100, 20)">
            <path d="M 680,680 C 680,640 700,500 780,480 C 860,460 920,520 900,640 C 900,680 920,700 880,780 C 850,840 820,840 820,840" />
            {/* Hypothalamus Tag */}
            <g transform="translate(800, 600)">
              <circle cx={0} cy={0} r={15 * (1 + 0.15 * Math.sin(frame * 0.15))} fill={C.gold} stroke={C.white} strokeWidth={2} />
              {brainKnobScale > 0.01 && (
                <g transform={`translate(0, -60) scale(${brainKnobScale})`}>
                  <rect x={-130} y={-24} width={260} height={48} rx={12} fill={C.bgPanel} stroke={C.gold} strokeWidth={2} />
                  <text x={0} y={8} textAnchor="middle" fill={C.gold} fontSize={20} fontWeight={900} fontFamily="Poppins">HYPOTHALAMUS</text>
                </g>
              )}
            </g>
          </g>

          {/* Dotted Signal line (cells -> hypothalamus) */}
          <path 
            d="M 280,1260 Q 500,1050 800,620" 
            fill="none" 
            stroke={C.gold} 
            strokeWidth={5} 
            strokeDasharray="10, 10"
            pathLength={100}
            strokeDashoffset={100 * (1 - signalProgress)}
          />

          {/* Immune Cells (lower left) */}
          {cellScale > 0.01 && (
            <g transform={`translate(200, 1300) scale(${cellScale})`}>
              <ImmuneCell cx={0} cy={0} scale={1.1} />
              <ImmuneCell cx={90} cy={80} scale={0.8} />
            </g>
          )}

          {/* Pyrogens label pill */}
          {pyrogenPill > 0.01 && (
            <g transform={`translate(250, 1140) scale(${pyrogenPill})`} opacity={pyrogenPill}>
              <rect x={-90} y={-26} width={180} height={52} rx={15} fill={C.gold} />
              <text x={0} y={8} textAnchor="middle" fill={C.ink} fontSize={22} fontWeight={900} fontFamily="Poppins">PYROGENS</text>
            </g>
          )}

          {/* Dotted Alarm particles flying along signal path */}
          {signalProgress > 0.1 && Array.from({ length: 4 }).map((_, i) => {
            const t = ((frame * 2.2 + i * 25) % 100) / 100;
            // Bezier quadratic interpolation for Q 500,1050
            const x = (1 - t) * (1 - t) * 280 + 2 * (1 - t) * t * 500 + t * t * 800;
            const y = (1 - t) * (1 - t) * 1260 + 2 * (1 - t) * t * 1050 + t * t * 620;
            return <circle key={i} cx={x} cy={y} r={7} fill={C.gold} opacity={1 - t} />;
          })}

          {/* Shivering Stick Figure (bottom right) */}
          <ShiveringFigure cx={760} cy={1360} scale={1.2} shiverOffset={shiverOffset} heatWaves={heatWaves} />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: WEAPON (485 - 576) ──────────────────────────────────────────────
function SceneWeapon() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // "malfunction" text pops (0 - 10 frames)
  const malScale = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  // Strikeout line draws (15 - 28 frames)
  const strike = interpolate(frame, [15, 28], [0, 1], clamp);
  
  // Fade out malfunction, fade in weapon (30 - 45 frames)
  const opMal = interpolate(frame, [30, 42], [1, 0], clamp);
  const shieldProgress = spring({ frame: frame - 30, fps, config: { damping: 15, mass: 0.6, stiffness: 160 } });

  // Morph shield into blade (50 - 68 frames)
  const morph = interpolate(frame, [50, 68], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Malfunction Label with Strikeout */}
          {opMal > 0 && (
            <g transform={`translate(540, 900) scale(${malScale})`} opacity={opMal}>
              <text x={0} y={15} textAnchor="middle" fill={C.feverRed} fontSize={70} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif" letterSpacing={2}>MALFUNCTION</text>
              <line x1={-260} y1={-5} x2={-260 + 520 * strike} y2={-5} stroke={C.white} strokeWidth={8} strokeLinecap="round" />
            </g>
          )}

          {/* Shield/Weapon Morph */}
          {frame >= 30 && (
            <g transform="translate(540, 960)">
              {/* Shield/Weapon SVG Path */}
              {/* morph = 0 is a shield, morph = 1 is a sword blade pointing UP */}
              <path 
                d={
                  morph < 0.01 
                    ? "M 0,-160 C 110,-160 130,-70 110,60 C 80,140 0,190 0,190 C 0,190 -80,140 -110,60 C -130,-70 -110,-160 0,-160 Z"
                    : `M ${interpolate(morph, [0, 1], [0, 0])},${interpolate(morph, [0, 1], [-160, -280])} 
                       C ${interpolate(morph, [0, 1], [110, 45])},${interpolate(morph, [0, 1], [-160, -220])} 
                         ${interpolate(morph, [0, 1], [130, 40])},${interpolate(morph, [0, 1], [-70, 120])} 
                         ${interpolate(morph, [0, 1], [110, 30])},${interpolate(morph, [0, 1], [60, 180])} 
                       L 0,220 
                       L ${interpolate(morph, [0, 1], [-110, -30])},${interpolate(morph, [0, 1], [60, 180])}
                       C ${interpolate(morph, [0, 1], [-130, -40])},${interpolate(morph, [0, 1], [-70, 120])} 
                         ${interpolate(morph, [0, 1], [-110, -45])},${interpolate(morph, [0, 1], [-160, -220])} 
                         0,${interpolate(morph, [0, 1], [-160, -280])} Z`
                }
                fill="none" 
                stroke={C.gold} 
                strokeWidth={10} 
                strokeLinejoin="round"
                transform={`scale(${shieldProgress})`}
                opacity={shieldProgress}
              />
              
              {/* Sword Hilt draws at morph = 1 */}
              {morph > 0.1 && (
                <g opacity={morph} stroke={C.gold} strokeWidth={8} fill="none" strokeLinecap="round">
                  {/* Guard */}
                  <line x1={-80} y1={180} x2={80} y2={180} />
                  {/* Handle */}
                  <line x1={0} y1={180} x2={0} y2={260} />
                  {/* Pommel */}
                  <circle cx={0} cy={270} r={10} fill={C.gold} />
                </g>
              )}

              {/* Sparks popping from weapon tip when fully morphed */}
              {frame >= 68 && (
                <g>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const angle = (i * 2 * Math.PI) / 6;
                    const pop = spring({ frame: frame - 68, fps, config: { damping: 10, mass: 0.4, stiffness: 190 } });
                    const px = Math.cos(angle) * 110 * pop;
                    const py = -280 + Math.sin(angle) * 70 * pop;
                    return <circle key={i} cx={px} cy={py} r={6 * (1 - pop)} fill={C.emberOrange} />;
                  })}
                </g>
              )}
            </g>
          )}

          {/* Weapon subtitle badge */}
          {morph > 0.7 && (
            <g transform={`translate(540, 460)`} opacity={interpolate(frame, [65, 75], [0, 1], clamp)}>
              <rect x={-140} y={-30} width={280} height={60} rx={15} fill={C.bgPanel} stroke={C.gold} strokeWidth={2} />
              <text x={0} y={10} textAnchor="middle" fill={C.gold} fontSize={28} fontWeight={900} fontFamily="Poppins">IT'S A WEAPON.</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: KILL (576 - 817) ────────────────────────────────────────────────
function SceneKill() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Surge of mercury column (10 - 70 frames)
  const progress = interpolate(frame, [10, 70], [0, 1], clamp);
  const fluidHeight = interpolate(progress, [0, 1], [180, 345]);
  
  // Readout text counter: 37 -> 40
  const curTemp = interpolate(progress, [0, 1], [37.0, 40.2]).toFixed(1);

  // Color morph: cool-blue -> ember-orange -> fever-red
  const fluidColor = interpolate(progress, [0, 0.5, 1], [0, 1, 2], clamp) < 1
    ? C.coolBlue
    : progress < 0.8 ? C.emberOrange : C.feverRed;

  // Red glow behind thermometer pulses twice (at 25 and 65)
  const pulse1 = Math.max(0, Math.sin(interpolate(frame, [20, 50], [0, Math.PI], clamp)));
  const pulse2 = Math.max(0, Math.sin(interpolate(frame, [60, 90], [0, Math.PI], clamp)));
  const glowOpacity = Math.max(pulse1 * 0.25, pulse2 * 0.35);

  // Germs around the bulb (540, 1100): Rod + Virus
  const germCrack = frame >= 50;
  const germScale = interpolate(frame, [50, 95], [1, 0.4], clamp);
  const germOpacity = interpolate(frame, [50, 95], [1, 0.2], clamp);
  const germFall = interpolate(frame, [60, 110], [0, 400], clamp); // sink to bottom

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Background Heat Pulse Halo */}
          {glowOpacity > 0.01 && <circle cx={540} cy={1100} r={500} fill={C.feverRed} opacity={glowOpacity} />}

          {/* Sinking/Dying Germs around the bulb */}
          <g transform={`translate(-180, ${-80 + germFall})`}>
            <Germ cx={540} cy={1100} scale={0.7 * germScale} opacity={germOpacity} wobbly={frame * (germCrack ? 0.3 : 0.1)} cracked={germCrack} />
          </g>
          <g transform={`translate(${180 + germFall * 0.3}, ${-130 + germFall})`}>
            <GermRod cx={540} cy={1100} scale={0.9 * germScale} opacity={germOpacity} angle={35 + frame} cracked={germCrack} />
          </g>

          {/* Thermometer */}
          <Thermometer 
            cx={540} 
            cy={960} 
            scale={1.1} 
            fluidHeight={fluidHeight} 
            fluidColor={fluidColor} 
            textVal={`${curTemp}°C`}
            glowColor={C.feverRed}
          />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: HUNT (817 - 959) ────────────────────────────────────────────────
function SceneHunt() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Curved paths trace on (0 - 30)
  const tracePath = interpolate(frame, [0, 30], [0, 1], clamp);

  // Immune cells move along trajectories (10 - 75)
  const progress = interpolate(frame, [10, 75], [0, 1], clamp);

  // Engulfing germ (50 - 75)
  const engulf = interpolate(frame, [50, 75], [0, 1], clamp);
  const germScale = interpolate(engulf, [0, 1], [0.65, 0], clamp);
  const cellSqueeze = interpolate(engulf, [0, 0.5, 1], [1, 1.3, 1], clamp);

  // Trajectory coords (Bezier Quad)
  const x1 = (1 - progress) * (1 - progress) * 150 + 2 * (1 - progress) * progress * 500 + progress * progress * 800;
  const y1 = (1 - progress) * (1 - progress) * 600 + 2 * (1 - progress) * progress * 700 + progress * progress * 820;

  const x2 = (1 - progress) * (1 - progress) * 900 + 2 * (1 - progress) * progress * 600 + progress * progress * 250;
  const y2 = (1 - progress) * (1 - progress) * 1400 + 2 * (1 - progress) * progress * 1200 + progress * progress * 1100;

  // Badge scale
  const huntBadge = spring({ frame: frame - 15, fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Background: warm fever red overlay */}
          <rect width={1080} height={1920} fill={C.feverRed} opacity={0.06} />

          {/* Gold Trajectory Lines */}
          <path d="M 150,600 Q 500,700 800,820" fill="none" stroke={C.gold} strokeWidth={4} strokeDasharray="12, 12" pathLength={100} strokeDashoffset={100 * (1 - tracePath)} opacity={0.4} />
          <path d="M 900,1400 Q 600,1200 250,1100" fill="none" stroke={C.gold} strokeWidth={4} strokeDasharray="12, 12" pathLength={100} strokeDashoffset={100 * (1 - tracePath)} opacity={0.4} />

          {/* Grey dying germs waiting to be engulfed */}
          {germScale > 0.001 && (
            <>
              <Germ cx={800} cy={820} scale={germScale} wobbly={0} opacity={0.5} cracked={true} />
              <Germ cx={250} cy={1100} scale={germScale} wobbly={0} opacity={0.5} cracked={true} />
            </>
          )}

          {/* Hunting Immune cells (Teal/White) streaking along paths */}
          {frame >= 10 && (
            <>
              {/* Lead Cell on Path 1 */}
              <g transform={`translate(${x1}, ${y1}) scale(${cellSqueeze})`}>
                <ImmuneCell cx={0} cy={0} scale={1.2} />
                {/* Speed trailing lines */}
                <path d="M -70,-10 Q -110,-30 -140,-20 M -70,20 Q -120,30 -150,10" fill="none" stroke={C.immuneTeal} strokeWidth={3} opacity={0.5} />
              </g>

              {/* Cell on Path 2 */}
              <g transform={`translate(${x2}, ${y2})`}>
                <ImmuneCell cx={0} cy={0} scale={0.9} />
                <path d="M 60,10 Q 110,-10 140,-20 M 60,-20 Q 110,-40 130,-10" fill="none" stroke={C.immuneTeal} strokeWidth={2} opacity={0.5} />
              </g>
            </>
          )}

          {/* HUNTING badge */}
          {huntBadge > 0.01 && (
            <g transform={`translate(540, 460) scale(${huntBadge})`}>
              <rect x={-90} y={-26} width={180} height={52} rx={15} fill={C.gold} />
              <text x={0} y={8} textAnchor="middle" fill={C.ink} fontSize={22} fontWeight={900} fontFamily="Poppins">HUNTING!</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF (959 - 1169) ─────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Aura breathe loop
  const auraBreathe = 1 + 0.04 * Math.sin(frame * 0.1);

  // Payoff words FLY in one-by-one
  const w1 = spring({ frame: frame - 5, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const w2 = spring({ frame: frame - 11, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const w3 = spring({ frame: frame - 17, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const w4 = spring({ frame: frame - 23, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
  const w5 = spring({ frame: frame - 29, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });

  // Gold checkmark coin (pops at 80+)
  const coin = spring({ frame: frame - 80, fps, config: { damping: 14, mass: 0.6, stiffness: 210 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {/* Steady Protective Aura (fever-red) */}
          <circle cx={540} cy={1000} r={280 * auraBreathe} fill={C.feverRed} opacity={0.08} />
          <circle cx={540} cy={1000} r={250 * auraBreathe} fill="none" stroke={C.feverRed} strokeWidth={6} opacity={0.25} />

          {/* Clean body outline stick figure (all germs dead) */}
          <BodySilhouette scale={1.15} cx={540} cy={1000} stroke={C.ashWhite} strokeWidth={7} />

          {/* Big Payoff Text */}
          <g transform="translate(540, 480)" textAnchor="middle" fontSize={60} fontWeight={900} fontFamily="Poppins,Arial Black,sans-serif">
            {w1 > 0.01 && <text x={0} y={-80} fill={C.white} transform={`scale(${w1})`} opacity={w1}>YOUR FEVER</text>}
            <text x={0} y={0}>
              {w2 > 0.01 && <tspan fill={C.gold} transform={`scale(${w2})`} opacity={w2}>COOKED </tspan>}
              {w3 > 0.01 && <tspan fill={C.white} transform={`scale(${w3})`} opacity={w3}>THEM</tspan>}
            </text>
            {w4 > 0.01 && <text x={0} y={80} fill={C.gold} transform={`scale(${w4})`} opacity={w4}>ALIVE!</text>}
          </g>

          {/* Gold checkmark coin */}
          {coin > 0.01 && (
            <g transform={`translate(540, 1500) scale(${coin})`} opacity={coin}>
              <circle cx={0} cy={0} r={65} fill={C.gold} />
              {/* checkmark vector */}
              <path d="M -30,0 L -10,20 L 30,-25" fill="none" stroke={C.ink} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Bodyheat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      {/* Audio Layer */}
      <Audio src={staticFile('bodyheat_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* Baked Scene SFX triggers */}
      <Sequence from={15} durationInFrames={100}>
        <Audio src={staticFile('sfx_invasion_punch.mp3')} volume={0.45} />
      </Sequence>
      <Sequence from={213} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.45} />
      </Sequence>
      <Sequence from={535} durationInFrames={100}>
        <Audio src={staticFile('sfx_weapon_shing.mp3')} volume={0.50} />
      </Sequence>
      <Sequence from={586} durationInFrames={120}>
        <Audio src={staticFile('sfx_fever_boom.wav')} volume={0.55} />
      </Sequence>
      <Sequence from={867} durationInFrames={100}>
        <Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.45} />
      </Sequence>
      <Sequence from={1039} durationInFrames={130}>
        <Audio src={staticFile('sfx_payoff_success.mp3')} volume={0.50} />
      </Sequence>

      {/* Visual Scenes */}
      <Sequence from={S.hook} durationInFrames={S.pyrogens - S.hook}>
        <SceneHook />
      </Sequence>
      <Sequence from={S.pyrogens} durationInFrames={S.weapon - S.pyrogens}>
        <ScenePyrogens />
      </Sequence>
      <Sequence from={S.weapon} durationInFrames={S.kill - S.weapon}>
        <SceneWeapon />
      </Sequence>
      <Sequence from={S.kill} durationInFrames={S.hunt - S.kill}>
        <SceneKill />
      </Sequence>
      <Sequence from={S.hunt} durationInFrames={S.payoff - S.hunt}>
        <SceneHunt />
      </Sequence>
      <Sequence from={S.payoff} durationInFrames={DURATION_IN_FRAMES - S.payoff}>
        <ScenePayoff />
      </Sequence>

      {/* Text Captions overlay */}
      {/* <Captions /> */}
    </AbsoluteFill>
  );
};

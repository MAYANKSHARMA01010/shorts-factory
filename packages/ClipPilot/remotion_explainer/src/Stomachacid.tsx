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

import stomachacidWords from './stomachacid_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1195;

const C = {
  bgDeep: '#0c0f14',
  bgPanel: '#141a22',
  gold: '#FFD23F',
  acidGreen: '#7CFF5A',
  acidGlow: '#A8FF8E',
  steel: '#9FB2C4',
  steelDark: '#5A6B7C',
  mucusBlue: '#4FC3E8',
  mucusGlow: '#9BE8FF',
  fleshRed: '#FF5C6E',
  ulcerEmber: '#FF8A3D',
  smokeGray: '#3A4654',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 151,
  scene3: 430,
  scene4: 621,
  scene5: 822,
  scene6: 1063,
};

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.05, 1.0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fadeIn,
        transform: `scale(${sc})`,
        transformOrigin: 'center',
      }}
    >
      {children}
    </div>
  );
}

const Bg = ({ color = C.bgDeep }) => (
  <AbsoluteFill style={{ backgroundColor: color }} />
);

// ─── SCENE 1: RAZOR BLADE ──────────────────────────────────────────────────────
function SceneRazor() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Acid climbs up the blade
  const acidH = interpolate(frame, [10, 40], [0, 500], clamp);
  
  // Badge slams
  const badgeS = spring({ frame: frame - 12, fps, config: { damping: 10, mass: 0.8, stiffness: 200 } });

  // Specular sweep
  const glintY = interpolate(frame, [20, 30], [-300, 300], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <defs>
            <radialGradient id="grad-vignette">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.8" />
            </radialGradient>
            <clipPath id="razor-clip">
              <path d="M -150,-400 L 150,-400 L 150,400 L 0,550 L -150,400 Z" />
            </clipPath>
          </defs>

          {/* Vignette */}
          <rect x={0} y={0} width={1080} height={1920} fill="url(#grad-vignette)" />

          {/* Center Group */}
          <g transform="translate(540, 960) scale(0.8)">
            
            {/* Beaker back */}
            <path d="M -300,0 L 300,0 L 300,600 L -300,600 Z" fill={C.bgPanel} opacity={0.5} />
            
            {/* Intact Razor Blade */}
            <g clipPath="url(#razor-clip)">
              {/* Blade Body */}
              <rect x={-150} y={-500} width={300} height={1100} fill={C.steelDark} />
              <path d="M -150,-500 L -150,400 L 0,550 L 150,400 L 150,-500 Z" fill="none" stroke={C.steel} strokeWidth={20} />
              
              {/* Inner cutouts */}
              <rect x={-30} y={-300} width={60} height={600} rx={30} fill={C.bgDeep} />
              <circle cx={0} cy={-200} r={50} fill={C.bgDeep} />
              <circle cx={0} cy={200} r={50} fill={C.bgDeep} />

              {/* Glint */}
              {frame > 20 && frame < 30 && (
                <rect x={-200} y={glintY} width={400} height={40} fill="#FFF" opacity={0.8} transform="rotate(20)" />
              )}
            </g>

            {/* Acid Bath */}
            <path d={`M -300,200 Q 0,${200 + Math.sin(frame*0.1)*10} 300,200 L 300,800 L -300,800 Z`} fill={C.acidGreen} opacity={0.7} />

            {/* Dissolved part of blade (covers the intact blade where acid is) */}
            <g clipPath="url(#razor-clip)">
              {/* Eaten Away mask */}
              <rect x={-200} y={200} width={400} height={acidH} fill={C.bgDeep} opacity={0.8} />
              {/* Glowing corroded edge */}
              <path d={`M -150,${200 + acidH} L 150,${200 + acidH}`} stroke={C.acidGlow} strokeWidth={15} opacity={0.8 + Math.sin(frame*0.3)*0.2} strokeDasharray="20 10" />
            </g>

            {/* Bubbles */}
            {Array.from({length: 20}).map((_, i) => (
              <circle key={i} cx={(i%5 - 2)*50 + Math.sin(frame*0.1 + i)*10} cy={600 - ((frame*3 + i*20) % 400)} r={Math.random()*8 + 4} fill={C.acidGreen} opacity={0.6} />
            ))}

            {/* Vapor */}
            <path d={`M -100,180 Q -150,100 -100,0`} stroke={C.acidGreen} strokeWidth={10} fill="none" opacity={0.3} filter="blur(5px)" strokeDasharray="100 100" strokeDashoffset={-frame*2} />
            <path d={`M 100,180 Q 150,100 100,0`} stroke={C.acidGreen} strokeWidth={10} fill="none" opacity={0.3} filter="blur(5px)" strokeDasharray="100 100" strokeDashoffset={-frame*3} />

          </g>

          {/* Badge */}
          {badgeS > 0.01 && (
            <g transform={`translate(540, 550) scale(${badgeS})`}>
              <rect x={-350} y={-60} width={700} height={120} rx={60} fill={C.gold} />
              <text x={-30} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">DISSOLVES STEEL</text>
              <circle cx={270} cy={0} r={40} fill={C.bgDeep} />
              <text x={270} y={15} textAnchor="middle" fill={C.gold} fontSize={45} fontWeight={900} fontFamily="Poppins, Arial Black">?</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: PUMP ────────────────────────────────────────────────────────────
function ScenePump() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Acid squirts
  const squirt1 = Math.max(0, Math.sin((frame - 10) * 0.3)) * 40;
  const squirt2 = Math.max(0, Math.sin((frame - 20) * 0.3)) * 40;
  
  // Tag draw on
  const tagW = interpolate(frame, [15, 25], [0, 100], clamp);

  // Dissolve items
  const itemS = spring({ frame: frame - 60, fps, config: { damping: 20, mass: 1, stiffness: 50 }, reverse: true });

  // Measuring tick
  const fillH = interpolate(frame, [40, 100], [0, 400], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Stomach outline */}
            <path d="M -300,-400 C -100,-400 0,-100 200,-100 C 400,-100 400,300 200,400 C -200,500 -400,200 -300,-400" fill={C.bgPanel} stroke={C.gold} strokeWidth={8} opacity={0.8} />

            {/* Glands */}
            <path d="M -250,-200 A 30 30 0 0 0 -220,-170" fill="none" stroke={C.fleshRed} strokeWidth={20} />
            <path d="M 280,100 A 30 30 0 0 0 250,70" fill="none" stroke={C.fleshRed} strokeWidth={20} />

            {/* Squirts */}
            {squirt1 > 0 && <line x1={-230} y1={-180} x2={-230 + squirt1} y2={-180 + squirt1} stroke={C.acidGreen} strokeWidth={15} strokeLinecap="round" />}
            {squirt2 > 0 && <line x1={260} y1={80} x2={260 - squirt2} y2={80 + squirt2} stroke={C.acidGreen} strokeWidth={15} strokeLinecap="round" />}

            {/* Tag */}
            <g transform="translate(-150, -250)">
              <rect x={0} y={0} width={tagW} height={40} rx={20} fill={C.gold} />
              {tagW > 50 && <text x={50} y={30} textAnchor="middle" fill={C.bgDeep} fontSize={25} fontWeight={900}>HCl</text>}
            </g>

            {/* Bath */}
            <path d="M -280,200 C 0,200 200,200 350,200 C 350,400 100,500 -200,400 Z" fill={C.acidGreen} opacity={0.6} />

            {/* Dissolving Items */}
            {frame < 90 && (
              <g transform={`scale(${Math.max(0.01, itemS)})`}>
                {/* Food chunk */}
                <path d="M -100,250 C -50,200 0,250 50,220 C 100,180 150,250 100,300 C 50,350 -50,350 -100,250" fill="#CD853F" />
                
                {/* Bacteria */}
                <ellipse cx={-150} cy={300} rx={40} ry={20} fill={C.fleshRed} transform="rotate(30, -150, 300)" />
                <path d={`M -110,280 Q -80,${280 + Math.sin(frame*0.5)*20} -50,280`} fill="none" stroke={C.fleshRed} strokeWidth={6} />
                
                <ellipse cx={180} cy={350} rx={30} ry={15} fill={C.fleshRed} transform="rotate(-20, 180, 350)" />
                <path d={`M 150,340 Q 120,${340 + Math.sin(frame*0.5)*20} 90,340`} fill="none" stroke={C.fleshRed} strokeWidth={6} />
              </g>
            )}

            {/* Fizz Bubbles on items */}
            {frame > 60 && frame < 90 && Array.from({length: 15}).map((_, i) => (
              <circle key={i} cx={(i%5 - 2)*60} cy={280 - ((frame*2 + i*15) % 100)} r={5 + Math.random()*5} fill={C.acidGreen} opacity={itemS} />
            ))}

            {/* Measuring Tick */}
            <g transform="translate(420, -100)">
              <rect x={0} y={0} width={40} height={400} rx={20} fill={C.bgPanel} stroke={C.steelDark} strokeWidth={4} />
              <rect x={0} y={400 - fillH} width={40} height={fillH} rx={20} fill={C.acidGreen} />
              {Array.from({length: 4}).map((_, i) => (
                <line key={i} x1={40} y1={(i+1)*80} x2={60} y2={(i+1)*80} stroke={C.steel} strokeWidth={4} />
              ))}
            </g>

          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: MUCUS ───────────────────────────────────────────────────────────
function SceneMucus() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gel wobble
  const wobble = Math.sin(frame * 0.15) * 20;

  // Badge
  const badgeS = spring({ frame: frame - 20, fps, config: { damping: 10, mass: 0.6, stiffness: 200 } });

  // Protective sweep
  const sweepX = interpolate(frame, [30, 60], [-540, 540], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 1050) scale(0.9)">
            
            {/* Flesh base */}
            <rect x={-540} y={0} width={1080} height={500} fill={C.fleshRed} />
            
            {/* Mucus layer */}
            <path d={`M -540,0 L -540,-200 Q -270,${-200 + wobble} 0,-200 Q 270,${-200 - wobble} 540,-200 L 540,0 Z`} fill={C.mucusBlue} opacity={0.9} />
            
            {/* Gel highlights */}
            <path d={`M -400,-180 Q -270,${-180 + wobble} -100,-180`} fill="none" stroke={C.mucusGlow} strokeWidth={15} strokeLinecap="round" />
            <path d={`M 100,-180 Q 270,${-180 - wobble} 400,-180`} fill="none" stroke={C.mucusGlow} strokeWidth={15} strokeLinecap="round" />

            {/* Sweep */}
            {frame > 30 && frame < 60 && (
              <rect x={sweepX} y={-200} width={100} height={200} fill={C.mucusGlow} opacity={0.4} transform="skewX(-20)" />
            )}

            {/* Rain droplets */}
            {Array.from({length: 6}).map((_, i) => {
              const startF = i * 15;
              const y = interpolate(frame - startF, [0, 15], [-800, -200], clamp);
              const splat = frame - startF > 15;
              const splatF = frame - startF - 15;
              const w = splat ? interpolate(splatF, [0, 10], [20, 60], clamp) : 20;
              const h = splat ? interpolate(splatF, [0, 10], [20, 5], clamp) : 40;
              const slide = splat ? splatF * 5 : 0;
              const xPos = (i%3 - 1) * 300;
              return (
                <g key={i} transform={`translate(${xPos + slide}, ${y})`}>
                  <ellipse cx={0} cy={0} rx={w/2} ry={h/2} fill={C.acidGreen} />
                </g>
              );
            })}

          </g>

          {/* Shield Badge */}
          {badgeS > 0.01 && (
            <g transform={`translate(540, 1250) scale(${badgeS})`}>
              <path d="M 0,-60 L 80,-30 L 80,40 C 80,90 0,130 0,130 C 0,130 -80,90 -80,40 L -80,-30 Z" fill={C.gold} />
              <rect x={-80} y={150} width={160} height={50} rx={25} fill={C.bgDeep} />
              <text x={0} y={185} textAnchor="middle" fill={C.gold} fontSize={30} fontWeight={900} fontFamily="Poppins, Arial Black">SEALED</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: REGENERATION ────────────────────────────────────────────────────
function SceneRegen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Worn patch fill
  const fillW = spring({ frame: frame - 10, fps, config: { damping: 15, mass: 0.6, stiffness: 100 } }) * 300;

  // Counter
  const count = Math.max(3, Math.floor(interpolate(frame, [20, 40], [14, 3], clamp)));

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 1050) scale(0.9)">
            
            {/* Flesh base */}
            <rect x={-540} y={0} width={1080} height={500} fill={C.fleshRed} />
            
            {/* Base Mucus layer */}
            <path d="M -540,0 L -540,-200 L 540,-200 L 540,0 Z" fill={C.mucusBlue} opacity={0.6} />

            {/* Worn patches (darker, lower) */}
            <path d="M -300,-200 L -300,-100 L 0,-100 L 0,-200 Z" fill={C.bgPanel} opacity={0.5} />
            <path d="M 100,-200 L 100,-150 L 300,-150 L 300,-200 Z" fill={C.bgPanel} opacity={0.5} />

            {/* Regrowing tiles */}
            {fillW > 0 && (
              <g>
                <rect x={-300} y={-100} width={Math.min(300, fillW)} height={100} fill={C.mucusBlue} />
                {fillW > 300 && (
                  <rect x={100} y={-150} width={Math.min(200, fillW - 300)} height={50} fill={C.mucusBlue} />
                )}
                {/* Tile lines */}
                {Array.from({length: 10}).map((_, i) => (
                  <line key={i} x1={-300 + i*60} y1={0} x2={-300 + i*60} y2={-200} stroke={C.mucusGlow} strokeWidth={4} opacity={0.3} />
                ))}
              </g>
            )}

            {/* Arrows pointing up */}
            {frame > 10 && frame < 50 && (
              <g opacity={Math.sin(frame*0.2)*0.5 + 0.5}>
                <path d="M -150,-50 L -150,-80 M -160,-70 L -150,-80 L -140,-70" fill="none" stroke={C.mucusGlow} strokeWidth={6} />
                <path d="M 200,-100 L 200,-130 M 190,-120 L 200,-130 L 210,-120" fill="none" stroke={C.mucusGlow} strokeWidth={6} />
              </g>
            )}

          </g>

          {/* Counter Badge */}
          <g transform="translate(650, 600)">
            <rect x={0} y={0} width={300} height={120} rx={20} fill={C.gold} />
            <text x={150} y={45} textAnchor="middle" fill={C.bgDeep} fontSize={30} fontWeight={700}>EVERY</text>
            <text x={150} y={100} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">{count} DAYS</text>
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: ULCER REVEAL ────────────────────────────────────────────────────
function SceneUlcer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tear mask
  const tearW = interpolate(frame, [10, 30], [0, 400], clamp);
  
  // Acid pour
  const pourY = interpolate(frame, [25, 40], [-800, 0], clamp);

  // Crater bloom
  const craterS = spring({ frame: frame - 40, fps, config: { damping: 10, mass: 0.8, stiffness: 200 } });
  
  // Pulse loop
  const pulse = craterS > 0.9 ? Math.sin(frame * 0.2) * 20 : 0;

  // Badge
  const badgeS = spring({ frame: frame - 50, fps, config: { damping: 12, mass: 0.6, stiffness: 250 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 1050) scale(0.9)">
            
            {/* Flesh base */}
            <rect x={-540} y={0} width={1080} height={500} fill={C.fleshRed} />

            {/* Veiny inflammation (crawls out from center) */}
            {craterS > 0 && Array.from({length: 8}).map((_, i) => {
              const ang = i * 45 * (Math.PI/180);
              const path = `M 0,0 Q ${Math.cos(ang)*100},${Math.sin(ang)*100 + 50} ${Math.cos(ang)*200},${Math.sin(ang)*200 + 100}`;
              return (
                <path key={i} d={path} fill="none" stroke={C.bgDeep} strokeWidth={15} opacity={craterS * 0.4} strokeLinecap="round" />
              );
            })}

            {/* Crater (Ember) */}
            {craterS > 0 && (
              <g transform={`scale(${craterS})`}>
                <ellipse cx={0} cy={0} rx={180 + pulse} ry={80 + pulse*0.5} fill={C.ulcerEmber} />
                <ellipse cx={0} cy={0} rx={120} ry={50} fill="#FFF" opacity={0.8} filter="blur(10px)" />
                {/* Heat lines */}
                {Array.from({length: 5}).map((_, i) => (
                  <path key={i} d={`M ${(i-2)*50}, -40 Q ${(i-2)*70}, -100 ${(i-2)*40}, -150`} fill="none" stroke={C.ulcerEmber} strokeWidth={8} opacity={Math.sin(frame*0.2 + i)*0.5+0.5} />
                ))}
                {/* Smoke */}
                {Array.from({length: 3}).map((_, i) => (
                  <circle key={i} cx={(i-1)*30 + Math.sin(frame*0.1)*20} cy={-100 - ((frame*3 + i*50) % 200)} r={30 + (frame%50)} fill={C.smokeGray} opacity={1 - ((frame*3 + i*50) % 200)/200} />
                ))}
              </g>
            )}
            
            {/* Mucus layer with tear */}
            <defs>
              <clipPath id="mucus-tear">
                <path d={`M -540,-200 L -540,0 L 540,0 L 540,-200 L ${tearW/2},-200 L 0,-100 L ${-tearW/2},-200 Z`} clipRule="evenodd" />
              </clipPath>
            </defs>
            <rect x={-540} y={-200} width={1080} height={200} fill={C.mucusBlue} clipPath="url(#mucus-tear)" />

            {/* Torn curled edges */}
            {tearW > 0 && (
              <g>
                <path d={`M ${-tearW/2},-200 Q 0,-250 0,-100 Q -50,-150 ${-tearW/2},-200`} fill={C.bgPanel} opacity={0.6} />
                <path d={`M ${tearW/2},-200 Q 0,-250 0,-100 Q 50,-150 ${tearW/2},-200`} fill={C.bgPanel} opacity={0.6} />
              </g>
            )}

            {/* Acid Pour */}
            {pourY > -800 && (
              <path d={`M -30,${pourY} Q 0,${pourY + 50} 30,${pourY} L 10,0 L -10,0 Z`} fill={C.acidGreen} opacity={0.9} />
            )}

          </g>

          {/* Badge */}
          {badgeS > 0.01 && (
            <g transform={`translate(540, 600) scale(${badgeS})`}>
              <circle cx={-150} cy={0} r={60} fill={C.gold} />
              <text x={-150} y={25} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900}>!</text>
              <rect x={-80} y={-60} width={280} height={120} rx={20} fill={C.gold} />
              <text x={60} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">ULCER</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Words slam
  const w1 = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w2 = spring({ frame: frame - 25, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w3 = spring({ frame: frame - 40, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w4 = spring({ frame: frame - 55, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  
  const flash = Math.max(0, 1 - (frame - 55)*0.05);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <defs>
            <radialGradient id="end-vig">
              <stop offset="40%" stopColor="transparent" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
            </radialGradient>
          </defs>

          {/* Icon summary top half */}
          <g transform="translate(540, 700) scale(0.8)">
            {/* Beaker (Acid) */}
            <g transform="translate(-300, 0)">
              <path d="M -80,-100 L 80,-100 L 100,100 L -100,100 Z" fill={C.bgPanel} stroke={C.steel} strokeWidth={8} />
              <path d="M -90,0 L 90,0 L 100,100 L -100,100 Z" fill={C.acidGreen} opacity={0.8} />
              <circle cx={0} cy={50} r={20} fill={C.bgDeep} opacity={0.3} />
            </g>

            {/* Shield (Slime) */}
            <g transform="translate(0, 0)">
              <rect x={-20} y={-100} width={40} height={200} rx={20} fill={C.mucusBlue} />
              <path d={`M -20,0 Q -40,${Math.sin(frame*0.2)*10} -20,-40`} fill="none" stroke={C.acidGreen} strokeWidth={8} opacity={0.6} />
            </g>

            {/* Human outline */}
            <g transform="translate(300, 0)">
              <circle cx={0} cy={-60} r={40} fill={C.fleshRed} opacity={0.8} />
              <path d="M -60,0 C -60,-20 60,-20 60,0 L 40,120 L -40,120 Z" fill={C.fleshRed} opacity={0.8} />
            </g>
          </g>

          <rect x={0} y={0} width={1080} height={1920} fill="url(#end-vig)" />

          {/* Payoff Text */}
          <g transform="translate(540, 1150) scale(0.8)">
            {w1 > 0.01 && <text y={-150} textAnchor="middle" fill="#FFF" fontSize={80} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${interpolate(w1, [0, 1], [1.3, 1])})`}>ACID.</text>}
            {w2 > 0.01 && <text y={-30} textAnchor="middle" fill="#FFF" fontSize={80} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${interpolate(w2, [0, 1], [1.3, 1])})`}>HELD BACK</text>}
            {w3 > 0.01 && <text y={90} textAnchor="middle" fill="#FFF" fontSize={80} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${interpolate(w3, [0, 1], [1.3, 1])})`}>BY</text>}
            {w4 > 0.01 && (
              <g transform={`scale(${interpolate(w4, [0, 1], [1.4, 1])})`}>
                <text y={250} textAnchor="middle" fill={C.gold} fontSize={140} fontWeight={900} fontFamily="Poppins, Arial Black">SLIME.</text>
                {frame < 80 && <ellipse cx={0} cy={200} rx={400 * (1-w4)} ry={200 * (1-w4)} fill={C.gold} opacity={flash} />}
              </g>
            )}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Stomachacid: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('stomachacid_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={5} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={150}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene5 + 40} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene6 + 50} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneRazor />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <ScenePump />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneMucus />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneRegen />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneUlcer />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePayoff />
      </Sequence>
    </AbsoluteFill>
  );
};

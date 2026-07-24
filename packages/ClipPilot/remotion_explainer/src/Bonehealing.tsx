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

import bonehealingWords from './bonehealing_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1206;

const C = {
  bgDeep: '#0c0e14',
  bgPanel: '#141823',
  gold: '#FFD23F',
  boneIvory: '#F4ECDD',
  bloodCrimson: '#C0392B',
  cartilageBlue: '#5FB3D4',
  callusAmber: '#E8A24A',
  steelSilver: '#AEB6C2',
  cellViolet: '#9B7BD4',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 207,
  scene3: 411,
  scene4: 673,
  scene5: 863,
  scene6: 997,
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

// ─── SVG BONE SHAPE ───────────────────────────────────────────────────────────
function BonePath({ width = 140, height = 800, crackScale = 0 }) {
  const topEpiphysis = `M ${-width/2},${-height/2 + 100} C ${-width/2-40},${-height/2-20} ${-width/4},${-height/2-80} 0,${-height/2-50} C ${width/4},${-height/2-80} ${width/2+40},${-height/2-20} ${width/2},${-height/2 + 100}`;
  const rightShaft = `L ${width/2 - 20},${height/2 - 100}`;
  const botEpiphysis = `C ${width/2+40},${height/2+20} ${width/4},${height/2+80} 0,${height/2+50} C ${-width/4},${height/2+80} ${-width/2-40},${height/2+20} ${-width/2},${height/2 - 100}`;
  const leftShaft = `Z`;
  
  // The crack path (zigzag through center)
  const crack = `M ${-width/2 + 10}, 0 L ${-20}, 20 L 10, -10 L ${width/2 - 10}, 10`;

  return (
    <g>
      <path d={`${topEpiphysis} ${rightShaft} ${botEpiphysis} ${leftShaft}`} fill={C.boneIvory} />
      {/* Rim light left */}
      <path d={`${topEpiphysis} L ${-width/2},${height/2-100}`} fill="none" stroke={C.gold} strokeWidth={8} opacity={0.5} />
      {/* Crack */}
      {crackScale > 0 && (
        <path d={crack} fill="none" stroke={C.bgDeep} strokeWidth={6 * crackScale} />
      )}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wipe up
  const wipeY = interpolate(frame, [0, 12], [1920, 0], clamp);
  const pop = spring({ frame: frame - 12, fps, config: { damping: 10, mass: 0.8, stiffness: 180 } });
  
  // Crack pops open on frame 25
  const crackPop = spring({ frame: frame - 25, fps, config: { damping: 20, mass: 0.5, stiffness: 300 } });
  const shakeX = (frame > 25 && frame < 30) ? (Math.random() - 0.5) * 20 : 0;
  
  // Badge slams down
  const badgeY = spring({ frame: frame - 30, fps, config: { damping: 12, mass: 0.6, stiffness: 200 } });
  const badgeScale = interpolate(badgeY, [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform={`translate(${540 + shakeX}, 960) scale(${1 + pop * 0.06})`}>
            {/* Mask for wipe */}
            <clipPath id="bone-wipe">
              <rect x={-300} y={-600 + wipeY} width={600} height={1200} />
            </clipPath>
            
            <g clipPath="url(#bone-wipe)">
              <BonePath width={200} height={1000} crackScale={crackPop} />
              
              {/* Crimson dot on crack */}
              {crackPop > 0.5 && (
                <circle cx={-10} cy={10} r={15} fill={C.bloodCrimson} opacity={Math.sin(frame*0.5)*0.5 + 0.5} />
              )}
            </g>
          </g>

          {/* Badge */}
          {badgeY > 0.01 && (
            <g transform={`translate(540, ${interpolate(badgeY, [0, 1], [-200, 250])}) scale(${badgeScale})`}>
              <circle cx={0} cy={0} r={250 * Math.max(0, 1 - (frame - 30)*0.1)} fill={C.gold} opacity={0.3} />
              <rect x={-400} y={-70} width={800} height={140} rx={70} fill={C.gold} />
              <text x={0} y={25} textAnchor="middle" fill={C.bgDeep} fontSize={65} fontWeight={900} fontFamily="Poppins, Arial Black">STRONGER WHEN BROKEN</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: CLOT ────────────────────────────────────────────────────────────
function SceneClot() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gap opens
  const gapOpen = spring({ frame, fps, config: { damping: 15, mass: 0.5, stiffness: 100 } });
  
  // Blood fills
  const fillH = interpolate(frame, [20, 60], [0, 150], clamp);

  // Scaffold threads
  const threads = interpolate(frame, [60, 100], [0, 1], clamp);

  const badgeScale = spring({ frame: frame - 110, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960) scale(1.5)">
            
            {/* Top Bone End */}
            <g transform={`translate(0, ${-80 - gapOpen * 50})`}>
              <path d="M -150,0 C -100,50 100,50 150,0 L 150,-400 L -150,-400 Z" fill={C.boneIvory} />
            </g>

            {/* Bottom Bone End */}
            <g transform={`translate(0, ${80 + gapOpen * 50})`}>
              <path d="M -150,0 C -100,-50 100,-50 150,0 L 150,400 L -150,400 Z" fill={C.boneIvory} />
            </g>

            {/* Blood Pool (gap center) */}
            {fillH > 0 && (
              <path d={`M -130,${150 - fillH} Q 0,${150 - fillH + Math.sin(frame*0.1)*10} 130,${150 - fillH} L 130,150 L -130,150 Z`} fill={C.bloodCrimson} opacity={0.6} />
            )}

            {/* Scaffold threads (drawn on) */}
            {threads > 0 && (
              <g stroke={C.bloodCrimson} strokeWidth={6} strokeLinecap="round" opacity={0.8}>
                <line x1={-100} y1={-80} x2={0} y2={50} strokeDasharray="200" strokeDashoffset={200*(1-threads)} />
                <line x1={0} y1={50} x2={100} y2={-50} strokeDasharray="200" strokeDashoffset={200*(1-threads)} />
                <line x1={-50} y1={-20} x2={50} y2={80} strokeDasharray="200" strokeDashoffset={200*(1-threads)} />
                <line x1={80} y1={30} x2={-20} y2={100} strokeDasharray="200" strokeDashoffset={200*(1-threads)} />
                
                {/* Nodes */}
                <circle cx={-100} cy={-80} r={8*threads} fill={C.bloodCrimson} />
                <circle cx={0} cy={50} r={10*threads} fill={C.bloodCrimson} />
                <circle cx={100} cy={-50} r={8*threads} fill={C.bloodCrimson} />
                <circle cx={50} cy={80} r={12*threads} fill={C.bloodCrimson} />
                <circle cx={-50} cy={-20} r={8*threads} fill={C.bloodCrimson} />
              </g>
            )}
          </g>

          {/* Badge */}
          {badgeScale > 0.01 && (
            <g transform={`translate(250, 400) scale(${badgeScale})`}>
              <rect x={0} y={-50} width={180} height={100} rx={30} fill={C.gold} />
              <text x={90} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={50} fontWeight={900} fontFamily="Poppins, Arial Black">CLOT</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: CARTILAGE ───────────────────────────────────────────────────────
function SceneCartilage() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Swarm
  const swarm = interpolate(frame, [0, 40], [0, 1], clamp);
  const bulge = spring({ frame: frame - 40, fps, config: { damping: 12, mass: 0.6, stiffness: 120 } });
  
  const labelScale = spring({ frame: frame - 60, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960) scale(1.2)">
            {/* Bone Ends */}
            <g transform="translate(0, -120)">
              <path d="M -150,0 C -100,20 100,20 150,0 L 150,-500 L -150,-500 Z" fill={C.boneIvory} />
            </g>
            <g transform="translate(0, 120)">
              <path d="M -150,0 C -100,-20 100,-20 150,0 L 150,500 L -150,500 Z" fill={C.boneIvory} />
            </g>
            
            {/* Scaffold background */}
            <circle cx={0} cy={0} r={100} fill={C.bloodCrimson} opacity={0.3} />

            {/* Cartilage Bulge */}
            <ellipse cx={0} cy={0} rx={220 * bulge} ry={180 * bulge} fill={C.cartilageBlue} opacity={0.8} />
            {/* Specular */}
            <ellipse cx={-80 * bulge} cy={-60 * bulge} rx={40 * bulge} ry={20 * bulge} fill={C.boneIvory} opacity={0.5} transform="rotate(-30)" />

            {/* Violet cells swarming */}
            {frame < 80 && Array.from({length: 40}).map((_, i) => {
              const startX = Math.cos(i) * 800;
              const startY = Math.sin(i) * 800;
              const endX = (Math.random()-0.5) * 300;
              const endY = (Math.random()-0.5) * 200;
              const curX = interpolate(swarm, [0, 1], [startX, endX]);
              const curY = interpolate(swarm, [0, 1], [startY, endY]);
              const p = interpolate(swarm, [0, 0.8, 1], [0, 1, 0]); // fade out at end
              return (
                <circle key={i} cx={curX} cy={curY} r={8} fill={C.cellViolet} opacity={p} />
              );
            })}
          </g>

          {/* Label */}
          {labelScale > 0.01 && (
            <g transform={`translate(200, 300) scale(${labelScale})`}>
              <text x={0} y={0} fill={C.gold} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">CARTILAGE</text>
              <rect x={0} y={20} width={340} height={10} fill={C.gold} />
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CALLUS REVEAL ───────────────────────────────────────────────────
function SceneCallus() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Transmute Blue to Amber
  const wipeY = interpolate(frame, [10, 30], [-250, 250], clamp);
  
  // Bulge rings build outward
  const ring1 = spring({ frame: frame - 40, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });
  const ring2 = spring({ frame: frame - 45, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });
  const ring3 = spring({ frame: frame - 50, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });

  const thickness = Math.floor(interpolate(ring3, [0, 1], [100, 165], clamp));

  const badgeScale = spring({ frame: frame - 70, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const flash = Math.max(0, 1 - (frame - 70)*0.05);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960) scale(1.2)">
            {/* Bone Ends */}
            <path d="M -130,-120 L -130,-500 L 130,-500 L 130,-120 Z" fill={C.boneIvory} />
            <path d="M -130,120 L -130,500 L 130,500 L 130,120 Z" fill={C.boneIvory} />

            {/* Base Cartilage that turns to bone */}
            <clipPath id="amber-wipe">
              <rect x={-400} y={-400} width={800} height={wipeY + 400} />
            </clipPath>
            
            <ellipse cx={0} cy={0} rx={220} ry={180} fill={C.cartilageBlue} />
            <ellipse cx={0} cy={0} rx={220} ry={180} fill={C.callusAmber} clipPath="url(#amber-wipe)" />

            {/* Building Collar Rings */}
            {ring1 > 0 && <ellipse cx={0} cy={0} rx={240 * ring1} ry={200 * ring1} fill="none" stroke={C.callusAmber} strokeWidth={20} opacity={0.9} />}
            {ring2 > 0 && <ellipse cx={0} cy={0} rx={270 * ring2} ry={220 * ring2} fill="none" stroke={C.callusAmber} strokeWidth={20} opacity={0.8} />}
            {ring3 > 0 && <ellipse cx={0} cy={0} rx={300 * ring3} ry={240 * ring3} fill="none" stroke={C.boneIvory} strokeWidth={20} opacity={0.9} />}

            {/* Trabecular Honeycomb inside collar */}
            {ring3 > 0.5 && (
              <g opacity={interpolate(frame, [50, 60], [0, 0.4], clamp)}>
                {Array.from({length: 40}).map((_, i) => {
                  const a = i * 137.5;
                  const r = Math.sqrt(i) * 35;
                  if (r > 280 || r < 140) return null;
                  const cx = Math.cos(a) * r;
                  const cy = Math.sin(a) * r;
                  return (
                    <polygon key={i} points="-10,-10 10,-10 20,0 10,10 -10,10 -20,0" fill="none" stroke={C.bgDeep} strokeWidth={3} transform={`translate(${cx}, ${cy})`} />
                  );
                })}
              </g>
            )}

            {/* Dimension Brackets */}
            {frame > 30 && (
              <g opacity={interpolate(frame, [30, 40], [0, 1], clamp)}>
                {/* Normal width bracket */}
                <path d="M -130,-300 L -150,-300 M 130,-300 L 150,-300 L -150,-300 M -130,-320 L -130,-280 M 130,-320 L 130,-280" fill="none" stroke={C.gold} strokeWidth={4} />
                <text x={0} y={-330} textAnchor="middle" fill={C.gold} fontSize={30} fontWeight={700}>100%</text>

                {/* Collar width bracket */}
                <path d={`M ${-310*ring3},0 L ${-330*ring3},0 M ${310*ring3},0 L ${330*ring3},0 L ${-330*ring3},0 M ${-310*ring3},-20 L ${-310*ring3},20 M ${310*ring3},-20 L ${310*ring3},20`} fill="none" stroke={C.gold} strokeWidth={6} />
                <text x={0} y={40} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900}>{thickness}%</text>
              </g>
            )}

            {/* Flash */}
            {badgeScale > 0.01 && <ellipse cx={0} cy={0} rx={310} ry={250} fill={C.boneIvory} opacity={flash * 0.8} />}
          </g>

          {/* Badge */}
          {badgeScale > 0.01 && (
            <g transform={`translate(540, 250) scale(${badgeScale})`}>
              <rect x={-250} y={-60} width={500} height={120} rx={30} fill={C.gold} />
              <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={55} fontWeight={900} fontFamily="Poppins, Arial Black">CALLUS COLLAR</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: TOUGHER ─────────────────────────────────────────────────────────
function SceneTougher() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load arrows press down (10-20)
  const press = spring({ frame: frame - 10, fps, config: { damping: 10, mass: 0.6, stiffness: 200 } });
  
  // Bar fills
  const barNorm = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 0.5, stiffness: 100 } }) * 300;
  const barHeal = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 0.5, stiffness: 100 } }) * 500;

  // Badge stamp
  const badgeS = spring({ frame: frame - 50, fps, config: { damping: 10, mass: 0.5, stiffness: 300 } });
  const shake = frame > 50 && frame < 55 ? (Math.random()-0.5)*10 : 0;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* LEFT: Normal Bone */}
          <g transform="translate(300, 1200)">
            <path d="M -80,0 L -80,-800 L 80,-800 L 80,0 Z" fill={C.boneIvory} />
            <path d={`M 0,${-900 + press * 100} L -40,${-1000 + press * 100} L 40,${-1000 + press * 100} Z`} fill={C.gold} />
            {/* Strength Bar */}
            <rect x={-140} y={0} width={20} height={barNorm} fill={C.steelSilver} transform="scale(1, -1)" />
            <text x={-130} y={-barNorm - 20} textAnchor="middle" fill={C.steelSilver} fontSize={30} fontWeight={700}>STRENGTH</text>
          </g>

          {/* RIGHT: Healed Bone */}
          <g transform="translate(750, 1200)">
            <path d="M -80,0 L -80,-800 L 80,-800 L 80,0 Z" fill={C.boneIvory} />
            <ellipse cx={0} cy={-400} rx={180} ry={140} fill={C.boneIvory} />
            <path d={`M 0,${-900 + press * 100} L -40,${-1000 + press * 100} L 40,${-1000 + press * 100} Z`} fill={C.gold} />
            {/* Strength Bar */}
            <rect x={-240} y={0} width={30} height={barHeal} fill={C.gold} transform="scale(1, -1)" />
            <text x={-225} y={-barHeal - 20} textAnchor="middle" fill={C.gold} fontSize={40} fontWeight={900}>TOUGHER</text>
            
            {badgeS > 0.01 && (
              <g transform={`translate(${shake}, -400) scale(${badgeS}) rotate(-10)`}>
                <rect x={-200} y={-60} width={400} height={120} rx={20} fill={C.gold} stroke={C.bgDeep} strokeWidth={10} />
                <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">TOUGHER</text>
                <text x={0} y={90} textAnchor="middle" fill={C.gold} fontSize={35} fontWeight={700}>for months</text>
              </g>
            )}
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

  // Erosion of collar (0-40)
  const erode = interpolate(frame, [0, 40], [1, 0], clamp);
  
  // Steel sheen sweep
  const sheenX = interpolate(frame, [40, 60], [-200, 200], clamp);

  // Words slam
  const w1 = spring({ frame: frame - 60, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w2 = spring({ frame: frame - 80, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w3 = spring({ frame: frame - 100, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960) scale(1.2)">
            <path d="M -130,-500 L -130,500 L 130,500 L 130,-500 Z" fill={C.boneIvory} />
            
            {/* Eroding collar */}
            {erode > 0 && <ellipse cx={0} cy={0} rx={130 + 170*erode} ry={130 + 110*erode} fill={C.boneIvory} />}
            
            {/* Sand particles */}
            {erode > 0 && erode < 1 && Array.from({length: 20}).map((_, i) => (
              <circle key={i} cx={(Math.random()-0.5)*400} cy={(Math.random()-0.5)*300 + 100*(1-erode)} r={Math.random()*10} fill={C.boneIvory} opacity={erode} />
            ))}

            {/* Seam */}
            {erode === 0 && (
              <g>
                <path d="M -130,0 L 130,0 L 100,10 L -100,10 Z" fill={C.steelSilver} opacity={0.6} />
                <path d="M -130,0 L -100,-20 L 100,20 L 130,0" fill="none" stroke={C.bgDeep} strokeWidth={4} opacity={0.3} />
                
                {/* Sheen */}
                {frame > 40 && frame < 70 && (
                  <circle cx={sheenX} cy={0} r={40} fill={C.steelSilver} opacity={0.8} transform="scale(1, 0.3)" />
                )}
              </g>
            )}
          </g>

          {/* Payoff Text */}
          <g transform="translate(540, 960)">
            {w1 > 0.01 && <text y={-100} textAnchor="middle" fill={C.boneIvory} fontSize={90} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${interpolate(w1, [0, 1], [1.4, 1])})`}>STRONGER.</text>}
            {w2 > 0.01 && <text y={20} textAnchor="middle" fill={C.boneIvory} fontSize={90} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${interpolate(w2, [0, 1], [1.4, 1])})`}>THAN.</text>}
            {w3 > 0.01 && (
              <g transform={`scale(${interpolate(w3, [0, 1], [1.4, 1])})`}>
                <text y={150} textAnchor="middle" fill={C.gold} fontSize={120} fontWeight={900} fontFamily="Poppins, Arial Black">STEEL.</text>
                {frame < 120 && <circle cx={0} cy={100} r={500 * (1-w3)} fill={C.gold} opacity={0.3 * (1-w3)} />}
              </g>
            )}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Bonehealing: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('bonehealing_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={25} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene2 + 20} durationInFrames={150}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 40} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene4 + 40} durationInFrames={150}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene6 + 100} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneHook />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneClot />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneCartilage />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneCallus />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneTougher />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePayoff />
      </Sequence>
    </AbsoluteFill>
  );
};

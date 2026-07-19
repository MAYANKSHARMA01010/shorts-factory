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

import tonsilWords from './tonsil_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 931;

const C = {
  bgDeep: '#0c0f14',
  bgPanel: '#141a22',
  gold: '#FFD23F',
  fleshRed: '#FF5C6E',
  fleshDark: '#A82C3D',
  fleshPink: '#FF9EAA',
  stoneWhite: '#FFF9E6',
  stoneShadow: '#D4C79F',
  foodBrown: '#CD853F',
  foodGreen: '#8FBC8F',
  bactGreen: '#7CFF5A',
  stinkGreen: '#41A825',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 65,
  scene3: 155,
  scene4: 307,
  scene5: 441,
  scene6: 617,
  scene7: 804,
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

// ─── SCENE 1: COUGH ────────────────────────────────────────────────────────────
function SceneCough() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cough jerk
  const cough = Math.sin(interpolate(frame, [10, 20], [0, Math.PI], clamp)) * 40;
  
  // Stone flying out
  const stoneX = interpolate(frame, [15, 40], [0, 500], clamp);
  const stoneY = interpolate(frame, [15, 40], [0, -200], clamp) + Math.pow(Math.max(0, frame-25)*0.5, 2);
  const stoneRot = frame * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Throat/Mouth silhouette */}
            <g transform={`translate(${cough}, 0)`}>
              <path d="M -300,500 L -300,200 C -300,0 -200,-100 0,-100 C 200,-100 300,0 300,200 L 300,500" fill="none" stroke={C.fleshRed} strokeWidth={20} strokeLinecap="round" />
              {/* Uvula */}
              <path d="M 0,-100 L 0,-30 A 30 30 0 0 0 0,30 A 30 30 0 0 0 0,-30" fill={C.fleshRed} />
              
              {/* Tonsils */}
              <circle cx={-150} cy={100} r={60} fill={C.fleshPink} />
              <circle cx={150} cy={100} r={60} fill={C.fleshPink} />
            </g>

            {/* Projectile Stone */}
            {frame > 15 && (
              <g transform={`translate(${stoneX}, ${stoneY}) rotate(${stoneRot})`}>
                <path d="M -30,0 Q -20,-30 10,-20 Q 30,0 20,20 Q -10,30 -30,0" fill={C.stoneWhite} stroke={C.stoneShadow} strokeWidth={4} />
              </g>
            )}

            {/* Action lines for cough */}
            {frame > 12 && frame < 22 && (
              <g>
                <path d="M -100,50 L -200,-50 M 0,0 L 0,-150 M 100,50 L 200,-50" fill="none" stroke="#FFF" strokeWidth={10} strokeLinecap="round" opacity={1 - (frame-12)/10} />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: NAME REVEAL ─────────────────────────────────────────────────────
function SceneName() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeS = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.8, stiffness: 200 } });
  const pointerY = interpolate(frame, [20, 30], [200, 80], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Giant Stone */}
            <g transform={`scale(${interpolate(frame, [0, 60], [1, 1.1])}) rotate(${frame*0.2})`}>
              <path d="M -150,0 C -200,-100 -50,-200 50,-150 C 200,-100 150,100 50,150 C -50,200 -100,100 -150,0" fill={C.stoneWhite} />
              {/* Craters */}
              <circle cx={-50} cy={-50} r={30} fill={C.stoneShadow} opacity={0.6} />
              <circle cx={60} cy={40} r={40} fill={C.stoneShadow} opacity={0.6} />
              <circle cx={80} cy={-40} r={20} fill={C.stoneShadow} opacity={0.6} />
            </g>

            {/* Pointer */}
            {frame > 20 && (
              <g transform={`translate(150, ${pointerY})`}>
                <path d="M 0,0 L 20,40 L -20,40 Z" fill={C.gold} />
                <rect x={-5} y={40} width={10} height={60} fill={C.gold} />
              </g>
            )}

          </g>

          {/* Badge */}
          {badgeS > 0.01 && (
            <g transform={`translate(540, 600) scale(${badgeS})`}>
              <rect x={-300} y={-60} width={600} height={120} rx={30} fill={C.gold} />
              <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">TONSIL STONES</text>
            </g>
          )}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: PITS & CREVICES ─────────────────────────────────────────────────
function ScenePits() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Zoom into the flesh
  const zoom = interpolate(frame, [0, 60], [1, 1.5], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.fleshDark} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${zoom * 0.9})`}>
            
            {/* Flesh background */}
            <rect x={-800} y={-800} width={1600} height={1600} fill={C.fleshPink} rx={400} />

            {/* Crevices */}
            <path d="M -300,-100 Q -150,-150 0,0 Q 150,150 300,50" fill="none" stroke={C.fleshDark} strokeWidth={80} strokeLinecap="round" />
            <path d="M -100,200 Q -50,300 -200,400" fill="none" stroke={C.fleshDark} strokeWidth={60} strokeLinecap="round" />
            <path d="M 200,-300 Q 300,-200 150,-50" fill="none" stroke={C.fleshDark} strokeWidth={70} strokeLinecap="round" />

            {/* Dark deep holes */}
            <circle cx={0} cy={0} r={60} fill={C.bgDeep} opacity={0.8} />
            <circle cx={-200} cy={-120} r={40} fill={C.bgDeep} opacity={0.8} />
            <circle cx={250} cy={80} r={50} fill={C.bgDeep} opacity={0.8} />
            
            {/* Texture */}
            {Array.from({length: 30}).map((_, i) => (
              <circle key={i} cx={(i*77 % 800) - 400} cy={(i*93 % 800) - 400} r={5 + (i%5)} fill={C.fleshRed} opacity={0.3} />
            ))}

          </g>

          {/* Search/Inspect overlay */}
          <g transform="translate(540, 960)">
            <circle cx={0} cy={0} r={450} fill="none" stroke={C.gold} strokeWidth={10} strokeDasharray="40 20" opacity={0.6 + Math.sin(frame*0.1)*0.4} />
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FOOD TRAPPED ────────────────────────────────────────────────────
function SceneFood() {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill>
      <Bg color={C.bgPanel} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Crevice Cross-section */}
            <path d="M -500,-200 L -300,-200 C -100,-200 -100,300 0,300 C 100,300 100,-200 300,-200 L 500,-200 L 500,500 L -500,500 Z" fill={C.fleshPink} stroke={C.fleshRed} strokeWidth={10} />
            
            {/* Deep pocket */}
            <path d="M -100,-200 C -100,300 0,300 0,300 C 0,300 100,300 100,-200 Z" fill={C.fleshDark} opacity={0.5} />

            {/* Food dropping in */}
            {Array.from({length: 6}).map((_, i) => {
              const start = i * 15;
              if (frame < start) return null;
              
              const isGreen = i % 2 === 0;
              const color = isGreen ? C.foodGreen : C.foodBrown;
              
              // Fall mechanics
              const dropY = interpolate(frame - start, [0, 20], [-400, 200 - i*20], clamp);
              const dropX = Math.sin(frame*0.1 + i) * 30;
              const rot = (frame - start) * 15;

              return (
                <g key={i} transform={`translate(${dropX}, ${dropY}) rotate(${rot})`}>
                  <rect x={-20} y={-20} width={40} height={40} rx={10} fill={color} />
                </g>
              );
            })}

            {/* Arrow pointing to pocket */}
            <g transform={`translate(-200, -100) rotate(-45)`}>
              <path d="M 0,0 L 20,-40 L -20,-40 Z" fill={C.gold} />
              <rect x={-5} y={-80} width={10} height={40} fill={C.gold} />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: BACTERIA ────────────────────────────────────────────────────────
function SceneBacteria() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Food pile
  const pile = Math.min(100, frame * 2);

  return (
    <AbsoluteFill>
      <Bg color={C.bgPanel} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Crevice Cross-section */}
            <path d="M -500,-200 L -300,-200 C -100,-200 -100,300 0,300 C 100,300 100,-200 300,-200 L 500,-200 L 500,500 L -500,500 Z" fill={C.fleshPink} />
            
            {/* Food pile */}
            <g transform="translate(0, 200)">
              <ellipse cx={0} cy={50} rx={80} ry={40} fill={C.foodBrown} />
              <ellipse cx={-30} cy={20} rx={50} ry={30} fill={C.foodGreen} />
              <ellipse cx={30} cy={10} rx={60} ry={35} fill={C.foodBrown} />
              <ellipse cx={0} cy={-20} rx={40} ry={25} fill={C.foodGreen} />
            </g>

            {/* Bacteria swarming */}
            {Array.from({length: 12}).map((_, i) => {
              if (frame < 10 + i * 5) return null;
              
              const prog = Math.min(1, (frame - (10 + i*5)) / 30);
              const startX = (i%2 === 0 ? -300 : 300) + (i%3)*50;
              const startY = -400 + i*30;
              const endX = (Math.random() - 0.5) * 120;
              const endY = 150 + (Math.random() - 0.5) * 80;
              
              const curX = interpolate(prog, [0, 1], [startX, endX]);
              const curY = interpolate(prog, [0, 1], [startY, endY]);
              const jiggleX = prog === 1 ? Math.sin(frame*0.3 + i)*10 : 0;
              const jiggleY = prog === 1 ? Math.cos(frame*0.4 + i)*10 : 0;

              return (
                <g key={i} transform={`translate(${curX + jiggleX}, ${curY + jiggleY})`}>
                  <rect x={-15} y={-8} width={30} height={16} rx={8} fill={C.bactGreen} />
                  {/* Lil tail */}
                  <path d="M -15,0 Q -25,10 -30,0" fill="none" stroke={C.bactGreen} strokeWidth={2} strokeLinecap="round" />
                </g>
              );
            })}

            {/* Stink lines emitting */}
            {frame > 60 && Array.from({length: 3}).map((_, i) => {
              const yProg = ((frame - 60) * 2 + i * 80) % 240;
              const op = Math.max(0, 1 - yProg/240);
              return (
                <path key={i} d={`M ${(i-1)*50}, ${100 - yProg} Q ${(i-1)*70}, ${50 - yProg} ${(i-1)*40}, ${0 - yProg}`} fill="none" stroke={C.stinkGreen} strokeWidth={6} opacity={op} strokeLinecap="round" />
              );
            })}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: HARDENS ─────────────────────────────────────────────────────────
function SceneHardens() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Morph from pile to stone
  const hardenProg = interpolate(frame, [10, 50], [0, 1], clamp);
  
  const stoneColor = interpolate(hardenProg, [0, 1], [0, 1], clamp); // 0=green/brown, 1=white

  return (
    <AbsoluteFill>
      <Bg color={C.bgPanel} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Crevice Cross-section */}
            <path d="M -500,-200 L -300,-200 C -100,-200 -100,300 0,300 C 100,300 100,-200 300,-200 L 500,-200 L 500,500 L -500,500 Z" fill={C.fleshPink} />
            
            {/* The Mass */}
            <g transform="translate(0, 200)">
              {/* Outer shape shrinks into stone */}
              <path 
                d={
                  hardenProg < 1 
                  ? "M -100,0 C -120,-60 -50,-100 0,-120 C 50,-100 120,-60 100,0 C 80,60 50,80 0,80 C -50,80 -80,60 -100,0" 
                  : "M -80,0 C -90,-40 -40,-80 0,-90 C 40,-80 90,-40 80,0 C 70,40 40,50 0,50 C -40,50 -70,40 -80,0"
                } 
                fill={hardenProg > 0.5 ? C.stoneWhite : C.bactGreen} 
                opacity={0.9} 
                style={{ transition: 'all 0.1s' }}
              />
              
              {/* Stone texture fades in */}
              {hardenProg > 0.8 && (
                <g opacity={(hardenProg - 0.8) * 5}>
                  <circle cx={-20} cy={-20} r={15} fill={C.stoneShadow} />
                  <circle cx={30} cy={10} r={20} fill={C.stoneShadow} />
                  <circle cx={-40} cy={20} r={10} fill={C.stoneShadow} />
                </g>
              )}
            </g>

            {/* Sparkles when hardened */}
            {frame > 60 && Array.from({length: 4}).map((_, i) => (
              <g key={i} transform={`translate(${(i%2===0?-1:1)*80}, ${100 + (i>1?-50:50)}) scale(${Math.max(0, Math.sin((frame-60)*0.2 + i))})`}>
                <path d="M 0,-20 L 5,-5 L 20,0 L 5,5 L 0,20 L -5,5 L -20,0 L -5,-5 Z" fill="#FFF" />
              </g>
            ))}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 7: BAD BREATH ──────────────────────────────────────────────────────
function SceneBadBreath() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stone falls out
  const stoneY = interpolate(frame, [10, 40], [200, 800], clamp);
  
  // Stinky gas cloud rises
  const gasS = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 1, stiffness: 100 } });
  
  const w1 = spring({ frame: frame - 40, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg color={C.bgPanel} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Crevice Cross-section */}
            <path d="M -500,-200 L -300,-200 C -100,-200 -100,300 0,300 C 100,300 100,-200 300,-200 L 500,-200 L 500,500 L -500,500 Z" fill={C.fleshPink} />

            {/* Stone falling */}
            <g transform={`translate(0, ${stoneY}) rotate(${frame*5})`}>
              <path d="M -80,0 C -90,-40 -40,-80 0,-90 C 40,-80 90,-40 80,0 C 70,40 40,50 0,50 C -40,50 -70,40 -80,0" fill={C.stoneWhite} />
              <circle cx={-20} cy={-20} r={15} fill={C.stoneShadow} />
              <circle cx={30} cy={10} r={20} fill={C.stoneShadow} />
            </g>

            {/* Bad breath cloud */}
            {gasS > 0.01 && (
              <g transform={`translate(0, -300) scale(${gasS})`}>
                <circle cx={0} cy={0} r={200} fill={C.stinkGreen} opacity={0.8} />
                <circle cx={-120} cy={80} r={100} fill={C.stinkGreen} opacity={0.8} />
                <circle cx={120} cy={80} r={100} fill={C.stinkGreen} opacity={0.8} />
                <circle cx={-150} cy={-50} r={120} fill={C.stinkGreen} opacity={0.8} />
                <circle cx={150} cy={-50} r={120} fill={C.stinkGreen} opacity={0.8} />

                {/* Skull icon inside cloud */}
                <g transform="translate(0, -20) scale(0.8)">
                  <path d="M -80,0 C -80,-100 80,-100 80,0 L 80,40 L 60,80 L -60,80 L -80,40 Z" fill={C.bgDeep} />
                  <circle cx={-30} cy={0} r={20} fill={C.stinkGreen} />
                  <circle cx={30} cy={0} r={20} fill={C.stinkGreen} />
                  <path d="M -10,30 L 10,30" fill="none" stroke={C.stinkGreen} strokeWidth={8} />
                  <path d="M -30,60 L -30,80 M 0,60 L 0,80 M 30,60 L 30,80" fill="none" stroke={C.bgDeep} strokeWidth={8} />
                </g>
              </g>
            )}

            {/* Final Text */}
            <g transform="translate(0, 300)">
              {w1 > 0.01 && (
                <g transform={`scale(${interpolate(w1, [0, 1], [1.3, 1])})`}>
                  <rect x={-300} y={-80} width={600} height={140} rx={40} fill={C.gold} />
                  <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900} fontFamily="Poppins, Arial Black">BAD BREATH</text>
                </g>
              )}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Tonsil: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('tonsil_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={150}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene5 + 40} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene7 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneCough />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneName />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <ScenePits />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneFood />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneBacteria />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={S.scene7 - S.scene6}>
        <SceneHardens />
      </Sequence>
      <Sequence from={S.scene7} durationInFrames={DURATION_IN_FRAMES - S.scene7}>
        <SceneBadBreath />
      </Sequence>
    </AbsoluteFill>
  );
};

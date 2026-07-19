import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';

import beerfloodWords from './beerflood_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1061;

const C = {
  bgDeep: '#212529',
  beerDark: '#3A2012',
  beerFoam: '#E2C792',
  woodBrown: '#5C4033',
  brickRed: '#9A3B26',
  metalIron: '#6C757D',
  streetGray: '#343A40',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 198,
  scene3: 451,
  scene4: 621,
  scene5: 762,
  scene6: 851,
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

// ─── SCENE 1: VAT BURSTS ──────────────────────────────────────────────────────
function SceneVatBurst() {
  const frame = useCurrentFrame();

  const burst = frame > 120 ? frame - 120 : 0;
  const shake = frame > 100 && frame < 120 ? Math.sin(frame * 2) * 10 : 0;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>LONDON, 1814</text>
            <text y={-500} textAnchor="middle" fill={C.beerFoam} fontSize={80} fontWeight={900}>A GIANT VAT OF BEER</text>

            <g transform={`translate(${shake}, ${100})`}>
              {/* Wooden Vat */}
              <rect x={-300} y={-400} width={600} height={800} fill={C.woodBrown} rx={20} />
              
              {/* Iron Hoops */}
              {[-300, -100, 100, 300].map((y, i) => (
                <g key={i}>
                  <rect x={-310} y={y} width={620} height={30} fill={C.metalIron} />
                  {/* Hoop bursting */}
                  {burst > 0 && i === 1 && (
                    <g stroke={C.beerFoam} strokeWidth={20}>
                      <line x1={0} y1={y+15} x2={-200 - burst*10} y2={y - burst*5} />
                      <line x1={0} y1={y+15} x2={200 + burst*10} y2={y + burst*5} />
                    </g>
                  )}
                </g>
              ))}

              {/* Beer spraying out */}
              {burst > 0 && (
                <path d={`M -100,-100 Q 0,${-100 - burst*20} 100,-100`} fill="none" stroke={C.beerDark} strokeWidth={60} />
              )}
            </g>

            {burst > 0 && (
              <text y={600} textAnchor="middle" fill={C.brickRed} fontSize={90} fontWeight={900}>BURST ITS HOOPS</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: EXPLODED OUTWARD ────────────────────────────────────────────────
function SceneExplosion() {
  const frame = useCurrentFrame();

  const wave = interpolate(frame, [0, 100], [0, 1000], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Vats breaking */}
            <g transform="translate(-200, 0)">
              <rect x={-100} y={-200} width={200} height={400} fill={C.woodBrown} rx={10} />
              <line x1={-110} y1={-100} x2={-150} y2={-150} stroke={C.woodBrown} strokeWidth={20} />
              <line x1={110} y1={100} x2={150} y2={150} stroke={C.woodBrown} strokeWidth={20} />
            </g>

            <g transform="translate(200, 0)">
              <rect x={-100} y={-200} width={200} height={400} fill={C.woodBrown} rx={10} />
            </g>

            {/* Huge Wave of beer */}
            <g transform={`translate(0, 500)`}>
              <path d={`M -800,${-wave*0.5} Q 0,${-wave*1.5} 800,${-wave*0.5} L 800,500 L -800,500 Z`} fill={C.beerDark} />
              {/* Foam on top */}
              <path d={`M -800,${-wave*0.5} Q 0,${-wave*1.5} 800,${-wave*0.5}`} fill="none" stroke={C.beerFoam} strokeWidth={80} strokeLinecap="round" />
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>100,000 GALLONS</text>
            <text y={-350} textAnchor="middle" fill={C.beerFoam} fontSize={80} fontWeight={900}>EXPLODED OUTWARD</text>

            <text y={200} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>15 FEET HIGH</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: SMASHED BRICK WALLS ─────────────────────────────────────────────
function SceneSmash() {
  const frame = useCurrentFrame();

  const breakWall = Math.min(100, frame * 5);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Dark Basement */}
            <rect x={-540} y={-960} width={1080} height={1920} fill="#0B090A" />

            {/* Brick Wall breaking open */}
            <g transform="translate(0, 0)">
              <rect x={-540} y={-500} width={1080} height={1000} fill={C.brickRed} />
              {/* Hole punched through */}
              <circle cx={0} cy={0} r={breakWall * 4} fill={C.beerDark} />
              
              {/* Flying bricks */}
              {frame > 10 && Array.from({length: 12}).map((_, i) => (
                <rect 
                  key={i} 
                  x={(i%4 - 1.5)*150 + Math.cos(i)*breakWall} 
                  y={Math.floor(i/4 - 1.5)*150 + Math.sin(i)*breakWall} 
                  width={80} height={40} 
                  fill={C.brickRed} 
                  transform={`rotate(${breakWall + i*20})`}
                />
              ))}
            </g>

            {/* Beer flooding in through the hole */}
            <circle cx={0} cy={0} r={breakWall * 3} fill={C.beerDark} opacity={0.8} />
            <circle cx={0} cy={0} r={breakWall * 2} fill={C.beerFoam} opacity={0.5} />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>SMASHED THROUGH</text>
            <text y={-500} textAnchor="middle" fill={C.brickRed} fontSize={100} fontWeight={900}>BRICK WALLS</text>
            <text y={700} textAnchor="middle" fill={C.beerFoam} fontSize={70} fontWeight={900}>INTO CRAMPED BASEMENTS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: DROWNED IN DARK ─────────────────────────────────────────────────
function SceneDrown() {
  const frame = useCurrentFrame();

  const waveY = interpolate(frame, [0, 100], [400, -200], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={-960} width={1080} height={1920} fill="#0B090A" />

            {/* People silhouettes swept away */}
            <g transform={`translate(0, ${waveY + 200})`}>
              <g transform="translate(-100, 0) rotate(-45)">
                <circle cx={0} cy={-100} r={30} fill={C.white} />
                <path d="M -20,-70 L 20,-70 L 30,50 L -30,50 Z" fill={C.white} />
              </g>
              <g transform="translate(150, 50) rotate(70)">
                <circle cx={0} cy={-80} r={25} fill={C.white} />
                <path d="M -15,-50 L 15,-50 L 20,40 L -20,40 Z" fill={C.white} />
              </g>
            </g>

            {/* Rising tide of beer */}
            <path d={`M -540,${waveY} Q 0,${waveY - 100 + Math.sin(frame*0.1)*50} 540,${waveY} L 540,960 L -540,960 Z`} fill={C.beerDark} opacity={0.9} />
            
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>DROWNED IN THE DARK</text>
            <text y={-400} textAnchor="middle" fill={C.beerFoam} fontSize={70} fontWeight={900}>SWEPT OFF THEIR FEET</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: EIGHT DIED ──────────────────────────────────────────────────────
function SceneEightDied() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Eight graves */}
            <g transform="translate(0, 100)">
              {Array.from({length: 8}).map((_, i) => {
                const x = (i % 4 - 1.5) * 200;
                const y = Math.floor(i / 4) * 200 - 100;
                // Make one smaller for the child
                const scale = i === 7 ? 0.7 : 1.0;
                return (
                  <g key={i} transform={`translate(${x}, ${y}) scale(${scale})`}>
                    <path d="M -50,0 L 50,0 L 50,-80 A 50 50 0 0 0 -50,-80 Z" fill={C.metalIron} />
                    <text y={-40} textAnchor="middle" fill={C.bgDeep} fontSize={30} fontWeight={900}>RIP</text>
                  </g>
                );
              })}
            </g>

            <text y={-400} textAnchor="middle" fill={C.brickRed} fontSize={120} fontWeight={900}>EIGHT DIED</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>INCLUDING A CHILD</text>
            <text y={600} textAnchor="middle" fill={C.beerFoam} fontSize={60} fontWeight={900}>AT A WAKE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: DRINKING FROM STREETS ───────────────────────────────────────────
function SceneDrinking() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={100} width={1080} height={860} fill={C.streetGray} />

            {/* Puddles of beer */}
            <ellipse cx={-100} cy={300} rx={300} ry={100} fill={C.beerDark} />
            <ellipse cx={200} cy={500} rx={200} ry={80} fill={C.beerDark} />

            {/* People scooping */}
            <g transform="translate(-100, 250)">
              <circle cx={0} cy={-80} r={40} fill="#FAD7A1" />
              <path d="M -30,-50 L 30,-50 L 50,50 L -50,50 Z" fill="#457B9D" />
              {/* Cup */}
              <rect x={40} y={40} width={30} height={40} fill={C.metalIron} rx={5} />
            </g>

            <g transform="translate(150, 450)">
              <circle cx={0} cy={-80} r={35} fill="#FAD7A1" />
              <path d="M -25,-50 L 25,-50 L 40,40 L -40,40 Z" fill="#A8DADC" />
              {/* Cup scooped */}
              <rect x={-50} y={20} width={30} height={40} fill={C.metalIron} rx={5} transform={`rotate(${Math.sin(frame*0.1)*20})`} />
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>IN THE DAYS AFTER...</text>
            <text y={-250} textAnchor="middle" fill={C.beerFoam} fontSize={70} fontWeight={900}>CROWDS WADED IN</text>
            
            <text y={800} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TO SCOOP UP AND DRINK IT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Beerflood: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('beerflood_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneVatBurst />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneExplosion />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneSmash />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneDrown />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneEightDied />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneDrinking />
      </Sequence>
    </AbsoluteFill>
  );
};

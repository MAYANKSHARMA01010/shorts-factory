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

import fugatesWords from './fugates_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1097;

const C = {
  bgDeep: '#111827',
  skinBlue: '#3B82F6',
  skinPink: '#FBCFE8',
  plumLip: '#701A75',
  bloodRed: '#991B1B',
  bruisePurple: '#4C1D95',
  hillGreen: '#065F46',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 151,
  scene3: 403,
  scene4: 650,
  scene5: 803,
  scene6: 908,
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

// ─── SCENE 1: HILLS OF KENTUCKY ───────────────────────────────────────────────
function SceneHills() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Green Hills */}
            <path d="M -540,0 Q -200,-200 100,50 T 540,-50 L 540,960 L -540,960 Z" fill={C.hillGreen} />
            <path d="M -540,200 Q -300,50 0,300 T 540,100 L 540,960 L -540,960 Z" fill="#047857" />

            {/* Cabin */}
            <g transform="translate(0, -50)">
              <rect x={-80} y={-100} width={160} height={100} fill="#78350F" />
              <path d="M -100,-100 L 0,-180 L 100,-100 Z" fill="#92400E" />
              <rect x={-20} y={-50} width={40} height={50} fill="#451A03" />
            </g>

            {/* Blue family standing */}
            <g transform="translate(-150, 100) scale(1.5)">
              {/* Father */}
              <circle cx={-40} cy={-40} r={15} fill={C.skinBlue} />
              <rect x={-50} y={-25} width={20} height={40} fill="#4B5563" />
              {/* Mother */}
              <circle cx={0} cy={-30} r={12} fill={C.skinBlue} />
              <rect x={-10} y={-18} width={20} height={35} fill="#6B7280" />
              {/* Child */}
              <circle cx={30} cy={-15} r={10} fill={C.skinBlue} />
              <rect x={20} y={-5} width={20} height={20} fill="#9CA3AF" />
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>HILLS OF KENTUCKY</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>LIVED A FAMILY</text>
            
            <text y={450} textAnchor="middle" fill={C.skinBlue} fontSize={80} fontWeight={900}>WHOSE SKIN WAS</text>
            <text y={550} textAnchor="middle" fill={C.skinBlue} fontSize={100} fontWeight={900}>DEEP BLUE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: BLOOD CONDITION ─────────────────────────────────────────────────
function SceneBlood() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Blood vessel */}
            <path d="M -400,-100 Q 0,-50 400,-100 L 400,100 Q 0,50 -400,100 Z" fill="#450A0A" />

            {/* Blood cells moving */}
            {Array.from({length: 8}).map((_, i) => (
              <circle 
                key={i} 
                cx={((i * 100 - frame * 5) % 800) - 400} 
                cy={Math.sin(frame*0.1 + i)*20} 
                r={30} 
                fill={i % 2 === 0 ? C.bloodRed : C.skinBlue} 
              />
            ))}

            {/* Oxygen failing to attach */}
            {Array.from({length: 4}).map((_, i) => (
              <g key={`o2-${i}`} transform={`translate(${((i * 200 - frame * 3) % 800) - 400}, -150)`}>
                <text textAnchor="middle" fill={C.white} fontSize={30}>O₂</text>
                {/* Arrow bouncing off */}
                <path d={`M 0,20 L 0,80 L 20,60 M 0,80 L -20,60`} fill="none" stroke={C.white} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                <path d={`M 0,80 Q 50,150 100,50`} fill="none" stroke="#EF4444" strokeWidth={5} strokeLinecap="round" strokeDasharray="10, 10" transform={`translate(0, ${Math.sin(frame*0.2)*10})`} />
              </g>
            ))}

            <text y={-350} textAnchor="middle" fill={C.bloodRed} fontSize={60} fontWeight={900}>RARE BLOOD CONDITION</text>
            <text y={300} textAnchor="middle" fill={C.skinBlue} fontSize={40} fontWeight={900}>UNABLE TO CARRY OXYGEN</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: FAMILY TREE ─────────────────────────────────────────────────────
function SceneTree() {
  const frame = useCurrentFrame();

  const drawProgress = interpolate(frame, [0, 60], [0, 100], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Family Tree structure */}
            <g stroke={C.white} strokeWidth={5} fill="none">
              <path d={`M -100,-400 L 100,-400`} strokeDasharray={`${drawProgress*2}, 200`} />
              <path d={`M 0,-400 L 0,-200 L -150,-200 L -150,-100`} strokeDasharray={`${drawProgress*4}, 400`} />
              <path d={`M 0,-200 L 150,-200 L 150,-100`} strokeDasharray={`${drawProgress*4}, 400`} />
              
              <path d={`M -150,-100 L -150,100 L 0,100 L 0,200`} strokeDasharray={`${drawProgress*4}, 400`} />
              <path d={`M 150,-100 L 150,100 L 0,100`} strokeDasharray={`${drawProgress*4}, 400`} />

              <path d={`M 0,200 L 0,400 L -100,400`} strokeDasharray={`${drawProgress*4}, 400`} />
              <path d={`M 0,400 L 100,400`} strokeDasharray={`${drawProgress*4}, 400`} />
            </g>

            {/* Nodes */}
            <circle cx={-100} cy={-400} r={30} fill={C.skinBlue} />
            <circle cx={100} cy={-400} r={30} fill={C.skinPink} />
            
            <circle cx={-150} cy={-100} r={30} fill={C.skinBlue} />
            <circle cx={150} cy={-100} r={30} fill={C.skinBlue} />

            <circle cx={0} cy={200} r={40} fill={C.skinBlue} />
            
            <circle cx={-100} cy={400} r={30} fill={C.skinBlue} />
            <circle cx={100} cy={400} r={30} fill={C.skinBlue} />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>AREA WAS ISOLATED</text>
            <text y={-500} textAnchor="middle" fill={C.skinBlue} fontSize={60} fontWeight={900}>RELATIVES MARRIED RELATIVES</text>
            
            <text y={650} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>PASSING THE TRAIT DOWN</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: LIPS AND SKIN ───────────────────────────────────────────────────
function SceneLipsSkin() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Face close up */}
            <circle cx={0} cy={0} r={250} fill={C.skinBlue} />

            {/* Eyes */}
            <path d="M -100,-50 Q -50,-100 0,-50" fill="none" stroke={C.white} strokeWidth={10} />
            <path d="M 100,-50 Q 50,-100 0,-50" fill="none" stroke={C.white} strokeWidth={10} />

            {/* Plum lips */}
            <g transform="translate(0, 100)">
              <path d="M -80,0 Q 0,-50 80,0 Q 0,30 -80,0 Z" fill={C.plumLip} />
              <path d="M -80,0 Q 0,50 80,0 Q 0,20 -80,0 Z" fill={C.plumLip} />
            </g>

            {/* Bruise texture */}
            <circle cx={150} cy={-150} r={80} fill={C.bruisePurple} opacity={0.3} filter="blur(20px)" />
            <circle cx={-180} cy={100} r={100} fill={C.bruisePurple} opacity={0.2} filter="blur(30px)" />

            <text y={-350} textAnchor="middle" fill={C.plumLip} fontSize={60} fontWeight={900}>LIPS THE COLOR OF PLUMS</text>
            <text y={350} textAnchor="middle" fill={C.bruisePurple} fontSize={60} fontWeight={900}>SKIN LIKE A BRUISE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: NEIGHBORS WHISPERED ─────────────────────────────────────────────
function SceneNeighbors() {
  const frame = useCurrentFrame();

  const whisper = Math.sin(frame * 0.5) * 5;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* The Blue family isolated in center */}
            <circle cx={0} cy={0} r={150} fill={C.bgDeep} stroke={C.skinBlue} strokeWidth={5} />
            <circle cx={-30} cy={-30} r={30} fill={C.skinBlue} />
            <circle cx={40} cy={20} r={20} fill={C.skinBlue} />
            <circle cx={-10} cy={50} r={25} fill={C.skinBlue} />

            {/* Neighbors looking and whispering */}
            {Array.from({length: 6}).map((_, i) => {
              const angle = (i / 6) * Math.PI * 2;
              const x = Math.cos(angle) * 350;
              const y = Math.sin(angle) * 350;
              return (
                <g key={i} transform={`translate(${x}, ${y})`}>
                  <circle cx={0} cy={0} r={40} fill={C.skinPink} />
                  {/* Pointing/Whispering lines */}
                  <path d={`M 0,0 L ${-Math.cos(angle)*50},${-Math.sin(angle)*50}`} stroke={C.white} strokeWidth={5} strokeDasharray="10, 5" opacity={0.5} />
                  
                  <text x={Math.cos(angle + 1)*50} y={Math.sin(angle + 1)*50 + whisper} fontSize={30} opacity={0.8}>💬</text>
                </g>
              );
            })}

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>NEIGHBORS WHISPERED</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>AND AVOIDED THEM</text>
            <text y={700} textAnchor="middle" fill={C.skinBlue} fontSize={80} fontWeight={900}>FOR GENERATIONS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: DOCTOR PILL ─────────────────────────────────────────────────────
function ScenePill() {
  const frame = useCurrentFrame();

  const colorTrans = interpolateColors(frame, [0, 60], [C.skinBlue, C.skinPink]);
  const pillFall = interpolate(frame, [0, 30], [-400, 0], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Person whose skin changes color */}
            <circle cx={0} cy={100} r={200} fill={colorTrans} />
            <path d="M -150,300 L 150,300 L 200,500 L -200,500 Z" fill="#374151" />

            {/* Pill dropping */}
            <g transform={`translate(0, ${pillFall}) rotate(${frame * 5})`}>
              <rect x={-20} y={-40} width={40} height={80} fill={C.white} rx={20} />
              <line x1={-20} y1={0} x2={20} y2={0} stroke="#D1D5DB" strokeWidth={4} />
            </g>

            {/* Sparkles of healing */}
            {frame > 30 && Array.from({length: 8}).map((_, i) => (
              <circle 
                key={i} 
                cx={(Math.random()-0.5)*300} 
                cy={100 + (Math.random()-0.5)*300} 
                r={5 + Math.random()*5} 
                fill={C.white} 
                opacity={0.8 - ((frame-30)*0.02)} 
              />
            ))}

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>DOCTOR ARRIVED</text>
            <text y={-320} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>WITH A SIMPLE PILL</text>
            
            <text y={450} textAnchor="middle" fill={colorTrans} fontSize={60} fontWeight={900}>FADED BACK TO PINK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Fugates: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('fugates_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneHills />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneBlood />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneTree />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneLipsSkin />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneNeighbors />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePill />
      </Sequence>
    </AbsoluteFill>
  );
};

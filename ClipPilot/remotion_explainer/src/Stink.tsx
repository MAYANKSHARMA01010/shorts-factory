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

import stinkWords from './stink_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1159;

const C = {
  bgDeep: '#1A1C19',
  riverMurk: '#4F5D36',
  sunHot: '#D95D39',
  stinkGreen: '#A2C11C',
  parliamentStone: '#B0A8B9',
  curtainRed: '#8B0000',
  brickSewer: '#8A3A3A',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 217,
  scene3: 488,
  scene4: 735,
  scene5: 821,
  scene6: 1023,
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

// ─── SCENE 1: OPEN SEWER ──────────────────────────────────────────────────────
function SceneRiver() {
  const frame = useCurrentFrame();

  const flow = frame * 2;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* River flowing down the screen */}
            <path d={`M -300,-1000 Q -200,0 -300,1000 L 300,1000 Q 200,0 300,-1000 Z`} fill={C.riverMurk} />
            
            {/* Pipes pouring waste into the river */}
            <g transform="translate(-400, -300)">
              <rect x={0} y={0} width={150} height={50} fill="#6C757D" />
              <path d="M 150,25 Q 200,25 200,200" fill="none" stroke="#4A3018" strokeWidth={30} strokeDasharray="50, 20" transform={`translate(0, ${flow % 70})`} />
            </g>

            <g transform="translate(250, 200)">
              <rect x={0} y={0} width={150} height={50} fill="#6C757D" />
              <path d="M 0,25 Q -50,25 -50,200" fill="none" stroke="#4A3018" strokeWidth={40} strokeDasharray="60, 30" transform={`translate(0, ${flow % 90})`} />
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>RIVER THAMES</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>HAD BECOME AN OPEN SEWER</text>
            
            <text y={600} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>SWALLOWING THE WASTE</text>
            <text y={700} textAnchor="middle" fill={C.stinkGreen} fontSize={80} fontWeight={900}>OF MILLIONS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: THE GREAT STINK ─────────────────────────────────────────────────
function SceneHeatwave() {
  const frame = useCurrentFrame();

  const heatWobble = Math.sin(frame * 0.5) * 10;
  const sunScale = interpolate(frame, [0, 60], [1, 1.5], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Blazing Sun */}
            <circle cx={0} cy={-400} r={200 * sunScale} fill={C.sunHot} opacity={0.8} />
            <circle cx={0} cy={-400} r={150 * sunScale} fill="#FFB703" />

            {/* Baking riverbanks */}
            <g transform={`translate(0, 300 + ${heatWobble})`}>
              <ellipse cx={0} cy={0} rx={400} ry={100} fill={C.riverMurk} />
              
              {/* Stink rising */}
              {Array.from({length: 10}).map((_, i) => (
                <path 
                  key={i} 
                  d={`M ${(i-4.5)*60},0 Q ${(i-4.5)*80},${-100} ${(i-4.5)*50},${-200} T ${(i-4.5)*60},${-400}`} 
                  fill="none" 
                  stroke={C.stinkGreen} 
                  strokeWidth={20} 
                  opacity={0.6} 
                  transform={`translate(0, ${-(frame*5 + i*20) % 400})`} 
                />
              ))}
            </g>

            <text y={0} textAnchor="middle" fill={C.sunHot} fontSize={90} fontWeight={900}>BRUTAL HEATWAVE</text>
            <text y={100} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>COOKING THE FILTH</text>
            
            <text y={650} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>INTO A STENCH SO VILE</text>
            <text y={750} textAnchor="middle" fill={C.stinkGreen} fontSize={120} fontWeight={900}>THE GREAT STINK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: PARLIAMENT GAGGING ──────────────────────────────────────────────
function SceneParliament() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg color={C.parliamentStone} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Windows of parliament */}
            <rect x={-300} y={-500} width={200} height={400} fill={C.bgDeep} rx={20} />
            <rect x={100} y={-500} width={200} height={400} fill={C.bgDeep} rx={20} />

            {/* Stink creeping in */}
            <path d="M -540,-50 Q 0,-200 540,100" fill="none" stroke={C.stinkGreen} strokeWidth={80} opacity={0.5} transform={`translate(0, ${Math.sin(frame*0.1)*50})`} />

            {/* Lawmaker gagging */}
            <g transform="translate(0, 300)">
              <rect x={-150} y={-100} width={300} height={400} fill="#212529" rx={40} />
              <circle cx={0} cy={-150} r={80} fill="#FAD7A1" />
              {/* Hand holding cloth over mouth */}
              <rect x={-60} y={-170} width={120} height={80} fill={C.white} rx={10} />
              <circle cx={40} cy={-120} r={30} fill="#FAD7A1" />
            </g>

            {/* Chemical soaked curtains */}
            <path d="M -540,-960 L -400,-960 Q -300,0 -540,960 Z" fill={C.curtainRed} />
            <path d="M 540,-960 L 400,-960 Q 300,0 540,960 Z" fill={C.curtainRed} />

            {/* Drips from chemicals on curtains */}
            {Array.from({length: 5}).map((_, i) => (
              <circle key={i} cx={-400 + i*10} cy={-500 + ((frame*5 + i*30)%1000)} r={5} fill={C.white} opacity={0.5} />
            ))}

            <text y={-600} textAnchor="middle" fill={C.bgDeep} fontSize={80} fontWeight={900}>SMELL CREPT INTO PARLIAMENT</text>
            <text y={750} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>GAGGED BEHIND CURTAINS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: NEARLY FLED ─────────────────────────────────────────────────────
function SceneFled() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Parliament building silhouette */}
            <path d="M -300,400 L -300,100 L -200,100 L -200,0 L -100,0 L -100,-300 L 0,-400 L 100,-300 L 100,0 L 200,0 L 200,100 L 300,100 L 300,400 Z" fill={C.parliamentStone} />

            {/* People running out */}
            <g transform={`translate(${-frame * 10}, 400)`}>
              <circle cx={-50} cy={-60} r={20} fill={C.white} />
              <path d="M -70,-40 L -30,-40 L -40,20 L -60,20 Z" fill={C.white} />
            </g>
            <g transform={`translate(${frame * 12}, 400)`}>
              <circle cx={50} cy={-50} r={18} fill={C.white} />
              <path d="M 30,-30 L 70,-30 L 60,30 L 40,30 Z" fill={C.white} />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>NEARLY FLED</text>
            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>THE BUILDING</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: FUNDING SEWERS ──────────────────────────────────────────────────
function SceneSewers() {
  const frame = useCurrentFrame();

  const flow = frame * 4;

  return (
    <AbsoluteFill>
      <Bg color={C.brickSewer} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Giant Brick Archway */}
            <path d="M -400,600 L -400,-100 A 400 400 0 0 1 400,-100 L 400,600 Z" fill={C.bgDeep} />
            
            {/* Bricks texture */}
            <g stroke="#3A1A1A" strokeWidth={5}>
              {Array.from({length: 10}).map((_, y) => (
                <line key={`h${y}`} x1={-540} y1={-960 + y*100} x2={540} y2={-960 + y*100} />
              ))}
              {Array.from({length: 10}).map((_, y) => 
                Array.from({length: 10}).map((_, x) => (
                  <line key={`v${y}${x}`} x1={-500 + x*100 + (y%2)*50} y1={-960 + y*100} x2={-500 + x*100 + (y%2)*50} y2={-860 + y*100} />
                ))
              )}
            </g>

            {/* Clean water flowing now */}
            <path d="M -400,400 L 400,400 L 400,600 L -400,600 Z" fill="#457B9D" />
            <path d={`M -400,400 Q ${-200 + flow%400},350 0,400 T 400,400`} fill="none" stroke="#A8DADC" strokeWidth={10} />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>THE UNBEARABLE REEK</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>FORCED THEM TO ACT</text>

            <text y={100} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>FUNDING A VAST NETWORK</text>
            <text y={200} textAnchor="middle" fill={C.stinkGreen} fontSize={90} fontWeight={900}>OF SEWERS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: A SMELL NOT DISEASE ─────────────────────────────────────────────
function SceneConclusion() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Split Concept: Smell vs Disease */}
            
            {/* Smell */}
            <g transform="translate(-150, 0)">
              <circle cx={0} cy={0} r={100} fill={C.stinkGreen} opacity={0.2} />
              <path d="M -30,50 Q 0,-50 30,50" fill="none" stroke={C.stinkGreen} strokeWidth={20} strokeLinecap="round" />
              <text y={150} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>A SMELL</text>
            </g>

            {/* Disease - crossed out */}
            <g transform="translate(150, 0)">
              <circle cx={0} cy={0} r={100} fill="#6C757D" opacity={0.2} />
              <circle cx={0} cy={0} r={40} fill="#9A031E" />
              <circle cx={-20} cy={-30} r={10} fill="#9A031E" />
              <circle cx={30} cy={20} r={15} fill="#9A031E" />
              
              <line x1={-80} y1={-80} x2={80} y2={80} stroke={C.white} strokeWidth={15} />
              <text y={150} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>NOT A DISEASE</text>
            </g>

            <text y={-300} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>SO IT TOOK</text>
            <text y={350} textAnchor="middle" fill="#457B9D" fontSize={70} fontWeight={900}>TO FINALLY CLEAN UP</text>
            <text y={420} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>THE CITY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Stink: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('stink_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneRiver />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneHeatwave />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneParliament />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneFled />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneSewers />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneConclusion />
      </Sequence>
    </AbsoluteFill>
  );
};

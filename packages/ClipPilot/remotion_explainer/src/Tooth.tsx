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

import toothWords from './tooth_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1074;

const C = {
  bgDeep: '#1A0B0E',
  toothWhite: '#F8F9FA',
  decayBrown: '#4A3B32',
  decayBlack: '#212529',
  gumPink: '#E5989B',
  gumRed: '#D90429',
  wormGreen: '#A7C957',
  smokeGray: '#CED4DA',
  fireOrange: '#E85D04',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 190,
  scene3: 395,
  scene4: 602,
  scene5: 784,
  scene6: 880,
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

// ─── SCENE 1: WORM BURROWING ──────────────────────────────────────────────────
function SceneWorm() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Gums */}
            <path d="M -540,200 Q 0,100 540,200 L 540,960 L -540,960 Z" fill={C.gumPink} />
            
            {/* Giant Tooth */}
            <path d="M -200,-200 C -200,-500 200,-500 200,-200 C 200,0 150,200 150,400 C 50,200 -50,200 -150,400 C -150,200 -200,0 -200,-200 Z" fill={C.toothWhite} />
            
            {/* Cross section hole */}
            <circle cx={0} cy={-100} r={100} fill={C.decayBlack} />

            {/* Tiny worm burrowing */}
            <g transform={`translate(${Math.sin(frame*0.1)*30}, ${-100 + Math.cos(frame*0.1)*30}) rotate(${Math.sin(frame*0.2)*20})`}>
              <path d="M -40,0 Q -20,-20 0,0 T 40,0" fill="none" stroke={C.wormGreen} strokeWidth={20} strokeLinecap="round" />
              <circle cx={-40} cy={0} r={15} fill={C.wormGreen} />
              <circle cx={-45} cy={-5} r={3} fill="#000" />
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>THOUSANDS OF YEARS AGO</text>
            <text y={600} textAnchor="middle" fill={C.wormGreen} fontSize={80} fontWeight={900}>THE TOOTH WORM MYTH</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: THROBBING SQUIRMING ─────────────────────────────────────────────
function SceneThrobbing() {
  const frame = useCurrentFrame();

  const throb = Math.sin(frame * 0.5) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Close up on tooth surface */}
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.toothWhite} />
            
            <g transform={`scale(${1 + throb/100})`}>
              {/* Nerve lines glowing red */}
              <path d="M 0,0 Q 100,100 -50,200 T 50,400" fill="none" stroke={C.gumRed} strokeWidth={30} opacity={0.6 + Math.sin(frame)*0.4} />
              <path d="M -100,-200 Q 50,-100 -150,0 T -50,200" fill="none" stroke={C.gumRed} strokeWidth={20} opacity={0.6 + Math.cos(frame)*0.4} />
              
              {/* Bulging surface */}
              <circle cx={0} cy={100} r={150 + throb} fill={C.decayBrown} opacity={0.2} />
              <circle cx={0} cy={100} r={100 + throb} fill={C.decayBlack} opacity={0.3} />
            </g>

            <text y={-200} textAnchor="middle" fill={C.decayBlack} fontSize={60} fontWeight={900}>THROBBING FELT LIKE</text>
            <text y={-120} textAnchor="middle" fill={C.gumRed} fontSize={60} fontWeight={900}>SOMETHING ALIVE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: SMOKE LURE ──────────────────────────────────────────────────────
function SceneSmokeLure() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Funnel/Pipe blowing smoke */}
            <path d="M -200,-500 L -50,-200 L 50,-200 L 200,-500 Z" fill="#6C757D" />
            <rect x={-50} y={-200} width={100} height={300} fill="#6C757D" />

            {/* Burning seeds */}
            <circle cx={0} cy={-400} r={80} fill={C.fireOrange} />
            <circle cx={-50} cy={-450} r={40} fill={C.decayBlack} />
            <circle cx={50} cy={-350} r={40} fill={C.decayBlack} />

            {/* Hot Smoke clouds flowing down */}
            <g transform="translate(0, 100)">
              {Array.from({length: 15}).map((_, i) => {
                const y = ((frame * 5 + i * 40) % 600) - 100;
                const x = Math.sin(y * 0.02) * 50;
                return (
                  <circle key={i} cx={x} cy={y} r={30 + y*0.1} fill={C.smokeGray} opacity={1 - y/600} />
                );
              })}
            </g>

            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>LURE THE WORM OUT</text>
            <text y={500} textAnchor="middle" fill={C.smokeGray} fontSize={60} fontWeight={900}>WITH HOT SEED SMOKE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: WHITE THREADS ───────────────────────────────────────────────────
function SceneWhiteThreads() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Tooth hole */}
            <circle cx={0} cy={0} r={200} fill={C.toothWhite} />
            <circle cx={0} cy={0} r={150} fill={C.decayBlack} />

            {/* White threads wriggling out */}
            <g>
              {Array.from({length: 8}).map((_, i) => {
                const phase = i * Math.PI / 4;
                const progress = interpolate(frame, [0, 60], [0, 100], clamp);
                const wriggle = Math.sin(frame * 0.3 + i) * 20;
                return (
                  <path 
                    key={i}
                    d={`M ${Math.cos(phase)*50},${Math.sin(phase)*50} Q ${Math.cos(phase)*100 + wriggle},${Math.sin(phase)*100 - wriggle} ${Math.cos(phase)*(100+progress)},${Math.sin(phase)*(100+progress)}`}
                    fill="none" 
                    stroke={C.toothWhite} 
                    strokeWidth={8} 
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            <text y={-250} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>TINY WHITE THREADS</text>
            <text y={300} textAnchor="middle" fill={C.wormGreen} fontSize={40} fontWeight={900}>THEY THOUGHT IT WAS WORMS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: JUST FIBERS ─────────────────────────────────────────────────────
function SceneJustFibers() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Plant Seed bursting open */}
            <circle cx={0} cy={0} r={150} fill={C.decayBrown} />
            <path d="M -150,0 Q 0,-200 150,0 Q 0,200 -150,0" fill="none" stroke={C.decayBlack} strokeWidth={10} />
            
            {/* Fibers flying out */}
            <g transform={`rotate(${frame * 2})`}>
              {Array.from({length: 20}).map((_, i) => (
                <line 
                  key={i} 
                  x1={0} y1={0} 
                  x2={Math.cos(i*Math.PI*2/20)*250} 
                  y2={Math.sin(i*Math.PI*2/20)*250} 
                  stroke={C.toothWhite} 
                  strokeWidth={5} 
                />
              ))}
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>JUST FIBERS</text>
            <text y={-300} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>FROM THE PLANT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: REAL CAUSE ──────────────────────────────────────────────────────
function SceneRealCause() {
  const frame = useCurrentFrame();

  const rot = Math.min(60, frame);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>THE REAL CAUSE:</text>
            <text y={-400} textAnchor="middle" fill={C.decayBrown} fontSize={120} fontWeight={900}>DECAY</text>

            {/* Rotting Tooth */}
            <g transform="translate(0, 100)">
              <path d="M -200,-200 C -200,-500 200,-500 200,-200 C 200,0 150,200 150,400 C 50,200 -50,200 -150,400 C -150,200 -200,0 -200,-200 Z" fill={C.toothWhite} />
              
              {/* Spreading decay */}
              <g opacity={Math.min(1, frame/60)}>
                <circle cx={-50} cy={-250} r={80} fill={C.decayBrown} />
                <circle cx={-50} cy={-250} r={40} fill={C.decayBlack} />
                
                <circle cx={80} cy={-150} r={100} fill={C.decayBrown} />
                <circle cx={80} cy={-150} r={60} fill={C.decayBlack} />
                
                <circle cx={0} cy={0} r={60} fill={C.decayBrown} />
              </g>

              {/* Smoke lingering doing nothing */}
              <circle cx={0} cy={-350} r={150} fill={C.smokeGray} opacity={0.3} />
            </g>

            <text y={700} textAnchor="middle" fill={C.gumRed} fontSize={80} fontWeight={900}>STILL ACHING</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Tooth: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('tooth_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneWorm />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneThrobbing />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneSmokeLure />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneWhiteThreads />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneJustFibers />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneRealCause />
      </Sequence>
    </AbsoluteFill>
  );
};

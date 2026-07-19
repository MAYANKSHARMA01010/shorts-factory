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

import blackholeWords from './blackhole_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1094;

const C = {
  bgDeep: '#030712',
  spaceBlack: '#000000',
  accretionDisk: '#F97316',
  diskCore: '#FEF08A',
  astronautWhite: '#F3F4F6',
  visorGold: '#FBBF24',
  redShift: '#991B1B',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 211,
  scene3: 356,
  scene4: 505,
  scene5: 694,
  scene6: 873,
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

// ─── SCENE 1: FLOATING IN DARK ────────────────────────────────────────────────
function SceneFloating() {
  const frame = useCurrentFrame();

  const floatY = Math.sin(frame * 0.05) * 20;
  const floatRot = Math.sin(frame * 0.02) * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Stars */}
            {Array.from({length: 50}).map((_, i) => (
              <circle 
                key={i} 
                cx={(Math.random()-0.5)*1080} 
                cy={(Math.random()-0.5)*1920} 
                r={1 + Math.random()*2} 
                fill={C.white} 
                opacity={Math.sin(frame*0.05 + i)*0.5 + 0.5} 
              />
            ))}

            {/* Astronaut floating feet down */}
            <g transform={`translate(0, ${floatY}) rotate(${floatRot}) scale(1.5)`}>
              {/* Body */}
              <rect x={-30} y={-50} width={60} height={100} fill={C.astronautWhite} rx={20} />
              {/* Helmet */}
              <circle cx={0} cy={-70} r={35} fill={C.astronautWhite} />
              <rect x={-25} y={-85} width={50} height={30} fill={C.visorGold} rx={10} />
              {/* Arms */}
              <rect x={-55} y={-40} width={20} height={70} fill={C.astronautWhite} rx={10} transform="rotate(15, -40, -40)" />
              <rect x={35} y={-40} width={20} height={70} fill={C.astronautWhite} rx={10} transform="rotate(-15, 40, -40)" />
              {/* Legs pointing down */}
              <rect x={-25} y={40} width={20} height={80} fill={C.astronautWhite} rx={10} />
              <rect x={5} y={40} width={20} height={80} fill={C.astronautWhite} rx={10} />
            </g>

            {/* Impending Black Hole below */}
            <ellipse cx={0} cy={1200} rx={800} ry={200} fill={C.accretionDisk} opacity={0.3} filter="blur(50px)" />
            <ellipse cx={0} cy={1200} rx={600} ry={100} fill={C.diskCore} opacity={0.5} filter="blur(20px)" />
            <circle cx={0} cy={1200} r={400} fill={C.spaceBlack} />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>WHAT IF YOU FELL</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>FEET FIRST</text>
            <text y={-400} textAnchor="middle" fill={C.accretionDisk} fontSize={90} fontWeight={900}>INTO A BLACK HOLE?</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: GRAVITY YANKS FEET ──────────────────────────────────────────────
function SceneYank() {
  const frame = useCurrentFrame();

  const pull = interpolate(frame, [0, 60], [0, 100], clamp);
  const stretch = interpolate(frame, [0, 60], [1, 1.2], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Gravity Lines pulling down */}
            <g stroke={C.white} strokeWidth={5} strokeDasharray="20, 20" opacity={0.5}>
              <path d={`M -150,-200 L -150,${200 + frame*10}`} />
              <path d={`M 150,-200 L 150,${200 + frame*15}`} />
            </g>

            {/* Astronaut starting to stretch */}
            <g transform={`translate(0, ${pull}) scale(1, ${stretch})`}>
              {/* Body */}
              <rect x={-30} y={-50} width={60} height={100} fill={C.astronautWhite} rx={20} />
              {/* Helmet */}
              <circle cx={0} cy={-70} r={35} fill={C.astronautWhite} />
              <rect x={-25} y={-85} width={50} height={30} fill={C.visorGold} rx={10} />
              {/* Legs pulling hard */}
              <rect x={-25} y={40} width={20} height={80 + pull*0.5} fill={C.astronautWhite} rx={10} />
              <rect x={5} y={40} width={20} height={80 + pull*0.5} fill={C.astronautWhite} rx={10} />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>GRAVITY YANKS YOUR FEET</text>
            <text y={-400} textAnchor="middle" fill="#EF4444" fontSize={90} fontWeight={900}>FAR HARDER</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>THAN YOUR HEAD</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: STRETCH LIKE TAFFY ──────────────────────────────────────────────
function SceneTaffy() {
  const frame = useCurrentFrame();

  const stretch = interpolate(frame, [0, 100], [1, 5], clamp);
  const width = interpolate(frame, [0, 100], [60, 20], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <circle cx={0} cy={800} r={400} fill={C.spaceBlack} stroke={C.accretionDisk} strokeWidth={20} />

            {/* Astronaut stretching extremely */}
            <g transform={`translate(0, 0)`}>
              <rect x={-width/2} y={-200} width={width} height={400 * stretch} fill={C.astronautWhite} rx={10} />
              {/* Helmet warping */}
              <ellipse cx={0} cy={-250} rx={35 * (60/width)} ry={35 * stretch * 0.5} fill={C.astronautWhite} />
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>BODY STARTS TO STRETCH</text>
            <text y={-500} textAnchor="middle" fill={C.visorGold} fontSize={100} fontWeight={900}>LIKE WARM TAFFY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: SPAGHETTIFICATION ───────────────────────────────────────────────
function SceneSpaghetti() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Swirling into the black hole center */}
            <circle cx={0} cy={0} r={100} fill={C.spaceBlack} />
            <circle cx={0} cy={0} r={150} fill="none" stroke={C.accretionDisk} strokeWidth={20} filter="blur(10px)" />
            <circle cx={0} cy={0} r={300} fill="none" stroke={C.accretionDisk} strokeWidth={5} filter="blur(5px)" transform={`rotate(${frame * 2})`} strokeDasharray="100, 50" />

            {/* A single strand thinner than a hair winding in */}
            <path d={`M 0,0 Q 100,-100 200,0 T 400,0 T 600,0`} fill="none" stroke={C.astronautWhite} strokeWidth={2} transform={`rotate(${-frame * 5})`} />
            <path d={`M 0,0 Q -100,100 -200,0 T -400,0 T -600,0`} fill="none" stroke={C.astronautWhite} strokeWidth={1} transform={`rotate(${-frame * 4})`} />

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SCIENTISTS CALL THIS</text>
            <text y={-350} textAnchor="middle" fill={C.accretionDisk} fontSize={90} fontWeight={900}>SPAGHETTIFICATION</text>
            
            <text y={450} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>DRAWN INTO A STRAND</text>
            <text y={550} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>THINNER THAN A HAIR</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: WATCHING FROM FAR AWAY ──────────────────────────────────────────
function SceneWatch() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Observer looking through telescope */}
            <g transform="translate(-300, 200)">
              <rect x={-50} y={-50} width={100} height={200} fill="#4B5563" rx={20} />
              <circle cx={0} cy={-70} r={40} fill="#FAD7A1" />
              <path d="M 0,-70 L 150,-120 L 150,-80 Z" fill="#9CA3AF" />
              <rect x={20} y={-100} width={120} height={30} fill={C.white} transform="rotate(-18, 20, -100)" />
            </g>

            {/* Black hole very far away */}
            <g transform="translate(300, -300) scale(0.3)">
              <circle cx={0} cy={0} r={200} fill={C.spaceBlack} stroke={C.accretionDisk} strokeWidth={40} />
              {/* Astronaut stuck at edge */}
              <circle cx={-180} cy={-80} r={20} fill={C.astronautWhite} />
            </g>

            {/* Dotted sight line */}
            <line x1={-150} y1={100} x2={250} y2={-250} stroke={C.white} strokeWidth={5} strokeDasharray="20, 20" />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>THE STRANGEST PART</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>TO SOMEONE WATCHING FROM FAR AWAY...</text>
            
            <text y={600} textAnchor="middle" fill={C.visorGold} fontSize={80} fontWeight={900}>YOU'D NEVER SEEM</text>
            <text y={700} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>TO FALL IN AT ALL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: FREEZE AND FADE ─────────────────────────────────────────────────
function SceneFreeze() {
  const frame = useCurrentFrame();

  const colorTrans = interpolateColors(frame, [0, 100], [C.astronautWhite, C.redShift]);
  const fade = interpolate(frame, [100, 200], [1, 0], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Event horizon edge */}
            <path d="M 0,-1000 Q -200,0 0,1000 L 540,1000 L 540,-1000 Z" fill={C.spaceBlack} />
            <path d="M 0,-1000 Q -200,0 0,1000" fill="none" stroke={C.accretionDisk} strokeWidth={20} filter="blur(10px)" />

            {/* Astronaut frozen at the edge, turning red and fading */}
            <g transform={`translate(-100, 0)`} opacity={fade}>
              <rect x={-30} y={-50} width={60} height={100} fill={colorTrans} rx={20} />
              <circle cx={0} cy={-70} r={35} fill={colorTrans} />
              <rect x={-25} y={-85} width={50} height={30} fill={colorTrans} rx={10} />
              <rect x={-25} y={40} width={20} height={80} fill={colorTrans} rx={10} />
              <rect x={5} y={40} width={20} height={80} fill={colorTrans} rx={10} />
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>APPEAR TO FREEZE</text>
            <text y={-350} textAnchor="middle" fill={C.redShift} fontSize={90} fontWeight={900}>GLOWING REDDER & REDDER</text>
            
            <text y={450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>UNTIL YOU SIMPLY</text>
            <text y={550} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900} opacity={fade}>FADED FROM SIGHT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Blackhole: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('blackhole_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.3} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneFloating />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneYank />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneTaffy />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneSpaghetti />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneWatch />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneFreeze />
      </Sequence>
    </AbsoluteFill>
  );
};

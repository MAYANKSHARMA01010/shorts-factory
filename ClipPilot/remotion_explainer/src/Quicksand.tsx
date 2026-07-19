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

import quicksandWords from './quicksand_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1136;

const C = {
  bgDeep: '#1A1510',
  sandDark: '#8C6239',
  sandLight: '#C79A5E',
  waterBlue: '#2A9D8F',
  dangerRed: '#E63946',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We will update these exact scene boundaries once we have quicksand_words.json
const S = {
  scene1: 0,
  scene2: 294,
  scene3: 467,
  scene4: 725,
  scene5: 945,
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

// ─── SCENE 1: SINKING MYTH ───────────────────────────────────────────────────
function SceneMyth() {
  const frame = useCurrentFrame();
  
  // Sinks until completely vanished
  const sink = interpolate(frame, [0, 250], [0, 400], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Quicksand Pit */}
            <path d="M -400,200 C -200,100 200,300 400,200 L 500,800 L -500,800 Z" fill={C.sandDark} />

            <text y={-400} textAnchor="middle" fill={C.sandLight} fontSize={80} fontWeight={900} letterSpacing={5}>THE MYTH</text>

            {/* Person Sinking completely */}
            <g transform={`translate(0, ${sink})`}>
              {/* Head */}
              <circle cx={0} cy={-200} r={50} fill={C.white} />
              {/* Body */}
              <line x1={0} y1={-150} x2={0} y2={0} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              {/* Arms */}
              <path d="M -80,-150 L 0,-100 L 80,-150" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              {/* Legs */}
              <path d="M -40,150 L 0,0 L 40,150" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Quicksand top layer overlay to cover sinking person */}
            <path d="M -400,200 C -200,100 200,300 400,200 L 500,800 L -500,800 Z" fill={C.sandDark} opacity={0.8} />

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DENSER THAN BODY (WAIST DEEP) ───────────────────────────────────
function SceneWaist() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame: frame - 20, fps, config: { damping: 12, mass: 1, stiffness: 100 } });
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} />

            {/* Person stuck at waist */}
            <g transform={`translate(0, 100)`}>
              <circle cx={0} cy={-200} r={50} fill={C.white} />
              <line x1={0} y1={-150} x2={0} y2={0} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              <path d="M -60,-100 L 0,-100 L 60,-100" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} opacity={0.8} />

            {/* Density Scale */}
            {pop > 0 && (
              <g transform={`translate(-250, -300) scale(${pop})`}>
                <text y={0} textAnchor="middle" fill={C.sandLight} fontSize={60} fontWeight={900}>SAND &gt; BODY</text>
                <path d="M -150,20 L 150,20" fill="none" stroke={C.white} strokeWidth={10} />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: STRUGGLING VACUUM ───────────────────────────────────────────────
function SceneStruggle() {
  const frame = useCurrentFrame();

  const struggle = Math.sin(frame * 0.5) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} />

            {/* Struggling person */}
            <g transform={`translate(${struggle}, 100)`}>
              <circle cx={0} cy={-200} r={50} fill={C.white} />
              <line x1={0} y1={-150} x2={0} y2={0} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              {/* Frantic arms */}
              <path d="M -80,-250 L 0,-150 L 80,-250" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} opacity={0.6} />

            {/* Vacuum Lock lines */}
            <g opacity={Math.min(1, frame/30)}>
              {Array.from({length: 6}).map((_, i) => {
                const y = 150 + i * 50;
                return (
                  <path key={i} d={`M -100,${y} C -50,${y+20} 50,${y+20} 100,${y}`} fill="none" stroke={C.dangerRed} strokeWidth={15} strokeLinecap="round" opacity={0.8} />
                );
              })}
            </g>

            <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>VACUUM</text>
            <text y={-300} textAnchor="middle" fill={C.dangerRed} fontSize={70} fontWeight={900}>LOCK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FLOAT & ROLL ────────────────────────────────────────────────────
function SceneFloat() {
  const frame = useCurrentFrame();

  const lean = interpolate(frame, [0, 60], [0, -80], clamp); // Leans back 80 degrees
  const rise = interpolate(frame, [60, 150], [0, -150], clamp); // Rises out

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} />

            {/* Person leaning back and rising */}
            <g transform={`translate(0, ${100 + rise}) rotate(${lean})`}>
              <circle cx={0} cy={-200} r={50} fill={C.white} />
              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              <path d="M -100,-100 L 0,-100 L 100,-100" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} opacity={0.4} />

            {frame > 30 && (
              <text x={-200} y={-300} textAnchor="middle" fill={C.sandLight} fontSize={60} fontWeight={900}>LEAN BACK</text>
            )}
            {frame > 120 && (
              <text x={200} y={-400} textAnchor="middle" fill={C.sandLight} fontSize={60} fontWeight={900}>FLOAT</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: THE CATCH (TIDE) ────────────────────────────────────────────────
function SceneTide() {
  const frame = useCurrentFrame();

  const tideY = interpolate(frame, [0, 150], [800, -100], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -500,0 C -200,-50 200,50 500,0 L 500,800 L -500,800 Z" fill={C.sandDark} />

            {/* Person stuck */}
            <g transform={`translate(0, 100)`}>
              <circle cx={0} cy={-200} r={50} fill={C.white} />
              <line x1={0} y1={-150} x2={0} y2={0} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Rising Tide */}
            <path d={`M -600,${tideY} C -200,${tideY-50} 200,${tideY+50} 600,${tideY} L 600,800 L -600,800 Z`} fill={C.waterBlue} opacity={0.8} />

            {/* Warning */}
            <g transform={`translate(0, -400)`}>
              <path d="M 0,-80 L 80,60 L -80,60 Z" fill={C.dangerRed} stroke={C.white} strokeWidth={10} strokeLinejoin="round" />
              <text y={30} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>!</text>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Quicksand: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('quicksand_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene2 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene5 + 40} durationInFrames={100}>
        <Audio src={staticFile('sfx_water_ripples.wav')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneMyth />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneWaist />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneStruggle />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneFloat />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneTide />
      </Sequence>
    </AbsoluteFill>
  );
};

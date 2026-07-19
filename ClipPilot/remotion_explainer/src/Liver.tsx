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

import liverWords from './liver_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 862;

const C = {
  bgDeep: '#10151c',
  bgPanel: '#1a222d',
  liverRed: '#8C3B3E',
  liverDark: '#5E2729',
  bloodRed: '#E63946',
  magicGlow: '#4DF0B0',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We will update these exact scene boundaries once we have liver_words.json
const S = {
  scene1: 0,
  scene2: 131,
  scene3: 418,
  scene4: 618,
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

// ─── SCENE 1: MYSTERY ORGAN ───────────────────────────────────────────────────
function SceneIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({ frame: frame - 60, fps, config: { damping: 15, mass: 0.5, stiffness: 100 } });
  const pulse = Math.sin(frame * 0.1) * 0.02;
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${0.9 + pulse})`}>
            
            {/* Question Mark Glow */}
            {reveal === 0 && (
              <text y={0} textAnchor="middle" fill={C.white} fontSize={300} fontWeight={900} opacity={0.3}>?</text>
            )}

            {/* Liver Shape */}
            <g transform={`scale(${reveal > 0 ? 1 : 0.8})`}>
              <path 
                d="M -150,-100 C 100,-150 250,-50 200,100 C 150,200 -50,150 -150,50 C -200,0 -250,-50 -150,-100 Z" 
                fill={reveal > 0 ? C.liverRed : C.bgPanel} 
                stroke={reveal > 0 ? C.liverDark : C.white}
                strokeWidth={10} 
              />
              {/* Shine */}
              {reveal > 0 && (
                <path d="M -100,-80 C 50,-120 150,-50 120,30" fill="none" stroke={C.white} strokeWidth={15} strokeLinecap="round" opacity={0.3} />
              )}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: CUTTING 70% ───────────────────────────────────────────────────────
function SceneCut() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Knife slices through at frame 60
  const knifeY = spring({ frame: frame - 60, fps, config: { damping: 15, mass: 1, stiffness: 100 } });
  
  // Cut portion slides away
  const cutSlide = spring({ frame: frame - 80, fps, config: { damping: 12, mass: 1, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* 30% REMAINING (Left side) */}
            <g transform={`translate(${-cutSlide * 100}, 0)`}>
              <path 
                d="M -150,-100 C -50,-110 0,-50 0,0 C 0,50 -50,150 -150,50 C -200,0 -250,-50 -150,-100 Z" 
                fill={C.liverRed} stroke={C.liverDark} strokeWidth={10} 
              />
              <text x={-100} y={0} fill={C.white} fontSize={50} fontWeight={900}>30%</text>
            </g>

            {/* 70% DONATED (Right side) */}
            <g transform={`translate(${cutSlide * 200}, ${cutSlide * 100}) rotate(${cutSlide * 20})`}>
              <path 
                d="M 0,0 C 0,-50 100,-150 200,100 C 150,200 50,100 0,0 Z" 
                fill={C.liverRed} stroke={C.liverDark} strokeWidth={10} 
              />
              <text x={100} y={50} fill={C.white} fontSize={50} fontWeight={900}>70%</text>
            </g>

            {/* Scalpel slicing line */}
            {frame > 50 && frame < 90 && (
              <line x1={0} y1={-300 + knifeY * 600} x2={0} y2={-200 + knifeY * 600} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
            )}

            {/* Slice flash */}
            {frame > 60 && frame < 75 && (
              <path d="M 0,-150 L 50,-100 L -50,0 L 50,100 L 0,150 L -50,100 L 50,0 L -50,-100 Z" fill={C.white} opacity={1 - (frame-60)/15} />
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: REGROWTH ────────────────────────────────────────────────────────
function SceneRegrow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The 30% grows back to 100%, the 70% grows back to 100%
  const grow = interpolate(frame, [20, 100], [0, 1], clamp);
  const pulse = Math.sin(frame * 0.3) * 0.05 * (1 - grow);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Split screen line */}
            <line x1={0} y1={-600} x2={0} y2={600} stroke={C.bgPanel} strokeWidth={10} />

            {/* Donor Side (Left) */}
            <g transform="translate(-250, 0)">
              <text y={-300} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>DONOR</text>
              <g transform={`scale(${0.5 + grow * 0.5 + pulse})`}>
                <path 
                  d="M -150,-100 C 100,-150 250,-50 200,100 C 150,200 -50,150 -150,50 C -200,0 -250,-50 -150,-100 Z" 
                  fill={C.liverRed} stroke={C.liverDark} strokeWidth={10} 
                />
              </g>
              {/* Bubbling effect during growth */}
              {frame > 20 && frame < 100 && (
                <>
                  <circle cx={50} cy={-50} r={10 + (frame%10)*2} fill="none" stroke={C.magicGlow} strokeWidth={5} opacity={1 - (frame%10)/10} />
                  <circle cx={100} cy={50} r={10 + (frame%15)*2} fill="none" stroke={C.magicGlow} strokeWidth={5} opacity={1 - (frame%15)/15} />
                </>
              )}
            </g>

            {/* Recipient Side (Right) */}
            <g transform="translate(250, 0)">
              <text y={-300} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>RECIPIENT</text>
              <g transform={`scale(${0.7 + grow * 0.3 + pulse})`}>
                <path 
                  d="M -150,-100 C 100,-150 250,-50 200,100 C 150,200 -50,150 -150,50 C -200,0 -250,-50 -150,-100 Z" 
                  fill={C.liverRed} stroke={C.liverDark} strokeWidth={10} 
                />
              </g>
              {frame > 20 && frame < 100 && (
                <>
                  <circle cx={-50} cy={-50} r={10 + (frame%12)*2} fill="none" stroke={C.magicGlow} strokeWidth={5} opacity={1 - (frame%12)/12} />
                </>
              )}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: SUPERPOWER ──────────────────────────────────────────────────────
function SceneSuperpower() {
  const frame = useCurrentFrame();

  const glowRot = frame * 2;
  const throb = Math.sin(frame * 0.1) * 0.1;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Superhero rays */}
            <g transform={`rotate(${glowRot})`}>
              {Array.from({length: 12}).map((_, i) => (
                <path key={i} d={`M 0,150 L -30,600 L 30,600 Z`} fill={C.magicGlow} opacity={0.2} transform={`rotate(${i * 30})`} />
              ))}
            </g>

            <text y={-300} textAnchor="middle" fill={C.magicGlow} fontSize={80} fontWeight={900} letterSpacing={5}>SUPERPOWER</text>

            {/* Glowing Liver */}
            <g transform={`scale(${1 + throb})`}>
              <path 
                d="M -150,-100 C 100,-150 250,-50 200,100 C 150,200 -50,150 -150,50 C -200,0 -250,-50 -150,-100 Z" 
                fill={C.liverRed} stroke={C.magicGlow} strokeWidth={15} 
              />
              <path d="M -100,-80 C 50,-120 150,-50 120,30" fill="none" stroke={C.white} strokeWidth={15} strokeLinecap="round" opacity={0.6} />
            </g>

            {/* Medical Cross */}
            <path d="M -20,150 L 20,150 L 20,190 L 60,190 L 60,230 L 20,230 L 20,270 L -20,270 L -20,230 L -60,230 L -60,190 L -20,190 Z" fill={C.white} />

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Liver: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('liver_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene2 + 60} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 20} durationInFrames={200}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.7} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneIntro />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneCut />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneRegrow />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={DURATION_IN_FRAMES - S.scene4}>
        <SceneSuperpower />
      </Sequence>
    </AbsoluteFill>
  );
};

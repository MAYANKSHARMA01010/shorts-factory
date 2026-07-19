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

import gutbrainWords from './gutbrain_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 872;

const C = {
  bgDeep: '#0d131a',
  bgPanel: '#151e29',
  brainPink: '#FF758C',
  gutOrange: '#FF9E5E',
  nerveBlue: '#4FC3E8',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We will update these exact scene boundaries once we have gutbrain_words.json
const S = {
  scene1: 0,
  scene2: 91,
  scene3: 238,
  scene4: 434,
  scene5: 681,
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

// ─── SCENE 1: SECOND BRAIN? ───────────────────────────────────────────────────
function SceneIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bodyFade = spring({ frame, fps, config: { damping: 20 } });
  const brainPop = spring({ frame: frame - 30, fps, config: { damping: 10, mass: 0.5, stiffness: 150 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Outline of torso */}
            <path d="M -150,-400 C -250,-200 -250,200 -250,400 L 250,400 C 250,200 250,-200 150,-400 Z" fill="none" stroke={C.white} strokeWidth={10} opacity={0.3 * bodyFade} />
            <circle cx={0} cy={-500} r={100} fill="none" stroke={C.white} strokeWidth={10} opacity={0.3 * bodyFade} />

            {/* Head brain */}
            <path d="M -50,-520 C 0,-550 50,-520 50,-480 C 50,-450 -50,-450 -50,-480 Z" fill={C.brainPink} opacity={bodyFade} />

            {/* Gut area */}
            <circle cx={0} cy={100} r={150} fill={C.gutOrange} opacity={0.2 * bodyFade} />

            {/* Question Mark Pop */}
            {brainPop > 0 && (
              <g transform={`translate(0, 100) scale(${brainPop})`}>
                <text y={60} textAnchor="middle" fill={C.brainPink} fontSize={200} fontWeight={900}>?</text>
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: ENTERIC NERVOUS SYSTEM ──────────────────────────────────────────
function SceneEnteric() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.1)`}>
            
            <text y={-400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900} letterSpacing={5}>ENTERIC SYSTEM</text>

            {/* Intestines shape */}
            <path d="M -150,-150 C 50,-150 50,-50 -50,-50 C -150,-50 -150,50 50,50 C 250,50 250,150 -50,150 C -250,150 -250,250 50,250" fill="none" stroke={C.gutOrange} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />

            {/* Glowing neuron web */}
            <g opacity={Math.min(1, frame / 30)}>
              {Array.from({length: 40}).map((_, i) => {
                const x = -150 + (i % 8) * 40 + Math.sin(i)*30;
                const y = -150 + Math.floor(i / 8) * 80 + Math.cos(i)*30;
                const r = 3 + Math.sin(frame*0.1 + i)*2;
                return (
                  <circle key={i} cx={x} cy={y} r={r} fill={C.nerveBlue} />
                );
              })}
              {/* Connections */}
              <path d="M -150,-150 L -110,-70 L -70,-150 M 50,-50 L -50,50 L 50,150" fill="none" stroke={C.nerveBlue} strokeWidth={2} opacity={0.5} />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: 100 MILLION NEURONS ─────────────────────────────────────────────
function SceneNeurons() {
  const frame = useCurrentFrame();

  const count = Math.floor(interpolate(frame, [0, 60], [0, 100], clamp));
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Split Screen */}
            <line x1={0} y1={-600} x2={0} y2={600} stroke={C.bgPanel} strokeWidth={10} />

            {/* Spinal Cord (Left) */}
            <g transform="translate(-250, 0)">
              <text y={-300} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>SPINAL CORD</text>
              <line x1={0} y1={-150} x2={0} y2={250} stroke={C.white} strokeWidth={40} strokeLinecap="round" />
              {/* Vertebrae */}
              {Array.from({length: 8}).map((_, i) => (
                <rect key={i} x={-40} y={-140 + i*50} width={80} height={20} fill={C.bgDeep} />
              ))}
              <text y={400} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={700}>&lt; 100M</text>
            </g>

            {/* Gut (Right) */}
            <g transform="translate(250, 0)">
              <text y={-300} textAnchor="middle" fill={C.gutOrange} fontSize={50} fontWeight={900}>GUT BRAIN</text>
              <circle cx={0} cy={50} r={120} fill="none" stroke={C.gutOrange} strokeWidth={20} />
              {/* Neurons */}
              {Array.from({length: 20}).map((_, i) => (
                <circle key={i} cx={Math.sin(i*1.2)*80} cy={50 + Math.cos(i*1.2)*80} r={5} fill={C.nerveBlue} />
              ))}
              <text y={400} textAnchor="middle" fill={C.nerveBlue} fontSize={80} fontWeight={900}>
                {count}M+
              </text>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: INDEPENDENT ──────────────────────────────────────────────────────
function SceneIndependent() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const snip = spring({ frame: frame - 60, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Top Brain */}
            <path d="M -80,-400 C 80,-400 120,-300 120,-200 C 120,-100 80,0 0,0 C -80,0 -120,-100 -120,-200 C -120,-300 -80,-400 -80,-400 Z" fill={C.brainPink} />
            <text y={-200} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>HEAD</text>

            {/* Gut Brain */}
            <circle cx={0} cy={300} r={120} fill={C.gutOrange} />
            <text y={320} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>GUT</text>
            
            {/* Gut Pulse */}
            {frame > 70 && (
              <circle cx={0} cy={300} r={120 + (frame%30)*2} fill="none" stroke={C.nerveBlue} strokeWidth={5} opacity={1 - (frame%30)/30} />
            )}

            {/* Vagus Nerve */}
            {snip === 0 ? (
              <line x1={0} y1={0} x2={0} y2={180} stroke={C.nerveBlue} strokeWidth={20} />
            ) : (
              <>
                <line x1={0} y1={0} x2={0} y2={70} stroke={C.nerveBlue} strokeWidth={20} />
                <line x1={0} y1={110} x2={0} y2={180} stroke={C.nerveBlue} strokeWidth={20} />
              </>
            )}

            {/* Scissors */}
            {frame > 40 && frame < 80 && (
              <g transform={`translate(0, 90) rotate(${snip * 45})`}>
                <line x1={-100} y1={-20} x2={50} y2={0} stroke={C.white} strokeWidth={15} strokeLinecap="round" />
                <line x1={-100} y1={20} x2={50} y2={0} stroke={C.white} strokeWidth={15} strokeLinecap="round" />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: GUT FEELING ─────────────────────────────────────────────────────
function SceneGutFeeling() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(0.9)`}>
            
            {/* Outline of torso */}
            <path d="M -150,-400 C -250,-200 -250,200 -250,400 L 250,400 C 250,200 250,-200 150,-400 Z" fill="none" stroke={C.white} strokeWidth={10} opacity={0.2} />
            
            {/* Gut glowing */}
            <circle cx={0} cy={100} r={150} fill={C.gutOrange} />
            
            {/* Signals traveling up */}
            {Array.from({length: 3}).map((_, i) => {
              const offset = (frame + i * 40) % 120;
              const y = 50 - offset * 4;
              return (
                <path key={i} d={`M -30,${y} L 0,${y-30} L 30,${y}`} fill="none" stroke={C.nerveBlue} strokeWidth={15} strokeLinecap="round" opacity={1 - offset/120} />
              );
            })}

            {/* Speech bubble */}
            {frame > 30 && (
              <g transform="translate(180, -100)">
                <path d="M 0,0 C 50,-50 150,-50 200,0 C 250,50 250,150 150,200 C 50,250 -50,200 -50,100 Z" fill={C.white} />
                <path d="M 0,0 L -100,50 L -30,80 Z" fill={C.white} />
                <text x={70} y={100} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900}>!</text>
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Gutbrain: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('gutbrain_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.3} />
      </Sequence>
      <Sequence from={S.scene4 + 60} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene5 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneIntro />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneEnteric />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneNeurons />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneIndependent />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneGutFeeling />
      </Sequence>
    </AbsoluteFill>
  );
};

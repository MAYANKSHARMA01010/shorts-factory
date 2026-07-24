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

import ripcurrentWords from './ripcurrent_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 931;

const C = {
  bgDeep: '#0b1d2e',
  bgPanel: '#1a3c5a',
  waterBlue: '#2A9D8F',
  sandTan: '#E9C46A',
  dangerRed: '#E63946',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We will update these exact scene boundaries once we have ripcurrent_words.json
const S = {
  scene1: 0,
  scene2: 211,
  scene3: 400,
  scene4: 610,
  scene5: 717,
  scene6: 815,
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

// ─── SCENE 1: PULLED AWAY ──────────────────────────────────────────────────────
function ScenePulled() {
  const frame = useCurrentFrame();
  const pull = interpolate(frame, [0, 150], [0, 300], clamp);
  
  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shoreline */}
            <path d="M -600,200 L 600,200 L 600,1000 L -600,1000 Z" fill={C.sandTan} />
            <path d="M -600,180 Q 0,220 600,180" fill="none" stroke={C.white} strokeWidth={20} opacity={0.5} />
            <text y={400} textAnchor="middle" fill={C.bgPanel} fontSize={100} fontWeight={900} opacity={0.5}>SHORE</text>

            {/* Swimmer being pulled up (out to sea) */}
            <g transform={`translate(0, ${100 - pull})`}>
              <circle cx={0} cy={0} r={40} fill={C.dangerRed} />
              <path d="M -60,20 L -20,60 M 60,20 L 20,60" fill="none" stroke={C.dangerRed} strokeWidth={15} strokeLinecap="round" />
              {/* Struggle lines */}
              {frame % 20 < 10 && (
                <path d="M -80,-20 Q -50,-50 -20,-20 M 80,-20 Q 50,-50 20,-20" fill="none" stroke={C.white} strokeWidth={10} strokeLinecap="round" />
              )}
            </g>

            {/* Arrows pulling out */}
            {Array.from({length: 3}).map((_, i) => {
              const y = -100 - i * 150 - (frame * 5) % 150;
              return (
                <path key={i} d={`M 0,${y} L -40,${y+60} M 0,${y} L 40,${y+60} M 0,${y} L 0,${y+100}`} fill="none" stroke={C.white} strokeWidth={20} opacity={0.4} strokeLinecap="round" strokeLinejoin="round" />
              );
            })}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: RIP CURRENT REVEAL ─────────────────────────────────────────────
function SceneReveal() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shoreline */}
            <path d="M -600,400 L 600,400 L 600,1000 L -600,1000 Z" fill={C.sandTan} />

            {/* Breaking Waves */}
            <path d="M -600,300 L -200,300 L -200,400 L -600,400 Z" fill={C.white} opacity={0.5} />
            <path d="M 200,300 L 600,300 L 600,400 L 200,400 Z" fill={C.white} opacity={0.5} />

            {/* Rip Current Channel */}
            <path d="M -150,-600 L 150,-600 L 200,400 L -200,400 Z" fill={C.bgDeep} opacity={0.3} />
            <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={80} fontWeight={900}>RIP CURRENT</text>

            {/* Powerful flow arrows */}
            <g opacity={Math.min(1, frame / 20)}>
              {Array.from({length: 4}).map((_, i) => {
                const y = 300 - ((frame*8 + i*200) % 800);
                return (
                  <path key={i} d={`M 0,${y} L -50,${y+80} M 0,${y} L 50,${y+80} M 0,${y} L 0,${y+150}`} fill="none" stroke={C.dangerRed} strokeWidth={25} strokeLinecap="round" strokeLinejoin="round" />
                );
              })}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: DON'T SWIM BACK ────────────────────────────────────────────────
function SceneFight() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cross = spring({ frame: frame - 60, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });
  const struggleY = Math.sin(frame * 0.5) * 20;

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -600,400 L 600,400 L 600,1000 L -600,1000 Z" fill={C.sandTan} />

            {/* Rip Current */}
            <path d="M -150,-600 L 150,-600 L 150,400 L -150,400 Z" fill={C.bgDeep} opacity={0.3} />

            {/* Swimmer trying to go down (to shore) but stuck */}
            <g transform={`translate(0, ${-200 + struggleY})`}>
              <circle cx={0} cy={0} r={40} fill={C.white} />
              <path d="M -60,-20 L -20,-60 M 60,-20 L 20,-60" fill="none" stroke={C.white} strokeWidth={15} strokeLinecap="round" />
            </g>

            <path d="M 0,-200 L 0,200 L -40,160 M 0,200 L 40,160" fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="20 20" />

            {/* Huge Red X */}
            {cross > 0 && (
              <g transform={`scale(${cross})`}>
                <line x1={-200} y1={-200} x2={200} y2={200} stroke={C.dangerRed} strokeWidth={60} strokeLinecap="round" />
                <line x1={200} y1={-200} x2={-200} y2={200} stroke={C.dangerRed} strokeWidth={60} strokeLinecap="round" />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: OLYMPIC SPEED ──────────────────────────────────────────────────
function SceneSpeed() {
  const frame = useCurrentFrame();

  const swimmerY = -600 + (frame * 15);
  const currentY = -600 + (frame * 25);

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <line x1={0} y1={-600} x2={0} y2={600} stroke={C.white} strokeWidth={10} opacity={0.2} />

            {/* Left: Olympic swimmer */}
            <g transform="translate(-200, 0)">
              <text y={-400} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>OLYMPIAN</text>
              <g transform={`translate(0, ${swimmerY})`}>
                <circle cx={0} cy={0} r={30} fill={C.sandTan} />
                <path d="M 0,-40 L 0,-80 L -20,-100 M 0,-80 L 20,-100" fill="none" stroke={C.sandTan} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>

            {/* Right: Rip Current */}
            <g transform="translate(200, 0)">
              <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={50} fontWeight={900}>RIP CURRENT</text>
              <g transform={`translate(0, ${currentY})`}>
                <path d="M 0,-50 L 0,50 L -40,10 M 0,50 L 40,10" fill="none" stroke={C.dangerRed} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: SWIM PARALLEL ──────────────────────────────────────────────────
function SceneParallel() {
  const frame = useCurrentFrame();
  
  // Swimmer starts in middle and swims sideways
  const swimX = interpolate(frame, [0, 80], [0, 300], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -600,400 L 600,400 L 600,1000 L -600,1000 Z" fill={C.sandTan} />
            
            {/* Rip Current */}
            <path d="M -150,-600 L 150,-600 L 150,400 L -150,400 Z" fill={C.dangerRed} opacity={0.3} />

            {/* Arrows pointing parallel */}
            <path d="M 0,-100 L 300,-100 L 260,-140 M 300,-100 L 260,-60" fill="none" stroke={C.white} strokeWidth={25} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0,-100 L -300,-100 L -260,-140 M -300,-100 L -260,-60" fill="none" stroke={C.white} strokeWidth={25} strokeLinecap="round" strokeLinejoin="round" />

            <text y={-250} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SWIM PARALLEL</text>

            {/* Swimmer going right */}
            <g transform={`translate(${swimX}, 100)`}>
              <circle cx={0} cy={0} r={40} fill={C.white} />
              {frame % 10 < 5 && (
                <path d="M -20,60 L -60,20 M 20,-60 L 60,-20" fill="none" stroke={C.white} strokeWidth={15} strokeLinecap="round" />
              )}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: SAFE RETURN ────────────────────────────────────────────────────
function SceneReturn() {
  const frame = useCurrentFrame();

  const swimX = 300;
  const swimY = interpolate(frame, [0, 80], [100, 500], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -600,400 L 600,400 L 600,1000 L -600,1000 Z" fill={C.sandTan} />
            
            {/* Rip Current */}
            <path d="M -150,-600 L 150,-600 L 150,400 L -150,400 Z" fill={C.dangerRed} opacity={0.2} />

            <text x={swimX} y={550} textAnchor="middle" fill={C.bgPanel} fontSize={60} fontWeight={900}>SAFE</text>

            {/* Swimmer going down to beach */}
            <g transform={`translate(${swimX}, ${swimY})`}>
              <circle cx={0} cy={0} r={40} fill={C.white} />
              <path d="M 0,-40 L 0,-80 M -30,-60 L 30,-60" fill="none" stroke={C.white} strokeWidth={15} strokeLinecap="round" />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Ripcurrent: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('ripcurrent_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 60} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <ScenePulled />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneReveal />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneFight />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneSpeed />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneParallel />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneReturn />
      </Sequence>
    </AbsoluteFill>
  );
};

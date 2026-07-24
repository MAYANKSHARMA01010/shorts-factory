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

import avalancheWords from './avalanche_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1106;

const C = {
  bgDeep: '#0D1B2A',
  snowWhite: '#E0FBFC',
  snowDark: '#98C1D9',
  iceBlue: '#3D5A80',
  dangerRed: '#EE6C4D',
  personSuit: '#F95738',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 289,
  scene3: 556,
  scene4: 760,
  scene5: 889,
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

// ─── SCENE 1: CRACK & ROAR ────────────────────────────────────────────────────
function SceneCrack() {
  const frame = useCurrentFrame();

  const crack = frame > 30 ? 1 : 0;
  const slide = interpolate(frame, [60, 120], [0, 800], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Mountain */}
            <path d="M -800,800 L 0,-600 L 800,800 Z" fill={C.iceBlue} />
            
            {/* Snowcap */}
            <path d="M -220,-200 L 0,-600 L 220,-200 Q 100,-100 0,-200 Q -100,-100 -220,-200" fill={C.snowWhite} />

            {/* The Crack */}
            <g opacity={crack}>
              <path d="M -150,-300 L -50,-250 L -80,-200 L 0,-150 L -20,-100" fill="none" stroke={C.dangerRed} strokeWidth={15} strokeLinejoin="round" />
            </g>

            {/* Avalanche sliding down */}
            <g transform={`translate(0, ${slide})`}>
              <path d="M -400,-200 C -200,-400 200,-400 400,-200 L 600,600 L -600,600 Z" fill={C.snowWhite} opacity={0.9} />
              <path d="M -300,-100 C -100,-200 100,-200 300,-100 L 500,500 L -500,500 Z" fill={C.snowDark} opacity={0.8} />
            </g>

            {/* Person running */}
            <g transform={`translate(0, 400)`}>
              <circle cx={0} cy={-100} r={30} fill={C.personSuit} />
              <line x1={0} y1={-70} x2={0} y2={20} stroke={C.personSuit} strokeWidth={15} strokeLinecap="round" />
              {/* Running legs */}
              <path d="M -30,70 L 0,20 L 30,50" fill="none" stroke={C.personSuit} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>CRACK!</text>
            <text y={700} textAnchor="middle" fill={C.dangerRed} fontSize={60} fontWeight={900}>FASTER THAN A CAR</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SWIM ────────────────────────────────────────────────────────────
function SceneSwim() {
  const frame = useCurrentFrame();

  const swimCycle = Math.sin(frame * 0.3) * 30;
  const arm1 = Math.sin(frame * 0.3) * 60;
  const arm2 = Math.cos(frame * 0.3) * 60;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Churning snow background */}
            <path d="M -600,-800 L 600,-800 L 600,800 L -600,800 Z" fill={C.snowDark} />
            <g opacity={0.5}>
              {Array.from({length: 20}).map((_, i) => (
                <circle key={i} cx={(Math.random()-0.5)*1000} cy={(Math.random()-0.5)*1500} r={Math.random()*50+20} fill={C.snowWhite} />
              ))}
            </g>

            {/* Swimming Person */}
            <g transform={`translate(${swimCycle}, 0)`}>
              <circle cx={0} cy={-150} r={50} fill={C.personSuit} />
              <line x1={0} y1={-100} x2={0} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* Thrashing Arms */}
              <line x1={0} y1={-80} x2={-100} y2={-80 + arm1} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={-80} x2={100} y2={-80 + arm2} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />

              <line x1={0} y1={50} x2={-50} y2={150} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={50} x2={50} y2={150} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={150} fontWeight={900}>SWIM!</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: AIR POCKET ──────────────────────────────────────────────────────
function ScenePocket() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Snow all around */}
            <path d="M -600,-800 L 600,-800 L 600,800 L -600,800 Z" fill={C.snowDark} />

            {/* Person */}
            <g transform={`translate(0, 100)`}>
              
              {/* Air pocket around head */}
              <circle cx={0} cy={-250} r={120} fill={C.bgDeep} />
              <text x={0} y={-300} textAnchor="middle" fill={C.snowWhite} fontSize={40} fontWeight={900}>AIR</text>

              <circle cx={0} cy={-200} r={50} fill={C.personSuit} />
              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* One arm up */}
              <line x1={0} y1={-100} x2={-100} y2={-300} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              {/* One hand cupped over face (simulated by arm bent to face) */}
              <path d="M 0,-100 L 60,-50 L 30,-200" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <text y={500} textAnchor="middle" fill={C.snowWhite} fontSize={80} fontWeight={900}>CARVE POCKET</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: STILL & BREATHE ─────────────────────────────────────────────────
function SceneBreathe() {
  const frame = useCurrentFrame();

  const breathe = Math.sin(frame * 0.1) * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -600,-800 L 600,-800 L 600,800 L -600,800 Z" fill={C.snowDark} />

            <g transform={`translate(0, 100)`}>
              <circle cx={0} cy={-250} r={120 + breathe} fill={C.bgDeep} />
              <circle cx={0} cy={-200} r={50} fill={C.personSuit} />
              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={-100} x2={-100} y2={-300} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M 0,-100 L 60,-50 L 30,-200" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <text y={-500} textAnchor="middle" fill={C.dangerRed} fontSize={80} fontWeight={900}>STAY STILL</text>
            <text y={-400} textAnchor="middle" fill={C.snowWhite} fontSize={60} fontWeight={900}>BREATHE SLOW</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: CONCRETE ────────────────────────────────────────────────────────
function SceneConcrete() {
  const frame = useCurrentFrame();

  // Snow hardens: color shifts to gray/ice
  const harden = interpolate(frame, [0, 60], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <path d="M -600,-800 L 600,-800 L 600,800 L -600,800 Z" fill={interpolateColors(harden, [0, 1], [C.snowDark, '#778DA9'])} />

            <g transform={`translate(0, 100)`}>
              <circle cx={0} cy={-250} r={120} fill={C.bgDeep} />
              <circle cx={0} cy={-200} r={50} fill={C.personSuit} />
              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={-100} x2={-100} y2={-300} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M 0,-100 L 60,-50 L 30,-200" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {harden > 0.5 && (
              <text y={-500} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>CONCRETE</text>
            )}

            {/* Crack lines in the hardened snow */}
            <g opacity={harden}>
              <path d="M -400,200 L -200,100 L -100,200" fill="none" stroke={C.bgDeep} strokeWidth={10} />
              <path d="M 300,300 L 400,100 L 500,200" fill="none" stroke={C.bgDeep} strokeWidth={10} />
              <path d="M -300,-400 L -100,-600 L 100,-500" fill="none" stroke={C.bgDeep} strokeWidth={10} />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Avalanche: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('avalanche_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_water_ripples.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneCrack />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneSwim />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <ScenePocket />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneBreathe />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneConcrete />
      </Sequence>
    </AbsoluteFill>
  );
};

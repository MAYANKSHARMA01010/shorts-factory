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

import trenchWords from './trench_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = Math.floor((trenchWords as any).words[(trenchWords as any).words.length - 1].end * FPS) + 30;

const C = {
  bgDeep: '#0D1B2A',
  waterBlue: '#3498DB',
  waterDark: '#1A5276',
  pitchBlack: '#000000',
  personSkin: '#F5CBA7',
  personSuit: '#E74C3C',
  bloodRed: '#C0392B',
  boneWhite: '#ECF0F1',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We'll calculate S (scene timings) roughly based on the script segments
const rawWords = (trenchWords as any).words;
const findTime = (text: string) => {
  const word = rawWords.find((w: any) => w.text.toLowerCase().includes(text.toLowerCase()));
  return word ? Math.floor(word.start * FPS) : 0;
};

const S = {
  scene1: 0,
  scene2: findTime('light vanishes'),
  scene3: findTime('fifty jumbo jets'),
  scene4: findTime('thin red cloud'),
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

// ─── SCENE 1: DRIFTING IN BLUE ────────────────────────────────────────────────
function SceneDrift() {
  const frame = useCurrentFrame();

  const sink = interpolate(frame, [0, 150], [0, 500], clamp);
  const bubbles = (frame * 3) % 200;

  return (
    <AbsoluteFill>
      <Bg color={C.waterBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Light from above */}
            <radialGradient id="light" cx="50%" cy="0%" r="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="100%" stopColor={C.waterBlue} stopOpacity="0" />
            </radialGradient>
            <rect x={-540} y={-960} width={1080} height={1920} fill="url(#light)" />

            {/* Bubbles */}
            <circle cx={-200} cy={200 - bubbles*1.5} r={10} fill={C.white} opacity={0.6} />
            <circle cx={150} cy={100 - bubbles} r={15} fill={C.white} opacity={0.6} />
            <circle cx={50} cy={300 - bubbles*2} r={8} fill={C.white} opacity={0.6} />

            {/* Person sinking */}
            <g transform={`translate(0, ${-400 + sink})`}>
              <rect x={-50} y={-100} width={100} height={100} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-130} r={40} fill={C.personSkin} />
              {/* Arms drifting up */}
              <path d="M -50,-80 Q -100,-150 -120,-180 M 50,-80 Q 100,-150 120,-180" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>WARM BLUE WATER</text>
            <text y={400} textAnchor="middle" fill={C.waterDark} fontSize={70} fontWeight={900}>DRIFTING DOWN</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DARKNESS & PRESSURE ─────────────────────────────────────────────
function SceneDark() {
  const frame = useCurrentFrame();

  const darken = interpolateColors(frame, [0, 40], [C.waterDark, C.pitchBlack]);
  const crushPulse = Math.sin(frame * 0.5) * 20;

  return (
    <AbsoluteFill>
      <Bg color={darken} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Person in dark */}
            <g transform="translate(0, 0)">
              <rect x={-50} y={-50} width={100} height={100} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-80} r={40} fill={C.personSkin} />
            </g>

            {/* Pressure waves pressing inward */}
            <g opacity={frame > 40 ? 1 : 0} stroke={C.waterBlue} strokeWidth={5} fill="none">
              <circle cx={0} cy={-40} r={150 - crushPulse} opacity={0.5} />
              <circle cx={0} cy={-40} r={180 - crushPulse} opacity={0.3} />
              <path d="M -200,-40 L -120,-40 M 200,-40 L 120,-40 M 0,-240 L 0,-160" strokeWidth={10} markerEnd="url(#arrow)" />
            </g>

            <text y={250} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TOTAL DARKNESS</text>
            <text y={-350} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>CRUSHING PRESSURE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: CRUSHED LUNGS ───────────────────────────────────────────────────
function SceneCrush() {
  const frame = useCurrentFrame();

  const scaleY = interpolate(frame, [20, 40], [1, 0.2], clamp);
  const jetWeight = interpolate(frame, [0, 20], [-400, -100], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.pitchBlack} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.2)`}>
            
            {/* Chest / Lungs crushing flat */}
            <g transform={`translate(0, 50) scale(1, ${scaleY})`}>
              <path d="M -80,-50 C -120,-50 -120,50 -80,100 C -40,150 0,50 0,0 C 0,50 40,150 80,100 C 120,50 120,-50 80,-50 C 40,-50 0,0 0,0" fill="#E74C3C" />
              {/* Ribcage */}
              <path d="M -60,0 Q 0,20 60,0 M -70,30 Q 0,50 70,30 M -60,60 Q 0,80 60,60" fill="none" stroke={C.boneWhite} strokeWidth={10} strokeLinecap="round" />
            </g>

            {/* 50 Jumbo Jets weight */}
            <g transform={`translate(0, ${jetWeight})`}>
              {/* Plane Icon */}
              <path d="M -80,0 L 80,0 L 120,-20 L 120,20 Z" fill={C.white} />
              <path d="M -40,0 L -60,-80 L -20,-80 Z" fill={C.white} />
              <path d="M -40,0 L -60,80 L -20,80 Z" fill={C.white} />
              <text y={-40} textAnchor="middle" fill={C.waterBlue} fontSize={80} fontWeight={900}>x50 JETS</text>
            </g>

            <text y={450} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>LUNGS FOLD FLAT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: RED CLOUD ───────────────────────────────────────────────────────
function SceneCloud() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg color={C.pitchBlack} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Expanding red cloud */}
            {Array.from({ length: 50 }).map((_, i) => {
              const angle = (i * Math.PI * 2) / 50 + (i % 2) * 0.5;
              const dist = interpolate(frame, [0, 80], [0, 300 + (i % 5) * 100], clamp);
              const r = interpolate(frame, [0, 80], [20, 0], clamp);
              const cx = Math.cos(angle) * dist;
              const cy = Math.sin(angle) * dist;
              return (
                <circle key={i} cx={cx} cy={cy} r={r} fill={C.bloodRed} opacity={0.8} />
              );
            })}

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>RED CLOUD</text>
            <text y={500} textAnchor="middle" fill={C.waterDark} fontSize={70} fontWeight={900}>7 MILES DEEP</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Trench: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.pitchBlack }}>
      <Audio src={staticFile('trench_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drone.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_impact.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1 || 1}>
        <SceneDrift />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2 || 1}>
        <SceneDark />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3 || 1}>
        <SceneCrush />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={DURATION_IN_FRAMES - S.scene4 || 1}>
        <SceneCloud />
      </Sequence>
    </AbsoluteFill>
  );
};

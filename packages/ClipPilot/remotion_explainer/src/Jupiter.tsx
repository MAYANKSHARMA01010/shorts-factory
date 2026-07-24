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

import jupiterWords from './jupiter_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = Math.floor((jupiterWords as any).words[(jupiterWords as any).words.length - 1].end * FPS) + 30;

const C = {
  bgDeep: '#0D1B2A',
  jupiterClouds: '#E67E22',
  jupiterGas: '#D35400',
  jupiterSoup: '#C0392B',
  liquidMetal: '#7F8C8D',
  personSkin: '#F5CBA7',
  personSuit: '#3498DB',
  subYellow: '#F1C40F',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We'll calculate S (scene timings) roughly based on the script segments
const rawWords = (jupiterWords as any).words;
const findTime = (text: string) => {
  const word = rawWords.find((w: any) => w.text.toLowerCase().includes(text.toLowerCase()));
  return word ? Math.floor(word.start * FPS) : 0;
};

const S = {
  scene1: 0,
  scene2: findTime('winds hit'),
  scene3: findTime('hot, crushing soup'),
  scene4: findTime('liquid metal'),
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

// ─── SCENE 1: PLUNGE THROUGH CLOUDS ───────────────────────────────────────────
function ScenePlunge() {
  const frame = useCurrentFrame();

  const fall = interpolate(frame, [0, 100], [-800, 800], clamp);
  const cloudsUp = interpolate(frame, [0, 100], [0, -500], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.jupiterClouds} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Clouds passing by */}
            <g transform={`translate(0, ${cloudsUp})`}>
              <ellipse cx={-300} cy={100} rx={200} ry={100} fill="#F39C12" opacity={0.6} />
              <ellipse cx={200} cy={300} rx={250} ry={120} fill="#F39C12" opacity={0.6} />
              <ellipse cx={-100} cy={600} rx={300} ry={150} fill="#E67E22" opacity={0.8} />
              <ellipse cx={400} cy={800} rx={200} ry={100} fill="#D35400" opacity={0.5} />
            </g>

            {/* Person falling */}
            <g transform={`translate(0, ${fall})`}>
              <rect x={-50} y={-50} width={100} height={100} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-80} r={40} fill={C.personSkin} />
              <path d="M -50,-30 L -100,-80 M 50,-30 L 100,-80" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>NO SURFACE</text>
            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>PLUNGE STRAIGHT THROUGH</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SCREAMING WINDS ─────────────────────────────────────────────────
function SceneWind() {
  const frame = useCurrentFrame();

  const buffeted = Math.sin(frame * 0.8) * 50;

  return (
    <AbsoluteFill>
      <Bg color={C.jupiterGas} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Horizontal Wind Lines */}
            {Array.from({ length: 20 }).map((_, i) => {
              const speed = 50 + (i % 5) * 10;
              const xPos = ((frame * speed + i * 200) % 2000) - 1000;
              const yPos = -600 + i * 60;
              return (
                <rect key={i} x={xPos} y={yPos} width={200} height={10} fill={C.white} opacity={0.4} />
              );
            })}

            {/* Person blown sideways */}
            <g transform={`translate(${buffeted}, 0) rotate(${buffeted * 0.2})`}>
              <rect x={-40} y={-40} width={80} height={80} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-70} r={35} fill={C.personSkin} />
              <path d="M -40,-20 L -80,0 M 40,-20 L 80,0" fill="none" stroke={C.personSuit} strokeWidth={15} strokeLinecap="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>1000+ MPH WINDS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: CRUSHING SOUP ───────────────────────────────────────────────────
function SceneCrush() {
  const frame = useCurrentFrame();

  const flatten = interpolate(frame, [20, 50], [1, 0.1], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.jupiterSoup} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.2)`}>
            
            {/* Submarine getting crushed */}
            <g transform={`translate(0, 0) scale(1, ${flatten})`}>
              <ellipse cx={0} cy={0} rx={200} ry={80} fill={C.subYellow} />
              <rect x={-30} y={-120} width={60} height={60} fill={C.subYellow} />
              {/* Windows */}
              <circle cx={-100} cy={0} r={20} fill={C.bgDeep} />
              <circle cx={0} cy={0} r={20} fill={C.bgDeep} />
              <circle cx={100} cy={0} r={20} fill={C.bgDeep} />
            </g>

            {/* Pressure Arrows */}
            {frame > 20 && (
              <g stroke={C.white} strokeWidth={10} fill="none">
                <path d="M 0,-300 L 0,-150" markerEnd="url(#arrow)" />
                <path d="M 0,300 L 0,150" markerEnd="url(#arrow)" />
                <path d="M -400,0 L -250,0" markerEnd="url(#arrow)" />
                <path d="M 400,0 L 250,0" markerEnd="url(#arrow)" />
              </g>
            )}

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>CRUSHING SOUP</text>
            <text y={450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>FLATTENS A SUBMARINE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: LIQUID METAL ────────────────────────────────────────────────────
function SceneLiquidMetal() {
  const frame = useCurrentFrame();

  const color = interpolateColors(frame, [0, 50], [C.jupiterSoup, C.liquidMetal]);
  const fall = frame * 10;

  return (
    <AbsoluteFill>
      <Bg color={color} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Speed lines upwards = endless fall */}
            {Array.from({ length: 30 }).map((_, i) => {
              const xPos = ((i * 137) % 1080) - 540;
              const yPos = -960 + ((fall + i * 200) % 1920);
              return (
                <rect key={i} x={xPos} y={yPos} width={4} height={100} fill={C.white} opacity={0.3} />
              );
            })}

            {/* Tiny silhouette of person far away */}
            <g transform={`translate(0, 0) scale(0.3)`}>
              <rect x={-50} y={-50} width={100} height={100} fill={C.bgDeep} rx={20} />
              <circle cx={0} cy={-80} r={40} fill={C.bgDeep} />
            </g>

            <text y={-500} textAnchor="middle" fill={C.bgDeep} fontSize={80} fontWeight={900}>LIQUID METAL</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>ENDLESS FALL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Jupiter: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('jupiter_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_whoosh.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_wind.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_impact.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drone.wav')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1 || 1}>
        <ScenePlunge />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2 || 1}>
        <SceneWind />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3 || 1}>
        <SceneCrush />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={DURATION_IN_FRAMES - S.scene4 || 1}>
        <SceneLiquidMetal />
      </Sequence>
    </AbsoluteFill>
  );
};

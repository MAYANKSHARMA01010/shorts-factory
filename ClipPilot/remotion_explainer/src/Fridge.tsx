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

import fridgeWords from './fridge_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = Math.floor((fridgeWords as any).words[(fridgeWords as any).words.length - 1].end * FPS) + 30;

const C = {
  bgDeep: '#2C3E50',
  fridgeWhite: '#ECF0F1',
  nukeFlash: '#FFF9C4',
  heatOrange: '#E67E22',
  skyBlue: '#85C1E9',
  radiationGreen: '#2ECC71',
  personSkin: '#F5CBA7',
  personSuit: '#3498DB',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We'll calculate S (scene timings) roughly based on the script segments
const rawWords = (fridgeWords as any).words;
const findTime = (text: string) => {
  const word = rawWords.find((w: any) => w.text.toLowerCase().includes(text.toLowerCase()));
  return word ? Math.floor(word.start * FPS) : 0;
};

const S = {
  scene1: 0,
  scene2: findTime('shockwave arrives'),
  scene3: findTime('tumble end over end'),
  scene4: findTime('Radiation'),
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

// ─── SCENE 1: THE FLASH ───────────────────────────────────────────────────────
function SceneFlash() {
  const frame = useCurrentFrame();

  const flash = interpolate(frame, [20, 25, 40], [0, 1, 0], clamp);
  const bg = interpolateColors(frame, [25, 40], [C.skyBlue, C.heatOrange]);

  return (
    <AbsoluteFill>
      <Bg color={bg} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Ground */}
            <rect x={-540} y={200} width={1080} height={760} fill="#7F8C8D" />

            {/* The Fridge */}
            <g transform="translate(0, 0)">
              <rect x={-120} y={-200} width={240} height={400} fill={C.fridgeWhite} rx={20} />
              <rect x={-100} y={-180} width={200} height={120} fill="#BDC3C7" rx={10} /> {/* freezer */}
              <rect x={-100} y={-40} width={200} height={220} fill="#BDC3C7" rx={10} /> {/* main */}
              <rect x={-120} y={-200} width={240} height={400} fill="none" stroke="#2C3E50" strokeWidth={10} rx={20} />
            </g>

            {/* Flash */}
            {frame > 20 && (
              <rect x={-540} y={-960} width={1080} height={1920} fill={C.nukeFlash} opacity={flash} />
            )}

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>NUCLEAR BLAST</text>
            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>HIDE IN FRIDGE?</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SHOCKWAVE FLING ─────────────────────────────────────────────────
function SceneFling() {
  const frame = useCurrentFrame();

  const flingX = interpolate(frame, [10, 40], [0, 800], clamp);
  const flingY = interpolate(frame, [10, 40], [0, -300], clamp);
  const rotate = interpolate(frame, [10, 40], [0, 180], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.heatOrange} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Speed lines */}
            {Array.from({ length: 20 }).map((_, i) => {
              const xPos = ((frame * 100 + i * 200) % 2000) - 1000;
              return (
                <rect key={i} x={xPos} y={-600 + i * 60} width={200} height={10} fill={C.white} opacity={0.3} />
              );
            })}

            {/* Shockwave front */}
            <circle cx={-800 + frame*100} cy={0} r={600} fill="none" stroke={C.white} strokeWidth={30} opacity={0.5} />

            {/* The Fridge Flung */}
            <g transform={`translate(${flingX}, ${flingY}) rotate(${rotate})`}>
              <rect x={-120} y={-200} width={240} height={400} fill={C.fridgeWhite} rx={20} />
              <rect x={-100} y={-180} width={200} height={120} fill="#BDC3C7" rx={10} />
              <rect x={-100} y={-40} width={200} height={220} fill="#BDC3C7" rx={10} />
              <rect x={-120} y={-200} width={240} height={400} fill="none" stroke="#2C3E50" strokeWidth={10} rx={20} />
            </g>

            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SHOCKWAVE ARRIVES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TUMBLE INSIDE ───────────────────────────────────────────────────
function SceneTumble() {
  const frame = useCurrentFrame();

  const tumble = frame * 10;
  const shake = Math.sin(frame * 2) * 20;

  return (
    <AbsoluteFill>
      <Bg color="#000000" />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Inside the fridge */}
            <rect x={-200} y={-300} width={400} height={600} fill="#BDC3C7" rx={20} />
            <rect x={-200} y={-300} width={400} height={600} fill="none" stroke={C.fridgeWhite} strokeWidth={20} rx={20} />

            {/* Person tumbling inside */}
            <g transform={`translate(${shake}, ${shake * 0.5}) rotate(${tumble})`}>
              <rect x={-40} y={-60} width={80} height={120} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-90} r={35} fill={C.personSkin} />
              {/* Flailing limbs */}
              <path d="M -40,-30 L -100,0 M 40,-30 L 100,0" fill="none" stroke={C.personSuit} strokeWidth={15} strokeLinecap="round" />
              <path d="M -20,60 L -60,120 M 20,60 L 60,120" fill="none" stroke={C.personSuit} strokeWidth={15} strokeLinecap="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TUMBLE END OVER END</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: RADIATION SEEPAGE ───────────────────────────────────────────────
function SceneRadiation() {
  const frame = useCurrentFrame();

  const radWave = (frame * 5) % 100;

  return (
    <AbsoluteFill>
      <Bg color="#34495E" />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.2)`}>
            
            {/* Fridge in rubble */}
            <g transform="translate(0, 0) rotate(90)">
              <rect x={-120} y={-200} width={240} height={400} fill="#95A5A6" rx={20} />
              <rect x={-120} y={-200} width={240} height={400} fill="none" stroke="#2C3E50" strokeWidth={10} rx={20} />
            </g>

            {/* Radiation waves seeping in */}
            <g opacity={0.6}>
              {Array.from({ length: 5 }).map((_, i) => (
                <circle key={i} cx={0} cy={0} r={150 + i*50 - radWave} fill="none" stroke={C.radiationGreen} strokeWidth={10} />
              ))}
            </g>

            {/* Biohazard Symbol center */}
            <g transform="translate(0, 0) scale(0.6)">
              <circle cx={0} cy={0} r={80} fill={C.radiationGreen} />
              <circle cx={-40} cy={-40} r={40} fill="#34495E" />
              <circle cx={40} cy={-40} r={40} fill="#34495E" />
              <circle cx={0} cy={40} r={40} fill="#34495E" />
            </g>

            <text y={-350} textAnchor="middle" fill={C.radiationGreen} fontSize={80} fontWeight={900}>RADIATION SEEPING</text>
            <text y={350} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>SLOWLY FALL APART</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Fridge: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('fridge_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_impact.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_airblast.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drone.wav')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1 || 1}>
        <SceneFlash />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2 || 1}>
        <SceneFling />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3 || 1}>
        <SceneTumble />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={DURATION_IN_FRAMES - S.scene4 || 1}>
        <SceneRadiation />
      </Sequence>
    </AbsoluteFill>
  );
};

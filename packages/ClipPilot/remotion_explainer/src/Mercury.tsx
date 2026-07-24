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

import mercuryWords from './mercury_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = Math.floor((mercuryWords as any).words[(mercuryWords as any).words.length - 1].end * FPS) + 30;

const C = {
  bgDeep: '#0D1B2A',
  mercurySilver: '#C0C0C0',
  vaporGreen: '#A9DFBF',
  vaporPurple: '#C39BD3',
  personSkin: '#F5CBA7',
  personSuit: '#E74C3C',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We'll calculate S (scene timings) roughly based on the script segments
const rawWords = (mercuryWords as any).words;
const findTime = (text: string) => {
  const word = rawWords.find((w: any) => w.text.toLowerCase().includes(text.toLowerCase()));
  return word ? Math.floor(word.start * FPS) : 0;
};

const S = {
  scene1: 0,
  scene2: findTime('float high'),
  scene3: findTime('real danger'),
  scene4: findTime('float there helplessly'),
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

// ─── SCENE 1: FLOAT ON POOL ───────────────────────────────────────────────────
function ScenePool() {
  const frame = useCurrentFrame();

  const drop = interpolate(frame, [0, 20], [-1000, 0], clamp);
  const bob = Math.sin(frame * 0.1) * 20;
  const ripples = (frame * 5) % 200;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Pool of Mercury */}
            <rect x={-540} y={100} width={1080} height={860} fill={C.mercurySilver} />
            <ellipse cx={0} cy={100} rx={540} ry={100} fill="#E0E0E0" />
            
            {/* Ripples */}
            <ellipse cx={0} cy={100} rx={ripples * 2} ry={ripples * 0.5} fill="none" stroke={C.white} strokeWidth={5} opacity={1 - ripples/200} />

            {/* Person bobbing high */}
            <g transform={`translate(0, ${100 + drop + bob})`}>
              <rect x={-50} y={-100} width={100} height={100} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-130} r={40} fill={C.personSkin} />
              <path d="M -70,-80 L -100,-150 M 70,-80 L 100,-150" fill="none" stroke={C.personSkin} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-400} textAnchor="middle" fill={C.mercurySilver} fontSize={90} fontWeight={900}>LIQUID MERCURY</text>
            <text y={450} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900}>FLOAT LIKE A CORK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: STRUGGLE TO SWIM ────────────────────────────────────────────────
function SceneStruggle() {
  const frame = useCurrentFrame();

  const paddle = Math.sin(frame * 0.5) * 40;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Mercury Level */}
            <rect x={-400} y={100} width={800} height={400} fill={C.mercurySilver} />

            {/* Person stuck */}
            <g transform="translate(0, 80)">
              <rect x={-60} y={-120} width={120} height={100} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-160} r={50} fill={C.personSkin} />
              
              {/* Sweating */}
              <circle cx={-30} cy={-180} r={5} fill="#3498DB" />
              <circle cx={30} cy={-180} r={5} fill="#3498DB" />

              {/* Arms paddling hard */}
              <path d={`M -60,-100 Q -100,${-100 + paddle} -120,0`} fill="none" stroke={C.personSkin} strokeWidth={20} strokeLinecap="round" />
              <path d={`M 60,-100 Q 100,${-100 - paddle} 120,0`} fill="none" stroke={C.personSkin} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* 13x Heavier text */}
            <text y={250} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900}>13x HEAVIER</text>
            <text y={-400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>IMPOSSIBLE TO SWIM</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TOXIC VAPOR ─────────────────────────────────────────────────────
function SceneVapor() {
  const frame = useCurrentFrame();

  const vaporHeight = interpolate(frame, [0, 60], [0, 400], clamp);
  const nerveColor = interpolateColors(frame, [40, 100], [C.white, C.vaporPurple]);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.2)`}>
            
            {/* Person profile showing nerves */}
            <path d="M -150,-100 Q -150,-300 0,-300 Q 150,-300 150,-100 Q 150,50 100,100 L -100,100 Z" fill={C.personSkin} />
            
            {/* Brain & Nerves inside */}
            <path d="M -50,-200 C -50,-250 50,-250 50,-200 C 50,-150 -50,-150 -50,-200" fill={nerveColor} />
            <path d="M 0,-180 L 0,50" stroke={nerveColor} strokeWidth={15} strokeLinecap="round" />
            <path d="M 0,-100 L 80,0 M 0,-50 L 60,50" stroke={nerveColor} strokeWidth={10} strokeLinecap="round" />

            {/* Vapor rising from below */}
            <g opacity={0.7} stroke={C.vaporGreen} strokeWidth={20} strokeLinecap="round">
              <path d={`M -100,200 Q -150,100 -100,${200 - vaporHeight * 0.8}`} fill="none" />
              <path d={`M 100,200 Q 150,100 100,${200 - vaporHeight}`} fill="none" />
              <path d={`M 0,200 Q 50,100 0,${200 - vaporHeight * 1.2}`} fill="none" />
            </g>

            <text y={-450} textAnchor="middle" fill={C.vaporGreen} fontSize={90} fontWeight={900}>INVISIBLE VAPOR</text>
            <text y={350} textAnchor="middle" fill={C.vaporPurple} fontSize={70} fontWeight={900}>POISONS NERVES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: NUMB REFLECTION ─────────────────────────────────────────────────
function SceneNumb() {
  const frame = useCurrentFrame();

  const colorFade = interpolateColors(frame, [0, 100], [C.personSkin, '#95A5A6']);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={0} width={1080} height={960} fill={C.mercurySilver} />
            
            {/* Reflection */}
            <g transform="translate(0, 0) scale(1, -1)">
              <rect x={-80} y={0} width={160} height={150} fill="#34495E" rx={20} />
              <circle cx={0} cy={200} r={60} fill="#7F8C8D" />
            </g>
            
            {/* Person fading out */}
            <g transform="translate(0, 0)">
              <rect x={-80} y={-150} width={160} height={150} fill={C.personSuit} rx={20} />
              <circle cx={0} cy={-200} r={60} fill={colorFade} />
              
              {/* Crossed out eyes */}
              {frame > 60 && (
                <g stroke="#2C3E50" strokeWidth={5}>
                  <path d="M -30,-220 L -10,-200 M -10,-220 L -30,-200" />
                  <path d="M 10,-220 L 30,-200 M 30,-220 L 10,-200" />
                </g>
              )}
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>SLOWLY GOING NUMB</text>
            <text y={500} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900}>SHIMMERING MIRROR</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Mercury: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('mercury_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_airblast.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1 || 1}>
        <ScenePool />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2 || 1}>
        <SceneStruggle />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3 || 1}>
        <SceneVapor />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={DURATION_IN_FRAMES - S.scene4 || 1}>
        <SceneNumb />
      </Sequence>
    </AbsoluteFill>
  );
};

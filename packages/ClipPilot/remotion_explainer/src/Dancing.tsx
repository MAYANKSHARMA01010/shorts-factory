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

import dancingWords from './dancing_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1091;

const C = {
  bgDeep: '#181A18',
  streetBrown: '#5C4033',
  dressRed: '#D90429',
  suitBlue: '#1D3557',
  stageWood: '#8B5A2B',
  deathPale: '#E0E1DD',
  bloodRed: '#9A031E',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 225,
  scene3: 385,
  scene4: 539,
  scene5: 752,
  scene6: 906,
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

// ─── SCENE 1: FIRST WOMAN DANCING ─────────────────────────────────────────────
function SceneFirstWoman() {
  const frame = useCurrentFrame();

  const spin = frame * 10;
  const bounce = Math.sin(frame * 0.5) * 30;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Street */}
            <rect x={-540} y={100} width={1080} height={860} fill={C.streetBrown} />
            {/* Old buildings silhouette */}
            <path d="M -540,100 L -540,-300 L -300,-500 L -100,-300 L -100,100 Z" fill="#212529" />
            <path d="M 100,100 L 100,-400 L 300,-600 L 540,-400 L 540,100 Z" fill="#212529" />

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>SUMMER 1518</text>

            {/* Dancing Woman */}
            <g transform={`translate(0, ${100 + bounce})`}>
              <g transform={`rotate(${spin})`}>
                <rect x={-60} y={0} width={120} height={150} fill={C.dressRed} rx={20} />
                <circle cx={0} cy={-50} r={40} fill={C.deathPale} />
                {/* Arms flailing */}
                <path d="M -50,20 L -100,-20 M 50,20 L 100,-20" fill="none" stroke={C.deathPale} strokeWidth={20} strokeLinecap="round" />
              </g>
              {/* Legs kicking */}
              <line x1={-30} y1={120} x2={-50 + Math.sin(frame)*40} y2={200} stroke={C.deathPale} strokeWidth={20} strokeLinecap="round" />
              <line x1={30} y1={120} x2={50 + Math.cos(frame)*40} y2={200} stroke={C.deathPale} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Music notes crossed out */}
            <g transform="translate(-200, -200)">
              <text fontSize={80} fill={C.white}>🎵</text>
              <line x1={-20} y1={20} x2={80} y2={-80} stroke={C.bloodRed} strokeWidth={15} />
            </g>

            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SHE WOULD NOT STOP</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DOZENS JOIN ─────────────────────────────────────────────────────
function SceneDozensJoin() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.streetBrown} />

            {/* Crowd of dancers */}
            <g transform="translate(0, 0)">
              {Array.from({length: 20}).map((_, i) => {
                const x = (i % 5 - 2) * 200 + (Math.random() - 0.5) * 50;
                const y = Math.floor(i / 5 - 2) * 200 + (Math.random() - 0.5) * 50;
                const phase = i * 10;
                const spin = (frame * 5 + phase) * (i % 2 === 0 ? 1 : -1);
                const bounce = Math.sin((frame + phase) * 0.5) * 20;
                return (
                  <g key={i} transform={`translate(${x}, ${y + bounce}) rotate(${spin})`}>
                    <rect x={-30} y={-40} width={60} height={80} fill={i % 3 === 0 ? C.dressRed : C.suitBlue} rx={10} />
                    <circle cx={0} cy={-50} r={20} fill={C.deathPale} />
                    <line x1={-30} y1={-20} x2={-60} y2={-50} stroke={C.deathPale} strokeWidth={10} strokeLinecap="round" />
                    <line x1={30} y1={-20} x2={60} y2={-50} stroke={C.deathPale} strokeWidth={10} strokeLinecap="round" />
                  </g>
                );
              })}
            </g>

            <rect x={-540} y={-300} width={1080} height={600} fill={C.bgDeep} opacity={0.6} />

            <text y={-100} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>DOZENS JOINED</text>
            <text y={0} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TWITCHING & SPINNING</text>
            <text y={100} textAnchor="middle" fill={C.bloodRed} fontSize={80} fontWeight={900}>WITH NO MUSIC</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: HUNDREDS DANCING A WEEK ─────────────────────────────────────────
function SceneHundreds() {
  const frame = useCurrentFrame();

  const grow = interpolate(frame, [0, 60], [1, 3], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${grow})`}>
            
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.bgDeep} />

            {/* Huge sea of dots vibrating */}
            <g transform="translate(0, 0)">
              {Array.from({length: 200}).map((_, i) => {
                const x = (Math.random() - 0.5) * 1000;
                const y = (Math.random() - 0.5) * 1800;
                const vx = Math.sin(frame * Math.random()) * 10;
                const vy = Math.cos(frame * Math.random()) * 10;
                return (
                  <circle key={i} cx={x + vx} cy={y + vy} r={10} fill={Math.random() > 0.5 ? C.dressRed : C.suitBlue} />
                );
              })}
            </g>

          </g>

          {/* Overlay text */}
          <g transform={`translate(540, 960) scale(1.0)`}>
            <rect x={-400} y={-200} width={800} height={400} fill={C.bgDeep} opacity={0.8} rx={20} />
            <text y={-50} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>HUNDREDS</text>
            <text y={50} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>WITHOUT REST</text>
            <text y={150} textAnchor="middle" fill={C.bloodRed} fontSize={60} fontWeight={900}>FOR A WEEK STRAIGHT</text>
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: MORE DANCING CURE ───────────────────────────────────────────────
function SceneCure() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <text y={-600} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>THE "CURE":</text>
            <text y={-500} textAnchor="middle" fill={C.bloodRed} fontSize={120} fontWeight={900}>MORE DANCING</text>

            {/* Stage */}
            <rect x={-400} y={200} width={800} height={400} fill={C.stageWood} rx={20} />
            
            {/* Musicians */}
            <g transform={`translate(-200, 100) rotate(${Math.sin(frame)*10})`}>
              <circle cx={0} cy={-50} r={30} fill="#E5E5E5" />
              <rect x={-20} y={-20} width={40} height={80} fill="#212529" />
              <rect x={10} y={0} width={80} height={10} fill="#B08968" /> {/* Flute */}
            </g>

            <g transform={`translate(200, 100) rotate(${Math.cos(frame)*10})`}>
              <circle cx={0} cy={-50} r={30} fill="#E5E5E5" />
              <rect x={-20} y={-20} width={40} height={80} fill="#212529" />
              <circle cx={30} cy={20} r={25} fill="#B08968" /> {/* Drum */}
            </g>

            {/* Dancers on stage */}
            <g transform="translate(0, 150)">
              <g transform={`rotate(${frame*15})`}>
                <circle cx={0} cy={-50} r={30} fill={C.deathPale} />
                <rect x={-20} y={-20} width={40} height={80} fill={C.dressRed} />
              </g>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DROPPING DEAD ───────────────────────────────────────────────────
function SceneDroppingDead() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={100} width={1080} height={860} fill={C.streetBrown} />

            {/* Collapsed dancers */}
            <g transform="translate(0, 300)">
              <g transform="translate(-200, 0) rotate(-80)">
                <rect x={-30} y={-40} width={60} height={80} fill={C.suitBlue} rx={10} />
                <circle cx={0} cy={-50} r={20} fill={C.deathPale} />
                <line x1={-30} y1={-20} x2={-60} y2={-50} stroke={C.deathPale} strokeWidth={10} />
                <line x1={30} y1={-20} x2={60} y2={-50} stroke={C.deathPale} strokeWidth={10} />
              </g>
              <g transform="translate(200, 100) rotate(90)">
                <rect x={-30} y={-40} width={60} height={80} fill={C.dressRed} rx={10} />
                <circle cx={0} cy={-50} r={20} fill={C.deathPale} />
              </g>
            </g>

            {/* One falls down */}
            <g transform={`translate(0, ${Math.min(300, frame*20)}) rotate(${Math.min(90, frame*5)})`}>
              <rect x={-40} y={-60} width={80} height={120} fill={C.suitBlue} rx={10} />
              <circle cx={0} cy={-80} r={30} fill={C.deathPale} />
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>PEOPLE KEPT COLLAPSING</text>
            <text y={-300} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>STROKES & EXHAUSTION</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: NOBODY KNOWS ────────────────────────────────────────────────────
function SceneMystery() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Giant Question Mark composed of skulls */}
            <g transform={`translate(0, ${Math.sin(frame*0.1)*20 - 100})`}>
              <text y={0} textAnchor="middle" fill={C.deathPale} fontSize={600} fontWeight={900}>?</text>
            </g>

            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>NOBODY TRULY KNOWS</text>
            <text y={500} textAnchor="middle" fill={C.bloodRed} fontSize={60} fontWeight={900}>WHAT MADE THEM DANCE TO DEATH</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Dancing: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('dancing_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneFirstWoman />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneDozensJoin />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneHundreds />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneCure />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneDroppingDead />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneMystery />
      </Sequence>
    </AbsoluteFill>
  );
};

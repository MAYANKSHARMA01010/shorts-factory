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

import bearWords from './bear_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1049;

const C = {
  bgDeep: '#233023',
  bearBrown: '#5A3A22',
  bearBlack: '#1C1A17',
  dangerRed: '#D62828',
  personSuit: '#F77F00',
  forestGreen: '#2B412E',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 322,
  scene3: 571,
  scene4: 693,
  scene5: 817,
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

// ─── SCENE 1: LOCK EYES & RUNNING MYTH ────────────────────────────────────────
function SceneRun() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chase = frame > 60 ? interpolate(frame, [60, 120], [0, 600], clamp) : 0;
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Trees */}
            <path d="M -300,100 L -400,-400 L -200,-400 Z" fill={C.forestGreen} />
            <path d="M 300,100 L 200,-500 L 400,-500 Z" fill={C.forestGreen} />

            {/* Bear */}
            <g transform={`translate(${chase*1.2}, 0)`}>
              <circle cx={-150} cy={0} r={100} fill={C.bearBrown} />
              <circle cx={-200} cy={-50} r={30} fill={C.bearBrown} />
              <circle cx={-100} cy={-50} r={30} fill={C.bearBrown} />
              {/* Glowing Eyes */}
              <circle cx={-180} cy={0} r={10} fill={C.dangerRed} />
              <circle cx={-120} cy={0} r={10} fill={C.dangerRed} />
            </g>

            {/* Person running */}
            {frame > 60 && (
              <g transform={`translate(${chase}, 200)`}>
                <circle cx={150} cy={0} r={40} fill={C.personSuit} />
                <line x1={150} y1={50} x2={150} y2={150} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
                <path d="M 120,200 L 150,150 L 180,200" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}

            {frame > 60 && (
              <>
                <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>DON'T RUN</text>
                <text y={-300} textAnchor="middle" fill={C.dangerRed} fontSize={60} fontWeight={900}>30 MPH CHASE</text>
              </>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: STAND TALL & WAVE ───────────────────────────────────────────────
function SceneWave() {
  const frame = useCurrentFrame();
  
  const wave1 = Math.sin(frame * 0.3) * 45;
  const wave2 = Math.cos(frame * 0.3) * 45;
  const pop = spring({ frame: frame - 10, fps: 30, config: { damping: 12 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Bear in background confused */}
            <g transform="translate(0, -300) scale(0.6)">
              <circle cx={0} cy={0} r={100} fill={C.bearBrown} />
              <text y={-150} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>?</text>
            </g>

            {/* Person standing tall */}
            <g transform={`translate(0, 300) scale(${1 + pop * 0.2})`}>
              <circle cx={0} cy={-200} r={60} fill={C.personSuit} />
              <line x1={0} y1={-120} x2={0} y2={100} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <path d="M -40,100 L -40,250 M 40,100 L 40,250" fill="none" stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              
              {/* Waving arms */}
              <line x1={0} y1={-80} x2={-120} y2={-200 + wave1} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <line x1={0} y1={-80} x2={120} y2={-200 + wave2} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
            </g>

            {/* Sound waves from mouth */}
            <g opacity={Math.min(1, frame/20)}>
              {Array.from({length: 3}).map((_, i) => {
                const r = ((frame * 2 + i * 40) % 120);
                return (
                  <path key={i} d={`M -${r},20 Q 0,-${r} ${r},20`} fill="none" stroke={C.white} strokeWidth={10} strokeLinecap="round" opacity={1 - r/120} />
                );
              })}
            </g>
            <text y={-50} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>"HEY BEAR"</text>

            <text y={650} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>NOT PREY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: BACK AWAY ───────────────────────────────────────────────────────
function SceneBackAway() {
  const frame = useCurrentFrame();
  
  const move = interpolate(frame, [0, 100], [0, 400], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <circle cx={0} cy={-200} r={120} fill={C.bearBrown} />
            <circle cx={-60} cy={-280} r={40} fill={C.bearBrown} />
            <circle cx={60} cy={-280} r={40} fill={C.bearBrown} />
            
            {/* Person backing away */}
            <g transform={`translate(0, ${move})`}>
              <circle cx={0} cy={200} r={40} fill={C.personSuit} />
              <line x1={0} y1={250} x2={0} y2={350} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>BACK AWAY SLOWLY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: BROWN BEAR -> PLAY DEAD ─────────────────────────────────────────
function SceneBrownBear() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Brown Bear */}
            <circle cx={0} cy={-300} r={180} fill={C.bearBrown} />
            <circle cx={-100} cy={-420} r={50} fill={C.bearBrown} />
            <circle cx={100} cy={-420} r={50} fill={C.bearBrown} />
            <text y={-100} textAnchor="middle" fill={C.bearBrown} fontSize={80} fontWeight={900}>BROWN BEAR</text>

            {/* Person playing dead, hands over neck */}
            <g transform="translate(0, 300) rotate(-90)">
              <circle cx={0} cy={-150} r={50} fill={C.personSuit} />
              <line x1={0} y1={-80} x2={0} y2={100} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              {/* Hands covering neck */}
              <path d="M 0,-60 L -60,-120 L 0,-150 M 0,-60 L 60,-120 L 0,-150" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinejoin="round" />
            </g>

            <text y={500} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>PLAY DEAD</text>
            <text y={600} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>PROTECT NECK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: BLACK BEAR -> FIGHT BACK ────────────────────────────────────────
function SceneBlackBear() {
  const frame = useCurrentFrame();

  const shake = Math.sin(frame) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Black Bear */}
            <circle cx={0} cy={-300} r={150} fill={C.bearBlack} />
            <circle cx={-80} cy={-400} r={40} fill={C.bearBlack} />
            <circle cx={80} cy={-400} r={40} fill={C.bearBlack} />
            <text y={-100} textAnchor="middle" fill={C.bearBlack} fontSize={80} fontWeight={900} stroke={C.white} strokeWidth={2}>BLACK BEAR</text>

            {/* Person Fighting Back */}
            <g transform={`translate(${shake}, 250)`}>
              <circle cx={0} cy={-150} r={50} fill={C.personSuit} />
              <line x1={0} y1={-80} x2={0} y2={100} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <path d="M -40,100 L -60,250 M 40,100 L 60,250" fill="none" stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              
              {/* Punching arms */}
              <line x1={0} y1={-60} x2={-150} y2={-200} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <line x1={0} y1={-60} x2={150} y2={-200} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />

              {/* Impact sparks */}
              {frame % 10 < 5 && (
                <g stroke={C.dangerRed} strokeWidth={10} fill="none">
                  <path d="M -180,-230 L -230,-280 M -120,-250 L -120,-300 M -150,-200 L -200,-180" />
                  <path d="M 180,-230 L 230,-280 M 120,-250 L 120,-300 M 150,-200 L 200,-180" />
                </g>
              )}
            </g>

            <text y={650} textAnchor="middle" fill={C.dangerRed} fontSize={120} fontWeight={900}>FIGHT BACK</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Bear: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('bear_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneRun />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneWave />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneBackAway />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneBrownBear />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneBlackBear />
      </Sequence>
    </AbsoluteFill>
  );
};

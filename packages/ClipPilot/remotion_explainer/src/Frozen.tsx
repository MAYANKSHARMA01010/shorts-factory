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

import frozenWords from './frozen_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1049;

const C = {
  bgDeep: '#0D1B2A',
  iceBlueLight: '#E0FBFC',
  iceBlueDark: '#98C1D9',
  waterDark: '#1B263B',
  dangerRed: '#EF233C',
  safeGreen: '#2A9D8F',
  personSuit: '#F77F00',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 188,
  scene3: 359,
  scene4: 553,
  scene5: 758,
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

// ─── SCENE 1: ICE CRACKS & PLUNGE ─────────────────────────────────────────────
function ScenePlunge() {
  const frame = useCurrentFrame();

  const crack = frame > 30 ? 1 : 0;
  const plunge = interpolate(frame, [60, 90], [0, 600], clamp);
  const splash = spring({ frame: frame - 60, fps: 30, config: { damping: 10 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Water under ice */}
            <rect x={-540} y={0} width={1080} height={960} fill={C.waterDark} />
            
            {/* Ice layer */}
            <rect x={-540} y={-50} width={1080} height={100} fill={C.iceBlueLight} />
            
            {/* The Crack */}
            <g opacity={crack}>
              <path d="M -150,-50 L -50,0 L 50,-50 L 150,0" fill="none" stroke={C.bgDeep} strokeWidth={10} />
              {/* Hole opens */}
              {frame > 60 && (
                <rect x={-200} y={-50} width={400} height={100} fill={C.waterDark} />
              )}
            </g>

            {/* Person */}
            <g transform={`translate(0, ${-250 + plunge})`}>
              <circle cx={0} cy={-50} r={40} fill={C.personSuit} />
              <line x1={0} y1={-10} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M -40,-20 L 0,-10 L 40,-20" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M -20,100 L -20,150 M 20,100 L 20,150" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Splash */}
            {splash > 0 && (
              <g transform="translate(0, 0)">
                <path d={`M -150,0 Q -100,${-150*splash} -50,0 Q 0,${-200*splash} 50,0 Q 100,${-150*splash} 150,0`} fill="none" stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              </g>
            )}

            {frame > 60 && (
              <text y={700} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>PUNCHES BREATH OUT</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: THE CLOCK IS TICKING ────────────────────────────────────────────
function SceneClock() {
  const frame = useCurrentFrame();

  const tick = Math.sin(frame * 0.2) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Person in freezing water */}
            <rect x={-540} y={0} width={1080} height={960} fill={C.waterDark} />
            <rect x={-540} y={-50} width={1080} height={100} fill={C.iceBlueLight} />
            <rect x={-200} y={-50} width={400} height={100} fill={C.waterDark} />

            <g transform={`translate(0, 150)`}>
              <circle cx={0} cy={-50} r={40} fill={C.personSuit} />
              <line x1={0} y1={-10} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              {/* Shivering */}
              <g transform={`translate(${Math.sin(frame)*5}, 0)`}>
                <path d="M -40,-20 L 0,-10 L 40,-20" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>

            {/* Giant Clock Graphic */}
            <g transform="translate(0, -400)">
              <circle cx={0} cy={0} r={200} fill="none" stroke={C.dangerRed} strokeWidth={30} />
              <line x1={0} y1={0} x2={0} y2={-150} stroke={C.dangerRed} strokeWidth={20} strokeLinecap="round" transform={`rotate(${tick})`} />
              <text y={300} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>1 MIN TO PANIC</text>
              <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>10 MIN TO MUSCLE FAILURE</text>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: TURN BACK TO STRONG ICE ─────────────────────────────────────────
function SceneTurn() {
  const frame = useCurrentFrame();
  
  const turn = spring({ frame: frame - 20, fps: 30, config: { damping: 12 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Top-down view of the hole */}
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.iceBlueLight} />
            <circle cx={0} cy={0} r={300} fill={C.waterDark} />

            {/* Person in water */}
            <g transform={`rotate(${turn * 180})`}>
              {/* Body */}
              <circle cx={0} cy={0} r={50} fill={C.personSuit} />
              <path d="M -40,40 L -60,80 M 40,40 L 60,80" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* Footprints showing path they came from */}
              {turn > 0.8 && (
                <g transform="rotate(180) translate(0, 400)">
                  <path d="M -40,0 A 20 40 0 1 1 0,0 A 20 40 0 1 1 -40,0" fill={C.bgDeep} opacity={0.3} />
                  <path d="M 10,100 A 20 40 0 1 1 50,100 A 20 40 0 1 1 10,100" fill={C.bgDeep} opacity={0.3} />
                  <path d="M -40,200 A 20 40 0 1 1 0,200 A 20 40 0 1 1 -40,200" fill={C.bgDeep} opacity={0.3} />
                  
                  <text y={-100} x={0} textAnchor="middle" fill={C.safeGreen} fontSize={50} fontWeight={900}>SOLID ICE</text>
                </g>
              )}
            </g>

            <text y={-500} textAnchor="middle" fill={C.bgDeep} fontSize={80} fontWeight={900}>TURN TO WHERE YOU CAME FROM</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: KICK & CLAW ─────────────────────────────────────────────────────
function SceneKickClaw() {
  const frame = useCurrentFrame();

  const kick = Math.sin(frame * 0.5) * 40;
  const slide = interpolate(frame, [0, 90], [0, 400], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Side view */}
            <rect x={-540} y={0} width={1080} height={960} fill={C.waterDark} />
            <rect x={100} y={-50} width={440} height={100} fill={C.iceBlueLight} />
            <rect x={-540} y={-50} width={640} height={100} fill={C.waterDark} />

            {/* Person swimming horizontally and pulling up */}
            <g transform={`translate(${-200 + slide}, 0)`}>
              <circle cx={0} cy={-20} r={40} fill={C.personSuit} />
              <line x1={-100} y1={20} x2={0} y2={0} stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              
              {/* Arms pulling */}
              <path d="M 0,-10 L 80,-30" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* Kicking legs */}
              <line x1={-100} y1={20} x2={-180} y2={40 + kick} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={-100} y1={20} x2={-180} y2={40 - kick} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />

              {/* Water splashes from kicking */}
              {frame % 10 < 5 && (
                <circle cx={-200} cy={40} r={10} fill={C.white} />
              )}
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>KICK LEGS HORIZONTAL</text>
            <text y={-300} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>CLAW ONTO SURFACE</text>

            {slide > 300 && (
              <text y={300} textAnchor="middle" fill={C.dangerRed} fontSize={120} fontWeight={900}>DON'T STAND!</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: ROLL AWAY ───────────────────────────────────────────────────────
function SceneRoll() {
  const frame = useCurrentFrame();

  const rollAngle = frame * 10;
  const moveX = interpolate(frame, [0, 100], [0, 500], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Top-down view */}
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.iceBlueLight} />
            <circle cx={-300} cy={0} r={200} fill={C.waterDark} />

            {/* Person rolling */}
            <g transform={`translate(${-100 + moveX}, 0)`}>
              <g transform={`rotate(${rollAngle})`}>
                <rect x={-80} y={-40} width={160} height={80} rx={20} fill={C.personSuit} />
                <circle cx={90} cy={0} r={30} fill={C.personSuit} />
              </g>
            </g>

            <text y={-500} textAnchor="middle" fill={C.bgDeep} fontSize={90} fontWeight={900}>ROLL AWAY</text>
            <text y={-400} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900}>SPREADS YOUR WEIGHT</text>

            <g transform="translate(0, 600)">
              <rect x={-300} y={-100} width={600} height={200} rx={20} fill={C.dangerRed} />
              <text y={0} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>BEWARE AFTERDROP</text>
              <text y={60} textAnchor="middle" fill={C.white} fontSize={40} fontWeight={900}>HYPOTHERMIA CAN STILL KILL</text>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Frozen: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('frozen_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene1 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_water_ripples.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <ScenePlunge />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneClock />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneTurn />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneKickClaw />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneRoll />
      </Sequence>
    </AbsoluteFill>
  );
};

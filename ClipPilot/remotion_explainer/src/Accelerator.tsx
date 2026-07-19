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

import acceleratorWords from './accelerator_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 935;

const C = {
  bgDeep: '#11151C',
  roadGray: '#343A40',
  carRed: '#E63946',
  dangerRed: '#D90429',
  safeGreen: '#2A9D8F',
  white: '#FFFFFF',
  lineYellow: '#FFB703',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 188,
  scene3: 370,
  scene4: 611,
  scene5: 766,
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

// ─── SCENE 1: SPEEDING HIGHWAY ────────────────────────────────────────────────
function SceneHighway() {
  const frame = useCurrentFrame();

  // Speeding effect
  const speed = (frame * 50) % 600;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Road */}
            <path d="M -200,-960 L 200,-960 L 500,960 L -500,960 Z" fill={C.roadGray} />
            
            {/* Moving lines */}
            <g transform={`translate(0, ${speed})`}>
              <line x1={0} y1={-1500} x2={0} y2={-1200} stroke={C.lineYellow} strokeWidth={20} />
              <line x1={0} y1={-900} x2={0} y2={-600} stroke={C.lineYellow} strokeWidth={20} />
              <line x1={0} y1={-300} x2={0} y2={0} stroke={C.lineYellow} strokeWidth={20} />
              <line x1={0} y1={300} x2={0} y2={600} stroke={C.lineYellow} strokeWidth={20} />
            </g>

            {/* Car out of control (shaking) */}
            <g transform={`translate(${Math.sin(frame)*10}, ${200 + Math.cos(frame)*10})`}>
              <rect x={-100} y={-150} width={200} height={300} rx={40} fill={C.carRed} />
              <rect x={-80} y={-80} width={160} height={100} rx={20} fill={C.bgDeep} />
              
              {/* Fire from exhaust */}
              <path d="M -60,150 L -40,200 L -20,160 L 0,220 L 20,160 L 40,200 L 60,150 Z" fill="#F48C06" />
            </g>

            {/* Accelerator pedal stuck */}
            <g transform="translate(300, -300) scale(1.2)">
              <rect x={-40} y={-80} width={80} height={160} rx={10} fill="#6C757D" />
              <path d="M -40,-80 L 40,-60 L 40,80 L -40,80 Z" fill="#343A40" />
              <line x1={-60} y1={0} x2={60} y2={0} stroke={C.dangerRed} strokeWidth={10} />
              <line x1={-60} y1={-40} x2={60} y2={40} stroke={C.dangerRed} strokeWidth={10} />
            </g>

            <text y={-600} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>ACCELERATOR STUCK</text>
            <text y={700} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SPEEDING OUT OF CONTROL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DON'T PANIC & KILL ENGINE ───────────────────────────────────────
function SceneKillEngine() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Steering wheel */}
            <g transform="translate(0, 0)">
              <circle cx={0} cy={0} r={250} fill="none" stroke="#6C757D" strokeWidth={50} />
              <path d="M 0,0 L -200,-150 M 0,0 L 200,-150 M 0,0 L 0,250" fill="none" stroke="#6C757D" strokeWidth={50} />
              
              {/* Lock overlay */}
              <g transform="translate(0, 0) scale(1.5)" opacity={frame > 40 ? 1 : 0}>
                <rect x={-60} y={0} width={120} height={100} rx={20} fill={C.dangerRed} />
                <path d="M -40,0 L -40,-50 A 40 40 0 0 1 40,-50 L 40,0" fill="none" stroke={C.dangerRed} strokeWidth={20} />
                <circle cx={0} cy={50} r={15} fill={C.bgDeep} />
              </g>
            </g>

            {/* Key turning off */}
            <g transform="translate(350, 100) rotate(45)">
              <rect x={-20} y={-100} width={40} height={100} fill="#ADB5BD" />
              <circle cx={0} cy={-120} r={40} fill="#212529" />
              <g opacity={0.8}>
                <line x1={-60} y1={-80} x2={60} y2={-40} stroke={C.dangerRed} strokeWidth={20} strokeLinecap="round" />
                <line x1={-60} y1={-40} x2={60} y2={-80} stroke={C.dangerRed} strokeWidth={20} strokeLinecap="round" />
              </g>
            </g>

            <text y={-450} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>DON'T TURN OFF ENGINE</text>
            
            {frame > 40 && (
              <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>STEERING WILL LOCK</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: APPLY BRAKES FIRMLY ─────────────────────────────────────────────
function SceneBrakes() {
  const frame = useCurrentFrame();

  const press = spring({ frame: frame - 20, fps: 30, config: { damping: 12 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Brake Pedal */}
            <g transform={`translate(0, ${100 + press * 100}) scale(1.5)`}>
              <rect x={-80} y={-60} width={160} height={120} rx={20} fill={C.roadGray} />
              {/* Shoe pressing down */}
              <path d="M -60,-200 L 60,-200 L 80,-60 L -80,-60 Z" fill="#212529" />
            </g>

            <text y={-300} textAnchor="middle" fill={C.safeGreen} fontSize={90} fontWeight={900}>FIRM, STEADY BRAKING</text>

            {/* Pumping forbidden */}
            <g transform="translate(0, 500)">
              <path d="M -150,0 Q 0,-150 150,0 T 450,0" fill="none" stroke="#6C757D" strokeWidth={20} strokeDasharray="30, 20" />
              <line x1={-200} y1={-100} x2={500} y2={100} stroke={C.dangerRed} strokeWidth={40} strokeLinecap="round" opacity={frame > 60 ? 1 : 0} />
              <text y={200} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>DO NOT PUMP</text>
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: SHIFT TO NEUTRAL ────────────────────────────────────────────────
function SceneNeutral() {
  const frame = useCurrentFrame();

  const shift = spring({ frame: frame - 20, fps: 30, config: { damping: 10 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Gear shift panel */}
            <rect x={-100} y={-300} width={200} height={600} rx={40} fill="#212529" />
            
            {/* P R N D */}
            <text x={-150} y={-200} fill={C.white} fontSize={60} fontWeight={900}>P</text>
            <text x={-150} y={-50} fill={C.white} fontSize={60} fontWeight={900}>R</text>
            <text x={-150} y={100} fill={C.safeGreen} fontSize={80} fontWeight={900}>N</text>
            <text x={-150} y={250} fill={C.white} fontSize={60} fontWeight={900}>D</text>

            {/* Shift Stick */}
            <g transform={`translate(0, ${220 - shift * 140})`}>
              <rect x={-20} y={-200} width={40} height={200} fill="#ADB5BD" />
              <circle cx={0} cy={-200} r={60} fill={C.roadGray} />
            </g>

            {/* Engine disconnected from wheels graphic */}
            <g transform="translate(0, 500)">
              <rect x={-200} y={-50} width={100} height={100} rx={10} fill={C.carRed} />
              <text x={-150} y={100} textAnchor="middle" fill={C.white} fontSize={40}>ENGINE</text>
              
              <circle cx={200} cy={0} r={50} fill="#6C757D" />
              <text x={200} y={100} textAnchor="middle" fill={C.white} fontSize={40}>WHEELS</text>
              
              {/* Connection broken */}
              <line x1={-100} y1={0} x2={150} y2={0} stroke={C.white} strokeWidth={20} />
              <g transform="translate(25, 0)">
                <line x1={-30} y1={-50} x2={30} y2={50} stroke={C.dangerRed} strokeWidth={30} strokeLinecap="round" />
                <line x1={-30} y1={50} x2={30} y2={-50} stroke={C.dangerRed} strokeWidth={30} strokeLinecap="round" />
              </g>
            </g>

            <text y={-450} textAnchor="middle" fill={C.safeGreen} fontSize={100} fontWeight={900}>SHIFT TO NEUTRAL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: COAST SAFELY ────────────────────────────────────────────────────
function SceneCoast() {
  const frame = useCurrentFrame();

  const coast = interpolate(frame, [0, 90], [0, 400], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Road edge */}
            <rect x={-100} y={-800} width={1080} height={1600} fill={C.roadGray} />
            <rect x={-540} y={-800} width={440} height={1600} fill="#2B412E" /> {/* Grass/shoulder */}
            
            <line x1={-100} y1={-800} x2={-100} y2={800} stroke={C.white} strokeWidth={20} />

            {/* Car coasting to the side */}
            <g transform={`translate(${100 - coast * 0.5}, ${-400 + coast}) rotate(${-15})`}>
              <rect x={-100} y={-150} width={200} height={300} rx={40} fill={C.carRed} />
              <rect x={-80} y={-80} width={160} height={100} rx={20} fill={C.bgDeep} />
            </g>

            <text y={600} textAnchor="middle" fill={C.safeGreen} fontSize={100} fontWeight={900}>COAST SAFELY</text>
            <text y={700} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>THEN TURN OFF IGNITION</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Accelerator: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('accelerator_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneHighway />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneKillEngine />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneBrakes />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneNeutral />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneCoast />
      </Sequence>
    </AbsoluteFill>
  );
};

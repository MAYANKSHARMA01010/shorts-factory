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

import trainWords from './train_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1082;

const C = {
  bgDeep: '#1A1A1D',
  railDark: '#4E4E50',
  railLight: '#950740',
  dangerRed: '#C3073F',
  carColor: '#6F2232',
  ground: '#000000',
  white: '#FFFFFF',
  personSuit: '#457B9D',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 185,
  scene3: 343,
  scene4: 441,
  scene5: 590,
  scene6: 716,
  scene7: 935,
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

// ─── SCENE 1: ENGINE DIES ON TRACKS ───────────────────────────────────────────
function SceneStuck() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Railroad tracks */}
            <g transform="translate(0, 0)">
              {Array.from({length: 10}).map((_, i) => (
                <rect key={i} x={-400} y={-800 + i * 200} width={800} height={40} fill="#5C4033" />
              ))}
              <rect x={-200} y={-1000} width={40} height={2000} fill={C.railDark} />
              <rect x={160} y={-1000} width={40} height={2000} fill={C.railDark} />
            </g>

            {/* Car stuck */}
            <g transform="translate(0, 0)">
              <rect x={-150} y={-100} width={300} height={200} fill={C.carColor} rx={20} />
              <rect x={-100} y={-70} width={200} height={140} fill={C.bgDeep} rx={10} />
              
              {/* Smoke from engine */}
              <circle cx={-180} cy={0} r={30 + Math.sin(frame*0.2)*10} fill="#6C757D" opacity={0.6} />
              <circle cx={-220} cy={-20} r={40 + Math.cos(frame*0.2)*10} fill="#6C757D" opacity={0.4} />
              <circle cx={-260} cy={20} r={50 + Math.sin(frame*0.3)*10} fill="#6C757D" opacity={0.2} />
            </g>

            <text y={-600} textAnchor="middle" fill={C.dangerRed} fontSize={90} fontWeight={900}>ENGINE DIES</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>ON THE CROSSING</text>

            {/* Distant train light */}
            <circle cx={0} cy={-1000} r={frame * 2} fill="#F4D03F" opacity={Math.sin(frame*0.5)*0.5 + 0.5} />
            
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: TRAIN CAN'T STOP ────────────────────────────────────────────────
function SceneImpactWarning() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Giant Train Front */}
            <g transform={`translate(0, ${-400 + frame*5})`}>
              <rect x={-300} y={-500} width={600} height={500} fill="#212529" rx={40} />
              {/* Grill */}
              {Array.from({length: 5}).map((_, i) => (
                <rect key={i} x={-200 + i*90} y={-100} width={40} height={80} fill="#ADB5BD" />
              ))}
              {/* Headlight */}
              <circle cx={0} cy={-300} r={100} fill="#F4D03F" />
              <circle cx={0} cy={-300} r={80} fill="#FFFFFF" />
            </g>

            <text y={300} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>TRAIN CAN'T STOP</text>
            <text y={400} textAnchor="middle" fill={C.dangerRed} fontSize={70} fontWeight={900}>CAR WILL BE CRUSHED</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: GET OUT IMMEDIATELY ─────────────────────────────────────────────
function SceneGetOut() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Person running away from car */}
            <g transform={`translate(${frame * 10}, ${frame * 5})`}>
              <circle cx={0} cy={0} r={40} fill={C.personSuit} />
              <path d="M 0,0 L -40,40 M 0,0 L -20,60" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-300} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>GET OUT NOW</text>
            <text y={-200} textAnchor="middle" fill={C.dangerRed} fontSize={80} fontWeight={900}>LEAVE EVERYTHING</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: DON'T RUN RIGHT ANGLE ───────────────────────────────────────────
function SceneWrongWay() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Tracks */}
            <rect x={-100} y={-960} width={200} height={1920} fill={C.railDark} />
            
            {/* Wrong path (90 degrees) */}
            <g stroke="#6C757D" strokeWidth={20} strokeDasharray="30, 20" fill="none">
              <path d="M 100,0 L 500,0" />
            </g>
            <line x1={200} y1={-100} x2={400} y2={100} stroke={C.dangerRed} strokeWidth={40} strokeLinecap="round" />
            <line x1={400} y1={-100} x2={200} y2={100} stroke={C.dangerRed} strokeWidth={40} strokeLinecap="round" />

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>DON'T RUN 90° AWAY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: RUN TOWARD TRAIN 45 DEG ─────────────────────────────────────────
function SceneRightWay() {
  const frame = useCurrentFrame();

  const dashOffset = -frame * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Tracks */}
            <rect x={-100} y={-960} width={200} height={1920} fill={C.railDark} />
            
            {/* Train coming from top */}
            <rect x={-120} y={-960} width={240} height={400} fill="#F4D03F" />

            {/* 45 Degree Path */}
            <path d="M 100,0 L 400,-300" fill="none" stroke="#2A9D8F" strokeWidth={30} strokeDasharray="40, 30" strokeDashoffset={dashOffset} strokeLinecap="round" />
            
            <text x={350} y={-350} fill="#2A9D8F" fontSize={80} fontWeight={900}>45°</text>

            <text y={400} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>RUN TOWARD THE TRAIN</text>
            <text y={500} textAnchor="middle" fill="#2A9D8F" fontSize={90} fontWeight={900}>AT A 45° ANGLE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: DEBRIS FLYING ───────────────────────────────────────────────────
function SceneDebris() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Impact at center */}
            <circle cx={0} cy={0} r={100} fill="#FF4500" opacity={0.8} />
            <circle cx={0} cy={0} r={60} fill={C.white} opacity={0.9} />

            {/* Debris flying FORWARD (down) */}
            <g transform="translate(0, 0)">
              {Array.from({length: 20}).map((_, i) => {
                const angle = Math.PI/2 + (Math.random() - 0.5) * Math.PI/2; // pointing down
                const speed = 10 + Math.random() * 10;
                const dist = frame * speed;
                return (
                  <rect 
                    key={i} 
                    x={Math.cos(angle) * dist} 
                    y={Math.sin(angle) * dist} 
                    width={20} 
                    height={20} 
                    fill={C.carColor} 
                    transform={`rotate(${frame * 20})`}
                  />
                );
              })}
            </g>

            {/* Safe Person running UP at 45 deg */}
            <g transform={`translate(${100 + frame*5}, ${-100 - frame*5})`}>
              <circle cx={0} cy={0} r={30} fill={C.personSuit} />
              <text x={50} y={10} fill="#2A9D8F" fontSize={50} fontWeight={900}>SAFE</text>
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>DEBRIS FLIES FORWARD</text>
            <text y={-300} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>AWAY FROM YOU</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 7: TRAIN NEEDS A MILE ──────────────────────────────────────────────
function SceneMile() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={-960} width={1080} height={1920} fill="#212529" />

            {/* Long brake trail */}
            <rect x={-100} y={-800} width={200} height={1600} fill={C.railDark} />
            <path d="M -50,-800 L -50,800 M 50,-800 L 50,800" fill="none" stroke={C.dangerRed} strokeWidth={20} opacity={0.5} />

            <text y={0} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>IT TAKES A TRAIN</text>
            <text y={100} textAnchor="middle" fill={C.dangerRed} fontSize={120} fontWeight={900}>OVER A MILE</text>
            <text y={200} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>TO FULLY STOP</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Train: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('train_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneStuck />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneImpactWarning />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneGetOut />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneWrongWay />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneRightWay />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={S.scene7 - S.scene6}>
        <SceneDebris />
      </Sequence>
      <Sequence from={S.scene7} durationInFrames={DURATION_IN_FRAMES - S.scene7}>
        <SceneMile />
      </Sequence>
    </AbsoluteFill>
  );
};

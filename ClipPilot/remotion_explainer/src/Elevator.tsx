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

import elevatorWords from './elevator_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1039;

const C = {
  bgDeep: '#1F2937',
  skyBlue: '#3B82F6',
  spaceBlack: '#030712',
  metalSilver: '#D1D5DB',
  metalDark: '#4B5563',
  indicatorRed: '#EF4444',
  glassBlue: '#93C5FD',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 220,
  scene3: 388,
  scene4: 515,
  scene5: 683,
  scene6: 805,
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

// ─── SCENE 1: ELEVATOR UP ─────────────────────────────────────────────────────
function SceneLift() {
  const frame = useCurrentFrame();

  const shake = Math.sin(frame * 0.5) * 5;
  const cloudsY = (frame * 10) % 1920;

  return (
    <AbsoluteFill>
      <Bg color={C.skyBlue} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Clouds passing down to simulate going up */}
            <circle cx={-300} cy={-960 + cloudsY} r={150} fill={C.white} opacity={0.6} />
            <circle cx={400} cy={-1500 + cloudsY} r={200} fill={C.white} opacity={0.6} />
            <circle cx={-200} cy={-2000 + cloudsY} r={180} fill={C.white} opacity={0.6} />

            {/* The Elevator Car */}
            <g transform={`translate(0, ${shake})`}>
              <rect x={-200} y={-300} width={400} height={600} fill={C.metalSilver} rx={20} />
              <rect x={-180} y={-280} width={360} height={560} fill={C.bgDeep} rx={10} />
              {/* Doors */}
              <rect x={-180} y={-280} width={178} height={560} fill={C.metalDark} />
              <rect x={2} y={-280} width={178} height={560} fill={C.metalDark} />
              
              {/* Floor indicator */}
              <rect x={-50} y={-350} width={100} height={40} fill={C.bgDeep} />
              <text y={-320} textAnchor="middle" fill={C.indicatorRed} fontSize={30} fontWeight={900}>↑ 999</text>
            </g>

            <text y={450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>ELEVATOR STRAIGHT UP</text>
            <text y={550} textAnchor="middle" fill={C.spaceBlack} fontSize={90} fontWeight={900}>INTO SPACE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: PRESSURE DROPS ──────────────────────────────────────────────────
function ScenePressure() {
  const frame = useCurrentFrame();

  const squeeze = interpolate(frame, [0, 60], [1, 0.8], clamp);
  const redness = interpolateColors(frame, [0, 60], [C.white, C.indicatorRed]);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Person's head */}
            <circle cx={0} cy={0} r={150 * squeeze} fill={C.metalDark} />
            <circle cx={0} cy={0} r={140 * squeeze} fill={redness} />

            {/* Ears screaming/popping */}
            <path d={`M -140,0 Q ${-200 - Math.sin(frame)*20},0 -140,-50`} fill="none" stroke={C.indicatorRed} strokeWidth={10} />
            <path d={`M 140,0 Q ${200 + Math.sin(frame)*20},0 140,-50`} fill="none" stroke={C.indicatorRed} strokeWidth={10} />
            
            <text x={-200} y={0} fontSize={40} opacity={Math.sin(frame*0.5)*0.5 + 0.5}>💥</text>
            <text x={200} y={0} fontSize={40} opacity={Math.cos(frame*0.5)*0.5 + 0.5}>💥</text>

            <text y={-300} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>YOUR EARS START</text>
            <text y={-230} textAnchor="middle" fill={C.indicatorRed} fontSize={70} fontWeight={900}>SCREAMING</text>
            
            <text y={300} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>AS PRESSURE DROPS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: AIR GETS THIN ───────────────────────────────────────────────────
function SceneThinAir() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Lungs struggling */}
            <path d="M -20, -100 L -20, -50 Q -50, -30 -80, 50 Q -80, 150 -40, 150 Q 0, 150 -10, 50 L -10, 0 Z" fill="#6B7280" opacity={0.7} />
            <path d="M 20, -100 L 20, -50 Q 50, -30 80, 50 Q 80, 150 40, 150 Q 0, 150 10, 50 L 10, 0 Z" fill="#6B7280" opacity={0.7} />

            {/* Very sparse oxygen particles */}
            {Array.from({length: 10}).map((_, i) => (
              <circle 
                key={i} 
                cx={(i * 30 - 150)} 
                cy={-200 + ((frame * 2 + i * 50) % 400)} 
                r={5} 
                fill={C.glassBlue} 
                opacity={0.5} 
              />
            ))}

            <text y={-350} textAnchor="middle" fill={C.glassBlue} fontSize={60} fontWeight={900}>AIR GETS SO THIN</text>
            <text y={350} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>YOU CAN'T PULL A</text>
            <text y={420} textAnchor="middle" fill={C.indicatorRed} fontSize={60} fontWeight={900}>FULL BREATH</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: SKY TURNS BLACK ─────────────────────────────────────────────────
function SceneSkyBlack() {
  const frame = useCurrentFrame();

  const skyColor = interpolateColors(frame, [0, 60], [C.skyBlue, C.spaceBlack]);

  return (
    <AbsoluteFill>
      <Bg color={skyColor} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Elevator Window View */}
            <rect x={-300} y={-400} width={600} height={800} fill="none" stroke={C.metalSilver} strokeWidth={40} rx={50} />
            
            {/* Sun in the black sky */}
            <circle cx={100} cy={-150} r={80} fill={C.white} filter="blur(5px)" />
            <circle cx={100} cy={-150} r={60} fill="#FEF08A" />

            <text y={550} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>SKY OUTSIDE</text>
            <text y={650} textAnchor="middle" fill={C.spaceBlack} stroke={C.white} strokeWidth={3} fontSize={100} fontWeight={900}>TURNS BLACK</text>
            <text y={750} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>IN MIDDLE OF THE DAY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: DOORS OPEN / NO EXPLOSION ───────────────────────────────────────
function SceneDoorsOpen() {
  const frame = useCurrentFrame();

  const doorOpen = interpolate(frame, [0, 30], [0, 180], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.spaceBlack} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Stars in background */}
            {Array.from({length: 30}).map((_, i) => (
              <circle key={i} cx={(Math.random()-0.5)*800} cy={(Math.random()-0.5)*800} r={2} fill={C.white} />
            ))}

            {/* Elevator Doors Opening */}
            <rect x={-360} y={-500} width={720} height={1000} fill={C.metalDark} />
            {/* Left Door */}
            <rect x={-360 - doorOpen} y={-500} width={360} height={1000} fill={C.metalSilver} />
            {/* Right Door */}
            <rect x={0 + doorOpen} y={-500} width={360} height={1000} fill={C.metalSilver} />

            {/* Person inside NOT exploding */}
            <g transform="translate(0, 100) scale(1.5)">
              <rect x={-40} y={-50} width={80} height={100} fill="#374151" rx={20} />
              <circle cx={0} cy={-80} r={40} fill="#FCA5A5" />
              {/* Cross out explosion */}
              <line x1={-150} y1={-150} x2={150} y2={50} stroke={C.indicatorRed} strokeWidth={20} />
              <circle cx={0} cy={-50} r={150} fill="none" stroke={C.indicatorRed} strokeWidth={20} />
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>IF DOORS SLID OPEN</text>
            <text y={-500} textAnchor="middle" fill={C.indicatorRed} fontSize={80} fontWeight={900}>YOU WOULDN'T EXPLODE</text>
            <text y={700} textAnchor="middle" fill={C.metalSilver} fontSize={60} fontWeight={900}>LIKE IN THE MOVIES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: BOIL AND PASS OUT ───────────────────────────────────────────────
function SceneBoil() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Tongue */}
            <path d="M -100,50 Q 0,200 100,50 Z" fill="#F43F5E" />
            
            {/* Saliva boiling (bubbles rising) */}
            {Array.from({length: 15}).map((_, i) => (
              <circle 
                key={i} 
                cx={(Math.random()-0.5)*150} 
                cy={100 - ((frame*3 + i*20)%200)} 
                r={5 + Math.random()*10} 
                fill={C.glassBlue} 
                opacity={0.8} 
              />
            ))}

            <text y={-350} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>SALIVA ON YOUR TONGUE</text>
            <text y={-280} textAnchor="middle" fill={C.glassBlue} fontSize={70} fontWeight={900}>WOULD BOIL AWAY</text>
            
            <text y={350} textAnchor="middle" fill={C.metalDark} fontSize={60} fontWeight={900}>QUIETLY PASS OUT</text>
            <text y={430} textAnchor="middle" fill={C.indicatorRed} fontSize={70} fontWeight={900}>IN ABOUT FIFTEEN</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Elevator: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('elevator_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.3} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneLift />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <ScenePressure />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneThinAir />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneSkyBlack />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneDoorsOpen />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneBoil />
      </Sequence>
    </AbsoluteFill>
  );
};

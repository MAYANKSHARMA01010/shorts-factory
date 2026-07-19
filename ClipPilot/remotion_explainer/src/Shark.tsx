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

import sharkWords from './shark_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1066;

const C = {
  bgDeep: '#023E8A',
  oceanBlue: '#0077B6',
  sharkGray: '#6C757D',
  dangerRed: '#D00000',
  personSuit: '#FFBA08',
  white: '#FFFFFF',
  bloodRed: '#9D0208',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 183,
  scene3: 357,
  scene4: 661,
  scene5: 859,
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

// ─── SCENE 1: SHARK CIRCLING ──────────────────────────────────────────────────
function SceneCircle() {
  const frame = useCurrentFrame();

  const circleAngle = (frame * 0.05) % (Math.PI * 2);
  const shadowScale = interpolate(frame, [0, 100], [0.5, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Ocean rays */}
            {Array.from({length: 8}).map((_, i) => (
              <path key={i} d="M -100,-1500 L 100,-1500 L 200,1000 L -200,1000 Z" fill={C.oceanBlue} opacity={0.2} transform={`rotate(${i * 45})`} />
            ))}

            {/* Person swimming */}
            <g transform={`translate(0, 0)`}>
              <circle cx={0} cy={0} r={50} fill={C.personSuit} />
              <line x1={0} y1={50} x2={0} y2={150} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Shark Circling */}
            <g transform={`translate(${Math.cos(circleAngle)*350}, ${Math.sin(circleAngle)*350}) rotate(${(circleAngle * 180 / Math.PI) + 90}) scale(${shadowScale})`}>
              <path d="M 0,-150 L -40,100 L 0,150 L 40,100 Z" fill={C.sharkGray} />
              {/* Fin */}
              <path d="M 0,-50 L 50,-10 L 0,30 Z" fill={C.sharkGray} />
              <path d="M -20,100 L -80,150 L 0,120 Z" fill={C.sharkGray} />
              <path d="M 20,100 L 80,150 L 0,120 Z" fill={C.sharkGray} />
            </g>

            {frame > 60 && (
              <text y={600} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>SHARK CIRCLES</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SPLASHING = PREY ────────────────────────────────────────────────
function SceneSplash() {
  const frame = useCurrentFrame();
  
  const splash = Math.sin(frame * 0.5) * 50;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shark getting closer */}
            <g transform={`translate(0, 300)`}>
              <path d="M 0,-200 L -60,50 L 0,150 L 60,50 Z" fill={C.sharkGray} />
              <path d="M 0,-100 L 80,-40 L 0,20 Z" fill={C.sharkGray} />
            </g>

            {/* Splashing person */}
            <g transform={`translate(0, -300)`}>
              <circle cx={0} cy={-50} r={50} fill={C.personSuit} />
              <line x1={0} y1={0} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* Thrashing arms */}
              <line x1={0} y1={20} x2={-100} y2={20 + splash} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={20} x2={100} y2={20 - splash} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />

              {/* Splash effects */}
              {Array.from({length: 6}).map((_, i) => (
                <circle key={i} cx={(Math.random()-0.5)*300} cy={(Math.random()-0.5)*150} r={Math.random()*20+10} fill={C.white} opacity={0.6} />
              ))}
            </g>

            <g opacity={Math.sin(frame * 0.2) > 0 ? 1 : 0}>
              <text y={-600} textAnchor="middle" fill={C.dangerRed} fontSize={120} fontWeight={900}>DON'T SPLASH</text>
            </g>
            <text y={700} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>MIMICS WOUNDED PREY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: STAY VERTICAL ───────────────────────────────────────────────────
function SceneVertical() {
  const frame = useCurrentFrame();

  const rotatePerson = interpolate(frame, [0, 60], [90, 0], clamp);
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Person rotating to vertical */}
            <g transform={`translate(0, -100) rotate(${rotatePerson})`}>
              <circle cx={0} cy={-100} r={50} fill={C.personSuit} />
              <line x1={0} y1={-50} x2={0} y2={100} stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              <path d="M -30,-20 L -30,60 M 30,-20 L 30,60" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M -20,100 L -20,200 M 20,100 L 20,200" fill="none" stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              
              {/* Eye contact lines */}
              {rotatePerson === 0 && (
                <g stroke={C.white} strokeWidth={5} strokeDasharray="10, 10">
                  <line x1={0} y1={-100} x2={0} y2={400} />
                </g>
              )}
            </g>

            {/* Shark turning */}
            {rotatePerson === 0 && (
              <g transform={`translate(0, 500)`}>
                <path d="M -100,0 C -50,-100 50,-100 100,0 C 50,100 -50,100 -100,0 Z" fill={C.sharkGray} />
                {/* Shark Eye */}
                <circle cx={-50} cy={-20} r={10} fill={C.bgDeep} />
                <circle cx={50} cy={-20} r={10} fill={C.bgDeep} />
              </g>
            )}

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>STAY VERTICAL</text>
            <text y={800} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>EYE CONTACT = PREDATOR</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: PUNCH GILLS ─────────────────────────────────────────────────────
function ScenePunchGills() {
  const frame = useCurrentFrame();

  const punch = spring({ frame: frame - 30, fps: 30, config: { damping: 10 } });
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shark head close up */}
            <g transform="translate(0, 100) scale(1.5)">
              <path d="M -200,200 C -200,-100 200,-100 200,200 Z" fill={C.sharkGray} />
              {/* Eyes */}
              <circle cx={-80} cy={50} r={15} fill={C.bgDeep} />
              <circle cx={80} cy={50} r={15} fill={C.bgDeep} />
              {/* Gills */}
              <path d="M -150,100 Q -180,150 -150,200 M -120,110 Q -150,160 -120,200" fill="none" stroke={C.bgDeep} strokeWidth={8} strokeLinecap="round" />
              <path d="M 150,100 Q 180,150 150,200 M 120,110 Q 150,160 120,200" fill="none" stroke={C.bgDeep} strokeWidth={8} strokeLinecap="round" />
              {/* Nose */}
              <path d="M -50,-50 C 0,-80 50,-50 50,-50" fill="none" stroke={C.bgDeep} strokeWidth={5} />
            </g>

            {/* Arm punching gills */}
            <g transform={`translate(0, ${-200 + punch * 200})`}>
              <line x1={300} y1={-300} x2={200} y2={400} stroke={C.personSuit} strokeWidth={40} strokeLinecap="round" />
              <circle cx={200} cy={400} r={40} fill={C.dangerRed} />
            </g>

            <text y={-400} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>PUNCH GILLS OR EYES</text>

            {/* Pow effect */}
            {punch > 0.5 && punch < 0.9 && (
              <g transform="translate(200, 450) scale(1.5)">
                <path d="M 0,-40 L 20,-10 L 50,-20 L 30,10 L 60,40 L 20,30 L 0,60 L -20,30 L -60,40 L -30,10 L -50,-20 L -20,-10 Z" fill={C.white} />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: NEVER NOSE ──────────────────────────────────────────────────────
function SceneNose() {
  const frame = useCurrentFrame();

  const slowPunch = interpolate(frame, [0, 90], [0, 400], clamp);
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shark mouth wide open */}
            <g transform="translate(0, 300) scale(1.5)">
              <path d="M -150,0 C -150,-150 150,-150 150,0 Z" fill={C.sharkGray} />
              <path d="M -120,0 C -120,-80 120,-80 120,0 Z" fill={C.bgDeep} />
              {/* Teeth */}
              <path d="M -120,0 L -100,-30 L -80,0 L -60,-40 L -40,0 L -20,-50 L 0,0 L 20,-50 L 40,0 L 60,-40 L 80,0 L 100,-30 L 120,0 Z" fill={C.white} />
            </g>

            {/* Arm punching very slowly, cutting on teeth */}
            <g transform={`translate(0, ${-400 + slowPunch})`}>
              <line x1={0} y1={-300} x2={0} y2={100} stroke={C.personSuit} strokeWidth={40} strokeLinecap="round" />
              <circle cx={0} cy={100} r={40} fill={C.personSuit} />
              
              {/* Water resistance ripples */}
              {frame % 20 < 10 && (
                <path d="M -80,50 Q 0,100 80,50" fill="none" stroke={C.white} strokeWidth={10} strokeLinecap="round" />
              )}
            </g>

            {slowPunch > 380 && (
              <g transform="translate(0, 100)">
                <circle cx={-20} cy={0} r={20} fill={C.bloodRed} />
                <circle cx={30} cy={20} r={15} fill={C.bloodRed} />
              </g>
            )}

            <text y={-500} textAnchor="middle" fill={C.dangerRed} fontSize={120} fontWeight={900}>NEVER THE NOSE</text>
            <text y={-400} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>WATER SLOWS YOUR ARM</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Shark: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('shark_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_water_ripples.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneCircle />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneSplash />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneVertical />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <ScenePunchGills />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneNose />
      </Sequence>
    </AbsoluteFill>
  );
};

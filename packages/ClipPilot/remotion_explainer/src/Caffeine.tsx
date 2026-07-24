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

import caffeineWords from './caffeine_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 827;

const C = {
  bgDeep: '#0c0f14',
  bgPanel: '#141a22',
  gold: '#FFD23F',
  brainPink: '#FF758C',
  brainDark: '#C13E5A',
  adenoBlue: '#4FC3E8',
  caffGreen: '#A8FF8E',
  sleepyDark: '#1A1829',
  zapYellow: '#FFE975',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// We will update these exact scene boundaries once we have caffeine_words.json
const S = {
  scene1: 0,
  scene2: 103,
  scene3: 273,
  scene4: 435,
  scene5: 655,
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

// ─── SCENE 1: CAFFEINE INTRO ──────────────────────────────────────────────────
function SceneIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cupY = interpolate(frame, [0, 30], [200, 0], clamp);
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Coffee Cup */}
            <g transform={`translate(0, ${cupY})`}>
              <path d="M -150,-100 L 150,-100 L 100,200 L -100,200 Z" fill={C.bgPanel} stroke={C.gold} strokeWidth={10} />
              <path d="M 150,-50 C 250,-50 250,150 120,150" fill="none" stroke={C.gold} strokeWidth={20} strokeLinecap="round" />
              <path d="M -150,-100 Q 0,-70 150,-100" fill={C.gold} />
            </g>

            {/* Steam / Eye opening */}
            <g>
              <path d="M -50,-150 Q -80,-200 -50,-250 Q -20,-300 -50,-350" fill="none" stroke={C.caffGreen} strokeWidth={8} strokeLinecap="round" opacity={Math.sin(frame*0.1)*0.5+0.5} />
              <path d="M 50,-130 Q 80,-180 50,-230 Q 20,-280 50,-330" fill="none" stroke={C.caffGreen} strokeWidth={8} strokeLinecap="round" opacity={Math.cos(frame*0.1)*0.5+0.5} />
            </g>

            {/* Glowing awake eyes */}
            <g transform="translate(0, -350)">
              <circle cx={-80} cy={0} r={40} fill={C.zapYellow} />
              <circle cx={80} cy={0} r={40} fill={C.zapYellow} />
              <path d="M -120,-30 Q -80,-60 -40,-30 M 40,-30 Q 80,-60 120,-30" fill="none" stroke={C.zapYellow} strokeWidth={10} strokeLinecap="round" />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: ADENOSINE ───────────────────────────────────────────────────────
function SceneAdenosine() {
  const frame = useCurrentFrame();

  const pulse = Math.sin(frame * 0.2) * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Brain */}
            <g transform={`scale(${1 + pulse*0.01})`}>
              <path d="M 0,-150 C 150,-150 250,-50 250,50 C 250,150 150,200 0,200 C -150,200 -250,150 -250,50 C -250,-50 -150,-150 0,-150 Z" fill={C.brainPink} opacity={0.6} />
              {/* Brain wrinkles */}
              <path d="M -150,0 Q -50,50 0,-50 Q 50,-150 150,0 Q 200,50 100,100" fill="none" stroke={C.brainDark} strokeWidth={15} strokeLinecap="round" />
            </g>

            {/* Adenosine producing */}
            {Array.from({length: 8}).map((_, i) => {
              const start = i * 10;
              if (frame < start) return null;
              
              const prog = Math.min(1, (frame - start) / 40);
              const angle = i * 45 * (Math.PI / 180);
              const x = Math.cos(angle) * (50 + prog * 200);
              const y = Math.sin(angle) * (50 + prog * 200);
              
              return (
                <g key={i} transform={`translate(${x}, ${y}) rotate(${frame*2}) scale(${prog})`}>
                  <path d="M -20,0 L 0,-30 L 20,0 L 0,30 Z" fill={C.adenoBlue} />
                  <circle cx={0} cy={0} r={10} fill="#FFF" />
                </g>
              );
            })}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: RECEPTOR BINDING ────────────────────────────────────────────────
function SceneSleepy() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Receptor
  const receptorY = 200;
  
  // Adenosine drops in
  const dropY = interpolate(frame, [10, 40], [-400, receptorY - 30], clamp);
  const zzzS = spring({ frame: frame - 60, fps, config: { damping: 10, mass: 1, stiffness: 100 } });

  return (
    <AbsoluteFill>
      <Bg color={frame > 60 ? C.sleepyDark : C.bgDeep} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Brain bg faint */}
            <path d="M 0,-150 C 150,-150 250,-50 250,50 C 250,150 150,200 0,200 C -150,200 -250,150 -250,50 C -250,-50 -150,-150 0,-150 Z" fill={C.brainPink} opacity={0.2} />

            {/* Receptor surface */}
            <path d="M -400,400 L -100,400 L -80,200 L 80,200 L 100,400 L 400,400 L 400,600 L -400,600 Z" fill={C.brainPink} />
            <path d="M -80,200 L -40,150 L 40,150 L 80,200 Z" fill={C.brainDark} />

            {/* Adenosine falling in */}
            <g transform={`translate(0, ${dropY})`}>
              <path d="M -40,-30 L 0,-80 L 40,-30 L 40,50 L -40,50 Z" fill={C.adenoBlue} />
              <circle cx={0} cy={-10} r={15} fill="#FFF" />
              {/* Radiating sleepy waves */}
              {frame > 40 && (
                <circle cx={0} cy={0} r={20 + (frame%30)*10} fill="none" stroke={C.adenoBlue} strokeWidth={8} opacity={1 - (frame%30)/30} />
              )}
            </g>

            {/* ZZZ */}
            {zzzS > 0 && (
              <g transform={`translate(150, -100) scale(${zzzS})`}>
                <text x={0} y={0} fill="#FFF" fontSize={120} fontWeight={900}>Z</text>
                <text x={60} y={-60} fill="#FFF" fontSize={80} fontWeight={900}>z</text>
                <text x={110} y={-100} fill="#FFF" fontSize={60} fontWeight={900}>z</text>
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CAFFEINE VS ADENOSINE ───────────────────────────────────────────
function SceneStructure() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const swap = frame > 100;
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Split Screen Concept */}
            <line x1={0} y1={-600} x2={0} y2={600} stroke={C.bgPanel} strokeWidth={10} />

            {/* Adenosine Left */}
            <g transform="translate(-250, 0)">
              <text y={-300} textAnchor="middle" fill={C.adenoBlue} fontSize={50} fontWeight={900}>ADENOSINE</text>
              <g transform={`rotate(${Math.sin(frame*0.05)*10})`}>
                <path d="M -80,-60 L 0,-140 L 80,-60 L 80,80 L -80,80 Z" fill={C.adenoBlue} />
                <circle cx={-80} cy={80} r={30} fill="#FFF" />
                <circle cx={80} cy={-60} r={30} fill="#FFF" />
              </g>
            </g>

            {/* Caffeine Right */}
            <g transform="translate(250, 0)">
              <text y={-300} textAnchor="middle" fill={C.caffGreen} fontSize={50} fontWeight={900}>CAFFEINE</text>
              <g transform={`rotate(${Math.cos(frame*0.05)*10})`}>
                <path d="M -80,-60 L 0,-140 L 80,-60 L 80,80 L -80,80 Z" fill={C.caffGreen} />
                <circle cx={80} cy={-60} r={30} fill="#FFF" />
                <circle cx={0} cy={120} r={30} fill="#FFF" /> {/* Slightly different group */}
              </g>
            </g>

            {/* Swoosh to Receptor */}
            {frame > 140 && (
              <g>
                {/* Caffeine swoops in from right */}
                <path d="M 250,0 Q 0,400 -200,600" fill="none" stroke={C.caffGreen} strokeWidth={20} strokeLinecap="round" strokeDasharray="100 100" strokeDashoffset={-frame*15} />
              </g>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: BLOCKING ────────────────────────────────────────────────────────
function SceneBlocking() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Caffeine already in receptor
  const caffBounce = Math.sin(frame * 0.5) * 5;

  // Adenosine tries to bind and bounces away
  const dropY = interpolate(frame, [10, 30], [-400, 50], clamp);
  const bounceY = frame > 30 ? interpolate(frame, [30, 60], [50, -500], clamp) : dropY;
  const bounceRot = frame > 30 ? (frame - 30)*15 : 0;

  // Awake flash
  const awakeFlash = spring({ frame: frame - 60, fps, config: { damping: 15, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg color={awakeFlash > 0.5 ? C.bgDeep : C.sleepyDark} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540, 960) scale(0.9)">
            
            {/* Receptor surface */}
            <path d="M -400,400 L -100,400 L -80,200 L 80,200 L 100,400 L 400,400 L 400,600 L -400,600 Z" fill={C.brainPink} />
            <path d="M -80,200 L -40,150 L 40,150 L 80,200 Z" fill={C.brainDark} />

            {/* Caffeine blocking slot */}
            <g transform={`translate(0, ${150 + caffBounce})`}>
              <path d="M -80,-60 L 0,-140 L 80,-60 L 80,80 L -80,80 Z" fill={C.caffGreen} />
              <rect x={-100} y={-40} width={200} height={40} fill="#FFF" opacity={0.3} />
              <text x={0} y={20} textAnchor="middle" fill="#000" fontSize={50} fontWeight={900}>X</text>
            </g>

            {/* Adenosine falling in and bouncing off */}
            <g transform={`translate(0, ${bounceY}) rotate(${bounceRot})`}>
              <path d="M -40,-30 L 0,-80 L 40,-30 L 40,50 L -40,50 Z" fill={C.adenoBlue} opacity={0.8} />
              {frame > 30 && frame < 40 && (
                <path d="M -50,60 L -80,80 M 50,60 L 80,80" stroke="#FFF" strokeWidth={10} strokeLinecap="round" />
              )}
            </g>

            {/* Awake Burst */}
            {awakeFlash > 0 && (
              <g transform={`scale(${awakeFlash})`}>
                <circle cx={0} cy={-200} r={150} fill={C.zapYellow} opacity={1 - awakeFlash*0.8} />
                <path d="M -40,-250 L 20,-250 L -10,-200 L 50,-200 L -20,-150 L 10,-150 L -50,-100 Z" fill={C.bgDeep} transform="translate(10, 50)" />
              </g>
            )}

            {/* Final Text */}
            <g transform="translate(0, -600)">
              {awakeFlash > 0.8 && (
                <g>
                  <rect x={-200} y={-60} width={400} height={120} rx={40} fill={C.zapYellow} />
                  <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={70} fontWeight={900} fontFamily="Poppins, Arial Black">AWAKE!</text>
                </g>
              )}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Caffeine: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('caffeine_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene5 + 25} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene5 + 50} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneIntro />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneAdenosine />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneSleepy />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneStructure />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneBlocking />
      </Sequence>
    </AbsoluteFill>
  );
};

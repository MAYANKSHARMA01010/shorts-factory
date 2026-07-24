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

import radiumWords from './radium_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 995;

const C = {
  bgDeep: '#0D1321',
  radiumGreen: '#39FF14',
  boneWhite: '#EAE0D5',
  bloodRed: '#9A031E',
  skinTone: '#F3C6A5',
  woodBrown: '#5C4033',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 230,
  scene3: 454,
  scene4: 595,
  scene5: 715,
  scene6: 851,
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

// ─── SCENE 1: PAINTING WATCH DIALS ────────────────────────────────────────────
function ScenePainting() {
  const frame = useCurrentFrame();

  const paintStroke = interpolate(frame, [0, 60], [0, 100], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Table */}
            <rect x={-540} y={100} width={1080} height={860} fill={C.woodBrown} />

            {/* Watch Dial */}
            <circle cx={0} cy={200} r={250} fill="#212529" stroke="#6C757D" strokeWidth={20} />
            <circle cx={0} cy={200} r={10} fill={C.white} />
            <line x1={0} y1={200} x2={0} y2={50} stroke={C.white} strokeWidth={10} strokeLinecap="round" />
            
            {/* Glowing numbers */}
            {Array.from({length: 12}).map((_, i) => (
              <text key={i} x={Math.sin(i * Math.PI/6) * 180} y={200 - Math.cos(i * Math.PI/6) * 180 + 15} textAnchor="middle" fill={C.radiumGreen} fontSize={40} fontWeight={900} opacity={i < (frame/10) ? 1 : 0.2}>
                {i === 0 ? 12 : i}
              </text>
            ))}

            {/* Paint brush licking */}
            <g transform={`translate(0, -300)`}>
              {/* Lips */}
              <path d="M -80,0 Q 0,-40 80,0 Q 0,40 -80,0" fill="#E5989B" />
              <path d="M -80,0 Q 0,20 80,0" fill="none" stroke={C.bgDeep} strokeWidth={5} />
              
              {/* Brush */}
              <g transform={`translate(0, ${Math.sin(frame*0.2)*20}) rotate(30)`}>
                <rect x={-10} y={0} width={20} height={300} fill="#D4A373" />
                <path d="M -10,0 L 0,-40 L 10,0 Z" fill={C.radiumGreen} />
              </g>
            </g>

            <text y={-600} textAnchor="middle" fill={C.radiumGreen} fontSize={90} fontWeight={900}>LICKING THE BRUSH</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TO KEEP A FINE POINT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: GLOWING NAILS & TEETH ───────────────────────────────────────────
function SceneGlowing() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Glowing smile */}
            <g transform="translate(0, -200) scale(1.5)">
              <path d="M -100,0 Q 0,100 100,0 Q 0,140 -100,0" fill="#212529" />
              {/* Teeth */}
              <g fill={C.radiumGreen} opacity={0.9}>
                <rect x={-40} y={10} width={20} height={30} rx={5} />
                <rect x={-15} y={10} width={20} height={30} rx={5} />
                <rect x={10} y={10} width={20} height={30} rx={5} />
                <rect x={-60} y={5} width={15} height={25} rx={5} />
                <rect x={35} y={5} width={15} height={25} rx={5} />
              </g>
            </g>

            {/* Hand with glowing nails */}
            <g transform="translate(0, 400)">
              {/* Fingers */}
              {[-100, -30, 40, 110].map((x, i) => (
                <g key={i} transform={`translate(${x}, ${Math.abs(x)*0.5})`}>
                  <rect x={-20} y={0} width={40} height={200} rx={20} fill={C.skinTone} />
                  <ellipse cx={0} cy={20} rx={15} ry={25} fill={C.radiumGreen} opacity={0.9} />
                </g>
              ))}
            </g>

            <text y={-600} textAnchor="middle" fill={C.radiumGreen} fontSize={80} fontWeight={900}>RADIUM MIRACLE PAINT</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>GLOWING TEETH & NAILS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: BONE EATING ─────────────────────────────────────────────────────
function SceneBones() {
  const frame = useCurrentFrame();
  
  const eat = interpolate(frame, [0, 100], [0, 100], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Bone */}
            <g transform="translate(0, 0)">
              <rect x={-50} y={-300} width={100} height={600} fill={C.boneWhite} />
              <circle cx={-50} cy={-300} r={60} fill={C.boneWhite} />
              <circle cx={50} cy={-300} r={60} fill={C.boneWhite} />
              <circle cx={-50} cy={300} r={60} fill={C.boneWhite} />
              <circle cx={50} cy={300} r={60} fill={C.boneWhite} />
              
              {/* Radium eating holes */}
              {Array.from({length: 20}).map((_, i) => (
                <circle 
                  key={i} 
                  cx={(Math.random()-0.5)*80} 
                  cy={(Math.random()-0.5)*500} 
                  r={Math.random()*15 * (frame/40)} 
                  fill={C.radiumGreen} 
                  opacity={0.8}
                />
              ))}
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>SETTLED IN BONES</text>
            <text y={500} textAnchor="middle" fill={C.radiumGreen} fontSize={80} fontWeight={900}>EATING FROM INSIDE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: JAWS CRUMBLING ──────────────────────────────────────────────────
function SceneJaw() {
  const frame = useCurrentFrame();

  const fall = Math.max(0, frame - 30) * 5;
  const rot = Math.max(0, frame - 30) * 0.2;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Skull upper */}
            <path d="M -150,-200 C -150,-400 150,-400 150,-200 C 150,-100 100,0 50,50 L -50,50 C -100,0 -150,-100 -150,-200 Z" fill={C.boneWhite} />
            <circle cx={-60} cy={-150} r={35} fill={C.bgDeep} />
            <circle cx={60} cy={-150} r={35} fill={C.bgDeep} />
            <path d="M -20,-50 L 20,-50 L 0,-100 Z" fill={C.bgDeep} />
            
            {/* Upper teeth */}
            <g fill={C.boneWhite}>
              {[-30, -10, 10, 30].map((x) => (
                <rect key={x} x={x-8} y={50} width={16} height={30} rx={5} />
              ))}
            </g>

            {/* Lower Jaw crumbling/falling */}
            <g transform={`translate(0, ${50 + fall}) rotate(${rot})`}>
              <path d="M -100,30 C -100,100 100,100 100,30 L 60,80 L -60,80 Z" fill={C.boneWhite} />
              {/* Lower teeth */}
              <g fill={C.boneWhite}>
                {[-30, -10, 10, 30].map((x) => (
                  <rect key={x} x={x-8} y={10} width={16} height={30} rx={5} />
                ))}
              </g>

              {/* Crumbling pieces */}
              {fall > 0 && (
                <g>
                  {Array.from({length: 5}).map((_, i) => (
                    <circle key={i} cx={(Math.random()-0.5)*100} cy={50 + Math.random()*50} r={Math.random()*10} fill={C.boneWhite} />
                  ))}
                  {/* Radium glow in fragments */}
                  {Array.from({length: 5}).map((_, i) => (
                    <circle key={i} cx={(Math.random()-0.5)*100} cy={50 + Math.random()*50} r={Math.random()*10} fill={C.radiumGreen} opacity={0.7} />
                  ))}
                </g>
              )}
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>JAWS CRUMBLED</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: LAWSUIT & DENIAL ────────────────────────────────────────────────
function SceneLawsuit() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Legal Document */}
            <rect x={-250} y={-300} width={500} height={600} fill="#F8F9FA" rx={10} />
            <rect x={-200} y={-200} width={400} height={20} fill="#CED4DA" />
            <rect x={-200} y={-150} width={350} height={20} fill="#CED4DA" />
            <rect x={-200} y={-100} width={380} height={20} fill="#CED4DA" />

            <text y={-250} textAnchor="middle" fill={C.bgDeep} fontSize={40} fontWeight={900}>LAWSUIT</text>

            {/* Giant "DENIED" stamp */}
            {frame > 30 && (
              <g transform={`rotate(-15) scale(${interpolate(frame, [30, 40], [2, 1], clamp)})`}>
                <rect x={-200} y={-80} width={400} height={160} fill="none" stroke={C.bloodRed} strokeWidth={20} rx={10} />
                <text y={30} textAnchor="middle" fill={C.bloodRed} fontSize={100} fontWeight={900}>OTHER CAUSES</text>
              </g>
            )}

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>COMPANY DENIED IT</text>
            <text y={500} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>BLAMED OTHER ILLNESSES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: BONES STILL GLOW ────────────────────────────────────────────────
function SceneGraves() {
  const frame = useCurrentFrame();

  const glowPulse = Math.sin(frame * 0.1) * 0.4 + 0.6;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Cemetery Ground */}
            <rect x={-540} y={0} width={1080} height={960} fill="#0B090A" />
            
            {/* Tombstone */}
            <path d="M -150,0 L 150,0 L 150,-200 A 150 150 0 0 0 -150,-200 Z" fill="#6C757D" />
            <text y={-100} textAnchor="middle" fill={C.bgDeep} fontSize={50} fontWeight={900}>R.I.P.</text>

            {/* Underground Bones */}
            <g transform="translate(0, 300)">
              <rect x={-200} y={-100} width={400} height={200} fill={C.woodBrown} rx={20} />
              
              <g opacity={glowPulse}>
                <circle cx={-100} cy={0} r={40} fill={C.radiumGreen} />
                <circle cx={0} cy={-20} r={30} fill={C.radiumGreen} />
                <circle cx={80} cy={30} r={35} fill={C.radiumGreen} />
                <circle cx={120} cy={-10} r={25} fill={C.radiumGreen} />
              </g>
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>DECADES LATER...</text>
            <text y={700} textAnchor="middle" fill={C.radiumGreen} fontSize={80} fontWeight={900}>BONES STILL GLOW IN GRAVES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Radium: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('radium_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene5 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <ScenePainting />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneGlowing />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneBones />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneJaw />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneLawsuit />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneGraves />
      </Sequence>
    </AbsoluteFill>
  );
};

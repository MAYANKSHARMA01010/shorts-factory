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

import corpseWords from './corpse_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1250;

const C = {
  bgDeep: '#181A18',
  woodShelf: '#5C4033',
  glassJar: '#E0E1DD',
  boneWhite: '#EAE0D5',
  bloodRed: '#9A031E',
  potionGreen: '#A3E4D7',
  goldTrim: '#D4AF37',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 187,
  scene3: 401,
  scene4: 556,
  scene5: 884,
  scene6: 1023,
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

// ─── SCENE 1: PHARMACY SHELVES ────────────────────────────────────────────────
function ScenePharmacy() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shelf */}
            <rect x={-540} y={100} width={1080} height={50} fill={C.woodShelf} />
            <rect x={-540} y={500} width={1080} height={50} fill={C.woodShelf} />

            {/* Normal Jars */}
            <g transform="translate(-300, 100)">
              <rect x={-50} y={-150} width={100} height={150} fill={C.glassJar} opacity={0.3} rx={10} />
              <rect x={-40} y={-100} width={80} height={100} fill={C.potionGreen} rx={5} />
            </g>
            <g transform="translate(300, 100)">
              <rect x={-60} y={-200} width={120} height={200} fill={C.glassJar} opacity={0.3} rx={10} />
              <rect x={-50} y={-150} width={100} height={150} fill="#D4A373" rx={5} />
            </g>

            {/* The Strange Ingredient Jar */}
            <g transform={`translate(0, 500) scale(${interpolate(frame, [0, 60], [1, 2], clamp)})`}>
              <rect x={-80} y={-250} width={160} height={250} fill={C.glassJar} opacity={0.2} rx={20} />
              <rect x={-60} y={-300} width={120} height={50} fill="#B08968" />
              
              {/* Ground up bone powder inside */}
              <path d="M -70,-20 L 70,-20 L 70,-150 Q 0,-180 -70,-130 Z" fill={C.boneWhite} />

              {/* Label */}
              <rect x={-50} y={-120} width={100} height={60} fill="#F8F9FA" />
              <text y={-80} textAnchor="middle" fill="#212529" fontSize={25} fontWeight={900}>CORPSE</text>
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>PHARMACIES OF EUROPE</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>STOCKED A STRANGE INGREDIENT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: LIFE FORCE ──────────────────────────────────────────────────────
function SceneLifeForce() {
  const frame = useCurrentFrame();

  const glow = Math.sin(frame * 0.1) * 20 + 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Outline of a person */}
            <path d="M 0,-200 C -100,-200 -100,-50 0,-50 C 100,-50 100,-200 0,-200 Z" fill="none" stroke={C.white} strokeWidth={5} />
            <path d="M -50,-50 L -100,100 L -150,50 M 50,-50 L 100,100 L 150,50 M -50,50 L -50,300 M 50,50 L 50,300" fill="none" stroke={C.white} strokeWidth={5} />
            <rect x={-50} y={-50} width={100} height={200} fill="none" stroke={C.white} strokeWidth={5} />

            {/* Glowing life force */}
            <circle cx={0} cy={50} r={50} fill={C.potionGreen} filter={`blur(${glow}px)`} />
            <circle cx={0} cy={50} r={30} fill={C.white} />

            {/* Arrows pointing to a sick person */}
            <path d="M 100,50 Q 200,0 300,50" fill="none" stroke={C.potionGreen} strokeWidth={10} markerEnd="url(#arrow)" strokeDasharray="20, 10" transform={`translate(${frame}, 0)`} />

            <text y={-350} textAnchor="middle" fill={C.potionGreen} fontSize={50} fontWeight={900}>HELD A PERSON'S LIFE FORCE</text>
            <text y={450} textAnchor="middle" fill={C.white} fontSize={40} fontWeight={900}>COULD CURE AILMENTS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: KINGS SKULL TINCTURE ────────────────────────────────────────────
function SceneKings() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* King with crown */}
            <circle cx={0} cy={-200} r={100} fill="#FAD7A1" />
            <path d="M -80,-300 L -100,-400 L -40,-350 L 0,-420 L 40,-350 L 100,-400 L 80,-300 Z" fill={C.goldTrim} />

            {/* Goblet */}
            <g transform={`translate(0, 100) rotate(${Math.sin(frame*0.1)*10})`}>
              <path d="M -50,-50 L 50,-50 L 0,50 Z" fill={C.goldTrim} />
              <rect x={-10} y={50} width={20} height={100} fill={C.goldTrim} />
              <rect x={-50} y={150} width={100} height={20} fill={C.goldTrim} />
              
              {/* Liquid inside */}
              <path d="M -40,-30 L 40,-30 L 0,40 Z" fill={C.bloodRed} />
            </g>

            {/* Skull dissolving into goblet */}
            <g transform={`translate(150, -50)`}>
              <path d="M -40,-40 C -40,-80 40,-80 40,-40 C 40,-20 20,0 0,0 C -20,0 -40,-20 -40,-40 Z" fill={C.boneWhite} />
              <circle cx={-15} cy={-40} r={10} fill="#212529" />
              <circle cx={15} cy={-40} r={10} fill="#212529" />
              
              {/* Drips */}
              {Array.from({length: 3}).map((_, i) => (
                <circle key={i} cx={(i-1)*10} cy={10 + ((frame*2 + i*20) % 50)} r={3} fill={C.boneWhite} />
              ))}
            </g>

            <text y={-500} textAnchor="middle" fill={C.goldTrim} fontSize={90} fontWeight={900}>KINGS DRANK TINCTURES</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>DISTILLED FROM HUMAN SKULLS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: MUMMY WINE & BLOOD ──────────────────────────────────────────────
function SceneMummyBlood() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Split Screen Concept */}
            <line x1={-540} y1={0} x2={540} y2={0} stroke={C.white} strokeWidth={10} />

            {/* Top: Powdered Mummy in Wine */}
            <g transform="translate(0, -300)">
              <text y={-150} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>POWDERED MUMMY</text>
              <text y={-80} textAnchor="middle" fill={C.woodShelf} fontSize={50} fontWeight={900}>STIRRED INTO WINE</text>
              
              {/* Wine glass */}
              <path d="M -80,0 L 80,0 C 80,100 -80,100 -80,0 Z" fill={C.bloodRed} opacity={0.8} />
              {/* Mummy powder sprinkling */}
              {Array.from({length: 20}).map((_, i) => (
                <circle key={i} cx={(Math.random()-0.5)*100} cy={-50 + ((frame*5 + i*10)%100)} r={3} fill="#8A5A44" />
              ))}
            </g>

            {/* Bottom: Fresh blood at scaffold */}
            <g transform="translate(0, 300)">
              <text y={150} textAnchor="middle" fill={C.bloodRed} fontSize={60} fontWeight={900}>FRESH BLOOD</text>
              <text y={220} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>FROM EXECUTED CRIMINALS</text>

              {/* Scaffold drops */}
              <rect x={-200} y={-150} width={400} height={20} fill={C.woodShelf} />
              
              {/* Blood drips falling into cup */}
              <rect x={-30} y={-20} width={60} height={80} fill="#6C757D" rx={5} />
              {Array.from({length: 5}).map((_, i) => (
                <circle key={i} cx={0} cy={-100 + ((frame*10 + i*30)%80)} r={8} fill={C.bloodRed} />
              ))}
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: HEALER PRESCRIBES DEAD ──────────────────────────────────────────
function SceneHealer() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Healer Character */}
            <circle cx={0} cy={-200} r={100} fill="#FAD7A1" />
            {/* Doctor hat/robe */}
            <path d="M -150,-250 L 150,-250 L 100,-400 L -100,-400 Z" fill="#212529" />
            <path d="M -150,-100 L 150,-100 L 200,400 L -200,400 Z" fill="#212529" />

            {/* Hands pointing at two things */}
            <g transform="translate(-200, 100)">
              {/* Grave robbing - crossed out */}
              <rect x={-80} y={-80} width={160} height={160} fill={C.woodShelf} rx={20} />
              <text y={20} textAnchor="middle" fill={C.white} fontSize={80}>🪦</text>
              <line x1={-100} y1={-100} x2={100} y2={100} stroke={C.bloodRed} strokeWidth={20} />
            </g>

            <g transform="translate(200, 100)">
              {/* Prescribing dead - checkmark */}
              <rect x={-80} y={-80} width={160} height={160} fill={C.glassJar} rx={20} />
              <text y={20} textAnchor="middle" fill={C.white} fontSize={80}>💀</text>
              <path d="M -50,0 L -20,30 L 50,-40" fill="none" stroke={C.potionGreen} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>EVEN A HEALER WHO</text>
            <text y={-400} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>CONDEMNED GRAVE ROBBING</text>
            <text y={450} textAnchor="middle" fill={C.potionGreen} fontSize={80} fontWeight={900}>HAPPILY PRESCRIBED</text>
            <text y={550} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>THE DEAD</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: BUILT ON CANNIBALISM ────────────────────────────────────────────
function SceneCannibalism() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Pillar of Medicine */}
            <rect x={-150} y={-200} width={300} height={600} fill={C.glassJar} />
            <path d="M -200,-200 L 200,-200 L 150,-300 L -150,-300 Z" fill={C.glassJar} />
            
            <text y={0} textAnchor="middle" fill="#212529" fontSize={80} fontWeight={900} transform="rotate(-90)">MEDICINE</text>

            {/* Foundation made of skulls/bones */}
            <rect x={-300} y={400} width={600} height={200} fill={C.bloodRed} />
            <g transform="translate(0, 500)">
              {Array.from({length: 10}).map((_, i) => (
                <text key={i} x={(i-4.5)*50} y={20} fontSize={40} textAnchor="middle">💀</text>
              ))}
            </g>

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>EUROPE'S MOST RESPECTABLE</text>
            <text y={-350} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>MEDICINE</text>
            <text y={750} textAnchor="middle" fill={C.bloodRed} fontSize={90} fontWeight={900}>BUILT ON CANNIBALISM</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Corpse: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('corpse_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <ScenePharmacy />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneLifeForce />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneKings />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneMummyBlood />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneHealer />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneCannibalism />
      </Sequence>
    </AbsoluteFill>
  );
};

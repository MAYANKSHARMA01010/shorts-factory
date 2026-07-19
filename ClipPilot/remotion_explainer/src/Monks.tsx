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

import monksWords from './monks_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1057;

const C = {
  bgDeep: '#1C1917',
  robeOrange: '#C2410C',
  skinTone: '#D4A373',
  stoneGray: '#57534E',
  boneWhite: '#EAE0D5',
  teaGreen: '#65A30D',
  woodBrown: '#78350F',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 239,
  scene3: 391,
  scene4: 568,
  scene5: 723,
  scene6: 983,
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

// ─── SCENE 1: LIVING STATUES ──────────────────────────────────────────────────
function SceneStatue() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Meditating monk */}
            <g transform="translate(0, 100)">
              {/* Robes */}
              <path d="M -200,300 C -200,100 -100,0 0,0 C 100,0 200,100 200,300 Z" fill={C.robeOrange} />
              {/* Head */}
              <circle cx={0} cy={-50} r={60} fill={C.skinTone} />
              {/* Closed eyes */}
              <path d="M -40,-50 Q -20,-40 -10,-50" fill="none" stroke="#A67C52" strokeWidth={5} />
              <path d="M 10,-50 Q 20,-40 40,-50" fill="none" stroke="#A67C52" strokeWidth={5} />
              {/* Prayer beads */}
              <circle cx={0} cy={100} r={40} fill="none" stroke="#4A3018" strokeWidth={10} strokeDasharray="10, 5" />
            </g>

            {/* Glowing aura of devotion */}
            <circle cx={0} cy={100} r={400} fill="none" stroke="#FBBF24" strokeWidth={2} opacity={0.5} transform={`rotate(${frame})`} strokeDasharray="20, 20" />
            <circle cx={0} cy={100} r={450} fill="none" stroke="#FBBF24" strokeWidth={1} opacity={0.3} transform={`rotate(${-frame*0.5})`} strokeDasharray="50, 50" />

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>LIVING STATUES</text>
            <text y={-350} textAnchor="middle" fill="#FBBF24" fontSize={60} fontWeight={900}>OF DEVOTION</text>

            <text y={650} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>STARVING THEMSELVES</text>
            <text y={750} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>FOR 1000 DAYS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: NUTS AND SEEDS ──────────────────────────────────────────────────
function SceneNuts() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Wooden bowl */}
            <path d="M -200,0 C -200,150 200,150 200,0 Z" fill={C.woodBrown} />

            {/* Nuts and seeds falling in */}
            {Array.from({length: 20}).map((_, i) => (
              <circle 
                key={i} 
                cx={(Math.random()-0.5)*200} 
                cy={(frame*10 + i*50) % 400 - 300} 
                r={10 + Math.random()*10} 
                fill="#D4A373" 
              />
            ))}

            {/* Silhouette of fat being stripped away */}
            <g transform="translate(0, 400) scale(1.5)">
              <path d="M -100,0 Q 0,-200 100,0 Z" fill={C.skinTone} />
              <path d="M -100,0 Q 0,-200 100,0 Z" fill="none" stroke={C.bgDeep} strokeWidth={interpolate(frame, [0, 60], [0, 100], clamp)} />
              <path d="M -50,0 Q 0,-100 50,0 Z" fill={C.boneWhite} />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>ONLY NUTS & SEEDS</text>
            <text y={700} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>TO STRIP AWAY EVERY OUNCE</text>
            <text y={800} textAnchor="middle" fill={C.skinTone} fontSize={90} fontWeight={900}>OF FAT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: POISONOUS TEA ───────────────────────────────────────────────────
function SceneTea() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Roots and bark */}
            <g stroke={C.woodBrown} strokeWidth={20} strokeLinecap="round">
              <path d="M -300,-100 Q -200,0 -300,100" />
              <path d="M 300,-150 Q 200,-50 250,50" />
            </g>

            {/* Tea cup */}
            <g transform="translate(0, 100)">
              <path d="M -100,0 C -100,100 100,100 100,0 Z" fill="#EAE0D5" />
              <ellipse cx={0} cy={0} rx={100} ry={20} fill={C.teaGreen} />
              
              {/* Poison fumes */}
              <path d={`M -30,0 Q -50,-50 -20,-100 T -40,-200`} fill="none" stroke={C.teaGreen} strokeWidth={10} opacity={0.6} transform={`translate(0, ${-frame % 50})`} />
              <path d={`M 30,0 Q 50,-50 20,-100 T 40,-200`} fill="none" stroke={C.teaGreen} strokeWidth={10} opacity={0.6} transform={`translate(0, ${-(frame+25) % 50})`} />
              
              {/* Skull warning on cup */}
              <text y={60} textAnchor="middle" fontSize={40}>☠️</text>
            </g>

            <text y={-450} textAnchor="middle" fill={C.woodBrown} fontSize={80} fontWeight={900}>BARK AND ROOTS</text>
            <text y={-350} textAnchor="middle" fill={C.teaGreen} fontSize={90} fontWeight={900}>POISONOUS TEA</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>VOMIT OUT THEIR FLUIDS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: INSECTS WON'T EAT ───────────────────────────────────────────────
function SceneInsects() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Emaciated arm */}
            <path d="M -400,0 L 200,0 C 250,0 250,-50 200,-50 L -400,-50 Z" fill={C.skinTone} />
            {/* Veins glowing green from tea */}
            <path d="M -300,-25 Q -100,-40 100,-25" fill="none" stroke={C.teaGreen} strokeWidth={5} />
            <path d="M -200,-15 Q -50,0 50,-15" fill="none" stroke={C.teaGreen} strokeWidth={3} />

            {/* Bugs flying away from it */}
            {Array.from({length: 10}).map((_, i) => (
              <g key={i} transform={`translate(${i*80 - 300}, ${-200 + Math.sin(frame*0.5 + i)*50})`}>
                <circle cx={0} cy={0} r={5} fill={C.white} />
                {/* Wings flapping fast */}
                <path d="M 0,0 L -10,-10 M 0,0 L 10,-10" stroke={C.white} strokeWidth={2} transform={`scale(1, ${Math.sin(frame*2)})`} />
              </g>
            ))}

            <text y={-400} textAnchor="middle" fill={C.teaGreen} fontSize={80} fontWeight={900}>SEEPED INTO THEIR FLESH</text>
            <text y={300} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>SO INSECTS WOULDN'T EAT</text>
            <text y={400} textAnchor="middle" fill={C.skinTone} fontSize={90} fontWeight={900}>THE BODY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: STONE TOMB & BELL ───────────────────────────────────────────────
function SceneTomb() {
  const frame = useCurrentFrame();

  const bellRing = Math.sin(frame) * 20;

  return (
    <AbsoluteFill>
      <Bg color="#0A0A0A" />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Ground above */}
            <rect x={-540} y={-400} width={1080} height={100} fill={C.stoneGray} />
            
            {/* Bamboo breathing tube */}
            <rect x={-20} y={-450} width={40} height={500} fill="#B5C99A" />

            {/* Stone tomb */}
            <rect x={-250} y={100} width={500} height={600} fill={C.stoneGray} rx={20} />
            <rect x={-200} y={150} width={400} height={500} fill={C.bgDeep} rx={10} />

            {/* Monk silhouette sitting inside */}
            <path d="M -100,650 C -100,500 100,500 100,650 Z" fill={C.robeOrange} opacity={0.5} />
            <circle cx={0} cy={450} r={40} fill={C.skinTone} opacity={0.5} />

            {/* String up to ground with a bell */}
            <line x1={-150} y1={-300} x2={-150} y2={400} stroke={C.white} strokeWidth={2} />
            
            {/* Bell ringing */}
            <g transform={`translate(-150, -300) rotate(${frame < 200 ? bellRing : 0})`}>
              <path d="M -30,40 C -30,0 30,0 30,40 Z" fill="#FBBF24" />
              <circle cx={0} cy={45} r={5} fill="#FBBF24" />
            </g>

            <text y={-600} textAnchor="middle" fill={C.stoneGray} fontSize={90} fontWeight={900}>SEALED ALIVE</text>
            <text y={-500} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>WITH A BREATHING TUBE</text>
            
            <text y={850} textAnchor="middle" fill="#FBBF24" fontSize={70} fontWeight={900}>RANG A BELL EACH DAY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PERFECTLY PRESERVED ─────────────────────────────────────────────
function ScenePreserved() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Shrine/Temple setting */}
            <rect x={-400} y={400} width={800} height={50} fill="#78350F" />
            <rect x={-300} y={350} width={600} height={50} fill="#78350F" />
            <rect x={-200} y={300} width={400} height={50} fill="#78350F" />

            {/* Mummified Monk sitting on pedestal */}
            <g transform="translate(0, 300)">
              <path d="M -150,0 C -150,-200 150,-200 150,0 Z" fill={C.robeOrange} />
              {/* Emaciated skull face */}
              <circle cx={0} cy={-250} r={50} fill="#A67C52" />
              <circle cx={-20} cy={-260} r={10} fill={C.bgDeep} />
              <circle cx={20} cy={-260} r={10} fill={C.bgDeep} />
              <path d="M -10,-220 L 10,-220" stroke={C.bgDeep} strokeWidth={5} />
            </g>

            {/* Sparkles of divinity/preservation */}
            {Array.from({length: 15}).map((_, i) => (
              <circle 
                key={i} 
                cx={(Math.random()-0.5)*400} 
                cy={Math.random()*600 - 300} 
                r={3 + Math.random()*5} 
                fill="#FBBF24" 
                opacity={Math.sin(frame*0.1 + i) * 0.5 + 0.5} 
              />
            ))}

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>LATER FOUND</text>
            <text y={-350} textAnchor="middle" fill="#FBBF24" fontSize={100} fontWeight={900}>PERFECTLY PRESERVED</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Monks: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('monks_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_splash_big.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={200}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.3} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneStatue />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneNuts />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneTea />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneInsects />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneTomb />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePreserved />
      </Sequence>
    </AbsoluteFill>
  );
};

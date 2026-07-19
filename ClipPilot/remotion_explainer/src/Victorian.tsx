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

import victorianWords from './victorian_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1015;

const C = {
  bgDeep: '#111010',
  sepiaLight: '#D4B483',
  sepiaMid: '#8A5A44',
  sepiaDark: '#4A3B32',
  bloodRed: '#780000',
  deathPale: '#F5F5F5',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 191,
  scene3: 278,
  scene4: 452,
  scene5: 596,
  scene6: 717,
  scene7: 912,
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
        filter: 'sepia(0.8) contrast(1.2)', // Old photo effect
      }}
    >
      {children}
    </div>
  );
}

const Bg = ({ color = C.sepiaDark }) => (
  <AbsoluteFill style={{ backgroundColor: color }} />
);

// ─── SCENE 1: OLD CAMERA FLASH ────────────────────────────────────────────────
function SceneCamera() {
  const frame = useCurrentFrame();

  const flash = frame > 120 && frame < 125 ? 1 : 0;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Old Victorian Camera */}
            <rect x={-200} y={-300} width={400} height={300} fill={C.sepiaMid} rx={10} />
            <rect x={-150} y={-300} width={300} height={300} fill={C.sepiaDark} />
            
            <circle cx={0} cy={-150} r={100} fill="#212529" stroke={C.sepiaLight} strokeWidth={20} />
            <circle cx={0} cy={-150} r={60} fill="#0D1321" />
            <circle cx={-20} cy={-170} r={15} fill={C.white} opacity={0.6} />

            {/* Tripod legs */}
            <line x1={0} y1={0} x2={0} y2={600} stroke={C.sepiaLight} strokeWidth={30} strokeLinecap="round" />
            <line x1={-100} y1={0} x2={-300} y2={600} stroke={C.sepiaLight} strokeWidth={30} strokeLinecap="round" />
            <line x1={100} y1={0} x2={300} y2={600} stroke={C.sepiaLight} strokeWidth={30} strokeLinecap="round" />

            {/* Flash Powder Explosion */}
            {flash > 0 && (
              <circle cx={250} cy={-400} r={600} fill={C.white} />
            )}

            <text y={-600} textAnchor="middle" fill={C.sepiaLight} fontSize={90} fontWeight={900}>VICTORIAN TIMES</text>
            <text y={600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>ONE FINAL PORTRAIT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: NOT IN A COFFIN ─────────────────────────────────────────────────
function SceneNoCoffin() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Coffin */}
            <path d="M -200,-400 L 200,-400 L 300,-100 L 150,400 L -150,400 L -300,-100 Z" fill={C.sepiaMid} stroke={C.sepiaLight} strokeWidth={20} />
            
            {/* Person in coffin */}
            <circle cx={0} cy={-250} r={60} fill={C.deathPale} />
            <path d="M -60,-180 L 60,-180 L 100,0 L -100,0 Z" fill="#212529" />

            {/* Red Cross Out */}
            <g transform="scale(1.5)">
              <line x1={-250} y1={-350} x2={250} y2={350} stroke={C.bloodRed} strokeWidth={50} />
              <line x1={250} y1={-350} x2={-250} y2={350} stroke={C.bloodRed} strokeWidth={50} />
            </g>

            <text y={600} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>NOT IN A COFFIN</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: POSED IN CHAIRS ─────────────────────────────────────────────────
function ScenePosed() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Fancy Victorian Chair */}
            <rect x={-150} y={-100} width={300} height={400} fill={C.sepiaMid} rx={20} />
            <rect x={-200} y={-300} width={400} height={300} fill={C.sepiaMid} rx={100} />
            <rect x={-180} y={-280} width={360} height={260} fill="#B08968" rx={80} />

            {/* Corpse propped up */}
            <g transform="translate(0, 50)">
              <rect x={-100} y={-250} width={200} height={300} fill="#212529" rx={20} />
              
              {/* Head slumped slightly, then propped up */}
              <g transform={`rotate(${Math.max(0, 15 - frame)})`}>
                <circle cx={0} cy={-320} r={60} fill={C.deathPale} />
                <path d="M -20,-340 L 20,-340" fill="none" stroke={C.sepiaDark} strokeWidth={5} />
                <path d="M -15,-300 L 15,-300" fill="none" stroke={C.sepiaDark} strokeWidth={5} />
              </g>

              {/* Wooden prop hidden behind */}
              <line x1={0} y1={0} x2={0} y2={-300} stroke={C.sepiaDark} strokeWidth={15} strokeDasharray="10, 10" />
            </g>

            <text y={-500} textAnchor="middle" fill={C.sepiaLight} fontSize={80} fontWeight={900}>POSED IN CHAIRS</text>
            <text y={600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>PROPPED TO LOOK ALIVE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: EYES PAINTED ────────────────────────────────────────────────────
function SceneEyesPainted() {
  const frame = useCurrentFrame();

  const paint = interpolate(frame, [20, 60], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(3.0)`}>
            
            {/* Close up of face */}
            <circle cx={0} cy={0} r={150} fill={C.deathPale} />
            <path d="M -30,60 L 30,60" fill="none" stroke={C.sepiaDark} strokeWidth={5} />

            {/* Closed eyes */}
            <path d="M -70,-30 Q -50,-10 -30,-30" fill="none" stroke={C.sepiaDark} strokeWidth={5} />
            <path d="M 30,-30 Q 50,-10 70,-30" fill="none" stroke={C.sepiaDark} strokeWidth={5} />

            {/* Painted eyes over closed eyelids */}
            <g opacity={paint}>
              <circle cx={-50} cy={-20} r={10} fill="#212529" />
              <circle cx={50} cy={-20} r={10} fill="#212529" />
            </g>

            {/* Rosy cheeks added */}
            <g opacity={paint * 0.5}>
              <circle cx={-80} cy={20} r={25} fill={C.bloodRed} filter="blur(5px)" />
              <circle cx={80} cy={20} r={25} fill={C.bloodRed} filter="blur(5px)" />
            </g>

            <text y={-180} textAnchor="middle" fill={C.white} fontSize={25} fontWeight={900}>EYES PAINTED OPEN</text>
            <text y={180} textAnchor="middle" fill={C.white} fontSize={20} fontWeight={900}>ROSY CHEEKS ADDED</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: MOTHER CRADLING CHILD ───────────────────────────────────────────
function SceneMother() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Mother holding child */}
            <circle cx={0} cy={-200} r={80} fill={C.sepiaLight} /> {/* Mother face */}
            <path d="M -150,-100 L 150,-100 L 200,400 L -200,400 Z" fill="#212529" /> {/* Dress */}

            {/* Dead Child */}
            <g transform="translate(0, 100)">
              <rect x={-100} y={-50} width={200} height={100} fill={C.white} rx={20} />
              <circle cx={0} cy={-50} r={50} fill={C.deathPale} />
              {/* Closed eyes */}
              <path d="M -20,-50 L -10,-50 M 10,-50 L 20,-50" stroke={C.sepiaDark} strokeWidth={4} />
            </g>

            {/* Mother's arms wrapped */}
            <path d="M -100,-100 Q -150,100 0,150" fill="none" stroke="#212529" strokeWidth={40} strokeLinecap="round" />
            <path d="M 100,-100 Q 150,100 0,150" fill="none" stroke="#212529" strokeWidth={40} strokeLinecap="round" />

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>AS IF MERELY SLEEPING</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: BLURRED LIVING ──────────────────────────────────────────────────
function SceneBlurredLiving() {
  const frame = useCurrentFrame();

  const blurAmount = Math.sin(frame * 0.5) * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Family Photo */}
            <rect x={-400} y={-400} width={800} height={800} fill={C.sepiaLight} rx={20} />
            
            {/* The Dead person (sharp) */}
            <g transform="translate(0, 100)">
              <circle cx={0} cy={-200} r={60} fill={C.deathPale} />
              <rect x={-80} y={-120} width={160} height={300} fill="#212529" rx={20} />
            </g>

            {/* The Living person (blurry) */}
            <g transform={`translate(-200, 100) rotate(${blurAmount})`}>
              <circle cx={0} cy={-200} r={60} fill={C.sepiaMid} />
              <rect x={-80} y={-120} width={160} height={300} fill="#212529" rx={20} />
            </g>

            <g transform={`translate(200, 100) rotate(${-blurAmount})`}>
              <circle cx={0} cy={-200} r={60} fill={C.sepiaMid} />
              <rect x={-80} y={-120} width={160} height={300} fill="#212529" rx={20} />
            </g>

            <text y={600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>LIVING RELATIVES BLURRED</text>
            <text y={700} textAnchor="middle" fill={C.deathPale} fontSize={70} fontWeight={900}>CORPSE STAYED PERFECTLY STILL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 7: HOW YOU CAN TELL ────────────────────────────────────────────────
function SceneHowToTell() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <circle cx={0} cy={-100} r={400} fill="none" stroke={C.bloodRed} strokeWidth={30} />
            <circle cx={0} cy={-100} r={350} fill="none" stroke={C.white} strokeWidth={10} strokeDasharray="30, 20" />

            <g transform="translate(0, 100)">
              <circle cx={0} cy={-200} r={100} fill={C.deathPale} />
              <rect x={-100} y={-80} width={200} height={200} fill="#212529" />
              <text y={-180} textAnchor="middle" fill={C.sepiaDark} fontSize={40} fontWeight={900}>SHARP</text>
            </g>

            <text y={450} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>THAT STILLNESS</text>
            <text y={550} textAnchor="middle" fill={C.sepiaLight} fontSize={70} fontWeight={900}>IS HOW YOU CAN TELL</text>
            <text y={650} textAnchor="middle" fill={C.bloodRed} fontSize={100} fontWeight={900}>WHO HAD ALREADY DIED</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Victorian: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('victorian_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneCamera />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneNoCoffin />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <ScenePosed />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneEyesPainted />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneMother />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={S.scene7 - S.scene6}>
        <SceneBlurredLiving />
      </Sequence>
      <Sequence from={S.scene7} durationInFrames={DURATION_IN_FRAMES - S.scene7}>
        <SceneHowToTell />
      </Sequence>
    </AbsoluteFill>
  );
};

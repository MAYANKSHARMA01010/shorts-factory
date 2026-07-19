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

import fireWords from './fire_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1046;

const C = {
  bgDeep: '#180B09',
  smokeGray: '#3E403F',
  smokeDark: '#1E1E1E',
  fireOrange: '#F48C06',
  fireRed: '#D00000',
  personSuit: '#457B9D',
  woodBrown: '#5C4033',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 130,
  scene3: 308,
  scene4: 534,
  scene5: 633,
  scene6: 788,
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

// ─── SCENE 1: WAKE TO SMOKE ───────────────────────────────────────────────────
function SceneWake() {
  const frame = useCurrentFrame();

  const wakeUp = interpolate(frame, [0, 60], [0, 1], clamp);
  const smokeDensity = interpolate(frame, [30, 100], [0, 0.9], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Person in bed */}
            <g transform={`translate(0, 400)`}>
              <rect x={-300} y={0} width={600} height={200} fill="#E5E5E5" rx={20} />
              
              <g transform={`rotate(${wakeUp * -20}) translate(0, ${wakeUp * -100})`}>
                <circle cx={-150} cy={-50} r={60} fill={C.personSuit} />
                <line x1={-150} y1={10} x2={-50} y2={100} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              </g>

              {/* Eyes opening */}
              {wakeUp > 0.5 && (
                <g transform={`rotate(${wakeUp * -20}) translate(0, ${wakeUp * -100})`}>
                  <circle cx={-170} cy={-60} r={10} fill={C.bgDeep} />
                  <circle cx={-130} cy={-60} r={10} fill={C.bgDeep} />
                </g>
              )}
            </g>

            {/* Thick smoke filling room */}
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.smokeGray} opacity={smokeDensity} />

            {frame > 60 && (
              <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>SMOKE SO THICK</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DON'T STAND UP ──────────────────────────────────────────────────
function SceneNoStand() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Room cross section */}
            <rect x={-540} y={-400} width={1080} height={400} fill={C.smokeDark} />
            <rect x={-540} y={-800} width={1080} height={400} fill={C.fireRed} opacity={0.6} />

            <g transform="translate(0, 0)">
              {Array.from({length: 10}).map((_, i) => (
                <circle key={i} cx={(Math.random()-0.5)*1000} cy={-600 + Math.random()*200} r={Math.random()*50} fill={C.fireOrange} opacity={0.8} />
              ))}
            </g>

            <text y={-600} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>TOXIC GAS FURNACE</text>

            {/* Person standing */}
            <g transform={`translate(0, 300)`}>
              <circle cx={0} cy={-400} r={50} fill={C.personSuit} />
              <line x1={0} y1={-350} x2={0} y2={-100} stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              <path d="M -40,-300 L -60,-150 M 40,-300 L 60,-150" fill="none" stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              <path d="M -20,-100 L -40,100 M 20,-100 L 40,100" fill="none" stroke={C.personSuit} strokeWidth={25} strokeLinecap="round" />
              
              <g opacity={Math.sin(frame * 0.5) > 0 ? 1 : 0}>
                <line x1={-150} y1={-450} x2={150} y2={-150} stroke={C.white} strokeWidth={40} strokeLinecap="round" />
                <line x1={150} y1={-450} x2={-150} y2={-150} stroke={C.white} strokeWidth={40} strokeLinecap="round" />
              </g>
            </g>

            <text y={600} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>DON'T STAND UP</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: DROP AND CRAWL ──────────────────────────────────────────────────
function SceneCrawl() {
  const frame = useCurrentFrame();

  const crawl = frame * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={-800} width={1080} height={1000} fill={C.smokeDark} />
            <rect x={-540} y={200} width={1080} height={200} fill="#8D99AE" opacity={0.3} />

            <g transform={`translate(${-400 + (crawl % 800)}, 250)`}>
              <circle cx={150} cy={-50} r={40} fill={C.personSuit} />
              <line x1={0} y1={-50} x2={150} y2={-50} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              
              {/* Crawling limbs */}
              <line x1={100} y1={-50} x2={120 + Math.sin(frame*0.5)*40} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={100} y1={-50} x2={120 + Math.sin(frame*0.5 + Math.PI)*40} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              <line x1={0} y1={-50} x2={-20 + Math.sin(frame*0.5)*40} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <line x1={0} y1={-50} x2={-20 + Math.sin(frame*0.5 + Math.PI)*40} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <text y={550} textAnchor="middle" fill="#8D99AE" fontSize={70} fontWeight={900}>BREATHABLE AIR HUGS GROUND</text>
            <text y={-200} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>DROP AND CRAWL</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: FEEL EVERY DOOR ─────────────────────────────────────────────────
function SceneFeelDoor() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Door */}
            <rect x={-200} y={-400} width={400} height={800} fill={C.woodBrown} />
            <rect x={-180} y={-380} width={360} height={760} fill={C.bgDeep} opacity={0.2} />
            
            <circle cx={140} cy={0} r={20} fill="#ADB5BD" />

            {/* Hand touching door handle */}
            <g transform={`translate(140, ${frame % 20 < 10 ? 20 : 0})`}>
              <line x1={200} y1={150} x2={20} y2={10} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <circle cx={20} cy={10} r={30} fill={C.personSuit} />
            </g>

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>FEEL EVERY DOOR</text>
            <text y={600} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>BEFORE OPENING</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: IF HOT, FIND ANOTHER WAY ────────────────────────────────────────
function SceneHotDoor() {
  const frame = useCurrentFrame();

  const glow = Math.sin(frame * 0.3) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Door glowing red */}
            <rect x={-200} y={-400} width={400} height={800} fill={C.fireRed} opacity={0.5} />
            
            {/* Handle glowing super bright */}
            <circle cx={140} cy={0} r={20 + glow} fill={C.fireOrange} opacity={0.8} />
            <circle cx={140} cy={0} r={20} fill={C.white} />

            {/* Heat waves */}
            <g stroke={C.fireOrange} strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.7}>
              <path d={`M 80,-50 Q 140,${-100 - glow} 200,-50`} />
              <path d={`M 100,-80 Q 140,${-120 - glow} 180,-80`} />
            </g>

            {/* Hand pulls away fast */}
            <g transform={`translate(200, 200)`}>
              <line x1={200} y1={150} x2={20} y2={10} stroke={C.personSuit} strokeWidth={30} strokeLinecap="round" />
              <circle cx={20} cy={10} r={30} fill={C.personSuit} />
              {/* Motion lines */}
              <line x1={-30} y1={0} x2={-80} y2={-50} stroke={C.white} strokeWidth={8} strokeLinecap="round" />
              <line x1={-10} y1={-30} x2={-50} y2={-80} stroke={C.white} strokeWidth={8} strokeLinecap="round" />
            </g>

            <text y={-500} textAnchor="middle" fill={C.fireRed} fontSize={100} fontWeight={900}>IF HANDLE IS HOT</text>
            <text y={550} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>FIRE ON OTHER SIDE</text>
            <text y={650} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>FIND ANOTHER WAY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: SMOKE KILLS MOST ────────────────────────────────────────────────
function SceneSmokeKills() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={-960} width={1080} height={1920} fill={C.smokeDark} />

            <g transform="translate(0, 0)">
              {/* Skull graphic out of smoke */}
              <path d="M -100,-100 C -100,-200 100,-200 100,-100 L 100,50 L 60,100 L -60,100 L -100,50 Z" fill={C.smokeGray} />
              <circle cx={-40} cy={-50} r={25} fill={C.bgDeep} />
              <circle cx={40} cy={-50} r={25} fill={C.bgDeep} />
              <path d="M -20,20 L 20,20 L 0,0 Z" fill={C.bgDeep} />
              {/* Teeth */}
              <line x1={-40} y1={80} x2={-40} y2={100} stroke={C.bgDeep} strokeWidth={5} />
              <line x1={-20} y1={80} x2={-20} y2={100} stroke={C.bgDeep} strokeWidth={5} />
              <line x1={0} y1={80} x2={0} y2={100} stroke={C.bgDeep} strokeWidth={5} />
              <line x1={20} y1={80} x2={20} y2={100} stroke={C.bgDeep} strokeWidth={5} />
              <line x1={40} y1={80} x2={40} y2={100} stroke={C.bgDeep} strokeWidth={5} />
            </g>

            <text y={-350} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>SMOKE KILLS MOST</text>
            
            {frame > 60 && (
              <text y={350} textAnchor="middle" fill={C.fireRed} fontSize={60} fontWeight={900}>OFTEN WHILE STILL ASLEEP</text>
            )}

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Fire: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('fire_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene4 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_water_ripples.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.8} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneWake />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneNoStand />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneCrawl />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneFeelDoor />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneHotDoor />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneSmokeKills />
      </Sequence>
    </AbsoluteFill>
  );
};

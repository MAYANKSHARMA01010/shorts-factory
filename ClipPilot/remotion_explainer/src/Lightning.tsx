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

import lightningWords from './lightning_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1083;

const C = {
  bgDeep: '#0B0C10',
  stormCloud: '#1F2833',
  lightningYellow: '#F3E92B',
  dangerRed: '#ED254E',
  personSuit: '#45A29E',
  treeBrown: '#4A3B32',
  treeGreen: '#2D452B',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 208,
  scene3: 455,
  scene4: 636,
  scene5: 872,
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

// ─── SCENE 1: TINGLE & FLASH ──────────────────────────────────────────────────
function SceneTingle() {
  const frame = useCurrentFrame();

  const flash = frame % 30 < 3 && frame > 60 ? 1 : 0;
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Background lightning flash */}
            {flash > 0 && <rect x={-540} y={-960} width={1080} height={1920} fill={C.lightningYellow} opacity={0.3} />}

            {/* Clouds */}
            <path d="M -400,-600 C -300,-800 -100,-800 0,-600 C 200,-800 400,-700 500,-500 C 600,-300 400,-200 300,-200 L -300,-200 Z" fill={C.stormCloud} />

            {/* Person standing */}
            <g transform={`translate(0, 300)`}>
              <circle cx={0} cy={-200} r={50} fill={C.personSuit} />
              
              {/* Hair standing on end */}
              {frame > 20 && (
                <g stroke={C.white} strokeWidth={8} strokeLinecap="round">
                  {Array.from({length: 7}).map((_, i) => {
                    const angle = -Math.PI + (i * Math.PI) / 6;
                    const jitter = Math.random() * 10;
                    return (
                      <line key={i} x1={0} y1={-200} x2={Math.cos(angle)* (60 + jitter)} y2={-200 + Math.sin(angle)*(60 + jitter)} />
                    );
                  })}
                </g>
              )}

              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M -60,-100 L 0,-150 L 60,-100" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M -40,100 L -40,250 M 40,100 L 40,250" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Tingle effects */}
            {frame > 30 && (
              <g opacity={0.5}>
                {Array.from({length: 15}).map((_, i) => {
                  const r = 150 + Math.random() * 50;
                  const angle = Math.random() * Math.PI * 2;
                  const x = Math.cos(angle) * r;
                  const y = 200 + Math.sin(angle) * r;
                  return <circle key={i} cx={x} cy={y} r={5} fill={C.lightningYellow} />;
                })}
              </g>
            )}

            <text y={700} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>AIR TINGLES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: DON'T LIE FLAT ──────────────────────────────────────────────────
function SceneFlat() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentFlow = (frame * 15) % 1080;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Ground */}
            <rect x={-540} y={300} width={1080} height={660} fill={C.stormCloud} opacity={0.5} />

            {/* Person lying flat */}
            <g transform="translate(0, 270) rotate(-90)">
              <circle cx={0} cy={-200} r={50} fill={C.personSuit} />
              <line x1={0} y1={-150} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              <path d="M -60,-100 L 0,-150 L 60,-100" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M -40,100 L -40,250 M 40,100 L 40,250" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Current flowing sideways */}
            <path d="M -540,300 L 540,300" fill="none" stroke={C.lightningYellow} strokeWidth={10} strokeDasharray="30, 30" strokeDashoffset={-currentFlow} />
            <path d="M -540,350 L 540,350" fill="none" stroke={C.lightningYellow} strokeWidth={10} strokeDasharray="30, 30" strokeDashoffset={-currentFlow * 1.5} opacity={0.7} />

            <g opacity={Math.sin(frame * 0.5) > 0 ? 1 : 0}>
              <line x1={-300} y1={250} x2={300} y2={250} stroke={C.dangerRed} strokeWidth={50} strokeLinecap="round" />
              <line x1={300} y1={250} x2={-300} y2={250} stroke={C.dangerRed} strokeWidth={50} strokeLinecap="round" />
            </g>

            <text y={-200} textAnchor="middle" fill={C.dangerRed} fontSize={100} fontWeight={900}>DON'T LIE FLAT</text>
            <text y={500} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>GROUND CARRIES CURRENT</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: CROUCH ──────────────────────────────────────────────────────────
function SceneCrouch() {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={300} width={1080} height={660} fill={C.stormCloud} opacity={0.5} />

            {/* Person Crouching */}
            <g transform={`translate(0, 200)`}>
              <circle cx={0} cy={-50} r={50} fill={C.personSuit} />
              {/* Torso bent */}
              <line x1={0} y1={0} x2={0} y2={50} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
              
              {/* Hands over ears */}
              <path d="M -60,-50 L 0,0 L 60,-50" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
              
              {/* Legs crouched on balls of feet */}
              <path d="M 0,50 L -40,100 L -10,100 M 0,50 L 40,100 L 10,100" fill="none" stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Arrows pointing to heels and ears */}
            <path d="M -150,-100 L -80,-30 L -100,-30 M -80,-30 L -80,-50" fill="none" stroke={C.white} strokeWidth={8} strokeLinejoin="round" />
            <text x={-200} y={-120} fill={C.white} fontSize={40} fontWeight={900}>HANDS ON EARS</text>

            <path d="M 150,350 L 50,300 L 70,300 M 50,300 L 50,320" fill="none" stroke={C.white} strokeWidth={8} strokeLinejoin="round" />
            <text x={200} y={380} fill={C.white} fontSize={40} fontWeight={900}>HEELS TOUCHING</text>

            <text y={-400} textAnchor="middle" fill="#A9DFBF" fontSize={120} fontWeight={900}>CROUCH LOW</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: LONE TREE ───────────────────────────────────────────────────────
function SceneTree() {
  const frame = useCurrentFrame();

  const flash = frame > 30 && frame < 40 ? 1 : 0;
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <rect x={-540} y={300} width={1080} height={660} fill={C.stormCloud} opacity={0.5} />

            {/* Lone Tree */}
            <g transform="translate(-150, 0)">
              <rect x={-30} y={-200} width={60} height={500} fill={C.treeBrown} />
              <circle cx={0} cy={-250} r={150} fill={C.treeGreen} />
              <circle cx={-100} cy={-200} r={100} fill={C.treeGreen} />
              <circle cx={100} cy={-200} r={100} fill={C.treeGreen} />
              
              {/* Lightning striking tree */}
              {frame > 30 && (
                <path d="M 0,-800 L -50,-500 L 20,-400 L -20,-250" fill="none" stroke={C.lightningYellow} strokeWidth={20} strokeLinejoin="round" />
              )}
            </g>

            {/* Person hiding under tree */}
            <g transform={`translate(-100, 200)`}>
              <circle cx={0} cy={-50} r={40} fill={C.personSuit} />
              <line x1={0} y1={-10} x2={0} y2={100} stroke={C.personSuit} strokeWidth={20} strokeLinecap="round" />
            </g>

            <g opacity={frame > 40 ? 1 : 0}>
              <line x1={-300} y1={0} x2={100} y2={400} stroke={C.dangerRed} strokeWidth={50} strokeLinecap="round" />
              <line x1={100} y1={0} x2={-300} y2={400} stroke={C.dangerRed} strokeWidth={50} strokeLinecap="round" />
            </g>

            <text y={500} textAnchor="middle" fill={C.white} fontSize={70} fontWeight={900}>NEVER HIDE UNDER TREES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: HOTTER THAN SUN ─────────────────────────────────────────────────
function SceneSun() {
  const frame = useCurrentFrame();

  const glow = Math.sin(frame * 0.1) * 20;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* The Sun */}
            <circle cx={-200} cy={0} r={150} fill="#F48C06" />
            <circle cx={-200} cy={0} r={150 + glow} fill="#FFBA08" opacity={0.5} />
            <text x={-200} y={250} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>SUN</text>

            <text x={0} y={0} textAnchor="middle" fill={C.white} fontSize={60} fontWeight={900}>X 5</text>

            {/* Lightning */}
            <g transform="translate(200, 0)">
              <path d="M 0,-150 L -30,0 L 20,20 L -20,150" fill="none" stroke={C.lightningYellow} strokeWidth={40} strokeLinejoin="round" />
              <path d="M 0,-150 L -30,0 L 20,20 L -20,150" fill="none" stroke={C.white} strokeWidth={15} strokeLinejoin="round" />
              <text y={250} textAnchor="middle" fill={C.lightningYellow} fontSize={50} fontWeight={900}>LIGHTNING</text>
            </g>

            <text y={-350} textAnchor="middle" fill={C.dangerRed} fontSize={80} fontWeight={900}>5X HOTTER THAN THE SUN</text>

            <g transform={`translate(0, 600)`}>
              {/* Heart stopped */}
              <path d="M 0,20 C -50,-30 -80,-80 -40,-120 C 0,-160 30,-120 50,-100 C 70,-120 100,-160 140,-120 C 180,-80 150,-30 100,20 Z" transform="translate(-50, 50)" fill={C.dangerRed} />
              <path d="M -100,-50 L 100,-50 L 100,-100 L 150,-20 L 100,60 L 100,10 L -100,10 Z" fill={C.white} />
            </g>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Lightning: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('lightning_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={S.scene5 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneTingle />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneFlat />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneCrouch />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneTree />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={DURATION_IN_FRAMES - S.scene5}>
        <SceneSun />
      </Sequence>
    </AbsoluteFill>
  );
};

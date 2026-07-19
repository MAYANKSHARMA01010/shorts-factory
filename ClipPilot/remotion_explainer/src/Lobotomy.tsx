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

import lobotomyWords from './lobotomy_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 953;

const C = {
  bgDeep: '#0D1B2A',
  hospitalGreen: '#A9DFBF',
  metalSilver: '#E0E1DD',
  bloodRed: '#9A031E',
  skinTone: '#F5CBA7',
  brainPink: '#F1948A',
  vanBlue: '#1B4F72',
  white: '#FFFFFF',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 214,
  scene3: 329,
  scene4: 543,
  scene5: 665,
  scene6: 818,
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

// ─── SCENE 1: METAL PICK BEHIND EYE ───────────────────────────────────────────
function SceneIcePick() {
  const frame = useCurrentFrame();

  const hammerStrike = frame > 120 ? Math.sin((frame - 120) * 0.5) * 50 : 0;
  const pickProgress = interpolate(frame, [120, 180], [0, 100], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Close up on eye area */}
            <circle cx={0} cy={0} r={300} fill={C.skinTone} />
            
            {/* Eyelid being lifted */}
            <path d="M -150,-50 Q 0,-150 150,-50" fill="none" stroke="#E5989B" strokeWidth={20} />
            <path d="M -150,-50 Q 0,50 150,-50" fill="none" stroke="#E5989B" strokeWidth={20} />
            <circle cx={0} cy={-50} r={50} fill={C.white} />
            <circle cx={0} cy={-50} r={20} fill="#212529" />

            {/* Fingers holding lid */}
            <g transform="translate(0, -180)">
              <rect x={-40} y={0} width={80} height={200} rx={40} fill="#FAD7A1" />
              <path d="M -40,100 L 40,100" stroke="#E5989B" strokeWidth={10} />
            </g>

            {/* Ice pick sliding in */}
            <g transform={`translate(-50, ${100 - pickProgress}) rotate(-15)`}>
              <line x1={0} y1={-100} x2={0} y2={200} stroke={C.metalSilver} strokeWidth={15} strokeLinecap="round" />
              <rect x={-15} y={200} width={30} height={80} fill="#B08968" rx={5} />
            </g>

            {/* Hammer tapping */}
            {frame > 100 && (
              <g transform={`translate(-100, ${300 + hammerStrike}) rotate(-30)`}>
                <rect x={-20} y={-80} width={40} height={160} fill="#6C757D" rx={10} />
                <rect x={-10} y={0} width={20} height={200} fill="#B08968" />
              </g>
            )}

            <text y={-450} textAnchor="middle" fill={C.white} fontSize={50} fontWeight={900}>THIN METAL PICK</text>
            <text y={450} textAnchor="middle" fill={C.metalSilver} fontSize={40} fontWeight={900}>TAP THROUGH THE BONE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: SEVER CONNECTIONS ───────────────────────────────────────────────
function SceneSever() {
  const frame = useCurrentFrame();

  const wiggle = Math.sin(frame * 0.8) * 30;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            <circle cx={0} cy={-200} r={400} fill={C.skinTone} />

            {/* Brain cross section */}
            <path d="M -250,-200 C -250,-400 250,-400 250,-200 C 250,0 150,100 0,100 C -150,100 -250,0 -250,-200 Z" fill={C.brainPink} />
            
            {/* Neural Connections */}
            <g stroke={C.white} strokeWidth={10} strokeDasharray="10, 10">
              <path d="M -150,-100 Q 0,-200 150,-100" />
              <path d="M -100,-250 Q 0,-150 100,-250" />
            </g>

            {/* Pick wiggling */}
            <g transform={`translate(0, 0) rotate(${wiggle})`}>
              <line x1={0} y1={-150} x2={0} y2={200} stroke={C.metalSilver} strokeWidth={20} strokeLinecap="round" />
            </g>

            {/* Severed lines snapping */}
            {frame > 30 && (
              <g stroke={C.bloodRed} strokeWidth={15}>
                <line x1={-50} y1={-150} x2={50} y2={-100} />
                <line x1={-30} y1={-200} x2={30} y2={-250} />
              </g>
            )}

            <text y={400} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>WIGGLE BACK & FORTH</text>
            <text y={500} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>SEVER BRAIN CONNECTIONS</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: ASSEMBLY LINE ───────────────────────────────────────────────────
function SceneAssembly() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg color={C.hospitalGreen} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Clock spinning fast */}
            <g transform="translate(0, -400) scale(1.5)">
              <circle cx={0} cy={0} r={100} fill={C.white} stroke="#212529" strokeWidth={10} />
              <line x1={0} y1={0} x2={0} y2={-80} stroke="#212529" strokeWidth={10} strokeLinecap="round" transform={`rotate(${frame * 20})`} />
              <line x1={0} y1={0} x2={60} y2={0} stroke="#212529" strokeWidth={15} strokeLinecap="round" transform={`rotate(${frame * 2})`} />
            </g>

            <text y={-150} textAnchor="middle" fill="#212529" fontSize={80} fontWeight={900}>TEN MINUTES</text>

            {/* Assembly line of patients on beds moving */}
            <g transform="translate(0, 300)">
              {Array.from({length: 5}).map((_, i) => {
                const x = ((i * 400 - frame * 15) % 2000) - 1000;
                return (
                  <g key={i} transform={`translate(${x}, 0)`}>
                    <rect x={-100} y={0} width={200} height={100} fill={C.white} rx={10} />
                    <circle cx={-50} cy={-20} r={40} fill={C.skinTone} />
                    {/* Bandage around head */}
                    <rect x={-90} y={-40} width={80} height={20} fill={C.metalSilver} rx={5} />
                  </g>
                );
              })}
            </g>

            <text y={600} textAnchor="middle" fill="#212529" fontSize={90} fontWeight={900}>LIKE AN ASSEMBLY LINE</text>
            <text y={700} textAnchor="middle" fill={C.bloodRed} fontSize={70} fontWeight={900}>DOZENS A DAY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: CALMER PATIENT ──────────────────────────────────────────────────
function SceneCalmer() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Patient sitting in chair, very still */}
            <rect x={-150} y={-50} width={300} height={400} fill="#6C757D" rx={20} />
            <circle cx={0} cy={-200} r={100} fill={C.skinTone} />
            <path d="M -100,-100 L 100,-100 L 150,300 L -150,300 Z" fill={C.white} />

            {/* Blank face */}
            <circle cx={-40} cy={-220} r={10} fill="#212529" />
            <circle cx={40} cy={-220} r={10} fill="#212529" />
            <line x1={-30} y1={-170} x2={30} y2={-170} stroke="#212529" strokeWidth={5} />

            <text y={-500} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>LEFT CALMER</text>
            <text y={-400} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900}>QUIETER</text>
            <text y={600} textAnchor="middle" fill={C.hospitalGreen} fontSize={80} fontWeight={900}>EASIER TO MANAGE</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: HOLLOWED OUT ────────────────────────────────────────────────────
function SceneHollow() {
  const frame = useCurrentFrame();

  const hollow = interpolate(frame, [0, 60], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.5)`}>
            
            {/* Silhouette of head */}
            <path d="M -200,0 C -200,-300 200,-300 200,0 C 200,200 100,300 0,300 C -100,300 -200,200 -200,0 Z" fill={C.white} />
            
            {/* Hollow cut out spreading */}
            <g transform="scale(1.2)">
              <circle cx={0} cy={-50} r={150 * hollow} fill={C.bgDeep} />
            </g>

            <text y={-350} textAnchor="middle" fill={C.bloodRed} fontSize={60} fontWeight={900}>HOLLOWED OUT</text>
            <text y={350} textAnchor="middle" fill={C.metalSilver} fontSize={40} fontWeight={900}>UNABLE TO THINK OR CARE FOR THEMSELVES</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: THE LOBOTOMOBILE ────────────────────────────────────────────────
function SceneVan() {
  const frame = useCurrentFrame();

  const drive = frame * 10;
  const bump = Math.sin(frame) * 5;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(1.0)`}>
            
            {/* Road */}
            <rect x={-540} y={200} width={1080} height={760} fill="#343A40" />
            <line x1={-540} y1={400} x2={540} y2={400} stroke="#FFB703" strokeWidth={20} strokeDasharray="100, 100" transform={`translate(${-drive % 200}, 0)`} />

            {/* Van moving */}
            <g transform={`translate(0, ${bump})`}>
              <rect x={-300} y={-100} width={600} height={250} fill={C.vanBlue} rx={30} />
              <rect x={150} y={-80} width={100} height={100} fill="#87CEEB" rx={10} />
              <rect x={-280} y={-80} width={400} height={100} fill="#87CEEB" rx={10} />
              
              <text x={-250} y={0} fill={C.white} fontSize={40} fontWeight={900}>THE</text>
              <text x={-250} y={50} fill={C.bloodRed} fontSize={60} fontWeight={900}>LOBOTOMOBILE</text>

              {/* Wheels spinning */}
              <g transform="translate(-200, 150)">
                <circle cx={0} cy={0} r={60} fill="#212529" />
                <circle cx={0} cy={0} r={40} fill={C.metalSilver} />
                <line x1={-40} y1={0} x2={40} y2={0} stroke="#212529" strokeWidth={10} transform={`rotate(${drive})`} />
                <line x1={0} y1={-40} x2={0} y2={40} stroke="#212529" strokeWidth={10} transform={`rotate(${drive})`} />
              </g>

              <g transform="translate(200, 150)">
                <circle cx={0} cy={0} r={60} fill="#212529" />
                <circle cx={0} cy={0} r={40} fill={C.metalSilver} />
                <line x1={-40} y1={0} x2={40} y2={0} stroke="#212529" strokeWidth={10} transform={`rotate(${drive})`} />
                <line x1={0} y1={-40} x2={0} y2={40} stroke="#212529" strokeWidth={10} transform={`rotate(${drive})`} />
              </g>
            </g>

            <text y={-400} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900}>HE TOURED THE COUNTRY</text>

          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Lobotomy: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('lobotomy_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={S.scene1 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_glass.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_alarm_tick.mp3')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene6 + 10} durationInFrames={100}>
        <Audio src={staticFile('sfx_drag_boom.wav')} volume={0.7} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneIcePick />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneSever />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneAssembly />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneCalmer />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneHollow />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <SceneVan />
      </Sequence>
    </AbsoluteFill>
  );
};

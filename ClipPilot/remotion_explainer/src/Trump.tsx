import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1300;

const C = {
  bgDeep: '#0D1B2A',
  bgRed: '#c0392b',
  bgBlue: '#2980b9',
  gold: '#f1c40f',
  white: '#FFFFFF',
  black: '#14213D',
  green: '#2ecc71',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function SceneWrap({ children, scaleOffset = 0, bg = C.bgDeep }: { children: React.ReactNode, scaleOffset?: number, bg?: string }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 4], [0, 1], clamp);
  const sc = interpolate(f, [0, 60], [1.0 + scaleOffset, 1.05 + scaleOffset], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
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
    </AbsoluteFill>
  );
}

// ─── CUT 1: "What if I told you one U.S. President" ───────────────────────
function Cut1() {
  const f = useCurrentFrame();
  const pop = spring({ frame: f - 5, fps: FPS, config: { damping: 10 } });
  const qY = Math.sin(f * 0.2) * 20;

  return (
    <SceneWrap bg={C.bgDeep}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
          {/* Silhouette */}
          <circle cx={0} cy={-100} r={150} fill={C.black} stroke={C.gold} strokeWidth={10} />
          <path d="M -200,200 L 200,200 L 300,500 L -300,500 Z" fill={C.black} stroke={C.gold} strokeWidth={10} />
          <path d="M 0,200 L -50,500 L 50,500 Z" fill={C.bgRed} />
          {/* Question mark */}
          <text y={-400 + qY} textAnchor="middle" fill={C.gold} fontSize={250} fontWeight={900} style={{ transform: `scale(${pop})` }}>?</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 2: "became a billionaire before entering politics?" ──────────────
function Cut2() {
  const f = useCurrentFrame();
  const pop = spring({ frame: f, fps: FPS, config: { damping: 12 } });

  return (
    <SceneWrap bg={C.gold}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
          {/* Rain of money */}
          {[...Array(20)].map((_, i) => {
            const drop = (f * (10 + i) + i * 200) % 1920;
            return <text key={i} x={-400 + i * 40} y={-960 + drop} fill={C.green} fontSize={80} fontWeight={900}>$</text>
          })}
          
          <g transform={`scale(${pop})`}>
             <circle cx={0} cy={0} r={300} fill={C.gold} stroke={C.white} strokeWidth={30} />
             <circle cx={0} cy={0} r={240} fill="none" stroke={C.bgDeep} strokeWidth={10} strokeDasharray="20 20" />
             <text y={100} textAnchor="middle" fill={C.bgDeep} fontSize={300} fontWeight={900}>$</text>
          </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 3: "Donald Trump wasn't a career politician." ────────────────────
function Cut3() {
  const f = useCurrentFrame();
  const cross = spring({ frame: f - 10, fps: FPS, config: { damping: 12 } });

  return (
    <SceneWrap bg={C.bgBlue}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           <rect x={-200} y={-100} width={400} height={300} fill={C.white} rx={30} />
           <rect x={-50} y={-150} width={100} height={50} fill={C.black} rx={10} />
           <path d="M -200,0 L 200,0" stroke={C.black} strokeWidth={20} />
           <text y={100} textAnchor="middle" fill={C.black} fontSize={80} fontWeight={900}>POLITICIAN</text>

           {/* Giant red X */}
           <g transform={`scale(${cross})`}>
              <line x1={-250} y1={-200} x2={250} y2={250} stroke={C.bgRed} strokeWidth={60} strokeLinecap="round" />
              <line x1={250} y1={-200} x2={-250} y2={250} stroke={C.bgRed} strokeWidth={60} strokeLinecap="round" />
           </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 4: "He built his public image through real estate," ──────────────
function Cut4() {
  const f = useCurrentFrame();
  const build1 = spring({ frame: f, fps: FPS, config: { damping: 14 } });
  const build2 = spring({ frame: f - 5, fps: FPS, config: { damping: 14 } });
  const build3 = spring({ frame: f - 10, fps: FPS, config: { damping: 14 } });

  return (
    <SceneWrap bg={C.bgDeep}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           <g transform={`translate(-250, ${500 - build1 * 600})`}>
              <rect x={-100} y={0} width={200} height={800} fill={C.black} stroke={C.gold} strokeWidth={10} />
              {[...Array(6)].map((_, i) => <rect key={i} x={-50} y={50 + i * 80} width={100} height={40} fill={C.gold} />)}
           </g>
           <g transform={`translate(250, ${500 - build2 * 700})`}>
              <rect x={-100} y={0} width={200} height={800} fill={C.black} stroke={C.white} strokeWidth={10} />
              {[...Array(7)].map((_, i) => <rect key={i} x={-50} y={50 + i * 80} width={100} height={40} fill={C.white} />)}
           </g>
           <g transform={`translate(0, ${500 - build3 * 900})`}>
              <rect x={-120} y={0} width={240} height={1000} fill={C.gold} stroke={C.white} strokeWidth={10} />
              <text y={-50} textAnchor="middle" fill={C.gold} fontSize={80} fontWeight={900}>EMPIRE</text>
              {[...Array(10)].map((_, i) => <rect key={i} x={-70} y={50 + i * 80} width={140} height={40} fill={C.black} />)}
           </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 5: "hotels, golf courses, and television." ───────────────────────
function Cut5() {
  const f = useCurrentFrame();
  const pop = spring({ frame: f, fps: FPS, config: { damping: 12 } });
  const tvPop = spring({ frame: f - 20, fps: FPS, config: { damping: 12 } });

  return (
    <SceneWrap bg={C.green}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           {/* Golf */}
           <g transform={`translate(-200, 0) scale(${pop})`}>
              <line x1={0} y1={200} x2={0} y2={-200} stroke={C.white} strokeWidth={20} strokeLinecap="round" />
              <path d="M 0,-200 L 150,-150 L 0,-100 Z" fill={C.bgRed} />
              <circle cx={-100} cy={200} r={30} fill={C.white} />
           </g>

           {/* TV */}
           <g transform={`translate(200, 0) scale(${tvPop})`}>
              <rect x={-200} y={-150} width={400} height={300} fill={C.black} rx={20} />
              <rect x={-180} y={-130} width={360} height={260} fill={f % 6 < 3 ? C.white : C.gold} rx={10} />
              <text y={20} textAnchor="middle" fill={C.black} fontSize={100} fontWeight={900}>TV</text>
              <line x1={0} y1={-150} x2={-100} y2={-250} stroke={C.black} strokeWidth={15} strokeLinecap="round" />
              <line x1={0} y1={-150} x2={100} y2={-250} stroke={C.black} strokeWidth={15} strokeLinecap="round" />
           </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 6: "In 2015, he announced his presidential campaign," ────────────
function Cut6() {
  const f = useCurrentFrame();
  const rise = spring({ frame: f, fps: FPS, config: { damping: 14 } });

  return (
    <SceneWrap bg={C.bgDeep}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           {/* Bunting */}
           <path d="M -540,-960 Q -270,-700 0,-960 Q 270,-700 540,-960 Z" fill={C.bgRed} />
           <path d="M -540,-960 Q -270,-800 0,-960 Q 270,-800 540,-960 Z" fill={C.white} />
           <path d="M -540,-960 Q -270,-900 0,-960 Q 270,-900 540,-960 Z" fill={C.bgBlue} />

           <g transform={`translate(0, ${500 - rise * 400})`}>
              {/* Podium */}
              <rect x={-200} y={0} width={400} height={500} fill={C.white} />
              <rect x={-220} y={0} width={440} height={40} fill={C.bgRed} />
              {/* Mic */}
              <line x1={0} y1={0} x2={-50} y2={-100} stroke={C.black} strokeWidth={15} />
              <circle cx={-50} cy={-100} r={20} fill={C.black} />
              <line x1={0} y1={0} x2={50} y2={-100} stroke={C.black} strokeWidth={15} />
              <circle cx={50} cy={-100} r={20} fill={C.black} />
              <text y={-200} textAnchor="middle" fill={C.gold} fontSize={150} fontWeight={900}>2015</text>
           </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 7: "and just one year later, he defeated experienced politicians" ─
function Cut7() {
  const f = useCurrentFrame();
  const punch = spring({ frame: f, fps: FPS, config: { damping: 10 } });

  return (
    <SceneWrap bg={C.bgRed}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           {/* Chart skyrocketing */}
           <path d={`M -400,300 L -200,200 L 0,300 L 200,100 L 400,${300 - punch * 600}`} fill="none" stroke={C.white} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
           <circle cx={400} cy={300 - punch * 600} r={40} fill={C.gold} />
           
           <text y={-200} textAnchor="middle" fill={C.white} fontSize={150} fontWeight={900} fontStyle="italic">DEFEATED</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 8: "to become the 45th President of the United States." ──────────
function Cut8() {
  const f = useCurrentFrame();
  const stamp = spring({ frame: f, fps: FPS, config: { damping: 8 } });
  
  return (
    <SceneWrap bg={C.bgBlue}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           {/* Starburst */}
           <g opacity={f > 10 ? 1 : 0}>
             {[...Array(12)].map((_, i) => {
                const angle = i * 30 * Math.PI / 180;
                return <line key={i} x1={0} y1={0} x2={Math.cos(angle)*500} y2={Math.sin(angle)*500} stroke={C.white} strokeWidth={20} strokeDasharray="50 50" />
             })}
           </g>

           <g transform={`scale(${stamp * 1.5})`}>
              <circle cx={0} cy={0} r={300} fill={C.bgRed} stroke={C.white} strokeWidth={30} />
              <text y={100} textAnchor="middle" fill={C.white} fontSize={300} fontWeight={900}>45</text>
           </g>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 9: "After leaving office, he made history again" ─────────────────
function Cut9() {
  const f = useCurrentFrame();
  const spin = f * 20;

  return (
    <SceneWrap bg={C.black}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           <g transform={`rotate(${spin})`}>
              <circle cx={0} cy={0} r={300} fill="none" stroke={C.white} strokeWidth={30} strokeDasharray="100 100" />
           </g>
           <circle cx={0} cy={0} r={250} fill={C.gold} />
           <text y={40} textAnchor="middle" fill={C.black} fontSize={150} fontWeight={900}>HISTORY</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 10: "by winning the 2024 election, becoming only the second" ─────
function Cut10() {
  const f = useCurrentFrame();
  const pop = spring({ frame: f, fps: FPS, config: { damping: 10 } });

  return (
    <SceneWrap bg={C.bgRed}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           {[...Array(5)].map((_, i) => (
             <circle key={i} cx={0} cy={0} r={pop * (100 + i * 150)} fill="none" stroke={C.white} strokeWidth={20} opacity={1 - i*0.2} />
           ))}
           <rect x={-350} y={-150} width={700} height={300} fill={C.black} rx={40} transform={`scale(${pop})`} />
           <text y={80} textAnchor="middle" fill={C.gold} fontSize={250} fontWeight={900} transform={`scale(${pop})`}>2024</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 11: "ever to serve two non-consecutive terms." ───────────────────
function Cut11() {
  const f = useCurrentFrame();
  const badge1 = spring({ frame: f, fps: FPS, config: { damping: 12 } });
  const badge2 = spring({ frame: f - 15, fps: FPS, config: { damping: 12 } });

  return (
    <SceneWrap bg={C.bgBlue}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           <g transform={`translate(-200, 0) scale(${badge1})`}>
              <polygon points="0,-150 150,150 -150,150" fill={C.bgRed} />
              <text y={100} textAnchor="middle" fill={C.white} fontSize={120} fontWeight={900}>45</text>
           </g>
           
           {f > 15 && (
             <path d="M -50,-50 Q 0,-150 50,-50 L 100,0 L 50,50 Q 0,150 -50,50 L -100,0 Z" fill={C.gold} transform="scale(0.5)" />
           )}

           <g transform={`translate(200, 0) scale(${badge2})`}>
              <polygon points="0,-150 150,150 -150,150" fill={C.white} />
              <text y={100} textAnchor="middle" fill={C.bgRed} fontSize={120} fontWeight={900}>47</text>
           </g>

           <text y={400} textAnchor="middle" fill={C.white} fontSize={100} fontWeight={900}>NON-CONSECUTIVE</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── CUT 12: "Whether people support him or not, his political comeback" ──
function Cut12() {
  const f = useCurrentFrame();
  const up = spring({ frame: f, fps: FPS, config: { damping: 15 } });

  return (
    <SceneWrap bg={C.bgDeep}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(540, 960)">
           <g transform={`translate(0, ${500 - up * 500})`}>
              <path d="M -200,200 L 0,-200 L 200,200 L 100,200 L 100,500 L -100,500 L -100,200 Z" fill={C.gold} stroke={C.white} strokeWidth={20} strokeLinejoin="round" />
              <text y={100} textAnchor="middle" fill={C.bgDeep} fontSize={150} fontWeight={900}>UP</text>
           </g>
           <text y={-300} textAnchor="middle" fill={C.white} fontSize={120} fontWeight={900}>COMEBACK</text>
        </g>
      </svg>
    </SceneWrap>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Trump: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('t101_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* 
        t101_words.json timing mapping:
        Cut 1: 0 - 52
        Cut 2: 52 - 146
        Cut 3: 146 - 232
        Cut 4: 232 - 315
        Cut 5: 315 - 409
        Cut 6: 409 - 530
        Cut 7: 530 - 630
        Cut 8: 630 - 749
        Cut 9: 749 - 870
        Cut 10: 870 - 980
        Cut 11: 980 - 1150
        Cut 12: 1150 - 1279
      */}

      <Sequence from={0} durationInFrames={52}><Cut1 /></Sequence>
      <Sequence from={52} durationInFrames={146 - 52}><Cut2 /></Sequence>
      <Sequence from={146} durationInFrames={232 - 146}><Cut3 /></Sequence>
      <Sequence from={232} durationInFrames={315 - 232}><Cut4 /></Sequence>
      <Sequence from={315} durationInFrames={409 - 315}><Cut5 /></Sequence>
      <Sequence from={409} durationInFrames={530 - 409}><Cut6 /></Sequence>
      <Sequence from={530} durationInFrames={630 - 530}><Cut7 /></Sequence>
      <Sequence from={630} durationInFrames={749 - 630}><Cut8 /></Sequence>
      <Sequence from={749} durationInFrames={870 - 749}><Cut9 /></Sequence>
      <Sequence from={870} durationInFrames={980 - 870}><Cut10 /></Sequence>
      <Sequence from={980} durationInFrames={1150 - 980}><Cut11 /></Sequence>
      <Sequence from={1150} durationInFrames={DURATION_IN_FRAMES - 1150}><Cut12 /></Sequence>

    </AbsoluteFill>
  );
};

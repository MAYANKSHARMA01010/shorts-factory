import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Sequence, Audio, staticFile } from 'remotion';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1240;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function SceneWrap({ children }: { children: React.ReactNode }) {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  const sc = interpolate(f, [0, 8], [1.05, 1.0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fadeIn, transform: `scale(${sc})`, transformOrigin: 'center' }}>
      {children}
    </div>
  );
}

function Scene1() {
  const f = useCurrentFrame();
  const r = interpolate(f, [0, 100], [0, 360]);
  return (
    <AbsoluteFill style={{ backgroundColor: '#8ECAE6' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) rotate(${r})`}>
             <rect x={-400} y={-400} width={800} height={800} fill="#219EBC" rx={100} />
             <circle cx={0} cy={0} r={200} fill="#023047" />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene2() {
  const f = useCurrentFrame();
  const s = Math.sin(f * 0.1) * 100;
  return (
    <AbsoluteFill style={{ backgroundColor: '#023047' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <circle cx={s} cy={-s} r={300} fill="#FFB703" />
             <circle cx={-s} cy={s} r={300} fill="#8ECAE6" />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene3() {
  const f = useCurrentFrame();
  const y = interpolate(f, [0, 100], [-500, 500], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#FFB703' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <polygon points="0,-400 300,200 -300,200" fill="#219EBC" transform={`translate(0, ${y})`} />
             <polygon points="0,-200 150,100 -150,100" fill="#8ECAE6" transform={`translate(0, ${-y})`} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene4() {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, 100], [0.5, 2], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#8ECAE6' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${scale})`}>
             <path d="M -200,0 A 200,200 0 1,0 200,0 A 200,200 0 1,0 -200,0" fill="none" stroke="#023047" strokeWidth={50} strokeDasharray="100 50" />
             <path d="M -100,0 A 100,100 0 1,0 100,0 A 100,100 0 1,0 -100,0" fill="none" stroke="#FFB703" strokeWidth={30} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene5() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#219EBC' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            {[...Array(20)].map((_, i) => {
              const r = 50 + i * 40;
              const dash = f * (i % 2 === 0 ? 2 : -2);
              return <circle key={i} cx={0} cy={0} r={r} fill="none" stroke={i % 2 === 0 ? '#FFB703' : '#8ECAE6'} strokeWidth={15} strokeDasharray="20 40" strokeDashoffset={dash} />
            })}
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene6() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#FFB703' }}>
      <SceneWrap>
        <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', height: '100%' }}>
          {[...Array(48)].map((_, i) => {
            const sc = 0.5 + Math.abs(Math.sin((f + i * 5) * 0.05));
            return (
              <div key={i} style={{ width: '16.66%', height: '12.5%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                 <div style={{ width: 100 * sc, height: 100 * sc, backgroundColor: i % 3 === 0 ? '#8ECAE6' : '#023047', borderRadius: i % 2 === 0 ? '50%' : '10%' }} />
              </div>
            )
          })}
        </div>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene7() {
  const f = useCurrentFrame();
  const r = f * 2;
  return (
    <AbsoluteFill style={{ backgroundColor: '#8ECAE6' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            {[...Array(8)].map((_, i) => {
               const angle = (i * 45 + r) * (Math.PI / 180);
               const x = Math.cos(angle) * 300;
               const y = Math.sin(angle) * 300;
               return <circle key={i} cx={x} cy={y} r={100} fill="#219EBC" />
            })}
            <circle cx={0} cy={0} r={150} fill="#023047" />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene8() {
  const f = useCurrentFrame();
  const offset = f * 10;
  return (
    <AbsoluteFill style={{ backgroundColor: '#023047', overflow: 'hidden' }}>
      <SceneWrap>
         {[...Array(10)].map((_, i) => (
           <div key={i} style={{ position: 'absolute', top: i * 200, left: -200 + ((i % 2 === 0 ? offset : -offset) % 1500), width: 1500, height: 100, backgroundColor: '#219EBC', transform: 'skewX(-20deg)' }} />
         ))}
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene9() {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, 60], [1, 3], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{ backgroundColor: '#FFB703' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${sc}) rotate(${f})`}>
            <rect x={-200} y={-200} width={400} height={400} fill="#8ECAE6" />
            <rect x={-150} y={-150} width={300} height={300} fill="#219EBC" transform={`rotate(${f * 2})`} />
            <rect x={-100} y={-100} width={200} height={200} fill="#023047" transform={`rotate(${f * 3})`} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene10() {
  const f = useCurrentFrame();
  const y = Math.sin(f * 0.1) * 200;
  return (
    <AbsoluteFill style={{ backgroundColor: '#8ECAE6' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <path d={`M 0,${960+y} Q 270,${960-y} 540,960 T 1080,${960-y} L 1080,1920 L 0,1920 Z`} fill="#219EBC" />
          <path d={`M 0,${1200-y} Q 270,${1200+y} 540,1200 T 1080,${1200+y} L 1080,1920 L 0,1920 Z`} fill="#FFB703" />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene11() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#219EBC' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
           {[...Array(50)].map((_, i) => {
             const cx = (i * 137) % 1080;
             const cy = (i * 223 + f * 5) % 1920;
             return <circle key={i} cx={cx} cy={cy} r={Math.random() * 20 + 10} fill="#023047" opacity={0.7} />
           })}
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene12() {
  const f = useCurrentFrame();
  const r = f * 3;
  return (
    <AbsoluteFill style={{ backgroundColor: '#023047' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            <polygon points="0,-300 260,150 -260,150" fill="#8ECAE6" transform={`rotate(${r})`} />
            <polygon points="0,-200 173,100 -173,100" fill="#FFB703" transform={`rotate(${-r})`} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

export const T090: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#8ECAE6' }}>
      <Audio src={staticFile('t090_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      <Sequence from={0} durationInFrames={90}>
        <Scene10 />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <Scene11 />
      </Sequence>
      <Sequence from={180} durationInFrames={90}>
        <Scene11 />
      </Sequence>
      <Sequence from={270} durationInFrames={90}>
        <Scene7 />
      </Sequence>
      <Sequence from={360} durationInFrames={90}>
        <Scene3 />
      </Sequence>
      <Sequence from={450} durationInFrames={90}>
        <Scene6 />
      </Sequence>
      <Sequence from={540} durationInFrames={90}>
        <Scene4 />
      </Sequence>
      <Sequence from={630} durationInFrames={90}>
        <Scene4 />
      </Sequence>
      <Sequence from={720} durationInFrames={90}>
        <Scene11 />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <Scene11 />
      </Sequence>
      <Sequence from={900} durationInFrames={90}>
        <Scene5 />
      </Sequence>
      <Sequence from={990} durationInFrames={90}>
        <Scene10 />
      </Sequence>
      <Sequence from={1080} durationInFrames={90}>
        <Scene5 />
      </Sequence>
      <Sequence from={1170} durationInFrames={70}>
        <Scene6 />
      </Sequence>
    </AbsoluteFill>
  );

};

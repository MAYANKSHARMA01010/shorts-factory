import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, Sequence, Audio, staticFile } from 'remotion';
import wordsData from './mars_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1141;

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
    <AbsoluteFill style={{ backgroundColor: '#2C3E50' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) rotate(${r})`}>
             <rect x={-400} y={-400} width={800} height={800} fill="#E74C3C" rx={100} />
             <circle cx={0} cy={0} r={200} fill="#ECF0F1" />
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
    <AbsoluteFill style={{ backgroundColor: '#ECF0F1' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <circle cx={s} cy={-s} r={300} fill="#3498DB" />
             <circle cx={-s} cy={s} r={300} fill="#2C3E50" />
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
    <AbsoluteFill style={{ backgroundColor: '#3498DB' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <polygon points="0,-400 300,200 -300,200" fill="#E74C3C" transform={`translate(0, ${y})`} />
             <polygon points="0,-200 150,100 -150,100" fill="#2C3E50" transform={`translate(0, ${-y})`} />
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
    <AbsoluteFill style={{ backgroundColor: '#2C3E50' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${scale})`}>
             <path d="M -200,0 A 200,200 0 1,0 200,0 A 200,200 0 1,0 -200,0" fill="none" stroke="#ECF0F1" strokeWidth={50} strokeDasharray="100 50" />
             <path d="M -100,0 A 100,100 0 1,0 100,0 A 100,100 0 1,0 -100,0" fill="none" stroke="#3498DB" strokeWidth={30} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

export const Mars: React.FC = () => {
  const third = Math.floor(DURATION_IN_FRAMES / 4);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2C3E50' }}>
      <Audio src={staticFile('mars_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />
      <Sequence from={0} durationInFrames={third}>
        <Scene1 />
      </Sequence>
      <Sequence from={third} durationInFrames={third}>
        <Scene2 />
      </Sequence>
      <Sequence from={third*2} durationInFrames={third}>
        <Scene3 />
      </Sequence>
      <Sequence from={third*3} durationInFrames={DURATION_IN_FRAMES - third*3}>
        <Scene4 />
      </Sequence>
    </AbsoluteFill>
  );
};

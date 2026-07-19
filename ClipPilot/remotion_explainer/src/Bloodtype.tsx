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

import bloodtypeWords from './bloodtype_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1198;

const C = {
  bgDeep: '#0c0e14',
  bgPanel: '#141822',
  gold: '#FFD23F',
  bloodRed: '#E63946',
  cellCrimson: '#B11226',
  antigenMagenta: '#FF3D7F',
  antibodyCyan: '#3FD0E0',
  safeGreen: '#4ADE80',
  ivory: '#F4F1EC',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 124,
  scene3: 349,
  scene4: 634,
  scene5: 862,
  scene6: 1072,
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

// ─── SVG VECTOR COMPONENTS ───────────────────────────────────────────────────
function RBC({ x, y, scale = 1, showMarkers = true, type = 'A' }) {
  // Biconcave disc
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <circle cx={0} cy={0} r={80} fill={C.cellCrimson} />
      <circle cx={0} cy={0} r={40} fill="#8A0E1E" /> {/* Dimple */}
      
      {showMarkers && type === 'A' && (
        <g>
          {/* Gold Keys */}
          {[0, 72, 144, 216, 288].map(angle => (
            <g key={angle} transform={`rotate(${angle}) translate(0, -90)`}>
              <line x1={0} y1={0} x2={0} y2={10} stroke={C.gold} strokeWidth={4} />
              <circle cx={0} cy={-5} r={8} fill={C.gold} />
            </g>
          ))}
        </g>
      )}
      
      {showMarkers && type === 'B' && (
        <g>
          {/* Magenta Triangles */}
          {[0, 72, 144, 216, 288].map(angle => (
            <g key={angle} transform={`rotate(${angle}) translate(0, -90)`}>
              <polygon points="-8,-10 8,-10 0,0" fill={C.antigenMagenta} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Bag slams in (0-12)
  const bagY = spring({ frame: frame - 5, fps, config: { damping: 10, mass: 0.6, stiffness: 200 } });
  
  // Droplet swells
  const dropScale = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 0.5, stiffness: 100 } });
  
  // Badge punches in
  const badgeScale = spring({ frame: frame - 35, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const badgeRot = Math.sin(frame * 0.5) * 8 * Math.max(0, 1 - (frame - 35)*0.05);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* Vignette glow */}
          <circle cx={540} cy={700} r={600} fill={C.bloodRed} opacity={0.1} />

          {/* Blood Bag */}
          <g transform={`translate(540, ${interpolate(bagY, [0, 1], [-1000, 700])})`}>
            {/* Outline */}
            <rect x={-150} y={-250} width={300} height={500} rx={40} fill={C.bloodRed} />
            {/* Label */}
            <rect x={-50} y={-200} width={100} height={350} rx={10} fill={C.ivory} />
            {/* Barcode lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <line key={i} x1={-30} y1={-150 + i*15} x2={30} y2={-150 + i*15} stroke="#333" strokeWidth={4} />
            ))}
            
            {/* Drip chamber */}
            <rect x={-20} y={250} width={40} height={80} rx={10} fill={C.ivory} opacity={0.5} />
            {/* Droplet inside */}
            <circle cx={0} cy={270} r={15 * dropScale} fill={C.cellCrimson} />
            
            {/* Tube */}
            <path d="M 0,330 L 0,800" fill="none" stroke={C.ivory} strokeWidth={8} opacity={0.5} />
          </g>

          {/* Clock ring */}
          <g transform="translate(540, 700)" opacity={0.2}>
            {Array.from({length: 12}).map((_, i) => (
              <line key={i} x1={0} y1={-400} x2={0} y2={-380} stroke={C.ivory} strokeWidth={4} transform={`rotate(${i * 30})`} />
            ))}
            {/* Tick fast 5 notches */}
            {frame > 35 && (
              <path d="M 0,0 L 0,-350" stroke={C.bloodRed} strokeWidth={8} transform={`rotate(${Math.min(5, (frame-35)*0.5) * 30})`} />
            )}
          </g>

          {/* KILL? Badge */}
          {badgeScale > 0.01 && (
            <g transform={`translate(800, 400) scale(${badgeScale}) rotate(${badgeRot})`}>
              <rect x={-120} y={-50} width={240} height={100} rx={50} fill={C.gold} />
              <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={60} fontWeight={900} fontFamily="Poppins, Arial Black">KILL?</text>
            </g>
          )}

          {/* Vein */}
          <path d="M 0,1600 Q 540,1800 1080,1600" fill="none" stroke={C.antibodyCyan} strokeWidth={40} opacity={0.3} />
          <path d="M 0,1600 Q 540,1800 1080,1600" fill="none" stroke={C.cellCrimson} strokeWidth={40} opacity={interpolate(frame, [60, 80], [0, 1], clamp)} />

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: MARKERS ─────────────────────────────────────────────────────────
function SceneMarkers() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide cells left to right (0-30)
  const cellX = interpolate(frame, [0, 30], [-1000, 0], { extrapolateRight: 'clamp' });
  const bob = Math.sin(frame * 0.05) * 20;

  // Scan line (100-140)
  const scanX = interpolate(frame, [100, 140], [100, 600], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform={`translate(${cellX}, ${bob})`}>
            <RBC x={200} y={960} type="A" />
            <RBC x={450} y={960} type="A" />
            <RBC x={700} y={960} type="A" />
          </g>

          {/* Immune memory panel */}
          <g transform="translate(850, 400)">
            <rect x={-150} y={-100} width={300} height={200} rx={30} fill={C.bgPanel} stroke={C.gold} strokeWidth={4} />
            <text x={0} y={-120} textAnchor="middle" fill={C.ivory} fontSize={30} fontWeight={700}>IMMUNE MEMORY</text>
            {/* Matching key silhouette */}
            <circle cx={0} cy={0} r={40} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.3} />
            {frame > 120 && (
              <g transform={`scale(${spring({frame: frame-120, fps, config: {damping: 12, mass: 0.5, stiffness: 200}})})`}>
                <circle cx={0} cy={0} r={40} fill={C.gold} />
                <path d="M -10,0 L 0,10 L 20,-10" fill="none" stroke={C.bgPanel} strokeWidth={6} strokeLinecap="round" />
              </g>
            )}
          </g>

          {/* Scan Line */}
          {frame > 100 && frame < 150 && (
            <line x1={scanX} y1={500} x2={scanX} y2={1400} stroke={C.antibodyCyan} strokeWidth={8} opacity={0.8} />
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: SWARM ───────────────────────────────────────────────────────────
function SceneSwarm() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Swarm rushing in (30-50)
  const swarmIn = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 0.5, stiffness: 180 } });

  // Cells pull together (60-80)
  const pull = spring({ frame: frame - 60, fps, config: { damping: 12, mass: 0.6, stiffness: 160 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960)">
            
            {/* Foreign Cells (Type B) drifting then pulled */}
            <g transform={`translate(${-150 * (1-pull)}, ${-100 * (1-pull)})`}>
              <RBC x={0} y={0} type="B" />
            </g>
            <g transform={`translate(${150 * (1-pull)}, ${-50 * (1-pull)})`}>
              <RBC x={0} y={0} type="B" />
            </g>
            <g transform={`translate(${0 * (1-pull)}, ${150 * (1-pull)})`}>
              <RBC x={0} y={0} type="B" />
            </g>

            {/* Antibodies */}
            {frame > 30 && (
              <g>
                {[0, 120, 240].map(angle => {
                  const dist = interpolate(swarmIn, [0, 1], [800, 100 * (1-pull)]);
                  return (
                    <g key={angle} transform={`rotate(${angle}) translate(0, ${-dist})`}>
                      <path d="M 0,0 L 0,-80 M 0,0 L -40,40 M 0,0 L 40,40" fill="none" stroke={C.antibodyCyan} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  );
                })}
              </g>
            )}

            {/* CLOT Warning */}
            {frame > 90 && (
              <g transform={`scale(${spring({frame: frame-90, fps, config: {damping: 10, mass: 0.5, stiffness: 150}})})`}>
                <circle cx={0} cy={0} r={300} fill="none" stroke={C.gold} strokeWidth={15} />
                <rect x={-120} y={-250} width={240} height={80} rx={40} fill={C.gold} />
                <text x={0} y={-195} textAnchor="middle" fill={C.bgDeep} fontSize={50} fontWeight={900} fontFamily="Poppins, Arial Black">CLOT</text>
              </g>
            )}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: MATCH ───────────────────────────────────────────────────────────
function SceneMatch() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pipette drops
  const pipY = interpolate(frame, [0, 20], [-500, 300], clamp);
  const squeeze = frame > 25 && frame < 35;

  const dropL = interpolate(frame, [35, 50], [300, 800], clamp);
  const dropR = interpolate(frame, [45, 60], [300, 800], clamp);

  const fillL = spring({ frame: frame - 50, fps, config: { damping: 15, mass: 0.5, stiffness: 150 } });
  const fillR = spring({ frame: frame - 60, fps, config: { damping: 15, mass: 0.5, stiffness: 150 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 960)">
            {/* Card Base */}
            <rect x={-400} y={-300} width={800} height={600} rx={50} fill={C.bgPanel} />
            <line x1={0} y1={-300} x2={0} y2={300} stroke={C.gold} strokeWidth={4} />

            {/* Left Well */}
            <circle cx={-200} cy={0} r={150} fill={C.bgDeep} />
            {fillL > 0.01 && <circle cx={-200} cy={0} r={150 * fillL} fill={C.cellCrimson} />}
            {fillL > 0.9 && (
              <g transform={`translate(-200, 0) scale(${spring({frame: frame-65, fps, config: {damping: 10, mass: 0.5, stiffness: 200}})})`}>
                <circle cx={0} cy={0} r={80} fill={C.safeGreen} />
                <path d="M -30,0 L -10,20 L 40,-20" fill="none" stroke={C.ivory} strokeWidth={15} strokeLinecap="round" />
              </g>
            )}

            {/* Right Well */}
            <circle cx={200} cy={0} r={150} fill={C.bgDeep} />
            {fillR > 0.01 && (
              <g transform="translate(200, 0)">
                {/* Granular clump */}
                {Array.from({length: 20}).map((_, i) => (
                  <circle key={i} cx={(Math.random()-0.5)*200} cy={(Math.random()-0.5)*200} r={Math.random()*15 + 5} fill={C.cellCrimson} opacity={fillR} />
                ))}
              </g>
            )}
            {fillR > 0.9 && (
              <g transform={`translate(200, 0) scale(${spring({frame: frame-75, fps, config: {damping: 10, mass: 0.5, stiffness: 200}})})`}>
                <circle cx={0} cy={0} r={80} fill={C.bloodRed} />
                <path d="M -30,-30 L 30,30 M -30,30 L 30,-30" fill="none" stroke={C.ivory} strokeWidth={15} strokeLinecap="round" />
              </g>
            )}

            {/* Pipette */}
            <g transform={`translate(0, ${pipY})`}>
              <path d="M -20,-400 L -20,-100 L -5,0 L 5,0 L 20,-100 L 20,-400 Z" fill={C.ivory} />
              {squeeze && <rect x={-30} y={-300} width={60} height={100} fill={C.bloodRed} opacity={0.5} />}
            </g>

            {/* Droplets */}
            {frame > 35 && frame < 50 && <circle cx={-200} cy={dropL} r={20} fill={C.cellCrimson} />}
            {frame > 45 && frame < 60 && <circle cx={200} cy={dropR} r={20} fill={C.cellCrimson} />}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: ONE BLOOD ───────────────────────────────────────────────────────
function SceneOneBlood() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cellScale = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 0.6, stiffness: 150 } });
  
  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform={`translate(540, 600) scale(${cellScale})`}>
            {/* O-negative cell: larger, smooth, no markers */}
            <circle cx={0} cy={0} r={200} fill={C.cellCrimson} />
            <circle cx={0} cy={0} r={100} fill="#8A0E1E" />
            <circle cx={0} cy={0} r={200} fill="none" stroke={C.safeGreen} strokeWidth={15} opacity={0.8} />

            <g transform="translate(250, -150)">
              <rect x={0} y={0} width={150} height={80} rx={40} fill={C.gold} />
              <text x={75} y={55} textAnchor="middle" fill={C.bgDeep} fontSize={50} fontWeight={900} fontFamily="Poppins, Arial Black">O−</text>
            </g>
          </g>

          {/* Recipients */}
          {[
            {x: 250, y: 1300, delay: 50, color: '#333'},
            {x: 540, y: 1300, delay: 70, color: '#444'},
            {x: 830, y: 1300, delay: 90, color: '#555'}
          ].map((r, i) => {
            const pop = spring({ frame: frame - r.delay, fps, config: { damping: 12, mass: 0.5, stiffness: 180 } });
            return (
              <g key={i} transform={`translate(${r.x}, ${r.y}) scale(${pop})`}>
                <path d="M 0,-150 C 150,-150 150,150 0,150 C -150,150 -150,-150 0,-150 Z" fill="none" stroke={C.gold} strokeWidth={8} opacity={0.6} />
                {/* Heart */}
                <HeartSilhouette scale={0.2} fill={r.color} />
                {/* Check */}
                <g transform="translate(0, 50)">
                  <circle cx={0} cy={0} r={40} fill={C.safeGreen} />
                  <path d="M -15,0 L -5,10 L 15,-10" fill="none" stroke={C.bgDeep} strokeWidth={8} strokeLinecap="round" />
                </g>
              </g>
            );
          })}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// Reuse from bodyheat/defib
function HeartSilhouette({ scale = 1, cx = 0, cy = 0, stroke = 'none', fill = C.cellCrimson, strokeWidth = 8, opacity = 1 }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale}) translate(-540, -750)`} opacity={opacity}>
      <path
        d="M 540,950 C 540,950 320,750 320,550 C 320,420 420,320 540,450 C 660,320 760,420 760,550 C 760,750 540,950 540,950 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const w1 = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w2 = spring({ frame: frame - 30, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w3 = spring({ frame: frame - 50, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w4 = spring({ frame: frame - 70, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform="translate(540, 300) scale(0.6)">
            {/* O-negative cell calm at top */}
            <circle cx={0} cy={0} r={350} fill={C.gold} opacity={0.15 + 0.1 * w1} />
            <circle cx={0} cy={0} r={200} fill={C.cellCrimson} />
            <circle cx={0} cy={0} r={100} fill="#8A0E1E" />
            
            {/* Orbiting green hearts */}
            {frame > 70 && (
              <g transform={`rotate(${(frame - 70)*2})`}>
                {[0, 120, 240].map(angle => (
                  <g key={angle} transform={`rotate(${angle}) translate(0, -300)`}>
                    <HeartSilhouette scale={0.15} fill={C.safeGreen} />
                  </g>
                ))}
              </g>
            )}
          </g>

          <g transform="translate(540, 900)">
            {w1 > 0.01 && <text y={0} textAnchor="middle" fill={C.ivory} fontSize={80} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w1})`}>ONE</text>}
            {w2 > 0.01 && <text y={120} textAnchor="middle" fill={C.ivory} fontSize={90} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w2})`}>BLOOD</text>}
            {w3 > 0.01 && <text y={240} textAnchor="middle" fill={C.ivory} fontSize={100} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w3})`}>SAVES</text>}
            {w4 > 0.01 && <text y={380} textAnchor="middle" fill={C.gold} fontSize={120} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w4})`}>EVERYONE</text>}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Bloodtype: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('bloodtype_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      {/* SFX Placeholders using existing files */}
      <Sequence from={0} durationInFrames={150}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={200}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene3 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_engulf_pop.mp3')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 30} durationInFrames={100}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene5 + 50} durationInFrames={150}>
        <Audio src={staticFile('sfx_chime.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene6 + 70} durationInFrames={100}>
        <Audio src={staticFile('sfx_success.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneHook />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneMarkers />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneSwarm />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneMatch />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneOneBlood />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePayoff />
      </Sequence>
    </AbsoluteFill>
  );
};

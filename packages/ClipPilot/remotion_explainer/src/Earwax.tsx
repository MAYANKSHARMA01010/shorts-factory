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

import earwaxWords from './earwax_words.json';

export const FPS = 30;
export const DURATION_IN_FRAMES = 1207;

const C = {
  bgDeep: '#0e1014',
  bgCanal: '#161a22',
  gold: '#FFD23F',
  waxAmber: '#E89B3B',
  oilGlow: '#F4B860',
  skinPink: '#C98B7A',
  germGreen: '#5BD6A0',
  acidTeal: '#3FC9C9',
  dustGrey: '#8A8F9A',
  dangerRed: '#FF5A52',
  white: '#F5F3EE',
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const S = {
  scene1: 0,
  scene2: 123,
  scene3: 472,
  scene4: 679,
  scene5: 796,
  scene6: 1083,
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

// ─── SCENE 1: HOOK ────────────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Blob springs in
  const blobScale = spring({ frame: frame - 5, fps, config: { damping: 10, mass: 0.8, stiffness: 150 } });
  
  // Badge slams in
  const badgeY = spring({ frame: frame - 20, fps, config: { damping: 12, mass: 0.6, stiffness: 200 } });
  
  // Jiggle
  const jiggle = Math.sin(frame * 0.4) * 5;
  const specX = Math.sin(frame * 0.1) * 10;

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          <g transform={`translate(540, 960) scale(${blobScale})`}>
            {/* Glow */}
            <circle cx={0} cy={0} r={400} fill={C.oilGlow} opacity={0.15} />
            
            {/* Blob */}
            <path 
              d={`M 0,-300 C 300,-300 400,100 200,300 C 0,400 -200,400 -400,200 C -500,-100 -300,-300 0,-300 Z`} 
              fill={C.waxAmber} 
              stroke={C.gold} 
              strokeWidth={8} 
              transform={`scale(${1 + jiggle*0.005}, ${1 - jiggle*0.005})`}
            />
            {/* Specular */}
            <path d="M -150,-150 Q -50,-250 100,-200 Q 0,-150 -150,-150" fill={C.oilGlow} opacity={0.6} transform={`translate(${specX}, 0)`}/>
          </g>

          {/* ON PURPOSE Badge */}
          {badgeY > 0.01 && (
            <g transform={`translate(540, ${interpolate(badgeY, [0, 1], [-200, 960])})`}>
              <rect x={-220} y={-50} width={440} height={100} rx={50} fill={C.gold} />
              <text x={0} y={20} textAnchor="middle" fill={C.bgDeep} fontSize={55} fontWeight={900} fontFamily="Poppins, Arial Black">ON PURPOSE</text>
            </g>
          )}

          {/* Text above */}
          <text x={540} y={450} textAnchor="middle" fill={C.white} fontSize={40} opacity={interpolate(frame, [30, 45], [0, 1], clamp)} fontFamily="Poppins, sans-serif" fontWeight={700}>
            this isn't dirt
          </text>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: GLANDS ──────────────────────────────────────────────────────────
function SceneGlands() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wipe down
  const wipeY = interpolate(frame, [0, 15], [0, 1920], clamp);

  return (
    <AbsoluteFill>
      <Bg color={C.bgDeep} />
      <div style={{ position: 'absolute', top: 0, width: 1080, height: wipeY, overflow: 'hidden' }}>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', top: 0, left: 0 }}>
          
          {/* Canal Walls */}
          <path d="M 0,200 Q 540,400 1080,200 L 1080,0 L 0,0 Z" fill={C.skinPink} opacity={0.4} />
          <path d="M 0,1720 Q 540,1520 1080,1720 L 1080,1920 L 0,1920 Z" fill={C.skinPink} opacity={0.4} />
          <rect x={0} y={0} width={1080} height={1920} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.1} />

          {/* Glands */}
          {[200, 400, 600, 800].map((gx, i) => {
            const pop = spring({ frame: frame - 15 - i*5, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
            // Drop logic
            const dropF = frame - 40 - i*15;
            const dropY = Math.max(0, dropF > 0 ? (dropF * dropF * 0.15) : 0);
            const dropped = dropY > 1000;
            
            return (
              <g key={i} transform={`translate(${gx}, 300)`}>
                <circle cx={0} cy={0} r={60 * pop} fill={C.oilGlow} opacity={0.8} />
                <circle cx={0} cy={40 * pop} r={15} fill={C.bgCanal} /> {/* Pore */}
                
                {dropF > 0 && !dropped && (
                  <circle cx={0} cy={40 + dropY} r={25} fill={C.waxAmber} />
                )}
                {dropF > 0 && !dropped && i === 1 && (
                  <text x={40} y={40 + dropY} fill={C.dustGrey} fontSize={30} fontWeight={700}>oil</text>
                )}
              </g>
            );
          })}

          {/* Skin flakes falling */}
          {[300, 700].map((sx, i) => {
            const rot = frame * 2 + i * 40;
            const y = 300 + (frame - 20) * 8;
            if (y > 1500) return null;
            return (
              <g key={i} transform={`translate(${sx}, ${y}) rotate(${rot})`}>
                <polygon points="-30,-20 20,-30 40,10 -10,40" fill={C.dustGrey} opacity={0.6} />
                {i === 0 && <text x={50} y={0} fill={C.dustGrey} fontSize={30} fontWeight={700}>dead skin</text>}
              </g>
            );
          })}

          {/* Wax Ridge building up on floor */}
          <path d={`M 0,1650 Q 540,1500 1080,1650 L 1080,1920 L 0,1920 Z`} fill={C.waxAmber} opacity={interpolate(frame, [60, 100], [0, 1], clamp)} />
          <path d={`M 0,1630 Q 540,1480 1080,1630 L 1080,1920 L 0,1920 Z`} fill={C.waxAmber} opacity={interpolate(frame, [90, 130], [0, 1], clamp)} />

        </svg>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: FLYPAPER ────────────────────────────────────────────────────────
function SceneFlypaper() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Eardrum breathes
  const drumPulse = 1 + Math.sin(frame * 0.1) * 0.03;

  // Threats fly in and stick
  const fly = (offset: number) => {
    const f = frame - offset;
    if (f < 0) return { x: -200, stuck: false, recoil: 0 };
    if (f < 15) return { x: interpolate(f, [0, 15], [-200, 500]), stuck: false, recoil: 0 };
    return { x: 500, stuck: true, recoil: Math.sin(f*0.5)*10 * Math.max(0, 1 - (f-15)*0.1) };
  };

  const dust = fly(20);
  const germ = fly(24);
  const bug = fly(28);

  const badgeScale = spring({ frame: frame - 45, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg color={C.bgCanal} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* Eardrum on RIGHT */}
          <g transform={`translate(900, 960) scale(${drumPulse})`}>
            <ellipse cx={0} cy={0} rx={120} ry={600} fill={C.white} opacity={0.2} />
            <ellipse cx={0} cy={0} rx={120} ry={600} fill="none" stroke={C.gold} strokeWidth={8} opacity={0.8} />
          </g>

          {/* Wax Sheet in MIDDLE */}
          <path d="M 450,0 Q 550,960 450,1920 L 600,1920 Q 500,960 600,0 Z" fill={C.waxAmber} opacity={0.9} />
          {/* Sticky strands */}
          <path d="M 450,300 Q 520,350 480,500" fill="none" stroke={C.oilGlow} strokeWidth={4} />
          <path d="M 520,1200 Q 450,1300 500,1500" fill="none" stroke={C.oilGlow} strokeWidth={6} />

          {/* Threats */}
          <g transform={`translate(${dust.x + dust.recoil}, 400)`}>
            <polygon points="-40,-30 20,-50 50,10 10,60 -30,40" fill={C.dustGrey} transform={dust.stuck ? "" : "scale(1.5, 0.5)"} />
            {dust.stuck && <path d="M -40,0 L -200,50" stroke={C.waxAmber} strokeWidth={3} />}
          </g>
          
          <g transform={`translate(${germ.x + germ.recoil}, 960)`}>
            <ellipse cx={0} cy={0} rx={60} ry={40} fill={C.germGreen} transform={germ.stuck ? "" : "scale(1.5, 0.5)"} />
            {/* flagella */}
            <path d={`M -60,0 Q -100,20 -150,0`} fill="none" stroke={C.germGreen} strokeWidth={6} transform={`translate(0, ${Math.sin(frame)*10})`} />
            <path d={`M -50,-20 Q -90,-40 -120,-30`} fill="none" stroke={C.germGreen} strokeWidth={4} transform={`translate(0, ${Math.cos(frame)*10})`} />
          </g>

          <g transform={`translate(${bug.x + bug.recoil}, 1400)`}>
            <circle cx={20} cy={0} r={25} fill="#222" />
            <ellipse cx={-30} cy={0} rx={40} ry={30} fill="#111" transform={bug.stuck ? "" : "scale(1.5, 0.5)"} />
            <path d="M 0,-20 Q 20,-60 40,-40" fill="none" stroke="#222" strokeWidth={4} />
            {bug.stuck && <path d="M -30,0 L -200,-50" stroke={C.waxAmber} strokeWidth={3} />}
          </g>

          {/* Badge */}
          {badgeScale > 0.01 && (
            <g transform={`translate(540, 960) scale(${badgeScale})`}>
              <circle cx={0} cy={0} r={180} fill={C.gold} opacity={0.3} />
              <rect x={-200} y={-60} width={400} height={120} rx={30} fill={C.gold} />
              <text x={0} y={25} textAnchor="middle" fill={C.bgDeep} fontSize={65} fontWeight={900} fontFamily="Poppins, Arial Black">TRAPPED</text>
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: ACIDIC ──────────────────────────────────────────────────────────
function SceneAcidic() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Acid bloom (10-30)
  const bloomRadius = interpolate(frame, [10, 30], [0, 1500], clamp);

  // Dissolve germ (25-50)
  const dissolve = interpolate(frame, [25, 50], [1, 0], clamp);
  
  // Checkmark (60+)
  const checkDraw = interpolate(frame, [60, 70], [0, 1], clamp);
  const checkPop = spring({ frame: frame - 70, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <Bg color={C.waxAmber} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* Acid glow washing over */}
          <circle cx={540} cy={960} r={bloomRadius} fill={C.acidTeal} opacity={0.6} />

          {/* Germ */}
          {dissolve > 0 && (
            <g transform="translate(540, 960)">
              <ellipse cx={0} cy={0} rx={180 * dissolve} ry={120 * dissolve} fill={C.germGreen} />
              {/* Fizzing bubbles */}
              {frame > 25 && frame < 60 && Array.from({length: 10}).map((_, i) => (
                <circle 
                  key={i} 
                  cx={(Math.random() - 0.5) * 400 * (1-dissolve)} 
                  cy={(Math.random() - 0.5) * 400 * (1-dissolve) - (frame-25)*5} 
                  r={Math.random() * 20} 
                  fill={C.acidTeal} 
                />
              ))}
            </g>
          )}

          {/* pH ACID badge */}
          <g transform="translate(200, 200)">
            <rect x={0} y={0} width={250} height={80} rx={15} fill={C.bgDeep} stroke={C.acidTeal} strokeWidth={4} />
            <text x={125} y={55} textAnchor="middle" fill={C.acidTeal} fontSize={40} fontWeight={900} fontFamily="Poppins, Arial Black">pH ACID</text>
          </g>

          {/* Gold Checkmark */}
          {frame > 60 && (
            <g transform={`translate(540, 960) scale(${1 + checkPop*0.2})`}>
              <path 
                d="M -50,0 L -10,40 L 60,-40" 
                fill="none" 
                stroke={C.gold} 
                strokeWidth={30} 
                strokeLinecap="round" 
                strokeLinejoin="round"
                strokeDasharray="300"
                strokeDashoffset={300 * (1 - checkDraw)}
              />
            </g>
          )}

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: JAW MOVES ───────────────────────────────────────────────────────
function SceneJaw() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Jaw chew (every 40 frames)
  const chew = Math.sin(frame * 0.15);
  const jawAngle = chew > 0 ? chew * 15 : 0;

  // Wax migrating out
  const waxX = interpolate(frame, [0, 200], [400, 1100], { extrapolateRight: 'extend' });

  return (
    <AbsoluteFill>
      <Bg color={C.bgDeep} />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* Head Profile Line Art */}
          <path d="M 300,400 Q 500,200 700,400 L 700,800 Q 500,900 400,1200" fill="none" stroke={C.gold} strokeWidth={10} />
          {/* Ear outline */}
          <path d="M 700,600 C 900,500 900,900 700,900" fill="none" stroke={C.gold} strokeWidth={10} />
          
          {/* Jaw */}
          <g transform={`translate(550, 900) rotate(${jawAngle})`}>
            <path d="M 0,0 L -150,300 L 150,400 Z" fill="none" stroke={C.gold} strokeWidth={8} opacity={0.6} />
            <circle cx={0} cy={0} r={15} fill={C.gold} /> {/* Pivot */}
          </g>

          {/* Ear Canal */}
          <path d="M 700,700 L 300,700 L 300,850 L 700,850" fill="none" stroke={C.skinPink} strokeWidth={8} opacity={0.4} />

          {/* Chevron Conveyor */}
          <g opacity={0.3}>
            {[400, 500, 600].map(cx => (
              <path key={cx} d={`M ${cx},750 L ${cx+20},775 L ${cx},800`} fill="none" stroke={C.gold} strokeWidth={6} />
            ))}
          </g>

          {/* Migrating Wax Plug */}
          <g transform={`translate(${waxX}, 775)`}>
            <ellipse cx={0} cy={0} rx={80} ry={60} fill={C.waxAmber} />
            {/* Embedded junk */}
            <circle cx={-30} cy={-20} r={10} fill={C.dustGrey} />
            <circle cx={10} cy={30} r={15} fill={C.germGreen} />
            <circle cx={40} cy={-10} r={8} fill="#222" />
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: PAYOFF ──────────────────────────────────────────────────────────
function ScenePayoff() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pendulum sway
  const sway = Math.sin(frame * 0.1) * 15;

  // Word slams (10, 35, 60)
  const w1 = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w2 = spring({ frame: frame - 35, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });
  const w3 = spring({ frame: frame - 60, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } });

  // Line sweeps
  const lineDraw = interpolate(frame, [80, 100], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg />
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          
          {/* Ear Glyph & Flypaper Strand */}
          <g transform={`translate(540, 300)`}>
            <path d="M -50,-50 C -150,-150 150,-150 50,-50 Z" fill={C.gold} />
            <g transform={`rotate(${sway})`}>
              <path d="M 0,0 L 0,200" stroke={C.waxAmber} strokeWidth={15} strokeLinecap="round" />
              <circle cx={0} cy={180} r={10} fill={C.dustGrey} />
            </g>
          </g>

          {/* Punchline */}
          <g transform="translate(540, 960)">
            {w1 > 0.01 && (
              <text x={0} y={-100} textAnchor="middle" fill={C.white} fontSize={80} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w1})`}>
                YOUR EAR
              </text>
            )}
            
            {w2 > 0.01 && (
              <g transform={`scale(${w2})`}>
                <text x={0} y={20} textAnchor="middle" fill={C.gold} fontSize={110} fontWeight={900} fontFamily="Poppins, Arial Black">
                  CLEANS
                </text>
                <circle cx={0} cy={-10} r={200 * Math.max(0, 1 - (frame-35)*0.1)} fill={C.gold} opacity={0.2} />
              </g>
            )}
            
            {w3 > 0.01 && (
              <text x={0} y={130} textAnchor="middle" fill={C.white} fontSize={90} fontWeight={900} fontFamily="Poppins, Arial Black" transform={`scale(${w3})`}>
                ITSELF
              </text>
            )}

            {/* Gold Underline */}
            {frame > 80 && (
              <path 
                d="M -250,180 L 250,180" 
                fill="none" 
                stroke={C.gold} 
                strokeWidth={15} 
                strokeLinecap="round"
                strokeDasharray="500"
                strokeDashoffset={500 * (1 - lineDraw)}
              />
            )}
          </g>

        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

// ─── MASTER COMPOSITION ───────────────────────────────────────────────────────
export const Earwax: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <Audio src={staticFile('earwax_narration.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.12} />

      <Sequence from={0} durationInFrames={150}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={200}>
        <Audio src={staticFile('sfx_plip.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={S.scene3 + 20} durationInFrames={100}>
        <Audio src={staticFile('sfx_smack.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={S.scene4 + 20} durationInFrames={150}>
        <Audio src={staticFile('sfx_digital.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={250}>
        <Audio src={staticFile('sfx_click.wav')} volume={0.3} />
      </Sequence>
      <Sequence from={S.scene6 + 35} durationInFrames={150}>
        <Audio src={staticFile('sfx_success.wav')} volume={0.6} />
      </Sequence>

      <Sequence from={S.scene1} durationInFrames={S.scene2 - S.scene1}>
        <SceneHook />
      </Sequence>
      <Sequence from={S.scene2} durationInFrames={S.scene3 - S.scene2}>
        <SceneGlands />
      </Sequence>
      <Sequence from={S.scene3} durationInFrames={S.scene4 - S.scene3}>
        <SceneFlypaper />
      </Sequence>
      <Sequence from={S.scene4} durationInFrames={S.scene5 - S.scene4}>
        <SceneAcidic />
      </Sequence>
      <Sequence from={S.scene5} durationInFrames={S.scene6 - S.scene5}>
        <SceneJaw />
      </Sequence>
      <Sequence from={S.scene6} durationInFrames={DURATION_IN_FRAMES - S.scene6}>
        <ScenePayoff />
      </Sequence>
    </AbsoluteFill>
  );
};

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadSans} from '@remotion/google-fonts/Oswald';

const {fontFamily: SERIF} = loadFont('normal', {weights: ['700', '800', '900']});
const {fontFamily: SANS} = loadSans('normal', {weights: ['400', '500', '600', '700']});

export const FPS = 30;
export const DURATION_IN_FRAMES = 1382;

type Scene = {
  start: number;
  end: number;
  image: string;
  hook: string;
  caption: string;
  align?: 'left' | 'center' | 'right';
  focusX?: number;
  focusY?: number;
  zoomStart?: number;
  zoomEnd?: number;
};

const scenes: Scene[] = [
  {
    start: 0,
    end: 102,
    image: 'elephant/scene_05.png',
    hook: 'SHE REMEMBERED HIM\nFOR DECADES',
    caption: 'The elephant recognized him instantly.',
    align: 'center',
    focusX: 0.52,
    focusY: 0.43,
    zoomStart: 1.02,
    zoomEnd: 1.13,
  },
  {
    start: 102,
    end: 259,
    image: 'elephant/scene_01.png',
    hook: 'THE FIRST DAY,\nSHE CHOSE HIM',
    caption: 'When he guided her inside, she pressed her forehead against him.',
    align: 'left',
    focusX: 0.48,
    focusY: 0.46,
    zoomStart: 1.0,
    zoomEnd: 1.12,
  },
  {
    start: 259,
    end: 397,
    image: 'elephant/scene_02.png',
    hook: 'HE BECAME\nHER KEEPER',
    caption: 'From that moment on, he was responsible for her care.',
    align: 'right',
    focusX: 0.55,
    focusY: 0.48,
    zoomStart: 1.01,
    zoomEnd: 1.1,
  },
  {
    start: 397,
    end: 598,
    image: 'elephant/scene_02.png',
    hook: "EVEN RETIREMENT\nCOULDN'T ERASE IT",
    caption: 'For years she followed his voice, and neither of them forgot.',
    align: 'left',
    focusX: 0.52,
    focusY: 0.42,
    zoomStart: 1.08,
    zoomEnd: 1.18,
  },
  {
    start: 598,
    end: 783,
    image: 'elephant/scene_03.png',
    hook: 'THEN HE MADE\nONE FINAL REQUEST',
    caption: 'When the old keeper learned he was dying, he asked to see her again.',
    align: 'center',
    focusX: 0.58,
    focusY: 0.42,
    zoomStart: 1.04,
    zoomEnd: 1.14,
  },
  {
    start: 783,
    end: 968,
    image: 'elephant/scene_04.png',
    hook: 'THEY BROUGHT HIM\nBACK TO HER',
    caption: 'Volunteers wheeled his bed to the zoo for one last visit.',
    align: 'center',
    focusX: 0.5,
    focusY: 0.45,
    zoomStart: 1.01,
    zoomEnd: 1.1,
  },
  {
    start: 968,
    end: 1188,
    image: 'elephant/scene_05.png',
    hook: 'SHE REACHED OUT\nSO HE COULD HOLD ON',
    caption: 'She extended her trunk, and he held it like an old friend.',
    align: 'center',
    focusX: 0.5,
    focusY: 0.39,
    zoomStart: 1.03,
    zoomEnd: 1.17,
  },
  {
    start: 1188,
    end: DURATION_IN_FRAMES,
    image: 'elephant/scene_06.png',
    hook: 'TWO DAYS LATER,\nHE WAS GONE',
    caption: 'After whispering goodbye to his beloved friend, he passed away two days later.',
    align: 'center',
    focusX: 0.48,
    focusY: 0.43,
    zoomStart: 1.02,
    zoomEnd: 1.08,
  },
];

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const SceneImage: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const local = frame;
  const duration = scene.end - scene.start;
  const enter = spring({frame: local, fps: FPS, config: {damping: 200, stiffness: 120}});
  const exit = interpolate(local, [duration - 12, duration], [1, 0], clamp);
  const opacity = Math.min(enter, exit);
  const zoom = interpolate(local, [0, duration], [scene.zoomStart ?? 1.02, scene.zoomEnd ?? 1.12], clamp);
  const driftX = interpolate(local, [0, duration], [0, ((scene.focusX ?? 0.5) - 0.5) * -220], clamp);
  const driftY = interpolate(local, [0, duration], [0, ((scene.focusY ?? 0.45) - 0.5) * -180], clamp);
  const flash = interpolate(local, [0, 4, 9], [0.42, 0, 0], clamp);

  return (
    <AbsoluteFill style={{opacity}}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom}) translate(${driftX}px, ${driftY}px)`,
        }}
      >
        <Img
          src={staticFile(scene.image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(6,8,10,0.72) 0%, rgba(6,8,10,0.10) 28%, rgba(6,8,10,0.18) 55%, rgba(6,8,10,0.78) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,233,180,0.12) 0%, rgba(255,233,180,0.04) 26%, rgba(0,0,0,0) 62%)',
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(255,255,255,${flash})`,
        }}
      />
    </AbsoluteFill>
  );
};

const HookText: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const local = frame;
  const inAnim = spring({frame: local - 4, fps: FPS, config: {damping: 170, stiffness: 120}});
  const outAnim = interpolate(local, [scene.end - scene.start - 14, scene.end - scene.start], [1, 0], clamp);
  const opacity = Math.min(inAnim, outAnim);
  const textAlign = scene.align ?? 'center';
  const justify =
    textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
  const padding =
    textAlign === 'left'
      ? '0 100px 0 70px'
      : textAlign === 'right'
        ? '0 70px 0 100px'
        : '0 70px';

  return (
    <div
      style={{
        position: 'absolute',
        top: 84,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: justify,
        padding,
        opacity,
        transform: `translateY(${interpolate(inAnim, [0, 1], [30, 0])}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 930,
          textAlign,
          color: 'white',
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 92,
          lineHeight: 0.95,
          letterSpacing: 0,
          textTransform: 'uppercase',
          textShadow: '0 5px 0 rgba(0,0,0,0.62), 0 0 20px rgba(0,0,0,0.45)',
        }}
      >
        {scene.hook.split('\n').map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
};

const FooterCaption: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const local = frame;
  const lift = spring({frame: local - 8, fps: FPS, config: {damping: 200}});
  const opacity = Math.min(lift, interpolate(local, [scene.end - scene.start - 12, scene.end - scene.start], [1, 0], clamp));

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        right: 54,
        bottom: 92,
        opacity,
        transform: `translateY(${interpolate(lift, [0, 1], [24, 0])}px)`,
      }}
    >
      <div
        style={{
          background: 'rgba(5,7,9,0.48)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 24,
          padding: '22px 28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
        }}
      >
        <div
          style={{
            color: 'rgba(255,255,255,0.92)',
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 42,
            lineHeight: 1.18,
            textAlign: 'center',
          }}
        >
          {scene.caption}
        </div>
      </div>
    </div>
  );
};

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, DURATION_IN_FRAMES], [0, 920], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        top: 38,
        left: 80,
        width: 920,
        height: 6,
        background: 'rgba(255,255,255,0.16)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width,
          height: '100%',
          background: 'linear-gradient(90deg, #f6d182 0%, #fff5cf 100%)',
          borderRadius: 999,
        }}
      />
    </div>
  );
};

export const ElephantKeeper: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const grainOpacity = 0.035 + 0.012 * Math.sin(frame / (fps / 3));

  return (
    <AbsoluteFill style={{backgroundColor: '#090807'}}>
      <Audio src={staticFile('elephant/narration.wav')} />
      <Audio src={staticFile('elephant/music.wav')} volume={0.15} />

      {scenes.map((scene) => (
        <Sequence key={scene.start} from={scene.start} durationInFrames={scene.end - scene.start}>
          <SceneImage scene={scene} />
          <HookText scene={scene} />
          <FooterCaption scene={scene} />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 32%, rgba(255,244,214,0.08) 0%, rgba(255,244,214,0.03) 22%, rgba(0,0,0,0) 55%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.26) 100%)',
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '3px 3px, 3px 3px',
          opacity: grainOpacity,
          mixBlendMode: 'soft-light',
          pointerEvents: 'none',
        }}
      />

      <Progress />
    </AbsoluteFill>
  );
};

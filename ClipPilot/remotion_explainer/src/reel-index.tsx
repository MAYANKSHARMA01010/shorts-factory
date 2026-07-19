/**
 * Separate Remotion entry point for the StyledReel composition.
 * Kept apart from the project's main src/index.ts so it never collides with
 * the explainer compositions. Render with:
 *   npx remotion render src/reel-index.ts StyledReel out.mp4 --props=props.json
 *
 * All metadata (dimensions, fps, duration) comes from inputProps via
 * calculateMetadata, so the same composition adapts to any input video.
 */
import {Composition, registerRoot} from 'remotion';
import {StyledReel} from './StyledReel';

const Root: React.FC = () => {
  return (
    <Composition
      id="StyledReel"
      component={StyledReel as any}
      // placeholder defaults; real values come from inputProps
      durationInFrames={1300}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{videoSrc: '', phrases: [] as any, contact: [] as string[]}}
      calculateMetadata={({props}: any) => {
        const fps = props.fps ?? 30;
        return {
          durationInFrames: props.durationInFrames ?? 1300,
          fps,
          width: props.width ?? 720,
          height: props.height ?? 1280,
        };
      }}
    />
  );
};

registerRoot(Root);

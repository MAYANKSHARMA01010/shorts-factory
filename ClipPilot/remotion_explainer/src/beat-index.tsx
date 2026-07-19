// Isolated Remotion entry for the ultimate-short 3D beat renderer.
// Keeps the per-beat composition out of the big Root.tsx. Render with:
//   npx remotion render src/beat-index.tsx BeatClip <out> --props=./props/<name>.json
import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {BeatClip, calculateBeatMetadata, defaultBeatProps} from './BeatClip';

const BeatRoot: React.FC = () => {
  return (
    <Composition
      id="BeatClip"
      component={BeatClip}
      durationInFrames={defaultBeatProps.durationInFrames}
      fps={defaultBeatProps.fps}
      width={defaultBeatProps.width}
      height={defaultBeatProps.height}
      defaultProps={defaultBeatProps}
      calculateMetadata={calculateBeatMetadata}
    />
  );
};

registerRoot(BeatRoot);

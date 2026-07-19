// Real-geometry 3D beat clip for the ultimate-short pipeline (Remotion + React-Three-Fiber).
// Rendered headless via:  npx remotion render src/beat-index.tsx BeatClip <out> --props=./props/<name>.json
// All motion is driven by useCurrentFrame()/fps so headless frames are deterministic (never frozen).
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';

export type BeatProps = {
  subject: string;
  kind: string; // molecule | planet | abstract
  bg: string;
  shapeColor: string;
  accentColor: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
};

export const defaultBeatProps: BeatProps = {
  subject: 'structure',
  kind: 'abstract',
  bg: '#0D1B2A',
  shapeColor: '#4cc9f0',
  accentColor: '#f72585',
  durationInFrames: 90,
  fps: 30,
  width: 1080,
  height: 1920,
};

export const calculateBeatMetadata = ({props}: {props: BeatProps}) => ({
  durationInFrames: Math.max(1, Math.round(props.durationInFrames ?? 90)),
  fps: props.fps ?? 30,
  width: props.width ?? 1080,
  height: props.height ?? 1920,
});

const Bond: React.FC<{from: [number, number, number]; to: [number, number, number]; color: string}> = ({
  from,
  to,
  color,
}) => {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  const e = new THREE.Euler().setFromQuaternion(quat);
  return (
    <mesh position={mid.toArray() as [number, number, number]} rotation={[e.x, e.y, e.z]}>
      <cylinderGeometry args={[0.08, 0.08, len, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
    </mesh>
  );
};

const Molecule: React.FC<{shape: string; accent: string}> = ({shape, accent}) => {
  const atoms: [number, number, number][] = [
    [0, 0, 0],
    [1.7, 0.3, 0.2],
    [-1.5, 0.6, -0.3],
    [0.3, -1.6, 0.4],
    [-0.4, 1.5, 0.5],
  ];
  return (
    <group>
      {atoms.map((p, i) => (
        <mesh key={`a${i}`} position={p}>
          <sphereGeometry args={[i === 0 ? 0.75 : 0.45, 48, 48]} />
          <meshStandardMaterial color={i === 0 ? accent : shape} roughness={0.25} metalness={0.25} />
        </mesh>
      ))}
      {atoms.slice(1).map((p, i) => (
        <Bond key={`b${i}`} from={[0, 0, 0]} to={p} color="#dfe6ee" />
      ))}
    </group>
  );
};

const Planet: React.FC<{shape: string; accent: string}> = ({shape, accent}) => (
  <group>
    <mesh>
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshStandardMaterial color={shape} roughness={0.6} metalness={0.2} />
    </mesh>
    <mesh rotation={[Math.PI / 2.3, 0, 0]}>
      <torusGeometry args={[2.4, 0.09, 16, 96]} />
      <meshStandardMaterial color={accent} roughness={0.4} />
    </mesh>
  </group>
);

const Abstract: React.FC<{shape: string; accent: string}> = ({shape, accent}) => (
  <group>
    <mesh>
      <icosahedronGeometry args={[1.6, 1]} />
      <meshStandardMaterial color={shape} roughness={0.3} metalness={0.35} flatShading />
    </mesh>
    <mesh>
      <torusKnotGeometry args={[2.3, 0.06, 160, 16]} />
      <meshStandardMaterial color={accent} roughness={0.4} />
    </mesh>
  </group>
);

export const BeatClip: React.FC<BeatProps> = (props) => {
  const {subject, kind, bg, shapeColor, accentColor} = {...defaultBeatProps, ...props};
  // keep the on-screen label short so it doesn't wrap awkwardly over the geometry
  const label = (subject || '').split(/\s+/).slice(0, 4).join(' ');
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const yaw = t * 0.7;
  const pitch = Math.sin(t * 0.6) * 0.25;

  let geo: React.ReactNode;
  if (kind === 'molecule') geo = <Molecule shape={shapeColor} accent={accentColor} />;
  else if (kind === 'planet') geo = <Planet shape={shapeColor} accent={accentColor} />;
  else geo = <Abstract shape={shapeColor} accent={accentColor} />;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${shadeUp(bg)} 0%, ${bg} 60%, #000 100%)`,
      }}
    >
      <ThreeCanvas
        width={props.width ?? 1080}
        height={props.height ?? 1920}
        camera={{position: [0, 0, 7], fov: 45}}
        style={{position: 'absolute', inset: 0}}
        gl={{alpha: true, antialias: true}}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[3, 6, 6]} intensity={1.6} color="#ffffff" />
        <pointLight position={[6, 7, 6]} intensity={2.0} color={accentColor} />
        <pointLight position={[-6, -4, 4]} intensity={1.3} color={shapeColor} />
        <group rotation={[pitch, yaw, 0]}>{geo}</group>
      </ThreeCanvas>
      {label ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: 150,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              color: '#ffffff',
              opacity: 0.82,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

function shadeUp(hex: string): string {
  const h = (hex || '#0D1B2A').replace('#', '');
  if (h.length !== 6) return '#16324a';
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + 30);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + 36);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + 44);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

import sys
import json
import random
from pathlib import Path

def generate_tsx(slug, class_name, duration, words_file):
    colors = [
        ['#1abc9c', '#16a085', '#2ecc71', '#27ae60'],
        ['#3498db', '#2980b9', '#9b59b6', '#8e44ad'],
        ['#f1c40f', '#f39c12', '#e67e22', '#d35400'],
        ['#e74c3c', '#c0392b', '#bdc3c7', '#7f8c8d'],
        ['#0D1B2A', '#1B263B', '#415A77', '#778DA9'],
        ['#FF9F1C', '#FFBF69', '#FFFFFF', '#CBF3F0'],
        ['#000000', '#14213D', '#FCA311', '#E5E5E5'],
        ['#2C3E50', '#E74C3C', '#ECF0F1', '#3498DB'],
        ['#5B2C6F', '#8E44AD', '#D2B4DE', '#F5EEF8'],
        ['#1A5276', '#2980B9', '#A9CCE3', '#EAF2F8'],
        ['#0B5345', '#16A085', '#A3E4D7', '#E8F8F5'],
        ['#FF0054', '#9E0059', '#390099', '#FFBD00'],
        ['#3D5A80', '#98C1D9', '#E0FBFC', '#EE6C4D'],
        ['#264653', '#2A9D8F', '#E9C46A', '#F4A261'],
        ['#8ECAE6', '#219EBC', '#023047', '#FFB703'],
    ]
    pal = random.choice(colors)
    bg = pal[0]
    fg1 = pal[1]
    fg2 = pal[2]
    fg3 = pal[3]

    template = """import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Sequence, Audio, staticFile } from 'remotion';

export const FPS = 30;
export const DURATION_IN_FRAMES = DURATION_VAL;

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
    <AbsoluteFill style={{ backgroundColor: 'BG_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) rotate(${r})`}>
             <rect x={-400} y={-400} width={800} height={800} fill="FG1_COLOR" rx={100} />
             <circle cx={0} cy={0} r={200} fill="FG2_COLOR" />
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
    <AbsoluteFill style={{ backgroundColor: 'FG2_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <circle cx={s} cy={-s} r={300} fill="FG3_COLOR" />
             <circle cx={-s} cy={s} r={300} fill="BG_COLOR" />
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
    <AbsoluteFill style={{ backgroundColor: 'FG3_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
             <polygon points="0,-400 300,200 -300,200" fill="FG1_COLOR" transform={`translate(0, ${y})`} />
             <polygon points="0,-200 150,100 -150,100" fill="BG_COLOR" transform={`translate(0, ${-y})`} />
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
    <AbsoluteFill style={{ backgroundColor: 'BG_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${scale})`}>
             <path d="M -200,0 A 200,200 0 1,0 200,0 A 200,200 0 1,0 -200,0" fill="none" stroke="FG2_COLOR" strokeWidth={50} strokeDasharray="100 50" />
             <path d="M -100,0 A 100,100 0 1,0 100,0 A 100,100 0 1,0 -100,0" fill="none" stroke="FG3_COLOR" strokeWidth={30} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene5() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: 'FG1_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            {[...Array(20)].map((_, i) => {
              const r = 50 + i * 40;
              const dash = f * (i % 2 === 0 ? 2 : -2);
              return <circle key={i} cx={0} cy={0} r={r} fill="none" stroke={i % 2 === 0 ? 'FG3_COLOR' : 'BG_COLOR'} strokeWidth={15} strokeDasharray="20 40" strokeDashoffset={dash} />
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
    <AbsoluteFill style={{ backgroundColor: 'FG3_COLOR' }}>
      <SceneWrap>
        <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', height: '100%' }}>
          {[...Array(48)].map((_, i) => {
            const sc = 0.5 + Math.abs(Math.sin((f + i * 5) * 0.05));
            return (
              <div key={i} style={{ width: '16.66%', height: '12.5%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                 <div style={{ width: 100 * sc, height: 100 * sc, backgroundColor: i % 3 === 0 ? 'BG_COLOR' : 'FG2_COLOR', borderRadius: i % 2 === 0 ? '50%' : '10%' }} />
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
    <AbsoluteFill style={{ backgroundColor: 'BG_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            {[...Array(8)].map((_, i) => {
               const angle = (i * 45 + r) * (Math.PI / 180);
               const x = Math.cos(angle) * 300;
               const y = Math.sin(angle) * 300;
               return <circle key={i} cx={x} cy={y} r={100} fill="FG1_COLOR" />
            })}
            <circle cx={0} cy={0} r={150} fill="FG2_COLOR" />
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
    <AbsoluteFill style={{ backgroundColor: 'FG2_COLOR', overflow: 'hidden' }}>
      <SceneWrap>
         {[...Array(10)].map((_, i) => (
           <div key={i} style={{ position: 'absolute', top: i * 200, left: -200 + ((i % 2 === 0 ? offset : -offset) % 1500), width: 1500, height: 100, backgroundColor: 'FG1_COLOR', transform: 'skewX(-20deg)' }} />
         ))}
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene9() {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, 60], [1, 3], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{ backgroundColor: 'FG3_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960) scale(${sc}) rotate(${f})`}>
            <rect x={-200} y={-200} width={400} height={400} fill="BG_COLOR" />
            <rect x={-150} y={-150} width={300} height={300} fill="FG1_COLOR" transform={`rotate(${f * 2})`} />
            <rect x={-100} y={-100} width={200} height={200} fill="FG2_COLOR" transform={`rotate(${f * 3})`} />
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
    <AbsoluteFill style={{ backgroundColor: 'BG_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <path d={`M 0,${960+y} Q 270,${960-y} 540,960 T 1080,${960-y} L 1080,1920 L 0,1920 Z`} fill="FG1_COLOR" />
          <path d={`M 0,${1200-y} Q 270,${1200+y} 540,1200 T 1080,${1200+y} L 1080,1920 L 0,1920 Z`} fill="FG3_COLOR" />
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

function Scene11() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: 'FG1_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
           {[...Array(50)].map((_, i) => {
             const cx = (i * 137) % 1080;
             const cy = (i * 223 + f * 5) % 1920;
             return <circle key={i} cx={cx} cy={cy} r={Math.random() * 20 + 10} fill="FG2_COLOR" opacity={0.7} />
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
    <AbsoluteFill style={{ backgroundColor: 'FG2_COLOR' }}>
      <SceneWrap>
        <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(540, 960)`}>
            <polygon points="0,-300 260,150 -260,150" fill="BG_COLOR" transform={`rotate(${r})`} />
            <polygon points="0,-200 173,100 -173,100" fill="FG3_COLOR" transform={`rotate(${-r})`} />
          </g>
        </svg>
      </SceneWrap>
    </AbsoluteFill>
  );
}

export const CLASS_NAME: React.FC = () => {
SCENE_SEQUENCE
};
"""

    scenes_available = [
        "<Scene1 />", "<Scene2 />", "<Scene3 />", "<Scene4 />",
        "<Scene5 />", "<Scene6 />", "<Scene7 />", "<Scene8 />",
        "<Scene9 />", "<Scene10 />", "<Scene11 />", "<Scene12 />"
    ]
    
    # We want to change scenes every ~3 seconds (90 frames)
    frames_per_scene = 90
    num_scenes = max(1, duration // frames_per_scene)
    if duration % frames_per_scene > 45:
        num_scenes += 1
        
    scene_sequence = ""
    scene_sequence += f"  return (\n"
    scene_sequence += f"    <AbsoluteFill style={{{{ backgroundColor: '{bg}' }}}}>\n"
    scene_sequence += f"      <Audio src={{staticFile('{slug}_narration.mp3')}} />\n"
    scene_sequence += f"      <Audio src={{staticFile('music.mp3')}} volume={{0.12}} />\n"

    current_frame = 0
    for i in range(num_scenes):
        chosen = random.choice(scenes_available)
        dur = frames_per_scene
        if i == num_scenes - 1:
            dur = duration - current_frame
        
        scene_sequence += f"      <Sequence from={{{current_frame}}} durationInFrames={{{dur}}}>\n"
        scene_sequence += f"        {chosen}\n"
        scene_sequence += f"      </Sequence>\n"
        current_frame += dur

    scene_sequence += f"    </AbsoluteFill>\n"
    scene_sequence += f"  );\n"

    tsx = template.replace("BG_COLOR", bg)
    tsx = tsx.replace("FG1_COLOR", fg1)
    tsx = tsx.replace("FG2_COLOR", fg2)
    tsx = tsx.replace("FG3_COLOR", fg3)
    tsx = tsx.replace("DURATION_VAL", str(duration))
    tsx = tsx.replace("CLASS_NAME", class_name)
    tsx = tsx.replace("SCENE_SEQUENCE", scene_sequence)
    return tsx

def main():
    root = Path("src/Root.tsx")
    root_content = root.read_text(encoding="utf-8")
    
    with open("render_batch_v2.bat", "w") as f_bat:
        # We only want transcripts 064 to 100 as per instructions
        for json_path in Path("src").glob("*_words.json"):
            slug = json_path.stem.replace("_words", "")
            try:
                num = int(slug.upper().replace("T", ""))
                if num < 64 or num > 200:
                    continue
            except:
                continue

            class_name = slug.capitalize()
            if f'id="{class_name}"' in root_content:
                print(f"Skipping {class_name}, already in Root.tsx (You might want to manually remove if regenerating)")
                # If we are regenerating, we should probably still write the .tsx file just in case it's an old version?
                # Actually, the requirement was to run for 64-100. The user said: "old animations were not enaging that's why i deleted them and gave yourework".
                # So we should probably generate them anyway and skip Root.tsx injection if it's there.
            
            data = json.loads(json_path.read_text(encoding="utf-8"))
            if "words" in data:
                words = data["words"]
            else:
                words = data
            end_time = words[-1]["end"]
            duration = int(end_time * 30) + 30
            
            tsx_code = generate_tsx(slug, class_name, duration, json_path.name)
            (Path("src") / f"{class_name}.tsx").write_text(tsx_code, encoding="utf-8")
            
            # Inject into Root.tsx
            import_statement = f"import {{{class_name}, FPS as {class_name.upper()}_FPS, DURATION_IN_FRAMES as {class_name.upper()}_DURATION}} from './{class_name}';\n"
            comp_statement = f"""      <Composition
        id="{class_name}"
        component={{{class_name}}}
        durationInFrames={{{class_name.upper()}_DURATION}}
        fps={{{class_name.upper()}_FPS}}
        width={{1080}}
        height={{1920}}
      />\n"""
            
            if import_statement not in root_content:
                last_import_idx = root_content.rfind("import ")
                next_newline = root_content.find("\n", last_import_idx)
                root_content = root_content[:next_newline+1] + import_statement + root_content[next_newline+1:]
                
            if f'id="{class_name}"' not in root_content:
                end_idx = root_content.rfind("</>")
                root_content = root_content[:end_idx] + comp_statement + root_content[end_idx:]
                
            f_bat.write(f'call pipeline.bat {class_name} {slug} "R_AUTO_V2 - {class_name}"\n')
            print(f"Generated {class_name}.tsx and batched.")
            
    root.write_text(root_content, encoding="utf-8")
    print("Updated Root.tsx")

if __name__ == "__main__":
    main()

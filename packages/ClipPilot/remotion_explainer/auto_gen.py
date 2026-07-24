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
    ]
    pal = random.choice(colors)
    bg = pal[0]
    fg1 = pal[1]
    fg2 = pal[2]
    fg3 = pal[3]

    template = """import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, Sequence, Audio, staticFile } from 'remotion';
import wordsData from './WORDS_FILE';

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

export const CLASS_NAME: React.FC = () => {
  const third = Math.floor(DURATION_IN_FRAMES / 4);
  return (
    <AbsoluteFill style={{ backgroundColor: 'BG_COLOR' }}>
      <Audio src={staticFile('SLUG_narration.mp3')} />
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
"""
    tsx = template.replace("BG_COLOR", bg)
    tsx = tsx.replace("FG1_COLOR", fg1)
    tsx = tsx.replace("FG2_COLOR", fg2)
    tsx = tsx.replace("FG3_COLOR", fg3)
    tsx = tsx.replace("WORDS_FILE", words_file)
    tsx = tsx.replace("DURATION_VAL", str(duration))
    tsx = tsx.replace("CLASS_NAME", class_name)
    tsx = tsx.replace("SLUG", slug)
    return tsx

def main():
    root = Path("src/Root.tsx")
    root_content = root.read_text(encoding="utf-8")
    
    with open("render_rest_2.bat", "w") as f_bat:
        for json_path in Path("src").glob("*_words.json"):
            slug = json_path.stem.replace("_words", "")
            # Skip ones already in Root.tsx
            class_name = slug.capitalize()
            if f'id="{class_name}"' in root_content:
                continue
            
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
                # insert after last import
                last_import_idx = root_content.rfind("import ")
                next_newline = root_content.find("\n", last_import_idx)
                root_content = root_content[:next_newline+1] + import_statement + root_content[next_newline+1:]
                
            if f'id="{class_name}"' not in root_content:
                # insert before </>
                end_idx = root_content.rfind("</>")
                root_content = root_content[:end_idx] + comp_statement + root_content[end_idx:]
                
            f_bat.write(f'call pipeline.bat {class_name} {slug} "R_AUTO - {class_name}"\n')
            print(f"Generated {class_name}.tsx and injected into Root.tsx")
            
    root.write_text(root_content, encoding="utf-8")
    print("Updated Root.tsx")

if __name__ == "__main__":
    main()

import re
import os

def main():
    with open('src/Root.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # Find all imports
    imports = set(re.findall(r'import\s+\{([^,]+)', text))

    # Identify all components used in <Composition component={...} />
    comps = re.findall(r'<Composition\s+id="[^"]+"\s+component=\{([^}]+)\}', text)

    for comp in comps:
        if comp not in imports:
            print(f"Removing composition for {comp}")
            pattern = r'<Composition\s+id="[^"]+"\s+component=\{' + comp + r'\}.*?/>'
            text = re.sub(pattern, '', text, flags=re.DOTALL)

    # Fix casing issues
    casing_fixes = {
        './Candybug': './CandyBug',
        './Castiron': './CastIron',
        './Hotdog': './HotDog',
        './Sandglass': './SandGlass',
        './Treesoup': './TreeSoup',
        './Glassfrog': './GlassFrog',
    }
    
    for bad, good in casing_fixes.items():
        text = text.replace(bad, good)

    with open('src/Root.tsx', 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == '__main__':
    main()

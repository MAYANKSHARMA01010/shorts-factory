import sys

def main():
    with open('src/Root.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    bad_imports = ['GlassFrog', 'HotDog2', 'CastIron', 'SandGlass', 'TreeSoup', 'CandyBug']
    
    new_lines = []
    for line in lines:
        if line.startswith('import '):
            if any(bad in line for bad in bad_imports):
                continue
        if '<Composition' in line:
            pass # we'll also need to remove bad compositions, but the user's manual ones were removed in the previous step? Let's check what compositions are there.
        
        new_lines.append(line)
        
    with open('src/Root.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

if __name__ == '__main__':
    main()

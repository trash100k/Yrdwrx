import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const output = execSync('find src -type f -name "*.ts" -o -name "*.tsx"').toString();
const files = output.trim().split('\n');

let changesCount = 0;

for (const file of files) {
  if (file === 'src/lib/storage.ts' || file === 'src/init.ts' || file === 'src/main.tsx') continue;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('localStorage.')) {
     const relative = path.relative(path.dirname(file), 'src/lib/storage').replace(/\\/g, '/');
     const importPath = relative.startsWith('.') ? relative : './' + relative;
     if (!content.includes('import { safeStorage }')) {
        content = `import { safeStorage } from "${importPath}";\n` + content;
     }
     content = content.replace(/window\.localStorage\.getItem/g, 'safeStorage.getItem');
     content = content.replace(/localStorage\.getItem/g, 'safeStorage.getItem');
     content = content.replace(/window\.localStorage\.setItem/g, 'safeStorage.setItem');
     content = content.replace(/localStorage\.setItem/g, 'safeStorage.setItem');
     content = content.replace(/window\.localStorage\.removeItem/g, 'safeStorage.removeItem');
     content = content.replace(/localStorage\.removeItem/g, 'safeStorage.removeItem');
     content = content.replace(/window\.localStorage\.clear/g, 'safeStorage.clear');
     content = content.replace(/localStorage\.clear/g, 'safeStorage.clear');

     fs.writeFileSync(file, content);
     console.log('Fixed', file);
     changesCount++;
  }
}
console.log(`Finished, updated ${changesCount} files.`);

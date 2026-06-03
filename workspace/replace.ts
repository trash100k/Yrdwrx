import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const output = execSync('find src -type f -name "*.ts" -o -name "*.tsx"').toString();
const files = output.trim().split('\n');

for (const file of files) {
  if (file === 'src/lib/storage.ts' || file === 'src/init.ts' || file === 'src/main.tsx') continue;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('localStorage.')) {
     const relative = path.relative(path.dirname(file), 'src/lib/storage').replace(/\\/g, '/');
     const importPath = relative.startsWith('.') ? relative : './' + relative;
     if (!content.includes('import { safeStorage }')) {
        content = `import { safeStorage } from "${importPath}";\n` + content;
     }
     content = content.replace(/window\.localStorage/g, 'safeStorage');
     content = content.replace(/localStorage\./g, 'safeStorage.');
     fs.writeFileSync(file, content);
     console.log('Fixed', file);
  }
}

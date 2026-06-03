const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const output = execSync('find src -type f -name "*.ts" -o -name "*.tsx"').toString();
const files = output.trim().split('\n');

for (const file of files) {
  if (file === 'src/lib/storage.ts') continue;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('localStorage.')) {
     const importPath = path.relative(path.dirname(file), 'src/lib/storage').replace(/\\/g, '/');
     const formattedImport = importPath.startsWith('.') ? importPath : './' + importPath;
     if (!content.includes('import { safeStorage }')) {
        content = `import { safeStorage } from "${formattedImport}";\n` + content;
     }
     content = content.replace(/window\.localStorage/g, 'safeStorage')
                      .replace(/localStorage\./g, 'safeStorage.');
     fs.writeFileSync(file, content);
     console.log('Fixed', file);
  }
}

const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir('./src');
files.forEach(file => {
  if (file.includes('lib/api.ts')) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('fetch(') || content.includes('window.fetch(')) {
    let newContent = content;
    newContent = newContent.replace(/window\.fetch\(/g, 'fetchApi(');
    newContent = newContent.replace(/\bfetch\(/g, 'fetchApi(');
    if (newContent !== content) {
      // Find the depth of the file to import correctly
      const depth = file.split(path.sep).length - 2; // src is depth 1
      const relativePath = depth > 0 ? '../'.repeat(depth) + 'lib/api' : './lib/api';
      
      const importStatement = `import { fetchApi } from "${relativePath}";\n`;
      if (!newContent.includes('import { fetchApi }')) {
        newContent = importStatement + newContent;
      }
      fs.writeFileSync(file, newContent, 'utf8');
      console.log('Fixed', file);
    }
  }
});

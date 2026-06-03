import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('./src');

let modifiedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/text-5xl sm:text-7xl/g, 'text-4xl sm:text-5xl lg:text-7xl break-words')
    .replace(/text-4xl sm:text-6xl/g, 'text-3xl sm:text-5xl lg:text-6xl break-words')
    .replace(/text-3xl sm:text-4xl sm:text-6xl/g, 'text-3xl sm:text-5xl lg:text-6xl break-words')
    .replace(/text-3xl sm:text-4xl sm:text-5xl/g, 'text-3xl sm:text-4xl lg:text-5xl break-words');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    modifiedCount++;
    console.log(`Modified ${file}`);
  }
}

console.log(`Modified ${modifiedCount} files.`);

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
    .replace(/w-\[900px\]/g, 'w-full lg:w-[900px]')
    .replace(/w-\[450px\]/g, 'w-full md:w-[450px]')
    .replace(/w-\[600px\]/g, 'w-full md:w-[600px]')
    .replace(/w-\[320px\]/g, 'w-full sm:w-[320px]')
    .replace(/w-\[540px\]/g, 'w-full sm:w-[540px]')
    .replace(/max-w-\[120px\]/g, 'max-w-[120px] break-words')
    .replace(/max-w-\[200px\]/g, 'max-w-[200px] break-words')
    .replace(/min-w-\[600px\]/g, 'min-w-0 md:min-w-[600px] w-full block sm:table overflow-x-auto')
    .replace(/tracking-tighter/g, 'tracking-normal md:tracking-tighter')
    .replace(/text-\[10px\]/g, 'text-xs md:text-[10px]')
    .replace(/text-\[11px\]/g, 'text-xs md:text-[11px]');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    modifiedCount++;
    console.log(`Modified width usages in ${file}`);
  }
}

console.log(`Modified ${modifiedCount} files for width issues.`);

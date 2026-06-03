const fs = require('fs');
const { join } = require('path');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      callback(p);
    }
  }
}

walk('src', (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add min-w-0 to inputs and selects that have w-full or flex-1 but lack min-w-0
  const replacer = (match, tag, before, className) => {
    let newClass = className;
    if (newClass.includes('w-full') && !newClass.includes('min-w-0')) {
      newClass = newClass.replace('w-full', 'w-full min-w-0');
      changed = true;
    }
    if (newClass.includes('flex-1') && !newClass.includes('min-w-0')) {
        newClass = newClass.replace('flex-1', 'flex-1 min-w-0');
        changed = true;
    }
    return `<${tag}${before}className="${newClass}"`;
  };

  const newContent = content.replace(/<(input|select)([^>]*?)className="([^"]+)"/g, replacer);

  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log('Fixed', file);
  }
});

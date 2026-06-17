const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.match(/\.(tsx|ts|jsx|js|css)$/)) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace green RGB
  content = content.replace(/16,\s*185,\s*129/g, '5, 168, 69');
  
  // Replace pink RGB
  content = content.replace(/236,\s*72,\s*153/g, '232, 93, 4');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

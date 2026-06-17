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

  // Replace pinks, purples, fuchsias, violets
  // Strategy:
  // light shades (100-300) -> Fog White [#F1F2F6]
  // medium/dark shades (400-900) -> Ember Glow [#E85D04]
  // Wait, Ember has its own shades if we just use tailwind's orange or slate. 
  // Custom theme colors might be better, but we can also inject a custom tailwind configuration.
  
  // Or we just replace the color words in the source code directly:
  // Wait, if it's "text-pink-500", we can replace "pink-" with "ember-" and define ember in index.css.
  
  content = content.replace(/\b(purple|pink|fuchsia|violet)-/g, 'ember-');
  // Wait, we need "ember" and "fog". If it's a light tone maybe fog? 
  // "remove purples and pinks from all instances of the app replace with the ember and fog from the file below"
  
  // Replace green and emerald with "forest-"
  content = content.replace(/\b(green|emerald)-/g, 'forest-');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

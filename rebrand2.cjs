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
      if (file.match(/\.(tsx|ts|jsx|js)$/)) {
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

  const specificReplacements = {
    'Welcome to Cutty!': 'Welcome to YardWorx!',
    'Welcome to Cutty.': 'Welcome to YardWorx.',
    'set up in Cutty.': 'set up in YardWorx.',
    'Cutty is now active': 'YardWorx is now active',
    'Cutty Help Active': 'YardWorx Help Active',
    'how Cutty works': 'how YardWorx works',
    'let Cutty architect': 'let YardWorx architect',
    'Cutty Green': 'YardWorx Green',
    'Cutty-Design-': 'YardWorx-Design-',
    'let Cutty help': 'let YardWorx help',
    'Cutty Custom Rule:': 'YardWorx Custom Rule:',
    'Cutty Logic Engine': 'YardWorx Logic Engine',
    'tools, Cutty uses': 'tools, YardWorx uses',
    'Cutty reads your': 'YardWorx reads your',
    'Cutty uses advanced AI': 'YardWorx uses advanced AI',
    'force Cutty to output': 'force YardWorx to output',
    '// Cutty Guidance Logic': '// YardWorx Guidance Logic'
  };

  for (const [key, value] of Object.entries(specificReplacements)) {
    content = content.split(key).join(value);
  }

  // Handle the solo 'Cutty' in App.tsx
  content = content.replace(/\>Cutty\</g, '>YardWorx<');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

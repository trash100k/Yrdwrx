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
    'CuttyOS': 'YardWorx',
    'cuttyos': 'yardworx',
    'Cutty Copilot': 'YardPilot',
    'Cutty Chat': 'YardChat',
    'Cutty Landscapes': 'YardWorx Landscapes',
    'Cutty Dispatch': 'YardWorx Dispatch',
    'Cutty Workspace Assistant': 'YardWorx Workspace Assistant',
    'Cutty Workspace Sync': 'YardWorx Workspace Sync',
    'Cutty AI': 'YardWorx AI',
    'Cutty Job:': 'YardWorx Job:',
    'Cutty Strategic': 'YardWorx Strategic',
    'Cutty Inspection': 'YardWorx Inspection',
    'Cutty Sync:': 'YardWorx Sync:',
    'Cutty crew': 'YardWorx crew',
    'Cutty team': 'YardWorx team',
    'from Cutty': 'from YardWorx',
    'with Cutty': 'with YardWorx',
    'for Cutty': 'for YardWorx',
    'Cutty does not sell': 'YardWorx does not sell',
    'Cutty Local Operations': 'YardWorx Local Operations',
    'Cutty Sandbox': 'YardWorx Sandbox',
    'Starting Cutty...': 'Starting YardWorx...',
    'Cutty Agent Workspace': 'YardWorx Agent Workspace',
    'CUTTY': 'YARDWORX',
    "demo@cutty.io": "demo@yardworx.io",
    "Cutty is a tool": "YardWorx is a tool"
  };

  for (const [key, value] of Object.entries(specificReplacements)) {
    content = content.split(key).join(value);
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

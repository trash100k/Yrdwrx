const fs = require('fs');

const filesToFix = [
  {
    path: './src/components/AgenticOutreachDrawer.tsx',
    replaces: {
      'Cutty saved': 'YardWorx saved',
      'Cutty Enterprise Group': 'YardWorx Enterprise Group',
      'outreach@cutty.io': 'outreach@yardworx.io'
    }
  },
  {
    path: './src/components/auth/BiometricGuard.tsx',
    replaces: {
      'Cutty OS': 'YardWorx'
    }
  },
  {
    path: './src/components/Layout.tsx',
    replaces: {
      '>Cutty<': '>YardWorx<',
      'Cutty\n': 'YardWorx\n',
      'Cutty\n                      <': 'YardWorx\n                      <'
    }
  },
  {
    path: './src/App.tsx',
    replaces: {
      '>Cutty<': '>YardWorx<',
      ' Cutty': ' YardWorx',
      'Cutty\n': 'YardWorx\n'
    }
  }
];

filesToFix.forEach(f => {
  if(fs.existsSync(f.path)) {
    let content = fs.readFileSync(f.path, 'utf8');
    let o = content;
    for(let k in f.replaces) {
      if(k === ' Cutty') {
         // App.tsx line 637: `<span className="font-bold relative z-10 text-white tracking-widest uppercase">Cutty</span>`
         // Oh wait, in my grep we had `src/components/Layout.tsx:305:                      Cutty`
         content = content.replace(/\n\s*Cutty\n/g, '\n                      YardWorx\n');
      } else {
        content = content.split(k).join(f.replaces[k]);
      }
    }
    if (o !== content) {
      fs.writeFileSync(f.path, content, 'utf8');
    }
  }
});

import * as fs from 'fs';

function fixFile(file: string) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/(onClick=\{([^}]+)\})/g, (match, onClickFull, onClickInner) => {
    // Note: if there is an existing onKeyDown, this is unsafe, but we know there isn't.
    // Also, if onClickInner has balanced braces, this regex might fail, but let's try.
    return `${onClickFull} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof ${onClickInner} === 'function') { (${onClickInner})(e as any); } } }}`;
  });

  fs.writeFileSync(file, content);
}

fixFile('src/pages/Dashboard.tsx');
fixFile('src/pages/Scheduler.tsx');

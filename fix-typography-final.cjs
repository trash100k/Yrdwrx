const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const dirsToProcess = ['src/pages', 'src/components', 'src'];

dirsToProcess.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  if (dir === 'src') {
    let p = path.join(dir, 'App.tsx');
    if (fs.existsSync(p)) processFile(p);
    return;
  }
  walkDir(dir, function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    processFile(filePath);
  });
});

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Make text-2xl responsive (from text-xl)
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-2xl\b/g, 'text-xl sm:text-2xl');

    // Make text-3xl responsive (from text-2xl)
    // Careful not to double apply if it was already sm:text-3xl
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-3xl\b/g, 'text-2xl sm:text-3xl');

    // Make text-4xl responsive (from text-3xl) 
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-4xl\b/g, 'text-3xl sm:text-4xl');

    // Make text-7xl responsive (from text-5xl)
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-7xl\b/g, 'text-5xl sm:text-7xl');

    // Make text-8xl responsive (from text-5xl)
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-8xl\b/g, 'text-5xl sm:text-8xl');

    // Handle any missed w-[...] fixed widths
    content = content.replace(/\bw-\[400px\]\b/g, 'w-full md:w-[400px]');
    content = content.replace(/\bw-\[450px\]\b/g, 'w-full md:w-[450px]');
    content = content.replace(/\bw-\[500px\]\b/g, 'w-[90vw] md:w-[500px]');
    content = content.replace(/\bw-\[600px\]\b/g, 'w-[95vw] md:w-[600px]');
    
    // Convert px-12 to responsive if missed
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\bpx-12\b/g, 'px-8 sm:px-12');
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\bpx-16\b/g, 'px-8 md:px-16');

    // Tables need display block and overflow-x-auto on mobile
    content = content.replace(/<table([^>]*)>/g, function(match, p1) {
       if (p1.includes('className=')) {
          if (!p1.includes('block w-full overflow-x-auto') && !p1.includes('sm:table')) {
             return `<table${p1.replace('className="', 'className="block sm:table w-full overflow-x-auto whitespace-nowrap ')}>`;
          }
       }
       return match;
    });

    fs.writeFileSync(filePath, content);
}

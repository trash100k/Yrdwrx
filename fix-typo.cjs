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
    let appPath = path.join(dir, 'App.tsx');
    if (fs.existsSync(appPath)) {
       processFile(appPath);
    }
    return;
  }
  
  walkDir(dir, function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    processFile(filePath);
  });
});

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace text-5xl with text-4xl sm:text-5xl if not already responsive
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-5xl\b/g, 'text-4xl sm:text-5xl');
    
    // Replace text-6xl with text-4xl sm:text-6xl
    content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-6xl\b/g, 'text-4xl sm:text-6xl');

    // Make min-w-[300px] responsive
    content = content.replace(/\bmin-w-\[300px\]\b/g, 'w-full md:min-w-[300px]');
    
    fs.writeFileSync(filePath, content);
}

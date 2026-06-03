const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Add max-w-full overflow-x-auto to tablists
    content = content.replace(/role="tablist"(\s+)className="([^"]+)"/g, function(match, p1, p2) {
       if (!p2.includes('overflow-x-auto')) {
          return `role="tablist"${p1}className="${p2} overflow-x-auto max-w-full"`;
       }
       return match;
    });
    
    // Add same to any className containing flex that is followed by role="tablist"
    content = content.replace(/className="([^"]+flex[^"]+)"\s+role="tablist"/g, function(match, p1) {
       if (!p1.includes('overflow-x-auto')) {
          return `className="${p1} overflow-x-auto max-w-full" role="tablist"`;
       }
       return match;
    });

    fs.writeFileSync(filePath, content);
});

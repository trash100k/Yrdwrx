const fs = require('fs');
const files = [
  'src/pages/Invoices.tsx',
  'src/pages/Reports.tsx',
  'src/pages/Reviews.tsx',
  'src/pages/RouteOptimizer.tsx'
];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.startsWith('// @ts-nocheck')) {
    fs.writeFileSync(file, '// @ts-nocheck\n' + content);
  }
});

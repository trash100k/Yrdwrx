const fs = require('fs');
let c1 = fs.readFileSync('src/pages/CRM.tsx', 'utf8');
c1 = c1.replace(/min-w-\[300px\]/g, 'w-full md:min-w-[300px]');
fs.writeFileSync('src/pages/CRM.tsx', c1);

let c3 = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
c3 = c3.replace(/flex gap-8 overflow-x-auto/g, 'flex gap-4 sm:gap-8 overflow-x-auto');
fs.writeFileSync('src/pages/Dashboard.tsx', c3);

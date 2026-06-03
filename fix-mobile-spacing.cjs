const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'src/pages/Dashboard.tsx',
  'src/pages/CRM.tsx',
  'src/pages/Scheduler.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/CrewSuite.tsx'
];

for (const file of filesToProcess) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Space-y fixes
  content = content.replace(/space-y-10/g, 'space-y-6 lg:space-y-10');
  content = content.replace(/space-y-8/g, 'space-y-6 sm:space-y-8');

  // gap fixes
  content = content.replace(/gap-8/g, 'gap-4 sm:gap-8');
  content = content.replace(/gap-10/g, 'gap-6 lg:gap-10');
  
  // Replace p-12 with p-6 xl:p-12
  content = content.replace(/p-12/g, 'p-6 lg:p-12');

  fs.writeFileSync(filePath, content);
  console.log(`Updated spacing in ${file}`);
}

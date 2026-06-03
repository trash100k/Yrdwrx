const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'src/pages/Dashboard.tsx',
  'src/pages/CRM.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/Scheduler.tsx'
];

for (const file of filesToProcess) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace text-3xl with text-2xl lg:text-3xl
  content = content.replace(/text-3xl/g, 'text-2xl sm:text-3xl');
  
  // Replace text-4xl with text-3xl lg:text-4xl
  content = content.replace(/text-4xl/g, 'text-3xl sm:text-4xl');

  // Button sizes px-8 py-4 to px-4 sm:px-8 py-3 sm:py-4
  // We need to be careful.
  content = content.replace(/px-8 py-4/g, 'px-4 sm:px-8 py-3 sm:py-4');
  content = content.replace(/px-8 py-5/g, 'px-4 sm:px-8 py-3 sm:py-5');

  fs.writeFileSync(filePath, content);
  console.log(`Updated typography and buttons in ${file}`);
}

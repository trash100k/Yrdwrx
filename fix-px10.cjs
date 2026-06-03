const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'src/pages/CRM.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Inventory.tsx',
  'src/components/LiveInventoryFeed.tsx'
];

for (const file of filesToProcess) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bpx-10\b/g, 'px-6 sm:px-10');
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bpx-12\b/g, 'px-6 sm:px-12');
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bpy-10\b/g, 'py-6 sm:py-10');

  fs.writeFileSync(filePath, content);
  console.log(`Updated px-10 in ${file}`);
}

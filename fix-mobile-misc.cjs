const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'src/pages/ClientPortal.tsx',
  'src/pages/Compliance.tsx',
  'src/pages/Contracts.tsx',
  'src/pages/DesignStudio.tsx',
  'src/pages/Invoices.tsx',
  'src/pages/Reviews.tsx',
  'src/pages/RouteOptimizer.tsx',
  'src/components/ServicePricingCatalog.tsx',
  'src/components/CommandPalette.tsx',
  'src/components/FieldModeInterface.tsx',
];

for (const file of filesToProcess) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace p-8 with p-5 sm:p-8 when it's just "p-8" and not already in a responsive chain
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bp-8\b(?! sm:p-)/g, 'p-5 sm:p-8');
  
  // Replace p-10 with p-6 sm:p-10
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bp-10\b(?! sm:p-)/g, 'p-6 sm:p-10');
  
  // Replace gap-8 with gap-4 sm:gap-8
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\bgap-8\b/g, 'gap-4 sm:gap-8');

  // Replace text-4xl
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-4xl\b/g, 'text-3xl sm:text-4xl');
  content = content.replace(/(?<!sm:|md:|lg:|xl:)\btext-5xl\b/g, 'text-4xl sm:text-5xl');

  fs.writeFileSync(filePath, content);
  console.log(`Updated spacing in ${file}`);
}

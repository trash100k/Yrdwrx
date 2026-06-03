const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Dashboard.tsx',
  'src/components/widgets/EarningsWidget.tsx',
  'src/components/widgets/AlertsWidget.tsx',
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix w-[450px]
  content = content.replace(/w-\[450px\]/g, 'w-[85vw] md:w-[450px] max-w-full');
  
  // Fix w-[900px]
  content = content.replace(/w-\[900px\]/g, 'w-[90vw] lg:w-[900px] max-w-full');

  // Some padding fixes for mobile might also be nice, e.g. p-6 on mobile, p-10 on bigger
  content = content.replace(/p-10/g, 'p-6 md:p-10');

  // Some min-h fixes to make them fluid
  // min-w-[280px] in horizontal flow could be 80vw 
  content = content.replace(/min-w-\[280px\]/g, 'min-w-[80vw] md:min-w-[280px]');

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}

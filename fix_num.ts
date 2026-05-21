import * as fs from 'fs';

let content = fs.readFileSync('src/components/FieldModeInterface.tsx', 'utf8');

content = content.replace(/t\.([0-9][a-zA-Z0-9_]*)/g, "t['$1']");

fs.writeFileSync('src/components/FieldModeInterface.tsx', content);

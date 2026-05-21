import * as fs from 'fs';

let content = fs.readFileSync('src/components/FieldModeInterface.tsx', 'utf8');

if (!content.includes('useLocalStorage(')) {
  console.log("Already prefixed? Wait, it has it in body.");
}

if (!content.includes('function useTranslation')) {
  const dict = fs.readFileSync('dict.json', 'utf8');

  const prefix = `import { useLocalStorage } from '../hooks/useLocalStorage';

const TRANSLATIONS: Record<string, {en: string, es: string}> = ${dict};

function useTranslation(isSpanish: boolean) {
  return new Proxy(TRANSLATIONS, {
    get: (target, prop: string) => {
      if (!target[prop]) return prop;
      return isSpanish ? target[prop].es : target[prop].en;
    }
  }) as Record<keyof typeof TRANSLATIONS, string>;
}

`;
  
  // prepend after the last import
  const lastImportIndex = content.lastIndexOf('import ');
  let endOfImport = content.indexOf('\n', lastImportIndex);
  if (endOfImport === -1) endOfImport = 0;
  
  content = content.slice(0, endOfImport + 1) + '\n' + prefix + content.slice(endOfImport + 1);
  fs.writeFileSync('src/components/FieldModeInterface.tsx', content);
}

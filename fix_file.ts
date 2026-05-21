import * as fs from 'fs';

let content = fs.readFileSync('src/components/FieldModeInterface.tsx.tmp', 'utf8');

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

content = content.replace(/(import .* from 'lucide-react';\n)/, `$1\n${prefix}`);

content = content.replace(
  /const \[isSpanish, setIsSpanish\] = useState\(false\);/,
  `const [isSpanish, setIsSpanish] = useLocalStorage('fieldmode_isSpanish', false);\n  const t = useTranslation(isSpanish);`
);

content = content.replace(
  /const \[isHighContrast, setIsHighContrast\] = useState\(false\);/,
  `const [isHighContrast, setIsHighContrast] = useLocalStorage('fieldmode_isHighContrast', false);`
);

fs.writeFileSync('src/components/FieldModeInterface.tsx', content);

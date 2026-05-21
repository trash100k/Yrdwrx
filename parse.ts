import * as fs from 'fs';

let content = fs.readFileSync('src/components/FieldModeInterface.tsx', 'utf8');

let counter = 0;
const dict: Record<string, {en: string, es: string}> = {};

const newContent = content.replace(/\{isSpanish \? '([^']+)' : '([^']+)'\}/g, (match, es, en) => {
  const key = en.replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).map((w: string, i: number) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  const safeKey = key || 'key' + (++counter);
  if (!dict[safeKey]) dict[safeKey] = { en, es };
  return `{t.${safeKey}}`;
}).replace(/\(isSpanish \? '([^']+)' : '([^']+)'\)/g, (match, es, en) => {
  const key = en.replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).map((w: string, i: number) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  const safeKey = key || 'key' + (++counter);
  if (!dict[safeKey]) dict[safeKey] = { en, es };
  return `t.${safeKey}`;
}).replace(/isSpanish \? '([^']+)' : '([^']+)'/g, (match, es, en) => {
  if (match.includes('t.')) return match;
  const key = en.replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).map((w: string, i: number) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  const safeKey = key || 'key' + (++counter);
  if (!dict[safeKey]) dict[safeKey] = { en, es };
  return `t.${safeKey}`;
});

fs.writeFileSync('dict.json', JSON.stringify(dict, null, 2));
fs.writeFileSync('src/components/FieldModeInterface.tsx.tmp', newContent);

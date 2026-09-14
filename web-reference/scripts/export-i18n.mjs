// Export the web dictionaries (src/i18n/locales/*.ts) for the Godot port: each locale becomes assets/i18n/<id>.json
// with plain strings as they are and parameterised entries as templates — the function called with "{0}", "{1}", …
// placeholders (a Godot `format` pattern). The locale order and native names come from src/i18n/index.ts LOCALES.
//   node scripts/export-i18n.mjs [output dir]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src/i18n');
const output = resolve(process.argv[2] ?? resolve(here, '../../assets/i18n'));
const FILES = { en: 'en', fr: 'fr', it: 'it', de: 'de', es: 'es', 'zh-CN': 'zhCN', 'pt-BR': 'ptBR', ru: 'ru', tr: 'tr', pl: 'pl' };
const PLACEHOLDERS = ['{0}', '{1}', '{2}', '{3}'];

/** Transpile a locale module to plain JS and import it (its only import is the Dict type, erased). */
async function loadLocale(file) {
  const source = await readFile(resolve(src, 'locales', `${file}.ts`), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

await mkdir(output, { recursive: true });
const summary = {};
for (const [id, file] of Object.entries(FILES)) {
  const module = await loadLocale(file);
  const dict = Object.values(module).find(v => v && typeof v === 'object');
  const out = {};
  for (const [key, value] of Object.entries(dict)) {
    out[key] = typeof value === 'function' ? value(...PLACEHOLDERS.slice(0, value.length)) : value;
  }
  await writeFile(resolve(output, `${id}.json`), JSON.stringify(out, null, 1) + '\n');
  summary[id] = Object.keys(out).length;
}
console.log(JSON.stringify(summary));

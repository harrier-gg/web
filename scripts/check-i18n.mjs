// Checks that every translation matches the English source (ADR 0003).
//   - error:   keys that do not exist in en.json (stale translations)
//   - error:   different {{placeholders}} or <tags> than the English text
//   - warning: keys missing in a translation (the UI falls back to English)
// Usage: node scripts/check-i18n.mjs   (exit code 1 on errors)
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/locales/', import.meta.url);
const load = (file) => JSON.parse(readFileSync(new URL(file, dir), 'utf8'));

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, String(value)]],
  );

const tokens = (text) => [...text.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+\/?>/g)].map((m) => m[0].replace(/\s/g, '')).sort();

const source = new Map(flatten(load('en.json')));
const github = process.env.GITHUB_ACTIONS === 'true';
let errors = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const translation = new Map(flatten(load(file)));

  for (const [key, text] of translation) {
    if (!source.has(key)) {
      errors++;
      console.log(`${github ? `::error file=src/locales/${file}::` : '✖ '}${file}: "${key}" does not exist in en.json`);
    } else if (tokens(text).join() !== tokens(source.get(key)).join()) {
      errors++;
      console.log(
        `${github ? `::error file=src/locales/${file}::` : '✖ '}${file}: "${key}" uses ${tokens(text).join(' ') || 'no placeholders'}, English uses ${tokens(source.get(key)).join(' ') || 'none'}`,
      );
    }
  }

  const missing = [...source.keys()].filter((key) => !translation.has(key));
  for (const key of missing) {
    console.log(`${github ? `::warning file=src/locales/${file}::` : '⚠ '}${file}: "${key}" is not translated yet (falls back to English)`);
  }
  console.log(`${file}: ${source.size - missing.length}/${source.size} keys translated`);
}

process.exit(errors ? 1 : 0);

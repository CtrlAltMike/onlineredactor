import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'node_modules/pdfjs-dist/standard_fonts');
const dest = resolve(root, 'public/pdfjs-standard-fonts');

if (!existsSync(src)) {
  console.log('[copy-standard-fonts] source missing — did you run npm install?');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-standard-fonts] copied to ${dest}`);

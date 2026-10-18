import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(base, 'frozen-v2-2026-10-12');
const manifest = JSON.parse(
  fs
    .readFileSync(path.join(base, 'frozen-v2-2026-10-12.sha256.json'), 'utf8')
    .replace(/^\uFEFF/, ''),
);
for (const entry of manifest) {
  const file = path.resolve(root, entry.path);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Invalid archive path');
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex')
    .toUpperCase();
  if (hash !== entry.sha256) throw Error('Changed archive file: ' + entry.path);
}
console.log('Frozen v2: ' + manifest.length + '/' + manifest.length + ' SHA-256 hashes unchanged');

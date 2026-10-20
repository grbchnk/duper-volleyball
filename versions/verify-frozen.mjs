import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUtf8 } from 'node:buffer';
const base = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(base, 'frozen-v2-2026-10-12');
const manifest = JSON.parse(
  fs
    .readFileSync(path.join(base, 'frozen-v2-2026-10-12.sha256.json'), 'utf8')
    .replace(/^\uFEFF/, ''),
);
const normalizedManifest = JSON.parse(
  fs.readFileSync(path.join(base, 'frozen-v2-2026-10-12.lf.sha256.json'), 'utf8'),
);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
for (const entry of manifest) {
  const file = path.resolve(root, entry.path);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Invalid archive path');
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) === entry.sha256) continue;
  // Git's text checkout changes CRLF to LF on Linux. Preserve every other byte,
  // including the BOM; binary files must still match the original exact hash.
  if (
    !isUtf8(bytes) ||
    sha256(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))) !==
      normalizedManifest[entry.path]
  )
    throw Error('Changed archive file: ' + entry.path);
}
console.log(
  'Frozen v2: ' + manifest.length + '/' + manifest.length + ' files verified (LF/CRLF compatible)',
);

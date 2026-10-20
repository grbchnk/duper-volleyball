import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isUtf8 } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('archive verification accepts Git line endings and rejects edited text and binary files', (t) => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const temporary = mkdtempSync(path.join(tmpdir(), 'volleyball-archive-'));
  t.after(() => {
    assert.equal(path.dirname(temporary), path.resolve(tmpdir()));
    rmSync(temporary, { recursive: true, force: true });
  });
  const manifest = JSON.parse(
    readFileSync(path.join(project, 'versions/frozen-v2-2026-10-12.sha256.json'), 'utf8').replace(
      /^\uFEFF/,
      '',
    ),
  );
  for (const entry of manifest) {
    const bytes = readFileSync(path.join(project, 'versions/frozen-v2-2026-10-12', entry.path));
    const destination = path.resolve(temporary, entry.path);
    assert.ok(destination.startsWith(temporary + path.sep));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      isUtf8(bytes) ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes,
    );
  }
  const verify = () =>
    spawnSync(process.execPath, [path.join(project, 'versions/verify-frozen.mjs'), temporary], {
      encoding: 'utf8',
      windowsHide: true,
    });
  assert.equal(verify().status, 0, 'LF checkout passes');
  const text = path.join(temporary, '.editorconfig');
  const original = readFileSync(text, 'utf8');
  writeFileSync(text, original.replace(/\n/g, '\r\n'));
  assert.equal(verify().status, 0, 'CRLF checkout passes');
  writeFileSync(text, original + '\nchanged = true\n');
  const editedText = verify();
  assert.notEqual(editedText.status, 0);
  assert.match(editedText.stderr, /Changed archive file: \.editorconfig/);
  writeFileSync(text, original);
  const binary = manifest.find((entry) => entry.path.endsWith('.png'));
  const binaryPath = path.join(temporary, binary.path);
  writeFileSync(binaryPath, Buffer.concat([readFileSync(binaryPath), Buffer.from([0])]));
  const editedBinary = verify();
  assert.notEqual(editedBinary.status, 0);
  assert.match(editedBinary.stderr, /Changed archive file:/);
});

/** Verify this overlay's contents. Does not write files, install or deploy anything. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../RELEASE_CONTACT9.json', import.meta.url), 'utf8'));
const errors = [];
for (const record of manifest.files) {
  if (!record.path || path.isAbsolute(record.path) || record.path.split(/[\\/]/).includes('..')) throw new Error('Unsafe manifest path');
  const target = path.resolve(root, record.path);
  if (!target.startsWith(root)) throw new Error('Path outside project root');
  try {
    const bytes = await readFile(target);
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) errors.push(`Modified/incomplete file: ${record.path}`);
  } catch { errors.push(`Missing file: ${record.path}`); }
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`${manifest.version}: ${manifest.files.length} release files verified (manifest excluded from self-hashing).`);

/** Verify a delivered overlay without a renderer or installed dependencies. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const metadata = JSON.parse(await readFile(new URL('../RELEASE_PERF15.json', import.meta.url), 'utf8'));
const errors = [];
for (const record of metadata.files) {
  const target = path.resolve(root, record.path);
  if (!target.startsWith(root + path.sep) || record.path.split('/').includes('..')) throw new Error('Invalid release path.');
  try {
    const bytes = await readFile(target);
    if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) errors.push(`Modified/incomplete file: ${record.path}`);
  } catch { errors.push(`Missing file: ${record.path}`); }
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`${metadata.version}: ${metadata.files.length} delivered files verified; release manifest excludes its own hash.`);

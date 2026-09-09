/** Release integrity check, independent of a renderer or package installation. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
const metadata = JSON.parse(await readFile(new URL('../RELEASE_PBR6.json', import.meta.url), 'utf8'));
const errors = [];
for (const record of metadata.changedFiles) {
  const target = path.resolve(root, record.path);
  if (!target.startsWith(root) || record.path.includes('..')) throw new Error('Invalid release manifest path.');
  try {
    const bytes = await readFile(target);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== record.sha256) errors.push(`Modified or incomplete update: ${record.path}`);
  } catch { errors.push(`Missing file: ${record.path}`); }
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`PBR release ${metadata.version}: ${metadata.changedFiles.length} packaged files verified (manifest excluded from self-hashing).`);

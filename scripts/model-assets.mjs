import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function matches(data, expected) {
  const hash = expected.length === 64 ? createHash('sha256') : createHash('sha1').update('blob ' + data.length + '\0');
  return hash.update(data).digest('hex') === expected;
}
export async function installModel({ repo, revision, directory, files }) {
  for (const [name, hash] of Object.entries(files)) {
    const target = fileURLToPath(new URL('../public/models/' + directory + '/' + name, import.meta.url));
    try {
      if (matches(await readFile(target), hash)) continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    console.log('Installing ' + directory + '/' + name);
    const response = await fetch('https://huggingface.co/' + repo + '/resolve/' + revision + '/' + name);
    if (!response.ok) throw new Error(name + ' download failed (HTTP ' + response.status + ').');
    const data = Buffer.from(await response.arrayBuffer());
    if (!matches(data, hash)) throw new Error('Checksum mismatch for ' + name);
    await mkdir(dirname(target), { recursive: true });
    const temp = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temp, data);
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }
}

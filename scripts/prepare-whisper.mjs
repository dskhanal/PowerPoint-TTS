import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const revision = '79fb389fc764e7c395bd330e9531d9d32ada7049';
const model = 'Xenova/whisper-tiny.en';
const files = {
  'config.json': '8170b9ae19fe3eec3501b3179afafd2e09ea7731',
  'generation_config.json': 'd390b4b113dc8cb9018e9f8e7f2616fa6f1f7af1',
  'preprocessor_config.json': '91876762a536a746d268353c5cba57286e76b058',
  'tokenizer.json': 'ba4bb296bdaeeda36b8ce0e6e94c986a156090b2',
  'tokenizer_config.json': '0009400790fd6ae115b0c4fa1e7bf19140bcc5fc',
  'onnx/encoder_model_quantized.onnx': '8cc3c6f8563d1b3fbd2c5af9f64c2bed8b020bc593c402d1ef53b9f08fbf1b90',
  'onnx/decoder_model_merged_quantized.onnx': 'dbb2e063b7fbc41d9803b9698f93ecb035c50cbb3fb87b56cb131e4a5eb99059'
};
function matches(data, expected) {
  const hash = expected.length === 64 ? createHash('sha256') : createHash('sha1').update('blob ' + data.length + '\0');
  return hash.update(data).digest('hex') === expected;
}
for (const [name, hash] of Object.entries(files)) {
  const target = fileURLToPath(new URL('../public/models/' + model + '/' + name, import.meta.url));
  try {
    if (matches(await readFile(target), hash)) continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log('Installing local Whisper asset ' + name);
  const response = await fetch('https://huggingface.co/' + model + '/resolve/' + revision + '/' + name);
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
console.log('Local Whisper model is ready.');

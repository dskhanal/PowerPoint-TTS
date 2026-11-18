import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { installModel } from './model-assets.mjs';
import { kokoroDirectory, kokoroRevision, piperDirectory, piperRevision } from '../src/voice-models.js';

await installModel({
  repo: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  revision: kokoroRevision,
  directory: kokoroDirectory,
  files: {
    'config.json': '790faf216e7e3f490e71e8bc80df79ed8941101c',
    'tokenizer.json': '4280f55fc1c32211bc9bb4d55545759a00054ecd',
    'tokenizer_config.json': '5c81e9a3a06db9139900d6ee5b60e8bb701ccb0b',
    'onnx/model_quantized.onnx': 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478',
    'README.md': '5d63f29192b225a12302c16c31913cbf02fc687e'
  }
});
await copyFile(
  new URL('../node_modules/kokoro-js/LICENSE', import.meta.url),
  new URL('../public/models/' + kokoroDirectory + '/LICENSE', import.meta.url)
);
const installedVoices = new URL('../node_modules/kokoro-js/voices/', import.meta.url);
const bundledVoices = new URL('../public/models/' + kokoroDirectory + '/voices/', import.meta.url);
await mkdir(bundledVoices, { recursive: true });
for (const name of await readdir(installedVoices)) {
  if (/^[ab][fm]_\w+\.bin$/.test(name)) {
    await copyFile(new URL(name, installedVoices), new URL(name, bundledVoices));
  }
}
await installModel({
  repo: 'DataCraftsmanAustralia/piper-en_AU-librivox-medium',
  revision: piperRevision,
  directory: piperDirectory,
  files: {
    'en_AU-librivox-medium.onnx': 'f34849bce64d803d0fe90087766d5d6f2a8215a12edad43e486d77072df7dd41',
    'en_AU-librivox-medium.onnx.json': '7501786a2ee5e58c6169ea7cda96190311a59333',
    'ATTRIBUTION.md': '1a66164fd597e23c01a8a28085e7d3490f224432',
    'README.md': '7768de8de5c33c49efb940316150cbeb8e1f177a'
  }
});
console.log('Local voice models are ready.');

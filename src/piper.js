import { env, InferenceSession, Tensor } from 'onnxruntime-web/webgpu';
import { phonemize } from 'phonemizer';
import { australianVoices } from './australian-voices.js';
import { piperDirectory } from './voice-models.js';

const modelUrl = new URL(import.meta.env.BASE_URL + 'models/' + piperDirectory + '/en_AU-librivox-medium.onnx', self.location.origin).href;

async function fetchAsset(url, cache) {
  const cached = await cache?.match(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Australian voice download failed (HTTP ' + response.status + ').');
  // Private browsing and limited disk space may prevent persistence.
  if (cache) await cache.put(url, response.clone()).catch(() => {});
  return response;
}

async function phonemeIds(text, config) {
  const map = config.phoneme_id_map;
  const ids = [...map['^'], ...map['_']];
  // eSpeak strips punctuation from its output. Retain clause endings for prosody.
  const pieces = text.split(/([,.!?;:]+)(?=\s|$)/u);
  for (let i = 0; i < pieces.length; i += 2) {
    const words = pieces[i].trim();
    if (!words) continue;
    const phones = await phonemize(words, config.espeak.voice);
    const ending = pieces[i + 1] || '';
    const clause = (i ? ' ' : '') + phones.join(' ') + ending;
    for (const phone of clause.normalize('NFD')) {
      if (map[phone]) ids.push(...map[phone], ...map['_']);
    }
  }
  ids.push(...map['$']);
  return ids;
}

function intTensor(numbers, dims) {
  return new Tensor('int64', BigInt64Array.from(numbers, BigInt), dims);
}

export async function loadAustralianEngine(wasmPaths) {
  env.wasm.numThreads = 1;
  env.wasm.wasmPaths = wasmPaths;
  const cache = await globalThis.caches?.open('kokoro-studio-piper').catch(() => undefined);
  const [config, model] = await Promise.all([
    fetchAsset(modelUrl + '.json', cache).then(response => response.json()),
    fetchAsset(modelUrl, cache).then(response => response.arrayBuffer())
  ]);
  const session = await InferenceSession.create(model, { executionProviders: ['wasm'] });
  return {
    async generate(text, { voice, speed }) {
      const speaker = config.speaker_id_map[australianVoices[voice]];
      if (!Number.isInteger(speaker)) throw new Error('Unknown Australian speaker.');
      const ids = await phonemeIds(text, config);
      const { noise_scale, length_scale, noise_w } = config.inference;
      // The publisher recommends slower base rates for these two narrators.
      const baseRate = { au_tully: 1.25, au_marlo: 1.08 }[voice] ?? length_scale;
      const { output } = await session.run({
        input: intTensor(ids, [1, ids.length]),
        input_lengths: intTensor([ids.length], [1]),
        scales: new Tensor('float32', Float32Array.of(noise_scale, baseRate / speed, noise_w), [3]),
        sid: intTensor([speaker], [1])
      });
      return { audio: output.data, sampling_rate: config.audio.sample_rate };
    }
  };
}

import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import { configureWasm } from './wasm.js';
import { renderNarration } from './render.js';
import { narrationPlan } from './script-delivery.js';

env.allowLocalModels = false;
configureWasm(env);
let kokoroEngine;
let australianEngine;
let lastProgress = '';
function progress(message) {
  if (message !== lastProgress) self.postMessage({ type: 'progress', message });
  lastProgress = message;
}

async function loadEngine(voice) {
  if (voice.startsWith('au_')) {
    if (!australianEngine) {
      progress('Loading Australian voices. The first use downloads a shared 77 MB model.');
      const { loadAustralianEngine } = await import('./piper.js');
      australianEngine = await loadAustralianEngine(env.backends.onnx.wasm.wasmPaths);
    }
    return australianEngine;
  }
  if (!kokoroEngine) {
    progress('Loading the local voice engine. The first use downloads the speech model.');
    kokoroEngine = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8', device: 'wasm',
      progress_callback(event) {
        if (event.status === 'progress' && event.file.endsWith('.onnx') && event.total > 0) {
          progress('Loading speech model · ' + Math.min(100, Math.round(event.progress)) + '%');
        }
      }
    });
  }
  return kokoroEngine;
}

self.onmessage = async ({ data }) => {
  try {
    const plan = narrationPlan(data.text, data.preview, data.variation);
    const engine = await loadEngine(data.voice);
    const result = await renderNarration(engine, plan, data, progress);
    self.postMessage({ type: 'ready', ...result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};

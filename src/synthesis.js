import { AutoTokenizer, StyleTextToSpeech2Model, env } from '@huggingface/transformers';
import { LocalKokoro } from './local-kokoro.js';
import { kokoroDirectory } from './voice-models.js';
import { configureWasm } from './wasm.js';
import { renderNarration } from './render.js';
import { narrationPlan } from './script-delivery.js';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = new URL(import.meta.env.BASE_URL + 'models/', self.location.origin).href;
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
    const model = StyleTextToSpeech2Model.from_pretrained(kokoroDirectory, {
      dtype: 'q8', device: 'wasm',
      progress_callback(event) {
        if (event.status === 'progress' && event.file.endsWith('.onnx') && event.total > 0) {
          progress('Loading speech model · ' + Math.min(100, Math.round(event.progress)) + '%');
        }
      }
    });
    const tokenizer = AutoTokenizer.from_pretrained(kokoroDirectory);
    kokoroEngine = new LocalKokoro(...await Promise.all([model, tokenizer]));
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

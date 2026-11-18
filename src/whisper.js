import { env, pipeline } from '@huggingface/transformers';
import { configureWasm } from './wasm.js';

configureWasm(env);
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = new URL(import.meta.env.BASE_URL + 'models/', self.location.origin).href;
env.useBrowserCache = false;
let recognizer;

self.onmessage = async ({ data: samples }) => {
  try {
    // Whisper can produce plausible words for an entirely silent input.
    if (!samples.some(sample => Math.abs(sample) > 0.0001)) {
      self.postMessage({ type: 'ready', cues: [] });
      return;
    }
    if (!recognizer) {
      self.postMessage({ type: 'status', message: 'Loading Whisper from local model files…' });
      recognizer = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        device: 'wasm', dtype: 'q8', local_files_only: true
      });
    }
    self.postMessage({ type: 'status', message: 'Transcribing English speech on this device…' });
    const result = await recognizer(samples, {
      return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, do_sample: false
    });
    const duration = samples.length / 16000;
    const cues = [];
    for (const [i, chunk] of result.chunks.entries()) {
      const [from, to] = chunk.timestamp;
      const previous = cues.at(-1)?.end ?? 0;
      const start = Math.max(previous, from ?? previous);
      const end = Math.min(duration, to ?? result.chunks[i + 1]?.timestamp[0] ?? duration);
      const text = chunk.text.trim();
      if (text && end > start) cues.push({ start, end, text });
    }
    self.postMessage({ type: 'ready', cues });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};

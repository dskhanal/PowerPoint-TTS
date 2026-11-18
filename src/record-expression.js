import { delivery } from './expression.js';
import { applyExpression } from './voice-effects.js';
import { wavBlob, waveform } from './audio.js';

self.onmessage = async ({ data }) => {
  try {
    // The recorder owns this input format: mono PCM16 with a 44-byte WAV header.
    const bytes = await data.blob.arrayBuffer();
    const rate = new DataView(bytes).getUint32(24, true);
    const pcm = new Int16Array(bytes, 44);
    const samples = Float32Array.from(pcm, value => value / (value < 0 ? 32768 : 32767));
    const profile = delivery(data.emotion, data.intensity);
    const result = applyExpression(samples, rate, profile);
    self.postMessage({
      blob: wavBlob([result], rate, result.length), peaks: waveform([result], result.length)
    });
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};

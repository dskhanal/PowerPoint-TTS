import { KokoroTTS } from 'kokoro-js';
import { RawAudio, Tensor } from '@huggingface/transformers';
import { kokoroDirectory } from './voice-models.js';

// kokoro-js 1.2.1 hardcodes a Hub URL for speaker profiles. Keep its English
// phonemization and tokenizer, and supply the bundled profile at inference.
export class LocalKokoro extends KokoroTTS {
  profiles = new Map();

  async generate_from_ids(inputIds, { voice, speed }) {
    if (!this.profiles.has(voice)) {
      const path = import.meta.env.BASE_URL + 'models/' + kokoroDirectory + '/voices/' + voice + '.bin';
      const response = await fetch(new URL(path, self.location.origin));
      if (!response.ok) throw new Error('Could not load the voice profile for ' + voice + '.');
      this.profiles.set(voice, new Float32Array(await response.arrayBuffer()));
    }
    // The profile supplies a 256-value style for each unpadded token count.
    const offset = 256 * Math.min(Math.max(inputIds.dims.at(-1) - 2, 0), 509);
    const style = this.profiles.get(voice).subarray(offset, offset + 256);
    const { waveform } = await this.model({
      input_ids: inputIds,
      style: new Tensor('float32', style, [1, 256]),
      speed: new Tensor('float32', [speed], [1])
    });
    return new RawAudio(waveform.data, 24000);
  }
}

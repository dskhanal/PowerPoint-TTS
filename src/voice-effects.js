import { SoundTouch } from '@soundtouchjs/core';
function shiftPitch(samples, rate, semitones) {
  if (!semitones) return samples;
  const processor = new SoundTouch({ sampleRate: rate });
  processor.pitchSemitones = semitones;
  // Keep the stereo working buffer bounded for long microphone recordings.
  // Padding drains SoundTouch's last window; only original-length audio is kept.
  const stereo = new Float32Array(8192);
  const mono = new Float32Array(samples.length);
  let input = 0, output = 0;
  while (output < mono.length) {
    const count = Math.min(stereo.length / 2, samples.length - input);
    if (count) {
      for (let i = 0; i < count; i++) stereo[2 * i] = stereo[2 * i + 1] = samples[input + i];
      processor.inputBuffer.putSamples(stereo, 0, count);
      input += count;
    } else {
      stereo.fill(0);
      processor.inputBuffer.putSamples(stereo);
    }
    processor.process();
    while (processor.outputBuffer.frameCount && output < mono.length) {
      const available = Math.min(stereo.length / 2, processor.outputBuffer.frameCount, mono.length - output);
      processor.outputBuffer.extract(stereo, 0, available, true);
      for (let i = 0; i < available; i++) mono[output++] = stereo[2 * i];
    }
  }
  return mono;
}

export function applyExpression(samples, rate, profile, manualPitch = 0) {
  const shifted = shiftPitch(samples, rate, manualPitch + profile.pitch);
  if (!profile.emphasis && !profile.brightness) return shifted;
  const result = new Float32Array(shifted.length);
  const crossover = 1 - Math.exp(-2 * Math.PI * 1800 / rate);
  const highGain = 10 ** (profile.brightness / 20);
  // Follow syllable energy against its slower local average so emphasis follows
  // the speaker's stress pattern, including on untranscribed recordings.
  const fast = 1 - Math.exp(-1 / (0.025 * rate));
  const slow = 1 - Math.exp(-1 / (0.25 * rate));
  let low = 0, envelope = 0, average = 0;
  for (let i = 0; i < result.length; i++) {
    const sample = shifted[i];
    low += crossover * (sample - low);
    envelope += fast * (Math.abs(sample) - envelope);
    average += slow * (envelope - average);
    const stress = Math.max(-1, Math.min(1, (envelope - average) / (average + 0.025)));
    const value = (low + highGain * (sample - low)) * (1 + stress * profile.emphasis);
    // Keep headroom on emphatic peaks and leave quieter samples linear.
    const peak = Math.abs(value);
    result[i] = peak <= 0.94 ? value : Math.sign(value) * (0.94 + 0.06 * Math.tanh((peak - 0.94) / 0.06));
  }
  return result;
}

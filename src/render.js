import { applyExpression } from './voice-effects.js';
import { delivery } from './expression.js';
import { wavBlob, waveform } from './audio.js';
import { phraseSpeed, shapeVolume } from './script-delivery.js';

export async function renderNarration(engine, plan, settings, progress) {
  const { voice, speed, pitch = 0, volume = 100, fadeIn = 0, fadeOut = 0 } = settings;
  const profile = delivery(settings.emotion, settings.intensity);
  const baseSpeed = speed * profile.pace;
  const chunks = [];
  const cues = [];
  const phrases = plan.filter(part => part.text).length;
  let length = 0;
  let rate = 0;
  let pendingPause = 0;

  function appendPause() {
    if (!pendingPause) return;
    const frames = Math.round(pendingPause * rate);
    chunks.push(new Float32Array(frames));
    length += frames;
    pendingPause = 0;
  }

  for (const part of plan) {
    if ('pause' in part) {
      pendingPause += part.pause;
      continue;
    }
    progress('Generating narration · ' + (cues.length + 1) + ' of ' + phrases + ' phrases');
    const audio = await engine.generate(part.text, { voice, speed: phraseSpeed(baseSpeed, part) });
    if (!audio.audio.length) throw new Error('The voice engine returned an empty phrase.');
    rate = audio.sampling_rate;
    appendPause();
    const start = length / rate;
    const voiced = applyExpression(audio.audio, rate, profile, pitch);
    chunks.push(shapeVolume(voiced, part.swell));
    length += audio.audio.length;
    cues.push({ start, end: length / rate, text: part.text });
  }
  appendPause();

  if (volume !== 100 || fadeIn || fadeOut) {
    const gain = volume / 100;
    const firstSpeech = Math.round(cues[0].start * rate);
    const lastSpeech = Math.round(cues.at(-1).end * rate);
    let frame = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++, frame++) {
        const attack = fadeIn ? Math.max(0, frame - firstSpeech) / (fadeIn * rate) : 1;
        const release = fadeOut ? Math.max(0, lastSpeech - 1 - frame) / (fadeOut * rate) : 1;
        const sample = chunk[i] * gain * Math.min(1, attack, release);
        chunk[i] = Math.max(-1, Math.min(1, sample));
      }
    }
  }
  return { blob: wavBlob(chunks, rate, length), peaks: waveform(chunks, length), duration: length / rate, cues };
}

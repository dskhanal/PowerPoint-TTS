import { applyExpression } from './voice-effects.js';
import { delivery } from './expression.js';
import { scriptParts, splitScript, wavBlob, waveform } from './audio.js';

export function narrationPlan(text, preview = false) {
  const plan = [];
  for (const part of scriptParts(text)) {
    if ('pause' in part) {
      if (part.pause < 0.1 || part.pause > 5) throw new Error('Choose a pause between 0.1 and 5 seconds.');
      plan.push(part);
    } else {
      for (const phrase of splitScript(part.text.trim())) {
        if (preview) return [{ text: phrase }];
        plan.push({ text: phrase });
      }
    }
  }
  if (!plan.some(part => part.text)) throw new Error('Add some spoken text to your script.');
  return plan;
}

export async function renderNarration(engine, plan, settings, progress) {
  const { voice, speed, pitch = 0, volume = 100, fadeIn = 0, fadeOut = 0 } = settings;
  const profile = delivery(settings.emotion, settings.intensity);
  const speakingSpeed = Math.max(0.5, Math.min(2, speed * profile.pace));
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
    const audio = await engine.generate(part.text, { voice, speed: speakingSpeed });
    if (!audio.audio.length) throw new Error('The voice engine returned an empty phrase.');
    rate = audio.sampling_rate;
    appendPause();
    const start = length / rate;
    chunks.push(applyExpression(audio.audio, rate, profile, pitch));
    length += audio.audio.length;
    cues.push({ start, end: length / rate, text: part.text });
  }
  appendPause();

  if (volume !== 100 || fadeIn || fadeOut) {
    const gain = volume / 100;
    let frame = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++, frame++) {
        const attack = fadeIn ? frame / (fadeIn * rate) : 1;
        const release = fadeOut ? (length - 1 - frame) / (fadeOut * rate) : 1;
        const sample = chunk[i] * gain * Math.min(1, attack, release);
        chunk[i] = Math.max(-1, Math.min(1, sample));
      }
    }
  }
  return { blob: wavBlob(chunks, rate, length), peaks: waveform(chunks, length), duration: length / rate, cues };
}

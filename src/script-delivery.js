import { scriptParts, splitScript } from './audio.js';

const defaultPause = '[pause 2s]';
export const blankScript = defaultPause + '\n\n' + defaultPause;
// Keep room for both markers around a previously supported 6,000-character script.
export const scriptLimit = 6000 + blankScript.length;

export function withDefaultPauses(text) {
  if (!text.trim()) return blankScript;
  const parts = scriptParts(text.trim());
  const start = 'pause' in parts[0] ? '' : defaultPause + '\n';
  const end = 'pause' in parts.at(-1) ? '' : '\n' + defaultPause;
  return start + text + end;
}
export const defaultVariation = Object.freeze({ volume: 'off', repeat: false, slow: false, seed: 0 });

export function validVariation(v) {
  return v && ['off', 'dip', 'lift', 'mixed'].includes(v.volume) &&
    typeof v.repeat === 'boolean' && typeof v.slow === 'boolean' &&
    Number.isInteger(v.seed) && v.seed >= 0 && v.seed <= 0xffffffff;
}

// Store a seed per page so a preview, full render and reopened project make
// the same choices. Independent streams keep the three effects independent.
function randomStream(text, seed) {
  let state = seed ^ 2166136261;
  for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function varyGroups(phrases, groupSize, random, apply) {
  for (let i = 0; i < phrases.length; i += groupSize) {
    const size = Math.min(groupSize, phrases.length - i);
    apply(phrases[i + Math.floor(random() * size)]);
  }
}

function repeatWord(text, random) {
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
    .filter(([word]) => word.length <= 15 && !/\p{N}/u.test(word));
  if (!words.length) return text;
  const common = words.filter(([word]) => /^(i|we|it|the|that|this|you|so|and|just|really|very)$/i.test(word));
  const candidates = common.length ? common : words;
  const match = candidates[Math.floor(random() * candidates.length)];
  return text.slice(0, match.index) + match[0] + ', ' + text.slice(match.index);
}

export function narrationPlan(text, preview = false, variation = defaultVariation) {
  const plan = [];
  for (const part of scriptParts(text)) {
    if ('pause' in part) {
      if (part.pause < 0.1 || part.pause > 5) throw new Error('Choose a pause between 0.1 and 5 seconds.');
      plan.push(part);
    } else {
      for (const phrase of splitScript(part.text.trim())) plan.push({ text: phrase });
    }
  }
  const phrases = plan.filter(part => part.text);
  if (!phrases.length) throw new Error('Add some spoken text to your script.');
  if (variation.repeat) {
    const random = randomStream(text, variation.seed ^ 1);
    varyGroups(phrases, 6, random, phrase => { phrase.text = repeatWord(phrase.text, random); });
  }
  if (variation.slow) {
    const random = randomStream(text, variation.seed ^ 2);
    varyGroups(phrases, 3, random, phrase => { phrase.pace = 0.78 + 0.12 * random(); });
  }
  if (variation.volume !== 'off') {
    const random = randomStream(text, variation.seed ^ 3);
    for (const phrase of phrases) {
      const lift = variation.volume === 'lift' || (variation.volume === 'mixed' && random() < 0.5);
      phrase.swell = { center: 0.25 + random() * 0.5, width: 0.18 + random() * 0.14,
        gain: 10 ** (((lift ? 1 : -1) * (2 + random() * 2)) / 20) };
    }
  }
  return preview ? [phrases[0]] : plan;
}

export function phraseSpeed(baseSpeed, phrase) {
  const selectedSpeed = Math.max(0.5, Math.min(2, baseSpeed));
  return Math.max(0.5, selectedSpeed * (phrase.pace ?? 1));
}

export function shapeVolume(samples, swell) {
  if (!swell || samples.length === 0) return samples;
  const center = swell.center * samples.length;
  const radius = swell.width * samples.length;
  const output = samples.slice();
  const start = Math.max(0, Math.ceil(center - radius));
  const end = Math.min(samples.length, Math.ceil(center + radius));
  for (let i = start; i < end; i++) {
    // Raised cosine joins the original level smoothly at both edges.
    const blend = (1 + Math.cos(Math.PI * (i - center) / radius)) / 2;
    const gain = 1 + (swell.gain - 1) * blend;
    const sample = samples[i];
    // Taper boosts near full scale to leave headroom without hard clipping.
    output[i] = gain > 1 ? sample * gain / (1 + (gain - 1) * Math.abs(sample)) : sample * gain;
  }
  return output;
}

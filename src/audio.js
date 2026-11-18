// Explicit markers are editable in the script. An ellipsis is a one-second rest.
export function scriptParts(script) {
  const parts = [];
  let start = 0;
  for (const match of script.matchAll(/\[pause\s+(\d+(?:\.\d+)?)s\]|\.{3,}|…+/gi)) {
    if (match.index > start) parts.push({ text: script.slice(start, match.index) });
    parts.push({ pause: Number(match[1] ?? 1) });
    start = match.index + match[0].length;
  }
  if (start < script.length) parts.push({ text: script.slice(start) });
  return parts;
}

// Each phrase is synthesised separately so its cue uses actual sample boundaries.
export function splitScript(text) {
  const phrases = [];
  const sentences = new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text);
  for (const { segment } of sentences) {
    let phrase = '';
    for (const word of segment.trim().split(/\s+/u)) {
      if (phrase && phrase.length + word.length + 1 > 84) {
        phrases.push(phrase);
        phrase = '';
      }
      if (word.length > 180) throw new Error('Break up the long unspaced text before generating narration.');
      phrase = phrase ? phrase + ' ' + word : word;
    }
    if (phrase) phrases.push(phrase);
  }
  return phrases;
}

export function wavBlob(chunks, rate, length) {
  const header = new DataView(new ArrayBuffer(44));
  function tag(offset, text) {
    for (let i = 0; i < text.length; i++) header.setUint8(offset + i, text.charCodeAt(i));
  }
  tag(0, 'RIFF');
  header.setUint32(4, 36 + length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  tag(36, 'data');
  header.setUint32(40, length * 2, true);
  const parts = chunks.map(samples => {
    const pcm = new DataView(new ArrayBuffer(samples.length * 2));
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      pcm.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    return pcm;
  });
  return new Blob([header, ...parts], { type: 'audio/wav' });
}

export function waveform(chunks, length) {
  const peaks = new Float32Array(600);
  let offset = 0;
  for (const samples of chunks) {
    for (let i = 0; i < samples.length; i++) {
      const bin = Math.floor((offset + i) * peaks.length / length);
      peaks[bin] = Math.max(peaks[bin], Math.abs(samples[i]));
    }
    offset += samples.length;
  }
  return peaks;
}

export function clock(seconds) {
  const n = Math.floor(seconds || 0);
  return [Math.floor(n / 60), n % 60].map(v => String(v).padStart(2, '0')).join(':');
}

function stamp(seconds, separator) {
  const ms = Math.round(seconds * 1000);
  const time = [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60];
  return time.map(v => String(v).padStart(2, '0')).join(':') + separator + String(ms % 1000).padStart(3, '0');
}

export function captionsFile(cues, format) {
  const vtt = format === 'VTT';
  const blocks = cues.map(({ start, end, text }, i) => {
    const separator = vtt ? '.' : ',';
    const content = text.trim().replace(/\s*\n\s*/g, ' ').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return (vtt ? '' : (i + 1) + '\n') + stamp(start, separator) + ' --> ' + stamp(end, separator) + '\n' + content;
  });
  return (vtt ? 'WEBVTT\n\n' : '') + blocks.join('\n\n') + '\n';
}

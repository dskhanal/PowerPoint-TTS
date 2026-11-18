import { Zip, ZipPassThrough } from 'fflate';
import { captionsFile } from './audio.js';

const format = 'open-local-tts-project';
const version = 1;

export function safeName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/^\.+|[. ]+$/g, '').trim().slice(0, 95) || 'Untitled';
}

function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function projectFile(project) {
  const blobs = new Map();
  function trackRef(track) {
    if (!track) return null;
    if (!blobs.has(track.blob)) blobs.set(track.blob, blobs.size);
    return { asset: blobs.get(track.blob), name: track.name, cues: track.cues ?? [] };
  }
  const pages = project.pages.map(page => ({
    ...page, voice: trackRef(page.voice), record: trackRef(page.record),
    recorder: { ...page.recorder, original: trackRef(page.recorder.original) }
  }));
  const header = JSON.stringify({ format, version, name: project.name, activePage: project.activePage, pages });
  const parts = [header.slice(0, -1), ',"audio":['];
  let separator = '';
  for (const blob of blobs.keys()) {
    parts.push(separator, '"', await base64(blob), '"');
    separator = ',';
  }
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}

function check(condition, reason) {
  if (!condition) throw new Error(reason);
}

function loadAudio(encoded) {
  check(typeof encoded === 'string', 'Invalid embedded audio.');
  let data;
  if (typeof Uint8Array.fromBase64 === 'function') {
    data = Uint8Array.fromBase64(encoded);
  } else {
    const binary = atob(encoded);
    data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  }
  const view = new DataView(data.buffer);
  const tag = offset => String.fromCharCode(...data.subarray(offset, offset + 4));
  check(data.length > 44 && data.length % 2 === 0 && tag(0) === 'RIFF' && tag(8) === 'WAVE' &&
    tag(12) === 'fmt ' && tag(36) === 'data' && view.getUint32(16, true) === 16 &&
    view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && view.getUint16(34, true) === 16 &&
    view.getUint32(40, true) === data.length - 44, 'A project audio asset is not a valid mono PCM WAV.');
  const rate = view.getUint32(24, true);
  check([22050, 24000, 48000].includes(rate), 'Unrecognised project WAV sample rate.');
  const frames = (data.length - 44) / 2;
  const peaks = new Float32Array(600);
  for (let i = 0; i < frames; i++) {
    const bin = Math.floor(i * peaks.length / frames);
    peaks[bin] = Math.max(peaks[bin], Math.abs(view.getInt16(44 + 2 * i, true)) / 32768);
  }
  return { blob: new Blob([data], { type: 'audio/wav' }), duration: frames / rate, peaks, rate };
}

export async function openProject(file, validateSettings) {
  const data = JSON.parse(await file.text());
  check(data?.format === format && data.version === version, 'Choose a supported Open Local.TTS project JSON file.');
  const title = value => typeof value === 'string' && value.trim() && value.length <= 100;
  check(title(data.name) && Array.isArray(data.pages) && data.pages.length > 0 &&
    Number.isInteger(data.activePage) && data.activePage >= 0 && data.activePage < data.pages.length &&
    Array.isArray(data.audio), 'Invalid project name, active page, or contents.');
  const assets = data.audio.map(loadAudio);
  function restoreTrack(ref) {
    if (ref === null) return null;
    check(ref && Number.isInteger(ref.asset) && assets[ref.asset] && typeof ref.name === 'string' && Array.isArray(ref.cues), 'Invalid audio reference.');
    const audio = assets[ref.asset];
    let previous = 0;
    const cues = ref.cues.map(cue => {
      check(cue && typeof cue.text === 'string' && Number.isFinite(cue.start) && Number.isFinite(cue.end) &&
        cue.start >= previous && cue.end > cue.start && cue.end <= audio.duration + 0.0001, 'Invalid caption timing.');
      previous = cue.end;
      return { start: cue.start, end: cue.end, text: cue.text };
    });
    return { ...audio, name: ref.name, cues };
  }
  const pages = data.pages.map((p, index) => {
    try {
      check(p && title(p.title) && typeof p.script === 'string' && p.script.length <= 6000 &&
        ['voice','record'].includes(p.source) && [p.source,'captions'].includes(p.mode), 'Invalid page contents.');
      check(p.recorder && validateSettings(p.settings, p.recorder), 'Invalid voice or recording settings.');
      const voice = restoreTrack(p.voice);
      const record = restoreTrack(p.record);
      const original = restoreTrack(p.recorder.original);
      check(record ? original && record.rate === 48000 && original.rate === 48000 && record.duration === original.duration : !original, 'Invalid original recording.');
      return { title: p.title, script: p.script, settings: p.settings, mode: p.mode, source: p.source, voice, record,
        recorder: { expression: p.recorder.expression, appliedStyle: p.recorder.appliedStyle, original } };
    } catch (error) { throw new Error('Page ' + (index + 1) + ' — ' + error.message); }
  });
  return { name: data.name, activePage: data.activePage, pages };
}

export async function projectZip(project) {
  const parts = [];
  let zipError;
  const zip = new Zip((error, chunk) => { if (error) zipError = error; else parts.push(chunk); });
  async function add(name, blob) {
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        entry.push(value);
        if (zipError) throw zipError;
      }
      entry.push(new Uint8Array(), true);
    } finally { reader.releaseLock(); }
  }
  await add('project.json', await projectFile(project));
  for (const [i, page] of project.pages.entries()) {
    const dir = String(i + 1).padStart(3, '0') + '-' + safeName(page.title) + '/';
    await add(dir + 'script.txt', new Blob([page.script]));
    for (const [type, track] of [['narration', page.voice], ['recording', page.record]]) {
      if (!track) continue;
      await add(dir + type + '.wav', track.blob);
      if (track.cues.some(cue => !cue.text.trim())) throw new Error('Complete the empty ' + type + ' caption on page ' + (i + 1) + ', or save the draft with Save JSON.');
      if (!track.cues.length) continue;
      for (const format of ['SRT', 'VTT']) {
        await add(dir + type + '.' + format.toLowerCase(), new Blob([captionsFile(track.cues, format)]));
      }
    }
  }
  zip.end();
  if (zipError) throw zipError;
  return new Blob(parts, { type: 'application/zip' });
}

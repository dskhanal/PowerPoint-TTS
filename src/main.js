import { australianVoices } from './australian-voices.js';
import { icon } from './icons.js';
import { defaultVariation, validVariation, blankScript, scriptLimit, withDefaultPauses, narrationPlan, phraseSpeed } from './script-delivery.js';
import { captionsFile, clock } from './audio.js';
import { delivery, expressionControls } from './expression.js';
import { setupRecorder } from './recording.js';
import { setupProject } from './project-ui.js';
import { setupMonitor } from './monitor.js';

const $ = id => document.getElementById(id);
document.querySelectorAll('[data-icon]').forEach(node => node.replaceWith(
  document.createRange().createContextualFragment(icon(node.dataset.icon))
));

const expression = expressionControls($('tts-expression'), count);
const sample = 'A familiar voice can make a new idea feel simple. In this presentation, we’ll explore how a few small changes can make a difference.';
const voices = {
  'American English': 'af_heart af_alloy af_aoede af_bella af_jessica af_kore af_nicole af_nova af_river af_sarah af_sky am_adam am_echo am_eric am_fenrir am_liam am_michael am_onyx am_puck am_santa',
  'Australian English': Object.keys(australianVoices).join(' '),
  'British English': 'bf_emma bf_isabella bf_alice bf_lily bm_george bm_lewis bm_daniel bm_fable'
};
for (const [accent, ids] of Object.entries(voices)) {
  const group = document.createElement('optgroup');
  group.label = accent;
  for (const id of ids.split(' ')) {
    const name = id.slice(3, 4).toUpperCase() + id.slice(4);
    group.append(new Option(name + ' · ' + accent, id));
  }
  $('voice').append(group);
}

let cues = [];
let activeCue = -1;
let fileName = '';
let worker;
let busy = false;
let recorderBusy = false;
let projectUI;
let pageRevision = 0;
let previewUrl;
const previewPlayer = $('preview-audio');
previewPlayer.onplay = () => $('player').pause();
$('player').addEventListener('play', () => previewPlayer.pause());
const monitor = setupMonitor(highlightCue, message => status(message, true));

const tracks = { voice: null, record: null };
let source = 'voice';

function displayTrack() {
  const track = tracks[source];
  cues = track?.cues ?? [];
  fileName = track?.name ?? '';
  renderCaptions();
  if (track) monitor.load(track, fileName);
  else monitor.clear();
}

const recorder = setupRecorder({
  onBusy(value) { recorderBusy = value; projectUI?.setBusy(busy || recorderBusy); },
  publish(track) {
    const sameAudio = track === tracks.record;
    tracks.record = track;
    if (source !== 'record') return;
    if (!sameAudio) displayTrack();
    else {
      cues = track.cues;
      renderCaptions();
      highlightCue($('player').currentTime);
    }
  },
  lockCapture(locked) {
    for (const mode of ['voice', 'captions']) document.querySelector('[data-mode="' + mode + '"]').disabled = locked;
    document.querySelector('.monitor').inert = locked;
    if (locked) {
      $('player').pause();
      previewPlayer.pause();
    }
  },
  review() { document.querySelector('[data-mode="captions"]').click(); }
});

function status(message = '', error = false) {
  $('feedback').textContent = message;
  $('feedback').classList.toggle('error', error);
}
let variationSeed = 0;
function variationSettings() {
  return { volume: $('volume-variation').value, repeat: $('repeat-words').checked,
    slow: $('slow-phrases').checked, seed: variationSeed };
}

function updateVariation() {
  const variation = variationSettings();
  $('shuffle-delivery').disabled = variation.volume === 'off' && !variation.repeat && !variation.slow;
  count();
}

for (const id of ['volume-variation', 'repeat-words', 'slow-phrases']) $(id).onchange = updateVariation;
$('shuffle-delivery').onclick = () => {
  variationSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  rememberVoiceSettings();
  count();
  status('New variation selected. Preview or generate to hear it.');
};

function count() {
  const text = $('text').value;
  $('counter').textContent = text.length.toLocaleString('en-AU') + ' / ' + scriptLimit.toLocaleString('en-AU');
  const { emotion, intensity } = expression.settings();
  const baseSpeed = Number($('speed').value) * delivery(emotion, intensity).pace;
  try {
    const plan = text.trim() && text !== blankScript ? narrationPlan(text, false, variationSettings()) : [];
    let seconds = 0;
    for (const part of plan) {
      seconds += part.pause ?? part.text.split(/\s+/).length / (2.5 * phraseSpeed(baseSpeed, part));
    }
    $('estimate').textContent = '~' + Math.ceil(seconds) + ' sec';
  } catch {
    $('estimate').textContent = '— sec';
  }
}
function setEditorScript(script) {
  const input = $('text');
  input.value = script;
  if (script === blankScript) {
    const middle = script.indexOf('\n') + 1;
    input.setSelectionRange(middle, middle);
  }
}
function replaceScript(text) {
  const script = withDefaultPauses(text);
  if (script.length > scriptLimit) {
    status('This script is too long. Import a shorter section.', true);
    return;
  }
  setEditorScript(script);
  count();
  status();
  $('text').focus();
}
$('text').oninput = count;
$('speed').oninput = () => {
  $('speed-out').value = Number($('speed').value).toFixed(2) + '×';
  count();
};
$('volume').oninput = () => { $('volume-out').value = $('volume').value + '%'; };
$('insert-pause').onclick = () => {
  const input = $('text');
  const cursor = input.selectionEnd;
  const marker = '[pause ' + $('pause-duration').value + 's]';
  if (input.value.length + marker.length > input.maxLength) return status('Make room in the script before inserting a pause.', true);
  input.setRangeText(marker, cursor, cursor, 'end');
  input.focus();
  count();
};
$('sample').onclick = () => replaceScript(sample);
$('import-text').onclick = () => $('text-file').click();
$('text-file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 24000) throw new Error('Import a text file with up to 6,000 characters.');
    const revision = pageRevision;
    const text = await file.text();
    if (pageRevision === revision) replaceScript(text.trim());
  } catch (error) { status(error.message, true); }
};

function connectOffice() {
  globalThis.Office?.onReady?.(info => {
    if (info.host === Office.HostType.PowerPoint) $('selection').hidden = false;
  });
}
if (globalThis.Office) connectOffice();
else document.querySelector('script[src*="appsforoffice"]').addEventListener('load', connectOffice);
$('selection').onclick = () => {
  const revision = pageRevision;
  Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, { valueFormat: Office.ValueFormat.Unformatted }, result => {
    if (revision !== pageRevision) return;
    if (result.status !== Office.AsyncResultStatus.Succeeded) return status(result.error.message, true);
    const value = String(result.value || '').trim();
    if (value) replaceScript(value);
    else status('Select some slide text in PowerPoint first.');
  });
};

for (const tab of document.querySelectorAll('[data-mode]')) {
  tab.onclick = () => {
    const mode = tab.dataset.mode;
    if (mode !== 'captions' && mode !== source) {
      previewPlayer.pause();
      source = mode;
      displayTrack();
      status();
    }
    for (const button of document.querySelectorAll('[data-mode]')) {
      const selected = button === tab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      $(button.dataset.mode + '-panel').hidden = !selected;
    }
  };
}

function highlightCue(time) {
  const next = cues.findIndex(cue => time >= cue.start && time < cue.end);
  if (next === activeCue) return;
  $('cues').children[activeCue]?.classList.remove('current');
  $('cues').children[next]?.classList.add('current');
  activeCue = next;
}
function renderCaptions() {
  activeCue = -1;
  if (!cues.length) {
    $('caption-results').hidden = true;
    $('cues').replaceChildren();
    $('caption-hint').textContent = source === 'record' ? 'Record or open audio in Record audio to generate captions with Whisper.' : 'Generate a voiceover to create captions timed to your narration.';
    return;
  }
  $('caption-hint').textContent = 'Select a timestamp to hear the narration. Edit the caption text before exporting.';
  $('caption-results').hidden = false;
  $('cues').replaceChildren(...cues.map((cue, index) => {
    const row = document.createElement('div');
    row.className = 'cue';
    const time = document.createElement('button');
    time.textContent = clock(cue.start) + ' – ' + clock(cue.end);
    time.setAttribute('aria-label', 'Play from caption ' + (index + 1));
    time.onclick = () => monitor.audition(cue.start);
    const edit = document.createElement('textarea');
    edit.rows = 2;
    edit.value = cue.text;
    edit.setAttribute('aria-label', 'Caption ' + (index + 1));
    edit.oninput = () => { cue.text = edit.value; };
    row.append(time, edit);
    return row;
  }));
}
$('export-captions').onclick = () => {
  const blank = cues.findIndex(cue => !cue.text.trim());
  if (blank >= 0) {
    $('cues').children[blank].querySelector('textarea').focus();
    return status('Enter text for caption ' + (blank + 1) + ' before exporting.', true);
  }
  const format = $('format').value;
  const blob = new Blob([captionsFile(cues, format)], { type: format === 'VTT' ? 'text/vtt;charset=utf-8' : 'application/x-subrip;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName + '.' + format.toLowerCase();
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  status('Caption file exported.');
};

function generating(value, preview = false) {
  monitor.setLoading(value ? (preview ? 'Generating voice preview…' : 'Generating voiceover…') : '');
  busy = value;
  projectUI?.setBusy(busy || recorderBusy);
  document.querySelector('[data-mode=record]').disabled = value;
  $('generate').innerHTML = icon(value ? 'cancel' : 'wave') + (value ? 'Cancel generation' : 'Generate voiceover');
  for (const id of ['voice', 'speed', 'pitch', 'tts-expression', 'variation-controls', 'volume', 'fade-in', 'fade-out', 'preview', 'text', 'sample', 'selection', 'import-text', 'insert-pause', 'pause-duration']) {
    $(id).disabled = value;
  }
}
function resetWorker() {
  worker?.terminate();
  worker = undefined;
  generating(false);
}
function generate(preview) {
  if (busy) {
    resetWorker();
    return status('Generation cancelled.');
  }
  const draft = $('text').value;
  const text = (draft === blankScript ? '' : draft.trim()) || (preview ? sample : '');
  if (!text) {
    $('text').focus();
    return status('Enter a script or choose Use sample to generate a voiceover.', true);
  }
  try {
    previewPlayer.pause();
    generating(true, preview);
    status('Starting the local voice engine…');
    worker ??= new Worker(new URL('./synthesis.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') return status(data.message);
      if (data.type === 'error') {
        resetWorker();
        return status('Generation failed. ' + data.message, true);
      }
      if (data.type === 'ready') {
        if (preview) {
          const previous = previewUrl;
          previewUrl = URL.createObjectURL(data.blob);
          previewPlayer.src = previewUrl;
          previewPlayer.hidden = false;
          if (previous) URL.revokeObjectURL(previous);
          generating(false);
          status('Voice preview ready.');
          previewPlayer.play().catch(() => {});
          return;
        }
        tracks.voice = { ...data, name: 'sano-local-tts-' + $('voice').value.slice(3) + '-narration' };
        if (source === 'voice') displayTrack();
        generating(false);
        status('Voiceover and captions are ready.');
        if (source === 'voice' && autoplay.checked) monitor.autoplay();
      }
    };
    worker.onerror = event => {
      resetWorker();
      status('The voice engine could not start. ' + (event.message || 'Reload and try again.'), true);
    };
    worker.postMessage({
      ...expression.settings(), variation: variationSettings(), text, preview, voice: $('voice').value, speed: Number($('speed').value),
      pitch: Number($('pitch').value), volume: Number($('volume').value),
      fadeIn: Number($('fade-in').value), fadeOut: Number($('fade-out').value)
    });
  } catch (error) {
    resetWorker();
    status(error.message, true);
  }
}

const autoplay = $('autoplay');
const autoplayKey = 'sano-local-tts.autoplay';
try {
  autoplay.checked = localStorage.getItem(autoplayKey) === 'true';
} catch { /* Browser storage is optional. */ }
autoplay.onchange = () => {
  try { localStorage.setItem(autoplayKey, String(autoplay.checked)); }
  catch { /* The checkbox still applies for this session. */ }
};

$('generate').onclick = () => generate(false);
$('preview').onclick = () => generate(true);

const voiceSettingIds = ['voice', 'speed', 'pitch', 'volume', 'fade-in', 'fade-out'];
const voiceStorageKey = 'open-local-tts.voice-settings.v1';

function readVoiceSettings() {
  const controls = Object.fromEntries(voiceSettingIds.map(id => [id, $(id).value]));
  return { ...controls, ...expression.settings(), variation: variationSettings() };
}

function rememberVoiceSettings() {
  voiceDefaults = readVoiceSettings();
  try {
    localStorage.setItem(voiceStorageKey, JSON.stringify(voiceDefaults));
  } catch {
    // The in-memory defaults still apply when the host blocks browser storage.
  }
}

function snapshotPage() {
  return {
    script: $('text').value, settings: { ...readVoiceSettings(), 'pause-duration': $('pause-duration').value, format: $('format').value },
    source, mode: document.querySelector('[data-mode][aria-pressed=true]').dataset.mode,
    voice: tracks.voice, record: tracks.record, recorder: recorder.snapshot()
  };
}

function applyVoiceSettings(settings) {
  for (const id of voiceSettingIds) $(id).value = settings[id];
  const variation = settings.variation ?? defaultVariation;
  variationSeed = variation.seed;
  $('volume-variation').value = variation.volume;
  $('repeat-words').checked = variation.repeat;
  $('slow-phrases').checked = variation.slow;
  updateVariation();
  expression.restore(settings);
  $('speed').oninput();
  $('volume').oninput();
}

function restorePage(page) {
  pageRevision++;
  previewPlayer.pause();
  previewPlayer.removeAttribute('src');
  previewPlayer.load();
  previewPlayer.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  setEditorScript(page.script);
  $('pause-duration').value = page.settings['pause-duration'];
  $('format').value = page.settings.format;
  applyVoiceSettings(page.settings);
  tracks.voice = page.voice;
  tracks.record = page.record;
  source = page.source;
  recorder.restore(page.record, page.recorder);
  displayTrack();
  document.querySelector('[data-mode="' + page.mode + '"]').click();
  status();
}

const emotionNames = [...$('tts-expression').querySelector('select').options].map(option => option.value);

function validExpression(value) {
  return value && emotionNames.includes(value.emotion) && Number.isInteger(value.intensity) && value.intensity >= 0 && value.intensity <= 100;
}

function validControl(id, value) {
  const control = $(id);
  if (typeof value !== 'string' || !value.trim()) return false;
  if (control.options) return [...control.options].some(option => option.value === value);
  const n = Number(value);
  return Number.isFinite(n) && n >= Number(control.min) && n <= Number(control.max);
}

function validVoiceSettings(settings) {
  return validExpression(settings) && (settings.variation === undefined || validVariation(settings.variation)) &&
    voiceSettingIds.every(id => validControl(id, settings[id]));
}

function validPageSettings(settings, savedRecorder) {
  if (!validVoiceSettings(settings) || !validExpression(savedRecorder.expression)) return false;
  const [name, amount] = String(savedRecorder.appliedStyle).split('-');
  if (savedRecorder.appliedStyle !== 'Neutral' && !(emotionNames.includes(name) && Number(amount) > 0 && Number(amount) <= 100 && savedRecorder.appliedStyle === name + '-' + Number(amount))) return false;
  return validControl('pause-duration', settings['pause-duration']) && validControl('format', settings.format);
}

try {
  const saved = JSON.parse(localStorage.getItem(voiceStorageKey));
  if (validVoiceSettings(saved)) applyVoiceSettings(saved);
} catch {
  // Missing or unreadable preferences leave the editor's initial values in place.
}
let voiceDefaults = readVoiceSettings();
document.querySelector('#voice-panel .settings').addEventListener('input', rememberVoiceSettings);

$('text').maxLength = scriptLimit;
setEditorScript(blankScript);
count();

projectUI = setupProject({
  snapshot: snapshotPage, restore: restorePage, validateSettings: validPageSettings,
  getVoiceDefaults: () => voiceDefaults,
  stopPlayback() { $('player').pause(); previewPlayer.pause(); }
});

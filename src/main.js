import { australianVoices } from './australian-voices.js';
import { icon } from './icons.js';
import { captionsFile, clock, scriptParts } from './audio.js';
import { delivery, expressionControls } from './expression.js';
import { setupRecorder } from './recording.js';
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

setupRecorder({
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
function count() {
  const text = $('text').value;
  let words = 0;
  let silence = 0;
  for (const part of scriptParts(text)) {
    if (part.text?.trim()) words += part.text.trim().split(/\s+/).length;
    if (part.pause) silence += part.pause;
  }
  $('counter').textContent = text.length.toLocaleString('en-AU') + ' / 6,000';
  const { emotion, intensity } = expression.settings();
  const speed = Math.max(0.5, Math.min(2, Number($('speed').value) * delivery(emotion, intensity).pace));
  $('estimate').textContent = '~' + Math.ceil(words / (2.5 * speed) + silence) + ' sec';
}
function replaceScript(text) {
  if (text.length > $('text').maxLength) {
    status('This script exceeds 6,000 characters. Import a shorter section.', true);
    return;
  }
  $('text').value = text;
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
    replaceScript((await file.text()).trim());
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
  Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, { valueFormat: Office.ValueFormat.Unformatted }, result => {
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

function generating(value) {
  busy = value;
  document.querySelector('[data-mode=record]').disabled = value;
  $('generate').innerHTML = icon(value ? 'cancel' : 'wave') + (value ? 'Cancel generation' : 'Generate voiceover');
  for (const id of ['voice', 'speed', 'pitch', 'tts-expression', 'volume', 'fade-in', 'fade-out', 'preview', 'text', 'sample', 'selection', 'import-text', 'insert-pause', 'pause-duration']) {
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
  const text = $('text').value.trim() || (preview ? sample : '');
  if (!text) {
    $('text').focus();
    return status('Enter a script or choose Use sample to generate a voiceover.', true);
  }
  try {
    previewPlayer.pause();
    generating(true);
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
        tracks.voice = { ...data, name: 'open-local-tts-' + $('voice').value.slice(3) + '-narration' };
        if (source === 'voice') displayTrack();
        generating(false);
        status('Voiceover and captions are ready.');
      }
    };
    worker.onerror = event => {
      resetWorker();
      status('The voice engine could not start. ' + (event.message || 'Reload and try again.'), true);
    };
    worker.postMessage({
      ...expression.settings(), text, preview, voice: $('voice').value, speed: Number($('speed').value),
      pitch: Number($('pitch').value), volume: Number($('volume').value),
      fadeIn: Number($('fade-in').value), fadeOut: Number($('fade-out').value)
    });
  } catch (error) {
    resetWorker();
    status(error.message, true);
  }
}

$('generate').onclick = () => generate(false);
$('preview').onclick = () => generate(true);

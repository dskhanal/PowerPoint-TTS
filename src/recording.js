import { wavBlob, waveform, clock } from './audio.js';
import { expressionControls } from './expression.js';
import { icon } from './icons.js';

export function setupRecorder({ publish, lockCapture, review }) {
  const $ = id => document.getElementById(id);
  const button = $('record-button');
  const recognize = $('recognize');
  let phase = 'idle';
  let lastTake;
  let captureId = 0;
  let stream;
  let recorder;
  let timer;
  let worker;
  let recognitionId = 0;
  let originalTake;
  let effectWorker;
  let appliedStyle = 'Neutral';
  const expression = expressionControls($('record-expression'), updateExpression);

  function styleKey() {
    const { emotion, intensity } = expression.settings();
    return emotion === 'Neutral' || intensity === 0 ? 'Neutral' : emotion + '-' + intensity;
  }
  function updateExpression() {
    $('take-expression').hidden = !lastTake;
    $('record-expression').disabled = phase !== 'idle';
    $('apply-expression').disabled = phase !== 'idle' || styleKey() === appliedStyle;
  }
  $('apply-expression').onclick = () => {
    if (!originalTake || phase !== 'idle') return;
    const key = styleKey();
    const { emotion, intensity } = expression.settings();
    function commit(audio, name) {
      lastTake = { ...lastTake, ...audio, name };
      appliedStyle = key;
      publish(lastTake);
      state('idle');
      message(key === 'Neutral' ? 'Original recording restored.' : emotion + ' expression applied. Play or export the adjusted recording.');
    }
    if (key === 'Neutral') {
      commit({ blob: originalTake.blob, peaks: originalTake.peaks }, originalTake.name);
      return;
    }
    state('processing');
    message('Applying expression to the original recording…');
    function finish() {
      effectWorker?.terminate();
      effectWorker = undefined;
    }
    function failed(reason) {
      finish();
      state('idle');
      message('Could not apply expression. ' + reason, true);
    }
    try {
      effectWorker = new Worker(new URL('./record-expression.js', import.meta.url), { type: 'module' });
      effectWorker.onerror = event => failed(event.message || 'Audio processing failed.');
      effectWorker.onmessage = ({ data }) => {
        if (data.error) return failed(data.error);
        finish();
        commit(data, originalTake.name + '-' + key.toLowerCase());
      };
      effectWorker.postMessage({ blob: originalTake.blob, emotion, intensity });
    } catch (error) { failed(error.message); }
  };


  function message(text, error = false) {
    $('record-status').textContent = text;
    $('record-status').classList.toggle('error', error);
  }
  function state(next) {
    phase = next;
    updateExpression();
    const recording = next === 'recording';
    const requesting = next === 'requesting';
    const transcribing = next === 'transcribing';
    const busy = next !== 'idle';
    button.disabled = busy && !recording && !requesting;
    button.innerHTML = icon(recording ? 'stop' : 'mic') + (recording ? 'Stop recording' : requesting ? 'Cancel request' : 'Start recording');
    button.classList.toggle('recording', recording);
    $('open-audio').disabled = busy;
    recognize.hidden = !lastTake || (!transcribing && (busy || lastTake.cues.length > 0));
    recognize.textContent = transcribing ? 'Cancel transcription' : 'Generate captions';
    $('view-transcript').hidden = busy || !lastTake?.cues.length;
    lockCapture(recording || requesting);
  }
  function releaseMicrophone() {
    clearInterval(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = undefined;
  }
  function cancelTranscription() {
    recognitionId++;
    worker?.terminate();
    worker = undefined;
    state('idle');
    message('Transcription cancelled. The WAV is available in the audio monitor.');
  }
  async function transcribe() {
    const id = ++recognitionId;
    state('transcribing');
    message('Preparing audio for Whisper…');
    try {
      const context = new OfflineAudioContext(1, 1, 16000);
      // The exported WAV is mono. Decoding at Whisper's rate also resamples it.
      const decoded = await context.decodeAudioData(await originalTake.blob.arrayBuffer());
      if (id !== recognitionId) return;
      const samples = decoded.getChannelData(0).slice();
      worker ??= new Worker(new URL('./whisper.js', import.meta.url), { type: 'module' });
      worker.onerror = event => failed(event.message || 'Whisper could not start.');
      worker.onmessage = ({ data }) => {
        if (id !== recognitionId) return;
        if (data.type === 'status') return message(data.message);
        if (data.type === 'error') return failed(data.message);
        lastTake.cues = data.cues;
        publish(lastTake);
        state('idle');
        message(data.cues.length ? 'WAV and captions are ready. Review the transcript before exporting.' : 'No speech was recognised. The WAV is available to export.');
      };
      worker.postMessage(samples, [samples.buffer]);
    } catch (error) {
      if (id === recognitionId) failed(error.message);
    }
    function failed(reason) {
      worker?.terminate();
      worker = undefined;
      state('idle');
      message('Transcription failed. The WAV is available to export. ' + reason, true);
    }
  }

  async function acceptAudio(blob, name) {
    state('decoding');
    message('Preparing the WAV file…');
    try {
      const rate = 48000;
      const context = new OfflineAudioContext(1, 1, rate);
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (!decoded.length) throw new Error('No audio frames were captured.');
      const mono = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const input = decoded.getChannelData(channel);
        for (let i = 0; i < mono.length; i++) mono[i] += input[i] / decoded.numberOfChannels;
      }
      lastTake = {
        name, duration: mono.length / rate, peaks: waveform([mono], mono.length),
        blob: wavBlob([mono], rate, mono.length), cues: []
      };
      originalTake = lastTake;
      appliedStyle = 'Neutral';
      expression.reset();
      $('record-time').textContent = clock(lastTake.duration);
      publish(lastTake);
      await transcribe();
    } catch (error) {
      state('idle');
      message('Could not read the audio. ' + error.message, true);
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      message('Microphone recording requires an HTTPS or localhost browser with recording support. You can also open an audio file.', true);
      return;
    }
    const id = ++captureId;
    state('requesting');
    message('Waiting for microphone permission…');
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== captureId) {
        input.getTracks().forEach(track => track.stop());
        return;
      }
      stream = input;
      const session = new MediaRecorder(input);
      recorder = session;
      const chunks = [];
      session.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      session.onerror = () => {
        captureId++;
        releaseMicrophone();
        state('idle');
        message('Recording was interrupted. Check your microphone and try again.', true);
      };
      session.onstop = () => {
        if (id !== captureId) return;
        releaseMicrophone();
        const name = 'open-local-recording-' + new Date().toISOString().replace(/[:.]/g, '-');
        void acceptAudio(new Blob(chunks, { type: session.mimeType }), name);
      };
      const device = input.getAudioTracks()[0];
      device.onended = () => { if (session.state === 'recording') session.stop(); };
      session.start(1000);
      const started = performance.now();
      $('record-time').textContent = '00:00';
      timer = setInterval(() => { $('record-time').textContent = clock((performance.now() - started) / 1000); }, 250);
      state('recording');
      message('Microphone on. Stop recording to prepare the WAV and captions.');
    } catch (error) {
      if (id !== captureId) return;
      releaseMicrophone();
      state('idle');
      const reason = error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser or open an audio file.' : 'Could not start the microphone. ' + error.message;
      message(reason, true);
    }
  }

  button.onclick = () => {
    if (phase === 'requesting') {
      captureId++;
      state('idle');
      return message('Microphone request cancelled.');
    }
    if (phase === 'recording') {
      state('stopping');
      recorder.stop();
      releaseMicrophone();
      return;
    }
    if (phase === 'idle') void start();
  };
  $('open-audio').onclick = () => $('record-file').click();
  $('record-file').onchange = event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file && phase === 'idle') void acceptAudio(file, file.name.replace(/\.[^.]+$/, '') || 'recording');
  };
  recognize.onclick = () => phase === 'transcribing' ? cancelTranscription() : transcribe();
  $('view-transcript').onclick = review;
  window.addEventListener('pagehide', () => {
    effectWorker?.terminate();
    effectWorker = undefined;
    captureId++;
    if (recorder?.state === 'recording') recorder.stop();
    releaseMicrophone();
    recognitionId++;
    worker?.terminate();
    worker = undefined;
    state('idle');
  });
}

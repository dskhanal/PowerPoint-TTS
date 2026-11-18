import { clock } from './audio.js';
import { icon } from './icons.js';

export function setupMonitor(onTime, onError) {
  const byId = id => document.getElementById(id);
  const player = byId('player');
  const canvas = byId('wave');
  const play = byId('play');
  const seek = byId('seek');
  let track;
  let objectUrl;
  let frame;
  let ticks = 0;

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = window.devicePixelRatio || 1;
    if (!width || !height) return;
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#71805c';
    ctx.fillRect(0, height / 2, width, 0.7);
    const columns = Math.max(2, Math.floor(width / 3.7));
    const position = track ? player.currentTime / track.duration : 0;
    for (let i = 0; i < columns; i++) {
      const x = i / (columns - 1);
      // An idle trace identifies the monitor before a generated waveform is available.
      const envelope = Math.abs(Math.sin(x * 14 - .3) * Math.cos(x * 7 + .6)) ** .8;
      const idle = (.06 + envelope * .93) * (.22 + .78 * Math.abs(Math.sin(i * 8.37) * Math.cos(i * .19)));
      const peak = track ? Math.sqrt(track.peaks[Math.floor(x * (track.peaks.length - 1))]) : idle;
      const size = Math.max(1.5, peak * height * .95);
      ctx.fillStyle = track && x < position ? '#f1ffd5' : '#bfe782';
      ctx.fillRect(i * width / columns, (height - size) / 2, 2, size);
    }
    if (track) {
      ctx.fillStyle = '#e6ffd2';
      ctx.fillRect(Math.min(width - 1, position * width), 2, 1, height - 4);
    }
    const count = width < 420 ? 5 : 9;
    if (ticks !== count) {
      byId('ruler').replaceChildren(...Array.from({ length: count }, (_, i) => {
        const label = document.createElement('span');
        label.textContent = clock(i * (track?.duration ?? 32) / (count - 1));
        return label;
      }));
      ticks = count;
    }
  }

  function update() {
    byId('elapsed').textContent = clock(player.currentTime);
    seek.value = player.currentTime || 0;
    seek.setAttribute('aria-valuetext', clock(player.currentTime));
    onTime(player.currentTime);
    draw();
  }
  function animate() {
    draw();
    if (!player.paused) frame = requestAnimationFrame(animate);
  }
  function playbackChanged() {
    const playing = !player.paused;
    play.innerHTML = icon(playing ? 'pause' : 'play');
    play.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
    byId('monitor-state').textContent = track ? (playing ? 'Playing' : 'Ready') : 'Standby';
    cancelAnimationFrame(frame);
    if (playing) animate();
    update();
  }
  const start = () => player.play().catch(() => onError('Playback could not start. Try playing the exported WAV.'));
  play.onclick = () => player.paused ? start() : player.pause();
  player.onplay = player.onpause = playbackChanged;
  player.ontimeupdate = update;
  seek.oninput = () => { player.currentTime = Number(seek.value); update(); };
  byId('mute').onclick = () => {
    player.muted = !player.muted;
    byId('mute').innerHTML = icon(player.muted ? 'muted' : 'volume');
    byId('mute').setAttribute('aria-label', player.muted ? 'Unmute audio' : 'Mute audio');
    byId('mute').setAttribute('aria-pressed', String(player.muted));
  };
  new ResizeObserver(draw).observe(canvas);
  return {
    load(result, name) {
      player.pause();
      track = result;
      const previous = objectUrl;
      objectUrl = URL.createObjectURL(result.blob);
      player.src = objectUrl;
      const link = byId('download');
      link.href = objectUrl;
      link.download = name + '.wav';
      link.removeAttribute('aria-disabled');
      if (previous) URL.revokeObjectURL(previous);
      byId('track-name').textContent = link.download;
      byId('duration').textContent = clock(result.duration);
      play.disabled = seek.disabled = byId('mute').disabled = false;
      seek.max = result.duration;
      ticks = 0;
      playbackChanged();
    },
    clear() {
      player.pause();
      track = undefined;
      player.removeAttribute('src');
      player.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
      const link = byId('download');
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      byId('track-name').textContent = 'No audio loaded';
      byId('duration').textContent = '00:00';
      play.disabled = seek.disabled = byId('mute').disabled = true;
      ticks = 0;
      playbackChanged();
    },
    audition(seconds) {
      player.currentTime = seconds;
      start();
    }
  };
}

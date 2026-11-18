// Pitch in semitones, brightness in dB above 1.8 kHz and pace as a multiplier.
const presets = {
  Neutral:  { pitch: 0,    pace: 1,    brightness: 0,    emphasis: 0 },
  Calm:     { pitch: -1.6, pace: 0.86, brightness: -3.5, emphasis: -0.18 },
  Cheerful: { pitch: 2,    pace: 1.08, brightness: 2,    emphasis: 0.16 },
  Serious:  { pitch: -2.8, pace: 0.94, brightness: -1,   emphasis: 0.12 },
  Excited:  { pitch: 3,    pace: 1.18, brightness: 3.5,  emphasis: 0.32 }
};

export function delivery(style = 'Neutral', intensity = 70) {
  const preset = presets[style] ?? presets.Neutral;
  const mix = Math.max(0, Math.min(100, intensity)) / 100;
  return {
    pitch: preset.pitch * mix, pace: preset.pace ** mix,
    brightness: preset.brightness * mix, emphasis: preset.emphasis * mix
  };
}

export function expressionControls(container, onChange) {
  container.innerHTML = `
    <label>Emotion<select class="emotion"></select></label>
    <div class="intensity" hidden>
      <label>Intensity <output>70%</output>
        <input type="range" aria-label="Emotion intensity" min="0" max="100" value="70" step="5">
      </label>
    </div>`;
  const select = container.querySelector('select');
  const slider = container.querySelector('input');
  const intensity = container.querySelector('.intensity');
  for (const name of Object.keys(presets)) select.add(new Option(name, name));
  function update() {
    intensity.hidden = select.value === 'Neutral';
    container.querySelector('output').value = slider.value + '%';
    slider.setAttribute('aria-valuetext', slider.value + '%');
    onChange();
  }
  select.onchange = slider.oninput = update;
  return {
    settings: () => ({ emotion: select.value, intensity: Number(slider.value) }),
    restore({ emotion, intensity: strength }) { select.value = emotion; slider.value = strength; update(); },
    reset() { select.value = 'Neutral'; slider.value = 70; update(); }
  };
}

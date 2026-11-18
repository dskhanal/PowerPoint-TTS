const paths = {
  pages: '<rect x="7" y="6" width="14" height="15" rx="2"/><path d="M4 17H3V3h13v1"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v4m-4 0h8"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
  cancel: '<path d="m6 6 12 12m0-12L6 18"/>',
  wave: '<path d="M2 10v4m4-8v12m4-16v20m4-17v14m4-11v8m4-6v4"/>',
  cc: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10a2.5 2.5 0 1 0 0 4m8-4a2.5 2.5 0 1 0 0 4"/>',
  play: '<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  volume: '<path d="m11 4-5 5H2v6h4l5 5zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-5 5H2v6h4l5 5zm5 5 6 6m0-6-6 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  text: '<path d="M3 5h18M3 10h14M3 15h18M3 20h10"/>',
  sliders: '<path d="M3 6h5m5 0h8M3 12h10m5 0h3M3 18h3m5 0h10"/><circle cx="10.5" cy="6" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="8.5" cy="18" r="2.5"/>',
  spark: '<path d="m10 4 2.3 6.4L19 13l-6.7 2.6L10 22l-2.3-6.4L1 13l6.7-2.6zM19 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="m12 2 8 3v6q0 7-8 11-8-4-8-11V5z"/><path d="m8 12 3 3 5-6"/>'
};
export function icon(name) {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}

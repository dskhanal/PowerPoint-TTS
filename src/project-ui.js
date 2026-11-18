import { openProject, projectFile, projectZip, safeName } from './project-file.js';

export function setupProject({ snapshot, restore, validateSettings, stopPlayback }) {
  const $ = id => document.getElementById(id);
  const empty = snapshot();
  const blankPage = title => ({ ...structuredClone(empty), title });
  let project = { name: 'Untitled project', pages: [blankPage('Page 1')], activePage: 0 };
  let expanded = false;
  let downloads = false;
  let working = false;
  let studioBusy = false;
  const current = () => project.pages[project.activePage];
  const position = () => project.activePage + 1;

  function notice(text = '') {
    $('project-status').textContent = text;
    $('project-status').hidden = !text;
  }
  function checkpoint() { Object.assign(current(), snapshot()); }
  function updateLocks() {
    const locked = working || studioBusy;
    $('project-tools').disabled = locked;
    $('project-mode').disabled = locked;
    $('download-project').disabled = locked;
    $('back-editor').disabled = locked;
    $('studio-editor').inert = working;
  }
  function drawPages() {
    $('page-nav').replaceChildren(...project.pages.map((page, index) => {
      const button = document.createElement('button');
      button.textContent = (index + 1) + ' · ' + page.title;
      if (index === project.activePage) button.setAttribute('aria-current', 'page');
      button.onclick = () => selectPage(index);
      return button;
    }));
    $('move-before').disabled = project.activePage === 0;
    $('move-after').disabled = position() === project.pages.length;
    $('remove-page').disabled = project.pages.length === 1;
  }
  function drawDownloads() {
    $('export-pages').replaceChildren(...project.pages.map(page => {
      const item = document.createElement('li');
      item.textContent = page.title;
      const info = document.createElement('small');
      const contents = [];
      if (page.script.trim()) contents.push('Script');
      for (const [label, track] of [['Narration', page.voice], ['Recording', page.record]]) {
        if (track) contents.push(label + ' WAV' + (track.cues.length ? ' + SRT/VTT' : ''));
      }
      info.textContent = contents.join(' · ') || 'Empty page';
      item.append(info);
      return item;
    }));
  }
  function draw() {
    $('project-mode').setAttribute('aria-expanded', String(expanded));
    $('project-mode-label').textContent = expanded ? 'Hide project tools' : project.pages.length > 1 ? 'Project · Page ' + position() : 'Project mode';
    $('project-tools').hidden = !expanded;
    $('project-downloads').hidden = !downloads;
    $('studio-editor').hidden = downloads;
    $('show-downloads').setAttribute('aria-pressed', String(downloads));
    $('project-name').value = project.name;
    $('page-name').value = current().title;
    drawPages();
    if (downloads) drawDownloads();
    updateLocks();
  }
  function selectPage(index) {
    if (studioBusy || working) return;
    checkpoint();
    const changed = project.activePage !== index;
    project.activePage = index;
    downloads = false;
    if (changed) restore(current());
    notice();
    draw();
  }
  function move(offset) {
    checkpoint();
    const page = project.pages.splice(project.activePage, 1)[0];
    project.activePage += offset;
    project.pages.splice(project.activePage, 0, page);
    draw();
  }

  $('project-mode').onclick = () => { checkpoint(); expanded = !expanded; downloads = false; notice(); draw(); };
  $('project-name').oninput = () => { project.name = $('project-name').value.trim() || 'Untitled project'; };
  $('project-name').onblur = () => { $('project-name').value = project.name; };
  $('page-name').oninput = () => {
    current().title = $('page-name').value.trim() || 'Page ' + position();
    drawPages();
    if (downloads) drawDownloads();
  };
  $('page-name').onblur = () => { $('page-name').value = current().title; };
  $('add-page').onclick = () => {
    project.pages.push(blankPage('Page ' + (project.pages.length + 1)));
    selectPage(project.pages.length - 1);
    $('page-name').focus();
    $('page-name').select();
  };
  $('move-before').onclick = () => move(-1);
  $('move-after').onclick = () => move(1);
  $('remove-page').onclick = () => {
    if (project.pages.length < 2 || !window.confirm('Remove “' + current().title + '” and its audio from this project?')) return;
    project.pages.splice(project.activePage, 1);
    project.activePage = Math.min(project.activePage, project.pages.length - 1);
    restore(current());
    notice();
    draw();
  };
  $('show-downloads').onclick = () => { checkpoint(); stopPlayback(); downloads = true; notice(); draw(); };
  $('back-editor').onclick = () => { downloads = false; notice(); draw(); };

  async function run(message, task) {
    if (working || studioBusy) return;
    checkpoint();
    working = true;
    updateLocks();
    notice(message);
    try { await task(); }
    catch (error) { notice(error.message || String(error)); }
    finally { working = false; updateLocks(); }
  }
  async function save(zip) {
    await run(zip ? 'Packing all pages…' : 'Saving project…', async () => {
      const blob = await (zip ? projectZip(project) : projectFile(project));
      const link = document.createElement('a');
      link.download = safeName(project.name) + (zip ? '.zip' : '.json');
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      notice(zip ? 'Project ZIP exported.' : 'Project JSON exported.');
    });
  }
  $('save-project').onclick = () => save(false);
  $('download-project').onclick = () => save(true);
  function hasWork() {
    return project.pages.length > 1 || project.name !== 'Untitled project' || current().title !== 'Page 1' ||
      current().script || current().voice || current().record || JSON.stringify(current().settings) !== JSON.stringify(empty.settings);
  }
  $('new-project').onclick = () => {
    checkpoint();
    if (hasWork() && !window.confirm('Start a new project? Save JSON first to keep your current work.')) return;
    project = { name: 'Untitled project', pages: [blankPage('Page 1')], activePage: 0 };
    downloads = false;
    restore(current());
    notice();
    draw();
    $('project-name').focus();
    $('project-name').select();
  };
  $('open-project').onclick = () => $('project-file').click();
  $('project-file').onchange = event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    void run('Reading project…', async () => {
      const loaded = await openProject(file, validateSettings);
      if (hasWork() && !window.confirm('Replace the open project with “' + loaded.name + '”? Save JSON first to keep your current work.')) {
        notice('Current project kept.');
        return;
      }
      project = loaded;
      downloads = false;
      restore(current());
      draw();
      notice('Opened ' + project.pages.length + (project.pages.length === 1 ? ' page.' : ' pages.'));
    });
  };
  drawPages();
  return { setBusy(value) { studioBusy = value; updateLocks(); } };
}

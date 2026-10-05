(() => {
  const tiles = [...document.querySelectorAll('.tile')];
  const toggle = document.querySelector('#sound');
  const label = document.querySelector('#sound-label');
  const title = document.querySelector('#selection-title');
  const description = document.querySelector('#selection-description');
  let enabled = false;
  let context;
  let selected = null;
  const buffers = {};
  let loading;
  // Decode the supplied recordings once. Sound is enabled by an explicit gesture.
  async function prepareAudio() {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    await context.resume();
    loading ||= Promise.all(Object.entries({select:'select', deselect:'deselect', click:'filter-select'}).map(async ([key, file]) => {
      const response = await fetch(`assets/audio/${file}.wav`);
      if (!response.ok) throw new Error('Audio unavailable');
      buffers[key] = await context.decodeAudioData(await response.arrayBuffer());
    }));
    await loading;
  }
  function play(key) {
    if (!enabled || !buffers[key] || context?.state !== 'running') return;
    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffers[key];
    volume.gain.value = 0.45;
    source.connect(volume).connect(context.destination);
    source.start();
  }
  function select(tile) {
    if (selected === tile) return;
    selected?.classList.remove('is-selected');
    selected = tile;
    tile.classList.add('is-selected');
    title.textContent = tile.dataset.title;
    description.textContent = tile.dataset.description;
    play('select');
  }
  function deselect(tile) {
    if (selected !== tile) return;
    selected = null;
    tile.classList.remove('is-selected');
    title.textContent = 'Choose a project';
    description.textContent = "Move to a tile to see what's inside.";
    play('deselect');
  }
  toggle.addEventListener('click', async () => {
    if (toggle.disabled) return;
    if (!enabled) {
      toggle.disabled = true;
      try { await prepareAudio(); enabled = true; }
      catch { loading = null; label.textContent = 'Sound unavailable'; }
      finally { toggle.disabled = false; }
    } else { enabled = false; }
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Disable interface sounds' : 'Enable interface sounds');
    if (enabled || loading) label.textContent = enabled ? 'Sound on' : 'Sound off';
    if (enabled) play('select');
  });
  for (const tile of tiles) {
    tile.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') select(tile); });
    tile.addEventListener('pointerleave', () => { if (document.activeElement !== tile) deselect(tile); });
    tile.addEventListener('focus', () => select(tile));
    tile.addEventListener('blur', () => deselect(tile));
    tile.addEventListener('click', event => {
      play('click');
      // Allow the short confirmation to finish before leaving the menu.
      if (enabled && buffers.click && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault();
        window.setTimeout(() => window.location.assign(tile.href), 120);
      }
    });
  }
})();

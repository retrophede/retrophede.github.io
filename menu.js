(() => {
  let tiles = [...document.querySelectorAll('.tile')];
  const toggle = document.querySelector('#sound');
  const label = document.querySelector('#sound-label');
  const title = document.querySelector('#selection-title');
  const description = document.querySelector('#selection-description');
  const shelf = document.querySelector('.tiles');
  const bubble = document.querySelector('.description-panel');
  const range = document.querySelector('#page-scroll');
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clockTime = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Rome', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  const clockDate = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Rome', day:'2-digit', month:'2-digit'});
  const clockZone = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Rome', timeZoneName:'shortOffset'});
  function updateClock() {
    const now = new Date();
    const offset = clockZone.formatToParts(now).find(part => part.type === 'timeZoneName').value.replace('GMT','UTC');
    document.querySelector('#rome-time').textContent = clockTime.format(now);
    document.querySelector('#rome-time').dateTime = now.toISOString();
    document.querySelector('#rome-date').textContent = clockDate.format(now);
    document.querySelector('#rome-zone').textContent = `ROMA / ${offset} · Europe/Rome`;
  }
  updateClock();
  window.setInterval(updateClock, 1000);
  function positionBubble() {
    if (!selected) return;
    const bounds = bubble.parentElement.getBoundingClientRect();
    const tileBounds = selected.getBoundingClientRect();
    const centre = tileBounds.left + tileBounds.width / 2 - bounds.left;
    const half = bubble.offsetWidth / 2;
    const x = Math.max(half, Math.min(bounds.width - half, centre));
    bubble.style.left = `${x}px`;
    bubble.style.setProperty('--pointer-x', `${Math.max(18, Math.min(bubble.offsetWidth - 18, centre - x + half))}px`);
    bubble.classList.toggle('is-visible', centre > 0 && centre < bounds.width);
  }
  function syncScroll() {
    const max = shelf.scrollWidth - shelf.clientWidth;
    const progress = max > 0 ? shelf.scrollLeft / max : 0;
    range.value = Math.round(progress * 1000);
    range.disabled = max <= 0;
    range.setAttribute('aria-valuetext', `Position ${Math.round(progress * 100)}%`);
    previous.disabled = shelf.scrollLeft <= 1;
    next.disabled = shelf.scrollLeft >= max - 1;
    positionBubble();
  }
  function step(direction) {
    const width = shelf.firstElementChild.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(shelf).columnGap);
    shelf.scrollBy({left:direction * (width + gap), behavior:reduceMotion.matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => {play('click'); step(-1);});
  next.addEventListener('click', () => {play('click'); step(1);});
  range.addEventListener('input', () => {
    shelf.style.scrollSnapType = 'none';
    shelf.scrollLeft = Number(range.value) / 1000 * (shelf.scrollWidth - shelf.clientWidth);
  });
  range.addEventListener('change', () => { shelf.style.scrollSnapType = ''; });
  shelf.addEventListener('scroll', syncScroll, {passive:true});
  shelf.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.addEventListener('resize', syncScroll);
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
    bubble.setAttribute('aria-hidden', 'false');
    positionBubble();
    play('select');
  }
  function deselect(tile) {
    if (selected !== tile) return;
    selected = null;
    tile.classList.remove('is-selected');
    title.textContent = 'Choose a project';
    description.textContent = "Move to a tile to see what's inside.";
    bubble.classList.remove('is-visible');
    bubble.setAttribute('aria-hidden', 'true');
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
  const themeToggle = document.querySelector('#theme-toggle');
  const root = document.documentElement;
  const shell = document.querySelector('.shell');
  let jump;
  let chimeVoices = [];
  function syncTheme() {
    const dark = root.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-checked', String(dark));
    document.querySelector('#theme-label').textContent = dark ? 'Dark' : 'Light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#171b1c' : '#ffffff';
  }
  // A short original piano-like tone: soft hammer attack, decaying harmonics.
  function themeChime(dark) {
    if (!enabled || context?.state !== 'running') return;
    const now = context.currentTime;
    for (const voice of chimeVoices) {
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.linearRampToValueAtTime(0, now + .018);
    }
    chimeVoices = [];
    const notes = dark ? [659.255, 523.251] : [523.251, 659.255];
    notes.forEach((frequency, index) => {
      const start = now + index * .105;
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.13, start + .004);
      gain.gain.exponentialRampToValueAtTime(.025, start + .11);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .40);
      const voice = {gain, remaining:4};
      chimeVoices.push(voice);
      [1, 2, 3, 4].forEach((harmonic, h) => {
        const oscillator = context.createOscillator();
        const partial = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * harmonic;
        partial.gain.setValueAtTime([.75,.2,.075,.025][h], start);
        partial.gain.exponentialRampToValueAtTime(.0001, start + (h ? .19 : .40));
        oscillator.connect(partial).connect(gain);
        oscillator.start(start);
        oscillator.stop(start + .42);
        oscillator.onended = () => {
          oscillator.disconnect(); partial.disconnect();
          if (--voice.remaining === 0) {
            gain.disconnect();
            chimeVoices = chimeVoices.filter(item => item !== voice);
          }
        };
      });
    });
  }
  syncTheme();
  themeToggle.addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    syncTheme();
    try { localStorage.setItem('retrophede-theme', root.dataset.theme); } catch {}
    jump?.cancel();
    if (!reduceMotion.matches) {
      jump = shell.animate([
        {transform:'translateY(0)', opacity:1},
        {transform:'translateY(-5px)', opacity:.88, offset:.38},
        {transform:'translateY(1px)', opacity:1, offset:.78},
        {transform:'translateY(0)', opacity:1}
      ], {duration:260, easing:'cubic-bezier(.22,.7,.3,1)'});
    }
    themeChime(dark);
  });
  syncScroll();
  function bindTiles() {
  tiles = [...shelf.querySelectorAll('.tile')];
  for (const tile of tiles) {
    tile.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') select(tile); });
    tile.addEventListener('pointerleave', () => { if (document.activeElement !== tile) deselect(tile); });
    tile.addEventListener('focus', () => select(tile));
    tile.addEventListener('blur', () => deselect(tile));
    tile.addEventListener('click', event => {
      play('click');
      if (tile.dataset.folder) { openFolder(tile.dataset.folder); return; }
      // Allow the short confirmation to finish before leaving the menu.
      if (enabled && buffers.click && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault();
        window.setTimeout(() => window.location.assign(tile.href), 120);
      }
    });
  }
  }
  const palette = {ocean:'#4390BD', violet:'#9383CD', rose:'#CF82AC', amber:'#C8A04F', mint:'#65AD95', coral:'#CB856D'};
  const colorControl = document.querySelector('#ui-color');
  let colorKey = 'ocean';
  try { const saved = localStorage.getItem('retrophede-color'); if (palette[saved]) colorKey = saved; } catch {}
  function setColor(key) {
    root.style.setProperty('--ui-accent', palette[key]);
    colorControl.value = key;
  }
  setColor(colorKey);
  colorControl.addEventListener('change', () => {
    setColor(colorControl.value);
    try { localStorage.setItem('retrophede-color', colorControl.value); } catch {}
    play('select');
  });
  // Folder entries can hold additional project tiles or child folders later.
  const nearProject = shelf.querySelector('.tile').outerHTML;
  const folders = {space:{title:'Space', projects:[nearProject]}};
  const star = '<svg viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M14 1h4v7h3v3h3v3h7v4h-7v3h-3v3h-3v7h-4v-7h-3v-3H8v-3H1v-4h7v-3h3V8h3Z"/><path fill="var(--rim)" d="M14 12h4v2h2v4h-2v2h-4v-2h-2v-4h2Z"/></svg>';
  const homeTiles = `<button type="button" class="tile folder-tile" data-folder="space" data-title="Space" data-description="Stars, orbits and little universes. Open this folder to explore NEAR / 100."><span class="tile-screen folder-screen">${star}<span class="folder-badge">01</span></span><span class="tile-label">Space</span><span class="selector" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>`;
  const back = document.querySelector('#folder-back');
  function renderShelf(content) {
    selected = null;
    bubble.classList.remove('is-visible');
    bubble.setAttribute('aria-hidden','true');
    shelf.innerHTML = content + '<div class="empty-slot" aria-hidden="true"><span>+</span></div>'.repeat(5);
    shelf.scrollLeft = 0;
    bindTiles();
    syncScroll();
  }
  function openFolder(key) {
    const folder = folders[key];
    if (!folder) return;
    document.querySelector('#projects-title').textContent = `Project menu / ${folder.title}`;
    document.querySelector('#item-count').textContent = `${String(folder.projects.length).padStart(2,'0')} project`;
    back.hidden = false;
    renderShelf(folder.projects.join(''));
    shelf.querySelector('.tile').focus({preventScroll:true});
  }
  back.addEventListener('click', () => {
    play('click');
    document.querySelector('#projects-title').textContent = 'Project menu';
    document.querySelector('#item-count').textContent = '01 folder';
    back.hidden = true;
    renderShelf(homeTiles);
    shelf.querySelector('.tile').focus({preventScroll:true});
  });
  shelf.addEventListener('keydown', event => { if (event.key === 'Escape' && !back.hidden) back.click(); });
  renderShelf(homeTiles);
})();

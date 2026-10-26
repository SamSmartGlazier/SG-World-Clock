/*
  app.js — the screen: drawing rows, reacting to clicks and typing,
  saving your list. The maths lives in tz.js.

  How it hangs together:
    data     what gets saved (your cities, settings, future templates)
    view     what's happening right now (live or converting, which row is being edited)
    buildList()  creates the rows when the list itself changes
    refresh()    updates the numbers in the rows (runs every second)
*/
(function () {
  'use strict';

  const APP_VERSION = '1.0.0';
  const STORAGE_KEY = 'worldclock.v1';

  // Used if team-defaults.json can't be loaded (e.g. opening the file directly).
  const BUILT_IN_DEFAULTS = {
    zones: [
      { tz: 'Pacific/Auckland', label: 'Auckland', home: true },
      { tz: 'America/Los_Angeles', label: 'Los Angeles' },
      { tz: 'America/Denver', label: 'Denver' },
      { tz: 'America/Chicago', label: 'Chicago' },
      { tz: 'America/New_York', label: 'New York' }
    ],
    settings: { hour12: true, workStart: 8, workEnd: 18 }
  };

  /* ---------- Saved data ---------- */

  let data = null;

  function newId() { return Math.random().toString(36).slice(2, 10); }

  // Turn a defaults file (or an import) into a clean, complete data object.
  // Anything unexpected is ignored rather than trusted.
  function normalise(raw) {
    const zones = (Array.isArray(raw && raw.zones) ? raw.zones : [])
      .filter((z) => z && typeof z.tz === 'string' && isValidZone(z.tz))
      .map((z) => ({ id: typeof z.id === 'string' ? z.id : newId(), tz: z.tz, label: String(z.label || labelFromZone(z.tz)).slice(0, 60) }));
    let homeId = raw && typeof raw.homeId === 'string' && zones.some((z) => z.id === raw.homeId) ? raw.homeId : null;
    if (!homeId && zones.length) {
      // Defaults files mark home with "home": true instead of an id.
      const flagged = raw.zones.filter((z) => z && typeof z.tz === 'string' && isValidZone(z.tz)).findIndex((z) => z.home);
      homeId = zones[flagged >= 0 ? flagged : 0].id;
    }
    const s = (raw && raw.settings) || {};
    const hour = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 24 ? v : d);
    return {
      version: 1,
      zones,
      homeId,
      settings: {
        hour12: s.hour12 !== false,
        workStart: hour(s.workStart, 8),
        workEnd: hour(s.workEnd, 18)
      },
      // Reserved for the copy-template feature later. Kept as-is on import/export.
      templates: Array.isArray(raw && raw.templates) ? raw.templates : []
    };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { toast('Couldn’t save — browser storage is blocked.'); }
  }

  function loadSaved() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? normalise(JSON.parse(s)) : null;
    } catch (e) { return null; }
  }

  async function loadTeamDefaults() {
    try {
      const r = await fetch('team-defaults.json', { cache: 'no-cache' });
      if (r.ok) return normalise(await r.json());
    } catch (e) { /* offline or opened as a file: fall through */ }
    return normalise(BUILT_IN_DEFAULTS);
  }

  /* ---------- Helpers ---------- */

  const $ = (id) => document.getElementById(id);

  function isValidZone(tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  function labelFromZone(tz) { return tz.split('/').pop().replace(/_/g, ' '); }
  function homeZone() { return data.zones.find((z) => z.id === data.homeId) || data.zones[0]; }
  function fmtHour(h) {
    if (!data.settings.hour12) return String(h).padStart(2, '0') + ':00';
    const hh = h % 12 || 12; return hh + (h < 12 || h === 24 ? 'am' : 'pm');
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- What's on screen right now ---------- */

  const view = {
    refMs: null,       // null = live; a number = the converted moment being shown
    editingId: null,   // which row has the typing box open
    editBaseMs: 0,     // the moment when typing started (so "3pm" means 3pm that day)
    editPrevRef: null  // what to go back to if you press Escape
  };
  const shownMs = () => (view.refMs === null ? Date.now() : view.refMs);

  /* ---------- Building the rows ---------- */

  const ICON_HOME = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>';
  const ICON_REMOVE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function buildList() {
    const list = $('zones');
    list.textContent = '';
    for (const z of data.zones) list.appendChild(buildRow(z));
    $('empty').hidden = data.zones.length > 0;
    refresh();
  }

  function buildRow(z) {
    const li = document.createElement('li');
    li.className = 'zone';
    li.dataset.id = z.id;

    const handle = el('button', 'handle', '⋮⋮');
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Move ' + z.label + ' (use arrow keys)');
    handle.title = 'Drag to reorder';

    const name = el('span', 'zone-name', z.label);
    name.title = 'Double-click to rename';
    const title = el('div', 'zone-title'); title.append(name);
    if (z.id === data.homeId) title.append(el('span', 'home-badge', 'HOME'));

    const names = el('div', 'zone-names');
    names.append(title, el('div', 'zone-meta'));

    const timeBtn = el('button', 'time-btn');
    timeBtn.type = 'button';
    const clock = el('div', 'zone-clock');
    clock.append(timeBtn, el('div', 'zone-date'));

    const top = el('div', 'zone-top'); top.append(names, clock);
    const bar = el('div', 'bar'); bar.setAttribute('aria-hidden', 'true');
    bar.append(el('div', 'bar-work'), el('div', 'bar-mark'));
    const main = el('div', 'zone-main'); main.append(top, bar);

    const actions = el('div', 'row-actions');
    if (z.id !== data.homeId) {
      const homeBtn = el('button'); homeBtn.type = 'button';
      homeBtn.innerHTML = ICON_HOME; homeBtn.title = 'Make home';
      homeBtn.setAttribute('aria-label', 'Make ' + z.label + ' home');
      homeBtn.addEventListener('click', () => { data.homeId = z.id; save(); buildList(); });
      actions.append(homeBtn);
    }
    const rm = el('button'); rm.type = 'button';
    rm.innerHTML = ICON_REMOVE; rm.title = 'Remove';
    rm.setAttribute('aria-label', 'Remove ' + z.label);
    rm.addEventListener('click', () => removeZone(z.id));
    actions.append(rm);

    li.append(handle, main, actions);

    timeBtn.addEventListener('click', () => startEditing(z.id));
    name.addEventListener('dblclick', () => renameZone(z.id));
    wireDrag(li, handle);
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveZone(z.id, e.key === 'ArrowUp' ? -1 : 1);
        const again = document.querySelector('.zone[data-id="' + z.id + '"] .handle');
        if (again) again.focus();
      }
    });
    return li;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- Updating the numbers (every second) ---------- */

  function refresh() {
    if (!data.zones.length) { updateBanner(); return; }
    const ms = shownMs();
    const home = homeZone();
    const { workStart, workEnd, hour12 } = data.settings;

    for (const li of $('zones').children) {
      const z = data.zones.find((x) => x.id === li.dataset.id);
      if (!z) continue;

      // Time (skip the row you're typing in)
      if (z.id !== view.editingId) {
        const btn = li.querySelector('.time-btn');
        btn.textContent = TZ.formatTime(ms, z.tz, hour12);
        btn.setAttribute('aria-label', z.label + ' time ' + btn.textContent + '. Click to type a time');
      }

      // Date, flagged when it's a different day from home
      const diff = TZ.dayDifference(ms, z.tz, home.tz);
      const dateEl = li.querySelector('.zone-date');
      dateEl.textContent = TZ.formatDate(ms, z.tz) + (diff ? ' · ' + (diff > 0 ? '+' : '−') + Math.abs(diff) + ' day' : '');
      dateEl.classList.toggle('shifted', diff !== 0);

      // Zone name, gap to home, and any upcoming clock change
      const abbr = TZ.abbreviation(ms, z.tz);
      const meta = li.querySelector('.zone-meta');
      meta.textContent = '';
      let text = abbr;
      let change = null;
      if (z.id === home.id) {
        text += ' · home';
        change = TZ.nextGapChange(Date.now(), z.tz, 'UTC', 45);
        if (change) change.label = 'clocks change ' + TZ.formatDate(change.at, z.tz);
      } else {
        const gap = TZ.offsetMinutes(ms, z.tz) - TZ.offsetMinutes(ms, home.tz);
        text += ' · ' + TZ.describeGap(gap);
        change = TZ.nextGapChange(Date.now(), z.tz, home.tz, 45);
        if (change) change.label = TZ.describeGap(change.newGap).replace(/ (ahead|behind)$/, '') + ' from ' + TZ.formatDate(change.at, z.tz).replace(/^\w+ /, '');
      }
      meta.append(text);
      if (change) {
        meta.append(' · ');
        const c = el('span', 'change', change.label);
        c.title = 'Daylight saving changes the gap on this date';
        meta.append(c);
      }

      // Working-hours bar
      const work = li.querySelector('.bar-work');
      const lo = Math.min(workStart, workEnd), hi = Math.max(workStart, workEnd);
      work.style.left = (lo / 24 * 100) + '%';
      work.style.width = ((hi - lo) / 24 * 100) + '%';
      const h = TZ.decimalHour(ms, z.tz);
      const mark = li.querySelector('.bar-mark');
      mark.style.left = (h / 24 * 100) + '%';
      mark.classList.toggle('off', h < lo || h >= hi);
      li.title = (h < lo || h >= hi) ? 'Outside working hours (' + fmtHour(lo) + '–' + fmtHour(hi) + ')' : '';
    }
    updateBanner();
  }

  function updateBanner() {
    const banner = $('banner');
    banner.hidden = view.refMs === null;
    if (view.refMs === null) return;
    const src = data.zones.find((z) => z.id === view.editingId) || homeZone();
    if (!src) return;
    $('banner-desc').textContent = TZ.formatTime(view.refMs, src.tz, data.settings.hour12) + ' ' +
      TZ.formatDate(view.refMs, src.tz) + ' in ' + src.label;
  }

  /* ---------- Typing a time ---------- */

  function startEditing(id) {
    if (view.editingId) stopEditing(true);
    const li = document.querySelector('.zone[data-id="' + id + '"]');
    const z = data.zones.find((x) => x.id === id);
    if (!li || !z) return;

    view.editingId = id;
    view.editBaseMs = shownMs();
    view.editPrevRef = view.refMs;
    li.classList.add('editing');

    const btn = li.querySelector('.time-btn');
    const input = document.createElement('input');
    input.className = 'time-input';
    input.type = 'text';
    input.value = btn.textContent;
    input.setAttribute('aria-label', 'Type a time in ' + z.label);
    input.spellcheck = false;
    btn.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener('input', () => {
      const parsed = TZ.parseTimeInput(input.value);
      input.classList.toggle('invalid', !parsed && input.value.trim() !== '');
      if (parsed) { view.refMs = TZ.resolveInput(parsed, view.editBaseMs, z.tz); refresh(); }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); stopEditing(true); }
      if (e.key === 'Escape') { e.preventDefault(); stopEditing(false); }
    });
    input.addEventListener('blur', () => { if (view.editingId === id) stopEditing(true); });
  }

  function stopEditing(keep) {
    const id = view.editingId;
    if (!id) return;
    const li = document.querySelector('.zone[data-id="' + id + '"]');
    const input = li && li.querySelector('.time-input');
    if (!keep || (input && !TZ.parseTimeInput(input.value))) view.refMs = view.editPrevRef;
    view.editingId = null;
    if (li) {
      li.classList.remove('editing');
      const btn = el('button', 'time-btn'); btn.type = 'button';
      btn.addEventListener('click', () => startEditing(id));
      if (input) input.replaceWith(btn);
    }
    refresh();
  }

  function backToNow() {
    if (view.editingId) { view.editPrevRef = null; stopEditing(false); }
    view.refMs = null;
    refresh();
  }

  function shiftDay(n) {
    view.refMs = shownMs() + n * 86400000;
    if (view.editingId) view.editBaseMs = view.refMs;
    refresh();
    const input = document.querySelector('.time-input');
    if (input) input.focus();
  }

  /* ---------- Copy ---------- */

  // e.g. "Tue 27 Oct: 9:00am CDT Chicago · 10:00am EDT New York · 3:00am NZDT Auckland (Wed 28 Oct)"
  function summaryLine() {
    const ms = shownMs();
    if (!data.zones.length) return '';
    const firstDate = TZ.formatDate(ms, data.zones[0].tz);
    const parts = data.zones.map((z) => {
      const d = TZ.formatDate(ms, z.tz);
      return TZ.formatTime(ms, z.tz, data.settings.hour12) + ' ' + TZ.abbreviation(ms, z.tz) + ' ' + z.label + (d !== firstDate ? ' (' + d + ')' : '');
    });
    return firstDate + ': ' + parts.join(' · ');
  }

  async function copySummary() {
    const text = summaryLine();
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast('Copied: ' + text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied');
    }
  }

  /* ---------- Changing the list ---------- */

  function addZone(tz, label) {
    if (data.zones.some((z) => z.tz === tz && z.label === label)) { toast(label + ' is already in your list'); return; }
    const z = { id: newId(), tz, label };
    data.zones.push(z);
    if (!data.homeId) data.homeId = z.id;
    save(); buildList();
    toast('Added ' + label);
  }

  function removeZone(id) {
    const i = data.zones.findIndex((z) => z.id === id);
    if (i < 0) return;
    const [gone] = data.zones.splice(i, 1);
    if (view.editingId === id) view.editingId = null;
    if (data.homeId === id) data.homeId = data.zones[0] ? data.zones[0].id : null;
    save(); buildList();
    toast('Removed ' + gone.label);
  }

  function renameZone(id) {
    const z = data.zones.find((x) => x.id === id);
    if (!z) return;
    const name = prompt('Name for this clock', z.label);
    if (name && name.trim()) { z.label = name.trim().slice(0, 60); save(); buildList(); }
  }

  function moveZone(id, delta) {
    const i = data.zones.findIndex((z) => z.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= data.zones.length) return;
    const [z] = data.zones.splice(i, 1);
    data.zones.splice(j, 0, z);
    save(); buildList();
  }

  /* ---------- Drag to reorder ---------- */

  let dragId = null;
  function wireDrag(li, handle) {
    // Only start a drag from the handle, so clicking times still works.
    handle.addEventListener('pointerdown', () => { li.draggable = true; });
    handle.addEventListener('pointerup', () => { li.draggable = false; });
    li.addEventListener('dragstart', (e) => {
      dragId = li.dataset.id;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    li.addEventListener('dragend', () => {
      li.draggable = false; dragId = null;
      document.querySelectorAll('.zone').forEach((n) => n.classList.remove('dragging', 'drop-before', 'drop-after'));
    });
    li.addEventListener('dragover', (e) => {
      if (!dragId || dragId === li.dataset.id) return;
      e.preventDefault();
      const r = li.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      li.classList.toggle('drop-before', before);
      li.classList.toggle('drop-after', !before);
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragId || dragId === li.dataset.id) return;
      const before = li.classList.contains('drop-before');
      const from = data.zones.findIndex((z) => z.id === dragId);
      const [moved] = data.zones.splice(from, 1);
      let to = data.zones.findIndex((z) => z.id === li.dataset.id);
      if (!before) to += 1;
      data.zones.splice(to, 0, moved);
      save(); buildList();
    });
  }

  /* ---------- Add-city search ---------- */

  let searchIndex = null;
  function buildSearchIndex() {
    const seen = new Set();
    const items = [];
    for (const [label, region, tz] of window.CITIES || []) {
      if (!isValidZone(tz)) continue;
      items.push({ label, region, tz, key: (label + ' ' + region + ' ' + tz).toLowerCase() });
      seen.add(label.toLowerCase());
    }
    // Every official zone too, e.g. "Pacific/Fiji" -> "Fiji"
    const all = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
    for (const tz of all) {
      const label = labelFromZone(tz);
      if (seen.has(label.toLowerCase())) continue;
      items.push({ label, region: tz.replace(/_/g, ' '), tz, key: (label + ' ' + tz).toLowerCase().replace(/_/g, ' ') });
    }
    return items;
  }

  function runSearch() {
    if (!searchIndex) searchIndex = buildSearchIndex();
    const q = $('city-search').value.trim().toLowerCase();
    const list = $('city-results');
    list.textContent = '';
    if (!q) return;
    const starts = [], contains = [];
    for (const it of searchIndex) {
      if (it.label.toLowerCase().startsWith(q)) starts.push(it);
      else if (it.key.includes(q)) contains.push(it);
    }
    const now = Date.now();
    for (const it of starts.concat(contains).slice(0, 12)) {
      const btn = el('button'); btn.type = 'button';
      const left = el('span');
      left.append(el('span', null, it.label), document.createElement('br'), el('span', 'r-sub', it.region));
      btn.append(left, el('span', 'r-time', TZ.formatTime(now, it.tz, data.settings.hour12) + ' ' + TZ.abbreviation(now, it.tz)));
      btn.addEventListener('click', () => { addZone(it.tz, it.label); $('add-dialog').close(); });
      const li = el('li'); li.append(btn); list.append(li);
    }
    if (!list.children.length) list.append(el('li', 'empty', 'No match. Try the nearest big city.'));
  }

  /* ---------- Settings, export, import ---------- */

  function fillHourSelects() {
    for (const [id, val] of [['work-start', data.settings.workStart], ['work-end', data.settings.workEnd]]) {
      const s = $(id); s.textContent = '';
      for (let h = 0; h <= 24; h++) {
        const o = el('option', null, fmtHour(h)); o.value = h; if (h === val) o.selected = true; s.append(o);
      }
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'world-clock-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(file) {
    try {
      const incoming = normalise(JSON.parse(await file.text()));
      if (!incoming.zones.length) throw new Error('no zones');
      if (!confirm('Replace your current ' + data.zones.length + ' cities with ' + incoming.zones.length + ' from this file?')) return;
      data = incoming; save(); fillHourSelects(); updateHourToggle(); buildList();
      toast('Imported ' + incoming.zones.length + ' cities');
    } catch (e) { toast('That file isn’t a World Clock backup'); }
  }

  function updateHourToggle() {
    $('toggle-hour').textContent = data.settings.hour12 ? '12h' : '24h';
  }

  /* ---------- Start up ---------- */

  async function init() {
    data = loadSaved() || await loadTeamDefaults();
    save();
    updateHourToggle();
    buildList();
    $('version').textContent = 'World Clock ' + APP_VERSION;

    $('back-to-now').addEventListener('click', backToNow);
    $('day-back').addEventListener('click', () => shiftDay(-1));
    $('day-fwd').addEventListener('click', () => shiftDay(1));
    $('copy').addEventListener('click', copySummary);
    $('toggle-hour').addEventListener('click', () => {
      data.settings.hour12 = !data.settings.hour12; save(); updateHourToggle(); refresh();
    });

    $('add-city').addEventListener('click', () => {
      $('city-search').value = ''; $('city-results').textContent = '';
      $('add-dialog').showModal(); $('city-search').focus();
    });
    $('city-search').addEventListener('input', runSearch);
    $('city-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const first = $('city-results').querySelector('button'); if (first) first.click(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); const first = $('city-results').querySelector('button'); if (first) first.focus(); }
      // A search box eats the first Escape to clear itself; close the dialog instead.
      if (e.key === 'Escape') { e.preventDefault(); $('add-dialog').close(); }
    });
    $('city-results').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const btns = [...$('city-results').querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1);
      if (i < 0) $('city-search').focus(); else if (btns[i]) btns[i].focus();
    });

    $('open-settings').addEventListener('click', () => { fillHourSelects(); $('settings-dialog').showModal(); });
    $('work-start').addEventListener('change', (e) => { data.settings.workStart = +e.target.value; save(); refresh(); });
    $('work-end').addEventListener('change', (e) => { data.settings.workEnd = +e.target.value; save(); refresh(); });
    $('export').addEventListener('click', exportData);
    $('import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    $('reset').addEventListener('click', async () => {
      if (!confirm('Replace your list and settings with the team defaults?')) return;
      data = await loadTeamDefaults(); save(); fillHourSelects(); updateHourToggle(); backToNow(); buildList();
      toast('Reset to team defaults');
    });

    // Tick once a second, lined up with the clock so minutes flip on time.
    const tick = () => { if (view.refMs === null) refresh(); setTimeout(tick, 1000 - (Date.now() % 1000)); };
    tick();
    // Catch up straight away after the laptop wakes from sleep.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

    // Offline support + "install as app". Needs https (or localhost).
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();

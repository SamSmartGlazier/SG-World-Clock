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

  const APP_VERSION = '1.4.0';
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
      .map((z) => ({
        id: typeof z.id === 'string' ? z.id : newId(),
        tz: z.tz,
        label: String(z.label || labelFromZone(z.tz)).slice(0, 60),          // your name for the row
        city: String(z.city || z.label || labelFromZone(z.tz)).slice(0, 60),  // the place it was added as
        notes: typeof z.notes === 'string' ? z.notes.slice(0, 2000) : '',     // shown in the ⓘ hover card
        selected: z.selected === true,                                      // ticked for copying
        // Compact view line. Missing = suggest one; '' = deliberately no group.
        group: typeof z.group === 'string' ? z.group.trim().slice(0, 40) : TZ.suggestGroup(z.tz)
      }));
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
        workEnd: hour(s.workEnd, 18),
        // Copy format (see the Copy section below). Your meeting link lives
        // here — in this browser's storage, never in the code on GitHub.
        copyEach: typeof s.copyEach === 'string' ? s.copyEach.slice(0, 300) : DEFAULT_COPY.copyEach,
        copyJoin: typeof s.copyJoin === 'string' ? s.copyJoin.slice(0, 20) : DEFAULT_COPY.copyJoin,
        copyMessage: typeof s.copyMessage === 'string' ? s.copyMessage.slice(0, 2000) : DEFAULT_COPY.copyMessage,
        copyGroup: typeof s.copyGroup === 'string' ? s.copyGroup.slice(0, 300) : DEFAULT_COPY.copyGroup,
        view: s.view === 'compact' ? 'compact' : 'list',
        meetingLink: typeof s.meetingLink === 'string' ? s.meetingLink.trim().slice(0, 500) : '',
        // Appearance
        theme: (window.THEMES || []).some((t) => t.id === s.theme) ? s.theme : 'classic',
        custom: cleanCustom(s.custom),
        subtitle: typeof s.subtitle === 'string' ? s.subtitle.slice(0, 60) : 'Smart Glazier · Sales'
      },
      // Reserved for the copy-template feature later. Kept as-is on import/export.
      templates: Array.isArray(raw && raw.templates) ? raw.templates : []
    };
  }

  // Only keep the four picker colours, and only if they're real #rrggbb values.
  function cleanCustom(c) {
    const out = {};
    if (c && typeof c === 'object') {
      for (const k of ['accent', 'header', 'page', 'card']) if (/^#[0-9a-f]{6}$/i.test(c[k] || '')) out[k] = c[k].toLowerCase();
    }
    return out;
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
  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  const ICON_INFO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5v.5"/></svg>';
  const ICON_REMOVE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function buildList() {
    const list = $('zones');
    list.textContent = '';
    for (const z of data.zones) list.appendChild(buildRow(z));
    $('empty').hidden = data.zones.length > 0;
    compactSignature = '';
    updateCopyControls();
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
    name.title = 'Double-click to edit';
    const title = el('div', 'zone-title'); title.append(name);
    if (z.notes.trim()) {
      const info = el('button', 'info-btn'); info.type = 'button';
      info.innerHTML = ICON_INFO;
      info.setAttribute('aria-label', 'Notes for ' + z.label);
      info.setAttribute('aria-describedby', 'info-card');
      wireInfo(info, z);
      title.append(info);
    }
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
    const editBtn = el('button'); editBtn.type = 'button';
    editBtn.innerHTML = ICON_EDIT; editBtn.title = 'Edit label and notes';
    editBtn.setAttribute('aria-label', 'Edit ' + z.label);
    editBtn.addEventListener('click', () => openEditor(z.id));
    actions.append(editBtn);
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

    const pick = document.createElement('input');
    pick.type = 'checkbox';
    pick.className = 'pick';
    pick.checked = z.selected;
    pick.setAttribute('aria-label', 'Include ' + z.city + ' when copying');
    pick.title = 'Include when copying';
    pick.addEventListener('change', () => { z.selected = pick.checked; save(); updateCopyControls(); });

    li.append(pick, handle, main, actions);

    timeBtn.addEventListener('click', () => startEditing(z.id));
    name.addEventListener('dblclick', () => openEditor(z.id));
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
    if (data.settings.view === 'compact') { refreshCompact(); return; }
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
      dateEl.textContent = TZ.formatDate(ms, z.tz);
      if (diff) dateEl.append(' · ', el('span', 'day-tag', (diff > 0 ? '+' : '−') + Math.abs(diff) + ' day'));

      // Zone name, gap to home, and any upcoming clock change
      const abbr = TZ.abbreviation(ms, z.tz);
      const meta = li.querySelector('.zone-meta');
      meta.textContent = '';
      // With a custom label ("Dave & Stefan"), still show which place it is.
      let text = (z.label.toLowerCase() !== z.city.toLowerCase() ? z.city + ' · ' : '') + abbr;
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

  /* ---------- Compact view ---------- */

  /*
    Turns the clock list into lines: Home first, then one line per group
    (in the order groups first appear in List view), then a line for each
    clock with no group. Clocks in the same group that show the same zone
    name and offset (Dallas + Chicago = CDT) collapse into one item.
  */
  function compactModel(ms) {
    const home = homeZone();
    const lines = [];
    if (home) lines.push({ key: 'home', name: 'Home', zones: [home] });
    const byKey = {};
    for (const z of data.zones) {
      if (z === home) continue;
      const key = z.group ? 'g:' + z.group.toLowerCase() : 'z:' + z.id;
      if (!byKey[key]) { byKey[key] = { key, name: z.group || z.city, zones: [] }; lines.push(byKey[key]); }
      byKey[key].zones.push(z);
    }
    for (const line of lines) {
      const seen = {};
      line.items = [];
      for (const z of line.zones) {
        const abbr = TZ.abbreviation(ms, z.tz);
        const k = abbr + '|' + TZ.offsetMinutes(ms, z.tz);
        if (seen[k]) { seen[k].zones.push(z); continue; }
        seen[k] = { key: k, abbr, zone: z, zones: [z] };
        line.items.push(seen[k]);
      }
    }
    return { lines, signature: lines.map((l) => l.key + '=' + l.items.map((i) => i.key).join(',')).join(';') };
  }

  let compactSignature = '';
  function buildCompact(model) {
    const list = $('groups');
    list.textContent = '';
    for (const line of model.lines) {
      const li = el('li', 'grp'); li.dataset.key = line.key;
      const head = el('div', 'grp-head');
      const pick = document.createElement('input');
      pick.type = 'checkbox'; pick.className = 'pick';
      pick.setAttribute('aria-label', 'Include ' + line.name + ' when copying');
      pick.addEventListener('change', () => {
        line.zones.forEach((z) => { z.selected = pick.checked; });
        save(); updateCopyControls(); refresh();
      });
      head.append(pick, el('span', 'grp-name', line.name), el('span', 'grp-date'));
      const row = el('div', 'grp-line');
      for (const it of line.items) {
        const pair = el('div', 'pair'); pair.dataset.item = it.key;
        const t = el('button', 'pair-time'); t.type = 'button';
        const names = it.zones.map((z) => z.city).join(', ');
        t.title = names;
        t.addEventListener('click', () => startEditing(it.zone.id, pair));
        pair.append(el('span', 'pair-abbr', it.abbr), t, el('span', 'pair-day'));
        row.append(pair);
      }
      li.append(head, row);
      list.append(li);
    }
    compactSignature = model.signature;
  }

  function refreshCompact() {
    const ms = shownMs();
    const model = compactModel(ms);
    // Rebuild only when the shape changes (cities added, a clock change
    // renames PDT -> PST) and never while you're typing in it.
    if (model.signature !== compactSignature && !view.editingId) buildCompact(model);
    const home = homeZone();
    const lo = Math.min(data.settings.workStart, data.settings.workEnd), hi = Math.max(data.settings.workStart, data.settings.workEnd);
    for (const line of model.lines) {
      const li = document.querySelector('.grp[data-key="' + CSS.escape(line.key) + '"]');
      if (!li) continue;
      li.querySelector('.pick').checked = line.zones.some((z) => z.selected);
      const firstTz = line.items[0].zone.tz;
      const date = TZ.formatDate(ms, firstTz);
      const diff = home ? TZ.dayDifference(ms, firstTz, home.tz) : 0;
      const dateEl = li.querySelector('.grp-date');
      dateEl.textContent = date;
      if (diff) dateEl.append(' · ', el('span', 'day-tag', (diff > 0 ? '+' : '−') + Math.abs(diff) + ' day'));
      for (const it of line.items) {
        const pair = li.querySelector('.pair[data-item="' + CSS.escape(it.key) + '"]');
        if (!pair) continue;
        const h = TZ.decimalHour(ms, it.zone.tz);
        pair.classList.toggle('off', h < lo || h >= hi);
        const d = TZ.formatDate(ms, it.zone.tz);
        pair.querySelector('.pair-day').textContent = d !== date ? '(' + d.split(' ')[0] + ')' : '';
        if (view.editingId && pair.classList.contains('editing')) continue;
        const btn = pair.querySelector('.pair-time');
        if (btn) {
          btn.textContent = compactTime(ms, it.zone.tz);   // "8am", "3:02pm": shorter, so lines fit
          btn.setAttribute('aria-label', it.abbr + ' ' + btn.textContent + ' (' + btn.title + '). Click to type a time');
        }
      }
    }
    updateBanner();
  }

  function setView(mode) {
    if (view.editingId) stopEditing(true);
    data.settings.view = mode; save();
    const compact = mode === 'compact';
    $('zones').hidden = compact;
    $('groups').hidden = !compact;
    $('hint-list').hidden = compact;
    $('hint-compact').hidden = !compact;
    document.querySelectorAll('.view-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
    compactSignature = '';
    updateCopyControls();
    refresh();
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

  // `holder` is the compact-view item being edited; in List view it's the row.
  function startEditing(id, holder) {
    if (view.editingId) stopEditing(true);
    const li = holder || document.querySelector('.zone[data-id="' + id + '"]');
    const z = data.zones.find((x) => x.id === id);
    if (!li || !z) return;

    view.editingId = id;
    view.editHolder = li;
    view.editBaseMs = shownMs();
    view.editPrevRef = view.refMs;
    li.classList.add('editing');

    const btn = li.querySelector('.time-btn, .pair-time');
    const input = document.createElement('input');
    input.className = 'time-input';
    input.type = 'text';
    input.value = btn.textContent;
    input.setAttribute('aria-label', 'Type a time in ' + (holder ? z.city : z.label));
    if (holder) input.size = Math.max(5, btn.textContent.length);
    input.spellcheck = false;
    input.dataset.title = btn.title || '';
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
    const li = view.editHolder;
    const compactItem = li && li.classList.contains('pair');
    const input = li && li.querySelector('.time-input');
    if (!keep || (input && !TZ.parseTimeInput(input.value))) view.refMs = view.editPrevRef;
    view.editingId = null;
    view.editHolder = null;
    if (li) {
      li.classList.remove('editing');
      const btn = el('button', compactItem ? 'pair-time' : 'time-btn'); btn.type = 'button';
      btn.title = input ? (input.dataset.title || '') : '';
      btn.addEventListener('click', () => startEditing(id, compactItem ? li : undefined));
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

  /*
    Copying works in two layers, both editable in ⚙:
      Each time  e.g. "{abbr} {weekday} {dayth} {time}"  -> "NZDT Tue 27th 11am"
                 (one per ticked row, joined with "Join with", e.g. " / ")
      Message    e.g. "{times}\nJoin here: {meetingLink}"
                 (wraps the whole thing; {times} is the joined list)
    Only place names are offered as tokens, never your labels, so internal
    notes can't end up in a client email.
  */
  const DEFAULT_COPY = {
    copyEach: '{abbr} {weekday} {dayth} {time}',
    copyJoin: ' / ',
    copyMessage: '{times}',
    copyGroup: '{group}: {list} ({weekday} {dayth})'   // Compact view: one per group
  };

  function ordinal(n) {
    const t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  }

  // "4pm", "4:30pm" (or "16:00" when the app is in 24h mode)
  function compactTime(ms, tz) {
    if (!data.settings.hour12) return TZ.formatTime(ms, tz, false);
    return TZ.formatTime(ms, tz, true).replace(':00', '');
  }

  function tokensFor(ms, z) {
    const w = TZ.wallParts(ms, z.tz);
    return {
      abbr: TZ.abbreviation(ms, z.tz),
      city: z.city,
      weekday: w.weekday,
      day: String(w.day),
      dayth: ordinal(w.day),
      month: TZ.formatDate(ms, z.tz).split(' ')[2],
      time: compactTime(ms, z.tz),
      time24: TZ.formatTime(ms, z.tz, false)
    };
  }

  // Swap {name} for its value; unknown names are left as typed so typos are visible.
  function fillTokens(text, values) {
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(values, k) ? values[k] : m));
  }

  function selectedZones() { return data.zones.filter((z) => z.selected); }

  function buildCopyText(zones, ms) {
    const s = data.settings;
    const times = zones.map((z) => fillTokens(s.copyEach, tokensFor(ms, z))).join(s.copyJoin);
    return fillTokens(s.copyMessage, { times, meetingLink: s.meetingLink }).trim();
  }

  /*
    Compact view copies whole lines. A line is included when any clock in
    it is ticked. One distinct time -> "Each time" format; several ->
    "Each group" format, where {list} is e.g. "PDT 3pm · MDT 4pm".
  */
  function compactLineText(line, ms) {
    const s = data.settings;
    if (line.items.length === 1) return fillTokens(s.copyEach, tokensFor(ms, line.items[0].zone));
    const first = tokensFor(ms, line.items[0].zone);
    const list = line.items.map((it) => {
      const t = tokensFor(ms, it.zone);
      return t.abbr + ' ' + t.time + (t.weekday !== first.weekday ? ' (' + t.weekday + ')' : '');
    }).join(' · ');
    return fillTokens(s.copyGroup, Object.assign({}, first, { group: line.name, list }));
  }
  function selectedLines() {
    return compactModel(shownMs()).lines.filter((l) => l.zones.some((z) => z.selected));
  }
  function buildCompactCopyText(lines, ms) {
    const s = data.settings;
    const times = lines.map((l) => compactLineText(l, ms)).join(s.copyJoin);
    return fillTokens(s.copyMessage, { times, meetingLink: s.meetingLink }).trim();
  }

  async function copySelected() {
    const compact = data.settings.view === 'compact';
    const zones = selectedZones();
    if (!zones.length) { toast('Tick the times you want to copy first'); return; }
    const text = compact ? buildCompactCopyText(selectedLines(), shownMs()) : buildCopyText(zones, shownMs());
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    const needsLink = /\{meetingLink\}/.test(data.settings.copyMessage) && !data.settings.meetingLink;
    toast(needsLink ? 'Copied — but your meeting link is empty (set it in ⚙)' : 'Copied: ' + text.split('\n')[0]);
  }

  function updateCopyControls() {
    const n = selectedZones().length;
    const btn = $('copy');
    if (data.settings.view === 'compact') {
      const lines = n ? selectedLines().length : 0;
      btn.textContent = lines === 1 ? 'Copy 1 line' : 'Copy ' + lines + ' lines';
    } else {
      btn.textContent = n === 1 ? 'Copy 1 time' : 'Copy ' + n + ' times';
    }
    btn.setAttribute('aria-disabled', n ? 'false' : 'true');
    btn.title = n ? '' : 'Tick the rows you want to copy';
    const all = data.zones.length > 0 && n === data.zones.length;
    $('select-all').textContent = all ? 'Select none' : 'Select all';
  }

  function updateCopyPreview() {
    if (!data.zones.length) { $('copy-preview').textContent = '(add a city to see a preview)'; return; }
    const ms = shownMs();
    const zones = selectedZones().length ? selectedZones() : data.zones.slice(0, 2);
    let lines = selectedLines();
    if (!lines.length) lines = compactModel(ms).lines.slice(0, 2);
    $('copy-preview').textContent = 'List view:\n' + buildCopyText(zones, ms) + '\n\nCompact view:\n' + buildCompactCopyText(lines, ms);
  }

  /* ---------- Appearance (themes + colour pickers) ---------- */

  // Small colour helpers. Colours are "#rrggbb"; mix(a, b, 0.25) is 25% of the way from a to b.
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function luminance(h) {
    return rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  // Black or white text, whichever is easier to read on this background.
  function readableOn(h) { return luminance(h) > 0.4 ? '#141414' : '#ffffff'; }
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

  const THEME_KEYS = Object.keys((window.THEMES || [])[0] ? window.THEMES[0].vars : {});

  function currentTheme() { return window.THEMES.find((t) => t.id === data.settings.theme) || window.THEMES[0]; }

  /*
    Start from the preset, then let each picked colour override its part
    and work out the colours that depend on it — so 4 pickers can
    restyle ~20 colours without ever producing unreadable text.
  */
  function themeVars() {
    const t = currentTheme();
    const c = data.settings.custom;
    const v = Object.assign({}, t.vars);
    let scheme = t.scheme;

    if (c.card) {
      const dark = luminance(c.card) < 0.25;
      const ink = dark ? '#f4f4f2' : '#1c1c1e';
      Object.assign(v, {
        bg: c.card, ink, 'time-ink': ink, 'row-bg': 'transparent',
        surface: mix(c.card, '#ffffff', dark ? 0.07 : 0.6),
        chrome: mix(c.card, ink, 0.05), line: mix(c.card, ink, 0.13), 'card-border': mix(c.card, ink, 0.1),
        muted: mix(ink, c.card, 0.32), faint: mix(ink, c.card, 0.45), track: mix(c.card, ink, 0.1),
        flag: mix(ink, c.card, 0.15), warn: dark ? '#fbbf24' : '#b45309'
      });
      scheme = dark ? 'dark' : 'light';
    }
    const cardSolid = c.card || t.swatch.card;
    if (c.accent || c.card) {
      const a = c.accent || t.swatch.accent;
      Object.assign(v, {
        accent: a, 'accent-ink': readableOn(a),
        'accent-soft': mix(cardSolid, a, 0.14), 'accent-line': mix(cardSolid, a, 0.35),
        work: mix(cardSolid, a, 0.4)
      });
      if (!c.header) v['header-mark'] = a;
    }
    if (c.header) Object.assign(v, { 'header-bg': c.header, 'header-ink': readableOn(c.header), 'header-mark': c.accent || t.swatch.accent });
    if (c.page) v['page-bg'] = c.page;
    return { vars: v, scheme };
  }

  function applyTheme() {
    const root = document.documentElement;
    const t = currentTheme();
    const custom = Object.keys(data.settings.custom).length > 0;
    root.dataset.theme = t.id;
    root.toggleAttribute('data-custom', custom);
    const { vars, scheme } = themeVars();
    if (t.id === 'classic' && !custom) {
      // Leave Classic to styles.css so it can follow Windows dark mode.
      THEME_KEYS.forEach((k) => root.style.removeProperty('--' + k));
      root.style.removeProperty('color-scheme');
    } else {
      for (const k of THEME_KEYS) root.style.setProperty('--' + k, vars[k]);
      root.style.colorScheme = scheme;
    }
    // Colours the installed app's title bar to match the header.
    const bar = data.settings.custom.header || t.swatch.header;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', bar);
    $('brand-sub').textContent = data.settings.subtitle;
  }

  function buildThemeGrid() {
    const grid = $('theme-grid');
    grid.textContent = '';
    for (const t of window.THEMES) {
      const b = el('button', 'theme-btn'); b.type = 'button';
      b.setAttribute('aria-pressed', String(t.id === data.settings.theme));
      const chip = el('span', 'theme-chip'); chip.setAttribute('aria-hidden', 'true');
      for (const k of ['header', 'accent', 'card']) { const s = el('span'); s.style.background = t.swatch[k]; chip.append(s); }
      b.append(chip, el('span', null, t.name));
      b.addEventListener('click', () => {
        data.settings.theme = t.id; data.settings.custom = {};
        save(); applyTheme(); buildThemeGrid(); fillPickers();
      });
      grid.append(b);
    }
  }

  function fillPickers() {
    const t = currentTheme();
    for (const k of ['accent', 'header', 'page', 'card']) $('pick-' + k).value = data.settings.custom[k] || t.swatch[k];
    $('reset-colours').disabled = !Object.keys(data.settings.custom).length;
    $('subtitle').value = data.settings.subtitle;
  }

  /* ---------- Changing the list ---------- */

  function addZone(tz, label) {
    if (data.zones.some((z) => z.tz === tz && z.label === label)) { toast(label + ' is already in your list'); return; }
    const z = { id: newId(), tz, label, city: label, notes: '', selected: false, group: TZ.suggestGroup(tz) };
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

  /* ---------- Edit label & notes ---------- */

  let editorId = null;
  function openEditor(id) {
    const z = data.zones.find((x) => x.id === id);
    if (!z) return;
    editorId = id;
    $('edit-label').value = z.label;
    $('edit-notes').value = z.notes;
    $('edit-group').value = z.group;
    const groups = [...new Set(data.zones.map((x) => x.group).filter(Boolean).concat(TZ.suggestGroup(z.tz) || []))].sort();
    $('group-list').textContent = '';
    groups.forEach((g) => { const o = document.createElement('option'); o.value = g; $('group-list').append(o); });
    const sug = TZ.suggestGroup(z.tz);
    $('edit-group-hint').textContent = sug ? 'Suggested: ' + sug : '';
    $('edit-zone').textContent = 'Time zone: ' + z.city + ' (' + z.tz.replace(/_/g, ' ') + ')';
    $('edit-dialog').showModal();
    $('edit-label').select();
  }

  function saveEditor() {
    const z = data.zones.find((x) => x.id === editorId);
    if (!z) return;
    z.label = ($('edit-label').value.trim() || z.city).slice(0, 60);
    z.notes = $('edit-notes').value.replace(/\s+$/, '').slice(0, 2000);
    z.group = $('edit-group').value.trim().slice(0, 40);
    compactSignature = '';
    save(); buildList();
    $('edit-dialog').close();
  }

  /* ---------- ⓘ hover card ---------- */

  // One shared card, moved next to whichever ⓘ you're on. It flips above
  // the icon when there isn't room below (e.g. on the last row).
  let hideTimer = null;
  function showInfo(btn, z) {
    clearTimeout(hideTimer);
    const card = $('info-card');
    $('info-title').textContent = z.label;
    $('info-notes').textContent = z.notes;
    $('info-zone').textContent = z.city + ' · ' + z.tz.replace(/_/g, ' ');
    card.hidden = false;
    const r = btn.getBoundingClientRect();
    const w = card.offsetWidth, h = card.offsetHeight;
    const left = Math.max(8, Math.min(r.left - 12, window.innerWidth - w - 8));
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }
  function hideInfo(now) {
    clearTimeout(hideTimer);
    if (now) { $('info-card').hidden = true; return; }
    hideTimer = setTimeout(() => { $('info-card').hidden = true; }, 120);
  }
  function wireInfo(btn, z) {
    btn.addEventListener('mouseenter', () => showInfo(btn, z));
    btn.addEventListener('mouseleave', () => hideInfo());
    btn.addEventListener('focus', () => showInfo(btn, z));
    btn.addEventListener('blur', () => hideInfo(true));
    // Click toggles it too, for touchscreens.
    btn.addEventListener('click', (e) => { e.stopPropagation(); if ($('info-card').hidden) showInfo(btn, z); else hideInfo(true); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideInfo(true); });
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
      data = incoming; save(); applyTheme(); setView(data.settings.view); buildThemeGrid(); fillPickers(); fillHourSelects(); updateHourToggle(); buildList();
      toast('Imported ' + incoming.zones.length + ' cities');
    } catch (e) { toast('That file isn’t a World Clock backup'); }
  }

  function fillCopyFields() {
    $('copy-each').value = data.settings.copyEach;
    $('copy-join').value = data.settings.copyJoin;
    $('copy-group').value = data.settings.copyGroup;
    $('copy-message').value = data.settings.copyMessage;
    $('meeting-link').value = data.settings.meetingLink;
  }

  // Clicking a token chip inserts it into whichever copy field you last used.
  let lastCopyField = 'copy-each';
  function insertToken(token) {
    const f = $(lastCopyField);
    const a = f.selectionStart ?? f.value.length, b = f.selectionEnd ?? f.value.length;
    f.value = f.value.slice(0, a) + token + f.value.slice(b);
    f.focus(); f.setSelectionRange(a + token.length, a + token.length);
    f.dispatchEvent(new Event('input'));
  }

  function updateHourToggle() {
    $('toggle-hour').textContent = data.settings.hour12 ? '12h' : '24h';
  }

  /* ---------- Start up ---------- */

  async function init() {
    data = loadSaved() || await loadTeamDefaults();
    save();
    applyTheme();
    updateHourToggle();
    buildList();
    $('version').textContent = 'World Clock ' + APP_VERSION;
    document.querySelectorAll('.view-toggle button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    setView(data.settings.view);

    $('back-to-now').addEventListener('click', backToNow);
    $('day-back').addEventListener('click', () => shiftDay(-1));
    $('day-fwd').addEventListener('click', () => shiftDay(1));
    $('copy').addEventListener('click', copySelected);
    $('select-all').addEventListener('click', () => {
      const all = data.zones.every((z) => z.selected);
      data.zones.forEach((z) => { z.selected = !all; });
      save(); buildList();
    });
    // Copy-format fields save as you type and update the preview.
    for (const [id, key] of [['copy-each', 'copyEach'], ['copy-join', 'copyJoin'], ['copy-group', 'copyGroup'], ['copy-message', 'copyMessage'], ['meeting-link', 'meetingLink']]) {
      $(id).addEventListener('input', (e) => { data.settings[key] = key === 'meetingLink' ? e.target.value.trim() : e.target.value; save(); updateCopyPreview(); });
    }
    $('copy-reset').addEventListener('click', () => {
      Object.assign(data.settings, DEFAULT_COPY); save(); fillCopyFields(); updateCopyPreview();
    });
    document.querySelectorAll('.token').forEach((b) => b.addEventListener('click', () => insertToken(b.dataset.token)));
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

    $('edit-form').addEventListener('submit', (e) => { e.preventDefault(); saveEditor(); });
    $('edit-cancel').addEventListener('click', () => $('edit-dialog').close());
    $('edit-notes').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEditor(); } });
    document.addEventListener('click', () => hideInfo(true));
    ['copy-each', 'copy-group', 'copy-message'].forEach((id) => $(id).addEventListener('focus', () => { lastCopyField = id; }));
    window.addEventListener('scroll', () => hideInfo(true), true);

    $('open-settings').addEventListener('click', () => { fillHourSelects(); fillCopyFields(); updateCopyPreview(); buildThemeGrid(); fillPickers(); $('settings-dialog').showModal(); });
    for (const k of ['accent', 'header', 'page', 'card']) {
      // 'input' fires while dragging in the picker, so the app recolours live.
      $('pick-' + k).addEventListener('input', (e) => {
        if (!isHex(e.target.value)) return;
        data.settings.custom[k] = e.target.value.toLowerCase(); save(); applyTheme(); $('reset-colours').disabled = false;
      });
    }
    $('reset-colours').addEventListener('click', () => { data.settings.custom = {}; save(); applyTheme(); fillPickers(); });
    $('subtitle').addEventListener('input', (e) => { data.settings.subtitle = e.target.value.slice(0, 60); save(); applyTheme(); });
    $('work-start').addEventListener('change', (e) => { data.settings.workStart = +e.target.value; save(); refresh(); });
    $('work-end').addEventListener('change', (e) => { data.settings.workEnd = +e.target.value; save(); refresh(); });
    $('export').addEventListener('click', exportData);
    $('import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    $('reset').addEventListener('click', async () => {
      if (!confirm('Replace your list and settings with the team defaults?')) return;
      data = await loadTeamDefaults(); save(); applyTheme(); setView(data.settings.view); buildThemeGrid(); fillPickers(); fillHourSelects(); updateHourToggle(); backToNow(); buildList();
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

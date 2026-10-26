/*
  tz.js — all the time-zone maths, kept separate from the screen code.

  Key idea: a moment in time is stored ONCE, as a plain number
  (milliseconds since 1 Jan 1970 UTC). Every row on screen is just that
  same number displayed in a different time zone. The browser's built-in
  Intl API knows every zone's rules, including daylight saving, so we
  never hard-code offsets.
*/
(function (global) {
  'use strict';

  // Cache formatters — creating them is slow, reusing them is fast.
  const partsCache = {};
  function partsFormatter(tz) {
    if (!partsCache[tz]) {
      partsCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short'
      });
    }
    return partsCache[tz];
  }

  // Break an instant into the wall-clock pieces seen in a zone.
  function wallParts(ms, tz) {
    const out = {};
    for (const p of partsFormatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
    return {
      year: +out.year, month: +out.month, day: +out.day,
      hour: +out.hour % 24, minute: +out.minute, second: +out.second,
      weekday: out.weekday
    };
  }

  // Minutes the zone is ahead of UTC at that instant (NZDT = +780).
  function offsetMinutes(ms, tz) {
    const w = wallParts(ms, tz);
    const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }

  // The reverse: "9:00 on 27 Oct in Chicago" -> instant.
  // Guess, check the zone's offset at the guess, correct, repeat once
  // (the second pass handles days when daylight saving changes).
  function instantFromWall(y, mo, d, h, mi, tz) {
    const naive = Date.UTC(y, mo - 1, d, h, mi);
    const a = naive - offsetMinutes(naive, tz) * 60000;
    const b = naive - offsetMinutes(a, tz) * 60000;
    const matches = (t) => { const w = wallParts(t, tz); return w.hour === h && w.minute === mi; };
    if (matches(b)) return b;
    if (matches(a)) return a;
    // The time doesn't exist (clocks jumped forward past it, e.g. 2:30am
    // on spring-forward day). Use the later reading, as phones do: 3:30am.
    return Math.max(a, b);
  }

  // Short zone name like "CDT" or "NZDT". en-US knows US names,
  // other locales know their own, so try a few before falling back.
  const abbrCache = {};
  function abbreviation(ms, tz) {
    const key = tz + '|' + offsetMinutes(ms, tz);
    if (abbrCache[key]) return abbrCache[key];
    let best = null;
    for (const loc of ['en-US', 'en-NZ', 'en-AU', 'en-GB', 'en-CA', 'en-IN']) {
      const p = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName');
      if (p && !/^(GMT|UTC)[+-]/.test(p.value)) { best = p.value; break; }
      if (!best && p) best = p.value;
    }
    // Some Windows builds call UK winter time "GMT+0"; tidy that up.
    if (/^(GMT|UTC)[+-]0(:00)?$/.test(best)) best = 'GMT';
    return (abbrCache[key] = best);
  }

  function formatTime(ms, tz, hour12) {
    const w = wallParts(ms, tz);
    const mm = String(w.minute).padStart(2, '0');
    if (!hour12) return String(w.hour).padStart(2, '0') + ':' + mm;
    const h = w.hour % 12 || 12;
    return h + ':' + mm + (w.hour < 12 ? 'am' : 'pm');
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDate(ms, tz) {
    const w = wallParts(ms, tz);
    return w.weekday + ' ' + w.day + ' ' + MONTHS[w.month - 1];
  }

  // Whole-day difference between the dates two zones are showing.
  function dayDifference(ms, tz, homeTz) {
    const a = wallParts(ms, tz), b = wallParts(ms, homeTz);
    return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
  }

  function describeGap(minutes) {
    if (minutes === 0) return 'same time';
    const abs = Math.abs(minutes), h = Math.floor(abs / 60), m = abs % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '') + (minutes > 0 ? ' ahead' : ' behind');
  }

  // Look ahead for the next date the gap between two zones changes
  // (either side changing its clocks). Returns null if none soon.
  function nextGapChange(fromMs, tz, homeTz, days) {
    const gap = (t) => offsetMinutes(t, tz) - offsetMinutes(t, homeTz);
    const start = gap(fromMs);
    const DAY = 86400000;
    for (let i = 1; i <= days; i++) {
      const t = fromMs + i * DAY;
      if (gap(t) !== start) {
        let lo = t - DAY, hi = t; // narrow down to within a minute
        while (hi - lo > 60000) { const mid = Math.floor((lo + hi) / 2); if (gap(mid) === start) lo = mid; else hi = mid; }
        return { at: hi, newGap: gap(hi) };
      }
    }
    return null;
  }

  /*
    Understands what people actually type:
      9   9am   9.30pm   9:30   14:30   1430   noon   midnight
    plus an optional day word anywhere:
      today  tomorrow / tmr / tom  yesterday  mon..sun  +1 / -1
    Returns {hour, minute, dayShift, weekday} or null if not understood.
  */
  const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function parseTimeInput(text) {
    let s = String(text || '').trim().toLowerCase();
    if (!s) return null;
    let dayShift = 0, weekday = null;

    s = s.replace(/\b(tomorrow|tmrw|tmr|tom)\b/, () => { dayShift = 1; return ' '; });
    s = s.replace(/\byesterday\b/, () => { dayShift = -1; return ' '; });
    s = s.replace(/\btoday\b/, ' ');
    s = s.replace(/(^|\s)([+-]\d)\s*d?(ays?)?(\s|$)/, (_, a, n) => { dayShift = +n; return ' '; });
    s = s.replace(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/, (_, w) => { weekday = WEEKDAYS.indexOf(w); return ' '; });
    s = s.replace(/\bat\b/, ' ').trim();

    let hour, minute = 0;
    if (s === 'noon' || s === 'midday') { hour = 12; }
    else if (s === 'midnight') { hour = 0; }
    else {
      const m = s.match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*(a|am|p|pm)?$/);
      if (!m) return null;
      hour = +m[1]; minute = m[2] ? +m[2] : 0;
      const ap = m[3];
      if (minute > 59) return null;
      if (ap) {
        if (hour < 1 || hour > 12) return null;
        if (ap[0] === 'p' && hour !== 12) hour += 12;
        if (ap[0] === 'a' && hour === 12) hour = 0;
      } else if (hour > 23) return null;
    }
    return { hour, minute, dayShift, weekday };
  }

  // Turn parsed input into an instant, relative to the date the
  // row is currently showing (so "3pm" means 3pm on that row's day).
  function resolveInput(parsed, baseMs, tz) {
    const w = wallParts(baseMs, tz);
    let shift = parsed.dayShift;
    if (parsed.weekday !== null) {
      const today = WEEKDAYS.indexOf(w.weekday.toLowerCase().slice(0, 3));
      shift += (parsed.weekday - today + 7) % 7;
    }
    const day = new Date(Date.UTC(w.year, w.month - 1, w.day + shift));
    return instantFromWall(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), parsed.hour, parsed.minute, tz);
  }

  // Local hour as a decimal (9:30 -> 9.5), for the working-hours bar.
  function decimalHour(ms, tz) {
    const w = wallParts(ms, tz);
    return w.hour + w.minute / 60;
  }

  /*
    A starting group for a zone, used by the Compact view. People can
    change it per clock in ✎ Edit; this only decides the first guess.
  */
  const US = /^(America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Boise|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/;
  const CANADA = /^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Dawson_Creek|Yellowknife|Iqaluit|Rankin_Inlet|Cambridge_Bay|Inuvik|Swift_Current|Atikokan|Creston|Fort_Nelson|Resolute|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung|Blanc-Sablon)$/;
  function suggestGroup(tz) {
    if (US.test(tz)) return 'USA';
    if (CANADA.test(tz)) return 'Canada';
    if (/^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Faroe|Madeira)$/.test(tz)) return 'Europe & UK';
    if (/^Australia\//.test(tz)) return 'Australia';
    if (/^Pacific\/(Auckland|Chatham)$/.test(tz)) return 'New Zealand';
    if (/^Asia\//.test(tz)) return 'Asia';
    if (/^America\//.test(tz)) return 'Americas';
    if (/^Africa\//.test(tz)) return 'Africa';
    return '';
  }

  global.TZ = {
    suggestGroup,
    wallParts, offsetMinutes, instantFromWall, abbreviation, formatTime, formatDate,
    dayDifference, describeGap, nextGapChange, parseTimeInput, resolveInput, decimalHour
  };
})(typeof window !== 'undefined' ? window : globalThis);

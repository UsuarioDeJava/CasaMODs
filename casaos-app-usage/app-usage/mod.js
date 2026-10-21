/*
 * App Usage — a CasaMOD mod for CasaOS.
 *
 * Each app's card on the dashboard shows what the app uses right now: a small
 * CPU gauge in its bottom-left corner and a RAM gauge in the bottom-right one,
 * drawn like the gauges of CasaOS's own system widget. The numbers are
 * CasaOS's own (GET /v1/container/usage, what that widget lists under CPU and
 * RAM), summed over the app's containers. A stopped app shows none.
 *
 * Settings: config.json, next to this file, in the format of CONFIG.md at the
 * repository's root (the CasaMOD Store shows and changes it):
 *   show       "hover" (default): the gauges while the pointer is on the card,
 *              and CasaOS is asked only then; "always": all the time
 *   interval   seconds between readings, 1 to 60 (default 3)
 */
(function () {
  'use strict';

  if (window.__appUsageMod) return;
  window.__appUsageMod = true;

  var TAG = '[App Usage]';
  var NS = 'http://www.w3.org/2000/svg';
  var SELF = document.currentScript && document.currentScript.src;   // CasaMOD: <script src="mod/<folder>/mod.js">
  // The settings: the defaults, and what config.json may set them to
  var DEFAULTS = { show: 'hover', interval: 3 };
  var VALID = {
    show: function (v) { return v === 'hover' || v === 'always'; },
    interval: function (v) { return typeof v === 'number' && v >= 1 && v <= 60 && v % 1 === 0; }
  };
  var config = { show: DEFAULTS.show, interval: DEFAULTS.interval };
  var last = {};      // card name: { cpu (%), ram (bytes), limit (bytes) }
  var hovered = null; // the card under the pointer

  // config.json, read at load and whenever the tab comes back in sight (its
  // settings say "applies": "visible"), so a change made in the CasaMOD Store
  // applies without reloading. Each value by its key; a missing or invalid one
  // is the default
  function loadConfig() {
    if (!SELF) return Promise.resolve();
    return fetch(new URL('config.json', SELF).href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (!c || typeof c !== 'object') return;
        var values = {};
        if (Array.isArray(c.settings)) {
          c.settings.forEach(function (s) { if (s && typeof s.key === 'string') values[s.key] = s.value; });
        } else values = c;   // the plain { "show", "interval" } of version 1.1.0
        Object.keys(DEFAULTS).forEach(function (k) { config[k] = VALID[k](values[k]) ? values[k] : DEFAULTS[k]; });
      })
      .catch(function () { /* no config.json, or not JSON: the defaults */ })
      .then(function () { document.documentElement.classList.toggle('aus-hover', config.show === 'hover'); });
  }

  function token() {
    try {
      var vm = document.querySelector('#app').__vue__;
      return (vm && vm.$store && vm.$store.state.access_token) || localStorage.getItem('access_token') || '';
    } catch (e) {
      return localStorage.getItem('access_token') || '';
    }
  }

  // An item's numbers, as CasaOS's widget computes them (widgets/Cpu.vue): CPU
  // in % of the whole machine since the reading before (CasaOS keeps it), RAM
  // without the page cache, against the app's limit (the machine's memory
  // when it has none)
  function measure(item) {
    var d = item.data || {}, p = item.previous, cpu = 0;
    if (p) {
      try {
        var used = d.cpu_stats.cpu_usage.total_usage - p.cpu_stats.cpu_usage.total_usage;
        var all = d.cpu_stats.system_cpu_usage - p.cpu_stats.system_cpu_usage + 1;
        cpu = Math.max(0, used / all * 100) || 0;
      } catch (e) { /* no CPU numbers yet */ }
    }
    var m = d.memory_stats || {}, s = m.stats || {};
    var cache = s.inactive_file != null ? s.inactive_file : s.cache != null ? s.cache : s.total_inactive_file || 0;
    return { cpu: cpu, ram: Math.max(0, (m.usage || 0) - cache), limit: m.limit || 0 };
  }

  // The app cards: CasaOS's #app-<name> holders (the app's name in CasaOS)
  function cards() {
    var list = [];
    [].forEach.call(document.querySelectorAll('[id^="app-"]'), function (el) {
      if (!el.querySelector('.app-card')) return;
      var img = el.querySelector('.cards-content img');
      list.push({ el: el, name: el.id.slice(4), icon: img ? img.getAttribute('src') || '' : '' });
    });
    return list;
  }

  // Whose container it is: the app whose name is the container's or begins it
  // ("librechat" for "librechat-api"; the longest wins), else the app with the
  // container's icon (CasaOS labels an app's containers with its icon)
  function owner(item, list) {
    var title = String(item.title || ''), best = null;
    list.forEach(function (c) {
      if ((title === c.name || title.indexOf(c.name + '-') === 0 || title.indexOf(c.name + '_') === 0) &&
        (!best || c.name.length > best.name.length)) best = c;
    });
    if (best || !item.icon) return best;
    for (var i = 0; i < list.length; i++) if (list[i].icon && list[i].icon === item.icon) return list[i];
    return null;
  }

  // ---------------------------------------------------------------------------
  // The gauges: CasaOS's RadialBar, small (a 270° arc from 7:30 to 4:30, the
  // white track at 40%, the green-to-yellow gradient, round ends)
  // ---------------------------------------------------------------------------
  function defs() {
    if (document.getElementById('aus-grad')) return;
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'aus-defs');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<linearGradient id="aus-grad" x1="0.17" x2="0.83" y1="0.13" y2="0.87">' +
      '<stop offset="0%" stop-color="#FFD580"/><stop offset="100%" stop-color="#33FFAA"/></linearGradient>';
    document.body.appendChild(s);
  }

  function gauge(kind) {
    var g = document.createElement('div');
    g.className = 'aus-gauge aus-' + kind;
    g.innerHTML = '<svg viewBox="-3 -3 38 38" aria-hidden="true">' +
      '<circle class="aus-track" cx="16" cy="16" r="16" pathLength="100"/>' +
      '<circle class="aus-fill" cx="16" cy="16" r="16" pathLength="100"/></svg>' +
      '<span class="aus-value"><b></b><small></small></span><span class="aus-label">' + (kind === 'cpu' ? 'CPU' : 'RAM') + '</span>';
    return g;
  }

  function size(bytes) {
    var mb = bytes / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(2) + ' MB';
  }

  function set(g, percent, value, unit, tip) {
    var p = Math.max(0, Math.min(100, percent || 0));
    g.querySelector('.aus-fill').style.strokeDashoffset = String((100 - p) * 0.75);
    g.querySelector('b').textContent = value;
    g.querySelector('small').textContent = unit;
    g.title = tip;
  }

  function paint() {
    defs();
    cards().forEach(function (c) {
      var u = last[c.name], el = c.el;
      var cpu = el.querySelector(':scope > .aus-cpu'), ram = el.querySelector(':scope > .aus-ram');
      if (!u) {
        el.classList.remove('aus-on');
        if (cpu) cpu.remove();
        if (ram) ram.remove();
        return;
      }
      el.classList.add('aus-on');
      if (!cpu) cpu = el.appendChild(gauge('cpu'));
      if (!ram) ram = el.appendChild(gauge('ram'));
      set(cpu, u.cpu, u.cpu < 9.95 ? u.cpu.toFixed(1) : String(Math.round(u.cpu)), '%', 'CPU ' + u.cpu.toFixed(1) + '%');
      var mb = u.ram / 1048576, share = u.limit ? u.ram / u.limit * 100 : 0;
      set(ram, share, mb >= 1000 ? (mb / 1024).toFixed(1) : String(Math.round(mb)), mb >= 1000 ? 'G' : 'M',
        'RAM ' + size(u.ram) + (u.limit ? ' \u00b7 ' + share.toFixed(1) + '%' : ''));
    });
  }

  // ---------------------------------------------------------------------------
  // Readings: every few seconds while the tab is in sight and has app cards
  // (in "hover", only while the pointer is on one: each request keeps CasaOS
  // reading every container's statistics for the next 100 seconds)
  // ---------------------------------------------------------------------------
  var timer = 0, busy = false, readAt = 0;
  function read() {
    clearTimeout(timer);
    timer = setTimeout(read, config.interval * 1000);
    if (busy || document.hidden || (config.show === 'hover' && !hovered) ||
      !document.querySelector('[id^="app-"] .app-card') || !token()) return;
    busy = true;
    readAt = Date.now();
    fetch('/v1/container/usage', { headers: { Authorization: token(), Accept: 'application/json' }, credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = cards(), sums = {};
        ((j && j.data) || []).forEach(function (item) {
          var c = owner(item, list);
          if (!c) return;
          var m = measure(item), s = sums[c.name] || (sums[c.name] = { cpu: 0, ram: 0, limit: 0 });
          s.cpu += m.cpu;
          s.ram += m.ram;
          s.limit = Math.max(s.limit, m.limit);
        });
        last = sums;
        paint();
      })
      .catch(function () { /* CasaOS didn't answer: next time */ })
      .then(function () { busy = false; });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadConfig().then(read); });

  // The card under the pointer: its gauges show (CSS), and a reading starts at once
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest ? e.target.closest('[id^="app-"]') : null;
    if (el && !el.querySelector('.app-card')) el = null;
    if (el === hovered) return;
    hovered = el;
    if (el && config.show === 'hover' && Date.now() - readAt > 1000) read();
  });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) hovered = null; });   // out of the window

  // CasaOS draws its cards again now and then (an app installed, started,
  // stopped): the gauges come back from the last reading at once
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      if (document.querySelector('[id^="app-"]:not(.aus-on) .app-card')) paint();
    }, 150);
  }).observe(document.body, { childList: true, subtree: true });

  loadConfig().then(read);
  console.info(TAG, 'loaded');
})();

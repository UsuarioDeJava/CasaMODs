/*
 * Transparency Everywhere — a CasaMOD mod for CasaOS: its settings.
 *
 * mod.css does the glass; this only hands it the settings of config.json
 * (next to this file, in the format of CONFIG.md at the repository's root;
 * the CasaMOD Store shows and changes it), as CSS variables on <html>:
 *   blur     --te-blur, the blur of the menus and dialogs (0 to 40 px; 20)
 *   tint     --te-tint, how dark the glass is (0 to 90 %, by 5; 40)
 *   topBar   the glass top bar (true); off: html.te-no-bar, CasaOS's own bar
 * Without this script (or config.json) mod.css keeps its own values.
 */
(function () {
  'use strict';

  if (window.__transparencyEverywhereMod) return;
  window.__transparencyEverywhereMod = true;

  // Settings: config.json next to this file, in the format of CONFIG.md at the
  // repository's root (the CasaMOD Store shows and changes it). Each value by
  // its key; a missing or invalid one is the default
  var SELF = document.currentScript && document.currentScript.src;
  var DEFAULTS = { blur: 20, tint: 40, topBar: true };
  var VALID = {
    blur: function (v) { return typeof v === 'number' && v >= 0 && v <= 40 && v % 1 === 0; },
    tint: function (v) { return typeof v === 'number' && v >= 0 && v <= 90 && v % 5 === 0; },
    topBar: function (v) { return v === true || v === false; }
  };
  var config = {};
  Object.keys(DEFAULTS).forEach(function (k) { config[k] = DEFAULTS[k]; });
  function loadConfig() {
    if (!SELF) return Promise.resolve();
    return fetch(new URL('config.json', SELF).href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        var values = {};
        if (c && Array.isArray(c.settings)) c.settings.forEach(function (s) { if (s && typeof s.key === 'string') values[s.key] = s.value; });
        Object.keys(DEFAULTS).forEach(function (k) { config[k] = VALID[k](values[k]) ? values[k] : DEFAULTS[k]; });
      })
      .catch(function () { /* no config.json, or not JSON: as it was */ });
  }

  function apply() {
    var root = document.documentElement;
    root.style.setProperty('--te-blur', config.blur + 'px');
    root.style.setProperty('--te-tint', String(config.tint / 100));
    root.classList.toggle('te-no-bar', !config.topBar);
  }

  // At load, and when the tab comes back in sight (a change made in the Store)
  loadConfig().then(apply);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadConfig().then(apply); });
})();

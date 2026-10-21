// app-windows/config.json against the format of CONFIG.md (the repository's
// root): its structure, every text in all 31 CasaOS languages (pt-pt only
// where it differs from pt), values within their rules, and the settings and
// defaults the same as the mod's own (DEFAULTS in mod.js).
// Run: node tests/config-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'app-windows');
const LANGS = ['en', 'ar', 'be', 'bg', 'ca', 'cs', 'de', 'el', 'es', 'fr', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'no',
  'pl', 'pt', 'pt-pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi', 'zh-cn', 'zh-tw'];
const TYPES = ['select', 'number', 'boolean', 'text'];
let failed = 0;
const check = (name, bad) => {
  if (bad.length) failed++;
  console.log((bad.length ? 'FAIL ' : 'PASS ') + name + (bad.length ? '\n  ' + bad.join('\n  ') : ''));
};

let cfg = null;
try { cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')); } catch (e) { check('config.json is JSON', [e.message]); process.exit(1); }

const textMap = (where, m, bad) => {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return bad.push(where + ': not a text map');
  Object.keys(m).forEach((c) => {
    if (!LANGS.includes(c)) bad.push(where + ': unknown language ' + c);
    else if (typeof m[c] !== 'string' || !m[c].trim()) bad.push(where + '.' + c + ': empty');
  });
  LANGS.filter((c) => c !== 'pt-pt' && !(c in m)).forEach((c) => bad.push(where + ': no ' + c));
};

// What a value may be, by the setting's rules
const valid = (s, v) => {
  if (s.type === 'select') return Array.isArray(s.options) && s.options.some((o) => o && o.value === v);
  if (s.type === 'number') {
    if (typeof v !== 'number' || !isFinite(v) || v < s.min || v > s.max) return false;
    const k = (v - s.min) / s.step;
    return Math.abs(k - Math.round(k)) < 1e-9;
  }
  if (s.type === 'boolean') return v === true || v === false;
  if (s.type === 'text') return typeof v === 'string' && v.length <= s.maxLength && (!s.pattern || new RegExp('^(?:' + s.pattern + ')$').test(v));
  return false;
};

let bad = [];
if (cfg.format !== 1) bad.push('format is ' + JSON.stringify(cfg.format) + ', not 1');
if (!Array.isArray(cfg.settings) || !cfg.settings.length) bad.push('no settings');
check('the file: format 1 and a list of settings', bad);

const keys = [];
(cfg.settings || []).forEach((s, i) => {
  bad = [];
  const at = 'settings[' + i + ']' + (s && s.key ? ' (' + s.key + ')' : '');
  if (!s || typeof s !== 'object') return check(at, ['not an object']);
  if (typeof s.key !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(s.key)) bad.push('key: letters and digits, starting lowercase');
  else if (keys.includes(s.key)) bad.push('key used twice');
  else keys.push(s.key);
  if (!TYPES.includes(s.type)) bad.push('type: one of ' + TYPES.join(', '));
  if (s.applies !== 'visible' && s.applies !== 'reload') bad.push('applies: "visible" or "reload"');
  textMap('label', s.label, bad);
  if ('description' in s) textMap('description', s.description, bad);
  if (s.type === 'select') {
    if (!Array.isArray(s.options) || s.options.length < 2) bad.push('options: two or more');
    else {
      const seen = new Set();
      s.options.forEach((o, k) => {
        if (!o || typeof o.value !== 'string') return bad.push('options[' + k + '].value: a string');
        if (seen.has(o.value)) bad.push('options[' + k + '].value used twice');
        seen.add(o.value);
        textMap('options[' + k + '].label', o.label, bad);
      });
    }
  }
  if (s.type === 'number') {
    ['min', 'max', 'step'].forEach((f) => { if (typeof s[f] !== 'number' || !isFinite(s[f])) bad.push(f + ': a number'); });
    if (s.max <= s.min) bad.push('max: greater than min');
    if (!(s.step > 0)) bad.push('step: greater than 0');
    if ('unit' in s) textMap('unit', s.unit, bad);
  }
  if (s.type === 'text') {
    if (!Number.isInteger(s.maxLength) || s.maxLength < 1) bad.push('maxLength: a whole number, 1 or more');
    if ('pattern' in s) { try { new RegExp(s.pattern); } catch (e) { bad.push('pattern: ' + e.message); } }
  }
  if (!valid(s, s.default)) bad.push('default ' + JSON.stringify(s.default) + ' breaks its rules');
  if (!valid(s, s.value)) bad.push('value ' + JSON.stringify(s.value) + ' breaks its rules');
  if (JSON.stringify(s.value) !== JSON.stringify(s.default)) bad.push('value: shipped equal to default');
  check(at + ': ' + (s.type || '?'), bad);
});

// The same settings and defaults as the mod's code
const src = fs.readFileSync(path.join(DIR, 'mod.js'), 'utf8');
const m = src.match(/var DEFAULTS = (\{[^}]*\});/);
bad = [];
if (!m) bad.push('no DEFAULTS in mod.js');
else {
  const defaults = vm.runInNewContext('(' + m[1] + ')');
  const inFile = Object.fromEntries((cfg.settings || []).map((s) => [s.key, s.default]));
  Object.keys(defaults).forEach((k) => {
    if (!(k in inFile)) bad.push(k + ': in mod.js, not in config.json');
    else if (JSON.stringify(inFile[k]) !== JSON.stringify(defaults[k])) bad.push(k + ': default ' + JSON.stringify(inFile[k]) + ' here, ' + JSON.stringify(defaults[k]) + ' in mod.js');
  });
  Object.keys(inFile).forEach((k) => { if (!(k in defaults)) bad.push(k + ': in config.json, not in mod.js'); });
}
check('the same settings and defaults as mod.js', bad);

console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);

// Quick language check, no browser (about a second):
//   node tests/text-check.js
// The mod's TEXT table must have all 31 CasaOS languages, every key in each
// (pt-pt only holds what differs from pt), nothing empty or unknown; and the
// CasaOS language codes must map to them.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = path.join(__dirname, '..', 'app-updates', 'mod.js');
const LANGS = ['en', 'ar', 'be', 'bg', 'ca', 'cs', 'de', 'el', 'es', 'fr', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'no',
  'pl', 'pt', 'pt-pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi', 'zh-cn', 'zh-tw'];

const src = fs.readFileSync(FILE, 'utf8');
const TEXT = vm.runInNewContext('(' + src.match(/var TEXT = (\{[\s\S]*?\n  \});/)[1] + ')');

let fails = 0;
function check(name, ok, info) {
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || info === undefined ? '' : '  → ' + JSON.stringify(info)));
}

const keys = Object.keys(TEXT.en);
const bad = [];
LANGS.forEach((c) => {
  if (!TEXT[c]) return bad.push(c + ': missing');
  Object.keys(TEXT[c]).forEach((k) => {
    if (!(k in TEXT.en)) bad.push(c + ': unknown ' + k);
    else if (TEXT[c][k] === '' || TEXT[c][k] == null) bad.push(c + ': empty ' + k);
  });
  if (c !== 'pt-pt') keys.forEach((k) => { if (!(k in TEXT[c])) bad.push(c + ': no ' + k); });
});
Object.keys(TEXT).forEach((c) => { if (!LANGS.includes(c)) bad.push('extra language ' + c); });
check('all ' + LANGS.length + ' languages, ' + keys.length + ' texts each', !bad.length, bad.slice(0, 10));

// lang(): CasaOS's localStorage.lang (or the browser's) → a key of TEXT
const langSrc = src.match(/function lang\(\) \{[\s\S]*?\n  \}/)[0];
const cases = { en_us: 'en', pt_br: 'pt', pt_pt: 'pt-pt', zh_cn: 'zh-cn', zh_tw: 'zh-tw', no_no: 'no', ar_sa: 'ar',
  sl_si: 'sl', de_de: 'de', 'zh-Hant-HK': 'zh-tw', 'nb-NO': 'no', 'xx-YY': 'en', '': 'en' };
const wrong = Object.keys(cases).filter((code) => {
  const ctx = { TEXT, localStorage: { getItem: () => code }, navigator: { language: '' } };
  return vm.runInNewContext(langSrc + '; lang()', ctx) !== cases[code];
});
check('CasaOS and browser language codes map to the table', !wrong.length, wrong);

console.log(fails ? fails + ' FAIL' : 'all passed');
process.exit(fails ? 1 : 0);

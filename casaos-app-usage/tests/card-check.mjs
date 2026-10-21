// App Usage against cards shaped like CasaOS's (AppSection/AppCard markup) and CasaOS's API answers, faked.
// Run: node tests/card-check.mjs (needs Playwright; Chrome or Chromium found in the usual places, or set CHROME).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const R = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const CHROME = process.env.CHROME || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((f) => fs.existsSync(f));
const icon = (c) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="${c}"/></svg>`);
const APPS = [['jellyfin', 'Jellyfin', icon('#6b4fd8')], ['librechat', 'LibreChat', icon('#d84f6b')], ['mineos', 'MineOS', icon('#4f8a3a')],
  ['big-bear-portainer', 'Portainer', icon('#1a8ad8')], ['syncthing', 'Syncthing', icon('#2a6fb0')]];
const card = ([n, title, ic]) => `<div id="app-${n}" class="handle"><div class="common-card is-flex is-align-items-center is-justify-content-center app-card">
  <div class="action-btn"><div class="dropdown app-card-drop"><div class="dropdown-trigger" onclick="window.menus=(window.menus||0)+1"><p role="button">⋯</p></div></div></div>
  <div class="blur-background"></div><div class="cards-content"><div class="b-tooltip in-card"><div class="tooltip-trigger">
  <div class="has-text-centered is-flex is-justify-content-center is-flex-direction-column pt-5 pb-3px img-c"><div class="is-flex is-justify-content-center">
  <div class="is-relative"><figure class="image is-64x64" onclick="window.opened=(window.opened||0)+1"><img src="${ic}"></figure></div></div>
  <p class="mt-3 one-line"><a class="one-line">${title}</a></p></div></div></div></div></div></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#1b2a4a,#3b2a5a);min-height:100vh}
.app-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;width:900px;margin:40px}
.common-card{position:relative;border-radius:10px;color:#fff;overflow:hidden}
.blur-background{position:absolute;inset:0;background:rgba(53,54,58,.35);backdrop-filter:blur(20px)}
.cards-content{position:relative;width:100%}.is-flex{display:flex}.is-flex-direction-column{flex-direction:column}.is-justify-content-center{justify-content:center}.is-align-items-center{align-items:center}
.has-text-centered{text-align:center}.pt-5{padding-top:1.25rem}.pb-3px{padding-bottom:3px}.mt-3{margin-top:.75rem}.is-relative{position:relative}
.image.is-64x64{width:64px;height:64px;margin:0}.image img{width:64px;height:64px;display:block}
.one-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;margin:0 0 .9rem;font-size:14px;color:#fff}
.action-btn{position:absolute;right:.5rem;top:1rem;visibility:hidden;z-index:20}.common-card:hover .action-btn{visibility:visible}
</style><style>${read('casaos-app-usage/app-usage/mod.css')}</style></head>
<body><div id="app"><div class="app-list">${APPS.map(card).join('')}</div></div></body></html>`;
const stats = (name, ic, cpuPrev, cpuNow, sysPrev, sysNow, ram, cache) => ({ title: name, icon: ic,
  previous: { cpu_stats: { cpu_usage: { total_usage: cpuPrev }, system_cpu_usage: sysPrev } },
  data: { name: '/' + name, cpu_stats: { cpu_usage: { total_usage: cpuNow }, system_cpu_usage: sysNow }, memory_stats: { usage: ram + cache, limit: 16 * 2 ** 30, stats: { inactive_file: cache } } } });
const USAGE = { success: 200, data: [
  stats('jellyfin', APPS[0][2], 0, 3e7, 0, 1e9, 678 * 2 ** 20, 50 * 2 ** 20),          // 3%, 678 MB
  stats('librechat-api', APPS[1][2], 0, 2e7, 0, 1e9, 403 * 2 ** 20, 0),                // 2%
  stats('librechat-mongodb', APPS[1][2], 0, 1.5e7, 0, 1e9, 173 * 2 ** 20, 0),          // 1.5% → librechat 3.5%, 576 MB
  stats('mineos_server', APPS[2][2], 0, 1.2e8, 0, 1e9, 1.6 * 2 ** 30, 0),              // 12%, 1.6 GB
  stats('portainer-xyz', APPS[3][2], 0, 2e6, 0, 1e9, 90 * 2 ** 20, 0)                  // by icon → big-bear-portainer
] };
const COMPOSE = { data: { jellyfin: { update_available: true }, librechat: { update_available: false }, 'big-bear-portainer': { update_available: true } } };
const MOD = 'casaos-app-usage/app-usage/mod.js';
const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const p = await b.newPage({ viewport: { width: 1000, height: 420 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let CONFIG = read('casaos-app-usage/app-usage/config.json'), asked = 0;
await p.route('**/*', (route) => {
  const u = route.request().url();
  if (u.endsWith('/mod/app-usage/mod.js')) return route.fulfill({ contentType: 'text/javascript', body: read(MOD) });
  if (u.endsWith('/mod/app-usage/config.json')) return route.fulfill({ contentType: 'application/json', body: CONFIG });
  if (u.endsWith('/v1/container/usage')) { asked++; return route.fulfill({ json: USAGE }); }
  if (u.endsWith('/v2/app_management/compose')) return route.fulfill({ json: COMPOSE });
  if (u.startsWith('http://casa.test/')) return route.fulfill({ contentType: 'text/html', body: html });
  return route.abort();
});
await p.addInitScript(() => { localStorage.setItem('access_token', 'tok'); localStorage.setItem('lang', 'pt_br'); });
const open = async () => {
  await p.goto('http://casa.test/');
  await p.addScriptTag({ url: 'http://casa.test/mod/app-usage/mod.js' });   // as CasaMOD: <script src="mod/<folder>/mod.js">
  await p.waitForTimeout(1500);
};
await open();
const res = []; const check = (n, ok, info) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' — ' + JSON.stringify(info))); };
const g = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[id^="app-"]')].map((el) => [el.id.slice(4), {
  cpu: el.querySelector(':scope > .aus-cpu')?.textContent || null, ram: el.querySelector(':scope > .aus-ram')?.textContent || null,
  tip: el.querySelector(':scope > .aus-ram')?.title || null, badge: !!el.querySelector('.aup-badge') }])));
const shown = (n) => p.evaluate((n) => getComputedStyle(document.querySelector('#app-' + n + ' > .aus-cpu')).opacity, n);
check('"show": "hover" (config.json): nothing asked of CasaOS before the pointer is on a card', asked === 0, asked);
await p.hover('#app-jellyfin .cards-content img');
await p.waitForTimeout(1200);
check('…on a card: CasaOS asked at once', asked === 1, asked);
check('…its gauges fade in; the others stay hidden', (await shown('jellyfin')) === '1' && (await shown('librechat')) === '0', [await shown('jellyfin'), await shown('librechat')]);
let s = await g();
check('Jellyfin: CPU 3.0%, RAM 678M (the page cache left out)', s.jellyfin.cpu === '3.0%CPU' && s.jellyfin.ram === '678MRAM', s.jellyfin);
check('LibreChat: its two containers summed (3.5%, 576M)', s.librechat.cpu === '3.5%CPU' && s.librechat.ram === '576MRAM', s.librechat);
check('MineOS: its container "mineos_server" found by name; 12%, 1.6G', s.mineos.cpu === '12%CPU' && s.mineos.ram === '1.6GRAM', s.mineos);
check('Portainer: its container found by the icon', s['big-bear-portainer'].cpu === '0.2%CPU', s['big-bear-portainer']);
check('Syncthing (stopped): no gauges', s.syncthing.cpu === null && s.syncthing.ram === null, s.syncthing);
check('RAM tooltip: the size and the share of the memory', s.jellyfin.tip === 'RAM 678.00 MB · 4.1%', s.jellyfin.tip);
const pad = await p.evaluate(() => getComputedStyle(document.querySelector('#app-jellyfin p.one-line')).paddingLeft);
check('the app name keeps its whole width', parseFloat(pad) === 0, pad);
await p.mouse.move(990, 410);
await p.waitForTimeout(500);
const before = asked;
await p.waitForTimeout(3500);
check('pointer off the cards: gauges hidden, CasaOS no longer asked', (await shown('jellyfin')) === '0' && asked === before, [await shown('jellyfin'), asked - before]);
await p.hover('#app-jellyfin .cards-content img');
await p.waitForTimeout(600);
await p.evaluate(() => { const el = document.getElementById('app-jellyfin'); const copy = el.cloneNode(true); copy.querySelectorAll('.aus-gauge, .aup-badge').forEach((n) => n.remove()); copy.classList.remove('aus-on'); el.replaceWith(copy); });
await p.waitForTimeout(800);
s = await g();
check('after CasaOS draws a card again: its gauges are back', s.jellyfin.cpu === '3.0%CPU', s.jellyfin);
CONFIG = JSON.stringify((() => {   // the shipped file, with the values a CasaMOD Store would write
  const c = JSON.parse(read('casaos-app-usage/app-usage/config.json'));
  c.settings.find((x) => x.key === 'show').value = 'always';
  c.settings.find((x) => x.key === 'interval').value = 2;
  return c;
})());
asked = 0;
await p.mouse.move(990, 410);
await open();
check('"show": "always": the gauges without the pointer, CasaOS asked', (await shown('jellyfin')) === '1' && asked >= 1, [await shown('jellyfin'), asked]);
check('no page errors', errors.length === 0, errors);
await b.close();
const bad = res.filter((r) => !r).length;
console.log(bad ? bad + ' FAIL' : res.length + ' PASS');
process.exit(bad ? 1 : 0);

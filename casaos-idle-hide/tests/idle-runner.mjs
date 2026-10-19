// End-to-end tests for the Idle Hide mod against the mock CasaOS dashboard
// (tests/mock.html, after CasaOS-UI), driven with real mouse, key and touch
// input. The idle time is set to 3 seconds (0.05 min) through the mod's
// settings so the waits stay short.
//
//   node tests/idle-runner.mjs
import fs from 'node:fs';
import { start, sleep } from './harness.mjs';

const T = await start();
const { ev, waitFor, click, clickSel, mouse, key, shot, check, info } = T;

const LIMIT = 3000;            // ms, the idle time used here
const STORE = 'casamod-idle-hide';

async function open(cfg) {
  if (cfg !== undefined) {
    await ev(`localStorage.setItem(${JSON.stringify(STORE)}, ${JSON.stringify(JSON.stringify(cfg))})`);
  }
  await T.send('Page.navigate', { url: T.site });
  return waitFor(`window.CasaIdleHide && document.getElementById('idh-switch') && !document.getElementById('idh-switch').hidden`, 15000);
}

const STATE = `(() => { const r = document.documentElement.classList;
  return { mode: CasaIdleHide.mode, hidden: r.contains('idh-hidden'), raised: r.contains('idh-raised'), anim: r.contains('idh-anim'),
    checked: document.querySelector('#idh-switch input').checked }; })()`;
const state = () => ev(STATE);
const HIDDEN = `CasaIdleHide.mode !== null`;
const RAISED = `document.documentElement.classList.contains('idh-raised')`;
const VISIBLE = `CasaIdleHide.mode === null && !document.documentElement.classList.contains('idh-hidden')`;

async function center(sel) {
  return ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
    const b = e.getBoundingClientRect(); return [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)]; })()`);
}
// A button press with any button, the way a real mouse sends it
async function press(x, y, button = 'left') {
  await T.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await T.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 });
  await T.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
}
async function tap(x, y) {
  await T.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await T.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
// Waits without touching anything (the idle time runs)
async function still(ms) { await sleep(ms); }
async function waitHidden(timeout = LIMIT + 3000) { return waitFor(HIDDEN, timeout); }
async function waitRaised(timeout = LIMIT + 4000) { return waitFor(RAISED, timeout); }
async function setWidth(w, h = 900) {
  await T.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
}
const SW = `(() => { const s = document.getElementById('idh-switch'), b = s.getBoundingClientRect(), t = document.querySelector('.top-bar').getBoundingClientRect();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, hit = document.elementFromPoint(cx, cy);
  return { right: Math.round(innerWidth - b.right), inBar: cy > t.top && cy < t.bottom, hit: !!hit && s.contains(hit), w: Math.round(b.width),
    brandClear: [...document.querySelectorAll('.top-bar .navbar-brand > *')].every(e => e.getBoundingClientRect().right <= b.left) }; })()`;

try {
  // ---------------------------------------------------------------- load
  await ev(`localStorage.clear()`).catch(() => {});
  check('the mod loads in the mock CasaOS', await open(), await ev(`({ mod: !!window.CasaIdleHide })`).catch(() => null));
  const injected = await ev(`[...document.scripts].map(s => s.getAttribute('src')).filter(Boolean)`);
  check('CasaMOD-style injection (mod.js of each mod)', injected.includes('mod/idle-hide/mod.js'), injected);
  for (const w of [1440, 1000, 400]) {
    await setWidth(w);
    const s = await ev(SW);
    check(`the switch sits at the far right of the top bar (${w}px wide), clickable, clear of the CasaOS icons`,
      s.right >= 0 && s.right <= 40 && s.inBar && s.hit && s.brandClear && s.w > 30, s);
  }
  await setWidth(1440);
  await ev('Mock.openFiles()');
  const closeAt = await center('.files-close');
  check('a CasaOS window (the file manager, full screen) covers the switch: its close button at the top right can be clicked',
    (await ev(`document.elementFromPoint(${closeAt[0]}, ${closeAt[1]}).className`)).includes('files-close'), await ev(`document.elementFromPoint(${closeAt[0]}, ${closeAt[1]}).className`));
  await click(closeAt[0], closeAt[1]);
  check('…and it closes', await waitFor(`getComputedStyle(document.querySelector('.file-panel')).display === 'none'`, 1000), null);
  await ev('Mock.openModal()');
  const swAt = await center('#idh-switch .idh-track');
  check('…a dialog\'s backdrop covers it too', !(await ev(`document.getElementById('idh-switch').contains(document.elementFromPoint(${swAt[0]}, ${swAt[1]}))`)), null);
  await ev('Mock.closeModal()');
  check('everything shows at first, the switch off', JSON.stringify(await state()) === JSON.stringify({ mode: null, hidden: false, raised: false, anim: false, checked: false }), await state());
  await shot('idle_visible');

  // ---------------------------------------------------------------- the settings row
  await clickSel('#settings-btn');
  await waitFor(`document.getElementById('idh-row')`, 2000);
  const ROWINFO = `(() => { const r = document.getElementById('idh-row'), prev = r.previousElementSibling;
    return { afterWallpaper: !!prev.querySelector('.casa-wallpaper-outline'), cls: r.className, icon: !!r.querySelector('.casa-time-outline'),
      sw: !!r.querySelector('label.switch._small > input[type="checkbox"] + span.check.is-dark'), on: r.querySelector('.switch input').checked,
      minutes: r.querySelector('.idh-minutes input').value, label: r.querySelector('.idh-label').textContent, unit: r.querySelector('.idh-unit').textContent,
      disabled: r.querySelector('.idh-minutes input').disabled, count: document.querySelectorAll('#idh-row').length,
      lwRow: document.querySelector('.dropdown-content ._box .casa-wallpaper-outline').closest('._box').textContent.includes('Wallpaper'),
      open: document.getElementById('settings-dropdown').classList.contains('is-active') }; })()`;
  let row = await ev(ROWINFO);
  check('a row in the CasaOS settings, right after "Wallpaper", in CasaOS\'s row markup (Buefy switch, time icon)',
    row.afterWallpaper && row.cls === 'is-flex is-align-items-center mb-1 _is-large _box hover-effect _is-radius pr-2 mr-4 ml-4 idh-off'.replace(' idh-off', '')
    && row.icon && row.sw && row.count === 1 && row.lwRow, row);
  check('…"Idle time", 5 min, on by default', row.label === 'Idle time' && row.unit === 'min' && row.minutes === '5' && row.on && !row.disabled, row);
  await shot('idle_settings_row', await ev(`(() => { const b = document.querySelector('#settings-dropdown .dropdown-content').getBoundingClientRect(); return { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 }; })()`));
  await clickSel('#idh-row .switch .check');
  row = await ev(ROWINFO);
  check('its switch turns the idle hiding off (saved; the field dims), and the dropdown stays open',
    !row.on && row.disabled && row.open && (await ev(`JSON.parse(localStorage.getItem('${STORE}')).enabled`)) === false, row);
  await clickSel('#idh-row .switch .check');
  check('…and on again', (await ev(ROWINFO)).on && (await ev(`JSON.parse(localStorage.getItem('${STORE}')).enabled`)) === true, await ev(ROWINFO));
  const typeMinutes = async (text) => {
    await ev(`(() => { const f = document.querySelector('#idh-row .idh-minutes input'); f.focus(); f.select(); })()`);
    await T.send('Input.insertText', { text });
    await key('Enter', 'Enter', 13);
    await sleep(100);
    return ev(`({ field: document.querySelector('#idh-row .idh-minutes input').value, saved: JSON.parse(localStorage.getItem('${STORE}')).minutes })`);
  };
  let m = await typeMinutes('12');
  check('typing the minutes (Enter) saves them', m.field === '12' && m.saved === 12, m);
  m = await typeMinutes('0');
  check('…at least 1 minute', m.field === '1' && m.saved === 1, m);
  m = await typeMinutes('99999');
  check('…at most 1440 (a day)', m.field === '1440' && m.saved === 1440, m);
  await typeMinutes('7');
  m = await typeMinutes('-');
  check('…and something that isn\'t a number puts the saved value back', m.field === '7' && m.saved === 7, m);
  check('…the dropdown stays open through all of it', await ev(`document.getElementById('settings-dropdown').classList.contains('is-active')`), null);
  await ev('Mock.rerenderSettings()');
  check('the row comes back, once, when CasaOS re-renders its settings', await waitFor(`document.querySelectorAll('#idh-row').length === 1
    && document.getElementById('idh-row').previousElementSibling.querySelector('.casa-wallpaper-outline')
    && document.querySelector('#idh-row .idh-minutes input').value === '7'`, 2000), await ev(ROWINFO));
  await ev('Mock.rerenderTopBar()');
  check('…also when CasaOS re-renders the whole top bar (the switch stays)', await waitFor(`document.querySelectorAll('#idh-row').length === 1 && !document.getElementById('idh-switch').hidden`, 2000)
    || (await clickSel('#settings-btn'), await waitFor(`document.querySelectorAll('#idh-row').length === 1`, 2000)), await ev(`document.querySelectorAll('#idh-row').length`));
  await ev(`document.querySelectorAll('.dropdown.is-active').forEach(d => d.classList.remove('is-active'))`);

  // ---------------------------------------------------------------- idle: the cascade, then the wallpaper on top
  check('reload with a 3 s idle time', await open({ enabled: true, minutes: 0.05 }), null);
  await mouse('mouseMoved', 700, 500);
  check('nothing hides before the idle time', (await ev(VISIBLE)) && !(await waitFor(HIDDEN, LIMIT - 1000)), await state());
  check('after the idle time without activity, everything goes (idle)', await waitHidden(), await state());
  const DELAYS = `(() => { const d = (el) => el ? parseInt(getComputedStyle(el).getPropertyValue('--idh-d')) : null;
    const q = (s) => document.querySelector(s), all = (s) => [...document.querySelectorAll(s)];
    const wave = all('.search-bar, .swiper-container, .home-section > .is-flex, .app-list > .handle, .side-bar .scroll-area > :not(.ps__rail-y), .side-bar > :not(.scroll-area)')
      .map(e => { const r = e.getBoundingClientRect(); return { at: r.top + r.left * 0.6, d: d(e) }; }).sort((a, b) => a.at - b.at).map(x => x.d);
    return { top: d(q('.top-bar')), search: d(q('.search-bar')), cards: all('.app-list > .handle').map(d), wave,
      foot: d(q('#app > .base-bar')), total: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--idh-total')),
      delays: { top: getComputedStyle(q('.top-bar')).transitionDelay, card: getComputedStyle(q('.app-list > .handle:nth-child(3) .blur-background')).transitionDelay,
        foot: getComputedStyle(q('#app > .base-bar')).transitionDelay, home: getComputedStyle(q('#app > .out-container')).transitionDelay } }; })()`;
  const dl = await ev(DELAYS);
  const rising = (a) => a.every((v, i) => i === 0 || v >= a[i - 1]);
  check('one by one: the top bar first, then a diagonal wave from the top left (widgets, search, apps), the footer last',
    dl.top === 0 && dl.wave.length >= 12 && rising(dl.wave) && dl.wave[0] > 0 && dl.wave[dl.wave.length - 1] < dl.foot && dl.foot === dl.total
    && new Set(dl.wave).size === dl.wave.length, dl);
  const ms = (v) => v.split(',').map((x) => Math.round(parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000)));
  check('…each item\'s fade waits its turn; the leftovers and the hiding for good come after the last one',
    ms(dl.delays.top)[0] === 0 && ms(dl.delays.card)[0] === dl.cards[2] && ms(dl.delays.foot)[0] === dl.total && ms(dl.delays.home)[2] === dl.total + 450
    && ms(dl.delays.card)[2] === dl.total + 450, dl.delays);
  check('…the whole cascade stays short (under a second)', dl.total > 300 && dl.total <= 950, dl);
  await sleep(Math.round(dl.total / 2));
  await shot('idle_cascade');
  check('then the wallpaper is raised above everything', await waitRaised(), await state());
  const GONE = `(() => { const cs = (s) => getComputedStyle(document.querySelector(s)), c = document.querySelector('.app-list > .handle').getBoundingClientRect();
    const hit = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
    return { home: cs('#app > .out-container').visibility, foot: cs('#app > .base-bar').visibility,
      tip: cs('.tooltip-content').visibility, card: [...document.querySelectorAll('.app-list > .handle [data-idh-fade]')].map(e => getComputedStyle(e).opacity).join(), bg: cs('#background').visibility,
      cover: cs('#idh-cover').display, coverBg: cs('#idh-cover').backgroundImage === cs('#background').backgroundImage, coverZ: cs('#idh-cover').zIndex,
      hit: hit && hit.id, sw: !document.getElementById('idh-switch').hidden, checked: document.querySelector('#idh-switch input').checked,
      swOpacity: +cs('#idh-switch').opacity }; })()`;
  let g = await ev(GONE);
  check('…the dashboard and the footer are hidden for good (even a tooltip that forces itself visible)',
    g.home === 'hidden' && g.foot === 'hidden' && g.tip === 'hidden' && /^0(,0)+$/.test(g.card), g);
  check('…a static CasaOS wallpaper is copied on top', g.cover === 'block' && g.coverBg && g.coverZ === '2147483000', g);
  check('…every click lands on the catcher, never on a hidden app', g.hit === 'idh-catch', g);
  check('…only the switch stays, checked and discreet', g.sw && g.checked && g.swOpacity < 0.5, g);
  await shot('idle_hidden');

  // ---------------------------------------------------------------- the frosted glass keeps blurring while it fades
  // (an ancestor with opacity below 1 would cut the glass off from the wallpaper)
  const GLASS = `(() => { const out = { glass: 0, fading: 0, cut: [] };
    for (const el of document.querySelectorAll('#app *')) {
      const own = getComputedStyle(el).backdropFilter !== 'none', pse = getComputedStyle(el, '::before').backdropFilter !== 'none';
      if (!own && !pse) continue;
      out.glass++;
      const op = +(own ? getComputedStyle(el) : getComputedStyle(el, '::before')).opacity;
      if (op > 0.02 && op < 0.98) out.fading++;
      for (let p = own ? el.parentElement : el; p && p.id !== 'app'; p = p.parentElement) {
        if (+getComputedStyle(p).opacity < 1) { out.cut.push((el.className || el.tagName) + ' under ' + (p.className || p.tagName)); break; }
      }
    }
    return out; })()`;
  async function glassDuringCascade() {
    if (!(await ev(VISIBLE))) await key('a', 'KeyA', 65);
    await waitFor(VISIBLE, 3000);
    await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 3000);
    await ev(`document.querySelector('#idh-switch input').click()`);
    const samples = [];
    for (let i = 0; i < 8; i++) { samples.push(await ev(GLASS)); await sleep(90); }
    samples.topGlass = await ev(`document.querySelector('.top-bar').getAttribute('data-idh-glass')`);
    samples.topOpacity = await ev(`getComputedStyle(document.querySelector('.top-bar')).opacity`);
    await key('Escape', 'Escape', 27);
    for (let i = 0; i < 6; i++) { samples.push(await ev(GLASS)); await sleep(90); }   // and coming back
    return samples;
  }
  let gs = await glassDuringCascade();
  check('while the cascade runs (both ways), the frosted glass (widgets, app cards) fades by itself and keeps blurring: nothing above it is half transparent',
    gs.every((x) => x.cut.length === 0) && gs.some((x) => x.fading >= 3) && gs[0].glass >= 10, gs.map((x) => ({ g: x.glass, f: x.fading, cut: x.cut.slice(0, 2) })));
  // the same with Transparency Everywhere (the top bar's glass is a ::before)
  const te = fs.readFileSync(new URL('../../casaos-transparency-everywhere/transparency-everywhere/mod.css', import.meta.url), 'utf8');
  await ev(`(() => { const s = document.createElement('style'); s.id = 'te'; s.textContent = ${JSON.stringify(te)}; document.head.appendChild(s); })()`);
  gs = await glassDuringCascade();
  check('…also with Transparency Everywhere: the top bar\'s glass (its ::before) fades by itself, the bar doesn\'t',
    gs.every((x) => x.cut.length === 0) && gs.some((x) => x.fading >= 3) && gs[0].glass >= 13 && gs.topGlass === 'before' && gs.topOpacity === '1',
    { top: [gs.topGlass, gs.topOpacity], s: gs.map((x) => ({ g: x.glass, f: x.fading, cut: x.cut.slice(0, 2) })) });
  await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 3000);
  await ev(`document.getElementById('te').remove()`);
  check('…and once everything shows again, the marks are gone', (await ev(`document.querySelectorAll('[data-idh-fade], [data-idh-glass]').length`)) === 0, null);
  await waitFor(HIDDEN, LIMIT + 3000);
  await waitRaised();

  // ---------------------------------------------------------------- moves don't wake; the wake click does nothing else
  await ev('Mock.reset()');
  for (let i = 0; i < 12; i++) await mouse('mouseMoved', 300 + i * 40, 300 + i * 20);
  await sleep(300);
  check('mouse moves don\'t bring it back, and still reach the page (an animated wallpaper follows them)',
    (await ev(HIDDEN)) && (await ev('Mock.moves')) >= 12, { s: await state(), moves: await ev('Mock.moves') });
  await ev(`window.__pd = 0; addEventListener('pointerdown', () => __pd++, true)`);   // like Live Wallpapers' own window listeners
  const card = await center('.app-list > .handle:nth-child(2)');
  await ev('Mock.reset()');
  await press(card[0], card[1]);
  check('a click brings everything back', await waitFor(VISIBLE, 1000), await state());
  let rec = await ev('Mock.rec');
  check('…and does nothing else: no app opens, the page sees no press or click, the wallpaper gets none',
    (await ev('Mock.launched.length')) === 0 && !rec.some((r) => /^(mousedown|mouseup|click)/.test(r)) && (await ev('Mock.wallpaperPresses.length')) === 0, { rec, launched: await ev('Mock.launched') });
  check('…while window listeners of other mods (audio unlock) still run', (await ev('__pd')) === 1, await ev('__pd'));
  const back = await ev(DELAYS);
  check('…coming back in reverse: the footer first, the top bar last', back.foot === 0 && back.top === back.total && back.top > back.cards[0], back);
  check('…and the wallpaper is lowered at once', !(await ev(RAISED)), await state());
  await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 2000);
  await press(card[0], card[1]);
  check('the next click opens the app as usual', (await ev('Mock.launched')).join() === 'App Store', await ev('Mock.launched'));
  check('…and after the idle time it all goes again', await waitHidden(), await state());

  await waitRaised();
  await ev('Mock.reset()');
  await press(700, 400, 'right');
  rec = await ev('Mock.rec');
  check('a right click brings it back too, with no menu (no contextmenu reaches the page)', (await waitFor(VISIBLE, 1000)) && !rec.some((r) => /^(contextmenu|mousedown|mouseup)/.test(r)), rec);
  await waitHidden();
  await ev('Mock.reset()');
  await tap(card[0], card[1]);
  await sleep(300);
  rec = await ev('Mock.rec');
  check('…and so does a tap (a touch screen), swallowed as well', (await ev(VISIBLE)) && (await ev('Mock.launched.length')) === 0 && !rec.some((r) => /^(click|mousedown)/.test(r)), { rec, s: await state() });
  await waitHidden();
  await ev('Mock.reset()');
  await key('Shift', 'ShiftLeft', 16);
  await sleep(200);
  check('a modifier key alone (Shift, Alt…) doesn\'t wake it', await ev(HIDDEN), await state());
  await ev(`document.documentElement.click(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))`);
  await sleep(200);
  check('synthetic clicks and keys from scripts don\'t wake it', await ev(HIDDEN), await state());
  await ev('Mock.reset()');
  for (const [k, vk] of [['MediaPlayPause', 179], ['MediaTrackNext', 176], ['MediaTrackPrevious', 177], ['AudioVolumeUp', 175]]) await key(k, k, vk);
  await sleep(200);
  rec = await ev('Mock.rec');
  check('media keys (play/pause, next, volume) don\'t wake it, and still reach the page (the music keeps being controlled)',
    (await ev(HIDDEN)) && rec.includes('keydown:MediaPlayPause@BODY') && rec.includes('keydown:AudioVolumeUp@BODY'), { s: await state(), rec });
  await ev('Mock.reset()');
  await key('a', 'KeyA', 65);
  rec = await ev('Mock.rec');
  check('a key brings it back, and the page doesn\'t get that key', (await waitFor(VISIBLE, 1000)) && !rec.some((r) => /^key/.test(r)), rec);

  // ---------------------------------------------------------------- activity postpones it; light on the PC
  await ev(`window.__st = 0; window.__raf = 0; const st = window.setTimeout, raf = window.requestAnimationFrame;
    window.setTimeout = function () { __st++; return st.apply(this, arguments); }; window.requestAnimationFrame = function () { __raf++; return raf.apply(this, arguments); }`);
  await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 2000);
  await ev('__st = 0; __raf = 0');
  for (let i = 0; i < 100; i++) await mouse('mouseMoved', 200 + (i % 50) * 9, 300 + (i % 7) * 11);
  check('moving the mouse costs nothing: no timers, no animation frames', (await ev('__st')) === 0 && (await ev('__raf')) === 0, { st: await ev('__st'), raf: await ev('__raf') });
  await sleep(1800);
  await mouse('mouseMoved', 640, 480);
  await sleep(1800);
  await mouse('mouseMoved', 660, 470);
  await sleep(1800);
  check('real mouse moves keep it from hiding', await ev(VISIBLE), await state());
  for (let i = 0; i < 6; i++) { await mouse('mouseMoved', 660, 470); await sleep(500); }
  check('…but "moves" that stay on the same spot (the page changing under a still cursor) don\'t', await ev(HIDDEN), await state());
  await key('a', 'KeyA', 65);
  await waitFor(VISIBLE, 1000);
  for (let i = 0; i < 9; i++) { await key('MediaPlayPause', 'MediaPlayPause', 179); await sleep(450); }
  check('…nor do media keys (controlling the music isn\'t using the dashboard)', await ev(HIDDEN), await state());
  await key('a', 'KeyA', 65);
  await waitFor(VISIBLE, 1000);

  // ---------------------------------------------------------------- never while something is in use
  const BLOCK_WAIT = LIMIT * 2 + 500;
  await clickSel('#settings-btn');
  check('a menu open (the CasaOS settings) keeps it from hiding', !(await waitFor(HIDDEN, BLOCK_WAIT)), await state());
  await ev(`document.querySelectorAll('.dropdown.is-active').forEach(d => d.classList.remove('is-active'))`);
  check('…and once it closes, the idle time runs again', await waitFor(HIDDEN, LIMIT * 2 + 2000), await state());
  await key('a', 'KeyA', 65);
  await ev('Mock.openModal()');
  check('a CasaOS dialog keeps it from hiding', !(await waitFor(HIDDEN, BLOCK_WAIT)), await state());
  await ev('Mock.closeModal()');
  await ev('Mock.openLwPanel()');
  check('…so does the Live Wallpapers panel', !(await waitFor(HIDDEN, BLOCK_WAIT)), await state());
  await ev('Mock.closeLwPanel()');
  await clickSel('#search');
  check('…and typing in a field (the search)', !(await waitFor(HIDDEN, BLOCK_WAIT)), await state());
  await ev('document.activeElement.blur()');
  check('the hidden file manager (always in the page) doesn\'t count', await waitFor(HIDDEN, LIMIT * 2 + 2000), await state());
  await waitRaised();
  await ev('Mock.openModal()');
  check('a dialog that opens while hidden (CasaOS wants attention) brings everything back', await waitFor(VISIBLE, 1500), await state());
  await ev('Mock.closeModal()');
  await waitHidden();
  await ev(`Mock.route('#/login')`);
  check('leaving the dashboard (logout, login page) shows everything and the switch goes', await waitFor(`${VISIBLE} && document.getElementById('idh-switch').hidden`, 1500), await state());
  const login = await center('#login-user');
  check('…the login page works', (await ev(`document.elementFromPoint(${login[0]}, ${login[1]}).id`)) === 'login-user', await ev(`document.elementFromPoint(${login[0]}, ${login[1]}).id`));
  check('…and nothing hides there', !(await waitFor(HIDDEN, BLOCK_WAIT)), await state());
  await ev(`Mock.route('#/')`);
  check('back on the dashboard: the switch returns and the idle time runs', (await waitFor(`!document.getElementById('idh-switch').hidden`, 1500)) && await waitHidden(LIMIT * 2 + 2000), await state());
  await key('a', 'KeyA', 65);

  // ---------------------------------------------------------------- with Live Wallpapers
  await ev('Mock.lwOn()');
  await waitHidden();
  await waitRaised();
  const lw = await ev(`({ layer: getComputedStyle(document.getElementById('lw-layer')).zIndex, cover: getComputedStyle(document.getElementById('idh-cover')).display })`);
  check('with Live Wallpapers, its own layer is raised (no copy)', lw.layer === '2147483000' && lw.cover === 'none', lw);
  await shot('idle_hidden_lw');
  await key('a', 'KeyA', 65);
  await waitFor(VISIBLE, 1000);
  check('…and lowered again when everything comes back', (await ev(`getComputedStyle(document.getElementById('lw-layer')).zIndex`)) === '0', await ev(`getComputedStyle(document.getElementById('lw-layer')).zIndex`));

  // ---------------------------------------------------------------- by hand: the switch
  await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 2000);
  await clickSel('#settings-btn');
  await clickSel('#idh-switch .idh-track');
  check('the switch hides everything at once (by hand), closing an open menu', await waitFor(`CasaIdleHide.mode === 'manual' && document.querySelector('#idh-switch input').checked
    && !document.querySelector('.dropdown.is-active')`, 1000), await state());
  await waitRaised();
  check('…it stays hidden past the idle time', !(await waitFor(VISIBLE, LIMIT + 1000)), await state());
  await ev('Mock.reset()');
  await press(card[0], card[1]);
  await sleep(200);
  check('…clicks go to the wallpaper (Live Wallpapers gets the press), never to a hidden app',
    (await ev(HIDDEN)) && (await ev('Mock.wallpaperPresses')).join() === 'idh-catch' && (await ev('Mock.launched.length')) === 0, { s: await state(), presses: await ev('Mock.wallpaperPresses') });
  await mouse('mouseMoved', 500, 500);
  await key('a', 'KeyA', 65);
  await sleep(200);
  check('…moves and keys don\'t bring it back', await ev(HIDDEN), await state());
  const swc = await center('#idh-switch .idh-track');
  await mouse('mouseMoved', swc[0], swc[1]);
  await sleep(350);
  check('…the switch is discreet, and clear when the mouse is on it', (await ev(`+getComputedStyle(document.getElementById('idh-switch')).opacity`)) > 0.95, await ev(`getComputedStyle(document.getElementById('idh-switch')).opacity`));
  await shot('idle_manual_hover', { x: 1100, y: 0, width: 340, height: 120 });
  await press(swc[0], swc[1]);
  check('…clicking it again brings everything back', await waitFor(VISIBLE, 1000), await state());
  await waitFor(`!document.documentElement.classList.contains('idh-anim')`, 2000);
  await press(swc[0], swc[1]);
  await waitFor(HIDDEN, 1000);
  await ev('Mock.reset()');
  await key('Escape', 'Escape', 27);
  rec = await ev('Mock.rec');
  check('…and so does Esc (the page doesn\'t get it)', (await waitFor(VISIBLE, 1000)) && !rec.some((r) => /Escape/.test(r)), rec);
  await ev(`document.querySelector('#idh-switch input').focus()`);
  await key(' ', 'Space', 32);
  check('…Space on the focused switch toggles it (keyboard)', await waitFor(`CasaIdleHide.mode === 'manual'`, 1000), await state());
  await key('Escape', 'Escape', 27);
  await waitFor(VISIBLE, 1000);
  await ev('Mock.openLwPanel()');
  await ev(`document.querySelector('#idh-switch input').click()`);
  check('…the Live Wallpapers panel hides with the rest', await waitFor(`getComputedStyle(document.getElementById('lw-panel')).visibility === 'hidden'`, 1000), await state());
  await ev(`document.querySelector('#idh-switch input').click()`);
  check('…and comes back with it', await waitFor(`getComputedStyle(document.getElementById('lw-panel')).visibility === 'visible'`, 1000), await state());
  await ev('Mock.closeLwPanel()');
  await ev(`document.querySelector('#idh-switch input').click()`);
  check('reload', await open(), null);
  check('…hiding by hand isn\'t kept: after a reload everything shows', await ev(VISIBLE), await state());

  // ---------------------------------------------------------------- turned off
  check('reload with the idle hiding off', await open({ enabled: false, minutes: 0.05 }), null);
  check('…nothing hides by itself', !(await waitFor(HIDDEN, LIMIT * 2 + 500)), await state());
  await ev(`document.querySelector('#idh-switch input').click()`);
  check('…the switch still hides by hand', await waitFor(`CasaIdleHide.mode === 'manual'`, 1000), await state());
  await key('Escape', 'Escape', 27);

  // ---------------------------------------------------------------- reduced motion
  await waitFor(`${VISIBLE} && !document.documentElement.classList.contains('idh-anim')`, 2000);   // the previous show is over
  await T.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await ev(`document.querySelector('#idh-switch input').click()`);
  await sleep(50);
  const rm = await ev(`({ d: [...document.querySelectorAll('.app-list > .handle')].map(e => getComputedStyle(e).getPropertyValue('--idh-d')),
    each: getComputedStyle(document.documentElement).getPropertyValue('--idh-each'), tr: getComputedStyle(document.querySelector('.app-list > .handle')).translate })`);
  check('with "reduce motion": no cascade and no movement, a short fade', rm.d.every((v) => v === '0ms') && rm.each === '150ms' && rm.tr === 'none', rm);
  check('…still raised at the end', await waitRaised(1000), await state());
  await key('Escape', 'Escape', 27);
  await T.send('Emulation.setEmulatedMedia', { features: [] });

  // ---------------------------------------------------------------- languages
  for (const [code, label, unit, hide] of [['pt_br', 'Tempo ocioso', 'min', 'Ocultar tudo'], ['ru_ru', 'Время бездействия', 'мин', 'Скрыть всё'],
    ['ja_jp', 'アイドル時間', '分', 'すべて隠す'], ['ar_sa', 'وقت الخمول', 'د', 'إخفاء كل شيء']]) {
    await ev(`localStorage.setItem('lang', '${code}')`);
    await open();
    await clickSel('#settings-btn');
    await waitFor(`document.getElementById('idh-row')`, 2000);
    const l = await ev(`({ label: document.querySelector('#idh-row .idh-label').textContent, unit: document.querySelector('#idh-row .idh-unit').textContent,
      sw: document.querySelector('#idh-switch input').getAttribute('aria-label') })`);
    check(`it follows the CasaOS language (${code})`, l.label === label && l.unit === unit && l.sw === hide, l);
    if (code === 'pt_br') await shot('idle_settings_row_pt', await ev(`(() => { const b = document.querySelector('#settings-dropdown .dropdown-content').getBoundingClientRect(); return { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 }; })()`));
  }
  await ev(`localStorage.setItem('lang', 'en_us')`);
} catch (e) {
  check('runner exception: ' + e.message, false, e.stack);
}
await T.finish();

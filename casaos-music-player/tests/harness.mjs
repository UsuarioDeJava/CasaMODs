// Harness for the end-to-end tests: starts the mock CasaOS (server.py, with the
// mod folders of the project root injected the way CasaMOD does) and a
// headless Chrome, and drives it through the DevTools protocol (real clicks,
// keys and audio).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
// The mock CasaOS serves (and injects) the mod folders of the project root
const ROOT = path.join(HERE, '..');
// Chrome: $CHROME, or where it usually is on Windows, Linux (cloud sessions) and macOS
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => fs.existsSync(p));
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// options: { port, cdp, fixtures: true to serve tests/fixtures/wallpapers too }
export async function start({ port = 8770, cdp = 9333, fixtures = false } = {}) {
  if (!fs.existsSync(path.join(HERE, 'music', '.tagged', '04 Tagged.mp3'))) spawnSync(PYTHON, [path.join(HERE, 'make_music.py')], { stdio: 'inherit' });
  const args = [path.join(HERE, 'server.py'), String(port), ROOT].concat(fixtures ? [path.join(HERE, 'fixtures')] : []);
  const server = spawn(PYTHON, args, { stdio: 'ignore' });
  process.on('exit', () => server.kill());
  fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

  if (!CHROME) throw new Error('Chrome not found: set CHROME to its path');
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${path.join(os.tmpdir(), 'casamod-test-profile-' + Date.now())}`,
    '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1440,900'
  ].concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [], ['about:blank']), { stdio: 'ignore' });   // root in containers needs --no-sandbox

  async function json(p) {
    for (let i = 0; i < 100; i++) {
      try { return await (await fetch(`http://127.0.0.1:${cdp}${p}`)).json(); } catch { await sleep(150); }
    }
    throw new Error('chrome did not start');
  }

  const target = (await json('/json/list')).find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let seq = 0;
  const pending = new Map();
  const problems = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      problems.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      problems.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async function waitFor(expr, timeout = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await ev(expr)) return true; } catch { /* not ready */ }
      await sleep(100);
    }
    return false;
  }
  async function mouse(type, x, y) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  }
  async function click(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); }
  async function center(sel) {
    return ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  }
  // Clicks go where a person would click: on what has stopped moving (the
  // widget's panels slide in and its height follows them)
  const SETTLED = `(() => { const w = document.querySelector('.smp-widget .widget');
    return !(w && w.style.height) && !document.getAnimations().some((a) => a.playState === 'running' && a.effect
      && a.effect.getTiming().iterations !== Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.smp-widget')); })()`;
  async function clickSel(sel) {
    await waitFor(SETTLED, 2000);
    const c = await center(sel);
    if (!c) throw new Error('not found: ' + sel);
    await click(c[0], c[1]);
  }
  async function key(k, code, vk) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  }
  async function shot(name, clip) {
    const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' });
    fs.writeFileSync(path.join(HERE, 'shots', name + '.png'), Buffer.from(r.data, 'base64'));
  }
  const results = [];
  function check(name, ok, info) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  → ' + JSON.stringify(info))); }
  function info(text) { results.push('INFO ' + text); }

  async function finish() {
    check('no errors in the console', problems.length === 0, problems.slice(0, 5));
    console.log(results.join('\n'));
    console.log(results.filter((r) => r.startsWith('PASS')).length + ' PASS / ' + results.filter((r) => r.startsWith('FAIL')).length + ' FAIL');
    ws.close();
    chrome.kill();
    await new Promise((r) => { chrome.once('exit', r); setTimeout(r, 3000); });
    process.exit(0);
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  return {
    site: `http://127.0.0.1:${port}/`, send, ev, waitFor, mouse, click, center, clickSel, key, shot, check, info, finish, problems
  };
}

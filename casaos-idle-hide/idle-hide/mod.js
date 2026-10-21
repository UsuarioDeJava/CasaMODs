/*
 * Idle Hide — a CasaMOD mod for CasaOS.
 *
 * After some minutes without activity on the dashboard, everything but the
 * wallpaper goes away: the top bar, then the dashboard in a wave from the top
 * left (search, apps, widgets), then the footer, one by one; at the end the
 * wallpaper (Live Wallpapers' layer, or a copy of the CasaOS image) is raised
 * above everything. A click or a key brings it all back, in reverse; mouse
 * moves don't, so an animated wallpaper keeps reacting to them. A switch at
 * the far right of the top bar does the same on demand, until it is turned off
 * (or Esc). The idle time and an on/off switch for it sit in the CasaOS
 * settings dropdown.
 *
 * Settings (config.json): cascade, one piece after another (true) or all at
 * once; speed of the fades, "slow", "normal" or "fast"; wakeOnMove, a mouse
 * move brings it all back after an idle hide too (false).
 */
(function () {
  'use strict';

  if (window.__idleHideMod) return;
  window.__idleHideMod = true;

  var TAG = '[Idle Hide]';
  var STORE = 'casamod-idle-hide';

  // Settings: config.json next to this file, in the format of CONFIG.md at the
  // repository's root (the CasaMOD Store shows and changes it). Each value by
  // its key; a missing or invalid one is the default
  var SELF = document.currentScript && document.currentScript.src;
  var DEFAULTS = { cascade: true, speed: 'normal', wakeOnMove: false };
  var VALID = {
    cascade: function (v) { return v === true || v === false; },
    speed: function (v) { return v === 'slow' || v === 'normal' || v === 'fast'; },
    wakeOnMove: function (v) { return v === true || v === false; }
  };
  var PACE = { slow: 1.8, normal: 1, fast: 0.5 };   // how long the fades take, against the normal ones
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

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default)
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: {
      idleTime: 'Idle time',
      minutes: 'min',
      minutesHint: 'Minutes without activity before only the wallpaper shows',
      idleSwitch: 'Hide everything when idle',
      hide: 'Hide everything',
      hideHint: 'Show only the wallpaper (Esc brings everything back)',
      show: 'Show everything'
    },
    ar: {
      idleTime: 'وقت الخمول',
      minutes: 'د',
      minutesHint: 'الدقائق دون نشاط قبل أن تبقى الخلفية وحدها',
      idleSwitch: 'إخفاء كل شيء عند الخمول',
      hide: 'إخفاء كل شيء',
      hideHint: 'إظهار الخلفية فقط (Esc يعيد كل شيء)',
      show: 'إظهار كل شيء'
    },
    be: {
      idleTime: 'Час бяздзейнасці',
      minutes: 'хв',
      minutesHint: 'Хвіліны без актыўнасці, пасля якіх застаюцца толькі шпалеры',
      idleSwitch: 'Хаваць усё пры бяздзейнасці',
      hide: 'Схаваць усё',
      hideHint: 'Паказваць толькі шпалеры (Esc вяртае ўсё)',
      show: 'Паказаць усё'
    },
    bg: {
      idleTime: 'Време на неактивност',
      minutes: 'мин',
      minutesHint: 'Минути без активност, след които остава само тапетът',
      idleSwitch: 'Скриване на всичко при неактивност',
      hide: 'Скрий всичко',
      hideHint: 'Показване само на тапета (Esc връща всичко)',
      show: 'Покажи всичко'
    },
    ca: {
      idleTime: 'Temps d’inactivitat',
      minutes: 'min',
      minutesHint: 'Minuts sense activitat abans de mostrar només el fons de pantalla',
      idleSwitch: 'Amaga-ho tot en estar inactiu',
      hide: 'Amaga-ho tot',
      hideHint: 'Mostra només el fons de pantalla (Esc ho torna tot)',
      show: 'Mostra-ho tot'
    },
    cs: {
      idleTime: 'Doba nečinnosti',
      minutes: 'min',
      minutesHint: 'Minuty bez aktivity, po kterých zůstane jen tapeta',
      idleSwitch: 'Při nečinnosti skrýt vše',
      hide: 'Skrýt vše',
      hideHint: 'Zobrazit jen tapetu (Esc vše vrátí)',
      show: 'Zobrazit vše'
    },
    de: {
      idleTime: 'Leerlaufzeit',
      minutes: 'Min.',
      minutesHint: 'Minuten ohne Aktivität, bis nur noch das Hintergrundbild zu sehen ist',
      idleSwitch: 'Bei Inaktivität alles ausblenden',
      hide: 'Alles ausblenden',
      hideHint: 'Nur das Hintergrundbild zeigen (Esc holt alles zurück)',
      show: 'Alles einblenden'
    },
    el: {
      idleTime: 'Χρόνος αδράνειας',
      minutes: 'λεπ.',
      minutesHint: 'Λεπτά χωρίς δραστηριότητα πριν μείνει μόνο η ταπετσαρία',
      idleSwitch: 'Απόκρυψη όλων κατά την αδράνεια',
      hide: 'Απόκρυψη όλων',
      hideHint: 'Μόνο η ταπετσαρία (το Esc επαναφέρει τα πάντα)',
      show: 'Εμφάνιση όλων'
    },
    es: {
      idleTime: 'Tiempo de inactividad',
      minutes: 'min',
      minutesHint: 'Minutos sin actividad antes de mostrar solo el fondo de pantalla',
      idleSwitch: 'Ocultar todo al estar inactivo',
      hide: 'Ocultar todo',
      hideHint: 'Mostrar solo el fondo de pantalla (Esc lo devuelve todo)',
      show: 'Mostrar todo'
    },
    fr: {
      idleTime: 'Délai d’inactivité',
      minutes: 'min',
      minutesHint: 'Minutes sans activité avant de n’afficher que le fond d’écran',
      idleSwitch: 'Tout masquer en cas d’inactivité',
      hide: 'Tout masquer',
      hideHint: 'N’afficher que le fond d’écran (Échap réaffiche tout)',
      show: 'Tout afficher'
    },
    hr: {
      idleTime: 'Vrijeme neaktivnosti',
      minutes: 'min',
      minutesHint: 'Minute bez aktivnosti prije nego što ostane samo pozadina',
      idleSwitch: 'Sakrij sve pri neaktivnosti',
      hide: 'Sakrij sve',
      hideHint: 'Prikaži samo pozadinu (Esc vraća sve)',
      show: 'Prikaži sve'
    },
    hu: {
      idleTime: 'Tétlenségi idő',
      minutes: 'perc',
      minutesHint: 'Ennyi perc tétlenség után csak a háttérkép látszik',
      idleSwitch: 'Minden elrejtése tétlenség esetén',
      hide: 'Minden elrejtése',
      hideHint: 'Csak a háttérkép (az Esc mindent visszahoz)',
      show: 'Minden megjelenítése'
    },
    id: {
      idleTime: 'Waktu diam',
      minutes: 'mnt',
      minutesHint: 'Menit tanpa aktivitas sebelum hanya wallpaper yang tampil',
      idleSwitch: 'Sembunyikan semua saat diam',
      hide: 'Sembunyikan semua',
      hideHint: 'Tampilkan hanya wallpaper (Esc mengembalikan semua)',
      show: 'Tampilkan semua'
    },
    it: {
      idleTime: 'Tempo di inattività',
      minutes: 'min',
      minutesHint: 'Minuti senza attività prima di mostrare solo lo sfondo',
      idleSwitch: 'Nascondi tutto quando inattivo',
      hide: 'Nascondi tutto',
      hideHint: 'Mostra solo lo sfondo (Esc riporta tutto)',
      show: 'Mostra tutto'
    },
    ja: {
      idleTime: 'アイドル時間',
      minutes: '分',
      minutesHint: '操作がないまま壁紙だけを表示するまでの分数',
      idleSwitch: '操作がないときはすべて隠す',
      hide: 'すべて隠す',
      hideHint: '壁紙だけを表示（Esc ですべて戻る）',
      show: 'すべて表示'
    },
    ko: {
      idleTime: '유휴 시간',
      minutes: '분',
      minutesHint: '활동이 없을 때 배경화면만 표시하기까지의 시간(분)',
      idleSwitch: '유휴 시 모두 숨기기',
      hide: '모두 숨기기',
      hideHint: '배경화면만 표시 (Esc로 모두 되돌리기)',
      show: '모두 표시'
    },
    nl: {
      idleTime: 'Inactiviteitstijd',
      minutes: 'min',
      minutesHint: 'Minuten zonder activiteit voordat alleen de achtergrond zichtbaar is',
      idleSwitch: 'Alles verbergen bij inactiviteit',
      hide: 'Alles verbergen',
      hideHint: 'Alleen de achtergrond tonen (Esc haalt alles terug)',
      show: 'Alles tonen'
    },
    no: {
      idleTime: 'Inaktiv tid',
      minutes: 'min',
      minutesHint: 'Minutter uten aktivitet før bare bakgrunnsbildet vises',
      idleSwitch: 'Skjul alt ved inaktivitet',
      hide: 'Skjul alt',
      hideHint: 'Vis bare bakgrunnsbildet (Esc henter alt tilbake)',
      show: 'Vis alt'
    },
    pl: {
      idleTime: 'Czas bezczynności',
      minutes: 'min',
      minutesHint: 'Minuty bez aktywności, po których zostaje tylko tapeta',
      idleSwitch: 'Ukryj wszystko przy bezczynności',
      hide: 'Ukryj wszystko',
      hideHint: 'Pokaż tylko tapetę (Esc przywraca wszystko)',
      show: 'Pokaż wszystko'
    },
    pt: {
      idleTime: 'Tempo ocioso',
      minutes: 'min',
      minutesHint: 'Minutos sem atividade até mostrar só o wallpaper',
      idleSwitch: 'Ocultar tudo quando ocioso',
      hide: 'Ocultar tudo',
      hideHint: 'Mostrar só o wallpaper (Esc mostra tudo de novo)',
      show: 'Mostrar tudo'
    },
    // Only what differs from pt
    'pt-pt': {
      idleTime: 'Tempo de inatividade',
      minutesHint: 'Minutos sem atividade até mostrar só a imagem de fundo',
      idleSwitch: 'Ocultar tudo quando inativo',
      hideHint: 'Mostrar só a imagem de fundo (Esc mostra tudo de novo)'
    },
    ro: {
      idleTime: 'Timp de inactivitate',
      minutes: 'min',
      minutesHint: 'Minute fără activitate până când rămâne doar imaginea de fundal',
      idleSwitch: 'Ascunde tot la inactivitate',
      hide: 'Ascunde tot',
      hideHint: 'Doar imaginea de fundal (Esc readuce tot)',
      show: 'Arată tot'
    },
    ru: {
      idleTime: 'Время бездействия',
      minutes: 'мин',
      minutesHint: 'Минуты без активности, после которых остаются только обои',
      idleSwitch: 'Скрывать всё при бездействии',
      hide: 'Скрыть всё',
      hideHint: 'Показать только обои (Esc возвращает всё)',
      show: 'Показать всё'
    },
    sk: {
      idleTime: 'Čas nečinnosti',
      minutes: 'min',
      minutesHint: 'Minúty bez aktivity, po ktorých zostane len tapeta',
      idleSwitch: 'Pri nečinnosti skryť všetko',
      hide: 'Skryť všetko',
      hideHint: 'Zobraziť len tapetu (Esc všetko vráti)',
      show: 'Zobraziť všetko'
    },
    sl: {
      idleTime: 'Čas nedejavnosti',
      minutes: 'min',
      minutesHint: 'Minute brez dejavnosti, preden ostane samo ozadje',
      idleSwitch: 'Ob nedejavnosti skrij vse',
      hide: 'Skrij vse',
      hideHint: 'Prikaži samo ozadje (Esc vrne vse)',
      show: 'Prikaži vse'
    },
    sv: {
      idleTime: 'Inaktiv tid',
      minutes: 'min',
      minutesHint: 'Minuter utan aktivitet innan bara bakgrundsbilden visas',
      idleSwitch: 'Dölj allt vid inaktivitet',
      hide: 'Dölj allt',
      hideHint: 'Visa bara bakgrundsbilden (Esc tar tillbaka allt)',
      show: 'Visa allt'
    },
    tr: {
      idleTime: 'Boşta kalma süresi',
      minutes: 'dk',
      minutesHint: 'Yalnızca duvar kâğıdı kalmadan önce etkinliksiz geçen dakika',
      idleSwitch: 'Boştayken her şeyi gizle',
      hide: 'Her şeyi gizle',
      hideHint: 'Yalnızca duvar kâğıdını göster (Esc her şeyi geri getirir)',
      show: 'Her şeyi göster'
    },
    uk: {
      idleTime: 'Час бездіяльності',
      minutes: 'хв',
      minutesHint: 'Хвилини без активності, після яких лишаються тільки шпалери',
      idleSwitch: 'Ховати все під час бездіяльності',
      hide: 'Сховати все',
      hideHint: 'Показати лише шпалери (Esc повертає все)',
      show: 'Показати все'
    },
    vi: {
      idleTime: 'Thời gian chờ',
      minutes: 'phút',
      minutesHint: 'Số phút không hoạt động trước khi chỉ còn hình nền',
      idleSwitch: 'Ẩn mọi thứ khi không hoạt động',
      hide: 'Ẩn mọi thứ',
      hideHint: 'Chỉ hiện hình nền (Esc để hiện lại tất cả)',
      show: 'Hiện mọi thứ'
    },
    'zh-cn': {
      idleTime: '空闲时间',
      minutes: '分钟',
      minutesHint: '无操作多少分钟后只显示壁纸',
      idleSwitch: '空闲时隐藏所有内容',
      hide: '隐藏所有内容',
      hideHint: '只显示壁纸（按 Esc 恢复全部）',
      show: '显示所有内容'
    },
    'zh-tw': {
      idleTime: '閒置時間',
      minutes: '分鐘',
      minutesHint: '無操作多少分鐘後只顯示桌布',
      idleSwitch: '閒置時隱藏所有內容',
      hide: '隱藏所有內容',
      hideHint: '只顯示桌布（按 Esc 恢復全部）',
      show: '顯示所有內容'
    }
  };

  // CasaOS keeps its language in localStorage.lang ('en_us', 'pt_br'…)
  function lang() {
    var c = String(localStorage.getItem('lang') || navigator.language || '').toLowerCase().replace(/_/g, '-');
    if (TEXT[c]) return c;
    var base = c.split('-')[0];
    if (base === 'zh') return /-(tw|hk|mo|hant)\b/.test(c) ? 'zh-tw' : 'zh-cn';
    if (base === 'pt') return /-pt\b/.test(c) ? 'pt-pt' : 'pt';
    if (base === 'nb' || base === 'nn') return 'no';
    return TEXT[base] ? base : 'en';
  }

  function t(key) {
    var l = lang();
    var v = TEXT[l][key];
    if (v === undefined && l === 'pt-pt') v = TEXT.pt[key];
    return v !== undefined ? v : TEXT.en[key];
  }

  // ---------------------------------------------------------------------------
  // Settings: { enabled, minutes }, in this browser. Hiding by hand isn't kept:
  // a reload always shows everything.
  // ---------------------------------------------------------------------------
  var cfg = load();

  function load() {
    var c = { enabled: true, minutes: 5 };
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
      if (typeof s.enabled === 'boolean') c.enabled = s.enabled;
      var m = Number(s.minutes);
      if (m >= 0.05 && m <= 1440) c.minutes = m;   // fractions only come from the tests
    } catch (e) { /* storage blocked or broken: the defaults */ }
    return c;
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* storage full or blocked */ }
  }

  // ---------------------------------------------------------------------------
  // What goes away, in order: the top bar, the dashboard in a wave from the top
  // left (sorted by where each item is on screen, so any layout works), then the
  // footer. What isn't listed goes with the dashboard at the end.
  // ---------------------------------------------------------------------------
  var HOME = '#app > :has(> .top-bar)';   // the dashboard root, on every CasaOS-UI layout
  var WAVE = '.search-bar, .swiper-container, .home-section > .is-flex, .home-section > .title-bar, .app-list > .handle, ' +
    '.side-bar .scroll-area > :not([class*="ps__rail"]), .side-bar > :not(.scroll-area)';
  var HIDE_MS = 450, SHOW_MS = 300;

  function shown(el) {
    return el && el.getClientRects().length > 0;
  }

  function items() {
    var home = document.querySelector(HOME);
    if (!home) return [];
    var wave = [].filter.call(home.querySelectorAll(WAVE), shown).map(function (el) {
      var r = el.getBoundingClientRect();
      return { el: el, at: r.top + r.left * 0.6 };   // a diagonal wave
    }).sort(function (a, b) { return a.at - b.at; }).map(function (x) { return x.el; });
    var top = home.querySelector('.top-bar'), foot = document.querySelector('#app > .base-bar');
    return [top].concat(wave, [foot]).filter(shown);
  }

  function reducedMotion() {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Delays for a cascade (forward when hiding, backward when showing); returns
  // how long the whole thing takes
  function cascade(list, hiding) {
    var pace = PACE[config.speed] || 1, n = list.length, each = Math.round((hiding ? HIDE_MS : SHOW_MS) * pace);
    var step = reducedMotion() || n < 2 || !config.cascade ? 0 : Math.min(hiding ? 45 : 25, (hiding ? 900 : 450) / (n - 1)) * pace;
    list.forEach(function (el, i) {
      el.style.setProperty('--idh-d', Math.round((hiding ? i : n - 1 - i) * step) + 'ms');
    });
    var total = Math.round((n - 1) * step);
    root.classList.toggle('idh-calm', reducedMotion());
    root.style.setProperty('--idh-total', total + 'ms');
    root.style.setProperty('--idh-each', (reducedMotion() ? 150 : each) + 'ms');
    return total + (reducedMotion() ? 150 : each);
  }

  // The frosted glass (backdrop-filter: the widgets', the app cards', a themed
  // top bar's ::before) only blurs the wallpaper behind it while none of its
  // ancestors is fading: an ancestor with opacity below 1 cuts it off, and the
  // blur would vanish during the fade. So the fade goes to the pieces of each
  // item: a box with glass inside hands it to its children (and to a glass
  // ::before/::after), the glass fades itself (its blur fades with it), the
  // rest fades whole. Marked once when hiding starts; nothing runs meanwhile.
  function glassy(cs) {
    var b = cs.backdropFilter || cs.webkitBackdropFilter;
    return !!b && b !== 'none';
  }

  function hasText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return true;
    return false;
  }

  function unmark() {
    [].forEach.call(document.querySelectorAll('[data-idh-fade], [data-idh-glass]'), function (el) {
      el.removeAttribute('data-idh-fade');
      el.removeAttribute('data-idh-glass');
    });
  }

  function markFades(list) {
    unmark();
    list.forEach(function (item) {
      var split = new Set();
      var split1 = function (el) {
        for (var p = el; p && p !== item.parentNode; p = p.parentNode) split.add(p);
      };
      [item].concat([].slice.call(item.querySelectorAll('*'))).forEach(function (el) {
        var pseudo = ['before', 'after'].filter(function (p) { return glassy(getComputedStyle(el, '::' + p)); });
        if (pseudo.length) {
          el.setAttribute('data-idh-glass', pseudo.join(' '));
          split1(el);
        }
        if (el !== item && glassy(getComputedStyle(el))) split1(el.parentNode);
      });
      // glass fades itself; only plain boxes around glass hand the fade down
      (function fade(el) {
        if (!split.has(el) || hasText(el) || glassy(getComputedStyle(el))) {
          el.setAttribute('data-idh-fade', '');
          return;
        }
        [].forEach.call(el.children, fade);
      })(item);
    });
  }

  // ---------------------------------------------------------------------------
  // Hiding and showing
  // ---------------------------------------------------------------------------
  var root = document.documentElement;
  var mode = null;          // null (everything shows), 'idle' or 'manual'
  var phase = null;         // the timer of the current animation step

  function hide(m) {
    if (mode) {               // already hidden (idle, then the switch): just the mode
      root.classList.remove('idh-idle', 'idh-manual');
      mode = m;
      root.classList.add('idh-' + m);
      syncSwitch();
      return;
    }
    mode = m;
    disarm();
    var a = document.activeElement;
    if (a && a !== document.body && a.closest && a.closest('#app') && a.blur) a.blur();   // keys mustn't type into what's hidden
    clearTimeout(phase);
    var list = items();
    markFades(list);
    var took = cascade(list, true);
    root.classList.add('idh-anim', 'idh-hidden', 'idh-' + m);
    syncSwitch();
    phase = setTimeout(raise, took);
  }

  // The wallpaper above everything, once the rest has gone: anything that wasn't
  // faded (a toast, another mod's popup, something new in CasaOS) stays covered
  function raise() {
    if (!mode) return;
    if (!root.classList.contains('lw-on')) {
      var bg = document.getElementById('background');
      if (bg) {
        var cs = getComputedStyle(bg);
        cover.style.backgroundImage = cs.backgroundImage;
        cover.style.backgroundSize = cs.backgroundSize;
        cover.style.backgroundPosition = cs.backgroundPosition;
        cover.style.backgroundRepeat = cs.backgroundRepeat;
        cover.style.backgroundColor = cs.backgroundColor;
      }
    }
    root.classList.add('idh-raised');
  }

  function show() {
    if (!mode) return;
    mode = null;
    clearTimeout(phase);
    root.classList.remove('idh-raised');   // first, while the rest is still invisible
    var took = cascade(items(), false);
    root.classList.add('idh-anim');
    root.classList.remove('idh-hidden', 'idh-idle', 'idh-manual');
    syncSwitch();
    phase = setTimeout(function () {
      root.classList.remove('idh-anim');
      unmark();
    }, took + 50);
    last = Date.now();
    arm();
  }

  // ---------------------------------------------------------------------------
  // Idle: one timer, armed for the whole idle time and checked when it fires
  // (activity only stores the time; no per-frame work, no polling)
  // ---------------------------------------------------------------------------
  var last = Date.now(), timer = null, lastX = -1, lastY = -1;

  function limit() { return cfg.minutes * 60000; }

  function disarm() {
    clearTimeout(timer);
    timer = null;
  }

  function arm(ms) {
    disarm();
    if (!cfg.enabled || mode) return;
    timer = setTimeout(tick, ms == null ? limit() : ms);
  }

  function tick() {
    timer = null;
    if (!cfg.enabled || mode) return;
    var left = last + limit() - Date.now();
    if (left > 250) return arm(left);
    if (blocked()) {
      last = Date.now();   // the whole time again once it's free
      return arm();
    }
    hide('idle');
  }

  // Media keys (play/pause, next, volume) control the music, not the dashboard:
  // they neither count as activity nor wake it
  var MEDIA_KEY = /^(Media|AudioVolume)/;

  function activity(e) {
    if (e.type === 'keydown' && MEDIA_KEY.test(e.key)) return;
    last = Date.now();
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, activity, { capture: true, passive: true });
  });
  // Only real moves: Chrome also sends one when the page changes under a still cursor
  window.addEventListener('mousemove', function (e) {
    if (e.screenX === lastX && e.screenY === lastY) return;
    lastX = e.screenX;
    lastY = e.screenY;
    last = Date.now();
    if (config.wakeOnMove && e.isTrusted && mode === 'idle') show();   // the setting: a move wakes it too (only after idle)
  }, { capture: true, passive: true });

  function onDashboard() {
    return /^#?\/?(\?.*)?$/.test(location.hash) && !!document.querySelector(HOME);
  }

  function visible(el) {
    if (el.hidden || !el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function dialogOpen() {
    return [].some.call(document.querySelectorAll('.modal, [aria-modal="true"], #lw-panel'), visible);
  }

  // Never while something is being used: a menu, a dialog, the Live Wallpapers
  // panel, an app window (App Windows: what's done inside it doesn't reach the
  // page), a text field, or another page (login…)
  function blocked() {
    if (!onDashboard()) return true;
    if (document.querySelector('.dropdown.is-active')) return true;
    if (document.documentElement.classList.contains('cw-active')) return true;
    if (dialogOpen()) return true;
    var a = document.activeElement;
    if (a && (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' ||
      (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|reset|color|file|image)$/i.test(a.type)))) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // Waking up. Hidden while idle, only a click or a key brings everything back,
  // and that click or key does nothing else (no app opens, the wallpaper gets no
  // click). These listeners are on window in the capture phase, so they run
  // before any page listener (Live Wallpapers listens on document). Mouse moves
  // are never stopped. Synthetic events (from scripts) are ignored.
  // ---------------------------------------------------------------------------
  var swallowing = false, swallowKey = null;

  window.addEventListener('pointerdown', function (e) {
    if (!e.isTrusted) return;
    swallowing = false;
    if (mode !== 'idle') return;
    swallowing = true;
    e.stopPropagation();
    show();
  }, true);

  ['mousedown', 'mouseup', 'pointerup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'touchend'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!swallowing || !e.isTrusted) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }, { capture: true, passive: false });
  });
  window.addEventListener('touchstart', function (e) {
    if (swallowing && e.isTrusted) e.stopPropagation();
  }, { capture: true, passive: true });

  var MODIFIER = /^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock|ScrollLock|Fn|Hyper|Super)$/;

  window.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    swallowing = false;
    if (mode === 'idle') {
      if (MODIFIER.test(e.key) || MEDIA_KEY.test(e.key)) return;   // Alt+Tab, media keys don't wake it
      swallowKey = e.code;
      e.stopPropagation();
      // shortcuts keep working (Ctrl+F, F5…); anything else only wakes
      if (!(e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key))) e.preventDefault();
      show();
    } else if (mode === 'manual' && e.key === 'Escape') {
      swallowKey = e.code;
      e.stopPropagation();
      e.preventDefault();
      show();
    }
  }, true);
  ['keypress', 'keyup'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!swallowKey || e.code !== swallowKey) return;
      e.stopPropagation();
      e.preventDefault();
      if (type === 'keyup') swallowKey = null;
    }, true);
  });

  // ---------------------------------------------------------------------------
  // Page pieces: the copy of a static wallpaper, the layer that takes every
  // click while hidden (so nothing invisible can be clicked; Live Wallpapers
  // forwards what lands on it to the wallpaper) and the switch in the top bar
  // ---------------------------------------------------------------------------
  function h(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  var cover = h('div');
  cover.id = 'idh-cover';
  var catcher = h('div');
  catcher.id = 'idh-catch';
  cover.setAttribute('aria-hidden', 'true');
  catcher.setAttribute('aria-hidden', 'true');

  var sw = h('div');
  sw.id = 'idh-switch';
  sw.hidden = true;
  sw.innerHTML = '<label class="idh-toggle"><span class="icon idh-icon" aria-hidden="true"><i class="casa casa-eye-off-outline"></i></span>' +
    '<input type="checkbox" role="switch"><span class="idh-track" aria-hidden="true"><span class="idh-knob"></span></span></label>';
  var swInput = sw.querySelector('input'), swLabel = sw.querySelector('label');
  swInput.addEventListener('change', function () {
    if (swInput.checked) hide('manual');
    else show();
  });

  function place() {
    if (!document.body) return;
    [cover, catcher, sw].forEach(function (el) {
      if (el.parentNode !== document.body) document.body.appendChild(el);
    });
  }

  function syncSwitch() {
    var on = !!mode;
    if (swInput.checked !== on) swInput.checked = on;
    var label = on ? t('show') : t('hide'), title = on ? t('show') : t('hideHint');
    if (swInput.getAttribute('aria-label') !== label) swInput.setAttribute('aria-label', label);
    if (swLabel.title !== title) swLabel.title = title;
    var l = lang();
    if (sw.lang !== l) sw.lang = l;
  }

  // The switch takes the color of the top bar's own icons (light, dark, themed)
  var fg = '';
  function syncColor() {
    var icon = document.querySelector('.top-bar .navbar-brand .icon');
    if (!icon || mode) return;
    var c = getComputedStyle(icon).color;
    if (c && c !== fg) {
      fg = c;
      sw.style.setProperty('--idh-fg', c);
    }
  }

  // ---------------------------------------------------------------------------
  // The settings row, in the CasaOS settings dropdown after "Wallpaper", in the
  // markup of CasaOS's own rows (a Buefy switch, a small field for the minutes)
  // ---------------------------------------------------------------------------
  var ROW_CLASS = 'is-flex is-align-items-center mb-1 _is-large _box hover-effect _is-radius pr-2 mr-4 ml-4';
  var row = null, rowLabel, rowField, rowUnit, rowSwitch;

  function buildRow() {
    row = h('div', ROW_CLASS);
    row.id = 'idh-row';
    row.innerHTML =
      '<div class="is-flex is-align-items-center is-flex-grow-1 _is-normal idh-name">' +
      '<span class="icon is-20 mr-1 ml-2"><i class="casa casa-time-outline is-size-5"></i></span><span class="idh-label"></span></div>' +
      '<div class="control idh-minutes"><input class="input is-small" type="number" inputmode="numeric" min="1" max="1440" step="1"></div>' +
      '<span class="idh-unit"></span>' +
      '<div class="ml-2"><div class="field"><label class="switch is-flex-direction-row-reverse mr-0 _small">' +
      '<input type="checkbox"><span class="check is-dark"></span></label></div></div>';
    rowLabel = row.querySelector('.idh-label');
    rowField = row.querySelector('.idh-minutes input');
    rowUnit = row.querySelector('.idh-unit');
    rowSwitch = row.querySelector('.switch input');
    rowSwitch.addEventListener('change', function () {
      cfg.enabled = rowSwitch.checked;
      save();
      last = Date.now();
      arm();
      syncRow();
    });
    rowField.addEventListener('change', function () {
      var m = Math.round(Number(rowField.value));
      if (rowField.value.trim() !== '' && isFinite(m)) {
        cfg.minutes = Math.min(1440, Math.max(1, m));
        save();
        last = Date.now();
        arm();
      }
      rowField.value = '';   // shows the saved value again (also after an invalid one)
      syncRow();
    });
    rowField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') rowField.blur();
    });
  }

  function injectRow() {
    var drop = document.querySelector('.top-bar .dropdown-content ._footer');
    var wall = document.querySelector('.top-bar .dropdown-content ._box .casa-wallpaper-outline');
    var anchor = wall && wall.closest('._box');
    if (!anchor && !drop) return;
    if (!row) buildRow();
    var parent = anchor ? anchor.parentNode : drop.parentNode;
    var right = anchor ? row.parentNode === parent && !!(anchor.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)
      : row.parentNode === parent && !!(row.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!right) parent.insertBefore(row, anchor ? anchor.nextSibling : drop);
    syncRow();
  }

  function syncRow() {
    if (!row) return;
    var set = function (el, prop, v) { if (el[prop] !== v) el[prop] = v; };
    set(rowLabel, 'textContent', t('idleTime'));
    set(rowUnit, 'textContent', t('minutes'));
    set(rowSwitch, 'checked', cfg.enabled);
    set(rowField, 'disabled', !cfg.enabled);
    if (document.activeElement !== rowField) set(rowField, 'value', String(Math.max(1, Math.round(cfg.minutes))));
    if (rowField.title !== t('minutesHint')) {
      rowField.title = t('minutesHint');
      rowField.setAttribute('aria-label', t('minutesHint'));
    }
    var sl = rowSwitch.parentNode;
    if (sl.title !== t('idleSwitch')) {
      sl.title = t('idleSwitch');
      rowSwitch.setAttribute('aria-label', t('idleSwitch'));
    }
    row.classList.toggle('idh-off', !cfg.enabled);
    var l = lang();
    if (row.lang !== l) row.lang = l;
  }

  // ---------------------------------------------------------------------------
  // Keeping up with CasaOS: Vue re-renders, routes (login, logout), dialogs that
  // open while hidden, settings changed in another tab
  // ---------------------------------------------------------------------------
  function refresh() {
    place();
    var dash = onDashboard();
    if (sw.hidden === dash) sw.hidden = !dash;
    if (mode && !dash) show();
    else if (mode === 'idle' && dialogOpen()) show();   // a CasaOS dialog wants attention
    injectRow();
    syncSwitch();
    syncColor();
    if (cfg.enabled && !mode && !timer) arm();
  }

  var scheduled = false;
  function soon() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; refresh(); }, 150);
  }
  new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', soon);
  window.addEventListener('storage', function (e) {
    if (e.key !== STORE) return;
    cfg = load();
    syncRow();
    last = Date.now();
    arm();
  });

  if (document.body) refresh();
  else document.addEventListener('DOMContentLoaded', refresh);
  loadConfig();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadConfig(); });
  console.info(TAG, 'loaded');

  // For other mods, the tests and debugging
  window.CasaIdleHide = {
    hide: function () { hide('manual'); },
    show: show,
    get mode() { return mode; },
    get settings() { return { enabled: cfg.enabled, minutes: cfg.minutes }; }
  };
})();

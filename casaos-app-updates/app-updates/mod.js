/*
 * App Updates — a CasaMOD mod for CasaOS.
 *
 * A small badge on the icon of each app that has an update in its app store,
 * as CasaOS itself knows it (GET /v2/app_management/compose, its
 * update_available: what "Check then update" in the app's ⋯ menu installs).
 * The badge opens that menu. Apps not from a store, or on an image tag of
 * their own, never get one: CasaOS doesn't track their updates.
 */
(function () {
  'use strict';

  if (window.__appUpdatesMod) return;
  window.__appUpdatesMod = true;

  var TAG = '[App Updates]';
  var EVERY = 30 * 60 * 1000;   // CasaOS caches its answer: asking more often brings nothing new

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default)
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: { update: 'Update available' },
    ar: { update: 'يتوفر تحديث' },
    be: { update: 'Ёсць абнаўленне' },
    bg: { update: 'Налична е актуализация' },
    ca: { update: 'Actualització disponible' },
    cs: { update: 'K dispozici je aktualizace' },
    de: { update: 'Update verfügbar' },
    el: { update: 'Διαθέσιμη ενημέρωση' },
    es: { update: 'Actualización disponible' },
    fr: { update: 'Mise à jour disponible' },
    hr: { update: 'Dostupno je ažuriranje' },
    hu: { update: 'Frissítés érhető el' },
    id: { update: 'Pembaruan tersedia' },
    it: { update: 'Aggiornamento disponibile' },
    ja: { update: 'アップデートがあります' },
    ko: { update: '업데이트 가능' },
    nl: { update: 'Update beschikbaar' },
    no: { update: 'Oppdatering tilgjengelig' },
    pl: { update: 'Dostępna aktualizacja' },
    pt: { update: 'Atualização disponível' },
    'pt-pt': {},
    ro: { update: 'Actualizare disponibilă' },
    ru: { update: 'Доступно обновление' },
    sk: { update: 'K dispozícii je aktualizácia' },
    sl: { update: 'Na voljo je posodobitev' },
    sv: { update: 'Uppdatering tillgänglig' },
    tr: { update: 'Güncelleme mevcut' },
    uk: { update: 'Доступне оновлення' },
    vi: { update: 'Có bản cập nhật' },
    'zh-cn': { update: '有可用更新' },
    'zh-tw': { update: '有可用的更新' }
  };

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

  function casa() {
    try { return document.querySelector('#app').__vue__ || null; } catch (e) { return null; }
  }
  // CasaOS's own words for its menu entry, in its language
  function casaText(key) {
    var vm = casa();
    try {
      var v = vm && vm.$t(key);
      if (typeof v === 'string' && v) return v;
    } catch (e) { /* no translations: English */ }
    return key;
  }
  function token() {
    var vm = casa();
    return (vm && vm.$store && vm.$store.state.access_token) || localStorage.getItem('access_token') || '';
  }

  // ---------------------------------------------------------------------------
  // Which apps have an update (app name in CasaOS: true)
  // ---------------------------------------------------------------------------
  var updates = {}, at = 0, busy = false;
  function read() {
    if (busy || document.hidden || !token()) return;
    busy = true;
    fetch('/v2/app_management/compose', { headers: { Authorization: token(), Accept: 'application/json' }, credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('CasaOS ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var data = (j && j.data) || {}, next = {};
        Object.keys(data).forEach(function (id) { if (data[id] && data[id].update_available === true) next[id] = true; });
        updates = next;
        at = Date.now();
        paint();
      })
      .catch(function (e) { console.warn(TAG, e.message); })
      .then(function () { busy = false; });
  }

  // The badge: on the top-left corner of the app's icon
  var ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 9.5V2.8M2.9 5.6L6 2.5l3.1 3.1" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function paint() {
    var tip = t('update') + ' · ⋯ → ' + casaText('Check then update');
    [].forEach.call(document.querySelectorAll('[id^="app-"]'), function (el) {
      var host = el.querySelector('.cards-content .is-relative');
      if (!host) return;
      var badge = host.querySelector(':scope > .aup-badge');
      if (!updates[el.id.slice(4)]) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'aup-badge';
        badge.innerHTML = ARROW;
        host.appendChild(badge);
      }
      badge.title = tip;
      badge.setAttribute('aria-label', tip);
    });
  }

  // A click on the badge opens the app's ⋯ menu (where "Check then update" is),
  // not the app; the list is read again after the update may have run
  document.addEventListener('click', function (e) {
    var badge = e.target.closest && e.target.closest('.aup-badge');
    if (!badge) return;
    e.preventDefault();
    e.stopPropagation();
    var card = badge.closest('[id^="app-"]');
    var menu = card && (card.querySelector('.app-card-drop [role="button"]') || card.querySelector('.app-card-drop .dropdown-trigger'));
    if (menu) menu.click();
    setTimeout(read, 90 * 1000);
  }, true);

  // Read again every half hour while CasaOS is in sight, and soon after
  // CasaOS draws its cards again (an app installed, updated or removed)
  setInterval(function () { if (Date.now() - at >= EVERY) read(); }, 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - at >= EVERY) read(); });
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      if (!document.querySelector('[id^="app-"] .app-card')) return;
      if (!at || Date.now() - at > 60 * 1000) read();
      else paint();
    }, 500);
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(function () { if (!at) read(); }, 2000);   // the first reading, after CasaOS's own requests at load
  console.info(TAG, 'loaded');
})();

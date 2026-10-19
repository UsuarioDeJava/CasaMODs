/*
 * App Windows — a CasaMOD mod for CasaOS.
 *
 * The apps open in windows inside the CasaOS tab instead of new tabs, as on a
 * desktop: a slim bar on top (the app's icon and title; open in a new tab,
 * minimize, maximize/restore, close), dragged by its bar and resized by its
 * edges and corners, below the CasaOS top bar. A minimized app keeps running
 * (its music keeps playing in this tab); its icon on the dashboard brings it
 * back. Size and place are kept per app. Files and the App Store, CasaOS's own
 * panels, become windows too.
 *
 * A window is an iframe that never moves in the page (moving an iframe in the
 * DOM reloads it): which window is on top is only its z-index.
 */
(function () {
  'use strict';

  if (window.__appWindowsMod || window.top !== window) return;
  window.__appWindowsMod = true;

  var TAG = '[App Windows]';
  var STORE = 'casamod-app-windows';
  // Above the dashboard and CasaOS's top bar (20), below its dialogs (40)
  var Z = 21, ZMAX = 29;
  var BAR = 34, MINW = 260, MINH = 160;

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default)
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: {
      newTab: 'Open in a new tab', minimize: 'Minimize', maximize: 'Maximize', restore: 'Restore', close: 'Close', more: 'More',
      alwaysTab: 'Always open in a new tab', tabHint: 'Blank, or "refused to connect"? This app doesn\'t allow windows: open it in a new tab.'
    },
    ar: {
      newTab: 'فتح في علامة تبويب جديدة', minimize: 'تصغير', maximize: 'تكبير', restore: 'استعادة', close: 'إغلاق', more: 'المزيد',
      alwaysTab: 'الفتح دائمًا في علامة تبويب جديدة',
      tabHint: 'صفحة فارغة أو "رُفض الاتصال"؟ هذا التطبيق لا يسمح بالنوافذ: افتحه في علامة تبويب جديدة.'
    },
    be: {
      newTab: 'Адкрыць у новай укладцы', minimize: 'Згарнуць', maximize: 'Разгарнуць', restore: 'Аднавіць', close: 'Закрыць', more: 'Яшчэ',
      alwaysTab: 'Заўсёды адкрываць у новай укладцы',
      tabHint: 'Пуста або «адмоўлена ў злучэнні»? Гэта праграма не дазваляе вокны: адкрыйце яе ў новай укладцы.'
    },
    bg: {
      newTab: 'Отвори в нов раздел', minimize: 'Минимизирай', maximize: 'Максимизирай', restore: 'Възстанови', close: 'Затвори', more: 'Още',
      alwaysTab: 'Винаги отваряй в нов раздел',
      tabHint: 'Празно или „връзката е отказана“? Това приложение не позволява прозорци: отворете го в нов раздел.'
    },
    ca: {
      newTab: 'Obre en una pestanya nova', minimize: 'Minimitza', maximize: 'Maximitza', restore: 'Restaura', close: 'Tanca', more: 'Més',
      alwaysTab: 'Obre sempre en una pestanya nova',
      tabHint: 'En blanc o «connexió rebutjada»? Aquesta app no permet finestres: obre-la en una pestanya nova.'
    },
    cs: {
      newTab: 'Otevřít na nové kartě', minimize: 'Minimalizovat', maximize: 'Maximalizovat', restore: 'Obnovit', close: 'Zavřít', more: 'Další',
      alwaysTab: 'Vždy otevírat na nové kartě',
      tabHint: 'Prázdné nebo „připojení odmítnuto“? Tato aplikace nepovoluje okna: otevřete ji na nové kartě.'
    },
    de: {
      newTab: 'In neuem Tab öffnen', minimize: 'Minimieren', maximize: 'Maximieren', restore: 'Wiederherstellen', close: 'Schließen', more: 'Mehr',
      alwaysTab: 'Immer in neuem Tab öffnen',
      tabHint: 'Leer oder „Verbindung abgelehnt“? Diese App erlaubt keine Fenster: Öffne sie in einem neuen Tab.'
    },
    el: {
      newTab: 'Άνοιγμα σε νέα καρτέλα', minimize: 'Ελαχιστοποίηση', maximize: 'Μεγιστοποίηση', restore: 'Επαναφορά', close: 'Κλείσιμο',
      more: 'Περισσότερα', alwaysTab: 'Άνοιγμα πάντα σε νέα καρτέλα',
      tabHint: 'Κενό ή «άρνηση σύνδεσης»; Αυτή η εφαρμογή δεν επιτρέπει παράθυρα: ανοίξτε την σε νέα καρτέλα.'
    },
    es: {
      newTab: 'Abrir en una pestaña nueva', minimize: 'Minimizar', maximize: 'Maximizar', restore: 'Restaurar', close: 'Cerrar', more: 'Más',
      alwaysTab: 'Abrir siempre en una pestaña nueva',
      tabHint: '¿En blanco o «rechazó la conexión»? Esta app no permite ventanas: ábrela en una pestaña nueva.'
    },
    fr: {
      newTab: 'Ouvrir dans un nouvel onglet', minimize: 'Réduire', maximize: 'Agrandir', restore: 'Restaurer', close: 'Fermer', more: 'Plus',
      alwaysTab: 'Toujours ouvrir dans un nouvel onglet',
      tabHint: 'Page blanche ou « connexion refusée » ? Cette appli n\'accepte pas les fenêtres : ouvrez-la dans un nouvel onglet.'
    },
    hr: {
      newTab: 'Otvori u novoj kartici', minimize: 'Smanji', maximize: 'Povećaj', restore: 'Vrati', close: 'Zatvori', more: 'Više',
      alwaysTab: 'Uvijek otvaraj u novoj kartici',
      tabHint: 'Prazno ili „veza odbijena”? Ova aplikacija ne dopušta prozore: otvorite je u novoj kartici.'
    },
    hu: {
      newTab: 'Megnyitás új lapon', minimize: 'Kis méret', maximize: 'Teljes méret', restore: 'Előző méret', close: 'Bezárás', more: 'Több',
      alwaysTab: 'Mindig új lapon nyíljon',
      tabHint: 'Üres vagy „a kapcsolat elutasítva”? Ez az alkalmazás nem engedi az ablakokat: nyisd meg új lapon.'
    },
    id: {
      newTab: 'Buka di tab baru', minimize: 'Perkecil', maximize: 'Perbesar', restore: 'Pulihkan', close: 'Tutup', more: 'Lainnya',
      alwaysTab: 'Selalu buka di tab baru', tabHint: 'Kosong atau "koneksi ditolak"? Aplikasi ini tidak mengizinkan jendela: buka di tab baru.'
    },
    it: {
      newTab: 'Apri in una nuova scheda', minimize: 'Riduci a icona', maximize: 'Ingrandisci', restore: 'Ripristina', close: 'Chiudi',
      more: 'Altro', alwaysTab: 'Apri sempre in una nuova scheda',
      tabHint: 'Pagina bianca o "connessione rifiutata"? Questa app non consente le finestre: aprila in una nuova scheda.'
    },
    ja: {
      newTab: '新しいタブで開く', minimize: '最小化', maximize: '最大化', restore: '元に戻す', close: '閉じる', more: 'その他', alwaysTab: '常に新しいタブで開く',
      tabHint: '真っ白、または「接続が拒否されました」？ このアプリはウィンドウ表示を許可していません。新しいタブで開いてください。'
    },
    ko: {
      newTab: '새 탭에서 열기', minimize: '최소화', maximize: '최대화', restore: '복원', close: '닫기', more: '더 보기', alwaysTab: '항상 새 탭에서 열기',
      tabHint: '빈 화면이거나 "연결이 거부됨"인가요? 이 앱은 창을 허용하지 않습니다. 새 탭에서 여세요.'
    },
    nl: {
      newTab: 'Openen in nieuw tabblad', minimize: 'Minimaliseren', maximize: 'Maximaliseren', restore: 'Herstellen', close: 'Sluiten',
      more: 'Meer', alwaysTab: 'Altijd in een nieuw tabblad openen',
      tabHint: 'Leeg of "verbinding geweigerd"? Deze app staat geen vensters toe: open hem in een nieuw tabblad.'
    },
    no: {
      newTab: 'Åpne i ny fane', minimize: 'Minimer', maximize: 'Maksimer', restore: 'Gjenopprett', close: 'Lukk', more: 'Mer',
      alwaysTab: 'Åpne alltid i ny fane', tabHint: 'Tomt eller «tilkobling avvist»? Denne appen tillater ikke vinduer: åpne den i en ny fane.'
    },
    pl: {
      newTab: 'Otwórz w nowej karcie', minimize: 'Minimalizuj', maximize: 'Maksymalizuj', restore: 'Przywróć', close: 'Zamknij', more: 'Więcej',
      alwaysTab: 'Zawsze otwieraj w nowej karcie',
      tabHint: 'Pusto albo „odmowa połączenia”? Ta aplikacja nie pozwala na okna: otwórz ją w nowej karcie.'
    },
    pt: {
      newTab: 'Abrir em nova aba', minimize: 'Minimizar', maximize: 'Maximizar', restore: 'Restaurar', close: 'Fechar', more: 'Mais',
      alwaysTab: 'Sempre abrir em nova aba', tabHint: 'Em branco ou "recusou a conexão"? Este app não permite janelas: abra em uma nova aba.'
    },
    'pt-pt': {
      newTab: 'Abrir num novo separador', alwaysTab: 'Abrir sempre num novo separador',
      tabHint: 'Em branco ou "recusou a ligação"? Esta aplicação não permite janelas: abra-a num novo separador.'
    },
    ro: {
      newTab: 'Deschide într-o filă nouă', minimize: 'Minimizează', maximize: 'Maximizează', restore: 'Restabilește', close: 'Închide',
      more: 'Mai mult', alwaysTab: 'Deschide mereu într-o filă nouă',
      tabHint: 'Gol sau „conexiune refuzată”? Această aplicație nu permite ferestre: deschide-o într-o filă nouă.'
    },
    ru: {
      newTab: 'Открыть в новой вкладке', minimize: 'Свернуть', maximize: 'Развернуть', restore: 'Восстановить', close: 'Закрыть', more: 'Ещё',
      alwaysTab: 'Всегда открывать в новой вкладке',
      tabHint: 'Пусто или «отказано в подключении»? Это приложение не разрешает окна: откройте его в новой вкладке.'
    },
    sk: {
      newTab: 'Otvoriť na novej karte', minimize: 'Minimalizovať', maximize: 'Maximalizovať', restore: 'Obnoviť', close: 'Zavrieť', more: 'Viac',
      alwaysTab: 'Vždy otvárať na novej karte',
      tabHint: 'Prázdne alebo „pripojenie odmietnuté“? Táto aplikácia nepovoľuje okná: otvorte ju na novej karte.'
    },
    sl: {
      newTab: 'Odpri v novem zavihku', minimize: 'Pomanjšaj', maximize: 'Povečaj', restore: 'Obnovi', close: 'Zapri', more: 'Več',
      alwaysTab: 'Vedno odpri v novem zavihku',
      tabHint: 'Prazno ali »povezava zavrnjena«? Ta aplikacija ne dovoli oken: odprite jo v novem zavihku.'
    },
    sv: {
      newTab: 'Öppna i ny flik', minimize: 'Minimera', maximize: 'Maximera', restore: 'Återställ', close: 'Stäng', more: 'Mer',
      alwaysTab: 'Öppna alltid i ny flik',
      tabHint: 'Tomt eller ”anslutningen nekades”? Den här appen tillåter inte fönster: öppna den i en ny flik.'
    },
    tr: {
      newTab: 'Yeni sekmede aç', minimize: 'Simge durumuna küçült', maximize: 'Ekranı kapla', restore: 'Geri yükle', close: 'Kapat',
      more: 'Daha fazla', alwaysTab: 'Her zaman yeni sekmede aç',
      tabHint: 'Boş mu, yoksa "bağlantı reddedildi" mi? Bu uygulama pencereye izin vermiyor: yeni sekmede açın.'
    },
    uk: {
      newTab: 'Відкрити в новій вкладці', minimize: 'Згорнути', maximize: 'Розгорнути', restore: 'Відновити', close: 'Закрити', more: 'Більше',
      alwaysTab: 'Завжди відкривати в новій вкладці',
      tabHint: 'Порожньо або «відмовлено в з’єднанні»? Цей застосунок не дозволяє вікна: відкрийте його в новій вкладці.'
    },
    vi: {
      newTab: 'Mở trong thẻ mới', minimize: 'Thu nhỏ', maximize: 'Phóng to', restore: 'Khôi phục', close: 'Đóng', more: 'Thêm',
      alwaysTab: 'Luôn mở trong thẻ mới',
      tabHint: 'Trống hoặc "từ chối kết nối"? Ứng dụng này không cho phép mở trong cửa sổ: hãy mở trong thẻ mới.'
    },
    'zh-cn': {
      newTab: '在新标签页中打开', minimize: '最小化', maximize: '最大化', restore: '还原', close: '关闭', more: '更多', alwaysTab: '总是在新标签页中打开',
      tabHint: '空白，或显示“拒绝连接”？此应用不允许在窗口中打开：请在新标签页中打开。'
    },
    'zh-tw': {
      newTab: '在新分頁中開啟', minimize: '最小化', maximize: '最大化', restore: '還原', close: '關閉', more: '更多', alwaysTab: '總是在新分頁中開啟',
      tabHint: '空白，或顯示「拒絕連線」？此應用程式不允許在視窗中開啟：請在新分頁中開啟。'
    }
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

  // ---------------------------------------------------------------------------
  // Settings per app (by its CasaOS name), in this browser:
  // { rect: {x, y, w, h} (fractions of the area), max, tab (always a new tab), https (port) }
  // ---------------------------------------------------------------------------
  var cfg = load();
  function load() {
    var c;
    try { c = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { c = {}; }
    if (!c.apps || typeof c.apps !== 'object') c.apps = {};
    return c;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* storage full or blocked */ }
  }
  if (!(cfg.v >= 2)) {
    ['Files', 'App Store'].forEach(function (n) { if (cfg.apps[n]) delete cfg.apps[n].rect; });
    cfg.v = 2;
    save();
  }
  function appCfg(name) { return cfg.apps[name] || (cfg.apps[name] = {}); }
  function wcfg(w) { return appCfg(w.base || w.name); }

  var ICONS = {
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    tab: '<path d="M14 4h6v6M20 4l-9 9" fill="none"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none"/>',
    min: '<path d="M5 12h14" fill="none"/>',
    max: '<rect x="5" y="5" width="14" height="14" rx="1.5" fill="none"/>',
    restore: '<rect x="4.5" y="8.5" width="11" height="11" rx="1.5" fill="none"/><path d="M8.5 8.5V5.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3" fill="none"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" fill="none"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // ---------------------------------------------------------------------------
  // The windows: { kind: 'app' | 'panel', name, title, icon, url, el (app) or
  // root (a CasaOS panel), frame, min, max }, the topmost last
  // ---------------------------------------------------------------------------
  var wins = [];

  function find(name) {
    for (var i = 0; i < wins.length; i++) if (wins[i].name === name) return wins[i];
    return null;
  }
  function box(w) { return w.kind === 'panel' ? w.root : w.el; }
  function topmost() {
    for (var i = wins.length - 1; i >= 0; i--) if (!wins[i].min) return wins[i];
    return null;
  }

  // Where windows go: the whole tab, over CasaOS's top bar too (maximized is
  // the whole tab; with the browser in full screen, the whole screen)
  function area() {
    return { x: 0, y: 0, w: window.innerWidth, h: Math.max(MINH, window.innerHeight) };
  }
  // A phone: windows always fill the area
  function narrow() { return window.innerWidth < 640; }

  // Which window is on top: only z-index (the windows never move in the page)
  function stack() {
    var top = topmost();
    wins.forEach(function (w, i) {
      var b = box(w);
      b.style.setProperty('z-index', String(Math.min(ZMAX, Z + i)), 'important');
      b.classList.toggle('cw-top', w === top);
    });
    document.documentElement.classList.toggle('cw-active', !!top);   // for other mods (Idle Hide): a window is in use
    mark();
    keepOpen();
  }
  function focus(w) {
    var i = wins.indexOf(w);
    if (i < 0) return;
    if (i !== wins.length - 1) {
      wins.splice(i, 1);
      wins.push(w);
    }
    stack();
  }

  // Size and place: the app's own (fractions of the area), else centered, a
  // bit lower and to the right for each window already open
  function place(w) {
    var a = area(), b = box(w), c = wcfg(w), full = w.max || narrow(), r;
    if (full) r = { x: a.x, y: a.y, w: a.w, h: a.h };
    else if (c.rect) r = { x: a.x + c.rect.x * a.w, y: a.y + c.rect.y * a.h, w: c.rect.w * a.w, h: c.rect.h * a.h };
    else {
      var n = wins.filter(function (o) { return o !== w && !o.min; }).length % 6;
      r = { w: Math.min(a.w - 40, Math.max(MINW, a.w * 0.72)), h: Math.min(a.h - 30, Math.max(MINH, a.h * 0.8)) };
      r.x = a.x + (a.w - r.w) / 2 + n * 28;
      r.y = a.y + (a.h - r.h) / 3 + n * 28;
    }
    if (!full) r = fit(clamp(r, a), a);
    put(b, r, true);
    b.classList.toggle('cw-max', full);
    b.classList.toggle('cw-narrow', narrow());
    var mx = b.querySelector('.cw-bar [data-cw="max"]');
    if (mx) {
      mx.innerHTML = icon(w.max ? 'restore' : 'max');
      mx.title = w.max ? t('restore') : t('maximize');
      mx.hidden = narrow();
    }
  }

  // A window's place, over any stylesheet (CasaOS's panels are Bulma modals,
  // whose fixed inset of 0 would win over a plain inline style)
  // measure: where it really lands is checked (Files sits inside CasaOS's page,
  // where a transformed ancestor would make "fixed" relative to that ancestor)
  // and the difference kept for the drags that follow
  function put(b, r, measure) {
    var st = b.style, off = b.__cwOff || { x: 0, y: 0 };
    st.setProperty('left', Math.round(r.x - off.x) + 'px', 'important');
    st.setProperty('top', Math.round(r.y - off.y) + 'px', 'important');
    st.setProperty('width', Math.round(r.w) + 'px', 'important');
    st.setProperty('height', Math.round(r.h) + 'px', 'important');
    st.setProperty('right', 'auto', 'important');
    st.setProperty('bottom', 'auto', 'important');
    if (!measure) return;
    var g = b.getBoundingClientRect();
    if (!g.width && !g.height) return;   // hidden: nothing to measure
    var dx = g.left - r.x, dy = g.top - r.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    b.__cwOff = { x: off.x + dx, y: off.y + dy };
    st.setProperty('left', Math.round(r.x - b.__cwOff.x) + 'px', 'important');
    st.setProperty('top', Math.round(r.y - b.__cwOff.y) + 'px', 'important');
  }

  // All of it in sight, when it fits
  function fit(r, a) {
    if (r.y + r.h > a.y + a.h) r.y = Math.max(a.y, a.y + a.h - r.h);
    if (r.x + r.w > a.x + a.w) r.x = Math.max(a.x, a.x + a.w - r.w);
    if (r.x < a.x) r.x = a.x;
    return r;
  }

  // The bar stays reachable: never above the tab's top edge, never out of sight
  function clamp(r, a) {
    r.w = Math.max(MINW, Math.min(r.w, a.w));
    r.h = Math.max(MINH, Math.min(r.h, a.h));
    r.x = Math.min(Math.max(r.x, a.x - r.w + 120), a.x + a.w - 120);
    r.y = Math.min(Math.max(r.y, a.y), a.y + a.h - BAR);
    return r;
  }

  function remember(w) {
    if (w.max || narrow()) return;
    var a = area(), b = box(w).getBoundingClientRect();
    wcfg(w).rect = {
      x: +((b.left - a.x) / a.w).toFixed(4), y: +((b.top - a.y) / a.h).toFixed(4),
      w: +(b.width / a.w).toFixed(4), h: +(b.height / a.h).toFixed(4)
    };
    save();
  }

  // ---------------------------------------------------------------------------
  // The bar and the edges, the same for apps and CasaOS's panels
  // ---------------------------------------------------------------------------
  function barHtml(app) {
    return '<div class="cw-bar">' +
      '<img class="cw-icon" alt="" draggable="false"><span class="cw-title"></span>' +
      '<span class="cw-btns">' +
      (app ? '<button type="button" class="cw-btn" data-cw="more">' + icon('more') + '</button>' +
        '<button type="button" class="cw-btn" data-cw="tab">' + icon('tab') + '</button>' : '') +
      '<button type="button" class="cw-btn" data-cw="min">' + icon('min') + '</button>' +
      '<button type="button" class="cw-btn" data-cw="max"></button>' +
      '<button type="button" class="cw-btn cw-close" data-cw="close">' + icon('close') + '</button>' +
      '</span></div>';
  }
  var EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  function edgesHtml() {
    return EDGES.map(function (e) { return '<div class="cw-edge" data-edge="' + e + '"></div>'; }).join('');
  }

  // The bar's texts and the window's handlers (b: the window's box)
  function dress(w, b) {
    var bar = b.querySelector('.cw-bar'), img = bar.querySelector('.cw-icon');
    bar.querySelector('.cw-title').textContent = w.title;
    if (w.icon) img.src = w.icon;
    img.hidden = !w.icon;
    img.onerror = function () { img.hidden = true; };
    bar.title = '';
    var titles = { more: 'more', tab: 'newTab', min: 'minimize', close: 'close' };
    [].forEach.call(bar.querySelectorAll('[data-cw]'), function (btn) {
      var k = titles[btn.getAttribute('data-cw')];
      if (k) btn.title = t(k);
    });
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cw]');
      if (!btn) return;
      var act = btn.getAttribute('data-cw');
      if (act === 'min') minimize(w);
      else if (act === 'max') toggleMax(w);
      else if (act === 'close') close(w);
      else if (act === 'tab') toTab(w);
      else if (act === 'more') toggleMenu(w);
    });
    bar.addEventListener('dblclick', function (e) {
      if (!e.target.closest('[data-cw]') && !narrow()) toggleMax(w);
    });
    bar.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('[data-cw]')) drag(w, e, '');
    });
    [].forEach.call(b.querySelectorAll('.cw-edge'), function (edge) {
      edge.addEventListener('pointerdown', function (e) { drag(w, e, edge.getAttribute('data-edge')); });
    });
    // anything pressed in it brings it to the front (inside an app's page: see the blur below).
    // On an app's bar or edges the keys come back to CasaOS's page (they stay
    // in the app's page otherwise, and F5 there reloads the whole tab)
    bar.setAttribute('tabindex', '-1');
    b.addEventListener('pointerdown', function (e) {
      if (w.kind === 'app' && !e.target.closest('.cw-menu')) bar.focus({ preventScroll: true });
      if (wins[wins.length - 1] !== w) focus(w);
    }, true);
  }

  // Dragging by the bar, resizing by an edge (pointer events: mouse, pen and touch)
  function drag(w, e, edge) {
    if (e.button !== 0 || narrow() || (w.max && edge)) return;
    var b = box(w), a = area(), r0 = b.getBoundingClientRect();
    var sx = e.clientX, sy = e.clientY, moved = false;
    focus(w);
    e.preventDefault();
    function move(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 4) return;
        moved = true;
        document.documentElement.classList.add('cw-moving');   // the apps' pages don't take the pointer meanwhile
        if (w.max && !edge) {
          // a maximized window comes loose under the pointer, at its last size
          w.max = false;
          wcfg(w).max = false;
          save();
          place(w);
          var r1 = b.getBoundingClientRect(), fx = (sx - r0.left) / r0.width;
          r0 = { left: sx - fx * r1.width, top: a.y, width: r1.width, height: r1.height };
        }
      }
      var r = { x: r0.left, y: r0.top, w: r0.width, h: r0.height };
      if (!edge) {
        r.x += dx;
        r.y += dy;
      } else {
        if (/e/.test(edge)) r.w = Math.max(MINW, r0.width + dx);
        if (/s/.test(edge)) r.h = Math.max(MINH, r0.height + dy);
        if (/w/.test(edge)) {
          r.w = Math.max(MINW, r0.width - dx);
          r.x = r0.left + r0.width - r.w;
        }
        if (/n/.test(edge)) {
          r.h = Math.max(MINH, r0.height - dy);
          r.y = r0.top + r0.height - r.h;
        }
      }
      put(b, clamp(r, a));
    }
    function up() {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      document.documentElement.classList.remove('cw-moving');
      if (moved) remember(w);
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  function toggleMax(w) {
    w.max = !w.max;
    wcfg(w).max = w.max;
    save();
    place(w);
    focus(w);
  }

  // Minimized: hidden, still running; its icon on the dashboard brings it back
  function minimize(w) {
    w.min = true;
    closeMenu(w);
    box(w).classList.add('cw-hidden');
    stack();
  }
  function show(w) {
    w.min = false;
    box(w).classList.remove('cw-hidden');
    if (w.kind === 'panel') unclip();
    place(w);
    focus(w);
  }

  function close(w) {
    if (w.kind === 'panel') return closePanel(w);
    closeMenu(w);
    if (w.np) nowPlaying(w, { title: '', playing: false });   // its music stops with it
    var i = wins.indexOf(w);
    if (i >= 0) wins.splice(i, 1);
    w.el.remove();
    stack();
  }

  // ---------------------------------------------------------------------------
  // Apps
  // ---------------------------------------------------------------------------
  // An app's address. Inside CasaOS opened over https:// the browser blocks
  // an http:// app (mixed content): its https:// address on the same port is
  // used instead (with tailscale serve on that port, it answers). Nothing is
  // checked beforehand: a page can't tell (Chrome hides the answer of a
  // no-cors request for a web page, ORB), so a window that can't show its
  // app shows the browser's error, and "open in a new tab" is right there.
  function route(app) {
    var u = new URL(app.url), orig = u.href;
    if (u.protocol === 'http:' && location.protocol === 'https:') {
      u.protocol = 'https:';
      u.hostname = location.hostname;
    }
    var a = {};
    for (var k in app) a[k] = app[k];
    a.url = u.href;
    a.orig = orig;
    return openApp(a);
  }

  function openApp(app) {
    var w = find(app.name);
    if (w && w.kind === 'app') {
      show(w);
      return w;
    }
    w = {
      kind: 'app', name: app.name, title: app.title || app.name, icon: app.icon || '', url: app.url, orig: app.orig || app.url,
      min: false, max: !!appCfg(app.name).max, wait: !!app.wait
    };
    var el = w.el = document.createElement('div');
    el.className = 'cw-win';
    el.innerHTML = barHtml(true) + '<div class="cw-menu" hidden></div><div class="cw-body"></div>' + edgesHtml();
    document.body.appendChild(el);   // once: an iframe that moves reloads
    dress(w, el);
    wins.push(w);
    place(w);
    stack();
    fill(w);
    if (!app.icon || !app.title || app.title === app.name) describe(w);
    return w;
  }

  // The window's page (again: a reload)
  function fill(w) {
    var body = w.el.querySelector('.cw-body'), url = w.url;
    body.textContent = '';
    w.frame = null;
    if (w.wait) {
      // an app CasaOS has just started: its page once it is up, as CasaOS's
      // launch page does. Up: its icon (/favicon.ico) loads (an image is the
      // one answer a page can see from another site); 12 s at most
      w.wait = false;
      body.innerHTML = '<div class="cw-wait"></div>';
      var tries = 0, ico = new URL('/favicon.ico', url).href;
      (function again() {
        var img = new Image();
        img.onload = function () { if (w.el.isConnected) fill(w); };
        img.onerror = function () {
          if (!w.el.isConnected) return;
          if (++tries < 8) setTimeout(again, 1500);
          else fill(w);
        };
        img.src = ico + '?' + Date.now();
      })();
      return;
    }
    var f = w.frame = document.createElement('iframe'), n = w.fills = (w.fills || 0) + 1;
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-read; clipboard-write; ' +
      'microphone; camera; display-capture; geolocation; screen-wake-lock; web-share');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'no-referrer');
    body.appendChild(f);
    viaShim(url, function (ok) {
      if (n !== w.fills || !w.el.isConnected) return;
      w.shim = ok;
      var u = new URL(url);
      f.src = ok ? u.origin + SHIM + 'frame.html#u=' + encodeURIComponent(u.pathname + u.search + u.hash) +
        '&o=' + encodeURIComponent(location.origin) : url;
    });
  }

  // Through the frame proxy (frame-proxy.sh), each app's https:// address also
  // serves this mod's window page (/__casaos-windows/frame.html), which holds
  // the app on the app's own origin: F5 inside the app reloads the app, and
  // what the app plays comes back here. It is there when its little picture
  // loads (an image is the one answer a page can see from another site).
  var SHIM = '/__casaos-windows/', shims = {};   // origin: the window page is there (true/false)
  function viaShim(url, done) {
    var u = new URL(url);
    if (u.protocol !== 'https:' || location.protocol !== 'https:') return done(false);
    if (u.origin in shims) return done(shims[u.origin]);
    var img = new Image(), over = false;
    var timer = setTimeout(function () { end(false, true); }, 2500);
    function end(ok, late) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      if (!late) shims[u.origin] = ok;   // no answer yet: asked again next time
      done(ok);
    }
    img.onload = function () { end(true); };
    img.onerror = function () { end(false); };
    img.src = u.origin + SHIM + 'ok.svg?' + Date.now();
  }

  // Whether a wallpaper listens to sound now (Live Wallpapers says so): the
  // window pages analyse an app's sound only then
  var soundOn = !!window.casamodsAudioWanted;
  window.addEventListener('casamods:audio-wanted', function (e) {
    soundOn = !!(e.detail && e.detail.on);
    wins.forEach(tellSound);
  });
  function tellSound(w) {
    if (w.shim && w.frame && w.frame.contentWindow) w.frame.contentWindow.postMessage({ cw: 1, type: 'sound', on: soundOn }, new URL(w.url).origin);
  }

  // From an app's window page: where the app is, what it plays, its sound
  window.addEventListener('message', function (e) {
    var d = e.data, w = null;
    if (!d || d.cw !== 1 || !d.data || typeof d.data !== 'object') return;
    for (var i = 0; i < wins.length; i++) if (wins[i].frame && wins[i].frame.contentWindow === e.source) w = wins[i];
    if (!w || !w.shim || e.origin !== new URL(w.url).origin) return;
    if (d.type === 'place') {
      try {
        if (new URL(d.data.href).origin !== e.origin) return;
      } catch (x) { return; }
      w.cur = d.data.href;
      keepOpen();
      tellSound(w);
    } else if (d.type === 'media') nowPlaying(w, d.data);
    else if (d.type === 'sound' && Array.isArray(d.data.bands) && d.data.bands.length === 64) {
      // for Live Wallpapers: 64 bands, 0-255, mixed with the tab's own sound
      try { window.dispatchEvent(new CustomEvent('casamods:audio', { detail: { source: 'app-windows:' + w.name, bands: d.data.bands } })); } catch (x) { /* old browser */ }
    }
  });

  // What an app plays, for other mods (Live Wallpapers' media integration): a
  // 'casamods:nowplaying' event, as Music Player + Spotify sends. Only from an
  // app that has played (a paused page that never played says nothing)
  function nowPlaying(w, m) {
    var on = !!(m.playing && m.title);
    if (!on && !w.np) return;
    w.np = on || !!m.title;
    var d = {
      source: 'app-windows:' + w.name, title: String(m.title || ''), artist: String(m.artist || ''), album: String(m.album || ''),
      cover: typeof m.cover === 'string' && /^(data:image\/|https?:)/.test(m.cover) ? m.cover : '',
      playing: !!m.playing, position: +m.position || 0, duration: +m.duration || 0, at: +m.at || Date.now()
    };
    try { window.dispatchEvent(new CustomEvent('casamods:nowplaying', { detail: d })); } catch (x) { /* old browser */ }
  }

  function portOf(u) { return Number(u.port) || (u.protocol === 'https:' ? 443 : 80); }

  // To a new tab (CasaOS's own way); the window closes
  function toTab(w) {
    nativeOpen.call(window, w.cur || w.orig || w.url, '_blank');   // where the app is, else its address as CasaOS opens it
    close(w);
  }

  // The app's menu: always a new tab, and what to do when the app refuses to
  // be in a window (browsers don't tell the page)
  function toggleMenu(w) {
    var m = w.el.querySelector('.cw-menu');
    if (!m.hidden) return closeMenu(w);
    var c = appCfg(w.name);
    m.innerHTML = '<label class="cw-item cw-check"><input type="checkbox" data-m="tab"> <span></span></label><p class="cw-hint"></p>';
    var tab = m.querySelector('[data-m="tab"]');
    tab.checked = !!c.tab;
    tab.nextElementSibling.textContent = t('alwaysTab');
    tab.addEventListener('change', function () {
      if (tab.checked) c.tab = true;
      else delete c.tab;
      save();
    });
    m.querySelector('.cw-hint').textContent = t('tabHint');
    m.hidden = false;
    var moreBtn = w.el.querySelector('[data-cw="more"]');
    setTimeout(function () {
      // a press anywhere else closes it
      w.away = function (e) { if (!m.contains(e.target) && !moreBtn.contains(e.target)) closeMenu(w); };
      document.addEventListener('pointerdown', w.away, true);
    }, 0);
  }
  function closeMenu(w) {
    var m = w.el && w.el.querySelector('.cw-menu');
    if (m) m.hidden = true;
    if (w.away) document.removeEventListener('pointerdown', w.away, true);
    w.away = null;
  }

  // Icon and title for a window opened from elsewhere (the App Store, a
  // widget): from CasaOS's app list, by port
  var grid = null, gridAt = 0;
  function describe(w) {
    var u = new URL(w.url, location.href), port = String(portOf(u));
    (Date.now() - gridAt < 60000 && grid ? Promise.resolve(grid) : fetch('/v2/app_management/web/appgrid', {
      headers: { Authorization: casaToken(), Accept: 'application/json' }
    }).then(function (r) { return r.json(); }).then(function (j) {
      grid = (j && j.data) || [];
      gridAt = Date.now();
      return grid;
    })).then(function (list) {
      var hit = list.filter(function (a) {
        return a && String(a.port || '') === port && (!a.hostname || a.hostname === u.hostname);
      })[0];
      if (!hit || !w.el.isConnected) return;
      // its CasaOS name, as if its icon had opened it (its dot, its settings)
      if (hit.name && w.name === u.host && !find(hit.name)) {
        w.name = hit.name;
        mark();
      }
      var l = lang().replace('-', '_'), tt = hit.title;
      var title = typeof tt === 'string' ? tt : tt && (tt[l] || tt[l.split('_')[0]] || tt.en_us || tt.en || tt[Object.keys(tt)[0]]);
      if (title && (!w.title || w.title === w.name)) w.title = title;
      if (hit.icon && !w.icon) w.icon = hit.icon;
      var img = w.el.querySelector('.cw-icon');
      w.el.querySelector('.cw-title').textContent = w.title;
      if (w.icon) {
        img.src = w.icon;
        img.hidden = false;
      }
    }, function () { /* no list: the address stays the title */ });
  }

  function casaToken() {
    try {
      var vm = document.querySelector('#app').__vue__;
      return (vm && vm.$store && vm.$store.state.access_token) || localStorage.getItem('access_token') || '';
    } catch (e) {
      return localStorage.getItem('access_token') || '';
    }
  }

  // ---------------------------------------------------------------------------
  // Opening: CasaOS opens an app with window.open(scheme://host:port/index), or
  // its launch page (#/launch?appDetailData=…) for an app that just started.
  // Those become windows; anything else opens as before.
  // ---------------------------------------------------------------------------
  var nativeOpen = window.open;
  var lastCard = null;   // the app icon just clicked: { name, title, icon, at, ctrl, shift }

  window.open = function (url) {
    var app = null;
    try { app = appFor(url); } catch (e) { app = null; }
    if (app) {
      route(app);
      return null;
    }
    return nativeOpen.apply(window, arguments);
  };

  function launchData(u) {
    if (u.origin !== location.origin) return null;
    var q = u.search;
    if (/^#\/?launch\b/.test(u.hash)) q = u.hash.slice(u.hash.indexOf('?'));
    else if (!/\/launch\/?$/.test(u.pathname)) return null;
    var raw = new URLSearchParams(q).get('appDetailData');
    if (!raw) return null;
    var d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : null;
  }

  function appFor(url) {
    if (url == null || url === '') return null;
    var u = new URL(String(url), location.href);
    var card = lastCard && Date.now() - lastCard.at < 2500 ? lastCard : null;
    if (card && card.ctrl) return null;   // Ctrl/Cmd + click: a new tab, as asked
    var d = launchData(u);
    if (d) {
      // the address CasaOS's launch page would go to
      u = new URL((d.scheme || 'http') + '://' + (d.hostname || location.hostname) + (d.port ? ':' + d.port : '') + (d.index || '/'));
    } else {
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (u.origin === location.origin) return null;   // CasaOS's own pages
      // an app of this server (its host, another port), or what an app icon opens
      if (!card && !(u.hostname === location.hostname && u.port !== location.port)) return null;
    }
    var name = (d && (d.name || d.id)) || (card && card.name) || u.host;
    var c = cfg.apps[name];
    if (c && c.tab && !(card && card.shift)) return null;   // this app: always a new tab
    return { name: name, title: card ? card.title : '', icon: card ? card.icon : '', url: u.href, wait: !!d };
  }

  // The app icons: an open app's icon brings its window back instead of a new
  // one; the icon just clicked names the window CasaOS opens next
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || !e.target.closest) return;
    var card = e.target.closest('[id^="app-"]');
    if (!card) {
      if (lastCard && e.target.closest('.app-card-drop')) lastCard.at = Date.now();   // its menu ("Open"): that app still
      else lastCard = null;
      return;
    }
    var name = card.id.slice(4), info = cardInfo(card);
    lastCard = { name: name, title: info.title, icon: info.icon, at: Date.now(), ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
    var w = find(name);
    if (!w || !e.target.closest('.cards-content') || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    show(w);
  }, true);

  function cardInfo(card) {
    var title = card.querySelector('.cards-content .one-line'), img = card.querySelector('.cards-content img');
    return { title: title ? title.textContent.trim() : '', icon: img ? img.currentSrc || img.src : '' };
  }

  // Clicking in an app's page reaches only that page: the tab loses focus to
  // the iframe, and its window comes to the front
  window.addEventListener('blur', function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || a.tagName !== 'IFRAME') return;
      for (var i = 0; i < wins.length; i++) {
        if (wins[i].frame === a) {
          touched = wins[i];
          if (wins[wins.length - 1] !== wins[i]) focus(wins[i]);
          return;
        }
      }
    }, 0);
  });

  // The open apps' icons get a dot (dimmed while minimized)
  function mark() {
    [].forEach.call(document.querySelectorAll('[id^="app-"].cw-open'), function (c) {
      if (!find(c.id.slice(4))) c.classList.remove('cw-open', 'cw-min');
    });
    wins.forEach(function (w) {
      var c = document.getElementById('app-' + (w.base || w.name));
      if (!c) return;
      c.classList.add('cw-open');
      c.classList.toggle('cw-min', w.min);
    });
  }

  // ---------------------------------------------------------------------------
  // Files and the App Store: CasaOS's own panels (Buefy modals: .modal.file-panel,
  // kept when closed; .modal.app-panel, made at each opening), turned into
  // windows: the bar on top, no backdrop, the place of a window
  // ---------------------------------------------------------------------------
  var PANELS = [{ sel: '.modal.file-panel', name: 'Files' }, { sel: '.modal.app-panel', name: 'App Store' }];

  function scanPanels() {
    // closed by CasaOS (its own close button, Esc), or gone
    wins.slice().forEach(function (w) {
      if (w.kind === 'panel' && (!w.root.isConnected || w.root.style.display === 'none')) dropPanel(w);
    });
    PANELS.forEach(function (p) {
      [].forEach.call(document.querySelectorAll(p.sel), function (m) {
        if (!seen.has(m)) {
          seen.add(m);
          panelStyle.observe(m, { attributes: true, attributeFilter: ['style'] });
        }
        if (m.style.display === 'none' || m.classList.contains('cw-panel')) return;
        adoptPanel(m, p);
      });
    });
  }

  function adoptPanel(m, p) {
    var card = document.getElementById('app-' + p.name), info = card ? cardInfo(card) : { title: '', icon: '' };
    var same = find(p.name);
    // a second App Store (opened from somewhere else): its own window
    var name = same ? p.name + ' ' + (wins.length + 1) : p.name;
    var w = { kind: 'panel', name: name, base: p.name, title: info.title || p.name, icon: info.icon, root: m, min: false, max: !!appCfg(p.name).max };
    m.classList.add('cw-panel');
    m.insertAdjacentHTML('afterbegin', barHtml(false));
    m.insertAdjacentHTML('beforeend', edgesHtml());
    dress(w, m);
    wins.push(w);
    unclip();
    place(w);
    stack();
    if (p.name === 'Files') hookFiles(m);
  }

  // CasaOS closed it: the panel is left as it was (Files is kept for next time)
  function dropPanel(w) {
    var i = wins.indexOf(w);
    if (i >= 0) wins.splice(i, 1);
    var m = w.root;
    m.classList.remove('cw-panel', 'cw-hidden', 'cw-top', 'cw-max', 'cw-narrow');
    [].forEach.call(m.querySelectorAll(':scope > .cw-bar, :scope > .cw-edge'), function (x) { x.remove(); });
    ['left', 'top', 'width', 'height', 'right', 'bottom', 'z-index'].forEach(function (k) { m.style.removeProperty(k); });
    stack();
  }

  // Closing goes through CasaOS's own close button (its panel then saves or forgets what it has)
  function closePanel(w) {
    var btns = w.root.querySelectorAll('.close-button');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].offsetParent !== null || btns[i].getClientRects().length) {
        w.root.classList.remove('cw-hidden');
        btns[i].click();
        setTimeout(scanPanels, 400);
        return;
      }
    }
    // no button to be found: hidden then, as a minimized one
    minimize(w);
  }

  // A full-screen panel locks the page's scrolling: not as a window
  function unclip() { document.documentElement.classList.remove('is-clipped'); }

  // Files opened from elsewhere (a notice, a widget) while minimized: its
  // window comes back (CasaOS calls the panel's init)
  function hookFiles(m) {
    var all = m.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var vm = all[i].__vue__;
      if (vm && typeof vm.init === 'function' && typeof vm.getFileList === 'function') {
        if (vm.__cwHooked) return;
        vm.__cwHooked = true;
        var init = vm.init;
        vm.init = function () {
          var w = find('Files');
          if (w && w.min) show(w);
          return init.apply(this, arguments);
        };
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // F5 (Ctrl+R) reloads the app last used, not CasaOS (Shift: CasaOS, as
  // always). Pressed inside an app's page, only the window page of the frame
  // proxy can catch it; otherwise the browser reloads the whole tab and no
  // page can stop it: then the apps' windows come back by themselves (this
  // tab's open apps are kept in sessionStorage).
  // ---------------------------------------------------------------------------
  var touched = null;   // the window last pressed (null: the dashboard)
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.cw-win, .modal.cw-panel');
    touched = null;
    for (var i = 0; b && i < wins.length; i++) if (box(wins[i]) === b) touched = wins[i];
  }, true);

  window.addEventListener('keydown', function (e) {
    var reload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'r' || e.key === 'R'));
    if (!reload || e.shiftKey) return;
    var w = touched;
    if (!w || w.kind !== 'app' || w.min || wins.indexOf(w) < 0) return;
    e.preventDefault();
    if (w.shim && w.frame && w.frame.contentWindow) w.frame.contentWindow.postMessage({ cw: 1, type: 'reload' }, new URL(w.url).origin);
    else fill(w);
  }, true);

  var SESSION = STORE + '-open';
  function keepOpen() {
    try {
      sessionStorage.setItem(SESSION, JSON.stringify(wins.filter(function (w) { return w.kind === 'app'; }).map(function (w) {
        return { name: w.name, title: w.title, icon: w.icon, url: w.cur || w.url, orig: w.orig, min: w.min };
      })));
    } catch (e) { /* storage blocked */ }
  }

  // After a reload, once the dashboard is there (not on the login page)
  var restored = false;
  function restore() {
    if (restored || !document.querySelector('.top-bar')) return;
    restored = true;
    var list;
    try { list = JSON.parse(sessionStorage.getItem(SESSION) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) return;
    list.forEach(function (o) {
      if (!o || typeof o.url !== 'string' || !o.name || find(o.name)) return;
      var w = openApp(o);
      if (o.min) minimize(w);
    });
  }

  // ---------------------------------------------------------------------------
  // Keeping up with the page
  // ---------------------------------------------------------------------------
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { wins.forEach(function (w) { if (!w.min) place(w); }); }, 120);
  });

  // Watched: elements added or removed (a panel made, the app list redrawn),
  // and the panels' own style (CasaOS shows and hides Files with it)
  var scheduled = false, seen = new WeakSet();
  function later() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      restore();
      scanPanels();
      mark();
    }, 120);
  }
  var PANEL_SEL = PANELS.map(function (p) { return p.sel; }).join(', ');
  var panelStyle = new MutationObserver(function () {
    scanPanels();   // before the next paint: no flash of the full-screen panel
    later();
  });
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var k = 0; k < added.length; k++) {
        var n = added[k];
        if (n.nodeType === 1 && (n.matches(PANEL_SEL) || n.querySelector(PANEL_SEL))) {
          scanPanels();
          break;
        }
      }
    }
    later();
  }).observe(document.body, { childList: true, subtree: true });

  restore();
  scanPanels();
  console.info(TAG, 'loaded');

  // For other mods and debugging
  window.CasaAppWindows = {
    open: function (url, title, iconUrl) {
      var u = new URL(String(url), location.href);
      openApp({ name: u.host, title: title || u.host, icon: iconUrl || '', url: u.href });
    },
    get windows() {
      return wins.map(function (w) { return { name: w.name, title: w.title, kind: w.kind, minimized: w.min, maximized: w.max }; });
    }
  };
})();

/*
 * Live Wallpapers — CasaMOD mod for CasaOS.
 *
 * Animated wallpapers for the CasaOS dashboard, from a folder on the server:
 *
 *   /DATA/AppData/casamod/mod/wallpapers/      (CasaMOD serves it at /mod/wallpapers/)
 *
 * Each subfolder is a wallpaper: a Wallpaper Engine "web" or "video" wallpaper
 * copied as is from its Steam Workshop folder (project.json included), or any
 * folder with an index.html or a video. Loose .mp4/.webm files are video
 * wallpapers too. Wallpaper Engine "scene" and "application" wallpapers can't
 * run outside it: they are listed greyed out, with the reason.
 *
 * The wallpapers show up in the CasaOS wallpaper menu (Settings → Wallpaper →
 * Change) and are saved like any CasaOS wallpaper. "Customize", next to
 * "Change", opens the settings of the chosen one, built from its project.json.
 *
 * Web wallpapers run in a sandboxed iframe with no access to CasaOS (unless the
 * wallpaper is marked as trusted) and get the Wallpaper Engine web API: user and
 * general properties (with pictures, videos and folders picked from the CasaOS
 * storage), the audio of the tab (128 bands), what plays in it, the mouse over
 * the empty background, pause. Nothing is loaded until a wallpaper is chosen, and only
 * that one; the wallpaper menu reads the folder when it opens.
 *
 * Settings (config.json, for every wallpaper; each wallpaper's own are in its
 * Customize panel): audio, wallpapers may hear the tab's sound (true); media,
 * they may know what plays (true); memory, video wallpapers up to this many
 * MB are kept in memory, bigger ones streamed (0 to 1000, by 10; 100).
 */
(function () {
  'use strict';

  if (window.__liveWallpapersMod) return;
  window.__liveWallpapersMod = true;

  var TAG = '[Live Wallpapers]';

  // Settings: config.json next to this file, in the format of CONFIG.md at the
  // repository's root (the CasaMOD Store shows and changes it). Each value by
  // its key; a missing or invalid one is the default
  var SELF = document.currentScript && document.currentScript.src;
  var DEFAULTS = { audio: true, media: true, memory: 100 };
  var VALID = {
    audio: function (v) { return v === true || v === false; },
    media: function (v) { return v === true || v === false; },
    memory: function (v) { return typeof v === 'number' && v >= 0 && v <= 1000 && v % 10 === 0; }   // MB
  };
  var configured = loadConfig();   // read once: the settings apply at load ("applies": "reload")
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
  var BASE = ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');
  var WALL_URL = (function () {
    try { return new URL('../wallpapers/', BASE).pathname; } catch (e) { return '/mod/wallpapers/'; }
  })();
  var WALL_DIR = '/DATA/AppData/casamod/mod/wallpapers';
  var FROM = 'Live Wallpaper';
  var STORE = 'casamod-live-wallpapers';
  var VIDEO_EXT = /\.(mp4|webm|m4v|ogv|mov)$/i;
  var IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
  var PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1d2b4f"/><stop offset="1" stop-color="#4a2a63"/></linearGradient></defs>' +
    '<rect width="320" height="180" fill="url(#g)"/><path fill="#fff" fill-opacity=".8" d="M160 62l7 18 18 7-18 7-7 18-7-18-18-7 18-7z"/></svg>');

  // ---------------------------------------------------------------------------
  // Tab audio tap: every same-origin <audio>/<video> that plays in the tab
  // (a music player widget, a video, anything) is routed through one Web Audio
  // analyser; the sound still reaches the speakers. A media element can feed
  // Web Audio only once, so the tap lives on window: another mod may reuse it.
  // ---------------------------------------------------------------------------
  var audioTap = window.__casaAudioTap || (window.__casaAudioTap = (function () {
    var tap = { analyser: null, listeners: [] };
    var ctx = null, routed = new WeakSet(), pending = [];

    tap.listen = function (cb) {
      tap.listeners.push(cb);
      if (tap.analyser) cb(tap.analyser);
    };

    function context() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        tap.analyser = ctx.createAnalyser();
        tap.analyser.fftSize = 4096;
        tap.analyser.smoothingTimeConstant = 0.55;
        tap.analyser.minDecibels = -85;
        tap.analyser.maxDecibels = -25;
        ctx.addEventListener('statechange', function () {
          if (ctx.state === 'running') pending.splice(0).forEach(tryRoute);
        });
        tap.listeners.forEach(function (cb) { cb(tap.analyser); });
      }
      return ctx;
    }

    // Browsers only start audio after a user gesture: unlock on the first one
    function unlock() {
      var c = context();
      if (c && c.state === 'suspended') c.resume();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (type) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    });

    function sameOrigin(url) {
      try {
        var u = new URL(url, location.href);
        return u.origin === location.origin || u.protocol === 'blob:' || u.protocol === 'data:';
      } catch (e) {
        return false;
      }
    }

    // Routes a media element through the analyser, once. Returns false when it
    // has to wait for the audio context to start. Cross-origin media would go
    // silent inside Web Audio, so it is left alone.
    function route(el) {
      if (routed.has(el)) return true;
      var src = el.currentSrc || el.src;
      if (!src) return false;
      if (!sameOrigin(src) && !el.crossOrigin) return true;
      var c = context();
      if (!c) return true;
      if (c.state !== 'running') return false;   // never mute media through a suspended context
      try {
        var node = c.createMediaElementSource(el);
        node.connect(c.destination);
        node.connect(tap.analyser);
      } catch (e) {
        // Already connected to another context by someone else: nothing to tap
      }
      routed.add(el);
      return true;
    }

    function tryRoute(el) {
      if (!route(el) && pending.indexOf(el) < 0) pending.push(el);
    }

    // Whoever wants to know which media plays in the tab (media integration):
    // called with every element that is told to play, in the DOM or not
    tap.onPlay = [];
    function started(el) {
      for (var i = 0; i < tap.onPlay.length; i++) {
        try { tap.onPlay[i](el); } catch (e) { /* never break playback */ }
      }
    }

    var nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      try { tryRoute(this); } catch (e) { /* never break playback */ }
      started(this);
      return nativePlay.apply(this, arguments);
    };
    document.addEventListener('playing', function (e) {
      if (e.target instanceof HTMLMediaElement) {
        tryRoute(e.target);
        started(e.target);
      }
    }, true);

    return tap;
  })());

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default)
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: {
      customize: 'Customize',
      settings: 'Settings',
      reset: 'Defaults',
      resetTitle: 'Restore every default value',
      close: 'Close (Esc)',
      search: 'Search settings',
      fps: 'Frame rate limit',
      unlimited: 'Unlimited',
      volume: 'Volume',
      trust: 'Trust this wallpaper (full compatibility)',
      trustNote: 'It then runs with full access to CasaOS and your account. Turn it on only for wallpapers you trust, if this one looks broken.',
      sound: 'Video sound',
      noSettings: 'This wallpaper has no settings.',
      scene: 'Scene: only runs in Wallpaper Engine',
      app: 'Application: not supported',
      unsupported: 'Not supported',
      schemeColor: 'Scheme color',
      hue: 'Hue',
      shade: 'Saturation and brightness',
      eyedropper: 'Pick a color from the screen',
      hex: 'Hex color',
      choose: 'Choose…',
      remove: 'Remove',
      upFolder: 'Up one folder',
      useFolder: 'Use this folder',
      emptyFolder: 'Nothing to choose in this folder',
      folderError: 'This folder can\'t be read',
      folderPath: 'Folder'
    },
    ar: {
      customize: 'تخصيص',
      settings: 'الإعدادات',
      reset: 'الافتراضي',
      resetTitle: 'استعادة جميع القيم الافتراضية',
      close: 'إغلاق (Esc)',
      search: 'ابحث في الإعدادات',
      fps: 'حد الإطارات في الثانية',
      unlimited: 'بلا حد',
      volume: 'مستوى الصوت',
      trust: 'الوثوق بهذه الخلفية (توافق كامل)',
      trustNote: 'ستعمل حينها بوصول كامل إلى CasaOS وإلى حسابك. فعّل ذلك فقط للخلفيات التي تثق بها، إذا بدت هذه معطّلة.',
      sound: 'صوت الفيديو',
      noSettings: 'لا توجد إعدادات لهذه الخلفية.',
      scene: 'مشهد: يعمل فقط في Wallpaper Engine',
      app: 'تطبيق: غير مدعوم',
      unsupported: 'غير مدعوم',
      schemeColor: 'لون المخطط',
      hue: 'تدرج اللون',
      shade: 'التشبع والسطوع',
      eyedropper: 'اختر لونًا من الشاشة',
      hex: 'اللون بالنظام الست عشري',
      choose: 'اختيار…',
      remove: 'إزالة',
      upFolder: 'المجلد الأعلى',
      useFolder: 'استخدام هذا المجلد',
      emptyFolder: 'لا يوجد ما يمكن اختياره في هذا المجلد',
      folderError: 'تعذّرت قراءة هذا المجلد',
      folderPath: 'المجلد'
    },
    be: {
      customize: 'Наладзіць',
      settings: 'Налады',
      reset: 'Па змаўчанні',
      resetTitle: 'Аднавіць усе значэнні па змаўчанні',
      close: 'Закрыць (Esc)',
      search: 'Пошук у наладах',
      fps: 'Абмежаванне кадраў у секунду',
      unlimited: 'Без абмежавання',
      volume: 'Гучнасць',
      trust: 'Давяраць гэтым шпалерам (поўная сумяшчальнасць)',
      trustNote: 'Тады яны працуюць з поўным доступам да CasaOS і вашага ўліковага запісу. Уключайце толькі для шпалер, якім давяраеце, калі гэтыя выглядаюць зламанымі.',
      sound: 'Гук відэа',
      noSettings: 'У гэтых шпалер няма налад.',
      scene: 'Сцэна: працуе толькі ў Wallpaper Engine',
      app: 'Праграма: не падтрымліваецца',
      unsupported: 'Не падтрымліваецца',
      schemeColor: 'Колер схемы',
      hue: 'Адценне',
      shade: 'Насычанасць і яркасць',
      eyedropper: 'Узяць колер з экрана',
      hex: 'Шаснаццатковы колер',
      choose: 'Выбраць…',
      remove: 'Выдаліць',
      upFolder: 'На ўзровень вышэй',
      useFolder: 'Выкарыстаць гэту папку',
      emptyFolder: 'У гэтай папцы няма чаго выбраць',
      folderError: 'Не ўдалося прачытаць гэту папку',
      folderPath: 'Папка'
    },
    bg: {
      customize: 'Персонализиране',
      settings: 'Настройки',
      reset: 'По подразбиране',
      resetTitle: 'Възстановяване на всички стойности по подразбиране',
      close: 'Затваряне (Esc)',
      search: 'Търсене в настройките',
      fps: 'Ограничение на кадрите в секунда',
      unlimited: 'Без ограничение',
      volume: 'Сила на звука',
      trust: 'Доверие към този тапет (пълна съвместимост)',
      trustNote: 'Тогава той работи с пълен достъп до CasaOS и до вашия акаунт. Включете само за тапети, на които имате доверие, ако този изглежда счупен.',
      sound: 'Звук на видеото',
      noSettings: 'Този тапет няма настройки.',
      scene: 'Сцена: работи само в Wallpaper Engine',
      app: 'Приложение: не се поддържа',
      unsupported: 'Не се поддържа',
      schemeColor: 'Цвят на схемата',
      hue: 'Оттенък',
      shade: 'Наситеност и яркост',
      eyedropper: 'Вземи цвят от екрана',
      hex: 'Шестнадесетичен цвят',
      choose: 'Избор…',
      remove: 'Премахване',
      upFolder: 'Една папка нагоре',
      useFolder: 'Използване на тази папка',
      emptyFolder: 'В тази папка няма какво да се избере',
      folderError: 'Тази папка не може да бъде прочетена',
      folderPath: 'Папка'
    },
    ca: {
      customize: 'Personalitzar',
      settings: 'Configuració',
      reset: 'Predeterminat',
      resetTitle: 'Restaurar tots els valors predeterminats',
      close: 'Tancar (Esc)',
      search: 'Cerca a la configuració',
      fps: 'Límit de fotogrames per segon',
      unlimited: 'Sense límit',
      volume: 'Volum',
      trust: 'Confiar en aquest fons (compatibilitat total)',
      trustNote: 'Llavors s’executa amb accés total a CasaOS i al teu compte. Activa-ho només per als fons en què confiïs, si aquest sembla trencat.',
      sound: 'So del vídeo',
      noSettings: 'Aquest fons no té configuració.',
      scene: 'Escena: només funciona al Wallpaper Engine',
      app: 'Aplicació: no compatible',
      unsupported: 'No compatible',
      schemeColor: 'Color de l’esquema',
      hue: 'To',
      shade: 'Saturació i brillantor',
      eyedropper: 'Agafa un color de la pantalla',
      hex: 'Color hexadecimal',
      choose: 'Tria…',
      remove: 'Treu',
      upFolder: 'Una carpeta amunt',
      useFolder: 'Fes servir aquesta carpeta',
      emptyFolder: 'No hi ha res per triar en aquesta carpeta',
      folderError: 'No es pot llegir aquesta carpeta',
      folderPath: 'Carpeta'
    },
    cs: {
      customize: 'Přizpůsobit',
      settings: 'Nastavení',
      reset: 'Výchozí',
      resetTitle: 'Obnovit všechny výchozí hodnoty',
      close: 'Zavřít (Esc)',
      search: 'Hledat v nastavení',
      fps: 'Omezení snímků za sekundu',
      unlimited: 'Bez omezení',
      volume: 'Hlasitost',
      trust: 'Důvěřovat této tapetě (plná kompatibilita)',
      trustNote: 'Pak poběží s plným přístupem k CasaOS a k vašemu účtu. Zapněte jen u tapet, kterým důvěřujete, pokud tato vypadá rozbitě.',
      sound: 'Zvuk videa',
      noSettings: 'Tato tapeta nemá žádná nastavení.',
      scene: 'Scéna: funguje jen ve Wallpaper Engine',
      app: 'Aplikace: není podporována',
      unsupported: 'Nepodporováno',
      schemeColor: 'Barva schématu',
      hue: 'Odstín',
      shade: 'Sytost a jas',
      eyedropper: 'Vybrat barvu z obrazovky',
      hex: 'Barva v šestnáctkovém zápisu',
      choose: 'Vybrat…',
      remove: 'Odebrat',
      upFolder: 'O složku výš',
      useFolder: 'Použít tuto složku',
      emptyFolder: 'V této složce není co vybrat',
      folderError: 'Tuto složku nelze přečíst',
      folderPath: 'Složka'
    },
    de: {
      customize: 'Anpassen',
      settings: 'Einstellungen',
      reset: 'Standard',
      resetTitle: 'Alle Standardwerte wiederherstellen',
      close: 'Schließen (Esc)',
      search: 'Einstellungen durchsuchen',
      fps: 'Bildratenbegrenzung',
      unlimited: 'Unbegrenzt',
      volume: 'Lautstärke',
      trust: 'Diesem Hintergrund vertrauen (volle Kompatibilität)',
      trustNote: 'Er läuft dann mit vollem Zugriff auf CasaOS und dein Konto. Nur für Hintergründe einschalten, denen du vertraust, wenn dieser fehlerhaft aussieht.',
      sound: 'Videoton',
      noSettings: 'Dieser Hintergrund hat keine Einstellungen.',
      scene: 'Szene: läuft nur in Wallpaper Engine',
      app: 'Anwendung: nicht unterstützt',
      unsupported: 'Nicht unterstützt',
      schemeColor: 'Schemafarbe',
      hue: 'Farbton',
      shade: 'Sättigung und Helligkeit',
      eyedropper: 'Farbe vom Bildschirm aufnehmen',
      hex: 'Hex-Farbe',
      choose: 'Auswählen…',
      remove: 'Entfernen',
      upFolder: 'Einen Ordner nach oben',
      useFolder: 'Diesen Ordner verwenden',
      emptyFolder: 'In diesem Ordner gibt es nichts zur Auswahl',
      folderError: 'Dieser Ordner kann nicht gelesen werden',
      folderPath: 'Ordner'
    },
    el: {
      customize: 'Προσαρμογή',
      settings: 'Ρυθμίσεις',
      reset: 'Προεπιλογές',
      resetTitle: 'Επαναφορά όλων των προεπιλεγμένων τιμών',
      close: 'Κλείσιμο (Esc)',
      search: 'Αναζήτηση ρυθμίσεων',
      fps: 'Όριο καρέ ανά δευτερόλεπτο',
      unlimited: 'Χωρίς όριο',
      volume: 'Ένταση',
      trust: 'Εμπιστοσύνη σε αυτή την ταπετσαρία (πλήρης συμβατότητα)',
      trustNote: 'Τότε εκτελείται με πλήρη πρόσβαση στο CasaOS και στον λογαριασμό σας. Ενεργοποιήστε το μόνο για ταπετσαρίες που εμπιστεύεστε, αν αυτή φαίνεται χαλασμένη.',
      sound: 'Ήχος βίντεο',
      noSettings: 'Αυτή η ταπετσαρία δεν έχει ρυθμίσεις.',
      scene: 'Σκηνή: λειτουργεί μόνο στο Wallpaper Engine',
      app: 'Εφαρμογή: δεν υποστηρίζεται',
      unsupported: 'Δεν υποστηρίζεται',
      schemeColor: 'Χρώμα σχήματος',
      hue: 'Απόχρωση',
      shade: 'Κορεσμός και φωτεινότητα',
      eyedropper: 'Επιλογή χρώματος από την οθόνη',
      hex: 'Δεκαεξαδικό χρώμα',
      choose: 'Επιλογή…',
      remove: 'Αφαίρεση',
      upFolder: 'Έναν φάκελο πάνω',
      useFolder: 'Χρήση αυτού του φακέλου',
      emptyFolder: 'Δεν υπάρχει κάτι για επιλογή σε αυτόν τον φάκελο',
      folderError: 'Δεν είναι δυνατή η ανάγνωση αυτού του φακέλου',
      folderPath: 'Φάκελος'
    },
    es: {
      customize: 'Personalizar',
      settings: 'Configuración',
      reset: 'Predeterminado',
      resetTitle: 'Restaurar todos los valores predeterminados',
      close: 'Cerrar (Esc)',
      search: 'Buscar en los ajustes',
      fps: 'Límite de fotogramas por segundo',
      unlimited: 'Sin límite',
      volume: 'Volumen',
      trust: 'Confiar en este fondo (compatibilidad total)',
      trustNote: 'Entonces se ejecuta con acceso total a CasaOS y a tu cuenta. Actívalo solo para fondos en los que confíes, si este parece roto.',
      sound: 'Sonido del vídeo',
      noSettings: 'Este fondo no tiene ajustes.',
      scene: 'Escena: solo funciona en Wallpaper Engine',
      app: 'Aplicación: no compatible',
      unsupported: 'No compatible',
      schemeColor: 'Color del esquema',
      hue: 'Tono',
      shade: 'Saturación y brillo',
      eyedropper: 'Tomar un color de la pantalla',
      hex: 'Color hexadecimal',
      choose: 'Elegir…',
      remove: 'Quitar',
      upFolder: 'Subir una carpeta',
      useFolder: 'Usar esta carpeta',
      emptyFolder: 'No hay nada que elegir en esta carpeta',
      folderError: 'No se puede leer esta carpeta',
      folderPath: 'Carpeta'
    },
    fr: {
      customize: 'Personnaliser',
      settings: 'Paramètres',
      reset: 'Par défaut',
      resetTitle: 'Rétablir toutes les valeurs par défaut',
      close: 'Fermer (Échap)',
      search: 'Rechercher dans les réglages',
      fps: 'Limite d’images par seconde',
      unlimited: 'Illimitée',
      volume: 'Volume',
      trust: 'Faire confiance à ce fond d’écran (compatibilité totale)',
      trustNote: 'Il s’exécute alors avec un accès complet à CasaOS et à votre compte. Activez-le uniquement pour les fonds d’écran de confiance, si celui-ci semble cassé.',
      sound: 'Son de la vidéo',
      noSettings: 'Ce fond d’écran n’a pas de paramètres.',
      scene: 'Scène : ne fonctionne que dans Wallpaper Engine',
      app: 'Application : non prise en charge',
      unsupported: 'Non pris en charge',
      schemeColor: 'Couleur du thème',
      hue: 'Teinte',
      shade: 'Saturation et luminosité',
      eyedropper: 'Prélever une couleur à l’écran',
      hex: 'Couleur hexadécimale',
      choose: 'Choisir…',
      remove: 'Retirer',
      upFolder: 'Dossier parent',
      useFolder: 'Utiliser ce dossier',
      emptyFolder: 'Rien à choisir dans ce dossier',
      folderError: 'Impossible de lire ce dossier',
      folderPath: 'Dossier'
    },
    hr: {
      customize: 'Prilagodi',
      settings: 'Postavke',
      reset: 'Zadano',
      resetTitle: 'Vrati sve zadane vrijednosti',
      close: 'Zatvori (Esc)',
      search: 'Pretraži postavke',
      fps: 'Ograničenje sličica u sekundi',
      unlimited: 'Bez ograničenja',
      volume: 'Glasnoća',
      trust: 'Vjeruj ovoj pozadini (puna kompatibilnost)',
      trustNote: 'Tada radi s punim pristupom CasaOS-u i vašem računu. Uključite samo za pozadine kojima vjerujete, ako ova izgleda pokvareno.',
      sound: 'Zvuk videozapisa',
      noSettings: 'Ova pozadina nema postavki.',
      scene: 'Scena: radi samo u Wallpaper Engineu',
      app: 'Aplikacija: nije podržana',
      unsupported: 'Nije podržano',
      schemeColor: 'Boja sheme',
      hue: 'Nijansa',
      shade: 'Zasićenost i svjetlina',
      eyedropper: 'Uzmi boju sa zaslona',
      hex: 'Heksadecimalna boja',
      choose: 'Odaberi…',
      remove: 'Ukloni',
      upFolder: 'Jednu mapu gore',
      useFolder: 'Koristi ovu mapu',
      emptyFolder: 'U ovoj mapi nema ničega za odabir',
      folderError: 'Ova se mapa ne može pročitati',
      folderPath: 'Mapa'
    },
    hu: {
      customize: 'Testreszabás',
      settings: 'Beállítások',
      reset: 'Alapértékek',
      resetTitle: 'Minden alapérték visszaállítása',
      close: 'Bezárás (Esc)',
      search: 'Keresés a beállításokban',
      fps: 'Képkocka/másodperc korlát',
      unlimited: 'Korlátlan',
      volume: 'Hangerő',
      trust: 'Megbízom ebben a háttérképben (teljes kompatibilitás)',
      trustNote: 'Ekkor teljes hozzáféréssel fut a CasaOS-hez és a fiókodhoz. Csak megbízható háttérképeknél kapcsold be, ha ez hibásnak tűnik.',
      sound: 'Videó hangja',
      noSettings: 'Ennek a háttérképnek nincsenek beállításai.',
      scene: 'Jelenet: csak a Wallpaper Engine-ben fut',
      app: 'Alkalmazás: nem támogatott',
      unsupported: 'Nem támogatott',
      schemeColor: 'Sémaszín',
      hue: 'Színárnyalat',
      shade: 'Telítettség és fényerő',
      eyedropper: 'Szín felvétele a képernyőről',
      hex: 'Hexadecimális szín',
      choose: 'Kiválasztás…',
      remove: 'Eltávolítás',
      upFolder: 'Egy mappával feljebb',
      useFolder: 'Ennek a mappának a használata',
      emptyFolder: 'Ebben a mappában nincs mit kiválasztani',
      folderError: 'Ez a mappa nem olvasható',
      folderPath: 'Mappa'
    },
    id: {
      customize: 'Sesuaikan',
      settings: 'Pengaturan',
      reset: 'Bawaan',
      resetTitle: 'Pulihkan semua nilai bawaan',
      close: 'Tutup (Esc)',
      search: 'Cari pengaturan',
      fps: 'Batas bingkai per detik',
      unlimited: 'Tanpa batas',
      volume: 'Volume',
      trust: 'Percayai wallpaper ini (kompatibilitas penuh)',
      trustNote: 'Wallpaper akan berjalan dengan akses penuh ke CasaOS dan akun Anda. Aktifkan hanya untuk wallpaper yang Anda percayai, jika yang ini tampak rusak.',
      sound: 'Suara video',
      noSettings: 'Wallpaper ini tidak memiliki pengaturan.',
      scene: 'Scene: hanya berjalan di Wallpaper Engine',
      app: 'Aplikasi: tidak didukung',
      unsupported: 'Tidak didukung',
      schemeColor: 'Warna skema',
      hue: 'Rona',
      shade: 'Saturasi dan kecerahan',
      eyedropper: 'Ambil warna dari layar',
      hex: 'Warna heksadesimal',
      choose: 'Pilih…',
      remove: 'Hapus',
      upFolder: 'Naik satu folder',
      useFolder: 'Gunakan folder ini',
      emptyFolder: 'Tidak ada yang bisa dipilih di folder ini',
      folderError: 'Folder ini tidak dapat dibaca',
      folderPath: 'Folder'
    },
    it: {
      customize: 'Personalizza',
      settings: 'Impostazioni',
      reset: 'Predefiniti',
      resetTitle: 'Ripristina tutti i valori predefiniti',
      close: 'Chiudi (Esc)',
      search: 'Cerca nelle impostazioni',
      fps: 'Limite di fotogrammi al secondo',
      unlimited: 'Nessun limite',
      volume: 'Volume',
      trust: 'Considera attendibile questo sfondo (compatibilità totale)',
      trustNote: 'Così viene eseguito con pieno accesso a CasaOS e al tuo account. Attivalo solo per gli sfondi di cui ti fidi, se questo sembra non funzionare.',
      sound: 'Audio del video',
      noSettings: 'Questo sfondo non ha impostazioni.',
      scene: 'Scena: funziona solo in Wallpaper Engine',
      app: 'Applicazione: non supportata',
      unsupported: 'Non supportato',
      schemeColor: 'Colore dello schema',
      hue: 'Tonalità',
      shade: 'Saturazione e luminosità',
      eyedropper: 'Preleva un colore dallo schermo',
      hex: 'Colore esadecimale',
      choose: 'Scegli…',
      remove: 'Rimuovi',
      upFolder: 'Cartella superiore',
      useFolder: 'Usa questa cartella',
      emptyFolder: 'Niente da scegliere in questa cartella',
      folderError: 'Impossibile leggere questa cartella',
      folderPath: 'Cartella'
    },
    ja: {
      customize: 'カスタマイズ',
      settings: '設定',
      reset: 'デフォルト',
      resetTitle: 'すべての値をデフォルトに戻す',
      close: '閉じる（Esc）',
      search: '設定を検索',
      fps: 'フレームレート上限',
      unlimited: '無制限',
      volume: '音量',
      trust: 'この壁紙を信頼する（完全な互換性）',
      trustNote: 'CasaOS とあなたのアカウントにフルアクセスできる状態で実行されます。この壁紙が正しく動かない場合に、信頼できる壁紙だけでオンにしてください。',
      sound: '動画の音声',
      noSettings: 'この壁紙には設定がありません。',
      scene: 'シーン：Wallpaper Engine でのみ動作',
      app: 'アプリケーション：非対応',
      unsupported: '非対応',
      schemeColor: 'スキームカラー',
      hue: '色相',
      shade: '彩度と明度',
      eyedropper: '画面から色を取得',
      hex: '16 進数カラー',
      choose: '選択…',
      remove: '削除',
      upFolder: '1つ上のフォルダー',
      useFolder: 'このフォルダーを使用',
      emptyFolder: 'このフォルダーには選択できるものがありません',
      folderError: 'このフォルダーを読み込めません',
      folderPath: 'フォルダー'
    },
    ko: {
      customize: '사용자 지정',
      settings: '설정',
      reset: '기본값',
      resetTitle: '모든 기본값 복원',
      close: '닫기 (Esc)',
      search: '설정 검색',
      fps: '초당 프레임 제한',
      unlimited: '제한 없음',
      volume: '음량',
      trust: '이 배경화면 신뢰 (완전 호환)',
      trustNote: 'CasaOS와 계정에 대한 전체 권한으로 실행됩니다. 이 배경화면이 제대로 표시되지 않을 때, 신뢰하는 배경화면에만 켜세요.',
      sound: '동영상 소리',
      noSettings: '이 배경화면에는 설정이 없습니다.',
      scene: '씬: Wallpaper Engine에서만 실행',
      app: '애플리케이션: 지원되지 않음',
      unsupported: '지원되지 않음',
      schemeColor: '구성표 색상',
      hue: '색조',
      shade: '채도 및 밝기',
      eyedropper: '화면에서 색 가져오기',
      hex: '16진수 색상',
      choose: '선택…',
      remove: '제거',
      upFolder: '상위 폴더',
      useFolder: '이 폴더 사용',
      emptyFolder: '이 폴더에는 선택할 항목이 없습니다',
      folderError: '이 폴더를 읽을 수 없습니다',
      folderPath: '폴더'
    },
    nl: {
      customize: 'Aanpassen',
      settings: 'Instellingen',
      reset: 'Standaard',
      resetTitle: 'Alle standaardwaarden herstellen',
      close: 'Sluiten (Esc)',
      search: 'Instellingen doorzoeken',
      fps: 'Limiet beelden per seconde',
      unlimited: 'Onbeperkt',
      volume: 'Volume',
      trust: 'Deze achtergrond vertrouwen (volledige compatibiliteit)',
      trustNote: 'Hij draait dan met volledige toegang tot CasaOS en je account. Zet dit alleen aan voor achtergronden die je vertrouwt, als deze kapot lijkt.',
      sound: 'Videogeluid',
      noSettings: 'Deze achtergrond heeft geen instellingen.',
      scene: 'Scène: werkt alleen in Wallpaper Engine',
      app: 'Toepassing: niet ondersteund',
      unsupported: 'Niet ondersteund',
      schemeColor: 'Schemakleur',
      hue: 'Tint',
      shade: 'Verzadiging en helderheid',
      eyedropper: 'Kleur van het scherm kiezen',
      hex: 'Hexkleur',
      choose: 'Kiezen…',
      remove: 'Verwijderen',
      upFolder: 'Eén map omhoog',
      useFolder: 'Deze map gebruiken',
      emptyFolder: 'Niets te kiezen in deze map',
      folderError: 'Deze map kan niet worden gelezen',
      folderPath: 'Map'
    },
    no: {
      customize: 'Tilpass',
      settings: 'Innstillinger',
      reset: 'Standard',
      resetTitle: 'Gjenopprett alle standardverdier',
      close: 'Lukk (Esc)',
      search: 'Søk i innstillingene',
      fps: 'Grense for bilder per sekund',
      unlimited: 'Ubegrenset',
      volume: 'Volum',
      trust: 'Stol på dette bakgrunnsbildet (full kompatibilitet)',
      trustNote: 'Det kjører da med full tilgang til CasaOS og kontoen din. Slå det bare på for bakgrunner du stoler på, hvis denne ser ødelagt ut.',
      sound: 'Videolyd',
      noSettings: 'Dette bakgrunnsbildet har ingen innstillinger.',
      scene: 'Scene: kjører bare i Wallpaper Engine',
      app: 'Program: støttes ikke',
      unsupported: 'Støttes ikke',
      schemeColor: 'Skjemafarge',
      hue: 'Fargetone',
      shade: 'Metning og lysstyrke',
      eyedropper: 'Hent en farge fra skjermen',
      hex: 'Heksadesimal farge',
      choose: 'Velg…',
      remove: 'Fjern',
      upFolder: 'Én mappe opp',
      useFolder: 'Bruk denne mappen',
      emptyFolder: 'Ingenting å velge i denne mappen',
      folderError: 'Denne mappen kan ikke leses',
      folderPath: 'Mappe'
    },
    pl: {
      customize: 'Dostosuj',
      settings: 'Ustawienia',
      reset: 'Domyślne',
      resetTitle: 'Przywróć wszystkie wartości domyślne',
      close: 'Zamknij (Esc)',
      search: 'Szukaj w ustawieniach',
      fps: 'Limit klatek na sekundę',
      unlimited: 'Bez limitu',
      volume: 'Głośność',
      trust: 'Ufaj tej tapecie (pełna zgodność)',
      trustNote: 'Będzie wtedy działać z pełnym dostępem do CasaOS i Twojego konta. Włącz tylko dla tapet, którym ufasz, jeśli ta wygląda na zepsutą.',
      sound: 'Dźwięk wideo',
      noSettings: 'Ta tapeta nie ma ustawień.',
      scene: 'Scena: działa tylko w Wallpaper Engine',
      app: 'Aplikacja: nieobsługiwana',
      unsupported: 'Nieobsługiwane',
      schemeColor: 'Kolor schematu',
      hue: 'Odcień',
      shade: 'Nasycenie i jasność',
      eyedropper: 'Pobierz kolor z ekranu',
      hex: 'Kolor szesnastkowy',
      choose: 'Wybierz…',
      remove: 'Usuń',
      upFolder: 'Folder wyżej',
      useFolder: 'Użyj tego folderu',
      emptyFolder: 'W tym folderze nie ma nic do wybrania',
      folderError: 'Nie można odczytać tego folderu',
      folderPath: 'Folder'
    },
    pt: {
      customize: 'Personalizar',
      settings: 'Configurações',
      reset: 'Padrão',
      resetTitle: 'Restaurar todos os valores padrão',
      close: 'Fechar (Esc)',
      search: 'Pesquisar nas configurações',
      fps: 'Limite de quadros por segundo',
      unlimited: 'Sem limite',
      volume: 'Volume',
      trust: 'Confiar neste wallpaper (compatibilidade total)',
      trustNote: 'Ele passa a rodar com acesso total ao CasaOS e à sua conta. Ative só para wallpapers em que você confia, se este parecer quebrado.',
      sound: 'Som do vídeo',
      noSettings: 'Este wallpaper não tem configurações.',
      scene: 'Scene: só funciona no Wallpaper Engine',
      app: 'Aplicativo: não suportado',
      unsupported: 'Não suportado',
      schemeColor: 'Cor do esquema',
      hue: 'Matiz',
      shade: 'Saturação e brilho',
      eyedropper: 'Pegar uma cor da tela',
      hex: 'Cor hexadecimal',
      choose: 'Escolher…',
      remove: 'Remover',
      upFolder: 'Subir uma pasta',
      useFolder: 'Usar esta pasta',
      emptyFolder: 'Nada para escolher nesta pasta',
      folderError: 'Não foi possível ler esta pasta',
      folderPath: 'Pasta'
    },
    'pt-pt': {
      settings: 'Definições',
      reset: 'Predefinições',
      resetTitle: 'Repor todos os valores predefinidos',
      trust: 'Confiar nesta imagem de fundo (compatibilidade total)',
      trustNote: 'Passa a ser executada com acesso total ao CasaOS e à sua conta. Ative apenas para imagens de fundo em que confia, se esta parecer avariada.',
      noSettings: 'Esta imagem de fundo não tem definições.',
      scene: 'Cena: só funciona no Wallpaper Engine',
      app: 'Aplicação: não suportada',
      search: 'Pesquisar nas definições',
      eyedropper: 'Escolher uma cor do ecrã'
    },
    ro: {
      customize: 'Personalizează',
      settings: 'Setări',
      reset: 'Implicite',
      resetTitle: 'Restabilește toate valorile implicite',
      close: 'Închide (Esc)',
      search: 'Caută în setări',
      fps: 'Limită de cadre pe secundă',
      unlimited: 'Fără limită',
      volume: 'Volum',
      trust: 'Ai încredere în acest fundal (compatibilitate totală)',
      trustNote: 'Va rula atunci cu acces complet la CasaOS și la contul dvs. Activați doar pentru fundalurile în care aveți încredere, dacă acesta pare defect.',
      sound: 'Sunetul videoclipului',
      noSettings: 'Acest fundal nu are setări.',
      scene: 'Scenă: rulează doar în Wallpaper Engine',
      app: 'Aplicație: neacceptată',
      unsupported: 'Neacceptat',
      schemeColor: 'Culoarea schemei',
      hue: 'Nuanță',
      shade: 'Saturație și luminozitate',
      eyedropper: 'Preia o culoare de pe ecran',
      hex: 'Culoare hexazecimală',
      choose: 'Alege…',
      remove: 'Elimină',
      upFolder: 'Un dosar mai sus',
      useFolder: 'Folosește acest dosar',
      emptyFolder: 'Nimic de ales în acest dosar',
      folderError: 'Acest dosar nu poate fi citit',
      folderPath: 'Dosar'
    },
    ru: {
      customize: 'Настроить',
      settings: 'Настройки',
      reset: 'По умолчанию',
      resetTitle: 'Восстановить все значения по умолчанию',
      close: 'Закрыть (Esc)',
      search: 'Поиск по настройкам',
      fps: 'Ограничение кадров в секунду',
      unlimited: 'Без ограничения',
      volume: 'Громкость',
      trust: 'Доверять этим обоям (полная совместимость)',
      trustNote: 'Тогда они работают с полным доступом к CasaOS и вашей учётной записи. Включайте только для обоев, которым доверяете, если эти выглядят сломанными.',
      sound: 'Звук видео',
      noSettings: 'У этих обоев нет настроек.',
      scene: 'Сцена: работает только в Wallpaper Engine',
      app: 'Приложение: не поддерживается',
      unsupported: 'Не поддерживается',
      schemeColor: 'Цвет схемы',
      hue: 'Оттенок',
      shade: 'Насыщенность и яркость',
      eyedropper: 'Взять цвет с экрана',
      hex: 'Шестнадцатеричный цвет',
      choose: 'Выбрать…',
      remove: 'Убрать',
      upFolder: 'На уровень выше',
      useFolder: 'Использовать эту папку',
      emptyFolder: 'В этой папке нечего выбрать',
      folderError: 'Не удалось прочитать эту папку',
      folderPath: 'Папка'
    },
    sk: {
      customize: 'Prispôsobiť',
      settings: 'Nastavenia',
      reset: 'Predvolené',
      resetTitle: 'Obnoviť všetky predvolené hodnoty',
      close: 'Zavrieť (Esc)',
      search: 'Hľadať v nastaveniach',
      fps: 'Obmedzenie snímok za sekundu',
      unlimited: 'Bez obmedzenia',
      volume: 'Hlasitosť',
      trust: 'Dôverovať tejto tapete (plná kompatibilita)',
      trustNote: 'Potom pobeží s plným prístupom k CasaOS a k vášmu účtu. Zapnite len pri tapetách, ktorým dôverujete, ak táto vyzerá pokazene.',
      sound: 'Zvuk videa',
      noSettings: 'Táto tapeta nemá žiadne nastavenia.',
      scene: 'Scéna: funguje len vo Wallpaper Engine',
      app: 'Aplikácia: nepodporovaná',
      unsupported: 'Nepodporované',
      schemeColor: 'Farba schémy',
      hue: 'Odtieň',
      shade: 'Sýtosť a jas',
      eyedropper: 'Vybrať farbu z obrazovky',
      hex: 'Farba v šestnástkovom zápise',
      choose: 'Vybrať…',
      remove: 'Odstrániť',
      upFolder: 'O priečinok vyššie',
      useFolder: 'Použiť tento priečinok',
      emptyFolder: 'V tomto priečinku nie je čo vybrať',
      folderError: 'Tento priečinok sa nedá prečítať',
      folderPath: 'Priečinok'
    },
    sl: {
      customize: 'Prilagodi',
      settings: 'Nastavitve',
      reset: 'Privzeto',
      resetTitle: 'Obnovi vse privzete vrednosti',
      close: 'Zapri (Esc)',
      search: 'Iskanje po nastavitvah',
      fps: 'Omejitev sličic na sekundo',
      unlimited: 'Brez omejitve',
      volume: 'Glasnost',
      trust: 'Zaupaj temu ozadju (popolna združljivost)',
      trustNote: 'Takrat deluje s polnim dostopom do CasaOS in vašega računa. Vklopite le za ozadja, ki jim zaupate, če je to videti pokvarjeno.',
      sound: 'Zvok videa',
      noSettings: 'To ozadje nima nastavitev.',
      scene: 'Prizor: deluje samo v Wallpaper Engine',
      app: 'Aplikacija: ni podprta',
      unsupported: 'Ni podprto',
      schemeColor: 'Barva sheme',
      hue: 'Odtenek',
      shade: 'Nasičenost in svetlost',
      eyedropper: 'Izberi barvo z zaslona',
      hex: 'Šestnajstiška barva',
      choose: 'Izberi…',
      remove: 'Odstrani',
      upFolder: 'Eno mapo višje',
      useFolder: 'Uporabi to mapo',
      emptyFolder: 'V tej mapi ni ničesar za izbiro',
      folderError: 'Te mape ni mogoče prebrati',
      folderPath: 'Mapa'
    },
    sv: {
      customize: 'Anpassa',
      settings: 'Inställningar',
      reset: 'Standard',
      resetTitle: 'Återställ alla standardvärden',
      close: 'Stäng (Esc)',
      search: 'Sök i inställningarna',
      fps: 'Gräns för bildrutor per sekund',
      unlimited: 'Obegränsat',
      volume: 'Volym',
      trust: 'Lita på den här bakgrunden (full kompatibilitet)',
      trustNote: 'Den körs då med full åtkomst till CasaOS och ditt konto. Slå bara på för bakgrunder du litar på, om den här ser trasig ut.',
      sound: 'Videoljud',
      noSettings: 'Den här bakgrunden har inga inställningar.',
      scene: 'Scen: körs bara i Wallpaper Engine',
      app: 'Program: stöds inte',
      unsupported: 'Stöds inte',
      schemeColor: 'Schemafärg',
      hue: 'Nyans',
      shade: 'Mättnad och ljusstyrka',
      eyedropper: 'Hämta en färg från skärmen',
      hex: 'Hexfärg',
      choose: 'Välj…',
      remove: 'Ta bort',
      upFolder: 'En mapp upp',
      useFolder: 'Använd den här mappen',
      emptyFolder: 'Inget att välja i den här mappen',
      folderError: 'Den här mappen kan inte läsas',
      folderPath: 'Mapp'
    },
    tr: {
      customize: 'Özelleştir',
      settings: 'Ayarlar',
      reset: 'Varsayılanlar',
      resetTitle: 'Tüm varsayılan değerleri geri yükle',
      close: 'Kapat (Esc)',
      search: 'Ayarlarda ara',
      fps: 'Saniyedeki kare sınırı',
      unlimited: 'Sınırsız',
      volume: 'Ses düzeyi',
      trust: 'Bu duvar kâğıdına güven (tam uyumluluk)',
      trustNote: 'Bu durumda CasaOS\'a ve hesabınıza tam erişimle çalışır. Yalnızca güvendiğiniz duvar kâğıtlarında, bu bozuk görünüyorsa açın.',
      sound: 'Video sesi',
      noSettings: 'Bu duvar kâğıdının ayarı yok.',
      scene: 'Sahne: yalnızca Wallpaper Engine\'de çalışır',
      app: 'Uygulama: desteklenmiyor',
      unsupported: 'Desteklenmiyor',
      schemeColor: 'Şema rengi',
      hue: 'Ton',
      shade: 'Doygunluk ve parlaklık',
      eyedropper: 'Ekrandan renk al',
      hex: 'Onaltılık renk',
      choose: 'Seç…',
      remove: 'Kaldır',
      upFolder: 'Bir klasör yukarı',
      useFolder: 'Bu klasörü kullan',
      emptyFolder: 'Bu klasörde seçilecek bir şey yok',
      folderError: 'Bu klasör okunamıyor',
      folderPath: 'Klasör'
    },
    uk: {
      customize: 'Налаштувати',
      settings: 'Налаштування',
      reset: 'За замовчуванням',
      resetTitle: 'Відновити всі значення за замовчуванням',
      close: 'Закрити (Esc)',
      search: 'Пошук у налаштуваннях',
      fps: 'Обмеження кадрів за секунду',
      unlimited: 'Без обмеження',
      volume: 'Гучність',
      trust: 'Довіряти цим шпалерам (повна сумісність)',
      trustNote: 'Тоді вони працюють із повним доступом до CasaOS і вашого облікового запису. Вмикайте лише для шпалер, яким довіряєте, якщо ці виглядають зламаними.',
      sound: 'Звук відео',
      noSettings: 'Ці шпалери не мають налаштувань.',
      scene: 'Сцена: працює лише у Wallpaper Engine',
      app: 'Застосунок: не підтримується',
      unsupported: 'Не підтримується',
      schemeColor: 'Колір схеми',
      hue: 'Відтінок',
      shade: 'Насиченість і яскравість',
      eyedropper: 'Взяти колір з екрана',
      hex: 'Шістнадцятковий колір',
      choose: 'Вибрати…',
      remove: 'Прибрати',
      upFolder: 'На рівень вище',
      useFolder: 'Використати цю папку',
      emptyFolder: 'У цій папці нічого вибрати',
      folderError: 'Не вдалося прочитати цю папку',
      folderPath: 'Папка'
    },
    vi: {
      customize: 'Tùy chỉnh',
      settings: 'Cài đặt',
      reset: 'Mặc định',
      resetTitle: 'Khôi phục mọi giá trị mặc định',
      close: 'Đóng (Esc)',
      search: 'Tìm trong cài đặt',
      fps: 'Giới hạn khung hình mỗi giây',
      unlimited: 'Không giới hạn',
      volume: 'Âm lượng',
      trust: 'Tin cậy hình nền này (tương thích đầy đủ)',
      trustNote: 'Khi đó hình nền chạy với toàn quyền truy cập CasaOS và tài khoản của bạn. Chỉ bật cho hình nền bạn tin cậy, nếu hình nền này có vẻ bị lỗi.',
      sound: 'Âm thanh video',
      noSettings: 'Hình nền này không có cài đặt.',
      scene: 'Scene: chỉ chạy trong Wallpaper Engine',
      app: 'Ứng dụng: không được hỗ trợ',
      unsupported: 'Không được hỗ trợ',
      schemeColor: 'Màu lược đồ',
      hue: 'Sắc độ',
      shade: 'Độ bão hòa và độ sáng',
      eyedropper: 'Lấy màu từ màn hình',
      hex: 'Màu hex',
      choose: 'Chọn…',
      remove: 'Xóa',
      upFolder: 'Lên một thư mục',
      useFolder: 'Dùng thư mục này',
      emptyFolder: 'Không có gì để chọn trong thư mục này',
      folderError: 'Không thể đọc thư mục này',
      folderPath: 'Thư mục'
    },
    'zh-cn': {
      customize: '自定义',
      settings: '设置',
      reset: '默认',
      resetTitle: '恢复所有默认值',
      close: '关闭（Esc）',
      search: '搜索设置',
      fps: '帧率上限',
      unlimited: '不限制',
      volume: '音量',
      trust: '信任此壁纸（完全兼容）',
      trustNote: '开启后它将拥有对 CasaOS 和你账户的完全访问权限。仅在此壁纸显示异常时，为你信任的壁纸开启。',
      sound: '视频声音',
      noSettings: '此壁纸没有设置。',
      scene: '场景：只能在 Wallpaper Engine 中运行',
      app: '应用程序：不支持',
      unsupported: '不支持',
      schemeColor: '方案颜色',
      hue: '色相',
      shade: '饱和度和亮度',
      eyedropper: '从屏幕取色',
      hex: '十六进制颜色',
      choose: '选择…',
      remove: '移除',
      upFolder: '上一级文件夹',
      useFolder: '使用此文件夹',
      emptyFolder: '此文件夹中没有可选择的内容',
      folderError: '无法读取此文件夹',
      folderPath: '文件夹'
    },
    'zh-tw': {
      customize: '自訂',
      settings: '設定',
      reset: '預設值',
      resetTitle: '還原所有預設值',
      close: '關閉（Esc）',
      search: '搜尋設定',
      fps: '影格率上限',
      unlimited: '不限制',
      volume: '音量',
      trust: '信任此桌布（完全相容）',
      trustNote: '開啟後它將擁有對 CasaOS 和你帳戶的完整存取權限。僅在此桌布顯示異常時，為你信任的桌布開啟。',
      sound: '影片聲音',
      noSettings: '此桌布沒有設定。',
      scene: '場景：只能在 Wallpaper Engine 中執行',
      app: '應用程式：不支援',
      unsupported: '不支援',
      schemeColor: '配色顏色',
      hue: '色相',
      shade: '飽和度與亮度',
      eyedropper: '從螢幕取色',
      hex: '十六進位色彩',
      choose: '選擇…',
      remove: '移除',
      upFolder: '上一層資料夾',
      useFolder: '使用此資料夾',
      emptyFolder: '此資料夾中沒有可選擇的項目',
      folderError: '無法讀取此資料夾',
      folderPath: '資料夾'
    }
  };

  // CasaOS code (pt_br, zh_tw, no_no…) or browser code → a key of TEXT
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

  // Wallpaper Engine language codes (project.json localization, applyGeneralProperties)
  var WE_LANG = {
    en: 'en-us', ar: 'ar-sa', be: 'be-by', bg: 'bg-bg', ca: 'ca-es', cs: 'cs-cz', de: 'de-de', el: 'el-gr',
    es: 'es-es', fr: 'fr-fr', hr: 'hr-hr', hu: 'hu-hu', id: 'id-id', it: 'it-it', ja: 'ja-jp', ko: 'ko-kr',
    nl: 'nl-nl', no: 'nb-no', pl: 'pl-pl', pt: 'pt-br', 'pt-pt': 'pt-pt', ro: 'ro-ro', ru: 'ru-ru', sk: 'sk-sk',
    sl: 'sl-si', sv: 'sv-se', tr: 'tr-tr', uk: 'uk-ua', vi: 'vi-vn', 'zh-cn': 'zh-chs', 'zh-tw': 'zh-cht'
  };

  // ---------------------------------------------------------------------------
  // Settings of each wallpaper (this browser)
  // ---------------------------------------------------------------------------
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }

  function settingsOf(id) {
    var s = loadAll()[id] || {};
    return {
      props: s.props && typeof s.props === 'object' ? s.props : {},
      trusted: !!s.trusted,
      fps: s.fps === '30' || s.fps === '60' ? s.fps : '0',
      sound: !!s.sound,
      volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : 0.5,
      open: s.open && typeof s.open === 'object' ? s.open : {}   // settings sections opened in the panel
    };
  }

  function saveSettings(id, s) {
    var all = loadAll();
    all[id] = s;
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) { /* private mode: not kept */ }
  }

  // ---------------------------------------------------------------------------
  // CasaOS API (the folder listing needs the session)
  // ---------------------------------------------------------------------------
  function token() {
    try {
      var vm = document.querySelector('#app').__vue__;
      return (vm && vm.$store && vm.$store.state.access_token) || localStorage.getItem('access_token') || '';
    } catch (e) {
      return localStorage.getItem('access_token') || '';
    }
  }

  function listFolder(path) {
    return fetch('/v1/folder?path=' + encodeURIComponent(path), {
      headers: { Authorization: token(), Accept: 'application/json' },
      credentials: 'include'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.data || !Array.isArray(j.data.content)) throw new Error('bad response');
      return j.data.content;
    });
  }

  // ---------------------------------------------------------------------------
  // Catalog: what is in the wallpapers folder
  // ---------------------------------------------------------------------------
  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function urlOf(id, file) {
    return WALL_URL + encodeURIComponent(id) + '/' + String(file || '').split('/').map(encodeURIComponent).join('/');
  }

  function pretty(name) {
    return name.replace(VIDEO_EXT, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function looseVideo(name, size) {
    return {
      id: name, title: pretty(name), type: 'video', supported: true, reason: '', project: null,
      file: WALL_URL + encodeURIComponent(name), base: WALL_URL, preview: null, size: size || 0
    };
  }

  function fromProject(id, p) {
    var type = String(p.type || '').toLowerCase();
    var file = p.file || (type === 'web' ? 'index.html' : '');
    var supported = (type === 'web' || type === 'video') && !!file;
    return {
      id: id, title: String(p.title || id), type: type, project: p, size: 0,
      supported: supported,
      reason: supported ? '' : type === 'scene' ? t('scene') : type === 'application' ? t('app') : t('unsupported'),
      file: file ? urlOf(id, file) : null,
      base: urlOf(id, file.replace(/[^/]*$/, '')),
      preview: p.preview ? urlOf(id, p.preview) : null
    };
  }

  // No project.json: an index.html makes it a web wallpaper, else a video inside
  function fromFiles(id, files) {
    var names = files.filter(function (f) { return !f.is_dir; }).map(function (f) { return f.name; });
    var html = names.filter(function (n) { return /^index\.html?$/i.test(n); })[0];
    var video = files.filter(function (f) { return !f.is_dir && VIDEO_EXT.test(f.name); })[0];
    var image = names.filter(function (n) { return /^preview\./i.test(n) && IMAGE_EXT.test(n); })[0];
    var w = {
      id: id, title: pretty(id), type: html ? 'web' : video ? 'video' : 'unknown', project: null,
      supported: !!(html || video), reason: html || video ? '' : t('unsupported'),
      file: html ? urlOf(id, html) : video ? urlOf(id, video.name) : null,
      base: urlOf(id, ''), preview: image ? urlOf(id, image) : null, size: video && !html ? video.size || 0 : 0
    };
    return w;
  }

  var described = {};

  // A folder's project.json: null when there is none (or it can't be read as
  // JSON); a network error is thrown so the caller can try again
  function readProject(id) {
    return fetch(urlOf(id, 'project.json'), { cache: 'no-cache' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      if (text == null) return null;
      try {
        return JSON.parse(text.replace(/^﻿/, ''));   // files saved on Windows may start with a BOM
      } catch (e) {
        console.warn(TAG, id + '/project.json is not valid JSON', e.message);
        return null;
      }
    });
  }

  function describeFolder(id) {
    if (!described[id]) {
      described[id] = readProject(id).catch(function () {
        return readProject(id);   // once more after a network hiccup
      }).then(function (p) {
        if (p) return fromProject(id, p);
        return listFolder(WALL_DIR + '/' + id).then(function (files) { return fromFiles(id, files); });
      }).catch(function (e) {
        console.warn(TAG, 'cannot read wallpaper', id, e);
        delete described[id];
        return null;
      });
    }
    return described[id];
  }

  function describe(id) {
    return VIDEO_EXT.test(id) && id.indexOf('/') < 0
      ? Promise.resolve(looseVideo(id, 0))
      : describeFolder(id);
  }

  // The whole folder, read again each time the wallpaper menu opens
  function loadCatalog() {
    described = {};
    return listFolder(WALL_DIR).then(function (entries) {
      entries = entries.filter(function (e) { return e.name.charAt(0) !== '.'; })
        .sort(function (a, b) { return collator.compare(a.name, b.name); });
      return Promise.all(entries.map(function (e) {
        if (e.is_dir) return describeFolder(e.name);
        return VIDEO_EXT.test(e.name) ? looseVideo(e.name, e.size) : null;
      }));
    }).then(function (list) {
      // the ones that run first, those that can't at the end (in folder order)
      return list.filter(Boolean).sort(function (a, b) { return (b.supported ? 1 : 0) - (a.supported ? 1 : 0); });
    }).catch(function (e) {
      console.info(TAG, 'no wallpapers folder at ' + WALL_DIR, e.message);
      return [];
    });
  }

  // CasaOS keeps a chosen wallpaper as an image path: the preview (a useful
  // still if this mod is ever removed), or the wallpaper's own file
  function pathOf(w) { return w.preview || w.file; }

  function idOf(path) {
    if (typeof path !== 'string') return null;
    var i = path.indexOf(WALL_URL);
    if (i < 0) return null;
    var first = path.slice(i + WALL_URL.length).split(/[?#]/)[0].split('/')[0];
    try { return first ? decodeURIComponent(first) : null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------------
  // The layer behind the CasaOS UI, on the level of CasaOS's own background
  // ---------------------------------------------------------------------------
  var layer = document.createElement('div');
  layer.id = 'lw-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(layer, document.body.firstChild);

  var selectedId = idOf(localStorage.getItem('wallpaper'));
  var store = null;
  var current = null;       // the mounted wallpaper
  var targetId = null;      // the one being mounted (or mounted)
  var generation = 0;
  var visible = false;
  var loading = false;      // the chosen one is being read (its project.json)
  var frame = null, video = null, blobUrl = null;
  var settings = null;
  var wantsAudio = false, audioTimer = null, wantsMedia = false;

  function unmount() {
    generation++;
    loading = false;
    if (audioTimer) { clearInterval(audioTimer); audioTimer = null; }
    wantsAudio = false;
    announce();
    wantsMedia = false;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    layer.textContent = '';
    frame = video = current = null;
    closePanel();
  }

  function switchTo(id) {
    unmount();
    targetId = id;
    if (!id) { update(); return Promise.resolve(); }
    var gen = generation;
    loading = true;
    update();
    return describe(id).then(function (w) {
      if (gen !== generation) return;
      loading = false;
      if (w && w.supported) mount(w);
      update();
    }, function () {
      if (gen !== generation) return;
      loading = false;
      update();
    });
  }

  function mount(w) {
    current = w;
    settings = settingsOf(w.id);
    if (w.type === 'video') mountVideo(w);
    else mountWeb(w);
  }

  // Shown on the dashboard (where CasaOS shows its background) while chosen
  function update() {
    var bg = document.getElementById('background');
    var show = !!(current && selectedId === current.id && bg);
    // While the chosen one is read, CasaOS's own background stays hidden too (no flash of it)
    var pending = !!(bg && loading && selectedId && targetId === selectedId);
    document.documentElement.classList.toggle('lw-on', show || pending);
    if (show !== visible) {
      visible = show;
      if (frame) post('paused', !show);
      if (video) { if (show) play(); else video.pause(); }
    }
    injectRow();
  }

  function sync() {
    if (selectedId !== targetId) switchTo(selectedId);
    else update();
  }

  // ---------------------------------------------------------------------------
  // Video wallpapers. The browser plays them; a file up to the memory setting
  // (100 MB unless set) is fetched once and looped from memory, a bigger one is streamed.
  // ---------------------------------------------------------------------------
  function sizeOf(w) {
    if (w.size) return Promise.resolve(w.size);
    return fetch(w.file, { method: 'HEAD' }).then(function (r) {
      return Number(r.headers.get('Content-Length')) || 0;
    }).catch(function () { return 0; });
  }

  function mountVideo(w) {
    var gen = generation;
    video = document.createElement('video');
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    applySound();
    layer.appendChild(video);
    Promise.all([sizeOf(w), configured]).then(function (got) {
      var size = got[0];
      if (gen !== generation) return;
      if (!size || size > config.memory * 1024 * 1024) return stream();
      fetch(w.file).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(function (blob) {
        if (gen !== generation) return;
        blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        if (visible) play();
      }).catch(stream);
    });
    function stream() {
      if (gen !== generation) return;
      video.src = w.file;
      if (visible) play();
    }
  }

  function applySound() {
    if (!video) return;
    video.muted = !settings.sound;
    video.volume = settings.volume;
  }

  // Sound needs a user gesture first: start muted, unmute on the first one
  function play() {
    if (!video || !video.src) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      video.muted = true;
      video.play().catch(function () {});
    });
  }
  window.addEventListener('pointerdown', function () {
    if (video && settings && settings.sound && video.muted) video.muted = false;
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (!video || !visible) return;
    if (document.hidden) video.pause(); else play();
  });

  // ---------------------------------------------------------------------------
  // Web wallpapers: the page goes into an iframe through srcdoc, with a <base>
  // pointing at its folder and, first of all, a small script that provides the
  // Wallpaper Engine web API and talks to this page through postMessage. Not
  // trusted: sandbox="allow-scripts" (an opaque origin: no access to CasaOS,
  // its storage or its session). Trusted: same origin, full compatibility.
  // ---------------------------------------------------------------------------
  function shim() {
    var audio = [];
    function post(m) {
      m.lw = 1;
      try { parent.postMessage(m, '*'); } catch (e) { /* detached */ }
    }
    window.wallpaperRegisterAudioListener = function (cb) {
      if (typeof cb !== 'function') return;
      audio.push(cb);
      post({ t: 'audio' });
    };
    // Media integration: what plays in the CasaOS tab (title, cover, state, time)
    var media = { status: [], properties: [], thumbnail: [], playback: [], timeline: [] };
    window.wallpaperMediaIntegration = { PLAYBACK_STOPPED: 0, PLAYBACK_PLAYING: 1, PLAYBACK_PAUSED: 2 };
    [['Status', 'status'], ['Properties', 'properties'], ['Thumbnail', 'thumbnail'], ['Playback', 'playback'],
      ['Timeline', 'timeline']].forEach(function (n) {
      window['wallpaperRegisterMedia' + n[0] + 'Listener'] = function (cb) {
        if (typeof cb !== 'function') return;
        media[n[1]].push(cb);
        post({ t: 'media' });
      };
    });
    // Files the user picked ("file" and "directory" properties). Wallpapers load
    // them as 'file:///' + value, which can't load here: wherever the wallpaper
    // puts such a URL (src, CSS, fetch…), it is swapped for the file itself,
    // which the page sends over (only what the user picked). Until it arrives
    // nothing is set, so there is no failed load in between.
    var files = {}, order = [], waiting = {}, denied = {}, randoms = {}, randomId = 0, filesOn = false;
    var known = {};   // the picked files and the folders' files: a bare path to one is a file too
    var reqs = new WeakMap(), ticket = 0, xhrs = new WeakMap();
    var KEEP = 512 * 1024 * 1024;   // object URLs kept for directory files, then the oldest go
    var setAttr = Element.prototype.setAttribute;

    // 'file:///DATA/a.jpg', 'file:////DATA/a.jpg' ('file:///' + the value),
    // 'file:///DATA/My%20a.jpg', '/DATA/a.jpg' → 'DATA/a.jpg'
    function norm(s) {
      var k = String(s).replace(/^\s*(file:)?\/*/i, '');
      if (!k || files[k] || waiting[k] || known[k]) return k;
      try { return decodeURIComponent(k); } catch (e) { return k; }
    }

    function keyOf(s) {
      if (typeof s !== 'string' && !(s instanceof URL)) return null;
      s = String(s);
      if (/^\s*file:/i.test(s)) return norm(s) || null;
      // the value used as it is: only a path to a picked file (never //host/…)
      if (/^\/[^/]/.test(s)) {
        var k = norm(s);
        return files[k] || known[k] ? k : null;
      }
      return null;
    }

    function touch(key) {
      var i = order.indexOf(key);
      if (i >= 0) order.splice(i, 1);
      order.push(key);
    }

    function keep(key, f) {
      if (files[key]) { if (f.blob) return; URL.revokeObjectURL(files[key].url); }
      files[key] = f.blob ? { url: URL.createObjectURL(f.blob), size: f.blob.size, own: true } : { url: f.url, size: 0 };
      touch(key);
      var total = 0;
      for (var i = 0; i < order.length; i++) total += files[order[i]].size;
      while (total > KEEP && order.length > 3) {
        var old = order.shift(), o = files[old];
        total -= o.size;
        if (o.own) URL.revokeObjectURL(o.url);
        delete files[old];
      }
    }

    function settle(key, ok) {
      var list = waiting[key] || [];
      delete waiting[key];
      for (var i = 0; i < list.length; i++) {
        try { if (ok) list[i].ok(files[key].url); else list[i].no(); } catch (e) { console.error(e); }
      }
    }

    // ok(url) now or when the file arrives; no() when it isn't one the user picked
    function resolve(key, ok, no) {
      if (files[key]) { touch(key); ok(files[key].url); return; }
      if (denied[key]) { no(); return; }
      if (!waiting[key]) {
        waiting[key] = [];
        post({ t: 'file', v: key });
      }
      waiting[key].push({ ok: ok, no: no });
    }

    // A URL attribute (src, poster, href): only the latest one asked for an element is set
    function urlSink(el, name, value, set) {
      var key = keyOf(value), mine = reqs.get(el) || {};
      mine[name] = key === null ? 0 : ++ticket;
      reqs.set(el, mine);
      if (key === null) return false;
      var t = mine[name];
      resolve(key, function (url) {
        if ((reqs.get(el) || {})[name] !== t) return;
        set(url);
        // a <source> added after its video gave up: the video looks again
        var v = el.parentNode;
        if (el.tagName === 'SOURCE' && v && v.load && !v.currentSrc) v.load();
      }, function () {
        if ((reqs.get(el) || {})[name] === t) set(String(value));   // fails like in Wallpaper Engine
      });
      return true;
    }

    [[window.HTMLImageElement, 'src'], [window.HTMLMediaElement, 'src'], [window.HTMLSourceElement, 'src'],
      [window.HTMLVideoElement, 'poster']].forEach(function (a) {
      var d = a[0] && Object.getOwnPropertyDescriptor(a[0].prototype, a[1]);
      if (!d || !d.set) return;
      Object.defineProperty(a[0].prototype, a[1], {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) {
          var el = this;
          if (!urlSink(el, a[1], v, function (u) { d.set.call(el, u); })) d.set.call(el, v);
        }
      });
    });

    Element.prototype.setAttribute = function (name, value) {
      var n = String(name).toLowerCase(), el = this;
      if ((n === 'src' || n === 'poster' || n === 'href') &&
          urlSink(el, n, value, function (u) { setAttr.call(el, name, u); })) return undefined;
      return setAttr.apply(el, arguments);
    };

    // CSS: url(file:…) swapped for the ones already here; again() when the others arrive
    var CSS_URL = /url\(\s*(['"]?)\s*(file:[^'")]*?)\s*\1\s*\)/gi;
    function cssFix(text, again) {
      if (typeof text !== 'string' || !/file:/i.test(text)) return text;
      return text.replace(CSS_URL, function (all, q, url) {
        var key = keyOf(url);
        if (key === null) return all;
        if (files[key]) { touch(key); return 'url("' + files[key].url + '")'; }
        resolve(key, again, function () {});
        return all;
      });
    }

    function fixAttr(el, name) {
      var v = el.getAttribute(name);
      if (!v || !/file:/i.test(v)) return;
      if (name !== 'style') {
        var key = keyOf(v);
        // a refused one stays as it is (setting it again would come back here)
        if (key !== null && !denied[key]) urlSink(el, name, v, function (u) { setAttr.call(el, name, u); });
        return;
      }
      var fixed = cssFix(v, function () { fixAttr(el, 'style'); });
      if (fixed !== v) setAttr.call(el, 'style', fixed);
    }

    function fixStyleSheet(el) {
      var v = el.textContent, fixed = cssFix(v, function () { fixStyleSheet(el); });
      if (fixed !== v) el.textContent = fixed;
    }

    function fixTree(root) {
      if (root.nodeType !== 1) return;
      if (root.tagName === 'STYLE') fixStyleSheet(root);
      ['src', 'poster', 'style'].forEach(function (a) { if (root.hasAttribute(a)) fixAttr(root, a); });
      var found = root.querySelectorAll('[src*="file:" i], [poster*="file:" i], [style*="file:" i], style');
      for (var i = 0; i < found.length; i++) {
        if (found[i].tagName === 'STYLE') fixStyleSheet(found[i]);
        else ['src', 'poster', 'style'].forEach(function (a) { if (found[i].hasAttribute(a)) fixAttr(found[i], a); });
      }
    }

    // Styles set any way (el.style.x = …, setProperty, jQuery, innerHTML,
    // <style> text) end up in the document: fixed there, before they are drawn.
    // Only once the wallpaper has a picked file or folder.
    function startFiles() {
      if (filesOn) return;
      filesOn = true;
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'attributes') fixAttr(m.target, m.attributeName);
          else {
            if (m.target.nodeName === 'STYLE') fixStyleSheet(m.target);
            for (var j = 0; j < m.addedNodes.length; j++) fixTree(m.addedNodes[j]);
          }
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'poster', 'style'] });
      if (document.documentElement) fixTree(document.documentElement);
    }

    var nativeFetch = window.fetch;
    if (nativeFetch) {
      window.fetch = function (input, init) {
        var key = keyOf(input instanceof Request ? input.url : input), self = this;
        if (key === null) return nativeFetch.apply(self, arguments);
        return new Promise(function (ok, fail) {
          resolve(key, function (url) { nativeFetch.call(self, url, init).then(ok, fail); },
            function () { fail(new TypeError('Failed to fetch')); });
        });
      };
    }

    var XHR = window.XMLHttpRequest && XMLHttpRequest.prototype;
    if (XHR) {
      var xOpen = XHR.open, xSend = XHR.send;
      XHR.open = function (method, url) {
        var args = Array.prototype.slice.call(arguments), key = keyOf(url);
        xhrs.delete(this);
        if (key !== null && files[key]) args[1] = files[key].url;
        else if (key !== null) xhrs.set(this, { key: key, args: args });   // opened again on send
        return xOpen.apply(this, args);
      };
      XHR.send = function () {
        var w = xhrs.get(this), x = this, rest = arguments;
        if (!w) return xSend.apply(x, rest);
        xhrs.delete(x);
        resolve(w.key, function (url) {
          w.args[1] = url;
          xOpen.apply(x, w.args);
          xSend.apply(x, rest);
        }, function () { xSend.apply(x, rest); });
      };
    }

    window.wallpaperRequestRandomFileForProperty = function (prop, cb) {
      if (typeof cb !== 'function') return;
      randoms[++randomId] = cb;
      post({ t: 'random', v: { prop: String(prop), id: randomId } });
    };

    function mouse(type, x, y, buttons) {
      var target = document.elementFromPoint(x, y) || document.body || document.documentElement;
      var init = {
        bubbles: true, cancelable: true, composed: true, view: window,
        clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: buttons
      };
      var ev = type.indexOf('pointer') === 0 && window.PointerEvent
        ? new PointerEvent(type, Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, init))
        : new MouseEvent(type, init);
      target.dispatchEvent(ev);
    }

    window.addEventListener('message', function (e) {
      if (e.source !== parent) return;
      var d = e.data;
      if (!d || d.lw !== 1) return;
      var l = window.wallpaperPropertyListener || {};
      try {
        if (d.t === 'audio') {
          for (var i = 0; i < audio.length; i++) audio[i](d.v);
        } else if (d.t === 'props') {
          if (l.applyUserProperties) l.applyUserProperties(d.v);
        } else if (d.t === 'general') {
          if (l.applyGeneralProperties) l.applyGeneralProperties(d.v);
        } else if (d.t === 'paused') {
          if (l.setPaused) l.setPaused(d.v);
        } else if (d.t === 'mouse') {
          d.v.types.forEach(function (type) { mouse(type, d.v.x, d.v.y, d.v.buttons); });
        } else if (d.t === 'media') {
          var cbs = media[d.v.kind] || [];
          for (var j = 0; j < cbs.length; j++) cbs[j](d.v.data);
        } else if (d.t === 'files') {
          startFiles();
          denied = {};   // the picks changed: what was refused may be allowed now
          (d.v || []).forEach(function (k) { known[k] = true; });
        } else if (d.t === 'file') {
          startFiles();
          if (d.v.denied) denied[d.v.key] = true;
          else keep(d.v.key, d.v);
          settle(d.v.key, !d.v.denied);
        } else if (d.t === 'dir') {
          (d.v.added || []).forEach(function (p) { known[norm(p)] = true; });
          if (d.v.removed && l.userDirectoryFilesRemoved) l.userDirectoryFilesRemoved(d.v.prop, d.v.removed);
          if (d.v.added && l.userDirectoryFilesAddedOrChanged) l.userDirectoryFilesAddedOrChanged(d.v.prop, d.v.added);
        } else if (d.t === 'random') {
          var cb = randoms[d.v.id];
          delete randoms[d.v.id];
          if (d.v.path) known[norm(d.v.path)] = true;
          if (d.v.file) { startFiles(); keep(norm(d.v.path), d.v.file); }
          if (cb) cb(d.v.prop, d.v.path || '');
        }
      } catch (err) {
        console.error(err);
      }
    });

    if (document.readyState === 'complete') post({ t: 'ready' });
    else window.addEventListener('load', function () { post({ t: 'ready' }); });
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // The wallpaper's HTML with <base> and the API script at the top of <head>
  function prepare(html, base) {
    var top = '<base href="' + escapeAttr(new URL(base, location.href).href) + '">' +
      '<script>(' + shim.toString() + ')();<\/script>';
    var m = /<head(\s[^>]*)?>/i.exec(html);
    if (m) return html.slice(0, m.index + m[0].length) + top + html.slice(m.index + m[0].length);
    m = /<html(\s[^>]*)?>/i.exec(html);
    if (m) return html.slice(0, m.index + m[0].length) + '<head>' + top + '</head>' + html.slice(m.index + m[0].length);
    m = /<!doctype[^>]*>/i.exec(html);
    if (m) return html.slice(0, m.index + m[0].length) + top + html.slice(m.index + m[0].length);
    return top + html;
  }

  function mountWeb(w) {
    var gen = generation;
    fetch(w.file, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (html) {
      if (gen !== generation) return;
      frame = document.createElement('iframe');
      frame.title = w.title;
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('allow', 'autoplay');
      if (!settings.trusted) frame.setAttribute('sandbox', 'allow-scripts');
      frame.srcdoc = prepare(html, w.base);
      layer.appendChild(frame);
    }).catch(function (e) {
      console.warn(TAG, 'cannot load', w.file, e);
    });
  }

  function post(type, value) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({ lw: 1, t: type, v: value }, '*');
  }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.lw !== 1) return;
    if (d.t === 'ready') {
      post('general', generalProps());
      dirSent = {};
      if (pickProps().length) {
        post('files', pickedFiles());
        prefetch();
      }
      post('props', allProps());
      post('paused', !visible);
      syncDirs();
    } else if (d.t === 'file' && typeof d.v === 'string') {
      askFile(d.v);
    } else if (d.t === 'random' && d.v) {
      randomFile(d.v);
    } else if (d.t === 'audio') {
      configured.then(function () {   // the settings may keep wallpapers from the sound, or from what plays
        if (!config.audio) return;
        wantsAudio = true;
        startAudio();
      });
    } else if (d.t === 'media') {
      configured.then(function () { if (config.media) startMedia(); });
    }
  });

  function generalProps() {
    var g = { language: WE_LANG[lang()] || 'en-us' };
    if (settings.fps !== '0') g.fps = Number(settings.fps);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Files and folders for web wallpapers (Wallpaper Engine "file" and
  // "directory" properties), picked in the panel from the CasaOS storage. The
  // wallpaper gets the absolute CasaOS path ('/DATA/Media/a.jpg', absolute like
  // Wallpaper Engine's 'C:/…': wallpapers that build their own URL treat a path
  // without the first slash as a file of their own folder) and asks for the
  // file itself through the shim (keys there have no first slash). It may read only what the user
  // picked: the picked files, and the images and videos right inside a picked
  // folder. An isolated wallpaper gets the file's content (the session never
  // reaches it); a trusted one, which has the session anyway, gets the CasaOS
  // URL, so a big video streams instead of loading whole first.
  // ---------------------------------------------------------------------------
  var giving = {}, dirSent = {}, dirCache = {}, lastRandom = {};

  function kindOf(p) { return String(p.type).toLowerCase(); }

  function pickProps() {
    return current ? propList(current).filter(function (p) {
      return kindOf(p) === 'file' || kindOf(p) === 'directory';
    }) : [];
  }

  // A path as a value: no leading slash, no empty or '.' parts; null when it climbs ('..')
  function cleanPath(path) {
    var parts = String(path == null ? '' : path).split('/').filter(function (s) { return s && s !== '.'; });
    return parts.indexOf('..') >= 0 ? null : parts.join('/');
  }

  function accepts(p, name) {
    var type = String(p.fileType || '').toLowerCase();
    return type === 'image' ? IMAGE_EXT.test(name) : type === 'video' ? VIDEO_EXT.test(name)
      : IMAGE_EXT.test(name) || VIDEO_EXT.test(name);
  }

  // What the user picked for it: never the project's default (a wallpaper
  // can't name a file of the server by itself)
  function picked(p) {
    var v = settings.props[p.key];
    return typeof v === 'string' ? cleanPath(v) || '' : '';
  }

  function allowed(path) {
    var dir = path.replace(/\/?[^/]*$/, ''), name = path.slice(path.lastIndexOf('/') + 1);
    return pickProps().some(function (p) {
      var v = picked(p);
      return !!v && accepts(p, name) && (kindOf(p) === 'file' ? v === path : v === dir);
    });
  }

  // The picked files, for the shim
  function pickedFiles() {
    return pickProps().filter(function (p) { return kindOf(p) === 'file' && picked(p); }).map(picked);
  }

  function casaFile(path) {
    return '/v1/file?path=' + encodeURIComponent('/' + path) + '&token=' + encodeURIComponent(token());
  }

  // The file for the shim: { url } (trusted), { blob }, or { denied } when it can't be read
  function give(path) {
    if (settings.trusted) return Promise.resolve({ url: new URL(casaFile(path), location.href).href });
    if (!giving[path]) {
      var p = giving[path] = fetch(casaFile(path)).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(function (blob) {
        return { blob: blob };
      }, function (e) {
        console.warn(TAG, 'cannot read /' + path, e.message);
        return { denied: true };
      });
      p.then(function () { if (giving[path] === p) delete giving[path]; });   // only shares one in flight
    }
    return giving[path];
  }

  function askFile(key) {
    var gen = generation, path = cleanPath(key);
    (path && allowed(path) ? give(path) : Promise.resolve({ denied: true })).then(function (f) {
      if (gen === generation) post('file', Object.assign({ key: key }, f));
    });
  }

  // The picked files, sent before the wallpaper asks for them
  function prefetch() {
    var gen = generation;
    pickProps().forEach(function (p) {
      var v = picked(p);
      if (kindOf(p) !== 'file' || !v || !accepts(p, v)) return;
      give(v).then(function (f) {
        if (gen === generation && !f.denied) post('file', Object.assign({ key: v }, f));
      });
    });
  }

  // The images and videos right inside a picked folder, as values (the
  // listing is read again after a minute)
  function folderFiles(p, dir) {
    var c = dirCache[dir];
    if (!c || Date.now() - c.at > 60000) {
      c = dirCache[dir] = { at: Date.now(), list: listFolder('/' + dir) };
      c.list.catch(function () { if (dirCache[dir] === c) delete dirCache[dir]; });
    }
    return c.list.then(function (entries) {
      return entries.filter(function (e) { return !e.is_dir && e.name.charAt(0) !== '.' && accepts(p, e.name); })
        .map(function (e) { return e.name; }).sort(collator.compare)
        .map(function (n) { return '/' + dir + '/' + n; });
    });
  }

  // Folders in "fetchall" mode: the wallpaper gets every file at once, and
  // when the pick changes, the old ones as removed first
  function syncDirs() {
    var gen = generation;
    pickProps().forEach(function (p) {
      if (kindOf(p) !== 'directory' || String(p.mode || '').toLowerCase() === 'ondemand') return;
      var v = picked(p), s = dirSent[p.key] || (dirSent[p.key] = { want: null, files: [] });
      if (s.want === v) return;
      s.want = v;
      (v ? folderFiles(p, v) : Promise.resolve([])).catch(function () { return []; }).then(function (list) {
        if (gen !== generation || dirSent[p.key] !== s || s.want !== v) return;
        if (s.files.length) post('dir', { prop: p.key, removed: s.files });
        s.files = list;
        if (list.length) post('dir', { prop: p.key, added: list });
      });
    });
  }

  // wallpaperRequestRandomFileForProperty: a file of the folder (not the last
  // one again when there are more), sent along with its name
  function randomFile(d) {
    var gen = generation, prop = String(d.prop);
    var p = pickProps().filter(function (x) { return x.key === prop && kindOf(x) === 'directory'; })[0];
    var v = p ? picked(p) : '';
    function reply(path, file) {
      if (gen === generation) post('random', { id: d.id, prop: prop, path: path, file: file || null });
    }
    if (!v) return reply('');
    folderFiles(p, v).then(function (list) {
      if (!list.length) return reply('');
      var i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && list[i] === lastRandom[prop]) i = (i + 1) % list.length;
      var path = lastRandom[prop] = list[i];
      give(cleanPath(path)).then(function (f) { reply(path, f.denied ? null : f); });
    }, function () { reply(''); });
  }

  // ---------------------------------------------------------------------------
  // Audio for web wallpapers, in the Wallpaper Engine format: 128 values,
  // 64 bands from low to high for the left channel, then 64 for the right
  // (the tab's audio is mixed, so both halves are the same), about 30 times a second
  // ---------------------------------------------------------------------------
  var BANDS = 64, bins = null, edges = null, frameData = new Array(BANDS * 2);

  // Sound from elsewhere: other mods that analyse what this tab can't read
  // (App Windows: an app playing in a window, which is another site) send
  // 'casamods:audio' events, { source, bands: 64 values 0-255, the loudest
  // bin of the same bands as here }, about 30 times a second; mixed in by the
  // loudest. They are told when a wallpaper listens (window.casamodsAudioWanted
  // and a 'casamods:audio-wanted' event, { on }), so they only work then.
  var outside = {}, announced = false;
  window.addEventListener('casamods:audio', function (e) {
    var d = e.detail;
    if (!d || typeof d.source !== 'string' || !d.bands || d.bands.length !== BANDS) return;
    outside[d.source] = { bands: d.bands, at: Date.now() };
  });
  function announce() {
    var on = !!(frame && visible && wantsAudio);
    if (on === announced) return;
    announced = on;
    window.casamodsAudioWanted = on;
    try { window.dispatchEvent(new CustomEvent('casamods:audio-wanted', { detail: { on: on } })); } catch (e) { /* old browser */ }
  }

  function computeEdges(sampleRate, fftSize) {
    var binHz = sampleRate / fftSize, fMin = 30, fMax = 16000;
    var e = new Uint16Array(BANDS + 1);
    for (var i = 0; i <= BANDS; i++) {
      e[i] = Math.max(1, Math.round(fMin * Math.pow(fMax / fMin, i / BANDS) / binHz));
      if (i > 0 && e[i] <= e[i - 1]) e[i] = e[i - 1] + 1;
    }
    return e;
  }

  function startAudio() {
    if (audioTimer) return;
    audioTimer = setInterval(function () {
      announce();
      if (!frame || !visible || !wantsAudio) return;
      var a = audioTap.analyser, now = Date.now(), more = [];
      for (var s in outside) {
        if (now - outside[s].at > 250) delete outside[s];   // stopped
        else more.push(outside[s].bands);
      }
      if (a) {
        if (!bins || bins.length !== a.frequencyBinCount) {
          bins = new Uint8Array(a.frequencyBinCount);
          edges = computeEdges(a.context.sampleRate, a.fftSize);
        }
        a.getByteFrequencyData(bins);
      }
      for (var b = 0; b < BANDS; b++) {
        var m = 0;
        if (a) for (var k = edges[b]; k < edges[b + 1] && k < bins.length; k++) if (bins[k] > m) m = bins[k];
        for (var j = 0; j < more.length; j++) if (more[j][b] > m) m = more[j][b];
        var v = Math.min(255, +m || 0) / 255;
        frameData[b] = frameData[b + BANDS] = v * v;
      }
      post('audio', frameData);
    }, 33);
  }

  // ---------------------------------------------------------------------------
  // Media integration, in the Wallpaper Engine format: what plays in the CasaOS
  // tab. The source is the media element that last started playing (any
  // player, in the DOM or not; never this mod's own video); its title, artist
  // and cover come from the standard Media Session (navigator.mediaSession,
  // which players set for the browser's media controls), else from the file
  // name. Or another mod's "now playing" ('casamods:nowplaying' events on
  // window: Music Player + Spotify's Spotify mode, music that plays on another
  // device), when it started playing last. Nothing runs until a wallpaper
  // registers a media listener.
  // ---------------------------------------------------------------------------
  var MEDIA_EVENTS = ['playing', 'pause', 'ended', 'emptied', 'seeked', 'timeupdate', 'durationchange', 'loadedmetadata'];
  var mediaEl = null, watched = new WeakSet(), sentMedia = {}, thumbs = {}, thumbFor = null;
  var ext = null, fromExt = false;   // the last 'casamods:nowplaying', and whether it is the source

  function sendMedia(kind, data, force) {
    var key = JSON.stringify(data);
    if (!force && kind !== 'timeline' && sentMedia[kind] === key) return;
    sentMedia[kind] = key;
    post('media', { kind: kind, data: data });
  }

  function fileTitle(src) {
    try {
      var u = new URL(src, location.href);
      var name = u.searchParams.get('path') || u.pathname;   // CasaOS: /v1/file?path=…
      name = decodeURIComponent(name.split('/').pop() || '');
      return name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    } catch (e) {
      return '';
    }
  }

  function metadata() {
    if (fromExt) {
      var a = (ext && ext.artist) || '';
      return {
        props: {
          title: (ext && ext.title) || '', artist: a, subTitle: '', albumTitle: (ext && ext.album) || '',
          albumArtist: a, genres: '', contentType: 'music'
        },
        artwork: (ext && ext.cover) || ''
      };
    }
    var m = navigator.mediaSession && navigator.mediaSession.metadata;
    var src = mediaEl ? mediaEl.currentSrc || mediaEl.src : '';
    var title = (m && m.title) || (src ? fileTitle(src) : '');
    var artist = (m && m.artist) || '';
    return {
      props: {
        title: title, artist: artist, subTitle: '', albumTitle: (m && m.album) || '',
        albumArtist: artist, genres: '', contentType: 'music'
      },
      artwork: m && m.artwork && m.artwork.length ? largest(m.artwork) : ''
    };
  }

  function largest(list) {
    var best = list[0], size = 0;
    list.forEach(function (a) {
      var s = String(a.sizes || '').split(/\s+/).reduce(function (mx, wh) {
        var n = parseInt(wh, 10);
        return n > mx ? n : mx;
      }, 0);
      if (s > size) { size = s; best = a; }
    });
    return best.src;
  }

  function hexOf(c) {
    return '#' + c.map(function (v) { v = Math.round(v); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }

  // The cover as a small JPEG and its main colors (most common color buckets,
  // preferring colorful ones), as Wallpaper Engine sends them
  function coverThumb(url) {
    if (thumbs[url]) return thumbs[url];
    thumbs[url] = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var S = 256, k = Math.min(1, S / Math.max(img.naturalWidth, img.naturalHeight));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * k));
          cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          var g = cv.getContext('2d');
          g.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(Object.assign({ thumbnail: cv.toDataURL('image/jpeg', 0.85) }, colors(g.getImageData(0, 0, cv.width, cv.height).data)));
        } catch (e) {
          resolve(emptyThumb());   // a cross-origin cover can't be read
        }
      };
      img.onerror = function () { resolve(emptyThumb()); };
      // a cover from another site (Spotify's) is read through CORS, if it allows it
      try {
        var u = new URL(url, location.href);
        if (/^https?:$/.test(u.protocol) && u.origin !== location.origin) img.crossOrigin = 'anonymous';
      } catch (e) { /* a data: or blob: URL */ }
      img.src = url;
    });
    return thumbs[url];
  }

  function emptyThumb() {
    return { thumbnail: '', primaryColor: '#000000', secondaryColor: '#000000', tertiaryColor: '#000000',
      textColor: '#ffffff', highContrastColor: '#ffffff' };
  }

  function colors(px) {
    var buckets = {};
    for (var i = 0; i < px.length; i += 16) {   // every 4th pixel is plenty
      if (px[i + 3] < 128) continue;
      var key = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
      var b = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
    }
    var list = Object.keys(buckets).map(function (k) {
      var b = buckets[k], c = [b.r / b.n, b.g / b.n, b.b / b.n];
      var sat = Math.max.apply(null, c) - Math.min.apply(null, c);
      return { c: c, n: b.n, score: b.n * (0.35 + sat / 255) };
    }).sort(function (a, b) { return b.score - a.score; });
    var picked = [];
    list.forEach(function (x) {
      if (picked.length < 3 && picked.every(function (p) { return dist(p.c, x.c) > 60; })) picked.push(x);
    });
    if (!picked.length) return emptyThumb();
    while (picked.length < 3) picked.push(picked[picked.length - 1]);
    var main = picked[0].c, light = lum(main) > 0.5;
    return {
      primaryColor: hexOf(main), secondaryColor: hexOf(picked[1].c), tertiaryColor: hexOf(picked[2].c),
      textColor: light ? '#000000' : '#ffffff', highContrastColor: light ? '#000000' : '#ffffff'
    };
  }

  function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }

  function sendProperties(force) {
    if (!wantsMedia) return;
    var m = metadata();
    sendMedia('properties', m.props, force);
    if (m.artwork !== thumbFor || force) {
      thumbFor = m.artwork;
      if (!m.artwork) return sendMedia('thumbnail', emptyThumb(), force);
      coverThumb(m.artwork).then(function (th) {
        if (wantsMedia && thumbFor === m.artwork) sendMedia('thumbnail', th, true);
      });
    }
  }

  function sendPlayback(force) {
    if (!wantsMedia) return;
    if (fromExt) return sendMedia('playback', { state: ext && ext.title ? (ext.playing ? 1 : 2) : 0 }, force);
    var st = !mediaEl || mediaEl.ended || !(mediaEl.currentSrc || mediaEl.src) ? 0 : mediaEl.paused ? 2 : 1;
    sendMedia('playback', { state: st }, force);
  }

  function sendTimeline() {
    if (wantsMedia && fromExt) {
      if (!ext || !ext.title) return;
      var pos = (Number(ext.position) || 0) + (ext.playing && ext.at ? Math.max(0, Date.now() - ext.at) / 1000 : 0);
      return sendMedia('timeline', { position: pos, duration: Number(ext.duration) || 0 });
    }
    if (!wantsMedia || !mediaEl) return;
    var d = mediaEl.duration;
    sendMedia('timeline', { position: mediaEl.currentTime || 0, duration: isFinite(d) ? d : 0 });
  }

  function onMediaEvent(e) {
    var el = e.target;
    if (e.type === 'playing' && (el !== mediaEl || fromExt)) {
      mediaEl = el;
      fromExt = false;   // the tab's own player starts: it is the source again
      sendProperties();
    }
    if (el !== mediaEl) return;
    if (e.type === 'loadedmetadata' || e.type === 'emptied') sendProperties();
    if (e.type !== 'timeupdate') sendPlayback();
    sendTimeline();
  }

  function watchMedia(el) {
    if (!(el instanceof HTMLMediaElement) || el === video || watched.has(el)) return;
    watched.add(el);
    MEDIA_EVENTS.forEach(function (type) { el.addEventListener(type, onMediaEvent); });
  }
  audioTap.onPlay.push(function (el) {
    if (el === video) return;
    watchMedia(el);
    if (!el.paused && (el !== mediaEl || fromExt)) {   // already playing: no 'playing' event will come
      mediaEl = el;
      fromExt = false;
      sendProperties();
      sendPlayback();
    }
  });

  // A player that changes its Media Session metadata (a new track, its cover)
  (function () {
    var MS = window.MediaSession && MediaSession.prototype;
    var d = MS && Object.getOwnPropertyDescriptor(MS, 'metadata');
    if (!d || !d.set || !d.configurable) return;
    Object.defineProperty(MS, 'metadata', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) {
        d.set.call(this, v);
        try { sendProperties(); } catch (e) { /* never break the player */ }
      }
    });
  })();

  // Another mod's now playing: { source, title, artist, album, cover, playing,
  // position, duration (seconds), at (Date.now() of the position) }; it becomes
  // the source when it plays (a stop, title '', ends it as the source)
  window.addEventListener('casamods:nowplaying', function (e) {
    var d = e.detail;
    if (!d || typeof d !== 'object') return;
    ext = d;
    if (d.playing && d.title) fromExt = true;
    if (!fromExt) return;
    sendProperties();
    sendPlayback();
    sendTimeline();
  });

  // A wallpaper registered a media listener: everything at once, then changes
  function startMedia() {
    wantsMedia = true;
    sentMedia = {};
    thumbFor = null;
    if (!mediaEl && !fromExt) {
      // something may be playing already, from before this mod saw it start
      var all = document.querySelectorAll('audio,video');
      for (var i = 0; i < all.length; i++) {
        if (all[i] !== video && !all[i].paused) { mediaEl = all[i]; watchMedia(mediaEl); break; }
      }
    }
    sendMedia('status', { enabled: true }, true);
    sendProperties(true);
    sendPlayback(true);
    sendTimeline();
  }

  // ---------------------------------------------------------------------------
  // Mouse: moves anywhere, presses only on the empty dashboard background
  // (never on icons, widgets or menus), in the same place inside the iframe
  // ---------------------------------------------------------------------------
  var UI = 'a,button,input,textarea,select,label,img,video,audio,svg,[role="button"],[contenteditable],' +
    '[draggable="true"],.widget,.card,.dropdown,.modal,.navbar,.b-tooltip,.tooltip,.snackbar,.toast,' +
    '.context-menu,#lw-panel';

  function emptyBackground(e) {
    var el = e.target;
    if (!el || !el.closest || el.closest(UI)) return false;
    var r = el.getBoundingClientRect();
    return r.width * r.height >= window.innerWidth * window.innerHeight * 0.3;
  }

  var pressing = false;

  function sendMouse(types, e, buttons) {
    post('mouse', { types: types, x: e.clientX, y: e.clientY, buttons: buttons });
  }

  // Sent right away: browsers already deliver about one mousemove per frame,
  // and waiting for the next frame would make the wallpaper trail the cursor
  document.addEventListener('mousemove', function (e) {
    if (frame && visible) sendMouse(['pointermove', 'mousemove'], e, e.buttons);
  }, { capture: true, passive: true });

  document.addEventListener('mousedown', function (e) {
    if (!frame || !visible || e.button !== 0 || !emptyBackground(e)) return;
    e.preventDefault();   // a drag on the wallpaper doesn't select the dashboard's text and images
    pressing = true;
    sendMouse(['pointerdown', 'mousedown'], e, 1);
  }, true);

  document.addEventListener('mouseup', function (e) {
    if (!pressing) return;
    pressing = false;
    if (frame && visible) sendMouse(['pointerup', 'mouseup', 'click'], e, 0);
  }, true);

  // ---------------------------------------------------------------------------
  // Properties (project.json → general.properties) and their labels
  // ---------------------------------------------------------------------------
  function propList(w) {
    var props = (w.project && w.project.general && w.project.general.properties) || {};
    return Object.keys(props).filter(function (k) {
      return props[k] && typeof props[k] === 'object' && props[k].type;
    }).map(function (k) {
      return Object.assign({ key: k }, props[k]);
    }).sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  }

  function valueOf(p) {
    if (!(p.key in settings.props)) return p.value;
    var v = settings.props[p.key], kind = String(p.type).toLowerCase();
    // a picked file or folder: its absolute path (1.2.0 kept it without the first slash)
    if ((kind === 'file' || kind === 'directory') && typeof v === 'string') return cleanPath(v) ? '/' + cleanPath(v) : '';
    return v;
  }

  function allProps() {
    var out = {};
    if (current) propList(current).forEach(function (p) { out[p.key] = { value: valueOf(p) }; });
    return out;
  }

  function values() {
    var v = {};
    if (current) propList(current).forEach(function (p) { v[p.key] = valueOf(p); });
    return v;
  }

  // Text without markup (labels may carry <b>, <br>…)
  function plain(html) {
    var doc = new DOMParser().parseFromString('<body>' + String(html == null ? '' : html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // A label: a "ui_" key of the wallpaper's own localization, in the CasaOS
  // language when it has it (then English), or the text itself. rawLabel keeps
  // the markup, label is the plain text.
  function rawLabel(text) {
    var key = plain(text);   // the key may come wrapped in markup ("<b>ui_title</b>")
    if (key === 'ui_browse_properties_scheme_color') return t('schemeColor');
    var loc = current && current.project && current.project.general && current.project.general.localization;
    if (loc && /^ui_\S+$/.test(key)) {
      var want = [WE_LANG[lang()], 'en-us'];
      for (var i = 0; i < want.length; i++) {
        for (var code in loc) {
          if (code.toLowerCase() === want[i] && loc[code] && loc[code][key] != null) return String(loc[code][key]);
        }
      }
    }
    return String(text == null ? '' : text);
  }

  function label(text) {
    return plain(rawLabel(text));
  }

  // Wallpaper Engine has no sections: wallpapers head them with a short "text"
  // property ("<b>— Mouse —</b>"). Short and not a sentence: a section header
  // (its title without the dashes); otherwise a note inside the section.
  var DECOR = /^[\s\-—–=_*~#•·|:>]+|[\s\-—–=_*~#•·|:<]+$/g;

  function headerTitle(p) {
    if (String(p.type).toLowerCase() !== 'text') return null;
    var raw = rawLabel(p.text);
    if (/<br\s*\/?>/i.test(raw)) return null;
    var text = plain(raw), title = text.replace(DECOR, '');
    if (!title || text.length > 48 || /[.!?。！？]$/.test(title)) return null;
    return title;
  }

  // Search: case and accents ignored
  function fold(text) {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // The "condition" of a property ("glow.value == true && size.value > 2"):
  // read by a small parser, never run as code (it comes from the wallpaper).
  // Anything it doesn't understand leaves the option visible.
  var TOKEN = /\s*(===|!==|==|!=|<=|>=|&&|\|\||[()!<>]|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/y;

  function condition(src, vals) {
    var text = String(src).trim(), toks = [], m;
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < text.length && (m = TOKEN.exec(text))) toks.push(m[1]);
    if (TOKEN.lastIndex < text.length) return true;
    var i = 0;
    function peek() { return toks[i]; }
    function next() { return toks[i++]; }
    function same(a, b) { return a == b || String(a) === String(b); }   // eslint-disable-line eqeqeq
    function primary() {
      var tk = next();
      if (tk === '(') { var v = or(); next(); return v; }
      if (tk === '!') return !primary();
      if (tk === 'true') return true;
      if (tk === 'false') return false;
      if (/^-?\d/.test(tk || '')) return parseFloat(tk);
      if (/^['"]/.test(tk || '')) return tk.slice(1, -1);
      if (/\.value$/.test(tk || '')) return vals[tk.slice(0, -6)];
      return undefined;
    }
    function compare() {
      var a = primary();
      while (['==', '!=', '===', '!==', '<', '>', '<=', '>='].indexOf(peek()) >= 0) {
        var op = next(), b = primary();
        a = op === '==' || op === '===' ? same(a, b) : op === '!=' || op === '!==' ? !same(a, b)
          : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
      }
      return a;
    }
    function and() { var a = compare(); while (peek() === '&&') { next(); var b = compare(); a = a && b; } return a; }
    function or() { var a = and(); while (peek() === '||') { next(); var b = and(); a = a || b; } return a; }
    try { return !!or(); } catch (e) { return true; }
  }

  function setProp(key, value) {
    settings.props[key] = value;
    saveSettings(current.id, settings);
    var change = {};
    change[key] = { value: value };
    var pick = pickProps().some(function (p) { return p.key === key; });
    if (pick) {
      post('files', pickedFiles());
      prefetch();
    }
    post('props', change);
    if (pick) syncDirs();
    refreshPanel();
  }

  // ---------------------------------------------------------------------------
  // Settings panel ("Customize"), in the CasaOS look (mod.css). The engine's
  // options first, then the wallpaper's own properties from its project.json,
  // in sections that open and close (closed at first; the panel remembers).
  // ---------------------------------------------------------------------------
  var panel = null, groups = [], query = '';

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function row(text, control, wide) {
    var r = h('div', 'lw-row' + (wide ? ' lw-wide' : ''));
    var l = h('label', null, text);
    var id = 'lw-opt-' + Math.random().toString(36).slice(2, 9);
    control.id = id;
    l.htmlFor = id;
    r.appendChild(l);
    r.appendChild(control);
    return r;
  }

  function toggle(checked, onChange) {
    var c = h('input');
    c.type = 'checkbox';
    c.checked = !!checked;
    c.addEventListener('change', function () { onChange(c.checked); });
    return c;
  }

  function slider(p, value, onChange) {
    var precision = p.fraction ? Number(p.precision) || 2 : 0;
    var step = Number(p.step) || (p.fraction ? Math.pow(10, -precision) : 1);
    var r = h('input');
    r.type = 'range';
    r.min = p.min;
    r.max = p.max;
    r.step = step;
    r.value = value;
    var shown = h('span', 'lw-val', Number(value).toFixed(precision));
    var timer = null;
    r.addEventListener('input', function () {
      shown.textContent = Number(r.value).toFixed(precision);
      clearTimeout(timer);
      timer = setTimeout(function () { onChange(Number(r.value)); }, 60);
    });
    r.lwValue = shown;
    return r;
  }

  function toHex(rgb) {
    var c = String(rgb || '0 0 0').trim().split(/\s+/).map(Number);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(Math.min(1, Math.max(0, c[i] || 0)) * 255);
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function fromHex(hex) {
    return [1, 3, 5].map(function (i) { return (parseInt(hex.substr(i, 2), 16) / 255).toFixed(3); }).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Color picker, opened inside the panel under its row (the browser's own popup
  // can't be styled and leaves the screen at the panel's edge). Drawn only with
  // the panel's theme variables, so it follows the CasaOS theme too.
  // ---------------------------------------------------------------------------
  var openPicker = null;

  function clamp01(x) { return Math.min(1, Math.max(0, x)); }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var d = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map(function (i) { return parseInt(d.substr(i, 2), 16) / 255; });
  }

  function rgbToHex(c) {
    return '#' + c.map(function (x) {
      var v = Math.round(clamp01(x) * 255);
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function rgbToHsv(c) {
    var max = Math.max(c[0], c[1], c[2]), d = max - Math.min(c[0], c[1], c[2]), hue = 0;
    if (d) {
      if (max === c[0]) hue = ((c[1] - c[2]) / d + 6) % 6;
      else if (max === c[1]) hue = (c[2] - c[0]) / d + 2;
      else hue = (c[0] - c[1]) / d + 4;
    }
    return { h: hue * 60, s: max ? d / max : 0, v: max };
  }

  function hsvToRgb(x) {
    var f = function (n) {
      var k = (n + x.h / 60) % 6;
      return x.v - x.v * x.s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5), f(3), f(1)];
  }

  function closePicker() {
    if (!openPicker) return;
    openPicker.box.hidden = true;
    openPicker.swatch.setAttribute('aria-expanded', 'false');
    openPicker = null;
  }

  function colorPicker(text, hex, onChange) {
    var hsv = rgbToHsv(hexToRgb(hex) || [0, 0, 0]);
    var swatch = h('button', 'lw-swatch');
    swatch.type = 'button';
    swatch.setAttribute('aria-expanded', 'false');
    var r = row(text, swatch);

    var box = h('div', 'lw-picker');
    box.hidden = true;
    box.dir = 'ltr';   // a color square reads left to right in every language
    swatch.setAttribute('aria-controls', box.id = 'lw-picker-' + Math.random().toString(36).slice(2, 9));
    var sv = h('div', 'lw-sv'), svDot = h('span', 'lw-dot');
    var hue = h('div', 'lw-hue'), hueDot = h('span', 'lw-dot');
    [[sv, 'shade'], [hue, 'hue']].forEach(function (a) {
      a[0].tabIndex = 0;
      a[0].setAttribute('role', 'slider');
      a[0].setAttribute('aria-label', t(a[1]));
    });
    hue.setAttribute('aria-valuemin', '0');
    hue.setAttribute('aria-valuemax', '360');
    sv.appendChild(svDot);
    hue.appendChild(hueDot);
    var foot = h('div', 'lw-picker-foot');
    var field = h('input');
    field.type = 'text';
    field.maxLength = 7;
    field.spellcheck = false;
    field.setAttribute('aria-label', t('hex'));
    foot.appendChild(field);
    if (window.EyeDropper) {
      var drop = h('button', 'lw-icon lw-drop');
      drop.type = 'button';
      drop.title = t('eyedropper');
      drop.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5l4 4"/>' +
        '<path d="M17.5 3.5a2.1 2.1 0 013 3l-2 2-3-3z"/><path d="M15.5 8.5L7 17l-3 1 1-3 8.5-8.5"/></svg>';
      drop.addEventListener('click', function () {
        new window.EyeDropper().open().then(function (res) {
          var c = hexToRgb(res.sRGBHex);
          if (!c) return;
          hsv = rgbToHsv(c);
          paint();
          send(true);
        }, function () { /* cancelled */ });
      });
      foot.appendChild(drop);
    }
    box.appendChild(sv);
    box.appendChild(hue);
    box.appendChild(foot);
    r.appendChild(box);

    function current() { return rgbToHex(hsvToRgb(hsv)); }

    function paint() {
      var c = current();
      box.style.setProperty('--lw-pick-hue', 'hsl(' + hsv.h + ', 100%, 50%)');
      svDot.style.left = hsv.s * 100 + '%';
      svDot.style.top = (1 - hsv.v) * 100 + '%';
      svDot.style.background = c;
      hueDot.style.left = hsv.h / 360 * 100 + '%';
      sv.setAttribute('aria-valuetext', Math.round(hsv.s * 100) + '%, ' + Math.round(hsv.v * 100) + '%');
      hue.setAttribute('aria-valuenow', String(Math.round(hsv.h)));
      swatch.style.background = c;
      swatch.title = c;
      if (document.activeElement !== field) field.value = c;
    }

    // One update per frame while dragging; nothing runs otherwise
    var frame = 0, sent = hex;
    function send(now) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      var go = function () {
        frame = 0;
        var c = current();
        if (c !== sent) onChange(sent = c);
      };
      if (now) go(); else frame = requestAnimationFrame(go);
    }

    function drag(el, move) {
      el.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        e.preventDefault();
        el.focus({ preventScroll: true });
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* not a live pointer */ }
        var at = function (ev) {
          var b = el.getBoundingClientRect();
          move(clamp01((ev.clientX - b.left) / b.width), clamp01((ev.clientY - b.top) / b.height));
          paint();
          send();
        };
        var up = function () {
          el.removeEventListener('pointermove', at);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          send(true);
        };
        el.addEventListener('pointermove', at);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        at(e);
      });
    }
    drag(sv, function (x, y) { hsv.s = x; hsv.v = 1 - y; });
    drag(hue, function (x) { hsv.h = x * 360; });

    function keys(el, step) {
      el.addEventListener('keydown', function (e) {
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (!d) return;
        e.preventDefault();
        step(d[0] * (e.shiftKey ? 5 : 1), d[1] * (e.shiftKey ? 5 : 1));
        paint();
        send();
      });
    }
    keys(sv, function (dx, dy) { hsv.s = clamp01(hsv.s + dx * 0.02); hsv.v = clamp01(hsv.v + dy * 0.02); });
    keys(hue, function (dx, dy) { hsv.h = Math.min(360, Math.max(0, hsv.h + (dx || dy) * 2)); });

    field.addEventListener('change', function () {
      var c = hexToRgb(field.value);
      if (c) {
        hsv = rgbToHsv(c);
        send(true);
      }
      field.value = '';   // shows the current color again (also when it was invalid)
      field.blur();
      paint();
    });
    field.addEventListener('keydown', function (e) { if (e.key === 'Enter') field.blur(); });

    swatch.addEventListener('click', function () {
      var mine = openPicker && openPicker.box === box;
      closePicker();
      if (mine) return;
      box.hidden = false;
      swatch.setAttribute('aria-expanded', 'true');
      openPicker = { box: box, swatch: swatch };
      paint();
      box.scrollIntoView({ block: 'nearest' });
    });

    paint();
    return r;
  }

  // ---------------------------------------------------------------------------
  // A file or a folder of the CasaOS storage ("file" and "directory"
  // properties): its name in a button that opens a small browser under the row,
  // like the color picker (folders first, then the files the option takes; a
  // folder option picks the folder shown). Read with the CasaOS folder API.
  // ---------------------------------------------------------------------------
  var GLYPH = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    dir: '<path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v7.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-9 8.5"/>',
    video: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M10 9.3v5.4l4.6-2.7z"/>'
  };

  function glyph(name) {
    var s = h('span', 'lw-glyph');
    s.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GLYPH[name] + '</svg>';
    return s;
  }

  function fileRow(p, text) {
    var folder = kindOf(p) === 'directory';
    var pick = h('button', 'lw-file');
    pick.type = 'button';
    pick.setAttribute('aria-expanded', 'false');
    var name = h('span', 'lw-file-name');
    pick.appendChild(glyph(folder ? 'dir' : String(p.fileType).toLowerCase() === 'video' ? 'video' : 'image'));
    pick.appendChild(name);
    var r = row(text, pick);
    var ctl = h('div', 'lw-file-ctl');
    r.replaceChild(ctl, pick);
    ctl.appendChild(pick);
    var clear = h('button', 'lw-icon lw-clear', '✕');
    clear.type = 'button';
    clear.title = t('remove');
    clear.setAttribute('aria-label', t('remove') + ': ' + text);
    ctl.appendChild(clear);

    var box = h('div', 'lw-picker lw-browser');
    box.hidden = true;
    pick.setAttribute('aria-controls', box.id = 'lw-browse-' + Math.random().toString(36).slice(2, 9));
    var bar = h('div', 'lw-browse-bar');
    var up = h('button', 'lw-icon lw-up');
    up.type = 'button';
    up.title = t('upFolder');
    up.appendChild(glyph('up'));
    var where = h('input');
    where.type = 'text';
    where.spellcheck = false;
    where.setAttribute('aria-label', t('folderPath'));
    bar.appendChild(up);
    bar.appendChild(where);
    var list = h('div', 'lw-browse-list');
    var note = h('p', 'lw-note');
    note.hidden = true;
    box.appendChild(bar);
    box.appendChild(list);
    box.appendChild(note);
    var use = null;
    if (folder) {
      use = h('button', 'lw-use', t('useFolder'));
      use.type = 'button';
      box.appendChild(use);
    }
    r.appendChild(box);

    function show() {
      var v = picked(p);
      name.textContent = v ? v.slice(v.lastIndexOf('/') + 1) : t('choose');
      pick.title = v ? '/' + v : '';
      pick.classList.toggle('lw-empty', !v);
      clear.hidden = !v;
    }

    function choose(path) {
      setProp(p.key, cleanPath(path) ? '/' + cleanPath(path) : '');
      show();
      closePicker();
      pick.focus();
    }

    // The list changes only once the new one is read: nothing moves under a
    // click meanwhile (a typed path is also read when the field loses focus)
    var at = '', seq = 0;
    function browse(dir, fresh) {
      var mine = ++seq;
      if (fresh) list.textContent = '';   // just opened: no other folder's list meanwhile
      at = '/' + (cleanPath(dir) || '');
      where.value = at;
      up.disabled = at === '/';
      if (use) use.disabled = at === '/';
      listFolder(at).then(function (entries) {
        if (mine !== seq) return;
        list.textContent = '';
        note.hidden = true;
        entries = entries.filter(function (e) {
          return e.name.charAt(0) !== '.' && (e.is_dir || (!folder && accepts(p, e.name)));
        }).sort(function (a, b) { return (b.is_dir ? 1 : 0) - (a.is_dir ? 1 : 0) || collator.compare(a.name, b.name); });
        var chosen = '/' + picked(p);
        entries.forEach(function (e) {
          var full = (at === '/' ? '' : at) + '/' + e.name;
          var b = h('button', 'lw-entry');
          b.type = 'button';
          b.title = e.name;
          b.appendChild(glyph(e.is_dir ? 'dir' : VIDEO_EXT.test(e.name) ? 'video' : 'image'));
          b.appendChild(h('span', null, e.name));
          if (!e.is_dir && full === chosen) b.setAttribute('aria-current', 'true');
          b.addEventListener('click', function () { if (e.is_dir) browse(full); else choose(full); });
          list.appendChild(b);
        });
        if (!entries.length && !folder) {
          note.textContent = t('emptyFolder');
          note.hidden = false;
        }
      }, function () {
        if (mine !== seq) return;
        list.textContent = '';
        note.textContent = t('folderError');
        note.hidden = false;
      });
    }

    up.addEventListener('click', function () { browse(at.replace(/\/[^/]*$/, '')); });
    function typed() {
      var dir = '/' + (cleanPath(where.value.trim()) || '');
      if (dir !== at) browse(dir);
      else where.value = at;
    }
    where.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      typed();
    });
    where.addEventListener('change', typed);
    if (use) use.addEventListener('click', function () { choose(at); });
    clear.addEventListener('click', function () {
      setProp(p.key, '');
      show();
      if (openPicker && openPicker.box === box) closePicker();
      pick.focus();
    });

    pick.addEventListener('click', function () {
      var mine = openPicker && openPicker.box === box;
      closePicker();
      if (mine) return;
      box.hidden = false;
      pick.setAttribute('aria-expanded', 'true');
      openPicker = { box: box, swatch: pick };
      // where the pick is (a file: its folder), else where it was left, else /DATA
      var v = picked(p);
      browse(v ? '/' + (folder ? v : v.replace(/\/?[^/]*$/, '')) : at || '/DATA', true);
      box.scrollIntoView({ block: 'nearest' });
    });

    show();
    return r;
  }

  function control(p) {
    var v = valueOf(p);
    var text = label(p.text);
    switch (String(p.type).toLowerCase()) {
      case 'bool':
        return row(text, toggle(v, function (x) { setProp(p.key, x); }));
      case 'slider': {
        var s = slider(p, v, function (x) { setProp(p.key, x); });
        var r = row(text, s, true);
        r.insertBefore(s.lwValue, s);
        return r;
      }
      case 'combo': {
        var sel = h('select');
        (p.options || []).forEach(function (o) {
          var opt = h('option', null, label(o.label));
          opt.value = String(o.value);
          sel.appendChild(opt);
        });
        sel.value = String(v);
        sel.addEventListener('change', function () {
          // keep numbers as numbers, like Wallpaper Engine sends them
          var o = (p.options || []).filter(function (x) { return String(x.value) === sel.value; })[0];
          setProp(p.key, o ? o.value : sel.value);
        });
        return row(text, sel);
      }
      case 'color':
        return colorPicker(text, toHex(v), function (hex) { setProp(p.key, fromHex(hex)); });
      case 'textinput': {
        var ti = h('input');
        ti.type = 'text';
        ti.value = v == null ? '' : String(v);
        ti.addEventListener('change', function () { setProp(p.key, ti.value); });
        return row(text, ti, true);
      }
      case 'text':
        return text ? h('p', 'lw-text', text) : null;
      case 'file':
      case 'directory':
        return fileRow(p, text);
      default:
        return null;   // scene textures and the like: nothing to offer here
    }
  }

  // A section: a header that opens and closes it (none for the options before
  // the first header) and its rows
  function group(key, title, cond) {
    var g = { key: key, title: title, cond: cond, rows: [], openByDefault: false };
    g.el = h('section', 'lw-group' + (title == null ? ' lw-loose' : ''));
    g.body = h('div', 'lw-group-body');
    if (title != null) {
      g.head = h('button', 'lw-group-head');
      g.head.type = 'button';
      g.body.id = 'lw-group-' + Math.random().toString(36).slice(2, 9);
      g.head.setAttribute('aria-controls', g.body.id);
      g.head.appendChild(h('span', 'lw-chev'));
      g.head.appendChild(h('span', null, title));
      g.head.addEventListener('click', function () {
        settings.open[key] = !isOpen(g);
        saveSettings(current.id, settings);
        refreshPanel();
      });
      g.el.appendChild(g.head);
    }
    g.el.appendChild(g.body);
    groups.push(g);
    return g;
  }

  function isOpen(g) {
    return g.key in settings.open ? !!settings.open[g.key] : g.openByDefault;
  }

  function addRow(g, el, cond) {
    g.body.appendChild(el);
    g.rows.push({ el: el, cond: cond, text: (el.querySelector('label') || el).textContent });
  }

  // Conditions, the search and which sections are open
  function refreshPanel() {
    if (!panel) return;
    var vals = values(), q = fold(query.trim());
    groups.forEach(function (g) {
      var shown = !g.cond || condition(g.cond, vals);
      var titleHit = !!q && g.title != null && fold(g.title).indexOf(q) >= 0;
      var any = false;
      g.rows.forEach(function (r) {
        var ok = !r.cond || condition(r.cond, vals);
        if (ok && q && !titleHit) ok = fold(r.text).indexOf(q) >= 0;
        r.el.hidden = !ok;
        any = any || ok;
      });
      g.el.hidden = !any;
      if (!g.head) return;
      // A header the wallpaper hides leaves its options in view, as in Wallpaper Engine
      g.head.hidden = !shown;
      var open = !!q || !shown || isOpen(g);
      g.body.hidden = !open;
      g.el.classList.toggle('lw-open', open);
      g.head.setAttribute('aria-expanded', String(open));
    });
  }

  function remount() {
    var id = current.id;
    switchTo(id).then(openPanel);
  }

  // The panel takes its look from CasaOS itself each time it opens: the glass of
  // a dashboard widget, its text color and the CasaOS primary color. So a mod
  // that restyles CasaOS (a theme) restyles the panel and the color picker too.
  // What can't be read keeps the defaults of mod.css.
  function visibleColor(c) { return c && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c) ? c : ''; }

  function applyTheme() {
    var set = function (name, value) { if (value) panel.style.setProperty(name, value); };
    var glass = document.querySelector('.widget .blur-background') || document.querySelector('.dropdown-content');
    if (glass) {
      var g = getComputedStyle(glass);
      set('--lw-glass', g.backgroundColor);
      set('--lw-filter', g.backdropFilter || g.webkitBackdropFilter);
      set('--lw-radius', g.borderRadius);
      set('--lw-shadow', g.boxShadow);
      var text = getComputedStyle(glass.closest('.widget') || glass).color;
      set('--lw-text', text);
      // a dark text means a light theme: native bits (scrollbars, options) follow
      var c = (text.match(/[\d.]+/g) || []).map(Number);
      if (c.length >= 3) panel.style.colorScheme = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 128 ? 'light' : 'dark';
    }
    var primary = document.querySelector('.button.is-primary:not(.is-light):not(.is-outlined), .switch input:checked + .check, .has-background-primary');
    if (primary) set('--lw-accent', visibleColor(getComputedStyle(primary).backgroundColor));
  }

  function buildPanel() {
    var w = current;
    groups = [];
    query = '';
    panel = h('aside');
    panel.id = 'lw-panel';
    panel.lang = WE_LANG[lang()] || 'en';
    panel.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    panel.setAttribute('aria-label', t('settings'));

    var head = h('header');
    var title = h('div', 'lw-title');
    title.appendChild(h('strong', null, w.title));
    title.appendChild(h('span', null, t('settings')));
    var reset = h('button', null, t('reset'));
    reset.type = 'button';
    reset.title = t('resetTitle');
    reset.addEventListener('click', function () {
      settings.props = {};
      saveSettings(w.id, settings);
      if (pickProps().length) post('files', pickedFiles());
      post('props', allProps());
      syncDirs();
      closePanel();
      openPanel();
    });
    var close = h('button', 'lw-icon', '✕');
    close.type = 'button';
    close.title = t('close');
    close.addEventListener('click', closePanel);
    head.appendChild(title);
    head.appendChild(reset);
    head.appendChild(close);
    panel.appendChild(head);

    var scroll = h('div', 'lw-scroll');
    // The engine's own options (under the name of this mod, the same in every language)
    var engine = group('lw', 'Live Wallpapers');
    if (w.type === 'video') {
      addRow(engine, row(t('sound'), toggle(settings.sound, function (x) {
        settings.sound = x;
        saveSettings(w.id, settings);
        applySound();
      })));
      var vol = slider({ min: 0, max: 1, fraction: true, precision: 2 }, settings.volume, function (x) {
        settings.volume = x;
        saveSettings(w.id, settings);
        applySound();
      });
      var vr = row(t('volume'), vol, true);
      vr.insertBefore(vol.lwValue, vol);
      addRow(engine, vr);
    } else {
      var fps = h('select');
      [['0', t('unlimited')], ['60', '60 FPS'], ['30', '30 FPS']].forEach(function (o) {
        var opt = h('option', null, o[1]);
        opt.value = o[0];
        fps.appendChild(opt);
      });
      fps.value = settings.fps;
      fps.addEventListener('change', function () {
        settings.fps = fps.value;
        saveSettings(w.id, settings);
        post('general', generalProps());
      });
      addRow(engine, row(t('fps'), fps));
      addRow(engine, row(t('trust'), toggle(settings.trusted, function (x) {
        settings.trusted = x;
        saveSettings(w.id, settings);
        remount();
      })));
      addRow(engine, h('p', 'lw-note', t('trustNote')));
    }

    // The wallpaper's properties, in the sections its headers start
    var cur = group(null, null), own = 0, sections = 0;
    propList(w).forEach(function (p) {
      var name = headerTitle(p);
      if (name) {
        cur = group('p:' + p.key, name, p.condition);
        sections++;
        return;
      }
      var el = control(p);
      if (!el) return;
      addRow(cur, el, p.condition);
      own++;
    });
    // A header with nothing under it is just a line of text
    groups.forEach(function (g) {
      if (g.head && !g.rows.length) {
        g.el.removeChild(g.head);
        g.head = null;
        g.el.classList.add('lw-loose');
        addRow(g, h('p', 'lw-text', g.title), g.cond);
        sections--;
      }
    });
    if (!own) {
      engine.openByDefault = true;   // nothing else to show
      if (w.type !== 'video') addRow(engine, h('p', 'lw-note', t('noSettings')));
    }
    groups.forEach(function (g) { scroll.appendChild(g.el); });

    // A search when there is a lot to go through
    if (sections >= 2 || own >= 10) {
      var bar = h('div', 'lw-search');
      var input = h('input');
      input.type = 'search';
      input.placeholder = t('search');
      input.setAttribute('aria-label', t('search'));
      input.spellcheck = false;
      input.addEventListener('input', function () {
        query = input.value;
        scroll.scrollTop = 0;
        refreshPanel();
      });
      // Esc clears the search first, then closes the panel
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !input.value) return;
        e.stopPropagation();
        input.value = query = '';
        refreshPanel();
      });
      bar.appendChild(input);
      panel.appendChild(bar);
    }
    panel.appendChild(scroll);
    applyTheme();   // before it shows, so nothing transitions from the defaults
    document.body.appendChild(panel);
    refreshPanel();
  }

  function openPanel() {
    if (!current) return;
    if (!panel) buildPanel();
    panel.hidden = false;
  }

  function closePanel() {
    if (panel) panel.remove();
    panel = null;
    groups = [];
    openPicker = null;
  }

  // Esc closes an open color picker first, then the panel
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !panel) return;
    if (openPicker) closePicker();
    else closePanel();
  });

  // ---------------------------------------------------------------------------
  // "Customize" next to "Change" in the CasaOS settings dropdown, while a live
  // wallpaper is the chosen one (just the sparkle when the row is too narrow)
  // ---------------------------------------------------------------------------
  var BTN_ID = 'lw-customize';
  var ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7z"/>' +
    '<path d="M18.5 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>';

  function customizeButton() {
    var wrap = h('div', 'ml-2');
    wrap.id = BTN_ID;
    wrap.innerHTML = '<button type="button" class="button is-dark is-small is-rounded">' +
      '<span class="lw-btn-text"></span><span class="lw-btn-icon">' + ICON + '</span></button>';
    wrap.firstChild.addEventListener('click', function (e) {
      e.preventDefault();
      openPanel();
      // Buefy closes its dropdown on any click outside it
      setTimeout(function () { document.documentElement.click(); }, 0);
    });
    return wrap;
  }

  function fitButton(r) {
    var wrap = r.querySelector('#' + BTN_ID);
    if (!wrap || wrap.hidden || !r.clientWidth) return;
    wrap.classList.remove('lw-compact');
    if (r.scrollWidth > r.clientWidth + 1 || r.scrollHeight > r.clientHeight + 1) wrap.classList.add('lw-compact');
  }

  var resizes = window.ResizeObserver && new ResizeObserver(function (entries) {
    entries.forEach(function (entry) { fitButton(entry.target); });
  });
  var watchedRow = null;

  // (only among the settings rows: the dashboard's right-click menu is also a
  // .dropdown-content, with the same wallpaper icon on "Change wallpaper")
  function injectRow() {
    var icon = document.querySelector('.dropdown-content ._box .casa-wallpaper-outline');
    var vanilla = icon && icon.closest('._box');
    if (!vanilla) return;
    var change = vanilla.lastElementChild;
    var wrap = document.getElementById(BTN_ID) || customizeButton();
    // anywhere before "Change": the other mod's button may sit there too
    if (wrap.parentNode !== vanilla || !(wrap.compareDocumentPosition(change) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      vanilla.insertBefore(wrap, change);
    }
    wrap.hidden = !(current && selectedId === current.id);
    var text = t('customize');
    var span = wrap.querySelector('.lw-btn-text');
    if (span.textContent !== text) span.textContent = text;
    if (wrap.firstChild.title !== text) wrap.firstChild.title = text;
    if (resizes && vanilla !== watchedRow) {
      if (watchedRow) resizes.unobserve(watchedRow);
      resizes.observe(vanilla);
      watchedRow = vanilla;
    }
    fitButton(vanilla);
  }

  // ---------------------------------------------------------------------------
  // The CasaOS wallpaper menu (CasaOS-UI WallpaperModal.vue): a tile per
  // wallpaper, copied from a built-in tile (so it keeps CasaOS's scoped
  // styles), before the upload button. Choosing one sets the menu's own state;
  // CasaOS's "Apply" saves it like any other wallpaper.
  // ---------------------------------------------------------------------------
  function thumbnail(w) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      var done = false;
      function finish(url) {
        if (done) return;
        done = true;
        v.removeAttribute('src');
        v.load();
        resolve(url);
      }
      v.muted = true;
      v.preload = 'metadata';
      v.addEventListener('loadeddata', function () {
        v.currentTime = Math.min(1, (v.duration || 2) / 2);
      });
      v.addEventListener('seeked', function () {
        try {
          var c = document.createElement('canvas');
          c.width = 320;
          c.height = 180;
          var g = c.getContext('2d'), k = Math.max(320 / v.videoWidth, 180 / v.videoHeight);
          g.drawImage(v, (320 - v.videoWidth * k) / 2, (180 - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
          finish(c.toDataURL('image/jpeg', 0.75));
        } catch (e) {
          finish(null);
        }
      });
      v.addEventListener('error', function () { finish(null); });
      setTimeout(function () { finish(null); }, 8000);
      v.src = w.file;
    });
  }

  function tile(template, w, vm, tiles) {
    var col = template.cloneNode(true);
    col.removeAttribute('id');
    col.classList.add('lw-tile');
    var item = col.querySelector('.image-list-item');
    item.classList.remove('active');
    item.title = w.title + (w.reason ? ' — ' + w.reason : '');
    var img = col.querySelector('img');
    if (img) {
      img.removeAttribute('srcset');
      img.alt = w.title;
      img.src = w.preview || PLACEHOLDER;
    }
    if (img && !w.preview && w.type === 'video' && w.supported) {
      thumbnail(w).then(function (url) {
        if (!url) return;
        w.thumb = url;
        img.src = url;
      });
    }
    var cap = h('span', 'lw-caption');
    var badge = h('span', 'lw-kind');
    badge.innerHTML = w.type === 'video'
      ? '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>'
      : ICON;
    var names = h('span', 'lw-names');
    names.appendChild(h('span', 'lw-name', w.title));
    if (w.reason) names.appendChild(h('span', 'lw-why', w.reason));
    cap.appendChild(badge);
    cap.appendChild(names);
    item.appendChild(cap);
    if (!w.supported) {
      col.classList.add('lw-disabled');
    } else {
      col.addEventListener('click', function () {
        vm.path = pathOf(w);
        vm.from = FROM;
        vm.backgroundStyleObj.backgroundImage = 'url("' + (w.preview || w.thumb || PLACEHOLDER) + '")';
      });
    }
    tiles.push({ item: item, w: w });
    return col;
  }

  function injectTiles() {
    var upload = document.getElementById('upload-wallpaper');
    var card = upload && upload.closest('.modal-card');
    var vm = card && card.__vue__;
    if (!vm || !('wallpaperItems' in vm) || card.lwTiles) return;
    var uploadCol = upload.closest('.column');
    var builtIn = uploadCol && uploadCol.parentNode.querySelector('.image-list-item');
    if (!builtIn) return;
    card.lwTiles = true;
    var template = builtIn.closest('.column');
    // the four-a-row grid right away if the folder had wallpapers last time (no jump)
    if (localStorage.getItem(STORE + '-count') > 0) uploadCol.parentNode.classList.add('lw-grid');
    var tiles = [];
    function mark() {
      tiles.forEach(function (x) { x.item.classList.toggle('active', vm.path === pathOf(x.w)); });
    }
    loadCatalog().then(function (list) {
      try { localStorage.setItem(STORE + '-count', String(list.length)); } catch (e) { /* not kept */ }
      uploadCol.parentNode.classList.toggle('lw-grid', list.length > 0);
      if (!card.isConnected || !list.length) return;
      list.forEach(function (w) { uploadCol.parentNode.insertBefore(tile(template, w, vm, tiles), uploadCol); });
      mark();
      vm.$watch('path', mark);
    });
  }

  // ---------------------------------------------------------------------------
  // CasaOS store: the chosen wallpaper (this tab or, after a reload, any device)
  // ---------------------------------------------------------------------------
  function hookStore() {
    if (store) return;
    var app = document.getElementById('app');
    var vm = app && app.__vue__;
    if (!vm || !vm.$store || !vm.$store.state || !('wallpaperObject' in vm.$store.state)) return;
    store = vm.$store;
    store.watch(function (state) { return state.wallpaperObject; }, function (w) {
      selectedId = w ? idOf(w.path) : null;
      sync();
    });
    // CasaOS may have loaded the saved choice (another device's) before the
    // hook: SET_WALLPAPER mirrors it in localStorage.wallpaper
    selectedId = idOf(localStorage.getItem('wallpaper'));
    sync();
  }

  // One cheap, debounced observer for the background, the dropdown and the menu
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      hookStore();
      update();
      injectTiles();
    }, 120);
  }).observe(document.body, { childList: true, subtree: true });

  hookStore();
  sync();
})();

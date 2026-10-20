/*
 * Music Player — CasaMOD mod for CasaOS.
 *
 * A music widget for the dashboard with three sources, switched at its top:
 * a folder of your CasaOS storage, played in the tab; your Spotify account
 * (it shows and controls what plays in the Spotify app on any of your
 * devices, or plays it in the tab; Spotify Web API with the Client ID of
 * your own Spotify app; controls need Premium); or your Jellyfin music
 * library, played in the tab.
 *
 * Local files are listed with the CasaOS API (/v1/folder) and streamed from
 * /v1/file, so nothing leaves your server. It was Music Player + Spotify
 * before 2.0.0: if that mod is installed too, only one widget shows.
 */
(function () {
  'use strict';

  if (window.__musicPlayerSpotify || window.__musicPlayerWidget) return;
  window.__musicPlayerSpotify = true;
  window.__musicPlayerWidget = true;   // the plain Music Player, if also installed, doesn't add a second widget

  // (named after Music Player + Spotify, where these settings and logins
  // started: they carry over from it as they are)
  var STORE = 'casamod-music-player-spotify';
  var OLD_STORE = 'casamod-music-player';   // the Music Player before 2.0.0: its folder, queue… are taken over once
  var DEFAULT_FOLDER = '/DATA/Media/Music';
  var AUDIO_EXT = /\.(mp3|flac|ogg|oga|opus|wav|m4a|aac|webm|weba)$/i;
  var MAX_FILES = 3000, MAX_FOLDERS = 400, MAX_DEPTH = 3;
  var TAG = '[Music Player]';

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default).
  // 'tracks' holds the plural forms of "N tracks" (Intl.PluralRules categories).
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: {
      title: 'Music', folder: 'Music folder', change: 'Change folder', scanning: 'Reading the folder…',
      empty: 'No audio files in this folder.', folderError: 'Could not open this folder.',
      nothing: 'Nothing playing', pick: 'Pick a track or press play', playlist: 'Playlist',
      tracks: { one: '{n} track', other: '{n} tracks' },
      play: 'Play', pause: 'Pause', next: 'Next', prev: 'Previous', shuffle: 'Shuffle',
      repeatAll: 'Repeat all', repeatOne: 'Repeat one', repeatOff: 'Repeat off', volume: 'Volume',
      subfolders: 'Include subfolders', use: 'Use this folder', cancel: 'Cancel', up: 'Up one level',
      loadError: 'Could not play this file, skipping.',
      search: 'Search the playlist', noMatch: 'No matching tracks.', queueAdd: 'Add to queue', queueRemove: 'Remove from queue',
      srcLocal: 'Files on CasaOS', spLibrary: 'Your library', spSettings: 'Spotify settings', spDevices: 'Devices', spBack: 'Back',
      spSearch: 'Search your playlists and Spotify', spLiked: 'Liked Songs', spOnSpotify: 'On Spotify', spLoading: 'Loading…',
      spCantOpen: 'Spotify doesn\'t let apps like this one open this playlist.', spQueued: 'In the Spotify queue (only Spotify can take it out)',
      spLike: 'Save to Liked Songs', spUnlike: 'Remove from Liked Songs', spNotConnected: 'Spotify is not connected',
      spConnectHint: 'Connect it in the settings (gear)', spNothing: 'Nothing playing on Spotify', spOpenApp: 'Play something in Spotify on any device',
      spOn: 'Playing on {name}', spFreeShort: 'Why are there no controls?',
      spFreeInfo: 'The controls need Spotify Premium: Spotify\'s API only lets Premium accounts play, pause or skip. What\'s playing still shows here.',
      spNoDevices: 'No device has Spotify open. Open Spotify on your PC, phone or TV.', spNoDevice: 'No device is playing: choose one.',
      spHttps: 'Spotify only connects with CasaOS opened over HTTPS (https://…). See the steps in the README.', spClientId: 'Client ID of your Spotify app',
      spRedirect: 'Redirect URI (add it to your Spotify app)', spCopy: 'Copy', spCopied: 'Copied', spConnectedAs: 'Connected as {name}',
      spHelp: 'How to set it up', spConnect: 'Connect', spDisconnect: 'Disconnect', spDenied: 'Access to Spotify was not allowed.',
      spError: 'Spotify didn\'t answer. Try again in a moment.', spLoginAgain: 'The Spotify login expired: connect again.',
      spNotRegistered: 'This account isn\'t in your Spotify app: add it under User Management.', spBusy: 'Spotify asked to wait a moment.',
      upNext: 'Up next', playingNow: 'Now playing', nothingNext: 'Nothing up next', jump: 'Skip to this one',
      spWeb: 'Play in this browser',
      spWebHint: 'This tab becomes a Spotify device and plays the music. It needs Premium and Web Playback SDK ticked in your Spotify app.',
      spWebStarting: 'Starting the player in this browser…', spWebReady: 'Ready: {name} is in your Spotify devices.',
      spWebOther: 'Another CasaOS tab in this browser is the device.', spWebScope: 'Connect again (below) to allow playing in this browser.',
      spWebDrm: 'This browser can\'t play Spotify here: protected content (DRM) is off or not supported.',
      spWebFailed: 'Spotify didn\'t take this browser as a device: it needs Premium and Web Playback SDK ticked in your Spotify app.',
      spWebTap: 'The browser held back the sound: press play.', spThisBrowser: 'This browser',
      jfServer: 'Jellyfin address', jfCode: 'In Jellyfin, open your profile → Quick Connect and enter this code:',
      jfQcOff: 'Quick Connect is off on this Jellyfin: turn it on in its Dashboard (General).',
      jfNoServer: 'Jellyfin didn\'t answer at this address. With CasaOS on https://, Jellyfin needs an https:// address too (see the README).',
      jfFavorite: 'Add to favorites', jfUnfavorite: 'Remove from favorites', jfFavorites: 'Favorites', jfAlbums: 'Albums', jfArtists: 'Artists',
      jfSearch: 'Search your library', jfOn: 'On Jellyfin', jfNotConnected: 'Jellyfin is not connected', jfSettings: 'Jellyfin settings',
      jfError: 'Jellyfin didn\'t answer. Try again in a moment.', jfLoginAgain: 'The Jellyfin login was revoked: connect again.',
      jfSongs: 'All songs'
    },
    ar: {
      title: 'الموسيقى', folder: 'مجلد الموسيقى', change: 'تغيير المجلد', scanning: 'جارٍ قراءة المجلد…',
      empty: 'لا توجد ملفات صوتية في هذا المجلد.', folderError: 'تعذّر فتح هذا المجلد.',
      nothing: 'لا شيء قيد التشغيل', pick: 'اختر مقطعًا أو اضغط تشغيل', playlist: 'قائمة التشغيل',
      tracks: { zero: '{n} مقطع', one: 'مقطع واحد', two: 'مقطعان', few: '{n} مقاطع', many: '{n} مقطعًا', other: '{n} مقطع' },
      play: 'تشغيل', pause: 'إيقاف مؤقت', next: 'التالي', prev: 'السابق', shuffle: 'ترتيب عشوائي',
      repeatAll: 'تكرار الكل', repeatOne: 'تكرار مقطع واحد', repeatOff: 'بدون تكرار', volume: 'مستوى الصوت',
      subfolders: 'تضمين المجلدات الفرعية', use: 'استخدام هذا المجلد', cancel: 'إلغاء', up: 'مستوى واحد للأعلى',
      loadError: 'تعذّر تشغيل هذا الملف، يتم التخطي.',
      search: 'ابحث في قائمة التشغيل', noMatch: 'لا توجد مقاطع مطابقة.', queueAdd: 'إضافة إلى قائمة الانتظار', queueRemove: 'إزالة من قائمة الانتظار',
      srcLocal: 'ملفات CasaOS', spLibrary: 'مكتبتك', spSettings: 'إعدادات Spotify', spDevices: 'الأجهزة', spBack: 'رجوع',
      spSearch: 'ابحث في قوائم التشغيل وفي Spotify', spLiked: 'الأغاني التي أعجبتك', spOnSpotify: 'على Spotify', spLoading: 'جارٍ التحميل…',
      spCantOpen: 'لا يسمح Spotify لتطبيقات مثل هذا بفتح قائمة التشغيل هذه.', spQueued: 'في قائمة انتظار Spotify (لا يمكن إزالتها إلا من Spotify)',
      spLike: 'حفظ في الأغاني التي أعجبتك', spUnlike: 'إزالة من الأغاني التي أعجبتك', spNotConnected: 'Spotify غير متصل',
      spConnectHint: 'اتصل به من الإعدادات (الترس)', spNothing: 'لا شيء قيد التشغيل على Spotify', spOpenApp: 'شغّل شيئًا في Spotify على أي جهاز',
      spOn: 'قيد التشغيل على {name}', spFreeShort: 'لماذا لا توجد أزرار تحكم؟',
      spFreeInfo: 'تتطلب أزرار التحكم Spotify Premium: لا تسمح واجهة Spotify البرمجية بالتشغيل أو الإيقاف المؤقت أو التخطي إلا لحسابات Premium. ما يُشغَّل يظل ظاهرًا هنا.',
      spNoDevices: 'لا يوجد جهاز فُتح عليه Spotify. افتح Spotify على الحاسوب أو الهاتف أو التلفاز.', spNoDevice: 'لا يوجد جهاز قيد التشغيل: اختر واحدًا.',
      spHttps: 'لا يتصل Spotify إلا عند فتح CasaOS عبر HTTPS (https://…). راجع الخطوات في README.', spClientId: 'Client ID لتطبيقك في Spotify',
      spRedirect: 'Redirect URI (أضفه إلى تطبيقك في Spotify)', spCopy: 'نسخ', spCopied: 'تم النسخ', spConnectedAs: 'متصل باسم {name}',
      spHelp: 'طريقة الإعداد', spConnect: 'اتصال', spDisconnect: 'قطع الاتصال', spDenied: 'لم يُسمح بالوصول إلى Spotify.',
      spError: 'لم يستجب Spotify. أعد المحاولة بعد قليل.', spLoginAgain: 'انتهت صلاحية تسجيل الدخول إلى Spotify: اتصل مجددًا.',
      spNotRegistered: 'هذا الحساب غير موجود في تطبيقك في Spotify: أضفه في User Management.', spBusy: 'طلب Spotify الانتظار قليلًا.',
      upNext: 'التالي', playingNow: 'قيد التشغيل الآن', nothingNext: 'لا شيء تالٍ', jump: 'انتقل إلى هذا',
      spWeb: 'التشغيل في هذا المتصفح',
      spWebHint: 'تصبح علامة التبويب هذه جهاز Spotify وتشغّل الموسيقى. يتطلب ذلك Premium وتحديد Web Playback SDK في تطبيقك على Spotify.',
      spWebStarting: 'جارٍ تشغيل المشغّل في هذا المتصفح…', spWebReady: 'جاهز: {name} ضمن أجهزتك على Spotify.',
      spWebOther: 'علامة تبويب أخرى لـ CasaOS في هذا المتصفح هي الجهاز.', spWebScope: 'اتصل مرة أخرى (أدناه) للسماح بالتشغيل في هذا المتصفح.',
      spWebDrm: 'لا يستطيع هذا المتصفح تشغيل Spotify هنا: المحتوى المحمي (DRM) معطّل أو غير مدعوم.',
      spWebFailed: 'لم يقبل Spotify هذا المتصفح كجهاز: يتطلب ذلك Premium وتحديد Web Playback SDK في تطبيقك على Spotify.',
      spWebTap: 'منع المتصفح الصوت: اضغط تشغيل.', spThisBrowser: 'هذا المتصفح',
      jfServer: 'عنوان Jellyfin', jfCode: 'في Jellyfin، افتح ملفك الشخصي ← Quick Connect وأدخل هذا الرمز:',
      jfQcOff: 'ميزة Quick Connect معطّلة في Jellyfin هذا: فعّلها من لوحة التحكم (عام).',
      jfNoServer: 'لم يستجب Jellyfin على هذا العنوان. عند فتح CasaOS عبر https://، يحتاج Jellyfin أيضًا إلى عنوان https:// (راجع README).',
      jfFavorite: 'إضافة إلى المفضلة', jfUnfavorite: 'إزالة من المفضلة', jfFavorites: 'المفضلة', jfAlbums: 'الألبومات', jfArtists: 'الفنانون',
      jfSearch: 'ابحث في مكتبتك', jfOn: 'على Jellyfin', jfNotConnected: 'Jellyfin غير متصل', jfSettings: 'إعدادات Jellyfin',
      jfError: 'لم يستجب Jellyfin. أعد المحاولة بعد قليل.', jfLoginAgain: 'أُلغي تسجيل الدخول إلى Jellyfin: اتصل مجددًا.',
      jfSongs: 'كل الأغاني'
    },
    be: {
      title: 'Музыка', folder: 'Папка з музыкай', change: 'Змяніць папку', scanning: 'Чытанне папкі…',
      empty: 'У гэтай папцы няма аўдыяфайлаў.', folderError: 'Не ўдалося адкрыць гэту папку.',
      nothing: 'Нічога не грае', pick: 'Выберыце трэк або націсніце «Прайграць»', playlist: 'Плэйліст',
      tracks: { one: '{n} трэк', few: '{n} трэкі', many: '{n} трэкаў', other: '{n} трэка' },
      play: 'Прайграць', pause: 'Паўза', next: 'Наступны', prev: 'Папярэдні', shuffle: 'Выпадкова',
      repeatAll: 'Паўтараць усё', repeatOne: 'Паўтараць адзін', repeatOff: 'Без паўтору', volume: 'Гучнасць',
      subfolders: 'Уключыць падпапкі', use: 'Выкарыстаць гэту папку', cancel: 'Скасаваць', up: 'На ўзровень вышэй',
      loadError: 'Не ўдалося прайграць гэты файл, прапускаю.',
      search: 'Пошук у плэйлісце', noMatch: 'Няма адпаведных трэкаў.', queueAdd: 'Дадаць у чаргу', queueRemove: 'Выдаліць з чаргі',
      srcLocal: 'Файлы CasaOS', spLibrary: 'Ваша бібліятэка', spSettings: 'Налады Spotify', spDevices: 'Прылады', spBack: 'Назад',
      spSearch: 'Шукаць у плэй-лістах і ў Spotify', spLiked: 'Упадабаныя песні', spOnSpotify: 'У Spotify', spLoading: 'Загрузка…',
      spCantOpen: 'Spotify не дазваляе такім праграмам адкрываць гэты плэй-ліст.', spQueued: 'У чарзе Spotify (прыбраць яго можа толькі Spotify)',
      spLike: 'Дадаць ва ўпадабаныя песні', spUnlike: 'Прыбраць з упадабаных песень', spNotConnected: 'Spotify не падключаны',
      spConnectHint: 'Падключыце яго ў наладах (шасцярня)', spNothing: 'У Spotify нічога не грае', spOpenApp: 'Уключыце нешта ў Spotify на любой прыладзе',
      spOn: 'Грае на {name}', spFreeShort: 'Чаму няма кнопак кіравання?',
      spFreeInfo: 'Для кіравання патрэбны Spotify Premium: API Spotify дазваляе ўключаць, ставіць на паўзу і пераключаць толькі акаўнтам Premium. Што грае, па-ранейшаму відаць тут.',
      spNoDevices: 'Ні на адной прыладзе не адкрыты Spotify. Адкрыйце Spotify на камп’ютары, тэлефоне ці тэлевізары.',
      spNoDevice: 'Ніводная прылада не грае: выберыце адну.',
      spHttps: 'Spotify падключаецца, толькі калі CasaOS адкрыты па HTTPS (https://…). Крокі — у README.', spClientId: 'Client ID вашай праграмы Spotify',
      spRedirect: 'Redirect URI (дадайце яго ў праграму Spotify)', spCopy: 'Капіяваць', spCopied: 'Скапіявана', spConnectedAs: 'Падключана як {name}',
      spHelp: 'Як наладзіць', spConnect: 'Падключыць', spDisconnect: 'Адключыць', spDenied: 'Доступ да Spotify не дазволены.',
      spError: 'Spotify не адказаў. Паспрабуйце яшчэ раз крыху пазней.', spLoginAgain: 'Уваход у Spotify скончыўся: падключыцеся зноў.',
      spNotRegistered: 'Гэтага акаўнта няма ў вашай праграме Spotify: дадайце яго ў User Management.', spBusy: 'Spotify папрасіў крыху пачакаць.',
      upNext: 'Далей', playingNow: 'Зараз грае', nothingNext: 'Далей нічога няма', jump: 'Перайсці да гэтага трэка',
      spWeb: 'Іграць у гэтым браўзеры',
      spWebHint: 'Гэтая ўкладка стане прыладай Spotify і будзе іграць музыку. Патрэбныя Premium і адзначаны Web Playback SDK у вашай праграме Spotify.',
      spWebStarting: 'Запуск плэера ў гэтым браўзеры…', spWebReady: 'Гатова: {name} ёсць у вашых прыладах Spotify.',
      spWebOther: 'Прыладай стала іншая ўкладка CasaOS у гэтым браўзеры.',
      spWebScope: 'Падключыцеся зноў (ніжэй), каб дазволіць прайграванне ў гэтым браўзеры.',
      spWebDrm: 'Гэты браўзер не можа прайграваць Spotify тут: абаронены змест (DRM) адключаны або не падтрымліваецца.',
      spWebFailed: 'Spotify не прыняў гэты браўзер як прыладу: патрэбныя Premium і адзначаны Web Playback SDK у вашай праграме Spotify.',
      spWebTap: 'Браўзер заблакаваў гук: націсніце «Прайграць».', spThisBrowser: 'Гэты браўзер',
      jfServer: 'Адрас Jellyfin', jfCode: 'У Jellyfin адкрыйце свой профіль → Quick Connect і ўвядзіце гэты код:',
      jfQcOff: 'Quick Connect выключаны ў гэтым Jellyfin: уключыце яго ў панэлі кіравання (Агульныя).',
      jfNoServer: 'Jellyfin не адказаў па гэтым адрасе. Калі CasaOS адкрыты праз https://, Jellyfin таксама патрэбны адрас https:// (гл. README).',
      jfFavorite: 'Дадаць у абранае', jfUnfavorite: 'Выдаліць з абранага', jfFavorites: 'Абранае', jfAlbums: 'Альбомы', jfArtists: 'Выканаўцы',
      jfSearch: 'Пошук у вашай бібліятэцы', jfOn: 'У Jellyfin', jfNotConnected: 'Jellyfin не падключаны', jfSettings: 'Налады Jellyfin',
      jfError: 'Jellyfin не адказаў. Паспрабуйце яшчэ раз крыху пазней.', jfLoginAgain: 'Уваход у Jellyfin адкліканы: падключыцеся зноў.',
      jfSongs: 'Усе песні'
    },
    bg: {
      title: 'Музика', folder: 'Папка с музика', change: 'Смяна на папката', scanning: 'Четене на папката…',
      empty: 'В тази папка няма аудиофайлове.', folderError: 'Тази папка не може да бъде отворена.',
      nothing: 'Нищо не свири', pick: 'Изберете песен или натиснете „Пусни“', playlist: 'Плейлист',
      tracks: { one: '{n} песен', other: '{n} песни' },
      play: 'Пусни', pause: 'Пауза', next: 'Следваща', prev: 'Предишна', shuffle: 'Разбъркано',
      repeatAll: 'Повтаряй всички', repeatOne: 'Повтаряй една', repeatOff: 'Без повторение', volume: 'Сила на звука',
      subfolders: 'Включи подпапките', use: 'Използвай тази папка', cancel: 'Отказ', up: 'Едно ниво нагоре',
      loadError: 'Този файл не може да се възпроизведе, пропускам го.',
      search: 'Търсене в плейлиста', noMatch: 'Няма съвпадащи песни.', queueAdd: 'Добави към опашката', queueRemove: 'Премахни от опашката',
      srcLocal: 'Файлове в CasaOS', spLibrary: 'Вашата библиотека', spSettings: 'Настройки на Spotify', spDevices: 'Устройства', spBack: 'Назад',
      spSearch: 'Търсене в плейлистите и в Spotify', spLiked: 'Харесани песни', spOnSpotify: 'В Spotify', spLoading: 'Зареждане…',
      spCantOpen: 'Spotify не позволява на приложения като това да отварят този плейлист.', spQueued: 'В опашката на Spotify (само Spotify може да я махне)',
      spLike: 'Запазване в Харесани песни', spUnlike: 'Премахване от Харесани песни', spNotConnected: 'Spotify не е свързан',
      spConnectHint: 'Свържете го в настройките (зъбно колело)', spNothing: 'В Spotify нищо не свири',
      spOpenApp: 'Пуснете нещо в Spotify на което и да е устройство', spOn: 'Свири на {name}', spFreeShort: 'Защо няма бутони за управление?',
      spFreeInfo: 'Управлението изисква Spotify Premium: API-то на Spotify позволява само на Premium акаунти да пускат, спират на пауза или прескачат. Това, което свири, продължава да се показва тук.',
      spNoDevices: 'Няма устройство с отворен Spotify. Отворете Spotify на компютъра, телефона или телевизора.',
      spNoDevice: 'Няма устройство, което да свири: изберете едно.',
      spHttps: 'Spotify се свързва само когато CasaOS е отворен през HTTPS (https://…). Стъпките са в README.',
      spClientId: 'Client ID на вашето приложение в Spotify', spRedirect: 'Redirect URI (добавете го в приложението си в Spotify)', spCopy: 'Копиране',
      spCopied: 'Копирано', spConnectedAs: 'Свързан като {name}', spHelp: 'Как да се настрои', spConnect: 'Свързване', spDisconnect: 'Прекъсване',
      spDenied: 'Достъпът до Spotify не беше разрешен.', spError: 'Spotify не отговори. Опитайте отново след малко.',
      spLoginAgain: 'Влизането в Spotify изтече: свържете се отново.',
      spNotRegistered: 'Този акаунт не е в приложението ви в Spotify: добавете го в User Management.', spBusy: 'Spotify помоли да се изчака малко.',
      upNext: 'Следва', playingNow: 'Сега звучи', nothingNext: 'Нищо не следва', jump: 'Прескочи до тази',
      spWeb: 'Възпроизвеждане в този браузър',
      spWebHint: 'Този раздел става устройство на Spotify и пуска музиката. Нужни са Premium и отметнат Web Playback SDK във вашето приложение в Spotify.',
      spWebStarting: 'Плейърът в този браузър се стартира…', spWebReady: 'Готово: {name} е сред устройствата ви в Spotify.',
      spWebOther: 'Устройството е друг раздел на CasaOS в този браузър.',
      spWebScope: 'Свържете се отново (по-долу), за да разрешите възпроизвеждане в този браузър.',
      spWebDrm: 'Този браузър не може да възпроизвежда Spotify тук: защитеното съдържание (DRM) е изключено или не се поддържа.',
      spWebFailed: 'Spotify не прие този браузър като устройство: нужни са Premium и отметнат Web Playback SDK във вашето приложение в Spotify.',
      spWebTap: 'Браузърът спря звука: натиснете „Пусни“.', spThisBrowser: 'Този браузър',
      jfServer: 'Адрес на Jellyfin', jfCode: 'В Jellyfin отворете профила си → Quick Connect и въведете този код:',
      jfQcOff: 'Quick Connect е изключен в този Jellyfin: включете го от таблото (Общи).',
      jfNoServer: 'Jellyfin не отговори на този адрес. Когато CasaOS е отворен през https://, Jellyfin също трябва да има адрес https:// (вижте README).',
      jfFavorite: 'Добавяне в любими', jfUnfavorite: 'Премахване от любими', jfFavorites: 'Любими', jfAlbums: 'Албуми', jfArtists: 'Изпълнители',
      jfSearch: 'Търсене в библиотеката ви', jfOn: 'В Jellyfin', jfNotConnected: 'Jellyfin не е свързан', jfSettings: 'Настройки на Jellyfin',
      jfError: 'Jellyfin не отговори. Опитайте отново след малко.', jfLoginAgain: 'Влизането в Jellyfin е отменено: свържете се отново.',
      jfSongs: 'Всички песни'
    },
    ca: {
      title: 'Música', folder: 'Carpeta de música', change: 'Canvia la carpeta', scanning: 'Llegint la carpeta…',
      empty: 'No hi ha fitxers d’àudio en aquesta carpeta.', folderError: 'No s’ha pogut obrir aquesta carpeta.',
      nothing: 'No sona res', pick: 'Tria una pista o prem reproduir', playlist: 'Llista de reproducció',
      tracks: { one: '{n} pista', other: '{n} pistes' },
      play: 'Reprodueix', pause: 'Pausa', next: 'Següent', prev: 'Anterior', shuffle: 'Aleatori',
      repeatAll: 'Repeteix-ho tot', repeatOne: 'Repeteix-ne una', repeatOff: 'Sense repetició', volume: 'Volum',
      subfolders: 'Inclou les subcarpetes', use: 'Fes servir aquesta carpeta', cancel: 'Cancel·la', up: 'Un nivell amunt',
      loadError: 'No s’ha pogut reproduir aquest fitxer, se salta.',
      search: 'Cerca a la llista', noMatch: 'Cap pista coincideix.', queueAdd: 'Afegeix a la cua', queueRemove: 'Treu de la cua',
      srcLocal: 'Fitxers de CasaOS', spLibrary: 'La teva biblioteca', spSettings: 'Configuració de l\'Spotify', spDevices: 'Dispositius', spBack: 'Enrere',
      spSearch: 'Cerca a les teves llistes i a l\'Spotify', spLiked: 'Cançons que t\'agraden', spOnSpotify: 'A l\'Spotify', spLoading: 'Carregant…',
      spCantOpen: 'L\'Spotify no deixa que apps com aquesta obrin aquesta llista.', spQueued: 'A la cua de l\'Spotify (només l\'Spotify la pot treure)',
      spLike: 'Desa a Cançons que t\'agraden', spUnlike: 'Treu de Cançons que t\'agraden', spNotConnected: 'L\'Spotify no està connectat',
      spConnectHint: 'Connecta-ho a la configuració (engranatge)', spNothing: 'No sona res a l\'Spotify',
      spOpenApp: 'Reprodueix alguna cosa a l\'Spotify en qualsevol dispositiu', spOn: 'Sonant a {name}', spFreeShort: 'Per què no hi ha controls?',
      spFreeInfo: 'Els controls necessiten Spotify Premium: l\'API de l\'Spotify només deixa reproduir, posar en pausa o saltar als comptes Premium. El que sona es continua mostrant aquí.',
      spNoDevices: 'Cap dispositiu té l\'Spotify obert. Obre l\'Spotify a l\'ordinador, al mòbil o a la tele.',
      spNoDevice: 'Cap dispositiu està reproduint: tria\'n un.',
      spHttps: 'L\'Spotify només es connecta amb CasaOS obert per HTTPS (https://…). Mira els passos al README.',
      spClientId: 'Client ID de la teva app de l\'Spotify', spRedirect: 'Redirect URI (afegeix-la a la teva app de l\'Spotify)', spCopy: 'Copia',
      spCopied: 'Copiat', spConnectedAs: 'Connectat com a {name}', spHelp: 'Com configurar-ho', spConnect: 'Connecta', spDisconnect: 'Desconnecta',
      spDenied: 'No s\'ha permès l\'accés a l\'Spotify.', spError: 'L\'Spotify no ha respost. Torna-ho a provar d\'aquí a una estona.',
      spLoginAgain: 'La sessió de l\'Spotify ha caducat: torna a connectar.',
      spNotRegistered: 'Aquest compte no és a la teva app de l\'Spotify: afegeix-lo a User Management.', spBusy: 'L\'Spotify ha demanat esperar una mica.',
      upNext: 'A continuació', playingNow: 'Sonant ara', nothingNext: 'No hi ha res a continuació', jump: 'Salta a aquesta',
      spWeb: 'Reprodueix en aquest navegador',
      spWebHint: 'Aquesta pestanya es converteix en un dispositiu de Spotify i reprodueix la música. Cal Premium i Web Playback SDK marcat a la teva app de Spotify.',
      spWebStarting: 'S\'està iniciant el reproductor en aquest navegador…', spWebReady: 'A punt: {name} és als teus dispositius de Spotify.',
      spWebOther: 'Una altra pestanya del CasaOS en aquest navegador és el dispositiu.',
      spWebScope: 'Torna a connectar (a sota) per permetre la reproducció en aquest navegador.',
      spWebDrm: 'Aquest navegador no pot reproduir Spotify aquí: el contingut protegit (DRM) està desactivat o no és compatible.',
      spWebFailed: 'Spotify no ha acceptat aquest navegador com a dispositiu: cal Premium i Web Playback SDK marcat a la teva app de Spotify.',
      spWebTap: 'El navegador ha retingut el so: prem reproduir.', spThisBrowser: 'Aquest navegador',
      jfServer: 'Adreça del Jellyfin', jfCode: 'Al Jellyfin, obre el teu perfil → Quick Connect i introdueix aquest codi:',
      jfQcOff: 'El Quick Connect està desactivat en aquest Jellyfin: activa\'l al seu tauler (General).',
      jfNoServer: 'El Jellyfin no ha respost en aquesta adreça. Amb el CasaOS a https://, el Jellyfin també necessita una adreça https:// (consulta el README).',
      jfFavorite: 'Afegeix als preferits', jfUnfavorite: 'Treu dels preferits', jfFavorites: 'Preferits', jfAlbums: 'Àlbums',
      jfArtists: 'Artistes', jfSearch: 'Cerca a la teva biblioteca', jfOn: 'Al Jellyfin', jfNotConnected: 'El Jellyfin no està connectat',
      jfSettings: 'Configuració del Jellyfin', jfError: 'El Jellyfin no ha respost. Torna-ho a provar d\'aquí a una estona.',
      jfLoginAgain: 'La sessió del Jellyfin s\'ha revocat: torna a connectar.',
      jfSongs: 'Totes les cançons'
    },
    cs: {
      title: 'Hudba', folder: 'Složka s hudbou', change: 'Změnit složku', scanning: 'Čtení složky…',
      empty: 'V této složce nejsou žádné zvukové soubory.', folderError: 'Tuto složku nelze otevřít.',
      nothing: 'Nic nehraje', pick: 'Vyberte skladbu nebo stiskněte přehrát', playlist: 'Playlist',
      tracks: { one: '{n} skladba', few: '{n} skladby', many: '{n} skladby', other: '{n} skladeb' },
      play: 'Přehrát', pause: 'Pozastavit', next: 'Další', prev: 'Předchozí', shuffle: 'Náhodně',
      repeatAll: 'Opakovat vše', repeatOne: 'Opakovat jednu', repeatOff: 'Neopakovat', volume: 'Hlasitost',
      subfolders: 'Včetně podsložek', use: 'Použít tuto složku', cancel: 'Zrušit', up: 'O úroveň výš',
      loadError: 'Tento soubor nelze přehrát, přeskakuji.',
      search: 'Hledat v playlistu', noMatch: 'Žádné odpovídající skladby.', queueAdd: 'Přidat do fronty', queueRemove: 'Odebrat z fronty',
      srcLocal: 'Soubory v CasaOS', spLibrary: 'Vaše knihovna', spSettings: 'Nastavení Spotify', spDevices: 'Zařízení', spBack: 'Zpět',
      spSearch: 'Hledat v playlistech a na Spotify', spLiked: 'Oblíbené skladby', spOnSpotify: 'Na Spotify', spLoading: 'Načítání…',
      spCantOpen: 'Spotify nedovoluje aplikacím, jako je tato, otevřít tento playlist.', spQueued: 'Ve frontě Spotify (odebrat ji může jen Spotify)',
      spLike: 'Uložit do Oblíbených skladeb', spUnlike: 'Odebrat z Oblíbených skladeb', spNotConnected: 'Spotify není připojené',
      spConnectHint: 'Připojte ho v nastavení (ozubené kolo)', spNothing: 'Na Spotify nic nehraje',
      spOpenApp: 'Pusťte něco na Spotify na libovolném zařízení', spOn: 'Hraje na {name}', spFreeShort: 'Proč tu nejsou ovládací prvky?',
      spFreeInfo: 'Ovládání vyžaduje Spotify Premium: API Spotify dovoluje přehrávat, pozastavovat a přeskakovat jen účtům Premium. Co hraje, se tu dál zobrazuje.',
      spNoDevices: 'Žádné zařízení nemá otevřené Spotify. Otevřete Spotify v počítači, telefonu nebo televizi.',
      spNoDevice: 'Žádné zařízení nehraje: vyberte jedno.',
      spHttps: 'Spotify se připojí jen s CasaOS otevřeným přes HTTPS (https://…). Postup najdete v README.', spClientId: 'Client ID vaší aplikace Spotify',
      spRedirect: 'Redirect URI (přidejte ho do své aplikace Spotify)', spCopy: 'Kopírovat', spCopied: 'Zkopírováno', spConnectedAs: 'Připojeno jako {name}',
      spHelp: 'Jak to nastavit', spConnect: 'Připojit', spDisconnect: 'Odpojit', spDenied: 'Přístup ke Spotify nebyl povolen.',
      spError: 'Spotify neodpovědělo. Zkuste to za chvíli znovu.', spLoginAgain: 'Přihlášení ke Spotify vypršelo: připojte se znovu.',
      spNotRegistered: 'Tento účet není ve vaší aplikaci Spotify: přidejte ho v User Management.', spBusy: 'Spotify požádalo o chvilku strpení.',
      upNext: 'Další v pořadí', playingNow: 'Právě hraje', nothingNext: 'Nic dalšího v pořadí', jump: 'Přeskočit na tuto',
      spWeb: 'Přehrávat v tomto prohlížeči',
      spWebHint: 'Tato karta se stane zařízením Spotify a bude přehrávat hudbu. Vyžaduje Premium a zaškrtnuté Web Playback SDK ve vaší aplikaci Spotify.',
      spWebStarting: 'Spouštění přehrávače v tomto prohlížeči…', spWebReady: 'Hotovo: {name} je mezi vašimi zařízeními Spotify.',
      spWebOther: 'Zařízením je jiná karta CasaOS v tomto prohlížeči.',
      spWebScope: 'Připojte se znovu (níže), abyste povolili přehrávání v tomto prohlížeči.',
      spWebDrm: 'Tento prohlížeč tu nemůže přehrávat Spotify: chráněný obsah (DRM) je vypnutý nebo není podporován.',
      spWebFailed: 'Spotify nepřijal tento prohlížeč jako zařízení: vyžaduje Premium a zaškrtnuté Web Playback SDK ve vaší aplikaci Spotify.',
      spWebTap: 'Prohlížeč zadržel zvuk: stiskněte přehrát.', spThisBrowser: 'Tento prohlížeč',
      jfServer: 'Adresa Jellyfinu', jfCode: 'V Jellyfinu otevřete svůj profil → Quick Connect a zadejte tento kód:',
      jfQcOff: 'Quick Connect je v tomto Jellyfinu vypnutý: zapněte ho v jeho ovládacím panelu (Obecné).',
      jfNoServer: 'Jellyfin na této adrese neodpověděl. Když je CasaOS otevřený přes https://, potřebuje i Jellyfin adresu https:// (viz README).',
      jfFavorite: 'Přidat do oblíbených', jfUnfavorite: 'Odebrat z oblíbených', jfFavorites: 'Oblíbené', jfAlbums: 'Alba', jfArtists: 'Interpreti',
      jfSearch: 'Hledat ve vaší knihovně', jfOn: 'V Jellyfinu', jfNotConnected: 'Jellyfin není připojený', jfSettings: 'Nastavení Jellyfinu',
      jfError: 'Jellyfin neodpověděl. Zkuste to za chvíli znovu.', jfLoginAgain: 'Přihlášení k Jellyfinu bylo zrušeno: připojte se znovu.',
      jfSongs: 'Všechny skladby'
    },
    de: {
      title: 'Musik', folder: 'Musikordner', change: 'Ordner wechseln', scanning: 'Ordner wird gelesen…',
      empty: 'Keine Audiodateien in diesem Ordner.', folderError: 'Dieser Ordner konnte nicht geöffnet werden.',
      nothing: 'Es läuft nichts', pick: 'Wähle einen Titel oder drücke Play', playlist: 'Playlist',
      tracks: { one: '{n} Titel', other: '{n} Titel' },
      play: 'Abspielen', pause: 'Pause', next: 'Weiter', prev: 'Zurück', shuffle: 'Zufallswiedergabe',
      repeatAll: 'Alle wiederholen', repeatOne: 'Einen wiederholen', repeatOff: 'Nicht wiederholen', volume: 'Lautstärke',
      subfolders: 'Unterordner einbeziehen', use: 'Diesen Ordner verwenden', cancel: 'Abbrechen', up: 'Eine Ebene höher',
      loadError: 'Diese Datei kann nicht abgespielt werden, wird übersprungen.',
      search: 'Playlist durchsuchen', noMatch: 'Keine passenden Titel.', queueAdd: 'Zur Warteschlange hinzufügen', queueRemove: 'Aus der Warteschlange entfernen',
      srcLocal: 'Dateien in CasaOS', spLibrary: 'Deine Bibliothek', spSettings: 'Spotify-Einstellungen', spDevices: 'Geräte', spBack: 'Zurück',
      spSearch: 'In deinen Playlists und auf Spotify suchen', spLiked: 'Lieblingssongs', spOnSpotify: 'Auf Spotify', spLoading: 'Wird geladen…',
      spCantOpen: 'Spotify lässt Apps wie diese diese Playlist nicht öffnen.', spQueued: 'In der Spotify-Warteschlange (nur Spotify kann ihn entfernen)',
      spLike: 'Zu Lieblingssongs hinzufügen', spUnlike: 'Aus Lieblingssongs entfernen', spNotConnected: 'Spotify ist nicht verbunden',
      spConnectHint: 'In den Einstellungen verbinden (Zahnrad)', spNothing: 'Auf Spotify läuft nichts',
      spOpenApp: 'Spiel auf einem beliebigen Gerät etwas in Spotify ab', spOn: 'Läuft auf {name}', spFreeShort: 'Warum gibt es keine Steuerung?',
      spFreeInfo: 'Die Steuerung braucht Spotify Premium: Die Spotify-API lässt nur Premium-Konten abspielen, pausieren oder überspringen. Was läuft, wird hier weiter angezeigt.',
      spNoDevices: 'Kein Gerät hat Spotify geöffnet. Öffne Spotify auf deinem PC, Handy oder Fernseher.', spNoDevice: 'Kein Gerät spielt ab: wähle eins.',
      spHttps: 'Spotify verbindet sich nur, wenn CasaOS über HTTPS (https://…) geöffnet ist. Die Schritte stehen in der README.',
      spClientId: 'Client ID deiner Spotify-App', spRedirect: 'Redirect URI (in deiner Spotify-App eintragen)', spCopy: 'Kopieren', spCopied: 'Kopiert',
      spConnectedAs: 'Verbunden als {name}', spHelp: 'So richtest du es ein', spConnect: 'Verbinden', spDisconnect: 'Trennen',
      spDenied: 'Der Zugriff auf Spotify wurde nicht erlaubt.', spError: 'Spotify hat nicht geantwortet. Versuch es gleich noch einmal.',
      spLoginAgain: 'Die Spotify-Anmeldung ist abgelaufen: verbinde dich neu.',
      spNotRegistered: 'Dieses Konto ist nicht in deiner Spotify-App: füge es unter User Management hinzu.', spBusy: 'Spotify bittet, kurz zu warten.',
      upNext: 'Als Nächstes', playingNow: 'Läuft gerade', nothingNext: 'Als Nächstes kommt nichts', jump: 'Zu diesem springen',
      spWeb: 'In diesem Browser abspielen',
      spWebHint: 'Dieser Tab wird zu einem Spotify-Gerät und spielt die Musik ab. Nötig sind Premium und ein Häkchen bei Web Playback SDK in deiner Spotify-App.',
      spWebStarting: 'Player in diesem Browser wird gestartet…', spWebReady: 'Bereit: {name} ist in deinen Spotify-Geräten.',
      spWebOther: 'Ein anderer CasaOS-Tab in diesem Browser ist das Gerät.',
      spWebScope: 'Verbinde dich erneut (unten), um die Wiedergabe in diesem Browser zu erlauben.',
      spWebDrm: 'Dieser Browser kann Spotify hier nicht abspielen: Geschützte Inhalte (DRM) sind aus oder werden nicht unterstützt.',
      spWebFailed: 'Spotify hat diesen Browser nicht als Gerät angenommen: Nötig sind Premium und ein Häkchen bei Web Playback SDK in deiner Spotify-App.',
      spWebTap: 'Der Browser hat den Ton zurückgehalten: Drück auf Play.', spThisBrowser: 'Dieser Browser',
      jfServer: 'Jellyfin-Adresse', jfCode: 'Öffne in Jellyfin dein Profil → Quick Connect und gib diesen Code ein:',
      jfQcOff: 'Quick Connect ist in diesem Jellyfin aus: Schalte es im Dashboard (Allgemein) ein.',
      jfNoServer: 'Jellyfin hat unter dieser Adresse nicht geantwortet. Ist CasaOS per https:// geöffnet, braucht Jellyfin auch eine https://-Adresse (siehe README).',
      jfFavorite: 'Zu Favoriten hinzufügen', jfUnfavorite: 'Aus Favoriten entfernen', jfFavorites: 'Favoriten', jfAlbums: 'Alben',
      jfArtists: 'Künstler', jfSearch: 'Deine Bibliothek durchsuchen', jfOn: 'In Jellyfin', jfNotConnected: 'Jellyfin ist nicht verbunden',
      jfSettings: 'Jellyfin-Einstellungen', jfError: 'Jellyfin hat nicht geantwortet. Versuch es gleich noch einmal.',
      jfLoginAgain: 'Die Jellyfin-Anmeldung wurde widerrufen: verbinde dich neu.',
      jfSongs: 'Alle Titel'
    },
    el: {
      title: 'Μουσική', folder: 'Φάκελος μουσικής', change: 'Αλλαγή φακέλου', scanning: 'Ανάγνωση φακέλου…',
      empty: 'Δεν υπάρχουν αρχεία ήχου σε αυτόν τον φάκελο.', folderError: 'Δεν ήταν δυνατό το άνοιγμα του φακέλου.',
      nothing: 'Δεν παίζει τίποτα', pick: 'Επιλέξτε κομμάτι ή πατήστε αναπαραγωγή', playlist: 'Λίστα αναπαραγωγής',
      tracks: { one: '{n} κομμάτι', other: '{n} κομμάτια' },
      play: 'Αναπαραγωγή', pause: 'Παύση', next: 'Επόμενο', prev: 'Προηγούμενο', shuffle: 'Τυχαία σειρά',
      repeatAll: 'Επανάληψη όλων', repeatOne: 'Επανάληψη ενός', repeatOff: 'Χωρίς επανάληψη', volume: 'Ένταση',
      subfolders: 'Συμπερίληψη υποφακέλων', use: 'Χρήση αυτού του φακέλου', cancel: 'Άκυρο', up: 'Ένα επίπεδο πάνω',
      loadError: 'Δεν ήταν δυνατή η αναπαραγωγή του αρχείου, παραλείπεται.',
      search: 'Αναζήτηση στη λίστα', noMatch: 'Δεν βρέθηκαν κομμάτια.', queueAdd: 'Προσθήκη στην ουρά', queueRemove: 'Αφαίρεση από την ουρά',
      srcLocal: 'Αρχεία στο CasaOS', spLibrary: 'Η βιβλιοθήκη σας', spSettings: 'Ρυθμίσεις Spotify', spDevices: 'Συσκευές', spBack: 'Πίσω',
      spSearch: 'Αναζήτηση στις λίστες σας και στο Spotify', spLiked: 'Αγαπημένα τραγούδια', spOnSpotify: 'Στο Spotify', spLoading: 'Φόρτωση…',
      spCantOpen: 'Το Spotify δεν επιτρέπει σε εφαρμογές σαν αυτή να ανοίξουν αυτή τη λίστα.',
      spQueued: 'Στην ουρά του Spotify (μόνο το Spotify μπορεί να το αφαιρέσει)', spLike: 'Αποθήκευση στα Αγαπημένα τραγούδια',
      spUnlike: 'Αφαίρεση από τα Αγαπημένα τραγούδια', spNotConnected: 'Το Spotify δεν είναι συνδεδεμένο',
      spConnectHint: 'Συνδέστε το στις ρυθμίσεις (γρανάζι)', spNothing: 'Τίποτα δεν παίζει στο Spotify',
      spOpenApp: 'Βάλτε κάτι να παίξει στο Spotify σε οποιαδήποτε συσκευή', spOn: 'Παίζει σε {name}', spFreeShort: 'Γιατί δεν υπάρχουν χειριστήρια;',
      spFreeInfo: 'Τα χειριστήρια χρειάζονται Spotify Premium: το API του Spotify επιτρέπει μόνο σε λογαριασμούς Premium να παίζουν, να κάνουν παύση ή να προσπερνούν. Ό,τι παίζει εξακολουθεί να φαίνεται εδώ.',
      spNoDevices: 'Καμία συσκευή δεν έχει ανοιχτό το Spotify. Ανοίξτε το Spotify στον υπολογιστή, στο κινητό ή στην τηλεόραση.',
      spNoDevice: 'Καμία συσκευή δεν παίζει: επιλέξτε μία.',
      spHttps: 'Το Spotify συνδέεται μόνο με το CasaOS ανοιχτό μέσω HTTPS (https://…). Δείτε τα βήματα στο README.',
      spClientId: 'Client ID της εφαρμογής σας στο Spotify', spRedirect: 'Redirect URI (προσθέστε το στην εφαρμογή σας στο Spotify)', spCopy: 'Αντιγραφή',
      spCopied: 'Αντιγράφηκε', spConnectedAs: 'Συνδεδεμένος ως {name}', spHelp: 'Πώς ρυθμίζεται', spConnect: 'Σύνδεση', spDisconnect: 'Αποσύνδεση',
      spDenied: 'Η πρόσβαση στο Spotify δεν επιτράπηκε.', spError: 'Το Spotify δεν απάντησε. Δοκιμάστε ξανά σε λίγο.',
      spLoginAgain: 'Η σύνδεση στο Spotify έληξε: συνδεθείτε ξανά.',
      spNotRegistered: 'Αυτός ο λογαριασμός δεν είναι στην εφαρμογή σας στο Spotify: προσθέστε τον στο User Management.',
      spBusy: 'Το Spotify ζήτησε να περιμένετε λίγο.',
      upNext: 'Ακολουθεί', playingNow: 'Παίζει τώρα', nothingNext: 'Δεν ακολουθεί τίποτα', jump: 'Μετάβαση σε αυτό',
      spWeb: 'Αναπαραγωγή σε αυτό το πρόγραμμα περιήγησης',
      spWebHint: 'Αυτή η καρτέλα γίνεται συσκευή Spotify και παίζει τη μουσική. Χρειάζεται Premium και επιλεγμένο το Web Playback SDK στην εφαρμογή σας στο Spotify.',
      spWebStarting: 'Εκκίνηση του player σε αυτό το πρόγραμμα περιήγησης…', spWebReady: 'Έτοιμο: το {name} είναι στις συσκευές σας στο Spotify.',
      spWebOther: 'Η συσκευή είναι μια άλλη καρτέλα του CasaOS σε αυτό το πρόγραμμα περιήγησης.',
      spWebScope: 'Συνδεθείτε ξανά (παρακάτω) για να επιτρέψετε την αναπαραγωγή σε αυτό το πρόγραμμα περιήγησης.',
      spWebDrm: 'Αυτό το πρόγραμμα περιήγησης δεν μπορεί να παίξει Spotify εδώ: το προστατευμένο περιεχόμενο (DRM) είναι απενεργοποιημένο ή δεν υποστηρίζεται.',
      spWebFailed: 'Το Spotify δεν δέχτηκε αυτό το πρόγραμμα περιήγησης ως συσκευή: χρειάζεται Premium και επιλεγμένο το Web Playback SDK στην εφαρμογή σας στο Spotify.',
      spWebTap: 'Το πρόγραμμα περιήγησης συγκράτησε τον ήχο: πατήστε αναπαραγωγή.', spThisBrowser: 'Αυτό το πρόγραμμα περιήγησης',
      jfServer: 'Διεύθυνση του Jellyfin', jfCode: 'Στο Jellyfin, ανοίξτε το προφίλ σας → Quick Connect και πληκτρολογήστε αυτόν τον κωδικό:',
      jfQcOff: 'Το Quick Connect είναι απενεργοποιημένο σε αυτό το Jellyfin: ενεργοποιήστε το στον Πίνακα ελέγχου του (Γενικά).',
      jfNoServer: 'Το Jellyfin δεν απάντησε σε αυτή τη διεύθυνση. Με το CasaOS σε https://, και το Jellyfin χρειάζεται διεύθυνση https:// (δείτε το README).',
      jfFavorite: 'Προσθήκη στα αγαπημένα', jfUnfavorite: 'Αφαίρεση από τα αγαπημένα', jfFavorites: 'Αγαπημένα', jfAlbums: 'Άλμπουμ',
      jfArtists: 'Καλλιτέχνες', jfSearch: 'Αναζήτηση στη βιβλιοθήκη σας', jfOn: 'Στο Jellyfin',
      jfNotConnected: 'Το Jellyfin δεν είναι συνδεδεμένο', jfSettings: 'Ρυθμίσεις Jellyfin',
      jfError: 'Το Jellyfin δεν απάντησε. Δοκιμάστε ξανά σε λίγο.', jfLoginAgain: 'Η σύνδεση στο Jellyfin ανακλήθηκε: συνδεθείτε ξανά.',
      jfSongs: 'Όλα τα τραγούδια'
    },
    es: {
      title: 'Música', folder: 'Carpeta de música', change: 'Cambiar carpeta', scanning: 'Leyendo la carpeta…',
      empty: 'No hay archivos de audio en esta carpeta.', folderError: 'No se pudo abrir esta carpeta.',
      nothing: 'No suena nada', pick: 'Elige una pista o pulsa reproducir', playlist: 'Lista de reproducción',
      tracks: { one: '{n} pista', other: '{n} pistas' },
      play: 'Reproducir', pause: 'Pausar', next: 'Siguiente', prev: 'Anterior', shuffle: 'Aleatorio',
      repeatAll: 'Repetir todo', repeatOne: 'Repetir una', repeatOff: 'Sin repetir', volume: 'Volumen',
      subfolders: 'Incluir subcarpetas', use: 'Usar esta carpeta', cancel: 'Cancelar', up: 'Subir un nivel',
      loadError: 'No se pudo reproducir este archivo, se omite.',
      search: 'Buscar en la lista', noMatch: 'No hay pistas que coincidan.', queueAdd: 'Añadir a la cola', queueRemove: 'Quitar de la cola',
      srcLocal: 'Archivos de CasaOS', spLibrary: 'Tu biblioteca', spSettings: 'Ajustes de Spotify', spDevices: 'Dispositivos', spBack: 'Volver',
      spSearch: 'Buscar en tus listas y en Spotify', spLiked: 'Canciones que te gustan', spOnSpotify: 'En Spotify', spLoading: 'Cargando…',
      spCantOpen: 'Spotify no permite a apps como esta abrir esta lista.', spQueued: 'En la cola de Spotify (solo Spotify puede quitarla)',
      spLike: 'Guardar en Canciones que te gustan', spUnlike: 'Quitar de Canciones que te gustan', spNotConnected: 'Spotify no está conectado',
      spConnectHint: 'Conéctalo en los ajustes (engranaje)', spNothing: 'No suena nada en Spotify',
      spOpenApp: 'Reproduce algo en Spotify en cualquier dispositivo', spOn: 'Sonando en {name}', spFreeShort: '¿Por qué no hay controles?',
      spFreeInfo: 'Los controles necesitan Spotify Premium: la API de Spotify solo deja a las cuentas Premium reproducir, pausar o saltar. Lo que suena se sigue mostrando aquí.',
      spNoDevices: 'Ningún dispositivo tiene Spotify abierto. Abre Spotify en tu PC, móvil o TV.',
      spNoDevice: 'Ningún dispositivo está reproduciendo: elige uno.',
      spHttps: 'Spotify solo se conecta con CasaOS abierto por HTTPS (https://…). Mira los pasos en el README.',
      spClientId: 'Client ID de tu app de Spotify', spRedirect: 'Redirect URI (añádela a tu app de Spotify)', spCopy: 'Copiar', spCopied: 'Copiado',
      spConnectedAs: 'Conectado como {name}', spHelp: 'Cómo configurarlo', spConnect: 'Conectar', spDisconnect: 'Desconectar',
      spDenied: 'No se permitió el acceso a Spotify.', spError: 'Spotify no respondió. Inténtalo de nuevo en un momento.',
      spLoginAgain: 'La sesión de Spotify caducó: vuelve a conectar.',
      spNotRegistered: 'Esta cuenta no está en tu app de Spotify: añádela en User Management.', spBusy: 'Spotify pidió esperar un momento.',
      upNext: 'A continuación', playingNow: 'Sonando ahora', nothingNext: 'No hay nada a continuación', jump: 'Saltar a esta',
      spWeb: 'Reproducir en este navegador',
      spWebHint: 'Esta pestaña se convierte en un dispositivo de Spotify y reproduce la música. Necesita Premium y Web Playback SDK marcado en tu app de Spotify.',
      spWebStarting: 'Iniciando el reproductor en este navegador…', spWebReady: 'Listo: {name} está en tus dispositivos de Spotify.',
      spWebOther: 'Otra pestaña de CasaOS en este navegador es el dispositivo.',
      spWebScope: 'Vuelve a conectar (abajo) para permitir reproducir en este navegador.',
      spWebDrm: 'Este navegador no puede reproducir Spotify aquí: el contenido protegido (DRM) está desactivado o no es compatible.',
      spWebFailed: 'Spotify no aceptó este navegador como dispositivo: necesita Premium y Web Playback SDK marcado en tu app de Spotify.',
      spWebTap: 'El navegador retuvo el sonido: pulsa reproducir.', spThisBrowser: 'Este navegador',
      jfServer: 'Dirección de Jellyfin', jfCode: 'En Jellyfin, abre tu perfil → Quick Connect e introduce este código:',
      jfQcOff: 'Quick Connect está desactivado en este Jellyfin: actívalo en su Panel de control (General).',
      jfNoServer: 'Jellyfin no respondió en esta dirección. Con CasaOS en https://, Jellyfin también necesita una dirección https:// (consulta el README).',
      jfFavorite: 'Añadir a favoritos', jfUnfavorite: 'Quitar de favoritos', jfFavorites: 'Favoritos', jfAlbums: 'Álbumes', jfArtists: 'Artistas',
      jfSearch: 'Buscar en tu biblioteca', jfOn: 'En Jellyfin', jfNotConnected: 'Jellyfin no está conectado', jfSettings: 'Ajustes de Jellyfin',
      jfError: 'Jellyfin no respondió. Inténtalo de nuevo en un momento.', jfLoginAgain: 'La sesión de Jellyfin se revocó: vuelve a conectar.',
      jfSongs: 'Todas las canciones'
    },
    fr: {
      title: 'Musique', folder: 'Dossier de musique', change: 'Changer de dossier', scanning: 'Lecture du dossier…',
      empty: 'Aucun fichier audio dans ce dossier.', folderError: 'Impossible d’ouvrir ce dossier.',
      nothing: 'Aucune lecture', pick: 'Choisissez une piste ou appuyez sur lecture', playlist: 'Liste de lecture',
      tracks: { one: '{n} piste', other: '{n} pistes' },
      play: 'Lecture', pause: 'Pause', next: 'Suivant', prev: 'Précédent', shuffle: 'Aléatoire',
      repeatAll: 'Tout répéter', repeatOne: 'Répéter une piste', repeatOff: 'Sans répétition', volume: 'Volume',
      subfolders: 'Inclure les sous-dossiers', use: 'Utiliser ce dossier', cancel: 'Annuler', up: 'Remonter d’un niveau',
      loadError: 'Impossible de lire ce fichier, passage au suivant.',
      search: 'Rechercher dans la liste', noMatch: 'Aucune piste correspondante.', queueAdd: 'Ajouter à la file d’attente', queueRemove: 'Retirer de la file d’attente',
      srcLocal: 'Fichiers de CasaOS', spLibrary: 'Votre bibliothèque', spSettings: 'Réglages Spotify', spDevices: 'Appareils', spBack: 'Retour',
      spSearch: 'Rechercher dans vos playlists et sur Spotify', spLiked: 'Titres likés', spOnSpotify: 'Sur Spotify', spLoading: 'Chargement…',
      spCantOpen: 'Spotify ne laisse pas les applis comme celle-ci ouvrir cette playlist.',
      spQueued: 'Dans la file d\'attente Spotify (seul Spotify peut l\'en retirer)', spLike: 'Ajouter aux Titres likés',
      spUnlike: 'Retirer des Titres likés', spNotConnected: 'Spotify n\'est pas connecté', spConnectHint: 'Connectez-le dans les réglages (roue dentée)',
      spNothing: 'Rien en lecture sur Spotify', spOpenApp: 'Lancez quelque chose dans Spotify sur n\'importe quel appareil', spOn: 'En lecture sur {name}',
      spFreeShort: 'Pourquoi pas de commandes ?',
      spFreeInfo: 'Les commandes nécessitent Spotify Premium : l\'API de Spotify ne laisse que les comptes Premium lancer, mettre en pause ou passer. Ce qui joue reste affiché ici.',
      spNoDevices: 'Aucun appareil n\'a Spotify ouvert. Ouvrez Spotify sur votre PC, téléphone ou TV.',
      spNoDevice: 'Aucun appareil en lecture : choisissez-en un.',
      spHttps: 'Spotify ne se connecte qu\'avec CasaOS ouvert en HTTPS (https://…). Voir les étapes dans le README.',
      spClientId: 'Client ID de votre appli Spotify', spRedirect: 'Redirect URI (à ajouter à votre appli Spotify)', spCopy: 'Copier', spCopied: 'Copié',
      spConnectedAs: 'Connecté en tant que {name}', spHelp: 'Comment le configurer', spConnect: 'Connecter', spDisconnect: 'Déconnecter',
      spDenied: 'L\'accès à Spotify n\'a pas été autorisé.', spError: 'Spotify n\'a pas répondu. Réessayez dans un instant.',
      spLoginAgain: 'La connexion à Spotify a expiré : reconnectez-vous.',
      spNotRegistered: 'Ce compte n\'est pas dans votre appli Spotify : ajoutez-le dans User Management.', spBusy: 'Spotify demande d\'attendre un instant.',
      upNext: 'À suivre', playingNow: 'En cours de lecture', nothingNext: 'Rien à suivre', jump: 'Passer à celle-ci',
      spWeb: 'Lire dans ce navigateur',
      spWebHint: 'Cet onglet devient un appareil Spotify et joue la musique. Il faut Premium et Web Playback SDK coché dans votre appli Spotify.',
      spWebStarting: 'Démarrage du lecteur dans ce navigateur…', spWebReady: 'Prêt : {name} figure dans vos appareils Spotify.',
      spWebOther: 'Un autre onglet CasaOS de ce navigateur est l\'appareil.',
      spWebScope: 'Reconnectez-vous (ci-dessous) pour autoriser la lecture dans ce navigateur.',
      spWebDrm: 'Ce navigateur ne peut pas lire Spotify ici : le contenu protégé (DRM) est désactivé ou non pris en charge.',
      spWebFailed: 'Spotify n\'a pas accepté ce navigateur comme appareil : il faut Premium et Web Playback SDK coché dans votre appli Spotify.',
      spWebTap: 'Le navigateur a bloqué le son : appuyez sur lecture.', spThisBrowser: 'Ce navigateur',
      jfServer: 'Adresse de Jellyfin', jfCode: 'Dans Jellyfin, ouvrez votre profil → Quick Connect et saisissez ce code :',
      jfQcOff: 'Quick Connect est désactivé sur ce Jellyfin : activez-le dans son tableau de bord (Général).',
      jfNoServer: 'Jellyfin n\'a pas répondu à cette adresse. Avec CasaOS en https://, Jellyfin a aussi besoin d\'une adresse https:// (voir le README).',
      jfFavorite: 'Ajouter aux favoris', jfUnfavorite: 'Retirer des favoris', jfFavorites: 'Favoris', jfAlbums: 'Albums', jfArtists: 'Artistes',
      jfSearch: 'Rechercher dans votre bibliothèque', jfOn: 'Sur Jellyfin', jfNotConnected: 'Jellyfin n\'est pas connecté',
      jfSettings: 'Réglages Jellyfin', jfError: 'Jellyfin n\'a pas répondu. Réessayez dans un instant.',
      jfLoginAgain: 'La connexion à Jellyfin a été révoquée : reconnectez-vous.',
      jfSongs: 'Tous les titres'
    },
    hr: {
      title: 'Glazba', folder: 'Mapa s glazbom', change: 'Promijeni mapu', scanning: 'Čitanje mape…',
      empty: 'U ovoj mapi nema audiodatoteka.', folderError: 'Ovu mapu nije moguće otvoriti.',
      nothing: 'Ništa ne svira', pick: 'Odaberite pjesmu ili pritisnite reprodukciju', playlist: 'Popis za reprodukciju',
      tracks: { one: '{n} pjesma', few: '{n} pjesme', other: '{n} pjesama' },
      play: 'Reproduciraj', pause: 'Pauza', next: 'Sljedeća', prev: 'Prethodna', shuffle: 'Nasumično',
      repeatAll: 'Ponavljaj sve', repeatOne: 'Ponavljaj jednu', repeatOff: 'Bez ponavljanja', volume: 'Glasnoća',
      subfolders: 'Uključi podmape', use: 'Koristi ovu mapu', cancel: 'Odustani', up: 'Jednu razinu gore',
      loadError: 'Ovu datoteku nije moguće reproducirati, preskačem.',
      search: 'Pretraži popis', noMatch: 'Nema odgovarajućih pjesama.', queueAdd: 'Dodaj u red čekanja', queueRemove: 'Ukloni iz reda čekanja',
      srcLocal: 'Datoteke u CasaOS-u', spLibrary: 'Vaša biblioteka', spSettings: 'Postavke Spotifyja', spDevices: 'Uređaji', spBack: 'Natrag',
      spSearch: 'Pretraži popise i Spotify', spLiked: 'Omiljene pjesme', spOnSpotify: 'Na Spotifyju', spLoading: 'Učitavanje…',
      spCantOpen: 'Spotify ne dopušta aplikacijama poput ove da otvore ovaj popis.', spQueued: 'U Spotify redu čekanja (ukloniti ga može samo Spotify)',
      spLike: 'Spremi u Omiljene pjesme', spUnlike: 'Ukloni iz Omiljenih pjesama', spNotConnected: 'Spotify nije povezan',
      spConnectHint: 'Povežite ga u postavkama (zupčanik)', spNothing: 'Na Spotifyju ništa ne svira',
      spOpenApp: 'Pustite nešto na Spotifyju na bilo kojem uređaju', spOn: 'Svira na: {name}', spFreeShort: 'Zašto nema kontrola?',
      spFreeInfo: 'Kontrole trebaju Spotify Premium: Spotifyjev API dopušta reprodukciju, pauzu i preskakanje samo Premium računima. Ono što svira i dalje se prikazuje ovdje.',
      spNoDevices: 'Nijedan uređaj nema otvoren Spotify. Otvorite Spotify na računalu, mobitelu ili televizoru.',
      spNoDevice: 'Nijedan uređaj ne svira: odaberite jedan.',
      spHttps: 'Spotify se povezuje samo s CasaOS-om otvorenim preko HTTPS-a (https://…). Koraci su u README-u.',
      spClientId: 'Client ID vaše Spotify aplikacije', spRedirect: 'Redirect URI (dodajte ga u svoju Spotify aplikaciju)', spCopy: 'Kopiraj',
      spCopied: 'Kopirano', spConnectedAs: 'Povezano kao {name}', spHelp: 'Kako postaviti', spConnect: 'Poveži', spDisconnect: 'Prekini vezu',
      spDenied: 'Pristup Spotifyju nije dopušten.', spError: 'Spotify nije odgovorio. Pokušajte ponovno za trenutak.',
      spLoginAgain: 'Prijava na Spotify je istekla: povežite se ponovno.',
      spNotRegistered: 'Ovaj račun nije u vašoj Spotify aplikaciji: dodajte ga u User Management.', spBusy: 'Spotify je zatražio da malo pričekate.',
      upNext: 'Sljedeće', playingNow: 'Sada svira', nothingNext: 'Ništa sljedeće', jump: 'Preskoči na ovu',
      spWeb: 'Reproduciraj u ovom pregledniku',
      spWebHint: 'Ova kartica postaje Spotify uređaj i reproducira glazbu. Potrebni su Premium i označen Web Playback SDK u vašoj Spotify aplikaciji.',
      spWebStarting: 'Pokretanje playera u ovom pregledniku…', spWebReady: 'Spremno: {name} je među vašim Spotify uređajima.',
      spWebOther: 'Uređaj je druga CasaOS kartica u ovom pregledniku.',
      spWebScope: 'Ponovno se povežite (ispod) da biste dopustili reprodukciju u ovom pregledniku.',
      spWebDrm: 'Ovaj preglednik ovdje ne može reproducirati Spotify: zaštićeni sadržaj (DRM) je isključen ili nije podržan.',
      spWebFailed: 'Spotify nije prihvatio ovaj preglednik kao uređaj: potrebni su Premium i označen Web Playback SDK u vašoj Spotify aplikaciji.',
      spWebTap: 'Preglednik je zadržao zvuk: pritisnite reprodukciju.', spThisBrowser: 'Ovaj preglednik',
      jfServer: 'Adresa Jellyfina', jfCode: 'U Jellyfinu otvorite svoj profil → Quick Connect i unesite ovaj kôd:',
      jfQcOff: 'Quick Connect je isključen na ovom Jellyfinu: uključite ga na njegovoj nadzornoj ploči (Općenito).',
      jfNoServer: 'Jellyfin nije odgovorio na ovoj adresi. Kad je CasaOS otvoren preko https://, i Jellyfin treba adresu https:// (pogledajte README).',
      jfFavorite: 'Dodaj u favorite', jfUnfavorite: 'Ukloni iz favorita', jfFavorites: 'Favoriti', jfAlbums: 'Albumi', jfArtists: 'Izvođači',
      jfSearch: 'Pretraži svoju biblioteku', jfOn: 'Na Jellyfinu', jfNotConnected: 'Jellyfin nije povezan', jfSettings: 'Postavke Jellyfina',
      jfError: 'Jellyfin nije odgovorio. Pokušajte ponovno za trenutak.', jfLoginAgain: 'Prijava na Jellyfin je opozvana: povežite se ponovno.',
      jfSongs: 'Sve pjesme'
    },
    hu: {
      title: 'Zene', folder: 'Zenemappa', change: 'Mappa módosítása', scanning: 'Mappa beolvasása…',
      empty: 'Ebben a mappában nincsenek hangfájlok.', folderError: 'Ezt a mappát nem sikerült megnyitni.',
      nothing: 'Nem szól semmi', pick: 'Válassz egy számot, vagy nyomd meg a lejátszást', playlist: 'Lejátszási lista',
      tracks: { one: '{n} szám', other: '{n} szám' },
      play: 'Lejátszás', pause: 'Szünet', next: 'Következő', prev: 'Előző', shuffle: 'Véletlen sorrend',
      repeatAll: 'Összes ismétlése', repeatOne: 'Egy ismétlése', repeatOff: 'Nincs ismétlés', volume: 'Hangerő',
      subfolders: 'Almappákkal együtt', use: 'Ennek a mappának a használata', cancel: 'Mégse', up: 'Egy szinttel feljebb',
      loadError: 'Ezt a fájlt nem sikerült lejátszani, kihagyom.',
      search: 'Keresés a listában', noMatch: 'Nincs egyező szám.', queueAdd: 'Hozzáadás a várólistához', queueRemove: 'Eltávolítás a várólistáról',
      srcLocal: 'Fájlok a CasaOS-en', spLibrary: 'A könyvtárad', spSettings: 'Spotify-beállítások', spDevices: 'Eszközök', spBack: 'Vissza',
      spSearch: 'Keresés a listáidban és a Spotifyon', spLiked: 'Kedvelt dalok', spOnSpotify: 'A Spotifyon', spLoading: 'Betöltés…',
      spCantOpen: 'A Spotify nem engedi, hogy az ilyen alkalmazások megnyissák ezt a listát.',
      spQueued: 'A Spotify lejátszási sorában (csak a Spotify tudja kivenni)', spLike: 'Mentés a Kedvelt dalok közé',
      spUnlike: 'Eltávolítás a Kedvelt dalok közül', spNotConnected: 'A Spotify nincs csatlakoztatva',
      spConnectHint: 'Csatlakoztasd a beállításokban (fogaskerék)', spNothing: 'A Spotifyon nem szól semmi',
      spOpenApp: 'Indíts el valamit a Spotifyon bármelyik eszközön', spOn: 'Itt szól: {name}', spFreeShort: 'Miért nincsenek vezérlők?',
      spFreeInfo: 'A vezérléshez Spotify Premium kell: a Spotify API-ja csak Premium-fiókoknak engedi a lejátszást, a szüneteltetést és a léptetést. Ami szól, az itt továbbra is látszik.',
      spNoDevices: 'Egyik eszközön sincs megnyitva a Spotify. Nyisd meg a Spotifyt a gépen, a telefonon vagy a tévén.',
      spNoDevice: 'Egyik eszköz sem játszik le: válassz egyet.',
      spHttps: 'A Spotify csak akkor csatlakozik, ha a CasaOS HTTPS-en (https://…) van megnyitva. A lépések a README-ben.',
      spClientId: 'A Spotify-alkalmazásod Client ID-ja', spRedirect: 'Redirect URI (add hozzá a Spotify-alkalmazásodhoz)', spCopy: 'Másolás',
      spCopied: 'Kimásolva', spConnectedAs: 'Csatlakozva mint {name}', spHelp: 'Hogyan állítsd be', spConnect: 'Csatlakozás', spDisconnect: 'Leválasztás',
      spDenied: 'A Spotify-hozzáférést nem engedélyezték.', spError: 'A Spotify nem válaszolt. Próbáld újra egy kicsit később.',
      spLoginAgain: 'A Spotify-bejelentkezés lejárt: csatlakozz újra.',
      spNotRegistered: 'Ez a fiók nincs benne a Spotify-alkalmazásodban: add hozzá a User Management részben.', spBusy: 'A Spotify egy kis várakozást kért.',
      upNext: 'Következik', playingNow: 'Most szól', nothingNext: 'Nincs következő', jump: 'Ugrás erre',
      spWeb: 'Lejátszás ebben a böngészőben',
      spWebHint: 'Ez a lap Spotify-eszközzé válik, és lejátssza a zenét. Premium kell, és a Spotify-alkalmazásodban bejelölt Web Playback SDK.',
      spWebStarting: 'A lejátszó indul ebben a böngészőben…', spWebReady: 'Kész: {name} ott van a Spotify-eszközeid között.',
      spWebOther: 'Egy másik CasaOS-lap ebben a böngészőben az eszköz.',
      spWebScope: 'Csatlakozz újra (lent), hogy engedélyezd a lejátszást ebben a böngészőben.',
      spWebDrm: 'Ez a böngésző itt nem tudja lejátszani a Spotifyt: a védett tartalom (DRM) ki van kapcsolva, vagy nem támogatott.',
      spWebFailed: 'A Spotify nem fogadta el ezt a böngészőt eszközként: Premium kell, és a Spotify-alkalmazásodban bejelölt Web Playback SDK.',
      spWebTap: 'A böngésző visszatartotta a hangot: nyomd meg a lejátszást.', spThisBrowser: 'Ez a böngésző',
      jfServer: 'A Jellyfin címe', jfCode: 'A Jellyfinben nyisd meg a profilodat → Quick Connect, és írd be ezt a kódot:',
      jfQcOff: 'A Quick Connect ki van kapcsolva ebben a Jellyfinben: kapcsold be a vezérlőpultján (Általános).',
      jfNoServer: 'A Jellyfin nem válaszolt ezen a címen. Ha a CasaOS https://-en van megnyitva, a Jellyfinnek is https:// cím kell (lásd a README-t).',
      jfFavorite: 'Hozzáadás a kedvencekhez', jfUnfavorite: 'Eltávolítás a kedvencek közül', jfFavorites: 'Kedvencek', jfAlbums: 'Albumok',
      jfArtists: 'Előadók', jfSearch: 'Keresés a könyvtáradban', jfOn: 'A Jellyfinben', jfNotConnected: 'A Jellyfin nincs csatlakoztatva',
      jfSettings: 'Jellyfin-beállítások', jfError: 'A Jellyfin nem válaszolt. Próbáld újra egy kicsit később.',
      jfLoginAgain: 'A Jellyfin-bejelentkezést visszavonták: csatlakozz újra.',
      jfSongs: 'Az összes dal'
    },
    id: {
      title: 'Musik', folder: 'Folder musik', change: 'Ganti folder', scanning: 'Membaca folder…',
      empty: 'Tidak ada file audio di folder ini.', folderError: 'Tidak dapat membuka folder ini.',
      nothing: 'Tidak ada yang diputar', pick: 'Pilih lagu atau tekan putar', playlist: 'Daftar putar',
      tracks: { other: '{n} lagu' },
      play: 'Putar', pause: 'Jeda', next: 'Berikutnya', prev: 'Sebelumnya', shuffle: 'Acak',
      repeatAll: 'Ulangi semua', repeatOne: 'Ulangi satu', repeatOff: 'Tanpa pengulangan', volume: 'Volume',
      subfolders: 'Sertakan subfolder', use: 'Gunakan folder ini', cancel: 'Batal', up: 'Naik satu tingkat',
      loadError: 'Tidak dapat memutar file ini, dilewati.',
      search: 'Cari di daftar putar', noMatch: 'Tidak ada lagu yang cocok.', queueAdd: 'Tambahkan ke antrean', queueRemove: 'Hapus dari antrean',
      srcLocal: 'File di CasaOS', spLibrary: 'Koleksimu', spSettings: 'Pengaturan Spotify', spDevices: 'Perangkat', spBack: 'Kembali',
      spSearch: 'Cari di playlist dan di Spotify', spLiked: 'Lagu yang Disukai', spOnSpotify: 'Di Spotify', spLoading: 'Memuat…',
      spCantOpen: 'Spotify tidak mengizinkan aplikasi seperti ini membuka playlist ini.',
      spQueued: 'Di antrean Spotify (hanya Spotify yang bisa menghapusnya)', spLike: 'Simpan ke Lagu yang Disukai', spUnlike: 'Hapus dari Lagu yang Disukai',
      spNotConnected: 'Spotify belum terhubung', spConnectHint: 'Hubungkan di pengaturan (roda gigi)', spNothing: 'Tidak ada yang diputar di Spotify',
      spOpenApp: 'Putar sesuatu di Spotify di perangkat apa pun', spOn: 'Diputar di {name}', spFreeShort: 'Kenapa tidak ada kontrol?',
      spFreeInfo: 'Kontrol memerlukan Spotify Premium: API Spotify hanya mengizinkan akun Premium memutar, menjeda, atau melewati. Yang sedang diputar tetap tampil di sini.',
      spNoDevices: 'Tidak ada perangkat yang membuka Spotify. Buka Spotify di PC, ponsel, atau TV.',
      spNoDevice: 'Tidak ada perangkat yang memutar: pilih satu.',
      spHttps: 'Spotify hanya terhubung jika CasaOS dibuka lewat HTTPS (https://…). Lihat langkahnya di README.',
      spClientId: 'Client ID aplikasi Spotify-mu', spRedirect: 'Redirect URI (tambahkan ke aplikasi Spotify-mu)', spCopy: 'Salin', spCopied: 'Disalin',
      spConnectedAs: 'Terhubung sebagai {name}', spHelp: 'Cara mengaturnya', spConnect: 'Hubungkan', spDisconnect: 'Putuskan',
      spDenied: 'Akses ke Spotify tidak diizinkan.', spError: 'Spotify tidak menjawab. Coba lagi sebentar lagi.',
      spLoginAgain: 'Login Spotify kedaluwarsa: hubungkan lagi.',
      spNotRegistered: 'Akun ini tidak ada di aplikasi Spotify-mu: tambahkan di User Management.', spBusy: 'Spotify meminta untuk menunggu sebentar.',
      upNext: 'Berikutnya', playingNow: 'Sedang diputar', nothingNext: 'Tidak ada yang berikutnya', jump: 'Lompat ke lagu ini',
      spWeb: 'Putar di browser ini',
      spWebHint: 'Tab ini menjadi perangkat Spotify dan memutar musiknya. Perlu Premium dan Web Playback SDK dicentang di aplikasi Spotify Anda.',
      spWebStarting: 'Memulai pemutar di browser ini…', spWebReady: 'Siap: {name} ada di perangkat Spotify Anda.',
      spWebOther: 'Tab CasaOS lain di browser ini yang menjadi perangkatnya.',
      spWebScope: 'Hubungkan lagi (di bawah) untuk mengizinkan pemutaran di browser ini.',
      spWebDrm: 'Browser ini tidak dapat memutar Spotify di sini: konten terlindungi (DRM) mati atau tidak didukung.',
      spWebFailed: 'Spotify tidak menerima browser ini sebagai perangkat: perlu Premium dan Web Playback SDK dicentang di aplikasi Spotify Anda.',
      spWebTap: 'Browser menahan suaranya: tekan putar.', spThisBrowser: 'Browser ini',
      jfServer: 'Alamat Jellyfin', jfCode: 'Di Jellyfin, buka profilmu → Quick Connect lalu masukkan kode ini:',
      jfQcOff: 'Quick Connect nonaktif di Jellyfin ini: aktifkan di Dasbornya (Umum).',
      jfNoServer: 'Jellyfin tidak menjawab di alamat ini. Jika CasaOS dibuka lewat https://, Jellyfin juga perlu alamat https:// (lihat README).',
      jfFavorite: 'Tambahkan ke favorit', jfUnfavorite: 'Hapus dari favorit', jfFavorites: 'Favorit', jfAlbums: 'Album', jfArtists: 'Artis',
      jfSearch: 'Cari di koleksimu', jfOn: 'Di Jellyfin', jfNotConnected: 'Jellyfin belum terhubung', jfSettings: 'Pengaturan Jellyfin',
      jfError: 'Jellyfin tidak menjawab. Coba lagi sebentar lagi.', jfLoginAgain: 'Login Jellyfin dicabut: hubungkan lagi.',
      jfSongs: 'Semua lagu'
    },
    it: {
      title: 'Musica', folder: 'Cartella della musica', change: 'Cambia cartella', scanning: 'Lettura della cartella…',
      empty: 'Nessun file audio in questa cartella.', folderError: 'Impossibile aprire questa cartella.',
      nothing: 'Nessuna riproduzione', pick: 'Scegli un brano o premi play', playlist: 'Playlist',
      tracks: { one: '{n} brano', other: '{n} brani' },
      play: 'Riproduci', pause: 'Pausa', next: 'Successivo', prev: 'Precedente', shuffle: 'Casuale',
      repeatAll: 'Ripeti tutto', repeatOne: 'Ripeti uno', repeatOff: 'Nessuna ripetizione', volume: 'Volume',
      subfolders: 'Includi le sottocartelle', use: 'Usa questa cartella', cancel: 'Annulla', up: 'Su di un livello',
      loadError: 'Impossibile riprodurre questo file, lo salto.',
      search: 'Cerca nella playlist', noMatch: 'Nessun brano corrispondente.', queueAdd: 'Aggiungi alla coda', queueRemove: 'Rimuovi dalla coda',
      srcLocal: 'File di CasaOS', spLibrary: 'La tua libreria', spSettings: 'Impostazioni di Spotify', spDevices: 'Dispositivi', spBack: 'Indietro',
      spSearch: 'Cerca nelle tue playlist e su Spotify', spLiked: 'Brani che ti piacciono', spOnSpotify: 'Su Spotify', spLoading: 'Caricamento…',
      spCantOpen: 'Spotify non permette alle app come questa di aprire questa playlist.', spQueued: 'Nella coda di Spotify (solo Spotify può toglierlo)',
      spLike: 'Salva in Brani che ti piacciono', spUnlike: 'Rimuovi da Brani che ti piacciono', spNotConnected: 'Spotify non è collegato',
      spConnectHint: 'Collegalo nelle impostazioni (ingranaggio)', spNothing: 'Niente in riproduzione su Spotify',
      spOpenApp: 'Riproduci qualcosa su Spotify da qualsiasi dispositivo', spOn: 'In riproduzione su {name}', spFreeShort: 'Perché non ci sono i comandi?',
      spFreeInfo: 'I comandi richiedono Spotify Premium: l\'API di Spotify permette solo agli account Premium di riprodurre, mettere in pausa o saltare. Ciò che suona resta visibile qui.',
      spNoDevices: 'Nessun dispositivo ha Spotify aperto. Apri Spotify sul PC, sul telefono o sulla TV.',
      spNoDevice: 'Nessun dispositivo in riproduzione: scegline uno.',
      spHttps: 'Spotify si collega solo con CasaOS aperto in HTTPS (https://…). Vedi i passaggi nel README.', spClientId: 'Client ID della tua app Spotify',
      spRedirect: 'Redirect URI (aggiungilo alla tua app Spotify)', spCopy: 'Copia', spCopied: 'Copiato', spConnectedAs: 'Collegato come {name}',
      spHelp: 'Come configurarlo', spConnect: 'Collega', spDisconnect: 'Scollega', spDenied: 'L\'accesso a Spotify non è stato consentito.',
      spError: 'Spotify non ha risposto. Riprova tra poco.', spLoginAgain: 'L\'accesso a Spotify è scaduto: ricollegati.',
      spNotRegistered: 'Questo account non è nella tua app Spotify: aggiungilo in User Management.', spBusy: 'Spotify ha chiesto di attendere un momento.',
      upNext: 'Prossimi brani', playingNow: 'In riproduzione', nothingNext: 'Nessun brano in arrivo', jump: 'Salta a questo',
      spWeb: 'Riproduci in questo browser',
      spWebHint: 'Questa scheda diventa un dispositivo Spotify e riproduce la musica. Servono Premium e Web Playback SDK spuntato nella tua app Spotify.',
      spWebStarting: 'Avvio del player in questo browser…', spWebReady: 'Pronto: {name} è tra i tuoi dispositivi Spotify.',
      spWebOther: 'Un\'altra scheda di CasaOS in questo browser è il dispositivo.',
      spWebScope: 'Ricollegati (qui sotto) per consentire la riproduzione in questo browser.',
      spWebDrm: 'Questo browser non può riprodurre Spotify qui: i contenuti protetti (DRM) sono disattivati o non supportati.',
      spWebFailed: 'Spotify non ha accettato questo browser come dispositivo: servono Premium e Web Playback SDK spuntato nella tua app Spotify.',
      spWebTap: 'Il browser ha bloccato l\'audio: premi play.', spThisBrowser: 'Questo browser',
      jfServer: 'Indirizzo di Jellyfin', jfCode: 'In Jellyfin, apri il tuo profilo → Quick Connect e inserisci questo codice:',
      jfQcOff: 'Quick Connect è disattivato in questo Jellyfin: attivalo nella sua Dashboard (Generale).',
      jfNoServer: 'Jellyfin non ha risposto a questo indirizzo. Con CasaOS su https://, anche Jellyfin ha bisogno di un indirizzo https:// (vedi il README).',
      jfFavorite: 'Aggiungi ai preferiti', jfUnfavorite: 'Rimuovi dai preferiti', jfFavorites: 'Preferiti', jfAlbums: 'Album',
      jfArtists: 'Artisti', jfSearch: 'Cerca nella tua libreria', jfOn: 'Su Jellyfin', jfNotConnected: 'Jellyfin non è collegato',
      jfSettings: 'Impostazioni di Jellyfin', jfError: 'Jellyfin non ha risposto. Riprova tra poco.',
      jfLoginAgain: 'L\'accesso a Jellyfin è stato revocato: ricollegati.',
      jfSongs: 'Tutti i brani'
    },
    ja: {
      title: '音楽', folder: '音楽フォルダー', change: 'フォルダーを変更', scanning: 'フォルダーを読み込み中…',
      empty: 'このフォルダーには音声ファイルがありません。', folderError: 'このフォルダーを開けませんでした。',
      nothing: '再生していません', pick: '曲を選ぶか再生を押してください', playlist: 'プレイリスト',
      tracks: { other: '{n} 曲' },
      play: '再生', pause: '一時停止', next: '次へ', prev: '前へ', shuffle: 'シャッフル',
      repeatAll: '全曲リピート', repeatOne: '1曲リピート', repeatOff: 'リピートなし', volume: '音量',
      subfolders: 'サブフォルダーを含める', use: 'このフォルダーを使う', cancel: 'キャンセル', up: '1つ上の階層へ',
      loadError: 'このファイルを再生できないため、スキップします。',
      search: 'プレイリストを検索', noMatch: '一致する曲はありません。', queueAdd: 'キューに追加', queueRemove: 'キューから削除',
      srcLocal: 'CasaOS のファイル', spLibrary: 'ライブラリ', spSettings: 'Spotify の設定', spDevices: 'デバイス', spBack: '戻る', spSearch: 'プレイリストと Spotify を検索',
      spLiked: 'お気に入りの曲', spOnSpotify: 'Spotify で', spLoading: '読み込み中…', spCantOpen: 'Spotify はこのようなアプリにこのプレイリストを開かせません。',
      spQueued: 'Spotify のキューに追加済み（外せるのは Spotify だけです）', spLike: 'お気に入りの曲に保存', spUnlike: 'お気に入りの曲から削除', spNotConnected: 'Spotify に接続していません',
      spConnectHint: '設定（歯車）から接続してください', spNothing: 'Spotify で再生中のものはありません', spOpenApp: 'どれかのデバイスで Spotify を再生してください', spOn: '{name} で再生中',
      spFreeShort: '操作ボタンがないのはなぜ？', spFreeInfo: '操作には Spotify Premium が必要です。Spotify の API では、再生・一時停止・スキップができるのは Premium アカウントだけです。再生中の内容はここに表示されます。',
      spNoDevices: 'Spotify を開いているデバイスがありません。PC、スマートフォン、テレビで Spotify を開いてください。', spNoDevice: '再生中のデバイスがありません。選んでください。',
      spHttps: 'Spotify は CasaOS を HTTPS（https://…）で開いているときだけ接続できます。手順は README を参照してください。', spClientId: 'Spotify アプリの Client ID',
      spRedirect: 'Redirect URI（Spotify アプリに追加してください）', spCopy: 'コピー', spCopied: 'コピーしました', spConnectedAs: '{name} として接続中', spHelp: '設定方法', spConnect: '接続',
      spDisconnect: '接続を解除', spDenied: 'Spotify へのアクセスが許可されませんでした。', spError: 'Spotify から応答がありません。少ししてからもう一度お試しください。',
      spLoginAgain: 'Spotify のログインの有効期限が切れました。もう一度接続してください。', spNotRegistered: 'このアカウントは Spotify アプリに登録されていません。User Management で追加してください。',
      spBusy: 'Spotify から少し待つよう求められました。',
      upNext: '次に再生', playingNow: '再生中', nothingNext: '次の曲はありません', jump: 'この曲までスキップ',
      spWeb: 'このブラウザで再生', spWebHint: 'このタブが Spotify のデバイスになり、音楽を再生します。Premium と、Spotify アプリで Web Playback SDK のチェックが必要です。',
      spWebStarting: 'このブラウザでプレーヤーを起動しています…', spWebReady: '準備完了：{name} が Spotify のデバイスに表示されます。', spWebOther: 'このブラウザの別の CasaOS タブがデバイスになっています。',
      spWebScope: 'このブラウザで再生できるよう、もう一度接続してください（下のボタン）。', spWebDrm: 'このブラウザではここで Spotify を再生できません：保護されたコンテンツ（DRM）がオフか、対応していません。',
      spWebFailed: 'Spotify はこのブラウザをデバイスとして受け付けませんでした：Premium と、Spotify アプリで Web Playback SDK のチェックが必要です。', spWebTap: 'ブラウザが音声を止めました：再生を押してください。',
      spThisBrowser: 'このブラウザ',
      jfServer: 'Jellyfin のアドレス', jfCode: 'Jellyfin でプロフィール → Quick Connect を開き、このコードを入力してください:',
      jfQcOff: 'この Jellyfin では Quick Connect がオフです。ダッシュボード（一般）でオンにしてください。',
      jfNoServer: 'このアドレスで Jellyfin から応答がありません。CasaOS を https:// で開いている場合、Jellyfin にも https:// のアドレスが必要です（README を参照）。', jfFavorite: 'お気に入りに追加',
      jfUnfavorite: 'お気に入りから削除', jfFavorites: 'お気に入り', jfAlbums: 'アルバム', jfArtists: 'アーティスト', jfSearch: 'ライブラリを検索', jfOn: 'Jellyfin で',
      jfNotConnected: 'Jellyfin に接続していません', jfSettings: 'Jellyfin の設定', jfError: 'Jellyfin から応答がありません。少ししてからもう一度お試しください。',
      jfLoginAgain: 'Jellyfin のログインが取り消されました。もう一度接続してください。',
      jfSongs: 'すべての曲'
    },
    ko: {
      title: '음악', folder: '음악 폴더', change: '폴더 변경', scanning: '폴더를 읽는 중…',
      empty: '이 폴더에 오디오 파일이 없습니다.', folderError: '이 폴더를 열 수 없습니다.',
      nothing: '재생 중인 곡 없음', pick: '곡을 선택하거나 재생을 누르세요', playlist: '재생 목록',
      tracks: { other: '{n}곡' },
      play: '재생', pause: '일시 정지', next: '다음', prev: '이전', shuffle: '셔플',
      repeatAll: '전체 반복', repeatOne: '한 곡 반복', repeatOff: '반복 안 함', volume: '음량',
      subfolders: '하위 폴더 포함', use: '이 폴더 사용', cancel: '취소', up: '한 단계 위로',
      loadError: '이 파일을 재생할 수 없어 건너뜁니다.',
      search: '재생 목록 검색', noMatch: '일치하는 곡이 없습니다.', queueAdd: '대기열에 추가', queueRemove: '대기열에서 제거',
      srcLocal: 'CasaOS 파일', spLibrary: '내 라이브러리', spSettings: 'Spotify 설정', spDevices: '기기', spBack: '뒤로', spSearch: '플레이리스트와 Spotify에서 검색',
      spLiked: '좋아요 표시한 곡', spOnSpotify: 'Spotify에서', spLoading: '불러오는 중…', spCantOpen: 'Spotify는 이런 앱이 이 플레이리스트를 여는 것을 허용하지 않습니다.',
      spQueued: 'Spotify 대기열에 추가됨(Spotify에서만 뺄 수 있음)', spLike: '좋아요 표시한 곡에 저장', spUnlike: '좋아요 표시한 곡에서 삭제', spNotConnected: 'Spotify가 연결되지 않음',
      spConnectHint: '설정(톱니바퀴)에서 연결하세요', spNothing: 'Spotify에서 재생 중인 항목이 없습니다', spOpenApp: '아무 기기에서나 Spotify로 재생해 보세요', spOn: '{name}에서 재생 중',
      spFreeShort: '컨트롤이 없는 이유는?', spFreeInfo: '컨트롤을 쓰려면 Spotify Premium이 필요합니다. Spotify API는 Premium 계정만 재생, 일시정지, 건너뛰기를 허용합니다. 재생 중인 내용은 계속 여기에 표시됩니다.',
      spNoDevices: 'Spotify를 연 기기가 없습니다. PC, 휴대폰 또는 TV에서 Spotify를 여세요.', spNoDevice: '재생 중인 기기가 없습니다. 하나를 선택하세요.',
      spHttps: 'Spotify는 CasaOS를 HTTPS(https://…)로 열었을 때만 연결됩니다. README의 단계를 참고하세요.', spClientId: 'Spotify 앱의 Client ID',
      spRedirect: 'Redirect URI(Spotify 앱에 추가하세요)', spCopy: '복사', spCopied: '복사됨', spConnectedAs: '{name}(으)로 연결됨', spHelp: '설정 방법', spConnect: '연결',
      spDisconnect: '연결 해제', spDenied: 'Spotify 접근이 허용되지 않았습니다.', spError: 'Spotify가 응답하지 않습니다. 잠시 후 다시 시도하세요.',
      spLoginAgain: 'Spotify 로그인이 만료되었습니다. 다시 연결하세요.', spNotRegistered: '이 계정은 Spotify 앱에 없습니다. User Management에서 추가하세요.',
      spBusy: 'Spotify가 잠시 기다려 달라고 했습니다.',
      upNext: '다음 곡', playingNow: '지금 재생 중', nothingNext: '다음 곡이 없습니다', jump: '이 곡으로 건너뛰기',
      spWeb: '이 브라우저에서 재생', spWebHint: '이 탭이 Spotify 기기가 되어 음악을 재생합니다. Premium과 Spotify 앱에서 Web Playback SDK 선택이 필요합니다.',
      spWebStarting: '이 브라우저에서 플레이어를 시작하는 중…', spWebReady: '준비됨: {name}이(가) Spotify 기기 목록에 있습니다.', spWebOther: '이 브라우저의 다른 CasaOS 탭이 기기로 쓰이고 있습니다.',
      spWebScope: '이 브라우저에서 재생하려면 다시 연결하세요(아래).', spWebDrm: '이 브라우저는 여기서 Spotify를 재생할 수 없습니다: 보호된 콘텐츠(DRM)가 꺼져 있거나 지원되지 않습니다.',
      spWebFailed: 'Spotify가 이 브라우저를 기기로 받아들이지 않았습니다: Premium과 Spotify 앱에서 Web Playback SDK 선택이 필요합니다.', spWebTap: '브라우저가 소리를 막았습니다: 재생을 누르세요.',
      spThisBrowser: '이 브라우저',
      jfServer: 'Jellyfin 주소', jfCode: 'Jellyfin에서 프로필 → Quick Connect를 열고 이 코드를 입력하세요:',
      jfQcOff: '이 Jellyfin에서 Quick Connect가 꺼져 있습니다. 대시보드(일반)에서 켜세요.',
      jfNoServer: '이 주소에서 Jellyfin이 응답하지 않습니다. CasaOS를 https://로 열었다면 Jellyfin에도 https:// 주소가 필요합니다(README 참고).', jfFavorite: '즐겨찾기에 추가',
      jfUnfavorite: '즐겨찾기에서 제거', jfFavorites: '즐겨찾기', jfAlbums: '앨범', jfArtists: '아티스트', jfSearch: '라이브러리에서 검색', jfOn: 'Jellyfin에서',
      jfNotConnected: 'Jellyfin이 연결되지 않음', jfSettings: 'Jellyfin 설정', jfError: 'Jellyfin이 응답하지 않습니다. 잠시 후 다시 시도하세요.',
      jfLoginAgain: 'Jellyfin 로그인이 취소되었습니다. 다시 연결하세요.',
      jfSongs: '모든 곡'
    },
    nl: {
      title: 'Muziek', folder: 'Muziekmap', change: 'Map wijzigen', scanning: 'Map wordt gelezen…',
      empty: 'Geen audiobestanden in deze map.', folderError: 'Kan deze map niet openen.',
      nothing: 'Er speelt niets', pick: 'Kies een nummer of druk op afspelen', playlist: 'Afspeellijst',
      tracks: { one: '{n} nummer', other: '{n} nummers' },
      play: 'Afspelen', pause: 'Pauzeren', next: 'Volgende', prev: 'Vorige', shuffle: 'Willekeurig',
      repeatAll: 'Alles herhalen', repeatOne: 'Eén herhalen', repeatOff: 'Niet herhalen', volume: 'Volume',
      subfolders: 'Submappen meenemen', use: 'Deze map gebruiken', cancel: 'Annuleren', up: 'Eén niveau omhoog',
      loadError: 'Kan dit bestand niet afspelen, wordt overgeslagen.',
      search: 'Zoeken in afspeellijst', noMatch: 'Geen overeenkomende nummers.', queueAdd: 'Toevoegen aan wachtrij', queueRemove: 'Verwijderen uit wachtrij',
      srcLocal: 'Bestanden in CasaOS', spLibrary: 'Je bibliotheek', spSettings: 'Spotify-instellingen', spDevices: 'Apparaten', spBack: 'Terug',
      spSearch: 'Zoeken in je playlists en op Spotify', spLiked: 'Gelikete nummers', spOnSpotify: 'Op Spotify', spLoading: 'Laden…',
      spCantOpen: 'Spotify laat apps zoals deze deze playlist niet openen.', spQueued: 'In de Spotify-wachtrij (alleen Spotify kan hem eruit halen)',
      spLike: 'Opslaan in Gelikete nummers', spUnlike: 'Verwijderen uit Gelikete nummers', spNotConnected: 'Spotify is niet verbonden',
      spConnectHint: 'Verbind het in de instellingen (tandwiel)', spNothing: 'Er speelt niets op Spotify',
      spOpenApp: 'Speel iets af in Spotify op een willekeurig apparaat', spOn: 'Speelt op {name}', spFreeShort: 'Waarom zijn er geen bedieningsknoppen?',
      spFreeInfo: 'De bediening vereist Spotify Premium: de API van Spotify laat alleen Premium-accounts afspelen, pauzeren of overslaan. Wat er speelt, blijft hier zichtbaar.',
      spNoDevices: 'Geen enkel apparaat heeft Spotify open. Open Spotify op je pc, telefoon of tv.', spNoDevice: 'Geen apparaat speelt af: kies er een.',
      spHttps: 'Spotify verbindt alleen met CasaOS geopend via HTTPS (https://…). Zie de stappen in de README.', spClientId: 'Client ID van je Spotify-app',
      spRedirect: 'Redirect URI (voeg hem toe aan je Spotify-app)', spCopy: 'Kopiëren', spCopied: 'Gekopieerd', spConnectedAs: 'Verbonden als {name}',
      spHelp: 'Zo stel je het in', spConnect: 'Verbinden', spDisconnect: 'Verbinding verbreken', spDenied: 'Toegang tot Spotify is niet toegestaan.',
      spError: 'Spotify reageerde niet. Probeer het zo opnieuw.', spLoginAgain: 'De Spotify-login is verlopen: verbind opnieuw.',
      spNotRegistered: 'Dit account staat niet in je Spotify-app: voeg het toe onder User Management.', spBusy: 'Spotify vroeg om even te wachten.',
      upNext: 'Hierna', playingNow: 'Speelt nu', nothingNext: 'Hierna komt niets', jump: 'Naar deze springen',
      spWeb: 'Afspelen in deze browser',
      spWebHint: 'Dit tabblad wordt een Spotify-apparaat en speelt de muziek af. Vereist Premium en Web Playback SDK aangevinkt in je Spotify-app.',
      spWebStarting: 'Speler in deze browser wordt gestart…', spWebReady: 'Klaar: {name} staat bij je Spotify-apparaten.',
      spWebOther: 'Een ander CasaOS-tabblad in deze browser is het apparaat.',
      spWebScope: 'Verbind opnieuw (hieronder) om afspelen in deze browser toe te staan.',
      spWebDrm: 'Deze browser kan Spotify hier niet afspelen: beveiligde inhoud (DRM) staat uit of wordt niet ondersteund.',
      spWebFailed: 'Spotify accepteerde deze browser niet als apparaat: vereist Premium en Web Playback SDK aangevinkt in je Spotify-app.',
      spWebTap: 'De browser hield het geluid tegen: druk op afspelen.', spThisBrowser: 'Deze browser',
      jfServer: 'Jellyfin-adres', jfCode: 'Open in Jellyfin je profiel → Quick Connect en voer deze code in:',
      jfQcOff: 'Quick Connect staat uit op deze Jellyfin: zet het aan in het dashboard (Algemeen).',
      jfNoServer: 'Jellyfin reageerde niet op dit adres. Met CasaOS op https:// heeft Jellyfin ook een https://-adres nodig (zie de README).',
      jfFavorite: 'Toevoegen aan favorieten', jfUnfavorite: 'Verwijderen uit favorieten', jfFavorites: 'Favorieten', jfAlbums: 'Albums',
      jfArtists: 'Artiesten', jfSearch: 'Zoeken in je bibliotheek', jfOn: 'Op Jellyfin', jfNotConnected: 'Jellyfin is niet verbonden',
      jfSettings: 'Jellyfin-instellingen', jfError: 'Jellyfin reageerde niet. Probeer het zo opnieuw.',
      jfLoginAgain: 'De Jellyfin-login is ingetrokken: verbind opnieuw.',
      jfSongs: 'Alle nummers'
    },
    no: {
      title: 'Musikk', folder: 'Musikkmappe', change: 'Bytt mappe', scanning: 'Leser mappen …',
      empty: 'Ingen lydfiler i denne mappen.', folderError: 'Kunne ikke åpne denne mappen.',
      nothing: 'Ingenting spilles', pick: 'Velg et spor eller trykk på spill av', playlist: 'Spilleliste',
      tracks: { one: '{n} spor', other: '{n} spor' },
      play: 'Spill av', pause: 'Pause', next: 'Neste', prev: 'Forrige', shuffle: 'Tilfeldig rekkefølge',
      repeatAll: 'Gjenta alle', repeatOne: 'Gjenta én', repeatOff: 'Ikke gjenta', volume: 'Volum',
      subfolders: 'Ta med undermapper', use: 'Bruk denne mappen', cancel: 'Avbryt', up: 'Ett nivå opp',
      loadError: 'Kunne ikke spille av denne filen, hopper over.',
      search: 'Søk i spillelisten', noMatch: 'Ingen spor passer.', queueAdd: 'Legg til i køen', queueRemove: 'Fjern fra køen',
      srcLocal: 'Filer i CasaOS', spLibrary: 'Biblioteket ditt', spSettings: 'Spotify-innstillinger', spDevices: 'Enheter', spBack: 'Tilbake',
      spSearch: 'Søk i spillelistene og på Spotify', spLiked: 'Likte sanger', spOnSpotify: 'På Spotify', spLoading: 'Laster inn…',
      spCantOpen: 'Spotify lar ikke apper som denne åpne denne spillelisten.', spQueued: 'I Spotify-køen (bare Spotify kan fjerne den)',
      spLike: 'Lagre i Likte sanger', spUnlike: 'Fjern fra Likte sanger', spNotConnected: 'Spotify er ikke tilkoblet',
      spConnectHint: 'Koble til i innstillingene (tannhjul)', spNothing: 'Ingenting spilles på Spotify',
      spOpenApp: 'Spill av noe i Spotify på en hvilken som helst enhet', spOn: 'Spilles på {name}', spFreeShort: 'Hvorfor er det ingen kontroller?',
      spFreeInfo: 'Kontrollene krever Spotify Premium: Spotifys API lar bare Premium-kontoer spille av, sette på pause eller hoppe over. Det som spilles, vises fortsatt her.',
      spNoDevices: 'Ingen enhet har Spotify åpen. Åpne Spotify på PC-en, mobilen eller TV-en.', spNoDevice: 'Ingen enhet spiller av: velg én.',
      spHttps: 'Spotify kobler seg bare til når CasaOS er åpnet over HTTPS (https://…). Se stegene i README.', spClientId: 'Client ID for Spotify-appen din',
      spRedirect: 'Redirect URI (legg den til i Spotify-appen din)', spCopy: 'Kopier', spCopied: 'Kopiert', spConnectedAs: 'Tilkoblet som {name}',
      spHelp: 'Slik setter du det opp', spConnect: 'Koble til', spDisconnect: 'Koble fra', spDenied: 'Tilgang til Spotify ble ikke tillatt.',
      spError: 'Spotify svarte ikke. Prøv igjen om litt.', spLoginAgain: 'Spotify-påloggingen har utløpt: koble til på nytt.',
      spNotRegistered: 'Denne kontoen er ikke i Spotify-appen din: legg den til under User Management.', spBusy: 'Spotify ba om å vente litt.',
      upNext: 'Neste', playingNow: 'Spilles nå', nothingNext: 'Ingenting neste', jump: 'Hopp til denne',
      spWeb: 'Spill av i denne nettleseren',
      spWebHint: 'Denne fanen blir en Spotify-enhet og spiller musikken. Krever Premium og Web Playback SDK avkrysset i Spotify-appen din.',
      spWebStarting: 'Starter spilleren i denne nettleseren…', spWebReady: 'Klar: {name} er blant Spotify-enhetene dine.',
      spWebOther: 'En annen CasaOS-fane i denne nettleseren er enheten.',
      spWebScope: 'Koble til på nytt (nedenfor) for å tillate avspilling i denne nettleseren.',
      spWebDrm: 'Denne nettleseren kan ikke spille Spotify her: beskyttet innhold (DRM) er av eller støttes ikke.',
      spWebFailed: 'Spotify godtok ikke denne nettleseren som enhet: krever Premium og Web Playback SDK avkrysset i Spotify-appen din.',
      spWebTap: 'Nettleseren holdt tilbake lyden: trykk spill av.', spThisBrowser: 'Denne nettleseren',
      jfServer: 'Jellyfin-adresse', jfCode: 'I Jellyfin åpner du profilen din → Quick Connect og skriver inn denne koden:',
      jfQcOff: 'Quick Connect er slått av på denne Jellyfin: slå det på i kontrollpanelet (Generelt).',
      jfNoServer: 'Jellyfin svarte ikke på denne adressen. Når CasaOS er åpnet med https://, trenger Jellyfin også en https://-adresse (se README).',
      jfFavorite: 'Legg til i favoritter', jfUnfavorite: 'Fjern fra favoritter', jfFavorites: 'Favoritter', jfAlbums: 'Album',
      jfArtists: 'Artister', jfSearch: 'Søk i biblioteket ditt', jfOn: 'På Jellyfin', jfNotConnected: 'Jellyfin er ikke tilkoblet',
      jfSettings: 'Jellyfin-innstillinger', jfError: 'Jellyfin svarte ikke. Prøv igjen om litt.',
      jfLoginAgain: 'Jellyfin-påloggingen ble trukket tilbake: koble til på nytt.',
      jfSongs: 'Alle sanger'
    },
    pl: {
      title: 'Muzyka', folder: 'Folder z muzyką', change: 'Zmień folder', scanning: 'Odczytywanie folderu…',
      empty: 'W tym folderze nie ma plików audio.', folderError: 'Nie można otworzyć tego folderu.',
      nothing: 'Nic nie gra', pick: 'Wybierz utwór lub naciśnij odtwarzanie', playlist: 'Playlista',
      tracks: { one: '{n} utwór', few: '{n} utwory', many: '{n} utworów', other: '{n} utworu' },
      play: 'Odtwórz', pause: 'Wstrzymaj', next: 'Następny', prev: 'Poprzedni', shuffle: 'Losowo',
      repeatAll: 'Powtarzaj wszystkie', repeatOne: 'Powtarzaj jeden', repeatOff: 'Bez powtarzania', volume: 'Głośność',
      subfolders: 'Uwzględnij podfoldery', use: 'Użyj tego folderu', cancel: 'Anuluj', up: 'Poziom wyżej',
      loadError: 'Nie można odtworzyć tego pliku, pomijam.',
      search: 'Szukaj w playliście', noMatch: 'Brak pasujących utworów.', queueAdd: 'Dodaj do kolejki', queueRemove: 'Usuń z kolejki',
      srcLocal: 'Pliki w CasaOS', spLibrary: 'Twoja biblioteka', spSettings: 'Ustawienia Spotify', spDevices: 'Urządzenia', spBack: 'Wstecz',
      spSearch: 'Szukaj w playlistach i w Spotify', spLiked: 'Polubione utwory', spOnSpotify: 'W Spotify', spLoading: 'Wczytywanie…',
      spCantOpen: 'Spotify nie pozwala aplikacjom takim jak ta otworzyć tej playlisty.', spQueued: 'W kolejce Spotify (usunąć go może tylko Spotify)',
      spLike: 'Zapisz w Polubionych utworach', spUnlike: 'Usuń z Polubionych utworów', spNotConnected: 'Spotify nie jest połączone',
      spConnectHint: 'Połącz w ustawieniach (koło zębate)', spNothing: 'Nic nie gra w Spotify', spOpenApp: 'Włącz coś w Spotify na dowolnym urządzeniu',
      spOn: 'Gra na: {name}', spFreeShort: 'Dlaczego nie ma sterowania?',
      spFreeInfo: 'Sterowanie wymaga Spotify Premium: API Spotify pozwala odtwarzać, wstrzymywać i przewijać tylko kontom Premium. To, co gra, nadal jest tu widoczne.',
      spNoDevices: 'Żadne urządzenie nie ma otwartego Spotify. Otwórz Spotify na komputerze, telefonie lub telewizorze.',
      spNoDevice: 'Żadne urządzenie nie odtwarza: wybierz jedno.',
      spHttps: 'Spotify łączy się tylko z CasaOS otwartym przez HTTPS (https://…). Kroki są w README.', spClientId: 'Client ID Twojej aplikacji Spotify',
      spRedirect: 'Redirect URI (dodaj go do swojej aplikacji Spotify)', spCopy: 'Kopiuj', spCopied: 'Skopiowano', spConnectedAs: 'Połączono jako {name}',
      spHelp: 'Jak to skonfigurować', spConnect: 'Połącz', spDisconnect: 'Rozłącz', spDenied: 'Nie zezwolono na dostęp do Spotify.',
      spError: 'Spotify nie odpowiedziało. Spróbuj ponownie za chwilę.', spLoginAgain: 'Logowanie do Spotify wygasło: połącz ponownie.',
      spNotRegistered: 'Tego konta nie ma w Twojej aplikacji Spotify: dodaj je w User Management.', spBusy: 'Spotify poprosiło o chwilę cierpliwości.',
      upNext: 'Następne', playingNow: 'Teraz odtwarzane', nothingNext: 'Nic więcej w kolejce', jump: 'Przeskocz do tego',
      spWeb: 'Odtwarzaj w tej przeglądarce',
      spWebHint: 'Ta karta staje się urządzeniem Spotify i odtwarza muzykę. Wymaga Premium i zaznaczonego Web Playback SDK w Twojej aplikacji Spotify.',
      spWebStarting: 'Uruchamianie odtwarzacza w tej przeglądarce…', spWebReady: 'Gotowe: {name} jest na liście Twoich urządzeń Spotify.',
      spWebOther: 'Urządzeniem jest inna karta CasaOS w tej przeglądarce.',
      spWebScope: 'Połącz ponownie (poniżej), aby zezwolić na odtwarzanie w tej przeglądarce.',
      spWebDrm: 'Ta przeglądarka nie może tu odtwarzać Spotify: chronione treści (DRM) są wyłączone lub nieobsługiwane.',
      spWebFailed: 'Spotify nie przyjął tej przeglądarki jako urządzenia: wymaga Premium i zaznaczonego Web Playback SDK w Twojej aplikacji Spotify.',
      spWebTap: 'Przeglądarka zablokowała dźwięk: naciśnij odtwarzaj.', spThisBrowser: 'Ta przeglądarka',
      jfServer: 'Adres Jellyfin', jfCode: 'W Jellyfin otwórz swój profil → Quick Connect i wpisz ten kod:',
      jfQcOff: 'Quick Connect jest wyłączone w tym Jellyfin: włącz je w panelu sterowania (Ogólne).',
      jfNoServer: 'Jellyfin nie odpowiedział pod tym adresem. Gdy CasaOS jest otwarty przez https://, Jellyfin też potrzebuje adresu https:// (zobacz README).',
      jfFavorite: 'Dodaj do ulubionych', jfUnfavorite: 'Usuń z ulubionych', jfFavorites: 'Ulubione', jfAlbums: 'Albumy', jfArtists: 'Wykonawcy',
      jfSearch: 'Szukaj w swojej bibliotece', jfOn: 'W Jellyfin', jfNotConnected: 'Jellyfin nie jest połączony', jfSettings: 'Ustawienia Jellyfin',
      jfError: 'Jellyfin nie odpowiedział. Spróbuj ponownie za chwilę.', jfLoginAgain: 'Logowanie do Jellyfin zostało cofnięte: połącz ponownie.',
      jfSongs: 'Wszystkie utwory'
    },
    pt: {
      title: 'Música', folder: 'Pasta de músicas', change: 'Trocar pasta', scanning: 'Lendo a pasta…',
      empty: 'Nenhum arquivo de áudio nesta pasta.', folderError: 'Não foi possível abrir esta pasta.',
      nothing: 'Nada tocando', pick: 'Escolha uma faixa ou aperte play', playlist: 'Playlist',
      tracks: { one: '{n} faixa', other: '{n} faixas' },
      play: 'Tocar', pause: 'Pausar', next: 'Próxima', prev: 'Anterior', shuffle: 'Aleatório',
      repeatAll: 'Repetir tudo', repeatOne: 'Repetir uma', repeatOff: 'Sem repetir', volume: 'Volume',
      subfolders: 'Incluir subpastas', use: 'Usar esta pasta', cancel: 'Cancelar', up: 'Subir um nível',
      loadError: 'Não foi possível tocar este arquivo, pulando.',
      search: 'Pesquisar na playlist', noMatch: 'Nenhuma faixa encontrada.', queueAdd: 'Adicionar à fila', queueRemove: 'Remover da fila',
      srcLocal: 'Arquivos do CasaOS', spLibrary: 'Sua biblioteca', spSettings: 'Configurações do Spotify', spDevices: 'Dispositivos', spBack: 'Voltar',
      spSearch: 'Pesquisar nas playlists e no Spotify', spLiked: 'Músicas Curtidas', spOnSpotify: 'No Spotify', spLoading: 'Carregando…',
      spCantOpen: 'O Spotify não deixa apps como este abrirem esta playlist.', spQueued: 'Na fila do Spotify (só o Spotify consegue tirar)',
      spLike: 'Salvar nas Músicas Curtidas', spUnlike: 'Remover das Músicas Curtidas', spNotConnected: 'Spotify não conectado',
      spConnectHint: 'Conecte nas configurações (engrenagem)', spNothing: 'Nada tocando no Spotify',
      spOpenApp: 'Toque algo no Spotify em qualquer dispositivo', spOn: 'Tocando em {name}', spFreeShort: 'Por que não há controles?',
      spFreeInfo: 'Os controles precisam do Spotify Premium: a API do Spotify só deixa contas Premium tocar, pausar ou pular. O que está tocando continua aparecendo aqui.',
      spNoDevices: 'Nenhum dispositivo com o Spotify aberto. Abra o Spotify no PC, no celular ou na TV.',
      spNoDevice: 'Nenhum dispositivo tocando: escolha um.',
      spHttps: 'O Spotify só conecta com o CasaOS aberto por HTTPS (https://…). Veja o passo a passo no README.',
      spClientId: 'Client ID do seu app do Spotify', spRedirect: 'Redirect URI (adicione no seu app do Spotify)', spCopy: 'Copiar', spCopied: 'Copiado',
      spConnectedAs: 'Conectado como {name}', spHelp: 'Como configurar', spConnect: 'Conectar', spDisconnect: 'Desconectar',
      spDenied: 'O acesso ao Spotify não foi permitido.', spError: 'O Spotify não respondeu. Tente de novo daqui a pouco.',
      spLoginAgain: 'O login do Spotify expirou: conecte de novo.',
      spNotRegistered: 'Esta conta não está no seu app do Spotify: adicione em User Management.', spBusy: 'O Spotify pediu para esperar um pouco.',
      upNext: 'A seguir', playingNow: 'Tocando agora', nothingNext: 'Nada a seguir', jump: 'Pular para esta',
      spWeb: 'Tocar neste navegador',
      spWebHint: 'Esta aba vira um dispositivo do Spotify e toca a música. Precisa do Premium e do Web Playback SDK marcado no seu app do Spotify.',
      spWebStarting: 'Iniciando o player neste navegador…', spWebReady: 'Pronto: {name} está nos seus dispositivos do Spotify.',
      spWebOther: 'Outra aba do CasaOS neste navegador é o dispositivo.', spWebScope: 'Conecte de novo (abaixo) para permitir tocar neste navegador.',
      spWebDrm: 'Este navegador não consegue tocar o Spotify aqui: o conteúdo protegido (DRM) está desativado ou não é suportado.',
      spWebFailed: 'O Spotify não aceitou este navegador como dispositivo: precisa do Premium e do Web Playback SDK marcado no seu app do Spotify.',
      spWebTap: 'O navegador segurou o som: aperte play.', spThisBrowser: 'Este navegador',
      jfServer: 'Endereço do Jellyfin', jfCode: 'No Jellyfin, abra seu perfil → Conexão Rápida (Quick Connect) e digite este código:',
      jfQcOff: 'A Conexão Rápida (Quick Connect) está desligada neste Jellyfin: ative no Painel dele (Geral).',
      jfNoServer: 'O Jellyfin não respondeu neste endereço. Com o CasaOS em https://, o Jellyfin também precisa de um endereço https:// (veja o README).',
      jfFavorite: 'Adicionar aos favoritos', jfUnfavorite: 'Remover dos favoritos', jfFavorites: 'Favoritos', jfAlbums: 'Álbuns',
      jfArtists: 'Artistas', jfSearch: 'Pesquisar na sua biblioteca', jfOn: 'No Jellyfin', jfNotConnected: 'Jellyfin não conectado',
      jfSettings: 'Configurações do Jellyfin', jfError: 'O Jellyfin não respondeu. Tente de novo daqui a pouco.',
      jfLoginAgain: 'O login do Jellyfin foi revogado: conecte de novo.',
      jfSongs: 'Todas as músicas'
    },
    // Only what differs from pt
    'pt-pt': {
      scanning: 'A ler a pasta…', empty: 'Nenhum ficheiro de áudio nesta pasta.', nothing: 'Nada a tocar',
      pick: 'Escolha uma faixa ou prima reproduzir', playlist: 'Lista de reprodução', play: 'Reproduzir',
      loadError: 'Não foi possível reproduzir este ficheiro; a passar à seguinte.',
      search: 'Pesquisar na lista',
      srcLocal: 'Ficheiros do CasaOS', spLibrary: 'A sua biblioteca', spSettings: 'Definições do Spotify', spLiked: 'Músicas de que gosta',
      spLoading: 'A carregar…', spCantOpen: 'O Spotify não deixa aplicações como esta abrir esta playlist.',
      spQueued: 'Na fila do Spotify (só o Spotify a consegue retirar)', spLike: 'Guardar nas Músicas de que gosta',
      spUnlike: 'Remover das Músicas de que gosta', spNotConnected: 'Spotify não ligado', spConnectHint: 'Ligue-o nas definições (roda dentada)',
      spNothing: 'Nada a tocar no Spotify', spOn: 'A tocar em {name}', spFreeShort: 'Porque não há controlos?',
      spFreeInfo: 'Os controlos precisam do Spotify Premium: a API do Spotify só deixa contas Premium tocar, pausar ou saltar. O que está a tocar continua a aparecer aqui.',
      spNoDevices: 'Nenhum dispositivo com o Spotify aberto. Abra o Spotify no PC, no telemóvel ou na TV.',
      spNoDevice: 'Nenhum dispositivo a tocar: escolha um.',
      spHttps: 'O Spotify só liga com o CasaOS aberto por HTTPS (https://…). Veja os passos no README.', spClientId: 'Client ID da sua aplicação do Spotify',
      spRedirect: 'Redirect URI (adicione-o à sua aplicação do Spotify)', spConnectedAs: 'Ligado como {name}', spConnect: 'Ligar', spDisconnect: 'Desligar',
      spError: 'O Spotify não respondeu. Tente novamente daqui a pouco.', spLoginAgain: 'O início de sessão do Spotify expirou: ligue novamente.',
      spNotRegistered: 'Esta conta não está na sua aplicação do Spotify: adicione-a em User Management.', spBusy: 'O Spotify pediu para aguardar um pouco.',
      playingNow: 'A tocar agora', jump: 'Saltar para esta',
      spWeb: 'Reproduzir neste navegador',
      spWebHint: 'Este separador torna-se um dispositivo do Spotify e reproduz a música. Precisa do Premium e do Web Playback SDK assinalado na sua aplicação do Spotify.',
      spWebStarting: 'A iniciar o leitor neste navegador…', spWebOther: 'Outro separador do CasaOS neste navegador é o dispositivo.',
      spWebScope: 'Ligue novamente (abaixo) para permitir a reprodução neste navegador.',
      spWebDrm: 'Este navegador não consegue reproduzir o Spotify aqui: o conteúdo protegido (DRM) está desativado ou não é suportado.',
      spWebFailed: 'O Spotify não aceitou este navegador como dispositivo: precisa do Premium e do Web Playback SDK assinalado na sua aplicação do Spotify.',
      spWebTap: 'O navegador reteve o som: carregue em reproduzir.',
      jfCode: 'No Jellyfin, abra o seu perfil → Quick Connect e introduza este código:',
      jfQcOff: 'O Quick Connect está desligado neste Jellyfin: ative-o no respetivo Painel (Geral).',
      jfNoServer: 'O Jellyfin não respondeu neste endereço. Com o CasaOS em https://, o Jellyfin também precisa de um endereço https:// (consulte o README).',
      jfNotConnected: 'Jellyfin não ligado', jfSettings: 'Definições do Jellyfin',
      jfError: 'O Jellyfin não respondeu. Tente novamente daqui a pouco.',
      jfLoginAgain: 'O início de sessão do Jellyfin foi revogado: ligue novamente.'
    },
    ro: {
      title: 'Muzică', folder: 'Dosarul cu muzică', change: 'Schimbă dosarul', scanning: 'Se citește dosarul…',
      empty: 'Niciun fișier audio în acest dosar.', folderError: 'Acest dosar nu a putut fi deschis.',
      nothing: 'Nu se redă nimic', pick: 'Alegeți o piesă sau apăsați redare', playlist: 'Listă de redare',
      tracks: { one: '{n} piesă', few: '{n} piese', other: '{n} de piese' },
      play: 'Redă', pause: 'Pauză', next: 'Următoarea', prev: 'Anterioara', shuffle: 'Amestecat',
      repeatAll: 'Repetă tot', repeatOne: 'Repetă una', repeatOff: 'Fără repetare', volume: 'Volum',
      subfolders: 'Include subdosarele', use: 'Folosește acest dosar', cancel: 'Anulează', up: 'Cu un nivel mai sus',
      loadError: 'Acest fișier nu a putut fi redat, se trece peste el.',
      search: 'Caută în listă', noMatch: 'Nicio piesă găsită.', queueAdd: 'Adaugă în coadă', queueRemove: 'Elimină din coadă',
      srcLocal: 'Fișiere din CasaOS', spLibrary: 'Biblioteca ta', spSettings: 'Setări Spotify', spDevices: 'Dispozitive', spBack: 'Înapoi',
      spSearch: 'Caută în playlisturi și pe Spotify', spLiked: 'Melodii apreciate', spOnSpotify: 'Pe Spotify', spLoading: 'Se încarcă…',
      spCantOpen: 'Spotify nu permite aplicațiilor ca aceasta să deschidă acest playlist.', spQueued: 'În coada Spotify (doar Spotify o poate scoate)',
      spLike: 'Salvează în Melodii apreciate', spUnlike: 'Elimină din Melodii apreciate', spNotConnected: 'Spotify nu este conectat',
      spConnectHint: 'Conectează-l din setări (rotița)', spNothing: 'Nu se redă nimic pe Spotify', spOpenApp: 'Pornește ceva în Spotify pe orice dispozitiv',
      spOn: 'Se redă pe {name}', spFreeShort: 'De ce nu există comenzi?',
      spFreeInfo: 'Comenzile necesită Spotify Premium: API-ul Spotify permite doar conturilor Premium să redea, să pună pe pauză sau să sară. Ce se redă rămâne afișat aici.',
      spNoDevices: 'Niciun dispozitiv nu are Spotify deschis. Deschide Spotify pe PC, telefon sau TV.', spNoDevice: 'Niciun dispozitiv nu redă: alege unul.',
      spHttps: 'Spotify se conectează doar cu CasaOS deschis prin HTTPS (https://…). Vezi pașii în README.',
      spClientId: 'Client ID-ul aplicației tale Spotify', spRedirect: 'Redirect URI (adaug-o în aplicația ta Spotify)', spCopy: 'Copiază',
      spCopied: 'Copiat', spConnectedAs: 'Conectat ca {name}', spHelp: 'Cum se configurează', spConnect: 'Conectează', spDisconnect: 'Deconectează',
      spDenied: 'Accesul la Spotify nu a fost permis.', spError: 'Spotify nu a răspuns. Încearcă din nou peste puțin timp.',
      spLoginAgain: 'Autentificarea Spotify a expirat: conectează-te din nou.',
      spNotRegistered: 'Acest cont nu este în aplicația ta Spotify: adaugă-l în User Management.', spBusy: 'Spotify a cerut să aștepți puțin.',
      upNext: 'Urmează', playingNow: 'Se redă acum', nothingNext: 'Nu urmează nimic', jump: 'Sari la aceasta',
      spWeb: 'Redă în acest browser',
      spWebHint: 'Această filă devine un dispozitiv Spotify și redă muzica. Are nevoie de Premium și de Web Playback SDK bifat în aplicația ta Spotify.',
      spWebStarting: 'Se pornește playerul în acest browser…', spWebReady: 'Gata: {name} apare printre dispozitivele tale Spotify.',
      spWebOther: 'Dispozitivul este o altă filă CasaOS din acest browser.',
      spWebScope: 'Conectează-te din nou (mai jos) pentru a permite redarea în acest browser.',
      spWebDrm: 'Acest browser nu poate reda Spotify aici: conținutul protejat (DRM) este dezactivat sau nu este acceptat.',
      spWebFailed: 'Spotify nu a acceptat acest browser ca dispozitiv: are nevoie de Premium și de Web Playback SDK bifat în aplicația ta Spotify.',
      spWebTap: 'Browserul a reținut sunetul: apasă redare.', spThisBrowser: 'Acest browser',
      jfServer: 'Adresa Jellyfin', jfCode: 'În Jellyfin, deschide profilul tău → Quick Connect și introdu acest cod:',
      jfQcOff: 'Quick Connect este dezactivat pe acest Jellyfin: activează-l din panoul de control (General).',
      jfNoServer: 'Jellyfin nu a răspuns la această adresă. Cu CasaOS pe https://, și Jellyfin are nevoie de o adresă https:// (vezi README).',
      jfFavorite: 'Adaugă la favorite', jfUnfavorite: 'Elimină de la favorite', jfFavorites: 'Favorite', jfAlbums: 'Albume', jfArtists: 'Artiști',
      jfSearch: 'Caută în biblioteca ta', jfOn: 'Pe Jellyfin', jfNotConnected: 'Jellyfin nu este conectat', jfSettings: 'Setări Jellyfin',
      jfError: 'Jellyfin nu a răspuns. Încearcă din nou peste puțin timp.',
      jfLoginAgain: 'Autentificarea Jellyfin a fost revocată: conectează-te din nou.',
      jfSongs: 'Toate melodiile'
    },
    ru: {
      title: 'Музыка', folder: 'Папка с музыкой', change: 'Сменить папку', scanning: 'Чтение папки…',
      empty: 'В этой папке нет аудиофайлов.', folderError: 'Не удалось открыть эту папку.',
      nothing: 'Ничего не играет', pick: 'Выберите трек или нажмите «Воспроизвести»', playlist: 'Плейлист',
      tracks: { one: '{n} трек', few: '{n} трека', many: '{n} треков', other: '{n} трека' },
      play: 'Воспроизвести', pause: 'Пауза', next: 'Следующий', prev: 'Предыдущий', shuffle: 'Перемешать',
      repeatAll: 'Повторять все', repeatOne: 'Повторять один', repeatOff: 'Без повтора', volume: 'Громкость',
      subfolders: 'Включить подпапки', use: 'Использовать эту папку', cancel: 'Отмена', up: 'На уровень выше',
      loadError: 'Не удалось воспроизвести этот файл, пропускаю.',
      search: 'Поиск в плейлисте', noMatch: 'Нет подходящих треков.', queueAdd: 'Добавить в очередь', queueRemove: 'Убрать из очереди',
      srcLocal: 'Файлы CasaOS', spLibrary: 'Ваша медиатека', spSettings: 'Настройки Spotify', spDevices: 'Устройства', spBack: 'Назад',
      spSearch: 'Искать в плейлистах и в Spotify', spLiked: 'Любимые треки', spOnSpotify: 'В Spotify', spLoading: 'Загрузка…',
      spCantOpen: 'Spotify не позволяет таким приложениям открывать этот плейлист.', spQueued: 'В очереди Spotify (убрать его может только Spotify)',
      spLike: 'Добавить в любимые треки', spUnlike: 'Убрать из любимых треков', spNotConnected: 'Spotify не подключён',
      spConnectHint: 'Подключите его в настройках (шестерёнка)', spNothing: 'В Spotify ничего не играет',
      spOpenApp: 'Включите что-нибудь в Spotify на любом устройстве', spOn: 'Играет на {name}', spFreeShort: 'Почему нет кнопок управления?',
      spFreeInfo: 'Для управления нужен Spotify Premium: API Spotify позволяет запускать, ставить на паузу и переключать треки только аккаунтам Premium. Что играет, по-прежнему видно здесь.',
      spNoDevices: 'Ни на одном устройстве не открыт Spotify. Откройте Spotify на компьютере, телефоне или телевизоре.',
      spNoDevice: 'Ни одно устройство не играет: выберите одно.',
      spHttps: 'Spotify подключается, только если CasaOS открыт по HTTPS (https://…). Шаги — в README.', spClientId: 'Client ID вашего приложения Spotify',
      spRedirect: 'Redirect URI (добавьте его в приложение Spotify)', spCopy: 'Копировать', spCopied: 'Скопировано', spConnectedAs: 'Подключено как {name}',
      spHelp: 'Как настроить', spConnect: 'Подключить', spDisconnect: 'Отключить', spDenied: 'Доступ к Spotify не разрешён.',
      spError: 'Spotify не ответил. Попробуйте ещё раз чуть позже.', spLoginAgain: 'Вход в Spotify истёк: подключитесь снова.',
      spNotRegistered: 'Этого аккаунта нет в вашем приложении Spotify: добавьте его в User Management.', spBusy: 'Spotify попросил немного подождать.',
      upNext: 'Далее', playingNow: 'Сейчас играет', nothingNext: 'Дальше ничего нет', jump: 'Перейти к этому треку',
      spWeb: 'Играть в этом браузере',
      spWebHint: 'Эта вкладка станет устройством Spotify и будет играть музыку. Нужны Premium и отмеченный Web Playback SDK в вашем приложении Spotify.',
      spWebStarting: 'Запуск плеера в этом браузере…', spWebReady: 'Готово: {name} есть в ваших устройствах Spotify.',
      spWebOther: 'Устройством стала другая вкладка CasaOS в этом браузере.',
      spWebScope: 'Подключитесь заново (ниже), чтобы разрешить воспроизведение в этом браузере.',
      spWebDrm: 'Этот браузер не может воспроизводить Spotify здесь: защищённый контент (DRM) отключён или не поддерживается.',
      spWebFailed: 'Spotify не принял этот браузер как устройство: нужны Premium и отмеченный Web Playback SDK в вашем приложении Spotify.',
      spWebTap: 'Браузер заблокировал звук: нажмите «Воспроизвести».', spThisBrowser: 'Этот браузер',
      jfServer: 'Адрес Jellyfin', jfCode: 'В Jellyfin откройте свой профиль → Quick Connect и введите этот код:',
      jfQcOff: 'Quick Connect выключен в этом Jellyfin: включите его в панели управления (Общие).',
      jfNoServer: 'Jellyfin не ответил по этому адресу. Если CasaOS открыт по https://, Jellyfin тоже нужен адрес https:// (см. README).',
      jfFavorite: 'Добавить в избранное', jfUnfavorite: 'Убрать из избранного', jfFavorites: 'Избранное', jfAlbums: 'Альбомы',
      jfArtists: 'Исполнители', jfSearch: 'Поиск в вашей медиатеке', jfOn: 'В Jellyfin', jfNotConnected: 'Jellyfin не подключён',
      jfSettings: 'Настройки Jellyfin', jfError: 'Jellyfin не ответил. Попробуйте ещё раз чуть позже.',
      jfLoginAgain: 'Вход в Jellyfin отозван: подключитесь снова.',
      jfSongs: 'Все треки'
    },
    sk: {
      title: 'Hudba', folder: 'Priečinok s hudbou', change: 'Zmeniť priečinok', scanning: 'Číta sa priečinok…',
      empty: 'V tomto priečinku nie sú žiadne zvukové súbory.', folderError: 'Tento priečinok sa nepodarilo otvoriť.',
      nothing: 'Nič nehrá', pick: 'Vyberte skladbu alebo stlačte prehrať', playlist: 'Playlist',
      tracks: { one: '{n} skladba', few: '{n} skladby', many: '{n} skladby', other: '{n} skladieb' },
      play: 'Prehrať', pause: 'Pozastaviť', next: 'Ďalšia', prev: 'Predchádzajúca', shuffle: 'Náhodne',
      repeatAll: 'Opakovať všetko', repeatOne: 'Opakovať jednu', repeatOff: 'Neopakovať', volume: 'Hlasitosť',
      subfolders: 'Vrátane podpriečinkov', use: 'Použiť tento priečinok', cancel: 'Zrušiť', up: 'O úroveň vyššie',
      loadError: 'Tento súbor sa nedá prehrať, preskakujem.',
      search: 'Hľadať v playliste', noMatch: 'Žiadne zodpovedajúce skladby.', queueAdd: 'Pridať do frontu', queueRemove: 'Odobrať z frontu',
      srcLocal: 'Súbory v CasaOS', spLibrary: 'Vaša knižnica', spSettings: 'Nastavenia Spotify', spDevices: 'Zariadenia', spBack: 'Späť',
      spSearch: 'Hľadať v playlistoch a na Spotify', spLiked: 'Obľúbené skladby', spOnSpotify: 'Na Spotify', spLoading: 'Načítava sa…',
      spCantOpen: 'Spotify nedovoľuje aplikáciám, ako je táto, otvoriť tento playlist.', spQueued: 'V poradí Spotify (odstrániť ju môže len Spotify)',
      spLike: 'Uložiť do Obľúbených skladieb', spUnlike: 'Odstrániť z Obľúbených skladieb', spNotConnected: 'Spotify nie je pripojené',
      spConnectHint: 'Pripojte ho v nastaveniach (ozubené koliesko)', spNothing: 'Na Spotify nič nehrá',
      spOpenApp: 'Pustite niečo na Spotify na ľubovoľnom zariadení', spOn: 'Hrá na {name}', spFreeShort: 'Prečo tu nie sú ovládacie prvky?',
      spFreeInfo: 'Ovládanie vyžaduje Spotify Premium: API Spotify dovoľuje prehrávať, pozastavovať a preskakovať iba účtom Premium. Čo hrá, sa tu naďalej zobrazuje.',
      spNoDevices: 'Žiadne zariadenie nemá otvorené Spotify. Otvorte Spotify v počítači, telefóne alebo televízore.',
      spNoDevice: 'Žiadne zariadenie neprehráva: vyberte jedno.',
      spHttps: 'Spotify sa pripojí iba s CasaOS otvoreným cez HTTPS (https://…). Postup nájdete v README.', spClientId: 'Client ID vašej aplikácie Spotify',
      spRedirect: 'Redirect URI (pridajte ho do svojej aplikácie Spotify)', spCopy: 'Kopírovať', spCopied: 'Skopírované',
      spConnectedAs: 'Pripojené ako {name}', spHelp: 'Ako to nastaviť', spConnect: 'Pripojiť', spDisconnect: 'Odpojiť',
      spDenied: 'Prístup k Spotify nebol povolený.', spError: 'Spotify neodpovedalo. Skúste to o chvíľu znova.',
      spLoginAgain: 'Prihlásenie do Spotify vypršalo: pripojte sa znova.',
      spNotRegistered: 'Tento účet nie je vo vašej aplikácii Spotify: pridajte ho v User Management.', spBusy: 'Spotify požiadalo o chvíľu strpenia.',
      upNext: 'Ďalej v poradí', playingNow: 'Práve hrá', nothingNext: 'Nič ďalšie v poradí', jump: 'Preskočiť na túto',
      spWeb: 'Prehrávať v tomto prehliadači',
      spWebHint: 'Táto karta sa stane zariadením Spotify a bude prehrávať hudbu. Vyžaduje Premium a začiarknuté Web Playback SDK vo vašej aplikácii Spotify.',
      spWebStarting: 'Spúšťa sa prehrávač v tomto prehliadači…', spWebReady: 'Hotovo: {name} je medzi vašimi zariadeniami Spotify.',
      spWebOther: 'Zariadením je iná karta CasaOS v tomto prehliadači.',
      spWebScope: 'Pripojte sa znova (nižšie), aby ste povolili prehrávanie v tomto prehliadači.',
      spWebDrm: 'Tento prehliadač tu nemôže prehrávať Spotify: chránený obsah (DRM) je vypnutý alebo nie je podporovaný.',
      spWebFailed: 'Spotify neprijal tento prehliadač ako zariadenie: vyžaduje Premium a začiarknuté Web Playback SDK vo vašej aplikácii Spotify.',
      spWebTap: 'Prehliadač zadržal zvuk: stlačte prehrať.', spThisBrowser: 'Tento prehliadač',
      jfServer: 'Adresa Jellyfinu', jfCode: 'V Jellyfine otvorte svoj profil → Quick Connect a zadajte tento kód:',
      jfQcOff: 'Quick Connect je v tomto Jellyfine vypnutý: zapnite ho v jeho ovládacom paneli (Všeobecné).',
      jfNoServer: 'Jellyfin na tejto adrese neodpovedal. Keď je CasaOS otvorený cez https://, aj Jellyfin potrebuje adresu https:// (pozri README).',
      jfFavorite: 'Pridať do obľúbených', jfUnfavorite: 'Odstrániť z obľúbených', jfFavorites: 'Obľúbené', jfAlbums: 'Albumy',
      jfArtists: 'Interpreti', jfSearch: 'Hľadať vo vašej knižnici', jfOn: 'V Jellyfine', jfNotConnected: 'Jellyfin nie je pripojený',
      jfSettings: 'Nastavenia Jellyfinu', jfError: 'Jellyfin neodpovedal. Skúste to o chvíľu znova.',
      jfLoginAgain: 'Prihlásenie do Jellyfinu bolo zrušené: pripojte sa znova.',
      jfSongs: 'Všetky skladby'
    },
    sl: {
      title: 'Glasba', folder: 'Mapa z glasbo', change: 'Zamenjaj mapo', scanning: 'Branje mape …',
      empty: 'V tej mapi ni zvočnih datotek.', folderError: 'Te mape ni bilo mogoče odpreti.',
      nothing: 'Nič se ne predvaja', pick: 'Izberite skladbo ali pritisnite predvajaj', playlist: 'Seznam predvajanja',
      tracks: { one: '{n} skladba', two: '{n} skladbi', few: '{n} skladbe', other: '{n} skladb' },
      play: 'Predvajaj', pause: 'Premor', next: 'Naslednja', prev: 'Prejšnja', shuffle: 'Naključno',
      repeatAll: 'Ponavljaj vse', repeatOne: 'Ponavljaj eno', repeatOff: 'Brez ponavljanja', volume: 'Glasnost',
      subfolders: 'Vključi podmape', use: 'Uporabi to mapo', cancel: 'Prekliči', up: 'Raven višje',
      loadError: 'Te datoteke ni mogoče predvajati, preskakujem.',
      search: 'Iskanje po seznamu', noMatch: 'Ni ustreznih skladb.', queueAdd: 'Dodaj v čakalno vrsto', queueRemove: 'Odstrani iz čakalne vrste',
      srcLocal: 'Datoteke v CasaOS', spLibrary: 'Vaša knjižnica', spSettings: 'Nastavitve Spotify', spDevices: 'Naprave', spBack: 'Nazaj',
      spSearch: 'Iskanje po seznamih predvajanja in na Spotifyju', spLiked: 'Všečkane skladbe', spOnSpotify: 'Na Spotifyju', spLoading: 'Nalaganje…',
      spCantOpen: 'Spotify aplikacijam, kot je ta, ne dovoli odpreti tega seznama.', spQueued: 'V čakalni vrsti Spotify (odstrani jo lahko le Spotify)',
      spLike: 'Shrani med Všečkane skladbe', spUnlike: 'Odstrani iz Všečkanih skladb', spNotConnected: 'Spotify ni povezan',
      spConnectHint: 'Povežite ga v nastavitvah (zobnik)', spNothing: 'Na Spotifyju se nič ne predvaja',
      spOpenApp: 'Predvajajte nekaj v Spotifyju na kateri koli napravi', spOn: 'Predvaja se na {name}', spFreeShort: 'Zakaj ni kontrolnikov?',
      spFreeInfo: 'Kontrolniki potrebujejo Spotify Premium: API Spotify dovoli predvajanje, premor in preskakovanje samo računom Premium. Kar se predvaja, je še vedno prikazano tukaj.',
      spNoDevices: 'Nobena naprava nima odprtega Spotifyja. Odprite Spotify v računalniku, telefonu ali televiziji.',
      spNoDevice: 'Nobena naprava ne predvaja: izberite eno.',
      spHttps: 'Spotify se poveže le, če je CasaOS odprt prek HTTPS (https://…). Koraki so v README.', spClientId: 'Client ID vaše aplikacije Spotify',
      spRedirect: 'Redirect URI (dodajte ga v svojo aplikacijo Spotify)', spCopy: 'Kopiraj', spCopied: 'Kopirano', spConnectedAs: 'Povezano kot {name}',
      spHelp: 'Kako nastaviti', spConnect: 'Poveži', spDisconnect: 'Prekini povezavo', spDenied: 'Dostop do Spotifyja ni bil dovoljen.',
      spError: 'Spotify se ni odzval. Poskusite znova čez trenutek.', spLoginAgain: 'Prijava v Spotify je potekla: znova se povežite.',
      spNotRegistered: 'Tega računa ni v vaši aplikaciji Spotify: dodajte ga v User Management.', spBusy: 'Spotify je prosil, da malo počakate.',
      upNext: 'Sledi', playingNow: 'Zdaj se predvaja', nothingNext: 'Nič ne sledi', jump: 'Preskoči na to',
      spWeb: 'Predvajaj v tem brskalniku',
      spWebHint: 'Ta zavihek postane naprava Spotify in predvaja glasbo. Potrebna sta Premium in označen Web Playback SDK v vaši aplikaciji Spotify.',
      spWebStarting: 'Zaganjanje predvajalnika v tem brskalniku…', spWebReady: 'Pripravljeno: {name} je med vašimi napravami Spotify.',
      spWebOther: 'Naprava je drug zavihek CasaOS v tem brskalniku.', spWebScope: 'Znova se povežite (spodaj), da dovolite predvajanje v tem brskalniku.',
      spWebDrm: 'Ta brskalnik tu ne more predvajati Spotifyja: zaščitena vsebina (DRM) je izklopljena ali ni podprta.',
      spWebFailed: 'Spotify tega brskalnika ni sprejel kot naprave: potrebna sta Premium in označen Web Playback SDK v vaši aplikaciji Spotify.',
      spWebTap: 'Brskalnik je zadržal zvok: pritisnite predvajaj.', spThisBrowser: 'Ta brskalnik',
      jfServer: 'Naslov Jellyfina', jfCode: 'V Jellyfinu odprite svoj profil → Quick Connect in vnesite to kodo:',
      jfQcOff: 'Quick Connect je v tem Jellyfinu izklopljen: vklopite ga na njegovi nadzorni plošči (Splošno).',
      jfNoServer: 'Jellyfin se na tem naslovu ni odzval. Ko je CasaOS odprt prek https://, tudi Jellyfin potrebuje naslov https:// (glejte README).',
      jfFavorite: 'Dodaj med priljubljene', jfUnfavorite: 'Odstrani iz priljubljenih', jfFavorites: 'Priljubljene', jfAlbums: 'Albumi',
      jfArtists: 'Izvajalci', jfSearch: 'Iskanje po vaši knjižnici', jfOn: 'V Jellyfinu', jfNotConnected: 'Jellyfin ni povezan',
      jfSettings: 'Nastavitve Jellyfina', jfError: 'Jellyfin se ni odzval. Poskusite znova čez trenutek.',
      jfLoginAgain: 'Prijava v Jellyfin je bila preklicana: znova se povežite.',
      jfSongs: 'Vse skladbe'
    },
    sv: {
      title: 'Musik', folder: 'Musikmapp', change: 'Byt mapp', scanning: 'Läser mappen…',
      empty: 'Inga ljudfiler i den här mappen.', folderError: 'Det gick inte att öppna mappen.',
      nothing: 'Inget spelas', pick: 'Välj ett spår eller tryck på spela', playlist: 'Spellista',
      tracks: { one: '{n} spår', other: '{n} spår' },
      play: 'Spela', pause: 'Pausa', next: 'Nästa', prev: 'Föregående', shuffle: 'Blanda',
      repeatAll: 'Upprepa alla', repeatOne: 'Upprepa ett', repeatOff: 'Upprepa inte', volume: 'Volym',
      subfolders: 'Ta med undermappar', use: 'Använd den här mappen', cancel: 'Avbryt', up: 'En nivå upp',
      loadError: 'Det gick inte att spela filen, hoppar över.',
      search: 'Sök i spellistan', noMatch: 'Inga matchande spår.', queueAdd: 'Lägg till i kön', queueRemove: 'Ta bort från kön',
      srcLocal: 'Filer i CasaOS', spLibrary: 'Ditt bibliotek', spSettings: 'Spotify-inställningar', spDevices: 'Enheter', spBack: 'Tillbaka',
      spSearch: 'Sök i dina spellistor och på Spotify', spLiked: 'Gillade låtar', spOnSpotify: 'På Spotify', spLoading: 'Läser in…',
      spCantOpen: 'Spotify låter inte appar som den här öppna den här spellistan.', spQueued: 'I Spotify-kön (bara Spotify kan ta bort den)',
      spLike: 'Spara i Gillade låtar', spUnlike: 'Ta bort från Gillade låtar', spNotConnected: 'Spotify är inte anslutet',
      spConnectHint: 'Anslut i inställningarna (kugghjulet)', spNothing: 'Inget spelas på Spotify', spOpenApp: 'Spela något i Spotify på valfri enhet',
      spOn: 'Spelas på {name}', spFreeShort: 'Varför finns det inga kontroller?',
      spFreeInfo: 'Kontrollerna kräver Spotify Premium: Spotifys API låter bara Premium-konton spela upp, pausa eller hoppa över. Det som spelas visas fortfarande här.',
      spNoDevices: 'Ingen enhet har Spotify öppet. Öppna Spotify på datorn, mobilen eller tv:n.', spNoDevice: 'Ingen enhet spelar upp: välj en.',
      spHttps: 'Spotify ansluter bara när CasaOS är öppnat via HTTPS (https://…). Se stegen i README.', spClientId: 'Client ID för din Spotify-app',
      spRedirect: 'Redirect URI (lägg till den i din Spotify-app)', spCopy: 'Kopiera', spCopied: 'Kopierat', spConnectedAs: 'Ansluten som {name}',
      spHelp: 'Så konfigurerar du det', spConnect: 'Anslut', spDisconnect: 'Koppla från', spDenied: 'Åtkomst till Spotify tilläts inte.',
      spError: 'Spotify svarade inte. Försök igen om en stund.', spLoginAgain: 'Spotify-inloggningen har gått ut: anslut igen.',
      spNotRegistered: 'Det här kontot finns inte i din Spotify-app: lägg till det under User Management.', spBusy: 'Spotify bad om att vänta en stund.',
      upNext: 'Näst på tur', playingNow: 'Spelas nu', nothingNext: 'Inget näst på tur', jump: 'Hoppa till den här',
      spWeb: 'Spela upp i den här webbläsaren',
      spWebHint: 'Den här fliken blir en Spotify-enhet och spelar musiken. Kräver Premium och Web Playback SDK ikryssat i din Spotify-app.',
      spWebStarting: 'Startar spelaren i den här webbläsaren…', spWebReady: 'Klart: {name} finns bland dina Spotify-enheter.',
      spWebOther: 'En annan CasaOS-flik i den här webbläsaren är enheten.',
      spWebScope: 'Anslut igen (nedan) för att tillåta uppspelning i den här webbläsaren.',
      spWebDrm: 'Den här webbläsaren kan inte spela Spotify här: skyddat innehåll (DRM) är av eller stöds inte.',
      spWebFailed: 'Spotify godtog inte den här webbläsaren som enhet: kräver Premium och Web Playback SDK ikryssat i din Spotify-app.',
      spWebTap: 'Webbläsaren höll tillbaka ljudet: tryck på spela.', spThisBrowser: 'Den här webbläsaren',
      jfServer: 'Jellyfin-adress', jfCode: 'Öppna din profil i Jellyfin → Quick Connect och ange den här koden:',
      jfQcOff: 'Quick Connect är avstängt på den här Jellyfin: slå på det i kontrollpanelen (Allmänt).',
      jfNoServer: 'Jellyfin svarade inte på den här adressen. Med CasaOS på https:// behöver Jellyfin också en https://-adress (se README).',
      jfFavorite: 'Lägg till i favoriter', jfUnfavorite: 'Ta bort från favoriter', jfFavorites: 'Favoriter', jfAlbums: 'Album',
      jfArtists: 'Artister', jfSearch: 'Sök i ditt bibliotek', jfOn: 'På Jellyfin', jfNotConnected: 'Jellyfin är inte anslutet',
      jfSettings: 'Jellyfin-inställningar', jfError: 'Jellyfin svarade inte. Försök igen om en stund.',
      jfLoginAgain: 'Jellyfin-inloggningen har återkallats: anslut igen.',
      jfSongs: 'Alla låtar'
    },
    tr: {
      title: 'Müzik', folder: 'Müzik klasörü', change: 'Klasörü değiştir', scanning: 'Klasör okunuyor…',
      empty: 'Bu klasörde ses dosyası yok.', folderError: 'Bu klasör açılamadı.',
      nothing: 'Çalan bir şey yok', pick: 'Bir parça seçin veya oynat’a basın', playlist: 'Çalma listesi',
      tracks: { one: '{n} parça', other: '{n} parça' },
      play: 'Oynat', pause: 'Duraklat', next: 'Sonraki', prev: 'Önceki', shuffle: 'Karıştır',
      repeatAll: 'Tümünü tekrarla', repeatOne: 'Birini tekrarla', repeatOff: 'Tekrarlama kapalı', volume: 'Ses düzeyi',
      subfolders: 'Alt klasörleri dahil et', use: 'Bu klasörü kullan', cancel: 'İptal', up: 'Bir üst düzey',
      loadError: 'Bu dosya oynatılamadı, atlanıyor.',
      search: 'Çalma listesinde ara', noMatch: 'Eşleşen parça yok.', queueAdd: 'Sıraya ekle', queueRemove: 'Sıradan çıkar',
      srcLocal: 'CasaOS\'teki dosyalar', spLibrary: 'Kitaplığın', spSettings: 'Spotify ayarları', spDevices: 'Cihazlar', spBack: 'Geri',
      spSearch: 'Çalma listelerinde ve Spotify\'da ara', spLiked: 'Beğenilen Şarkılar', spOnSpotify: 'Spotify\'da', spLoading: 'Yükleniyor…',
      spCantOpen: 'Spotify, bunun gibi uygulamaların bu çalma listesini açmasına izin vermiyor.',
      spQueued: 'Spotify kuyruğunda (yalnızca Spotify çıkarabilir)', spLike: 'Beğenilen Şarkılar\'a kaydet', spUnlike: 'Beğenilen Şarkılar\'dan kaldır',
      spNotConnected: 'Spotify bağlı değil', spConnectHint: 'Ayarlardan bağlayın (dişli)', spNothing: 'Spotify\'da hiçbir şey çalmıyor',
      spOpenApp: 'Herhangi bir cihazda Spotify\'da bir şey çalın', spOn: '{name} üzerinde çalıyor', spFreeShort: 'Neden kontroller yok?',
      spFreeInfo: 'Kontroller Spotify Premium gerektirir: Spotify\'ın API\'si yalnızca Premium hesapların çalmasına, duraklatmasına veya atlamasına izin verir. Çalan şey burada görünmeye devam eder.',
      spNoDevices: 'Hiçbir cihazda Spotify açık değil. Spotify\'ı bilgisayarda, telefonda veya TV\'de açın.',
      spNoDevice: 'Hiçbir cihaz çalmıyor: birini seçin.', spHttps: 'Spotify yalnızca CasaOS HTTPS (https://…) ile açıldığında bağlanır. Adımlar README\'de.',
      spClientId: 'Spotify uygulamanızın Client ID değeri', spRedirect: 'Redirect URI (Spotify uygulamanıza ekleyin)', spCopy: 'Kopyala',
      spCopied: 'Kopyalandı', spConnectedAs: '{name} olarak bağlı', spHelp: 'Nasıl kurulur', spConnect: 'Bağlan', spDisconnect: 'Bağlantıyı kes',
      spDenied: 'Spotify\'a erişime izin verilmedi.', spError: 'Spotify yanıt vermedi. Biraz sonra yeniden deneyin.',
      spLoginAgain: 'Spotify oturumunun süresi doldu: yeniden bağlanın.',
      spNotRegistered: 'Bu hesap Spotify uygulamanızda yok: User Management bölümünden ekleyin.', spBusy: 'Spotify biraz beklemenizi istedi.',
      upNext: 'Sıradaki', playingNow: 'Şimdi çalıyor', nothingNext: 'Sırada bir şey yok', jump: 'Buna atla',
      spWeb: 'Bu tarayıcıda çal',
      spWebHint: 'Bu sekme bir Spotify cihazı olur ve müziği çalar. Premium ve Spotify uygulamanızda işaretli Web Playback SDK gerekir.',
      spWebStarting: 'Oynatıcı bu tarayıcıda başlatılıyor…', spWebReady: 'Hazır: {name} Spotify cihazlarınızda.',
      spWebOther: 'Cihaz, bu tarayıcıdaki başka bir CasaOS sekmesi.', spWebScope: 'Bu tarayıcıda çalmaya izin vermek için yeniden bağlanın (aşağıda).',
      spWebDrm: 'Bu tarayıcı Spotify\'ı burada çalamıyor: korumalı içerik (DRM) kapalı ya da desteklenmiyor.',
      spWebFailed: 'Spotify bu tarayıcıyı cihaz olarak kabul etmedi: Premium ve Spotify uygulamanızda işaretli Web Playback SDK gerekir.',
      spWebTap: 'Tarayıcı sesi engelledi: oynat\'a basın.', spThisBrowser: 'Bu tarayıcı',
      jfServer: 'Jellyfin adresi', jfCode: 'Jellyfin\'de profilinizden Quick Connect\'i açın ve bu kodu girin:',
      jfQcOff: 'Bu Jellyfin\'de Quick Connect kapalı: Kontrol Paneli\'nden (Genel) açın.',
      jfNoServer: 'Jellyfin bu adreste yanıt vermedi. CasaOS https:// ile açıksa Jellyfin\'in de https:// adresi olmalı (README\'ye bakın).',
      jfFavorite: 'Favorilere ekle', jfUnfavorite: 'Favorilerden çıkar', jfFavorites: 'Favoriler', jfAlbums: 'Albümler', jfArtists: 'Sanatçılar',
      jfSearch: 'Kitaplıkta ara', jfOn: 'Jellyfin\'de', jfNotConnected: 'Jellyfin bağlı değil', jfSettings: 'Jellyfin ayarları',
      jfError: 'Jellyfin yanıt vermedi. Biraz sonra yeniden deneyin.', jfLoginAgain: 'Jellyfin oturumu iptal edildi: yeniden bağlanın.',
      jfSongs: 'Tüm şarkılar'
    },
    uk: {
      title: 'Музика', folder: 'Тека з музикою', change: 'Змінити теку', scanning: 'Читання теки…',
      empty: 'У цій теці немає аудіофайлів.', folderError: 'Не вдалося відкрити цю теку.',
      nothing: 'Нічого не грає', pick: 'Оберіть трек або натисніть «Відтворити»', playlist: 'Плейлист',
      tracks: { one: '{n} трек', few: '{n} треки', many: '{n} треків', other: '{n} треку' },
      play: 'Відтворити', pause: 'Пауза', next: 'Наступний', prev: 'Попередній', shuffle: 'Перемішати',
      repeatAll: 'Повторювати все', repeatOne: 'Повторювати один', repeatOff: 'Без повтору', volume: 'Гучність',
      subfolders: 'Включити підтеки', use: 'Використати цю теку', cancel: 'Скасувати', up: 'На рівень вище',
      loadError: 'Не вдалося відтворити цей файл, пропускаю.',
      search: 'Пошук у плейлисті', noMatch: 'Немає відповідних треків.', queueAdd: 'Додати до черги', queueRemove: 'Прибрати з черги',
      srcLocal: 'Файли CasaOS', spLibrary: 'Ваша бібліотека', spSettings: 'Налаштування Spotify', spDevices: 'Пристрої', spBack: 'Назад',
      spSearch: 'Шукати в плейлистах і в Spotify', spLiked: 'Вподобані пісні', spOnSpotify: 'У Spotify', spLoading: 'Завантаження…',
      spCantOpen: 'Spotify не дозволяє таким застосункам відкривати цей плейлист.', spQueued: 'У черзі Spotify (прибрати його може лише Spotify)',
      spLike: 'Додати до вподобаних пісень', spUnlike: 'Прибрати з вподобаних пісень', spNotConnected: 'Spotify не підключено',
      spConnectHint: 'Підключіть його в налаштуваннях (шестірня)', spNothing: 'У Spotify нічого не грає',
      spOpenApp: 'Увімкніть щось у Spotify на будь-якому пристрої', spOn: 'Грає на {name}', spFreeShort: 'Чому немає кнопок керування?',
      spFreeInfo: 'Для керування потрібен Spotify Premium: API Spotify дозволяє відтворювати, ставити на паузу й перемикати лише акаунтам Premium. Що грає, і далі видно тут.',
      spNoDevices: 'На жодному пристрої не відкрито Spotify. Відкрийте Spotify на комп’ютері, телефоні чи телевізорі.',
      spNoDevice: 'Жоден пристрій не грає: виберіть один.',
      spHttps: 'Spotify підключається, лише якщо CasaOS відкрито через HTTPS (https://…). Кроки — у README.',
      spClientId: 'Client ID вашого застосунку Spotify', spRedirect: 'Redirect URI (додайте його до застосунку Spotify)', spCopy: 'Копіювати',
      spCopied: 'Скопійовано', spConnectedAs: 'Підключено як {name}', spHelp: 'Як налаштувати', spConnect: 'Підключити', spDisconnect: 'Відключити',
      spDenied: 'Доступ до Spotify не дозволено.', spError: 'Spotify не відповів. Спробуйте ще раз трохи згодом.',
      spLoginAgain: 'Вхід у Spotify закінчився: підключіться знову.',
      spNotRegistered: 'Цього акаунта немає у вашому застосунку Spotify: додайте його в User Management.', spBusy: 'Spotify попросив трохи зачекати.',
      upNext: 'Далі', playingNow: 'Зараз грає', nothingNext: 'Далі нічого немає', jump: 'Перейти до цього треку',
      spWeb: 'Грати в цьому браузері',
      spWebHint: 'Ця вкладка стане пристроєм Spotify і гратиме музику. Потрібні Premium і позначений Web Playback SDK у вашому застосунку Spotify.',
      spWebStarting: 'Запуск плеєра в цьому браузері…', spWebReady: 'Готово: {name} є у ваших пристроях Spotify.',
      spWebOther: 'Пристроєм стала інша вкладка CasaOS у цьому браузері.',
      spWebScope: 'Підключіться знову (нижче), щоб дозволити відтворення в цьому браузері.',
      spWebDrm: 'Цей браузер не може відтворювати Spotify тут: захищений вміст (DRM) вимкнено або не підтримується.',
      spWebFailed: 'Spotify не прийняв цей браузер як пристрій: потрібні Premium і позначений Web Playback SDK у вашому застосунку Spotify.',
      spWebTap: 'Браузер заблокував звук: натисніть «Відтворити».', spThisBrowser: 'Цей браузер',
      jfServer: 'Адреса Jellyfin', jfCode: 'У Jellyfin відкрийте свій профіль → Quick Connect і введіть цей код:',
      jfQcOff: 'Quick Connect вимкнено в цьому Jellyfin: увімкніть його в панелі керування (Загальні).',
      jfNoServer: 'Jellyfin не відповів за цією адресою. Якщо CasaOS відкрито через https://, Jellyfin теж потрібна адреса https:// (див. README).',
      jfFavorite: 'Додати до обраного', jfUnfavorite: 'Прибрати з обраного', jfFavorites: 'Обране', jfAlbums: 'Альбоми', jfArtists: 'Виконавці',
      jfSearch: 'Пошук у вашій бібліотеці', jfOn: 'У Jellyfin', jfNotConnected: 'Jellyfin не підключено', jfSettings: 'Налаштування Jellyfin',
      jfError: 'Jellyfin не відповів. Спробуйте ще раз трохи згодом.', jfLoginAgain: 'Вхід у Jellyfin відкликано: підключіться знову.',
      jfSongs: 'Усі треки'
    },
    vi: {
      title: 'Âm nhạc', folder: 'Thư mục nhạc', change: 'Đổi thư mục', scanning: 'Đang đọc thư mục…',
      empty: 'Không có tệp âm thanh trong thư mục này.', folderError: 'Không thể mở thư mục này.',
      nothing: 'Không phát gì', pick: 'Chọn một bài hoặc nhấn phát', playlist: 'Danh sách phát',
      tracks: { other: '{n} bài' },
      play: 'Phát', pause: 'Tạm dừng', next: 'Tiếp theo', prev: 'Trước', shuffle: 'Phát ngẫu nhiên',
      repeatAll: 'Lặp lại tất cả', repeatOne: 'Lặp lại một bài', repeatOff: 'Không lặp lại', volume: 'Âm lượng',
      subfolders: 'Bao gồm thư mục con', use: 'Dùng thư mục này', cancel: 'Hủy', up: 'Lên một cấp',
      loadError: 'Không thể phát tệp này, đang bỏ qua.',
      search: 'Tìm trong danh sách phát', noMatch: 'Không có bài nào khớp.', queueAdd: 'Thêm vào hàng chờ', queueRemove: 'Xóa khỏi hàng chờ',
      srcLocal: 'Tệp trên CasaOS', spLibrary: 'Thư viện của bạn', spSettings: 'Cài đặt Spotify', spDevices: 'Thiết bị', spBack: 'Quay lại',
      spSearch: 'Tìm trong danh sách phát và trên Spotify', spLiked: 'Bài hát đã thích', spOnSpotify: 'Trên Spotify', spLoading: 'Đang tải…',
      spCantOpen: 'Spotify không cho các ứng dụng như thế này mở danh sách phát này.', spQueued: 'Đã vào hàng đợi Spotify (chỉ Spotify mới gỡ được)',
      spLike: 'Lưu vào Bài hát đã thích', spUnlike: 'Xóa khỏi Bài hát đã thích', spNotConnected: 'Chưa kết nối Spotify',
      spConnectHint: 'Kết nối trong cài đặt (bánh răng)', spNothing: 'Không có gì đang phát trên Spotify',
      spOpenApp: 'Hãy phát gì đó trên Spotify ở thiết bị bất kỳ', spOn: 'Đang phát trên {name}', spFreeShort: 'Sao không có nút điều khiển?',
      spFreeInfo: 'Điều khiển cần Spotify Premium: API của Spotify chỉ cho tài khoản Premium phát, tạm dừng hoặc chuyển bài. Nội dung đang phát vẫn hiện ở đây.',
      spNoDevices: 'Không thiết bị nào đang mở Spotify. Hãy mở Spotify trên máy tính, điện thoại hoặc TV.',
      spNoDevice: 'Không thiết bị nào đang phát: hãy chọn một.',
      spHttps: 'Spotify chỉ kết nối khi CasaOS được mở qua HTTPS (https://…). Xem các bước trong README.',
      spClientId: 'Client ID của ứng dụng Spotify của bạn', spRedirect: 'Redirect URI (thêm vào ứng dụng Spotify của bạn)', spCopy: 'Sao chép',
      spCopied: 'Đã sao chép', spConnectedAs: 'Đã kết nối với tên {name}', spHelp: 'Cách thiết lập', spConnect: 'Kết nối', spDisconnect: 'Ngắt kết nối',
      spDenied: 'Quyền truy cập Spotify không được cho phép.', spError: 'Spotify không phản hồi. Hãy thử lại sau giây lát.',
      spLoginAgain: 'Phiên đăng nhập Spotify đã hết hạn: hãy kết nối lại.',
      spNotRegistered: 'Tài khoản này không có trong ứng dụng Spotify của bạn: hãy thêm trong User Management.', spBusy: 'Spotify yêu cầu chờ một chút.',
      upNext: 'Tiếp theo', playingNow: 'Đang phát', nothingNext: 'Không có gì tiếp theo', jump: 'Chuyển đến bài này',
      spWeb: 'Phát trong trình duyệt này',
      spWebHint: 'Thẻ này trở thành một thiết bị Spotify và phát nhạc. Cần Premium và đánh dấu Web Playback SDK trong ứng dụng Spotify của bạn.',
      spWebStarting: 'Đang khởi động trình phát trong trình duyệt này…', spWebReady: 'Sẵn sàng: {name} có trong danh sách thiết bị Spotify của bạn.',
      spWebOther: 'Một thẻ CasaOS khác trong trình duyệt này đang là thiết bị.',
      spWebScope: 'Hãy kết nối lại (bên dưới) để cho phép phát trong trình duyệt này.',
      spWebDrm: 'Trình duyệt này không thể phát Spotify ở đây: nội dung được bảo vệ (DRM) đang tắt hoặc không được hỗ trợ.',
      spWebFailed: 'Spotify không nhận trình duyệt này làm thiết bị: cần Premium và đánh dấu Web Playback SDK trong ứng dụng Spotify của bạn.',
      spWebTap: 'Trình duyệt đã chặn âm thanh: hãy nhấn phát.', spThisBrowser: 'Trình duyệt này',
      jfServer: 'Địa chỉ Jellyfin', jfCode: 'Trong Jellyfin, mở hồ sơ của bạn → Quick Connect và nhập mã này:',
      jfQcOff: 'Quick Connect đang tắt trên Jellyfin này: hãy bật trong Bảng điều khiển (Chung).',
      jfNoServer: 'Jellyfin không phản hồi ở địa chỉ này. Khi mở CasaOS bằng https://, Jellyfin cũng cần địa chỉ https:// (xem README).',
      jfFavorite: 'Thêm vào yêu thích', jfUnfavorite: 'Xóa khỏi yêu thích', jfFavorites: 'Yêu thích', jfAlbums: 'Album', jfArtists: 'Nghệ sĩ',
      jfSearch: 'Tìm trong thư viện của bạn', jfOn: 'Trên Jellyfin', jfNotConnected: 'Chưa kết nối Jellyfin', jfSettings: 'Cài đặt Jellyfin',
      jfError: 'Jellyfin không phản hồi. Hãy thử lại sau giây lát.', jfLoginAgain: 'Phiên đăng nhập Jellyfin đã bị thu hồi: hãy kết nối lại.',
      jfSongs: 'Tất cả bài hát'
    },
    'zh-cn': {
      title: '音乐', folder: '音乐文件夹', change: '更换文件夹', scanning: '正在读取文件夹…',
      empty: '此文件夹中没有音频文件。', folderError: '无法打开此文件夹。',
      nothing: '未在播放', pick: '选择一首曲目或点击播放', playlist: '播放列表',
      tracks: { other: '{n} 首' },
      play: '播放', pause: '暂停', next: '下一首', prev: '上一首', shuffle: '随机播放',
      repeatAll: '全部循环', repeatOne: '单曲循环', repeatOff: '不循环', volume: '音量',
      subfolders: '包含子文件夹', use: '使用此文件夹', cancel: '取消', up: '返回上一级',
      loadError: '无法播放此文件，已跳过。',
      search: '搜索播放列表', noMatch: '没有匹配的曲目。', queueAdd: '加入播放队列', queueRemove: '从播放队列移除',
      srcLocal: 'CasaOS 上的文件', spLibrary: '你的音乐库', spSettings: 'Spotify 设置', spDevices: '设备', spBack: '返回', spSearch: '搜索歌单和 Spotify', spLiked: '已点赞的歌曲',
      spOnSpotify: 'Spotify 上', spLoading: '正在加载…', spCantOpen: 'Spotify 不允许此类应用打开这个歌单。', spQueued: '已加入 Spotify 播放队列（只能在 Spotify 中移除）', spLike: '保存到已点赞的歌曲',
      spUnlike: '从已点赞的歌曲中移除', spNotConnected: '未连接 Spotify', spConnectHint: '在设置（齿轮）中连接', spNothing: 'Spotify 上没有正在播放的内容',
      spOpenApp: '在任意设备上用 Spotify 播放点什么', spOn: '正在 {name} 上播放', spFreeShort: '为什么没有控制按钮？',
      spFreeInfo: '控制需要 Spotify Premium：Spotify 的 API 只允许 Premium 账户播放、暂停或切歌。正在播放的内容仍会显示在这里。', spNoDevices: '没有设备打开 Spotify。请在电脑、手机或电视上打开 Spotify。',
      spNoDevice: '没有正在播放的设备：请选择一个。', spHttps: '只有通过 HTTPS（https://…）打开 CasaOS 时 Spotify 才能连接。步骤见 README。', spClientId: '你的 Spotify 应用的 Client ID',
      spRedirect: 'Redirect URI（添加到你的 Spotify 应用中）', spCopy: '复制', spCopied: '已复制', spConnectedAs: '已连接：{name}', spHelp: '如何设置', spConnect: '连接',
      spDisconnect: '断开连接', spDenied: '未允许访问 Spotify。', spError: 'Spotify 没有响应，请稍后再试。', spLoginAgain: 'Spotify 登录已过期：请重新连接。',
      spNotRegistered: '此账户不在你的 Spotify 应用中：请在 User Management 中添加。', spBusy: 'Spotify 要求稍等片刻。',
      upNext: '接下来播放', playingNow: '正在播放', nothingNext: '接下来没有歌曲', jump: '跳到这首',
      spWeb: '在此浏览器中播放', spWebHint: '此标签页会成为一台 Spotify 设备并播放音乐。需要 Premium，并在你的 Spotify 应用中勾选 Web Playback SDK。', spWebStarting: '正在此浏览器中启动播放器…',
      spWebReady: '就绪：{name} 已在你的 Spotify 设备中。', spWebOther: '此浏览器中的另一个 CasaOS 标签页是该设备。', spWebScope: '请重新连接（下方），以允许在此浏览器中播放。',
      spWebDrm: '此浏览器无法在这里播放 Spotify：受保护内容（DRM）已关闭或不受支持。', spWebFailed: 'Spotify 未接受此浏览器作为设备：需要 Premium，并在你的 Spotify 应用中勾选 Web Playback SDK。',
      spWebTap: '浏览器拦截了声音：请按播放。', spThisBrowser: '此浏览器',
      jfServer: 'Jellyfin 地址', jfCode: '在 Jellyfin 中打开你的个人资料 → Quick Connect，然后输入此代码：', jfQcOff: '此 Jellyfin 已关闭 Quick Connect：请在其控制台（常规）中开启。',
      jfNoServer: '此地址上的 Jellyfin 没有响应。CasaOS 通过 https:// 打开时，Jellyfin 也需要 https:// 地址（参见 README）。', jfFavorite: '添加到收藏', jfUnfavorite: '从收藏中移除',
      jfFavorites: '收藏', jfAlbums: '专辑', jfArtists: '艺人', jfSearch: '搜索你的音乐库', jfOn: 'Jellyfin 上', jfNotConnected: '未连接 Jellyfin',
      jfSettings: 'Jellyfin 设置', jfError: 'Jellyfin 没有响应，请稍后再试。', jfLoginAgain: 'Jellyfin 登录已被撤销：请重新连接。',
      jfSongs: '所有歌曲'
    },
    'zh-tw': {
      title: '音樂', folder: '音樂資料夾', change: '更換資料夾', scanning: '正在讀取資料夾…',
      empty: '此資料夾中沒有音訊檔案。', folderError: '無法開啟此資料夾。',
      nothing: '未在播放', pick: '選擇一首曲目或點擊播放', playlist: '播放清單',
      tracks: { other: '{n} 首' },
      play: '播放', pause: '暫停', next: '下一首', prev: '上一首', shuffle: '隨機播放',
      repeatAll: '全部重複', repeatOne: '單曲重複', repeatOff: '不重複', volume: '音量',
      subfolders: '包含子資料夾', use: '使用此資料夾', cancel: '取消', up: '回到上一層',
      loadError: '無法播放此檔案，已略過。',
      search: '搜尋播放清單', noMatch: '沒有符合的曲目。', queueAdd: '加入待播清單', queueRemove: '從待播清單移除',
      srcLocal: 'CasaOS 上的檔案', spLibrary: '你的音樂庫', spSettings: 'Spotify 設定', spDevices: '裝置', spBack: '返回', spSearch: '搜尋播放清單和 Spotify', spLiked: '已按讚的歌曲',
      spOnSpotify: 'Spotify 上', spLoading: '載入中…', spCantOpen: 'Spotify 不允許此類應用程式開啟這個播放清單。', spQueued: '已加入 Spotify 待播清單（只能在 Spotify 中移除）',
      spLike: '儲存到已按讚的歌曲', spUnlike: '從已按讚的歌曲中移除', spNotConnected: '尚未連接 Spotify', spConnectHint: '在設定（齒輪）中連接', spNothing: 'Spotify 上沒有正在播放的內容',
      spOpenApp: '在任何裝置上用 Spotify 播放一些內容', spOn: '正在 {name} 上播放', spFreeShort: '為什麼沒有控制按鈕？',
      spFreeInfo: '控制需要 Spotify Premium：Spotify 的 API 只允許 Premium 帳戶播放、暫停或跳過。正在播放的內容仍會顯示在這裡。', spNoDevices: '沒有裝置開啟 Spotify。請在電腦、手機或電視上開啟 Spotify。',
      spNoDevice: '沒有正在播放的裝置：請選擇一個。', spHttps: '只有透過 HTTPS（https://…）開啟 CasaOS 時 Spotify 才能連接。步驟請見 README。', spClientId: '你的 Spotify 應用程式的 Client ID',
      spRedirect: 'Redirect URI（加到你的 Spotify 應用程式中）', spCopy: '複製', spCopied: '已複製', spConnectedAs: '已連接：{name}', spHelp: '如何設定', spConnect: '連接',
      spDisconnect: '中斷連接', spDenied: '未允許存取 Spotify。', spError: 'Spotify 沒有回應，請稍後再試。', spLoginAgain: 'Spotify 登入已過期：請重新連接。',
      spNotRegistered: '此帳戶不在你的 Spotify 應用程式中：請在 User Management 中新增。', spBusy: 'Spotify 要求稍候片刻。',
      upNext: '即將播放', playingNow: '正在播放', nothingNext: '接下來沒有歌曲', jump: '跳到這首',
      spWeb: '在此瀏覽器中播放', spWebHint: '此分頁會成為一台 Spotify 裝置並播放音樂。需要 Premium，並在你的 Spotify 應用程式中勾選 Web Playback SDK。', spWebStarting: '正在此瀏覽器中啟動播放器…',
      spWebReady: '就緒：{name} 已在你的 Spotify 裝置中。', spWebOther: '此瀏覽器中的另一個 CasaOS 分頁是該裝置。', spWebScope: '請重新連線（下方），以允許在此瀏覽器中播放。',
      spWebDrm: '此瀏覽器無法在這裡播放 Spotify：受保護內容（DRM）已關閉或不受支援。', spWebFailed: 'Spotify 未接受此瀏覽器作為裝置：需要 Premium，並在你的 Spotify 應用程式中勾選 Web Playback SDK。',
      spWebTap: '瀏覽器擋下了聲音：請按播放。', spThisBrowser: '此瀏覽器',
      jfServer: 'Jellyfin 位址', jfCode: '在 Jellyfin 中開啟你的個人資料 → Quick Connect，然後輸入此代碼：', jfQcOff: '此 Jellyfin 已關閉 Quick Connect：請在其控制台（一般）中開啟。',
      jfNoServer: '此位址上的 Jellyfin 沒有回應。CasaOS 透過 https:// 開啟時，Jellyfin 也需要 https:// 位址（參見 README）。', jfFavorite: '加入我的最愛', jfUnfavorite: '從我的最愛移除',
      jfFavorites: '我的最愛', jfAlbums: '專輯', jfArtists: '藝人', jfSearch: '搜尋你的音樂庫', jfOn: 'Jellyfin 上', jfNotConnected: '尚未連接 Jellyfin',
      jfSettings: 'Jellyfin 設定', jfError: 'Jellyfin 沒有回應，請稍後再試。', jfLoginAgain: 'Jellyfin 登入已被撤銷：請重新連接。',
      jfSongs: '所有歌曲'
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
    return v !== undefined ? v : TEXT.en[key] !== undefined ? TEXT.en[key] : key;
  }

  // "12 tracks" with the plural form of the language
  function trackCount(n) {
    var forms = t('tracks'), cat = 'other';
    try { cat = new Intl.PluralRules(lang()).select(n); } catch (e) { /* old browser: 'other' */ }
    return (forms[cat] || forms.other).replace('{n}', n);
  }

  var ICONS = {
    play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    next: '<path d="M6 6l8 6-8 6z" fill="currentColor" stroke="none"/><path d="M17 6v12"/>',
    prev: '<path d="M18 6l-8 6 8 6z" fill="currentColor" stroke="none"/><path d="M7 6v12"/>',
    shuffle: '<path d="M4 7h3.5c2 0 3 1 4.2 2.6l2.6 3.8c1.1 1.6 2.2 2.6 4.2 2.6H20"/><path d="M4 17h3.5c1.4 0 2.3-.5 3.1-1.4M13.4 8.4C14.2 7.5 15.1 7 16.5 7H20"/><path d="M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>',
    repeat: '<path d="M5 11V9a3 3 0 013-3h11"/><path d="M16.5 3.5L19 6l-2.5 2.5"/><path d="M19 13v2a3 3 0 01-3 3H5"/><path d="M7.5 20.5L5 18l2.5-2.5"/>',
    one: '<path d="M11.2 10.4l1.3-.9v5"/>',
    volume: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6M17.8 6.8a7 7 0 010 10.4"/>',
    mute: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    folder: '<path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v7.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r=".6" fill="currentColor"/><circle cx="4.5" cy="12" r=".6" fill="currentColor"/><circle cx="4.5" cy="17" r=".6" fill="currentColor"/>',
    up: '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',
    queue: '<path d="M4 7h11M4 12h11M4 17h7"/><path d="M18 14v6M15 17h6"/>',
    note: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.3 9.6c3.1-1 6.6-.8 9.4.8M7.8 12.7c2.6-.7 5.3-.5 7.6.8M8.4 15.5c2-.5 4-.3 5.7.6"/>',
    jellyfin: '<path d="M12 3.8c-1.2 0-8.9 13.7-8.3 14.8.6 1.1 16 1.1 16.6 0 .6-1.1-7.1-14.8-8.3-14.8z"/><path d="M12 9.6c-.6 0-3.9 5.8-3.6 6.3.3.5 6.9.5 7.2 0 .3-.5-3-6.3-3.6-6.3z" fill="currentColor" stroke="none"/>',
    disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/>',
    person: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>',
    device: '<rect x="3.5" y="5" width="17" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
    gear: '<path d="M9.75 5.48L10.21 2.77L13.79 2.77L14.25 5.48A6.9 6.9 0 0 1 16.53 6.79L19.09 5.83L20.89 8.94L18.77 10.68A6.9 6.9 0 0 1 18.77 13.32L20.89 15.06L19.09 18.17L16.53 17.21A6.9 6.9 0 0 1 14.25 18.52L13.79 21.23L10.21 21.23L9.75 18.52A6.9 6.9 0 0 1 7.47 17.21L4.91 18.17L3.11 15.06L5.23 13.32A6.9 6.9 0 0 1 5.23 10.68L3.11 8.94L4.91 5.83L7.47 6.79A6.9 6.9 0 0 1 9.75 5.48z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M12 19.5s-7-4.3-7-9.6A4 4 0 0112 7.3a4 4 0 017 2.6c0 5.3-7 9.6-7 9.6z"/>',
    back: '<path d="M14.5 18l-6-6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    upnext: '<path d="M4 7h10M4 12h10M4 17h6"/><path d="M15.5 14.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  var saved = loadState();
  var state = {
    folder: saved.folder || DEFAULT_FOLDER,
    recursive: saved.recursive !== false,
    volume: typeof saved.volume === 'number' ? saved.volume : 0.8,
    muted: !!saved.muted,
    shuffle: !!saved.shuffle,
    repeat: saved.repeat || 'all',            // all | one | off
    current: saved.current || null,           // path of the current track
    time: saved.time || 0,
    tracks: [], order: [], index: -1,
    queue: [],                                // indexes of tracks to play next, in order
    context: -1,                              // while the queue plays: where the playlist goes on from
    search: '',
    loading: false, message: '',
    showList: false, showFolder: false, browsePath: '',
    source: saved.source === 'spotify' || saved.source === 'jellyfin' ? saved.source : 'local',   // local files, Spotify or Jellyfin
    web: !!saved.web,                         // Spotify plays in this browser too (a Spotify device)
    webVolume: typeof saved.webVolume === 'number' ? saved.webVolume : 0.8,
    showDevices: false, showSettings: false, showNext: false
  };
  // The saved queue (paths) waits for the folder to be read
  var pendingQueue = Array.isArray(saved.queue) ? saved.queue : null;
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        folder: state.folder, recursive: state.recursive, volume: state.volume, muted: state.muted,
        shuffle: state.shuffle, repeat: state.repeat, current: state.current, source: state.source,
        web: state.web, webVolume: state.webVolume, jf: jfSaved(),
        time: Math.floor(audio.currentTime || 0),
        queue: pendingQueue || state.queue.map(function (i) { return state.tracks[i] && state.tracks[i].path; }).filter(Boolean)
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  var audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = state.volume;
  audio.muted = state.muted;

  // ---------------------------------------------------------------------------
  // CasaOS API
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

  function fileUrl(path) {
    return '/v1/file?path=' + encodeURIComponent(path) + '&token=' + encodeURIComponent(token());
  }

  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  function byName(a, b) { return collator.compare(a.name, b.name); }

  function pretty(name) {
    return name.replace(AUDIO_EXT, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function fold(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function parentName(path) {
    var parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : '';
  }

  // ---------------------------------------------------------------------------
  // Tags and covers: title, artist, album and picture from the file itself
  // (ID3v2 in MP3/AAC, FLAC and Ogg/Opus comments, MP4/M4A atoms), read with
  // HTTP ranges, only what is needed; else a cover image of the track's folder.
  // Only for the track that plays and the next one, cached.
  // ---------------------------------------------------------------------------
  var COVER_FILE = /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i;
  var TAG_LIMIT = 4 * 1024 * 1024;

  function latin1(b) { var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  function decode(b, enc) {
    try { return new TextDecoder(enc).decode(b); } catch (e) { return latin1(b); }
  }
  function be32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function le32(b, o) { return (b[o] | b[o + 1] << 8 | b[o + 2] << 16) + ((b[o + 3] << 24) >>> 0); }
  function syncsafe(b, o) { return (b[o] & 127) << 21 | (b[o + 1] & 127) << 14 | (b[o + 2] & 127) << 7 | (b[o + 3] & 127); }
  function imageType(b) {
    if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp';
    if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
    return 'image/jpeg';
  }

  // ID3v2.2/2.3/2.4
  function readId3(b) {
    var ver = b[3], flags = b[5], end = Math.min(b.length, 10 + syncsafe(b, 6)), out = {};
    var d = b.subarray(10, end);
    if (flags & 0x80 && ver < 4) d = unsync(d);
    var o = 0;
    if (flags & 0x40) o = ver === 3 ? 4 + be32(d, 0) : ver === 4 ? syncsafe(d, 0) : 0;
    var idLen = ver === 2 ? 3 : 4, head = ver === 2 ? 6 : 10, pic = null;
    while (o + head <= d.length) {
      var id = latin1(d.subarray(o, o + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break;   // padding
      var size = ver === 2 ? d[o + 3] << 16 | d[o + 4] << 8 | d[o + 5] : ver === 4 ? syncsafe(d, o + 4) : be32(d, o + 4);
      var fflags = ver === 2 ? 0 : d[o + 9];
      var f = d.subarray(o + head, Math.min(d.length, o + head + size));
      o += head + size;
      if (ver === 4) {
        if (fflags & 0x02) f = unsync(f);
        if (fflags & 0x01) f = f.subarray(4);
      }
      if (!f.length) continue;
      var key = { TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album', TPE2: 'albumArtist', TP2: 'albumArtist' }[id];
      if (key) {
        if (!out[key]) out[key] = id3Text(f);
      } else if (id === 'APIC' || id === 'PIC') {
        var p = id3Picture(f, id === 'PIC');
        if (p && (!pic || (p.kind === 3 && pic.kind !== 3))) pic = p;
      }
    }
    if (pic) out.picture = { mime: pic.mime, data: pic.data };
    return out;
  }

  function unsync(b) {
    var out = new Uint8Array(b.length), n = 0;
    for (var i = 0; i < b.length; i++) {
      out[n++] = b[i];
      if (b[i] === 0xff && b[i + 1] === 0) i++;
    }
    return out.subarray(0, n);
  }

  var ENCODINGS = ['iso-8859-1', 'utf-16le', 'utf-16be', 'utf-8'];
  function id3Text(f) {
    var enc = ENCODINGS[f[0]] || 'iso-8859-1';
    if (f[0] === 1 && f[1] === 0xfe && f[2] === 0xff) enc = 'utf-16be';   // the byte order mark says
    var s = decode(f.subarray(1), enc).replace(/^\ufeff/, '');
    return s.split('\u0000').filter(Boolean)[0] || '';   // 2.4: several values, the first
  }

  // the end of a text in the given ID3 encoding (1 or 2 zero bytes)
  function textEnd(f, o, enc) {
    if (enc === 1 || enc === 2) {
      while (o + 1 < f.length && (f[o] || f[o + 1])) o += 2;
      return o + 2;
    }
    while (o < f.length && f[o]) o++;
    return o + 1;
  }

  function id3Picture(f, v22) {
    var enc = f[0], o = 1, mime;
    if (v22) {
      mime = 'image/' + latin1(f.subarray(1, 4)).toLowerCase().replace('jpg', 'jpeg');
      o = 4;
    } else {
      var e = textEnd(f, o, 0);
      mime = latin1(f.subarray(o, e - 1)).toLowerCase();
      o = e;
    }
    var kind = f[o++];
    o = textEnd(f, o, enc);
    var data = f.subarray(o);
    if (!data.length) return null;
    if (!/^image\//.test(mime)) mime = imageType(data);
    return { kind: kind, mime: mime, data: data };
  }

  // Vorbis comments (FLAC, Ogg Vorbis, Opus)
  function readComments(b, o, out) {
    o += 4 + le32(b, o);   // vendor
    var n = le32(b, o);
    o += 4;
    for (var i = 0; i < n && o + 4 <= b.length; i++) {
      var len = le32(b, o), c = decode(b.subarray(o + 4, o + 4 + len), 'utf-8');
      o += 4 + len;
      var eq = c.indexOf('=');
      if (eq < 0) continue;
      var k = c.slice(0, eq).toUpperCase(), v = c.slice(eq + 1);
      var key = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', ALBUMARTIST: 'albumArtist', 'ALBUM ARTIST': 'albumArtist' }[k];
      if (key) { if (!out[key]) out[key] = v; }
      else if (k === 'METADATA_BLOCK_PICTURE' && !out.picture) {
        try {
          var raw = atob(v), bytes = new Uint8Array(raw.length);
          for (var j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
          out.picture = flacPicture(bytes);
        } catch (e) { /* bad base64 */ }
      }
    }
    return out;
  }

  function flacPicture(b) {
    var o = 4, ml = be32(b, o);
    var mime = latin1(b.subarray(o + 4, o + 4 + ml));
    o += 4 + ml;
    o += 4 + be32(b, o);   // description
    o += 16;               // width, height, depth, colors
    var len = be32(b, o), data = b.subarray(o + 4, o + 4 + len);
    return data.length ? { mime: /^image\//.test(mime) ? mime : imageType(data), data: data } : null;
  }

  // FLAC metadata blocks; returns null while more bytes are needed
  function readFlac(b, out) {
    var o = 4;
    for (;;) {
      if (o + 4 > b.length) return null;
      var last = b[o] & 0x80, type = b[o] & 0x7f, len = b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3];
      if (o + 4 + len > b.length) return null;
      var blk = b.subarray(o + 4, o + 4 + len);
      if (type === 4) readComments(blk, 0, out);
      else if (type === 6 && !out.picture) out.picture = flacPicture(blk);
      o += 4 + len;
      if (last) return out;
    }
  }

  // Ogg: the second packet of the first stream holds the comments; null while
  // more bytes are needed
  function readOgg(b, out) {
    var o = 0, packets = [], cur = [], serial = null;
    while (o + 27 <= b.length && latin1(b.subarray(o, o + 4)) === 'OggS') {
      var segs = b[o + 26], sizes = b.subarray(o + 27, o + 27 + segs), p = o + 27 + segs;
      var ser = le32(b, o + 14);
      if (serial === null) serial = ser;
      for (var i = 0; i < segs; i++) {
        if (p + sizes[i] > b.length) return null;
        if (ser === serial) cur.push(b.subarray(p, p + sizes[i]));
        p += sizes[i];
        if (ser === serial && sizes[i] < 255) {
          packets.push(cur);
          cur = [];
          if (packets.length === 2) {
            var total = 0;
            packets[1].forEach(function (x) { total += x.length; });
            var pk = new Uint8Array(total), at = 0;
            packets[1].forEach(function (x) { pk.set(x, at); at += x.length; });
            var magic = latin1(pk.subarray(0, 8));
            if (magic === 'OpusTags') return readComments(pk, 8, out);
            if (pk[0] === 3 && magic.slice(1, 7) === 'vorbis') return readComments(pk, 7, out);
            return out;
          }
        }
      }
      o = p;
    }
    return null;
  }

  // MP4: moov > udta > meta > ilst
  function readMoov(b, out) {
    (function walk(s, e) {
      var o = s;
      while (o + 8 <= e) {
        var size = be32(b, o), type = latin1(b.subarray(o + 4, o + 8));
        if (size < 8 || o + size > e) size = e - o;
        if (type === 'moov' || type === 'udta' || type === 'ilst') walk(o + 8, o + size);
        else if (type === 'meta') walk(o + 12, o + size);
        else if (s > 0 && latin1(b.subarray(s - 4, s)) === 'ilst') item(type, o + 8, o + size);
        o += size;
      }
    })(0, b.length);
    function item(type, s, e) {
      if (s + 16 > e || latin1(b.subarray(s + 4, s + 8)) !== 'data') return;
      var kind = be32(b, s + 8) & 0xffffff, data = b.subarray(s + 16, Math.min(e, s + be32(b, s)));
      var key = { '©nam': 'title', '©ART': 'artist', '©alb': 'album', aART: 'albumArtist' }[type];
      if (key && !out[key]) out[key] = decode(data, 'utf-8');
      else if (type === 'covr' && !out.picture && data.length) {
        out.picture = { mime: kind === 14 ? 'image/png' : kind === 13 ? 'image/jpeg' : imageType(data), data: data };
      }
    }
    return out;
  }

  // Tags from the start of a file (for MP4, from its moov atom)
  function readTags(buffer) {
    var b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var magic = latin1(b.subarray(0, 4));
    if (magic.slice(0, 3) === 'ID3') return readId3(b);
    if (magic === 'fLaC') return readFlac(b, {});
    if (magic === 'OggS') return readOgg(b, {});
    if (magic === 'moov') return readMoov(b, {});
    if (latin1(b.subarray(4, 8)) === 'ftyp') {   // a whole MP4 file in memory
      for (var o = 0; o + 8 <= b.length;) {
        var size = be32(b, o);
        if (latin1(b.subarray(o + 4, o + 8)) === 'moov') return readMoov(b.subarray(o, o + size), {});
        if (size < 8) break;
        o += size;
      }
    }
    return {};
  }

  // Bytes start..end of a file (an HTTP range); never the whole file
  function range(path, start, end) {
    return fetch(fileUrl(path), { headers: { Range: 'bytes=' + start + '-' + end } }).then(function (r) {
      if (r.status !== 206) {
        if (r.body) r.body.cancel();
        throw new Error('no range support');
      }
      return r.arrayBuffer();
    }).then(function (ab) { return new Uint8Array(ab); });
  }

  function fetchTags(path) {
    return range(path, 0, 65535).then(function (b) {
      var magic = latin1(b.subarray(0, 4));
      if (magic.slice(0, 3) === 'ID3') {
        var need = 10 + syncsafe(b, 6);
        if (need <= b.length || need > TAG_LIMIT) return readId3(b);
        return range(path, 0, need - 1).then(readId3);
      }
      if (magic === 'fLaC' || magic === 'OggS') {
        var more = function (buf) {
          var r = readTags(buf);
          if (r || buf.length < 65536 || buf.length >= TAG_LIMIT) return r || {};
          return range(path, 0, Math.min(TAG_LIMIT, buf.length * 4) - 1).then(more);
        };
        return more(b);
      }
      if (latin1(b.subarray(4, 8)) === 'ftyp') return findMoov(path, b, 0);
      return {};
    });
  }

  // Walks the top-level MP4 atoms (with small reads) to the moov one, wherever it is
  function findMoov(path, head, o) {
    var hops = 0;
    function at(o) {
      if (++hops > 64) return Promise.resolve({});
      var get = o + 16 <= head.length ? Promise.resolve(head.subarray(o, o + 16)) : range(path, o, o + 15);
      return get.then(function (h) {
        if (h.length < 8) return {};
        var size = be32(h, 0), type = latin1(h.subarray(4, 8));
        if (size === 1) size = be32(h, 8) * 4294967296 + be32(h, 12);
        if (type === 'moov') {
          if (size > TAG_LIMIT * 2) return {};
          var body = o + size <= head.length ? Promise.resolve(head.subarray(o, o + size)) : range(path, o, o + size - 1);
          return body.then(function (b) { return readMoov(b, {}); });
        }
        if (size < 8) return {};
        return at(o + size);
      });
    }
    return at(o);
  }

  // path → Promise of { title, artist, album, albumArtist, cover }; the last 30
  var tagCache = new Map();
  function trackInfo(tr) {
    if (tagCache.has(tr.path)) {
      var hit = tagCache.get(tr.path);
      tagCache.delete(tr.path);
      tagCache.set(tr.path, hit);
      return hit;
    }
    var p = fetchTags(tr.path).catch(function () { return {}; }).then(function (t) {
      var info = { title: t.title || '', artist: t.artist || t.albumArtist || '', album: t.album || '', albumArtist: t.albumArtist || '' };
      if (t.picture) {
        info.cover = URL.createObjectURL(new Blob([t.picture.data], { type: t.picture.mime }));
        info.ownCover = true;
        info.coverType = t.picture.mime;
      } else if (tr.cover) {
        info.cover = fileUrl(tr.cover);
      }
      return info;
    });
    tagCache.set(tr.path, p);
    if (tagCache.size > 30) {
      var old = tagCache.keys().next().value;
      tagCache.get(old).then(function (i) { if (i.ownCover) URL.revokeObjectURL(i.cover); });
      tagCache.delete(old);
    }
    return p;
  }

  // The playing track's tags (and the next one's, ahead of time)
  function loadInfo(i) {
    var tr = state.tracks[i];
    if (!tr) return;
    trackInfo(tr).then(function (info) {
      tr.info = info;
      tr.key = fold([tr.title, tr.album, info.title, info.artist, info.album].join(' '));
      if (state.tracks[state.index] === tr) {
        updateSession();
        render();
      }
    });
  }

  function upNext() {
    if (state.queue.length) return state.queue[0];
    var pos = state.order.indexOf(state.context >= 0 ? state.context : state.index);
    return pos >= 0 ? state.order[(pos + 1) % state.order.length] : -1;
  }

  // ---------------------------------------------------------------------------
  // Library
  // ---------------------------------------------------------------------------
  var scanId = 0;
  function scan() {
    var id = ++scanId;
    if (!pendingQueue && state.queue.length) {
      pendingQueue = state.queue.map(function (i) { return state.tracks[i] && state.tracks[i].path; }).filter(Boolean);
    }
    state.queue = [];
    state.context = -1;
    state.loading = true;
    state.message = t('scanning');
    render();

    var found = [], queue = [{ path: state.folder, depth: 0 }], folders = 0, failed = false, covers = {};

    function walk() {
      if (id !== scanId) return Promise.resolve();
      if (!queue.length || found.length >= MAX_FILES || folders >= MAX_FOLDERS) return Promise.resolve();
      var item = queue.shift();
      folders++;
      return listFolder(item.path).then(function (entries) {
        entries.sort(byName).forEach(function (e) {
          if (!e || !e.name || e.name.charAt(0) === '.') return;
          if (!e.is_dir && COVER_FILE.test(e.name) && !covers[item.path]) covers[item.path] = e.path;
          if (e.is_dir) {
            if (state.recursive && item.depth < MAX_DEPTH) queue.push({ path: e.path, depth: item.depth + 1 });
          } else if (AUDIO_EXT.test(e.name) && found.length < MAX_FILES) {
            var title = pretty(e.name), album = parentName(e.path);
            found.push({ path: e.path, name: e.name, title: title, album: album, key: fold(title + ' ' + album), dir: item.path });
          }
        });
      }, function () {
        if (folders === 1) failed = true;
      }).then(walk);
    }

    walk().then(function () {
      if (id !== scanId) return;
      state.loading = false;
      found.forEach(function (tr) { tr.cover = covers[tr.dir] || null; });
      state.tracks = found;
      state.message = failed ? t('folderError') : found.length ? '' : t('empty');
      buildOrder();
      if (pendingQueue) {
        state.queue = pendingQueue.map(indexOfPath).filter(function (i, k, all) { return i >= 0 && all.indexOf(i) === k; });
        pendingQueue = null;
      }
      // Resume where it stopped, without autoplay
      var at = state.current ? indexOfPath(state.current) : -1;
      if (at >= 0 && state.index < 0) {
        state.index = at;
        audio.src = fileUrl(found[at].path);
        var resumeAt = state.time;
        audio.addEventListener('loadedmetadata', function once() {
          audio.removeEventListener('loadedmetadata', once);
          if (resumeAt > 0 && resumeAt < (audio.duration || 0) - 2) audio.currentTime = resumeAt;
        });
        updateSession();
        loadInfo(at);
      }
      render();
    });
  }

  function indexOfPath(path) {
    for (var i = 0; i < state.tracks.length; i++) if (state.tracks[i].path === path) return i;
    return -1;
  }

  // Playback order of n tracks: natural or shuffled (from first when shuffling)
  function playOrder(n, from) {
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    if (state.shuffle) {
      for (var j = n - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1)), tmp = order[j];
        order[j] = order[k];
        order[k] = tmp;
      }
      var pos = order.indexOf(from);
      if (pos > 0) { order.splice(pos, 1); order.unshift(from); }
    }
    return order;
  }
  function buildOrder() {
    state.order = playOrder(state.tracks.length, state.context >= 0 ? state.context : state.index);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------
  var errors = 0;

  // queued: the track comes from the queue, so the playlist later goes on from
  // where it was; a track picked directly leaves the queue
  function playIndex(i, queued) {
    var tr = state.tracks[i];
    if (!tr) return;
    if (!queued) state.context = -1;
    else if (state.context < 0) state.context = state.index;
    var q = state.queue.indexOf(i);
    if (q >= 0) state.queue.splice(q, 1);
    state.index = i;
    state.current = tr.path;
    audio.src = fileUrl(tr.path);
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: user presses play */ });
    updateSession();
    save();
    render();
    loadInfo(i);
    var nx = upNext();
    if (nx >= 0 && nx !== i) setTimeout(function () { if (state.tracks[nx]) trackInfo(state.tracks[nx]); }, 3000);
  }

  function togglePlay() {
    if (!state.tracks.length) return;
    if (state.index < 0) return state.queue.length ? playIndex(state.queue[0], true) : playIndex(state.order[0]);
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      audio.pause();
    }
  }

  function step(dir, auto) {
    if (!state.tracks.length) return;
    if (auto && state.repeat === 'one') {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    // The queue first, then the playlist from where it was
    if (dir > 0 && state.queue.length) return playIndex(state.queue[0], true);
    var pos = state.order.indexOf(state.context >= 0 ? state.context : state.index), n = state.order.length;
    var nextPos = pos + dir;
    if (nextPos >= n || nextPos < 0) {
      if (auto && state.repeat === 'off') { audio.pause(); render(); return; }
      if (dir > 0 && state.shuffle) buildOrder();
      nextPos = (nextPos + n) % n;
    }
    playIndex(state.order[nextPos]);
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    // From a queued track: back to where the playlist was
    if (state.context >= 0) return playIndex(state.context);
    step(-1, false);
  }

  function toggleQueue(i) {
    if (!state.tracks[i]) return;
    var q = state.queue.indexOf(i);
    if (q >= 0) state.queue.splice(q, 1);
    else state.queue.push(i);
    save();
    renderList();
    renderNext();
  }

  audio.addEventListener('ended', function () { step(1, true); });
  audio.addEventListener('playing', function () { errors = 0; render(); });
  audio.addEventListener('pause', render);
  audio.addEventListener('error', function () {
    if (state.index < 0 || !audio.src) return;
    state.message = t('loadError');
    render();
    if (++errors < 5) setTimeout(function () { step(1, true); }, 800);
  });

  var lastSave = 0;
  audio.addEventListener('timeupdate', function () {
    updateProgress();
    var now = Date.now();
    if (now - lastSave > 2000) { lastSave = now; save(); }
  });
  audio.addEventListener('loadedmetadata', updateProgress);
  window.addEventListener('pagehide', save);

  // Media keys, lock screen, browser media controls (in Spotify mode: what
  // plays on Spotify, for when the keys reach this tab)
  function updateSession() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    var ms = navigator.mediaSession, m;
    if (state.source === 'spotify') {
      var p = sp.playback;
      if (p && p.uri) {
        m = { title: p.title, artist: p.artist, album: p.album };
        if (p.cover) m.artwork = [{ src: p.cover, sizes: '300x300' }];
      }
      ms.metadata = m ? new MediaMetadata(m) : null;
      ms.playbackState = m ? (p.playing ? 'playing' : 'paused') : 'none';
      sessionPosition();
      return;
    }
    if (ms.setPositionState) try { ms.setPositionState(); } catch (e) { /* older browsers */ }
    if (state.source === 'jellyfin') {
      var j = jf.now;
      if (j) {
        m = { title: j.name, artist: j.artist, album: j.album };
        if (j.image) m.artwork = [{ src: jfImg(j.image, 512), sizes: '512x512' }];
      }
      ms.metadata = m ? new MediaMetadata(m) : null;
      return;
    }
    var tr = state.tracks[state.index];
    if (!tr) {
      ms.metadata = null;
      return;
    }
    var info = tr.info || {};
    m = { title: info.title || tr.title, artist: info.artist || tr.album, album: info.album || 'CasaOS' };
    if (info.cover) m.artwork = [info.coverType ? { src: info.cover, sizes: '512x512', type: info.coverType } : { src: info.cover, sizes: '512x512' }];
    ms.metadata = new MediaMetadata(m);
  }
  function updatePlaybackState() {
    if ('mediaSession' in navigator && state.source !== 'spotify') navigator.mediaSession.playbackState = player().paused ? 'paused' : 'playing';
  }
  // The audio element of the mode (local files or Jellyfin)
  function player() { return state.source === 'jellyfin' ? jfAudio : audio; }
  // Where the Spotify song is, for the browser's and the system's media
  // controls (the local file's comes from the audio element itself)
  function sessionPosition() {
    var ms = navigator.mediaSession, p = sp.playback;
    if (!ms || !ms.setPositionState || state.source !== 'spotify') return;
    try {
      if (p && p.uri && p.duration) ms.setPositionState({ duration: p.duration / 1000, position: Math.min(p.duration, position()) / 1000, playbackRate: 1 });
      else ms.setPositionState();
    } catch (e) { /* older browsers */ }
  }
  audio.addEventListener('play', updatePlaybackState);
  audio.addEventListener('pause', updatePlaybackState);
  if ('mediaSession' in navigator) {
    var ms = navigator.mediaSession;
    try {
      // (in Spotify mode, the keys that reach this tab go to Spotify; play and
      // pause both toggle there: the browser picks one from this tab's own
      // audio, which is paused while Spotify plays elsewhere)
      var jelly = function () { return state.source === 'jellyfin'; };
      ms.setActionHandler('play', function () { if (state.source === 'spotify') spToggle(); else if (jelly()) jfToggle(); else togglePlay(); });
      ms.setActionHandler('pause', function () { if (state.source === 'spotify') spToggle(); else player().pause(); });
      ms.setActionHandler('nexttrack', function () { if (state.source === 'spotify') spNext(); else if (jelly()) jfNext(false); else step(1, false); });
      ms.setActionHandler('previoustrack', function () { if (state.source === 'spotify') spPrev(); else if (jelly()) jfPrev(); else prev(); });
      ms.setActionHandler('seekto', function (d) {
        if (d.seekTime == null) return;
        if (state.source === 'spotify') spSeek(d.seekTime * 1000);
        else if (jelly()) jfSeek(d.seekTime);
        else audio.currentTime = d.seekTime;
      });
      // the 10 s buttons (the browser's own ones would move the paused local file)
      ['seekbackward', 'seekforward'].forEach(function (a) {
        ms.setActionHandler(a, function (d) {
          var by = ((d && d.seekOffset) || 10) * (a === 'seekbackward' ? -1 : 1);
          if (state.source === 'spotify') spSeek(position() + by * 1000);
          else if (jelly()) jfSeek(jfTime() + by);
          else if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + by));
        });
      });
    } catch (e) { /* older browsers */ }
  }

  // ---------------------------------------------------------------------------
  // Spotify: instead of the files, the widget can show and control your
  // Spotify account (the Spotify app plays on any of your devices; with
  // "Play in this browser" this tab is one of them, see the Web Playback SDK
  // section below). The login is Authorization Code + PKCE from this page,
  // with the Client ID of your own Spotify app: no server, no secret. Spotify
  // only sends the login back to an https:// address (or 127.0.0.1), so CasaOS
  // has to be opened over HTTPS (see the README: Tailscale). Controls need
  // Premium; a free account sees what plays, with an (i) saying why.
  // ---------------------------------------------------------------------------
  var AUTH = STORE + '-auth';
  var SP_API = 'https://api.spotify.com/v1';
  var SP_ACCOUNTS = 'https://accounts.spotify.com';
  // (the last three are the Web Playback SDK's: a login from before 1.2.0 lacks them)
  var SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing ' +
    'playlist-read-private playlist-read-collaborative user-library-read user-library-modify ' +
    'streaming user-read-email user-read-private';
  var HELP = 'https://github.com/UsuarioDeJava/CasaMODs/tree/main/casaos-music-player#spotify';

  // { clientId, access, refresh, expires, scope, user: {id, name}, at (when the login last changed),
  //   premium, checked, probedOn, likeApi, off: {feature: true} }
  function loadAuth() {
    var a;
    try { a = JSON.parse(localStorage.getItem(AUTH) || '{}') || {}; } catch (e) { a = {}; }
    if (!a.off || typeof a.off !== 'object') a.off = {};
    return a;
  }
  var auth = loadAuth();
  function saveAuth() {
    try { localStorage.setItem(AUTH, JSON.stringify(auth)); } catch (e) { /* storage blocked */ }
  }
  // Another tab renewed the login (Spotify replaces the refresh token each time)
  window.addEventListener('storage', function (e) {
    if (e.key !== AUTH) return;
    auth = loadAuth();
    if (!connected()) stopSpotify();
    webSync();
    render();
  });

  var sp = {
    playback: null,        // what plays (from GET /me/player), see setPlayback
    liked: null,           // the current track is in Liked Songs (null: unknown)
    probing: false,
    message: '', messageTimer: 0,
    devices: null, devicesLoading: false,
    playlists: null, playlistsLoading: false,
    open: null,            // the playlist (or Liked Songs) opened in the list
    rows: [],              // the list's rows, by the data-i of their buttons
    results: [], resultsFor: '',
    queued: {},            // tracks sent to the Spotify queue (by uri)
    info: false,           // the (i) explanation shown
    lastVolume: 50
  };

  function connected() { return !!auth.refresh; }
  function secure() { return location.protocol === 'https:' || /^(127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
  function redirectUri() { return location.origin + '/'; }

  function spError(status, reason, detail) {
    var e = new Error('Spotify ' + status + ' ' + (reason || detail || ''));
    e.status = status;
    e.reason = reason || '';
    e.detail = detail || '';
    return e;
  }

  function b64url(bytes) {
    var s = '';
    bytes = new Uint8Array(bytes);
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function randomString(n) {
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b64url(b).slice(0, n);
  }

  // To Spotify's login page; it comes back to this page with ?code=…&state=…
  function connect(clientId) {
    clientId = String(clientId || '').trim();
    if (!clientId || !secure() || !window.crypto || !crypto.subtle) return;
    auth.clientId = clientId;
    saveAuth();
    var verifier = randomString(64), st = randomString(16);
    try {
      sessionStorage.setItem(AUTH + '-pkce', JSON.stringify({ v: verifier, s: st, c: clientId }));
    } catch (e) {
      return;
    }
    var again = connected();   // connecting again (for the player's new scopes): Spotify asks, not skips
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (hash) {
      var q = {
        response_type: 'code', client_id: clientId, scope: SCOPES, redirect_uri: redirectUri(), state: st,
        code_challenge_method: 'S256', code_challenge: b64url(hash)
      };
      if (again) q.show_dialog = 'true';
      location.assign(SP_ACCOUNTS + '/authorize?' + new URLSearchParams(q).toString());
    });
  }

  function tokenRequest(params) {
    return fetch(SP_ACCOUNTS + '/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw spError(r.status, j.error || '', j.error_description || '');
        return j;
      });
    });
  }

  function keepTokens(j) {
    auth.access = j.access_token;
    auth.expires = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    if (j.refresh_token) auth.refresh = j.refresh_token;
    if (j.scope) auth.scope = j.scope;   // what the login allows (the player needs "streaming")
    auth.at = Date.now();
    saveAuth();
    sharedWrite();   // the other browsers get it from the server
  }

  // Back from Spotify's login page (only the login this page started)
  function finishLogin() {
    var q = new URLSearchParams(location.search);
    if (!q.get('state') || !(q.get('code') || q.get('error'))) return;
    var pk = null;
    try { pk = JSON.parse(sessionStorage.getItem(AUTH + '-pkce') || 'null'); } catch (e) { /* none */ }
    if (!pk || pk.s !== q.get('state')) return;
    sessionStorage.removeItem(AUTH + '-pkce');
    history.replaceState(history.state, '', location.pathname + location.hash);
    state.source = 'spotify';
    state.showSettings = true;
    save();
    if (q.get('error')) {
      say(t('spDenied'), true);
      return;
    }
    tokenRequest({
      grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), client_id: pk.c, code_verifier: pk.v
    }).then(function (j) {
      auth = { clientId: pk.c, off: {} };
      keepTokens(j);
      state.showSettings = false;
      web.failed = '';
      say('');
      loadMe();
      poll();
      webSync();
    }, function (e) {
      console.warn(TAG, 'Spotify login:', e.message);
      say(t('spError'), true);
    });
  }

  // A valid access token, renewed 1 to 4 minutes before it ends (once, for
  // every caller; browsers sharing the login don't all renew at once, and the
  // later ones find the new one on the server). not: a token that won't do
  // (the player never takes the same twice)
  var refreshing = null, LEAD = 60000 + Math.round(Math.random() * 180000);
  function valid(a, not) { return !!(a.access && a.access !== not && Date.now() < a.expires - LEAD); }
  function fresh(not) {
    if (valid(auth, not)) return Promise.resolve(auth.access);
    var stored = loadAuth();   // another tab may have renewed it already
    if (stored.refresh && valid(stored, not)) {
      auth = stored;
      return Promise.resolve(auth.access);
    }
    if (stored.refresh && stored.refresh !== auth.refresh) auth = stored;   // its newer refresh token
    if (!refreshing) {
      // another browser may have renewed it: the login on the server first
      refreshing = sharedPull(true).then(function (changed) {
        if (changed && !connected()) loggedOut();   // disconnected in another browser
        if (valid(auth, not)) return auth.access;
        if (!auth.refresh) throw spError(401, 'LOGIN');
        return renew(not, true);
      }).then(function (tok) {
        refreshing = null;
        return tok;
      }, function (e) {
        refreshing = null;
        throw e;
      });
    }
    return refreshing;
  }

  function renew(not, again) {
    var used = auth.refresh;
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: used, client_id: auth.clientId }).then(function (j) {
      keepTokens(j);
      return auth.access;
    }, function (e) {
      // Another tab or browser renewed it at the same time (the old refresh
      // token is spent): a moment for it to save, then its login goes on
      return new Promise(function (done) { setTimeout(done, again ? 2500 : 0); }).then(function () {
        return sharedPull(true);
      }).then(function () {
        var now = loadAuth();
        if (now.refresh && now.refresh !== used && now.refresh !== auth.refresh && (now.at || 0) >= (auth.at || 0)) auth = now;
        if (auth.refresh && auth.refresh !== used) {
          if (valid(auth, not)) return auth.access;
          if (again) return renew(not, false);
        }
        // The login was revoked or expired for good: connect again
        if (e.status === 400 || e.status === 401) {
          forget();
          say(t('spLoginAgain'), true);
        }
        throw spError(401, 'LOGIN');
      });
    });
  }

  // Disconnect: the login is forgotten, here and on the server (the Client ID stays)
  function forget() {
    auth = { clientId: auth.clientId, off: {}, at: Date.now() };
    saveAuth();
    sharedWrite();
    loggedOut();
  }

  function loggedOut() {
    sp.playback = sp.playlists = sp.open = sp.devices = sp.liked = null;
    sp.queued = {};
    stopSpotify();
    web.failed = '';
    webSync();
    publish();
    updateSession();
    render();
  }

  // ---------------------------------------------------------------------------
  // The login is kept on the CasaOS server too, so every browser logged in to
  // CasaOS has it (one Spotify login for all of them, at any CasaOS address).
  // It lives outside CasaMOD's mod folder, which is public (served at /mod/
  // without a login), and goes through CasaOS's file API, which needs the
  // CasaOS login. "at" says which login is newer: a renewal or a Disconnect
  // in one browser reaches the others.
  // ---------------------------------------------------------------------------
  var SHARED_DIR = '/DATA/AppData/casamod/data';
  var SHARED = SHARED_DIR + '/music-player-spotify.json';
  var SHARED_KEYS = ['clientId', 'access', 'refresh', 'expires', 'scope', 'user', 'at'];
  var made = {}, sharedQueue = Promise.resolve();   // made: the file exists (by path)

  function casa(method, path, body) {
    var init = { method: method, headers: { Authorization: token(), Accept: 'application/json' }, credentials: 'include' };
    if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(path, init).then(function (r) {
      return r.json().then(null, function () { return null; }).then(function (j) { return (j && j.success) || r.status; });
    });
  }

  // The server's login (Spotify's, or file's): an object, null (none saved
  // yet), or a rejection (it couldn't be asked)
  function sharedRead(file) {
    if (!token()) return Promise.reject(new Error('not logged in to CasaOS'));
    return fetch('/v1/file/content?path=' + encodeURIComponent(file || SHARED), {
      headers: { Authorization: token(), Accept: 'application/json' }, credentials: 'include'
    }).then(function (r) {
      return r.json().then(function (j) {
        if (j && j.success === 200) {
          var v = null;
          try { v = JSON.parse(j.data || 'null'); } catch (e) { /* not ours */ }
          return v && typeof v === 'object' ? v : null;
        }
        if (j && j.success === 60001) return null;   // the file doesn't exist yet
        throw new Error('CasaOS ' + r.status);
      });
    });
  }

  // Saves a login on the server (one write at a time, the latest wins)
  function sharedSave(file, data) {
    var text = JSON.stringify(data);
    var put = function () { return casa('PUT', '/v1/file', { path: file, content: text }); };
    var make = function () {   // the folder and the file, then its content
      return casa('POST', '/v1/folder', { path: SHARED_DIR }).then(function () {
        return casa('POST', '/v1/file', { path: file });
      }).then(put);
    };
    sharedQueue = sharedQueue.then(function () {
      if (!token()) return;
      return (made[file] ? put() : make()).then(function (code) {
        return code === 200 || !made[file] ? code : make();   // the file went away: again
      }).then(function (code) {
        made[file] = code === 200;
        if (!made[file]) console.warn(TAG, 'the login could not be saved on CasaOS:', code);
      });
    }).then(null, function (e) { console.warn(TAG, 'the login could not be saved on CasaOS:', e.message); });
    return sharedQueue;
  }
  // This browser's Spotify login, on the server
  function sharedWrite() {
    var data = {};
    SHARED_KEYS.forEach(function (k) { if (auth[k] != null) data[k] = auth[k]; });
    return sharedSave(SHARED, data);
  }

  // A newer login from the server replaces this one (another browser's login,
  // renewal or Disconnect); true if it did
  function adopt(v) {
    if (!v || (v.at || 0) <= (auth.at || 0)) return false;
    var same = v.refresh && auth.user && v.user && auth.user.id === v.user.id;
    if (!same) auth = { clientId: auth.clientId, off: {} };   // another account (or none): learned again
    SHARED_KEYS.forEach(function (k) {
      if (v[k] != null) auth[k] = v[k];
      else if (k !== 'clientId') delete auth[k];
    });
    saveAuth();
    return true;
  }

  // Reads the server's login: a newer one is taken; this browser's, when newer
  // (or the server has none), is saved there unless keep. true: the login changed
  function sharedPull(keep) {
    return sharedRead().then(function (v) {
      made[SHARED] = made[SHARED] || !!v;
      if (adopt(v)) return true;
      if (!keep && connected() && (!v || (v.at || 0) < (auth.at || 0) || !auth.at)) {
        if (!auth.at) {   // a login from before 1.3.0: from now on, everyone's
          auth.at = Date.now();
          saveAuth();
        }
        sharedWrite();
      }
      return false;
    }, function () { return false; });
  }

  // After the server's login came in: connected, or not anymore
  function sharedChanged(changed) {
    if (!changed) return;
    if (!connected()) return loggedOut();
    if (state.source === 'spotify') {
      if (!auth.user) loadMe();
      poll();
    }
    webSync();
    render();
  }

  // Not connected here: a login made in another browser may be there now
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && root && !connected()) sharedPull().then(sharedChanged);
  });

  // The Web API: JSON in and out; a 401 renews the login once; after a 429
  // nothing is asked until Spotify's Retry-After has passed
  var waitUntil = 0;
  function api(method, path, body, again) {
    if (Date.now() < waitUntil) return Promise.reject(spError(429, 'RATE_LIMITED'));
    return fresh().then(function (tok) {
      var init = { method: method, headers: { Authorization: 'Bearer ' + tok } };
      if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      return fetch(/^https:/.test(path) ? path : SP_API + path, init);
    }).then(function (r) {
      if (r.status === 401 && !again) {
        auth.expires = 0;
        saveAuth();
        return api(method, path, body, true);
      }
      if (r.status === 429) waitUntil = Date.now() + (Number(r.headers.get('Retry-After')) || 3) * 1000;
      return r.text().then(function (txt) {
        var j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* a plain text body */ }
        if (!r.ok) {
          var er = j && j.error;
          throw spError(r.status, (er && er.reason) || '', (er && er.message) || (typeof er === 'string' ? er : ''));
        }
        return j;
      });
    });
  }

  // A feature Spotify refuses to this app (new apps get fewer endpoints) is
  // hidden from then on; nothing else stops working
  function refused(name, e) {
    if (!e || e.status !== 403 || e.reason === 'PREMIUM_REQUIRED' || /regist/i.test(e.detail)) return false;
    auth.off[name] = true;
    saveAuth();
    console.info(TAG, 'Spotify refuses "' + name + '" to this app:', e.detail || e.reason);
    render();
    return true;
  }

  function say(text, sticky) {
    clearTimeout(sp.messageTimer);
    sp.message = text;
    if (text && !sticky) sp.messageTimer = setTimeout(function () { sp.message = ''; render(); }, 6000);
    render();
  }

  // What went wrong, in plain words
  function trouble(e) {
    if (!e) return;
    if (e.reason === 'PREMIUM_REQUIRED') return setPremium(false);
    if (e.reason === 'NO_ACTIVE_DEVICE' || (e.status === 404 && /device/i.test(e.detail))) {
      say(t('spNoDevice'));
      return openDevices();
    }
    if (e.reason === 'LOGIN') return render();
    if (/regist/i.test(e.detail)) return say(t('spNotRegistered'), true);
    if (e.status === 429) return say(t('spBusy'));
    console.warn(TAG, e.message);
    say(t('spError'));
  }

  function setPremium(v) {
    if (auth.premium !== v) {
      auth.premium = v;
      if (v) sp.info = false;
    }
    auth.checked = Date.now();
    saveAuth();
    webSync();
    render();
  }

  // Free or Premium? Spotify no longer tells apps like this one, so a command
  // that changes nothing (repeat set to what it already is) asks: a free
  // account gets PREMIUM_REQUIRED. Asked again on another device and after 6 hours.
  function probe() {
    var p = sp.playback;
    if (!p || !p.device || sp.probing) return;
    // known: again after 6 hours or on another device; unknown (the device
    // refused the command): again after a minute
    var wait = auth.premium == null ? 60e3 : 6 * 3600e3;
    if (auth.probedOn === p.device.id && Date.now() - (auth.checked || 0) < wait) return;
    sp.probing = true;
    auth.probedOn = p.device.id;
    auth.checked = Date.now();
    saveAuth();
    api('PUT', '/me/player/repeat?state=' + p.repeat).then(function () {
      setPremium(true);
    }, function (e) {
      if (e.reason === 'PREMIUM_REQUIRED') setPremium(false);
    }).then(function () { sp.probing = false; });
  }

  function loadMe() {
    return api('GET', '/me').then(function (j) {
      auth.user = { id: j.id, name: j.display_name || j.id };
      if (j.product) auth.premium = j.product === 'premium';   // when Spotify still says
      saveAuth();
      render();
    }, trouble);
  }

  // The image closest above 200 px (album covers come as 640, 300 and 64)
  function bestImage(images) {
    if (!images || !images.length) return '';
    var pick = images[0];
    for (var i = 0; i < images.length; i++) {
      var w = images[i].width || 0;
      if (w >= 200 && w < (pick.width || Infinity)) pick = images[i];
    }
    return pick.url || '';
  }

  function artistsOf(it) {
    return (it.artists || []).map(function (a) { return a.name; }).join(', ') || (it.show ? it.show.name : '');
  }

  function setPlayback(j) {
    var before = sp.playback, it = j && j.item;
    sp.playback = j ? {
      playing: !!j.is_playing,
      position: j.progress_ms || 0,
      at: Date.now(),
      duration: it ? it.duration_ms || 0 : 0,
      uri: it ? it.uri : '',
      title: it ? it.name || '' : '',
      artist: it ? artistsOf(it) : '',
      album: it && it.album ? it.album.name : '',
      cover: it ? bestImage((it.album && it.album.images) || it.images || (it.show && it.show.images)) : '',
      context: j.context ? j.context.uri : '',
      shuffle: !!j.shuffle_state,
      repeat: j.repeat_state || 'off',
      device: j.device ? {
        id: j.device.id, name: j.device.name || '', volume: j.device.volume_percent,
        volumeOk: j.device.supports_volume !== false && j.device.volume_percent != null
      } : null
    } : null;
    var p = sp.playback;
    if (p && p.device && p.device.volume > 0) sp.lastVolume = p.device.volume;
    if ((p && p.uri) !== (before && before.uri)) {
      sp.liked = null;
      checkLiked();
      if (state.showNext && state.source === 'spotify') loadNext();
    }
    if ((p && p.uri) !== (before && before.uri) || (p && p.playing) !== (before && before.playing)) updateSession();
    else sessionPosition();
    if (p && p.device) probe();
    tick();
    render();
    publish();
  }

  // Where the song is now (it goes on between two readings)
  function position() {
    var p = sp.playback;
    if (!p) return 0;
    return p.playing ? Math.min(p.duration || Infinity, p.position + Date.now() - p.at) : p.position;
  }

  // Reading what plays: every 3 s while playing, 10 s paused, right after a
  // command and when the song ends; nothing in local mode or with the tab
  // hidden. While it plays in this browser, its player says what plays: only
  // every 30 s, for a move to another device or the volume set elsewhere.
  var pollTimer = 0, tickTimer = 0;
  function live() { return state.source === 'spotify' && connected() && !document.hidden; }

  function later(ms) {
    clearTimeout(pollTimer);
    if (live()) pollTimer = setTimeout(poll, Math.max(250, ms));
  }

  function poll() {
    clearTimeout(pollTimer);
    if (!live()) return;
    api('GET', '/me/player?additional_types=episode').then(function (j) {
      if (web.active && j && j.device && j.device.id === web.id) {
        var v = j.device.volume_percent, p = sp.playback;
        if (v != null && p && p.device && p.device.volume !== v) {
          p.device.volume = v;
          state.webVolume = v / 100;
          if (v > 0) sp.lastVolume = v;
          save();
          render();
        }
        return later(30000);
      }
      // (the Web API can lag a moment behind the player that just started here)
      if (web.active && Date.now() - web.seen < 5000) return later(3000);
      web.active = false;   // it moved to another device, or stopped
      setPlayback(j);
      var p = sp.playback, next = p && p.playing ? 3000 : 10000;
      if (p && p.playing && p.duration) next = Math.min(next, p.duration - position() + 300);
      later(next);
    }, function (e) {
      if (e.reason === 'LOGIN') return render();
      if (/regist/i.test(e.detail)) say(t('spNotRegistered'), true);
      else console.warn(TAG, e.message);
      later(e.status === 429 ? waitUntil - Date.now() + 100 : 15000);
    });
  }

  // The progress moves on its own between readings (only while playing and seen)
  function tick() {
    var on = live() && sp.playback && sp.playback.playing;
    if (on && !tickTimer) tickTimer = setInterval(function () { updateProgress(); publish(); }, 500);
    else if (!on && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = 0;
    }
  }

  function stopSpotify() {
    clearTimeout(pollTimer);
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = 0;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (live()) poll();
    else stopSpotify();
  });

  // What plays on Spotify, for other mods (an animated wallpaper with synced
  // lyrics, for example): a 'casamods:nowplaying' event on window
  var published = false;
  function publish() {
    var p = sp.playback, on = !!(state.source === 'spotify' && p && p.uri);
    if (!on && !published) return;
    published = on;
    var d = on ? {
      source: 'spotify', title: p.title, artist: p.artist, album: p.album, cover: p.cover, playing: p.playing,
      position: position() / 1000, duration: p.duration / 1000, at: Date.now()
    } : { source: 'spotify', title: '', playing: false };
    try { window.dispatchEvent(new CustomEvent('casamods:nowplaying', { detail: d })); } catch (e) { /* old browser */ }
  }

  // A command, shown at once (then read back from Spotify); undo() if it fails
  function command(method, path, body, show, undo) {
    if (auth.premium === false) {
      sp.info = true;
      render();
      return;
    }
    if (show) {
      show();
      render();
    }
    api(method, path, body).then(function () {
      if (auth.premium !== true) setPremium(true);
      later(400);
    }, function (e) {
      if (undo) undo();
      trouble(e);
      later(400);
    });
  }

  function spToggle() {
    var p = sp.playback;
    // nothing plays anywhere: here, when this browser is a device
    if (!p || !p.device) return web.ready ? playHere() : openDevices();
    var show = function () {
      p.position = position();
      p.at = Date.now();
      p.playing = !p.playing;
      tick();
      updateSession();
    };
    if (web.active) {
      // paused here for long: the player may have gone quiet, so the music is moved here again
      if (!p.playing && Date.now() - web.seen > 600000) return playHere(true);
      show();
      render();
      return webDo(p.playing ? 'resume' : 'pause');
    }
    command('PUT', p.playing ? '/me/player/pause' : '/me/player/play', undefined, show);
  }

  function spSeek(ms) {
    var p = sp.playback;
    if (!p) return;
    ms = Math.max(0, Math.round(ms));
    var show = function () {
      p.position = ms;
      p.at = Date.now();
      sessionPosition();
    };
    if (web.active) {
      show();
      render();
      return webDo('seek', ms);
    }
    command('PUT', '/me/player/seek?position_ms=' + ms, undefined, show);
  }

  function spNext() {
    if (!sp.playback) return openDevices();
    if (web.active) return webDo('nextTrack');
    command('POST', '/me/player/next');
  }

  function spPrev() {
    if (!sp.playback) return openDevices();
    if (position() > 3000) return spSeek(0);
    if (web.active) return webDo('previousTrack');
    command('POST', '/me/player/previous');
  }

  function spShuffle() {
    var p = sp.playback;
    if (!p) return openDevices();
    var on = !p.shuffle;
    command('PUT', '/me/player/shuffle?state=' + on, undefined, function () { p.shuffle = on; });
  }

  // The same cycle as the local player: all (context) → one (track) → off
  var REPEAT_NEXT = { context: 'track', track: 'off', off: 'context' };
  function spRepeat() {
    var p = sp.playback;
    if (!p) return openDevices();
    var r = REPEAT_NEXT[p.repeat] || 'context';
    command('PUT', '/me/player/repeat?state=' + r, undefined, function () { p.repeat = r; });
  }

  var volumeTimer = 0;
  function spVolume(v) {
    var p = sp.playback;
    if (!p || !p.device || !p.device.volumeOk) return;
    v = Math.round(Math.max(0, Math.min(100, v)));
    p.device.volume = v;
    if (v > 0) sp.lastVolume = v;
    renderButtons();
    clearTimeout(volumeTimer);
    if (web.active) {
      state.webVolume = v / 100;
      webDo('setVolume', v / 100);
      volumeTimer = setTimeout(save, 500);
      return;
    }
    volumeTimer = setTimeout(function () { command('PUT', '/me/player/volume?volume_percent=' + v); }, 250);
  }

  function spMute() {
    var p = sp.playback;
    if (!p || !p.device || !p.device.volumeOk) return;
    spVolume(p.device.volume > 0 ? 0 : sp.lastVolume || 50);
    el.vol.value = p.device.volume;
  }

  // Liked Songs: the library routes of new apps (/me/library), else the older ones
  function isTrack(uri) { return /^spotify:track:/.test(uri || ''); }
  function likePath(uri, contains) {
    return auth.likeApi === 'tracks'
      ? (contains ? '/me/tracks/contains?ids=' : '/me/tracks?ids=') + uri.split(':')[2]
      : (contains ? '/me/library/contains?uris=' : '/me/library?uris=') + encodeURIComponent(uri);
  }

  function checkLiked() {
    var p = sp.playback;
    if (!p || !isTrack(p.uri) || auth.off.like) return;
    var uri = p.uri;
    api('GET', likePath(uri, true)).then(function (j) {
      if (!sp.playback || sp.playback.uri !== uri) return;
      sp.liked = !!(Array.isArray(j) && j[0]);
      render();
    }, function (e) {
      if ((e.status === 404 || e.status === 403) && auth.likeApi !== 'tracks' && !/regist/i.test(e.detail)) {
        auth.likeApi = 'tracks';
        saveAuth();
        return checkLiked();
      }
      refused('like', e);
    });
  }

  function toggleLike() {
    var p = sp.playback;
    if (!p || !isTrack(p.uri) || sp.liked == null) return;
    var on = !sp.liked, uri = p.uri;
    sp.liked = on;
    render();
    api(on ? 'PUT' : 'DELETE', likePath(uri, false)).then(null, function (e) {
      if (sp.playback && sp.playback.uri === uri) sp.liked = !on;
      if (!refused('like', e)) trouble(e);
      render();
    });
  }

  // Devices with Spotify open; one click moves the music there
  function openDevices() {
    state.showDevices = true;
    state.showList = state.showFolder = state.showSettings = state.showNext = false;
    loadDevices();
    render();
  }

  function loadDevices() {
    if (auth.off.devices || !connected()) return;
    sp.devicesLoading = true;
    api('GET', '/me/player/devices').then(function (j) {
      sp.devices = (j && j.devices) || [];
      sp.devicesLoading = false;
      render();
    }, function (e) {
      sp.devicesLoading = false;
      if (!refused('devices', e)) trouble(e);
      render();
    });
  }

  function useDevice(id) {
    var p = sp.playback;
    command('PUT', '/me/player', { device_ids: [id], play: !p || p.playing }, function () {
      state.showDevices = false;
      if (id !== web.id) {   // the player here goes quiet
        web.active = false;
        keep(false);
      }
    });
  }

  // The library: Liked Songs and your playlists, then a playlist's tracks
  function loadPlaylists() {
    if (sp.playlists || sp.playlistsLoading || auth.off.playlists || !connected()) return;
    sp.playlistsLoading = true;
    var all = [];
    (function page(url, n) {
      api('GET', url).then(function (j) {
        ((j && j.items) || []).forEach(function (pl) {
          if (!pl || !pl.id) return;
          all.push({
            kind: 'playlist', id: pl.id, uri: pl.uri, name: pl.name || '', image: bestImage(pl.images),
            count: ((pl.items || pl.tracks) || {}).total, key: fold(pl.name || '')
          });
        });
        sp.playlists = all.slice();
        if (j && j.next && n < 20) page(j.next, n + 1);
        else sp.playlistsLoading = false;
        renderList();
      }, function (e) {
        sp.playlistsLoading = false;
        sp.playlists = all;
        if (!refused('playlists', e)) trouble(e);
        renderList();
      });
    })('/me/playlists?limit=50', 1);
  }

  function trackRow(tr) {
    var artist = artistsOf(tr), album = tr.album ? tr.album.name : '';
    return { kind: 'track', uri: tr.uri, name: tr.name || '', artist: artist, local: !!tr.is_local, key: fold([tr.name, artist, album].join(' ')) };
  }

  function openList(item) {
    sp.open = {
      kind: item.kind, id: item.id, uri: item.uri, name: item.name, tracks: [], loading: false, failed: false,
      next: item.kind === 'liked' ? '/me/tracks?limit=50' : '/playlists/' + encodeURIComponent(item.id) + '/items?limit=50&additional_types=track,episode'
    };
    state.search = el.search.value = '';
    el.list.scrollTop = 0;
    more();
    render();
  }

  // The next page of the open list (while scrolling; all of it while searching)
  function more() {
    var o = sp.open;
    if (!o || o.loading || !o.next) return;
    o.loading = true;
    api('GET', o.next).then(function (j) {
      if (sp.open !== o) return;
      ((j && j.items) || []).forEach(function (row) {
        var tr = row && (row.item || row.track);
        if (tr && tr.uri) o.tracks.push(trackRow(tr));
      });
      o.next = (j && j.next) || null;
      o.loading = false;
      renderList();
      if (state.search && o.next && o.tracks.length < 2000) more();
    }, function (e) {
      if (sp.open !== o) return;
      o.loading = false;
      o.next = null;
      o.failed = true;
      // Spotify's own playlists can't be read by new apps: only that one fails
      if (o.kind !== 'liked' || !refused('liked', e)) console.warn(TAG, e.message);
      renderList();
    });
  }

  function playRow(r) {
    var o = sp.open;
    if (r.kind !== 'track' || r.local) return;
    if (o && o.kind === 'playlist') return command('PUT', '/me/player/play', { context_uri: o.uri, offset: { uri: r.uri } });
    if (o && o.kind === 'liked') return playLiked(r);
    command('PUT', '/me/player/play', { uris: [r.uri] });
  }

  // Liked Songs as a whole (the collection), else from this track on (100 at most)
  function playLiked(r) {
    var list = sp.open.tracks.filter(function (x) { return !x.local; }), i = Math.max(0, list.indexOf(r));
    var uris = { uris: list.slice(i, i + 100).map(function (x) { return x.uri; }) };
    if (!auth.user || !auth.user.id || auth.off.collection) return command('PUT', '/me/player/play', uris);
    if (auth.premium === false) {
      sp.info = true;
      return render();
    }
    api('PUT', '/me/player/play', { context_uri: 'spotify:user:' + auth.user.id + ':collection', offset: { uri: r.uri } }).then(function () {
      if (auth.premium !== true) setPremium(true);
      later(400);
    }, function (e) {
      var other = e.status === 400 || (e.status === 404 && e.reason !== 'NO_ACTIVE_DEVICE') ||
        (e.status === 403 && e.reason !== 'PREMIUM_REQUIRED' && !/regist/i.test(e.detail));
      if (!other) {
        trouble(e);
        return later(400);
      }
      auth.off.collection = true;
      saveAuth();
      command('PUT', '/me/player/play', uris);
    });
  }

  // To the Spotify queue (the API can't take a track out of it again)
  function queueRow(r) {
    if (r.kind !== 'track' || r.local || sp.queued[r.uri]) return;
    command('POST', '/me/player/queue?uri=' + encodeURIComponent(r.uri), undefined, function () {
      sp.queued[r.uri] = true;
    }, function () {
      delete sp.queued[r.uri];
    });
    if (state.showNext) setTimeout(loadNext, 900);
  }

  // Spotify's "Up next": what plays now and the next ones (what you queued,
  // then the playlist; Spotify gives about 20)
  function loadNext() {
    if (auth.off.queue || !connected()) return;
    sp.nextLoading = true;
    renderNext();
    api('GET', '/me/player/queue').then(function (j) {
      sp.next = {
        now: j && j.currently_playing && j.currently_playing.uri ? trackRow(j.currently_playing) : null,
        list: ((j && j.queue) || []).filter(function (x) { return x && x.uri; }).map(trackRow)
      };
      sp.nextLoading = false;
      renderNext();
    }, function (e) {
      sp.nextLoading = false;
      if (!refused('queue', e)) trouble(e);
      renderNext();
    });
  }

  // The API can't play from the queue: skipping to it, one track after the other
  function jumpTo(k) {
    if (auth.premium === false) {
      sp.info = true;
      return render();
    }
    if (sp.jumping) return;
    var left = Math.min(20, k + 1);
    sp.jumping = true;
    renderNext();
    (function step() {
      api('POST', '/me/player/next').then(function () {
        if (--left > 0) return setTimeout(step, 150);
        sp.jumping = false;
        later(300);
        setTimeout(loadNext, 700);
      }, function (e) {
        sp.jumping = false;
        trouble(e);
        later(300);
        renderNext();
      });
    })();
  }

  // The catalog, from the library's first level (Spotify gives 10 results at most)
  var searchTimer = 0;
  function searchSpotify() {
    clearTimeout(searchTimer);
    var q = state.search.trim();
    if (sp.open || q.length < 2 || auth.off.search || !connected()) {
      sp.results = [];
      sp.resultsFor = '';
      return;
    }
    if (q === sp.resultsFor) return;
    searchTimer = setTimeout(function () {
      api('GET', '/search?type=track&limit=10&q=' + encodeURIComponent(q)).then(function (j) {
        if (state.search.trim() !== q || sp.open) return;
        sp.resultsFor = q;
        sp.results = ((j && j.tracks && j.tracks.items) || []).filter(Boolean).map(trackRow);
        renderList();
      }, function (e) {
        if (!refused('search', e)) trouble(e);
      });
    }, 450);
  }

  // ---------------------------------------------------------------------------
  // Spotify in this browser (the Web Playback SDK): with "Play in this
  // browser" on, this tab is a Spotify device too ("CasaOS (Chrome)"), in
  // every Spotify app and in the devices list. Spotify's script plays in a
  // hidden iframe of its own, protected audio no analyser can hear (the
  // wallpapers still get what plays: casamods:nowplaying). It needs Premium,
  // the login's "streaming" scope and "Web Playback SDK" ticked in the
  // Spotify app. It loads only in Spotify mode with the switch on, and one tab
  // at a time is the device (the others wait for it: Web Locks). While the
  // music plays here, the player says what plays and takes the commands.
  // ---------------------------------------------------------------------------
  var SDK = 'https://sdk.scdn.co/spotify-player.js';
  var web = {
    player: null,          // the page's one Spotify.Player (a second one would never get ready)
    id: '',                // its device id
    on: false,             // wanted and started
    asked: false,          // waiting for the lock (another tab is the device)
    held: false, release: null,   // the lock, while this tab is the device
    ready: false,          // a Spotify device now
    active: false,         // the music plays here (the player has a state)
    seen: 0,               // the player's last word
    failed: '',            // drm | scope | account | auth | timeout | load (until switched off and on)
    given: '',             // the last token handed to the player
    playHere: null,        // once ready, move the music here (true: playing, false: paused)
    retried: false,        // reconnected for a device Spotify didn't find
    restarted: false,      // reconnected after a failed authentication
    timer: 0
  };
  var WEB_SAYS = { drm: 'spWebDrm', scope: 'spWebScope', account: 'spWebFailed', auth: 'spWebFailed', timeout: 'spWebFailed', load: 'spError' };
  var sdkLoading = null;

  // While the music plays here, the browser's and the system's media controls
  // (Chrome's media button, Windows' overlay) go to this page, which knows
  // where the song is, not to Spotify's frame (its own media session puts
  // milliseconds where seconds go: a 2-minute song shows as 40 hours, and
  // the progress bar skips it). A browser gives them to the topmost frame
  // with a player, so a silent one loops here meanwhile (paused with the music).
  var keeper = null;
  function keep(on) {
    if (!on) {
      if (keeper && !keeper.paused) keeper.pause();
      return;
    }
    if (!keeper) {
      // a quarter of a second of silence (8 kHz, 8 bits), as a WAV
      var n = 2000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
      var w = function (at, txt) { for (var i = 0; i < txt.length; i++) b[at + i] = txt.charCodeAt(i); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      w(36, 'data'); v.setUint32(40, n, true);
      for (var k = 44; k < b.length; k++) b[k] = 128;
      keeper = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
      keeper.loop = true;
    }
    if (keeper.paused) {
      var r;
      try { r = quietPlay(keeper); } catch (e) { r = keeper.play(); }
      if (r && r.catch) r.catch(function () { /* no click yet: Spotify's frame keeps the controls */ });
    }
  }
  // Started with a play() of its own (from a blank frame): other mods watch
  // what the page's play() starts, and Live Wallpapers would show this
  // silence as the song (0:00 of 0:00, over and over)
  var quietFrame = null;
  function quietPlay(el) {
    if (!quietFrame || !quietFrame.isConnected) {
      quietFrame = document.createElement('iframe');
      quietFrame.style.display = 'none';
      quietFrame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(quietFrame);
    }
    return quietFrame.contentWindow.HTMLMediaElement.prototype.play.call(el);
  }

  // Protected (EME) audio, over HTTPS
  function webSupported() { return secure() && !!navigator.requestMediaKeySystemAccess; }
  // Does the login allow it? (null: unknown, a login from before 1.2.0 until it's renewed)
  function webScope() { return auth.scope ? /(^|\s)streaming(\s|$)/.test(auth.scope) : null; }

  // The player starts or stops as the switch, the mode and the login say
  function webSync() {
    var want = state.web && state.source === 'spotify' && connected() && auth.premium !== false &&
      webSupported() && !web.failed && webScope() !== false;
    if (want && !web.on) webStart();
    else if (!want && web.on) webStop();
  }

  // The device's name in the Spotify apps
  function webName() {
    var ua = navigator.userAgent;
    var b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' :
      /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return b ? 'CasaOS (' + b + ')' : 'CasaOS';
  }

  function webStart() {
    web.on = true;
    if (web.held || !navigator.locks) webOpen();
    else if (!web.asked) {
      web.asked = true;
      try {
        navigator.locks.request(STORE + '-player', function () {
          web.asked = false;
          if (!web.on) return;   // stopped while waiting
          web.held = true;
          webOpen();
          render();
          return new Promise(function (done) { web.release = done; });
        }).then(null, function () { web.asked = false; });
      } catch (e) {
        web.asked = false;
        webOpen();
      }
    }
    render();
  }

  function webOpen() {
    // Spotify's script, then the device: 45 s at most (it never answered: a failure, not "Starting…" forever)
    clearTimeout(web.timer);
    web.timer = setTimeout(function () { if (web.on && !web.ready) webFail('timeout'); }, 45000);
    loadSdk().then(function () {
      if (!web.on) return;
      if (!web.player) webPlayer();
      web.player.connect().then(function (ok) { if (!ok && web.on) webFail('auth'); }, function (e) { if (web.on) webFail('auth', e); });
    }, function () {
      if (web.on) webFail('load');
    });
  }

  function webStop() {
    var was = web.ready && sp.playback && sp.playback.device && sp.playback.device.id === web.id;
    web.on = web.ready = web.active = false;
    web.playHere = null;
    keep(false);
    clearTimeout(web.timer);
    webDo('disconnect');
    if (web.release) {
      web.release();
      web.release = null;
      web.held = false;
    }
    if (was) later(1000);   // what plays now, and where
    render();
  }

  // Spotify lost this device (after a long idle, say): the same player connects again
  function webRestart() {
    web.ready = false;
    clearTimeout(web.timer);
    webDo('disconnect');
    setTimeout(function () { if (web.on) webOpen(); }, 1000);
    render();
  }

  function webFail(kind, e) {
    console.warn(TAG, 'Spotify player in this browser:', kind, (e && e.message) || '');
    if (kind === 'auth' && !web.restarted && web.player) {
      web.restarted = true;
      return webRestart();
    }
    web.failed = kind;
    webStop();
    say(t(WEB_SAYS[kind]));
  }

  // A command to the player here (it answers through its events; playback_error if it fails)
  function webDo(name, arg) {
    if (!web.player) return;
    try {
      var r = web.player[name](arg);
      if (r && r.then) r.then(null, function (er) { console.warn(TAG, 'Spotify player:', name, er && er.message); });
    } catch (er) {
      console.warn(TAG, 'Spotify player:', name, er.message);
    }
  }

  // Spotify's script, once (it calls onSpotifyWebPlaybackSDKReady when it's there)
  function loadSdk() {
    if (window.Spotify && window.Spotify.Player) return Promise.resolve();
    if (!sdkLoading) {
      sdkLoading = new Promise(function (ok, fail) {
        var before = window.onSpotifyWebPlaybackSDKReady;
        window.onSpotifyWebPlaybackSDKReady = function () {
          if (typeof before === 'function') try { before(); } catch (er) { /* another page's */ }
          ok();
        };
        var s = document.createElement('script');
        s.src = SDK;
        s.async = true;
        s.onerror = function () {
          sdkLoading = null;
          s.remove();
          fail(new Error('Spotify\'s player did not load'));
        };
        document.head.appendChild(s);
      });
    }
    return sdkLoading;
  }

  function webPlayer() {
    var pl = web.player = new window.Spotify.Player({
      name: webName(),
      // never the same token twice (the player refuses it): when it asks again, a new one
      getOAuthToken: function (cb) {
        fresh(web.given || undefined).then(function (tok) {
          web.given = tok;
          cb(tok);
        }, function () { /* logged out: the player stops */ });
      },
      volume: Math.max(0, Math.min(1, state.webVolume)),
      enableMediaSession: false   // the page's media session, with the right units (see keep)
    });
    pl.addListener('ready', function (d) {
      web.id = (d && d.device_id) || '';
      web.ready = !!web.id;
      web.seen = Date.now();
      clearTimeout(web.timer);
      // only Premium accounts become a device: nothing to probe here
      auth.probedOn = web.id;
      if (auth.premium !== true) setPremium(true);
      else {
        auth.checked = Date.now();
        saveAuth();
      }
      if (web.playHere != null) {
        var play = web.playHere, again = web.retried;
        web.playHere = null;
        web.retried = false;
        playHere(play, again);
      }
      if (state.showDevices) loadDevices();
      render();
    });
    pl.addListener('not_ready', function () {   // offline: it comes back with ready
      web.ready = false;
      render();
    });
    pl.addListener('player_state_changed', webState);
    pl.addListener('initialization_error', function (e) { webFail('drm', e); });
    pl.addListener('authentication_error', function (e) { webFail(/scope/i.test((e && e.message) || '') ? 'scope' : 'auth', e); });
    pl.addListener('account_error', function (e) { webFail('account', e); });
    pl.addListener('playback_error', function (e) {
      console.warn(TAG, 'Spotify player:', (e && e.message) || '');
      if (web.active) say(t('spError'));
    });
    pl.addListener('autoplay_failed', function () { say(t('spWebTap'), true); });
  }

  // What plays here (only this device's playback; null: it stopped or moved away)
  function webState(s) {
    var tr = s && s.track_window && s.track_window.current_track;
    web.seen = Date.now();
    if (!tr) {
      keep(false);
      if (web.active) {
        web.active = false;
        later(300);   // where it went
      }
      return;
    }
    web.active = true;
    keep(!s.paused);
    if (!s.paused && sp.message === t('spWebTap')) say('');
    setPlayback({
      is_playing: !s.paused,
      progress_ms: s.paused ? s.position : s.position + Math.max(0, Date.now() - (s.timestamp || Date.now())),
      item: { uri: tr.uri, name: tr.name, duration_ms: s.duration || tr.duration_ms, artists: tr.artists, album: tr.album },
      context: s.context && s.context.uri ? { uri: s.context.uri } : null,
      shuffle_state: s.shuffle,
      repeat_state: ['off', 'context', 'track'][s.repeat_mode] || 'off',
      device: { id: web.id, name: webName(), volume_percent: Math.round(state.webVolume * 100), supports_volume: true }
    });
    later(30000);
  }

  // The music moves to this browser ("This browser" in the devices, or play
  // with nothing playing). play: start playing there (default: as it was)
  function playHere(play, retried) {
    var p = sp.playback;
    if (auth.premium === false) {
      sp.info = true;
      return render();
    }
    if (play == null) play = !p || !p.device || p.playing;
    state.showDevices = false;
    if (!state.web || web.failed) {
      state.web = true;
      web.failed = '';
      save();
    }
    if (!web.ready) {
      webSync();
      // the login lacks the player's scope: the settings say to connect again
      if (!web.on) state.showSettings = true;
      else web.playHere = play;
      return render();
    }
    var tries = 0, body = { device_ids: [web.id], play: play };
    (function go() {
      api('PUT', '/me/player', body).then(function () {
        if (auth.premium !== true) setPremium(true);
        later(1500);
      }, function (e) {
        // just ready, Spotify may not know the device yet; after a long idle, not anymore
        if (e.status === 404 && web.on) {
          if (++tries < 5) return setTimeout(go, 500 * Math.pow(2, tries - 1));
          if (!retried) {
            web.playHere = play;
            web.retried = true;
            return webRestart();
          }
        }
        trouble(e);
        later(400);
      });
    })();
    render();
  }

  // ---------------------------------------------------------------------------
  // Jellyfin: your Jellyfin music library, played in this tab (an audio
  // element of the page, so Live Wallpapers hears it and the media controls
  // reach it). The login is Jellyfin's Quick Connect: the widget shows a code,
  // you enter it in Jellyfin (your profile → Quick Connect) and the access
  // token it gets is kept like Spotify's login, here and on the CasaOS server.
  // Jellyfin is another site (its own port): its API answers any page (CORS),
  // and from an https:// CasaOS it needs an https:// address too (App
  // Windows' frame proxy gives it one, at the same port).
  // ---------------------------------------------------------------------------
  var JF_AUTH = STORE + '-jellyfin';
  var JF_SHARED = SHARED_DIR + '/music-player-jellyfin.json';
  var JF_KEYS = ['server', 'token', 'user', 'device', 'at'];
  var JF_CLIENT = 'CasaOS Music Player', JF_VERSION = '2.0.1';
  var JF_HELP = 'https://github.com/UsuarioDeJava/CasaMODs/tree/main/casaos-music-player#jellyfin';
  var JF_PAGE = 200, JF_ALL_PAGE = 500, JF_SHOWN = 300;
  // What this browser plays as it is (Jellyfin converts the rest to MP3)
  var JF_FORMATS = [['opus', 'audio/ogg; codecs="opus"'], ['webm|opus', 'audio/webm; codecs="opus"'], ['mp3', 'audio/mpeg'],
    ['aac,m4a|aac,m4b|aac', 'audio/mp4; codecs="mp4a.40.2"'], ['flac', 'audio/flac'], ['webma,webm|webma', 'audio/webm'],
    ['wav', 'audio/wav'], ['ogg', 'audio/ogg']];

  // { server (':8096': this CasaOS host at that port; or a full address), token, user: {id, name}, device, at }
  function loadJf() {
    var a;
    try { a = JSON.parse(localStorage.getItem(JF_AUTH) || '{}') || {}; } catch (e) { a = {}; }
    return typeof a === 'object' ? a : {};
  }
  var jfAuth = loadJf();
  function saveJf() {
    try { localStorage.setItem(JF_AUTH, JSON.stringify(jfAuth)); } catch (e) { /* storage blocked */ }
  }
  // Another tab connected or disconnected
  window.addEventListener('storage', function (e) {
    if (e.key !== JF_AUTH) return;
    var was = jfOn();
    jfAuth = loadJf();
    if (was && !jfOn()) jfReset();
    render();
  });

  var jf = {
    tracks: [], order: [], index: -1,   // the list a track was picked in, its play order, where it is
    now: null,                          // the track playing (from the list or the queue)
    queue: [],                          // tracks to play next, in order
    resume: 0,                          // where the restored track goes on from (not loaded yet)
    session: '',                        // this play's id, for Jellyfin's playback reports
    playlists: null, playlistsLoading: false,
    stack: [],                          // the library's open lists: { kind, id, name, rows, total, loading, failed, paged, search }
    rows: [], results: [], resultsFor: '',
    shown: JF_SHOWN, cut: false,        // a long list shows its first rows, more as it scrolls
    songs: null,                        // All songs, kept once loaded
    qc: null,                           // Quick Connect: { code, secret, server, base }
    note: '', message: '', errors: 0, reported: null
  };
  var jfAudio = new Audio();
  jfAudio.preload = 'metadata';
  jfAudio.crossOrigin = 'anonymous';   // Jellyfin allows it (CORS): the wallpapers can hear it
  jfAudio.volume = state.volume;
  jfAudio.muted = state.muted;
  var jfContainers = JF_FORMATS.filter(function (f) { return jfAudio.canPlayType(f[1]); })
    .map(function (f) { return f[0]; }).join(',') || 'mp3';

  function jfOn() { return !!(jfAuth.token && jfAuth.user && jfAuth.user.id); }

  // Jellyfin's address: ':8096' is this CasaOS host at that port, with the
  // page's scheme (http://casaos:8096, or https://….ts.net:8096 through the frame proxy)
  function jfBase(s) {
    s = s == null ? jfAuth.server || ':8096' : s;
    return s.charAt(0) === ':' ? location.protocol + '//' + location.hostname + s : s;
  }
  // What was typed → what is kept (null: not an address). The CasaOS host
  // keeps only its port, so the login works at every CasaOS address.
  function jfAddress(text) {
    text = String(text || '').trim();
    if (!text) return ':8096';
    if (/^\d+$/.test(text)) return ':' + text;
    if (!/^https?:\/\//i.test(text)) text = location.protocol + '//' + text;
    var u;
    try { u = new URL(text); } catch (e) { return null; }
    var path = u.pathname.replace(/\/web(\/.*)?$/i, '').replace(/\/+$/, '');   // a pasted …:8096/web/#/home
    if (u.hostname === location.hostname && u.protocol === location.protocol && u.port) return ':' + u.port + path;
    return u.origin + path;
  }

  function jfDevice() {
    if (!jfAuth.device) {
      jfAuth.device = 'casaos-' + randomString(16);
      saveJf();
    }
    return jfAuth.device;
  }
  function jfHeader(tok) {
    return 'MediaBrowser Client="' + JF_CLIENT + '", Device="CasaOS", DeviceId="' + jfDevice() + '", Version="' + JF_VERSION + '"' +
      (tok ? ', Token="' + tok + '"' : '');
  }

  // Jellyfin's API: JSON in and out (PascalCase, as every version answers it).
  // base: an address to log in at (no token yet). A 401 means the login was revoked.
  function jfApi(method, path, body, base) {
    var tok = base ? '' : jfAuth.token;
    var init = { method: method, headers: { Authorization: jfHeader(tok), Accept: 'application/json; profile="PascalCase"' } };
    if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (window.AbortController) {
      var ctl = new AbortController();
      init.signal = ctl.signal;
      setTimeout(function () { ctl.abort(); }, 20000);
    }
    return fetch((base || jfBase()) + path, init).then(function (r) {
      if (r.status === 401 && tok && tok === jfAuth.token) jfLost();
      if (!r.ok) {
        var e = new Error('Jellyfin ' + r.status);
        e.status = r.status;
        throw e;
      }
      return r.status === 204 ? null : r.json().then(null, function () { return null; });
    });
  }
  // A path with the user (older versions want it)
  function jfQuery(path, params) {
    return path + (path.indexOf('?') < 0 ? '?' : '&') + (params ? params + '&' : '') + 'UserId=' + jfAuth.user.id;
  }

  // ---- The login on the CasaOS server, as Spotify's ----
  function jfShare() {
    var data = {};
    JF_KEYS.forEach(function (k) { if (jfAuth[k] != null) data[k] = jfAuth[k]; });
    return sharedSave(JF_SHARED, data);
  }
  // A newer login from the server is taken; this browser's, when newer, is
  // saved there unless keep. true: the login changed
  function jfPull(keep) {
    return sharedRead(JF_SHARED).then(function (v) {
      made[JF_SHARED] = made[JF_SHARED] || !!v;
      if (v && (v.at || 0) > (jfAuth.at || 0)) {
        JF_KEYS.forEach(function (k) {
          if (v[k] != null) jfAuth[k] = v[k];
          else if (k === 'token' || k === 'user') delete jfAuth[k];
        });
        saveJf();
        return true;
      }
      if (!keep && jfOn() && (!v || (v.at || 0) < (jfAuth.at || 0))) jfShare();
      return false;
    }, function () { return false; });
  }
  function jfChanged(changed) {
    if (!changed) return;
    if (!jfOn()) jfReset();
    else if (state.source === 'jellyfin') {
      state.showSettings = false;
      jfRestore();
    }
    render();
  }
  // Not connected here: a login made in another browser may be there now
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && root && !jfOn() && state.source === 'jellyfin') jfPull().then(jfChanged);
  });

  // The token stopped working (Disconnect elsewhere, or removed in
  // Jellyfin's Devices): another browser may have a new one on the server
  var jfLosing = false;
  function jfLost() {
    if (jfLosing) return;
    jfLosing = true;
    var was = jfAuth.token;
    jfPull(true).then(function (changed) {
      jfLosing = false;
      if (jfAuth.token !== was) return jfChanged(changed);
      jfLogout(t('jfLoginAgain'));
    });
  }

  // ---- Quick Connect: a code to enter in Jellyfin; the login comes once it's approved ----
  var qcTimer = 0, qcId = 0;
  function jfConnect() {
    var server = jfAddress(el.jfServer.value);
    jfCancelCode();
    jf.note = '';
    if (!server) {
      jf.note = t('jfNoServer');
      return render();
    }
    var base = jfBase(server), id = qcId;
    jf.qc = { code: '', server: server, base: base };
    render();
    jfApi('GET', '/QuickConnect/Enabled', null, base).then(function (on) {
      if (on === false) throw new Error('off');
      return jfApi('POST', '/QuickConnect/Initiate', null, base).then(null, function (e) {
        if (e.status === 404 || e.status === 405) return jfApi('GET', '/QuickConnect/Initiate', null, base);   // before 10.9
        throw e;
      });
    }).then(function (q) {
      if (id !== qcId || !q || !q.Secret) return;
      jf.qc.code = q.Code;
      jf.qc.secret = q.Secret;
      render();
      qcWait(id);
    }, function (e) {
      if (id !== qcId) return;
      jf.qc = null;
      jf.note = e.message === 'off' || e.status === 401 ? t('jfQcOff') : t('jfNoServer');
      render();
    });
  }
  function qcWait(id) {
    clearTimeout(qcTimer);
    qcTimer = setTimeout(function () {
      var q = jf.qc;
      if (id !== qcId || !q) return;
      if (jfOn()) {   // connected meanwhile (another tab, or the server's login)
        jfCancelCode();
        return render();
      }
      jfApi('GET', '/QuickConnect/Connect?Secret=' + encodeURIComponent(q.secret), null, q.base).then(function (s) {
        if (id !== qcId) return;
        if (!s || !s.Authenticated) return qcWait(id);
        return jfApi('POST', '/Users/AuthenticateWithQuickConnect', { Secret: q.secret }, q.base).then(function (a) {
          if (id !== qcId || !a || !a.AccessToken || !a.User) throw new Error('no login');
          jfCancelCode();
          jfReset();
          jfAuth.server = q.server;
          jfAuth.token = a.AccessToken;
          jfAuth.user = { id: a.User.Id, name: a.User.Name || '' };
          jfAuth.at = Date.now();
          jf.typed = null;
          saveJf();
          jfShare();
          state.showSettings = false;
          render();
        });
      }).then(null, function (e) {
        if (id !== qcId) return;
        if (e.status !== 404) return qcWait(id);   // a hiccup: ask again
        // the code expired (10 minutes): a new one while the settings are in view
        if (state.source === 'jellyfin' && state.showSettings && !document.hidden) return jfConnect();
        jfCancelCode();
        render();
      });
    }, 3000);
  }
  function jfCancelCode() {
    qcId++;
    clearTimeout(qcTimer);
    jf.qc = null;
  }

  // Disconnect: the token stops working everywhere (Jellyfin forgets it), here and on the server
  function jfForget() {
    if (jfOn()) jfApi('POST', '/Sessions/Logout').then(null, function () {});
    jfLogout('');
  }
  function jfLogout(message) {
    jfReset();
    delete jfAuth.token;
    delete jfAuth.user;
    jfAuth.at = Date.now();
    saveJf();
    jfShare();
    jf.message = message;
    render();
  }
  // Nothing of the last login stays: what played, the library
  function jfReset() {
    jfReportStop();
    jfAudio.pause();
    jfAudio.removeAttribute('src');
    jf.tracks = [];
    jf.order = [];
    jf.queue = [];
    jf.index = -1;
    jf.now = jf.playlists = jf.songs = null;
    jf.stack = [];
    jf.results = [];
    jf.resultsFor = '';
    jf.message = jf.note = '';
    saved.jf = null;
    if (state.source === 'jellyfin') updateSession();
  }

  // ---- The library ----
  // An item's picture (a track without its own: its album's), as a path with its tag
  function jfImage(i) {
    if (i.ImageTags && i.ImageTags.Primary) return '/Items/' + i.Id + '/Images/Primary?tag=' + i.ImageTags.Primary;
    if (i.AlbumPrimaryImageTag && i.AlbumId) return '/Items/' + i.AlbumId + '/Images/Primary?tag=' + i.AlbumPrimaryImageTag;
    return '';
  }
  function jfImg(path, size) {
    return path ? jfBase() + path + '&fillWidth=' + size + '&fillHeight=' + size + '&quality=90' : '';
  }
  var JF_KINDS = { Audio: 'track', MusicAlbum: 'album', MusicArtist: 'artist', Playlist: 'playlist' };
  function jfRow(i) {
    var kind = JF_KINDS[i.Type] || 'other', name = i.Name || '?';
    if (kind === 'track') {
      var artist = (i.Artists && i.Artists.join(', ')) || i.AlbumArtist || '';
      return {
        kind: kind, id: i.Id, name: name, artist: artist, album: i.Album || '', duration: (i.RunTimeTicks || 0) / 1e7,
        image: jfImage(i), fav: !!(i.UserData && i.UserData.IsFavorite), key: fold(name + ' ' + artist + ' ' + (i.Album || ''))
      };
    }
    var sub = kind === 'album' ? [i.AlbumArtist, i.ProductionYear].filter(Boolean).join(' · ') : '';
    return { kind: kind, id: i.Id, name: name, sub: sub, count: kind === 'playlist' ? i.ChildCount : null, image: jfImage(i), key: fold(name + ' ' + sub) };
  }
  // The first level: All songs, Favorites, Albums, Artists, then your playlists
  function jfRoot() {
    return [
      { kind: 'songs', name: t('jfSongs') }, { kind: 'favs', name: t('jfFavorites') },
      { kind: 'albums', name: t('jfAlbums') }, { kind: 'artists', name: t('jfArtists') }
    ].map(function (r) { r.key = fold(r.name); return r; }).concat(jf.playlists || []);
  }
  function jfLoadRoot() {
    if (jf.playlistsLoading || !jfOn()) return;
    jf.playlistsLoading = true;
    jfApi('GET', jfQuery('/Items', 'Recursive=true&IncludeItemTypes=Playlist&SortBy=SortName&Fields=ChildCount')).then(function (j) {
      jf.playlists = ((j && j.Items) || []).filter(function (i) { return i.MediaType !== 'Video'; }).map(jfRow);
    }, jfTrouble).then(function () {
      jf.playlistsLoading = false;
      renderList();
    });
  }
  // What each list asks for (albums and artists come in pages, searched on
  // the server; All songs comes whole, a page after the other)
  var JF_OPEN = {
    songs: function () { return '/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=SortName'; },
    favs: function () { return '/Items?Recursive=true&IncludeItemTypes=Audio&Filters=IsFavorite&SortBy=AlbumArtist,Album,ParentIndexNumber,IndexNumber,SortName'; },
    albums: function () { return '/Items?Recursive=true&IncludeItemTypes=MusicAlbum&SortBy=SortName'; },
    artists: function () { return '/Artists/AlbumArtists?SortBy=SortName'; },
    artist: function (id) { return '/Items?Recursive=true&IncludeItemTypes=MusicAlbum&SortBy=ProductionYear,SortName&AlbumArtistIds=' + id; },
    album: function (id) { return '/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=ParentIndexNumber,IndexNumber,SortName&ParentId=' + id; },
    playlist: function (id) { return '/Playlists/' + id + '/Items'; }
  };
  function jfOpen(r) {
    if (!JF_OPEN[r.kind]) return;
    var lv = r.kind === 'songs' && jf.songs && !jf.songs.failed ? jf.songs : {
      kind: r.kind, id: r.id, name: r.name, rows: [], total: null, loading: false, failed: false,
      paged: r.kind === 'albums' || r.kind === 'artists', all: r.kind === 'songs', search: ''
    };
    if (lv.all) jf.songs = lv;
    jf.stack.push(lv);
    state.search = el.search.value = '';
    el.list.scrollTop = 0;
    jf.shown = JF_SHOWN;
    jfMore(lv);
    render();
  }
  // The open list: all of it, or its next page
  function jfMore(lv) {
    lv = lv || jf.stack[jf.stack.length - 1];
    if (!lv || !jfOn() || lv.loading || lv.failed || (lv.total != null && lv.rows.length >= lv.total)) return;
    lv.loading = true;
    var search = lv.search, size = lv.all ? JF_ALL_PAGE : JF_PAGE, pages = lv.paged || lv.all;
    var q = 'ImageTypeLimit=1&EnableImageTypes=Primary' + (pages ? '&StartIndex=' + lv.rows.length + '&Limit=' + size : '') +
      (search ? '&SearchTerm=' + encodeURIComponent(search) : '');
    jfApi('GET', jfQuery(JF_OPEN[lv.kind](lv.id), q)).then(function (j) {
      if (lv.search !== search) return;
      var items = (j && j.Items) || [];
      Array.prototype.push.apply(lv.rows, items.map(jfRow));   // in place: a list that plays grows with it
      if (jf.tracks === lv.rows) jfGrow(items.length);
      lv.total = !pages || items.length < size ? lv.rows.length : (j.TotalRecordCount || lv.rows.length + 1);
    }, function (e) {
      if (lv.search === search) lv.failed = true;
      jfTrouble(e);
    }).then(function () {
      lv.loading = false;
      if (lv.search !== search) return jfMore(lv);   // searched again meanwhile
      renderList();
      if (lv.all) jfMore(lv);   // All songs: the next page at once
    });
  }
  // Typing: the first level searches all of Jellyfin, albums and artists
  // search on the server, a list of tracks is only filtered
  var jfSearchTimer = 0;
  function jfSearch() {
    clearTimeout(jfSearchTimer);
    var lv = jf.stack[jf.stack.length - 1];
    if (lv && !lv.paged) return;
    jfSearchTimer = setTimeout(function () {
      var q = state.search.trim();
      if (!jfOn()) return;
      if (lv) {
        if (lv.search === q) return;
        lv.search = q;
        lv.rows = [];
        jf.shown = JF_SHOWN;
        lv.total = null;
        lv.failed = false;
        jfMore(lv);
        return renderList();
      }
      if (q.length < 2) {
        jf.results = [];
        jf.resultsFor = '';
        return renderList();
      }
      jfApi('GET', jfQuery('/Items', 'Recursive=true&IncludeItemTypes=MusicArtist,MusicAlbum,Playlist,Audio&Limit=40&SearchTerm=' + encodeURIComponent(q))).then(function (j) {
        if (state.search.trim() !== q) return;
        var rows = ((j && j.Items) || []).map(jfRow).filter(function (r) { return r.kind !== 'other'; });
        // artists, albums and playlists first, then the tracks
        jf.results = rows.filter(function (r) { return r.kind !== 'track'; }).concat(rows.filter(function (r) { return r.kind === 'track'; }));
        jf.resultsFor = q;
        renderList();
      }, jfTrouble);
    }, 300);
  }
  function jfTrouble(e) {
    if (e && e.status === 401) return;   // jfLost() says it
    jf.message = t('jfError');
    render();
    clearTimeout(jf.messageTimer);
    jf.messageTimer = setTimeout(function () { jf.message = ''; render(); }, 5000);
  }

  // ---- Playing ----
  function jfStream(tr) {
    return jfBase() + '/Audio/' + tr.id + '/universal?UserId=' + jfAuth.user.id + '&DeviceId=' + encodeURIComponent(jfDevice()) +
      '&MaxStreamingBitrate=140000000&Container=' + encodeURIComponent(jfContainers) +
      '&TranscodingContainer=mp3&TranscodingProtocol=http&AudioCodec=mp3&PlaySessionId=' + jf.session +
      '&ApiKey=' + encodeURIComponent(jfAuth.token);
  }
  function jfPlay(tr, at) {
    if (!tr || !jfOn()) return;
    jfReportStop();
    jf.now = tr;
    jf.resume = at || 0;
    jf.session = randomString(16);
    jf.message = '';
    jfAudio.src = jfStream(tr);
    var p = jfAudio.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: user presses play */ });
    updateSession();
    save();
    render();
  }
  // A track of the list (it leaves the queue)
  function jfPlayIndex(i) {
    var tr = jf.tracks[i];
    if (!tr) return;
    jf.index = i;
    var k = jfQueued(tr.id);
    if (k >= 0) jf.queue.splice(k, 1);
    jfPlay(tr);
  }
  function jfOrder() { jf.order = playOrder(jf.tracks.length, jf.index); }
  // The list that plays got n more tracks (it was still loading): they join
  // the play order (anywhere after the current one, when shuffling)
  function jfGrow(n) {
    var len = jf.tracks.length, at = jf.order.indexOf(jf.index);
    for (var i = len - n; i < len; i++) {
      if (state.shuffle) jf.order.splice(at + 1 + Math.floor(Math.random() * (jf.order.length - at)), 0, i);
      else jf.order.push(i);
    }
  }
  // A track picked in a list: that list plays from it
  function jfPick(r) {
    var lv = jf.stack[jf.stack.length - 1];
    var rows = lv ? lv.rows : jf.results.indexOf(r) >= 0 ? jf.results : jfRoot();
    var tracks = rows.filter(function (x) { return x.kind === 'track'; });
    jf.tracks = tracks.length === rows.length ? rows : tracks;   // the list itself: it may still be loading
    jf.index = jf.tracks.indexOf(r);
    jfOrder();
    jfPlayIndex(jf.index);
  }
  function jfToggle() {
    if (!jf.now) {
      if (jf.queue.length) return jfPlay(jf.queue.shift());
      if (jf.tracks.length) return jfPlayIndex(jf.order[0]);
      // nothing yet: the library
      state.showList = true;
      state.showNext = state.showSettings = false;
      jfLoadRoot();
      return render();
    }
    if (!jfAudio.src) return jfPlay(jf.now, jf.resume);   // restored after a reload
    if (jfAudio.paused) {
      var p = jfAudio.play();
      if (p && p.catch) p.catch(function () {});
    } else jfAudio.pause();
  }
  // The queue first, then the list from where it was
  function jfNext(auto) {
    if (auto && state.repeat === 'one' && jf.now) return jfPlay(jf.now);
    if (jf.queue.length) return jfPlay(jf.queue.shift());
    var n = jf.order.length, pos = jf.order.indexOf(jf.index) + 1;
    if (!n) return;
    if (pos >= n) {
      if (auto && state.repeat === 'off') { jfAudio.pause(); render(); return; }
      if (state.shuffle) jfOrder();
      pos = 0;
    }
    jfPlayIndex(jf.order[pos]);
  }
  function jfPrev() {
    if (jfTime() > 3) return jfSeek(0);
    var cur = jf.tracks[jf.index];
    if (cur && jf.now !== cur) return jfPlayIndex(jf.index);   // from a queued track: back to the list
    var n = jf.order.length;
    if (!n) return;
    jfPlayIndex(jf.order[(jf.order.indexOf(jf.index) - 1 + n) % n]);
  }
  function jfTime() { return jfAudio.src ? jfAudio.currentTime : jf.resume; }
  function jfDuration() {
    var d = jfAudio.duration;
    return isFinite(d) && d > 0 ? d : jf.now ? jf.now.duration : 0;   // a converted track has no length of its own
  }
  function jfSeek(sec) {
    sec = Math.max(0, Math.min(jfDuration() || 0, sec));
    if (jfAudio.src) jfAudio.currentTime = sec;
    else jf.resume = sec;
    updateProgress();
  }
  function jfQueued(id) {
    for (var k = 0; k < jf.queue.length; k++) if (jf.queue[k].id === id) return k;
    return -1;
  }
  function jfQueue(r) {
    var k = jfQueued(r.id);
    if (k >= 0) jf.queue.splice(k, 1);
    else jf.queue.push(r);
    save();
    renderList();
    renderNext();
  }
  // ❤: Jellyfin's favorites (the route of 10.9 and later, else the older one)
  function jfFavorite() {
    var tr = jf.now;
    if (!tr) return;
    var on = !tr.fav, method = on ? 'POST' : 'DELETE';
    tr.fav = on;
    render();
    jfApi(method, '/UserFavoriteItems/' + tr.id).then(null, function (e) {
      if (e.status === 404) return jfApi(method, '/Users/' + jfAuth.user.id + '/FavoriteItems/' + tr.id);
      throw e;
    }).then(function () {
      var fav = jf.stack[0] && jf.stack[0].kind === 'favs' ? jf.stack[0] : null;
      if (fav) { fav.rows = []; fav.total = null; fav.failed = false; jfMore(fav); }
    }, function (e) {
      tr.fav = !on;
      jfTrouble(e);
    });
  }

  jfAudio.addEventListener('playing', function () {
    jf.errors = 0;
    jfReportStart();
    render();
  });
  jfAudio.addEventListener('pause', function () {
    jfReportProgress();
    render();
  });
  jfAudio.addEventListener('ended', function () {
    jfReportStop(true);
    jfNext(true);
  });
  jfAudio.addEventListener('error', function () {
    if (!jf.now || !jfAudio.src) return;
    if (!jf.errors) jfApi('GET', '/Users/Me').then(null, function () {});   // a revoked login answers 401 there
    jf.message = t('loadError');
    render();
    if (++jf.errors < 5) setTimeout(function () { jfNext(true); }, 800);
  });
  jfAudio.addEventListener('loadedmetadata', function () {
    if (jf.resume) {
      try { jfAudio.currentTime = jf.resume; } catch (e) { /* a converted track starts over */ }
      jf.resume = 0;
    }
    updateProgress();
  });
  jfAudio.addEventListener('timeupdate', function () {
    updateProgress();
    var now = Date.now();
    if (now - lastSave > 2000) { lastSave = now; save(); }
  });
  jfAudio.addEventListener('play', updatePlaybackState);
  jfAudio.addEventListener('pause', updatePlaybackState);

  // Jellyfin learns what plays here (its dashboard, play counts, scrobbling plugins)
  function jfSession(path, tr, paused, sec) {
    jfApi('POST', path, {
      ItemId: tr.id, PlaySessionId: tr.session, PositionTicks: Math.round((sec || 0) * 1e7), IsPaused: paused, CanSeek: true
    }).then(null, function () {});
  }
  function jfReportStart() {
    var tr = jf.now;
    if (!tr || !jfOn()) return;
    if (jf.reported === tr && tr.session === jf.session) return jfReportProgress();   // resumed
    jfReportStop();
    tr.session = jf.session;
    jf.reported = tr;
    jfSession('/Sessions/Playing', tr, false, jfAudio.currentTime);
  }
  function jfReportProgress() {
    if (jf.reported && jfOn()) jfSession('/Sessions/Playing/Progress', jf.reported, jfAudio.paused, jfAudio.currentTime);
  }
  function jfReportStop(ended) {
    var tr = jf.reported;
    jf.reported = null;
    if (tr && jfOn()) jfSession('/Sessions/Playing/Stopped', tr, false, ended ? tr.duration : jfAudio.currentTime);
  }

  // ---- After a reload: the list, the track and where it was ----
  function jfSaved() {
    if (!jf || (!jf.now && !jf.tracks.length && !jf.queue.length)) return saved.jf || null;   // not restored yet
    var id = function (tr) { return tr.id; };
    var from = Math.max(0, Math.min(jf.index - 100, jf.tracks.length - 400));
    return {
      ids: jf.tracks.slice(from, from + 400).map(id), now: jf.now ? jf.now.id : null,
      queue: jf.queue.slice(0, 50).map(id), time: Math.floor(jfTime() || 0)
    };
  }
  var jfRestored = false;
  function jfRestore() {
    var s = saved.jf;
    if (jfRestored || !jfOn() || !s || !Array.isArray(s.ids)) return;
    jfRestored = true;
    var ids = s.ids.concat(s.queue || [], s.now ? [s.now] : []).filter(function (x, k, all) { return x && all.indexOf(x) === k; });
    var parts = [];
    for (var k = 0; k < ids.length; k += 100) parts.push(jfApi('GET', jfQuery('/Items', 'Ids=' + ids.slice(k, k + 100).join(','))));
    Promise.all(parts).then(function (all) {
      if (jf.now || jf.tracks.length) return;   // something else plays already
      var byId = {};
      all.forEach(function (j) { ((j && j.Items) || []).forEach(function (i) { byId[i.Id] = jfRow(i); }); });
      var pick = function (list) { return (list || []).map(function (x) { return byId[x]; }).filter(Boolean); };
      jf.tracks = pick(s.ids);
      jf.queue = pick(s.queue);
      jf.now = byId[s.now] || null;
      jf.index = jf.tracks.indexOf(jf.now);
      jf.resume = jf.now ? s.time || 0 : 0;
      jfOrder();
      updateSession();
      render();
    }, function () { jfRestored = false; });
  }

  function setSource(src) {
    if (src !== 'spotify' && src !== 'jellyfin') src = 'local';
    if (state.source === src) return;
    var was = state.source;
    state.source = src;
    state.showList = state.showFolder = state.showDevices = state.showSettings = state.showNext = false;
    sp.info = false;
    state.search = el.search.value = '';
    jfCancelCode();
    if (was === 'local' && !audio.paused) audio.pause();   // one mode plays at a time
    if (was === 'jellyfin' && !jfAudio.paused) jfAudio.pause();
    if (src === 'spotify') {
      if (!connected()) state.showSettings = true;
      else {
        if (!auth.user) loadMe();
        poll();
      }
    } else {
      if (web.active) webDo('pause');
      stopSpotify();
    }
    if (src === 'jellyfin') {
      if (jfOn()) jfRestore();
      else {
        state.showSettings = true;
        jfPull().then(jfChanged);   // a login made in another browser
      }
    }
    webSync();
    save();
    render();
    updateSession();
    updatePlaybackState();
    publish();
  }

  // ---------------------------------------------------------------------------
  // Widget
  // ---------------------------------------------------------------------------
  var root = null, el = {};

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'smp-widget';
    root.setAttribute('widget-id', 'music-player');
    root.innerHTML =
      '<div class="widget has-text-white is-relative">' +
      '<div class="blur-background"></div>' +
      '<div class="widget-content smp-content">' +
      '  <div class="smp-head">' +
      '    <span class="smp-head-left">' +
      '      <span class="smp-heading"></span>' +
      '      <button type="button" class="smp-info" data-act="info" hidden>i</button>' +
      '    </span>' +
      '    <span class="smp-head-btns">' +
      '      <span class="smp-source" dir="ltr">' +
      '        <button type="button" class="smp-src" data-act="source" data-src="local">' + icon('note') + '</button>' +
      '        <button type="button" class="smp-src" data-act="source" data-src="spotify">' + icon('spotify') + '</button>' +
      '        <button type="button" class="smp-src" data-act="source" data-src="jellyfin">' + icon('jellyfin') + '</button>' +
      '      </span>' +
      '      <button type="button" class="smp-btn smp-small" data-act="list">' + icon('list') + '</button>' +
      '      <button type="button" class="smp-btn smp-small" data-act="next-up">' + icon('upnext') + '</button>' +
      '      <button type="button" class="smp-btn smp-small" data-act="folder">' + icon('folder') + '</button>' +
      '      <button type="button" class="smp-btn smp-small" data-act="settings">' + icon('gear') + '</button>' +
      '    </span>' +
      '  </div>' +
      '  <div class="smp-pop" hidden></div>' +
      '  <div class="smp-now">' +
      '    <div class="smp-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
      '    <div class="smp-meta"><div class="smp-title"></div><div class="smp-sub"></div></div>' +
      '    <button type="button" class="smp-btn smp-small smp-like" data-act="like" hidden>' + icon('heart') + '</button>' +
      '  </div>' +
      // Playback goes left to right in every language (time, prev/next), as in RTL players
      '  <div class="smp-progress" dir="ltr">' +
      '    <span class="smp-time">0:00</span>' +
      '    <input type="range" class="smp-seek" min="0" max="1000" value="0" step="1">' +
      '    <span class="smp-time smp-dur">0:00</span>' +
      '  </div>' +
      '  <div class="smp-controls" dir="ltr">' +
      '    <button type="button" class="smp-btn" data-act="shuffle">' + icon('shuffle') + '</button>' +
      '    <button type="button" class="smp-btn" data-act="prev">' + icon('prev') + '</button>' +
      '    <button type="button" class="smp-btn smp-play" data-act="play"></button>' +
      '    <button type="button" class="smp-btn" data-act="next">' + icon('next') + '</button>' +
      '    <button type="button" class="smp-btn" data-act="repeat"></button>' +
      '  </div>' +
      '  <button type="button" class="smp-device" data-act="devices" hidden>' + icon('device') + '<span></span></button>' +
      '  <div class="smp-volume" dir="ltr">' +
      '    <button type="button" class="smp-btn smp-small" data-act="mute"></button>' +
      '    <input type="range" class="smp-vol" min="0" max="100" step="1">' +
      '  </div>' +
      '  <div class="smp-msg" hidden></div>' +
      '  <div class="smp-folder" hidden>' +
      '    <label class="smp-label"></label>' +
      '    <div class="smp-path-row">' +
      '      <button type="button" class="smp-btn smp-small" data-act="up">' + icon('up') + '</button>' +
      '      <input type="text" class="smp-path" spellcheck="false" dir="ltr">' +
      '    </div>' +
      '    <div class="smp-dirs"></div>' +
      '    <label class="smp-check"><input type="checkbox" class="smp-recursive"> <span></span></label>' +
      '    <div class="smp-folder-btns">' +
      '      <button type="button" class="smp-text-btn smp-primary" data-act="use"></button>' +
      '      <button type="button" class="smp-text-btn" data-act="cancel"></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="smp-upnext" hidden><div class="smp-nlist"></div></div>' +
      '  <div class="smp-devices" hidden>' +
      '    <div class="smp-label smp-dev-label"></div>' +
      '    <div class="smp-dev-list"></div>' +
      '  </div>' +
      '  <div class="smp-spset" hidden>' +
      '    <p class="smp-note smp-https"></p>' +
      '    <label class="smp-label smp-cid-label"></label>' +
      '    <input type="text" class="smp-path smp-cid" spellcheck="false" autocomplete="off" dir="ltr">' +
      '    <label class="smp-label smp-uri-label"></label>' +
      '    <div class="smp-path-row">' +
      '      <input type="text" class="smp-path smp-uri" readonly dir="ltr">' +
      '      <button type="button" class="smp-text-btn" data-act="sp-copy"></button>' +
      '    </div>' +
      '    <div class="smp-account"></div>' +
      '    <label class="smp-check smp-web-row"><input type="checkbox" class="smp-web"> <span></span></label>' +
      '    <p class="smp-web-note"></p>' +
      '    <div class="smp-folder-btns">' +
      '      <a class="smp-help" target="_blank" rel="noopener"></a>' +
      '      <button type="button" class="smp-text-btn" data-act="sp-disconnect"></button>' +
      '      <button type="button" class="smp-text-btn smp-primary" data-act="sp-connect"></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="smp-jfset" hidden>' +
      '    <label class="smp-label smp-jf-label"></label>' +
      '    <input type="text" class="smp-path smp-jf-server" spellcheck="false" autocomplete="off" dir="ltr">' +
      '    <p class="smp-note smp-jf-note" hidden></p>' +
      '    <div class="smp-jf-wait" hidden><p class="smp-web-note smp-jf-how"></p><div class="smp-jf-code" dir="ltr"></div></div>' +
      '    <div class="smp-account smp-jf-account" hidden></div>' +
      '    <div class="smp-folder-btns">' +
      '      <a class="smp-help smp-jf-help" target="_blank" rel="noopener"></a>' +
      '      <button type="button" class="smp-text-btn" data-act="jf-disconnect"></button>' +
      '      <button type="button" class="smp-text-btn smp-primary" data-act="jf-connect"></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="smp-listbox" hidden>' +
      '    <div class="smp-sp-head" hidden>' +
      '      <button type="button" class="smp-btn smp-small" data-act="sp-back">' + icon('back') + '</button>' +
      '      <span class="smp-sp-name"></span>' +
      '    </div>' +
      '    <input type="search" class="smp-search" spellcheck="false" autocomplete="off" dir="auto">' +
      '    <div class="smp-list"></div>' +
      '  </div>' +
      '</div></div>';

    ['heading', 'title', 'sub', 'seek', 'dur', 'vol', 'msg', 'folder', 'path', 'dirs', 'recursive', 'listbox', 'search', 'list', 'art', 'label']
      .forEach(function (k) { el[k] = root.querySelector('.smp-' + k); });
    el.time = root.querySelector('.smp-time');
    el.play = root.querySelector('[data-act="play"]');
    el.shuffle = root.querySelector('[data-act="shuffle"]');
    el.repeat = root.querySelector('[data-act="repeat"]');
    el.mute = root.querySelector('[data-act="mute"]');
    el.listBtn = root.querySelector('[data-act="list"]');
    el.folderBtn = root.querySelector('[data-act="folder"]');
    el.nextBtn = root.querySelector('[data-act="next-up"]');
    el.upnext = root.querySelector('.smp-upnext');
    el.nlist = root.querySelector('.smp-nlist');
    el.settingsBtn = root.querySelector('[data-act="settings"]');
    ['info', 'pop', 'like', 'device', 'devices', 'spset', 'https', 'cid', 'uri', 'account', 'help', 'controls', 'volume', 'web', 'web-row', 'web-note',
      'jfset', 'jf-server', 'jf-note', 'jf-wait', 'jf-how', 'jf-code', 'jf-account', 'jf-help']
      .forEach(function (k) { el[k.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = root.querySelector('.smp-' + k); });
    el.devList = root.querySelector('.smp-dev-list');
    el.spHead = root.querySelector('.smp-sp-head');
    el.spName = root.querySelector('.smp-sp-name');
    el.src = root.querySelectorAll('.smp-src');

    root.addEventListener('click', onClick);
    el.seek.addEventListener('input', function () {
      seeking = true;
      var d = state.source === 'spotify' ? (sp.playback ? sp.playback.duration / 1000 : 0) : state.source === 'jellyfin' ? jfDuration() : audio.duration;
      if (d) el.time.textContent = fmt(el.seek.value / 1000 * d);
    });
    el.seek.addEventListener('change', function () {
      seeking = false;
      if (state.source === 'spotify') {
        if (sp.playback && sp.playback.duration) spSeek(el.seek.value / 1000 * sp.playback.duration);
        return;
      }
      if (state.source === 'jellyfin') {
        if (jfDuration()) jfSeek(el.seek.value / 1000 * jfDuration());
        return;
      }
      if (audio.duration) audio.currentTime = el.seek.value / 1000 * audio.duration;
    });
    el.vol.addEventListener('input', function () {
      if (state.source === 'spotify') return spVolume(Number(el.vol.value));
      state.volume = el.vol.value / 100;
      audio.volume = jfAudio.volume = state.volume;
      if (state.muted && state.volume > 0) { state.muted = false; audio.muted = jfAudio.muted = false; }
      renderButtons();
      save();
    });
    el.path.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') browse(el.path.value.trim());
    });
    el.path.addEventListener('change', function () { browse(el.path.value.trim()); });
    el.search.addEventListener('input', function () {
      state.search = el.search.value;
      el.list.scrollTop = 0;
      if (state.source === 'spotify') {
        searchSpotify();
        if (state.search) more();
      } else if (state.source === 'jellyfin') {
        jf.shown = JF_SHOWN;
        jfSearch();
      }
      renderList();
    });
    // Enter plays the first result
    el.search.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (state.source === 'spotify') {
        var row = el.list.querySelector('[data-act="sp-row"]');
        if (row) row.click();
        return;
      }
      if (state.source === 'jellyfin') {
        var jr = el.list.querySelector('[data-act="jf-row"][data-track]') || el.list.querySelector('[data-act="jf-row"]');
        if (jr) jr.click();
        return;
      }
      var first = el.list.querySelector('[data-act="track"]');
      if (first) playIndex(Number(first.getAttribute('data-index')));
    });
    // The open playlist's next page when its end comes into view
    el.list.addEventListener('scroll', function () {
      if (el.list.scrollTop + el.list.clientHeight < el.list.scrollHeight - 120) return;
      if (state.source === 'spotify' && sp.open) more();
      else if (state.source === 'jellyfin') {
        if (jf.cut) {
          jf.shown += JF_SHOWN;
          renderList();
        } else if (jf.stack.length) jfMore();
      }
    }, { passive: true });
    el.cid.addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(el.cid.value); });
    el.jfServer.addEventListener('keydown', function (e) { if (e.key === 'Enter') jfConnect(); });
    el.jfServer.addEventListener('input', function () { jf.typed = el.jfServer.value; });
    // Play in this browser: at once (switching it off and on also tries again after a failure)
    el.web.addEventListener('change', function () {
      state.web = el.web.checked;
      web.failed = '';
      save();
      webSync();
      render();
    });
  }

  var seeking = false;

  // Spotify mode's buttons (the others are the local player's)
  var SP_ACTS = {
    play: spToggle, next: spNext, prev: spPrev, shuffle: spShuffle, repeat: spRepeat, mute: spMute, like: toggleLike,
    list: function () {
      state.showList = !state.showList;
      state.showDevices = state.showSettings = state.showNext = false;
      state.search = el.search.value = '';
      sp.results = [];
      sp.resultsFor = '';
      if (state.showList) loadPlaylists();
      render();
    },
    devices: function () {
      if (!state.showDevices) return openDevices();
      state.showDevices = false;
      render();
    },
    settings: function () {
      state.showSettings = !state.showSettings;
      state.showList = state.showDevices = state.showNext = false;
      render();
    },
    info: function () {
      sp.info = !sp.info;
      render();
    },
    'sp-connect': function () { connect(el.cid.value); },
    'sp-disconnect': forget,
    'sp-copy': function (btn) {
      var done = function () {
        sp.copiedAt = Date.now();
        render();
        setTimeout(render, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(redirectUri()).then(done, function () {});
      else {
        el.uri.select();
        try { if (document.execCommand('copy')) done(); } catch (err) { /* select it by hand */ }
      }
    },
    'sp-back': function () {
      sp.open = null;
      state.search = el.search.value = '';
      sp.results = [];
      sp.resultsFor = '';
      el.list.scrollTop = 0;
      render();
    },
    'sp-row': function (btn) {
      var r = sp.rows[Number(btn.getAttribute('data-i'))];
      if (!r) return;
      if (r.kind === 'track') playRow(r);
      else openList(r);
    },
    'sp-queue': function (btn) {
      var r = sp.rows[Number(btn.getAttribute('data-i'))];
      if (r) queueRow(r);
    },
    device: function (btn) { useDevice(btn.getAttribute('data-id')); },
    'sp-here': function () { playHere(); }
  };
  var SP_FREE = { settings: 1, info: 1, 'sp-connect': 1, 'sp-copy': 1, 'sp-disconnect': 1 };

  // Jellyfin mode's buttons (shuffle, repeat and the volume are the local player's)
  var JF_ACTS = {
    play: jfToggle, next: function () { jfNext(false); }, prev: jfPrev, like: jfFavorite,
    list: function () {
      state.showList = !state.showList;
      state.showNext = state.showSettings = false;
      state.search = el.search.value = '';
      jf.results = [];
      jf.resultsFor = '';
      jf.shown = JF_SHOWN;
      if (state.showList) jfLoadRoot();
      render();
    },
    settings: function () {
      state.showSettings = !state.showSettings;
      state.showList = state.showNext = false;
      if (!state.showSettings) jfCancelCode();
      render();
    },
    'jf-connect': function () {
      if (!jf.qc) return jfConnect();
      jfCancelCode();
      render();
    },
    'jf-disconnect': jfForget,
    'sp-back': function () {
      jf.stack.pop();
      state.search = el.search.value = '';
      jf.results = [];
      jf.resultsFor = '';
      jf.shown = JF_SHOWN;
      var lv = jf.stack[jf.stack.length - 1];
      if (lv && lv.paged && lv.search) {   // its search is gone with the box's text
        lv.search = '';
        lv.rows = [];
        lv.total = null;
        lv.failed = false;
        jfMore(lv);
      }
      el.list.scrollTop = 0;
      render();
    },
    'jf-row': function (btn) {
      var r = jf.rows[Number(btn.getAttribute('data-i'))];
      if (!r) return;
      if (r.kind === 'track') jfPick(r);
      else jfOpen(r);
    },
    'jf-queue': function (btn) {
      var r = jf.rows[Number(btn.getAttribute('data-i'))];
      if (r) jfQueue(r);
    }
  };
  var JF_FREE = { settings: 1, 'jf-connect': 1, 'jf-disconnect': 1 };

  function onClick(e) {
    var btn = e.target.closest('[data-act]');
    if (btn) {
      var act = btn.getAttribute('data-act');
      if (act === 'source') return setSource(btn.getAttribute('data-src'));
      if (act === 'next-up') {
        state.showNext = !state.showNext;
        state.showList = state.showFolder = state.showDevices = state.showSettings = false;
        if (state.showNext && state.source === 'spotify') {
          if (!connected()) {
            state.showNext = false;
            state.showSettings = true;
          } else loadNext();
        }
        if (state.showNext && state.source === 'jellyfin' && !jfOn()) {
          state.showNext = false;
          state.showSettings = true;
        }
        return render();
      }
      if (state.source === 'jellyfin' && /^nx-/.test(act)) {
        var k = Number(btn.getAttribute('data-index'));
        if (act === 'nx-unqueue') {
          jf.queue.splice(k, 1);
          save();
          return render();
        }
        if (btn.hasAttribute('data-queued')) return jfPlay(jf.queue.splice(k, 1)[0]);
        return jfPlayIndex(k);
      }
      if (act === 'nx-play') return playIndex(Number(btn.getAttribute('data-index')), btn.hasAttribute('data-queued'));
      if (act === 'nx-unqueue') return toggleQueue(Number(btn.getAttribute('data-index')));
      if (act === 'nx-jump') return jumpTo(Number(btn.getAttribute('data-k')));
      if (state.source === 'spotify' && SP_ACTS[act]) {
        // not connected yet: everything leads to the settings
        if (!connected() && !SP_FREE[act]) {
          state.showSettings = true;
          state.showList = state.showDevices = state.showNext = false;
          return render();
        }
        // a click lets the player here make sound (some browsers want it from a click)
        if (web.player) webDo('activateElement');
        return SP_ACTS[act](btn);
      }
      if (state.source === 'jellyfin' && JF_ACTS[act]) {
        if (!jfOn() && !JF_FREE[act]) {
          state.showSettings = true;
          state.showList = state.showNext = false;
          return render();
        }
        return JF_ACTS[act](btn);
      }
      if (act === 'play') togglePlay();
      else if (act === 'next') step(1, false);
      else if (act === 'prev') prev();
      else if (act === 'shuffle') { state.shuffle = !state.shuffle; buildOrder(); jfOrder(); save(); render(); }
      else if (act === 'repeat') {
        state.repeat = state.repeat === 'all' ? 'one' : state.repeat === 'one' ? 'off' : 'all';
        save();
        render();
      } else if (act === 'mute') { state.muted = !state.muted; audio.muted = jfAudio.muted = state.muted; save(); render(); }
      else if (act === 'list') {
        state.showList = !state.showList;
        state.showFolder = state.showNext = false;
        state.search = el.search.value = '';
        listScrolledTo = -1;
        render();
      }
      else if (act === 'folder') {
        state.showFolder = !state.showFolder;
        state.showList = state.showNext = false;
        if (state.showFolder) browse(state.folder);
        render();
      } else if (act === 'up') browse(el.path.value.replace(/\/[^/]+\/?$/, '') || '/');
      else if (act === 'cancel') { state.showFolder = false; render(); }
      else if (act === 'use') {
        state.folder = el.path.value.trim() || DEFAULT_FOLDER;
        state.recursive = el.recursive.checked;
        state.showFolder = false;
        state.index = -1;
        state.current = null;
        state.queue = [];
        pendingQueue = null;
        audio.pause();
        audio.removeAttribute('src');
        save();
        scan();
      } else if (act === 'dir') browse(btn.getAttribute('data-path'));
      else if (act === 'track') playIndex(Number(btn.getAttribute('data-index')));
      else if (act === 'queue') toggleQueue(Number(btn.getAttribute('data-index')));
      return;
    }
  }

  // Folder picker: lists the subfolders of the typed path
  var browseId = 0;
  function browse(path) {
    if (!path) return;
    var id = ++browseId;
    state.browsePath = path;
    el.path.value = path;
    el.dirs.textContent = t('scanning');
    listFolder(path).then(function (entries) {
      if (id !== browseId) return;
      var dirs = entries.filter(function (e) { return e && e.is_dir && e.name.charAt(0) !== '.'; }).sort(byName);
      var audioCount = entries.filter(function (e) { return e && !e.is_dir && AUDIO_EXT.test(e.name); }).length;
      el.dirs.innerHTML = '';
      dirs.slice(0, 200).forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'smp-dir';
        b.setAttribute('data-act', 'dir');
        b.setAttribute('data-path', d.path);
        b.innerHTML = icon('folder') + '<span></span>';
        b.querySelector('span').textContent = d.name;
        el.dirs.appendChild(b);
      });
      var info = document.createElement('div');
      info.className = 'smp-dir-info';
      info.textContent = trackCount(audioCount);
      el.dirs.appendChild(info);
    }, function () {
      if (id === browseId) el.dirs.textContent = t('folderError');
    });
  }

  // Every word of the search must be in the title or the folder name
  function matches(tr, words) {
    for (var w = 0; w < words.length; w++) if (tr.key.indexOf(words[w]) < 0) return false;
    return true;
  }

  function renderList() {
    if (!state.showList) return;
    if (state.source === 'spotify') return renderSpotifyList();
    if (state.source === 'jellyfin') return renderJellyfinList();
    var words = fold(state.search).split(/\s+/).filter(Boolean);
    var shown = [], html = '';
    state.tracks.forEach(function (tr, i) {
      if (words.length && !matches(tr, words)) return;
      shown.push(i);
      var q = state.queue.indexOf(i);
      html += '<div class="smp-track' + (i === state.index ? ' smp-current' : '') + '">' +
        '<button type="button" class="smp-track-play" data-act="track" data-index="' + i + '">' +
        '<span class="smp-track-n">' + (i + 1) + '</span><span class="smp-track-t"></span></button>' +
        '<button type="button" class="smp-queue' + (q >= 0 ? ' smp-on' : '') + '" data-act="queue" data-index="' + i + '">' +
        (q >= 0 ? q + 1 : icon('queue')) + '</button></div>';
    });
    if (!shown.length && state.tracks.length) html = '<div class="smp-none"></div>';
    el.list.innerHTML = html;
    var none = el.list.querySelector('.smp-none');
    if (none) none.textContent = t('noMatch');
    var titles = el.list.querySelectorAll('.smp-track-t'), qs = el.list.querySelectorAll('.smp-queue');
    for (var i = 0; i < shown.length; i++) {
      titles[i].textContent = state.tracks[shown[i]].title;
      qs[i].title = qs[i].classList.contains('smp-on') ? t('queueRemove') : t('queueAdd');
    }
    // Keep the current track visible by scrolling the list only (scrollIntoView
    // would scroll the whole CasaOS dashboard), and only when it changes
    var cur = el.list.querySelector('.smp-current');
    if (cur && listScrolledTo !== state.index) {
      listScrolledTo = state.index;
      var top = cur.offsetTop - el.list.offsetTop, bottom = top + cur.offsetHeight;
      if (top < el.list.scrollTop) el.list.scrollTop = top;
      else if (bottom > el.list.scrollTop + el.list.clientHeight) el.list.scrollTop = bottom - el.list.clientHeight;
    }
  }
  var listScrolledTo = -1;

  // Spotify's list: Liked Songs and the playlists (with the catalog's results
  // while searching), or the open one's tracks
  function renderSpotifyList() {
    var o = sp.open, words = fold(state.search).split(/\s+/).filter(Boolean), cur = sp.playback && sp.playback.uri;
    var rows = [], html = '', results = [];
    var hit = function (r) { return matches(r, words); };
    if (o) {
      rows = o.tracks.filter(hit);
    } else {
      if (!auth.off.liked) rows.push({ kind: 'liked', name: t('spLiked'), key: fold(t('spLiked')) });
      rows = rows.concat(sp.playlists || []).filter(hit);
      if (words.length && sp.resultsFor) results = sp.results;
    }
    sp.rows = rows.concat(results);
    function line(r, i) {
      var track = r.kind === 'track';
      var q = track && sp.queued[r.uri];
      return '<div class="smp-track' + (track && r.uri === cur ? ' smp-current' : '') + (r.local ? ' smp-off' : '') + '">' +
        '<button type="button" class="smp-track-play" data-act="sp-row" data-i="' + i + '">' +
        (track ? '<span class="smp-track-n">' + (i < rows.length ? i + 1 : '') + '</span>'
          : '<span class="smp-pl-img' + (r.kind === 'liked' ? ' smp-liked-img' : '') + '"></span>') +
        '<span class="smp-track-t"></span><span class="smp-track-s"></span></button>' +
        (track && !r.local ? '<button type="button" class="smp-queue' + (q ? ' smp-on' : '') + '" data-act="sp-queue" data-i="' + i + '">' +
          icon(q ? 'check' : 'queue') + '</button>' : '') + '</div>';
    }
    rows.forEach(function (r, i) { html += line(r, i); });
    if (results.length) {
      html += '<div class="smp-section"></div>';
      results.forEach(function (r, k) { html += line(r, rows.length + k); });
    }
    var note = '';
    if (o && o.failed && !o.tracks.length) note = t('spCantOpen');
    else if ((o ? o.loading : sp.playlistsLoading) && !rows.length) note = t('spLoading');
    else if (!rows.length && !results.length) note = words.length ? t('noMatch') : '';
    if (note) html += '<div class="smp-none"></div>';
    el.list.innerHTML = html;
    var none = el.list.querySelector('.smp-none');
    if (none) none.textContent = note;
    var sec = el.list.querySelector('.smp-section');
    if (sec) sec.textContent = t('spOnSpotify');
    var titles = el.list.querySelectorAll('.smp-track-t'), subs = el.list.querySelectorAll('.smp-track-s');
    var imgs = el.list.querySelectorAll('.smp-pl-img'), qs = el.list.querySelectorAll('.smp-queue'), n = 0;
    sp.rows.forEach(function (r, i) {
      titles[i].textContent = r.name;
      subs[i].textContent = r.kind === 'track' ? r.artist : r.count != null ? trackCount(r.count) : '';
      if (r.kind === 'playlist' && r.image && imgs[n]) imgs[n].style.backgroundImage = 'url("' + r.image.replace(/"/g, '%22') + '")';
      if (r.kind !== 'track') n++;
    });
    for (var k = 0; k < qs.length; k++) qs[k].title = qs[k].classList.contains('smp-on') ? t('spQueued') : t('queueAdd');
    var liked = el.list.querySelector('.smp-liked-img');
    if (liked) liked.innerHTML = icon('heart');
  }

  // Jellyfin's list: the first level (with Jellyfin's search results while
  // searching), or the open list's rows
  var JF_ICON = { songs: 'note', favs: 'heart', albums: 'disc', artists: 'person', album: 'disc', artist: 'person', playlist: 'list' };
  function renderJellyfinList() {
    var lv = jf.stack[jf.stack.length - 1], words = fold(state.search).split(/\s+/).filter(Boolean), cur = jf.now && jf.now.id;
    var hit = function (r) { return matches(r, words); }, rows, results = [], html = '';
    if (lv) rows = lv.paged ? lv.rows : lv.rows.filter(hit);   // albums and artists are searched on the server
    else {
      rows = jfRoot().filter(hit);
      if (words.length && jf.resultsFor) results = jf.results;
    }
    jf.cut = rows.length > jf.shown;   // a long list: its first rows, more as it scrolls
    if (jf.cut) rows = rows.slice(0, jf.shown);
    jf.rows = rows.concat(results);
    function line(r, i) {
      var track = r.kind === 'track', q = track ? jfQueued(r.id) : -1;
      return '<div class="smp-track' + (track && r.id === cur ? ' smp-current' : '') + '">' +
        '<button type="button" class="smp-track-play" data-act="jf-row" data-i="' + i + '"' + (track ? ' data-track' : '') + '>' +
        (track ? '<span class="smp-track-n">' + (i < rows.length ? i + 1 : '') + '</span>' : '<span class="smp-pl-img"></span>') +
        '<span class="smp-track-t"></span><span class="smp-track-s"></span></button>' +
        (track ? '<button type="button" class="smp-queue' + (q >= 0 ? ' smp-on' : '') + '" data-act="jf-queue" data-i="' + i + '">' +
          (q >= 0 ? q + 1 : icon('queue')) + '</button>' : '') + '</div>';
    }
    rows.forEach(function (r, i) { html += line(r, i); });
    if (results.length) {
      html += '<div class="smp-section"></div>';
      results.forEach(function (r, k) { html += line(r, rows.length + k); });
    }
    var note = '';
    if (lv && lv.failed && !lv.rows.length) note = t('jfError');
    else if ((lv ? lv.loading : jf.playlistsLoading && !jf.playlists) && !rows.length) note = t('spLoading');
    else if (!rows.length && !results.length) note = t('noMatch');
    if (note) html += '<div class="smp-none"></div>';
    el.list.innerHTML = html;
    var none = el.list.querySelector('.smp-none');
    if (none) none.textContent = note;
    var sec = el.list.querySelector('.smp-section');
    if (sec) sec.textContent = t('jfOn');
    var titles = el.list.querySelectorAll('.smp-track-t'), subs = el.list.querySelectorAll('.smp-track-s');
    var imgs = el.list.querySelectorAll('.smp-pl-img'), qs = el.list.querySelectorAll('.smp-queue'), n = 0;
    jf.rows.forEach(function (r, i) {
      titles[i].textContent = r.name;
      subs[i].textContent = r.kind === 'track' ? r.artist : r.count != null ? trackCount(r.count) : r.sub || '';
      if (r.kind === 'track') return;
      var box = imgs[n++];
      if (!r.image) return (box.innerHTML = icon(JF_ICON[r.kind] || 'list'));
      var img = document.createElement('img');   // only the pictures scrolled into view load
      img.loading = 'lazy';
      img.alt = '';
      img.src = jfImg(r.image, 96);
      box.appendChild(img);
    });
    for (var k = 0; k < qs.length; k++) qs[k].title = qs[k].classList.contains('smp-on') ? t('queueRemove') : t('queueAdd');
  }

  function renderButtons() {
    if (state.source === 'spotify') return renderSpotifyButtons();
    var paused = player().paused, jelly = state.source === 'jellyfin';
    el.play.innerHTML = icon(paused ? 'play' : 'pause');
    el.play.title = paused ? t('play') : t('pause');
    el.shuffle.classList.toggle('smp-on', state.shuffle);
    el.shuffle.title = t('shuffle');
    el.repeat.innerHTML = state.repeat === 'one'
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS.repeat + ICONS.one + '</svg>'
      : icon('repeat');
    el.repeat.classList.toggle('smp-on', state.repeat !== 'off');
    el.repeat.title = state.repeat === 'all' ? t('repeatAll') : state.repeat === 'one' ? t('repeatOne') : t('repeatOff');
    el.mute.innerHTML = icon(state.muted || state.volume === 0 ? 'mute' : 'volume');
    el.mute.title = t('volume');
    root.querySelector('[data-act="next"]').title = t('next');
    root.querySelector('[data-act="prev"]').title = t('prev');
    el.listBtn.title = jelly ? t('spLibrary') : t('playlist');
    el.folderBtn.title = t('change');
    el.listBtn.classList.toggle('smp-on', state.showList);
    el.folderBtn.classList.toggle('smp-on', state.showFolder);
    el.settingsBtn.title = t('jfSettings');
    el.settingsBtn.classList.toggle('smp-on', jelly && state.showSettings);
  }

  var REPEAT_SHOWN = { context: 'all', track: 'one', off: 'off' };
  function renderSpotifyButtons() {
    var p = sp.playback, playing = !!(p && p.playing), repeat = REPEAT_SHOWN[p ? p.repeat : 'off'] || 'off';
    var dev = p && p.device, vol = dev && dev.volumeOk ? dev.volume : null;
    el.play.innerHTML = icon(playing ? 'pause' : 'play');
    el.play.title = playing ? t('pause') : t('play');
    el.shuffle.classList.toggle('smp-on', !!(p && p.shuffle));
    el.shuffle.title = t('shuffle');
    el.repeat.innerHTML = repeat === 'one'
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS.repeat + ICONS.one + '</svg>'
      : icon('repeat');
    el.repeat.classList.toggle('smp-on', repeat !== 'off');
    el.repeat.title = repeat === 'all' ? t('repeatAll') : repeat === 'one' ? t('repeatOne') : t('repeatOff');
    el.mute.innerHTML = icon(vol === 0 ? 'mute' : 'volume');
    el.mute.title = t('volume');
    el.vol.disabled = el.mute.disabled = vol == null;
    if (vol != null && document.activeElement !== el.vol) el.vol.value = vol;
    root.querySelector('[data-act="next"]').title = t('next');
    root.querySelector('[data-act="prev"]').title = t('prev');
    el.listBtn.title = t('spLibrary');

    el.settingsBtn.title = t('spSettings');
    el.listBtn.classList.toggle('smp-on', state.showList);

    el.settingsBtn.classList.toggle('smp-on', state.showSettings);
    el.like.hidden = !(p && isTrack(p.uri) && sp.liked != null && !auth.off.like);
    el.like.classList.toggle('smp-on', !!sp.liked);
    el.like.title = sp.liked ? t('spUnlike') : t('spLike');
  }

  function updateProgress() {
    if (!root) return;
    var spotify = state.source === 'spotify', jelly = state.source === 'jellyfin', p = sp.playback;
    var d = spotify ? (p ? p.duration / 1000 : 0) : jelly ? jfDuration() : audio.duration;
    var c = spotify ? position() / 1000 : jelly ? jfTime() : audio.currentTime;
    el.dur.textContent = fmt(d);
    if (!seeking) {
      el.time.textContent = fmt(c);
      el.seek.value = d ? Math.round(c / d * 1000) : 0;
    }
  }

  function render() {
    if (!root) return;
    var spotify = state.source === 'spotify', jelly = state.source === 'jellyfin', local = !spotify && !jelly;
    var l = lang();
    if (root.lang !== l) {
      root.lang = l;
      root.dir = l === 'ar' ? 'rtl' : 'ltr';   // the texts and lists follow the language
    }
    root.setAttribute('data-source', state.source);
    root.classList.toggle('smp-free', spotify && auth.premium === false);
    for (var i = 0; i < el.src.length; i++) {
      var mine = el.src[i].getAttribute('data-src') === state.source;
      el.src[i].classList.toggle('smp-on', mine);
      el.src[i].setAttribute('aria-pressed', String(mine));
      var src = el.src[i].getAttribute('data-src');
      el.src[i].title = src === 'spotify' ? 'Spotify' : src === 'jellyfin' ? 'Jellyfin' : t('srcLocal');
    }
    el.heading.textContent = spotify ? 'Spotify' : jelly ? 'Jellyfin' : t('title');
    el.folderBtn.hidden = !local;
    el.settingsBtn.hidden = local;
    el.nextBtn.hidden = spotify && !!auth.off.queue;
    el.nextBtn.title = t('upNext');
    el.nextBtn.classList.toggle('smp-on', state.showNext);
    el.upnext.hidden = !state.showNext;

    if (spotify) renderSpotifyNow();
    else if (jelly) renderJellyfinNow();
    else {
      var tr = state.tracks[state.index];
      var info = (tr && tr.info) || {};
      el.title.textContent = tr ? info.title || tr.title : t('nothing');
      var by = [info.artist, info.album].filter(Boolean).join(' — ');
      el.sub.textContent = tr ? (by || tr.album || state.folder) : (state.tracks.length ? trackCount(state.tracks.length) + ' · ' + t('pick') : state.folder);
      el.art.classList.toggle('smp-playing', !audio.paused);
      setCover(info.cover);
      el.vol.value = Math.round(state.volume * 100);
      el.vol.disabled = el.mute.disabled = false;
      el.msg.hidden = !state.message;
      el.msg.textContent = state.message;
      el.like.hidden = el.device.hidden = el.info.hidden = el.pop.hidden = true;
      el.seek.disabled = false;
    }
    el.folder.hidden = !local || !state.showFolder;
    el.devices.hidden = !(spotify && state.showDevices);
    el.spset.hidden = !(spotify && state.showSettings);
    el.jfset.hidden = !(jelly && state.showSettings);
    el.listbox.hidden = !state.showList;
    var lv = jelly ? jf.stack[jf.stack.length - 1] : null, open = spotify ? sp.open : lv;
    el.spHead.hidden = !open;
    if (open) el.spName.textContent = open.name;
    el.search.placeholder = spotify && !sp.open ? t('spSearch') : jelly && (!lv || lv.paged) ? t('jfSearch') : t('search');
    el.search.setAttribute('aria-label', el.search.placeholder);
    el.label.textContent = t('folder');
    el.recursive.checked = state.recursive;
    el.recursive.nextElementSibling.textContent = t('subfolders');
    root.querySelector('[data-act="use"]').textContent = t('use');
    root.querySelector('[data-act="cancel"]').textContent = t('cancel');
    root.querySelector('[data-act="up"]').title = t('up');
    root.querySelector('[data-act="sp-back"]').title = t('spBack');
    renderButtons();
    renderList();
    renderNext();
    updateProgress();
  }

  // "Up next": what plays now, then what comes (local: the queue, then the
  // playlist in play order; Spotify: its queue)
  function nextRow(n, title, sub, act, data, extra) {
    var row = document.createElement('div');
    row.className = 'smp-track';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'smp-track-play';
    if (act) b.setAttribute('data-act', act);
    Object.keys(data || {}).forEach(function (k) { b.setAttribute('data-' + k, data[k]); });
    b.innerHTML = '<span class="smp-track-n"></span><span class="smp-track-t"></span><span class="smp-track-s"></span>';
    b.children[0].textContent = n;
    b.children[1].textContent = title;
    b.children[2].textContent = sub || '';
    row.appendChild(b);
    if (extra) row.appendChild(extra);
    return row;
  }

  function nextSection(text) {
    var d = document.createElement('div');
    d.className = 'smp-section';
    d.textContent = text;
    return d;
  }

  function renderNext() {
    if (!root || !state.showNext) return;
    var box = el.nlist, spotify = state.source === 'spotify', added = 0;
    box.textContent = '';
    if (spotify) {
      var nx = sp.next;
      if (nx && nx.now) {
        box.appendChild(nextSection(t('playingNow')));
        box.appendChild(nextRow('', nx.now.name, nx.now.artist)).classList.add('smp-current');
      }
      box.appendChild(nextSection(t('upNext')));
      ((nx && nx.list) || []).forEach(function (r, k) {
        var row = nextRow(k + 1, r.name, r.artist, 'nx-jump', { k: k });
        row.firstChild.title = t('jump');
        if (sp.jumping) row.firstChild.disabled = true;
        box.appendChild(row);
        added++;
      });
      if (!added) {
        var none = document.createElement('div');
        none.className = 'smp-none';
        none.textContent = sp.nextLoading ? t('spLoading') : t('nothingNext');
        box.appendChild(none);
      }
      return;
    }
    // Jellyfin: its queue holds the tracks themselves (data-index: their place in it)
    var jelly = state.source === 'jellyfin', list = jelly ? jf.tracks : state.tracks, cur = jelly ? jf.now : list[state.index];
    var name = function (tr) { return jelly ? tr.name : (tr.info && tr.info.title) || tr.title; };
    var by = function (tr) { return jelly ? tr.artist : (tr.info && tr.info.artist) || tr.album; };
    if (cur) {
      box.appendChild(nextSection(t('playingNow')));
      box.appendChild(nextRow('', name(cur), by(cur))).classList.add('smp-current');
    }
    box.appendChild(nextSection(t('upNext')));
    (jelly ? jf.queue : state.queue).forEach(function (q, k) {
      var tr = jelly ? q : list[q];
      if (!tr) return;
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'smp-queue';
      x.setAttribute('data-act', 'nx-unqueue');
      x.setAttribute('data-index', jelly ? k : q);
      x.title = t('queueRemove');
      x.textContent = '✕';
      var row = nextRow(k + 1, jelly ? tr.name : tr.title, jelly ? tr.artist : tr.album, 'nx-play', { index: jelly ? k : q, queued: 1 }, x);
      row.classList.add('smp-queued');
      box.appendChild(row);
      added++;
    });
    // then the playlist, from where it goes on (around again when repeating)
    var order = jelly ? jf.order : state.order, at = jelly ? jf.index : state.context >= 0 ? state.context : state.index;
    var n = order.length, from = order.indexOf(at);
    for (var k = 1, shown = 0; k < n + 1 && shown < 20; k++) {
      var p = from + k;
      if (p >= n) {
        if (state.repeat === 'off' && from >= 0) break;
        p %= n;
      }
      var i = order[p], tr = list[i];
      if (!tr || tr === cur || (jelly ? jfQueued(tr.id) >= 0 : state.queue.indexOf(i) >= 0)) continue;
      box.appendChild(nextRow('', jelly ? tr.name : tr.title, jelly ? tr.artist : tr.album, 'nx-play', { index: i }));
      shown++;
      added++;
    }
    if (!added) {
      var empty = document.createElement('div');
      empty.className = 'smp-none';
      empty.textContent = t('nothingNext');
      box.appendChild(empty);
    }
  }

  function setCover(url) {
    var cover = url ? 'url("' + url.replace(/"/g, '%22') + '")' : '';
    if (el.art.style.backgroundImage !== cover) el.art.style.backgroundImage = cover;
    el.art.classList.toggle('smp-cover', !!url);
  }

  // Spotify mode: what plays, the device, the settings and the free account's (i)
  function renderSpotifyNow() {
    var p = sp.playback, on = connected();
    if (!on) {
      el.title.textContent = t('spNotConnected');
      el.sub.textContent = t('spConnectHint');
    } else if (!p || !p.uri) {
      el.title.textContent = t('spNothing');
      el.sub.textContent = t('spOpenApp');
    } else {
      el.title.textContent = p.title;
      el.sub.textContent = [p.artist, p.album].filter(Boolean).join(' — ');
    }
    el.art.classList.toggle('smp-playing', !!(p && p.playing));
    setCover(p && p.cover);
    el.seek.disabled = !p || !p.duration || auth.premium === false;
    el.msg.hidden = !sp.message;
    el.msg.textContent = sp.message;

    el.device.hidden = !on;
    el.device.querySelector('span').textContent = p && p.device ? t('spOn').replace('{name}', p.device.name) : t('spDevices');
    el.device.title = t('spDevices');

    var free = auth.premium === false;
    el.info.hidden = !(on && free);
    el.info.title = t('spFreeShort');
    el.info.setAttribute('aria-expanded', String(sp.info && free));
    el.pop.hidden = !(sp.info && free);
    if (!el.pop.hidden) el.pop.textContent = t('spFreeInfo');

    // Devices: this browser first (unless another CasaOS tab is it), then Spotify's list
    el.devices.querySelector('.smp-dev-label').textContent = t('spDevices');
    var canWeb = on && webSupported() && auth.premium !== false;
    if (state.showDevices) {
      var here = canWeb && !(web.asked && !web.held), cur = p && p.device ? p.device.id : null, html = '';
      var list = (sp.devices || []).filter(function (d) { return !web.id || d.id !== web.id; });
      if (here) html += '<button type="button" class="smp-dir smp-dev smp-here' + (cur && cur === web.id ? ' smp-current' : '') + '" data-act="sp-here">' +
        icon('device') + '<span></span></button>';
      list.forEach(function (d) {
        html += '<button type="button" class="smp-dir smp-dev' + (d.id === cur || d.is_active ? ' smp-current' : '') + '" data-act="device" data-id="' +
          String(d.id || '').replace(/[^\w-]/g, '') + '"' + (d.is_restricted || !d.id ? ' disabled' : '') + '>' + icon('device') + '<span></span></button>';
      });
      if (!list.length) html += '<div class="smp-dir-info"></div>';
      el.devList.innerHTML = html;
      if (here) el.devList.querySelector('.smp-here span').textContent = t('spThisBrowser') + (web.on && !web.ready ? ' …' : '');
      var names = el.devList.querySelectorAll('[data-act="device"] span');
      list.forEach(function (d, k) { if (names[k]) names[k].textContent = d.name || d.type || '?'; });
      if (!list.length) el.devList.querySelector('.smp-dir-info').textContent = sp.devicesLoading || !sp.devices ? t('spLoading') : t('spNoDevices');
    }

    // Settings
    el.https.hidden = secure() || on;
    el.https.textContent = t('spHttps');
    root.querySelector('.smp-cid-label').textContent = t('spClientId');
    root.querySelector('.smp-uri-label').textContent = t('spRedirect');
    if (document.activeElement !== el.cid) el.cid.value = auth.clientId || '';
    el.uri.value = redirectUri();
    root.querySelector('[data-act="sp-copy"]').textContent = Date.now() - (sp.copiedAt || 0) < 1500 ? t('spCopied') : t('spCopy');
    el.account.hidden = !on;
    el.account.textContent = on && auth.user ? t('spConnectedAs').replace('{name}', auth.user.name) : '';
    el.help.textContent = t('spHelp');
    el.help.href = HELP;
    // Play in this browser: the switch, and how it goes
    var noScope = state.web && (web.failed === 'scope' || webScope() === false), note = '';
    el.webRow.hidden = !canWeb;
    el.web.checked = state.web;
    el.web.nextElementSibling.textContent = t('spWeb');
    if (canWeb) {
      if (!state.web) note = t('spWebHint');
      else if (noScope) note = t('spWebScope');
      else if (web.failed) note = t(WEB_SAYS[web.failed]);
      else if (web.ready) note = t('spWebReady').replace('{name}', webName());
      else if (web.asked && !web.held) note = t('spWebOther');
      else note = t('spWebStarting');
    }
    el.webNote.hidden = !note;
    el.webNote.textContent = note;
    el.webNote.classList.toggle('smp-warn', canWeb && state.web && (noScope || !!web.failed));
    var connectBtn = root.querySelector('[data-act="sp-connect"]'), disconnectBtn = root.querySelector('[data-act="sp-disconnect"]');
    connectBtn.textContent = t('spConnect');
    connectBtn.hidden = on && !(canWeb && noScope);   // connecting again gives the player its scope
    connectBtn.disabled = !secure();
    disconnectBtn.textContent = t('spDisconnect');
    disconnectBtn.hidden = !on;
  }

  // Jellyfin mode: what plays, the login and its settings
  function renderJellyfinNow() {
    var on = jfOn(), tr = jf.now;
    if (!on) {
      el.title.textContent = t('jfNotConnected');
      el.sub.textContent = t('spConnectHint');
    } else if (!tr) {
      el.title.textContent = t('nothing');
      el.sub.textContent = t('pick');
    } else {
      el.title.textContent = tr.name;
      el.sub.textContent = [tr.artist, tr.album].filter(Boolean).join(' — ');
    }
    el.art.classList.toggle('smp-playing', !!tr && !jfAudio.paused);
    setCover(tr ? jfImg(tr.image, 300) : '');
    el.vol.value = Math.round(state.volume * 100);
    el.vol.disabled = el.mute.disabled = false;
    el.seek.disabled = !tr;
    el.msg.hidden = !jf.message;
    el.msg.textContent = jf.message;
    el.device.hidden = el.info.hidden = el.pop.hidden = true;
    el.like.hidden = !(on && tr);
    el.like.classList.toggle('smp-on', !!(tr && tr.fav));
    el.like.title = tr && tr.fav ? t('jfUnfavorite') : t('jfFavorite');

    // Settings: the address, Quick Connect's code, the account
    root.querySelector('.smp-jf-label').textContent = t('jfServer');
    if (on || jf.typed == null) el.jfServer.value = jfBase();
    el.jfServer.disabled = on || !!jf.qc;
    el.jfNote.hidden = !jf.note;
    el.jfNote.textContent = jf.note;
    var code = jf.qc && jf.qc.code;
    el.jfWait.hidden = !code;
    el.jfHow.textContent = t('jfCode');
    el.jfCode.textContent = code || '';
    el.jfAccount.hidden = !on;
    el.jfAccount.textContent = on ? t('spConnectedAs').replace('{name}', jfAuth.user.name) : '';
    el.jfHelp.textContent = t('spHelp');
    el.jfHelp.href = JF_HELP;
    var connectBtn = root.querySelector('[data-act="jf-connect"]'), disconnectBtn = root.querySelector('[data-act="jf-disconnect"]');
    connectBtn.textContent = jf.qc ? t('cancel') : t('spConnect');
    connectBtn.hidden = on;
    disconnectBtn.textContent = t('spDisconnect');
    disconnectBtn.hidden = !on;
  }

  // Where the widget goes: where the widget-sortable mod last left it (Sortable
  // keeps the order in localStorage 'widget-sortable', widget ids joined by '|'),
  // otherwise first. That mod sorts only once, before this widget is added.
  function slot(container) {
    var order = (localStorage.getItem('widget-sortable') || '').split('|');
    var me = order.indexOf('music-player');
    var items = [].filter.call(container.children, function (c) {
      return c !== root && !/\bps__rail/.test(c.className);
    });
    var end = container.querySelector(':scope > .ps__rail-x, :scope > .ps__rail-y');
    if (me < 0) return items[0] || end;
    function find(id) {
      for (var j = 0; j < items.length; j++) if (items[j].getAttribute('widget-id') === id) return items[j];
      return null;
    }
    var k, w;
    for (k = me + 1; k < order.length; k++) if ((w = find(order[k]))) return w;
    for (k = me - 1; k >= 0; k--) if ((w = find(order[k]))) return w.nextSibling;
    // The other widgets aren't marked yet: the same position
    return items[me] || end;
  }

  // Keeps the widget in the CasaOS sidebar, re-adding it when Vue re-renders
  function mount() {
    var container = document.querySelector('.ps-container');
    if (!container) return;
    if (!root) {
      build();
      render();
      sharedPull().then(sharedChanged);   // the logins kept on the CasaOS server
      if (state.source === 'jellyfin' || jfOn()) jfPull().then(jfChanged);
    }
    if (root.parentNode !== container) container.insertBefore(root, slot(container));
  }

  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; mount(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });

  mount();
  scan();
  finishLogin();
  if (state.source === 'spotify' && connected()) {
    if (!auth.user) loadMe();
    poll();
  }
  webSync();
  if (state.source === 'jellyfin') jfRestore();
  console.info(TAG, 'loaded');

  // For other mods and debugging
  window.CasaMusicPlayer = {
    audio: audio,
    state: state,
    play: togglePlay,
    next: function () { step(1, false); },
    prev: prev,
    rescan: scan,
    readTags: readTags,
    source: setSource,
    spotify: {
      get playback() { return sp.playback; },
      get connected() { return connected(); },
      get premium() { return auth.premium; },
      connect: connect,
      disconnect: forget,
      refresh: poll,
      // this browser as a Spotify device
      get here() { return { on: state.web, ready: web.ready, active: web.active, device: web.id, failed: web.failed }; },
      playHere: function () { playHere(); }
    },
    jellyfin: {
      audio: jfAudio,
      get connected() { return jfOn(); },
      get playing() { return jf.now ? { id: jf.now.id, title: jf.now.name, artist: jf.now.artist, album: jf.now.album } : null; },
      disconnect: jfForget
    },
    get nowPlaying() {
      var tr = state.tracks[state.index];
      if (!tr) return null;
      var info = tr.info || {};
      return { path: tr.path, title: info.title || tr.title, artist: info.artist || '', album: info.album || '', cover: info.cover || null };
    }
  };
})();

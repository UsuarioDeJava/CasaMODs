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
  // Above the dashboard, below CasaOS's top bar (30: its menus open over the
  // windows) and its dialogs (40)
  var Z = 21, ZMAX = 29;
  var BAR = 34, MINW = 260, MINH = 160;

  // ---------------------------------------------------------------------------
  // Text, in every CasaOS language (follows CasaOS; English by default)
  // ---------------------------------------------------------------------------
  var TEXT = {
    en: {
      newTab: 'Open in a new tab', minimize: 'Minimize', maximize: 'Maximize', restore: 'Restore', close: 'Close', more: 'More', reload: 'Reload',
      alwaysTab: 'Always open in a new tab', tabHint: 'Blank, or "refused to connect"? This app doesn\'t allow windows: open it in a new tab.',
      mixedTitle: 'This app can\'t open in a window here',
      mixedText: 'CasaOS is open over HTTPS and this app only over HTTP, so the browser blocks it inside the page. Open it in a new tab, open CasaOS at its http:// address, or give the app an HTTPS port on the server (with Tailscale, this command, with any free port):',
      httpsPort: 'HTTPS port', useHttps: 'Use this port', copy: 'Copy', copied: 'Copied'
    },
    ar: {
      newTab: 'فتح في علامة تبويب جديدة', minimize: 'تصغير', maximize: 'تكبير', restore: 'استعادة', close: 'إغلاق', more: 'المزيد',
      reload: 'إعادة التحميل', alwaysTab: 'الفتح دائمًا في علامة تبويب جديدة',
      tabHint: 'صفحة فارغة أو "رُفض الاتصال"؟ هذا التطبيق لا يسمح بالنوافذ: افتحه في علامة تبويب جديدة.',
      mixedTitle: 'لا يمكن فتح هذا التطبيق في نافذة هنا',
      mixedText: 'CasaOS مفتوح عبر HTTPS وهذا التطبيق عبر HTTP فقط، لذلك يحظره المتصفح داخل الصفحة. افتحه في علامة تبويب جديدة، أو افتح CasaOS على عنوان http://، أو امنح التطبيق منفذ HTTPS على الخادم (مع Tailscale، هذا الأمر، مع أي منفذ متاح):',
      httpsPort: 'منفذ HTTPS', useHttps: 'استخدام هذا المنفذ', copy: 'نسخ', copied: 'تم النسخ'
    },
    be: {
      newTab: 'Адкрыць у новай укладцы', minimize: 'Згарнуць', maximize: 'Разгарнуць', restore: 'Аднавіць', close: 'Закрыць', more: 'Яшчэ',
      reload: 'Перазагрузіць', alwaysTab: 'Заўсёды адкрываць у новай укладцы',
      tabHint: 'Пуста або «адмоўлена ў злучэнні»? Гэта праграма не дазваляе вокны: адкрыйце яе ў новай укладцы.',
      mixedTitle: 'Гэту праграму нельга адкрыць тут у акне',
      mixedText: 'CasaOS адкрыты праз HTTPS, а гэта праграма толькі праз HTTP, таму браўзер блакуе яе ўнутры старонкі. Адкрыйце яе ў новай укладцы, адкрыйце CasaOS па адрасе http:// або дайце праграме HTTPS-порт на серверы (з Tailscale — гэта каманда, з любым вольным портам):',
      httpsPort: 'HTTPS-порт', useHttps: 'Выкарыстаць гэты порт', copy: 'Капіяваць', copied: 'Скапіявана'
    },
    bg: {
      newTab: 'Отвори в нов раздел', minimize: 'Минимизирай', maximize: 'Максимизирай', restore: 'Възстанови', close: 'Затвори', more: 'Още',
      reload: 'Презареди', alwaysTab: 'Винаги отваряй в нов раздел',
      tabHint: 'Празно или „връзката е отказана“? Това приложение не позволява прозорци: отворете го в нов раздел.',
      mixedTitle: 'Това приложение не може да се отвори тук в прозорец',
      mixedText: 'CasaOS е отворен през HTTPS, а това приложение само през HTTP, затова браузърът го блокира в страницата. Отворете го в нов раздел, отворете CasaOS на адреса му http:// или дайте на приложението HTTPS порт на сървъра (с Tailscale – тази команда, с който и да е свободен порт):',
      httpsPort: 'HTTPS порт', useHttps: 'Използвай този порт', copy: 'Копирай', copied: 'Копирано'
    },
    ca: {
      newTab: 'Obre en una pestanya nova', minimize: 'Minimitza', maximize: 'Maximitza', restore: 'Restaura', close: 'Tanca', more: 'Més',
      reload: 'Torna a carregar', alwaysTab: 'Obre sempre en una pestanya nova',
      tabHint: 'En blanc o «connexió rebutjada»? Aquesta app no permet finestres: obre-la en una pestanya nova.',
      mixedTitle: 'Aquesta app no es pot obrir en una finestra aquí',
      mixedText: 'El CasaOS està obert per HTTPS i aquesta app només per HTTP, així que el navegador la bloqueja dins la pàgina. Obre-la en una pestanya nova, obre el CasaOS per la seva adreça http:// o dona a l\'app un port HTTPS al servidor (amb Tailscale, aquesta ordre, amb qualsevol port lliure):',
      httpsPort: 'Port HTTPS', useHttps: 'Fes servir aquest port', copy: 'Copia', copied: 'Copiat'
    },
    cs: {
      newTab: 'Otevřít na nové kartě', minimize: 'Minimalizovat', maximize: 'Maximalizovat', restore: 'Obnovit', close: 'Zavřít', more: 'Další',
      reload: 'Znovu načíst', alwaysTab: 'Vždy otevírat na nové kartě',
      tabHint: 'Prázdné nebo „připojení odmítnuto“? Tato aplikace nepovoluje okna: otevřete ji na nové kartě.',
      mixedTitle: 'Tuto aplikaci zde nelze otevřít v okně',
      mixedText: 'CasaOS je otevřen přes HTTPS a tato aplikace jen přes HTTP, proto ji prohlížeč na stránce blokuje. Otevřete ji na nové kartě, otevřete CasaOS na adrese http:// nebo dejte aplikaci na serveru port HTTPS (s Tailscale tento příkaz, s libovolným volným portem):',
      httpsPort: 'Port HTTPS', useHttps: 'Použít tento port', copy: 'Kopírovat', copied: 'Zkopírováno'
    },
    de: {
      newTab: 'In neuem Tab öffnen', minimize: 'Minimieren', maximize: 'Maximieren', restore: 'Wiederherstellen', close: 'Schließen', more: 'Mehr',
      reload: 'Neu laden', alwaysTab: 'Immer in neuem Tab öffnen',
      tabHint: 'Leer oder „Verbindung abgelehnt“? Diese App erlaubt keine Fenster: Öffne sie in einem neuen Tab.',
      mixedTitle: 'Diese App kann hier nicht in einem Fenster geöffnet werden',
      mixedText: 'CasaOS ist über HTTPS geöffnet und diese App nur über HTTP, daher blockiert der Browser sie innerhalb der Seite. Öffne sie in einem neuen Tab, öffne CasaOS über seine http://-Adresse oder gib der App einen HTTPS-Port auf dem Server (mit Tailscale dieser Befehl, mit einem beliebigen freien Port):',
      httpsPort: 'HTTPS-Port', useHttps: 'Diesen Port verwenden', copy: 'Kopieren', copied: 'Kopiert'
    },
    el: {
      newTab: 'Άνοιγμα σε νέα καρτέλα', minimize: 'Ελαχιστοποίηση', maximize: 'Μεγιστοποίηση', restore: 'Επαναφορά', close: 'Κλείσιμο',
      more: 'Περισσότερα', reload: 'Επαναφόρτωση', alwaysTab: 'Άνοιγμα πάντα σε νέα καρτέλα',
      tabHint: 'Κενό ή «άρνηση σύνδεσης»; Αυτή η εφαρμογή δεν επιτρέπει παράθυρα: ανοίξτε την σε νέα καρτέλα.',
      mixedTitle: 'Αυτή η εφαρμογή δεν ανοίγει εδώ σε παράθυρο',
      mixedText: 'Το CasaOS είναι ανοιχτό μέσω HTTPS και αυτή η εφαρμογή μόνο μέσω HTTP, γι\' αυτό το πρόγραμμα περιήγησης την μπλοκάρει μέσα στη σελίδα. Ανοίξτε την σε νέα καρτέλα, ανοίξτε το CasaOS από τη διεύθυνση http:// ή δώστε στην εφαρμογή μια θύρα HTTPS στον διακομιστή (με το Tailscale, αυτή η εντολή, με οποιαδήποτε ελεύθερη θύρα):',
      httpsPort: 'Θύρα HTTPS', useHttps: 'Χρήση αυτής της θύρας', copy: 'Αντιγραφή', copied: 'Αντιγράφηκε'
    },
    es: {
      newTab: 'Abrir en una pestaña nueva', minimize: 'Minimizar', maximize: 'Maximizar', restore: 'Restaurar', close: 'Cerrar', more: 'Más',
      reload: 'Recargar', alwaysTab: 'Abrir siempre en una pestaña nueva',
      tabHint: '¿En blanco o «rechazó la conexión»? Esta app no permite ventanas: ábrela en una pestaña nueva.',
      mixedTitle: 'Esta app no puede abrirse en una ventana aquí',
      mixedText: 'CasaOS está abierto por HTTPS y esta app solo por HTTP, así que el navegador la bloquea dentro de la página. Ábrela en una pestaña nueva, abre CasaOS por su dirección http:// o dale a la app un puerto HTTPS en el servidor (con Tailscale, este comando, con cualquier puerto libre):',
      httpsPort: 'Puerto HTTPS', useHttps: 'Usar este puerto', copy: 'Copiar', copied: 'Copiado'
    },
    fr: {
      newTab: 'Ouvrir dans un nouvel onglet', minimize: 'Réduire', maximize: 'Agrandir', restore: 'Restaurer', close: 'Fermer', more: 'Plus',
      reload: 'Recharger', alwaysTab: 'Toujours ouvrir dans un nouvel onglet',
      tabHint: 'Page blanche ou « connexion refusée » ? Cette appli n\'accepte pas les fenêtres : ouvrez-la dans un nouvel onglet.',
      mixedTitle: 'Cette appli ne peut pas s\'ouvrir dans une fenêtre ici',
      mixedText: 'CasaOS est ouvert en HTTPS et cette appli seulement en HTTP : le navigateur la bloque dans la page. Ouvrez-la dans un nouvel onglet, ouvrez CasaOS à son adresse http:// ou donnez à l\'appli un port HTTPS sur le serveur (avec Tailscale, cette commande, avec n\'importe quel port libre) :',
      httpsPort: 'Port HTTPS', useHttps: 'Utiliser ce port', copy: 'Copier', copied: 'Copié'
    },
    hr: {
      newTab: 'Otvori u novoj kartici', minimize: 'Smanji', maximize: 'Povećaj', restore: 'Vrati', close: 'Zatvori', more: 'Više',
      reload: 'Ponovno učitaj', alwaysTab: 'Uvijek otvaraj u novoj kartici',
      tabHint: 'Prazno ili „veza odbijena”? Ova aplikacija ne dopušta prozore: otvorite je u novoj kartici.',
      mixedTitle: 'Ova se aplikacija ovdje ne može otvoriti u prozoru',
      mixedText: 'CasaOS je otvoren preko HTTPS-a, a ova aplikacija samo preko HTTP-a, pa je preglednik blokira unutar stranice. Otvorite je u novoj kartici, otvorite CasaOS na njegovoj http:// adresi ili dajte aplikaciji HTTPS priključak na poslužitelju (s Tailscaleom, ova naredba, s bilo kojim slobodnim priključkom):',
      httpsPort: 'HTTPS priključak', useHttps: 'Koristi ovaj priključak', copy: 'Kopiraj', copied: 'Kopirano'
    },
    hu: {
      newTab: 'Megnyitás új lapon', minimize: 'Kis méret', maximize: 'Teljes méret', restore: 'Előző méret', close: 'Bezárás', more: 'Több',
      reload: 'Újratöltés', alwaysTab: 'Mindig új lapon nyíljon',
      tabHint: 'Üres vagy „a kapcsolat elutasítva”? Ez az alkalmazás nem engedi az ablakokat: nyisd meg új lapon.',
      mixedTitle: 'Ez az alkalmazás itt nem nyitható meg ablakban',
      mixedText: 'A CasaOS HTTPS-en, ez az alkalmazás csak HTTP-n érhető el, ezért a böngésző letiltja az oldalon belül. Nyisd meg új lapon, nyisd meg a CasaOS-t a http:// címén, vagy adj az alkalmazásnak HTTPS-portot a szerveren (Tailscale-lel ezzel a paranccsal, bármely szabad porttal):',
      httpsPort: 'HTTPS-port', useHttps: 'Ez a port legyen', copy: 'Másolás', copied: 'Másolva'
    },
    id: {
      newTab: 'Buka di tab baru', minimize: 'Perkecil', maximize: 'Perbesar', restore: 'Pulihkan', close: 'Tutup', more: 'Lainnya',
      reload: 'Muat ulang', alwaysTab: 'Selalu buka di tab baru',
      tabHint: 'Kosong atau "koneksi ditolak"? Aplikasi ini tidak mengizinkan jendela: buka di tab baru.',
      mixedTitle: 'Aplikasi ini tidak bisa dibuka di jendela di sini',
      mixedText: 'CasaOS dibuka melalui HTTPS dan aplikasi ini hanya melalui HTTP, jadi browser memblokirnya di dalam halaman. Buka di tab baru, buka CasaOS di alamat http://-nya, atau beri aplikasi port HTTPS di server (dengan Tailscale, perintah ini, dengan port bebas mana pun):',
      httpsPort: 'Port HTTPS', useHttps: 'Gunakan port ini', copy: 'Salin', copied: 'Tersalin'
    },
    it: {
      newTab: 'Apri in una nuova scheda', minimize: 'Riduci a icona', maximize: 'Ingrandisci', restore: 'Ripristina', close: 'Chiudi',
      more: 'Altro', reload: 'Ricarica', alwaysTab: 'Apri sempre in una nuova scheda',
      tabHint: 'Pagina bianca o "connessione rifiutata"? Questa app non consente le finestre: aprila in una nuova scheda.',
      mixedTitle: 'Questa app non può aprirsi in una finestra qui',
      mixedText: 'CasaOS è aperto in HTTPS e questa app solo in HTTP, quindi il browser la blocca dentro la pagina. Aprila in una nuova scheda, apri CasaOS dal suo indirizzo http:// o dai all\'app una porta HTTPS sul server (con Tailscale, questo comando, con una porta libera qualsiasi):',
      httpsPort: 'Porta HTTPS', useHttps: 'Usa questa porta', copy: 'Copia', copied: 'Copiato'
    },
    ja: {
      newTab: '新しいタブで開く', minimize: '最小化', maximize: '最大化', restore: '元に戻す', close: '閉じる', more: 'その他', reload: '再読み込み', alwaysTab: '常に新しいタブで開く',
      tabHint: '真っ白、または「接続が拒否されました」？ このアプリはウィンドウ表示を許可していません。新しいタブで開いてください。', mixedTitle: 'このアプリはここではウィンドウで開けません',
      mixedText: 'CasaOS は HTTPS で、このアプリは HTTP だけで開かれているため、ブラウザがページ内での表示をブロックします。新しいタブで開くか、CasaOS を http:// のアドレスで開くか、サーバーでアプリに HTTPS ポートを割り当ててください（Tailscale なら、空いている任意のポートでこのコマンド）：',
      httpsPort: 'HTTPS ポート', useHttps: 'このポートを使う', copy: 'コピー', copied: 'コピーしました'
    },
    ko: {
      newTab: '새 탭에서 열기', minimize: '최소화', maximize: '최대화', restore: '복원', close: '닫기', more: '더 보기', reload: '새로고침', alwaysTab: '항상 새 탭에서 열기',
      tabHint: '빈 화면이거나 "연결이 거부됨"인가요? 이 앱은 창을 허용하지 않습니다. 새 탭에서 여세요.', mixedTitle: '이 앱은 여기서 창으로 열 수 없습니다',
      mixedText: 'CasaOS는 HTTPS로, 이 앱은 HTTP로만 열려 있어 브라우저가 페이지 안에서 차단합니다. 새 탭에서 열거나, CasaOS를 http:// 주소로 열거나, 서버에서 앱에 HTTPS 포트를 지정하세요(Tailscale이라면 비어 있는 아무 포트로 이 명령):',
      httpsPort: 'HTTPS 포트', useHttps: '이 포트 사용', copy: '복사', copied: '복사됨'
    },
    nl: {
      newTab: 'Openen in nieuw tabblad', minimize: 'Minimaliseren', maximize: 'Maximaliseren', restore: 'Herstellen', close: 'Sluiten',
      more: 'Meer', reload: 'Herladen', alwaysTab: 'Altijd in een nieuw tabblad openen',
      tabHint: 'Leeg of "verbinding geweigerd"? Deze app staat geen vensters toe: open hem in een nieuw tabblad.',
      mixedTitle: 'Deze app kan hier niet in een venster openen',
      mixedText: 'CasaOS is geopend via HTTPS en deze app alleen via HTTP, dus de browser blokkeert hem in de pagina. Open hem in een nieuw tabblad, open CasaOS via zijn http://-adres of geef de app een HTTPS-poort op de server (met Tailscale deze opdracht, met een willekeurige vrije poort):',
      httpsPort: 'HTTPS-poort', useHttps: 'Deze poort gebruiken', copy: 'Kopiëren', copied: 'Gekopieerd'
    },
    no: {
      newTab: 'Åpne i ny fane', minimize: 'Minimer', maximize: 'Maksimer', restore: 'Gjenopprett', close: 'Lukk', more: 'Mer',
      reload: 'Last inn på nytt', alwaysTab: 'Åpne alltid i ny fane',
      tabHint: 'Tomt eller «tilkobling avvist»? Denne appen tillater ikke vinduer: åpne den i en ny fane.',
      mixedTitle: 'Denne appen kan ikke åpnes i et vindu her',
      mixedText: 'CasaOS er åpnet over HTTPS og denne appen bare over HTTP, så nettleseren blokkerer den inne på siden. Åpne den i en ny fane, åpne CasaOS på http://-adressen eller gi appen en HTTPS-port på serveren (med Tailscale, denne kommandoen, med en hvilken som helst ledig port):',
      httpsPort: 'HTTPS-port', useHttps: 'Bruk denne porten', copy: 'Kopier', copied: 'Kopiert'
    },
    pl: {
      newTab: 'Otwórz w nowej karcie', minimize: 'Minimalizuj', maximize: 'Maksymalizuj', restore: 'Przywróć', close: 'Zamknij', more: 'Więcej',
      reload: 'Odśwież', alwaysTab: 'Zawsze otwieraj w nowej karcie',
      tabHint: 'Pusto albo „odmowa połączenia”? Ta aplikacja nie pozwala na okna: otwórz ją w nowej karcie.',
      mixedTitle: 'Tej aplikacji nie można tu otworzyć w oknie',
      mixedText: 'CasaOS jest otwarty przez HTTPS, a ta aplikacja tylko przez HTTP, więc przeglądarka blokuje ją na stronie. Otwórz ją w nowej karcie, otwórz CasaOS pod adresem http:// albo daj aplikacji port HTTPS na serwerze (z Tailscale to polecenie, z dowolnym wolnym portem):',
      httpsPort: 'Port HTTPS', useHttps: 'Użyj tego portu', copy: 'Kopiuj', copied: 'Skopiowano'
    },
    pt: {
      newTab: 'Abrir em nova aba', minimize: 'Minimizar', maximize: 'Maximizar', restore: 'Restaurar', close: 'Fechar', more: 'Mais',
      reload: 'Recarregar', alwaysTab: 'Sempre abrir em nova aba',
      tabHint: 'Em branco ou "recusou a conexão"? Este app não permite janelas: abra em uma nova aba.',
      mixedTitle: 'Este app não abre numa janela aqui',
      mixedText: 'O CasaOS está aberto por HTTPS e este app só por HTTP, então o navegador o bloqueia dentro da página. Abra em uma nova aba, abra o CasaOS pelo endereço http:// ou dê ao app uma porta HTTPS no servidor (com o Tailscale, este comando, com qualquer porta livre):',
      httpsPort: 'Porta HTTPS', useHttps: 'Usar esta porta', copy: 'Copiar', copied: 'Copiado'
    },
    'pt-pt': {
      newTab: 'Abrir num novo separador', alwaysTab: 'Abrir sempre num novo separador',
      tabHint: 'Em branco ou "recusou a ligação"? Esta aplicação não permite janelas: abra-a num novo separador.',
      mixedTitle: 'Esta aplicação não abre numa janela aqui',
      mixedText: 'O CasaOS está aberto por HTTPS e esta aplicação só por HTTP, por isso o navegador bloqueia-a dentro da página. Abra-a num novo separador, abra o CasaOS pelo endereço http:// ou dê à aplicação uma porta HTTPS no servidor (com o Tailscale, este comando, com qualquer porta livre):'
    },
    ro: {
      newTab: 'Deschide într-o filă nouă', minimize: 'Minimizează', maximize: 'Maximizează', restore: 'Restabilește', close: 'Închide',
      more: 'Mai mult', reload: 'Reîncarcă', alwaysTab: 'Deschide mereu într-o filă nouă',
      tabHint: 'Gol sau „conexiune refuzată”? Această aplicație nu permite ferestre: deschide-o într-o filă nouă.',
      mixedTitle: 'Această aplicație nu se poate deschide aici într-o fereastră',
      mixedText: 'CasaOS este deschis prin HTTPS, iar această aplicație doar prin HTTP, așa că browserul o blochează în pagină. Deschide-o într-o filă nouă, deschide CasaOS la adresa http:// sau dă aplicației un port HTTPS pe server (cu Tailscale, această comandă, cu orice port liber):',
      httpsPort: 'Port HTTPS', useHttps: 'Folosește acest port', copy: 'Copiază', copied: 'Copiat'
    },
    ru: {
      newTab: 'Открыть в новой вкладке', minimize: 'Свернуть', maximize: 'Развернуть', restore: 'Восстановить', close: 'Закрыть', more: 'Ещё',
      reload: 'Перезагрузить', alwaysTab: 'Всегда открывать в новой вкладке',
      tabHint: 'Пусто или «отказано в подключении»? Это приложение не разрешает окна: откройте его в новой вкладке.',
      mixedTitle: 'Это приложение нельзя открыть здесь в окне',
      mixedText: 'CasaOS открыт по HTTPS, а это приложение только по HTTP, поэтому браузер блокирует его внутри страницы. Откройте его в новой вкладке, откройте CasaOS по адресу http:// или дайте приложению HTTPS-порт на сервере (с Tailscale — эта команда, с любым свободным портом):',
      httpsPort: 'HTTPS-порт', useHttps: 'Использовать этот порт', copy: 'Копировать', copied: 'Скопировано'
    },
    sk: {
      newTab: 'Otvoriť na novej karte', minimize: 'Minimalizovať', maximize: 'Maximalizovať', restore: 'Obnoviť', close: 'Zavrieť', more: 'Viac',
      reload: 'Znova načítať', alwaysTab: 'Vždy otvárať na novej karte',
      tabHint: 'Prázdne alebo „pripojenie odmietnuté“? Táto aplikácia nepovoľuje okná: otvorte ju na novej karte.',
      mixedTitle: 'Túto aplikáciu tu nemožno otvoriť v okne',
      mixedText: 'CasaOS je otvorený cez HTTPS a táto aplikácia len cez HTTP, preto ju prehliadač na stránke blokuje. Otvorte ju na novej karte, otvorte CasaOS na adrese http:// alebo dajte aplikácii na serveri port HTTPS (s Tailscale tento príkaz, s ľubovoľným voľným portom):',
      httpsPort: 'Port HTTPS', useHttps: 'Použiť tento port', copy: 'Kopírovať', copied: 'Skopírované'
    },
    sl: {
      newTab: 'Odpri v novem zavihku', minimize: 'Pomanjšaj', maximize: 'Povečaj', restore: 'Obnovi', close: 'Zapri', more: 'Več',
      reload: 'Znova naloži', alwaysTab: 'Vedno odpri v novem zavihku',
      tabHint: 'Prazno ali »povezava zavrnjena«? Ta aplikacija ne dovoli oken: odprite jo v novem zavihku.',
      mixedTitle: 'Te aplikacije tu ni mogoče odpreti v oknu',
      mixedText: 'CasaOS je odprt prek HTTPS, ta aplikacija pa samo prek HTTP, zato jo brskalnik na strani blokira. Odprite jo v novem zavihku, odprite CasaOS na naslovu http:// ali aplikaciji dodelite vrata HTTPS na strežniku (s Tailscale ta ukaz, s poljubnimi prostimi vrati):',
      httpsPort: 'Vrata HTTPS', useHttps: 'Uporabi ta vrata', copy: 'Kopiraj', copied: 'Kopirano'
    },
    sv: {
      newTab: 'Öppna i ny flik', minimize: 'Minimera', maximize: 'Maximera', restore: 'Återställ', close: 'Stäng', more: 'Mer',
      reload: 'Läs in igen', alwaysTab: 'Öppna alltid i ny flik',
      tabHint: 'Tomt eller ”anslutningen nekades”? Den här appen tillåter inte fönster: öppna den i en ny flik.',
      mixedTitle: 'Den här appen kan inte öppnas i ett fönster här',
      mixedText: 'CasaOS är öppnat över HTTPS och den här appen bara över HTTP, så webbläsaren blockerar den på sidan. Öppna den i en ny flik, öppna CasaOS på dess http://-adress eller ge appen en HTTPS-port på servern (med Tailscale, det här kommandot, med valfri ledig port):',
      httpsPort: 'HTTPS-port', useHttps: 'Använd den här porten', copy: 'Kopiera', copied: 'Kopierat'
    },
    tr: {
      newTab: 'Yeni sekmede aç', minimize: 'Simge durumuna küçült', maximize: 'Ekranı kapla', restore: 'Geri yükle', close: 'Kapat',
      more: 'Daha fazla', reload: 'Yeniden yükle', alwaysTab: 'Her zaman yeni sekmede aç',
      tabHint: 'Boş mu, yoksa "bağlantı reddedildi" mi? Bu uygulama pencereye izin vermiyor: yeni sekmede açın.',
      mixedTitle: 'Bu uygulama burada pencerede açılamaz',
      mixedText: 'CasaOS HTTPS üzerinden, bu uygulama ise yalnızca HTTP üzerinden açık; bu yüzden tarayıcı onu sayfanın içinde engelliyor. Yeni sekmede açın, CasaOS\'u http:// adresinden açın ya da sunucuda uygulamaya bir HTTPS portu verin (Tailscale ile bu komut, herhangi bir boş portla):',
      httpsPort: 'HTTPS portu', useHttps: 'Bu portu kullan', copy: 'Kopyala', copied: 'Kopyalandı'
    },
    uk: {
      newTab: 'Відкрити в новій вкладці', minimize: 'Згорнути', maximize: 'Розгорнути', restore: 'Відновити', close: 'Закрити', more: 'Більше',
      reload: 'Перезавантажити', alwaysTab: 'Завжди відкривати в новій вкладці',
      tabHint: 'Порожньо або «відмовлено в з’єднанні»? Цей застосунок не дозволяє вікна: відкрийте його в новій вкладці.',
      mixedTitle: 'Цей застосунок не можна відкрити тут у вікні',
      mixedText: 'CasaOS відкрито через HTTPS, а цей застосунок лише через HTTP, тому браузер блокує його всередині сторінки. Відкрийте його в новій вкладці, відкрийте CasaOS за адресою http:// або дайте застосунку HTTPS-порт на сервері (з Tailscale — ця команда, з будь-яким вільним портом):',
      httpsPort: 'HTTPS-порт', useHttps: 'Використати цей порт', copy: 'Копіювати', copied: 'Скопійовано'
    },
    vi: {
      newTab: 'Mở trong thẻ mới', minimize: 'Thu nhỏ', maximize: 'Phóng to', restore: 'Khôi phục', close: 'Đóng', more: 'Thêm', reload: 'Tải lại',
      alwaysTab: 'Luôn mở trong thẻ mới',
      tabHint: 'Trống hoặc "từ chối kết nối"? Ứng dụng này không cho phép mở trong cửa sổ: hãy mở trong thẻ mới.',
      mixedTitle: 'Ứng dụng này không thể mở trong cửa sổ ở đây',
      mixedText: 'CasaOS đang mở qua HTTPS còn ứng dụng này chỉ qua HTTP, nên trình duyệt chặn nó trong trang. Hãy mở trong thẻ mới, mở CasaOS bằng địa chỉ http://, hoặc cấp cho ứng dụng một cổng HTTPS trên máy chủ (với Tailscale, dùng lệnh này với một cổng trống bất kỳ):',
      httpsPort: 'Cổng HTTPS', useHttps: 'Dùng cổng này', copy: 'Sao chép', copied: 'Đã sao chép'
    },
    'zh-cn': {
      newTab: '在新标签页中打开', minimize: '最小化', maximize: '最大化', restore: '还原', close: '关闭', more: '更多', reload: '重新加载', alwaysTab: '总是在新标签页中打开',
      tabHint: '空白，或显示“拒绝连接”？此应用不允许在窗口中打开：请在新标签页中打开。', mixedTitle: '此应用无法在这里以窗口打开',
      mixedText: 'CasaOS 通过 HTTPS 打开，而此应用只能通过 HTTP 访问，因此浏览器在页面中拦截了它。请在新标签页中打开，或通过 http:// 地址打开 CasaOS，或在服务器上为应用分配一个 HTTPS 端口（使用 Tailscale 时运行此命令，端口任选空闲的）：',
      httpsPort: 'HTTPS 端口', useHttps: '使用此端口', copy: '复制', copied: '已复制'
    },
    'zh-tw': {
      newTab: '在新分頁中開啟', minimize: '最小化', maximize: '最大化', restore: '還原', close: '關閉', more: '更多', reload: '重新載入', alwaysTab: '總是在新分頁中開啟',
      tabHint: '空白，或顯示「拒絕連線」？此應用程式不允許在視窗中開啟：請在新分頁中開啟。', mixedTitle: '此應用程式無法在這裡以視窗開啟',
      mixedText: 'CasaOS 透過 HTTPS 開啟，而此應用程式只能透過 HTTP 存取，因此瀏覽器在頁面中封鎖了它。請在新分頁中開啟，或透過 http:// 位址開啟 CasaOS，或在伺服器上為應用程式指定一個 HTTPS 連接埠（使用 Tailscale 時執行此指令，連接埠任選空閒的）：',
      httpsPort: 'HTTPS 連接埠', useHttps: '使用此連接埠', copy: '複製', copied: '已複製'
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

  // Where windows go: below the CasaOS top bar, the whole width
  function area() {
    var bar = document.querySelector('.top-bar'), top = 0;
    if (bar) {
      var r = bar.getBoundingClientRect();
      if (r.height && r.bottom > 0 && r.bottom < window.innerHeight / 3) top = Math.round(r.bottom);
    }
    return { x: 0, y: top, w: window.innerWidth, h: Math.max(MINH, window.innerHeight - top) };
  }
  // A phone: windows always fill the area
  function narrow() { return window.innerWidth < 640; }

  // Which window is on top: only z-index (the windows never move in the page)
  function stack() {
    var top = topmost();
    wins.forEach(function (w, i) {
      var b = box(w);
      b.style.zIndex = String(Math.min(ZMAX, Z + i));
      b.classList.toggle('cw-top', w === top);
    });
    document.documentElement.classList.toggle('cw-active', !!top);   // for other mods (Idle Hide): a window is in use
    mark();
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
    if (!full) r = clamp(r, a);
    b.style.left = Math.round(r.x) + 'px';
    b.style.top = Math.round(r.y) + 'px';
    b.style.width = Math.round(r.w) + 'px';
    b.style.height = Math.round(r.h) + 'px';
    b.classList.toggle('cw-max', full);
    b.classList.toggle('cw-narrow', narrow());
    var mx = b.querySelector('.cw-bar [data-cw="max"]');
    if (mx) {
      mx.innerHTML = icon(w.max ? 'restore' : 'max');
      mx.title = w.max ? t('restore') : t('maximize');
      mx.hidden = narrow();
    }
  }

  // The bar stays reachable: never above the top bar, never out of sight
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
    // anything pressed in it brings it to the front (inside an app's page: see the blur below)
    b.addEventListener('pointerdown', function () { if (wins[wins.length - 1] !== w) focus(w); }, true);
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
      r = clamp(r, a);
      b.style.left = Math.round(r.x) + 'px';
      b.style.top = Math.round(r.y) + 'px';
      b.style.width = Math.round(r.w) + 'px';
      b.style.height = Math.round(r.h) + 'px';
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
    var i = wins.indexOf(w);
    if (i >= 0) wins.splice(i, 1);
    w.el.remove();
    stack();
  }

  // ---------------------------------------------------------------------------
  // Apps
  // ---------------------------------------------------------------------------
  // The address a window loads. An http:// app inside CasaOS opened over
  // https:// is blocked by the browser (mixed content): only with an HTTPS
  // port for it, set in the window (null otherwise)
  function target(w) {
    var u = new URL(w.url, location.href), c = appCfg(w.name);
    if (location.protocol === 'https:' && u.protocol === 'http:') {
      if (!c.https) return null;
      u.protocol = 'https:';
      u.hostname = location.hostname;
      u.port = String(c.https);
    }
    return u.href;
  }

  function openApp(app) {
    var w = find(app.name);
    if (w && w.kind === 'app') return show(w);
    w = { kind: 'app', name: app.name, title: app.title || app.name, icon: app.icon || '', url: app.url, min: false, max: !!appCfg(app.name).max, wait: !!app.wait };
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
  }

  // The window's page: the app, or why it can't open here
  function fill(w) {
    var body = w.el.querySelector('.cw-body'), url = target(w);
    body.textContent = '';
    w.frame = null;
    if (!url) return mixedNote(w, body);
    if (w.wait) {
      // an app CasaOS has just started: its page once it answers (40 s at most), as CasaOS's launch page does
      w.wait = false;
      body.innerHTML = '<div class="cw-wait"></div>';
      var tries = 0;
      (function knock() {
        fetch(url, { mode: 'no-cors', cache: 'no-store' }).then(function () {
          if (w.el.isConnected) fill(w);
        }, function () {
          if (!w.el.isConnected) return;
          if (++tries < 27) setTimeout(knock, 1500);
          else fill(w);
        });
      })();
      return;
    }
    var f = w.frame = document.createElement('iframe');
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-read; clipboard-write; ' +
      'microphone; camera; display-capture; geolocation; screen-wake-lock; web-share');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.src = url;
    body.appendChild(f);
  }

  function portOf(u) { return Number(u.port) || (u.protocol === 'https:' ? 443 : 80); }
  function suggest(w) {
    var p = portOf(new URL(w.url, location.href));
    return p + 10000 <= 65535 ? p + 10000 : p - 10000;
  }

  // CasaOS is https:// and the app http://: the ways out, in the window
  function mixedNote(w, body) {
    var c = appCfg(w.name), u = new URL(w.url, location.href), port = c.https || suggest(w);
    var note = document.createElement('div');
    note.className = 'cw-note';
    note.innerHTML = '<h3></h3><p></p><div class="cw-cmd"><code></code><button type="button" class="cw-text-btn" data-n="copy"></button></div>' +
      '<div class="cw-row"><label><span></span> <input type="number" min="1" max="65535"></label>' +
      '<button type="button" class="cw-text-btn cw-primary" data-n="use"></button>' +
      '<button type="button" class="cw-text-btn" data-n="tab"></button></div>';
    var input = note.querySelector('input'), code = note.querySelector('code');
    note.querySelector('h3').textContent = t('mixedTitle');
    note.querySelector('p').textContent = t('mixedText');
    note.querySelector('label span').textContent = t('httpsPort');
    note.querySelector('[data-n="copy"]').textContent = t('copy');
    note.querySelector('[data-n="use"]').textContent = t('useHttps');
    note.querySelector('[data-n="tab"]').textContent = t('newTab');
    input.value = port;
    var cmd = function () {
      code.textContent = 'sudo tailscale serve --bg --https=' + (Number(input.value) || port) + ' http://127.0.0.1:' + portOf(u);
    };
    cmd();
    input.addEventListener('input', cmd);
    note.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]');
      if (!b) return;
      var n = b.getAttribute('data-n');
      if (n === 'copy') {
        copy(code.textContent, function () {
          b.textContent = t('copied');
          setTimeout(function () { b.textContent = t('copy'); }, 1500);
        });
      } else if (n === 'use') {
        var v = Math.round(Number(input.value));
        if (!(v > 0 && v < 65536)) return input.focus();
        c.https = v;
        save();
        fill(w);
      } else if (n === 'tab') toTab(w);
    });
    body.appendChild(note);
  }

  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }

  // To a new tab (CasaOS's own way); the window closes
  function toTab(w) {
    nativeOpen.call(window, target(w) || w.url, '_blank');
    close(w);
  }

  // The app's menu: reload, always a new tab, the HTTPS port, and what to do
  // when the app refuses to be in a window (browsers don't tell the page)
  function toggleMenu(w) {
    var m = w.el.querySelector('.cw-menu');
    if (!m.hidden) return closeMenu(w);
    var c = appCfg(w.name), mixed = location.protocol === 'https:' && new URL(w.url, location.href).protocol === 'http:';
    m.innerHTML = '<button type="button" class="cw-item" data-m="reload"></button>' +
      '<label class="cw-item cw-check"><input type="checkbox" data-m="tab"> <span></span></label>' +
      (mixed ? '<label class="cw-item cw-port"><span></span> <input type="number" min="1" max="65535" data-m="port"></label>' : '') +
      '<p class="cw-hint"></p>';
    m.querySelector('[data-m="reload"]').textContent = t('reload');
    var tab = m.querySelector('[data-m="tab"]');
    tab.checked = !!c.tab;
    tab.nextElementSibling.textContent = t('alwaysTab');
    tab.addEventListener('change', function () {
      if (tab.checked) c.tab = true;
      else delete c.tab;
      save();
    });
    var port = m.querySelector('[data-m="port"]');
    if (port) {
      port.previousElementSibling.textContent = t('httpsPort');
      port.value = c.https || '';
      port.addEventListener('change', function () {
        var v = Math.round(Number(port.value));
        if (v > 0 && v < 65536) c.https = v;
        else delete c.https;
        save();
        fill(w);
      });
    }
    m.querySelector('.cw-hint').textContent = t('tabHint');
    m.querySelector('[data-m="reload"]').addEventListener('click', function () {
      closeMenu(w);
      fill(w);
    });
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
      openApp(app);
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
    ['left', 'top', 'width', 'height', 'zIndex'].forEach(function (k) { m.style[k] = ''; });
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
      scanPanels();
      mark();
    }, 120);
  }
  var panelStyle = new MutationObserver(later);
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });

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

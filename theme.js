/* Design "DEUKRO Cyber" (Voreinstellung). Umschalter unten links, Auswahl wird im Browser gemerkt. */
(function () {
  var KEY = 'html-games-style', FX = 'html-games-fx', RAIN = 'html-games-rain';
  var script = document.currentScript;
  var base = script.src.replace(/theme\.js.*$/, '');
  var root = document.documentElement;
  if (script.hasAttribute('data-legacy')) root.setAttribute('data-legacy', '');

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function addLink(id, href) {
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }
  function apply(mode) {
    if (mode === true) mode = 'cyber';
    if (mode === false) mode = 'standard';
    if (mode === 'dark') {
      root.setAttribute('data-style', 'dark');
      addLink('dark-css', base + 'dark.css?v=3');
    } else if (mode === 'cyber') {
      root.setAttribute('data-style', 'cyber');
      addLink('cyber-fonts', 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@700;800&family=Share+Tech+Mono&display=swap');
      addLink('cyber-css', base + 'cyber.css');
    } else {
      root.removeAttribute('data-style');
    }
  }
  function applyFx(off) {
    if (off) root.setAttribute('data-fx', 'off'); else root.removeAttribute('data-fx');
  }

  function current() { var v = get(KEY); if (v === 'standard') return 'standard'; if (v === 'dark' && window.DARK_STYLE) return 'dark'; return 'cyber'; }
  apply(current()); // Cyber ist die Voreinstellung; Dunkel gibt es nur auf Seiten mit window.DARK_STYLE
  applyFx(get(FX) === 'off');
  if (get(RAIN) === 'off') root.setAttribute('data-rain', 'off');
  var repaint = null;
  // Für das Profil: gespeicherten Stil lesen/setzen. Dunkel gibt es nur auf Seiten, die es anbieten; sonst gilt dort Cyber.
  window.SITE_STYLE = {
    raw: function () { var v = get(KEY); return v === 'standard' || v === 'dark' ? v : 'cyber'; },
    set: function (m) { set(KEY, m); apply(current()); if (repaint) repaint(); }
  };

  addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent =
      '#styleSwitch{position:fixed;left:8px;bottom:8px;z-index:500;display:flex;gap:6px;font:600 12px system-ui,sans-serif}' +
      '#styleSwitch button,#styleSwitch select{font:inherit;color:#fff;background:rgba(20,22,40,.82);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:6px 10px;cursor:pointer}' +
      '#styleSwitch select{padding-right:6px;max-width:150px}#styleSwitch select option{background:#14162a;color:#fff;text-transform:none;letter-spacing:0}' +
      '#styleSwitch button:hover,#styleSwitch select:hover{border-color:#fff}' +
      '#styleSwitch [hidden]{display:none!important}#styleSwitch #styleGear{display:none}' +
      /* Kleine Bildschirme (Handy): nur ein Zahnrad unten links, die Einstellungen klappen erst beim Antippen auf und verdecken nichts */
      '@media (max-width:700px),(max-height:520px){' +
      '#styleSwitch>*:not(#styleGear){display:none}' +
      '#styleSwitch.open>*:not(#styleGear){display:inline-block}' +
      'html #styleSwitch button#styleGear{display:block;width:32px;height:32px;padding:0;font-size:17px;line-height:1;text-align:center;letter-spacing:0;text-transform:none;opacity:.8}' +
      'html #styleSwitch.open button#styleGear{opacity:1;border-color:#fff}' +
      '#styleSwitch.open{flex-direction:column-reverse;align-items:flex-start;gap:6px;max-width:calc(100vw - 16px)}' +
      '#styleSwitch.open.top{flex-direction:column}' +
      '}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'styleSwitch';
    // Stil-Auswahl als Aufklappmenü mit allen Stilen; Dunkel ist nur auf Seiten wählbar, die es anbieten
    var b1 = document.createElement('select');
    b1.title = 'Stil wählen'; b1.setAttribute('aria-label', 'Stil wählen');
    [['cyber', 'Stil: Cyber'], ['standard', 'Stil: Standard'], ['dark', window.DARK_STYLE ? 'Stil: Dunkel' : 'Stil: Dunkel (hier nicht verfügbar)']].forEach(function (s) {
      var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; if (s[0] === 'dark' && !window.DARK_STYLE) o.disabled = true; b1.appendChild(o);
    });
    var b2 = document.createElement('button');
    var b3 = document.createElement('button');
    box.appendChild(b1); box.appendChild(b2); box.appendChild(b3);
    var gear = document.createElement('button'); gear.id = 'styleGear'; gear.type = 'button'; gear.textContent = '\u2699'; gear.setAttribute('data-noi18n', '');
    gear.title = 'Einstellungen'; gear.setAttribute('aria-label', 'Einstellungen'); box.insertBefore(gear, box.firstChild);
    gear.onclick = function (e) { e.stopPropagation(); box.classList.toggle('open'); box.classList.toggle('top', box.getBoundingClientRect().top < innerHeight / 2); };
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) box.classList.remove('open'); });
    document.body.appendChild(box);

    function paint() {
      var st = root.getAttribute('data-style'), on = st === 'cyber';
      b1.value = st || 'standard';
      b2.hidden = !on;
      b2.textContent = root.getAttribute('data-fx') === 'off' ? 'Effekte: aus' : 'Effekte: an';
      b3.hidden = !(on && window.RAIN_OPTION);   // Regen gibt es nur in den 3D-Ansichten im Cyber-Stil
      b3.textContent = root.getAttribute('data-rain') === 'off' ? 'Regen: aus' : 'Regen: an';
    }
    b1.onchange = function () { var next = b1.value; set(KEY, next); apply(current()); paint(); };
    b2.onclick = function () {
      var off = root.getAttribute('data-fx') !== 'off';
      applyFx(off); set(FX, off ? 'off' : 'on'); paint();
    };
    b3.onclick = function () {
      var off = root.getAttribute('data-rain') !== 'off';
      if (off) root.setAttribute('data-rain', 'off'); else root.removeAttribute('data-rain');
      set(RAIN, off ? 'off' : 'on'); paint();
    };
    paint(); repaint = paint;
  });
})();

/* ===== Seitenweite Funktionen: Spielername, Sprache (DE/EN), Versionsnummer und Update-Hinweis ===== */
(function () {
  var VERSION = '3.15.0';
  var script = document.currentScript, base = script.src.replace(/theme\.js.*$/, ''), root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var lang = get('html-games-lang');
  if (lang !== 'de' && lang !== 'en') lang = /^de/i.test(navigator.language || 'de') ? 'de' : 'en';
  root.lang = lang;
  var dict = {}, pats = [];
  var SITE = window.SITE = {
    version: VERSION, lang: lang, base: base,
    T: function (de, en) { return lang === 'en' && en != null ? en : de; },
    name: function () { return (get('mp-name') || '').trim(); },
    setName: function (n) { n = String(n || '').trim().slice(0, 14); if (n) set('mp-name', n); var i = document.getElementById('mpName'); if (i) i.value = n; return n; },
    setLang: function (l) { set('html-games-lang', l); location.reload(); },
    addDict: function (o) { for (var k in o) dict[norm(k)] = o[k]; },
    addPatterns: function (a) { a.forEach(function (p) { pats.push(p); }); },
    tr: function (s) { var r = trText(s); return r == null ? s : r; },
    askName: function (f) { return askName(f); }
  };
  window.T = SITE.T;
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function trText(s) {
    if (lang !== 'en') return null;
    var k = norm(s); if (!k || !/[A-Za-zÄÖÜäöüß]/.test(k)) return null;
    var hit = dict[k];
    if (hit == null) { for (var i = 0; i < pats.length; i++) { var m = k.match(pats[i][0]); if (m) { hit = typeof pats[i][1] === 'function' ? pats[i][1].apply(null, m) : k.replace(pats[i][0], pats[i][1]); break; } } }
    if (hit == null) return null;
    var lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
    return lead + hit + trail;
  }
  // Allgemeine Begriffe, die auf vielen Seiten vorkommen (Lobby, Umschalter, Knöpfe)
  SITE.addDict({
    '← Spiele': '← Games', 'Spielen →': 'Play →', 'Ton: an': 'Sound: on', 'Ton: aus': 'Sound: off', 'Stil: Cyber': 'Style: Cyber', 'Stil: Standard': 'Style: Standard', 'Stil: Japan': 'Style: Japan', 'Stil: Dunkel': 'Style: Dark', 'Stil: Dunkel (hier nicht verfügbar)': 'Style: Dark (not available here)', 'Stil wählen': 'Choose style',
    'Effekte: an': 'Effects: on', 'Effekte: aus': 'Effects: off', 'Regen: an': 'Rain: on', 'Regen: aus': 'Rain: off', '🌸 Japan: an': '🌸 Japan: on', '🌑 Dunkel': '🌑 Dark', '🌑 Dunkel: an': '🌑 Dark: on',
    'Dein Name': 'Your name', 'Raum erstellen': 'Create room', 'Beitreten': 'Join', 'Link kopieren': 'Copy link', 'Kopiert': 'Copied', 'Öffentlich (in der Spieleliste)': 'Public (in the game list)', 'Privat (nur mit Code)': 'Private (code only)',
    'Plätze': 'Seats', 'Spiel starten': 'Start game', 'Zuletzt gespielt in Raum': 'Last played in room', 'Wieder beitreten': 'Rejoin', 'Offene Spiele': 'Open games', 'Suche …': 'Searching …', 'Mit Code beitreten': 'Join with code',
    'Warte, bis der Host das Spiel startet.': 'Wait for the host to start the game.', 'Schließen': 'Close', 'Entfernen': 'Remove', 'Offen (Online-Spieler)': 'Open (online player)', 'Aus': 'Off', 'aus': 'off', 'Hierher': 'Sit here', 'frei': 'free',
    'Keine offenen Spiele gefunden. Erstelle selbst eins oder gib einen Code ein.': 'No open games found. Create one or enter a code.', 'Bitte den Raumcode eingeben.': 'Please enter the room code.', 'Verbinde …': 'Connecting …', 'Verbindung fehlgeschlagen.': 'Connection failed.',
    'Zu wenige Spieler.': 'Not enough players.', 'Der Raum ist voll': 'The room is full', 'Der Host hat dich entfernt': 'The host removed you', 'Ein Computer hat deinen Platz übernommen': 'A computer took over your seat', 'Der Host hat den Raum geschlossen': 'The host closed the room',
    'Der Host hat das Spiel verlassen.': 'The host left the game.', 'Der Host ist weg. Ein neuer Host übernimmt …': 'The host is gone. A new host is taking over …', 'Der Host ist weg und es konnte kein neuer Host verbunden werden.': 'The host is gone and no new host could be connected.',
    'Die Verbindung zum Host ist abgebrochen.': 'The connection to the host was lost.', 'Raum konnte nicht erstellt werden. Bitte nochmal versuchen.': 'Could not create the room. Please try again.', 'Verbindung beendet': 'Connection closed',
    'Gegen den Computer': 'Against the computer', '🌐 Online spielen': '🌐 Play online', '↩ Wieder ins laufende Spiel': '↩ Back into the running game', 'Zur Auswahl': 'Back to menu', 'Regeln': 'Rules', '3D-Ansicht': '3D view', '2D-Ansicht': '2D view', '⛶ Vollbild': '⛶ Fullscreen', '⛶ Vollbild beenden': '⛶ Exit fullscreen',
    'Nochmal spielen': 'Play again', 'Beenden': 'Quit', 'Weiterspielen': 'Keep playing', 'Abbrechen': 'Cancel', 'Ja': 'Yes', 'Nein': 'No', 'Du': 'You', 'Runde': 'Round', 'Punkte': 'Points', 'Spieler': 'Player', 'Neu laden': 'Reload', 'Neues Spiel': 'New game',
    'Spiel verlassen': 'Leave game', 'Verlassen, die anderen spielen weiter': 'Leave, the others keep playing', 'Spiel für alle beenden': 'End the game for everyone',
    'Soll das Spiel für alle enden, oder soll ein anderer Spieler Host werden und mit den anderen weiterspielen?': 'Should the game end for everyone, or should another player become host and keep playing with the others?',
    'Warte auf den Host …': 'Waiting for the host …', 'Computer-Gegner': 'Computer opponents', 'Mitspieler': 'Players', 'Ziel': 'Goal'
  });
  SITE.addPatterns([
    [/^Du \((.+)\)$/, 'You ($1)'], [/^(.+) \(Du\)$/, '$1 (You)'], [/^(.+) \(Host\)$/, '$1 (Host)'], [/^(\d+)\/(\d+) Spieler$/, '$1/$2 players'],
    [/^(.+) online$/, function (a, t) { return SITE.tr(t) + ' online'; }], [/^Das Spiel läuft schon.*$/, 'The game is already running'],
    [/^(.+) hat das Spiel verlassen\. Ein Computer übernimmt, bis die Person zurückkommt\.$/, '$1 left the game. A computer plays until they come back.'], [/^(.+) ist zurück im Spiel\.$/, '$1 is back in the game.'],
    [/^Der Host hat gewechselt\. Das Spiel läuft weiter\.$/, 'The host changed. The game goes on.'], [/^(\d+) Gegner$/, function (a, n) { return n + (n === '1' ? ' opponent' : ' opponents'); }]
  ]);
  // Automatische Übersetzung (nur bei Englisch): Texte und Attribute werden über das Wörterbuch ersetzt
  function trNode(n) {
    if (n.nodeType === 3) {
      if (n.__t === n.nodeValue) return;
      var p = n.parentNode; if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || (p.closest && p.closest('[data-noi18n]'))) return;
      var r = trText(n.nodeValue); if (r != null && r !== n.nodeValue) { n.__t = r; n.nodeValue = r; } else n.__t = n.nodeValue;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE' || n.hasAttribute('data-noi18n')) return;
      ['title', 'placeholder', 'aria-label', 'alt'].forEach(function (a) { var v = n.getAttribute(a); if (v && n['__a' + a] !== v) { var r = trText(v); if (r != null) n.setAttribute(a, r); n['__a' + a] = r != null ? r : v; } });
      for (var c = n.firstChild; c; c = c.nextSibling) trNode(c);
    }
  }
  SITE.translate = trNode;
  function trTitle() { var r = trText(document.title); if (r != null && r !== document.title) document.title = r; }
  if (lang === 'en') addEventListener('DOMContentLoaded', function () {
    trNode(document.body); trTitle();
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(trNode); else trNode(m.target);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label', 'alt'] });
    var t = document.querySelector('title'); if (t) new MutationObserver(trTitle).observe(t, { childList: true, characterData: true, subtree: true });
  });

  // ---------- Namensfrage, Menüknöpfe, Update-Hinweis ----------
  var css = '#siteOv{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(5,8,18,.78);backdrop-filter:blur(4px);font:15px system-ui,sans-serif}' +
    '#siteOv .bx{background:#161a2e;color:#eef0ff;border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:22px 22px 18px;width:min(92vw,380px);box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
    '#siteOv h2{margin:0 0 6px;font-size:1.3rem}#siteOv p{margin:0 0 14px;color:#a9afd6;font-size:.9rem}' +
    '#siteOv input{width:100%;box-sizing:border-box;font:inherit;font-size:1.1rem;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#0d1020;color:#fff}' +
    '#siteOv .rw{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}#siteOv button{flex:1;font:inherit;font-weight:700;padding:10px 14px;border-radius:10px;border:0;cursor:pointer;background:#7c5cff;color:#fff}#siteOv button.alt{background:rgba(255,255,255,.12)}' +
    '#siteOv .bx.prof{width:min(94vw,470px);max-height:94vh;overflow:auto}#siteOv .lb{display:block;margin:14px 0 6px;font-weight:700;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase;color:#a9afd6}#siteOv .nt{display:block;margin-top:6px;color:#8990b8;font-size:.76rem;line-height:1.3}' +
    '#siteOv .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}#siteOv .tiles .tl{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:9px 4px 7px;font-size:.78rem;font-weight:600;line-height:1.15;background:rgba(255,255,255,.07);border:2px solid transparent;border-radius:12px;color:#eef0ff}' +
    '#siteOv .tiles .tl.on{border-color:#fff;background:rgba(124,92,255,.35)}#siteOv .sv{width:54px;height:38px;border-radius:8px;display:grid;place-items:center;font-weight:900;border:1px solid rgba(255,255,255,.3)}' +
    '#siteOv .dv{width:40px;height:40px;border-radius:16%;border:1px solid;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:6px;box-sizing:border-box;gap:2px}#siteOv .dv i{border-radius:50%}#siteOv .dv.num{display:grid;grid-template:none;place-items:center;padding:0;font:900 22px system-ui,sans-serif;border-radius:8%;border-width:2px}#siteOv .dv.auto{border:1px dashed rgba(255,255,255,.4);place-items:center;padding:0;font-size:22px;grid-template:none}' +
    '#siteOv .lg{display:flex;gap:8px;margin:0 0 12px}#siteOv .lg button{padding:7px}#siteOv .lg button.on{outline:2px solid #fff}' +
    '#siteUpd{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1900;background:#1d2342;color:#fff;border:1px solid #7c5cff;border-radius:14px;padding:10px 12px 10px 16px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 14px system-ui,sans-serif;max-width:calc(100vw - 24px)}' +
    '#siteUpd button{font:inherit;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;background:#7c5cff;color:#fff}#siteUpd button.x{background:transparent;color:#aab;padding:4px 6px}';
  function addCss() { if (document.getElementById('siteCss')) return; var s = document.createElement('style'); s.id = 'siteCss'; s.textContent = css; document.head.appendChild(s); }
  // ---------- Würfel-Designs (gelten in allen Spielen; 'auto' = passend zum Stil) ----------
  var DICEK = 'html-games-dice';
  SITE.DICE = {
    classic: { n: ['Klassisch', 'Classic'], bg: ['#fffdf4', '#ece3c8'], pip: '#16161c', one: '#c62828', edge: 'rgba(0,0,0,.25)' },
    casino: { n: ['Casino', 'Casino'], bg: ['#ef4444', '#a5121b'], pip: '#ffffff', one: '#ffffff', edge: '#5a0a10' },
    noir: { n: ['Schwarz-Gold', 'Black & gold'], bg: ['#2c2c34', '#0b0b0f'], pip: '#ffc857', one: '#ffc857', edge: '#ffc857' },
    ocean: { n: ['Ozean', 'Ocean'], bg: ['#2f7fd8', '#123c7a'], pip: '#ffffff', one: '#ffe08a', edge: '#0a2550' },
    neon: { n: ['Neon (Zahlen)', 'Neon (numbers)'], num: true, bg: ['#0b1424', '#070d19'], pip: '#00f0ff', one: '#00f0ff', edge: '#00f0ff' },
    player: { n: ['Spielerfarbe', 'Player colour'], player: true, bg: ['#8f74ff', '#5b3fd6'], pip: '#ffffff', one: '#ffffff', edge: 'rgba(0,0,0,.3)' }
  };
  SITE.dice = function () { var v = get(DICEK); return v && SITE.DICE[v] ? v : 'auto'; };
  SITE.setDice = function (v) { if (v !== 'auto' && !SITE.DICE[v]) v = 'auto'; set(DICEK, v); applyDice(); document.dispatchEvent(new CustomEvent('site-dice', { detail: v })); };
  // Das Design gilt nur für die eigenen Würfe: Spiele melden mit SITE.diceMine(false), wenn gerade jemand anderes würfelt
  var diceMine = true;
  SITE.diceMine = function (m) { diceMine = m !== false; applyDice(); };
  function applyDice() { var v = SITE.dice(); if (v === 'auto' || !diceMine) root.removeAttribute('data-dice'); else root.setAttribute('data-dice', v); }
  applyDice();
  // Flache Würfel (.die) und der Animationswürfel (#pdie) im gewählten Design, unabhängig vom Stil der Seite
  (function () {
    var s = '';
    Object.keys(SITE.DICE).forEach(function (k) {
      var d = SITE.DICE[k], H = 'html[data-dice="' + k + '"] ', bg = d.player ? 'var(--pc,' + d.bg[0] + ')' : 'linear-gradient(135deg,' + d.bg[0] + ',' + d.bg[1] + ')';
      if (d.num) {
        s += H + '.die{background:' + bg + '!important;border:2px solid ' + d.edge + '!important;border-radius:8%!important;display:flex!important;align-items:center;justify-content:center;box-shadow:0 0 14px ' + d.edge + ',inset 0 0 12px rgba(0,240,255,.2)!important}' +
          H + '.die .dp{display:none!important}' + H + '.die .dn{display:block!important;font:900 calc(var(--die)*.56)/1 Orbitron,system-ui,sans-serif;color:#f4ffff;text-shadow:0 0 10px ' + d.pip + ',0 0 22px ' + d.pip + '}' +
          H + '#pdie .f{background:' + bg + '!important;border-radius:8%!important;box-shadow:inset 0 0 0 2px ' + d.edge + ',inset 0 0 10px ' + d.edge + ',0 0 10px ' + d.edge + '!important}' +
          H + '#pdie .f i{display:none!important}' + H + '#pdie .f b{display:grid!important;place-items:center;position:absolute;inset:0;font:900 calc(var(--ds)*.6)/1 Orbitron,system-ui,sans-serif;color:#f4ffff;text-shadow:0 0 6px ' + d.pip + ',0 0 16px ' + d.pip + '}';
      } else {
        s += H + '.die{background:' + bg + '!important;border:1px solid ' + d.edge + '!important;border-radius:16%!important;display:block!important;box-shadow:0 4px 14px rgba(0,0,0,.4),inset 0 0 0 1px ' + d.edge + '!important}' +
          H + '.die::before,' + H + '.die::after{display:none!important}' +
          H + '.die .dp{display:grid!important}' + H + '.die .dn,' + H + '.die .dh,' + H + '.die .db{display:none!important}' +
          H + '.die .dp i.on{background:' + d.pip + '!important;box-shadow:none!important}' +
          H + '#pdie .f{background:' + bg + '!important;border-radius:14%!important;box-shadow:inset 0 0 0 1px ' + d.edge + ',inset 0 0 8px rgba(0,0,0,.2)!important}' +
          H + '#pdie .f i{display:block!important}' + H + '#pdie .f b{display:none!important}' +
          H + '#pdie .f i.on{background:' + d.pip + '!important;box-shadow:none!important}' + H + '#pdie .f i.one.on{background:' + d.one + '!important}';
      }
    });
    var st = document.createElement('style'); st.id = 'siteDiceCss'; st.textContent = s; document.head.appendChild(st);
  })();
  function diePrev(k) {       // kleine Vorschau: Würfelseite mit der 5
    if (k === 'auto') return '<span class="dv auto">🎲</span>';
    var d = SITE.DICE[k], st = 'background:linear-gradient(135deg,' + d.bg[0] + ',' + d.bg[1] + ');border-color:' + d.edge + (d.num ? ';box-shadow:0 0 8px ' + d.edge + ';color:#f4ffff;text-shadow:0 0 8px ' + d.pip : '');
    if (d.num) return '<span class="dv num" style="' + st + '">5</span>';
    var s = ''; for (var i = 0; i < 9; i++) s += '<i' + ([0, 2, 4, 6, 8].indexOf(i) >= 0 ? ' style="background:' + d.pip + '"' : '') + '></i>';
    return '<span class="dv" style="' + st + '">' + s + '</span>';
  }
  var START = !/\.\./.test(script.getAttribute('src') || ''), PROF = 'html-games-profile';
  // ---------- Profil: Name, Standard-Stil und Würfel (beim ersten Besuch der Startseite, später über den Namensknopf) ----------
  function askName(force) {
    return new Promise(function (res) {
      addCss();
      var old = document.getElementById('siteOv'); if (old) old.remove();
      var ov = document.createElement('div'); ov.id = 'siteOv'; ov.setAttribute('data-noi18n', '');
      var cur = SITE.name(), st0 = window.SITE_STYLE ? SITE_STYLE.raw() : 'cyber', st = st0, dc = SITE.dice(), first = !get(PROF);
      var STY = [['cyber', 'Cyber', 'linear-gradient(135deg,#05060b,#101a2c)', '#fcee09'], ['standard', 'Standard', 'linear-gradient(135deg,#7c5cff,#27d3c3)', '#fff'], ['dark', SITE.T('Dunkel', 'Dark'), 'linear-gradient(135deg,#1b1e27,#0b0d12)', '#cfd6e6']];
      ov.innerHTML = '<form class="bx prof"><div class="lg"><button type="button" data-l="de" class="alt' + (lang === 'de' ? ' on' : '') + '">🇩🇪 Deutsch</button><button type="button" data-l="en" class="alt' + (lang === 'en' ? ' on' : '') + '">🇬🇧 English</button></div>' +
        '<h2>' + (first ? SITE.T('Willkommen! Richte dein Profil ein', 'Welcome! Set up your profile') : SITE.T('Dein Profil', 'Your profile')) + '</h2><p>' + SITE.T('Name, Stil und Würfel gelten in allen Spielen. Du kannst sie jederzeit unten links über deinen Namen ändern.', 'Name, style and dice apply in all games. You can change them any time via your name at the bottom left.') + '</p>' +
        '<label class="lb">' + SITE.T('Dein Name', 'Your name') + '</label><input id="siteName" maxlength="14" autocomplete="nickname" placeholder="Name">' +
        '<label class="lb">' + SITE.T('Standard-Stil', 'Default style') + '</label><div class="tiles" id="siteSty">' + STY.map(function (s) { return '<button type="button" class="tl" data-v="' + s[0] + '"><span class="sv" style="background:' + s[2] + ';color:' + s[3] + '">Aa</span>' + s[1] + '</button>'; }).join('') + '</div>' +
        '<small class="nt">' + SITE.T('Dunkel gibt es bisher auf der Startseite und in „Mensch ärgere dich nicht“; in den anderen Spielen gilt dann Cyber.', 'Dark currently exists on the start page and in “Ludo”; the other games then use Cyber.') + '</small>' +
        '<label class="lb">' + SITE.T('Würfel', 'Dice') + '</label><div class="tiles" id="siteDc">' + ['auto'].concat(Object.keys(SITE.DICE)).map(function (k) { return '<button type="button" class="tl" data-v="' + k + '">' + diePrev(k) + (k === 'auto' ? SITE.T('Passend zum Stil', 'Match the style') : SITE.T(SITE.DICE[k].n[0], SITE.DICE[k].n[1])) + '</button>'; }).join('') + '</div>' +
        '<div class="rw">' + (force && cur ? '<button type="button" class="alt" id="siteCancel">' + SITE.T('Abbrechen', 'Cancel') + '</button>' : '') + '<button type="submit">' + (first ? SITE.T('Los geht’s', 'Let’s go') : SITE.T('Speichern', 'Save')) + '</button></div></form>';
      document.body.appendChild(ov);
      var inp = ov.querySelector('#siteName'); inp.value = cur; setTimeout(function () { inp.focus(); inp.select(); }, 30);
      function mark() {
        Array.prototype.forEach.call(ov.querySelectorAll('#siteSty .tl'), function (b) { b.classList.toggle('on', b.dataset.v === st); });
        Array.prototype.forEach.call(ov.querySelectorAll('#siteDc .tl'), function (b) { b.classList.toggle('on', b.dataset.v === dc); });
      }
      mark();
      ov.querySelector('#siteSty').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; st = b.dataset.v; if (window.SITE_STYLE) SITE_STYLE.set(st); mark(); };      // Stil sofort zeigen
      ov.querySelector('#siteDc').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; dc = b.dataset.v; mark(); };
      ov.querySelector('.lg').onclick = function (e) { var b = e.target.closest('[data-l]'); if (!b || b.dataset.l === lang) return; var n = inp.value.trim(); if (n) SITE.setName(n); SITE.setDice(dc); SITE.setLang(b.dataset.l); };
      var c = ov.querySelector('#siteCancel'); if (c) c.onclick = function () { if (window.SITE_STYLE && st !== st0) SITE_STYLE.set(st0); ov.remove(); res(cur); };
      ov.querySelector('form').onsubmit = function (e) {
        e.preventDefault(); var n = inp.value.trim();
        if (!n) { inp.style.borderColor = '#ff5c7a'; inp.focus(); return; }
        SITE.setName(n); if (window.SITE_STYLE) SITE_STYLE.set(st); SITE.setDice(dc); set(PROF, '1');
        ov.remove(); paintBtns(); res(n); document.dispatchEvent(new CustomEvent('site-name', { detail: n }));
      };
    });
  }
  var bLang, bName;
  function paintBtns() { if (bName) bName.textContent = '👤 ' + (SITE.name() || 'Name'); if (bLang) bLang.textContent = lang === 'en' ? '🌐 EN' : '🌐 DE'; }
  addEventListener('DOMContentLoaded', function () {
    addCss();
    var box = document.getElementById('styleSwitch');
    if (box) {
      bLang = document.createElement('button'); bLang.title = SITE.T('Sprache: Deutsch / Englisch', 'Language: German / English'); bLang.setAttribute('data-noi18n', '');
      bLang.onclick = function () { SITE.setLang(lang === 'en' ? 'de' : 'en'); };
      bName = document.createElement('button'); bName.title = SITE.T('Profil: Name, Stil und Würfel ändern', 'Profile: change name, style and dice'); bName.setAttribute('data-noi18n', '');
      bName.onclick = function () { askName(true); };
      box.appendChild(bLang); box.appendChild(bName); paintBtns();
    }
    if (!SITE.name() || (START && !get(PROF))) askName(!!SITE.name());      // Profil: beim ersten Besuch der Startseite (oder wenn noch kein Name da ist)
    checkUpdate(); setInterval(checkUpdate, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(); });
  });
  var shownV = null, lastCheck = 0;
  function cmpV(a, b) { a = String(a).split('.').map(Number); b = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); } return 0; }
  function checkUpdate() {
    if (Date.now() - lastCheck < 20000 || location.protocol === 'file:') return; lastCheck = Date.now();
    fetch(base + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.v || cmpV(j.v, VERSION) <= 0 || shownV === j.v) return;
      shownV = j.v; var old = document.getElementById('siteUpd'); if (old) old.remove();
      var d = document.createElement('div'); d.id = 'siteUpd'; d.setAttribute('data-noi18n', '');
      var note = j.notes ? (j.notes[lang] || j.notes.de || '') : '';
      d.innerHTML = '<span>✨ ' + SITE.T('Neue Version', 'New version') + ' ' + String(j.v).replace(/[<>&]/g, '') + ' ' + SITE.T('verfügbar', 'available') + (note ? '<br><small style="font-weight:400;opacity:.8">' + String(note).replace(/[<>&]/g, '') + '</small>' : '') + '</span><button class="go">' + SITE.T('Neu laden', 'Reload') + '</button><button class="x" title="' + SITE.T('Später', 'Later') + '">✕</button>';
      d.querySelector('.go').onclick = function () { location.reload(); };
      d.querySelector('.x').onclick = function () { d.remove(); };
      document.body.appendChild(d);
    }).catch(function () {});
  }
})();

/* Abfragen und Fenster, die das Spiel nicht mehr blockieren: Sie sind unten rechts angedockt (auf dem Handy unten), das Spielfeld bleibt sichtbar und bedienbar.
   Ein Klick auf die Überschrift klappt das Fenster ein oder aus. Verwendung: Klasse "dock" am Fenster (.overlay oder .ov2). */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.overlay.dock,.ov2.dock{position:fixed;inset:auto;right:12px;bottom:12px;top:auto;left:auto;display:block;background:transparent;padding:0;width:min(360px,calc(100vw - 24px));max-height:calc(100vh - 110px);pointer-events:none;z-index:900}' +
    '.overlay.dock[hidden],.ov2.dock[hidden]{display:none}' +
    '.overlay.dock>.box,.ov2.dock>.box{pointer-events:auto;width:100%;max-width:none;max-height:calc(100vh - 120px);overflow:auto;padding:14px 16px;text-align:left;box-shadow:0 10px 40px rgba(0,0,0,.65);border-radius:16px}' +
    '.overlay.dock>.box>h2,.ov2.dock>.box>h2{cursor:pointer;user-select:none;font-size:1.15rem;margin:0 0 8px}' +
    '.overlay.dock>.box>h2::after,.ov2.dock>.box>h2::after{content:" \\25BE";font-size:.7em;opacity:.6}' +
    '.overlay.dock>.box.min>*:not(h2),.ov2.dock>.box.min>*:not(h2){display:none}' +
    '.overlay.dock>.box.min>h2,.ov2.dock>.box.min>h2{margin:0}' +
    '.overlay.dock>.box.min>h2::after,.ov2.dock>.box.min>h2::after{content:" \\25B8"}' +
    '.overlay.dock .ico{font-size:1.8rem;line-height:1;margin-bottom:2px}' +
    '@media (max-width:900px){.overlay.dock,.ov2.dock{left:8px;right:8px;bottom:8px;width:auto;max-height:52vh}.overlay.dock>.box,.ov2.dock>.box{max-height:50vh}}';
  document.head.appendChild(css);
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('.overlay.dock>.box>h2,.ov2.dock>.box>h2');
    if (h) h.parentElement.classList.toggle('min');
  });
})();

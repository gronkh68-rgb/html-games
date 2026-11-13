/* Gemeinsame Online-Lobby für alle Spiele (Raum erstellen, beitreten, öffentliche Liste, Platz-/Farbwahl).
   Nutzt ../net.js (WebRTC über PeerJS mit Metered/TURN, Ersatzweg Relay). Der Host führt das Spiel,
   Mitspieler schicken ihre Eingaben und bekommen den Stand zurück.

   const L = MP.init({
     prefix: 'xyz-v1-', title: 'Vier gewinnt',
     seats: [{name:'Rot', color:'#ff2a55'}, ...],   // Plätze (Farben/Seiten)
     minPlayers: 2, bots: false,                    // bots: freie Plätze können "Computer" sein
     onStart(info),        // info: {role:'host'|'client', you, seats:[{type,name}]}  (type: host|remote|cpu|off)
     onData(from, msg),    // Host: from = Platz des Mitspielers; Mitspieler: from = -1 (vom Host)
     onSeatDrop(seat),     // Host: ein Mitspieler ist während des Spiels weg
     onBackToLobby(),      // alle: Host hat zurück in die Lobby geschaltet
     onLeave(why)          // Mitspieler: Verbindung zum Host weg / entfernt
   });
   L.open()  L.send(msg)  L.sendTo(seat,msg)  L.broadcast(msg)  L.backToLobby()  L.leave()
   L.role ('local'|'host'|'client'), L.you, L.seats (nur Host), L.playing                                     */
(function () {
  var MP = window.MP = {};
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  MP.init = function (cfg) {
    var L = { role: 'local', you: -1, seats: [], playing: false, room: null, hostConn: null, joiner: null, ann: null, watch: null, opening: false, cfg: cfg };
    var N = cfg.seats.length, $ = function (id) { return document.getElementById(id); };

    // ---------- Oberfläche ----------
    var css = document.createElement('style');
    css.textContent =
      '#mpOv{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(5,7,20,.72);padding:12px;overflow:auto}' +
      '#mpOv[hidden]{display:none}' +
      '#mpOv .mpbox{width:min(520px,100%);max-height:94vh;overflow:auto;background:var(--card,#1a1e33);color:var(--text,#eef0ff);border:1px solid var(--border,#2a2f4f);border-radius:18px;padding:18px}' +
      '#mpOv h2{margin:0 0 10px;font-size:1.05rem}#mpOv h3{margin:12px 0 6px;font-size:.85rem;color:var(--muted,#9aa0c3);text-transform:uppercase;letter-spacing:.08em}' +
      '#mpOv .mprow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}' +
      '#mpOv input,#mpOv select{font:inherit;color:var(--text,#eef0ff);background:var(--bg,#0f1220);border:1px solid var(--border,#2a2f4f);border-radius:10px;padding:8px 10px}' +
      '#mpOv .mpcode{font:900 2rem ui-monospace,monospace;letter-spacing:.35em;text-align:center;padding:8px 4px 8px 14px;background:var(--bg,#0f1220);border:1px solid var(--border,#2a2f4f);margin:6px 0}' +
      '#mpOv .mphint{color:var(--muted,#9aa0c3);font-size:.82rem;margin:6px 0}' +
      '#mpOv .mpslot{display:flex;align-items:center;gap:10px;margin:7px 0;flex-wrap:wrap}' +
      '#mpOv .mpslot .nm{min-width:84px;color:var(--muted,#9aa0c3)}#mpOv .mpslot .who{font-weight:700}' +
      '#mpOv .mpdot{display:inline-block;width:.9em;height:.9em;border-radius:50%;margin-right:.4em;vertical-align:-.1em;border:2px solid rgba(255,255,255,.6)}' +
      '#mpOv .mpmini{padding:3px 9px!important;font-size:.74rem!important}' +
      '#mpOv .mperr{color:#ff7b7b;font-size:.85rem;min-height:1.2em;margin-top:6px}';
    document.head.appendChild(css);
    var ov = document.createElement('div'); ov.id = 'mpOv'; ov.hidden = true;
    ov.innerHTML =
      '<div class="mpbox">' +
      '<h2>' + esc(cfg.title) + ' online</h2>' +
      '<div class="mprow mphint" style="margin:0 0 6px">👤 <b id="mpWho" style="color:var(--text,#eef0ff)"></b><button class="btn alt mpmini" id="mpProf" type="button">Profil</button></div>' +
      '<div class="mprow" id="mpTabs"><button class="btn" data-m="host">Raum erstellen</button><button class="btn alt" data-m="join">Beitreten</button></div>' +
      '<div id="mpHost" hidden>' +
      '  <div class="mpcode" id="mpCode">…</div>' +
      '  <div class="mprow"><button class="btn alt mpmini" id="mpCopy">Link kopieren</button>' +
      '  <select id="mpPub"><option value="1">Öffentlich (in der Spieleliste)</option><option value="0">Privat (nur mit Code)</option></select></div>' +
      '  <h3>Plätze</h3><div id="mpSlots"></div>' +
      '  <div class="mprow"><button class="btn" id="mpStart">Spiel starten</button></div>' +
      '</div>' +
      '<div id="mpJoin" hidden>' +
      '  <div id="mpJoinForm"><div class="mprow" id="mpRejoin" hidden><span class="mphint" style="margin:0">Zuletzt gespielt in Raum <b id="mpRejoinCode"></b></span><button class="btn mpmini" id="mpRejoinBtn">Wieder beitreten</button></div><h3>Offene Spiele</h3><div id="mpList" class="mphint">Suche …</div>' +
      '  <h3>Mit Code beitreten</h3><div class="mprow"><input id="mpJoinCode" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:.2em;width:8em"><button class="btn" id="mpJoinBtn">Beitreten</button></div></div>' +
      '  <div id="mpLobby" hidden><h3>Lobby</h3><div id="mpJoinSlots"></div><p class="mphint">Warte, bis der Host das Spiel startet.</p></div>' +
      '</div>' +
      '<div class="mperr" id="mpErr"></div>' +
      '<div class="mprow"><button class="btn alt" id="mpClose">Schließen</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    // Der Name kommt aus dem Profil (theme.js) und gilt in allen Spielen
    var profName = function () { return ((window.SITE && SITE.name()) || (function () { try { return localStorage.getItem('mp-name') || ''; } catch (e) { return ''; } })()).trim().slice(0, 14); };
    var showWho = function () { $('mpWho').textContent = profName() || 'Spieler'; }; showWho();
    document.addEventListener('site-name', showWho);
    $('mpProf').onclick = function () { if (window.SITE && SITE.askName) SITE.askName(true); };
    var err = function (t) { $('mpErr').textContent = t || ''; };
    // Wiederbeitritt: eigene Kennung und letzten Raum merken
    var LASTK = 'mp-last-' + cfg.prefix;
    function myRid() { try { var r = localStorage.getItem('mp-rid'); if (!r) { r = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('mp-rid', r); } return r; } catch (e) { return 'x' + Math.random().toString(36).slice(2, 10); } }
    function getLast() { if (!cfg.rejoin) return null; try { var l = JSON.parse(localStorage.getItem(LASTK) || 'null'); return l && Date.now() - l.t < 6 * 3600e3 ? l : null; } catch (e) { return null; } }
    function saveLast(code) { if (!cfg.rejoin || !code) return; try { localStorage.setItem(LASTK, JSON.stringify({ code: code, t: Date.now() })); } catch (e) {} }
    function clearLast() { try { localStorage.removeItem(LASTK); } catch (e) {} updateRejoin(); }
    function updateRejoin() { var l = getLast(), show = !!l && L.role !== 'client'; $('mpRejoin').hidden = !show; if (show) $('mpRejoinCode').textContent = l.code; }
    L.hasRejoin = function () { return !!getLast(); };
    L.rejoin = function () { var l = getLast(); if (!l) return false; ov.hidden = false; showMode('join'); joinRoom(l.code); return true; };
    var myName = function () { return profName() || 'Spieler'; };
    var dot = function (i) { return '<span class="mpdot" style="background:' + cfg.seats[i].color + '"></span>' + esc(cfg.seats[i].name); };
    var row = function (i, html) { return '<div class="mpslot"><span class="nm">' + dot(i) + '</span>' + html + '</div>'; };

    function showMode(m) {
      Array.prototype.forEach.call($('mpTabs').querySelectorAll('.btn'), function (b) { b.classList.toggle('alt', b.dataset.m !== m); });
      $('mpHost').hidden = m !== 'host'; $('mpJoin').hidden = m !== 'join'; err('');
      if (m === 'join' && L.role !== 'client') startWatch(); else stopWatch();
      updateRejoin();
    }
    L.open = function () {
      ov.hidden = false;
      if (L.role === 'host') showMode('host'); else if (L.role === 'client') showMode('join'); else showMode('host'), openRoom();
    };
    L.close = function () { ov.hidden = true; };
    $('mpClose').onclick = function () { if (!L.playing) { L.leave(); } L.close(); };
    $('mpTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return; var m = b.dataset.m;
      if (m !== 'host' && L.role === 'host') L.leave();
      if (m !== 'join' && L.role === 'client') L.leave();
      showMode(m); if (m === 'host' && L.role !== 'host') openRoom();
    });

    // ---------- Host ----------
    async function openRoom() {
      if (L.opening || L.role === 'host') return;
      L.opening = true; $('mpCode').textContent = '…'; err('');
      var r = null;
      for (var i = 0; i < 4 && !r; i++) { try { r = await Net.host(cfg.prefix, Net.newCode(), onConn); } catch (e) { r = null; } }
      L.opening = false;
      if (!r) { err('Raum konnte nicht erstellt werden. Bitte nochmal versuchen.'); return; }
      L.room = r; L.role = 'host'; L.playing = false;
      L.seats = cfg.seats.map(function (_, i) { return i === 0 ? { type: 'host', name: myName() } : { type: 'open' }; });
      $('mpCode').textContent = r.code; renderHost(); startAnnounce();
    }
    function onConn(conn) {
      conn.on('data', function (m) { onHostMsg(conn, m); });
      conn.on('close', function () { dropRemote(conn); });
    }
    // ---------- Host-Wechsel: ein Mitspieler hält einen zweiten Raum bereit und bekommt laufend den Spielstand ----------
    function ensureBackup() {
      if (!cfg.migrate || L.role !== 'host' || !L.playing) return;
      if (L.backup && L.seats[L.backup.seat] && L.seats[L.backup.seat].type === 'remote') return;
      L.backup = null; var si = -1;
      L.seats.forEach(function (s, k) { if (si < 0 && s.type === 'remote' && s.conn && s.conn.open) si = k; });
      L.pendingSucc = si; if (si < 0) return;
      var info = L.seats.map(function (s) { return { type: s.type, name: s.name || '', rid: s.rid || (s.type === 'host' ? myRid() : null) }; });
      try { L.seats[si].conn.send({ t: 'standby', seats: info, hostSeat: hostSeat() }); } catch (e) {}
    }
    function broadcastBackup() {
      if (!L.backup) return;
      L.seats.forEach(function (s) { if (s.conn && s.conn.open) try { s.conn.send({ t: 'backup', seat: L.backup.seat, code: L.backup.code }); } catch (e) {} });
    }
    L.snap = function (d) {                              // Spiel ruft das an jedem Zugbeginn auf
      L.lastSnap = d;
      if (!cfg.migrate || L.role !== 'host' || !L.backup) return;
      var s = L.seats[L.backup.seat]; if (s && s.conn && s.conn.open) try { s.conn.send({ t: 'snap', d: d }); } catch (e) {}
    };
    L.handover = function () {                           // Host geht freiwillig: alle wechseln zum Nachfolger
      if (L.role !== 'host' || !L.backup || !L.playing) return false;
      L.handedOver = true;
      L.seats.forEach(function (s) { if (s.conn && s.conn.open) try { s.conn.send({ t: 'migrate' }); } catch (e) {} });
      return true;
    };
    L.canHandover = function () { return !!(L.role === 'host' && L.playing && L.backup && L.seats.some(function (s, k) { return k !== L.backup.seat && s.type === 'remote'; }) || (L.role === 'host' && L.playing && L.backup)); };
    setInterval(function () { if (L.role === 'host' && L.playing) ensureBackup(); }, 4000);
    var toastT = 0;
    function toast(t) {
      var e = document.getElementById('mpToast');
      if (!e) { e = document.createElement('div'); e.id = 'mpToast'; e.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:990;background:#ffd23f;color:#1b1200;font-weight:800;padding:10px 18px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.5)'; document.body.appendChild(e); }
      e.textContent = t || ''; e.hidden = !t; clearTimeout(toastT); if (t) toastT = setTimeout(function () { e.hidden = true; }, 12000);
    }
    function hostSeat() { for (var i = 0; i < L.seats.length; i++) if (L.seats[i].type === 'host') return i; return -1; }
    function onHostMsg(conn, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hello') {
        if (conn.slot !== undefined) return;
        var full = function (why) { try { conn.send({ t: 'full', why: why }); } catch (e) {} setTimeout(function () { try { conn.close(); } catch (e) {} }, 400); };
        if (L.playing) {
          var ri = -1;
          if (cfg.rejoin) {
            // 1) dieselbe Kennung: der Platz ist frei geworden ('away') oder die alte Verbindung hängt noch (Seite neu geladen, Handy gesperrt) -> übernehmen
            if (m.rid) L.seats.forEach(function (s, k) { if (ri < 0 && s.rid === m.rid && (s.away || s.type === 'remote')) ri = k; });
            // 2) gleicher Name auf einem freien Platz (zurück von einem anderen Gerät)
            var nq = String(m.name || '').trim().toLowerCase();
            if (ri < 0 && nq) L.seats.forEach(function (s, k) { if (ri < 0 && s.away && s.was && String(s.was).trim().toLowerCase() === nq) ri = k; });
            // 3) sonst der erste freie Platz: so kann man jemanden mit dem Raumcode einladen, der den Platz übernimmt
            if (ri < 0) L.seats.forEach(function (s, k) { if (ri < 0 && s.away) ri = k; });
            if (ri >= 0 && L.seats[ri].type === 'remote' && L.seats[ri].conn) { var oc = L.seats[ri].conn; oc.slot = undefined; try { oc.close(); } catch (e) {} }      // alte, hängende Verbindung beenden
          }
          if (ri < 0) { full('Das Spiel läuft schon' + (cfg.rejoin ? ' und dein alter Platz ist nicht mehr frei' : '')); return; }
          L.seats[ri] = { type: 'remote', name: String(m.name || 'Spieler').slice(0, 14), conn: conn, rid: m.rid }; conn.slot = ri;
          try { conn.send({ t: 'welcome', slot: ri }); } catch (e) {}
          try { conn.send({ t: 'start', you: ri, seats: lobbyInfo() }); } catch (e) {}
          if (cfg.onRejoin) cfg.onRejoin(ri);
          setTimeout(ensureBackup, 300);
          return;
        }
        var i = -1; L.seats.forEach(function (s, k) { if (i < 0 && s.type === 'open') i = k; });
        if (i < 0) { full('Der Raum ist voll'); return; }
        L.seats[i] = { type: 'remote', name: String(m.name || 'Spieler').slice(0, 14), conn: conn, rid: m.rid }; conn.slot = i;
        try { conn.send({ t: 'welcome', slot: i }); } catch (e) {}
        broadcastLobby(); return;
      }
      if (conn.slot === undefined) return;
      if (m.t === 'standbyReady') {
        if (cfg.migrate && !L.backup && conn.slot === L.pendingSucc) { L.backup = { seat: conn.slot, code: String(m.code || '') }; saveLast(L.backup.code); broadcastBackup(); if (L.lastSnap) L.snap(L.lastSnap); }
        return;
      }
      if (m.t === 'color') {
        var to = +m.slot;
        if (!L.playing && Number.isInteger(to) && L.seats[to] && L.seats[to].type === 'open') moveSlot(conn.slot, to);
      } else if (m.t === 'g') { if (cfg.onData) cfg.onData(conn.slot, m.d); }
      else if (m.t === 'bye') dropRemote(conn);
    }
    function dropRemote(conn) {
      var i = conn.slot; if (i === undefined || !L.seats[i] || L.seats[i].conn !== conn) return;
      conn.slot = undefined;
      if (!L.playing) { L.seats[i] = { type: 'open' }; broadcastLobby(); return; }
      var old = L.seats[i];
      L.seats[i] = { type: cfg.bots ? 'cpu' : 'left', name: '', rid: cfg.rejoin ? old.rid : undefined, away: !!cfg.rejoin, was: old.name };
      if (cfg.onSeatDrop) cfg.onSeatDrop(i);
      if (L.backup && L.backup.seat === i) L.backup = null;
      setTimeout(ensureBackup, 300);
    }
    function moveSlot(from, to) {
      if (L.playing || !L.seats[from] || !L.seats[to] || L.seats[to].type !== 'open') return;
      L.seats[to] = L.seats[from]; L.seats[from] = { type: 'open' };
      if (L.seats[to].conn) L.seats[to].conn.slot = to;
      broadcastLobby();
    }
    function lobbyInfo() { return L.seats.map(function (s) { return { type: s.type, name: s.name || '' }; }); }
    function broadcastLobby(back) {
      var sl = lobbyInfo();
      L.seats.forEach(function (s, i) { if (s.conn && s.conn.open) try { s.conn.send({ t: 'lobby', slots: sl, you: i, back: !!back }); } catch (e) {} });
      renderHost();
    }
    function renderHost() {
      if (L.role !== 'host') return;
      $('mpSlots').innerHTML = L.seats.map(function (s, i) {
        if (s.type === 'host') return row(i, '<span class="who">Du (' + esc(s.name) + ')</span>');
        if (s.type === 'remote') return row(i, '<span class="who">' + esc(s.name) + '</span><button class="btn alt mpmini" data-kick="' + i + '">Entfernen</button>');
        var opts = '<option value="open">Offen (Online-Spieler)</option>' + (cfg.bots ? '<option value="cpu">Computer</option>' : '') + '<option value="off">Aus</option>';
        return row(i, '<select data-slot="' + i + '">' + opts + '</select>' + (s.type === 'open' ? '<button class="btn alt mpmini" data-me="' + i + '">Hierher</button>' : ''));
      }).join('');
      Array.prototype.forEach.call($('mpSlots').querySelectorAll('select'), function (sel) { sel.value = L.seats[+sel.dataset.slot].type; });
      var n = L.seats.filter(function (s) { return s.type === 'host' || s.type === 'remote' || s.type === 'cpu'; }).length;
      $('mpStart').disabled = n < (cfg.minPlayers || 2);
    }
    $('mpSlots').addEventListener('change', function (e) {
      var sel = e.target.closest('select'); if (!sel) return; var i = +sel.dataset.slot;
      if (L.seats[i] && L.seats[i].type !== 'remote' && L.seats[i].type !== 'host') { L.seats[i] = { type: sel.value }; broadcastLobby(); }
    });
    $('mpSlots').addEventListener('click', function (e) {
      var me = e.target.closest('[data-me]');
      if (me) { moveSlot(hostSeat(), +me.dataset.me); return; }
      var k = e.target.closest('[data-kick]'); if (!k) return;
      var s = L.seats[+k.dataset.kick]; if (s && s.conn) { var c = s.conn; try { c.send({ t: 'kicked', why: 'Der Host hat dich entfernt' }); } catch (er) {} dropRemote(c); setTimeout(function () { try { c.close(); } catch (er) {} }, 300); }
    });
    // Mitspieler während des Spiels entfernen (z. B. vom Spiel aus aufrufbar)
    L.kick = function (seat, why) {
      var s = L.seats[seat]; if (s && s.conn) { var c = s.conn; try { c.send({ t: 'kicked', why: why || 'Ein Computer hat deinen Platz übernommen' }); } catch (er) {} dropRemote(c); setTimeout(function () { try { c.close(); } catch (er) {} }, 300); }
    };
    $('mpStart').onclick = function () {
      if (L.role !== 'host') return;
      var n = L.seats.filter(function (s) { return s.type === 'host' || s.type === 'remote' || s.type === 'cpu'; }).length;
      if (n < (cfg.minPlayers || 2)) { err('Zu wenige Spieler.'); return; }
      L.seats = L.seats.map(function (s) { return s.type === 'open' ? { type: 'off' } : s; });
      L.playing = true;
      var info = lobbyInfo();
      L.seats.forEach(function (s, i) { if (s.conn && s.conn.open) try { s.conn.send({ t: 'start', you: i, seats: info }); } catch (e) {} });
      L.you = hostSeat(); L.close();
      cfg.onStart({ role: 'host', you: L.you, seats: info });
      L.backup = null; L.lastSnap = null; setTimeout(ensureBackup, 600);
    };
    $('mpCopy').onclick = function () {
      if (!L.room) return;
      var link = location.origin + location.pathname + '?room=' + L.room.code;
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { $('mpCopy').textContent = 'Kopiert'; setTimeout(function () { $('mpCopy').textContent = 'Link kopieren'; }, 1500); }).catch(function () { prompt('Link zum Kopieren:', link); });
    };
    // Öffentliche Liste: der Host meldet sich, solange Plätze frei sind und das Spiel nicht läuft
    function startAnnounce() {
      if (L.ann) return;
      L.ann = Net.announce(cfg.prefix, function () {
        if (L.role !== 'host' || L.playing || !L.room || $('mpPub').value !== '1') return null;
        var free = L.seats.filter(function (s) { return s.type === 'open'; }).length, hum = L.seats.filter(function (s) { return s.type === 'host' || s.type === 'remote'; }).length;
        if (!free) return null;
        var h = L.seats.filter(function (s) { return s.type === 'host'; })[0];
        return { code: L.room.code, host: h ? h.name : '', count: hum, max: hum + free };
      });
    }
    function stopAnnounce() { if (L.ann) { L.ann.stop(); L.ann = null; } }
    function startWatch() {
      if (L.watch) return; $('mpList').textContent = 'Suche …';
      L.watch = Net.watch(cfg.prefix, function (list) {
        $('mpList').innerHTML = list.length ? list.map(function (g) {
          return '<div class="mpslot"><span class="who">' + esc(g.host || 'Spiel') + '</span><span class="nm">' + g.count + '/' + g.max + ' Spieler</span><button class="btn mpmini" data-join="' + esc(g.code) + '">Beitreten</button></div>';
        }).join('') : 'Keine offenen Spiele gefunden. Erstelle selbst eins oder gib einen Code ein.';
      });
    }
    function stopWatch() { if (L.watch) { L.watch.stop(); L.watch = null; } }

    // ---------- Mitspieler ----------
    function joinRoom(codeArg) {
      var code = ((typeof codeArg === 'string' ? codeArg : '') || $('mpJoinCode').value || '').trim().toUpperCase();
      if (code.length < 4) { err('Bitte den Raumcode eingeben.'); return; }
      L.joinCode = code; var name = myName(); err('Verbinde …'); $('mpJoinBtn').disabled = true; stopWatch();
      L.joiner = Net.join(cfg.prefix, code, {
        attach: function (c) { L.hostConn = c; c.on('data', onClientMsg); c.on('close', onClientClose); },
        open: function (c) { L.role = 'client'; err(''); try { c.send({ t: 'hello', name: name, rid: myRid() }); } catch (e) {} },
        fail: function (msg) { clearLast(); $('mpJoinBtn').disabled = false; L.hostConn = null; L.joiner = null; err(msg || 'Verbindung fehlgeschlagen.'); showMode('join'); }
      });
    }
    function onClientMsg(m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'welcome') { if (L.migrating) { L.migrating = false; toast(''); L.backup = null; } saveLast(L.joinCode); L.you = m.slot; $('mpJoinForm').hidden = true; $('mpLobby').hidden = false; }
      else if (m.t === 'lobby') {
        L.you = m.you; $('mpJoinForm').hidden = true; $('mpLobby').hidden = false;
        if (L.playing || m.back) { L.playing = false; if (cfg.onBackToLobby) cfg.onBackToLobby(); ov.hidden = false; showMode('join'); $('mpJoinForm').hidden = true; $('mpLobby').hidden = false; }
        $('mpJoinSlots').innerHTML = m.slots.map(function (s, i) {
          var who = s.type === 'open' ? '<span style="color:var(--muted)">frei</span> <button class="btn alt mpmini" data-take="' + i + '">Hierher</button>'
            : s.type === 'cpu' ? 'Computer' : s.type === 'off' ? '<span style="color:var(--muted)">aus</span>' : esc(s.name) + (i === m.you ? ' (Du)' : s.type === 'host' ? ' (Host)' : '');
          return row(i, '<span class="who">' + who + '</span>');
        }).join('');
      }
      else if (m.t === 'standby') { becomeStandby(m); }
      else if (m.t === 'backup') { L.backup = { seat: m.seat, code: m.code }; }
      else if (m.t === 'snap') { L.snapData = m.d; }
      else if (m.t === 'migrate') { startMigration(); }
      else if (m.t === 'start') { L.playing = true; L.you = m.you; ov.hidden = true; if (cfg.onStart) cfg.onStart({ role: 'client', you: m.you, seats: m.seats }); }
      else if (m.t === 'g') { if (cfg.onData) cfg.onData(-1, m.d); }
      else if (m.t === 'full') { var w = m.why || 'Der Raum ist voll'; L.leave(); clearLast(); err(w); showMode('join'); }
      else if (m.t === 'kicked') { var why = m.why || 'Verbindung beendet'; if (/Host/.test(why)) clearLast(); L.leave(); ov.hidden = false; showMode('join'); err(why); if (cfg.onLeave) cfg.onLeave(why); }
    }
    function becomeStandby(m) {
      L.standbySeats = m;
      if (L.standby && L.standby.code) { L.send2host({ t: 'standbyReady', code: L.standby.code }); return; }
      if (L.standbyOpening) return; L.standbyOpening = true;
      (async function () {
        var r = null;
        for (var i = 0; i < 4 && !r; i++) { try { r = await Net.host(cfg.prefix, Net.newCode(), onStandbyConn); } catch (e) { r = null; } }
        L.standbyOpening = false; if (!r) return;
        L.standby = { room: r, code: r.code, queue: [] };
        L.send2host({ t: 'standbyReady', code: r.code });
      })();
    }
    function onStandbyConn(conn) {
      conn.on('data', function (m) { if (L.role === 'host') onHostMsg(conn, m); else if (L.standby) L.standby.queue.push([conn, m]); });
      conn.on('close', function () { if (L.role === 'host') dropRemote(conn); });
    }
    function startMigration() {
      if (L.migrating || L.leaving || L.role !== 'client' || !cfg.migrate || !L.backup || !L.backup.code) { if (!L.migrating) { L.leave(); ov.hidden = false; showMode('join'); err('Der Host hat das Spiel verlassen.'); if (cfg.onLeave) cfg.onLeave('Host weg'); } return; }
      L.migrating = true; toast('Der Host ist weg. Ein neuer Host übernimmt …');
      try { var hc = L.hostConn; L.hostConn = null; hc && hc.close(); } catch (e) {}
      if (L.standby && L.you === L.backup.seat) setTimeout(becomeHost, 300);
      else setTimeout(function () { migJoin(12); }, 1800);
    }
    function migJoin(tries) {
      if (!L.migrating) return;
      L.joinCode = L.backup.code;
      L.joiner = Net.join(cfg.prefix, L.backup.code, {
        attach: function (c) { L.hostConn = c; c.on('data', onClientMsg); c.on('close', onClientClose); },
        open: function (c) { try { c.send({ t: 'hello', name: myName(), rid: myRid() }); } catch (e) {} },
        fail: function () { if (tries > 0 && L.migrating) setTimeout(function () { migJoin(tries - 1); }, 1500); else giveUp(); }
      });
    }
    function giveUp() {
      L.migrating = false; toast(''); L.leave(); ov.hidden = false; showMode('join'); err('Der Host ist weg und es konnte kein neuer Host verbunden werden.');
      if (cfg.onLeave) cfg.onLeave('Host weg');
    }
    function becomeHost() {
      var sd = L.standbySeats;
      if (!L.standby || !sd || !L.snapData) { giveUp(); return; }
      L.room = L.standby.room; L.role = 'host'; L.playing = true; L.migrating = false; L.hostConn = null; L.backup = null; L.lastSnap = L.snapData; toast('');
      var me = L.you;
      L.seats = sd.seats.map(function (s, i) {
        if (i === me) return { type: 'host', name: myName(), rid: myRid() };
        if (i === sd.hostSeat) return { type: cfg.bots ? 'cpu' : 'left', name: '', rid: s.rid || undefined, away: !!cfg.rejoin, was: s.name };      // der alte Host darf wieder auf seinen Platz (Kennung, Name oder Raumcode)
        if (s.type === 'remote') return { type: cfg.bots ? 'cpu' : 'left', name: '', rid: s.rid, away: true };
        return { type: s.type === 'off' ? 'off' : (s.type === 'cpu' ? 'cpu' : 'left'), name: '' };
      });
      if (cfg.onMigrate) cfg.onMigrate(L.snapData, { you: me, seats: lobbyInfo() });
      var q = L.standby.queue.splice(0);
      q.forEach(function (x) { onHostMsg(x[0], x[1]); });
      setTimeout(ensureBackup, 4000);
    }
    function onClientClose() {
      if (L.role !== 'client' || L.leaving) return;
      if (cfg.migrate && L.playing && L.backup && L.backup.code && !L.migrating) { startMigration(); return; }
      if (L.migrating) return;
      L.leave(); ov.hidden = false; showMode('join'); err('Die Verbindung zum Host ist abgebrochen.'); if (cfg.onLeave) cfg.onLeave('Verbindung zum Host abgebrochen');
    }
    $('mpJoinBtn').onclick = function () { joinRoom(); };
    $('mpRejoinBtn').onclick = function () { var l = getLast(); if (l) joinRoom(l.code); };
    $('mpJoinCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(); });
    $('mpJoinSlots').addEventListener('click', function (e) { var b = e.target.closest('[data-take]'); if (b) L.send2host({ t: 'color', slot: +b.dataset.take }); });
    $('mpList').addEventListener('click', function (e) { var b = e.target.closest('[data-join]'); if (b) { $('mpJoinCode').value = b.dataset.join; joinRoom(b.dataset.join); } });
    L.send2host = function (m) { try { if (L.hostConn && L.hostConn.open) L.hostConn.send(m); } catch (e) {} };

    // ---------- Spiel-Schnittstelle ----------
    L.send = function (d) { L.send2host({ t: 'g', d: d }); };                       // Mitspieler -> Host
    L.sendTo = function (seat, d) { var s = L.seats[seat]; if (s && s.conn && s.conn.open) try { s.conn.send({ t: 'g', d: d }); } catch (e) {} };
    L.broadcast = function (d) { L.seats.forEach(function (s) { if (s.conn && s.conn.open) try { s.conn.send({ t: 'g', d: d }); } catch (e) {} }); };
    L.backToLobby = function () {                                                    // Host: nach dem Spiel zurück in die Lobby
      if (L.role !== 'host') return;
      L.playing = false;
      L.seats = L.seats.map(function (s) { return s.away ? { type: 'open' } : (s.type === 'off' ? { type: 'open' } : (s.type === 'left' ? { type: 'open' } : s)); });
      broadcastLobby(true); ov.hidden = false; showMode('host'); renderHost();
    };
    L.leave = function () {
      var wasIn = L.role === 'client' && L.playing;
      L.leaving = true;
      if (L.role === 'host') {
        L.seats.forEach(function (s) { if (s.conn) try { if (!L.handedOver) s.conn.send({ t: 'kicked', why: 'Der Host hat den Raum geschlossen' }); s.conn.close(); } catch (e) {} });
        try { L.room && L.room.close(); } catch (e) {}
      }
      if (L.role === 'client') { try { L.hostConn && (L.hostConn.send({ t: 'bye' }), L.hostConn.close()); } catch (e) {} if (L.joiner) L.joiner.cancel(); }
      stopAnnounce(); stopWatch();
      L.room = null; L.seats = []; L.hostConn = null; L.joiner = null; L.role = 'local'; L.playing = false; L.you = -1; L.opening = false;
      L.backup = null; L.migrating = false; L.handedOver = false; L.snapData = null; L.lastSnap = null;
      try { if (L.standby && L.standby.room) L.standby.room.close(); } catch (e) {} L.standby = null; L.standbySeats = null; L.leaving = false;
      $('mpJoinForm').hidden = false; $('mpLobby').hidden = true; $('mpJoinBtn').disabled = false;
      if (wasIn && L.showRejoin) L.showRejoin();      // aus Versehen gegangen? Sofort den Weg zurück anbieten
    };
    // ---------- Raumcode im Spiel (zum Einladen) und Wiederbeitritt-Leiste ----------
    var ui = document.createElement('style');
    ui.textContent = '#mpChip{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:600;font:700 12px system-ui,sans-serif;color:#fff;background:rgba(14,18,34,.78);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:4px 12px;cursor:pointer;white-space:nowrap;display:none;backdrop-filter:blur(4px)}' +
      '#mpChip b{letter-spacing:.18em;font-size:13px}#mpChip.free{border-color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.6);animation:mpfree 1.2s ease-in-out infinite alternate}@keyframes mpfree{to{box-shadow:0 0 2px rgba(255,210,63,.2)}}' +
      '#mpRj{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1800;background:#1d2342;color:#fff;border:1px solid #7c5cff;border-radius:14px;padding:10px 12px 10px 16px;display:none;gap:10px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 14px system-ui,sans-serif;max-width:calc(100vw - 24px)}' +
      '#mpRj button{font:inherit;border:0;border-radius:9px;padding:8px 14px;cursor:pointer;background:#7c5cff;color:#fff}#mpRj button.x{background:transparent;color:#aab;padding:4px 8px}';
    document.head.appendChild(ui);
    var chip = document.createElement('div'); chip.id = 'mpChip'; chip.setAttribute('data-noi18n', ''); document.body.appendChild(chip);
    function roomCode() { return L.role === 'host' && L.room ? L.room.code : (L.role === 'client' ? L.joinCode : null); }
    function inviteUrl(code) { return location.origin + location.pathname + '?room=' + code; }
    chip.onclick = function () {
      var code = roomCode(); if (!code) return; var url = inviteUrl(code), done = function () { toast('Einladungslink kopiert: ' + code); };
      try { navigator.clipboard.writeText(url).then(done, function () { prompt('Einladungslink:', url); }); } catch (e) { prompt('Einladungslink:', url); }
    };
    setInterval(function () {
      var code = L.playing ? roomCode() : null;
      if (!code) { chip.style.display = 'none'; return; }
      var free = L.role === 'host' && L.seats.some(function (s) { return s.away; });
      chip.style.display = 'block'; chip.className = free ? 'free' : '';
      chip.innerHTML = '🔗 Raum <b>' + esc(code) + '</b>' + (free ? ' · Platz frei' : '');
      chip.title = free ? 'Jemand ist weg: Mit dem Code oder Link kann die Person (oder jemand anderes) zurück ins Spiel. Antippen kopiert den Link.' : 'Raumcode: Antippen kopiert den Einladungslink';
    }, 1200);
    var rj = document.createElement('div'); rj.id = 'mpRj'; rj.setAttribute('data-noi18n', ''); document.body.appendChild(rj);
    var rjOff = false; try { rjOff = sessionStorage.getItem('mp-rj-off-' + cfg.prefix) === '1'; } catch (e) {}
    function showRejoin() {
      var l = getLast(); if (!l || L.role !== 'local' || rjOff) { rj.style.display = 'none'; return; }
      rj.innerHTML = '<span>↩ Du warst in Raum <b>' + esc(l.code) + '</b>.</span><button class="go">Zurück ins Spiel</button><button class="x" title="Ausblenden">✕</button>';
      rj.style.display = 'flex';
      rj.querySelector('.go').onclick = function () { rj.style.display = 'none'; L.rejoin(); };
      rj.querySelector('.x').onclick = function () { rjOff = true; try { sessionStorage.setItem('mp-rj-off-' + cfg.prefix, '1'); } catch (e) {} rj.style.display = 'none'; };
    }
    L.showRejoin = function () { rjOff = false; try { sessionStorage.removeItem('mp-rj-off-' + cfg.prefix); } catch (e) {} setTimeout(showRejoin, 400); };
    if (cfg.rejoin) { setTimeout(showRejoin, 1200); setInterval(function () { if (L.role !== 'local' || !getLast()) rj.style.display = 'none'; }, 2000); }
    addEventListener('beforeunload', function () { try { if (L.role === 'host') L.handover(); } catch (e) {} try { if (L.role === 'client' && L.hostConn) L.hostConn.send({ t: 'bye' }); } catch (e) {} });

    // Raumlink (?room=CODE): Beitritts-Fenster direkt öffnen
    var q = new URLSearchParams(location.search).get('room');
    if (q) { setTimeout(function () { ov.hidden = false; showMode('join'); $('mpJoinCode').value = q.toUpperCase().slice(0, 5); }, 300); }
    return L;
  };
})();

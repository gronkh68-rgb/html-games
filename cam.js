/* Video-Chat für Mehrspieler-Spiele (statt Discord): Kamera und Mikrofon direkt zwischen den Spielern per WebRTC (PeerJS).
   Jeder Mitspieler bekommt eine eigene Cam-ID "<prefix><Raumcode>-cam<Platz>". Die Videos laufen von Gerät zu Gerät,
   nicht über den Spielhost. Braucht peerjs (von der Seite geladen) und optional window.NET_TURN (net-config.js).
   Cam.mount(box, cfg)  cfg: { prefix, code(): Raumcode, me(): eigener Platz, others(): [{i, name}] }   Cam.sync() bei Änderungen der Mitspieler */
(function () {
  var Cam = window.Cam = { on: false };
  var cfg, box, peer = null, stream = null, calls = {}, tiles = {}, retry = 0, mic = true, cam = true, seen = {};
  var $ = function (s) { return box.querySelector(s); };
  var T = function (d, e) { return window.SITE ? SITE.T(d, e) : d; };
  var esc = function (s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
  function ice() { var extra = Array.isArray(window.NET_TURN) ? window.NET_TURN : []; return { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }].concat(extra) } }; }
  function idOf(i) { return cfg.prefix + cfg.code() + '-cam' + i; }
  function seatOf(pid) { var m = /-cam(\d+)$/.exec(pid || ''); return m ? +m[1] : -1; }
  function nameOf(i) { var o = cfg.others().filter(function (x) { return x.i === i; })[0]; return o ? o.name : T('Spieler ', 'Player ') + (i + 1); }
  function ui() {
    box.innerHTML = '<div class="camhead"><b>📹 ' + T('Video-Chat', 'Video chat') + '</b><span class="camst" id="camSt"></span></div>' +
      '<div class="camtools"><button class="btn" id="camGo">' + (Cam.on ? '⏹ ' + T('Beenden', 'Stop') : '▶ ' + T('Video-Chat starten', 'Start video chat')) + '</button>' +
      (Cam.on ? '<button class="btn alt" id="camV">' + (cam ? '📷' : '🚫') + '</button><button class="btn alt" id="camM">' + (mic ? '🎤' : '🔇') + '</button>' : '') + '</div>' +
      '<div class="camgrid" id="camGrid"></div>';
    $('#camGo').onclick = function () { Cam.on ? Cam.stop() : Cam.start(); };
    if (Cam.on) {
      $('#camV').onclick = function () { cam = !cam; if (stream) stream.getVideoTracks().forEach(function (t) { t.enabled = cam; }); ui(); grid(); };
      $('#camM').onclick = function () { mic = !mic; if (stream) stream.getAudioTracks().forEach(function (t) { t.enabled = mic; }); ui(); grid(); };
    }
    grid();
  }
  function status(t) { var e = $('#camSt'); if (e) e.textContent = t || ''; }
  function grid() {
    var g = $('#camGrid'); if (!g) return; g.innerHTML = '';
    if (stream) { var me = tile(T('Du', 'You'), stream, true); me.classList.toggle('off', !cam); g.appendChild(me); }
    Object.keys(tiles).forEach(function (k) { var t = tiles[k]; var el = tile(nameOf(+k), t.stream, false); g.appendChild(el); });
  }
  function tile(name, s, mine) {
    var d = document.createElement('div'); d.className = 'camtile'; var v = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.muted = !!mine; v.srcObject = s;
    if (mine) v.style.transform = 'scaleX(-1)'; var p = v.play && v.play(); if (p && p.catch) p.catch(function () {});
    d.appendChild(v); var n = document.createElement('span'); n.textContent = name; d.appendChild(n); return d;
  }
  function connectAll() {
    if (!peer || !stream) return; var ok = 0, want = 0;
    cfg.others().forEach(function (o) {
      want++; var c = calls[o.i];
      if (c && (c.open === true || Date.now() - c.t0 < 10000)) { ok++; return; }      // läuft oder wird gerade aufgebaut
      if (c) { try { c.close(); } catch (e) {} delete calls[o.i]; }
      var call = peer.call(idOf(o.i), stream); if (!call) return; call.t0 = Date.now(); calls[o.i] = call;
      call.on('close', function () { if (calls[o.i] === call) delete calls[o.i]; }); call.on('error', function () { if (calls[o.i] === call) delete calls[o.i]; });
    });
    status(want ? T('Verbunden mit ' + Object.keys(tiles).length + ' von ' + want, 'Connected to ' + Object.keys(tiles).length + ' of ' + want) : T('Warte auf Mitspieler …', 'Waiting for other players …'));
  }
  Cam.mount = function (b, c) { box = b; cfg = c; ui(); };
  Cam.sync = function () { if (Cam.on) connectAll(); };
  Cam.start = async function () {
    if (Cam.on || !window.Peer || cfg.me() < 0) return; Cam.on = true; ui(); status(T('Kamera wird angefragt …', 'Asking for camera …'));
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); cam = false; } catch (e2) { stream = null; } }
    var myId = idOf(cfg.me()), tries = 0;
    function open() {
      peer = new Peer(myId, ice());
      peer.on('open', function () { status(stream ? T('Verbinde …', 'Connecting …') : T('Nur zuschauen (keine Kamera erlaubt)', 'Viewing only (no camera allowed)')); ui(); connectAll(); });
      peer.on('call', function (call) {
        call.answer();      // Empfangen: Mein eigener Strom läuft über meine ausgehenden Anrufe
        call.on('stream', function (s) { var k = seatOf(call.peer); tiles[k] = { stream: s, call: call }; grid(); connectAll(); });
        call.on('close', function () { delete tiles[seatOf(call.peer)]; grid(); });
      });
      peer.on('error', function (e) {
        if (e.type === 'unavailable-id' && tries++ < 6) { try { peer.destroy(); } catch (x) {} setTimeout(open, 2500); }
        else if (e.type === 'peer-unavailable') { var m = /peer ([\w-]+)/.exec(e.message || ''), k = m ? seatOf(m[1]) : -1; if (k >= 0 && calls[k]) delete calls[k]; }
        else status(T('Video-Chat nicht verfügbar (', 'Video chat unavailable (') + e.type + ')');
      });
    }
    open(); clearInterval(retry); retry = setInterval(connectAll, 5000);
  };
  Cam.stop = function () {
    Cam.on = false; clearInterval(retry); Object.keys(calls).forEach(function (k) { try { calls[k].close(); } catch (e) {} }); calls = {}; tiles = {};
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; if (peer) { try { peer.destroy(); } catch (e) {} peer = null; } ui();
  };
  var css = document.createElement('style'); css.textContent = '.camhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.camst{font-size:.75rem;color:var(--muted)}.camtools{display:flex;gap:6px;margin-bottom:8px}.camtools .btn{padding:6px 10px;font-size:.85rem}' +
    '.camgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.camtile{position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:4/3;border:1px solid var(--border)}.camtile video{width:100%;height:100%;object-fit:cover;display:block}.camtile.off video{opacity:.15}.camtile span{position:absolute;left:4px;bottom:3px;font-size:.7rem;background:rgba(0,0,0,.6);color:#fff;border-radius:6px;padding:1px 6px}';
  document.head.appendChild(css);
})();

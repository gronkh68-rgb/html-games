/* Gemeinsame Spiel-Grundlage für Host-geführte Spiele (Einzelspiel und online).
   Der Host hält den Spielstand G (nur JSON-Daten), jeder Platz bekommt nur seine eigene Sicht.
   Mitspieler beantworten nur Fragen (ask). Texte sind entweder Strings oder {de,en} und werden
   auf jedem Gerät in dessen Sprache angezeigt. Unterstützt Wiederbeitritt und Host-Wechsel (mplobby.js).

   const K = HK.init({
     prefix, title:{de,en}, seats:[{name,color}], minPlayers, cpuNames:[...],
     view(G, s)            -> Sicht für Platz s
     valid(spec, a, G, p)  -> ist die Antwort gültig?
     render(V)             -> Sicht auf diesem Gerät anzeigen
     ui(spec)              -> Promise: Frage an diesem Gerät beantworten (dlg macht HK selbst)
     start(seats)          -> neues Spiel (setzt K.G und ruft K.run(main))
     resume(phase)         -> nach Host-Wechsel weitermachen (K.G ist gesetzt)
     fx(data)              -> optionale Effekte (Würfel, Animation), auf allen Geräten
   });                                                                                                   */
(function () {
  var HK = window.HK = {};
  var T = function (de, en) { return window.SITE ? SITE.T(de, en) : de; };
  HK.tx = function (v) { if (v == null) return ''; if (typeof v === 'object' && ('de' in v || 'en' in v)) return T(v.de, v.en); return String(v); };
  HK.L2 = function (de, en) { return { de: de, en: en == null ? de : en }; };
  HK.esc = function (s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
  HK.shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  HK.rnd = function (n) { return Math.floor(Math.random() * n); };

  var CSS = '.hk-layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:16px;align-items:start}@media (max-width:900px){.hk-layout{grid-template-columns:1fr}}' +
    '.hk-main{display:flex;flex-direction:column;gap:10px;min-width:0}.hk-side{display:flex;flex-direction:column;gap:12px}.hk-side .panel{margin:0}' +
    '#hkBanner{border-radius:12px;padding:10px 14px;text-align:center;font-weight:900;letter-spacing:.03em;font-size:1.05rem;background:rgba(0,0,0,.35);color:#cfe3ff;border:2px solid rgba(255,255,255,.12);transition:all .25s}' +
    '#hkBanner.me{background:linear-gradient(90deg,#ffb300,#ffd23f,#ffb300);color:#1b1200;border-color:#fff;font-size:1.25rem;animation:hkPulse .8s ease-in-out infinite alternate}' +
    'html[data-style="cyber"] #hkBanner.me{background:linear-gradient(90deg,#c9bd00,#fcee09,#c9bd00)}' +
    '@keyframes hkPulse{from{box-shadow:0 0 6px rgba(255,210,63,.5)}to{box-shadow:0 0 26px rgba(255,210,63,.95)}}' +
    '#hkStatus{background:rgba(0,0,0,.4);color:#fff;border-radius:10px;padding:8px 12px;text-align:center;min-height:2.6em;display:flex;align-items:center;justify-content:center;font-weight:600}' +
    '#hkLog{font-size:.8rem;color:var(--muted);max-height:220px;overflow:auto;line-height:1.4}#hkLog div{padding:2px 0;border-top:1px solid rgba(255,255,255,.06)}' +
    '.hk-score{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0}.hk-score b{font-size:1.1rem}.hk-score.turn span{color:#ffd23f;font-weight:800}' +
    '#hkModal{z-index:900}#hkModal .box{max-width:min(560px,94vw);max-height:92vh;overflow:auto}#hkModal .ico{font-size:2.6rem;line-height:1}#hkModal p,#hkModal .tx{color:var(--text);text-align:left;margin:0 0 14px;line-height:1.45}' +
    '.hk-btns{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto}.hk-btns .btn{width:100%}.hk-btns.cols{display:grid;grid-template-columns:1fr 1fr}' +
    '#hkToast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:950;background:rgba(10,14,30,.92);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:10px 16px;font-weight:700;pointer-events:none;transition:opacity .3s;max-width:90vw;text-align:center}' +
    '.rules ul{margin:6px 0 0;padding-left:18px;line-height:1.55;font-size:.9rem}.hk-opts{display:grid;gap:6px;margin:8px 0}.hk-opts label{display:flex;gap:10px;align-items:flex-start;line-height:1.35;font-size:.9rem;cursor:pointer}.hk-opts input{margin-top:3px}.hk-opts small{display:block;color:var(--muted)}';

  HK.init = function (cfg) {
    var K = { G: null, V: null, prevV: null, ME: 0, ROLE: 'local', L: null, token: 0, pend: {}, askN: 0, dlgSeq: 0, snd: true, CANCEL: {} };
    var $ = function (id) { return document.getElementById(id); };
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    try { K.snd = localStorage.getItem('hk-snd') !== '0'; } catch (e) {}
    function domReady(f) { if (document.readyState !== 'loading') f(); else addEventListener('DOMContentLoaded', f); }
    domReady(function () {
      var m = document.createElement('div'); m.className = 'overlay dock'; m.id = 'hkModal'; m.hidden = true; m.setAttribute('data-noi18n', '');
      m.innerHTML = '<div class="box"><div class="ico" id="hkIco"></div><h2 id="hkTitle"></h2><div class="tx" id="hkText"></div><div class="hk-btns" id="hkBtns"></div></div>';
      document.body.appendChild(m);
      var t = document.createElement('div'); t.id = 'hkToast'; t.style.opacity = 0; document.body.appendChild(t);
    });

    K.sleep = function (ms) { var t = K.token; return new Promise(function (res, rej) { setTimeout(function () { t === K.token ? res() : rej(K.CANCEL); }, ms); }); };
    K.nm = function (p) { return K.G.seats[p].name; };
    K.N = function () { return K.G.seats.length; };
    // Protokoll: a = Text für alle anderen, b = Text für Spieler p (beides String oder {de,en})
    K.say = function (p, a, b) { var G = K.G; G.log.unshift({ p: p, a: a, b: b == null ? a : b }); if (G.log.length > 60) G.log.length = 60; };
    K.logFor = function (s) { return K.G.log.map(function (e) { return e.p === s ? e.b : e.a; }); };
    K.toast = function (txt, ms) { var e = $('hkToast'); if (!e) return; e.textContent = HK.tx(txt); e.style.opacity = txt ? 1 : 0; clearTimeout(K._tt); if (txt) K._tt = setTimeout(function () { e.style.opacity = 0; }, ms || 2200); };

    // ---------- Ansicht verteilen ----------
    K.push = function () {
      if (!K.G) return;
      if (!K._dock && window.Dice3D && cfg.diceDock) { K._dock = 1; if (!(cfg.dviewFor && cfg.dviewFor(0))) K.dview().show(); }      // Würfel-Tablett im Dock zeigen
      K.V = cfg.view(K.G, K.ME); K.apply();
      if (K.ROLE === 'host') K.G.seats.forEach(function (x, i) { if (x.type === 'remote') K.L.sendTo(x.seat, { k: 'v', v: cfg.view(K.G, i) }); });
    };
    K.apply = function () { if (!K.V) return; cfg.render(K.V, K.prevV); K.prevV = K.V; };
    K.fxLocal = function (d) {
      if (d && d.k === 'dice3d') { if (!HK.noView && window.Dice3D) K.dview(d.p).play(d.track, { hold: 1300, color: d.col, mine: d.p === K.ME, mod: !!d.mod }); return; }
      if (cfg.fx) cfg.fx(d);
    };
    K.fx = function (d) {          // Effekt auf allen Geräten (z. B. Würfelwurf)
      K.fxLocal(d);
      if (K.ROLE === 'host') K.G.seats.forEach(function (x) { if (x.type === 'remote') K.L.sendTo(x.seat, { k: 'fx', d: d }); });
    };

    // ---------- Fragen an Spieler ----------
    K.ask = function (p, spec, ai) {
      var s = K.G.seats[p];
      if (s.type === 'cpu') return Promise.resolve(ai());
      if (s.type === 'host') return K.uiAsk(spec);
      return new Promise(function (res) { var id = ++K.askN; K.pend[p] = { id: id, res: res, ai: ai, spec: spec }; K.L.sendTo(s.seat, { k: 'ask', id: id, spec: spec }); });
    };
    K.uiAsk = function (spec) { return spec.k === 'dlg' ? K.dlg(spec) : spec.k === 'throw' ? K.throwUi(spec) : cfg.ui(spec); };
    // ---------- Echte Würfelphysik (dice3d.js): Wurf per Maus ziehen, der Host rechnet, alle sehen dieselbe Bahn ----------
    var DV = null;
    K.dview = function (p) { var v = cfg.dviewFor ? cfg.dviewFor(p) : null; if (v) return v; return DV || (DV = Dice3D.view(document.getElementById(cfg.diceDock))); };      // dviewFor: Würfelfeld in einer 3D-Szene des Spiels
    K.throwUi = function (spec) {
      var V = K.dview(spec.p);
      return new Promise(function (res) {
        var btn = document.createElement('button'); btn.className = 'dbtn'; btn.setAttribute('data-noi18n', '');
        btn.textContent = '🎲 ' + T('Für mich werfen', 'Throw for me');
        btn.onclick = function () { btn.remove(); V.stopDrag(); res(null); };
        V.wrap.appendChild(btn);
        V.drag(spec.n, { color: spec.col, mod: !!spec.mod, zoom: cfg.diceZoom !== false, hint: spec.hint ? HK.tx(spec.hint) : T('Würfel mit der Maus ziehen und loslassen zum Werfen', 'Drag the dice and release to throw') }).then(function (p) { btn.remove(); res(p); }, function () { btn.remove(); });
      });
    };
    // Wirft n Würfel für Spieler p und gibt die Augen zurück (Host). Das Ergebnis kommt aus der Physik.
    // opt.mod: Der zweite Würfel ist ein vierseitiger Rechenwürfel (Tetraeder, Werte 1 bis 4 = +2, -2, x2, geteilt durch 2), echte Physik
    K.throwDice = async function (p, n, hint, opt) {
      var col = cfg.dieColor ? cfg.dieColor(p, K.G) : null, mod = !!(opt && opt.mod) && n === 2;
      var par = await K.ask(p, { k: 'throw', n: n, hint: hint || null, col: col, p: p, mod: mod }, function () { return Dice3D.autoParams(n); });
      par = Dice3D.clean(par, n) || Dice3D.autoParams(n);
      var r = await Dice3D.simulate(par, null, mod ? ['d6', 'd4'] : null);
      K.fx({ k: 'dice3d', track: r.track, col: col, p: p, mod: mod }); K.sfx('dice');
      await K.sleep(Math.round(r.track.f.length / r.track.hz * 1000) + 900);
      return r.v;
    };
    function validAns(spec, a, p) {
      if (spec.k === 'throw') return a === null || Dice3D.clean(a, spec.n) !== null;
      if (spec.k === 'dlg') return Number.isInteger(a) && a >= 0 && a < spec.btns.length;
      return !!cfg.valid(spec, a, K.G, p);
    }
    K.dlgAll = function (specFor, aiVal) { return Promise.all(K.G.seats.map(function (s, q) { return s.type === 'cpu' ? 0 : K.ask(q, Object.assign({ k: 'dlg' }, specFor(q)), function () { return aiVal; }); })); };
    K.vote = function (specFor) {      // Mehrheit der Menschen, Gleichstand = ja
      return Promise.all(K.G.seats.map(function (s, q) { return s.type === 'cpu' ? null : K.ask(q, Object.assign({ k: 'dlg' }, specFor(q)), function () { return null; }); })).then(function (r) {
        var v = r.filter(function (x) { return x !== null && x !== undefined; }), yes = v.filter(function (x) { return x === 0; }).length; return yes >= v.length - yes;
      });
    };

    // ---------- Dialog ----------
    K.dlg = function (o) {
      return new Promise(function (res) {
        var my = ++K.dlgSeq;
        $('hkIco').textContent = o.ico || ''; $('hkTitle').textContent = HK.tx(o.title); $('hkText').innerHTML = HK.tx(o.html);
        var box = $('hkBtns'); box.innerHTML = ''; box.className = 'hk-btns' + (o.cols ? ' cols' : '');
        o.btns.forEach(function (b, i) {
          var e = document.createElement('button'); e.className = 'btn' + (i && !o.cols ? ' alt' : '') + (o.dis && o.dis[i] ? '' : ''); e.innerHTML = HK.tx(b);
          if (o.dis && o.dis[i]) e.disabled = true;
          e.onclick = function () { if (my !== K.dlgSeq) return; $('hkModal').hidden = true; res(i); };
          box.appendChild(e);
        });
        $('hkModal').hidden = false;
      });
    };
    K.closeDlg = function () { K.dlgSeq++; var m = $('hkModal'); if (m) m.hidden = true; };

    // ---------- Ton ----------
    var AC = null, lastSfx = 0;
    function tone(f, d, type, g0) { var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(g0 || .16, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); }
    function noise(dur, f0, f1, gain) {
      var t = AC.currentTime, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = AC.createBufferSource(); s.buffer = b; var f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = 1.2;
      var g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t);
    }
    K.sfx = function (kind) {
      if (!K.snd) return; var now = performance.now(); if (now - lastSfx < 40) return; lastSfx = now;
      try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
        if (kind === 'lay') noise(.07, 1300, 380, .5); else if (kind === 'take') noise(.06, 2200, 700, .4); else if (kind === 'flip') noise(.14, 900, 3000, .22);
        else if (kind === 'dice') { noise(.05, 3000, 1500, .4); setTimeout(function () { try { noise(.05, 2600, 1200, .35); } catch (e) {} }, 90); setTimeout(function () { try { noise(.06, 2000, 900, .3); } catch (e) {} }, 190); }
        else if (kind === 'ping') { tone(880, .12); setTimeout(function () { try { tone(1320, .2); } catch (e) {} }, 120); }
        else if (kind === 'coin') { tone(1568, .08, 'square', .06); setTimeout(function () { try { tone(2093, .16, 'square', .06); } catch (e) {} }, 70); }
        else if (kind === 'bad') { tone(220, .25, 'sawtooth', .08); }
        else if (kind === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { try { tone(f, .22); } catch (e) {} }, i * 110); }); }
      } catch (e) {}
    };
    K.sndBtn = function (btn) {
      var paint = function () { btn.textContent = K.snd ? 'Ton: an' : 'Ton: aus'; };
      btn.onclick = function () { K.snd = !K.snd; paint(); try { localStorage.setItem('hk-snd', K.snd ? '1' : '0'); } catch (e) {} };
      paint();
    };

    // ---------- Spielablauf ----------
    K.run = function (main) {      // main ist async; Abbruch über K.token
      Promise.resolve().then(main).catch(function (e) { if (e !== K.CANCEL) { console.error(e); K.toast(T('Fehler: ', 'Error: ') + (e && e.message || e), 6000); } });
    };
    K.snap = function (phase) { if (K.ROLE === 'host' && K.L) K.L.snap({ phase: phase, G: JSON.parse(JSON.stringify(K.G)) }); };
    K.reset = function () { K.token++; K.pend = {}; K.closeDlg(); K.V = null; K.prevV = null; if (DV) DV.cancel(); if (cfg.cancelDice) cfg.cancelDice(); };
    K.myName = function () { return (window.SITE && SITE.name()) || T('Du', 'You'); };
    K.startLocal = function (nCpu) {
      K.ROLE = 'local'; K.ME = 0;
      var names = HK.shuffle(cfg.cpuNames || ['Computer']), seats = [{ type: 'host', name: K.myName(), seat: 0 }];
      for (var i = 0; i < nCpu; i++) seats.push({ type: 'cpu', name: cfg.cpuNameFor ? cfg.cpuNameFor(i + 1) : names[i % names.length], seat: -1 });
      K.reset(); cfg.start(seats);
    };
    K.backToSetup = function () { K.reset(); K.G = null; if (cfg.onSetup) cfg.onSetup(); };
    K.exit = function (ask) {
      var go = function () {
        if (K.ROLE === 'host' && K.L.role === 'host') { K.backToSetup(); K.ROLE = 'local'; K.L.backToLobby(); return; }
        if (K.ROLE === 'client') { try { K.L.leave(); } catch (e) {} K.ROLE = 'local'; }
        K.backToSetup();
      };
      if (ask && K.ROLE === 'host' && K.L.role === 'host' && K.G && K.G.seats.some(function (s) { return s.type === 'remote'; }) && K.L.backup) {
        K.dlg({ ico: '🚪', title: HK.L2('Spiel verlassen', 'Leave game'), html: HK.L2('Soll das Spiel für alle enden, oder soll ein anderer Spieler Host werden und mit den anderen weiterspielen?', 'Should the game end for everyone, or should another player become host and keep playing with the others?'),
          btns: [HK.L2('Verlassen, die anderen spielen weiter', 'Leave, the others keep playing'), HK.L2('Spiel für alle beenden', 'End the game for everyone'), HK.L2('Abbrechen', 'Cancel')] }).then(function (i) {
          if (i === 2) return;
          if (i === 0) { K.L.handover(); setTimeout(function () { K.ROLE = 'local'; K.L.leave(); K.backToSetup(); }, 500); return; }
          go();
        });
        return;
      }
      go();
    };

    // ---------- Online ----------
    var idxOfSeat = function (seat) { return K.G ? K.G.seats.findIndex(function (s) { return s.seat === seat && s.type === 'remote'; }) : -1; };
    function hostMsg(from, m) {
      var p = idxOfSeat(from); if (p < 0 || !m) return;
      if (m.k === 'ans') {
        var e = K.pend[p]; if (!e || e.id !== m.id) return;
        if (!validAns(e.spec, m.a, p)) { K.L.sendTo(from, { k: 'ask', id: e.id, spec: e.spec }); return; }
        delete K.pend[p]; e.res(m.a);
      } else if (m.k === 'sync') { K.L.sendTo(from, { k: 'v', v: cfg.view(K.G, p) }); var e2 = K.pend[p]; if (e2) K.L.sendTo(from, { k: 'ask', id: e2.id, spec: e2.spec }); }
      else if (cfg.hostMsg) cfg.hostMsg(p, m);
    }
    var clientAsk = 0;
    function clientMsg(m) {
      if (!m) return;
      if (m.k === 'v') { K.V = m.v; K.apply(); }
      else if (m.k === 'ask') { var my = ++clientAsk; K.closeDlg(); K.uiAsk(m.spec).then(function (a) { if (my === clientAsk) K.L.send({ k: 'ans', id: m.id, a: a }); }); }
      else if (m.k === 'fx') { K.fxLocal(m.d); }
      else if (m.k === 'closedlg') { K.closeDlg(); }
    }
    K.cancelAsk = function (p) { var s = K.G.seats[p]; if (s && s.type === 'remote') K.L.sendTo(s.seat, { k: 'closedlg' }); };
    function onSeatDrop(seat) {
      var p = K.G ? K.G.seats.findIndex(function (s) { return s.seat === seat; }) : -1; if (p < 0) return;
      var was = K.G.seats[p].name; K.G.seats[p] = { type: 'cpu', name: was + ' (CPU)', seat: K.G.seats[p].seat, orig: was, away: true };
      K.say(-1, HK.L2(was + ' hat das Spiel verlassen. Ein Computer übernimmt, bis die Person zurückkommt.', was + ' left the game. A computer plays until they come back.'));
      var e = K.pend[p]; if (e) { delete K.pend[p]; e.res(e.ai()); }
      K.push();
    }
    function onRejoin(seat) {
      var p = K.G ? K.G.seats.findIndex(function (s) { return s.seat === seat && s.away; }) : -1; if (p < 0) return;
      var o = K.G.seats[p].orig; K.G.seats[p] = { type: 'remote', name: o, seat: seat };
      K.say(-1, HK.L2(o + ' ist zurück im Spiel.', o + ' is back in the game.')); K.push();
    }
    function onMigrate(snap, info) {
      K.reset(); K.ROLE = 'host';
      K.G = snap.G;
      K.G.seats.forEach(function (s) {
        if (s.seat === info.you) { s.type = 'host'; s.away = false; if (s.orig) { s.name = s.orig; delete s.orig; } }
        else if (s.type === 'host') { s.orig = s.name; s.name = s.name + ' (CPU)'; s.type = 'cpu'; s.away = true; }
        else if (s.type === 'remote') { s.orig = s.name; s.name = s.name + ' (CPU)'; s.type = 'cpu'; s.away = true; }
      });
      K.ME = K.G.seats.findIndex(function (s) { return s.type === 'host'; });
      K.say(-1, HK.L2('Der Host hat gewechselt. Das Spiel läuft weiter.', 'The host changed. The game goes on.'));
      if (cfg.onGame) cfg.onGame();
      K.push(); cfg.resume(snap.phase);
    }
    domReady(function () {
      if (!window.MP) return;
      K.L = MP.init({
        prefix: cfg.prefix, title: HK.tx(cfg.title), seats: cfg.seats, minPlayers: cfg.minPlayers || 2, bots: true, rejoin: true, migrate: true,
        onRejoin: onRejoin, onMigrate: onMigrate,
        onStart: function (info) {
          K.reset(); K.ROLE = info.role;
          if (info.role === 'host') {
            var seats = [], k = 0, names = HK.shuffle(cfg.cpuNames || ['Computer']);
            info.seats.forEach(function (s, i) {
              if (s.type === 'host' || s.type === 'remote') seats.push({ type: s.type, name: s.name || 'Spieler', seat: i });
              else if (s.type === 'cpu') seats.push({ type: 'cpu', name: cfg.cpuNameFor ? cfg.cpuNameFor(seats.length) : names[k++ % names.length], seat: -1 });
            });
            K.ME = seats.findIndex(function (s) { return s.type === 'host'; });
            cfg.start(seats);
          } else { K.G = null; if (cfg.onGame) cfg.onGame(); K.toast(HK.L2('Warte auf den Host …', 'Waiting for the host …')); K.L.send({ k: 'sync' }); }
        },
        onData: function (from, m) { if (K.L.role === 'client') clientMsg(m); else hostMsg(from, m); },
        onSeatDrop: onSeatDrop,
        onBackToLobby: function () { K.ROLE = 'local'; K.backToSetup(); },
        onLeave: function () { K.ROLE = 'local'; K.backToSetup(); }
      });
      var rb = document.getElementById('rejoinBtn');
      if (rb) { var upd = function () { rb.hidden = !K.L.hasRejoin(); }; rb.onclick = function () { K.L.rejoin(); }; upd(); setInterval(upd, 3000); }
      var ob = document.getElementById('online'); if (ob) ob.onclick = function () { K.L.open(); };
    });
    return K;
  };
})();

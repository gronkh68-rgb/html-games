// Hüttenduell – Regelwerk (ohne Oberfläche): Opfer-Kartenspiel auf vier Bahnen mit Waage
(function (root) {
  'use strict';
  var HD = {}, LANES = 4, WIN = 5;
  HD.LANES = LANES; HD.WIN = WIN;
  // Fähigkeiten: Name, Symbol, Beschreibung
  HD.SIG = {
    airborne: ['Flug', '🪽', 'Greift über Blocker hinweg direkt die Waage an.'],
    leap: ['Weitsprung', '🦘', 'Blockt auch fliegende Angreifer.'],
    worthy: ['Wertvolles Opfer', '🩸', 'Zählt als drei Opfer.'],
    fecund: ['Fruchtbar', '🥚', 'Beim Ausspielen kommt eine Kopie auf die Hand.'],
    death: ['Todesberührung', '☠️', 'Tötet jede Karte, die sie verletzt.'],
    quills: ['Stacheln', '📌', 'Fügt Angreifern 1 Schaden zu.'],
    bi: ['Doppelschlag', '⚔️', 'Greift die beiden Nachbarbahnen an statt der eigenen.'],
    tri: ['Dreifachschlag', '🔱', 'Greift die eigene und beide Nachbarbahnen an.'],
    unkill: ['Unsterblich', '♾️', 'Kehrt beim Tod als Kopie auf die Hand zurück.'],
    burrow: ['Wühler', '⛏️', 'Wechselt in eine angegriffene leere Bahn.'],
    sprint: ['Läufer', '💨', 'Wechselt am Zugende die Bahn.'],
    fledge: ['Jungtier', '🐣', 'Entwickelt sich nach einem Zug weiter.'],
    guard: ['Wächter', '🛡️', 'Springt in eine leere Bahn, wenn dort ein Gegner erscheint.'],
    hoard: ['Sammler', '🎒', 'Beim Ausspielen darfst du eine Karte aus dem Wald ziehen.']
  };
  // Karten: Name, Angriff, Leben, Kosten {b: Opfer, o: Knochen}, Fähigkeiten, Symbol, Entwicklung
  var C = {
    squirrel: ['Eichhörnchen', 0, 1, {}, [], '🐿️'],
    stoat: ['Hermelin', 1, 3, { b: 1 }, [], '🦦'],
    wolf_cub: ['Wolfswelpe', 1, 1, { b: 1 }, ['fledge'], '🐺', 'wolf'],
    wolf: ['Wolf', 3, 2, { b: 2 }, [], '🐺'],
    frog: ['Ochsenfrosch', 1, 2, { b: 1 }, ['leap'], '🐸'],
    adder: ['Kreuzotter', 1, 1, { o: 2 }, ['death'], '🐍'],
    raven: ['Rabe', 2, 3, { b: 2 }, ['airborne'], '🐦‍⬛'],
    bat: ['Fledermaus', 2, 1, { o: 4 }, ['airborne'], '🦇'],
    elk_fawn: ['Elchkalb', 1, 1, { b: 1 }, ['sprint', 'fledge'], '🦌', 'elk'],
    elk: ['Elch', 2, 4, { b: 2 }, ['sprint'], '🫎'],
    grizzly: ['Grizzly', 4, 6, { b: 3 }, [], '🐻'],
    hound: ['Bluthund', 2, 3, { b: 2 }, ['guard'], '🐕'],
    rattler: ['Klapperschlange', 3, 1, { o: 6 }, [], '🐍'],
    mole: ['Maulwurf', 0, 4, { b: 1 }, ['burrow'], '🐀'],
    porcupine: ['Stachelschwein', 1, 2, { b: 1 }, ['quills'], '🦔'],
    mantis: ['Fangschrecke', 1, 1, { b: 1 }, ['bi'], '🦗'],
    mantis_god: ['Mantisgott', 1, 1, { b: 1 }, ['tri'], '🦗'],
    coyote: ['Kojote', 2, 1, { o: 4 }, ['fecund'], '🦊'],
    warren: ['Kaninchenbau', 0, 2, { b: 1 }, ['fecund'], '🐇'],
    packrat: ['Packratte', 2, 2, { b: 2 }, ['hoard'], '🐀'],
    ouro: ['Ouroboros', 1, 1, { b: 2 }, ['unkill'], '🐍'],
    ox: ['Ur', 3, 4, { b: 2, o: 2 }, ['worthy'], '🐂'],
    vulture: ['Geier', 3, 3, { b: 2, o: 2 }, ['airborne'], '🦅']
  };
  // Opfer-Tier (Waldstapel)
  HD.CARDS = {}; Object.keys(C).forEach(function (id) { var c = C[id]; HD.CARDS[id] = { id: id, n: c[0], atk: c[1], hp: c[2], cost: c[3], sig: c[4], art: c[5], evo: c[6] || null }; });
  var uid = 1;
  HD.make = function (id) { var d = HD.CARDS[id], c = { id: id, uid: uid++, n: d.n, atk: d.atk, hp: d.hp, max: d.hp, sig: d.sig.slice(), art: d.art, cost: d.cost, age: 0, dir: 1 }; return c; };
  HD.has = function (c, s) { return c && c.sig.indexOf(s) >= 0; };
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd || Math.random)() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  HD.shuffle = shuffle;
  // opts: { decks:[[id..],[id..]], npc: true|false, rnd }
  HD.newGame = function (opts) {
    var G = { p: [], turn: 0, n: 0, phase: 'draw', over: null, npc: !!opts.npc, rnd: opts.rnd || Math.random, log: [] };
    for (var s = 0; s < 2; s++) {
      var deck = shuffle(opts.decks[s].map(HD.make), G.rnd), side = []; for (var i = 0; i < 20; i++) side.push(HD.make('squirrel'));
      var P = { deck: deck, side: side, hand: [], board: [null, null, null, null], queue: [null, null, null, null], bones: 0, dmg: 0, drew: false };
      G.p.push(P);
      for (var h = 0; h < 3; h++) if (P.deck.length) P.hand.push(P.deck.pop());
      P.hand.push(side.pop());
    }
    return G;
  };
  HD.diff = function (G) { return G.p[0].dmg - G.p[1].dmg; };
  function check(G) { var d = HD.diff(G); if (d >= WIN) G.over = 0; else if (d <= -WIN) G.over = 1; return G.over !== null; }
  // ---------- Aktionen ----------
  HD.draw = function (G, s, from) {
    var P = G.p[s]; if (P.drew || G.over !== null) return null;
    var pile = from === 'side' ? P.side : P.deck; if (!pile.length) pile = from === 'side' ? P.deck : P.side; if (!pile.length) return null;
    var c = pile.pop(); P.hand.push(c); P.drew = true; G.phase = 'main'; return c;
  };
  function worth(c) { return HD.has(c, 'worthy') ? 3 : 1; }
  // Prüft, ob Handkarte idx mit den Opfer-Bahnen sac auf Bahn lane gespielt werden kann; gibt null oder Fehlertext
  HD.check = function (G, s, idx, lane, sac) {
    var P = G.p[s], c = P.hand[idx]; sac = sac || [];
    if (!c) return 'Keine Karte'; if (G.over !== null) return 'Spiel vorbei'; if (G.turn !== s || G.phase !== 'main') return 'Nicht am Zug';
    var need = c.cost.b || 0, got = 0; for (var i = 0; i < sac.length; i++) { var o = P.board[sac[i]]; if (!o) return 'Kein Opfer'; got += worth(o); }
    if (got < need) return 'Zu wenig Opfer (' + got + '/' + need + ')';
    if (sac.length > 1 && got - worth(P.board[sac[sac.length - 1]]) >= need) { /* überzählige Opfer sind erlaubt, aber unnötig */ }
    if ((c.cost.o || 0) > P.bones) return 'Zu wenig Knochen';
    if (lane < 0 || lane >= LANES) return 'Ungültige Bahn';
    if (P.board[lane] && sac.indexOf(lane) < 0) return 'Bahn besetzt';
    return null;
  };
  HD.play = async function (G, s, idx, lane, sac, hook) {
    var err = HD.check(G, s, idx, lane, sac); if (err) return err;
    var P = G.p[s], c = P.hand.splice(idx, 1)[0]; sac = sac || [];
    sac.forEach(function (l) { kill(G, s, l, true); });
    P.bones -= (c.cost.o || 0); P.board[lane] = c; c.age = 0;
    if (HD.has(c, 'fecund')) P.hand.push(HD.make(c.id));
    if (HD.has(c, 'hoard') && P.deck.length) P.hand.push(P.deck.pop());
    onEnter(G, s, lane);
    if (hook) await hook({ k: 'play', s: s, l: lane });
    return null;
  };
  function kill(G, s, l, sacrificed) {
    var P = G.p[s], c = P.board[l]; if (!c) return;
    P.board[l] = null; P.bones++;
    if (!sacrificed && HD.has(c, 'unkill')) P.hand.push(HD.make(c.id));
  }
  // Wächter der Gegenseite wechseln in leere Bahnen, wenn ein Gegner dort erscheint
  function onEnter(G, s, lane) {
    var o = 1 - s, O = G.p[o];
    if (!G.p[s].board[lane] || O.board[lane]) return;
    for (var i = 0; i < LANES; i++) if (HD.has(O.board[i], 'guard') && i !== lane) { O.board[lane] = O.board[i]; O.board[i] = null; return; }
  }
  // Angriff aller Karten von Spieler s; hook(ev) wird nach jedem Schritt aufgerufen (Animation)
  HD.attack = async function (G, s, hook) {
    var o = 1 - s, P = G.p[s], O = G.p[o]; G.phase = 'attack';
    for (var l = 0; l < LANES && G.over === null; l++) {
      var c = P.board[l]; if (!c || c.atk <= 0) continue;
      var tg = HD.has(c, 'tri') ? [l - 1, l, l + 1] : HD.has(c, 'bi') ? [l - 1, l + 1] : [l];
      if (hook) await hook({ k: 'atk', s: s, l: l });
      for (var t = 0; t < tg.length && G.over === null; t++) {
        var tl = tg[t]; if (tl < 0 || tl >= LANES || P.board[l] !== c) continue;
        var d = O.board[tl];
        if (!d) { // Wühler wechselt in die leere Bahn
          for (var b = 0; b < LANES; b++) if (HD.has(O.board[b], 'burrow')) { O.board[tl] = O.board[b]; O.board[b] = null; d = O.board[tl]; break; }
        }
        if (d && HD.has(c, 'airborne') && !HD.has(d, 'leap')) d = null;
        if (d) {
          d.hp -= c.atk; var dead = d.hp <= 0 || HD.has(c, 'death');
          if (HD.has(d, 'quills')) c.hp -= 1;
          if (hook) await hook({ k: 'hit', s: o, l: tl, n: c.atk });
          if (dead) { var dl = O.board.indexOf(d); if (dl >= 0) kill(G, o, dl); if (hook) await hook({ k: 'die', s: o, l: tl }); }
          if (c.hp <= 0) { kill(G, s, l); if (hook) await hook({ k: 'die', s: s, l: l }); break; }
        } else {
          P.dmg += c.atk; if (hook) await hook({ k: 'scale', s: s, n: c.atk }); if (check(G)) break;
        }
      }
    }
    return G.over;
  };
  // Zugende von s: Läufer bewegen sich, Jungtiere entwickeln sich
  HD.endTurn = function (G, s) {
    var P = G.p[s];
    for (var i = 0; i < LANES; i++) {
      var c = P.board[i]; if (!c) continue; c.age++;
      if (HD.has(c, 'sprint')) {
        var j = i + c.dir; if (j < 0 || j >= LANES || P.board[j]) { c.dir = -c.dir; j = i + c.dir; }
        if (j >= 0 && j < LANES && !P.board[j]) { P.board[j] = c; P.board[i] = null; onEnter(G, s, j); i = j; }
      }
    }
    for (var k = 0; k < LANES; k++) {
      var f = P.board[k];
      if (f && HD.has(f, 'fledge') && f.age >= 1) { var n = HD.make(HD.CARDS[f.id].evo); n.age = f.age; n.dir = f.dir; P.board[k] = n; }
    }
  };
  HD.startTurn = function (G, s) { G.turn = s; G.phase = 'draw'; G.p[s].drew = false; if (s === 0) G.n++; };
  // ---------- Computergegner ----------
  // Rückt die Warteschlange vor (Gegner-NPC)
  HD.advanceQueue = function (G, s) {
    var P = G.p[s];
    for (var i = 0; i < LANES; i++) if (P.queue[i] && !P.board[i]) { P.board[i] = P.queue[i]; P.queue[i] = null; P.board[i].age = 0; onEnter(G, s, i); }
  };
  // Legt neue Karten in die Warteschlange; diff = Schwierigkeit 1..3
  HD.fillQueue = function (G, s, diff) {
    var P = G.p[s], O = G.p[1 - s], rnd = G.rnd, n = 1 + (diff >= 2 && G.n > 5 ? 1 : 0) + (diff >= 3 && G.n > 3 ? 1 : 0);
    for (var k = 0; k < n && P.deck.length; k++) {
      var free = []; for (var i = 0; i < LANES; i++) if (!P.queue[i]) free.push(i);
      if (!free.length) break;
      var lane = free[0], best = -99;
      free.forEach(function (l) { var sc = rnd() * 2; if (O.board[l]) sc += 2 + O.board[l].atk * .5; if (!P.board[l]) sc += 1; if (P.board[l]) sc -= 3; if (sc > best) { best = sc; lane = l; } });
      var lim = 3 + G.n * (.7 + diff * .3), el = [], mn = 0;
      P.deck.forEach(function (c, ix) { var pw = c.atk + c.hp; if (pw <= lim) el.push(ix); if (pw < P.deck[mn].atk + P.deck[mn].hp) mn = ix; });
      var pick = el.length ? el[Math.floor(rnd() * el.length)] : mn;
      P.queue[lane] = P.deck.splice(pick, 1)[0];
    }
  };
  // Einfacher Spieler-Bot (für Tests und als Platzhalter): zieht, spielt so viel wie möglich, gibt zurück
  HD.botPlay = async function (G, s, hook) {
    var P = G.p[s]; HD.draw(G, s, P.deck.length && G.rnd() < .7 ? 'deck' : 'side');
    for (var guard = 0; guard < 10; guard++) {
      var done = true;
      var order = P.hand.map(function (c, i) { return i; }).sort(function (a, b) { var A = P.hand[a], B = P.hand[b]; return (B.atk + B.hp) - (A.atk + A.hp); });
      for (var oi = 0; oi < order.length; oi++) {
        var idx = order[oi], c = P.hand[idx], need = c.cost.b || 0, sac = [], got = 0;
        var mine = []; for (var l = 0; l < LANES; l++) if (P.board[l]) mine.push(l);
        mine.sort(function (a, b) { return (P.board[a].atk + P.board[a].hp) - (P.board[b].atk + P.board[b].hp); });
        for (var m = 0; m < mine.length && got < need; m++) { if (need > 0 && P.board[mine[m]].id !== 'squirrel' && c.id === 'squirrel') break; sac.push(mine[m]); got += worth(P.board[mine[m]]); }
        var lane = -1, pref = -99;
        for (var q = 0; q < LANES; q++) { if (P.board[q] && sac.indexOf(q) < 0) continue; var sc = G.p[1 - s].board[q] ? 1 : 2; if (sc > pref) { pref = sc; lane = q; } }
        if (lane < 0 || HD.check(G, s, idx, lane, sac)) continue;
        if (need > 0 && c.atk + c.hp <= sac.length * 2) continue;
        await HD.play(G, s, idx, lane, sac, hook); done = false; break;
      }
      if (done) break;
    }
  };
  root.HD = HD;
  if (typeof module !== 'undefined') module.exports = HD;
})(typeof window !== 'undefined' ? window : globalThis);

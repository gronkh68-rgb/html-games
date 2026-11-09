/* Mädn Teams: Regeln und Computer-Gegner (läuft nur beim Host). Spielstand G enthält nur JSON-Daten.
   Ring mit 80 Feldern. 4 Spieler (je 8 Figuren, Zielgasse 8) oder 8 Spieler (je 4 Figuren, Zielgasse 4). Teams: gegenüber sitzende Spieler.
   Position einer Figur: -1 = Haus, 0..79 = Schritte ab dem eigenen Startfeld, 80.. = Zielgasse (80 + Platz). */
(function () {
  var E = window.MTE = {}, L2 = HK.L2, K = null;
  E.bind = function (k) { K = k; };
  var RING = 80;
  var nm = function (p) { return K.nm(p); };
  E.teamOf = function (g, p) { return p % (g.n / 2); };
  E.partner = function (g, p) { return (p + g.n / 2) % g.n; };
  E.start = function (g, p) { var per = g.n / 4, side = Math.floor(p / per), j = p % per; return 20 * side + (per === 1 ? 10 : 5 + 10 * j); };
  var sameTeam = function (g, a, b) { return E.teamOf(g, a) === E.teamOf(g, b); };
  var done = function (g, p) { return g.pos[p].every(function (x) { return x >= RING; }); };
  E.done = done;
  E.teamDone = function (g, t) { for (var p = 0; p < g.n; p++) if (E.teamOf(g, p) === t && !done(g, p)) return false; return true; };
  // wer zieht die Figuren: wer selbst fertig ist, zieht die des Partners
  E.ctrl = function (g, p) { return done(g, p) ? E.partner(g, p) : p; };
  function occupant(g, ringIdx) {
    for (var q = 0; q < g.n; q++) { var s = E.start(g, q); for (var i = 0; i < g.P; i++) { var x = g.pos[q][i]; if (x >= 0 && x < RING && (s + x) % RING === ringIdx) return { q: q, i: i }; } }
    return null;
  }
  E.occupant = occupant;
  // Sitze, deren Figuren mit diesem Wurf gezogen werden dürfen: Teamregel = das ganze Team, sonst nur man selbst (oder der Partner, wenn man fertig ist)
  E.seatsFor = function (g, p) {
    if (g.opts.share) { var r = []; for (var q = 0; q < g.n; q++) if (E.teamOf(g, q) === E.teamOf(g, p) && !done(g, q)) r.push(q); return r; }
    return [E.ctrl(g, p)];
  };
  function movesOf(g, c, v) {
    var moves = [], s = E.start(g, c), P = g.P, lastSlot = RING + P - 1;
    g.pos[c].forEach(function (x, i) {
      var to = null;
      if (x === -1) { if (v !== 6) return; to = 0; }
      else { to = x + v; }
      if (to > lastSlot) return;
      if (to >= RING) {                     // Zielgasse: nicht über eigene Figuren springen
        for (var k = Math.max(x + 1, RING); k <= to; k++) if (g.pos[c].some(function (y, j) { return j !== i && y === k; })) return;
        moves.push({ q: c, i: i, from: x, to: to, cap: null }); return;
      }
      var o = occupant(g, (s + to) % RING);
      if (o && sameTeam(g, o.q, c) && !(o.q === c && o.i === i)) return;     // Figuren des eigenen Teams blockieren
      moves.push({ q: c, i: i, from: x, to: to, cap: o && !sameTeam(g, o.q, c) ? o : null });
    });
    return moves;
  }
  // alle erlaubten Züge für Wurf v aus den Sitzen in seats
  E.legal = function (g, seats, v) {
    var all = [];
    seats.forEach(function (c) {
      var mv = movesOf(g, c, v), house = g.pos[c].some(function (x) { return x === -1; });
      if (v === 6 && house) { var ent = mv.filter(function (m) { return m.from === -1; }); if (ent.length) mv = ent; }         // mit einer 6 muss eine Figur raus
      else if (house) { var off = mv.filter(function (m) { return m.from === 0; }); if (off.length) mv = off; }                  // das Startfeld muss frei werden
      all = all.concat(mv);
    });
    return all;
  };
  E.apply = function (g, c, m) {
    g.pos[m.q][m.i] = m.to;
    if (m.cap) { g.pos[m.cap.q][m.cap.i] = -1; }
    g.last = { p: m.q, i: m.i, from: m.from, to: m.to, cap: m.cap, seq: (g.last ? g.last.seq : 0) + 1 };
  };
  // ---------- Computer ----------
  function threatened(g, c, ringIdx) {      // kann ein Gegner dieses Feld mit einem Wurf von 1 bis 6 erreichen?
    for (var q = 0; q < g.n; q++) { if (sameTeam(g, q, c)) continue; var s = E.start(g, q); for (var i = 0; i < g.P; i++) { var x = g.pos[q][i]; if (x < 0 || x >= RING) continue; var cur = (s + x) % RING, d = (ringIdx - cur + RING) % RING; if (d >= 1 && d <= 6 && x + d < RING) return true; } }
    return false;
  }
  E.ai = function (g, p, moves) {
    var best = 0, bs = -1e9;
    moves.forEach(function (m, k) {
      var c = m.q, s = E.start(g, c), sc = Math.random() * 3;
      if (m.cap) sc += 120 + g.pos[m.cap.q][m.cap.i] * .4;
      if (m.to >= RING) sc += 70 + (m.to - RING) * 3;
      if (m.from === -1) sc += 85;
      sc += m.to * .25;
      if (m.to < RING) {
        var ri = (s + m.to) % RING;
        if (threatened(g, c, ri)) sc -= 28;
        if (m.from >= 0 && m.from < RING && threatened(g, c, (s + m.from) % RING)) sc += 32;      // aus der Gefahr ziehen
      }
      if (m.from >= RING) sc -= 8;
      if (sc > bs) { bs = sc; best = k; }
    });
    return best;
  };

  // ---------- Aufbau und Ablauf ----------
  E.setup = function (seats, opts) {
    var n = opts.n, P = opts.P, g = { seats: seats, opts: { n: n, P: P, share: opts.share !== false }, n: n, P: P, log: [], pos: [], cur: HK.rnd(n), die: 0, dieP: -1, last: null, over: null, rolls: 0 };
    for (var p = 0; p < n; p++) { g.pos.push([]); for (var i = 0; i < P; i++) g.pos[p].push(-1); }
    return g;
  };
  function nextSeat(g) { g.cur = (g.cur + 1) % g.n; }
  E.main = async function () {
    var g = K.G;
    while (!g.over) {
      var p = g.cur;
      if (E.teamDone(g, E.teamOf(g, p))) { g.over = { team: E.teamOf(g, p) }; break; }
      K.snap('turn');
      var again = true, extra = 0;
      while (again && !g.over) {
        again = false;
        var seatsF = E.seatsFor(g, p), c = seatsF[0];
        var onField = seatsF.some(function (q) { return g.pos[q].some(function (x) { return x >= 0; }); }), attempts = onField ? 1 : 3, v = 0, moves = [];
        for (var a = 0; a < attempts; a++) {
          g.dieP = p; g.die = 0; K.push();
          var d = await K.throwDice(p, 1, L2('Wirf den Würfel', 'Throw the die'));
          v = d[0]; g.die = v; g.rolls++;
          K.say(p, L2(nm(p) + ' würfelt eine ' + v + '.', nm(p) + ' rolls a ' + v + '.'), L2('Du würfelst eine ' + v + '.', 'You roll a ' + v + '.'));
          K.push(); await K.sleep(500);
          moves = E.legal(g, seatsF, v);
          if (moves.length) break;
        }
        if (!moves.length) { K.say(p, L2(nm(p) + ' kann nicht ziehen.', nm(p) + ' cannot move.'), L2('Du kannst nicht ziehen.', 'You cannot move.')); K.push(); await K.sleep(500); break; }
        var idx = moves.length === 1 && g.seats[p].type === 'cpu' ? 0 : await K.ask(p, { k: 'turn', v: v, opts: moves }, function () { return E.ai(g, p, moves); });
        if (!(Number.isInteger(idx) && idx >= 0 && idx < moves.length)) idx = E.ai(g, p, moves);
        var m = moves[idx];
        E.apply(g, p, m);
        if (m.cap) { K.say(p, L2(nm(p) + ' wirft eine Figur von ' + nm(m.cap.q) + ' raus!', nm(p) + ' sends a piece of ' + nm(m.cap.q) + ' home!'), L2('Du wirfst eine Figur von ' + nm(m.cap.q) + ' raus!', 'You send a piece of ' + nm(m.cap.q) + ' home!')); K.sfx('bad'); }
        else if (m.to >= RING) { K.say(p, L2(nm(m.q) + ' bringt eine Figur ins Ziel.', nm(m.q) + ' brings a piece home.')); K.sfx('coin'); }
        K.push(); await K.sleep(g.seats[p].type === 'cpu' ? 450 : 200);
        if (E.teamDone(g, E.teamOf(g, p))) { g.over = { team: E.teamOf(g, p) }; break; }
        if (v === 6 && ++extra < 4) again = true;      // nach einer 6 nochmal (höchstens dreimal hintereinander)
      }
      if (g.over) break;
      nextSeat(g);
    }
    K.push();
  };
  E.valid = function (spec, a, g, p) { return spec.k === 'turn' && Number.isInteger(a) && a >= 0 && a < spec.opts.length; };
})();

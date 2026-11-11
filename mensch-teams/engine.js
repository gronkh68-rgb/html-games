/* Mädn Teams: Regeln und Computer-Gegner (läuft nur beim Host). Spielstand G enthält nur JSON-Daten.
   Ring mit 80 Feldern. 4 Spieler (je 8 Figuren, Zielgasse 8) oder 8 Spieler (je 4 Figuren, Zielgasse 4). Teams: gegenüber sitzende Spieler.
   Position einer Figur: -1 = Haus, 0..79 = Schritte ab dem eigenen Startfeld, 80.. = Zielgasse (80 + Platz). */
(function () {
  var E = window.MTE = {}, L2 = HK.L2, K = null;
  E.bind = function (k) { K = k; };
  // Brett "ring": 80 Felder im Quadrat. Brett "eight" (liegende Acht): 72 Wege-Positionen, die Kreuzung in der Mitte ist ein gemeinsames Feld (Position 18 und 54),
  // 4 Spieler, je Team ein gemeinsames Haus mit 8 Plätzen. Sitz -> Startposition auf der Acht und Laufrichtung (+1 / -1): Team 0 rechts, Team 1 links, die beiden Spieler eines Teams laufen gegenläufig.
  var EN = 72, ECEN = 18, EDUP = 54, ESEAT = [{ s: 1, d: 1 }, { s: 37, d: 1 }, { s: 71, d: -1 }, { s: 35, d: -1 }];
  E.EN = EN; E.ESEAT = ESEAT; E.ECEN = ECEN; E.EDUP = EDUP;
  E.len = function (g) { return g.map === 'eight' ? EN : 80; };
  E.slots = function (g) { return g.map === 'eight' ? 8 : g.P; };
  // Wege-Position der Acht -> Feldnummer (die zweite Kreuzungsposition zählt als dasselbe Feld wie die erste)
  E.eightCell = function (q, x) { var i = (((ESEAT[q].s + ESEAT[q].d * x) % EN) + EN) % EN; return i === EDUP ? ECEN : i; };
  var nm = function (p) { return K.nm(p); };
  E.teamOf = function (g, p) { return p % (g.n / 2); };
  E.partner = function (g, p) { return (p + g.n / 2) % g.n; };
  E.start = function (g, p) { if (g.map === 'eight') return ESEAT[p].s; var per = g.n / 4, side = Math.floor(p / per), j = p % per; return 20 * side + (per === 1 ? 10 : 5 + 10 * j); };
  E.cell = function (g, q, x) { return g.map === 'eight' ? E.eightCell(q, x) : (E.start(g, q) + x) % 80; };
  E.applyOp = function (r, op) { return op === 0 ? r + 2 : op === 1 ? Math.max(1, r - 2) : op === 2 ? r * 2 : Math.max(1, Math.ceil(r / 2)); };      // +2, -2, x2, geteilt durch 2 (aufgerundet); nie unter 1
  var sameTeam = function (g, a, b) { return E.teamOf(g, a) === E.teamOf(g, b); };
  var done = function (g, p) { var R = E.len(g); return g.pos[p].every(function (x) { return x >= R; }); };
  E.done = done;
  E.teamDone = function (g, t) { for (var p = 0; p < g.n; p++) if (E.teamOf(g, p) === t && !done(g, p)) return false; return true; };
  // wer zieht die Figuren: wer selbst fertig ist, zieht die des Partners
  E.ctrl = function (g, p) { return done(g, p) ? E.partner(g, p) : p; };
  function occupant(g, cell) {
    var R = E.len(g);
    for (var q = 0; q < g.n; q++) for (var i = 0; i < g.P; i++) { var x = g.pos[q][i]; if (x >= 0 && x < R && E.cell(g, q, x) === cell) return { q: q, i: i }; }
    return null;
  }
  // Haus: Liegende Acht = gemeinsames Haus des Teams (egal wer einzieht), Ring = Zielgasse nur für den eigenen Spieler
  function houseBusy(g, c, k, i) {
    if (g.map !== 'eight') return g.pos[c].some(function (y, j) { return j !== i && y === k; });
    for (var q = 0; q < g.n; q++) if (E.teamOf(g, q) === E.teamOf(g, c)) for (var j = 0; j < g.P; j++) if (!(q === c && j === i) && g.pos[q][j] === k) return true;
    return false;
  }
  E.occupant = occupant;
  // Sitze, deren Figuren mit diesem Wurf gezogen werden dürfen: Teamregel = das ganze Team, sonst nur man selbst (oder der Partner, wenn man fertig ist)
  E.seatsFor = function (g, p) {
    if (g.map === 'eight') { var rr = []; for (var q0 = 0; q0 < g.n; q0++) if (E.teamOf(g, q0) === E.teamOf(g, p)) rr.push(q0); return rr; }      // Acht: das ganze Team zieht immer gemeinsam (das Haus ist geteilt, sonst könnten Figuren darin festsitzen)
    if (g.opts.share) { var r = []; for (var q = 0; q < g.n; q++) if (E.teamOf(g, q) === E.teamOf(g, p) && !done(g, q)) r.push(q); return r; }
    return [E.ctrl(g, p)];
  };
  // r = Augen des Würfels (nur mit einer 6 kommt man raus), s = Anzahl der Schritte (auf der Acht durch den Rechenwürfel verändert, sonst gleich r)
  function movesOf(g, c, r, s) {
    var moves = [], R = E.len(g), lastSlot = R + E.slots(g) - 1;
    g.pos[c].forEach(function (x, i) {
      var to = null;
      if (x === -1) { if (r !== 6) return; to = 0; }
      else { to = x + s; }
      if (to > lastSlot) return;
      if (to >= R) {                        // Haus/Zielgasse: nicht über Figuren springen
        for (var k = Math.max(x + 1, R); k <= to; k++) if (houseBusy(g, c, k, i)) return;
        moves.push({ q: c, i: i, from: x, to: to, cap: null }); return;
      }
      var o = occupant(g, E.cell(g, c, to));
      if (o && sameTeam(g, o.q, c) && !(o.q === c && o.i === i)) return;     // Figuren des eigenen Teams blockieren
      moves.push({ q: c, i: i, from: x, to: to, cap: o && !sameTeam(g, o.q, c) ? o : null });
    });
    return moves;
  }
  // alle erlaubten Züge für Wurf v aus den Sitzen in seats
  E.legal = function (g, seats, v, s) {
    var all = [];
    seats.forEach(function (c) {
      var mv = movesOf(g, c, v, s == null ? v : s), house = g.pos[c].some(function (x) { return x === -1; });
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
  function threatened(g, c, cell) {      // kann ein Gegner dieses Feld mit einem Wurf von 1 bis 6 erreichen?
    var R = E.len(g);
    for (var q = 0; q < g.n; q++) { if (sameTeam(g, q, c)) continue; for (var i = 0; i < g.P; i++) { var x = g.pos[q][i]; if (x < 0 || x >= R) continue; for (var d = 1; d <= 6; d++) if (x + d < R && E.cell(g, q, x + d) === cell) return true; } }
    return false;
  }
  E.ai = function (g, p, moves) {
    var best = 0, bs = -1e9, R = E.len(g);
    moves.forEach(function (m, k) {
      var c = m.q, sc = Math.random() * 3;
      if (m.cap) sc += 120 + g.pos[m.cap.q][m.cap.i] * .4;
      if (m.to >= R) sc += 70 + (m.to - R) * 3;
      if (m.from === -1) sc += 85;
      sc += m.to * .25;
      if (m.to < R) {
        if (threatened(g, c, E.cell(g, c, m.to))) sc -= 28;
        if (m.from >= 0 && m.from < R && threatened(g, c, E.cell(g, c, m.from))) sc += 32;      // aus der Gefahr ziehen
      }
      if (m.from >= R) sc -= 8;
      if (sc > bs) { bs = sc; best = k; }
    });
    return best;
  };

  // ---------- Aufbau und Ablauf ----------
  E.setup = function (seats, opts) {
    var map = opts.map === 'eight' ? 'eight' : 'ring', n = map === 'eight' ? 4 : opts.n, P = map === 'eight' ? 4 : opts.P;
    var g = { seats: seats, opts: { n: n, P: P, share: opts.share !== false, map: map }, map: map, n: n, P: P, log: [], pos: [], cur: HK.rnd(n), die: 0, mod: null, dieP: -1, last: null, over: null, rolls: 0 };
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
      var again = true, extra = 0, eight = g.map === 'eight', steps = 0;
      while (again && !g.over) {
        again = false;
        var seatsF = E.seatsFor(g, p), c = seatsF[0];
        var onField = seatsF.some(function (q) { return g.pos[q].some(function (x) { return x >= 0; }); }), attempts = onField ? 1 : 3, v = 0, moves = [];
        for (var a = 0; a < attempts; a++) {
          g.dieP = p; g.die = 0; g.mod = null; K.push();
          var d = await K.throwDice(p, eight ? 2 : 1, eight ? L2('Wirf beide Würfel (der goldene rechnet)', 'Throw both dice (the golden one calculates)') : L2('Wirf den Würfel', 'Throw the die'), { mod: eight });
          v = d[0]; g.die = v; g.rolls++; steps = v;
          if (eight) {      // zweiter, physischer Rechenwürfel (+2, -2, x2, geteilt durch 2, Seiten 1 bis 4): wird immer angewendet, das Ergebnis ist mindestens 1
            var op = Math.max(0, Math.min(3, (d[1] | 0) - 1)); steps = E.applyOp(v, op); g.mod = { op: op, s: steps, seq: g.rolls };
            var ot = ['+2', '\u22122', '\u00d72', '\u00f72'][op];
            K.say(p, L2(nm(p) + ' würfelt ' + v + ' ' + ot + ' = ' + steps + '.', nm(p) + ' rolls ' + v + ' ' + ot + ' = ' + steps + '.'), L2('Du würfelst ' + v + ' ' + ot + ' = ' + steps + '.', 'You roll ' + v + ' ' + ot + ' = ' + steps + '.'));
          } else K.say(p, L2(nm(p) + ' würfelt eine ' + v + '.', nm(p) + ' rolls a ' + v + '.'), L2('Du würfelst eine ' + v + '.', 'You roll a ' + v + '.'));
          K.push(); await K.sleep(eight ? 800 : 500);
          moves = E.legal(g, seatsF, v, steps);
          if (moves.length) break;
        }
        if (!moves.length) { K.say(p, L2(nm(p) + ' kann nicht ziehen.', nm(p) + ' cannot move.'), L2('Du kannst nicht ziehen.', 'You cannot move.')); K.push(); await K.sleep(500); break; }
        var idx = moves.length === 1 && g.seats[p].type === 'cpu' ? 0 : await K.ask(p, { k: 'turn', v: steps || v, opts: moves }, function () { return E.ai(g, p, moves); });
        if (!(Number.isInteger(idx) && idx >= 0 && idx < moves.length)) idx = E.ai(g, p, moves);
        var m = moves[idx];
        E.apply(g, p, m);
        if (m.cap) { K.say(p, L2(nm(p) + ' wirft eine Figur von ' + nm(m.cap.q) + ' raus!', nm(p) + ' sends a piece of ' + nm(m.cap.q) + ' home!'), L2('Du wirfst eine Figur von ' + nm(m.cap.q) + ' raus!', 'You send a piece of ' + nm(m.cap.q) + ' home!')); K.sfx('bad'); }
        else if (m.to >= E.len(g)) { K.say(p, L2(nm(m.q) + ' bringt eine Figur ins Ziel.', nm(m.q) + ' brings a piece home.')); K.sfx('coin'); }
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

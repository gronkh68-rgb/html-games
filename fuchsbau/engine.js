/* Fuchsbau: Spielregeln und Computer-Gegner. Läuft im Browser (window.Fuchsbau) und in Node (require). */
(function (root) {
  'use strict';

  var N = 7, SIZE = N * N;
  var WIN = 100000;

  // Standard-Aufbau (Feldnummer = Zeile * 7 + Spalte). Ausbalanciert per KI-gegen-KI-Simulation (siehe README).
  var CFG = {
    holes: [24, 3, 21, 27, 45],             // Bau in der Mitte + 4 Ausgänge am Rand
    hens: [8, 12, 36, 40, 1, 13, 47, 35],   // 8 Hühner, drehsymmetrisch verteilt
    hounds: [0, 6, 42, 48],                 // 4 Hunde in den Ecken
    fox: 24,                                // Fuchs startet im Bau
    need: 4,                                // so viele Hühner braucht der Fuchs
    rounds: 16                              // nach so vielen Runden graut der Morgen
  };

  var NB = [], NB8 = [];
  for (var i = 0; i < SIZE; i++) {
    var r = (i / N) | 0, c = i % N, a = [];
    if (r > 0) a.push(i - N);
    if (c < N - 1) a.push(i + 1);
    if (r < N - 1) a.push(i + N);
    if (c > 0) a.push(i - 1);
    NB.push(a);
    var d = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      var rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) d.push(rr * N + cc);
    }
    NB8.push(d);
  }

  function setup(cfg) {
    cfg = cfg || CFG;
    var hen = [], hole = [];
    for (var i = 0; i < SIZE; i++) { hen.push(false); hole.push(false); }
    cfg.hens.forEach(function (h) { hen[h] = true; });
    cfg.holes.forEach(function (h) { hole[h] = true; });
    return {
      cfg: cfg, hole: hole, hen: hen,
      fox: cfg.fox, hounds: cfg.hounds.slice(),
      eaten: 0, round: 1, turn: 'F', winner: null, reason: ''
    };
  }

  function clone(s) {
    return {
      cfg: s.cfg, hole: s.hole, hen: s.hen.slice(), fox: s.fox, hounds: s.hounds.slice(),
      eaten: s.eaten, round: s.round, turn: s.turn, winner: s.winner, reason: s.reason
    };
  }

  function houndAt(s, f) { return s.hounds.indexOf(f) >= 0; }

  // Züge des Fuchses (8 Richtungen oder Tunnel von Bauloch zu Bauloch): {to, tunnel}
  function foxMoves(s) {
    var out = [], nb = NB8[s.fox];
    for (var i = 0; i < nb.length; i++) if (!houndAt(s, nb[i])) out.push({ to: nb[i], tunnel: false });
    if (s.hole[s.fox]) {
      var hs = s.cfg.holes;
      for (var j = 0; j < hs.length; j++)
        if (hs[j] !== s.fox && !houndAt(s, hs[j]) && NB8[s.fox].indexOf(hs[j]) < 0) out.push({ to: hs[j], tunnel: true });
    }
    return out;
  }

  // Züge der Hunde: {h (Index), to}. Hunde betreten keine Hühnerfelder und schnappen den Fuchs nicht in einem Bauloch.
  function houndMoves(s) {
    var out = [];
    for (var h = 0; h < s.hounds.length; h++) {
      var nb = NB[s.hounds[h]];
      for (var i = 0; i < nb.length; i++) {
        var t = nb[i];
        if (!houndAt(s, t) && !s.hen[t] && !(t === s.fox && s.hole[t])) out.push({ h: h, to: t });
      }
    }
    return out;
  }

  function moves(s) {
    if (s.winner) return [];
    return s.turn === 'F' ? foxMoves(s) : houndMoves(s);
  }

  function legal(s, m) {
    var ms = moves(s);
    for (var i = 0; i < ms.length; i++)
      if (ms[i].to === m.to && (s.turn === 'F' || ms[i].h === m.h)) return true;
    return false;
  }

  // Führt einen Zug aus (verändert s). Prüft danach Sieg/Niederlage.
  function play(s, m) {
    if (s.turn === 'F') {
      s.fox = m.to;
      if (s.hen[m.to]) { s.hen[m.to] = false; s.eaten++; }
      if (s.eaten >= s.cfg.need) { s.winner = 'F'; s.reason = 'hens'; return s; }
      s.turn = 'H';
      if (!houndMoves(s).length) endRound(s); // alle Hunde eingekeilt: sie setzen aus
    } else {
      s.hounds[m.h] = m.to;
      if (m.to === s.fox) { s.winner = 'H'; s.reason = 'caught'; return s; }
      endRound(s);
    }
    return s;
  }

  function endRound(s) {
    if (s.round >= s.cfg.rounds) { s.winner = 'H'; s.reason = 'dawn'; return; }
    s.round++;
    s.turn = 'F';
    if (!foxMoves(s).length) { s.winner = 'H'; s.reason = 'trapped'; }
  }

  // ---------- Bewertung (aus Sicht des Fuchses) ----------
  var dist = new Int16Array(SIZE), queue = new Int16Array(SIZE);
  // Kürzester Weg des Fuchses zu einem Huhn (Hunde sind Hindernisse, Tunnel kosten 1 Zug)
  function henDistances(s) {
    for (var i = 0; i < SIZE; i++) dist[i] = -1;
    var qh = 0, qt = 0;
    dist[s.fox] = 0; queue[qt++] = s.fox;
    var found = [];
    while (qh < qt) {
      var f = queue[qh++], d = dist[f];
      if (s.hen[f] && f !== s.fox) found.push(d);
      var nb = NB8[f];
      for (var k = 0; k < nb.length; k++) {
        var t = nb[k];
        if (dist[t] < 0 && !houndAt(s, t)) { dist[t] = d + 1; queue[qt++] = t; }
      }
      if (s.hole[f]) {
        var hs = s.cfg.holes;
        for (var j = 0; j < hs.length; j++) {
          var u = hs[j];
          if (dist[u] < 0 && !houndAt(s, u)) { dist[u] = d + 1; queue[qt++] = u; }
        }
      }
    }
    return found; // aufsteigend sortiert (BFS)
  }

  function manh(a, b) { return Math.abs(((a / N) | 0) - ((b / N) | 0)) + Math.abs(a % N - b % N); }

  // Kann ein Hund den Fuchs sofort schnappen?
  function canCatch(s) {
    if (s.hole[s.fox]) return false;
    var nb = NB[s.fox];
    for (var i = 0; i < nb.length; i++) if (houndAt(s, nb[i])) return true;
    return false;
  }

  function evaluate(s) {
    if (s.winner === 'F') return WIN;
    if (s.winner === 'H') return -WIN;
    if (s.turn === 'H' && canCatch(s)) return -WIN * 0.9; // Fuchs steht ungeschützt neben einem Hund
    var need = s.cfg.need - s.eaten;
    var left = s.cfg.rounds - s.round + 1;
    var hd = henDistances(s);
    var v = s.eaten * 400;
    // Weg zu den nächsten benötigten Hühnern (abgeschnittene Hühner kosten extra)
    var sum = 0;
    for (var i = 0; i < need && i < hd.length; i++) sum += hd[i] / (i + 1);
    v -= Math.max(0, need - hd.length) * 150;
    if (hd.length) {
      v -= hd[0] * 30 + sum * 8;
      if (hd[0] > left) v -= 2000;
    } else v -= 600;
    // Bewegungsfreiheit: sichere Nachbarfelder (kein Hund daneben)
    var safe = 0, fm = foxMoves(s);
    for (var m = 0; m < fm.length; m++) {
      var t = fm[m].to, ok = true;
      for (var h = 0; h < s.hounds.length; h++) if (manh(t, s.hounds[h]) <= 1 && !s.hole[t]) { ok = false; break; }
      if (ok) safe++;
    }
    v += safe * 25 - (fm.length === 0 ? 500 : 0);
    // Hunde nahe am Fuchs sind gut für den Jäger
    var near = 0;
    for (var h2 = 0; h2 < s.hounds.length; h2++) near += Math.min(manh(s.fox, s.hounds[h2]), 6);
    v += near * 4;
    // Zeitdruck
    v -= Math.max(0, need * 3 - left) * 40;
    return v;
  }

  // ---------- Suche: Alpha-Beta (Negamax) ----------
  function negamax(s, depth, alpha, beta, nodes) {
    nodes.n++;
    var sign = s.turn === 'F' ? 1 : -1;
    if (s.winner) return sign * evaluate(s) * (1 + depth * 0.001); // schneller Sieg / späte Niederlage bevorzugen
    if (depth === 0) return sign * evaluate(s);
    var ms = moves(s);
    if (!ms.length) return sign * evaluate(s);
    order(s, ms);
    var best = -Infinity;
    for (var i = 0; i < ms.length; i++) {
      var c = play(clone(s), ms[i]);
      var v = c.turn === s.turn ? negamax(c, depth - 1, alpha, beta, nodes) : -negamax(c, depth - 1, -beta, -alpha, nodes);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Schlagende Züge zuerst (Huhn fressen / Fuchs fangen)
  function order(s, ms) {
    ms.sort(function (a, b) {
      var ka = s.turn === 'F' ? (s.hen[a.to] ? 0 : 1) : (a.to === s.fox ? 0 : manh(a.to, s.fox));
      var kb = s.turn === 'F' ? (s.hen[b.to] ? 0 : 1) : (b.to === s.fox ? 0 : manh(b.to, s.fox));
      return ka - kb;
    });
  }

  // Bester Zug. level: 1 leicht, 2 mittel, 3 schwer. rnd: Zufallsfunktion (für Tests einstellbar).
  var LEVELS = { 1: { depth: 2, noise: 120 }, 2: { depth: 4, noise: 20 }, 3: { depth: 6, noise: 0 } };
  function bestMove(s, level, rnd) {
    rnd = rnd || Math.random;
    var L = LEVELS[level] || LEVELS[2];
    var ms = moves(s);
    if (!ms.length) return null;
    order(s, ms);
    var nodes = { n: 0 }, scored = [], best = -Infinity;
    for (var i = 0; i < ms.length; i++) {
      var c = play(clone(s), ms[i]);
      var v = c.turn === s.turn ? negamax(c, L.depth - 1, -Infinity, Infinity, nodes)
                                : -negamax(c, L.depth - 1, -Infinity, Infinity, nodes);
      scored.push({ m: ms[i], v: v });
      if (v > best) best = v;
    }
    // Unter gleich guten (bzw. bei leicht: ähnlich guten) Zügen zufällig wählen; Gewinnzüge werden nie verworfen
    var tol = best >= WIN / 2 ? 0 : Math.max(L.noise, 1e-6);
    var pool = scored.filter(function (x) { return x.v >= best - tol; });
    var pick = pool[Math.floor(rnd() * pool.length)];
    return { move: pick.m, value: pick.v, nodes: nodes.n };
  }

  var api = {
    N: N, SIZE: SIZE, WIN: WIN, CFG: CFG, NB: NB, NB8: NB8, canCatch: canCatch, LEVELS: LEVELS,
    setup: setup, clone: clone, moves: moves, foxMoves: foxMoves, houndMoves: houndMoves,
    legal: legal, play: play, evaluate: evaluate, bestMove: bestMove, henDistances: henDistances
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fuchsbau = api;
})(this);

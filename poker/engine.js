/* Texas Hold'em (No Limit) für 2 bis 6 Spieler: Blinds, Setzrunden, All-in mit Nebenpotten, Computer-Gegner.
   Die Engine kennt keine Oberfläche: sie nutzt nur ctx.ask / ctx.push / ctx.sleep. Eingebunden von cardgame.js. */
(function (root) {
  var HAND_NAMES = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];
  var RANK = function (r) { return r <= 10 ? String(r) : ({ 11: 'Bube', 12: 'Dame', 13: 'König', 14: 'Ass' })[r]; };

  function newDeck() {
    var d = [], s, r;
    for (s = 0; s < 4; s++) for (r = 2; r <= 14; r++) d.push({ r: r, s: s });
    for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  // Bewertung von 5 Karten als Zahlenliste (größer = besser)
  function eval5(c) {
    var ranks = c.map(function (x) { return x.r; }).sort(function (a, b) { return b - a; });
    var flush = c.every(function (x) { return x.s === c[0].s; });
    var uniq = ranks.filter(function (r, i) { return ranks.indexOf(r) === i; });
    var sh = 0;
    if (uniq.length === 5) { if (ranks[0] - ranks[4] === 4) sh = ranks[0]; else if (ranks[0] === 14 && ranks[1] === 5) sh = 5; }
    var cnt = {}; ranks.forEach(function (r) { cnt[r] = (cnt[r] || 0) + 1; });
    var g = Object.keys(cnt).map(function (r) { return [cnt[r], +r]; }).sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; });
    if (sh && flush) return [8, sh];
    if (g[0][0] === 4) return [7, g[0][1], g[1][1]];
    if (g[0][0] === 3 && g[1][0] === 2) return [6, g[0][1], g[1][1]];
    if (flush) return [5].concat(ranks);
    if (sh) return [4, sh];
    if (g[0][0] === 3) return [3, g[0][1], g[1][1], g[2][1]];
    if (g[0][0] === 2 && g[1][0] === 2) return [2, g[0][1], g[1][1], g[2][1]];
    if (g[0][0] === 2) return [1, g[0][1], g[1][1], g[2][1], g[3][1]];
    return [0].concat(ranks);
  }
  function num(a) { var v = 0; for (var i = 0; i < 6; i++) v = v * 15 + (a[i] || 0); return v; }
  // beste 5 aus bis zu 7 Karten
  function best(cards) {
    var n = cards.length, bestV = -1, bestA = null;
    if (n < 5) return { score: -1, cat: -1 };
    for (var a = 0; a < n - 4; a++) for (var b = a + 1; b < n - 3; b++) for (var c = b + 1; c < n - 2; c++) for (var d = c + 1; d < n - 1; d++) for (var e = d + 1; e < n; e++) {
      var h = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]), v = num(h);
      if (v > bestV) { bestV = v; bestA = h; }
    }
    return { score: bestV, cat: bestA[0], high: bestA[1] };
  }
  function handName(cards) {
    var b = best(cards); if (b.cat < 0) return '';
    if (b.cat === 8 && b.high === 14) return 'Royal Flush';
    return HAND_NAMES[b.cat];
  }
  // Gewinnchance per Zufallsspiele
  function equity(hole, community, nOpp, iters) {
    var used = {}; hole.concat(community).forEach(function (c) { used[c.r * 4 + c.s] = 1; });
    var rest = []; for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) if (!used[r * 4 + s]) rest.push({ r: r, s: s });
    var need = 5 - community.length, wins = 0;
    for (var it = 0; it < iters; it++) {
      var k = need + nOpp * 2;
      for (var i = 0; i < k; i++) { var j = i + Math.floor(Math.random() * (rest.length - i)); var t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      var board = community.concat(rest.slice(0, need)), mine = best(hole.concat(board)).score, beat = true, ties = 0;
      for (var o = 0; o < nOpp; o++) {
        var os = best([rest[need + o * 2], rest[need + o * 2 + 1]].concat(board)).score;
        if (os > mine) { beat = false; break; } if (os === mine) ties++;
      }
      if (beat) wins += ties ? 1 / (ties + 1) : 1;
    }
    return wins / iters;
  }

  function create(seatsIn, ctx) {
    var N = seatsIn.length, E = {};
    var P = seatsIn.map(function (s, i) {
      return s.type === 'off' ? null : { i: i, name: s.name || 'Spieler', type: s.type, chips: 1000, bet: 0, total: 0, cards: [], folded: false, allin: false, out: false, show: false, win: 0, state: '', acted: false };
    });
    var deck = [], community = [], dealerSeat = -1, hand = 0, sb = 10, bb = 20, curBet = 0, minRaise = 20, turnSeat = -1, msg = '', log = [], over = false, result = '', stopped = false, revealed = false;
    function say(t) { msg = t; log.push(t); if (log.length > 40) log.shift(); ctx.push(); }
    var live = function () { return P.filter(function (p) { return p && !p.out; }); };
    var inHand = function () { return P.filter(function (p) { return p && !p.out && !p.folded; }); };
    var pot = function () { return P.reduce(function (a, p) { return a + (p ? p.total : 0); }, 0); };
    function nextSeat(from, pred) { for (var k = 1; k <= N; k++) { var p = P[(from + k) % N]; if (p && pred(p)) return p; } return null; }
    function pay(p, amt) { amt = Math.min(amt, p.chips); p.chips -= amt; p.bet += amt; p.total += amt; if (p.chips === 0) p.allin = true; return amt; }

    E.view = function (i) {
      return {
        kind: 'poker', you: i, over: over, result: result, msg: msg, log: log.slice(-8), pot: pot(), community: community.slice(),
        info: 'Blinds ' + sb + '/' + bb + (hand ? ' · Hand ' + hand : ''),
        seats: P.map(function (p) {
          if (!p) return null;
          var vis = p.i === i || p.show;
          return {
            name: p.name, type: p.type, chips: p.chips, bet: p.bet, dealer: p.i === dealerSeat && !p.out, turn: p.i === turnSeat,
            state: p.out ? 'raus' : p.folded ? 'Fold' : p.allin ? 'All-in' : '', win: p.win || 0,
            cards: p.folded || p.out ? [] : p.cards.map(function (c) { return vis ? c : 0; })
          };
        }),
        actions: ctx.pendingFor(i)
      };
    };
    E.stop = function () { stopped = true; };

    // ---- Computer ----
    function botDecide(p, toCall, minTo, maxTo) {
      var opp = inHand().length - 1, eq = equity(p.cards, community, Math.max(1, opp), 130);
      var potNow = pot(), odds = toCall > 0 ? toCall / (potNow + toCall) : 0, r = Math.random();
      var strong = eq > (opp > 2 ? .55 : .62), decent = eq > odds + .08;
      var canRaise = maxTo > minTo || (maxTo === minTo && maxTo > p.bet + toCall);
      var raiseTo = function (frac) { var t = Math.round((p.bet + toCall + frac * (potNow + toCall)) / 10) * 10; return Math.max(minTo, Math.min(maxTo, t)); };
      if (strong && canRaise && r < .75) return { id: 'raise', amount: raiseTo(.5 + Math.random() * .6) };
      if (toCall === 0) {
        if (!strong && canRaise && r < .07) return { id: 'raise', amount: raiseTo(.5) };      // gelegentlicher Bluff
        return { id: 'check' };
      }
      if (decent || (toCall <= bb && eq > .3) || r < .04) return { id: 'call' };
      return { id: 'fold' };
    }

    // ---- Setzrunde ----
    async function betRound(startSeat) {
      var pos = startSeat;
      for (;;) {
        var act = inHand(); if (act.length <= 1) return;
        var need = act.filter(function (p) { return !p.allin && (!p.acted || p.bet < curBet); });
        if (!need.length) return;
        var p = null;
        for (var k = 0; k < N && !p; k++) { var c = P[(pos + k) % N]; if (c && need.indexOf(c) >= 0) p = c; }
        pos = p.i + 1;
        var toCall = Math.min(curBet - p.bet, p.chips), actions = [];
        var maxTo = p.bet + p.chips, minTo = Math.min(maxTo, curBet + minRaise);
        if (toCall > 0) actions.push({ id: 'fold', label: 'Passen', alt: true });
        actions.push(toCall === 0 ? { id: 'check', label: 'Schieben' } : { id: 'call', label: toCall >= p.chips ? 'All-in ' + toCall : 'Mitgehen ' + toCall });
        if (p.chips > toCall) {
          var potNow = pot(), pres = [{ label: 'Min', value: minTo }, { label: '½ Pot', value: Math.round((curBet + (potNow + toCall) / 2) / 10) * 10 }, { label: 'Pot', value: Math.round((curBet + potNow + toCall) / 10) * 10 }, { label: 'All-in', value: maxTo }];
          actions.push({ id: 'raise', label: curBet === 0 ? 'Setzen' : 'Erhöhen auf', min: minTo, max: maxTo, step: 10, presets: pres });
        }
        turnSeat = p.i; ctx.push();
        var res = await ctx.ask(p.i, { actions: actions, timeout: 60 }, function () { return p.type === 'cpu' || true ? botDecide(p, toCall, minTo, maxTo) : null; });
        if (stopped) return;
        turnSeat = -1;
        // gültige Auswahl absichern
        var ok = actions.filter(function (a) { return a.id === res.id; })[0];
        if (!ok) res = toCall > 0 ? { id: 'fold' } : { id: 'check' };
        if (res.id === 'fold') { p.folded = true; p.state = 'Fold'; say(p.name + ' passt.'); }
        else if (res.id === 'check') { say(p.name + ' schiebt.'); }
        else if (res.id === 'call') { var amt = pay(p, toCall); say(p.name + (p.allin ? ' geht All-in mit ' + amt : ' geht mit (' + amt + ')') + '.'); }
        else if (res.id === 'raise') {
          var to = Math.max(minTo, Math.min(maxTo, Math.round(res.amount || minTo)));
          var add = to - p.bet; pay(p, add);
          if (p.bet - curBet >= minRaise) minRaise = p.bet - curBet;
          var raised = p.bet > curBet; if (raised) { if (p.bet - curBet > minRaise) minRaise = p.bet - curBet; curBet = p.bet; P.forEach(function (o) { if (o && o !== p) o.acted = false; }); }
          say(p.name + (p.allin ? ' geht All-in auf ' + p.bet : (curBet === p.bet && raised ? ' erhöht auf ' + p.bet : ' setzt ' + p.bet)) + '.');
        }
        p.acted = true; ctx.push();
        await ctx.sleep(450);
      }
    }
    function resetStreet() { P.forEach(function (p) { if (p) { p.bet = 0; p.acted = false; } }); curBet = 0; minRaise = bb; }

    async function playHand() {
      hand++;
      var level = Math.floor((hand - 1) / 6); bb = Math.min(2560, 20 * Math.pow(2, level)); sb = bb / 2;
      P.forEach(function (p) { if (p) { p.bet = 0; p.total = 0; p.cards = []; p.folded = !!p.out; p.allin = false; p.show = false; p.win = 0; p.state = p.out ? 'raus' : ''; p.acted = false; } });
      community = []; revealed = false; curBet = 0; minRaise = bb;
      var lv = live();
      var d = nextSeat(dealerSeat < 0 ? N - 1 : dealerSeat, function (p) { return !p.out; }); dealerSeat = d.i;
      var sbp, bbp;
      if (lv.length === 2) { sbp = d; bbp = nextSeat(d.i, function (p) { return !p.out; }); }
      else { sbp = nextSeat(d.i, function (p) { return !p.out; }); bbp = nextSeat(sbp.i, function (p) { return !p.out; }); }
      deck = newDeck();
      say('Neue Hand (' + hand + '). Blinds ' + sb + '/' + bb + '.');
      await ctx.sleep(500);
      pay(sbp, sb); pay(bbp, bb); curBet = bb; ctx.push();
      for (var round = 0; round < 2; round++) for (var k = 0; k < N; k++) { var pl = P[(dealerSeat + 1 + k) % N]; if (pl && !pl.out) { pl.cards.push(deck.pop()); ctx.push(); await ctx.sleep(180); } }
      var first = lv.length === 2 ? sbp : nextSeat(bbp.i, function (p) { return !p.out; });
      await betRound(first.i);
      if (stopped) return;
      var streets = [[3, 'Flop'], [1, 'Turn'], [1, 'River']];
      for (var s = 0; s < streets.length && inHand().length > 1; s++) {
        resetStreet();
        for (var c = 0; c < streets[s][0]; c++) community.push(deck.pop());
        say(streets[s][1] + ': ' + community.map(function (x) { return RANK(x.r); }).join(' '));
        await ctx.sleep(800);
        var canBet = inHand().filter(function (p) { return !p.allin; }).length > 1;
        if (canBet) await betRound(nextSeat(dealerSeat, function (p) { return !p.out && !p.folded; }).i);
        if (stopped) return;
      }
      await showdown();
    }
    async function showdown() {
      var left = inHand();
      P.forEach(function (p) { if (p) p.bet = 0; });
      if (left.length === 1) {
        var w = left[0], amt = pot(); w.chips += amt; w.win = amt; say(w.name + ' gewinnt ' + amt + ' (alle anderen haben gepasst).'); ctx.push(); return;
      }
      left.forEach(function (p) { p.show = true; }); revealed = true;
      var parts = [], contrib = P.filter(function (p) { return p && p.total > 0; });
      var levels = left.map(function (p) { return p.total; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      var prev = 0;
      levels.forEach(function (L) {
        var amount = 0; contrib.forEach(function (p) { amount += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev)); });
        var elig = left.filter(function (p) { return p.total >= L; });
        if (amount > 0 && elig.length) {
          var scores = elig.map(function (p) { return best(p.cards.concat(community)).score; }), top = Math.max.apply(null, scores);
          var winners = elig.filter(function (p, i) { return scores[i] === top; });
          var share = Math.floor(amount / winners.length), rem = amount - share * winners.length;
          winners.forEach(function (p, i) { var g = share + (i < rem ? 1 : 0); p.chips += g; p.win += g; });
          parts.push(winners.map(function (p) { return p.name; }).join(' & ') + ' (' + handName(winners[0].cards.concat(community)) + ')');
        }
        prev = L;
      });
      say('Showdown: ' + parts.join(', ') + '.');
      ctx.push();
    }

    E.run = async function () {
      try {
        for (;;) {
          if (stopped) return;
          var lv = live();
          if (lv.length < 2) { over = true; result = lv[0] ? lv[0].name + ' gewinnt das Spiel!' : 'Spiel beendet'; say(result); return; }
          if (!lv.some(function (p) { return p.type === 'human' || p.type === 'remote'; })) { over = true; result = 'Du bist ausgeschieden. ' + 'Gewonnen hat am Ende ein Computer.'; say(result); return; }
          await playHand();
          if (stopped) return;
          await ctx.sleep(3200);
          P.forEach(function (p) { if (p && p.chips <= 0 && !p.out) { p.out = true; p.state = 'raus'; say(p.name + ' ist ausgeschieden.'); } });
        }
      } catch (e) { if (e && e.message) throw e; }
    };
    // für Tests
    E._P = P; E._best = best;
    return E;
  }
  root.PokerEngine = { create: create, best: best, eval5: eval5, equity: equity, handName: handName, newDeck: newDeck };
})(typeof window !== 'undefined' ? window : globalThis);

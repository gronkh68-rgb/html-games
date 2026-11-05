/* Blackjack gegen den Geber für 1 bis 5 Spieler: Einsätze, Karten, Verdoppeln, Geber zieht bis 17, Blackjack zahlt 3:2.
   Die Engine kennt keine Oberfläche: sie nutzt nur ctx.ask / ctx.push / ctx.sleep. Eingebunden von cardgame.js. */
(function (root) {
  var START = 500, MINBET = 10;

  function newShoe() {
    var d = [], k, s, r;
    for (k = 0; k < 6; k++) for (s = 0; s < 4; s++) for (r = 2; r <= 14; r++) d.push({ r: r, s: s });
    for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  var val = function (c) { return c.r === 14 ? 11 : (c.r >= 11 ? 10 : c.r); };
  function handValue(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) { total += val(c); if (c.r === 14) aces++; });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }
  var isNatural = function (cards) { return cards.length === 2 && handValue(cards).total === 21; };

  // Einfache Grundstrategie für den Computer
  function botMove(cards, up, canDouble) {
    var h = handValue(cards), t = h.total, u = up;
    if (h.soft) {
      if (t >= 19) return 'stand';
      if (t === 18) return u >= 9 ? 'hit' : (canDouble && u <= 6 ? 'double' : 'stand');
      return canDouble && u >= 4 && u <= 6 && t >= 15 ? 'double' : 'hit';
    }
    if (t >= 17) return 'stand';
    if (t >= 13) return u <= 6 ? 'stand' : 'hit';
    if (t === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit';
    if (t === 11) return canDouble ? 'double' : 'hit';
    if (t === 10) return canDouble && u <= 9 ? 'double' : 'hit';
    if (t === 9) return canDouble && u >= 3 && u <= 6 ? 'double' : 'hit';
    return 'hit';
  }

  function create(seatsIn, ctx) {
    var N = seatsIn.length, E = {};
    var P = seatsIn.map(function (s, i) {
      return s.type === 'off' ? null : { i: i, name: s.name || 'Spieler', type: s.type, chips: START, bet: 0, cards: [], state: '', delta: 0, out: false, active: false };
    });
    var shoe = [], dealer = { cards: [], hidden: true }, msg = '', log = [], over = false, result = '', stopped = false, turnSeat = -1, round = 0, phase = 'bet';
    function say(t) { msg = t; log.push(t); if (log.length > 40) log.shift(); ctx.push(); }
    var draw = function () { if (shoe.length < 20) shoe = newShoe(); return shoe.pop(); };
    var players = function () { return P.filter(function (p) { return p && !p.out; }); };

    E.view = function (i) {
      var dv = handValue(dealer.cards.filter(function (c, k) { return !(dealer.hidden && k === 1); }));
      return {
        kind: 'blackjack', you: i, over: over, result: result, msg: msg, log: log.slice(-8), pot: 0, community: [],
        info: 'Runde ' + round + ' · Mindesteinsatz ' + MINBET,
        dealerHand: { cards: dealer.cards.map(function (c, k) { return dealer.hidden && k === 1 ? 0 : c; }), total: dealer.cards.length ? dv.total : 0 },
        seats: P.map(function (p) {
          if (!p) return null;
          return {
            name: p.name, type: p.type, chips: p.chips, bet: p.bet, turn: p.i === turnSeat, state: p.out ? 'pleite' : p.state, delta: p.delta,
            cards: p.cards.slice(), total: p.cards.length ? handValue(p.cards).total : 0
          };
        }),
        actions: ctx.pendingFor(i)
      };
    };
    E.stop = function () { stopped = true; };

    async function playRound() {
      round++; phase = 'bet';
      P.forEach(function (p) { if (p) { p.cards = []; p.bet = 0; p.state = ''; p.delta = 0; p.active = false; } });
      dealer = { cards: [], hidden: true }; ctx.push();
      say('Runde ' + round + ': Einsätze, bitte.');
      // 1. Einsätze
      for (var k = 0; k < N; k++) {
        var p = P[k]; if (!p || p.out) continue;
        var maxBet = p.chips, minBet = Math.min(MINBET, p.chips);
        var pres = [10, 25, 50, 100].filter(function (v) { return v >= minBet && v < maxBet; }).map(function (v) { return { label: String(v), value: v }; }); pres.push({ label: 'Max', value: maxBet });
        turnSeat = p.i; ctx.push();
        var res = await ctx.ask(p.i, { timeout: 45, actions: [{ id: 'bet', label: 'Einsatz', min: minBet, max: maxBet, step: 5, presets: pres }] }, function () {
          var v = [10, 25, 25, 50][Math.floor(Math.random() * 4)]; return { id: 'bet', amount: Math.max(minBet, Math.min(maxBet, v)) };
        });
        if (stopped) return; turnSeat = -1;
        var amt = Math.max(minBet, Math.min(maxBet, Math.round((res && res.amount) || minBet)));
        p.bet = amt; p.chips -= amt; p.active = true; ctx.push();
      }
      var seated = P.filter(function (p) { return p && p.active; });
      // 2. Austeilen
      phase = 'deal'; say('Karten werden gegeben …');
      for (var c = 0; c < 2; c++) {
        for (var q = 0; q < seated.length; q++) { seated[q].cards.push(draw()); ctx.push(); await ctx.sleep(260); }
        dealer.cards.push(draw()); ctx.push(); await ctx.sleep(260);
      }
      var up = val(dealer.cards[0]);
      // 3. Geber mit Blackjack?
      if (isNatural(dealer.cards)) {
        dealer.hidden = false; say('Der Geber hat Blackjack!'); await ctx.sleep(1200);
        seated.forEach(function (p) { if (isNatural(p.cards)) { p.chips += p.bet; p.delta = 0; p.state = 'Push'; } else { p.delta = -p.bet; p.state = 'Verloren'; } });
        ctx.push(); return;
      }
      // 4. Spieler am Zug
      phase = 'play';
      for (var s = 0; s < seated.length; s++) {
        var pl = seated[s];
        if (isNatural(pl.cards)) { pl.state = 'Blackjack!'; say(pl.name + ' hat Blackjack!'); ctx.push(); await ctx.sleep(700); continue; }
        for (;;) {
          var hv = handValue(pl.cards);
          if (hv.total >= 21) break;
          var canDouble = pl.cards.length === 2 && pl.chips >= pl.bet;
          var actions = [{ id: 'hit', label: 'Karte' }, { id: 'stand', label: 'Halten', alt: true }];
          if (canDouble) actions.push({ id: 'double', label: 'Verdoppeln (' + pl.bet + ')' });
          turnSeat = pl.i; say(pl.name + ' ist dran: ' + hv.total + (hv.soft ? ' (weich)' : '') + '.');
          var r = await ctx.ask(pl.i, { timeout: 45, actions: actions }, function () { return { id: botMove(pl.cards, up, canDouble) }; });
          if (stopped) return; turnSeat = -1;
          var id = r && actions.some(function (a) { return a.id === r.id; }) ? r.id : 'stand';
          if (id === 'hit') { pl.cards.push(draw()); ctx.push(); await ctx.sleep(450); }
          else if (id === 'double') { pl.chips -= pl.bet; pl.bet *= 2; pl.cards.push(draw()); say(pl.name + ' verdoppelt.'); await ctx.sleep(700); break; }
          else break;
        }
        var fin = handValue(pl.cards).total;
        pl.state = fin > 21 ? 'Bust' : (fin === 21 ? '21' : 'Halten'); ctx.push();
        await ctx.sleep(400);
      }
      // 5. Geber spielt
      turnSeat = -1; dealer.hidden = false; say('Der Geber deckt auf.'); await ctx.sleep(900);
      var live = seated.some(function (p) { return handValue(p.cards).total <= 21 && !isNatural(p.cards); });
      while (live && handValue(dealer.cards).total < 17) { dealer.cards.push(draw()); ctx.push(); await ctx.sleep(750); }
      var dt = handValue(dealer.cards).total, dBust = dt > 21;
      say(dBust ? 'Der Geber überkauft sich (' + dt + ').' : 'Der Geber hat ' + dt + '.');
      // 6. Auszahlung
      seated.forEach(function (p) {
        var t = handValue(p.cards).total, nat = isNatural(p.cards);
        if (t > 21) { p.delta = -p.bet; p.state = 'Bust'; }
        else if (nat) { var g = Math.floor(p.bet * 1.5); p.chips += p.bet + g; p.delta = g; p.state = 'Blackjack!'; }
        else if (dBust || t > dt) { p.chips += p.bet * 2; p.delta = p.bet; p.state = 'Gewonnen'; }
        else if (t === dt) { p.chips += p.bet; p.delta = 0; p.state = 'Push'; }
        else { p.delta = -p.bet; p.state = 'Verloren'; }
      });
      ctx.push();
    }

    E.run = async function () {
      try {
        shoe = newShoe();
        for (;;) {
          if (stopped) return;
          P.forEach(function (p) { if (p && !p.out && p.chips < 1) { p.out = true; p.state = 'pleite'; } });
          var humans = P.filter(function (p) { return p && !p.out && (p.type === 'human' || p.type === 'remote'); });
          if (!humans.length) { over = true; result = 'Alle Spieler sind pleite.'; say(result); return; }
          await playRound();
          if (stopped) return;
          await ctx.sleep(3000);
          P.forEach(function (p) { if (p) { p.bet = 0; } });
        }
      } catch (e) { if (e && e.message) throw e; }
    };
    E._P = P;
    return E;
  }
  root.BlackjackEngine = { create: create, handValue: handValue, botMove: botMove };
})(typeof window !== 'undefined' ? window : globalThis);

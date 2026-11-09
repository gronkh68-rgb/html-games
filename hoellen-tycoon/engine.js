/* Höllen-Tycoon: Spiellogik (läuft nur beim Host). */
(function () {
  var F = HT.F, L2 = HK.L2, K = null;
  var E = window.HTE = {};
  E.bind = function (k) { K = k; };
  var G = function () { return K.G; };
  var nm = function (p) { return K.nm(p); };
  var fn = function (f) { return F[f].n; };
  var S = function (n) { return n + ' 💀'; };
  E.S = S;
  function say2(p, de, en, deMe, enMe) { K.say(p, L2(de, en), deMe != null ? L2(deMe, enMe) : null); }

  // ---------- Besitz und Regeln ----------
  var buyable = function (f) { return F[f].t === 'st' || F[f].t === 'ferry' || F[f].t === 'util'; };
  E.buyable = buyable;
  var groupOf = function (g) { var r = []; F.forEach(function (f) { if (f.t === 'st' && f.g === g) r.push(f.i); }); return r; };
  E.groupOf = groupOf;
  function ownsGroup(g, p, grp) { return groupOf(grp).every(function (f) { return g.own[f] === p; }); }
  E.ownsGroup = ownsGroup;
  function groupHouses(g, grp) { return groupOf(grp).map(function (f) { return g.houses[f]; }); }
  function canBuild(g, p, f) {
    var x = F[f]; if (x.t !== 'st' || g.own[f] !== p || !ownsGroup(g, p, x.g) || g.houses[f] >= 5 || g.cash[p] < x.hc) return false;
    if (groupOf(x.g).some(function (q) { return g.mort[q]; })) return false;
    return g.houses[f] <= Math.min.apply(null, groupHouses(g, x.g));
  }
  function canSell(g, p, f) { var x = F[f]; return x.t === 'st' && g.own[f] === p && g.houses[f] > 0 && g.houses[f] >= Math.max.apply(null, groupHouses(g, x.g)); }
  function canMort(g, p, f) { if (g.own[f] !== p || g.mort[f]) return false; if (F[f].t === 'st' && groupHouses(g, F[f].g).some(function (h) { return h > 0; })) return false; return true; }
  var unmortCost = function (f) { return Math.ceil(F[f].price / 2 * 1.1); };
  E.unmortCost = unmortCost;
  function canUnmort(g, p, f) { return g.own[f] === p && g.mort[f] && g.cash[p] >= unmortCost(f); }
  E.canBuild = canBuild; E.canSell = canSell; E.canMort = canMort; E.canUnmort = canUnmort;
  function tradable(g, p, f) { return g.own[f] === p && !(F[f].t === 'st' && groupHouses(g, F[f].g).some(function (h) { return h > 0; })); }
  E.tradable = tradable;
  function rent(g, f, dice, mult) {
    var x = F[f], o = g.own[f];
    if (x.t === 'st') { var h = g.houses[f]; return h > 0 ? x.rent[h] : x.rent[0] * (ownsGroup(g, o, x.g) ? 2 : 1); }
    if (x.t === 'ferry') { var n = F.filter(function (y) { return y.t === 'ferry' && g.own[y.i] === o; }).length; return 25 * Math.pow(2, n - 1) * (mult || 1); }
    if (x.t === 'util') { var u = F.filter(function (y) { return y.t === 'util' && g.own[y.i] === o; }).length; return dice * (mult === 10 ? 10 : u === 2 ? 10 : 4); }
    return 0;
  }
  E.rent = rent;
  function worth(g, p) {
    var w = g.cash[p];
    F.forEach(function (x) { if (g.own[x.i] === p) { w += g.mort[x.i] ? x.price / 2 : x.price; if (x.t === 'st') w += g.houses[x.i] * x.hc; } });
    return w;
  }
  E.worth = worth;
  var alive = function (g) { var r = []; g.seats.forEach(function (_, i) { if (!g.out[i]) r.push(i); }); return r; };
  E.alive = alive;

  // ---------- Geld ----------
  function give(p, n) { G().cash[p] += n; }
  async function pay(p, n, to) {          // to: Spieler oder -1 (Bank) oder -2 (Topf)
    var g = G();
    if (n <= 0) return true;
    if (g.cash[p] < n) { var ok = await raise(p, n, to); if (!ok) return false; }
    g.cash[p] -= n;
    if (to >= 0) g.cash[to] += n; else if (to === -2) g.pot += n;
    K.fx({ k: 'cash', p: p, n: -n, to: to }); K.sfx('coin');
    return true;
  }
  async function raise(p, need, to) {    // Geld beschaffen oder Bankrott
    var g = G(), guard = 0;
    while (g.cash[p] < need && guard++ < 200) {
      K.snap('debt'); K.push();
      var a = await K.ask(p, { k: 'turn', phase: 'debt', need: need, to: to, opts: ['bankrupt'] }, function () { return aiRaise(g, p); });
      if (!a) continue;
      if (a.t === 'bankrupt') { bankrupt(p, to); return false; }
      await manage(p, a);
    }
    if (g.cash[p] < need) { bankrupt(p, to); return false; }
    return true;
  }
  function aiRaise(g, p) {
    var fs = F.filter(function (x) { return g.own[x.i] === p; });
    var s = fs.filter(function (x) { return canSell(g, p, x.i); }).sort(function (a, b) { return a.hc - b.hc; })[0]; if (s) return { t: 'sell', f: s.i };
    var m = fs.filter(function (x) { return canMort(g, p, x.i); }).sort(function (a, b) { return (ownsGroup(g, p, a.g) ? 1 : 0) - (ownsGroup(g, p, b.g) ? 1 : 0) || a.price - b.price; })[0]; if (m) return { t: 'mort', f: m.i };
    return { t: 'bankrupt' };
  }
  function bankrupt(p, to) {
    var g = G();
    // Häuser gehen zum halben Preis an die Bank
    F.forEach(function (x) { if (g.own[x.i] === p && x.t === 'st' && g.houses[x.i]) { g.cash[p] += g.houses[x.i] * x.hc / 2; g.houses[x.i] = 0; } });
    if (to >= 0) {
      g.cash[to] += Math.max(0, g.cash[p]);
      F.forEach(function (x) { if (g.own[x.i] === p) g.own[x.i] = to; });
      g.free[to] += g.free[p];
      say2(p, nm(p) + ' ist bankrott! Alles geht an ' + nm(to) + '.', nm(p) + ' is bankrupt! Everything goes to ' + nm(to) + '.', 'Du bist bankrott! Alles geht an ' + nm(to) + '.', 'You are bankrupt! Everything goes to ' + nm(to) + '.');
    } else {
      F.forEach(function (x) { if (g.own[x.i] === p) { g.own[x.i] = -1; g.mort[x.i] = false; } });
      for (var k = 0; k < g.free[p]; k++) { var fc = g.freeCards.shift(); if (fc) { var pr = fc.split(':'); (pr[0] === 'fate' ? g.fate : g.pact).push(+pr[1]); } }
      say2(p, nm(p) + ' ist bankrott! Der Besitz fällt an die Hölle zurück.', nm(p) + ' is bankrupt! The property returns to hell.', 'Du bist bankrott! Dein Besitz fällt an die Hölle zurück.', 'You are bankrupt! Your property returns to hell.');
    }
    g.cash[p] = 0; g.free[p] = 0; g.out[p] = true; g.jail[p] = -1;
    K.sfx('bad'); K.push();
  }

  // ---------- Verwalten (bauen, verkaufen, Hypothek, Handel) ----------
  E.legal = function (g, p, a) {
    if (!a || typeof a !== 'object') return false;
    var f = a.f;
    if (a.t === 'build') return Number.isInteger(f) && canBuild(g, p, f);
    if (a.t === 'sell') return Number.isInteger(f) && canSell(g, p, f);
    if (a.t === 'mort') return Number.isInteger(f) && canMort(g, p, f);
    if (a.t === 'unmort') return Number.isInteger(f) && canUnmort(g, p, f);
    if (a.t === 'trade') {
      var q = a.to; if (!Number.isInteger(q) || q === p || q < 0 || q >= g.seats.length || g.out[q]) return false;
      if ((g.tradesN || 0) >= 4) return false;
      if (!Array.isArray(a.give) || !Array.isArray(a.get)) return false;
      var gm = +a.gm || 0, tm = +a.tm || 0; if (gm < 0 || tm < 0 || gm > g.cash[p] || tm > g.cash[q]) return false;
      if (!a.give.length && !a.get.length && !gm && !tm) return false;
      return a.give.every(function (f) { return Number.isInteger(f) && tradable(g, p, f); }) && a.get.every(function (f) { return Number.isInteger(f) && tradable(g, q, f); });
    }
    return false;
  };
  async function manage(p, a) {
    var g = G(), x = F[a.f];
    if (a.t === 'build') { g.cash[p] -= x.hc; g.houses[a.f]++; say2(p, nm(p) + (g.houses[a.f] === 5 ? ' baut einen Palast auf ' : ' baut ein Haus auf ') + x.n.de + '.', nm(p) + (g.houses[a.f] === 5 ? ' builds a palace on ' : ' builds a house on ') + x.n.en + '.', (g.houses[a.f] === 5 ? 'Du baust einen Palast auf ' : 'Du baust ein Haus auf ') + x.n.de + '.', (g.houses[a.f] === 5 ? 'You build a palace on ' : 'You build a house on ') + x.n.en + '.'); K.sfx('lay'); }
    else if (a.t === 'sell') { g.houses[a.f]--; g.cash[p] += x.hc / 2; say2(p, nm(p) + ' verkauft ein Gebäude auf ' + x.n.de + '.', nm(p) + ' sells a building on ' + x.n.en + '.', 'Du verkaufst ein Gebäude auf ' + x.n.de + '.', 'You sell a building on ' + x.n.en + '.'); }
    else if (a.t === 'mort') { g.mort[a.f] = true; g.cash[p] += x.price / 2; say2(p, nm(p) + ' belastet ' + x.n.de + ' mit einer Hypothek (+' + x.price / 2 + ').', nm(p) + ' mortgages ' + x.n.en + ' (+' + x.price / 2 + ').', 'Du belastest ' + x.n.de + ' mit einer Hypothek (+' + x.price / 2 + ').', 'You mortgage ' + x.n.en + ' (+' + x.price / 2 + ').'); }
    else if (a.t === 'unmort') { var c = unmortCost(a.f); g.cash[p] -= c; g.mort[a.f] = false; say2(p, nm(p) + ' löst die Hypothek auf ' + x.n.de + ' ab (−' + c + ').', nm(p) + ' lifts the mortgage on ' + x.n.en + ' (−' + c + ').', 'Du löst die Hypothek auf ' + x.n.de + ' ab (−' + c + ').', 'You lift the mortgage on ' + x.n.en + ' (−' + c + ').'); }
    else if (a.t === 'trade') await trade(p, a);
    K.push();
  }
  function tradeText(g, p, a, lang) {
    var de = lang === 'de', list = function (fs) { return fs.map(function (f) { return (de ? F[f].n.de : F[f].n.en) + (g.mort[f] ? (de ? ' (Hypothek)' : ' (mortgaged)') : ''); }); };
    var giveL = list(a.give), getL = list(a.get); if (a.gm) giveL.push(S(a.gm)); if (a.tm) getL.push(S(a.tm));
    return (de ? '<b>' + HK.esc(nm(p)) + ' bietet:</b> ' : '<b>' + HK.esc(nm(p)) + ' offers:</b> ') + (giveL.length ? HK.esc(giveL.join(', ')) : '—') + '<br>' + (de ? '<b>und möchte dafür:</b> ' : '<b>and wants:</b> ') + (getL.length ? HK.esc(getL.join(', ')) : '—');
  }
  E.tradeText = tradeText;
  function tradeValue(g, q, gets, gives, mGet, mGive) {   // Bewertung aus Sicht von q
    var v = mGet - mGive;
    var after = g.own.slice(); gives.forEach(function (f) { after[f] = -9; }); gets.forEach(function (f) { after[f] = q; });
    var setVal = function (own, who) { var s = 0; for (var gr = 0; gr < 8; gr++) if (groupOf(gr).every(function (f) { return own[f] === who; })) s += 1; return s; };
    gets.forEach(function (f) { v += F[f].price * (g.mort[f] ? .55 : 1); }); gives.forEach(function (f) { v -= F[f].price * (g.mort[f] ? .55 : 1) * 1.15; });
    v += (setVal(after, q) - setVal(g.own, q)) * 400;
    return v;
  }
  async function trade(p, a) {
    var g = G(), q = a.to; g.tradesN = (g.tradesN || 0) + 1;
    var gm = +a.gm || 0, tm = +a.tm || 0;
    say2(p, nm(p) + ' macht ' + nm(q) + ' ein Handelsangebot.', nm(p) + ' makes ' + nm(q) + ' a trade offer.', 'Du machst ' + nm(q) + ' ein Handelsangebot.', 'You make ' + nm(q) + ' a trade offer.');
    K.push();
    var ans = await K.ask(q, { k: 'dlg', ico: '🤝', title: L2('Handelsangebot', 'Trade offer'), html: L2(tradeText(g, p, a, 'de'), tradeText(g, p, a, 'en')), btns: [L2('✔ Annehmen', '✔ Accept'), L2('✖ Ablehnen', '✖ Decline')] }, function () {
      var mine = tradeValue(g, q, a.give, a.get, gm, tm);
      // Gibt der Handel dem anderen eine neue Farbgruppe, verlangt der Computer mehr
      var otherSet = 0, after = g.own.slice(); a.get.forEach(function (f) { after[f] = p; }); a.give.forEach(function (f) { after[f] = q; });
      for (var gr = 0; gr < 8; gr++) if (groupOf(gr).every(function (f) { return after[f] === p; }) && !ownsGroup(g, p, gr)) otherSet++;
      return mine - otherSet * 350 >= 40 ? 0 : 1;
    });
    if (ans !== 0) { if (a.ai) { g.rej = g.rej || {}; g.rej[a.ai] = g.round; } say2(q, nm(q) + ' lehnt ab.', nm(q) + ' declines.', 'Du lehnst ab.', 'You decline.'); return; }
    if (!E.legal(g, p, Object.assign({}, a, { t: 'trade' })) && false) return;
    if (gm > g.cash[p] || tm > g.cash[q]) { say2(-1, 'Der Handel platzt: nicht genug Geld.', 'The trade fails: not enough money.'); return; }
    a.give.forEach(function (f) { g.own[f] = q; }); a.get.forEach(function (f) { g.own[f] = p; });
    g.cash[p] += tm - gm; g.cash[q] += gm - tm;
    say2(q, nm(q) + ' nimmt den Handel mit ' + nm(p) + ' an.', nm(q) + ' accepts the trade with ' + nm(p) + '.', 'Du nimmst den Handel mit ' + nm(p) + ' an.', 'You accept the trade with ' + nm(p) + '.');
    K.sfx('coin');
  }

  // ---------- Bewegung und Felder ----------
  function dice() { return [1 + HK.rnd(6), 1 + HK.rnd(6)]; }
  async function showDice(p, d) { var g = G(); g.dice = { p: p, a: d[0], b: d[1], seq: (g.dice ? g.dice.seq : 0) + 1 }; K.fx({ k: 'dice' }); K.sfx('dice'); K.push(); await K.sleep(900); }
  async function moveTo(p, to, viaGo, steps) {
    var g = G(), from = g.pos[p];
    var passed = viaGo !== false && (steps != null ? from + steps >= 40 : to < from);
    g.pos[p] = to; g.move = { p: p, from: from, to: to, steps: steps != null ? steps : (to - from + 40) % 40, back: steps != null && steps < 0, seq: (g.move ? g.move.seq : 0) + 1 };
    K.push();
    var n = Math.abs(g.move.back ? steps : g.move.steps);
    await K.sleep(Math.min(2600, 180 * n + 300));
    if (passed && to !== 30 && !g.out[p]) { give(p, 200); say2(p, nm(p) + ' passiert das Höllentor und kassiert 200.', nm(p) + ' passes Hell Gate and collects 200.', 'Du passierst das Höllentor und kassierst 200.', 'You pass Hell Gate and collect 200.'); K.fx({ k: 'cash', p: p, n: 200 }); K.sfx('coin'); K.push(); }
  }
  async function toJail(p) {
    var g = G(); g.pos[p] = 10; g.jail[p] = 0; g.move = { p: p, from: g.pos[p], to: 10, jump: true, seq: (g.move ? g.move.seq : 0) + 1 };
    say2(p, nm(p) + ' muss in den Seelenkerker!', nm(p) + ' goes to the Soul Prison!', 'Du musst in den Seelenkerker!', 'You go to the Soul Prison!'); K.sfx('bad'); K.push(); await K.sleep(700);
  }
  async function land(p, roll, mult) {
    var g = G(), f = g.pos[p], x = F[f];
    if (buyable(f)) {
      var o = g.own[f];
      if (o < 0) { await offerBuy(p, f); return; }
      if (o === p || g.mort[f]) { if (g.mort[f] && o !== p) say2(-1, x.n.de + ' ist mit einer Hypothek belastet: keine Miete.', x.n.en + ' is mortgaged: no rent.'); return; }
      if (g.out[o]) return;
      var r = rent(g, f, roll, mult);
      if (x.t === 'util' && mult === 10) { var d = dice(); await showDice(p, d); r = (d[0] + d[1]) * 10; }
      say2(p, nm(p) + ' zahlt ' + S(r) + ' Miete an ' + nm(o) + ' (' + x.n.de + ').', nm(p) + ' pays ' + S(r) + ' rent to ' + nm(o) + ' (' + x.n.en + ').', 'Du zahlst ' + S(r) + ' Miete an ' + nm(o) + ' (' + x.n.de + ').', 'You pay ' + S(r) + ' rent to ' + nm(o) + ' (' + x.n.en + ').');
      await pay(p, r, o); return;
    }
    if (x.t === 'tax') { say2(p, nm(p) + ' zahlt ' + x.n.de + ': ' + S(x.amt) + '.', nm(p) + ' pays ' + x.n.en + ': ' + S(x.amt) + '.', 'Du zahlst ' + x.n.de + ': ' + S(x.amt) + '.', 'You pay ' + x.n.en + ': ' + S(x.amt) + '.'); await pay(p, x.amt, g.opts.pot ? -2 : -1); return; }
    if (x.t === 'gojail') { await toJail(p); return; }
    if (x.t === 'free' && g.opts.pot && g.pot > 0) { var pt = g.pot; g.pot = 0; give(p, pt); say2(p, nm(p) + ' räumt den Topf ab: ' + S(pt) + '!', nm(p) + ' takes the pot: ' + S(pt) + '!', 'Du räumst den Topf ab: ' + S(pt) + '!', 'You take the pot: ' + S(pt) + '!'); K.sfx('win'); return; }
    if (x.t === 'fate' || x.t === 'pact') await card(p, x.t);
  }
  async function offerBuy(p, f) {
    var g = G(), x = F[f];
    if (g.cash[p] >= x.price) {
      var i = await K.ask(p, { k: 'dlg', ico: x.t === 'st' ? '🏚️' : x.ico, title: L2(x.n.de + ' kaufen?', 'Buy ' + x.n.en + '?'), html: L2('Preis: <b>' + S(x.price) + '</b> · Du hast ' + S(g.cash[p]) + '.' + rentInfo(x, 'de'), 'Price: <b>' + S(x.price) + '</b> · You have ' + S(g.cash[p]) + '.' + rentInfo(x, 'en')), btns: [L2('Kaufen für ' + x.price, 'Buy for ' + x.price), g.opts.auction ? L2('Nicht kaufen (Versteigerung)', 'Don’t buy (auction)') : L2('Nicht kaufen', 'Don’t buy')] }, function () { return aiBuy(g, p, f) ? 0 : 1; });
      if (i === 0) { g.cash[p] -= x.price; g.own[f] = p; say2(p, nm(p) + ' kauft ' + x.n.de + ' für ' + S(x.price) + '.', nm(p) + ' buys ' + x.n.en + ' for ' + S(x.price) + '.', 'Du kaufst ' + x.n.de + ' für ' + S(x.price) + '.', 'You buy ' + x.n.en + ' for ' + S(x.price) + '.'); K.fx({ k: 'cash', p: p, n: -x.price }); K.sfx('coin'); K.push(); return; }
    }
    if (g.opts.auction) await auction(f, p);
  }
  function rentInfo(x, l) {
    var de = l === 'de';
    if (x.t === 'st') return '<br><small>' + (de ? 'Miete: ' : 'Rent: ') + x.rent[0] + ' · ' + (de ? 'mit Farbgruppe ' : 'with colour set ') + x.rent[0] * 2 + ' · ' + (de ? 'Häuser: ' : 'houses: ') + x.rent.slice(1, 5).join(' / ') + ' · ' + (de ? 'Palast: ' : 'palace: ') + x.rent[5] + ' · ' + (de ? 'Hauspreis: ' : 'house price: ') + x.hc + '</small>';
    if (x.t === 'ferry') return '<br><small>' + (de ? 'Miete: 25 / 50 / 100 / 200 je nach Anzahl Fähren' : 'Rent: 25 / 50 / 100 / 200 depending on ferries owned') + '</small>';
    return '<br><small>' + (de ? 'Miete: 4× Würfelaugen, mit beiden Werken 10×' : 'Rent: 4× the dice roll, with both works 10×') + '</small>';
  }
  E.rentInfo = rentInfo;
  function propValue(g, p, f) {
    var x = F[f], v = x.price;
    if (x.t === 'st') { var grp = groupOf(x.g), mine = grp.filter(function (q) { return g.own[q] === p; }).length, other = grp.filter(function (q) { return g.own[q] >= 0 && g.own[q] !== p; }).length; if (mine === grp.length - 1) v *= 1.7; else if (mine && !other) v *= 1.25; if (other && !mine) v *= 1.1; }
    else if (x.t === 'ferry') v *= 1 + .15 * F.filter(function (y) { return y.t === 'ferry' && g.own[y.i] === p; }).length;
    return v;
  }
  function aiBuy(g, p, f) { var x = F[f], reserve = 120 + Math.min(200, g.round * 8); return g.cash[p] - x.price >= reserve || (propValue(g, p, f) > x.price * 1.5 && g.cash[p] - x.price >= 40); }
  async function auction(f, starter) {
    var g = G(), x = F[f], act = alive(g).filter(function (q) { return g.cash[q] >= 10; }), bid = 0, lead = -1, k = 0;
    if (!act.length) return;
    // Reihenfolge ab dem Nächsten
    act.sort(function (a, b) { return ((a - starter - 1 + 40) % g.seats.length) - ((b - starter - 1 + 40) % g.seats.length); });
    g.auc = { f: f, bid: 0, lead: -1, act: act.slice() };
    say2(-1, x.n.de + ' wird versteigert!', x.n.en + ' is up for auction!'); K.push();
    var guard = 0;
    while (guard++ < 400) {
      act = act.filter(function (q) { return g.cash[q] >= bid + 10 || q === lead; });
      if (!act.length) break;
      if (act.length === 1 && lead === act[0]) break;
      var q = act[k % act.length];
      if (q === lead) { k++; continue; }
      g.auc = { f: f, bid: bid, lead: lead, act: act.slice() }; K.push();
      var steps = [10, 50, 100], bt = steps.map(function (s) { return L2('+' + s + ' (' + (bid + s) + ')', '+' + s + ' (' + (bid + s) + ')'); }).concat([L2('Passen', 'Pass')]);
      var dis = steps.map(function (s) { return g.cash[q] < bid + s; }).concat([false]);
      var i = await K.ask(q, { k: 'dlg', ico: '🔨', title: L2('Versteigerung: ' + x.n.de, 'Auction: ' + x.n.en), html: L2('Höchstgebot: <b>' + S(bid) + '</b>' + (lead >= 0 ? ' von ' + HK.esc(nm(lead)) : '') + ' · Listenpreis ' + x.price + ' · Du hast ' + S(g.cash[q]) + '.' + rentInfo(x, 'de'), 'Highest bid: <b>' + S(bid) + '</b>' + (lead >= 0 ? ' by ' + HK.esc(nm(lead)) : '') + ' · list price ' + x.price + ' · you have ' + S(g.cash[q]) + '.' + rentInfo(x, 'en')), btns: bt, dis: dis }, function () {
        var max = Math.min(g.cash[q] - 30, propValue(g, q, f) * (g.cash[q] > x.price * 2 ? 1 : .8));
        if (bid + 10 > max) return 3; return bid + 50 <= max * .7 ? 1 : 0;
      });
      if (i == null || i >= 3 || dis[i]) { act = act.filter(function (z) { return z !== q; }); say2(q, nm(q) + ' passt.', nm(q) + ' passes.', 'Du passt.', 'You pass.'); }
      else { bid += steps[i]; lead = q; k++; say2(q, nm(q) + ' bietet ' + S(bid) + '.', nm(q) + ' bids ' + S(bid) + '.', 'Du bietest ' + S(bid) + '.', 'You bid ' + S(bid) + '.'); }
      K.push();
    }
    g.auc = null;
    if (lead >= 0) { g.cash[lead] -= bid; g.own[f] = lead; say2(lead, nm(lead) + ' ersteigert ' + x.n.de + ' für ' + S(bid) + '.', nm(lead) + ' wins ' + x.n.en + ' for ' + S(bid) + '.', 'Du ersteigerst ' + x.n.de + ' für ' + S(bid) + '.', 'You win ' + x.n.en + ' for ' + S(bid) + '.'); K.sfx('coin'); }
    else say2(-1, 'Niemand bietet. ' + x.n.de + ' bleibt frei.', 'Nobody bids. ' + x.n.en + ' stays unowned.');
    K.push();
  }
  async function card(p, kind) {
    var g = G(), deck = kind === 'fate' ? g.fate : g.pact, idx = deck.shift(), c = (kind === 'fate' ? HT.FATE : HT.PACT)[idx];
    if (c.a !== 'free') deck.push(idx); else { g.freeCards.push(kind + ':' + idx); g.free[p]++; }
    g.card = { kind: kind, idx: idx, p: p, seq: (g.card ? g.card.seq : 0) + 1 };
    K.say(p, L2(nm(p) + ' zieht ' + (kind === 'fate' ? 'Schicksalsrad' : 'Teufelspakt') + ': ' + c.d.de, nm(p) + ' draws ' + (kind === 'fate' ? 'Wheel of Fate' : 'Devil’s Pact') + ': ' + c.d.en), L2('Du ziehst: ' + c.d.de, 'You draw: ' + c.d.en));
    K.fx({ k: 'card' }); K.sfx('flip'); K.push(); await K.sleep(1500);
    var i, n;
    switch (c.a) {
      case 'to': await moveTo(p, c.f, true); await land(p, 7); break;
      case 'ferry': n = [5, 15, 25, 35].find(function (f) { return f > g.pos[p]; }); if (n == null) n = 5; await moveTo(p, n, true); if (g.own[n] >= 0 && g.own[n] !== p && !g.mort[n]) await land(p, 7, 2); else await land(p, 7); break;
      case 'util': n = g.pos[p] < 12 || g.pos[p] >= 28 ? 12 : 28; await moveTo(p, n, true); await land(p, 7, 10); break;
      case 'back': n = (g.pos[p] - c.n + 40) % 40; await moveTo(p, n, false, -c.n); await land(p, 7); break;
      case 'jail': await toJail(p); break;
      case 'free': break;
      case 'money': if (c.n > 0) { give(p, c.n); K.fx({ k: 'cash', p: p, n: c.n }); K.sfx('coin'); } else await pay(p, -c.n, g.opts.pot ? -2 : -1); break;
      case 'repair':
        var h = 0, pl = 0; F.forEach(function (x) { if (g.own[x.i] === p && x.t === 'st') { if (g.houses[x.i] === 5) pl++; else h += g.houses[x.i]; } });
        n = h * c.h + pl * c.p; if (n) await pay(p, n, g.opts.pot ? -2 : -1); break;
      case 'each':
        var others = alive(g).filter(function (q) { return q !== p; });
        for (i = 0; i < others.length; i++) { if (c.n < 0) { if (!(await pay(p, -c.n, others[i]))) break; } else await pay(others[i], c.n, p); }
        break;
    }
    K.push();
  }

  // ---------- Züge ----------
  E.turnOpts = function (g, p, phase) {
    var o = [];
    if (phase === 'pre') { o.push('roll'); if (g.jail[p] >= 0) { if (g.cash[p] >= 50) o.push('payjail'); if (g.free[p] > 0) o.push('cardjail'); } }
    else o.push('end');
    o.push('bankrupt');
    return o;
  };
  E.valid = function (spec, a, g, p) {
    if (spec.k !== 'turn' || !a) return false;
    if (['build', 'sell', 'mort', 'unmort', 'trade'].indexOf(a.t) >= 0) return E.legal(g, p, a);
    return spec.opts.indexOf(a.t) >= 0;
  };
  function aiManage(g, p, phase) {
    var fs = F.filter(function (x) { return g.own[x.i] === p; });
    var reserve = 150 + Math.min(250, g.round * 6);
    var u = fs.filter(function (x) { return g.mort[x.i] && g.cash[p] - unmortCost(x.i) > reserve + 150 && (x.t !== 'st' || ownsGroup(g, p, x.g)); })[0]; if (u) return { t: 'unmort', f: u.i };
    var b = fs.filter(function (x) { return canBuild(g, p, x.i) && g.cash[p] - x.hc >= reserve; }).sort(function (a, c) { return g.houses[a.i] - g.houses[c.i] || c.price - a.price; })[0]; if (b) return { t: 'build', f: b.i };
    if (phase === 'post' && (g.tradesN || 0) < 1 && Math.random() < .4) { var t = aiTradeIdea(g, p); if (t) return t; }
    return null;
  }
  function missingOne(g, p) {         // Felder, die p zur fertigen Farbgruppe fehlen (genau eins)
    var r = [];
    for (var gr = 0; gr < 8; gr++) {
      var grp = groupOf(gr), miss = grp.filter(function (f) { return g.own[f] !== p; });
      if (miss.length === 1 && grp.length > 1 && !groupHouses(g, gr).some(function (h) { return h > 0; })) r.push(miss[0]);
    }
    return r;
  }
  function aiTradeIdea(g, p) {
    g.rej = g.rej || {};
    var want = missingOne(g, p);
    for (var k = 0; k < want.length; k++) {
      var f = want[k], q = g.own[f];
      if (q < 0 || q === p || g.out[q] || !tradable(g, q, f)) continue;
      var key = p + '>' + q + ':' + f; if (g.rej[key] != null && g.round - g.rej[key] < 6) continue;
      // Tausch: etwas geben, das q eine Farbgruppe vervollständigt
      var theirs = missingOne(g, q).filter(function (x) { return g.own[x] === p && tradable(g, p, x) && F[x].g !== F[f].g; });
      if (theirs.length) return { t: 'trade', to: q, give: [theirs[0]], get: [f], gm: 0, tm: 0, ai: key };
      var offer = Math.min(g.cash[p] - 150, Math.round((F[f].price * 1.3 + 420) / 10) * 10);
      if (offer >= F[f].price + 200) return { t: 'trade', to: q, give: [], get: [f], gm: offer, tm: 0, ai: key };
    }
    return null;
  }
  E.main = async function () {
    var g = G();
    while (!g.over) {
      var p = g.cur;
      if (g.out[p]) { nextPlayer(); continue; }
      if (!g.inTurn) { g.inTurn = true; g.dbl = 0; g.phase = 'pre'; g.tradesN = 0; g.cpuN = 0; say2(p, nm(p) + ' ist am Zug.', 'It is ' + nm(p) + '’s turn.', 'Du bist am Zug.', 'Your turn.'); }
      K.snap('turn'); K.push();
      var opts = E.turnOpts(g, p, g.phase);
      var a = await K.ask(p, { k: 'turn', phase: g.phase, opts: opts }, function () {
        if (g.cpuN++ < 14) { var m = aiManage(g, p, g.phase); if (m) return m; }
        if (g.phase === 'pre' && g.jail[p] >= 0) { if (g.free[p] > 0) return { t: 'cardjail' }; if (g.cash[p] > 400 && g.round < 25) return { t: 'payjail' }; }
        return { t: g.phase === 'pre' ? 'roll' : 'end' };
      });
      if (!a) continue;
      if (a.t === 'end') { nextPlayer(); continue; }
      if (a.t === 'bankrupt') { bankrupt(p, -1); checkOver(); nextPlayer(); continue; }
      if (a.t === 'payjail') { if (await pay(p, 50, g.opts.pot ? -2 : -1)) { g.jail[p] = -1; say2(p, nm(p) + ' kauft sich für 50 aus dem Kerker frei.', nm(p) + ' pays 50 to leave the prison.', 'Du kaufst dich für 50 frei.', 'You pay 50 to get out.'); } checkOver(); continue; }
      if (a.t === 'cardjail') { g.free[p]--; var fc = g.freeCards.shift(); if (fc) { var pr = fc.split(':'); (pr[0] === 'fate' ? g.fate : g.pact).push(+pr[1]); } g.jail[p] = -1; say2(p, nm(p) + ' nutzt eine Freikarte.', nm(p) + ' uses a free pass.', 'Du nutzt eine Freikarte.', 'You use a free pass.'); continue; }
      if (a.t === 'roll') { await doRoll(p); checkOver(); if (g.out[p]) nextPlayer(); continue; }
      await manage(p, a); checkOver();
    }
    K.push();
  };
  async function doRoll(p) {
    var g = G(), d = dice(), sum = d[0] + d[1], dbl = d[0] === d[1];
    await showDice(p, d);
    if (g.jail[p] >= 0) {
      if (dbl) { g.jail[p] = -1; say2(p, nm(p) + ' würfelt einen Pasch und kommt frei!', nm(p) + ' rolls doubles and gets out!', 'Pasch! Du kommst frei!', 'Doubles! You get out!'); }
      else {
        g.jail[p]++;
        if (g.jail[p] < 3) { say2(p, nm(p) + ' bleibt im Kerker.', nm(p) + ' stays in prison.', 'Kein Pasch: Du bleibst im Kerker.', 'No doubles: you stay in prison.'); g.phase = 'post'; return; }
        say2(p, nm(p) + ' muss nach drei Versuchen 50 zahlen.', nm(p) + ' must pay 50 after three tries.', 'Nach drei Versuchen zahlst du 50.', 'After three tries you pay 50.');
        if (!(await pay(p, 50, g.opts.pot ? -2 : -1))) return;
        g.jail[p] = -1;
      }
      await moveTo(p, (g.pos[p] + sum) % 40, true, sum); await land(p, sum); g.phase = 'post'; return;
    }
    if (dbl) { g.dbl++; if (g.dbl >= 3) { say2(p, 'Drei Pasch hintereinander!', 'Three doubles in a row!'); await toJail(p); g.phase = 'post'; return; } }
    await moveTo(p, (g.pos[p] + sum) % 40, true, sum);
    await land(p, sum);
    if (g.out[p]) return;
    g.phase = dbl && g.jail[p] < 0 ? 'pre' : 'post';
    if (g.phase === 'pre') say2(p, 'Pasch: ' + nm(p) + ' würfelt nochmal.', 'Doubles: ' + nm(p) + ' rolls again.', 'Pasch: Du würfelst nochmal.', 'Doubles: you roll again.');
  }
  function nextPlayer() {
    var g = G(), n = g.seats.length; g.inTurn = false;
    var wrapped = false; for (var i = 1; i <= n; i++) { var q = (g.cur + i) % n; if (q <= g.cur) wrapped = true; if (!g.out[q]) { g.cur = q; break; } } if (wrapped) g.round++;
    if ((g.opts.rounds && g.round >= g.opts.rounds || g.round >= 300) && !g.over) { var al = alive(g).sort(function (a, b) { return worth(g, b) - worth(g, a); }); g.over = { w: al[0], why: 'rounds' }; }
    checkOver();
  }
  function checkOver() { var g = G(), al = alive(g); if (!g.over && al.length <= 1) g.over = { w: al[0], why: 'last' }; }
  E.setup = function (seats, opts) {
    var g = { seats: seats, opts: opts, log: [], cash: seats.map(function () { return opts.cash || 1500; }), pos: seats.map(function () { return 0; }), jail: seats.map(function () { return -1; }), free: seats.map(function () { return 0; }), out: seats.map(function () { return false; }),
      own: F.map(function () { return -1; }), houses: F.map(function () { return 0; }), mort: F.map(function () { return false; }), cur: HK.rnd(seats.length), round: 0, pot: 0, inTurn: false, phase: 'pre', dbl: 0,
      fate: HK.shuffle(HT.FATE.map(function (_, i) { return i; })), pact: HK.shuffle(HT.PACT.map(function (_, i) { return i; })), freeCards: [], over: null, dice: null, move: null, card: null, auc: null };
    return g;
  };
})();

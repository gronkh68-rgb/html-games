/* Heldengilde: Spiellogik (läuft nur beim Host). Spielstand G enthält nur JSON-Daten. */
(function () {
  var C = HG.CARDS, CL = HG.CL, MONS = HG.MONS, LEADERS = HG.LEADERS, L2 = HK.L2;
  var K = null;
  var E = window.HGE = {};
  E.bind = function (k) { K = k; };
  var G = function () { return K.G; };
  var nm = function (p) { return K.nm(p); };
  var cn = function (id) { var c = C[id]; return c.t === 'hero' ? L2(c.name, c.name) : c.t === 'mod' ? L2('Modifikator ' + c.v.map(sg).join('/'), 'Modifier ' + c.v.map(sg).join('/')) : c.t === 'chal' ? L2('Herausforderung', 'Challenge') : c.name; };
  var sg = function (v) { return (v > 0 ? '+' : '−') + Math.abs(v); };
  E.cn = cn; E.sg = sg;
  var P = function (a, b) { return L2(a.de + b.de, a.en + b.en); };
  function fmt(tpl, p) { return L2(tpl.de.replace('%', nm(p)), tpl.en.replace('%', nm(p))); }

  // ---------- Hilfen ----------
  function heroCl(e) {
    if (e.it != null) { var it = C[e.it]; if (it.sub === 'crest') return it.cl; if (it.kind === 'mask') return -1; }
    return C[e.h].cl;
  }
  E.heroCl = heroCl;
  function classes(g, p) { var s = {}; s[LEADERS[g.lead[p]].cl] = 1; g.party[p].forEach(function (e) { var c = heroCl(e); if (c >= 0) s[c] = 1; }); return Object.keys(s).length; }
  E.classes = classes;
  function rwCount(g, p, rw) { var n = LEADERS[g.lead[p]].rw === rw ? 1 : 0; g.slain[p].forEach(function (m) { if (MONS[m].rw === rw) n++; }); return n; }
  E.rwCount = rwCount;
  function bonus(g, p, kind) { return kind === 'abil' ? rwCount(g, p, 'abil1') : kind === 'atk' ? rwCount(g, p, 'atk1') : kind === 'chal' ? 2 * rwCount(g, p, 'chal2') : 0; }
  function itemMod(e) { if (e.it == null) return 0; var it = C[e.it]; return it.sub === 'luck' ? it.v : it.kind === 'lead' ? it.v : 0; }
  function silenced(e) { return e.it != null && C[e.it].kind === 'silence'; }
  E.silenced = silenced;
  function safe(g, p) { return rwCount(g, p, 'safe') > 0; }
  function meets(g, p, m) {
    var M = MONS[m], party = g.party[p]; if (party.length < M.rq.n) return false;
    var have = {}; party.forEach(function (e) { var c = heroCl(e); if (c >= 0) have[c] = (have[c] || 0) + 1; });
    return M.rq.cl.every(function (c) { if (!have[c]) return false; have[c]--; return true; });
  }
  E.meets = meets;
  var others = function (p) { var o = []; for (var i = 1; i < K.N(); i++) o.push((p + i) % K.N()); return o; };
  function refillDeck(g) { if (!g.deck.length && g.disc.length) { g.deck = HK.shuffle(g.disc); g.disc = []; K.say(-1, L2('Der Ablagestapel wird neu gemischt.', 'The discard pile is reshuffled.')); } }
  function draw(p, n, quiet) {
    var g = G(), k = 0;
    for (var i = 0; i < n; i++) { refillDeck(g); if (!g.deck.length) break; g.hands[p].push(g.deck.pop()); k++; }
    if (k && !quiet) K.say(p, L2(nm(p) + ' zieht ' + k + (k === 1 ? ' Karte.' : ' Karten.'), nm(p) + ' draws ' + k + ' card' + (k === 1 ? '.' : 's.')), L2('Du ziehst ' + k + (k === 1 ? ' Karte.' : ' Karten.'), 'You draw ' + k + ' card' + (k === 1 ? '.' : 's.')));
    return k;
  }
  E.draw = draw;
  var p2 = function (n) { var w = 0; for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) if (a + b >= n) w++; return w / 36; };
  E.p2 = p2;
  function progress(g, p) { return classes(g, p) + g.slain[p].length * 2.2 + g.party[p].length * .3; }

  // ---------- Fragen ----------
  function pick(p, title, html, items, ai, cancel) {   // items: [{l:{de,en}}], gibt Index oder -1 (Abbrechen)
    var btns = items.map(function (x) { return x.l; }); if (cancel) btns.push(cancel);
    return K.ask(p, { k: 'dlg', ico: '🎯', title: title, html: html || '', btns: btns }, ai).then(function (i) { return i >= items.length ? -1 : i; });
  }
  function heroLabel(q, e) { var c = C[e.h]; return L2(CL[heroCl(e)] ? CL[heroCl(e)].i : '❔', '').de + ' ' + c.name + ' (' + nm(q) + ')'; }
  function chooseOpp(p, title, filter, aiScore) {
    var opts = others(p).filter(filter || function () { return true; }); if (!opts.length) return Promise.resolve(-1);
    var g = G();
    return pick(p, title, '', opts.map(function (q) { return { l: L2(nm(q) + ' · ' + g.hands[q].length + ' Karten · ' + g.party[q].length + ' Helden', nm(q) + ' · ' + g.hands[q].length + ' cards · ' + g.party[q].length + ' heroes') }; }),
      function () { var b = 0, bs = -1e9; opts.forEach(function (q, i) { var s = aiScore ? aiScore(q) : progress(g, q) + Math.random() * .5; if (s > bs) { bs = s; b = i; } }); return b; }).then(function (i) { return i < 0 ? -1 : opts[i]; });
  }
  function chooseOppHero(p, title, allowSafe) {
    var g = G(), list = [];
    others(p).forEach(function (q) { if (!allowSafe && safe(g, q)) return; g.party[q].forEach(function (e, i) { list.push({ q: q, i: i }); }); });
    if (!list.length) return Promise.resolve(null);
    return pick(p, title, '', list.map(function (x) { var e = g.party[x.q][x.i]; return { l: L2(heroLabel(x.q, e), heroLabel(x.q, e)) }; }), function () {
      var best = 0, bs = -1e9; list.forEach(function (x, k) {
        var e = g.party[x.q][x.i], c = heroCl(e), uniq = c >= 0 && g.party[x.q].filter(function (f) { return heroCl(f) === c; }).length === 1 && LEADERS[g.lead[x.q]].cl !== c;
        var mine = c >= 0 && !g.party[p].some(function (f) { return heroCl(f) === c; }) && LEADERS[g.lead[p]].cl !== c;
        var s = progress(g, x.q) + (uniq ? 3 : 0) + (mine ? 2 : 0) + Math.random(); if (s > bs) { bs = s; best = k; }
      }); return best;
    }).then(function (i) { return i < 0 ? null : list[i]; });
  }
  function cardValue(g, p, id) {
    var c = C[id];
    if (c.t === 'hero') { var have = LEADERS[g.lead[p]].cl === c.cl || g.party[p].some(function (e) { return heroCl(e) === c.cl; }); return have ? 5 : 9; }
    if (c.t === 'magic') return 7; if (c.t === 'item') return c.sub === 'curse' ? 5 : 6; if (c.t === 'chal') return 4; return 3 + Math.max.apply(null, c.v.map(Math.abs)) / 2;
  }
  function chooseOwnCard(q, title, html, filterT) {     // q wählt eine eigene Handkarte (z. B. zum Abwerfen)
    var g = G(), h = g.hands[q].filter(function (id) { return !filterT || filterT(C[id]); }); if (!h.length) return Promise.resolve(null);
    return pick(q, title, html, h.map(function (id) { return { l: cn(id) }; }), function () { var b = 0, bs = 1e9; h.forEach(function (id, i) { var v = cardValue(g, q, id); if (v < bs) { bs = v; b = i; } }); return b; }).then(function (i) { return i < 0 ? null : h[i]; });
  }
  function chooseOwnHero(q, title) {
    var g = G(); if (!g.party[q].length) return Promise.resolve(-1);
    return pick(q, title, '', g.party[q].map(function (e) { return { l: L2(heroLabel(q, e), heroLabel(q, e)) }; }), function () {
      var b = 0, bs = 1e9; g.party[q].forEach(function (e, i) { var c = heroCl(e), dup = g.party[q].filter(function (f) { return heroCl(f) === c; }).length > 1 || LEADERS[g.lead[q]].cl === c; var s = (dup ? 0 : 5) + C[e.h].rq / 10 + (e.it != null && C[e.it].sub === 'curse' ? -3 : 0); if (s < bs) { bs = s; b = i; } }); return b;
    });
  }
  function removeHero(q, i, toDisc) { var g = G(), e = g.party[q].splice(i, 1)[0]; if (toDisc) { g.disc.push(e.h); if (e.it != null) g.disc.push(e.it); } return e; }
  function discardCard(q, id) { var g = G(); var k = g.hands[q].indexOf(id); if (k >= 0) { g.hands[q].splice(k, 1); g.disc.push(id); } }

  // ---------- Würfeln mit Modifikator-Runde ----------
  async function roll(p, bonusV, need, label, fail) {
    var g = G(); g.roll = null; K.push();
    var dd = await K.throwDice(p, 2, L2('Wirf die Würfel: ' + label.de, 'Throw the dice: ' + label.en)), a = dd[0], b = dd[1], total = a + b + bonusV;
    g.roll = { p: p, a: a, b: b, bonus: bonusV, mods: [], total: total, need: need, fail: fail == null ? null : fail, label: label, seq: (g.roll ? g.roll.seq : 0) + 1 };
    K.push();
    await K.sleep(500);
    total = await modRound(p, total, need, fail);
    g.roll.total = total; g.roll.done = true; K.push();
    await K.sleep(700);
    return total;
  }
  E.rollFn = roll;
  async function modRound(p, total, need, fail) {
    var g = G(), n = K.N(), passes = 0, k = 0;
    while (passes < n) {
      var q = (p + k) % n; k++;
      var mods = g.hands[q].filter(function (id) { return C[id].t === 'mod'; });
      if (!mods.length) { passes++; continue; }
      var opts = []; mods.forEach(function (id) { C[id].v.forEach(function (v) { opts.push({ id: id, v: v }); }); });
      var who = q === p ? L2('Dein Wurf', 'Your roll') : L2('Wurf von ' + nm(p), nm(p) + '’s roll');
      var info = L2(who.de + ': <b>' + total + '</b> (benötigt ' + need + '+' + (fail != null ? ', Fehlschlag bei ' + fail + ' oder weniger' : '') + ')', who.en + ': <b>' + total + '</b> (needs ' + need + '+' + (fail != null ? ', fails at ' + fail + ' or less' : '') + ')');
      var i = await K.ask(q, { k: 'dlg', ico: '🎲', title: L2('Modifikator spielen?', 'Play a modifier?'), html: info, btns: opts.map(function (o) { return L2(sg(o.v) + ' spielen', 'Play ' + sg(o.v)); }).concat([L2('Keinen spielen', 'Play none')]) },
        function () { return aiMod(g, p, q, total, need, fail, opts); });
      if (i == null || i < 0 || i >= opts.length) { passes++; continue; }
      var o = opts[i]; discardCard(q, o.id); total += o.v; passes = 0;
      g.roll.mods.push({ q: q, v: o.v }); g.roll.total = total;
      K.say(q, L2(nm(q) + ' spielt ' + sg(o.v) + ' auf den Wurf (jetzt ' + total + ').', nm(q) + ' plays ' + sg(o.v) + ' on the roll (now ' + total + ').'), L2('Du spielst ' + sg(o.v) + ' auf den Wurf (jetzt ' + total + ').', 'You play ' + sg(o.v) + ' on the roll (now ' + total + ').'));
      K.fx({ k: 'mod', v: o.v, total: total }); K.push(); K.sfx('flip');
      if (rwCount(g, q, 'modDraw')) draw(q, rwCount(g, q, 'modDraw'));
      await K.sleep(600);
    }
    return total;
  }
  function aiMod(g, p, q, total, need, fail, opts) {
    var best = -1, bv = 1e9;
    opts.forEach(function (o, i) {
      var t = total + o.v;
      if (q === p) {
        if (total < need && o.v > 0 && t >= need && o.v < bv) { bv = o.v; best = i; }
        else if (fail != null && total <= fail && o.v > 0 && t > fail && best < 0 && o.v < bv) { bv = o.v; best = i; }
      } else {
        var leader = progress(g, p) >= Math.max.apply(null, others(p).map(function (x) { return progress(g, x); })) - 1;
        if (total >= need && o.v < 0 && t < need && -o.v < bv && (leader || Math.random() < .5)) { bv = -o.v; best = i; }
      }
    });
    return best < 0 ? opts.length : best;
  }

  // ---------- Herausforderung ----------
  async function challenge(p, id) {
    var g = G();
    for (var k = 0; k < others(p).length; k++) {
      var q = others(p)[k], ch = g.hands[q].filter(function (x) { return C[x].t === 'chal'; });
      if (!ch.length) continue;
      var t = C[id].t, what = cn(id);
      var yes = await K.ask(q, { k: 'dlg', ico: '⚡', title: L2('Herausfordern?', 'Challenge?'), html: L2(nm(p) + ' spielt <b>' + what.de + '</b>. Willst du es mit einer Herausforderungskarte verhindern? Ihr würfelt beide, du musst höher würfeln.', nm(p) + ' plays <b>' + what.en + '</b>. Use a challenge card to stop it? You both roll, you must roll higher.'), btns: [L2('⚡ Herausfordern', '⚡ Challenge'), L2('Nicht herausfordern', 'Don’t challenge')] },
        function () { var lead = progress(g, p) >= progress(g, q); var pr = (t === 'magic' ? .45 : t === 'hero' ? .3 : .25) + (lead ? .2 : -.1) + (classes(g, p) >= 5 ? .4 : 0); return Math.random() < pr ? 0 : 1; });
      if (yes !== 0) continue;
      discardCard(q, ch[0]);
      K.say(q, L2(nm(q) + ' fordert ' + nm(p) + ' heraus!', nm(q) + ' challenges ' + nm(p) + '!'), L2('Du forderst ' + nm(p) + ' heraus!', 'You challenge ' + nm(p) + '!'));
      K.push(); await K.sleep(500);
      g.roll = null; K.push();
      var dq = await K.throwDice(q, 2, L2('Herausforderung: Wirf die Würfel', 'Challenge: throw the dice')), dp = await K.throwDice(p, 2, L2('Herausforderung: Wirf die Würfel', 'Challenge: throw the dice'));
      var ra = dq[0] + dq[1] + bonus(g, q, 'chal'), rb = dp[0] + dp[1] + bonus(g, p, 'chal');
      g.roll = { p: q, a: 0, b: 0, chal: { q: q, p: p, rq: ra, rp: rb }, total: ra, need: rb + 1, done: true, mods: [], label: L2('Herausforderung', 'Challenge'), seq: (g.roll ? g.roll.seq : 0) + 1 };
      K.push(); await K.sleep(1300);
      if (ra > rb) {
        K.say(q, L2(nm(q) + ' gewinnt die Herausforderung (' + ra + ' gegen ' + rb + '). ' + what.de + ' wird abgeworfen.', nm(q) + ' wins the challenge (' + ra + ' vs ' + rb + '). ' + what.en + ' is discarded.'));
        K.sfx('bad'); return true;
      }
      K.say(p, L2(nm(p) + ' hält stand (' + rb + ' gegen ' + ra + ').', nm(p) + ' holds (' + rb + ' vs ' + ra + ').'), L2('Du hältst stand (' + rb + ' gegen ' + ra + ').', 'You hold (' + rb + ' vs ' + ra + ').'));
      return false;
    }
    return false;
  }

  // ---------- Effekte ----------
  async function runFx(p, fx, n) {
    var g = G(), i, q, t;
    switch (fx) {
      case 'draw': draw(p, n); break;
      case 'ap': g.ap += n; K.say(p, L2(nm(p) + ' erhält +' + n + ' Aktionspunkte.', nm(p) + ' gains +' + n + ' action points.'), L2('Du erhältst +' + n + ' Aktionspunkte.', 'You gain +' + n + ' action points.')); break;
      case 'destroy':
        for (i = 0; i < n; i++) {
          t = await chooseOppHero(p, L2('Welchen Helden zerstören?', 'Destroy which hero?'));
          if (!t) { if (!i) K.say(-1, L2('Es gibt keinen Helden zum Zerstören.', 'There is no hero to destroy.')); break; }
          var e = removeHero(t.q, t.i, true);
          K.say(p, L2(nm(p) + ' zerstört ' + C[e.h].name + ' von ' + nm(t.q) + '.', nm(p) + ' destroys ' + nm(t.q) + '’s ' + C[e.h].name + '.'), L2('Du zerstörst ' + C[e.h].name + ' von ' + nm(t.q) + '.', 'You destroy ' + nm(t.q) + '’s ' + C[e.h].name + '.'));
          if (rwCount(g, t.q, 'revive')) draw(t.q, 2 * rwCount(g, t.q, 'revive'));
          K.fx({ k: 'boom' }); K.sfx('bad'); K.push(); await K.sleep(500);
        }
        break;
      case 'sacrifice':
        q = await chooseOpp(p, L2('Wer muss einen Helden opfern?', 'Who must sacrifice a hero?'), function (x) { return g.party[x].length > 0; });
        if (q < 0) { K.say(-1, L2('Niemand hat einen Helden zum Opfern.', 'Nobody has a hero to sacrifice.')); break; }
        await sacrifice(q, 1); break;
      case 'discardAll':
        await Promise.all(others(p).map(async function (x) { for (var j = 0; j < n; j++) { var c = await chooseOwnCard(x, L2('Karte abwerfen', 'Discard a card'), L2(nm(p) + ' zwingt dich, ' + (n - j) + ' Karte(n) abzuwerfen.', nm(p) + ' makes you discard ' + (n - j) + ' card(s).')); if (c == null) break; discardCard(x, c); K.push(); } }));
        K.say(p, L2('Alle Gegner von ' + nm(p) + ' werfen ' + n + ' Karte(n) ab.', 'All of ' + nm(p) + '’s opponents discard ' + n + ' card(s).'), L2('Alle deine Gegner werfen ' + n + ' Karte(n) ab.', 'All your opponents discard ' + n + ' card(s).')); break;
      case 'pull':
        q = await chooseOpp(p, L2('Von wem willst du ziehen?', 'Take cards from whom?'), function (x) { return g.hands[x].length > 0; }, function (x) { return g.hands[x].length + Math.random(); });
        if (q < 0) break;
        var got = 0; for (i = 0; i < n && g.hands[q].length; i++) { g.hands[p].push(g.hands[q].splice(HK.rnd(g.hands[q].length), 1)[0]); got++; }
        K.say(p, L2(nm(p) + ' zieht ' + got + ' Karte(n) von ' + nm(q) + '.', nm(p) + ' takes ' + got + ' card(s) from ' + nm(q) + '.'), L2('Du ziehst ' + got + ' Karte(n) von ' + nm(q) + '.', 'You take ' + got + ' card(s) from ' + nm(q) + '.')); K.sfx('take'); break;
      case 'drawPlay':
        refillDeck(g); if (!g.deck.length) break;
        var d = g.deck.pop(); g.hands[p].push(d);
        K.say(p, L2(nm(p) + ' zieht eine Karte.', nm(p) + ' draws a card.'), P(L2('Du ziehst ', 'You draw '), P(cn(d), L2('.', '.'))));
        K.push();
        if (C[d].t === 'hero') {
          var yes = await K.ask(p, { k: 'dlg', ico: '✨', title: L2('Held gezogen!', 'Hero drawn!'), html: P(cn(d), L2(': Sofort kostenlos in deine Gruppe spielen?', ': play it into your party now for free?')), btns: [L2('Ja, spielen', 'Yes, play'), L2('Auf der Hand behalten', 'Keep in hand')] }, function () { return 0; });
          if (yes === 0) { g.hands[p].splice(g.hands[p].indexOf(d), 1); g.party[p].push({ h: d, it: null, u: false }); K.say(p, L2(nm(p) + ' spielt ' + C[d].name + ' kostenlos.', nm(p) + ' plays ' + C[d].name + ' for free.'), L2('Du spielst ' + C[d].name + ' kostenlos.', 'You play ' + C[d].name + ' for free.')); K.sfx('lay'); }
        }
        break;
      case 'search': case 'revive': case 'reviveParty':
        var flt = fx === 'search' ? function (c) { return n === 'any' || c.t === n; } : function (c) { return c.t === 'hero'; };
        var pool = g.disc.filter(function (id) { return flt(C[id]); });
        if (!pool.length) { K.say(-1, L2('Im Ablagestapel liegt nichts Passendes.', 'Nothing suitable in the discard pile.')); break; }
        pool = pool.slice(-24);
        i = await pick(p, L2('Karte aus dem Ablagestapel nehmen', 'Take a card from the discard pile'), '', pool.map(function (id) { return { l: cn(id) }; }), function () { var b = 0, bs = -1; pool.forEach(function (id, k) { var v = cardValue(g, p, id); if (v > bs) { bs = v; b = k; } }); return b; });
        if (i < 0) break;
        var id = pool[i]; g.disc.splice(g.disc.lastIndexOf(id), 1);
        if (fx === 'reviveParty') { g.party[p].push({ h: id, it: null, u: false }); K.say(p, L2(nm(p) + ' holt ' + C[id].name + ' zurück in die Gruppe.', nm(p) + ' brings ' + C[id].name + ' back into the party.'), L2('Du holst ' + C[id].name + ' zurück in deine Gruppe.', 'You bring ' + C[id].name + ' back into your party.')); }
        else { g.hands[p].push(id); K.say(p, L2(nm(p) + ' nimmt eine Karte aus dem Ablagestapel.', nm(p) + ' takes a card from the discard pile.'), P(L2('Du nimmst ', 'You take '), P(cn(id), L2(' aus dem Ablagestapel.', ' from the discard pile.')))); }
        break;
      case 'peek':
        q = await chooseOpp(p, L2('Wessen Hand ansehen?', 'Look at whose hand?'), function (x) { return g.hands[x].length > 0; }, function (x) { return g.hands[x].length + Math.random(); });
        if (q < 0) break;
        var hq = g.hands[q].slice();
        i = await pick(p, L2('Hand von ' + nm(q) + ': eine Karte nehmen', nm(q) + '’s hand: take one card'), '', hq.map(function (id) { return { l: cn(id) }; }), function () { var b = 0, bs = -1; hq.forEach(function (id, k) { var v = cardValue(g, p, id); if (v > bs) { bs = v; b = k; } }); return b; });
        if (i < 0) break;
        g.hands[q].splice(g.hands[q].indexOf(hq[i]), 1); g.hands[p].push(hq[i]);
        K.say(p, L2(nm(p) + ' sieht sich die Hand von ' + nm(q) + ' an und nimmt eine Karte.', nm(p) + ' looks at ' + nm(q) + '’s hand and takes a card.'), P(L2('Du nimmst ', 'You take '), P(cn(hq[i]), L2(' von ' + nm(q) + '.', ' from ' + nm(q) + '.')))); break;
      case 'steal':
        t = await chooseOppHero(p, L2('Welchen Helden stehlen?', 'Steal which hero?'));
        if (!t) { K.say(-1, L2('Es gibt keinen Helden zum Stehlen.', 'There is no hero to steal.')); break; }
        var se = removeHero(t.q, t.i, false); se.u = true; g.party[p].push(se);
        K.say(p, L2(nm(p) + ' stiehlt ' + C[se.h].name + ' von ' + nm(t.q) + '.', nm(p) + ' steals ' + C[se.h].name + ' from ' + nm(t.q) + '.'), L2('Du stiehlst ' + C[se.h].name + ' von ' + nm(t.q) + '.', 'You steal ' + C[se.h].name + ' from ' + nm(t.q) + '.')); K.sfx('take'); break;
      case 'trade':
        q = await chooseOpp(p, L2('Mit wem Hände tauschen?', 'Swap hands with whom?'), null, function (x) { return g.hands[x].length + Math.random(); });
        if (q < 0) break;
        var tmp = g.hands[p]; g.hands[p] = g.hands[q]; g.hands[q] = tmp;
        K.say(p, L2(nm(p) + ' tauscht die Hand mit ' + nm(q) + '.', nm(p) + ' swaps hands with ' + nm(q) + '.'), L2('Du tauschst die Hand mit ' + nm(q) + '.', 'You swap hands with ' + nm(q) + '.')); break;
      case 'swapHero':
        if (!g.party[p].length) { K.say(-1, L2('Kein eigener Held zum Tauschen.', 'No own hero to swap.')); break; }
        t = await chooseOppHero(p, L2('Welchen Helden willst du bekommen?', 'Which hero do you want?'));
        if (!t) break;
        i = await chooseOwnHero(p, L2('Welchen deiner Helden gibst du ab?', 'Which of your heroes do you give away?'));
        if (i < 0) break;
        var mine = g.party[p][i], theirs = g.party[t.q][t.i]; g.party[p][i] = theirs; g.party[t.q][t.i] = mine; theirs.u = true;
        K.say(p, L2(nm(p) + ' tauscht ' + C[mine.h].name + ' gegen ' + C[theirs.h].name + ' von ' + nm(t.q) + '.', nm(p) + ' swaps ' + C[mine.h].name + ' for ' + nm(t.q) + '’s ' + C[theirs.h].name + '.')); break;
      case 'draw3d1':
        draw(p, 3); K.push();
        var c3 = await chooseOwnCard(p, L2('Eine Karte abwerfen', 'Discard one card'), '');
        if (c3 != null) discardCard(p, c3); break;
    }
    K.push();
  }
  async function sacrifice(q, n) {
    var g = G();
    for (var j = 0; j < n; j++) {
      var i = await chooseOwnHero(q, L2('Welchen Helden opferst du?', 'Which hero do you sacrifice?'));
      if (i < 0) break;
      var e = removeHero(q, i, true);
      K.say(q, L2(nm(q) + ' opfert ' + C[e.h].name + '.', nm(q) + ' sacrifices ' + C[e.h].name + '.'), L2('Du opferst ' + C[e.h].name + '.', 'You sacrifice ' + C[e.h].name + '.'));
      if (rwCount(g, q, 'revive')) draw(q, 2 * rwCount(g, q, 'revive'));
      K.push(); await K.sleep(400);
    }
  }

  // ---------- Aktionen ----------
  function itemTargets(g, p, id) {
    var it = C[id], list = [];
    if (it.sub === 'curse') others(p).forEach(function (q) { g.party[q].forEach(function (e, i) { if (e.it == null) list.push({ q: q, i: i }); }); });
    else g.party[p].forEach(function (e, i) { if (e.it == null) list.push({ q: p, i: i }); });
    return list;
  }
  function magicUsable(g, p, c) {
    switch (c.fx) {
      case 'destroy': case 'steal': return others(p).some(function (q) { return !safe(g, q) && g.party[q].length; });
      case 'reviveParty': return g.disc.some(function (id) { return C[id].t === 'hero'; });
      case 'search': return g.disc.length > 0;
      case 'pull': return others(p).some(function (q) { return g.hands[q].length; });
    }
    return true;
  }
  E.options = function (g, p) {
    var o = [], ap = g.ap;
    if (ap >= 1 || g.freeDraw) if (g.deck.length || g.disc.length) o.push({ t: 'draw' });
    if (ap >= 1) g.hands[p].forEach(function (id) {
      var c = C[id];
      if (c.t === 'hero') o.push({ t: 'play', c: id });
      else if (c.t === 'item' && itemTargets(g, p, id).length) o.push({ t: 'play', c: id });
      else if (c.t === 'magic' && magicUsable(g, p, c)) o.push({ t: 'play', c: id });
    });
    if (ap >= 1) g.party[p].forEach(function (e, i) { if (!e.u && !silenced(e)) o.push({ t: 'use', i: i }); });
    if (ap >= 2) g.mons.forEach(function (m, i) { if (m != null && meets(g, p, m)) o.push({ t: 'atk', m: i }); });
    if (ap >= 1 && LEADERS[g.lead[p]].rw === 'thief' && !g.thiefUsed && others(p).some(function (q) { return g.hands[q].length; })) o.push({ t: 'thief' });
    if (ap >= 3) o.push({ t: 'redraw' });
    o.push({ t: 'end' });
    return o;
  };
  E.doAction = async function (p, a) {
    var g = G();
    if (a.t === 'draw') {
      if (g.freeDraw) g.freeDraw = false; else g.ap--;
      draw(p, 1); K.sfx('take'); return;
    }
    if (a.t === 'redraw') {
      g.ap -= 3; g.hands[p].forEach(function (id) { g.disc.push(id); }); g.hands[p] = [];
      K.say(p, L2(nm(p) + ' wirft die Hand ab und zieht 5 neue Karten.', nm(p) + ' discards the hand and draws 5 new cards.'), L2('Du wirfst deine Hand ab und ziehst 5 neue Karten.', 'You discard your hand and draw 5 new cards.'));
      draw(p, 5, true); return;
    }
    if (a.t === 'thief') { g.ap--; g.thiefUsed = true; await runFx(p, 'pull', 1); return; }
    if (a.t === 'use') {
      g.ap--; var e = g.party[p][a.i]; e.u = true;
      await heroAbility(p, e); return;
    }
    if (a.t === 'atk') { g.ap -= 2; await attack(p, a.m); return; }
    if (a.t === 'play') {
      var id = a.c, c = C[id]; g.ap--;
      g.hands[p].splice(g.hands[p].indexOf(id), 1);
      var tgt = null;
      if (c.t === 'item') {
        var list = itemTargets(g, p, id);
        var ti = await pick(p, L2('Gegenstand anlegen: an welchen Helden?', 'Equip item: on which hero?'), '', list.map(function (x) { var e = g.party[x.q][x.i]; return { l: L2(heroLabel(x.q, e), heroLabel(x.q, e)) }; }), function () {
          var b = 0, bs = -1e9; list.forEach(function (x, k) {
            var e = g.party[x.q][x.i], s = 0;
            if (c.sub === 'crest') { var hc = heroCl(e), dup = g.party[p].filter(function (f) { return heroCl(f) === hc; }).length > 1 || LEADERS[g.lead[p]].cl === hc; var newC = !g.party[p].some(function (f) { return heroCl(f) === c.cl; }) && LEADERS[g.lead[p]].cl !== c.cl; s = (dup ? 4 : 0) + (newC ? 3 : -5); }
            else if (c.sub === 'luck') s = -C[e.h].rq;
            else s = progress(g, x.q) + C[e.h].rq / 3 + Math.random();
            if (s > bs) { bs = s; b = k; }
          }); return b;
        });
        tgt = list[Math.max(0, ti)];
      }
      K.say(p, P(L2(nm(p) + ' spielt ', nm(p) + ' plays '), P(cn(id), L2('.', '.'))), P(L2('Du spielst ', 'You play '), P(cn(id), L2('.', '.'))));
      g.limbo = { id: id, p: p }; K.push(); K.sfx('lay'); await K.sleep(450);
      var stopped = await challenge(p, id);
      g.limbo = null;
      if (stopped) { g.disc.push(id); K.push(); return; }
      if (c.t === 'hero') {
        var ne = { h: id, it: null, u: false }; g.party[p].push(ne); K.push();
        var r = await K.ask(p, { k: 'dlg', ico: CL[c.cl].i, title: L2(c.name + ' ist in deiner Gruppe', c.name + ' joined your party'), html: L2('Fähigkeit jetzt kostenlos würfeln? (' + c.rq + '+ nötig)<br><i>' + HG.FX(c.fx, c.n).de + '</i>', 'Roll for the ability now for free? (' + c.rq + '+ needed)<br><i>' + HG.FX(c.fx, c.n).en + '</i>'), btns: [L2('🎲 Würfeln', '🎲 Roll'), L2('Später', 'Later')] }, function () { return 0; });
        if (r === 0) { ne.u = true; await heroAbility(p, ne); }
      } else if (c.t === 'item') {
        var te = g.party[tgt.q][tgt.i];
        if (te && te.it == null) { te.it = id; K.say(p, L2(cn(id).de + ' wird an ' + C[te.h].name + ' angelegt.', cn(id).en + ' is equipped on ' + C[te.h].name + '.')); }
        else g.disc.push(id);
      } else if (c.t === 'magic') {
        g.disc.push(id);
        await runFx(p, c.fx, c.n);
        if (LEADERS[g.lead[p]].rw === 'magicDraw') draw(p, 1);
      }
      K.push(); return;
    }
  };
  async function heroAbility(p, e) {
    var g = G(), c = C[e.h];
    if (silenced(e)) { K.say(-1, L2(c.name + ' ist verflucht und kann nichts tun.', c.name + ' is cursed and cannot act.')); return; }
    var tot = await roll(p, bonus(g, p, 'abil') + itemMod(e), c.rq, L2(c.name + ': Fähigkeit', c.name + ': ability'));
    if (tot >= c.rq) {
      K.say(p, L2(c.name + ' gelingt (' + tot + '). ', c.name + ' succeeds (' + tot + ').'), L2(c.name + ' gelingt (' + tot + ').', c.name + ' succeeds (' + tot + ').'));
      K.sfx('coin'); await runFx(p, c.fx, c.n);
    } else { K.say(p, L2(c.name + ' scheitert (' + tot + ', nötig ' + c.rq + ').', c.name + ' fails (' + tot + ', needed ' + c.rq + ').')); K.sfx('bad'); }
  }
  async function attack(p, mi) {
    var g = G(), m = g.mons[mi], M = MONS[m];
    K.say(p, L2(nm(p) + ' greift ' + M.name.de + ' an!', nm(p) + ' attacks the ' + M.name.en + '!'), L2('Du greifst ' + M.name.de + ' an!', 'You attack the ' + M.name.en + '!'));
    g.atk = { p: p, m: mi }; K.push(); await K.sleep(400);
    var tot = await roll(p, bonus(g, p, 'atk'), M.slay, L2('Angriff auf ' + M.name.de, 'Attack on ' + M.name.en), M.fail);
    g.atk = null;
    if (tot >= M.slay) {
      g.slain[p].push(m); g.mdeck.length ? g.mons[mi] = g.mdeck.pop() : g.mons[mi] = null;
      K.say(p, L2(nm(p) + ' besiegt ' + M.name.de + '! Belohnung: ' + HG.RW[M.rw].de, nm(p) + ' slays the ' + M.name.en + '! Reward: ' + HG.RW[M.rw].en), L2('Du besiegst ' + M.name.de + '! Belohnung: ' + HG.RW[M.rw].de, 'You slay the ' + M.name.en + '! Reward: ' + HG.RW[M.rw].en));
      K.fx({ k: 'slay', m: m }); K.sfx('win');
    } else if (tot <= M.fail) {
      K.say(p, L2('Der Angriff scheitert (' + tot + ')! Strafe für ' + nm(p) + '.', 'The attack fails (' + tot + ')! Penalty for ' + nm(p) + '.'), L2('Der Angriff scheitert (' + tot + ')! Strafe.', 'The attack fails (' + tot + ')! Penalty.'));
      K.sfx('bad'); K.push();
      if (M.pen[0] === 'sac') await sacrifice(p, M.pen[1]);
      else for (var j = 0; j < M.pen[1]; j++) { var c = await chooseOwnCard(p, L2('Strafe: Karte abwerfen', 'Penalty: discard a card'), ''); if (c == null) break; discardCard(p, c); K.push(); }
    } else K.say(-1, L2('Unentschieden (' + tot + '): Das Monster bleibt, ohne Strafe.', 'No result (' + tot + '): the monster stays, no penalty.'));
    K.push();
  }

  // ---------- Computer ----------
  E.ai = function (g, p, o) {
    var has = function (t) { return o.filter(function (x) { return x.t === t; }); };
    var atk = has('atk'), best = null, bp = 0;
    atk.forEach(function (x) { var M = MONS[g.mons[x.m]], pr = p2(M.slay - bonus(g, p, 'atk')), pf = 1 - p2(M.fail + 1 - bonus(g, p, 'atk')); var s = pr - pf * .5; if (s > bp) { bp = s; best = x; } });
    if (best && bp > .3) return best;
    var plays = has('play').map(function (x) { var c = C[x.c], s = 0;
      if (c.t === 'hero') { var newC = LEADERS[g.lead[p]].cl !== c.cl && !g.party[p].some(function (e) { return heroCl(e) === c.cl; }); s = newC ? 10 : 6; }
      else if (c.t === 'magic') s = c.fx === 'ap' ? (g.ap >= 2 ? 7 : 2) : c.fx === 'draw' ? 5 : 7;
      else if (c.t === 'item') s = c.sub === 'crest' ? 6 : 4;
      return { x: x, s: s + Math.random() }; }).sort(function (a, b) { return b.s - a.s; });
    if (plays.length && plays[0].s > 5) return plays[0].x;
    var use = has('use').map(function (x) { var e = g.party[p][x.i], c = C[e.h]; return { x: x, s: p2(c.rq - bonus(g, p, 'abil') - itemMod(e)) }; }).sort(function (a, b) { return b.s - a.s; });
    if (use.length && use[0].s >= .4) return use[0].x;
    if (plays.length) return plays[0].x;
    if (has('thief').length) return has('thief')[0];
    if (has('draw').length && (g.ap >= 1 || g.freeDraw)) return has('draw')[0];
    if (use.length) return use[0].x;
    return { t: 'end' };
  };

  // ---------- Ablauf ----------
  E.setup = function (seats, opts) {
    var g = { seats: seats, opts: opts, log: [], deck: HK.shuffle(C.map(function (c) { return c.id; })), disc: [], mdeck: HK.shuffle(MONS.map(function (m) { return m.id; })), mons: [], hands: [], party: [], slain: [], lead: [], cur: 0, ap: 0, inTurn: false, over: null, roll: null, atk: null, limbo: null, freeDraw: false, thiefUsed: false };
    g.mons = [g.mdeck.pop(), g.mdeck.pop(), g.mdeck.pop()];
    var ls = HK.shuffle([0, 1, 2, 3, 4, 5]);
    seats.forEach(function (s, i) { g.lead.push(ls[i % 6]); g.party.push([]); g.slain.push([]); g.hands.push(g.deck.splice(-5, 5)); });
    g.cur = HK.rnd(seats.length);
    g.goalM = opts.quick ? 2 : 3; g.goalC = opts.quick ? 5 : 6;
    return g;
  };
  E.main = async function () {
    var g = G();
    while (!g.over) {
      var p = g.cur;
      if (!g.inTurn) {
        g.inTurn = true; g.ap = 3 + rwCount(g, p, 'ap1'); g.freeDraw = LEADERS[g.lead[p]].rw === 'freeDraw'; g.thiefUsed = false;
        g.party[p].forEach(function (e) { e.u = false; });
        K.say(p, L2(nm(p) + ' ist am Zug.', 'It is ' + nm(p) + '’s turn.'), L2('Du bist am Zug.', 'Your turn.'));
        var d1 = rwCount(g, p, 'draw1'); if (d1) draw(p, d1);
      }
      K.snap('turn'); K.push();
      var o = E.options(g, p);
      if (o.length === 1 || (g.ap <= 0 && !g.freeDraw)) { await endTurn(p); continue; }
      var a = await K.ask(p, { k: 'act', ap: g.ap, opts: o }, function () { return E.ai(g, p, o); });
      if (!a || a.t === 'end') { await endTurn(p); continue; }
      await E.doAction(p, a);
      checkWin();
      if (G().seats[p].type === 'cpu') await K.sleep(500);
    }
    K.push();
  };
  async function endTurn(p) {
    var g = G();
    while (g.hands[p].length > 7) {
      var c = await chooseOwnCard(p, L2('Zu viele Karten', 'Too many cards'), L2('Am Zugende darfst du höchstens 7 Karten haben. Wirf eine ab.', 'You may hold at most 7 cards at the end of your turn. Discard one.'));
      if (c == null) break; discardCard(p, c); K.push();
    }
    g.inTurn = false; g.cur = (p + 1) % K.N();
    if (G().seats[p].type === 'cpu') await K.sleep(300);
  }
  function checkWin() {
    var g = G(); if (g.over) return;
    var order = [g.cur].concat(others(g.cur));
    for (var k = 0; k < order.length; k++) {
      var p = order[k];
      if (g.slain[p].length >= g.goalM) { g.over = { w: p, why: 'm' }; break; }
      if (classes(g, p) >= g.goalC) { g.over = { w: p, why: 'c' }; break; }
    }
  }
  E.checkWin = checkWin;
  E.valid = function (spec, a, g, p) {
    if (spec.k !== 'act' || !a) return false;
    var s = JSON.stringify(a); return spec.opts.some(function (o) { return JSON.stringify(o) === s; });
  };
})();

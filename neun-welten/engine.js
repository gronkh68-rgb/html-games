/* Neun Welten: Regeln (reine Funktionen, laufen beim Host und in der Simulation).
   Deckbau + Gefolgsleute einsetzen: Karten schicken Gefolgsleute auf Felder (Entsenden), der Rest der Hand zählt beim Thing (Ruhm kauft Karten, Stärke zählt in der Schlacht). */
(function (root) {
  'use strict';
  var NW = {};
  var L2 = function (de, en) { return { de: de, en: en == null ? de : en }; };
  NW.FAC = { a: L2('Asen', 'Aesir'), r: L2('Riesen', 'Giants'), z: L2('Zwerge', 'Dwarves'), w: L2('Walküren', 'Valkyries') };
  NW.TYPES = { a: L2('Asen', 'Aesir'), r: L2('Riesen', 'Giants'), z: L2('Zwerge', 'Dwarves'), w: L2('Walküren', 'Valkyries'), s: L2('Siedlung', 'Settlement'), k: L2('Schlachtfeld', 'Battlefield') };
  NW.RES = { met: L2('Met', 'Mead'), eisen: L2('Eisen', 'Iron'), silber: L2('Silber', 'Silver') };
  // Felder: t = Typ (welches Kartenzeichen nötig ist), f = Macht (gibt +1 Einfluss), c = Kosten, e = Ertrag, k = Kampffeld (Krieger dürfen in die Schlacht)
  NW.SPACES = [
    { id: 'a1', t: 'a', f: 'a', n: L2('Odins Halle', "Odin's Hall"), c: { silber: 2 }, e: { draw: 2 } },
    { id: 'a2', t: 'a', f: 'a', n: L2('Mimirs Brunnen', "Mimir's Well"), c: {}, e: { list: 1 } },
    { id: 'r1', t: 'r', f: 'r', n: L2('Jötunheim', 'Jotunheim'), c: {}, e: { troop: 2 }, k: 1 },
    { id: 'r2', t: 'r', f: 'r', n: L2('Eisfeste', 'Ice Keep'), c: { met: 1 }, e: { eisen: 3 } },
    { id: 'z1', t: 'z', f: 'z', n: L2('Schmiede von Nidavellir', 'Forge of Nidavellir'), c: { eisen: 2 }, e: { silber: 5 } },
    { id: 'z2', t: 'z', f: 'z', n: L2('Schatzkammer', 'Treasury'), c: {}, e: { silber: 2 } },
    { id: 'w1', t: 'w', f: 'w', n: L2('Walhall', 'Valhalla'), c: { met: 2 }, e: { troop: 3 }, k: 1 },
    { id: 'w2', t: 'w', f: 'w', n: L2('Folkwang', 'Folkvangr'), c: {}, e: { troop: 1, draw: 1 }, k: 1 },
    { id: 's1', t: 's', n: L2('Hafen', 'Harbour'), c: {}, e: { met: 1 } },
    { id: 's2', t: 's', n: L2('Markt', 'Market'), c: {}, e: { silber: 2 } },
    { id: 's3', t: 's', n: L2('Langhaus', 'Longhouse'), c: { silber: 6 }, e: { agent: 1 } },
    { id: 's4', t: 's', n: L2('Runenstein', 'Runestone'), c: {}, e: { draw: 1, ruhm: 1 } },
    { id: 'k1', t: 'k', n: L2('Fjordüberfall', 'Fjord Raid'), c: {}, e: { silber: 1, troop: 1 }, k: 1 },
    { id: 'k2', t: 'k', n: L2('Eisenmine', 'Iron Mine'), c: {}, e: { eisen: 2 }, k: 1 },
    { id: 'k3', t: 'k', n: L2('Bifröst', 'Bifrost'), c: { met: 1 }, e: { troop: 2, draw: 1 }, k: 1 }
  ];
  NW.SP = {}; NW.SPACES.forEach(function (s) { NW.SP[s.id] = s; });
  // Karten: go = Feldtypen, s = Effekt beim Entsenden, r/st = Ruhm/Stärke beim Thing, t = weiterer Thing-Effekt, x = Anzahl im Marktstapel
  var C = NW.CARDS = {
    // Startkarten
    lied: { n: L2('Skaldenlied', "Skald's Song"), go: [], r: 2, art: 'sHarp', bg: '#3a2a4a' },
    axt: { n: L2('Axt', 'Axe'), go: ['k'], st: 1, art: 'sAxe', bg: '#4a2a1a' },
    gesandter: { n: L2('Gesandter', 'Envoy'), go: ['a', 'r', 'z', 'w'], r: 1, art: 'sScroll', bg: '#23365a' },
    schiff: { n: L2('Langschiff', 'Longship'), go: ['s'], r: 1, art: 'sShip', bg: '#16384a' },
    spaeher: { n: L2('Späher', 'Scout'), go: ['k', 's'], r: 1, art: 'sRaven', bg: '#2a3a2a' },
    eid: { n: L2('Treueeid', 'Oath'), go: ['a', 'r', 'z', 'w'], art: 'sRing', bg: '#4a3a1a' },
    ring: { n: L2('Siegelring', 'Signet Ring'), go: ['s', 'k', 'z'], s: { silber: 1 }, r: 1, art: 'sRing', bg: '#3a2216' },
    // immer kaufbar
    skalde: { n: L2('Skalde', 'Skald'), cost: 2, go: ['s'], r: 2, art: 'sHarp', bg: '#3a2a4a' },
    saga: { n: L2('Heldensaga', 'Hero Saga'), cost: 9, go: [], r: 1, buy: { vp: 1 }, art: 'sTree', bg: '#1f3a22' },
    // Markt
    schildmaid: { n: L2('Schildmaid', 'Shieldmaiden'), cost: 3, f: 'w', go: ['k', 'w'], s: { troop: 1 }, r: 1, st: 1, art: 'sFame', bg: '#4a1f33', x: 3 },
    runenschmied: { n: L2('Runenschmied', 'Rune Smith'), cost: 4, f: 'z', go: ['z', 's'], s: { eisen: 2 }, r: 2, art: 'sHammer', bg: '#3a2216', x: 2 },
    raben: { n: L2('Odins Raben', "Odin's Ravens"), cost: 5, f: 'a', go: ['a', 's', 'k'], s: { draw: 1 }, r: 3, art: 'sRaven', bg: '#23365a', x: 2 },
    berserker: { n: L2('Berserker', 'Berserker'), cost: 3, go: ['k'], s: { troop: 1 }, st: 3, art: 'sAxe', bg: '#5a1f18', x: 3 },
    seherin: { n: L2('Seherin', 'Seeress'), cost: 4, f: 'a', go: ['a', 'w'], s: { list: 1 }, r: 2, art: 'sEye', bg: '#2a2a5a', x: 2 },
    frostriese: { n: L2('Frostriese', 'Frost Giant'), cost: 5, f: 'r', go: ['r', 'k'], s: { troop: 2 }, r: 1, st: 3, art: 'sMount', bg: '#1f3a44', x: 2 },
    haendler: { n: L2('Händler', 'Trader'), cost: 2, go: ['s', 'z'], s: { silber: 1 }, r: 1, t: { silber: 1 }, art: 'sCoin', bg: '#4a3a1a', x: 3 },
    braumeister: { n: L2('Braumeisterin', 'Brewmistress'), cost: 3, go: ['s', 'r'], s: { met: 1 }, r: 2, art: 'sHorn', bg: '#4a3216', x: 2 },
    walkuere: { n: L2('Walküre', 'Valkyrie'), cost: 6, f: 'w', go: ['w', 'k', 'a'], s: { troop: 1, draw: 1 }, r: 2, st: 2, art: 'sWing', bg: '#4a1f33', x: 2 },
    zwergenkoenig: { n: L2('Zwergenkönig', 'Dwarf King'), cost: 6, f: 'z', go: ['z'], s: { silber: 2, inf: 'z' }, r: 3, art: 'sCrown', bg: '#3a2216', x: 1 },
    jarl: { n: L2('Jarl', 'Jarl'), cost: 4, go: ['s', 'k'], s: { troop: 1, silber: 1 }, r: 2, st: 1, art: 'sHelm', bg: '#3a2a1a', x: 3 },
    thor: { n: L2('Thors Hammer', "Thor's Hammer"), cost: 7, f: 'a', go: ['a', 'k'], s: { troop: 2 }, r: 1, st: 5, art: 'sHammer', bg: '#23365a', x: 1 },
    loki: { n: L2('Lokis List', "Loki's Trick"), cost: 4, f: 'r', go: ['r', 'a', 's'], s: { list: 1, silber: 1 }, r: 2, art: 'sSnake', bg: '#1f3a2a', x: 2 },
    eisbrecher: { n: L2('Eisbrecher', 'Icebreaker'), cost: 3, f: 'r', go: ['r', 's'], s: { eisen: 1, met: 1 }, r: 1, st: 1, art: 'sShip', bg: '#1f3a44', x: 2 },
    goldschmied: { n: L2('Goldschmiedin', 'Goldsmith'), cost: 5, f: 'z', go: ['z', 's'], s: { silber: 2 }, r: 2, t: { silber: 2 }, art: 'sCoin', bg: '#4a3a1a', x: 2 },
    freya: { n: L2('Freyas Gunst', "Freya's Favour"), cost: 7, f: 'w', go: ['w', 'a', 'r', 'z'], s: { inf: 'any', draw: 1 }, r: 3, art: 'sWing', bg: '#5a2a44', x: 1 },
    einherjer: { n: L2('Einherjer', 'Einherjar'), cost: 5, f: 'w', go: ['w', 'k'], s: { troop: 2 }, r: 1, st: 4, art: 'sSword', bg: '#4a1f33', x: 2 },
    weltenbaum: { n: L2('Hüter der Esche', 'Ash Warden'), cost: 8, f: 'a', go: ['a'], s: { inf: 'a', list: 1 }, r: 4, buy: { vp: 1 }, art: 'sTree', bg: '#1f3a22', x: 1 },
    bergwerk: { n: L2('Bergarbeiter', 'Miner'), cost: 2, f: 'z', go: ['z', 'k'], s: { eisen: 1 }, r: 1, art: 'sIron', bg: '#2a2a30', x: 3 },
    fenrir: { n: L2('Fenriswolf', 'Fenrir'), cost: 6, f: 'r', go: ['r', 'k'], s: { troop: 1 }, r: 1, st: 6, art: 'sWolf', bg: '#2a2a30', x: 1 }
  };
  NW.START = ['lied', 'lied', 'axt', 'axt', 'gesandter', 'schiff', 'schiff', 'spaeher', 'eid', 'ring'];
  // Ränke: m = spielbar im eigenen Zug (Effekt), c = spielbar beim Thing mit Kriegern in der Schlacht (Stärke)
  var P = NW.PLOTS = {
    beute: { n: L2('Verborgene Beute', 'Hidden Loot'), m: { silber: 3 }, x: 3 },
    fass: { n: L2('Volles Fass', 'Full Barrel'), m: { met: 2 }, x: 2 },
    ader: { n: L2('Erzader', 'Ore Vein'), m: { eisen: 3 }, x: 2 },
    zuzug: { n: L2('Zuzug', 'Reinforcements'), m: { troop: 2 }, x: 3 },
    weisung: { n: L2('Weisung der Nornen', "Norns' Counsel"), m: { draw: 2 }, x: 2 },
    fuersprache: { n: L2('Fürsprache', 'Advocacy'), m: { inf: 'any' }, x: 2 },
    hinterhalt: { n: L2('Hinterhalt', 'Ambush'), c: 3, x: 3 },
    schildwall: { n: L2('Schildwall', 'Shield Wall'), c: 4, x: 2 },
    blutrausch: { n: L2('Blutrausch', 'Blood Frenzy'), c: 6, x: 1 }
  };
  // Schlachten: Belohnungen für Platz 1, 2, 3 (Platz 3 nur zu viert)
  NW.CONFLICTS = [
    [{ n: L2('Plünderfahrt', 'Raid'), rw: [{ silber: 4 }, { silber: 2 }, { silber: 1 }] }, { n: L2('Viehraub', 'Cattle Raid'), rw: [{ met: 2, silber: 1 }, { met: 1 }, { silber: 1 }] }, { n: L2('Grenzstreit', 'Border Feud'), rw: [{ inf: 'any' }, { eisen: 2 }, { eisen: 1 }] }, { n: L2('Zweikampf', 'Duel'), rw: [{ vp: 1 }, { list: 1 }, { silber: 1 }] }],
    [{ n: L2('Schlacht am Fjord', 'Battle of the Fjord'), rw: [{ vp: 1, silber: 2 }, { list: 1, silber: 2 }, { silber: 2 }] }, { n: L2('Sturm auf die Eisfeste', 'Storming the Ice Keep'), rw: [{ vp: 1, eisen: 2 }, { eisen: 3 }, { eisen: 1 }] }, { n: L2('Kampf um Bifröst', 'Fight for Bifrost'), rw: [{ vp: 1, inf: 'any' }, { inf: 'any' }, { met: 1 }] }, { n: L2('Blutfehde', 'Blood Feud'), rw: [{ vp: 1, troop: 2 }, { troop: 2, silber: 1 }, { troop: 1 }] }, { n: L2('Hort des Drachen', "Dragon's Hoard"), rw: [{ vp: 1, silber: 3 }, { silber: 4 }, { silber: 2 }] }, { n: L2('Wilde Jagd', 'Wild Hunt'), rw: [{ vp: 1, list: 1 }, { list: 1, met: 1 }, { met: 1 }] }],
    [{ n: L2('Götterdämmerung', 'Twilight of the Gods'), rw: [{ vp: 2 }, { vp: 1 }, { silber: 3 }] }, { n: L2('Fimbulwinter', 'Fimbulwinter'), rw: [{ vp: 2 }, { vp: 1 }, { list: 1 }] }, { n: L2('Schlacht auf Wigrid', 'Battle of Vigrid'), rw: [{ vp: 2, silber: 2 }, { vp: 1 }, { eisen: 2 }] }]
  ];
  NW.ROUNDS = 10; NW.GOAL = 10;
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  NW.setup = function (seats, opts) {
    var n = seats.length, md = [], pd = [], cd = [];
    Object.keys(C).forEach(function (id) { for (var i = 0; i < (C[id].x || 0); i++) md.push(id); });
    Object.keys(P).forEach(function (id) { for (var i = 0; i < P[id].x; i++) pd.push(id); });
    var c0 = shuffle(NW.CONFLICTS[0]).slice(0, 2), c1 = shuffle(NW.CONFLICTS[1]).slice(0, 5), c2 = shuffle(NW.CONFLICTS[2]).slice(0, 3);
    cd = c0.concat(c1, c2);
    var g = { seats: seats, opts: opts || {}, log: [], round: 0, first: Math.floor(Math.random() * n), cur: 0, mdeck: shuffle(md), market: [], pdeck: shuffle(pd), pdisc: [], cdeck: cd, conflict: null, occ: {}, ally: { a: null, r: null, z: null, w: null }, over: null, seq: 0, last: null,
      pl: seats.map(function () { return { deck: shuffle(NW.START), hand: [], disc: [], play: [], agents: 2, left: 2, res: { met: 1, eisen: 0, silber: 0 }, troops: 3, conf: 0, swords: 0, bonus: 0, ruhm: 0, extraRuhm: 0, inf: { a: 0, r: 0, z: 0, w: 0 }, vp: 0, plots: [], revealed: false, bought: 0 }; }) };
    while (g.market.length < 5) g.market.push(g.mdeck.pop());
    NW.startRound(g); return g;
  };
  NW.draw = function (g, p, n) { var q = g.pl[p]; for (var i = 0; i < n; i++) { if (!q.deck.length) { if (!q.disc.length) return; q.deck = shuffle(q.disc); q.disc = []; } q.hand.push(q.deck.pop()); } };
  NW.startRound = function (g) {
    g.round++; g.occ = {}; g.conflict = g.cdeck[g.round - 1]; g.cur = g.first;
    g.pl.forEach(function (q, p) { q.left = q.agents; q.conf = 0; q.swords = 0; q.bonus = 0; q.ruhm = 0; q.extraRuhm = 0; q.revealed = false; NW.draw(g, p, 5 - q.hand.length); });
  };
  NW.addInf = function (g, p, f, n) {
    var q = g.pl[p], b = q.inf[f]; q.inf[f] = Math.min(6, b + n); var a = q.inf[f];
    if (b < 2 && a >= 2) q.vp++;
    if (a >= 4) { var h = g.ally[f]; if (h === null || (h !== p && a > g.pl[h].inf[f])) { if (h !== null) g.pl[h].vp--; g.ally[f] = p; q.vp++; } }
  };
  NW.bestInf = function (g, p) {      // "Einfluss nach Wahl": dorthin, wo der nächste Siegpunkt am nächsten ist
    var q = g.pl[p], best = 'a', bs = -1;
    'arzw'.split('').forEach(function (f) { var v = q.inf[f], s = v === 1 ? 10 : v === 3 && (g.ally[f] === null || g.pl[g.ally[f]].inf[f] < 4) ? 9 : v === 0 ? 5 : v >= 6 ? -1 : (g.ally[f] !== null && g.ally[f] !== p && g.pl[g.ally[f]].inf[f] === v) ? 8 : 3 - v * .1; if (s > bs) { bs = s; best = f; } });
    return best;
  };
  NW.gain = function (g, p, e, info) {      // Effekt anwenden; info sammelt neu rekrutierte Krieger
    var q = g.pl[p]; if (!e) return;
    if (e.met) q.res.met += e.met; if (e.eisen) q.res.eisen += e.eisen; if (e.silber) q.res.silber += e.silber;
    if (e.troop) { q.troops += e.troop; if (info) info.newTroops = (info.newTroops || 0) + e.troop; }
    if (e.draw) NW.draw(g, p, e.draw);
    if (e.list) for (var i = 0; i < e.list; i++) { if (!g.pdeck.length) { g.pdeck = shuffle(g.pdisc); g.pdisc = []; } if (g.pdeck.length) q.plots.push(g.pdeck.pop()); }
    if (e.vp) q.vp += e.vp;
    if (e.inf) NW.addInf(g, p, e.inf === 'any' ? NW.bestInf(g, p) : e.inf, 1);
    if (e.ruhm) q.extraRuhm += e.ruhm;
    if (e.agent) { q.agents = 3; q.left++; }
  };
  var canPay = function (q, c) { for (var k in c) if (q.res[k] < c[k]) return false; return true; };
  // mögliche Einsätze: [{c: Handindex, sp: Feld, max: höchstens so viele Krieger in die Schlacht}]
  NW.agentMoves = function (g, p) {
    var q = g.pl[p], out = []; if (q.revealed || q.left <= 0) return out;
    var seen = {};
    q.hand.forEach(function (id, i) {
      if (seen[id]) return; seen[id] = 1; var cd = C[id];
      NW.SPACES.forEach(function (s) {
        if (cd.go.indexOf(s.t) < 0 || g.occ[s.id] != null || !canPay(q, s.c)) return;
        if (s.e.agent && q.agents >= 3) return;
        var nt = (s.e.troop || 0) + ((cd.s && cd.s.troop) || 0);
        out.push({ c: i, sp: s.id, max: s.k ? Math.min(q.troops + nt, nt + 2) : 0 });
      });
    });
    return out;
  };
  NW.doAgent = function (g, p, a) {
    var q = g.pl[p], id = q.hand.splice(a.c, 1)[0], cd = C[id], s = NW.SP[a.sp], info = {};
    for (var k in s.c) q.res[k] -= s.c[k];
    g.occ[s.id] = p; q.left--; q.play.push(id);
    NW.gain(g, p, s.e, info); NW.gain(g, p, cd.s, info);
    if (s.f) NW.addInf(g, p, s.f, 1);
    var dep = 0; if (s.k) { dep = Math.max(0, Math.min(a.dep | 0, q.troops, (info.newTroops || 0) + 2)); q.troops -= dep; q.conf += dep; }
    g.seq++; g.last = { p: p, sp: s.id, card: id, seq: g.seq };
    return { card: id, space: s, dep: dep };
  };
  NW.doReveal = function (g, p) {
    var q = g.pl[p], r = q.extraRuhm, st = 0;
    q.hand.forEach(function (id) { var cd = C[id]; r += cd.r || 0; st += cd.st || 0; if (cd.t) NW.gain(g, p, cd.t); });
    q.ruhm = r; q.swords = st; q.revealed = true; q.play = q.play.concat(q.hand); q.hand = [];
    g.seq++; g.last = { p: p, reveal: 1, seq: g.seq };
    return { ruhm: r, st: st };
  };
  NW.strength = function (g, p) { var q = g.pl[p]; return q.conf > 0 ? q.conf * 2 + q.swords + q.bonus : 0; };
  NW.buyOpts = function (g, p) {
    var q = g.pl[p], out = [];
    g.market.forEach(function (id, i) { if (id && C[id].cost <= q.ruhm) out.push({ m: i, id: id }); });
    if (C.skalde.cost <= q.ruhm) out.push({ m: 'skalde', id: 'skalde' });
    if (C.saga.cost <= q.ruhm) out.push({ m: 'saga', id: 'saga' });
    return out;
  };
  NW.doBuy = function (g, p, m) {
    var q = g.pl[p], id = typeof m === 'number' ? g.market[m] : m, cd = C[id];
    q.ruhm -= cd.cost; q.disc.push(id); q.bought++;
    if (typeof m === 'number') g.market[m] = g.mdeck.length ? g.mdeck.pop() : null;
    if (cd.buy) NW.gain(g, p, cd.buy);
    if (cd.f) { /* gekaufte Karten einer Macht geben keinen Einfluss, das machen nur Felder */ }
    return id;
  };
  NW.plotOpts = function (g, p, mode) {      // mode: 'main' (eigener Zug) oder 'thing' (nach dem Aufdecken)
    var q = g.pl[p], out = [];
    q.plots.forEach(function (id, i) { var d = P[id]; if (d.m && mode === 'main') out.push(i); if (d.c && mode === 'thing' && q.conf > 0) out.push(i); });
    return out;
  };
  NW.doPlot = function (g, p, i) {
    var q = g.pl[p], id = q.plots.splice(i, 1)[0], d = P[id]; g.pdisc.push(id);
    if (d.m) NW.gain(g, p, d.m); if (d.c) q.bonus += d.c;
    return id;
  };
  // Rundenende: Schlacht werten, aufräumen. Rückgabe: Ergebnisliste für Anzeige und Protokoll
  NW.endRound = function (g) {
    var n = g.pl.length, st = g.pl.map(function (_, p) { return NW.strength(g, p); }), res = [], rw = g.conflict.rw;
    var order = st.map(function (v, p) { return { p: p, v: v }; }).filter(function (o) { return o.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var place = 0, i = 0;
    while (i < order.length && place < (n >= 4 ? 3 : 2)) {
      var grp = order.filter(function (o) { return o.v === order[i].v; });
      var slot = grp.length > 1 ? place + 1 : place;      // Gleichstand: alle bekommen die nächstniedrigere Belohnung
      if (slot < (n >= 4 ? 3 : 2)) grp.forEach(function (o) { NW.gain(g, o.p, rw[slot]); res.push({ p: o.p, place: slot, v: o.v, tie: grp.length > 1 }); });
      place += grp.length; i += grp.length;
    }
    g.pl.forEach(function (q) { q.disc = q.disc.concat(q.play, q.hand); q.play = []; q.hand = []; q.conf = 0; q.swords = 0; q.bonus = 0; });
    var out = { st: st, res: res, conflict: g.conflict };
    var top = Math.max.apply(null, g.pl.map(function (q) { return q.vp; }));
    if (top >= NW.GOAL || g.round >= NW.ROUNDS) {
      var best = -1, bw = -1; g.pl.forEach(function (q, p) { var sc = q.vp * 1000 + q.res.silber + q.res.eisen + q.res.met; if (sc > best) { best = sc; bw = p; } });
      g.over = { w: bw };
    } else { g.first = (g.first + 1) % n; NW.startRound(g); }
    return out;
  };
  NW.nextPlayer = function (g) {      // nächster, der noch nicht aufgedeckt hat; -1 = alle fertig
    var n = g.pl.length; for (var k = 1; k <= n; k++) { var p = (g.cur + k) % n; if (!g.pl[p].revealed) return p; } return -1;
  };
  // ---------- Computer ----------
  var W = { met: 1.7, eisen: 1.3, silber: 1.15, troop: 1.9, draw: 2.3, list: 3, vp: 14, ruhm: 1.4, agent: 0 };
  NW.infVal = function (g, p, f) { var q = g.pl[p], v = q.inf[f] + 1, s = 2.5; if (v === 2) s += 12; if (v >= 4 && (g.ally[f] === null || (g.ally[f] !== p && g.pl[g.ally[f]].inf[f] < v))) s += 12; return v > 6 ? 0 : s; };
  NW.effVal = function (g, p, e) {
    if (!e) return 0; var q = g.pl[p], s = 0;
    for (var k in e) { if (k === 'inf') s += NW.infVal(g, p, e.inf === 'any' ? NW.bestInf(g, p) : e.inf); else if (k === 'agent') s += g.round <= 6 ? 16 - g.round * 1.5 : 3; else s += (W[k] || 0) * e[k]; }
    if (e.silber && q.agents < 3 && q.res.silber < 6) s += e.silber * .6;
    return s;
  };
  NW.rewardVal = function (g, p, slot) { return NW.effVal(g, p, g.conflict.rw[slot]); };
  NW.aiMain = function (g, p) {
    var q = g.pl[p], po = NW.plotOpts(g, p, 'main'); if (po.length) return { t: 'plot', i: po[0] };
    var mv = NW.agentMoves(g, p), best = null, bs = 2.2;
    var others = Math.max.apply(null, g.pl.map(function (_, o) { return o === p ? 0 : NW.strength(g, o); }));
    mv.forEach(function (m) {
      var cd = C[q.hand[m.c]], s = NW.SP[m.sp], v = NW.effVal(g, p, s.e) + NW.effVal(g, p, cd.s) - (s.c.met || 0) * W.met - (s.c.eisen || 0) * W.eisen - (s.c.silber || 0) * W.silber * (s.e.agent ? .3 : 1);
      if (s.f) v += NW.infVal(g, p, s.f);
      v -= (cd.r || 0) * 1.5 + (cd.st || 0) * (q.conf > 0 || s.k ? 1.1 : .3);
      var dep = 0;
      if (s.k && m.max > 0) { var mine = NW.strength(g, p), want = NW.rewardVal(g, p, 0); dep = want >= 10 || mine + m.max * 2 > others ? m.max : Math.min(m.max, 1); if (g.round >= 8) dep = m.max; v += dep * .8 + (mine + dep * 2 > others ? want * .35 : 1); }
      v += Math.random() * 1.2;
      if (v > bs) { bs = v; best = { t: 'agent', c: m.c, sp: m.sp, dep: dep }; }
    });
    return best || { t: 'reveal' };
  };
  NW.aiThing = function (g, p) {
    var q = g.pl[p], po = NW.plotOpts(g, p, 'thing');
    if (po.length) { var mine = NW.strength(g, p), top = Math.max.apply(null, g.pl.map(function (_, o) { return o === p ? 0 : NW.strength(g, o); })); if (mine <= top + 1 && mine + P[q.plots[po[0]]].c >= top) return { t: 'plot', i: po[0] }; }
    var bo = NW.buyOpts(g, p); if (!bo.length) return { t: 'done' };
    bo.sort(function (a, b) { var ca = C[a.id], cb = C[b.id]; return (cb.cost + (cb.buy ? 6 : 0) + (cb.id === 'skalde' ? -1 : 0)) - (ca.cost + (ca.buy ? 6 : 0)); });
    if (bo[0].id === 'skalde' && q.bought > 7) return { t: 'done' };
    return { t: 'buy', m: bo[0].m };
  };
  NW.validMain = function (g, p, a) {
    if (!a) return false;
    if (a.t === 'reveal') return !g.pl[p].revealed;
    if (a.t === 'plot') return NW.plotOpts(g, p, 'main').indexOf(a.i) >= 0;
    if (a.t === 'agent') { var q = g.pl[p], id = q.hand[a.c]; return NW.agentMoves(g, p).some(function (m) { return q.hand[m.c] === id && m.sp === a.sp && (a.dep | 0) >= 0 && (a.dep | 0) <= m.max; }); }
    return false;
  };
  NW.validThing = function (g, p, a) {
    if (!a) return false; if (a.t === 'done') return true;
    if (a.t === 'plot') return NW.plotOpts(g, p, 'thing').indexOf(a.i) >= 0;
    if (a.t === 'buy') return NW.buyOpts(g, p).some(function (o) { return o.m === a.m; });
    return false;
  };
  root.NW = NW; if (typeof module !== 'undefined') module.exports = NW;
})(typeof window !== 'undefined' ? window : globalThis);

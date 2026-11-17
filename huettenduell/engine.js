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
    hoard: ['Sammler', '🎒', 'Beim Ausspielen kommt eine Karte aus dem Wald auf die Hand.'],
    lives: ['Neun Leben', '❤️', 'Als Opfer stirbt sie nicht gleich: Sie verliert nur ein Leben. Im Kampf kehrt sie mit einem Leben weniger auf die Hand zurück.'],
    dam: ['Dammbauer', '🪵', 'Beim Ausspielen entsteht in jeder freien Nachbarbahn ein Damm (0/2).'],
    submerge: ['Abtauchen', '🌊', 'Taucht während des Gegnerzugs ab: Angriffe gehen an ihr vorbei auf die Waage.'],
    ant: ['Ameise', '🐜', 'Der Angriff entspricht der Zahl deiner Ameisen auf dem Feld.'],
    hefty: ['Wuchtig', '🦬', 'Am Zugende bewegt sie sich samt den Nachbarkarten in ihre Richtung und schiebt andere Karten mit.'],
    double: ['Doppelhieb', '🗡️', 'Greift in jedem Angriff zweimal an.'],
    digger: ['Knochengräber', '⛏️', 'Am Zugende erzeugt sie 1 Knochen.'],
    reborn: ['Wiedergeburt', '♻️', 'Beim Tod kehrt sie mit +1 Angriff und +1 Leben auf die Hand zurück.'],
    nosac: ['Nicht opferbar', '🚫', 'Diese Karte kann nicht geopfert werden.'],
    frozen: ['Eingefroren', '🧊', 'Beim Tod erscheint an ihrer Stelle ein Opossum.'],
    leader: ['Anführer', '📣', 'Karten auf den Nachbarbahnen erhalten +1 Angriff.'],
    stinky: ['Gestank', '🦨', 'Die gegenüberliegende Karte verliert 1 Angriff.'],
    boneking: ['Knochenkönig', '🦴', 'Beim Tod gibt sie 4 Knochen statt 1.'],
    rabbit: ['Kaninchenloch', '🕳️', 'Beim Ausspielen kommt ein Kaninchen auf die Hand.'],
    antspawn: ['Ameisenzüchter', '🏺', 'Beim Ausspielen kommt eine Arbeiterameise auf die Hand.'],
    bees: ['Bienenschwarm', '🐝', 'Wird sie getroffen, kommt eine Biene auf die Hand.'],
    trinket: ['Krämer', '🧳', 'Beim Ausspielen erhältst du einen Gegenstand.'],
    handy: ['Handvoll', '🖐️', 'Der Angriff entspricht der Zahl deiner Handkarten.'],
    mirror: ['Spiegelbild', '🪞', 'Der Angriff entspricht dem Angriff der gegenüberliegenden Karte (0 ohne Gegner).'],
    tail: ['Abgeworfener Schwanz', '🦎', 'Wird sie angegriffen, bleibt ein Schwanz (0/2) zurück und sie weicht in eine freie Nachbarbahn aus (einmal).']
  };
  // Karten: Name, Angriff, Leben, Kosten {b: Opfer, o: Knochen}, Fähigkeiten, Symbol, Entwicklung
  // Kartenwerte nach dem Inscryption-Wiki (Akt I): Name, Angriff, Leben, Kosten {b: Blut, o: Knochen}, Fähigkeiten, Symbol, Entwicklung
  var C = {
    squirrel: ['Eichhörnchen', 0, 1, {}, [], '🐿️'],
    stoat: ['Hermelin', 1, 3, { b: 1 }, [], '🦡'],
    wolf_cub: ['Wolfswelpe', 1, 1, { b: 1 }, ['fledge'], '🐺', 'wolf'],
    wolf: ['Wolf', 3, 2, { b: 2 }, [], '🐺'],
    stunted: ['Verkümmerter Wolf', 2, 2, { b: 1 }, [], '🐺'],
    coyote: ['Kojote', 2, 1, { o: 4 }, [], '🦊'],
    hound: ['Bluthund', 2, 3, { b: 2 }, ['guard'], '🐕'],
    alpha: ['Alphawolf', 1, 2, { o: 4 }, ['leader'], '🐺'],
    direwolf: ['Schreckenswolf', 2, 5, { b: 3 }, ['double'], '🐺'],
    direpup: ['Schreckenswolf-Welpe', 1, 1, { b: 2 }, ['digger', 'fledge'], '🐺', 'direwolf'],
    raven_egg: ['Rabenei', 0, 2, { b: 1 }, ['fledge'], '🥚', 'raven'],
    raven: ['Rabe', 2, 3, { b: 2 }, ['airborne'], '🐦‍⬛'],
    sparrow: ['Spatz', 1, 2, { b: 1 }, ['airborne'], '🐦'],
    magpie: ['Elster', 1, 1, { b: 2 }, ['airborne', 'hoard'], '🐦‍⬛'],
    kingfisher: ['Eisvogel', 1, 1, { b: 1 }, ['airborne', 'submerge'], '🐦'],
    vulture: ['Truthahngeier', 3, 3, { o: 8 }, ['airborne'], '🦅'],
    elk_fawn: ['Elchkalb', 1, 1, { b: 1 }, ['sprint', 'fledge'], '🦌', 'elk'],
    elk: ['Elch', 2, 4, { b: 2 }, ['sprint'], '🫎'],
    pronghorn: ['Gabelbock', 1, 3, { b: 2 }, ['sprint', 'bi'], '🦌'],
    moose: ['Elchbulle', 3, 7, { b: 3 }, ['hefty'], '🫎'],
    goat: ['Schwarze Ziege', 0, 1, { b: 1 }, ['worthy'], '🐐'],
    mantis: ['Fangschrecke', 1, 1, { b: 1 }, ['bi'], '🦗'],
    mantis_god: ['Mantisgott', 1, 1, { b: 1 }, ['tri'], '🦗'],
    hive: ['Bienenstock', 0, 2, { b: 1 }, ['bees'], '🐝'],
    ant: ['Arbeiterameise', 0, 2, { b: 1 }, ['ant'], '🐜'],
    ant_queen: ['Ameisenkönigin', 0, 3, { b: 2 }, ['ant', 'antspawn'], '🐜'],
    stinkbug: ['Stinkwanze', 1, 2, { o: 2 }, ['stinky'], '🪲'],
    cockroach: ['Kakerlake', 1, 1, { o: 4 }, ['unkill'], '🪳'],
    ringworm: ['Ringwurm', 0, 1, { b: 1 }, [], '🪱'],
    frog: ['Ochsenfrosch', 1, 2, { b: 1 }, ['leap'], '🐸'],
    skink: ['Skink', 1, 2, { b: 1 }, ['tail'], '🦎'],
    adder: ['Kreuzotter', 1, 1, { b: 2 }, ['death'], '🐍'],
    snapper: ['Schnappschildkröte', 1, 6, { b: 2 }, [], '🐢'],
    rattler: ['Klapperschlange', 3, 1, { o: 6 }, [], '🐍'],
    ouro: ['Ouroboros', 1, 1, { b: 2 }, ['reborn'], '🐍'],
    mole: ['Maulwurf', 0, 4, { b: 1 }, ['burrow'], '🐀'],
    mole_man: ['Maulwurfsmann', 0, 6, { b: 1 }, ['leap', 'burrow'], '🐹'],
    packrat: ['Packratte', 2, 2, { b: 2 }, ['trinket'], '🐀'],
    porcupine: ['Stachelschwein', 1, 2, { b: 1 }, ['quills'], '🦔'],
    mice: ['Feldmäuse', 2, 2, { b: 2 }, ['fecund'], '🐁'],
    cat: ['Katze', 0, 1, { b: 1 }, ['lives'], '🐈'],
    beaver: ['Biber', 1, 4, { b: 2 }, ['dam'], '🦫'],
    otter: ['Fischotter', 1, 1, { b: 1 }, ['submerge'], '🦦'],
    shark: ['Weißer Hai', 4, 2, { b: 3 }, ['submerge'], '🦈'],
    grizzly: ['Grizzly', 4, 6, { b: 3 }, [], '🐻'],
    opossum: ['Opossum', 1, 1, { o: 2 }, [], '🐁'],
    ratking: ['Rattenkönig', 2, 1, { b: 2 }, ['boneking'], '🐀'],
    skunk: ['Stinktier', 0, 3, { b: 1 }, ['stinky'], '🦨'],
    warren: ['Kaninchenbau', 0, 2, { b: 1 }, ['rabbit'], '🐇'],
    bat: ['Fledermaus', 2, 1, { o: 4 }, ['airborne'], '🦇'],
    handtent: ['Handtentakel', 0, 1, { b: 1 }, ['handy'], '🐙'],
    mirrortent: ['Spiegeltentakel', 0, 3, { b: 1 }, ['mirror'], '🐙'],
    long_elk: ['Langer Elch', 1, 2, { o: 4 }, ['sprint', 'death'], '🦌'],
    amalgam: ['Amalgam', 3, 3, { b: 2 }, [], '🧬'],
    geck: ['Gecko', 1, 1, {}, [], '🦎'],
    urayuli: ['Urayuli', 7, 7, { b: 4 }, [], '🦣'],
    // Marken und Sonderkarten
    pelt_rabbit: ['Kaninchenfell', 0, 1, {}, [], '🐰'],
    pelt_wolf: ['Wolfsfell', 0, 2, {}, [], '🐺'],
    pelt_gold: ['Goldenes Fell', 0, 3, {}, [], '🏅'],
    boulder: ['Felsbrocken', 0, 5, {}, ['nosac'], '🪨'],
    frozen_opossum: ['Eis-Opossum', 0, 5, {}, ['nosac', 'frozen'], '🧊'],
    skeleton: ['Skelett', 1, 1, {}, [], '💀'],
    rabbit: ['Kaninchen', 0, 1, {}, [], '🐇'],
    bee: ['Biene', 1, 1, {}, ['airborne'], '🐝'],
    smoke: ['Großer Rauch', 1, 3, {}, ['boneking'], '🌫️'],
    starvation: ['Hunger', 1, 1, {}, [], '🍖'],
    death: ['Todeskarte', 1, 1, { b: 1 }, [], '💀'],
    dam: ['Damm', 0, 2, {}, [], '🪵'],
    skink_tail: ['Schwanz', 0, 2, {}, [], '🦎']
  };
  // Opfer-Tier (Waldstapel)
  HD.CARDS = {}; Object.keys(C).forEach(function (id) { var c = C[id]; HD.CARDS[id] = { id: id, n: c[0], atk: c[1], hp: c[2], cost: c[3], sig: c[4], art: c[5], evo: c[6] || null }; });
  // Bosse: besondere Regeln für den Gegner (Spieler 1)
  HD.BOSS = {
    pack: ['Rudelruf', 'Stirbt eine seiner Karten, schließt sich ein Elchkalb dem Rudel an (einmal pro Zug). Ab 3 Punkten Rückstand ruft er zwei Karten pro Zug.'],
    curse: ['Moorfluch', 'Zu Beginn ihres Zuges verliert deine stärkste Karte 1 Leben. Ab 3 Punkten Rückstand legt sie zusätzlich eine Kreuzotter nach.'],
    necro: ['Totenbeschwörung', 'Stirbt eine seiner Karten, steht an derselben Stelle ein Skelett auf (einmal pro Karte).']
  };
  var uid = 1;
  // Nach dem Laden eines Spielstands (Host-Wechsel): Kartennummern fortsetzen
  HD.sync = function (G) { var m = 0; G.p.forEach(function (P) { [].concat(P.deck, P.side, P.hand, P.board, P.queue).forEach(function (c) { if (c && c.uid > m) m = c.uid; }); }); if (m >= uid) uid = m + 1; };
  HD.make = function (x) { var up = typeof x === 'object' ? x : { id: x }, id = up.id, d = HD.CARDS[id], c = { id: id, uid: uid++, n: d.n, atk: d.atk, hp: d.hp, max: d.hp, sig: d.sig.slice(), art: d.art, cost: d.cost, age: 0, dir: 1, lives: d.sig.indexOf('lives') >= 0 ? 9 : 1, sub: false, up: up.a || up.h ? { a: up.a || 0, h: up.h || 0 } : null }; if (up.dc) { var dc = up.dc; c.n = dc.n; c.atk = dc.atk; c.hp = dc.hp; c.sig = dc.sig.slice(); c.art = dc.art; c.cost = dc.cost; c.max = c.hp; c.dead = true; }
    if (c.up) { c.atk += c.up.a; c.hp += c.up.h; c.max = c.hp; } if (up.xs) up.xs.forEach(function (k) { if (c.sig.indexOf(k) < 0) c.sig.push(k); }); if (up.xs && up.xs.length) c.xs = up.xs.slice(); c.base = c.atk; return c; };
  HD.TOKENS = { dam: 1, skink_tail: 1, squirrel: 1, skeleton: 1, death: 1, rabbit: 1, bee: 1, smoke: 1, starvation: 1, pelt_rabbit: 1, pelt_wolf: 1, pelt_gold: 1, boulder: 1, frozen_opossum: 1 };
  function dies(c) { return !(HD.has(c, 'lives') && c.lives > 1); }
  // Angriffswerte neu berechnen: Ameisen, Handvoll, Spiegelbild, Anführer (Nachbarn +1) und Gestank (-1)
  HD.refresh = function (G) {
    for (var s = 0; s < 2; s++) {
      var P = G.p[s], O = G.p[1 - s], b = P.board, ants = 0, i, j;
      for (i = 0; i < LANES; i++) if (HD.has(b[i], 'ant')) ants++;
      for (i = 0; i < LANES; i++) {
        var c = b[i]; if (!c) continue; var a = c.base != null ? c.base : c.atk, e = O.board[i];
        if (HD.has(c, 'ant')) a = ants; if (HD.has(c, 'handy')) a = P.hand.length; if (HD.has(c, 'mirror')) a = e ? (e.base != null ? e.base : e.atk) : 0;
        [i - 1, i + 1].forEach(function (k) { if (k >= 0 && k < LANES && HD.has(b[k], 'leader')) a++; });
        if (e && HD.has(e, 'stinky')) a--;
        c.atk = Math.max(0, a);
      }
    }
  };
  // ---------- Gegenstände (Regelbuch: Wer genau 4 Punkte im Rückstand ist, erhält einen Gegenstand) ----------
  HD.ITEMS = {
    pliers: ['Zange', '🔧', 'Du erhältst 1 Punkt auf der Waage.', 0],
    scissors: ['Schere', '✂️', 'Tötet eine gegnerische Karte deiner Wahl.', 'e'],
    hourglass: ['Sanduhr', '⏳', 'Der Gegner überspringt seinen nächsten Zug.', 0],
    fan: ['Harpyienfächer', '🪶', 'Alle deine Karten greifen in diesem Zug mit Flug an.', 0],
    hook: ['Angelhaken', '🪝', 'Nimm eine gegnerische Karte auf eine freie Bahn deiner Seite.', 'h'],
    sbottle: ['Flasche mit Eichhörnchen', '🍶', 'Ein Eichhörnchen kommt auf deine Hand.', 0],
    gbottle: ['Flasche mit Ziege', '🍶', 'Eine Schwarze Ziege kommt auf deine Hand.', 0],
    bbottle: ['Flasche mit Felsbrocken', '🍶', 'Ein Felsbrocken (0/5) kommt auf deine Hand.', 0],
    obottle: ['Flasche mit Eis-Opossum', '🍶', 'Ein Eis-Opossum (0/5) kommt auf deine Hand.', 0],
    bank: ['Sparschwein', '🐷', 'Du erhältst sofort 4 Knochen.', 0]
  };
  function giveItem(G, p) {
    if (G.npc && p === 1) return; if (!G.itemPile || !G.itemPile.length || G.p[p].items.length >= 3) return;      // Wiki: höchstens drei Gegenstände
    var id = G.itemPile.pop(); G.p[p].items.push(id);
  }
  HD.giveItem = giveItem;
  function scaleTick(G) {
    var d = HD.diff(G); if (G.lastDiff === d) return; G.lastDiff = d;
    if (d === 4) giveItem(G, 1); else if (d === -4) giveItem(G, 0);
  }
  // Gegenstand idx von Spieler s benutzen; t = { l: Bahn des Gegners, to: eigene freie Bahn }. Gibt null oder einen Fehlertext zurück.
  HD.useItem = function (G, s, idx, t) {
    var P = G.p[s], O = G.p[1 - s], id = P.items[idx]; t = t || {};
    if (!id) return 'Kein Gegenstand'; if (G.over !== null) return 'Spiel vorbei'; if (G.turn !== s || (G.phase !== 'main' && G.phase !== 'draw')) return 'Nicht am Zug';
    if (id === 'scissors') { if (!O.board[t.l]) return 'Kein Ziel'; kill(G, 1 - s, t.l); }
    else if (id === 'hook') { if (!O.board[t.l] || t.to == null || P.board[t.to]) return 'Kein Ziel'; P.board[t.to] = O.board[t.l]; O.board[t.l] = null; P.board[t.to].age = 0; onEnter(G, s, t.to); }
    else if (id === 'pliers') { P.dmg++; }
    else if (id === 'hourglass') O.skip = true;
    else if (id === 'fan') P.fan = true;
    else if (id === 'bbottle') P.hand.push(HD.make('boulder'));
    else if (id === 'obottle') P.hand.push(HD.make('frozen_opossum'));
    else if (id === 'sbottle') P.hand.push(HD.make('squirrel'));
    else if (id === 'gbottle') P.hand.push(HD.make('goat'));
    else if (id === 'bank') P.bones += 4;
    P.items.splice(idx, 1); G.itemPile.unshift(id); HD.refresh(G); check(G); return null;
  };
  HD.has = function (c, s) { return c && c.sig.indexOf(s) >= 0; };
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd || Math.random)() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  HD.shuffle = shuffle;
  // opts: { decks:[[id..],[id..]], npc: true|false, rnd }
  HD.newGame = function (opts) {
    var rnd0 = opts.rnd || Math.random, G = { p: [], turn: 0, n: 0, phase: 'draw', over: null, npc: !!opts.npc, rnd: opts.rnd, log: [], win: opts.win || WIN, hard: !!opts.hard, boss: opts.boss || null, bossRisen: 0, lastDiff: 0, itemPile: [] };
    Object.keys(HD.ITEMS).forEach(function (k) { G.itemPile.push(k, k); }); shuffle(G.itemPile, opts.rnd || Math.random);
    for (var s = 0; s < 2; s++) {
      var deck = shuffle(opts.decks[s].map(function (x) { return HD.make(x); }), rnd0), side = []; for (var i = 0; i < 10; i++) side.push(HD.make('squirrel'));      // begrenzter Opfer-Vorrat: Jedes Eichhörnchen zählt
      var P = { deck: deck, side: side, hand: [], board: [null, null, null, null], queue: [null, null, null, null], bones: 0, dmg: 0, drew: false, lives: opts.lives || 1, first: true, skip: false, fan: false, items: [], dead: [] };
      G.p.push(P);
      for (var h = 0; h < 3; h++) if (P.deck.length) P.hand.push(P.deck.pop());
      P.hand.push(side.pop());
    }
    return G;
  };
  HD.diff = function (G) { return G.p[0].dmg - G.p[1].dmg; };
  // Waage prüfen: Bei 5 (bzw. G.win) Punkten Vorsprung verliert der andere ein Leben. Gewinner = G.over; ist ihm kein Leben mehr übrig, ist das Spiel aus (HD.matchOver).
  function check(G) {
    if (G.over !== null) return true; var d = HD.diff(G); scaleTick(G);
    if (d >= G.win) { G.p[1].lives--; G.over = 0; } else if (d <= -G.win) { G.p[0].lives--; G.over = 1; }
    return G.over !== null;
  }
  HD.matchOver = function (G) { return G.over !== null && G.p[1 - G.over].lives <= 0; };
  // Neue Runde nach verlorenem Leben (Regelbuch): Karten auf dem Feld wandern ohne Knochen in den Friedhof, Hand und Knochen bleiben,
  // beide ziehen 3 Karten und 1 Eichhörnchen, die Waage beginnt bei 0, der Verlierer erhält den Großen Rauch und beginnt.
  HD.newRound = function (G) {
    var loser = 1 - G.over;
    G.p.forEach(function (P, s) {
      P.board.forEach(function (c) { if (c) P.dead.push(c); }); P.board = [null, null, null, null]; P.queue = [null, null, null, null]; P.dmg = 0; P.first = true; P.skip = false; P.fan = false; P.drew = false;
      for (var h = 0; h < 3; h++) if (P.deck.length) P.hand.push(P.deck.pop()); if (P.side.length) P.hand.push(P.side.pop());
    });
    G.p[loser].hand.push(HD.make('smoke')); G.over = null; G.lastDiff = 0; HD.startTurn(G, loser);
  };
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
    var need = c.cost.b || 0, got = 0; for (var i = 0; i < sac.length; i++) { var o = P.board[sac[i]]; if (!o) return 'Kein Opfer'; if (HD.has(o, 'nosac')) return 'Nicht opferbar'; got += worth(o); }
    if (got < need) return 'Zu wenig Opfer (' + got + '/' + need + ')';
    if (sac.length > 1 && got - worth(P.board[sac[sac.length - 1]]) >= need) { /* überzählige Opfer sind erlaubt, aber unnötig */ }
    if ((c.cost.o || 0) > P.bones) return 'Zu wenig Knochen';
    if (lane < 0 || lane >= LANES) return 'Ungültige Bahn';
    if (P.board[lane] && !(sac.indexOf(lane) >= 0 && dies(P.board[lane]))) return 'Bahn besetzt';
    return null;
  };
  HD.play = async function (G, s, idx, lane, sac, hook) {
    var err = HD.check(G, s, idx, lane, sac); if (err) return err;
    var P = G.p[s], c = P.hand.splice(idx, 1)[0]; sac = sac || [];
    sac.forEach(function (l) { var o = P.board[l]; if (dies(o)) kill(G, s, l, true); else o.lives--; });
    P.bones -= (c.cost.o || 0); P.board[lane] = c; c.age = 0;
    if (HD.has(c, 'fecund')) P.hand.push(HD.make(c.id));
    if (HD.has(c, 'hoard') && P.deck.length) P.hand.push(P.deck.pop());
    if (HD.has(c, 'rabbit')) P.hand.push(HD.make('rabbit'));
    if (HD.has(c, 'antspawn')) P.hand.push(HD.make('ant'));
    if (HD.has(c, 'trinket')) giveItem(G, s);
    if (HD.has(c, 'dam')) [lane - 1, lane + 1].forEach(function (a) { if (a >= 0 && a < LANES && !P.board[a]) P.board[a] = HD.make('dam'); });
    onEnter(G, s, lane); HD.refresh(G);
    if (hook) await hook({ k: 'play', s: s, l: lane });
    return null;
  };
  function kill(G, s, l, sacrificed) {
    var P = G.p[s], c = P.board[l]; if (!c) return;
    P.board[l] = null; P.bones += (!sacrificed && HD.has(c, 'boneking')) ? 4 : 1; P.dead.push(c);
    if (HD.has(c, 'frozen') && !P.board[l]) { P.board[l] = HD.make('opossum'); }
    if (s === 1 && G.boss && !sacrificed) bossDeath(G, l, c);
    if (!sacrificed && HD.has(c, 'unkill')) P.hand.push(HD.make(c.id));
    if (!sacrificed && HD.has(c, 'reborn')) P.hand.push(HD.make({ id: c.id, a: (c.up ? c.up.a : 0) + 1, h: (c.up ? c.up.h : 0) + 1 }));
    if (!sacrificed && HD.has(c, 'lives') && c.lives > 1) { var n = HD.make(c.id); n.lives = c.lives - 1; P.hand.push(n); }
  }
  function bossDeath(G, l, c) {
    var B = G.p[1];
    if (G.boss === 'pack' && c.id !== 'elk_fawn' && !G.rallied) { var f = -1; for (var i = 0; i < LANES; i++) if (!B.queue[i]) { f = i; break; } if (f >= 0) { B.queue[f] = HD.make('elk_fawn'); G.rallied = true; } }
    if (G.boss === 'necro' && c.id !== 'skeleton' && !c.risen && !B.board[l]) { var sk = HD.make('skeleton'); sk.risen = true; B.board[l] = sk; }
  }
  // Zu Beginn des Zuges des Bosses
  HD.bossTurn = function (G) {
    G.rallied = false; var P = G.p[0], d = HD.diff(G), i;
    if (G.boss === 'curse') {
      var t = -1; for (i = 0; i < LANES; i++) if (P.board[i] && (t < 0 || P.board[i].atk > P.board[t].atk)) t = i;
      if (t >= 0) { P.board[t].hp -= 1; if (P.board[t].hp <= 0) kill(G, 0, t); }
      if (d >= 3) { for (i = 0; i < LANES; i++) if (!G.p[1].queue[i]) { G.p[1].queue[i] = HD.make('adder'); break; } }
    }
  };
  // Wächter der Gegenseite wechseln in leere Bahnen, wenn ein Gegner dort erscheint
  function onEnter(G, s, lane) {
    var o = 1 - s, O = G.p[o];
    if (!G.p[s].board[lane] || O.board[lane]) return;
    for (var i = 0; i < LANES; i++) if (HD.has(O.board[i], 'guard') && i !== lane) { O.board[lane] = O.board[i]; O.board[i] = null; return; }
  }
  // Angriff aller Karten von Spieler s; hook(ev) wird nach jedem Schritt aufgerufen (Animation)
  HD.attack = async function (G, s, hook) {
    var o = 1 - s, P = G.p[s], O = G.p[o], cap = P.first ? 3 : 1e9, dealt = 0; G.phase = 'attack';      // Regelbuch: Im ersten Zug jedes Spielers (und nach einem verlorenen Leben) zählen höchstens 3 Punkte
    for (var l = 0; l < LANES && G.over === null; l++) {
      var c = P.board[l]; if (!c || c.atk <= 0) continue;
      var tg = HD.has(c, 'tri') ? [l - 1, l, l + 1] : HD.has(c, 'bi') ? [l - 1, l + 1] : [l];
      if (hook) await hook({ k: 'atk', s: s, l: l });
      var reps = HD.has(c, 'double') ? 2 : 1, tgAll = []; for (var rp = 0; rp < reps; rp++) tgAll = tgAll.concat(tg); tg = tgAll;
      for (var t = 0; t < tg.length && G.over === null; t++) {
        var tl = tg[t]; if (tl < 0 || tl >= LANES || P.board[l] !== c) continue;
        HD.refresh(G); if (c.atk <= 0) break;
        var d = O.board[tl];
        if (!d) { // Wühler wechselt in die leere Bahn
          for (var b = 0; b < LANES; b++) if (HD.has(O.board[b], 'burrow')) { O.board[tl] = O.board[b]; O.board[b] = null; d = O.board[tl]; break; }
        }
        if (d && d.sub) d = null;
        if (d && HD.has(d, 'tail') && !d.tailUsed) { var adj = [tl - 1, tl + 1].filter(function (a) { return a >= 0 && a < LANES && !O.board[a]; })[0]; if (adj !== undefined) { d.tailUsed = true; O.board[adj] = d; d = O.board[tl] = HD.make('skink_tail'); } }
        if (d && (HD.has(c, 'airborne') || P.fan) && !HD.has(d, 'leap')) d = null;
        if (d) {
          d.hp -= c.atk; var dead = d.hp <= 0 || HD.has(c, 'death');
          if (HD.has(d, 'quills')) c.hp -= 1;
          if (HD.has(d, 'bees')) O.hand.push(HD.make('bee'));
          if (hook) await hook({ k: 'hit', s: o, l: tl, n: c.atk });
          if (dead) { var dl = O.board.indexOf(d); if (dl >= 0) kill(G, o, dl); if (hook) await hook({ k: 'die', s: o, l: tl }); }
          if (c.hp <= 0) { kill(G, s, l); if (hook) await hook({ k: 'die', s: s, l: l }); break; }
        } else {
          var dn = Math.min(c.atk, cap - dealt); if (dn <= 0) continue; dealt += dn; P.dmg += dn; if (hook) await hook({ k: 'scale', s: s, n: dn }); if (check(G)) break;
        }
      }
    }
    P.first = false; P.fan = false; HD.refresh(G); scaleTick(G);
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
    for (var h = 0; h < LANES; h++) {      // Wuchtig: die Karte und ihre Nachbarn rücken vor und schieben angrenzende Karten mit
      var hc = P.board[h]; if (!hc || !HD.has(hc, 'hefty') || hc.moved) continue;
      var d = hc.dir, a = h - 1 >= 0 && P.board[h - 1] ? h - 1 : h, b = h + 1 < LANES && P.board[h + 1] ? h + 1 : h;
      var lo = d > 0 ? a : a, hi = b; if (d > 0) { while (hi + 1 < LANES && P.board[hi + 1]) hi++; if (hi + 1 >= LANES) { hc.dir = -d; continue; } for (var q = hi; q >= lo; q--) { P.board[q + 1] = P.board[q]; } P.board[lo] = null; }
      else { while (lo - 1 >= 0 && P.board[lo - 1]) lo--; if (lo - 1 < 0) { hc.dir = -d; continue; } for (var q2 = lo; q2 <= hi; q2++) { P.board[q2 - 1] = P.board[q2]; } P.board[hi] = null; }
      for (var u = 0; u < LANES; u++) if (P.board[u]) onEnter(G, s, u);
      break;
    }
    for (var dg = 0; dg < LANES; dg++) if (HD.has(P.board[dg], 'digger')) P.bones++;
    for (var z = 0; z < LANES; z++) if (P.board[z] && HD.has(P.board[z], 'submerge')) P.board[z].sub = true;
    for (var k = 0; k < LANES; k++) {
      var f = P.board[k];
      if (f && HD.has(f, 'fledge') && f.age >= 1) { var n = HD.make(HD.CARDS[f.id].evo); n.age = f.age; n.dir = f.dir; n.sub = f.sub && HD.has(n, 'submerge'); P.board[k] = n; }
    }
    HD.refresh(G);
  };
  // Hunger (Wiki): Hat der Spieler zu Zugbeginn keine Karte mehr zu ziehen, erscheint beim Gegner eine Hunger-Karte (1/1, jede weitere +1/+1, ab der fünften mit Flug, ab der neunten zusätzlich ein Punkt auf der Waage)
  function starve(G) {
    var P = G.p[0], O = G.p[1]; if (!G.npc || P.deck.length || P.side.length) return; G.starved = (G.starved || 0) + 1; var n = G.starved;
    var c = HD.make({ id: 'starvation', dc: { n: 'Hunger', atk: n, hp: n, sig: n >= 5 ? ['airborne'] : [], art: '🍖', cost: {} } }), l = O.board.indexOf(null); if (l < 0) l = 0; O.board[l] = c;
    if (n >= 9) { O.dmg++; check(G); }
  }
  HD.startTurn = function (G, s) { G.p[s].board.forEach(function (c) { if (c) c.sub = false; }); HD.refresh(G); G.turn = s; G.phase = 'draw'; G.p[s].drew = false; if (s === 0) { G.n++; starve(G); } };
  // ---------- Computergegner ----------
  // Rückt die Warteschlange vor (Gegner-NPC)
  HD.advanceQueue = function (G, s) {
    var P = G.p[s];
    for (var i = 0; i < LANES; i++) if (P.queue[i] && !P.board[i]) { P.board[i] = P.queue[i]; P.queue[i] = null; P.board[i].age = 0; onEnter(G, s, i); }
  };
  // Legt neue Karten in die Warteschlange; diff = Schwierigkeit 1..3. Der Gegner wählt Karte und Bahn passend zu deinem Feld
  // (Blocker gegen deine starken Karten, Angreifer in deine leeren Bahnen), die Stärke der Karten wächst mit der Rundenzahl.
  HD.fillQueue = function (G, s, diff) {
    var P = G.p[s], O = G.p[1 - s], rnd = G.rnd || Math.random, hard = G.hard ? 1 : 0;
    var n = 1 + (diff >= 2 && G.n > 5 ? 1 : 0) + (diff >= 3 && G.n > 3 ? 1 : 0) + (G.boss === 'pack' && HD.diff(G) >= 3 ? 1 : 0) + (hard && G.n > 4 ? 1 : 0);
    for (var k = 0; k < n && P.deck.length; k++) {
      var lim = (3 + G.n * (.7 + diff * .3)) * (hard ? 1.25 : 1), best = null, bs = -99, any = null;
      for (var l = 0; l < LANES; l++) {
        if (P.queue[l]) continue;
        for (var ix = 0; ix < P.deck.length; ix++) {
          var c = P.deck[ix], pw = c.atk + c.hp; if (!any || pw < any.pw) any = { ix: ix, l: l, pw: pw };
          if (pw > lim) continue;
          var e = O.board[l], sc = rnd() * 1.6 + pw * .25;
          if (e) { if (c.hp > e.atk) sc += 2; if (c.atk >= e.hp) sc += 2.5; if (e.atk > 0 && c.hp <= e.atk && !HD.has(c, 'death')) sc -= 1.5; if (HD.has(c, 'airborne')) sc += .5; }
          else sc += c.atk * 1.4 + (HD.has(c, 'airborne') ? 1 : 0);
          if (P.board[l]) sc -= 3;
          if (HD.has(c, 'death') || HD.has(c, 'quills')) sc += e ? 1 : 0;
          if (sc > bs) { bs = sc; best = { ix: ix, l: l }; }
        }
      }
      var pick = best || any; if (!pick) break;
      P.queue[pick.l] = P.deck.splice(pick.ix, 1)[0];
    }
  };
  // Einfacher Spieler-Bot (für Tests und als Platzhalter): zieht, spielt so viel wie möglich, gibt zurück
  HD.botPlay = async function (G, s, hook) {
    var P = G.p[s]; HD.draw(G, s, P.deck.length && (G.rnd || Math.random)() < .7 ? 'deck' : 'side');
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

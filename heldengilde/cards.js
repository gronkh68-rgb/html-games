/* Heldengilde: Kartendaten (eigene Helden, Gegenstände, Zauber, Monster). */
(function () {
  var L2 = function (de, en) { return { de: de, en: en }; };
  var CL = [
    { i: '⚔️', n: L2('Krieger', 'Fighter'), c: '#e53935' },
    { i: '🎵', n: L2('Barde', 'Bard'), c: '#f9a825' },
    { i: '🛡️', n: L2('Wächter', 'Guardian'), c: '#1e88e5' },
    { i: '🏹', n: L2('Waldläufer', 'Ranger'), c: '#43a047' },
    { i: '🗝️', n: L2('Dieb', 'Thief'), c: '#8e24aa' },
    { i: '🔮', n: L2('Magier', 'Wizard'), c: '#00acc1' }
  ];
  var CARDS = [];
  function add(o) { o.id = CARDS.length; CARDS.push(o); return o; }
  // Helden: [Klasse, Name, Würfelwert, Effekt, n]
  [
    [0, 'Brakka Eisenfaust', 8, 'destroy', 1], [0, 'Hilda Schildbrecherin', 7, 'sacrifice', 1], [0, 'Torvin Donnerschlag', 6, 'discardAll', 1],
    [0, 'Garm der Wilde', 6, 'pull', 1], [0, 'Rika Klingenwirbel', 5, 'draw', 1], [0, 'Ulfar Bergbrecher', 10, 'destroy', 2],
    [1, 'Lio Lautenklang', 6, 'draw', 2], [1, 'Mira Silberstimme', 7, 'ap', 2], [1, 'Fenn Flötenwind', 8, 'drawPlay', 1],
    [1, 'Selia Sternensang', 5, 'draw', 1], [1, 'Bodo Trommelherz', 6, 'search', 'any'], [1, 'Ylva Harfenzauber', 9, 'draw', 3],
    [2, 'Gunda Steinwall', 6, 'revive', 1], [2, 'Aldric Lichtschild', 8, 'search', 'item'], [2, 'Petra Turmhüterin', 5, 'draw', 1],
    [2, 'Hagen Eichenherz', 7, 'search', 'magic'], [2, 'Erna Wachfeuer', 9, 'sacrifice', 1], [2, 'Theodor Bollwerk', 10, 'drawPlay', 1],
    [3, 'Kael Falkenauge', 7, 'pull', 1], [3, 'Nia Moospfad', 6, 'peek', 1], [3, 'Orrin Wolfsbruder', 8, 'pull', 2],
    [3, 'Sola Windläuferin', 5, 'draw', 1], [3, 'Varek Spurensucher', 9, 'search', 'any'], [3, 'Lyra Pfeilregen', 10, 'destroy', 1],
    [4, 'Schnapp', 6, 'pull', 1], [4, 'Mara Schattenhand', 8, 'steal', 1], [4, 'Rix Flinkfinger', 7, 'peek', 1],
    [4, 'Vela Nachtmaske', 9, 'trade', 1], [4, 'Grim Taschenleer', 5, 'pull', 1], [4, 'Zara Dolchtanz', 10, 'swapHero', 1],
    [5, 'Ezren Funkenhand', 8, 'destroy', 1], [5, 'Ilsa Frostweber', 7, 'discardAll', 1], [5, 'Morwen Sternenleser', 6, 'draw3d1', 1],
    [5, 'Quill Tintenzauber', 5, 'draw', 1], [5, 'Xandor der Graue', 9, 'discardAll', 2], [5, 'Aurelia Arkanflamme', 10, 'steal', 1]
  ].forEach(function (h) { add({ t: 'hero', cl: h[0], name: h[1], rq: h[2], fx: h[3], n: h[4] }); });
  // Gegenstände
  CL.forEach(function (c, i) { add({ t: 'item', sub: 'crest', cl: i, name: L2('Wappen: ' + c.n.de, 'Crest: ' + c.n.en) }); });
  add({ t: 'item', sub: 'luck', v: 1, name: L2('Glücksstein', 'Lucky Stone') });
  add({ t: 'item', sub: 'luck', v: 1, name: L2('Glücksstein', 'Lucky Stone') });
  add({ t: 'item', sub: 'luck', v: 2, name: L2('Runenring', 'Rune Ring') });
  add({ t: 'item', sub: 'curse', kind: 'lead', v: -2, name: L2('Bleikette', 'Lead Chain') });
  add({ t: 'item', sub: 'curse', kind: 'lead', v: -2, name: L2('Bleikette', 'Lead Chain') });
  add({ t: 'item', sub: 'curse', kind: 'silence', name: L2('Schweigefluch', 'Curse of Silence') });
  add({ t: 'item', sub: 'curse', kind: 'mask', name: L2('Verwirrungsmaske', 'Mask of Confusion') });
  // Zauber
  [['destroy', 1, 'Feuerball', 'Fireball'], ['destroy', 1, 'Feuerball', 'Fireball'], ['draw', 3, 'Glückssträhne', 'Lucky Streak'], ['draw', 3, 'Glückssträhne', 'Lucky Streak'],
    ['discardAll', 2, 'Chaosblitz', 'Chaos Bolt'], ['reviveParty', 1, 'Totenruf', 'Call of the Fallen'], ['reviveParty', 1, 'Totenruf', 'Call of the Fallen'],
    ['search', 'any', 'Kristallkugel', 'Crystal Ball'], ['ap', 2, 'Zeitkrümmung', 'Time Warp'], ['ap', 2, 'Zeitkrümmung', 'Time Warp'],
    ['steal', 1, 'Diebeszauber', 'Thief’s Charm'], ['pull', 2, 'Sturmruf', 'Storm Call']
  ].forEach(function (m) { add({ t: 'magic', fx: m[0], n: m[1], name: L2(m[2], m[3]) }); });
  // Modifikatoren (eine der Optionen wählen)
  [[4], [4], [4], [-4], [-4], [-4], [3, -1], [3, -1], [3, -1], [3, -1], [1, -3], [1, -3], [1, -3], [1, -3], [2, -2], [2, -2], [2, -2], [2, -2], [2, -2], [4]].forEach(function (v) { add({ t: 'mod', v: v }); });
  // Herausforderungen
  for (var i = 0; i < 10; i++) add({ t: 'chal' });

  var LEADERS = [
    { cl: 0, name: 'Kommandantin Vala', rw: 'atk1' }, { cl: 1, name: 'Meister Aurin', rw: 'abil1' }, { cl: 2, name: 'Wächterin Brunhild', rw: 'chal2' },
    { cl: 3, name: 'Jägerin Sylva', rw: 'freeDraw' }, { cl: 4, name: 'Fuchs Renko', rw: 'thief' }, { cl: 5, name: 'Magistra Elda', rw: 'magicDraw' }
  ];
  // Monster: rq = {n: Anzahl Helden, cl: [Klassen, die dabei sein müssen]}, slay = Wurf ab, fail = Wurf bis, pen = Strafe, rw = Belohnung
  var MONS = [
    ['Knochenhydra', 'Bone Hydra', 3, [], 8, 4, ['sac', 1], 'abil1'], ['Schattenwurm', 'Shadow Wyrm', 2, [5], 7, 5, ['dis', 2], 'draw1'],
    ['Kristallgolem', 'Crystal Golem', 2, [2], 8, 4, ['sac', 1], 'safe'], ['Sumpfvettel', 'Swamp Hag', 2, [1], 6, 5, ['dis', 2], 'modDraw'],
    ['Feuerdrache', 'Fire Dragon', 4, [], 10, 6, ['sac', 1], 'ap1'], ['Nebelgeist', 'Mist Wraith', 2, [4], 7, 4, ['dis', 1], 'chal2'],
    ['Steintroll', 'Stone Troll', 3, [0], 8, 5, ['sac', 1], 'atk1'], ['Rabenkönigin', 'Raven Queen', 2, [3], 7, 4, ['dis', 2], 'draw1'],
    ['Eisbestie', 'Ice Beast', 3, [], 9, 5, ['dis', 2], 'abil1'], ['Riesenkrake', 'Giant Kraken', 3, [5, 1], 8, 4, ['sac', 1], 'revive'],
    ['Höhlenoger', 'Cave Ogre', 2, [], 9, 6, ['dis', 1], 'atk1'], ['Dornenbestie', 'Thorn Beast', 2, [0], 7, 4, ['sac', 1], 'chal2'],
    ['Glutgolem', 'Ember Golem', 3, [2], 8, 5, ['dis', 2], 'safe'], ['Sternenschlange', 'Star Serpent', 4, [5], 9, 5, ['sac', 1], 'ap1']
  ].map(function (m, i) { return { id: i, name: L2(m[0], m[1]), rq: { n: m[2], cl: m[3] }, slay: m[4], fail: m[5], pen: m[6], rw: m[7], ico: ['🐉', '🪱', '💎', '🧙‍♀️', '🔥', '👻', '🗿', '🐦‍⬛', '🧊', '🐙', '👹', '🌵', '🌋', '🐍'][i] }; });

  var RW = {
    atk1: L2('+1 auf Angriffswürfe gegen Monster', '+1 to attack rolls against monsters'),
    abil1: L2('+1 auf Helden-Fähigkeitswürfe', '+1 to hero ability rolls'),
    chal2: L2('+2 bei Herausforderungen', '+2 in challenges'),
    freeDraw: L2('Einmal pro Zug: Karte ziehen kostet keinen Aktionspunkt', 'Once per turn: drawing a card costs no action point'),
    thief: L2('Einmal pro Zug für 1 Aktionspunkt: Ziehe 1 zufällige Karte von einem Gegner', 'Once per turn for 1 action point: take 1 random card from an opponent'),
    magicDraw: L2('Wenn du einen Zauber spielst, ziehe danach 1 Karte', 'When you cast a spell, draw 1 card afterwards'),
    draw1: L2('Zu Beginn deines Zuges ziehe 1 Karte', 'At the start of your turn draw 1 card'),
    safe: L2('Deine Helden können nicht zerstört oder gestohlen werden', 'Your heroes cannot be destroyed or stolen'),
    modDraw: L2('Wenn du einen Modifikator spielst, ziehe 1 Karte', 'When you play a modifier, draw 1 card'),
    ap1: L2('+1 Aktionspunkt in jedem deiner Züge', '+1 action point on each of your turns'),
    revive: L2('Wird einer deiner Helden zerstört, ziehe 2 Karten', 'When one of your heroes is destroyed, draw 2 cards')
  };
  function FX(fx, n) {
    var s = n === 1 ? '' : 's';
    switch (fx) {
      case 'draw': return L2('Ziehe ' + n + (n === 1 ? ' Karte.' : ' Karten.'), 'Draw ' + n + ' card' + s + '.');
      case 'destroy': return n === 1 ? L2('Zerstöre einen Helden eines Gegners.', 'Destroy an opponent’s hero.') : L2('Zerstöre ' + n + ' Helden von Gegnern.', 'Destroy ' + n + ' opponent heroes.');
      case 'sacrifice': return L2('Ein Gegner deiner Wahl muss einen seiner Helden opfern.', 'An opponent of your choice must sacrifice one of their heroes.');
      case 'discardAll': return L2('Jeder Gegner wirft ' + n + (n === 1 ? ' Karte' : ' Karten') + ' ab.', 'Each opponent discards ' + n + ' card' + s + '.');
      case 'pull': return L2('Ziehe ' + n + (n === 1 ? ' zufällige Karte' : ' zufällige Karten') + ' von einem Gegner.', 'Take ' + n + ' random card' + s + ' from an opponent.');
      case 'ap': return L2('+' + n + ' Aktionspunkte in diesem Zug.', '+' + n + ' action points this turn.');
      case 'drawPlay': return L2('Ziehe 1 Karte. Ist es ein Held, darfst du ihn sofort kostenlos spielen.', 'Draw 1 card. If it is a hero, you may play it right away for free.');
      case 'search': return n === 'any' ? L2('Nimm eine beliebige Karte aus dem Ablagestapel.', 'Take any card from the discard pile.') : n === 'item' ? L2('Nimm einen Gegenstand aus dem Ablagestapel.', 'Take an item from the discard pile.') : L2('Nimm einen Zauber aus dem Ablagestapel.', 'Take a spell from the discard pile.');
      case 'revive': return L2('Nimm einen Helden aus dem Ablagestapel auf die Hand.', 'Take a hero from the discard pile into your hand.');
      case 'reviveParty': return L2('Hole einen Helden aus dem Ablagestapel direkt in deine Gruppe.', 'Bring a hero from the discard pile straight into your party.');
      case 'peek': return L2('Sieh dir die Hand eines Gegners an und nimm 1 Karte.', 'Look at an opponent’s hand and take 1 card.');
      case 'steal': return L2('Stiehl einen Helden aus der Gruppe eines Gegners.', 'Steal a hero from an opponent’s party.');
      case 'trade': return L2('Tausche deine Hand mit der eines Gegners.', 'Swap your hand with an opponent’s.');
      case 'swapHero': return L2('Tausche einen deiner Helden gegen einen Helden eines Gegners.', 'Swap one of your heroes for an opponent’s hero.');
      case 'draw3d1': return L2('Ziehe 3 Karten, wirf dann 1 Karte ab.', 'Draw 3 cards, then discard 1 card.');
    }
    return L2('', '');
  }
  function itemText(c) {
    if (c.sub === 'crest') return L2('Der Held zählt als ' + CL[c.cl].n.de + '.', 'The hero counts as a ' + CL[c.cl].n.en + '.');
    if (c.sub === 'luck') return L2('+' + c.v + ' auf die Fähigkeitswürfe dieses Helden.', '+' + c.v + ' to this hero’s ability rolls.');
    if (c.kind === 'lead') return L2('Fluch: ' + c.v + ' auf die Fähigkeitswürfe dieses Helden.', 'Curse: ' + c.v + ' to this hero’s ability rolls.');
    if (c.kind === 'silence') return L2('Fluch: Dieser Held kann seine Fähigkeit nicht nutzen.', 'Curse: this hero cannot use its ability.');
    if (c.kind === 'mask') return L2('Fluch: Dieser Held zählt zu keiner Klasse.', 'Curse: this hero counts as no class.');
    return L2('', '');
  }
  window.HG = { CL: CL, CARDS: CARDS, LEADERS: LEADERS, MONS: MONS, RW: RW, FX: FX, itemText: itemText };
})();

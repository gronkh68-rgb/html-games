/* Höllen-Tycoon: Spielfeld und Karten (eigene Namen und Texte). */
(function () {
  var L2 = function (de, en) { return { de: de, en: en }; };
  var GROUPS = [
    { c: '#8d5524', hc: 50 }, { c: '#7fd3f7', hc: 50 }, { c: '#e056a0', hc: 100 }, { c: '#ff8f1f', hc: 100 },
    { c: '#e53935', hc: 150 }, { c: '#fdd835', hc: 150 }, { c: '#2e9a4a', hc: 200 }, { c: '#283593', hc: 200 }
  ];
  var R = {
    60: [[2, 10, 30, 90, 160, 250], [4, 20, 60, 180, 320, 450]], 100: [6, 30, 90, 270, 400, 550], 120: [8, 40, 100, 300, 450, 600], 140: [10, 50, 150, 450, 625, 750], 160: [12, 60, 180, 500, 700, 900],
    180: [14, 70, 200, 550, 750, 950], 200: [16, 80, 220, 600, 800, 1000], 220: [18, 90, 250, 700, 875, 1050], 240: [20, 100, 300, 750, 925, 1100], 260: [22, 110, 330, 800, 975, 1150],
    280: [24, 120, 360, 850, 1025, 1200], 300: [26, 130, 390, 900, 1100, 1275], 320: [28, 150, 450, 1000, 1200, 1400], 350: [35, 175, 500, 1100, 1300, 1500], 400: [50, 200, 600, 1400, 1700, 2000]
  };
  var F = [];
  function st(de, en, g, price, k) { F.push({ t: 'st', n: L2(de, en), g: g, price: price, rent: price === 60 ? R[60][k] : R[price] }); }
  function sp(t, de, en, ico, extra) { var o = { t: t, n: L2(de, en), ico: ico }; for (var k in extra || {}) o[k] = extra[k]; F.push(o); }
  sp('go', 'Höllentor', 'Hell Gate', '🔥');
  st('Schwefelgasse', 'Brimstone Lane', 0, 60, 0); sp('pact', 'Teufelspakt', 'Devil’s Pact', '📜'); st('Aschenweg', 'Ash Road', 0, 60, 1); sp('tax', 'Seelensteuer', 'Soul Tax', '💸', { amt: 200 });
  sp('ferry', 'Styx-Fähre', 'Styx Ferry', '⛴️', { price: 200 });
  st('Fegefeuerallee', 'Purgatory Avenue', 1, 100); sp('fate', 'Schicksalsrad', 'Wheel of Fate', '🎡'); st('Grollstraße', 'Grudge Street', 1, 100); st('Jammertal', 'Wailing Vale', 1, 120);
  sp('jail', 'Seelenkerker', 'Soul Prison', '⛓️');
  st('Lustgarten', 'Garden of Lust', 2, 140); sp('util', 'Lavawerk', 'Lava Works', '🌋', { price: 150 }); st('Gierplatz', 'Greed Square', 2, 140); st('Neidweg', 'Envy Way', 2, 160);
  sp('ferry', 'Charons Fähre', 'Charon’s Ferry', '⛴️', { price: 200 });
  st('Zornstraße', 'Wrath Street', 3, 180); sp('pact', 'Teufelspakt', 'Devil’s Pact', '📜'); st('Trägheitsallee', 'Sloth Avenue', 3, 180); st('Hochmutplatz', 'Pride Plaza', 3, 200);
  sp('free', 'Ruheloses Feld', 'Restless Rest', '🪦');
  st('Feuergraben', 'Fire Trench', 4, 220); sp('fate', 'Schicksalsrad', 'Wheel of Fate', '🎡'); st('Glutboulevard', 'Ember Boulevard', 4, 220); st('Flammenring', 'Ring of Flames', 4, 240);
  sp('ferry', 'Phlegyas-Fähre', 'Phlegyas Ferry', '⛴️', { price: 200 });
  st('Dämonenmarkt', 'Demon Market', 5, 260); st('Imp-Viertel', 'Imp Quarter', 5, 260); sp('util', 'Schwefelquelle', 'Sulphur Spring', '♨️', { price: 150 }); st('Höllenhund-Allee', 'Hellhound Avenue', 5, 280);
  sp('gojail', 'Ab in den Kerker', 'Go to Prison', '👮');
  st('Sündenpalast-Straße', 'Sin Palace Street', 6, 300); st('Pandämonium', 'Pandemonium', 6, 300); sp('pact', 'Teufelspakt', 'Devil’s Pact', '📜'); st('Luziferring', 'Lucifer Ring', 6, 320);
  sp('ferry', 'Höllenexpress', 'Hell Express', '🚂', { price: 200 });
  sp('fate', 'Schicksalsrad', 'Wheel of Fate', '🎡'); st('Thronsaal-Gasse', 'Throne Hall Alley', 7, 350); sp('tax', 'Ablass-Abgabe', 'Indulgence Fee', '💸', { amt: 100 }); st('Höllenthron', 'Hell Throne', 7, 400);
  F.forEach(function (f, i) { f.i = i; if (f.t === 'st') { f.hc = GROUPS[f.g].hc; } });
  // Karten: a = Aktion
  var FATE = [
    { a: 'to', f: 0, d: L2('Rücke vor zum Höllentor.', 'Advance to Hell Gate.') },
    { a: 'to', f: 39, d: L2('Rücke vor zum Höllenthron.', 'Advance to Hell Throne.') },
    { a: 'to', f: 21, d: L2('Rücke vor zum Feuergraben. Kommst du über das Höllentor, kassiere 200.', 'Advance to Fire Trench. If you pass Hell Gate, collect 200.') },
    { a: 'to', f: 11, d: L2('Rücke vor zum Lustgarten.', 'Advance to Garden of Lust.') },
    { a: 'ferry', d: L2('Rücke vor zur nächsten Fähre. Gehört sie jemandem, zahle die doppelte Miete.', 'Advance to the nearest ferry. If owned, pay double rent.') },
    { a: 'ferry', d: L2('Rücke vor zur nächsten Fähre. Gehört sie jemandem, zahle die doppelte Miete.', 'Advance to the nearest ferry. If owned, pay double rent.') },
    { a: 'util', d: L2('Rücke vor zum nächsten Werk. Gehört es jemandem, würfle und zahle das Zehnfache.', 'Advance to the nearest works. If owned, roll and pay ten times the roll.') },
    { a: 'back', n: 3, d: L2('Ein Dämon schubst dich: Gehe 3 Felder zurück.', 'A demon shoves you: go back 3 fields.') },
    { a: 'jail', d: L2('Gehe direkt in den Seelenkerker. Kein Geld über das Höllentor.', 'Go straight to the Soul Prison. Do not pass Hell Gate.') },
    { a: 'free', d: L2('Freikarte: Du kommst aus dem Seelenkerker frei. Behalte die Karte.', 'Free pass: get out of the Soul Prison. Keep this card.') },
    { a: 'money', n: 50, d: L2('Die Hölle zahlt dir eine Dividende von 50.', 'Hell pays you a dividend of 50.') },
    { a: 'money', n: -15, d: L2('Strafe für zu gute Laune: Zahle 15.', 'Fine for being too cheerful: pay 15.') },
    { a: 'repair', h: 25, p: 100, d: L2('Renovierung: Zahle 25 je Haus und 100 je Palast.', 'Renovations: pay 25 per house and 100 per palace.') },
    { a: 'each', n: -50, d: L2('Du wirst zum Obersten Folterer gewählt: Zahle jedem Spieler 50.', 'You are elected Chief Tormentor: pay each player 50.') },
    { a: 'money', n: 150, d: L2('Dein Seelenkredit wird fällig: Kassiere 150.', 'Your soul loan matures: collect 150.') },
    { a: 'to', f: 5, d: L2('Fahre mit der Styx-Fähre. Kommst du über das Höllentor, kassiere 200.', 'Take the Styx Ferry. If you pass Hell Gate, collect 200.') }
  ];
  var PACT = [
    { a: 'to', f: 0, d: L2('Rücke vor zum Höllentor.', 'Advance to Hell Gate.') },
    { a: 'money', n: 200, d: L2('Ein Fehler der Höllenbank zu deinen Gunsten: Kassiere 200.', 'Hell bank error in your favour: collect 200.') },
    { a: 'money', n: -50, d: L2('Rechnung vom Höllenarzt: Zahle 50.', 'Bill from the hell doctor: pay 50.') },
    { a: 'money', n: 50, d: L2('Du verkaufst alte Seelen: Kassiere 50.', 'You sell some old souls: collect 50.') },
    { a: 'free', d: L2('Freikarte: Du kommst aus dem Seelenkerker frei. Behalte die Karte.', 'Free pass: get out of the Soul Prison. Keep this card.') },
    { a: 'jail', d: L2('Gehe direkt in den Seelenkerker. Kein Geld über das Höllentor.', 'Go straight to the Soul Prison. Do not pass Hell Gate.') },
    { a: 'money', n: 100, d: L2('Dein Sündenfonds wird ausgezahlt: Kassiere 100.', 'Your sin fund pays out: collect 100.') },
    { a: 'money', n: 20, d: L2('Steuerrückzahlung aus der Unterwelt: Kassiere 20.', 'Underworld tax refund: collect 20.') },
    { a: 'each', n: 10, d: L2('Es ist dein Verdammnistag: Jeder Spieler zahlt dir 10.', 'It is your damnation day: every player pays you 10.') },
    { a: 'money', n: 100, d: L2('Eine Lebensversicherung wird fällig: Kassiere 100.', 'A life insurance matures: collect 100.') },
    { a: 'money', n: -100, d: L2('Krankenhausgebühren im Fegefeuer: Zahle 100.', 'Purgatory hospital fees: pay 100.') },
    { a: 'money', n: -50, d: L2('Schulgeld für die Dämonenakademie: Zahle 50.', 'Demon academy fees: pay 50.') },
    { a: 'money', n: 25, d: L2('Beraterhonorar für einen Fluch: Kassiere 25.', 'Consulting fee for a curse: collect 25.') },
    { a: 'repair', h: 40, p: 115, d: L2('Straßenreparatur: Zahle 40 je Haus und 115 je Palast.', 'Street repairs: pay 40 per house and 115 per palace.') },
    { a: 'money', n: 10, d: L2('Zweiter Platz beim Schönheitswettbewerb der Hölle: Kassiere 10.', 'Second prize in hell’s beauty contest: collect 10.') },
    { a: 'money', n: 100, d: L2('Du erbst ein Höllenvermögen: Kassiere 100.', 'You inherit a hellish fortune: collect 100.') }
  ];
  window.HT = { F: F, GROUPS: GROUPS, FATE: FATE, PACT: PACT, TOKENS: ['😈', '👹', '💀', '🦇', '🐍', '🔥'], COLORS: ['#ff3d3d', '#ffb300', '#3ddc84', '#40a9ff', '#c86bff', '#ff7ac6'] };
})();

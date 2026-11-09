/* Helluva Tycoon: Spielfeld und Karten. Inoffizielles Fan-Spiel zu „Helluva Boss“ (Vivienne Medrano / SpindleHorse Toons).
   Nur Namen und Anspielungen, keine Bilder oder Texte aus der Serie. */
(function () {
  var L2 = function (de, en) { return { de: de, en: en }; };
  var GROUPS = [
    { c: '#8d5524', hc: 50, n: L2('Imp City', 'Imp City') }, { c: '#7fd3f7', hc: 50, n: L2('Zorn-Ring', 'Wrath Ring') }, { c: '#e056a0', hc: 100, n: L2('Lust-Ring', 'Lust Ring') }, { c: '#ff8f1f', hc: 100, n: L2('Gier-Ring', 'Greed Ring') },
    { c: '#e53935', hc: 150, n: L2('Völlerei- und Neid-Ring', 'Gluttony & Envy Ring') }, { c: '#fdd835', hc: 150, n: L2('Stolz-Ring', 'Pride Ring') }, { c: '#2e9a4a', hc: 200, n: L2('Ars Goetia', 'Ars Goetia') }, { c: '#283593', hc: 200, n: L2('Königshaus', 'Royal Court') }
  ];
  var R = {
    60: [[2, 10, 30, 90, 160, 250], [4, 20, 60, 180, 320, 450]], 100: [6, 30, 90, 270, 400, 550], 120: [8, 40, 100, 300, 450, 600], 140: [10, 50, 150, 450, 625, 750], 160: [12, 60, 180, 500, 700, 900],
    180: [14, 70, 200, 550, 750, 950], 200: [16, 80, 220, 600, 800, 1000], 220: [18, 90, 250, 700, 875, 1050], 240: [20, 100, 300, 750, 925, 1100], 260: [22, 110, 330, 800, 975, 1150],
    280: [24, 120, 360, 850, 1025, 1200], 300: [26, 130, 390, 900, 1100, 1275], 320: [28, 150, 450, 1000, 1200, 1400], 350: [35, 175, 500, 1100, 1300, 1500], 400: [50, 200, 600, 1400, 1700, 2000]
  };
  var F = [];
  function st(de, en, g, price, k) { F.push({ t: 'st', n: L2(de, en), g: g, price: price, rent: price === 60 ? R[60][k] : R[price] }); }
  function sp(t, de, en, ico, extra) { var o = { t: t, n: L2(de, en), ico: ico }; for (var k in extra || {}) o[k] = extra[k]; F.push(o); }
  sp('go', 'Imp City', 'Imp City', '😈');
  st('I.M.P.-Büro', 'I.M.P. Office', 0, 60, 0); sp('pact', 'I.M.P.-Auftrag', 'I.M.P. Job', '📋'); st('Blitzøs Wohnung', 'Blitzø’s Apartment', 0, 60, 1); sp('tax', 'Seelensteuer', 'Soul Tax', '💸', { amt: 200 });
  sp('ferry', 'Portal zur Erde', 'Portal to Earth', '🌀', { price: 200 });
  st('Harvest-Moon-Festival', 'Harvest Moon Festival', 1, 100); sp('fate', 'Grimoire', 'Grimoire', '📖'); st('Millies Familienfarm', 'Millie’s Family Farm', 1, 100); st('Zorn-Ring-Rodeo', 'Wrath Ring Rodeo', 1, 120);
  sp('jail', 'Imp-City-Knast', 'Imp City Jail', '⛓️');
  st('Ozzie’s', 'Ozzie’s', 2, 140); sp('util', 'Höllenfeuer-Werk', 'Hellfire Works', '🌋', { price: 150 }); st('Asmodeus’ Palast', 'Asmodeus’ Palace', 2, 140); st('Fizzarollis Bühne', 'Fizzarolli’s Stage', 2, 160);
  sp('ferry', 'Höllen-Taxi', 'Hell Taxi', '🚕', { price: 200 });
  st('Mammons Studio', 'Mammon’s Studio', 3, 180); sp('pact', 'I.M.P.-Auftrag', 'I.M.P. Job', '📋'); st('Crimsons Casino', 'Crimson’s Casino', 3, 180); st('Cash Buckzos Zirkus', 'Cash Buckzo’s Circus', 3, 200);
  sp('free', 'Loonas Couch', 'Loona’s Couch', '🛋️');
  st('Beelzebubs Party-Villa', 'Beelzebub’s Party Villa', 4, 220); sp('fate', 'Grimoire', 'Grimoire', '📖'); st('Völlerei-Buffet', 'Gluttony Buffet', 4, 220); st('Neid-Ring-Basar', 'Envy Ring Bazaar', 4, 240);
  sp('ferry', 'Grimoire-Portal', 'Grimoire Portal', '🌀', { price: 200 });
  st('Loo Loo Land', 'Loo Loo Land', 5, 260); st('Verosikas Konzert', 'Verosika’s Concert', 5, 260); sp('util', 'Seelen-Kraftwerk', 'Soul Power Plant', '⚡', { price: 150 }); st('Pride-Ring-Mall', 'Pride Ring Mall', 5, 280);
  sp('gojail', 'Ausrottungstag!', 'Extermination Day!', '👼');
  st('Goetia-Akademie', 'Goetia Academy', 6, 300); st('Stolas’ Sternwarte', 'Stolas’ Observatory', 6, 300); sp('pact', 'I.M.P.-Auftrag', 'I.M.P. Job', '📋'); st('Paimons Anwesen', 'Paimon’s Estate', 6, 320);
  sp('ferry', 'Stolas’ Kutsche', 'Stolas’ Carriage', '🦉', { price: 200 });
  sp('fate', 'Grimoire', 'Grimoire', '📖'); st('Stolas’ Herrenhaus', 'Stolas’ Mansion', 7, 350); sp('tax', 'Mammons Gebühr', 'Mammon’s Fee', '💸', { amt: 100 }); st('Luzifers Palast', 'Lucifer’s Palace', 7, 400);
  F.forEach(function (f, i) { f.i = i; if (f.t === 'st') { f.hc = GROUPS[f.g].hc; } });
  // Grimoire (Ereigniskarten)
  var FATE = [
    { a: 'to', f: 0, d: L2('Zurück nach Imp City! Kassiere 200.', 'Back to Imp City! Collect 200.') },
    { a: 'to', f: 39, d: L2('Eine Einladung zu Luzifers Palast. Rücke vor.', 'An invitation to Lucifer’s Palace. Advance.') },
    { a: 'to', f: 21, d: L2('Beelzebub schmeißt eine Party: Rücke vor zu ihrer Villa. Über Imp City kassierst du 200.', 'Beelzebub is throwing a party: advance to her villa. Passing Imp City pays 200.') },
    { a: 'to', f: 11, d: L2('Ozzie’s hat noch einen Tisch frei. Rücke vor.', 'Ozzie’s has a table free. Advance.') },
    { a: 'ferry', d: L2('Das Grimoire öffnet ein Portal: Rücke zum nächsten Portal oder Fahrzeug vor. Gehört es jemandem, zahle doppelt.', 'The grimoire opens a portal: advance to the nearest portal or ride. If owned, pay double.') },
    { a: 'ferry', d: L2('Blitzø „leiht“ sich das Grimoire: Rücke zum nächsten Portal oder Fahrzeug vor. Gehört es jemandem, zahle doppelt.', 'Blitzø “borrows” the grimoire: advance to the nearest portal or ride. If owned, pay double.') },
    { a: 'util', d: L2('Stromausfall in Imp City: Rücke zum nächsten Werk vor. Gehört es jemandem, würfle und zahle das Zehnfache.', 'Power outage in Imp City: advance to the nearest works. If owned, roll and pay ten times the roll.') },
    { a: 'back', n: 3, d: L2('Loona hat keine Lust. Gehe 3 Felder zurück.', 'Loona can’t be bothered. Go back 3 fields.') },
    { a: 'jail', d: L2('Erwischt beim Auftrag auf der Erde! Ab in den Knast, ohne über Imp City zu gehen.', 'Caught on a job on Earth! Go straight to jail without passing Imp City.') },
    { a: 'free', d: L2('Stolas zieht ein paar Fäden: Du kommst aus dem Knast frei. Behalte die Karte.', 'Stolas pulls some strings: get out of jail free. Keep this card.') },
    { a: 'money', n: 50, d: L2('Ein Auftrag läuft ausnahmsweise glatt: Kassiere 50.', 'For once a job goes smoothly: collect 50.') },
    { a: 'money', n: -15, d: L2('Moxxie hat sich in der Bestellung vertan: Zahle 15.', 'Moxxie got the order wrong: pay 15.') },
    { a: 'repair', h: 25, p: 100, d: L2('Millie war zu enthusiastisch: Zahle 25 je Haus und 100 je Palast für Reparaturen.', 'Millie got a bit too enthusiastic: pay 25 per house and 100 per palace for repairs.') },
    { a: 'each', n: -50, d: L2('Du gibst eine Runde bei Ozzie’s aus: Zahle jedem Spieler 50.', 'You buy a round at Ozzie’s: pay each player 50.') },
    { a: 'money', n: 150, d: L2('Mammon zahlt dir Werbegeld: Kassiere 150.', 'Mammon pays you for an ad: collect 150.') },
    { a: 'to', f: 5, d: L2('Ab durchs Portal zur Erde! Über Imp City kassierst du 200.', 'Through the portal to Earth! Passing Imp City pays 200.') }
  ];
  // I.M.P.-Aufträge (Gemeinschaftskarten)
  var PACT = [
    { a: 'to', f: 0, d: L2('Feierabend: Zurück nach Imp City. Kassiere 200.', 'Quitting time: back to Imp City. Collect 200.') },
    { a: 'money', n: 200, d: L2('Ein reicher Kunde zahlt doppelt: Kassiere 200.', 'A rich client pays double: collect 200.') },
    { a: 'money', n: -50, d: L2('Arztrechnung nach dem letzten Auftrag: Zahle 50.', 'Doctor’s bill after the last job: pay 50.') },
    { a: 'money', n: 50, d: L2('Du verkaufst Blitzøs alte Pferde-Poster: Kassiere 50.', 'You sell Blitzø’s old horse posters: collect 50.') },
    { a: 'free', d: L2('Loona kennt den Wärter: Du kommst aus dem Knast frei. Behalte die Karte.', 'Loona knows the guard: get out of jail free. Keep this card.') },
    { a: 'jail', d: L2('Der Ausrottungstag erwischt dich: Ab in den Knast, ohne über Imp City zu gehen.', 'Extermination Day catches you: go straight to jail without passing Imp City.') },
    { a: 'money', n: 100, d: L2('Ein Auftrag für Stolas wird bezahlt: Kassiere 100.', 'A job for Stolas gets paid: collect 100.') },
    { a: 'money', n: 20, d: L2('Steuerrückzahlung aus Imp City: Kassiere 20.', 'Imp City tax refund: collect 20.') },
    { a: 'each', n: 10, d: L2('Du hast Geburtstag, Loona hat sogar daran gedacht: Jeder Spieler zahlt dir 10.', 'It’s your birthday and Loona even remembered: every player pays you 10.') },
    { a: 'money', n: 100, d: L2('Moxxie findet einen Fehler in der Buchhaltung zu deinen Gunsten: Kassiere 100.', 'Moxxie finds an accounting error in your favour: collect 100.') },
    { a: 'money', n: -100, d: L2('Ein Auftrag geht komplett schief: Zahle 100 Schadensersatz.', 'A job goes completely wrong: pay 100 in damages.') },
    { a: 'money', n: -50, d: L2('Teambuilding im Freizeitpark: Zahle 50.', 'Team building at the theme park: pay 50.') },
    { a: 'money', n: 25, d: L2('Trinkgeld vom Kunden: Kassiere 25.', 'A tip from the client: collect 25.') },
    { a: 'repair', h: 40, p: 115, d: L2('Das Büro wurde mal wieder zerschossen: Zahle 40 je Haus und 115 je Palast.', 'The office got shot up again: pay 40 per house and 115 per palace.') },
    { a: 'money', n: 10, d: L2('Zweiter Platz beim Talentwettbewerb von Imp City: Kassiere 10.', 'Second place at the Imp City talent show: collect 10.') },
    { a: 'money', n: 100, d: L2('Ein Erbe aus dem Zorn-Ring: Kassiere 100.', 'An inheritance from the Wrath Ring: collect 100.') }
  ];
  window.HT = {
    F: F, GROUPS: GROUPS, FATE: FATE, PACT: PACT,
    TOKENS: ['😈', '🔫', '🪓', '🐺', '🦉', '🃏'],
    CHARS: ['Blitzø', 'Moxxie', 'Millie', 'Loona', 'Stolas', 'Fizzarolli'],
    COLORS: ['#ff3d3d', '#ffb300', '#3ddc84', '#b0b0c8', '#c86bff', '#ff7ac6'],
    DECKN: { fate: L2('Grimoire', 'Grimoire'), pact: L2('I.M.P.-Auftrag', 'I.M.P. Job') }
  };
})();

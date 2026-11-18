// Wortlisten: je Kategorie drei Stufen (1 = leicht, 2 = mittel, 3 = schwer)
window.ACT_WORDS = {
  draw: [
    ['Haus','Baum','Sonne','Katze','Fisch','Auto','Blume','Apfel','Herz','Stern','Mond','Hund','Boot','Buch','Brille','Schuh','Uhr','Regenschirm','Ei','Kuchen','Fahrrad','Eis','Schnecke','Pilz','Banane'],
    ['Leuchtturm','Wasserfall','Schneemann','Hängebrücke','Zahnbürste','Windmühle','Kaktus','Papagei','Fernseher','Schaukel','Vulkan','Staubsauger','Eiffelturm','Spinnennetz','Wecker','Pinguin','Schatzkiste','Hubschrauber','Gitarre','Zirkuszelt','Wohnwagen','Fußball','Kamel','Strandkorb','Tintenfisch'],
    ['Zeitmaschine','Schwerkraft','Erdbeben','Klimawandel','Bestechung','Heimweh','Kopfsteinpflaster','Sanduhr','Wasserkreislauf','Mondfinsternis','Lieferdrohne','Gewissen','Dornröschen','Marathonlauf','Fließband','Wünschelrute','Seifenblase','Nordlicht','Perpetuum mobile','Trojanisches Pferd','Rettungsring','Sonnenfinsternis','Eselsohr','Achterbahn','Schweizer Taschenmesser']
  ],
  mime: [
    ['Schlafen','Duschen','Zähneputzen','Telefonieren','Schwimmen','Tanzen','Essen','Weinen','Lachen','Joggen','Angeln','Kochen','Singen','Lesen','Klatschen','Autofahren','Boxen','Gähnen','Niesen','Winken','Husten','Radfahren','Staubsaugen','Bügeln','Fotografieren'],
    ['Zelt aufbauen','Reifen wechseln','Schneemann bauen','Gitarre spielen','Eis essen','Fenster putzen','Torte anschneiden','Luftballon aufblasen','Seil springen','Kaugummi kauen','Spiegelei braten','Geschenk einpacken','Skifahren','Bergsteigen','Fallschirm springen','Pizza backen','Hund Gassi führen','Stau im Auto','Zahnarztbesuch','Wäsche aufhängen','Klavier spielen','Angst haben','Bowling spielen','Wasserski fahren','Boot rudern'],
    ['Lampenfieber','Sonnenbrand','Muskelkater','Schluckauf','Verkehrskontrolle','Bewerbungsgespräch','Zeitlupe','Vorstellungsgespräch','Hochzeitsantrag','Schlafwandeln','Fahrstuhl steckt fest','Fahrprüfung','Reklamation','Rückwärts einparken','Brennnessel berühren','Schnäppchenjagd','Seekrankheit','Lügendetektor','Taschendieb','Warteschlange','Kopfstand','Dornenhecke','Ohrwurm','Selfie machen','Streit schlichten']
  ],
  explain: [
    ['Geburtstag','Sommer','Feuerwehr','Zirkus','Schule','Krankenhaus','Weihnachten','Frühstück','Flughafen','Bauernhof','Supermarkt','Schwimmbad','Kino','Friseur','Bibliothek','Bäckerei','Geschenk','Spielplatz','Zoo','Sonnencreme','Regenbogen','Gewitter','Schokolade','Rucksack','Fernbedienung'],
    ['Ohrfeige','Handwerker','Quittung','Stundenplan','Gartenzwerg','Wunschzettel','Mitfahrgelegenheit','Gebrauchsanweisung','Hausmeister','Steuererklärung','Schlussverkauf','Warteschlange','Vorfahrt','Kleingeld','Bewerbung','Schlüsselbund','Kopfkissen','Taschenrechner','Ersatzteil','Trinkgeld','Lieferdienst','Nachbarschaft','Vorsprung','Zeitumstellung','Haushaltsgeld'],
    ['Gerechtigkeit','Nostalgie','Verschwörung','Inflation','Demokratie','Datenschutz','Wettbewerb','Zeitgeist','Schadenfreude','Fernweh','Kompromiss','Nachhaltigkeit','Selbstironie','Ehrgeiz','Vorurteil','Gewohnheit','Rücksichtnahme','Bürokratie','Zivilcourage','Verantwortung','Fingerspitzengefühl','Weltanschauung','Prokrastination','Understatement','Mehrwertsteuer']
  ]
};
window.ACT_CATS = {
  draw: { n: ['Zeichnen', 'Drawing'], ico: '✏️', hint: ['Zeichne den Begriff. Keine Buchstaben und Zahlen!', 'Draw the word. No letters or numbers!'] },
  mime: { n: ['Pantomime', 'Mime'], ico: '🎭', hint: ['Stelle den Begriff ohne Worte und Geräusche dar.', 'Act the word out without words or sounds.'] },
  explain: { n: ['Erklären', 'Explain'], ico: '💬', hint: ['Erkläre den Begriff mit Worten, ohne ihn (oder Teile davon) zu nennen.', 'Explain the word without saying it (or parts of it).'] }
};
// Eingabe vergleichen: ohne Groß-/Kleinschreibung, Umlaute, Artikel und Satzzeichen; bei längeren Wörtern ein Tippfehler erlaubt
window.actNorm = function (s) {
  s = String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.replace(/^(der|die|das|ein|eine|einen|einem|einer|the|a|an) /, '');
};
window.actMatch = function (guess, word) {
  var a = actNorm(guess), b = actNorm(word); if (!a || !b) return false; if (a === b) return true;
  if (b.length < 6 || Math.abs(a.length - b.length) > 1) return false;
  var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; } for (var j = 1; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 1;
};

# Offene Wünsche (Stand 2026-11-12, noch nicht umgesetzt)

Reihenfolge ist nur ein Vorschlag. Jeder Punkt stammt vom Besitzer und ist noch nicht begonnen.

## Mädn Teams (liegende Acht und Ring)
1. **3D wie bei Mädn:** Die 3D-Ansicht soll den ganzen Bildschirm füllen (nicht nur ein Fenster im Seitenlayout), so wie die 3D-Ansicht bei Mensch ärgere dich nicht (`body.full3d`). Der Vollbildknopf von v3.16.0 war nicht das Gemeinte.
2. **Würfeln über das Spielfeld (3D):** Die Würfel werden über die ganze Spielfläche geworfen, kein Tablett. Sie starten immer von der Seite, von der man gerade aufs Brett schaut (Kameraseite). Der Abwurf soll **höher** starten, weil der Wurf sonst in einer Spielfigur beginnen kann. Gilt auch für den Rechenwürfel (Tetraeder).
3. **Dark- und Cyber-Version** für Mädn Teams (Stile wie bei den anderen Spielen, siehe `cyber.css`, `dark.css`, `theme.js`).

## Mensch ärgere dich nicht und Mädn Teams
4. **Würfelposition** auch bei Mädn (nicht nur Teams): Start von der Kameraseite, höher abwerfen (der Würfel kann sonst in einer Figur starten).
5. **Zugtimer 30 Sekunden:** Danach wirft das Spiel automatisch. Bei **3 automatischen Würfen hintereinander** wird der Spieler aus dem Spiel geworfen und zum Bot (um Fehler beim Verlassen zu vermeiden). Gilt für Mädn und Mädn Teams.

## Mensch ärgere dich nicht
6. **Orb in der Mitte entfernen** (in allen Stilen: Kugel im Cyber-Stil, Säule/Kugel im Standard-Stil) und durch etwas **Flaches ohne Kollision** ersetzen, das man auch in 2D sieht. Die Würfelkollision mit der Mitte (`diceObstacles`, Eintrag `[0,0,.5,.9]`) entfernen.
7. **Cyber, Tron-Linien:** Die Linien laufen nicht mehr von der Mitte zum Rand, sondern von der Mitte zu den **Figuren des Spielers am Zug und zu seinen Feldern** und lassen diese kurz aufleuchten. Der Rand färbt sich danach trotzdem wie jetzt ein (`tronSweep3`, `tron2d`, `edgeTo3`).

## Zollkreuzwort (Handy)
8. Bei **jedem Tipp** wird die Ansicht verschoben bzw. zurückgesetzt. Das muss aufhören (Zoom/Scroll beim Eintippen behalten).
9. **Hinweis-Buchstaben** (die man sich als Hinweis geben lässt) dürfen nicht überschrieben werden.
10. **Wort eintippen über bereits gesperrte Buchstaben** (Hinweis-Buchstaben oder Buchstaben eines gelösten Wortes):
    - Tippt man einen **anderen** Buchstaben, wird das gesperrte Feld **übersprungen**, der Buchstabe kommt ins nächste freie Feld.
    - Tippt man **denselben** Buchstaben, wird **nicht übersprungen**, sondern das Feld zählt als eingegeben (man gibt dann das ganze Wort ein, oder das Wort ohne den schon vorhandenen Buchstaben).
11. **Abgeschlossene Wörter werden gesperrt** und lassen sich nicht mehr ändern.

## Kleinigkeiten (nachgetragen)
12. **Zollkreuzwort:** Die Tasten ö, ä, ü sollen direkt als **OE, AE, UE** eingetragen werden (zwei Buchstaben, Eingabe springt entsprechend weiter).
13. **Mädn Teams, Vierseiter (D4):** soll **bouncier** werden (mehr Federn auf dem Tisch und an den Banden). In `dice3d.js` gibt es dafür bisher nur die gemeinsamen Kontaktmaterialien (`mDie` mit Boden `restitution: .5`, Wände `.8`); für den Tetraeder ein eigenes Material mit höherem Rückprall anlegen (`b._k === 'd4'`).

## Rückfragen, bevor es losgeht
- Punkt 1: Soll die Ansicht beim Start gleich in 3D-Vollbild öffnen oder nur per Knopf, wie bei Mädn? Wie bei Mädn gehört dann die untere Bedienleiste (Würfel, Hinweise) dazu.
- Punkt 5: Zählt der Timer nur bei Online-Spielern oder auch am lokalen Gerät? Der Bot-Wechsel ist online durch `onSeatDrop`/`away` schon vorgesehen; lokal gibt es keine zweite Person, die ihn verlässt.
- Punkt 6: Wie soll das flache Mittelzeichen aussehen (Logo, Ring, Schriftzug „MÄDN“)?

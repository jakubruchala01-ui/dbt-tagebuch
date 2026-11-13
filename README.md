# DBT-Tagebuch

Persönliche App für Diary-Cards und DBT-Skills. Läuft im Browser, speichert **nur lokal** auf diesem Gerät.
Nichts wird ins Internet gesendet. Keine Konten, keine Cloud, keine Fremd-Bibliotheken.

## Starten

Doppelklick auf `start.bat` → öffnet `http://127.0.0.1:8765/`.
Voraussetzung: Python (ist installiert). Fenster offen lassen, solange die App läuft.

Wichtig: Immer genau diese Adresse benutzen (`127.0.0.1:8765`).
Der Browser speichert die Daten pro Adresse – `localhost:8765` oder ein anderer Port wäre ein leeres Tagebuch.

## Was die App kann

| Bereich | Inhalt |
| --- | --- |
| **Farbe mit Bedeutung** | Gedämpfte Bereichsfarben (Befinden blau, Problemverhalten rosé, Neue Wege petrol, Aktivitäten grün, Ereignisse bernstein, PC & Koffein schiefer, Medikamente oliv) in Karte, Verlauf, Wochenbalken und PDF. Die vier DBT-Module mit eigener Farbe (Achtsamkeit violett, Stresstoleranz bernstein, Emotionsregulation rosé, Zwischenmenschliches blau). Gruß nach Tageszeit, eigene Farbwelt je Übung. Alle Töne nach WCAG AA geprüft, hell und dunkel. Eigene Bereiche bekommen automatisch eine feste Farbe. |
| **Druckarm begleiten** | Keine Serien/Streaks, leere Tage neutral, **Tonfall** wählbar (Sanft / Klar / Direkt): fehlende Karten der letzten 7 Tage werden je nach Tonfall benannt, mit „Schnell nachtragen“ pro Tag oder **Notiz zur Lücke** (Grund + Satz, erscheint im PDF). **Schnell-Karte** mit den 6 Befinden-Werten (in der Vorlage änderbar), auch zum Nachtragen. Nach dem Speichern anerkennende Sätze statt Bewertung; bei hohen belastenden Werten ein ruhiges Skill-Angebot (abschaltbar, Schwelle einstellbar). **Skill üben**: geführte Übungen offline (Ruhig atmen mit Atemkreis, 5-4-3-2-1, TIPP, Sinnesreiz, STOP), auch im ♥-Fenster, am Ende als Skill eintragbar. **Merken** (oben): Themen für die nächste Stunde sammeln, als „besprochen“ abhaken, eigene PDF-Seite „Für die nächste Stunde“. |
| **Bedienung** | Speichert automatisch (Karte und Ketten), „Karte abschließen“ als Hauptknopf. Am Handy Navigation unten. Bereiche der Karte einklappbar mit Fortschritt („3/6“), Schalter „Nur das Wichtigste“ (Felder in der Vorlage per „Kurzansicht“ wählbar). Regler mit Pfeiltasten bedienbar und für Bildschirmleser beschriftet. Eigene Rückfragen statt Browser-Dialoge. |
| **Woche** (Start) | Woche ab dem Therapietag: „Heutige Karte“ mit Ausfüllen-Knopf, Kacheln (erfasste/abgeschlossene Tage, Tage mit Skills, Problemverhalten – jeweils mit Vorwoche), Balken der Belastung pro Tag, Tagesliste mit Kurzinfo. |
| **Karte** | Tageskarte: Skalen mit großen − / + Tasten (leer = „Offen“), Status **Entwurf / Abgeschlossen**, Skills mit Wirkung 0–5, Medikamente, Verhaltensketten des Tages. |
| **Ketten** | Assistent in 7 Schritten mit Fortschrittsleiste und Ketten-Vorschau. Verhaltenskette (Kettenanalyse): Problemverhalten, Auslöser, Verletzlichkeit, Kettenglieder (Gedanke, Gefühl, Körper, Drang, Handlung …), Folgen, Lösungsanalyse, hilfreiche Skills, Vorbeugung, Wiedergutmachung. Archivieren statt Löschen. |
| **ⓘ Erklärungen** | Neben Feldnamen ein i-Knopf mit Erklärung, eigener Notiz („was meine Therapeutin sagt“) und Haken „muss noch geklärt werden“. Solange der Haken gesetzt ist, ist das i **signalrot** und oben auf der Karte steht, wie viele Punkte offen sind. Für die sechs Befinden-Punkte sind Erklärungen vorbelegt; jedes Feld kann unter Vorlage eine bekommen. |
| **Verlauf** | Tabelle der letzten Tage, Werte farblich nach Stärke. Klick auf einen Tag öffnet ihn. |
| **PDF** | Druckfertige Diary-Card (A4 quer) pro Woche: Wochenspalte mit Ø/Summen, Spalte **Vorwoche** zum Vergleich, Skills, Medikamente, Ereignisse & Notizen, optional Verhaltensketten als eigene Seite. Beispiel: [docs/Muster-Diary-Card.pdf](docs/Muster-Diary-Card.pdf) (Musterdaten). |
| **Mehr → Vorlage** | Nach Bereichen gegliedert. Felder anlegen, umbenennen, sortieren, ausblenden. Typen: Skala, Ja/Nein, Zahl mit Einheit, Freitext, Medikamentenliste, Auswahl (antippen, eine oder mehrere). Verhaltens-Baukasten mit Messarten, „+ Messart“ bei bestehenden Verhalten, einzelne Felder (Menge/Zeit, Skala, Ja/Nein). |
| **Mehr → Skills** | DBT-Skills nach Modulen, eigene hinzufügen, umbenennen, ausblenden, als Notfall-Skill (♥) markieren. |
| **Mehr → Einstellungen & Daten** | Aussehen: Automatisch/Hell/Dunkel; helle Designs Salbei, Bernstein, Nebelblau, Lavendel; dunkles Design immer Dunkelgrau mit wählbarem Akzent (Mint, Blau, Lavendel, Petrol, Bernstein, Rosé) – alle Kontraste nach WCAG AA geprüft. Tonfall, Erinnerung (Handy-App: Mitteilungen bis zur Karte; Browser: Kalender-Termin), Therapietag (Woche z. B. Fr–Do), PIN-Sperre, **eigene Notfallkontakte**, Notfallplan, Export/Import, dauerhafter Speicher. |
| **Mehr → Datenschutz** | Was gespeichert wird, wo es liegt, wie man alles löscht. Entwurf für den Store: [docs/DATENSCHUTZ.md](docs/DATENSCHUTZ.md). |
| **♥ Hilfe** (immer oben) | Notrufnummern zum Antippen (112, eigene Kontakte, Telefonseelsorge, 116 117), eigener Notfallplan, Notfall-Skills. Beim ersten Start ein kurzer Hinweis. |

**PIN-Sperre:** fragt beim Öffnen und nach 1 Minute im Hintergrund nach der PIN. Sie schützt vor neugierigen Blicken,
**verschlüsselt aber nichts**. Die PIN wird nur als Hash gespeichert. Wer sie vergisst, kann sie am Sperrbildschirm entfernen
(„PIN ENTFERNEN“ eintippen) – die Einträge bleiben erhalten.

## Start-Vorlage

Nach der Papier-Diary-Card: angenehme/unangenehme Ereignisse, Belastung, Selbstmitgefühl, Suizidgedanken,
Erholsamkeit des Schlafes, dissoziative Symptome, Vertrauen in die Therapie (je 0–5), Neue Wege I/II,
Skills angewendet, Bewegung/Sport (0–6, 6 = zu viel), angenehme Aktivitäten, Therapie-Aufgaben,
ein neutrales „Verhalten 1“ (Drang, Gemacht?, Gefühl danach), Medikamente, Notiz. Alles umbenenn- und ausblendbar.
Die Start-Vorlage ist bewusst neutral (keine persönlichen Beispiele), weil der Code ggf. öffentlich gehostet wird.
Die eigene Vorlage kommt per Import oder über den Verhaltens-Baukasten dazu.

**Verhaltens-Baukasten** (Vorlage → „Verhalten hinzufügen“): Für jedes Verhalten – Sucht, alte Gewohnheit, Hobby,
neuer Weg – wählst du, *was* du beobachten willst: Drang, Gemacht?, Wie oft, Wie lange, Wie viel (eigene Einheit),
Wann (morgens … nachts), Gefühl währenddessen, Gefühl danach, Auslöser, Skill statt Verhalten?, Dran gedacht?, Ausprobiert.
Startauswahlen (Bildschirm/Gaming, Essattacke, Substanz, Krisenverhalten, Alte Gewohnheit, Neuer Weg) setzen nur Häkchen vor.
Bei bestehenden Verhalten ergänzt „+ Messart“ weitere Fragen – alte Einträge bleiben vollständig.

**Medikamente:** Mit dem runden „+“ eine Zeile anlegen: Name, Dosis, Einheit (g/mg/µg).
Gespeicherte Medikamente werden beim Tippen vorgeschlagen und füllen Dosis und Einheit aus.
„wie zuletzt“ übernimmt die Liste vom letzten Eintrag.
Unter Vorlage → Weitere Aktionen lässt sich dieser Standard jederzeit wieder übernehmen (ohne Datenverlust).

## Anpassen ohne Datenverlust

- Jede gespeicherte Änderung der Vorlage wird eine neue **Version** (v1, v2, …). Alte Versionen bleiben erhalten.
- Felder und Skills haben feste IDs. Umbenennen ändert nur den Anzeigenamen – alte Einträge bleiben zugeordnet.
- Statt Löschen gibt es **Ausblenden**. Ausgeblendete Felder erscheinen nicht mehr in neuen Einträgen,
  alte Einträge zeigen sie weiterhin an.
- Der Typ eines Feldes ist fest, sobald es einmal gespeichert wurde (sonst passen alte Werte nicht mehr).

Details: [docs/DATENMODELL.md](docs/DATENMODELL.md)

## Aufs Handy

Web-Version (PWA) über GitHub Pages: [docs/HANDY.md](docs/HANDY.md).
Echte Android-/iOS-App mit Capacitor, gebaut auf GitHub: [docs/APP-BAUEN.md](docs/APP-BAUEN.md).

## Sicherung

Die Daten liegen im Browser-Speicher (IndexedDB). Wer die Browserdaten löscht, löscht das Tagebuch.
Deshalb regelmäßig unter **Mehr → Einstellungen & Daten → Exportieren** eine JSON-Datei sichern, am besten auf eine andere Platte als „Elements“ (B:/D:).
Die Export-Datei ist **nicht verschlüsselt** – sie enthält Gesundheitsdaten im Klartext.
Ab 3 Karten erinnert die Startseite sanft, wenn die letzte Sicherung über 30 Tage her ist („Später“ = eine Woche Ruhe).

## Ordner

```text
DBT-Tagebuch\
  start.bat            startet lokalen Server + Browser
  app\                 die App (HTML, CSS, JS, PWA-Dateien)
    js\db.js           Speicher (IndexedDB)
    js\model.js        Datenmodell, Versionierung
    js\defaults.js     Start-Vorlage und Standard-Skills
    js\app.js          Oberfläche (Woche, Karte, Verlauf, PDF, Vorlage, Skills, Einstellungen)
    js\ketten.js       Verhaltensketten
    js\sicherheit.js   PIN-Sperre
    js\ui.js           gemeinsame Helfer (Datum, Overlay, Meldungen)
    js\plattform.js    Browser vs. Handy-App (Teilen, Erinnerungen, Bildschirmschutz)
    js\bericht.js      PDF-Bericht (HTML für den Druck)
    bericht.css        Design des PDF-Berichts
  docs\               Datenmodell, Handy, App bauen, Datenschutz
  assets\             App-Symbol und Startbild für Android/iOS
  capacitor.config.json, package.json   Handy-App (Capacitor)
  .github\workflows\  GitHub: Web-Version veröffentlichen, APK bauen
```

## Ideen für später

- Verschlüsselung mit Passwort (Web Crypto, AES-GCM)
- Fingerabdruck-Entsperrung in der Handy-App
- „Angenehmstes / unangenehmstes Ereignis der Woche“ markieren
- Diagramme über mehrere Wochen, Export als CSV

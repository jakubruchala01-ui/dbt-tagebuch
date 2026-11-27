# Auftrag: Durchgang 3 (Tour, ?-Hilfe, runde Optik)

Autonom mit Kontrollinstanzen, sparsam mit dem Kontingent, aber ohne Qualitätseinbußen. Deutsch, kurz und klar.

## Zuerst lesen
- `docs/APP-BAUEN.md` → „Noch offen / später“ (ganzer Plan)
- `testberichte/9-Umbau-Plan.md` (letzter Durchgang, offene Reste)

## Umfang
1. **Reste:** Kasten „Dränge & Verhalten heute“ direkt nach „Befinden“. Baukasten bleibt nach „Hinzufügen“ offen.
   Platzhalter „Verhalten 1“ und „Neue Wege I/II“ in `app/js/defaults.js` verständlich benennen, **nur für neue Nutzer**. Bestehende Vorlagen bleiben unverändert, Jakub hat echte Daten.
2. **Tour beim ersten Start:** 4 Schritte, überspringbar, unter Mehr wiederholbar, ersetzt `zeigeHinweis`.
   Schritt 1: „Wie ausführlich möchtest du deine Karte?“ mit Einfach / Standard / Ausführlich (nutzt `tpl-preset`-Logik, nur Ausblenden, speichern).
   Datenschutz-Satz: „Deine Einträge bleiben nur auf diesem Handy. Niemand sonst kann sie sehen – auch nicht die Entwickler, die Klinik oder eine andere Stelle. Es gibt keine Kopie im Internet. Geht das Handy verloren oder wird die App gelöscht, sind sie weg. Sichere sie deshalb regelmäßig: Mehr → Einstellungen & Daten → Sicherung.“
   Krisenhinweis: 112, Telefonseelsorge, ♥ oben rechts.
3. **„?“-Hilfe** auf jeder Seite (Woche, Karte, Ketten, PDF, Mehr, Karte anpassen, Einstellungen): 3–5 Sätze ohne Fachwörter. Auf der Karte auch die Skalen-Wörter erklären und wann sich Anpassen lohnt.
4. **Runde, ruhige Optik:** Karten ca. 20 px gerundet, Pillen-Knöpfe und -Chips, weiche Schatten statt Rahmen, mehr Abstand.
   Gedämpfte Farben, je Bereich ein Akzent, keine Vollfarben, keine Fotos. Hell und Dunkel prüfen (`app/style.css`, `app/js/design.js`).
   Schrift (z. B. Nunito) nur lokal als woff2 mit OFL-Lizenz, nie aus dem Internet laden (CSP `'self'`, offline). Sonst Systemschrift.
5. **Bei PDF und Export** der Hinweis: „Nicht per Messenger, Mail oder Cloud verschicken – in der Stunde zeigen oder ausdrucken.“

**Nicht dabei:** Gruppen-Vorlage als Datei, Aufteilen von `app.js`, Signatur-Schlüssel.

## Ablauf mit Prüfern
1. Plan nach `testberichte/10-Durchgang-3-Plan.md` schreiben.
2. **Plan-Prüfer:** Agent mit Sonnet, nur lesend, höchstens 12 Aufrufe, Antwort höchstens 25 Zeilen. Fragen: nutzerorientiert? Risiko für Datenverlust? Gibt es einen einfacheren Weg?
3. Bauen, jeden Block kurz im Browser prüfen.
4. **Code-Review:** Agent mit Sonnet auf `git diff`, nur lesend, höchstens 15 Aufrufe.
5. **Browser-Tester:** Agent mit Sonnet, als „Jonas“ (dissoziiert, nur Handy) oder als neue Nutzerin beim ersten Start. Höchstens 30 Aufrufe, eigener Port, Handy-Größe.
6. Funde beheben, Protokoll an die Plan-Datei anhängen.

## Stolpersteine
- **Testen:** `python -m http.server <port> --bind 127.0.0.1` im Ordner `app/` im Hintergrund laufen lassen und danach stoppen. Jeder Port hat eigenen Speicher.
- **Eigene Tabs:** Browser-Werkzeuge **immer mit eigener tabId** aufrufen, sonst greift man in den Tab des Testers ein.
- **Service Worker:** den Cache-Namen in `app/sw.js` hochzählen, zuletzt `dbt-tagebuch-v16`.
- **Dateien ändern:** größere Änderungen als Python-Skript (mit dem Write-Werkzeug angelegt) mit Zählprüfung. Bash-Heredocs brechen bei Backticks und `${}`.
- **Git:** Der Autor ist repo-lokal gesetzt. Nur eigene Dateien committen. `testberichte/` ist absichtlich ignoriert.
- **Veröffentlichen:** Ein Push auf `main` aktualisiert die Web-Version. Der Tag `v0.1.8` baut die APK. Den Status liest man über `https://api.github.com/repos/jakubruchala01-ui/dbt-tagebuch/actions/runs`, mit einer Warteschleife im Hintergrund.

## Regeln
- Gesundheitsdaten bleiben lokal, nichts geht ins Internet. Keine Passwörter eingeben.
- Nichts endgültig löschen. Bestehende Einträge, Sicherungen, Verlauf und PDF müssen weiter funktionieren. Das Datenmodell bleibt, erlaubt sind nur optionale Zusatzangaben.

**Fertig, wenn:** alles gepusht ist, die APK v0.1.8 gebaut ist und das Protokoll geschrieben ist.
Die Abschlussmeldung enthält: was neu ist, was die Prüfer fanden, was offen bleibt und den Kontingentverbrauch.

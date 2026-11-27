# Android- und iOS-App bauen

Die App ist dieselbe wie im Browser, nur mit **Capacitor** als Handy-App verpackt.
In der Handy-App gibt es zusätzlich echte Erinnerungen (bis die Karte ausgefüllt ist), einen verborgenen Inhalt in der App-Übersicht
und das Sichern über „Teilen“. Gebaut wird auf **GitHub**, auf dem PC muss nichts installiert werden.

## Stand (13.11.2026)

| Plattform | Weg | Status |
| --- | --- | --- |
| Android | APK über GitHub Actions | vorbereitet, noch nicht gebaut |
| Android Play Store | später (einmalig 25 $, vorher 14 Tage Test mit 12 Testern) | offen |
| iPhone | vorerst Web-Version über Safari („Zum Home-Bildschirm“), ohne zuverlässige Erinnerungen | Web-Version geht |
| iPhone-App | braucht Apple-Entwicklerkonto (99 $/Jahr) | vorbereitet (`@capacitor/ios`), offen |
| Herausgeber | wer im Store und in der Datenschutzerklärung steht | **offen, mit der Klinik klären** |

## Ordner

| Datei | Zweck |
| --- | --- |
| `app/` | die App selbst (Web-Version und Inhalt der Handy-App) |
| `app/js/plattform.js` | alles, was sich zwischen Browser und Handy-App unterscheidet |
| `capacitor.config.json` | App-Name, App-ID `de.dbttagebuch.app` (vor dem ersten Store-Upload endgültig festlegen) |
| `package.json` | Capacitor und Plugins (Erinnerungen, Dateien, Teilen, Bildschirmschutz) |
| `assets/` | App-Symbol und Startbild, daraus erzeugt GitHub alle Größen |
| `.github/workflows/android.yml` | baut die APK |
| `.github/workflows/pages.yml` | veröffentlicht `app/` als Web-Version |

## Einmalig: GitHub einrichten

1. Neues Repository, z. B. `dbt-tagebuch` (öffentlich).
2. **Den ganzen Projektordner** hochladen, außer `node_modules`, `android`, `ios` (stehen in `.gitignore`).
   Wichtig: der versteckte Ordner `.github` muss mit. Am einfachsten mit **GitHub Desktop**.
3. *Settings → Pages → Source: **GitHub Actions***. Die Web-Version erscheint unter `https://<name>.github.io/dbt-tagebuch/`.

## APK bauen

1. Reiter **Actions** → „Android-App bauen“ → **Run workflow**.
2. Nach ca. 5–10 Minuten unten unter **Artifacts** `DBT-Tagebuch-APK` herunterladen (ZIP mit der APK).
3. APK aufs Handy, antippen, „Aus dieser Quelle installieren“ erlauben.

Ohne Signatur entsteht eine **Test-APK**: Vor jedem Update muss die alte Version deinstalliert werden, **dabei gehen die Daten verloren**
(vorher exportieren). Für echte Nutzer deshalb einmalig einen Schlüssel anlegen:

## Einmalig: Signatur-Schlüssel

Der Schlüssel beweist, dass ein Update von dir kommt. **Geht er verloren, kann niemand mehr Updates installieren.**
Zwei Kopien an verschiedenen Orten aufbewahren (nicht nur auf „Elements“ B:/D:), niemals ins Repository.

```powershell
keytool -genkeypair -v -keystore dbt-tagebuch.keystore -alias dbt -keyalg RSA -keysize 2048 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("dbt-tagebuch.keystore")) | Set-Clipboard
```

Dann auf GitHub unter *Settings → Secrets and variables → Actions → New repository secret*:

| Name | Wert |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Inhalt der Zwischenablage |
| `ANDROID_KEYSTORE_PASSWORT` | Passwort des Keystores |
| `ANDROID_KEY_ALIAS` | `dbt` |
| `ANDROID_KEY_PASSWORT` | Passwort des Schlüssels (oft dasselbe) |

## Was in der Handy-App anders ist

| Funktion | Browser | Handy-App |
| --- | --- | --- |
| Erinnerung | Kalender-Termin (.ics) | echte Mitteilungen, hören für heute auf, sobald etwas eingetragen ist |
| Sicherung exportieren | Download | Teilen-Menü („In Dateien speichern“, USB, Quick Share) |
| PDF-Bericht | Druckdialog | Bericht als Datei teilen, im Browser öffnen und drucken |
| App-Übersicht | zeigt Inhalt | Inhalt verborgen, keine Bildschirmfotos (abschaltbar: Einstellungen → Inhalt schützen) |
| Offline | Service Worker | immer offline |

## Noch offen / später

**Erledigt 28.11. (APK v0.1.6, auf dem Handy noch zu testen):** PDF über Android-Druckdialog (`native/android/DruckPlugin.java`),
keine Cloud-Sicherung/Geräte-Übertragung (allowBackup=false + dataExtractionRules), Exportkopie wird aus dem Cache gelöscht,
neutrale Mitteilung („Tagebuch“), CSP strenger. Datenschutz-Prüfung: `testberichte/8-Datenschutz-Pruefung.md`.
Offen daraus: Texte der Datenschutzseite ergänzen (Druckdienst, Teilen, Tastatur, Bildschirmfotos), Schalter „Notfallkontakte auf dem Sperrbildschirm zeigen“.

**(erledigt, siehe oben) PDF in der Handy-App lieferte nur eine HTML-Datei**
- Ursache: In der APK gibt es keinen Druckdialog, `berichtAlsDatei()` teilt deshalb HTML.
- Lösung A (bevorzugt): Android-Druckdialog über ein Druck-Plugin → „Als PDF speichern“, gleiches Layout wie im Browser.
  Plugin vorher prüfen (gepflegt, keine Netzwerkzugriffe, Capacitor 7).
- Lösung B: echte PDF-Datei in der App erzeugen (z. B. jsPDF, lokal mitgeliefert, kein Internet), dann teilen.
- Test: APK auf dem Handy → PDF erzeugen → in Dateien öffnen, Seiten und Umlaute prüfen.
- Übergang: PDF über die Web-Version im Browser (Drucken → Als PDF speichern).

**Nächstes Paket (besprochen 27.11.2026): Einstieg leicht machen**
- Tour beim ersten Start (4 Schritte, überspringbar, unter Mehr wiederholbar), ersetzt den alten Start-Hinweis
- „?“ oben auf jeder Seite mit 3–5 Sätzen zu genau diesem Bildschirm
- Fertige Vorlagen statt leerem Baukasten: Einfach / Standard / Ausführlich; Gruppen-Vorlage der Psychologin als Datei (nur Struktur, keine Daten)
- „Vorlage“ unter Mehr nach unten: „Karte anpassen (für später)“
- Text in der Tour: „Deine Einträge bleiben nur auf diesem Handy. Niemand sonst kann sie sehen – auch nicht die Entwickler, die Klinik oder eine andere Stelle. Es gibt keine Kopie im Internet. Geht das Handy verloren oder wird die App gelöscht, sind sie weg. Sichere sie deshalb regelmäßig: Mehr → Einstellungen & Daten → Sicherung.“
- Beim PDF und bei der Sicherung: „Nicht per Messenger, Mail oder Cloud verschicken – in der Stunde zeigen oder ausdrucken.“

**Dränge und Skills einfacher (Wunsch 27.11.2026)**
- Karte fragt zuerst „Dränge heute? Ja / Nein“. Nein = fertig, nichts weiter.
- Ja → Liste der eigenen gespeicherten Dränge (nur antippen, welche heute da waren) + darunter „+ Drang hinzufügen“.
  Nur angetippte Dränge bekommen Stärke 0–5 und „Habe ich es getan?“.
- Skalen beschriften. Drang: 0 kein · 1 kaum spürbar · 2 leicht · 3 deutlich · 4 stark · 5 kaum auszuhalten.
  Skill-Wirkung: 0 nicht geholfen · 1 kaum · 2 etwas · 3 spürbar · 4 deutlich · 5 sehr geholfen.
- Skills genauso: „Skills genutzt? Ja / Nein“ → eigene Skill-Liste antippen + „+ Skill hinzufügen“, Wirkung nur bei angetippten.
- Dränge ändern sich langsam: Liste zeigt die Dränge der letzten Tage zuerst, Knopf „Wie gestern“ übernimmt die Auswahl (Stärke trotzdem neu wählen, nichts automatisch eintragen).
- Skills als Kacheln/Chips zum Antippen (mehrere möglich), oft genutzte zuerst, Rest nach DBT-Modul aufklappbar
  (Achtsamkeit, Stresstoleranz, Gefühle regulieren, Zwischenmenschlich). Angetippte bekommen darunter die Wirkung 0–5.
- Alte Einträge und PDF müssen weiter funktionieren (Daten-Umbau prüfen).

**Zuerst bei vollem Kontingent: Datenschutz-Prüfung (Agent, nur lesend, Sonnet)**
- Android: automatische Google-Drive-Sicherung (`allowBackup`) – Verdacht: Tagebuch landet doch in der Cloud. Berechtigungen der APK, Mitteilungen ohne Inhalt
- Web: CSP blockiert wirklich alles nach außen? Service-Worker-Cache
- Export/PDF: Inhalt, verräterische Dateinamen · PIN: Texte ehrlich? · DATENSCHUTZ.md passt zum Code?
- Danach: echte Psychologin Texte gegenlesen lassen (Krisenhinweis, TIPP-Warnung, Skalen)

**Umbau-Pflicht: alte Daten übernehmen (Jakub nutzt die App bereits)**
- Vor dem Umbau eigene Sicherung exportieren. Neue Version muss alte Sicherungen (heutiges Format) importieren und umwandeln
  (Dränge/Skills/„Wie lange“ in neue Form, nichts verlieren). Sicherungsdatei bekommt Formatversion.
- Test: echte Alt-Sicherung (Kopie) importieren → Verlauf und PDF vergleichen, vorher/nachher gleich.

**Nach dem Umbau: Code-Prüfung auf Qualität („Slop“)**
- app.js hat ~1.900 Zeilen in einer Datei → beim Umbau in Module teilen (Karte, Vorlage, Einstellungen, Notfall)
- Danach Prüfung: doppelter Code, tote Funktionen, unklare Namen, fehlende Fehlerbehandlung (z. B. mit /simplify und /code-review)

**Vorlage aufräumen (Analyse: testberichte/7-Vorlage-Analyse.md)**
- Vorinstallierte Wege und Dränge sind alle aufgeklappt: man sieht nicht, was schon da ist → Doppelte, eigene Einträge unauffindbar.
  Lösung: kompakte Liste „Schon auf deiner Karte“ (eine Zeile je Eintrag, zugeklappt), eigene Einträge markiert/zuerst, Suche/Filter.
  Beim Hinzufügen Warnung bei ähnlichem Namen: „Gaming gibt es schon – trotzdem anlegen?“
- „Wie lange?“: Einheit wählbar Minuten / Stunden / Tage (PC-Spiel in Stunden). Intern immer in Minuten speichern und umrechnen,
  damit alte Einträge, Verlauf und PDF stimmen. Standard je Verhalten sinnvoll vorbelegen (Gaming: Stunden).

**Optik „runder“ (Inspiration: Insight Timer, MoodMission, Anxiety Check-In)**
- Erster Start: eine Frage „Wie ausführlich möchtest du deine Karte?“ mit großen Antworten (Einfach / Standard / Ausführlich / Vorlage meiner Therapeutin)
- Schnell-Karte als Schritt-für-Schritt: eine Frage pro Bildschirm, Fortschrittsbalken
- Formen: Karten stark gerundet (ca. 20 px), Knöpfe und Chips als Pillen, Wertewahl als runde Punkte, weiche Schatten statt Rahmen, mehr Abstand
- Schrift mit runden Formen (z. B. Nunito), lokal mitgeliefert, nicht von Google laden (Datenschutz, offline)
- Farben gedämpft, sanfte Verläufe, je Bereich nur ein Akzent. Keine Vollfarben, keine großen Fotos (Dissoziation, Krise)

- Fingerabdruck-Entsperrung (Plugin nötig)
- eigenes kleines Mitteilungs-Symbol (Android zeigt sonst ein einfaches Symbol)
- PDF direkt in der App erzeugen statt über den Browser
- iOS-App: Apple-Konto, Bau auf GitHub mit macOS, TestFlight
- Play Store: Datenschutzerklärung als öffentliche Seite (`docs/DATENSCHUTZ.md`), Herausgeber, Store-Texte, Bildschirmfotos
- Inhalte (Fragen, Erklärungen, Notfalltexte) von der Psychologin/Klinik gegenlesen lassen

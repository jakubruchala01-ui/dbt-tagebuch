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
| App-Übersicht | zeigt Inhalt | Inhalt verborgen, keine Bildschirmfotos |
| Offline | Service Worker | immer offline |

## Noch offen / später

- Fingerabdruck-Entsperrung (Plugin nötig)
- eigenes kleines Mitteilungs-Symbol (Android zeigt sonst ein einfaches Symbol)
- PDF direkt in der App erzeugen statt über den Browser
- iOS-App: Apple-Konto, Bau auf GitHub mit macOS, TestFlight
- Play Store: Datenschutzerklärung als öffentliche Seite (`docs/DATENSCHUTZ.md`), Herausgeber, Store-Texte, Bildschirmfotos
- Inhalte (Fragen, Erklärungen, Notfalltexte) von der Psychologin/Klinik gegenlesen lassen

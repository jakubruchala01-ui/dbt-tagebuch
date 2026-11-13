# DBT-Tagebuch aufs Handy

Damit das Handy die App **installieren** und **offline** nutzen kann, muss sie über **HTTPS** erreichbar sein.
Die App selbst ist dafür fertig vorbereitet (Manifest, Icons 192/512, Offline-Speicher).

**Wichtig vorab**
- Die Tagebuch-Daten liegen **immer nur im Browser des jeweiligen Geräts**. Der Server liefert nur die leere App aus –
  er sieht und speichert keine Einträge.
- PC und Handy haben **getrennte Tagebücher**. Umziehen: am PC *Mehr → Einstellungen & Daten → Exportieren*,
  Datei aufs Handy, dort *Importieren*.
- Auf dem Handy regelmäßig sichern (die Startseite erinnert daran).

## Möglichkeiten

| Weg | Kosten | Aufwand | Privatsphäre | Bemerkung |
| --- | --- | --- | --- | --- |
| **GitHub Pages** (empfohlen) | kostenlos | einmalig ~15 Min. | App-Code öffentlich, Daten nicht | braucht ein GitHub-Konto |
| Netlify Drop | kostenlos | ~5 Min. (Ordner hineinziehen) | wie oben | braucht ein Netlify-Konto |
| Tailscale (privat) | kostenlos | mittel | nur deine Geräte sehen die App | PC muss laufen, App auf PC + Handy nötig |
| Nur Heimnetz, eigenes Zertifikat | – | hoch | privat | Zertifikatswarnungen, PC muss laufen – nicht empfohlen |

## Vor dem Veröffentlichen (öffentlicher Code)

Die **Start-Vorlage** im Code ist neutral („Verhalten 1“), ohne persönliche Beispiele. Deine eigene Vorlage und deine Einträge
kommen nur per Import aufs Handy – sie stehen nie im Code. Das Muster-PDF in `docs` enthält nur erfundene Daten.

## GitHub Pages – Schritte

Seit der Vorbereitung für die Handy-App wird **der ganze Projektordner** hochgeladen (nicht mehr nur `app`).
GitHub veröffentlicht davon automatisch nur `app` als Web-Version und baut daraus auf Wunsch die Android-APK.
Ausführlich: [APP-BAUEN.md](APP-BAUEN.md).

1. Neues Repository anlegen, z. B. `dbt-tagebuch` (öffentlich).
2. Ganzen Projektordner hochladen, inklusive des versteckten Ordners `.github` (am einfachsten mit GitHub Desktop).
3. *Settings → Pages → Source: GitHub Actions*. Nach 1–2 Minuten erscheint die Adresse, z. B. `https://<name>.github.io/dbt-tagebuch/`.
4. Am Handy (Chrome) die Adresse öffnen → Menü ⋮ → **„App installieren“** bzw. „Zum Startbildschirm hinzufügen“.
   iPhone: in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
5. Daten vom PC per Export/Import übernehmen.

Updates: geänderte Dateien erneut hochladen. Die App lädt beim nächsten Öffnen mit Internet die neue Version.

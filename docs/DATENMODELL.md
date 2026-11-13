# Datenmodell

Speicher: IndexedDB `dbt-tagebuch` mit zwei Bereichen.

## `meta` → Schlüssel `config`

```js
{
  schema: 1,
  fields: [Feld],            // aktuelle Vorlage (= Felder der neuesten Version)
  versions: [                // jede gespeicherte Vorlagen-Änderung, nie gelöscht
    { v: 1, savedAt: "2026-11-13T…", fields: [Feld] }
  ],
  skills: [Skill],
  medikamente: [{ name: "…", dose: 50, unit: "mg" }]  // Vorschlagsliste, wird beim Speichern eines Eintrags aktualisiert
}
```

**Feld**

```js
{
  id: "f_anspannung",        // fest, ändert sich nie
  name: "Anspannung",        // Anzeigename, frei änderbar
  type: "scale",             // scale | yesno | number | text | meds – nach erstem Speichern fest
  min: 0, max: 100, step: 5, // nur für scale (number nutzt step)
  unit: "ml",                // nur für number, Anzeige hinter dem Eingabefeld
  group: "Anspannung & Stimmung",
  hint: "höchster Wert heute",
  hidden: false              // ausgeblendet statt gelöscht
}
```

**Skill**

```js
{ id: "s_stop", name: "STOP", module: "stresstoleranz", description: "", hidden: false }
```

Module: `achtsamkeit`, `stresstoleranz`, `emotionsregulation`, `zwischenmenschlich`, `eigene`.

## `entries` → Schlüssel = Datum

```js
{
  date: "2026-11-13",
  templateVersion: 3,        // Vorlagen-Version beim letzten Speichern
  values: {
    "f_belastung": 3, "f_pv_essen_handlung": false, "f_notiz": "…",
    "f_meds": [{ name: "Sertralin", dose: 50, unit: "mg" }]   // Typ meds: Liste
  },
  skills: { "s_stop": { used: true, rating: 4 } },
  createdAt: "…", updatedAt: "…"
}
```

## Bausteine (`defaults.js` → `BAUSTEINE`)

Fertige Feldgruppen, die beim Hinzufügen normale Felder mit eigenem Bereich erzeugen:

| Baustein | Bereich | Felder |
| --- | --- | --- |
| Problemverhalten / Sucht | `Problemverhalten: <Name>` | Drang (0–5), Handlung (Ja/Nein) |
| Problemverhalten mit Menge | `Problemverhalten: <Name>` | Drang (0–5), Menge (Freitext), Handlung (Ja/Nein) |
| Neuer Weg | `Neue Wege: <Name>` | Dran gedacht? (Ja/Nein), Ausprobiert? (0–5) |
| Menge / Zeit | `Mengen & Zeiten` | `<Name>` (Zahl) |
| Einzelne Skala / Ja-Nein | `Persönlich` | `<Name>` |

Der Bereich (`group`) ist nur Anzeige; umbenennen ändert alle Felder darin, IDs bleiben.

## Seit Datenbank-Version 2

- `config.einstellungen = { wochenstart: 0–6 (0 = So), pin: { salt, hash } | null, hinweisGesehen, notfallPlan }`
- Skill: zusätzlich `notfall: true|false` (erscheint im ♥-Fenster)
- Eintrag: zusätzlich `status: "entwurf" | "abgeschlossen"`
- Neuer Speicherbereich `ketten` (Schlüssel `id`):

```js
{ id, date, titel, status: "entwurf" | "fertig", archiviert,
  problem, ausloeser, verletzlichkeit,
  glieder: [{ art: "ereignis|gedanke|gefuehl|koerper|drang|handlung", text }],
  folgenKurz, folgenLang, loesung, skills: [skillId], vorbeugung, wiedergutmachung,
  createdAt, updatedAt }
```

- Export-Format v2: zusätzlich `ketten: [...]`.

## Regeln

- Werte hängen an der Feld-**ID**, nicht am Namen. Umbenennen ist daher immer sicher.
- Ein Eintrag zeigt: alle sichtbaren Felder + ausgeblendete Felder, die in diesem Eintrag einen Wert haben.
- Leere Werte werden nicht gespeichert („nicht ausgefüllt“ ≠ 0).
- Neue, noch nie gespeicherte Felder dürfen entfernt werden. Gespeicherte nur ausblenden.
- Export-Format: `{ app: "dbt-tagebuch", exportVersion: 1, exportedAt, config, entries }`.

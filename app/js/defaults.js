// Start-Vorlage (nach der Papier-Diary-Card) und Standard-Skills.

export const TYPEN = {
  scale: 'Skala',
  yesno: 'Ja/Nein',
  number: 'Zahl',
  text: 'Freitext',
  meds: 'Medikamentenliste',
  auswahl: 'Auswahl (antippen)',
};

export const MED_EINHEITEN = ['g', 'mg', 'µg'];

// ---------- Farbe mit Bedeutung ----------
// Jeder Bereich der Karte bekommt einen gedämpften Ton (CSS: .kat-<name>), jedes DBT-Modul ebenso (.modul-<name>).
// Die Hex-Werte hier sind die hellen Varianten für das PDF; die App nutzt CSS-Variablen (hell/dunkel).
export const KAT_HELL = {
  befinden: '#3F6A8A', problem: '#8A4F67', wege: '#2E6E72', aktiv: '#44703D',
  ereignisse: '#97591F', mengen: '#5A6878', meds: '#7A6338', neutral: '#5F6B66',
};
export const MODUL_HELL = {
  achtsamkeit: '#6B5B95', stresstoleranz: '#97591F', emotionsregulation: '#8A4F67', zwischenmenschlich: '#3F6A8A', eigene: '#456F60',
};

/** Bereich (group) → Farbkategorie. Unbekannte Bereiche bekommen stabil eine Farbe über ihren Namen. */
export function kategorie(group = '') {
  const g = group.trim();
  if (g === 'Befinden' || /gef(ü|u)hl|stimmung|anspannung/i.test(g)) return 'befinden';
  if (g.startsWith('Problemverhalten') || g.startsWith('Verhalten:') || /drang|handlung|sucht/i.test(g)) return 'problem';
  if (g.startsWith('Neue Wege')) return 'wege';
  if (g === 'Aktivitäten') return 'aktiv';
  if (g === 'Ereignisse') return 'ereignisse';
  if (g === 'Medikamente') return 'meds';
  if (g === 'PC & Koffein' || g === 'Mengen & Zeiten') return 'mengen';
  if (g === 'Notizen' || g === 'Allgemein') return 'neutral';
  const reihe = ['befinden', 'wege', 'aktiv', 'ereignisse', 'mengen', 'meds', 'problem'];
  let h = 0;
  for (const c of g) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return reihe[h % reihe.length];
}

export const MODULE = {
  achtsamkeit: 'Achtsamkeit',
  stresstoleranz: 'Stresstoleranz',
  emotionsregulation: 'Emotionsregulation',
  zwischenmenschlich: 'Zwischenmenschliche Fertigkeiten',
  eigene: 'Eigene Skills',
};

const skala = (id, name, group, min, max, hint = '', step = 1) =>
  ({ id, name, type: 'scale', min, max, step, group, hint, hidden: false });
const janein = (id, name, group, hint = '') =>
  ({ id, name, type: 'yesno', min: 0, max: 1, step: 1, group, hint, hidden: false });
const text = (id, name, group, hint = '') =>
  ({ id, name, type: 'text', min: 0, max: 0, step: 1, group, hint, hidden: false });
const zahl = (id, name, group, unit = '', hint = '', step = 0.5) =>
  ({ id, name, type: 'number', min: 0, max: 0, step, unit, group, hint, hidden: false });
const medliste = (id, name, group, hint = '') =>
  ({ id, name, type: 'meds', min: 0, max: 0, step: 1, group, hint, hidden: false });
const auswahl = (id, name, group, optionen, mehrfach = true, hint = '') =>
  ({ id, name, type: 'auswahl', min: 0, max: 0, step: 1, optionen: [...optionen], mehrfach, group, hint, hidden: false });

// ---------- Verhaltens-Baukasten ----------
// Für jedes Verhalten (Sucht, alte Gewohnheit, Hobby, neuer Weg …) wählt man, WAS man beobachten will.

export const GEFUEHLE = ['ruhig', 'erleichtert', 'zufrieden', 'leer', 'gelangweilt', 'angespannt', 'traurig', 'wütend', 'ängstlich', 'beschämt', 'schuldig', 'einsam'];
export const TAGESZEITEN = ['morgens', 'mittags', 'nachmittags', 'abends', 'nachts'];

/** Messarten: key → { titel, info, feld(id, gruppe, opts) } */
export const MESSARTEN = {
  drang: { titel: 'Drang', info: 'Skala 0–5', feld: (id, g) => skala(`${id}_drang`, 'Drang', g, 0, 5, '0 gar kein – 5 sehr stark') },
  gemacht: { titel: 'Gemacht?', info: 'Ja/Nein', feld: (id, g) => janein(`${id}_gemacht`, 'Gemacht?', g) },
  oft: { titel: 'Wie oft', info: 'Anzahl', feld: (id, g) => zahl(`${id}_oft`, 'Wie oft', g, 'mal', '', 1) },
  lange: { titel: 'Wie lange', info: 'Minuten', feld: (id, g) => zahl(`${id}_lange`, 'Wie lange', g, 'Minuten', '', 15) },
  viel: { titel: 'Wie viel', info: 'Zahl + eigene Einheit', feld: (id, g, o = {}) => zahl(`${id}_viel`, 'Wie viel', g, o.einheit ?? '', '', 1) },
  wann: { titel: 'Wann', info: 'morgens … nachts', feld: (id, g) => auswahl(`${id}_wann`, 'Wann', g, TAGESZEITEN, true) },
  gefuehlWaehrend: { titel: 'Gefühl währenddessen', info: 'Gefühle antippen', feld: (id, g) => auswahl(`${id}_gefuehl_waehrend`, 'Gefühl währenddessen', g, GEFUEHLE, true) },
  gefuehlDanach: { titel: 'Gefühl danach', info: 'Gefühle antippen', feld: (id, g) => auswahl(`${id}_gefuehl_danach`, 'Gefühl danach', g, GEFUEHLE, true) },
  ausloeser: { titel: 'Auslöser', info: 'kurzer Text', feld: (id, g) => text(`${id}_ausloeser`, 'Auslöser', g, 'Was war davor?') },
  skillStatt: { titel: 'Skill statt Verhalten?', info: 'Ja/Nein', feld: (id, g) => janein(`${id}_skill_statt`, 'Skill statt Verhalten?', g, 'Konntest du stattdessen einen Skill nutzen?') },
  gedacht: { titel: 'Dran gedacht?', info: 'Ja/Nein', feld: (id, g) => janein(`${id}_gedacht`, 'Dran gedacht?', g) },
  probiert: { titel: 'Ausprobiert', info: 'Skala 0–5', feld: (id, g) => skala(`${id}_probiert`, 'Ausprobiert?', g, 0, 5, '0 gar nicht – 5 häufig') },
};

/** Alte Feld-Endungen → Messart (damit „+ Messart“ auch bei älteren Bereichen erkennt, was schon da ist) */
export const MESSART_ENDUNG = {
  drang: 'drang', handlung: 'gemacht', gemacht: 'gemacht', oft: 'oft', lange: 'lange', viel: 'viel', wann: 'wann',
  gefuehl_waehrend: 'gefuehlWaehrend', gefuehl_danach: 'gefuehlDanach', ausloeser: 'ausloeser', skill_statt: 'skillStatt',
  gedacht: 'gedacht', probiert: 'probiert',
};

/** Startauswahlen: setzen nur die Häkchen vor – alles bleibt änderbar */
export const VERHALTEN_VORLAGEN = {
  bildschirm: { titel: 'Bildschirm / Gaming', arten: ['drang', 'lange', 'gefuehlWaehrend', 'gefuehlDanach'] },
  essen: { titel: 'Essattacke', arten: ['drang', 'oft', 'wann', 'gefuehlDanach'] },
  substanz: { titel: 'Substanz', arten: ['drang', 'gemacht', 'viel', 'ausloeser'] },
  krise: { titel: 'Selbstverletzung / Krisenverhalten', arten: ['drang', 'gemacht', 'skillStatt'] },
  gewohnheit: { titel: 'Alte Gewohnheit', arten: ['drang', 'gemacht', 'gefuehlDanach'] },
  weg: { titel: 'Neuer Weg', arten: ['gedacht', 'probiert'], gruppe: 'Neue Wege' },
  eigenes: { titel: 'Eigenes', arten: [] },
};

/** Felder für ein Verhalten erzeugen. id = Präfix, arten = Messart-Keys in Reihenfolge der MESSARTEN */
export function verhaltenFelder(name, id, arten, { vorlage = 'eigenes', einheit = '' } = {}) {
  const g = `${VERHALTEN_VORLAGEN[vorlage]?.gruppe ?? 'Verhalten'}: ${name}`;
  return Object.keys(MESSARTEN).filter((k) => arten.includes(k)).map((k) => MESSARTEN[k].feld(id, g, { einheit }));
}

// ---------- Bausteine: fertige Feld-Gruppen, frei benennbar ----------
// id = Präfix für die Feld-IDs (bei neuen Bausteinen eine zufällige ID).

export const BAUSTEINE = {
  problem: {
    titel: 'Problemverhalten / Sucht',
    info: 'Drang 0–5 und Handlung Ja/Nein',
    felder: (name, id) => {
      const g = `Problemverhalten: ${name}`;
      return [skala(`${id}_drang`, 'Drang', g, 0, 5, '0 gar kein – 5 sehr stark'), janein(`${id}_handlung`, 'Handlung', g)];
    },
  },
  problemMenge: {
    titel: 'Problemverhalten mit Menge',
    info: 'Drang 0–5, Menge (Freitext) und Handlung Ja/Nein',
    felder: (name, id) => {
      const g = `Problemverhalten: ${name}`;
      return [
        skala(`${id}_drang`, 'Drang', g, 0, 5, '0 gar kein – 5 sehr stark'),
        text(`${id}_menge`, 'Menge', g, 'Was und wie viel?'),
        janein(`${id}_handlung`, 'Handlung', g),
      ];
    },
  },
  weg: {
    titel: 'Neuer Weg (Ziel-Verhalten)',
    info: 'Dran gedacht Ja/Nein und ausprobiert 0–5',
    felder: (name, id) => {
      const g = `Neue Wege: ${name}`;
      return [janein(`${id}_gedacht`, 'Dran gedacht?', g), skala(`${id}_probiert`, 'Ausprobiert?', g, 0, 5, '0 gar nicht – 5 häufig')];
    },
  },
  menge: {
    titel: 'Menge / Zeit',
    info: 'Zahl mit Einheit, z. B. „Kaffee“ in Tassen – Einheit danach im Feld eintragen',
    felder: (name, id) => [zahl(`${id}_menge`, name, 'Mengen & Zeiten')],
  },
  skala: {
    titel: 'Einzelne Skala 0–5',
    info: 'z. B. „Wie viel gezockt?“ 0 gar nicht – 5 sehr viel',
    felder: (name, id) => [skala(`${id}_skala`, name, 'Persönlich', 0, 5)],
  },
  janein: {
    titel: 'Einzelnes Ja/Nein',
    info: 'z. B. „Medikamente genommen“',
    felder: (name, id) => [janein(`${id}_janein`, name, 'Persönlich')],
  },
};

export function defaultFields() {
  const E = 'Ereignisse';
  const B = 'Befinden';
  const A = 'Aktivitäten';
  const N = 'Notizen';
  // Neutral gehalten: keine persönlichen Beispiele im (ggf. öffentlichen) Code.
  // Eigene Verhalten legt man unter Vorlage → „Verhalten hinzufügen“ an.
  return [
    text('f_ereignis_pos', 'Angenehme Ereignisse', E, 'Was ist passiert?'),
    text('f_ereignis_neg', 'Unangenehme Ereignisse', E, 'Was ist passiert?'),
    skala('f_belastung', 'Belastung', B, 0, 5, '0 gar nicht – 5 sehr hoch'),
    skala('f_selbstmitgefuehl', 'Selbstmitgefühl', B, 0, 5, '0 gar nicht – 5 sehr hoch'),
    skala('f_suizid', 'Suizidgedanken', B, 0, 5, '0 keine – 5 außer Kontrolle'),
    skala('f_schlaf_erholsam', 'Erholsamkeit des Schlafes', B, 0, 5, '0 gar nicht – 5 ausgezeichnet'),
    skala('f_dissoziation', 'Dissoziative Symptome', B, 0, 5, '0 keine – 5 sehr stark'),
    skala('f_vertrauen', 'Vertrauen in die Therapie', B, 0, 5, '0 gar nicht – 5 sehr stark'),
    ...BAUSTEINE.weg.felder('Neuer Weg 1', 'f_nw1'),
    ...BAUSTEINE.weg.felder('Neuer Weg 2', 'f_nw2'),
    skala('f_skills', 'Skills angewendet', A, 0, 5, '0 gar nicht – 5 häufig'),
    skala('f_bewegung', 'Bewegung / Sport', A, 0, 6, '0 gar nicht – 5 intensiv – 6 zu viel'),
    skala('f_angenehm', 'Angenehme Aktivitäten aufgesucht', A, 0, 5, '0 gar nicht – 5 viele'),
    janein('f_therapieaufgaben', 'Therapie-Aufgaben erledigt', A),
    ...verhaltenFelder('Eigener Drang', 'f_v1', ['drang', 'gemacht', 'gefuehlDanach'], { vorlage: 'gewohnheit' }),
    medliste('f_meds', 'Eingenommen', 'Medikamente', '+ für jedes Medikament'),
    text('f_notiz', 'Notiz zum Tag', N),
  ];
}

// Erklärungen zu Feldern (nicht versioniert, frei bearbeitbar).
// klaeren: true = Bedeutung noch mit der Therapie klären → ⓘ erscheint signalrot.
export const FELD_INFO = {
  f_belastung: {
    text: 'Wie sehr hat dich der Tag insgesamt mitgenommen – seelisch und körperlich zusammen? Auf englischen Karten oft „Misery“ (Leidensdruck). Gemeint ist der vorherrschende oder stärkste Zustand des Tages.\nFrage: „Wie schwer war heute alles zu tragen?“',
    klaeren: true,
  },
  f_selbstmitgefuehl: {
    text: 'Wie bist du heute mit dir selbst umgegangen – besonders, wenn etwas schiefging?\n• Freundlichkeit zu dir statt Selbstverurteilung (wie mit einer guten Freundin sprechen)\n• Gemeinsames Menschsein statt Isolation („anderen geht es auch so“)\n• Achtsamkeit: Schmerz wahrnehmen, ohne darin zu versinken\nIn der DBT eng verbunden mit Selbstvalidierung: Gefühle anerkennen, ohne sie zu bewerten. Nicht dasselbe wie Selbstmitleid.\n0 = „Ich habe mich nur fertiggemacht“ · 5 = „Ich war verständnisvoll und fürsorglich mit mir“.',
    klaeren: true,
  },
  f_suizid: {
    text: 'Wie stark und wie häufig waren Gedanken ans Sterben oder an Suizid da? 0 = keine, mittlere Werte = da, aber mit Abstand, 5 = nicht mehr steuerbar.\nEhrlich eintragen hilft der Therapie. Die Karte ist aber kein Krisenwerkzeug: Bei hohen Werten gilt dein Notfallplan (♥ oben rechts, Telefonseelsorge 0800 111 0 111, Notruf 112).',
    klaeren: true,
  },
  f_schlaf_erholsam: {
    text: 'Nicht wie lange, sondern wie erholt du aufgewacht bist. Schlechter Schlaf ist ein „Verletzlichkeitsfaktor“: Gefühle werden schneller heftig.\nAchtung: Hier ist hoch = gut.',
    klaeren: true,
  },
  f_dissoziation: {
    text: 'Gefühl, von dir selbst oder der Umgebung „abgeschnitten“ zu sein, z. B.:\n• alles wirkt unwirklich, wie hinter Glas (Derealisation)\n• sich selbst fremd fühlen, neben sich stehen (Depersonalisation)\n• Taubheit, Schmerz kaum spüren, Zeitlücken, „weggetreten“ sein\nTritt bei Borderline oft zusammen mit sehr hoher Anspannung auf.\nFrage: „Wie sehr war ich heute ‚nicht richtig da‘?“',
    klaeren: true,
  },
  f_vertrauen: {
    text: 'Wie sehr glaubst du heute daran, dass die Therapie hilft, und wie sehr vertraust du deiner Therapeutin / deinem Therapeuten? Zweifel, Wut oder Abbruchgedanken werden in der DBT früh besprochen. Ein niedriger Wert ist kein Fehler, sondern ein Gesprächsthema.',
    klaeren: true,
  },
};

const s = (id, name, module, description = '') => ({ id, name, module, description, hidden: false });

export function defaultSkills() {
  return [
    s('s_weiser_geist', 'Weiser Geist', 'achtsamkeit', 'Verstand und Gefühl zusammenbringen'),
    s('s_beobachten', 'Beobachten', 'achtsamkeit'),
    s('s_beschreiben', 'Beschreiben', 'achtsamkeit'),
    s('s_teilnehmen', 'Teilnehmen', 'achtsamkeit'),
    s('s_nicht_bewerten', 'Nicht bewerten', 'achtsamkeit'),
    s('s_stop', 'STOP', 'stresstoleranz', 'Stopp, Schritt zurück, beobachten, achtsam weiter'),
    s('s_tipp', 'TIPP (Kälte, Bewegung, Atmung, Entspannung)', 'stresstoleranz'),
    s('s_sinnesreize', 'Starke Sinnesreize (Notfallkoffer)', 'stresstoleranz', 'z. B. Eis, Chili, Igelball'),
    s('s_pro_contra', 'Pro und Contra', 'stresstoleranz'),
    s('s_ablenken', 'Ablenken', 'stresstoleranz'),
    s('s_selbstberuhigung', 'Selbstberuhigung mit den 5 Sinnen', 'stresstoleranz'),
    s('s_radikale_akzeptanz', 'Radikale Akzeptanz', 'stresstoleranz'),
    s('s_fakten_pruefen', 'Fakten prüfen', 'emotionsregulation'),
    s('s_entgegengesetzt', 'Entgegengesetzt handeln', 'emotionsregulation'),
    s('s_problemloesen', 'Problemlösen', 'emotionsregulation'),
    s('s_positives', 'Angenehme Aktivität', 'emotionsregulation'),
    s('s_koerper', 'Körper pflegen (Schlaf, Essen, Bewegung)', 'emotionsregulation'),
    s('s_dear_man', 'DEAR MAN (Wünsche äußern)', 'zwischenmenschlich'),
    s('s_give', 'GIVE (Beziehung pflegen)', 'zwischenmenschlich'),
    s('s_fast', 'FAST (Selbstachtung)', 'zwischenmenschlich'),
  ];
}

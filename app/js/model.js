// Datenmodell: Konfiguration, versionierte Vorlage, Hilfsfunktionen.
import { defaultFields, defaultSkills } from './defaults.js';

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function newId(prefix) {
  const r = globalThis.crypto?.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${r.slice(0, 12)}`;
}

export function todayISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function shiftDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function createInitialConfig() {
  const fields = defaultFields();
  return {
    schema: 1,
    fields,
    versions: [{ v: 1, savedAt: new Date().toISOString(), fields: clone(fields) }],
    skills: defaultSkills(),
    medikamente: [], // gespeicherte Medikamente: { name, dose, unit }
  };
}

export const currentVersion = (c) => c.versions[c.versions.length - 1];

export const templateChanged = (c, fields) =>
  JSON.stringify(currentVersion(c).fields) !== JSON.stringify(fields);

/** Speichert die Vorlage als neue Version, falls sich etwas geändert hat. */
export function commitTemplate(c, fields) {
  if (!templateChanged(c, fields)) return false;
  c.fields = clone(fields);
  c.versions.push({ v: currentVersion(c).v + 1, savedAt: new Date().toISOString(), fields: clone(fields) });
  return true;
}

/** Wurde das Feld schon einmal gespeichert? Dann darf es nicht mehr entfernt oder im Typ geändert werden. */
export const isCommitted = (c, id) => c.versions.some((v) => v.fields.some((f) => f.id === id));

/** Zahl-Feld, das eine Dauer in Minuten speichert („Wie lange“) */
export const istMinuten = (f) => f?.type === 'number' && f.unit === 'Minuten';
/** Minuten lesbar: „45 min“, „7 h“, „7 h 30 min“ */
export function dauerText(min) {
  const m = Math.round(Number(min));
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}
/** Anzeige-Einheiten für Dauern: Faktor in Minuten */
export const ZEIT_EINHEITEN = { min: ['Minuten', 1], h: ['Stunden', 60], t: ['Tage', 1440] };

export const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '');

/** Medikamente aus einem Eintrag in die gespeicherte Liste übernehmen (Name → letzte Dosis/Einheit). */
export function rememberMeds(c, fields, entry) {
  c.medikamente ??= [];
  let changed = false;
  fields.filter((f) => f.type === 'meds').forEach((f) => {
    (entry.values[f.id] ?? []).forEach((m) => {
      const alt = c.medikamente.find((x) => x.name.toLowerCase() === m.name.toLowerCase());
      if (!alt) { c.medikamente.push({ name: m.name, dose: m.dose, unit: m.unit }); changed = true; }
      else if (alt.dose !== m.dose || alt.unit !== m.unit) { Object.assign(alt, { dose: m.dose, unit: m.unit }); changed = true; }
    });
  });
  if (changed) c.medikamente.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return changed;
}

/** Felder, die in einem Eintrag angezeigt werden: sichtbare + ausgeblendete mit vorhandenem Wert. */
export const fieldsForEntry = (c, entry) =>
  c.fields.filter((f) => !f.hidden || hasValue(entry?.values?.[f.id]));

/**
 * Standard-Vorlage übernehmen, ohne etwas zu verlieren:
 * Standardfelder sichtbar (vorhandene behalten Namen/Einstellungen, bekommen den Standard-Bereich),
 * alle anderen ausgeblendet ans Ende.
 */
export function applyStandard(fields) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const std = defaultFields().filter((s) => !byId.has(s.id) || byId.get(s.id).type === s.type);
  const stdIds = new Set(std.map((s) => s.id));
  return [
    ...std.map((s) => {
      if (!byId.has(s.id)) return s;
      const f = { ...byId.get(s.id), group: s.group, hidden: false };
      if (s.unit && !f.unit) f.unit = s.unit;
      return f;
    }),
    ...fields.filter((f) => !stdIds.has(f.id)).map((f) => ({ ...f, hidden: true })),
  ];
}

export function validateFields(fields) {
  const fehler = [];
  fields.forEach((f) => {
    if (!f.name.trim()) fehler.push('Ein Feld hat keinen Namen.');
    if (f.type === 'scale') {
      if (!(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min < f.max)) fehler.push(`„${f.name}“: Min muss kleiner als Max sein.`);
      if (!(f.step > 0)) fehler.push(`„${f.name}“: Schrittweite muss größer als 0 sein.`);
    }
    if (f.type === 'auswahl' && !(f.optionen ?? []).filter((o) => o.trim()).length) fehler.push(`„${f.name}“: Bitte mindestens eine Auswahlmöglichkeit eintragen.`);
  });
  return fehler;
}

/** Leere Werte entfernen, damit „nicht ausgefüllt“ nicht als 0 gilt. */
export function cleanEntry(entry) {
  const values = {};
  for (const [k, raw] of Object.entries(entry.values)) {
    let v = raw;
    if (Array.isArray(raw)) {
      v = raw
        .filter((m) => (typeof m === 'string' ? m.trim() : m?.name?.trim())) // Auswahl: Texte · Medikamente: Objekte
        .map((m) => (typeof m === 'string' ? m : { name: m.name.trim(), dose: m.dose ?? null, unit: m.unit }));
    }
    if (hasValue(v)) values[k] = v;
  }
  const skills = {};
  for (const [k, v] of Object.entries(entry.skills)) if (v.used) skills[k] = v;
  return { ...entry, values, skills };
}

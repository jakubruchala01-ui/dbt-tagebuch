// Tageseintrag speichern: automatisch, beim Verlassen und beim Ändern einzelner Werte.
import * as db from './db.js';
import { todayISO, currentVersion, templateChanged, hasValue, cleanEntry, rememberMeds } from './model.js';
import { esc, frage, icon } from './ui.js';
import { state, saveConfig, ketten } from './kern.js';
import { erinnerungenAktualisieren } from './erinnerung.js';
import { suizidHoch, zeigeKrisenHinweis } from './notfall.js';
import { updFortschritt, updStepper } from './felder.js';

/** Darf die aktuelle Ansicht verlassen werden? Karte und Ketten speichern selbst, nur die Vorlage fragt nach. */
export async function leaveOk() {
  if (state.view === 'heute') await autoSpeichernJetzt();
  if (ketten.isDirty()) await ketten.speichernJetzt();
  if (state.view === 'vorlage' && state.draftFields && templateChanged(state.config, state.draftFields)) {
    return frage('Deine Änderungen an der Vorlage sind noch nicht gespeichert.', { titel: 'Vorlage verlassen?', ja: 'Verwerfen', nein: 'Weiter bearbeiten' });
  }
  return true;
}

// ---------- Automatisch speichern ----------
let autoTimer = null;
let speichertGerade = Promise.resolve();
/** Wartet noch eine Änderung auf das automatische Speichern? */
export const autoHatAusstehendes = () => autoTimer !== null;

function setzeSpeicherstatus(text, ok = false) {
  const el = document.getElementById('speicherstatus');
  if (el) el.innerHTML = text ? `${ok ? icon('check', 14) : ''}${esc(text)}` : '';
}

export function autoSpeichern() {
  state.entryDirty = true;
  setzeSpeicherstatus('speichert …');
  clearTimeout(autoTimer);
  autoTimer = setTimeout(autoSpeichernJetzt, 700);
}

export async function autoSpeichernJetzt() {
  clearTimeout(autoTimer);
  autoTimer = null;
  if (!state.entryDirty || !state.entry) return speichertGerade;
  speichertGerade = speichertGerade.then(() => speichereEntry());
  return speichertGerade;
}

/** Speichert die Karte still (ohne neu zu zeichnen). Leere neue Karten werden nicht angelegt. */
async function speichereEntry() {
  const now = new Date().toISOString();
  const e = cleanEntry(state.entry);
  const leer = !Object.keys(e.values).length && !Object.keys(e.skills).length && e.status !== 'abgeschlossen';
  state.entryDirty = false;
  if (leer && !e.createdAt) { setzeSpeicherstatus(''); return; }
  const ersteWerte = !state.entryHatteWerte && Object.keys(e.values).length > 0;
  state.entryHatteWerte ||= ersteWerte;
  e.templateVersion = currentVersion(state.config).v;
  e.createdAt ??= now;
  e.updatedAt = now;
  state.entry.createdAt = e.createdAt;
  await db.putEntry(e);
  if (rememberMeds(state.config, state.config.fields, e)) await saveConfig();
  if (ersteWerte && e.date === todayISO()) erinnerungenAktualisieren(); // heute etwas eingetragen → Erinnerungen für heute aus
  setzeSpeicherstatus(`gespeichert ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`, true);
}

/** Wert eines Skalenfelds ändern (−/+ Tasten, Balken, Tastatur) */
export function schritt(id, delta, direkt = null) {
  const f = state.config.fields.find((x) => x.id === id);
  const v = state.entry.values[id];
  let neu;
  if (direkt !== null) neu = direkt === v ? +(v - f.step).toFixed(4) : direkt; // nochmal tippen = eins weniger
  else if (!hasValue(v)) neu = f.min;
  else if (delta < 0 && v <= f.min) neu = null; // unter Minimum = wieder „Offen“
  else neu = Math.min(f.max, Math.max(f.min, +(v + delta * f.step).toFixed(4)));
  if (neu !== null && neu < f.min) neu = null;
  setValue(id, neu);
  updStepper(id);
}

export function setValue(id, value) {
  const vorher = suizidHoch(state.entry.values);
  state.entry.values[id] = value;
  if (id === 'f_suizid' && !vorher && suizidHoch(state.entry.values)) setTimeout(zeigeKrisenHinweis, 300);
  autoSpeichern();
  updFortschritt();
}

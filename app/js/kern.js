// Gemeinsamer Zustand und Ereignis-Verteiler. Wird von allen Oberflächen-Modulen genutzt, importiert selbst keines davon.
import * as db from './db.js';
import { todayISO } from './model.js';
import { kettenModul } from './ketten.js';

export const $main = document.getElementById('main');
export const state = {
  config: null,
  view: 'woche',
  date: todayISO(),        // Tag der Tageskarte
  wocheDatum: todayISO(),  // irgendein Tag der angezeigten Woche
  entry: null,             // Arbeitskopie des Tageseintrags
  entryDirty: false,
  draftFields: null,       // Arbeitskopie der Vorlage
  verlaufTage: 14,
  pdf: { von: '', bis: '', leereWeglassen: false, mitSkills: true, mitTexten: true, mitVergleich: true, mitKetten: false, mitStunde: true },
};
export const E = () => state.config.einstellungen;
export const saveConfig = () => db.putConfig(state.config);
export const ketten = kettenModul({ $main, state });
export const BEFINDEN_IDS = ['f_belastung', 'f_selbstmitgefuehl', 'f_suizid', 'f_schlaf_erholsam', 'f_dissoziation', 'f_vertrauen'];

// ---------- Tonfall ----------
export const TONFAELLE = {
  sanft: { name: 'Sanft', text: 'Ohne Druck. Lücken werden nur freundlich erwähnt.' },
  klar: { name: 'Klar', text: 'Freundlich, aber deutlich: Lücken werden benannt, mit einem kleinen nächsten Schritt.' },
  direkt: { name: 'Direkt', text: 'Kurz und sachlich. Für alle, die klare Erinnerungen mögen.' },
};
export const ton = () => (TONFAELLE[E().tonfall] ? E().tonfall : 'klar');

/** Feldname mit Bereich, wo der Name allein unklar wäre (z. B. „Gaming – Wie lange“) */
export const feldTitel = (f) => (/^(Problemverhalten|Verhalten|Neue Wege): /.test(f.group ?? '')
  ? `${f.group.split(': ').slice(1).join(': ')} – ${f.name}` : f.name);

// ---------- Ansicht wechseln (setzt app.js – so brauchen die Module keinen Rückimport) ----------
export const nav = { zeige: async () => {}, neuZeichnen: async () => {} };

// ---------- Ereignis-Verteiler ----------
const KLICK = new Map();
/** Klick-Aktionen (data-act → Funktion) anmelden. Jede Aktion gehört genau einem Modul. */
export function aufKlick(aktionen) {
  for (const [act, fn] of Object.entries(aktionen)) {
    if (KLICK.has(act)) throw new Error(`Aktion doppelt angemeldet: ${act}`);
    KLICK.set(act, fn);
  }
}
$main.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  return KLICK.get(el.dataset.act)?.(el);
});

const SENDEN = new Map();
/** Formulare (id → Funktion) anmelden. Absenden lädt nie die Seite neu (außer in den Ketten, die das selbst regeln). */
export function aufSenden(formulare) {
  for (const [id, fn] of Object.entries(formulare)) {
    if (SENDEN.has(id)) throw new Error(`Formular doppelt angemeldet: ${id}`);
    SENDEN.set(id, fn);
  }
}
$main.addEventListener('submit', async (e) => {
  if (state.view === 'ketten') return; // eigenes Modul
  e.preventDefault();
  return SENDEN.get(e.target.id)?.(e.target);
});

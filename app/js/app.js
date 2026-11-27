// Einstieg: Navigation zwischen den Ansichten, Kopfzeile, Seite verlassen, PIN-Sperre und Start.
// Die Ansichten selbst liegen in eigenen Modulen (woche, karte, draenge, vorlage, pdf, einstellungen, notfall, hilfe).
import * as db from './db.js';
import { clone, todayISO, createInitialConfig, templateChanged } from './model.js';
import { esc, toast, closeModal, icon } from './ui.js';
import { sperren } from './sicherheit.js';
import { wendeDesignAn } from './design.js';
import { starteUebung } from './uebungen.js';
import { istNativ, beiMitteilungAntippen, beiRueckkehr, bildschirmSchutz } from './plattform.js';
import { $main, E, state, saveConfig, ketten, nav, aufKlick } from './kern.js';
import { erinnerungenAktualisieren } from './erinnerung.js';
import { zeigeNotfall, speichereNotfallplan } from './notfall.js';
import { leaveOk, autoSpeichernJetzt, autoHatAusstehendes } from './eintrag.js';
import { renderSkills } from './draenge.js';
import { zeigeSchnellkarte, trageUebungEin, renderHeute } from './karte.js';
import { renderVorlage } from './vorlage.js';
import { zeigeHinweis, zeigeHilfe } from './hilfe.js';
import { pdfWoche, renderPdf, pdfDruckVerdrahten } from './pdf.js';
import { renderMehr, renderDatenschutz, renderDaten, vervollstaendigeConfig } from './einstellungen.js';
import { zeigeMerken, renderWoche, zeigeLueckenNotiz, renderVerlauf } from './woche.js';

// ---------- Navigation ----------
const views = {
  woche: renderWoche, heute: renderHeute, ketten: () => ketten.render(), verlauf: renderVerlauf, pdf: renderPdf,
  mehr: renderMehr, vorlage: renderVorlage, skills: renderSkills, daten: renderDaten, datenschutz: renderDatenschutz,
};
const NAV_VON = { vorlage: 'mehr', skills: 'mehr', daten: 'mehr', datenschutz: 'mehr' };

async function show(view, { force = false } = {}) {
  if (!force && !(await leaveOk())) return;
  if (view === 'ketten' && state.view !== 'ketten' && !force) ketten.zurListe();
  state.view = view;
  if (view === 'vorlage') state.draftFields = clone(state.config.fields);
  document.body.classList.toggle('breit', view === 'verlauf');
  const navView = NAV_VON[view] ?? view;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === navView));
  await views[view]();
  window.scrollTo(0, 0);
}

document.querySelector('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) show(b.dataset.view);
});
document.getElementById('notfall-btn').addEventListener('click', () => zeigeNotfall());
// Symbole in Navigation und Hilfe-Knopf
document.querySelectorAll('nav button[data-icon]').forEach((b) => b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon, 18)));
document.getElementById('notfall-btn').innerHTML = `${icon('herz', 16)}<span>Hilfe</span>`;
document.getElementById('merken-btn').innerHTML = `${icon('merken', 16)}<span>Merken</span>`;
document.getElementById('merken-btn').addEventListener('click', () => zeigeMerken());
document.getElementById('hilfe-btn').addEventListener('click', () => zeigeHilfe());

// Übungen und Schnell-Karte können aus der Seite und aus Fenstern gestartet werden
document.addEventListener('click', (e) => {
  const u = e.target.closest('[data-uebung]');
  if (u) { closeModal(); starteUebung(u.dataset.uebung, { onFertig: trageUebungEin }); return; }
  const sk = e.target.closest('[data-schnell]');
  if (sk) { closeModal(); zeigeSchnellkarte(sk.dataset.schnell || undefined); return; }
  const lk = e.target.closest('[data-luecke-notiz]');
  if (lk) { closeModal(); zeigeLueckenNotiz(lk.dataset.lueckeNotiz.split(',')); return; }
  if (e.target.closest('[data-merken]')) { closeModal(); zeigeMerken(); return; }
  if (e.target.closest('[data-notfall]')) { closeModal(); zeigeNotfall(); }
});
nav.zeige = show;
nav.neuZeichnen = () => views[state.view]();
aufKlick({
  goto: (el) => show(el.dataset.view),
  'open-day': (el) => { state.date = el.dataset.date; return show('heute'); },
});
pdfDruckVerdrahten();

window.addEventListener('pagehide', () => { autoSpeichernJetzt(); ketten.speichernJetzt(); speichereNotfallplan(); });
window.addEventListener('beforeunload', (e) => {
  if (autoHatAusstehendes()) autoSpeichernJetzt();
  ketten.speichernJetzt();
  speichereNotfallplan();
  if (state.view === 'vorlage' && state.draftFields && templateChanged(state.config, state.draftFields)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
// App geht in den Hintergrund (Handy): sofort sichern
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { autoSpeichernJetzt(); ketten.speichernJetzt(); }
});

// ---------- Sperre ----------
async function entsperren() {
  if (!E().pin) return;
  await sperren(E().pin, async () => { E().pin = null; await saveConfig(); toast('PIN entfernt'); }, () => zeigeNotfall({ gesperrt: true }));
}

let verstecktSeit = null;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { verstecktSeit = Date.now(); return; }
  if (state.config?.einstellungen?.pin && verstecktSeit && Date.now() - verstecktSeit > 60_000 && document.getElementById('sperre').hidden) await entsperren();
  verstecktSeit = null;
});

// ---------- Start ----------
async function init() {
  state.config = await db.getConfig();
  if (!state.config) {
    state.config = createInitialConfig();
    await saveConfig();
  }
  await vervollstaendigeConfig();
  wendeDesignAn(E().design);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => wendeDesignAn(E().design));
  pdfWoche(0);
  await entsperren();
  await show('woche', { force: true });
  if (!E().hinweisGesehen) await zeigeHinweis();
  if (istNativ()) {
    // Handy-App: Inhalt in der App-Übersicht verbergen, Erinnerungen aktuell halten
    bildschirmSchutz(E().inhaltSchuetzen !== false);
    beiMitteilungAntippen(() => { state.date = todayISO(); show('heute'); });
    beiRueckkehr(() => erinnerungenAktualisieren());
    erinnerungenAktualisieren();
  } else if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init().catch((err) => {
  $main.innerHTML = `<p class="fehler">Fehler beim Start: ${esc(err.message)}</p>`;
  console.error(err);
});

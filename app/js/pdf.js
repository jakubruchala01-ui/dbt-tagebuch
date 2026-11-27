// PDF-Bericht: Zeitraum und Inhalt wählen, Vorschau, Drucken bzw. Teilen.
import * as db from './db.js';
import { todayISO, shiftDate } from './model.js';
import { berichtHTML } from './bericht.js';
import { esc, datumKurz, toast, wochenbeginn, WOCHENTAGE } from './ui.js';
import { dateiSpeichern, kannDrucken, drucken } from './plattform.js';
import { $main, E, state, saveConfig, aufKlick } from './kern.js';

// ---------- PDF ----------
export function pdfWoche(deltaWochen = 0, anzahl = 1) {
  const start = shiftDate(wochenbeginn(todayISO(), E().wochenstart), 7 * deltaWochen);
  state.pdf.von = start;
  state.pdf.bis = shiftDate(start, 7 * anzahl - 1);
}

export function renderPdf() {
  const p = state.pdf;
  const check = (key, text) => `<label class="check"><input type="checkbox" data-pdf="${key}" ${p[key] ? 'checked' : ''}> ${text}</label>`;
  $main.innerHTML = `
    <div class="karte">
      <h2>PDF für deine Therapeutin / deinen Therapeuten</h2>
      <p class="meta">Druckfertige Diary-Card im A4-Querformat, eine Woche pro Blatt (${WOCHENTAGE[E().wochenstart]} bis ${WOCHENTAGE[(E().wochenstart + 6) % 7]}),
      mit Wochen-Auswertung. Im Druckdialog als Ziel <strong>„Als PDF speichern“</strong> wählen. Alles bleibt auf diesem Gerät.</p>
      <div class="row wrap">
        <button data-act="pdf-woche" data-delta="0">Diese Woche</button>
        <button data-act="pdf-woche" data-delta="-1">Letzte Woche</button>
        <button data-act="pdf-woche" data-delta="-3" data-wochen="4">Letzte 4 Wochen</button>
      </div>
      <div class="row wrap">
        <label>Von <input type="date" data-pdf="von" value="${p.von}"></label>
        <label>Bis <input type="date" data-pdf="bis" value="${p.bis}"></label>
      </div>
      <label>Name auf dem Bericht (optional) <input data-pdf="name" value="${esc(state.config.profil?.name ?? '')}" placeholder="z. B. Vorname"></label>
      <div class="optionen">
        ${check('mitVergleich', 'Vergleich mit der Vorwoche (Spalte „Vorwoche“)')}
        ${check('mitSkills', 'DBT-Skills aufführen')}
        ${check('mitTexten', 'Ereignisse &amp; Notizen (Freitexte) aufführen')}
        ${check('mitKetten', 'Verhaltensketten des Zeitraums anhängen')}
        ${check('mitStunde', 'Seite „Für die nächste Stunde“ (gemerkte Themen, offene Fragen)')}
        ${check('leereWeglassen', 'Felder ohne Werte weglassen')}
      </div>
      <p class="meta">Der Bericht fasst Selbstbeobachtungen zusammen. Er stellt keine Diagnose und keine Bewertung dar.</p>
      <div class="actions"><button data-act="pdf-vorschau" class="primary">Vorschau &amp; PDF</button></div>
    </div>`;
}

export async function pdfVorschau() {
  const p = state.pdf;
  if (!p.von || !p.bis || p.von > p.bis) return toast('Bitte einen gültigen Zeitraum wählen');
  const [entries, alleKetten] = await Promise.all([db.getAllEntries(), db.getAllKetten()]);
  const name = state.config.profil?.name ?? '';
  const druck = document.getElementById('druck');
  druck.innerHTML = `
    <div class="druckleiste">
      <span>Vorschau · ${datumKurz(p.von)} – ${datumKurz(p.bis)}</span>
      <small class="druckhinweis">Nicht per Messenger, Mail oder Cloud verschicken – in der Stunde zeigen oder ausdrucken.</small>
      <button data-act="pdf-drucken" class="primary">${kannDrucken() ? 'Drucken / Als PDF speichern' : 'Bericht teilen'}</button>
      <button data-act="pdf-schliessen">Schließen</button>
    </div>
    <div class="blaetter">${berichtHTML({ config: state.config, entries, ketten: alleKetten.filter((k) => !k.archiviert), ...p, name, luecken: state.config.luecken ?? {}, stundenNotizen: (state.config.stundenNotizen ?? []).filter((n) => !n.erledigt), klaeren: state.config.fields.filter((f) => !f.hidden && state.config.feldInfo?.[f.id]?.klaeren).map((f) => ({ name: f.name, notiz: state.config.feldInfo[f.id].notiz })) })}</div>`;
  druck.hidden = false;
  document.body.classList.add('druckmodus');
  vorschauEinpassen();
}

/** Blatt (A4 quer) auf die Bildschirmbreite verkleinern, statt die Tabelle zu stauchen */
function vorschauEinpassen() {
  const b = document.querySelector('#druck .blaetter');
  const blatt = b?.querySelector('.blatt');
  if (!blatt) return;
  b.style.removeProperty('--vorschau');
  const platz = b.clientWidth - 32; // Innenabstand links/rechts
  b.style.setProperty('--vorschau', Math.min(1, platz / blatt.offsetWidth).toFixed(3));
}
window.addEventListener('resize', () => { if (!document.getElementById('druck').hidden) vorschauEinpassen(); });

async function berichtAlsDatei() {
  const css = await fetch('bericht.css').then((r) => r.text()).catch(() => '');
  const blaetter = (document.querySelector('#druck .blaetter')?.outerHTML ?? '').replace(/ style="[^"]*"/, '');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diary-Card ${state.pdf.von} bis ${state.pdf.bis}</title><style>${css}</style></head><body><div id="druck">${blaetter}</div></body></html>`;
  await dateiSpeichern(`diary-card-${state.pdf.von}-bis-${state.pdf.bis}.html`, html, 'text/html');
  toast('Bericht gespeichert – im Browser öffnen und dort drucken oder als PDF speichern');
}

function pdfSchliessen() {
  const druck = document.getElementById('druck');
  druck.hidden = true;
  druck.innerHTML = '';
  document.body.classList.remove('druckmodus');
}

/** Knöpfe der Druckvorschau (liegt außerhalb von #main) */
export function pdfDruckVerdrahten() {
  document.getElementById('druck').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'pdf-schliessen') pdfSchliessen();
    if (act === 'pdf-drucken' && !kannDrucken()) {
      // Handy-App: kein Druckdialog. Bericht als eigenständige Datei teilen, z. B. in Chrome öffnen und dort drucken.
      berichtAlsDatei();
      return;
    }
    if (act === 'pdf-drucken') {
      const alt = document.title;
      document.title = `Diary-Card ${state.pdf.von} bis ${state.pdf.bis}`; // Vorschlag für den Dateinamen
      drucken(document.title).finally(() => { document.title = alt; });
    }
  });
}

aufKlick({
  'pdf-woche': (el) => { pdfWoche(+el.dataset.delta, +el.dataset.wochen || 1); return renderPdf(); },
  'pdf-vorschau': () => pdfVorschau(),
});

$main.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.pdf) {
    const key = t.dataset.pdf;
    if (key === 'name') {
      state.config.profil = { ...state.config.profil, name: t.value.trim() };
      return saveConfig();
    }
    state.pdf[key] = t.type === 'checkbox' ? t.checked : t.value;
  }
});

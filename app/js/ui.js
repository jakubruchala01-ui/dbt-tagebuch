// Kleine gemeinsame Helfer für die Oberfläche.
import { shiftDate } from './model.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtTime = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
export const datumKurz = (iso) => iso.split('-').reverse().join('.');

export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export const wochentag = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

/** Erster Tag der Woche, die `iso` enthält. start: 0 = So … 6 = Sa (Therapietag). */
export function wochenbeginn(iso, start = 1) {
  return shiftDate(iso, -((wochentag(iso) - start + 7) % 7));
}

export function groupBy(list, keyFn) {
  const m = new Map();
  list.forEach((x) => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return [...m.entries()];
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/** Einfaches Overlay. Gibt das Inhalts-Element zurück; schließen mit closeModal(). */
let beimSchliessen = null;
export function openModal(html, { klasse = '', schliessbar = true, onClose = null } = {}) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal-box ${klasse}" role="dialog" aria-modal="true">
    ${schliessbar ? `<button class="modal-zu" data-modal-zu aria-label="Schließen">${icon('x', 20)}</button>` : ''}${html}</div>`;
  m.hidden = false;
  beimSchliessen = onClose;
  document.body.classList.add('modal-offen');
  if (schliessbar) {
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-modal-zu]')) closeModal(); };
    m.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  } else { m.onclick = null; m.onkeydown = null; }
  setTimeout(() => m.querySelector('[autofocus], .primary, button')?.focus(), 30);
  return m.querySelector('.modal-box');
}

export function closeModal() {
  const m = document.getElementById('modal');
  m.hidden = true;
  m.innerHTML = '';
  document.body.classList.remove('modal-offen');
  const cb = beimSchliessen;
  beimSchliessen = null;
  cb?.();
}

/**
 * Freundliche Rückfrage im App-Stil statt confirm(). Löst mit true/false auf.
 * frage('Änderungen verwerfen?', { ja: 'Verwerfen', nein: 'Weiter bearbeiten' })
 */
export function frage(text, { titel = '', ja = 'OK', nein = 'Abbrechen', nurOk = false } = {}) {
  return new Promise((resolve) => {
    let antwort = false;
    const box = openModal(`
      ${titel ? `<h2>${esc(titel)}</h2>` : ''}
      <p class="frage-text">${esc(text).replace(/\n/g, '<br>')}</p>
      <div class="actions dialog-knoepfe">
        ${nurOk ? '' : `<button class="ghost" data-antwort="nein">${esc(nein)}</button>`}
        <button class="primary" data-antwort="ja">${esc(ja)}</button>
      </div>`, { klasse: 'dialog', onClose: () => resolve(antwort) });
    box.querySelectorAll('[data-antwort]').forEach((b) => {
      b.onclick = () => { antwort = b.dataset.antwort === 'ja'; closeModal(); };
    });
  });
}

export const hinweis = (text, titel = '') => frage(text, { titel, ja: 'Verstanden', nurOk: true });

// ---------- Symbole (Linien-Icons, offline, einheitlich) ----------
const PFADE = {
  woche: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  karte: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v2H9zM9 10h6M9 14h6M9 18h3"/>',
  ketten: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  verlauf: '<path d="M4 4v16h16"/><path d="M8 16v-3M12 16V9M16 16v-6"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  mehr: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  herz: '<path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 8.2-3.9L12 8l.8-.9A4.6 4.6 0 0 1 21 11c-2 4.6-9 9-9 9z"/>',
  vorlage: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  skills: '<path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  schloss: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  rechts: '<path d="M9 6l6 6-6 6"/>',
  links: '<path d="M15 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  hoch: '<path d="M6 15l6-6 6 6"/>',
  runter: '<path d="M6 9l6 6 6-6"/>',
  wolke: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
  merken: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/>',
  atem: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M3 16h7"/>',
  blitz: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-8a1.5 1.5 0 0 1 3 0v8M14 11.5V5a1.5 1.5 0 0 1 3 0v9a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3.6 16a1.6 1.6 0 0 1 2.5-2l1.9 2"/>',
};

export function icon(name, groesse = 20) {
  return `<svg class="ico" width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PFADE[name] ?? ''}</svg>`;
}

// Erinnerung an die Karte: Einstellungen und Planung (Mitteilungen nur in der Handy-App).
import * as db from './db.js';
import { todayISO } from './model.js';
import { toast, icon } from './ui.js';
import { dateiSpeichern, ERINNERUNG_STANDARD, ABSTAENDE, erinnerungsZeiten, erinnerungMoeglich, erinnerungenPlanen, kalenderDatei } from './plattform.js';
import { $main, E, saveConfig, ton, aufKlick } from './kern.js';

// ---------- Erinnerungen ----------
const ER = () => (E().erinnerung = { ...ERINNERUNG_STANDARD, ...E().erinnerung });
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function erinnerungHtml() {
  const e = ER();
  const zeiten = erinnerungsZeiten(e).map(hhmm);
  const felder = `
    <div class="row wrap erinnerung-felder">
      <label>Erste Erinnerung <input type="time" id="er-start" value="${e.start}" class="kurz"></label>
      <label>Wiederholen <select id="er-abstand" style="width:auto">${ABSTAENDE.map(([w, t]) => `<option value="${w}" ${e.abstand === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label ${e.abstand ? '' : 'hidden'}>Spätestens bis <input type="time" id="er-ende" value="${e.ende}" class="kurz"></label>
    </div>
    <p class="meta">Zeiten: ${zeiten.join(' · ')}</p>`;
  if (erinnerungMoeglich()) {
    return `<h2>Erinnerung</h2>
      <p class="meta">Erinnert dich an die Karte, bis sie für heute ausgefüllt ist. Sobald du etwas einträgst, hören die Erinnerungen für heute auf.
      Die Mitteilung zeigt nie deine Werte.</p>
      <label class="check"><input type="checkbox" id="er-an" ${e.an ? 'checked' : ''}> Erinnerung an</label>
      ${felder}`;
  }
  return `<h2>Erinnerung</h2>
    <p class="meta">Im Browser kann die App dich nicht zuverlässig erinnern, wenn sie geschlossen ist. Das geht in der Handy-App.
    Bis dahin: einen täglichen Termin mit Weckzeiten in deinen Kalender übernehmen. Der Kalender weiß allerdings nicht, ob die Karte schon fertig ist.</p>
    ${felder}
    <div class="actions"><button type="button" class="primary" data-act="er-kalender">${icon('verlauf', 18)} Termin für den Kalender</button></div>`;
}

/** Erinnerungen neu planen (nur in der App) – nach dem Speichern, beim Start und bei Rückkehr in die App */
export async function erinnerungenAktualisieren() {
  if (!erinnerungMoeglich()) return null;
  const heute = await db.getEntry(todayISO());
  const erledigt = !!heute && (Object.keys(heute.values ?? {}).length > 0 || heute.status === 'abgeschlossen');
  try { return await erinnerungenPlanen(ER(), ton(), erledigt); } catch { return null; }
}

aufKlick({
  'er-kalender': async () => {
    await dateiSpeichern('diary-card-erinnerung.ics', kalenderDatei(ER()), 'text/calendar');
    return toast('Kalender-Datei gespeichert – öffnen und in den Kalender übernehmen');
  },
});

$main.addEventListener('change', async (e) => {
  const t = e.target;
  if (['er-an', 'er-start', 'er-abstand', 'er-ende'].includes(t.id)) {
    const e = ER();
    if (t.id === 'er-an') e.an = t.checked;
    if (t.id === 'er-start' && t.value) e.start = t.value;
    if (t.id === 'er-ende' && t.value) e.ende = t.value;
    if (t.id === 'er-abstand') e.abstand = +t.value;
    await saveConfig();
    const r = await erinnerungenAktualisieren();
    $main.querySelector('#erinnerung-karte').innerHTML = erinnerungHtml();
    if (r?.grund === 'erlaubnis') { e.an = false; await saveConfig(); $main.querySelector('#erinnerung-karte').innerHTML = erinnerungHtml(); return toast('Mitteilungen sind nicht erlaubt – bitte in den Handy-Einstellungen erlauben'); }
    return toast(erinnerungMoeglich() ? (e.an ? 'Erinnerung gespeichert' : 'Erinnerung aus') : 'Gespeichert');
  }
});

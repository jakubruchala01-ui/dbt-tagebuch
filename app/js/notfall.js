// Hilfe in der Krise: ♥-Fenster, Notfallkontakte, Notfallplan, Krisenhinweis.
import { hasValue } from './model.js';
import { esc, toast, openModal, frage, icon } from './ui.js';
import { uebungenListe } from './uebungen.js';
import { $main, E, state, saveConfig, aufKlick, aufSenden, feldNach } from './kern.js';

/** Übungsliste in kompakter Form (Krisen- und Hinweisfenster) */
export const uebungenKompakt = () => uebungenListe().replace('class="uebungen-liste"', 'class="uebungen-liste kompakt"');

/** Suizidgedanken ab 4 von 5 (bzw. 70 % der Skala) */
export function suizidHoch(values) {
  const f = feldNach('f_suizid');
  return !!f && hasValue(values?.f_suizid) && (values.f_suizid - f.min) / (f.max - f.min) >= 0.7;
}
export const KRISEN_HTML = `
  <div class="notfallnummern">
    <a class="notruf" href="tel:112"><b>112</b><small>Notruf (Rettungsdienst)</small></a>
    <a href="tel:08001110111"><b>0800 111 0 111</b><small>Telefonseelsorge – kostenlos, rund um die Uhr</small></a>
  </div>`;
export function zeigeKrisenHinweis() {
  openModal(`
    <h2>Suizidgedanken sind gerade stark.</h2>
    <p>Danke, dass du das ehrlich einträgst. Wenn du in Gefahr bist: <strong>Ruf jetzt an.</strong></p>
    ${KRISEN_HTML}
    <div class="actions dialog-knoepfe">
      <button class="primary" data-notfall>${icon('herz', 16)} Mein Notfallplan &amp; Kontakte</button>
      <button class="ghost" data-modal-zu>Weiter eintragen</button>
    </div>`, { klasse: 'sanft' });
}

// ---------- Notfall & Hinweis ----------
export function zeigeNotfall({ gesperrt = false } = {}) {
  const privat = !gesperrt || E().sperreKontakte !== false;
  const notSkills = privat ? state.config.skills.filter((s) => s.notfall && !s.hidden) : [];
  const kontakte = privat ? E().notfallKontakte ?? [] : [];
  openModal(`
    <h2>♥ Hilfe in der Krise</h2>
    <p>Wenn du in Gefahr bist oder daran denkst, dir etwas anzutun: <strong>Ruf jetzt an.</strong></p>
    <div class="notfallnummern">
      <a class="notruf" href="tel:112"><b>112</b><small>Notruf (Rettungsdienst)</small></a>
    </div>
    ${kontakte.length ? `<h3>Meine Kontakte</h3><div class="notfallnummern eigene">${kontakte.map((k) => `
      <a href="tel:${telHref(k.nummer)}"><b>${esc(k.name)}</b><small>${esc(k.nummer)}${k.info ? ` · ${esc(k.info)}` : ''}</small></a>`).join('')}</div>` : ''}
    <h3>Beratung rund um die Uhr</h3>
    <div class="notfallnummern">
      <a href="tel:08001110111"><b>0800 111 0 111</b><small>Telefonseelsorge – kostenlos, rund um die Uhr</small></a>
      <a href="tel:08001110222"><b>0800 111 0 222</b><small>Telefonseelsorge – zweite Leitung</small></a>
      <a href="tel:116117"><b>116 117</b><small>Ärztlicher Bereitschaftsdienst</small></a>
    </div>
    ${privat && E().notfallPlan ? `<h3>Mein Notfallplan</h3><div class="notfallplan">${esc(E().notfallPlan).replace(/\n/g, '<br>')}</div>` : ''}
    <h3>Skill jetzt üben</h3>
    ${uebungenKompakt()}
    ${notSkills.length ? `<h3>Meine Notfall-Skills</h3><ul class="notfallskills">${notSkills.map((s) => `<li><b>${esc(s.name)}</b>${s.description ? ` – ${esc(s.description)}` : ''}</li>`).join('')}</ul>` : ''}
    <p class="meta">Eigene Kontakte und Notfallplan: Mehr → Einstellungen. Notfall-Skills: Mehr → Skills.</p>`, { klasse: 'notfall' });
}

/** Telefonnummer für tel:-Links: nur Ziffern und führendes + */
const telHref = (nr) => String(nr).trim().replace(/\(0\)/g, '').replace(/^00/, '+').replace(/(?!^\+)[^\d]/g, '');

export function kontakteHtml() {
  const k = E().notfallKontakte ?? [];
  return `
    ${k.length ? `<ul class="kontaktliste">${k.map((c, i) => `<li>
      <span><b>${esc(c.name)}</b><small>${esc(c.nummer)}${c.info ? ` · ${esc(c.info)}` : ''}</small></span>
      <span class="kontakt-knoepfe">
        <button type="button" class="ghost klein" data-act="kontakt-hoch" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Nach oben">${icon('hoch', 16)}</button>
        <button type="button" class="ghost klein" data-act="kontakt-weg" data-i="${i}" aria-label="${esc(c.name)} entfernen">${icon('x', 16)}</button>
      </span></li>`).join('')}</ul>` : '<p class="meta">Noch keine eigenen Kontakte.</p>'}
    <form id="kontakt-form" class="row wrap" autocomplete="off">
      <label>Name <input name="name" required maxlength="40" placeholder="z. B. Anna"></label>
      <label>Nummer <input name="nummer" required type="tel" inputmode="tel" maxlength="30" placeholder="0151 …"></label>
      <label>Wann / Hinweis <input name="info" maxlength="60" placeholder="z. B. abends, Station rund um die Uhr"></label>
      <button type="submit" class="primary">${icon('plus', 18)} Hinzufügen</button>
    </form>`;
}

let planTimer = null;
let planGeaendert = false;
/** Speichert den Notfallplan (wird beim Tippen sofort übernommen und kurz danach gesichert) */
export async function speichereNotfallplan() {
  clearTimeout(planTimer);
  const feld = $main.querySelector('#notfallplan');
  if (feld && state.config) { planGeaendert ||= (E().notfallPlan ?? '') !== feld.value.trim(); E().notfallPlan = feld.value.trim(); }
  if (!planGeaendert) return;
  planGeaendert = false;
  await saveConfig();
}

aufKlick({
  'kontakt-weg': kontaktAendern,
  'kontakt-hoch': kontaktAendern,
  'notfall-speichern': async () => {
    await speichereNotfallplan();
    return toast('Notfallplan gespeichert');
  },
});

async function kontaktAendern(el) {
  const act = el.dataset.act;
  const liste = [...(E().notfallKontakte ?? [])];
  const i = +el.dataset.i;
  if (act === 'kontakt-weg') {
    if (!(await frage(`${liste[i].name} aus den Notfallkontakten entfernen?`, { titel: 'Kontakt entfernen', ja: 'Entfernen' }))) return;
    liste.splice(i, 1);
  } else [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
  E().notfallKontakte = liste;
  await saveConfig();
  $main.querySelector('#kontakte').innerHTML = kontakteHtml();
}

aufSenden({
  'kontakt-form': async (form) => {
    const fd = new FormData(form);
    const k = { name: String(fd.get('name')).trim(), nummer: String(fd.get('nummer')).trim(), info: String(fd.get('info')).trim() };
    if (!k.name || !k.nummer) return;
    if (telHref(k.nummer).replace('+', '').length < 3) return toast('Bitte eine gültige Nummer eingeben');
    E().notfallKontakte = [...(E().notfallKontakte ?? []), k];
    await saveConfig();
    $main.querySelector('#kontakte').innerHTML = kontakteHtml();
    return toast(`${k.name} gespeichert`);
  },
});

$main.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'notfallplan') { E().notfallPlan = t.value.trim(); planGeaendert = true; clearTimeout(planTimer); planTimer = setTimeout(speichereNotfallplan, 600); }
});

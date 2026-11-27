// Oberfläche: Woche, Karte, Ketten, Verlauf, PDF, Mehr (Vorlage, Skills, Einstellungen & Daten).
import * as db from './db.js';
import {
  clone, newId, todayISO, shiftDate, formatDate, createInitialConfig, currentVersion,
  templateChanged, commitTemplate, isCommitted, hasValue, fieldsForEntry, validateFields, cleanEntry, applyStandard, rememberMeds,
} from './model.js';
import {
  TYPEN, MODULE, BAUSTEINE, MED_EINHEITEN, FELD_INFO, kategorie, MESSARTEN, MESSART_ENDUNG, VERHALTEN_VORLAGEN, verhaltenFelder,
} from './defaults.js';
import { berichtHTML } from './bericht.js';
import { esc, fmtTime, datumKurz, groupBy, toast, wochenbeginn, WOCHENTAGE, WT_KURZ, wochentag, openModal, closeModal, frage, hinweis, icon } from './ui.js';
import { kettenModul } from './ketten.js';
import { pinHash, pinPruefen, pinGueltig, sperren } from './sicherheit.js';
import { HELL, NACHT, MODI, DESIGN_STANDARD, wendeDesignAn } from './design.js';
import { starteUebung, uebungenListe, UEBUNGEN } from './uebungen.js';
import {
  istNativ, dateiSpeichern, kannDrucken, drucken, ERINNERUNG_STANDARD, ABSTAENDE, erinnerungsZeiten, erinnerungMoeglich,
  erinnerungenPlanen, beiMitteilungAntippen, beiRueckkehr, kalenderDatei, bildschirmSchutz,
} from './plattform.js';

const $main = document.getElementById('main');
const state = {
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
const E = () => state.config.einstellungen;
const saveConfig = () => db.putConfig(state.config);
const ketten = kettenModul({ $main, state });

const EINSTELLUNGEN_STANDARD = { wochenstart: 1, pin: null, hinweisGesehen: false, notfallPlan: '', tonfall: 'klar', notfallKontakte: [], inhaltSchuetzen: true };
const BEFINDEN_IDS = ['f_belastung', 'f_selbstmitgefuehl', 'f_suizid', 'f_schlaf_erholsam', 'f_dissoziation', 'f_vertrauen'];

// ---------- Tonfall ----------
const TONFAELLE = {
  sanft: { name: 'Sanft', text: 'Ohne Druck. Lücken werden nur freundlich erwähnt.' },
  klar: { name: 'Klar', text: 'Freundlich, aber deutlich: Lücken werden benannt, mit einem kleinen nächsten Schritt.' },
  direkt: { name: 'Direkt', text: 'Kurz und sachlich. Für alle, die klare Erinnerungen mögen.' },
};
const ton = () => (TONFAELLE[E().tonfall] ? E().tonfall : 'klar');
const LUECKEN_GRUENDE = ['keine Kraft', 'vergessen', 'bewusst Pause', 'schlechte Phase', 'keine Zeit', 'anderes'];

/** Darf die aktuelle Ansicht verlassen werden? Karte und Ketten speichern selbst, nur die Vorlage fragt nach. */
async function leaveOk() {
  if (state.view === 'heute') await autoSpeichernJetzt();
  if (ketten.isDirty()) await ketten.speichernJetzt();
  if (state.view === 'vorlage' && state.draftFields && templateChanged(state.config, state.draftFields)) {
    return frage('Deine Änderungen an der Vorlage sind noch nicht gespeichert.', { titel: 'Vorlage verlassen?', ja: 'Verwerfen', nein: 'Weiter bearbeiten' });
  }
  return true;
}

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

// ---------- Anerkennende Rückmeldung & sanftes Angebot ----------
const ANERKENNUNG = {
  sanft: [
    'Danke, dass du heute hingeschaut hast.',
    'Eingetragen. Jeder Eintrag ist Selbstbeobachtung – egal, wie der Tag war.',
    'Gespeichert. Du musst nichts perfekt machen, um dranzubleiben.',
    'Danke dir. Auch ein schwerer Tag ist wertvolle Information für dich und deine Therapie.',
    'Notiert. Schön, dass du dir die Zeit genommen hast.',
    'Erledigt. Kleine Schritte zählen.',
  ],
  klar: [
    'Gespeichert. Gut, dass du drangeblieben bist.',
    'Erledigt für heute. Das hilft dir und deiner Therapie.',
    'Eingetragen – danke. Morgen wieder.',
    'Gespeichert. Auch schwere Tage sind wichtige Information.',
  ],
  direkt: ['Gespeichert.', 'Erledigt. Morgen wieder.', 'Karte gespeichert.'],
};
const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
/** Feldname mit Bereich, wo der Name allein unklar wäre (z. B. „Gaming – Wie lange“) */
const feldTitel = (f) => (/^(Problemverhalten|Verhalten|Neue Wege): /.test(f.group ?? '')
  ? `${f.group.split(': ').slice(1).join(': ')} – ${f.name}` : f.name);

/** Felder, bei denen ein hoher Wert Belastung bedeutet (nicht z. B. Selbstmitgefühl oder Schlaf) */
const istBelastend = (f) => f.type === 'scale' && (['f_belastung', 'f_suizid', 'f_dissoziation'].includes(f.id) || /drang/i.test(`${f.id} ${f.name}`));

function hoheWerte(values) {
  const schwelle = E().hinweisSchwelle ?? 0.8;
  return state.config.fields.filter((f) => istBelastend(f) && hasValue(values?.[f.id]) && (values[f.id] - f.min) / (f.max - f.min) >= schwelle);
}

/** Suizidgedanken ab 4 von 5 (bzw. 70 % der Skala) */
function suizidHoch(values) {
  const f = state.config.fields.find((x) => x.id === 'f_suizid');
  return !!f && hasValue(values?.f_suizid) && (values.f_suizid - f.min) / (f.max - f.min) >= 0.7;
}
const KRISEN_HTML = `
  <div class="notfallnummern">
    <a class="notruf" href="tel:112"><b>112</b><small>Notruf (Rettungsdienst)</small></a>
    <a href="tel:08001110111"><b>0800 111 0 111</b><small>Telefonseelsorge – kostenlos, rund um die Uhr</small></a>
  </div>`;
function zeigeKrisenHinweis() {
  openModal(`
    <h2>Suizidgedanken sind gerade stark.</h2>
    <p>Danke, dass du das ehrlich einträgst. Wenn du in Gefahr bist: <strong>Ruf jetzt an.</strong></p>
    ${KRISEN_HTML}
    <div class="actions dialog-knoepfe">
      <button class="primary" data-notfall>${icon('herz', 16)} Mein Notfallplan &amp; Kontakte</button>
      <button class="ghost" data-modal-zu>Weiter eintragen</button>
    </div>`, { klasse: 'sanft' });
}

function rueckmeldung(values) {
  toast(zufall(ANERKENNUNG[ton()]));
  erinnerungenAktualisieren();
  const hoch = hoheWerte(values);
  const krise = suizidHoch(values);
  if (!krise && (!hoch.length || E().sanfterHinweis === false)) return;
  setTimeout(() => {
    openModal(`
      <h2>Heute war viel los.</h2>
      <p>${hoch.map((f) => esc(feldTitel(f))).join(', ')} ${hoch.length > 1 ? 'waren' : 'war'} hoch. Das ist kein Fehler – nur ein Hinweis, gut für dich zu sorgen.</p>
      ${krise ? `<p>Bei starken Suizidgedanken: <strong>Ruf an, wenn du in Gefahr bist.</strong></p>${KRISEN_HTML}` : ''}
      <p>Magst du jetzt einen Skill ausprobieren?</p>
      ${uebungenListe().replace('class="uebungen-liste"', 'class="uebungen-liste kompakt"')}
      <div class="actions dialog-knoepfe">
        <button class="ghost" data-modal-zu>Nicht jetzt</button>
        <button class="ghost" data-notfall>${icon('herz', 16)} Notfallplan</button>
      </div>
      <p class="meta">Diesen Hinweis kannst du unter Mehr → Einstellungen anpassen oder ausschalten.</p>`, { klasse: 'sanft' });
  }, 900);
}

// ---------- Schnell-Karte (ca. 30 Sekunden) ----------
async function zeigeSchnellkarte(datum = todayISO()) {
  const heute = datum;
  const nachtrag = datum !== todayISO();
  const stored = await db.getEntry(heute);
  const werte = { ...(stored?.values ?? {}) };
  const felder = (state.config.schnellFelder ?? []).map((id) => state.config.fields.find((f) => f.id === id)).filter((f) => f && !f.hidden);
  const chips = (f) => {
    if (f.type === 'yesno') return [true, false].map((b) => `<button type="button" data-sf="${f.id}" data-sv="${b}" class="${werte[f.id] === b ? 'on' : ''}">${b ? 'Ja' : 'Nein'}</button>`).join('');
    const opts = [];
    for (let x = f.min; x <= f.max + 1e-9; x = +(x + f.step).toFixed(4)) opts.push(x);
    return opts.map((o) => `<button type="button" data-sf="${f.id}" data-sv="${o}" class="${werte[f.id] === o ? 'on' : ''}">${o}</button>`).join('');
  };
  const box = openModal(`
    <h2>${icon('blitz', 20)} Schnell-Karte <small class="meta">· ${nachtrag ? `für ${esc(WOCHENTAGE[wochentag(datum)])}, ${datumKurz(datum)}` : 'ca. 30 Sekunden'}</small></h2>
    <p class="meta">${nachtrag ? 'Nachtragen, so gut du dich erinnerst. Ungefähr reicht.' : 'Nur das Nötigste für heute. Skills und den Rest kannst du später in der Karte ergänzen.'}</p>
    ${felder.map((f) => `<div class="schnellfeld"><span class="fname">${esc(feldTitel(f))}</span>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}
      <div class="chips schnell-chips">${chips(f)}</div></div>`).join('') || '<p>Noch keine Felder gewählt. Unter Mehr → Vorlage kannst du Felder für die Schnell-Karte markieren.</p>'}
    <div class="actions dialog-knoepfe">
      <button class="ghost" data-modal-zu>Abbrechen</button>
      <button class="primary" id="schnell-speichern">${icon('check', 18)} Speichern</button>
    </div>`, { klasse: 'schnell' });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sf]');
    if (!b) return;
    const raw = b.dataset.sv;
    const v = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
    werte[b.dataset.sf] = werte[b.dataset.sf] === v ? null : v;
    box.querySelectorAll(`[data-sf="${b.dataset.sf}"]`).forEach((x) => x.classList.toggle('on', x === b && werte[b.dataset.sf] !== null));
  });
  box.querySelector('#schnell-speichern').onclick = async () => {
    const now = new Date().toISOString();
    const e = cleanEntry({ date: heute, skills: {}, status: 'entwurf', ...stored, values: werte });
    if (!Object.keys(e.values).length) { closeModal(); return; }
    e.templateVersion = currentVersion(state.config).v;
    e.createdAt ??= now;
    e.updatedAt = now;
    await db.putEntry(e);
    closeModal();
    if (nachtrag) { toast(`Nachgetragen für ${datumKurz(datum)}`); erinnerungenAktualisieren(); } else rueckmeldung(e.values);
    if (['woche', 'heute'].includes(state.view)) await views[state.view]();
  };
}

/** Übung als genutzten Skill in die heutige Karte eintragen */
async function trageUebungEin(u, wirkung) {
  const heute = todayISO();
  if (state.view === 'heute' && state.date === heute) await autoSpeichernJetzt();
  const e = (await db.getEntry(heute)) ?? { date: heute, values: {}, skills: {}, status: 'entwurf', templateVersion: currentVersion(state.config).v };
  const now = new Date().toISOString();
  if (state.config.skills.some((s) => s.id === u.skill)) e.skills[u.skill] = { used: true, rating: wirkung };
  e.createdAt ??= now;
  e.updatedAt = now;
  await db.putEntry(e);
  toast(`„${u.name}“ in der heutigen Karte eingetragen`);
  if (['woche', 'heute'].includes(state.view)) await views[state.view]();
}

// ---------- Für die nächste Stunde merken ----------
function zeigeMerken() {
  const notizen = state.config.stundenNotizen ?? [];
  const offen = notizen.filter((n) => !n.erledigt);
  const klaeren = state.config.fields.filter((f) => state.config.feldInfo?.[f.id]?.klaeren && !f.hidden);
  const box = openModal(`
    <h2>${icon('merken', 20)} Für die nächste Stunde</h2>
    <p class="meta">Fragen, Gedanken, Erlebnisse, die du in der Therapie ansprechen möchtest. Erscheinen auch im PDF.</p>
    <textarea id="merken-text" rows="3" placeholder="z. B. Warum fällt mir STOP im Streit so schwer?" autofocus></textarea>
    <div class="actions"><button class="primary" id="merken-neu">${icon('plus', 18)} Merken</button></div>
    ${offen.length ? `<h3>Offen (${offen.length})</h3><ul class="merkliste">${offen.map((n) => `
      <li><label class="check"><input type="checkbox" data-merk-erledigt="${n.id}"> <span>${esc(n.text)}<small class="meta"> · ${datumKurz(n.datum)}</small></span></label></li>`).join('')}</ul>
      <p class="meta">Haken = besprochen. Besprochenes wird archiviert, nicht gelöscht.</p>` : ''}
    ${klaeren.length ? `<h3>Noch zu klären (rotes i)</h3><p>${klaeren.map((f) => `<span class="klaeren-chip"><span class="info-knopf klaeren" aria-hidden="true">i</span> ${esc(f.name)}</span>`).join(' ')}</p>` : ''}`);
  box.querySelector('#merken-neu').onclick = async () => {
    const text = box.querySelector('#merken-text').value.trim();
    if (!text) { box.querySelector('#merken-text').focus(); return; }
    state.config.stundenNotizen = [...notizen, { id: newId('n'), text, datum: todayISO(), erledigt: false }];
    await saveConfig();
    toast('Für die nächste Stunde gemerkt');
    zeigeMerken();
    if (state.view === 'woche') renderWoche();
  };
  box.querySelectorAll('[data-merk-erledigt]').forEach((cb) => {
    cb.onchange = async () => {
      const n = state.config.stundenNotizen.find((x) => x.id === cb.dataset.merkErledigt);
      n.erledigt = cb.checked;
      n.erledigtAm = todayISO();
      await saveConfig();
      cb.closest('li').classList.toggle('erledigt', cb.checked);
      if (state.view === 'woche') renderWoche();
    };
  });
}

window.addEventListener('pagehide', () => { autoSpeichernJetzt(); ketten.speichernJetzt(); speichereNotfallplan(); });
window.addEventListener('beforeunload', (e) => {
  if (autoTimer) autoSpeichernJetzt();
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

// ---------- Lücken: fehlende Karten der letzten 7 Tage ----------
/** Tage der letzten Woche (vor heute) ohne Karte und ohne Lücken-Notiz – frühestens ab der ersten Karte überhaupt */
function fehlendeTage(alle, heute) {
  if (!alle.length) return [];
  const daten = new Set(alle.map((e) => e.date));
  const erster = [...daten].sort()[0];
  const notiert = state.config.luecken ?? {};
  const liste = [];
  for (let i = 7; i >= 1; i--) {
    const d = shiftDate(heute, -i);
    if (d >= erster && !daten.has(d) && !notiert[d]) liste.push(d);
  }
  return liste;
}

function lueckenHtml(fehlend, heuteErledigt) {
  const t = ton();
  const heute = todayISO();
  if (!fehlend.length || E().lueckeAusgeblendet === heute) return '';
  if (t === 'sanft' && (fehlend.length < 3 || heuteErledigt)) return '';
  const n = fehlend.length;
  const wann = n === 1 ? (fehlend[0] === shiftDate(heute, -1) ? 'Gestern fehlt die Karte' : `${WOCHENTAGE[wochentag(fehlend[0])]} fehlt die Karte`) : `${n} Tage ohne Karte`;
  const text = {
    sanft: 'Schön, dass du da bist. Lücken sind okay – du kannst einfach mit heute weitermachen. Nachtragen ist freiwillig.',
    klar: `${wann} – kann passieren. Magst du kurz nachtragen oder in einem Satz notieren, was los war?`,
    direkt: `${wann}. Trag sie kurz nach oder notiere den Grund. Auch eine Lücke ist eine nützliche Information für die Therapie.`,
  }[t];
  return `<div class="luecken-box ton-${t}">
    <p>${text}</p>
    <div class="luecken-tage">${fehlend.map((d) => `<button type="button" class="ghost klein" data-schnell="${d}" title="Schnell-Karte für diesen Tag">${icon('blitz', 14)} ${WT_KURZ[wochentag(d)]} ${d.slice(8)}.${d.slice(5, 7)}.</button>`).join('')}</div>
    <div class="actions">
      <button type="button" class="ghost klein" data-luecke-notiz="${fehlend.join(',')}">Notiz zur Lücke</button>
      <button type="button" class="ghost klein" data-act="luecke-spaeter">${t === 'direkt' ? 'Heute nicht' : 'Später'}</button>
    </div>
  </div>`;
}

/** Kurze Notiz, warum Karten fehlen. Erscheint im PDF; die Tage gelten dann nicht mehr als offen. */
function zeigeLueckenNotiz(tage) {
  let grund = '';
  const box = openModal(`
    <h2>Notiz zur Lücke</h2>
    <p class="meta">${tage.map((d) => `${WT_KURZ[wochentag(d)]} ${datumKurz(d)}`).join(' · ')}</p>
    <p>Was war los? Ein Stichwort reicht.</p>
    <div class="chips">${LUECKEN_GRUENDE.map((g) => `<button type="button" data-grund="${esc(g)}">${esc(g)}</button>`).join('')}</div>
    <label>Ein Satz dazu (freiwillig)<textarea id="luecke-text" rows="2" placeholder="z. B. Krankenhaus, Besuch, keine Energie"></textarea></label>
    <p class="meta">Erscheint im PDF für die Therapie. Du kannst die Tage trotzdem jederzeit nachtragen.</p>
    <div class="actions dialog-knoepfe">
      <button class="ghost" data-modal-zu>Abbrechen</button>
      <button class="primary" id="luecke-speichern">${icon('check', 18)} Speichern</button>
    </div>`);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-grund]');
    if (!b) return;
    grund = grund === b.dataset.grund ? '' : b.dataset.grund;
    box.querySelectorAll('[data-grund]').forEach((x) => x.classList.toggle('on', x.dataset.grund === grund));
  });
  box.querySelector('#luecke-speichern').onclick = async () => {
    const text = box.querySelector('#luecke-text').value.trim();
    if (!grund && !text) { toast('Bitte ein Stichwort wählen oder kurz etwas schreiben'); return; }
    state.config.luecken ??= {};
    tage.forEach((d) => { state.config.luecken[d] = { grund, text }; });
    await saveConfig();
    closeModal();
    toast('Notiert. Danke für die Ehrlichkeit.');
    if (state.view === 'woche') renderWoche();
  };
}

// ---------- Woche (Startseite) ----------
/** Freundlicher Gruß je nach Tageszeit, mit kleiner ruhiger Sonne bzw. Mond */
function grussHtml() {
  const h = new Date().getHours();
  const [text, nacht] = h < 5 ? ['Gute Nacht', true] : h < 11 ? ['Guten Morgen', false] : h < 17 ? ['Hallo', false] : h < 22 ? ['Guten Abend', true] : ['Gute Nacht', true];
  const name = state.config.profil?.name ? `, ${esc(state.config.profil.name)}` : '';
  const bild = nacht
    ? '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" style="fill:color-mix(in srgb, var(--k-befinden) 16%, var(--karte))"/><path d="M27 12a11 11 0 1 0 6 18 9 9 0 0 1-6-18z" style="fill:var(--k-befinden)" opacity=".85"/><circle cx="13" cy="14" r="1.2" style="fill:var(--k-befinden)"/><circle cx="31" cy="34" r="1" style="fill:var(--k-befinden)"/></svg>'
    : '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" style="fill:color-mix(in srgb, var(--k-ereignisse) 18%, var(--karte))"/><circle cx="22" cy="22" r="7" style="fill:var(--k-ereignisse)" opacity=".85"/><g style="stroke:var(--k-ereignisse)" stroke-width="2" stroke-linecap="round" opacity=".7"><path d="M22 8v4M22 32v4M8 22h4M32 22h4M12 12l3 3M29 29l3 3M12 32l3-3M29 15l3-3"/></g></svg>';
  return `<div class="gruss">${bild}<div><b>${text}${name}</b><small>${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div></div>`;
}

function kennFeld() {
  return state.config.fields.find((f) => f.id === 'f_belastung' && !f.hidden)
    ?? state.config.fields.find((f) => f.type === 'scale' && !f.hidden);
}

function problemHandlung(e) {
  return state.config.fields.some((f) => f.type === 'yesno' && (f.group ?? '').startsWith('Problemverhalten') && e?.values[f.id] === true);
}

async function renderWoche() {
  const start = E().wochenstart;
  const von = wochenbeginn(state.wocheDatum, start);
  const tage = Array.from({ length: 7 }, (_, i) => shiftDate(von, i));
  const vorTage = tage.map((d) => shiftDate(d, -7));
  const alle = await db.getAllEntries();
  const byDate = new Map(alle.map((e) => [e.date, e]));
  const heute = todayISO();
  const istAktuell = tage.includes(heute);
  const eintraege = tage.map((d) => byDate.get(d));
  const vorher = vorTage.map((d) => byDate.get(d));
  const zaehle = (list, fn) => list.filter((e) => e && fn(e)).length;
  const kf = kennFeld();
  const kettenWoche = (await db.getAllKetten()).filter((k) => !k.archiviert && k.date >= tage[0] && k.date <= tage[6]);
  const heuteEintrag = byDate.get(heute);
  const letzter = alle.map((e) => e.date).filter((d) => d < heute).sort().at(-1);
  const fehlend = fehlendeTage(alle, heute);
  const ersterStart = alle.length === 0;
  // Sanfte Sicherungs-Erinnerung: ab 3 Karten, wenn nie oder vor über 30 Tagen gesichert (und nicht auf „später“ gestellt)
  const sicherungFaellig = alle.length >= 3
    && (!E().letzteSicherung || E().letzteSicherung < shiftDate(heute, -30))
    && !(E().sicherungSpaeter && E().sicherungSpaeter > heute);
  const offeneNotizen = (state.config.stundenNotizen ?? []).filter((n) => !n.erledigt).length;

  const kachel = (titel, wert, vorwert, gesamt = '') => `
    <div class="kachel"><span class="k-titel">${titel}</span>
      <span class="k-wert">${wert}${gesamt ? `<small>/${gesamt}</small>` : ''}</span>
      <span class="k-vor">Vorwoche: ${vorwert}</span></div>`;

  const zusammenfassung = (e) => {
    if (!e) return 'Noch keine Karte';
    const teile = [];
    if (kf && hasValue(e.values[kf.id])) teile.push(`${kf.name} ${e.values[kf.id]}`);
    const sk = Object.keys(e.skills).length;
    if (sk) teile.push(`${sk} Skill${sk > 1 ? 's' : ''}`);
    if (problemHandlung(e)) teile.push('Problemverhalten');
    teile.push(e.status === 'abgeschlossen' ? 'abgeschlossen' : 'Entwurf');
    return teile.join(' · ');
  };

  const status = (e) => (!e ? '' : e.status === 'abgeschlossen' ? 'fertig' : 'entwurf');
  $main.innerHTML = `
    ${istAktuell ? grussHtml() : ''}
    <div class="wochenkopf">
      <button data-act="w-nav" data-delta="-7" aria-label="Vorige Woche">${icon('links')}</button>
      <div><b>${datumKurz(tage[0]).slice(0, 6)} – ${datumKurz(tage[6])}</b>
        <small>${WOCHENTAGE[start]} bis ${WOCHENTAGE[(start + 6) % 7]}</small></div>
      <button data-act="w-nav" data-delta="7" aria-label="Nächste Woche" ${istAktuell ? 'disabled' : ''}>${icon('rechts')}</button>
    </div>
    <div class="wochenstreifen" role="list" aria-label="Tage dieser Woche">${tage.map((d, i) => {
      const e = eintraege[i];
      const lbl = `${WOCHENTAGE[wochentag(d)]}: ${!e ? 'keine Karte' : e.status === 'abgeschlossen' ? 'abgeschlossen' : 'Entwurf'}`;
      return `<button role="listitem" class="${d === heute ? 'heute' : ''}" data-act="open-day" data-date="${d}" ${d > heute ? 'disabled' : ''} aria-label="${lbl}" title="${lbl}">
        <small>${WT_KURZ[wochentag(d)]}</small><span class="punkt ${status(e)}">${e?.status === 'abgeschlossen' ? icon('check', 16) : d.slice(8)}</span></button>`;
    }).join('')}</div>
    <p class="legende-zeile"><span><i style="border:2px dashed var(--linie)"></i>leer</span><span><i style="background:color-mix(in srgb, var(--akzent) 15%, var(--karte));border:2px solid var(--akzent)"></i>Entwurf</span><span><i style="background:var(--akzent)"></i>abgeschlossen</span></p>
    ${istAktuell ? '' : '<p class="zentriert"><button class="ghost klein" data-act="w-heute">Zur aktuellen Woche</button></p>'}
    ${istAktuell && ersterStart ? `
      <div class="karte einfuehrung">
        <h2>Willkommen in deinem Tagebuch</h2>
        <ul>
          <li><b>Jeden Tag eine Karte</b> – so ausführlich, wie es dir heute möglich ist. Die Schnell-Karte braucht nur sechs Antippen.</li>
          <li><b>Alles speichert automatisch</b> und bleibt nur auf diesem Gerät.</li>
          <li><b>Lücken sind okay.</b> Es gibt keine Serien und kein „verpasst“.</li>
        </ul>
        <p class="meta">Die Vorlage (Mehr → Vorlage) kannst du jederzeit mit deiner Therapie anpassen. Hilfe in der Krise findest du immer oben über ♥.</p>
      </div>` : ''}
    ${istAktuell && sicherungFaellig ? `
      <div class="sicherung-hinweis">
        <span>${icon('wolke', 20)}</span>
        <div><b>Zeit für eine Sicherung?</b>
          <small>${E().letzteSicherung ? `Letzte Sicherung: ${datumKurz(E().letzteSicherung)}` : 'Noch keine Sicherung'} · Deine Einträge liegen nur in diesem Browser.</small></div>
        <span class="sicherung-knoepfe"><button class="ghost klein" data-act="w-sichern-spaeter">Später</button><button class="primary" data-act="w-sichern">Jetzt sichern</button></span>
      </div>` : ''}
    ${istAktuell ? `
      ${lueckenHtml(fehlend, !!heuteEintrag)}
      <div class="heutekarte ${heuteEintrag?.status === 'abgeschlossen' ? 'fertig' : ''}">
        <div><small>Heutige Karte</small>
          <b>${!heuteEintrag ? 'Noch offen' : heuteEintrag.status === 'abgeschlossen' ? 'Abgeschlossen ✓' : 'Entwurf – weitermachen?'}</b></div>
        <button class="primary" data-act="open-day" data-date="${heute}">${heuteEintrag ? 'Öffnen' : 'Ausfüllen'} ${icon('rechts', 18)}</button>
      </div>
      <div class="schnellreihe">
        <button data-schnell>${icon('blitz', 18)} Schnell-Karte</button>
        <button data-act="w-skill">${icon('atem', 18)} Skill üben</button>
        <button data-merken>${icon('merken', 18)} Merken${offeneNotizen ? ` (${offeneNotizen})` : ''}</button>
      </div>` : ''}
    ${ersterStart ? '' : `<div class="kacheln">
      ${kachel('Erfasste Tage', zaehle(eintraege, () => true), zaehle(vorher, () => true))}
      ${kachel('Abgeschlossen', zaehle(eintraege, (e) => e.status === 'abgeschlossen'), zaehle(vorher, (e) => e.status === 'abgeschlossen'))}
      ${kachel('Tage mit Skills', zaehle(eintraege, (e) => Object.keys(e.skills).length), zaehle(vorher, (e) => Object.keys(e.skills).length))}
      ${kachel('Problemverhalten', zaehle(eintraege, problemHandlung), zaehle(vorher, problemHandlung))}
    </div>`}
    ${kf && !ersterStart ? `<div class="karte balkenkarte kat-${kategorie(kf.group)}"><div class="balken-skala"><span class="k-titel">${esc(kf.name)} pro Tag</span><span>Skala ${kf.min}–${kf.max}</span></div>
      <div class="balken">${tage.map((d, i) => {
        const v = eintraege[i]?.values[kf.id];
        const h = hasValue(v) ? Math.max(4, ((v - kf.min) / (kf.max - kf.min)) * 100) : 0;
        return `<div class="bal" title="${WOCHENTAGE[wochentag(d)]}: ${hasValue(v) ? v : 'kein Wert'}"><span class="bal-wert">${hasValue(v) ? v : ''}</span><span class="bal-saeule ${hasValue(v) ? '' : 'leer'}" style="height:calc((100% - 34px) * ${h / 100})"></span><small>${WT_KURZ[wochentag(d)]}</small></div>`;
      }).join('')}</div></div>` : ''}
    <div class="wochen-links">
      <button data-act="w-pdf">${icon('pdf')} PDF dieser Woche</button>
      <button data-act="w-kette">${icon('ketten')} Ketten${kettenWoche.length ? ` (${kettenWoche.length})` : ''}</button>
      <button data-act="goto" data-view="verlauf">${icon('verlauf')} Verlauf</button>
    </div>
    ${ersterStart ? '' : tage.filter((d) => d <= heute).reverse().map((d) => {
      const e = byDate.get(d);
      return `<button class="listeneintrag" data-act="open-day" data-date="${d}">
        <span class="tagbadge ${status(e)}">${WT_KURZ[wochentag(d)]}</span>
        <span class="li-text"><b>${formatDate(d).replace(/\.\d{4}$/, '.')}</b><small>${esc(zusammenfassung(e))}</small></span>
        <span class="pfeil">${icon('rechts')}</span></button>`;
    }).join('')}`;
}

// ---------- Tageskarte ----------
async function renderHeute() {
  const stored = await db.getEntry(state.date);
  state.entry = stored ? clone(stored) : { date: state.date, values: {}, skills: {}, status: 'entwurf' };
  state.entry.status ??= 'entwurf';
  state.entryDirty = false;
  state.entryHatteWerte = Object.keys(state.entry.values ?? {}).length > 0;
  const fields = fieldsForEntry(state.config, stored);
  const isToday = state.date === todayISO();
  const kettenTag = (await db.getAllKetten()).filter((k) => k.date === state.date && !k.archiviert);
  const zuKlaeren = E().klaerenAusgeblendet === todayISO() ? 0 : fields.filter((f) => state.config.feldInfo?.[f.id]?.klaeren).length;

  const kurz = !!E().kurzansicht;
  const kurzSet = new Set(state.config.kurzFelder ?? []);
  const sichtbarKurz = (f) => !kurz || kurzSet.has(f.id);
  const fertig = state.entry.status === 'abgeschlossen';

  $main.innerHTML = `
    <div class="datebar">
      <button data-act="day" data-delta="-1" aria-label="Vortag">${icon('links')}</button>
      <input type="date" id="datum" value="${state.date}" max="${todayISO()}" aria-label="Datum der Karte">
      <button data-act="day" data-delta="1" aria-label="Folgetag" ${isToday ? 'disabled' : ''}>${icon('rechts')}</button>
      ${isToday ? '' : '<button data-act="today" class="ghost">Heute</button>'}
    </div>
    <div class="kartenkopf">
      <span class="meta">${formatDate(state.date)} · <span id="kartenstand">${stored ? (fertig ? 'abgeschlossen' : 'Entwurf, wird automatisch gespeichert') : 'noch keine Karte'}</span></span>
      <label class="umschalter"><input type="checkbox" id="kurzansicht" ${kurz ? 'checked' : ''}> Nur das Wichtigste</label>
    </div>
    <p class="klaeren-leiste" ${zuKlaeren ? '' : 'hidden'}><span class="info-knopf klaeren" aria-hidden="true">i</span>
      <span><b id="klaeren-zahl">${zuKlaeren}</b> Punkte noch mit der Therapie klären – rotes i antippen für die Erklärung.</span>
      <button type="button" class="ghost klein klaeren-zu" data-act="klaeren-aus" aria-label="Heute ausblenden" title="Heute ausblenden">${icon('x', 16)}</button></p>
    <form id="card" autocomplete="off">
      ${groupBy(fields, (f) => f.group || 'Allgemein').map(([g, fs]) => {
        const sichtbar = fs.filter(sichtbarKurz);
        return `<details class="kasten gruppe-k kat-${kategorie(g)} ${sichtbar.length ? '' : 'kurz-aus'}" data-gruppe="${esc(g)}" ${state.zu?.has(g) ? '' : 'open'}>
          <summary><span class="kat-punkt" aria-hidden="true"></span><span>${esc(g)}</span><span class="fortschritt" data-fortschritt="${esc(g)}"></span>${icon('runter', 18)}</summary>
          <div class="gruppe-inhalt">${fs.map((f) => (sichtbarKurz(f) ? fieldInput(f) : '')).join('')}</div>
        </details>`;
      }).join('')}
      <details class="kasten gruppe-k" data-gruppe="__skills" ${state.zu?.has('__skills') || kurz ? '' : 'open'}>
        <summary><span>Skills heute</span><span class="fortschritt" id="skillcount"></span>${icon('runter', 18)}</summary>
        <div class="gruppe-inhalt">${skillsBlock(stored)}</div>
      </details>
      <details class="kasten gruppe-k" data-gruppe="__ketten" ${state.zu?.has('__ketten') ? '' : 'open'}>
        <summary><span>Verhaltensketten</span>${kettenTag.length ? `<span class="fortschritt">${kettenTag.length}</span>` : ''}${icon('runter', 18)}</summary>
        <div class="gruppe-inhalt">
        ${kettenTag.map((k) => `<button type="button" class="listeneintrag" data-act="kette-oeffnen" data-id="${k.id}">
          <span class="tagbadge ${k.status === 'fertig' ? 'fertig' : 'entwurf'}">${icon('ketten', 18)}</span>
          <span class="li-text"><b>${esc(k.titel || k.problem || 'Ohne Titel')}</b><small>${k.status === 'fertig' ? 'abgeschlossen' : 'Entwurf'}</small></span>
          <span class="pfeil">${icon('rechts')}</span></button>`).join('')}
        <button type="button" class="ghost" data-act="kette-neu">${icon('plus', 18)} Kette für diesen Tag</button>
        </div>
      </details>
      <div class="actions sticky">
        ${fertig
          ? `<button type="button" class="ghost" data-act="status" data-wert="entwurf">Wieder als Entwurf öffnen</button><span class="meta">${icon('check', 16)} Karte abgeschlossen</span>`
          : `<button type="button" class="primary" data-act="status" data-wert="abgeschlossen">${icon('check', 18)} Karte abschließen</button><span class="meta">Entwurf wird automatisch gespeichert</span>`}
      </div>
    </form>`;
  updateSkillCount();
  updFortschritt();
}

/** Fortschritt pro Bereich: „3/6“ ausgefüllt */
function updFortschritt() {
  const kurz = !!E().kurzansicht;
  const kurzSet = new Set(state.config.kurzFelder ?? []);
  groupBy(fieldsForEntry(state.config, state.entry), (f) => f.group || 'Allgemein').forEach(([g, fs]) => {
    const el = $main.querySelector(`[data-fortschritt="${CSS.escape(g)}"]`);
    if (!el) return;
    const liste = fs.filter((f) => !kurz || kurzSet.has(f.id));
    const voll = liste.filter((f) => hasValue(state.entry.values[f.id])).length;
    el.textContent = `${voll}/${liste.length}`;
    el.classList.toggle('voll', voll === liste.length && liste.length > 0);
  });
}

// ---------- Automatisch speichern ----------
let autoTimer = null;
let speichertGerade = Promise.resolve();

function setzeSpeicherstatus(text, ok = false) {
  const el = document.getElementById('speicherstatus');
  if (el) el.innerHTML = text ? `${ok ? icon('check', 14) : ''}${esc(text)}` : '';
}

function autoSpeichern() {
  state.entryDirty = true;
  setzeSpeicherstatus('speichert …');
  clearTimeout(autoTimer);
  autoTimer = setTimeout(autoSpeichernJetzt, 700);
}

async function autoSpeichernJetzt() {
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

/** ⓘ-Knopf zu einem Feld: signalrot, solange die Bedeutung noch geklärt werden muss. */
function infoKnopf(f) {
  const info = state.config.feldInfo?.[f.id];
  if (!info?.text && !info?.notiz && !info?.klaeren) return '';
  return `<button type="button" class="info-knopf ${info.klaeren ? 'klaeren' : ''}" data-act="info" data-field="${f.id}"
    title="${info.klaeren ? 'Erklärung – muss noch mit der Therapie geklärt werden' : 'Erklärung'}" aria-label="Erklärung zu ${esc(f.name)}">i</button>`;
}

function zeigeInfo(fid, nachher = () => {}) {
  const f = state.config.fields.find((x) => x.id === fid) ?? state.draftFields?.find((x) => x.id === fid);
  const info = { text: '', notiz: '', klaeren: false, ...state.config.feldInfo?.[fid] };
  const box = openModal(`
    <h2>${esc(f?.name ?? 'Feld')} ${f?.hint ? `<small class="meta">${esc(f.hint)}</small>` : ''}</h2>
    ${info.klaeren ? '<p class="klaeren-hinweis">Muss noch mit der Therapie geklärt werden</p>' : ''}
    <h3>Was ist gemeint?</h3>
    <textarea id="info-text" rows="7" placeholder="Eigene Erklärung, z. B. woran du eine 2 und eine 4 erkennst">${esc(info.text)}</textarea>
    <h3>Was meine Therapeutin / mein Therapeut sagt</h3>
    <textarea id="info-notiz" rows="3" placeholder="z. B. „Selbstmitgefühl = wie streng ich heute mit mir war“">${esc(info.notiz)}</textarea>
    <label class="check klaeren-check"><input type="checkbox" id="info-klaeren" ${info.klaeren ? 'checked' : ''}> Muss noch geklärt werden (ⓘ signalrot)</label>
    <div class="actions"><button class="primary" id="info-speichern">Speichern</button><button class="ghost" data-modal-zu>Schließen</button></div>
    <p class="meta">Allgemeine Erklärung aus DBT-Grundlagen und Fachliteratur. Was auf deiner Karte genau gemeint ist, legst du mit deiner Therapie fest.</p>`);
  box.querySelector('#info-speichern').onclick = async () => {
    state.config.feldInfo = {
      ...state.config.feldInfo,
      [fid]: { text: box.querySelector('#info-text').value.trim(), notiz: box.querySelector('#info-notiz').value.trim(), klaeren: box.querySelector('#info-klaeren').checked },
    };
    await saveConfig();
    closeModal();
    toast(state.config.feldInfo[fid].klaeren ? 'Gespeichert – noch zu klären' : 'Gespeichert – geklärt ✓');
    nachher();
  };
}

/** ⓘ-Knöpfe auf der Seite neu einfärben, ohne die Karte neu zu laden (ungespeicherte Werte bleiben). */
function infoKnoepfeAktualisieren() {
  const knoepfe = [...$main.querySelectorAll('.info-knopf[data-field]')];
  knoepfe.forEach((b) => b.classList.toggle('klaeren', !!state.config.feldInfo?.[b.dataset.field]?.klaeren));
  const n = knoepfe.filter((b) => b.classList.contains('klaeren')).length;
  const el = $main.querySelector('#klaeren-zahl');
  if (el) {
    el.textContent = n;
    el.closest('.klaeren-leiste').hidden = !n || E().klaerenAusgeblendet === todayISO();
  }
}

function fieldInput(f) {
  const v = state.entry.values[f.id];
  const label = `<span class="fname">${esc(f.name)}${f.hidden ? ' <em>(ausgeblendet)</em>' : ''} ${infoKnopf(f)}</span>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}`;
  const clear = `<button type="button" class="clear" data-act="clear" data-field="${f.id}" title="Leeren" aria-label="Leeren">×</button>`;

  if (f.type === 'scale') {
    const steps = Math.round((f.max - f.min) / f.step);
    const opts = Array.from({ length: steps }, (_, i) => +(f.min + (i + 1) * f.step).toFixed(4));
    return `<div class="field stepfeld" data-scale="${f.id}">
      <div class="stepkopf"><div>${label}</div>
        <div class="stepper" role="spinbutton" tabindex="0" data-field="${f.id}"
          aria-label="${esc(f.name)}" aria-valuemin="${f.min}" aria-valuemax="${f.max}"
          ${hasValue(v) ? `aria-valuenow="${v}"` : ''} aria-valuetext="${hasValue(v) ? `${v} von ${f.max}` : 'offen, noch kein Wert'}">
          <button type="button" tabindex="-1" aria-hidden="true" data-act="step" data-field="${f.id}" data-delta="-1">−</button>
          <output class="stepwert ${hasValue(v) ? '' : 'offen'}">${hasValue(v) ? v : 'Offen'}</output>
          <button type="button" tabindex="-1" aria-hidden="true" data-act="step" data-field="${f.id}" data-delta="1">+</button>
        </div></div>
      ${steps <= 10
        ? `<div class="segmente" aria-hidden="true">${opts.map((o) => `<button type="button" tabindex="-1" class="seg ${hasValue(v) && o <= v ? 'an' : ''}" data-act="seg" data-field="${f.id}" data-value="${o}" title="${o}"></button>`).join('')}</div>`
        : `<input type="range" data-field="${f.id}" data-kind="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${hasValue(v) ? v : f.min}" class="${hasValue(v) ? '' : 'unset'}" aria-label="${esc(f.name)}">`}
    </div>`;
  }
  if (f.type === 'yesno') {
    return `<div class="field">${label}<div class="chips" data-group="${f.id}">
      <button type="button" data-act="set" data-field="${f.id}" data-value="true" class="${v === true ? 'on' : ''}">Ja</button>
      <button type="button" data-act="set" data-field="${f.id}" data-value="false" class="${v === false ? 'on' : ''}">Nein</button>
      ${clear}</div></div>`;
  }
  if (f.type === 'number') {
    return `<label class="field">${label}<span class="mitEinheit"><input type="number" inputmode="decimal" min="0" data-field="${f.id}" data-kind="number" step="${f.step || 'any'}" value="${hasValue(v) ? v : ''}">${f.unit ? `<span class="einheit">${esc(f.unit)}</span>` : ''}</span></label>`;
  }
  if (f.type === 'auswahl') {
    const gewaehlt = Array.isArray(v) ? v : hasValue(v) ? [v] : [];
    return `<div class="field">${label}<div class="chips auswahl-chips" data-group="${f.id}" role="group" aria-label="${esc(f.name)}">
      ${(f.optionen ?? []).map((o) => `<button type="button" data-act="wahl" data-field="${f.id}" data-wert="${esc(o)}" aria-pressed="${gewaehlt.includes(o)}" class="${gewaehlt.includes(o) ? 'on' : ''}">${esc(o)}</button>`).join('')}
      ${clear}</div>${f.mehrfach ? '<span class="hint">mehrere möglich</span>' : ''}</div>`;
  }
  if (f.type === 'meds') {
    return `<div class="field">${label}
      <div class="medrows" data-meds="${f.id}">${medRows(f.id)}</div>
      <div class="medaktionen">
        <button type="button" class="plus" data-act="med-add" data-field="${f.id}" title="Medikament hinzufügen" aria-label="Medikament hinzufügen">+</button>
        <button type="button" class="ghost klein" data-act="med-last" data-field="${f.id}" title="Medikamente vom letzten Eintrag übernehmen">wie zuletzt</button>
      </div>
      <datalist id="medliste">${(state.config.medikamente ?? []).map((m) => `<option value="${esc(m.name)}">${esc(`${m.dose ?? ''} ${m.unit ?? ''}`)}</option>`).join('')}</datalist>
    </div>`;
  }
  return `<label class="field">${label}<textarea rows="3" data-field="${f.id}" data-kind="text">${esc(v ?? '')}</textarea></label>`;
}

/** Stepper-Anzeige eines Skalenfelds nach Wertänderung aktualisieren */
function updStepper(id) {
  const box = $main.querySelector(`[data-scale="${id}"]`);
  if (!box) return;
  const v = state.entry.values[id];
  const out = box.querySelector('.stepwert');
  out.textContent = hasValue(v) ? v : 'Offen';
  out.classList.toggle('offen', !hasValue(v));
  const sb = box.querySelector('[role=spinbutton]');
  if (hasValue(v)) sb.setAttribute('aria-valuenow', v); else sb.removeAttribute('aria-valuenow');
  sb.setAttribute('aria-valuetext', hasValue(v) ? `${v} von ${sb.getAttribute('aria-valuemax')}` : 'offen, noch kein Wert');
  box.querySelectorAll('.seg').forEach((s) => s.classList.toggle('an', hasValue(v) && +s.dataset.value <= v));
  const r = box.querySelector('input[type=range]');
  if (r) { r.value = hasValue(v) ? v : r.min; r.classList.toggle('unset', !hasValue(v)); }
}

function medRows(fid) {
  const list = state.entry.values[fid] ?? [];
  return list.map((m, i) => `<div class="medrow" data-i="${i}">
    <input data-med="name" list="medliste" value="${esc(m.name)}" placeholder="Medikament" aria-label="Medikament">
    <input data-med="dose" type="number" inputmode="decimal" min="0" step="any" value="${hasValue(m.dose) ? m.dose : ''}" placeholder="Dosis" aria-label="Dosis">
    <select data-med="unit" aria-label="Einheit">${MED_EINHEITEN.map((u) => `<option ${m.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
    <button type="button" class="clear" data-act="med-del" title="Entfernen" aria-label="Entfernen">×</button>
  </div>`).join('');
}

function refreshMeds(fid, focusLast = false) {
  const box = $main.querySelector(`[data-meds="${fid}"]`);
  box.innerHTML = medRows(fid);
  if (focusLast) box.querySelector('.medrow:last-child [data-med="name"]')?.focus();
}

function skillsBlock(stored) {
  const usedIds = new Set(Object.keys(stored?.skills ?? {}));
  const skills = state.config.skills.filter((s) => !s.hidden || usedIds.has(s.id));
  if (!skills.length) return '<p class="meta">Noch keine Skills. Unter „Mehr → Skills“ anlegen.</p>';
  return groupBy(skills, (s) => s.module).map(([mod, list]) => `
    <details class="modul-${mod}" ${list.some((s) => usedIds.has(s.id)) ? 'open' : ''}><summary>${esc(MODULE[mod] ?? mod)}</summary>
      ${list.map((s) => {
        const u = state.entry.skills[s.id];
        return `<div class="skill">
          <label><input type="checkbox" data-skill="${s.id}" ${u?.used ? 'checked' : ''}> ${esc(s.name)}</label>
          <select data-skill-rating="${s.id}" ${u?.used ? '' : 'disabled'} title="Wie gut hat es geholfen?">
            <option value="">Wirkung</option>
            ${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${u?.rating === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select></div>`;
      }).join('')}
    </details>`).join('');
}

function updateSkillCount() {
  const n = Object.values(state.entry.skills).filter((s) => s.used).length;
  const el = document.getElementById('skillcount');
  if (el) { el.textContent = n ? `${n} genutzt` : ''; el.hidden = !n; }
}

/** Wert eines Skalenfelds ändern (−/+ Tasten, Balken, Tastatur) */
function schritt(id, delta, direkt = null) {
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

function setValue(id, value) {
  const vorher = suizidHoch(state.entry.values);
  state.entry.values[id] = value;
  if (id === 'f_suizid' && !vorher && suizidHoch(state.entry.values)) setTimeout(zeigeKrisenHinweis, 300);
  autoSpeichern();
  updFortschritt();
}

// ---------- Verlauf ----------
async function renderVerlauf() {
  const all = (await db.getAllEntries()).sort((a, b) => b.date.localeCompare(a.date));
  const grenze = state.verlaufTage ? shiftDate(todayISO(), -state.verlaufTage + 1) : '';
  const entries = all.filter((e) => e.date >= grenze);
  const gruppen = groupBy(
    state.config.fields.filter((f) => !f.hidden || entries.some((e) => hasValue(e.values[f.id]))),
    (f) => f.group || 'Allgemein',
  );
  const fields = gruppen.flatMap(([, fs]) => fs);

  // erste Spalte jeder Gruppe bekommt eine Trennlinie
  const gruppenStart = new Set(gruppen.map(([, fs]) => fs[0].id));
  const cell = (f, v) => {
    const gs = gruppenStart.has(f.id) ? ' gs' : '';
    if (!hasValue(v)) return `<td class="leer${gs}">·</td>`;
    if (f.type === 'yesno') return `<td class="${v ? 'ja' : 'nein'}${gs}">${v ? 'Ja' : 'Nein'}</td>`;
    if (f.type === 'meds') v = v.map((m) => `${m.name} ${m.dose ?? ''}${m.unit ?? ''}`.trim()).join(', ');
    if (f.type === 'auswahl') v = [].concat(v).join(', ');
    if (f.type === 'number') return `<td class="${gs}">${String(v).replace('.', ',')}${f.unit ? ` <small>${esc(f.unit)}</small>` : ''}</td>`;
    if (f.type === 'text' || f.type === 'meds' || f.type === 'auswahl') return `<td class="text${gs}" title="${esc(v)}">${esc(String(v).slice(0, 30))}${String(v).length > 30 ? '…' : ''}</td>`;
    if (f.type === 'scale') {
      const i = Math.max(0, Math.min(1, (v - f.min) / (f.max - f.min)));
      return `<td class="skala${gs} kat-${kategorie(f.group)}" style="--i:${(i * 100).toFixed(0)}%">${v}</td>`;
    }
    return `<td class="${gs}">${v}</td>`;
  };

  $main.innerHTML = `
    <div class="toolbar">
      <label>Zeitraum <select id="verlaufTage">
        ${[[7, '7 Tage'], [14, '14 Tage'], [30, '30 Tage'], [90, '90 Tage'], [0, 'alle']].map(([n, t]) => `<option value="${n}" ${state.verlaufTage === n ? 'selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <span class="legende">wenig <span style="background:color-mix(in srgb, var(--akzent) 8%, var(--karte))"></span><span style="background:color-mix(in srgb, var(--akzent) 25%, var(--karte))"></span><span style="background:color-mix(in srgb, var(--akzent) 45%, var(--karte))"></span> viel</span>
      <span class="meta">${entries.length} Einträge · ✓ = abgeschlossen</span>
    </div>
    ${entries.length ? `<div class="tablewrap"><table class="verlauf">
      <thead>
        <tr><th rowspan="2">Tag</th><th rowspan="2" title="Kartenstatus">✓</th>${gruppen.map(([g, fs]) => `<th colspan="${fs.length}" class="gruppe gs kat-${kategorie(g)}" title="${esc(g)}">${esc(g)}</th>`).join('')}<th rowspan="2" class="gs">Skills</th></tr>
        <tr>${fields.map((f) => `<th class="${gruppenStart.has(f.id) ? 'gs' : ''}" title="${esc(`${f.group}: ${f.name}`)}">${esc(f.name)}</th>`).join('')}</tr>
      </thead>
      <tbody>${entries.map((e) => {
        const [wt, ...rest] = formatDate(e.date).split(', ');
        return `<tr data-act="open-day" data-date="${e.date}">
        <th>${rest.join(', ').replace(/\.\d{4}$/, '.')}<small>${wt.replace('.', '')}</small></th>
        <td class="status">${e.status === 'abgeschlossen' ? '✓' : ''}</td>${fields.map((f) => cell(f, e.values[f.id])).join('')}
        <td class="gs">${Object.keys(e.skills).length || '<span class="leer">·</span>'}</td></tr>`;
      }).join('')}</tbody>
    </table></div>` : '<p class="meta">Keine Einträge in diesem Zeitraum.</p>'}`;
}

// ---------- Mehr ----------
function renderMehr() {
  const punkt = (view, ic, titel, text) => `<button class="listeneintrag" data-act="goto" data-view="${view}">
    <span class="tagbadge">${icon(ic)}</span><span class="li-text"><b>${titel}</b><small>${text}</small></span><span class="pfeil">${icon('rechts')}</span></button>`;
  $main.innerHTML = `
    ${punkt('verlauf', 'verlauf', 'Verlauf', 'Alle Tage als Tabelle, Werte farblich nach Stärke')}
    ${punkt('vorlage', 'vorlage', 'Vorlage der Diary-Card', `Felder, Skalen, Bausteine, Kurzansicht · Version v${currentVersion(state.config).v}`)}
    ${punkt('skills', 'skills', 'Skills', 'DBT-Skills sammeln, eigene anlegen, ausblenden')}
    ${punkt('daten', 'einstellungen', 'Einstellungen &amp; Daten', `Aussehen (hell/dunkel, Farben), Therapietag (${WOCHENTAGE[E().wochenstart]}), PIN-Sperre ${E().pin ? 'an' : 'aus'}, Tonfall, Erinnerung, Notfallkontakte, Sicherung`)}
    ${punkt('datenschutz', 'schloss', 'Datenschutz', 'Was gespeichert wird, wo es liegt und wie du alles löschst')}
    <p class="hilfe">Dieses Tagebuch ist ein Werkzeug zur Selbstbeobachtung. Es ersetzt keine Therapie und keine ärztliche Hilfe.</p>`;
}

function renderDatenschutz() {
  const wo = istNativ() ? 'im Speicher dieser App auf deinem Handy' : `im Speicher dieses Browsers auf diesem Gerät (Adresse <code>${esc(location.origin)}</code>)`;
  const loeschen = istNativ()
    ? 'App deinstallieren oder in den Handy-Einstellungen bei dieser App „Speicher → Daten löschen“ wählen.'
    : 'In den Browser-Einstellungen die Website-Daten dieser Adresse löschen. Achtung: Auch „Browserdaten löschen“ entfernt das Tagebuch.';
  $main.innerHTML = `
    <div class="karte datenschutz">
      <h2>Datenschutz – kurz und ehrlich</h2>
      <p><strong>Deine Einträge verlassen dein Gerät nicht.</strong> Es gibt kein Konto, keinen Server, keine Werbung,
      keine Nutzungsstatistik und keine Absturzberichte. Niemand außer dir kann deine Einträge sehen – auch nicht die Entwickler.</p>

      <h3>Was gespeichert wird</h3>
      <ul>
        <li>deine Tageskarten (Werte, Skills, Notizen, Medikamente)</li>
        <li>Verhaltensketten und Notizen „Für die nächste Stunde“</li>
        <li>deine Vorlage, Einstellungen, Notfallkontakte und Notfallplan</li>
        <li>die PIN nur als nicht umkehrbarer Prüfwert, nie im Klartext</li>
      </ul>

      <h3>Wo es liegt</h3>
      <p>Nur ${wo}. Andere Geräte haben ein eigenes, getrenntes Tagebuch.</p>

      <h3>Was die App ins Internet schickt</h3>
      <p>Nichts aus deinem Tagebuch. ${istNativ() ? 'Die App braucht kein Internet.' : 'Der Browser lädt nur die App selbst (Seiten, Bilder), nicht deine Daten.'}
      Notrufnummern und deine Kontakte wählt dein Telefon direkt – die App erfährt nichts davon.
      ${istNativ() ? 'Erinnerungen plant das Handy selbst, ohne Server. Die Mitteilung enthält nie deine Werte.' : ''}</p>

      <h3>Sicherung und Weitergabe</h3>
      <p>Nur wenn <em>du</em> exportierst oder einen Bericht teilst, entsteht eine Datei. Sie ist <strong>nicht verschlüsselt</strong>.
      Bewahre sie sicher auf und schicke sie möglichst nicht über Messenger, E-Mail oder Cloud. Was du mit der Datei machst, entscheidest du.</p>

      <h3>Schutz vor neugierigen Blicken</h3>
      <p>Die PIN-Sperre schützt die Anzeige, verschlüsselt die Daten aber nicht. ${istNativ() ? 'Mit „Inhalt schützen“ (Einstellungen) ist der Inhalt in der App-Übersicht verborgen und Bildschirmfotos sind gesperrt.' : 'Schütze dein Gerät zusätzlich mit einer Bildschirmsperre.'}</p>

      <h3>Alles löschen</h3>
      <p>${loeschen} Vorher exportieren, wenn du die Daten behalten möchtest – sie sind sonst endgültig weg.</p>

      <h3>Kein Medizinprodukt</h3>
      <p>Das Tagebuch hilft dir, dich selbst zu beobachten und die Therapie vorzubereiten. Es stellt keine Diagnosen, gibt keine Behandlungsempfehlungen
      und ersetzt keine Therapie oder ärztliche Hilfe. In einer Krise: ♥ oben rechts, Notruf 112 oder Telefonseelsorge 0800 111 0 111.</p>
    </div>`;
}

// ---------- Vorlage: Verhaltens-Baukasten ----------
const istVerhaltenGruppe = (g = '') => /^(Verhalten|Problemverhalten|Neue Wege):/.test(g);

function verhaltenBaukasten() {
  const vb = (state.vb ??= { vorlage: 'bildschirm', arten: new Set(VERHALTEN_VORLAGEN.bildschirm.arten), name: '', einheit: '' });
  return `<div class="karte baukasten kat-problem">
    <h2>Verhalten hinzufügen</h2>
    <p class="meta">Für Süchte, alte Gewohnheiten, Hobbys oder neue Wege: Wähle, <b>was</b> du daran beobachten möchtest. Später jederzeit änderbar.</p>
    <label class="field"><span class="fname">Name</span>
      <input id="vb-name" value="${esc(vb.name)}" placeholder="z. B. Gaming, Kaufen, Grübeln, Nein sagen"></label>
    <div class="field"><span class="fname">Startauswahl</span><span class="hint">Setzt passende Häkchen – danach frei anpassbar</span>
      <div class="chips">${Object.entries(VERHALTEN_VORLAGEN).map(([k, v]) => `<button type="button" data-act="vb-vorlage" data-wert="${k}" class="${vb.vorlage === k ? 'on' : ''}">${esc(v.titel)}</button>`).join('')}</div>
    </div>
    <div class="field"><span class="fname">Was möchtest du beobachten?</span>
      <div class="messarten">${Object.entries(MESSARTEN).map(([k, m]) => `
        <label class="check messart"><input type="checkbox" data-vb-art="${k}" ${vb.arten.has(k) ? 'checked' : ''}>
          <span>${esc(m.titel)}<small>${esc(m.info)}</small></span></label>`).join('')}</div>
      <label class="einheit-zeile" ${vb.arten.has('viel') ? '' : 'hidden'}>Einheit für „Wie viel“ <input id="vb-einheit" value="${esc(vb.einheit)}" placeholder="z. B. Gläser, €, Stück" class="kurz"></label>
    </div>
    <div class="actions"><button class="primary" data-act="vb-add">${icon('plus', 18)} Verhalten hinzufügen</button></div>
  </div>`;
}

/** Welche Messarten hat ein Bereich schon? Und mit welchem ID-Präfix? */
function messartenVon(gruppe) {
  const felder = state.draftFields.filter((f) => f.group === gruppe);
  const endungen = Object.keys(MESSART_ENDUNG).sort((a, b) => b.length - a.length);
  const vorhanden = new Set();
  let praefix = null;
  felder.forEach((f) => {
    const e = endungen.find((x) => f.id.endsWith(`_${x}`));
    if (e) { vorhanden.add(MESSART_ENDUNG[e]); praefix ??= f.id.slice(0, -(e.length + 1)); }
  });
  return { vorhanden, praefix: praefix ?? newId('f') };
}

/** Feld-IDs eindeutig halten (falls es eine ID schon gibt, z. B. nach Umbenennen) */
function eindeutig(felder) {
  const ids = new Set(state.config.versions.flatMap((v) => v.fields.map((f) => f.id)).concat(state.draftFields.map((f) => f.id)));
  return felder.map((f) => (ids.has(f.id) ? { ...f, id: `${f.id}_${newId('x').slice(2, 7)}` } : f));
}

function zeigeMessartWahl(gruppe) {
  const { vorhanden, praefix } = messartenVon(gruppe);
  const frei = Object.entries(MESSARTEN).filter(([k]) => !vorhanden.has(k));
  const box = openModal(`
    <h2>Messart hinzufügen</h2>
    <p class="meta">Für <b>${esc(gruppe)}</b>. Neue Messarten gelten ab jetzt – alte Einträge bleiben vollständig.</p>
    <div class="messarten">${frei.map(([k, m]) => `<label class="check messart"><input type="checkbox" data-neu-art="${k}"><span>${esc(m.titel)}<small>${esc(m.info)}</small></span></label>`).join('') || '<p>Alle Messarten sind schon da.</p>'}</div>
    <label class="einheit-zeile">Einheit für „Wie viel“ (falls gewählt) <input id="neu-einheit" class="kurz" placeholder="z. B. €"></label>
    <div class="actions dialog-knoepfe"><button class="ghost" data-modal-zu>Abbrechen</button><button class="primary" id="messart-ok">Hinzufügen</button></div>`);
  box.querySelector('#messart-ok').onclick = () => {
    const arten = [...box.querySelectorAll('[data-neu-art]:checked')].map((c) => c.dataset.neuArt);
    const einheit = box.querySelector('#neu-einheit').value.trim();
    closeModal();
    if (!arten.length) return;
    const neu = eindeutig(Object.keys(MESSARTEN).filter((k) => arten.includes(k)).map((k) => MESSARTEN[k].feld(praefix, gruppe, { einheit })));
    einfuegen(neu);
    toast(`${neu.length} Messart${neu.length > 1 ? 'en' : ''} ergänzt – jetzt „Vorlage speichern“`);
  };
}

// ---------- Vorlage ----------
function renderVorlage() {
  const c = state.config;
  const bereiche = [...new Set(state.draftFields.map((f) => f.group).filter(Boolean))];
  const geaendert = templateChanged(c, state.draftFields);

  $main.innerHTML = `
    <p class="meta">Aktuelle Vorlage: <strong>v${currentVersion(c).v}</strong>. Speichern legt eine neue Version an – alte Einträge bleiben unverändert.
    Gespeicherte Felder kann man umbenennen und ausblenden, aber nicht löschen.</p>
    <datalist id="bereiche">${bereiche.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
    ${verhaltenBaukasten()}
    <details class="karte einzelfeld">
      <summary><b>Einzelnes Feld hinzufügen</b> <span class="meta">– z. B. eine Skala oder ein Ja/Nein</span></summary>
      <div class="row wrap">
        <select id="baustein">${Object.entries(BAUSTEINE).filter(([k]) => ['menge', 'skala', 'janein'].includes(k)).map(([k, b]) => `<option value="${k}">${esc(b.titel)}</option>`).join('')}</select>
        <input id="bausteinname" class="grow" placeholder="Name, z. B. Wie viel gezockt?">
        <button data-act="b-add">Hinzufügen</button>
      </div>
      <p class="meta" id="bausteininfo">${esc(BAUSTEINE.menge.info)}</p>
    </details>
    ${groupBy(state.draftFields.map((f, i) => ({ f, i })), (x) => x.f.group || 'Allgemein').map(([g, items]) => `
      <section class="bereich">
        <div class="row bereichkopf">
          <input class="bereichname" data-g="${esc(g)}" value="${esc(g)}" aria-label="Bereich umbenennen" title="Bereich umbenennen (gilt für alle Felder darin)">
          ${istVerhaltenGruppe(g) ? `<button data-act="v-messart" data-group="${esc(g)}" class="ghost">+ Messart</button>` : ''}
          <button data-act="f-add" data-group="${esc(g)}" class="ghost">+ Feld</button>
        </div>
        ${items.map(({ f, i }, k) => feldEditor(f, i, k === 0, k === items.length - 1)).join('')}
      </section>`).join('')}
    <div class="actions sticky">
      <button data-act="tpl-save" class="primary" ${geaendert ? '' : 'disabled'}>Vorlage speichern</button>
      <button data-act="tpl-reset" class="ghost" ${geaendert ? '' : 'disabled'}>Verwerfen</button>
    </div>
    <details class="versionen"><summary>Versionen (${c.versions.length})</summary>
      <ul>${[...c.versions].reverse().map((v) => `<li>v${v.v} · ${fmtTime(v.savedAt)} · ${v.fields.filter((f) => !f.hidden).length} sichtbare Felder</li>`).join('')}</ul>
    </details>
    <details class="versionen"><summary>Weitere Aktionen</summary>
      <p><button data-act="tpl-standard">Diary-Card-Standard übernehmen</button></p>
      <p class="meta">Zeigt die Standardfelder der Papier-Diary-Card, blendet alle anderen aus. Nichts wird gelöscht, alte Einträge bleiben. Danach noch „Vorlage speichern“.</p>
    </details>`;
}

function feldEditor(f, i, erstes, letztes) {
  const fest = isCommitted(state.config, f.id);
  return `<div class="feld ${f.hidden ? 'aus' : ''}" data-idx="${i}">
    <div class="row">
      <input class="name" data-f="name" value="${esc(f.name)}" aria-label="Name">
      <button data-act="f-move" data-delta="-1" title="nach oben" ${erstes ? 'disabled' : ''}>↑</button>
      <button data-act="f-move" data-delta="1" title="nach unten" ${letztes ? 'disabled' : ''}>↓</button>
    </div>
    <div class="row wrap">
      <label>Bereich <input data-f="group" list="bereiche" value="${esc(f.group)}"></label>
      <label>Typ <select data-f="type" ${fest ? 'disabled title="Typ ist fest, weil es schon Einträge geben kann"' : ''}>
        ${Object.entries(TYPEN).map(([k, t]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${t}</option>`).join('')}
      </select></label>
      ${f.type === 'scale' ? `
        <label>Min <input type="number" data-f="min" value="${f.min}" class="kurz"></label>
        <label>Max <input type="number" data-f="max" value="${f.max}" class="kurz"></label>
        <label>Schritt <input type="number" data-f="step" value="${f.step}" min="0" step="any" class="kurz"></label>` : ''}
      ${f.type === 'auswahl' ? `
        <label class="grow">Auswahl <input data-f="optionen" value="${esc((f.optionen ?? []).join(', '))}" placeholder="z. B. morgens, mittags, abends"></label>
        <label class="check"><input type="checkbox" data-f="mehrfach" ${f.mehrfach ? 'checked' : ''}> mehrere wählbar</label>` : ''}
      ${f.type === 'number' ? `
        <label>Einheit <input data-f="unit" value="${esc(f.unit ?? '')}" placeholder="z. B. ml" class="kurz"></label>
        <label>Schritt <input type="number" data-f="step" value="${f.step}" min="0" step="any" class="kurz"></label>` : ''}
    </div>
    <div class="row wrap">
      <label class="grow">Hinweis <input data-f="hint" value="${esc(f.hint)}" placeholder="optional"></label>
      <label class="check"><input type="checkbox" data-f="hidden" ${f.hidden ? 'checked' : ''}> ausgeblendet</label>
      <label class="check" title="Wird bei „Nur das Wichtigste“ angezeigt"><input type="checkbox" data-kurz="${f.id}" ${(state.config.kurzFelder ?? []).includes(f.id) ? 'checked' : ''}> Kurzansicht</label>
      ${['scale', 'yesno'].includes(f.type) ? `<label class="check" title="Erscheint in der Schnell-Karte (am besten höchstens 6 Felder)"><input type="checkbox" data-schnellfeld="${f.id}" ${(state.config.schnellFelder ?? []).includes(f.id) ? 'checked' : ''}> Schnell-Karte</label>` : ''}
      <button type="button" class="ghost klein info-bearbeiten" data-act="f-info">
        <span class="info-knopf ${state.config.feldInfo?.[f.id]?.klaeren ? 'klaeren' : ''}" data-field="${f.id}" aria-hidden="true">i</span> Erklärung</button>
      ${fest ? '' : '<button data-act="f-remove" class="ghost">Entfernen</button>'}
    </div>
  </div>`;
}

/** Neue Felder hinter dem letzten Feld desselben Bereichs einfügen (sonst ans Ende). */
function einfuegen(felder) {
  const g = felder[0].group;
  let pos = state.draftFields.map((f) => f.group).lastIndexOf(g);
  if (pos >= 0) pos += 1;
  else {
    // neuer Bereich: vor den ausgeblendeten Feldern am Ende einfügen
    pos = state.draftFields.length;
    while (pos > 0 && state.draftFields[pos - 1].hidden) pos -= 1;
  }
  state.draftFields.splice(pos, 0, ...felder);
  renderVorlage();
  const input = $main.querySelector(`.feld[data-idx="${pos}"] .name`);
  input?.scrollIntoView({ block: 'center' });
  input?.select();
}

function refreshVorlageButtons() {
  const g = templateChanged(state.config, state.draftFields);
  $main.querySelector('[data-act="tpl-save"]').disabled = !g;
  $main.querySelector('[data-act="tpl-reset"]').disabled = !g;
}

// ---------- Skills ----------
async function renderSkills() {
  const entries = await db.getAllEntries();
  const grenze = shiftDate(todayISO(), -29);
  const zaehler = {};
  entries.filter((e) => e.date >= grenze).forEach((e) => Object.keys(e.skills).forEach((id) => { zaehler[id] = (zaehler[id] ?? 0) + 1; }));
  const nachModul = groupBy(Object.keys(MODULE).flatMap((m) => state.config.skills.filter((s) => s.module === m)), (s) => s.module);

  $main.innerHTML = `
    <form id="skill-neu" class="karte">
      <h2>Eigenen Skill anlegen</h2>
      <div class="row wrap">
        <label class="grow">Name <input name="name" required placeholder="z. B. Kaltes Wasser ins Gesicht"></label>
        <label>Modul <select name="module">${Object.entries(MODULE).map(([k, t]) => `<option value="${k}" ${k === 'eigene' ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label>Beschreibung <input name="description" placeholder="optional"></label>
      <label class="check"><input type="checkbox" name="notfall"> im Notfall-Fenster (♥) anzeigen</label>
      <div class="actions"><button type="submit" class="primary">Hinzufügen</button></div>
    </form>
    <p class="meta">Zahl rechts = an wie vielen Tagen in den letzten 30 Tagen genutzt. ♥ = erscheint im Notfall-Fenster. Änderungen werden sofort gespeichert.</p>
    ${nachModul.map(([m, list]) => `<fieldset class="modul-${m}"><legend>${esc(MODULE[m])}</legend>
      ${list.map((s) => `<div class="skillrow ${s.hidden ? 'aus' : ''}" data-id="${s.id}">
        <input data-s="name" value="${esc(s.name)}" aria-label="Name">
        <input data-s="description" value="${esc(s.description)}" placeholder="Beschreibung" aria-label="Beschreibung">
        <label class="check" title="Im Notfall-Fenster anzeigen"><input type="checkbox" data-s="notfall" ${s.notfall ? 'checked' : ''}> ♥</label>
        <label class="check"><input type="checkbox" data-s="hidden" ${s.hidden ? 'checked' : ''}> aus</label>
        <span class="count">${zaehler[s.id] ?? 0}</span>
      </div>`).join('')}</fieldset>`).join('')}`;
}

// ---------- PDF ----------
function pdfWoche(deltaWochen = 0, anzahl = 1) {
  const start = shiftDate(wochenbeginn(todayISO(), E().wochenstart), 7 * deltaWochen);
  state.pdf.von = start;
  state.pdf.bis = shiftDate(start, 7 * anzahl - 1);
}

function renderPdf() {
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

async function pdfVorschau() {
  const p = state.pdf;
  if (!p.von || !p.bis || p.von > p.bis) return toast('Bitte einen gültigen Zeitraum wählen');
  const [entries, alleKetten] = await Promise.all([db.getAllEntries(), db.getAllKetten()]);
  const name = state.config.profil?.name ?? '';
  const druck = document.getElementById('druck');
  druck.innerHTML = `
    <div class="druckleiste">
      <span>Vorschau · ${datumKurz(p.von)} – ${datumKurz(p.bis)}</span>
      <button data-act="pdf-drucken" class="primary">${kannDrucken() ? 'Drucken / Als PDF speichern' : 'Bericht teilen'}</button>
      <button data-act="pdf-schliessen">Schließen</button>
    </div>
    <div class="blaetter">${berichtHTML({ config: state.config, entries, ketten: alleKetten.filter((k) => !k.archiviert), ...p, name, luecken: state.config.luecken ?? {}, stundenNotizen: (state.config.stundenNotizen ?? []).filter((n) => !n.erledigt), klaeren: state.config.fields.filter((f) => !f.hidden && state.config.feldInfo?.[f.id]?.klaeren).map((f) => ({ name: f.name, notiz: state.config.feldInfo[f.id].notiz })) })}</div>`;
  druck.hidden = false;
  document.body.classList.add('druckmodus');
}

async function berichtAlsDatei() {
  const css = await fetch('bericht.css').then((r) => r.text()).catch(() => '');
  const blaetter = document.querySelector('#druck .blaetter')?.outerHTML ?? '';
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

// ---------- Notfall & Hinweis ----------
function zeigeNotfall() {
  const notSkills = state.config.skills.filter((s) => s.notfall && !s.hidden);
  const kontakte = E().notfallKontakte ?? [];
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
    ${E().notfallPlan ? `<h3>Mein Notfallplan</h3><div class="notfallplan">${esc(E().notfallPlan).replace(/\n/g, '<br>')}</div>` : ''}
    <h3>Skill jetzt üben</h3>
    ${uebungenListe().replace('class="uebungen-liste"', 'class="uebungen-liste kompakt"')}
    ${notSkills.length ? `<h3>Meine Notfall-Skills</h3><ul class="notfallskills">${notSkills.map((s) => `<li><b>${esc(s.name)}</b>${s.description ? ` – ${esc(s.description)}` : ''}</li>`).join('')}</ul>` : ''}
    <p class="meta">Eigene Kontakte und Notfallplan: Mehr → Einstellungen. Notfall-Skills: Mehr → Skills.</p>`, { klasse: 'notfall' });
}

/** Telefonnummer für tel:-Links: nur Ziffern und führendes + */
const telHref = (nr) => String(nr).trim().replace(/\(0\)/g, '').replace(/^00/, '+').replace(/(?!^\+)[^\d]/g, '');

function kontakteHtml() {
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

// ---------- Erinnerungen ----------
const ER = () => (E().erinnerung = { ...ERINNERUNG_STANDARD, ...E().erinnerung });
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function erinnerungHtml() {
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
async function erinnerungenAktualisieren() {
  if (!erinnerungMoeglich()) return null;
  const heute = await db.getEntry(todayISO());
  const erledigt = !!heute && (Object.keys(heute.values ?? {}).length > 0 || heute.status === 'abgeschlossen');
  try { return await erinnerungenPlanen(ER(), ton(), erledigt); } catch { return null; }
}

function zeigeHinweis() {
  return new Promise((resolve) => {
    const box = openModal(`
      <h2>Bevor du beginnst</h2>
      <p>Dieses Tagebuch ist ein Werkzeug zur Selbstbeobachtung. Es bietet keine Diagnose oder Behandlung und ersetzt nicht die Begleitung durch deine Therapeutin oder deinen Therapeuten.</p>
      <p>Wenn du in einer Krise bist oder daran denkst, dir etwas anzutun: Wende dich sofort an die <strong>Telefonseelsorge (0800 111 0 111)</strong> oder den <strong>Notruf 112</strong>.
      Hilfe findest du jederzeit über das <strong>♥</strong> oben rechts.</p>
      <p class="meta">Deine Einträge bleiben nur auf diesem Gerät. Nichts wird ins Internet gesendet.</p>
      <div class="actions"><button class="primary" id="hinweis-ok">Verstanden</button></div>`, { schliessbar: false });
    box.querySelector('#hinweis-ok').onclick = async () => {
      E().hinweisGesehen = true;
      await saveConfig();
      closeModal();
      resolve();
    };
  });
}

// ---------- Einstellungen & Daten ----------
async function renderDaten() {
  const [entries, alleKetten] = await Promise.all([db.getAllEntries(), db.getAllKetten()]);
  const persist = await navigator.storage?.persisted?.();
  const d = E().design;
  $main.innerHTML = `
    <div class="karte">
      <h2>Aussehen</h2>
      <p class="meta">Wann hell, wann dunkel? „Automatisch“ folgt der Einstellung des Geräts.</p>
      <div class="segment">${Object.entries(MODI).map(([k, t]) => `<button type="button" data-act="design" data-key="modus" data-wert="${k}" class="${d.modus === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <h3 class="unterkopf">Helles Design</h3>
      <div class="themenwahl">${Object.entries(HELL).map(([k, t]) => `
        <button type="button" data-act="design" data-key="thema" data-wert="${k}" class="${d.thema === k ? 'on' : ''}">
          <span class="farbpunkte">${t.farben.map((f) => `<span style="background:${f}"></span>`).join('')}</span>${t.name}</button>`).join('')}</div>
      <h3 class="unterkopf">Dunkles Design – Akzentfarbe</h3>
      <p class="meta">Hintergrund bleibt ein ruhiges Dunkelgrau (kein reines Schwarz). Die Farbe gilt für Knöpfe, Regler und Markierungen.</p>
      <div class="themenwahl">${Object.entries(NACHT).map(([k, t]) => `
        <button type="button" data-act="design" data-key="nacht" data-wert="${k}" class="${d.nacht === k ? 'on' : ''}">
          <span class="farbpunkte"><span style="background:#1C1F22"></span><span style="background:#E4E1DA"></span><span style="background:${t.farbe}"></span></span>${t.name}</button>`).join('')}</div>
    </div>
    <div class="karte">
      <h2>Sanfter Hinweis bei hohen Werten</h2>
      <p class="meta">Nach dem Abschließen erscheint bei hoher Belastung, hohem Drang, Suizidgedanken oder Dissoziation ein ruhiges Angebot für einen Skill – ohne Alarm.</p>
      <label class="check"><input type="checkbox" id="sanfter-hinweis" ${E().sanfterHinweis !== false ? 'checked' : ''}> Hinweis anzeigen</label>
      <label>Ab welchem Wert (bei einer Skala 0–5)?
        <select id="hinweis-schwelle" style="width:auto">
          ${[[0.6, 'ab 3'], [0.8, 'ab 4'], [1, 'nur bei 5']].map(([w, t]) => `<option value="${w}" ${(E().hinweisSchwelle ?? 0.8) === w ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
    </div>
    <div class="karte">
      <h2>Tonfall</h2>
      <p class="meta">Wie deutlich soll die App an fehlende Karten erinnern? Gilt für Startseite, Rückmeldungen und Erinnerungen.</p>
      <div class="tonwahl">${Object.entries(TONFAELLE).map(([k, t]) => `
        <button type="button" data-act="tonfall" data-wert="${k}" class="${ton() === k ? 'on' : ''}"><b>${t.name}</b><small>${t.text}</small></button>`).join('')}</div>
    </div>
    <div class="karte" id="erinnerung-karte">${erinnerungHtml()}</div>
    <div class="karte">
      <h2>Therapie- oder Auswertungstag</h2>
      <p class="meta">An welchem Tag beginnt deine Woche? Gilt für Startseite und PDF.</p>
      <div class="segment wrap" id="wochenstart">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" data-act="wochenstart" data-wert="${d}" class="${E().wochenstart === d ? 'on' : ''}">${WOCHENTAGE[d]}</button>`).join('')}</div>
      <p class="meta">Wochen laufen jetzt von ${WOCHENTAGE[E().wochenstart]} bis ${WOCHENTAGE[(E().wochenstart + 6) % 7]}.</p>
    </div>
    ${istNativ() ? `<div class="karte">
      <h2>Inhalt schützen</h2>
      <p class="meta">An: In der App-Übersicht ist der Inhalt verborgen, Bildschirmfotos sind gesperrt. Android koppelt beides – wer Bildschirmfotos machen möchte,
      schaltet kurz aus und danach wieder ein.</p>
      <label class="check"><input type="checkbox" id="inhalt-schuetzen" ${E().inhaltSchuetzen !== false ? 'checked' : ''}> Inhalt schützen</label>
    </div>` : ''}
    <div class="karte">
      <h2>PIN-Sperre</h2>
      <p class="meta">Fragt beim Öffnen und nach 1 Minute im Hintergrund nach einer PIN (4–8 Ziffern).
      Schützt vor neugierigen Blicken – die Daten selbst sind <strong>nicht verschlüsselt</strong>.</p>
      <p>Status: <strong>${E().pin ? 'an' : 'aus'}</strong></p>
      <form id="pin-form" class="row wrap" autocomplete="off">
        ${E().pin ? '<label>Aktuelle PIN <input type="password" inputmode="numeric" name="alt" maxlength="8" class="kurz"></label>' : ''}
        <label>Neue PIN <input type="password" inputmode="numeric" name="neu" maxlength="8" class="kurz"></label>
        <label>Wiederholen <input type="password" inputmode="numeric" name="neu2" maxlength="8" class="kurz"></label>
        <button type="submit" class="primary">${E().pin ? 'PIN ändern' : 'PIN festlegen'}</button>
        ${E().pin ? '<button type="button" class="ghost" data-act="pin-aus">PIN entfernen</button>' : ''}
      </form>
    </div>
    <div class="karte">
      <h2>Meine Notfallkontakte</h2>
      <p class="meta">Erscheinen im ♥-Fenster direkt unter dem Notruf. Antippen ruft an. Die Nummern bleiben nur auf diesem Gerät.</p>
      <div id="kontakte">${kontakteHtml()}</div>
    </div>
    <div class="karte">
      <h2>Mein Notfallplan</h2>
      <p class="meta">Erscheint im ♥-Fenster. z. B. was mir in Krisen hilft, Warnzeichen, meine Gründe weiterzumachen.</p>
      <textarea id="notfallplan" rows="5" placeholder="z. B. Anna anrufen: 0151 …&#10;Igelball, kaltes Wasser, raus an die Luft">${esc(E().notfallPlan)}</textarea>
      <div class="actions"><button data-act="notfall-speichern" class="primary">Speichern</button>
        <button class="ghost" data-act="hinweis-zeigen">Start-Hinweis erneut zeigen</button></div>
    </div>
    <div class="karte">
      <h2>Wo liegen meine Daten?</h2>
      <p>Nur hier im Browser auf diesem Gerät (IndexedDB, Adresse <code>${esc(location.origin)}</code>). Nichts wird ins Internet gesendet.</p>
      <p>${entries.length} Tageskarten · ${alleKetten.length} Verhaltensketten · ${state.config.skills.length} Skills · Vorlage v${currentVersion(state.config).v}</p>
      <p>Dauerhafter Speicher: <strong>${persist ? 'ja' : 'nein'}</strong>
        ${persist ? '' : '<button data-act="persist" class="ghost">anfordern</button>'}
        <br><span class="meta">Verhindert, dass der Browser die Daten bei Platzmangel selbst löscht.</span></p>
    </div>
    <div class="karte">
      <h2>Sicherung</h2>
      <p>Export erzeugt eine JSON-Datei mit allem. <strong>Nicht verschlüsselt</strong> – sicher aufbewahren, am besten an einem zweiten Ort (z. B. USB-Stick).</p>
      <p class="meta">Letzte Sicherung: <strong>${E().letzteSicherung ? datumKurz(E().letzteSicherung) : 'noch keine'}</strong>. Die Startseite erinnert sanft, wenn die letzte Sicherung über 30 Tage her ist.</p>
      <div class="actions"><button data-act="export" class="primary">Exportieren</button></div>
      <h2>Import</h2>
      <p>Ersetzt alle Daten hier durch die Datei. Vorher wird automatisch ein Export der aktuellen Daten heruntergeladen.</p>
      <input type="file" id="importfile" accept="application/json,.json">
    </div>`;
}

async function exportieren(prefix = 'dbt-tagebuch-export') {
  const [entries, alleKetten] = await Promise.all([db.getAllEntries(), db.getAllKetten()]);
  const data = { app: 'dbt-tagebuch', exportVersion: 2, exportedAt: new Date().toISOString(), config: state.config, entries, ketten: alleKetten };
  await dateiSpeichern(`${prefix}-${todayISO()}.json`, JSON.stringify(data, null, 2));
  E().letzteSicherung = todayISO();
  E().sicherungSpaeter = null;
  await saveConfig();
}

async function importieren(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Datei ist kein gültiges JSON.'); }
  if (data?.app !== 'dbt-tagebuch' || !data.config?.fields || !Array.isArray(data.entries)) return toast('Das ist keine DBT-Tagebuch-Sicherung.');
  if (!(await frage(`${data.entries.length} Tageskarten und ${data.ketten?.length ?? 0} Ketten vom ${fmtTime(data.exportedAt)}.\nDeine aktuellen Daten werden vorher als Datei gesichert und dann ersetzt.`, { titel: 'Sicherung importieren?', ja: 'Importieren' }))) return;
  await exportieren('dbt-tagebuch-vor-import');
  await db.replaceAll(data.config, data.entries, data.ketten ?? []);
  state.config = data.config;
  await vervollstaendigeConfig(); // ältere Sicherungen um neuere Einstellungen ergänzen
  wendeDesignAn(E().design);
  toast('Import abgeschlossen');
  await renderDaten();
}

// ---------- Ereignisse ----------
$main.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  // Navigation & Woche
  if (act === 'goto') return show(el.dataset.view);
  if (act === 'w-nav') { state.wocheDatum = shiftDate(state.wocheDatum, +el.dataset.delta); return renderWoche(); }
  if (act === 'w-heute') { state.wocheDatum = todayISO(); return renderWoche(); }
  if (act === 'w-pdf') {
    state.pdf.von = wochenbeginn(state.wocheDatum, E().wochenstart);
    state.pdf.bis = shiftDate(state.pdf.von, 6);
    await show('pdf');
    return pdfVorschau();
  }
  if (act === 'w-kette') return show('ketten');
  if (act === 'w-sichern') { await exportieren(); toast('Sicherung gespeichert – am besten an einen zweiten Ort kopieren'); return renderWoche(); }
  if (act === 'luecke-spaeter') { E().lueckeAusgeblendet = todayISO(); await saveConfig(); return renderWoche(); }
  if (act === 'klaeren-aus') { E().klaerenAusgeblendet = todayISO(); await saveConfig(); el.closest('.klaeren-leiste').hidden = true; return; }
  if (act === 'w-sichern-spaeter') { E().sicherungSpaeter = shiftDate(todayISO(), 7); await saveConfig(); toast('Ich erinnere dich in einer Woche'); return renderWoche(); }
  if (act === 'w-skill') {
    return openModal(`<h2>${icon('atem', 20)} Skill üben</h2>
      <p class="meta">Geführt, Schritt für Schritt. Am Ende kannst du den Skill in die heutige Karte eintragen.</p>${uebungenListe()}`);
  }
  if (act === 'open-day') { state.date = el.dataset.date; return show('heute'); }

  // Tageskarte
  if (act === 'day' || act === 'today') {
    if (!(await leaveOk())) return;
    state.date = act === 'today' ? todayISO() : shiftDate(state.date, +el.dataset.delta);
    return renderHeute();
  }
  if (act === 'status') {
    state.entry.status = el.dataset.wert;
    state.entryDirty = true;
    await autoSpeichernJetzt();
    if (el.dataset.wert === 'abgeschlossen') rueckmeldung(state.entry.values);
    else toast('Wieder als Entwurf geöffnet');
    const y = window.scrollY;
    await renderHeute();
    window.scrollTo(0, y);
    return;
  }
  if (act === 'info') return zeigeInfo(el.dataset.field, infoKnoepfeAktualisieren);
  if (act === 'f-info') return zeigeInfo(state.draftFields[+el.closest('.feld').dataset.idx].id, infoKnoepfeAktualisieren);
  if (act === 'step') return schritt(el.dataset.field, +el.dataset.delta);
  if (act === 'seg') return schritt(el.dataset.field, 0, +el.dataset.value);
  if (act === 'wahl') {
    const id = el.dataset.field;
    const f = state.config.fields.find((x) => x.id === id);
    const w = el.dataset.wert;
    let liste = [...(state.entry.values[id] ?? [])];
    if (liste.includes(w)) liste = liste.filter((x) => x !== w);
    else liste = f?.mehrfach ? [...liste, w] : [w];
    setValue(id, liste.length ? liste : null);
    el.parentElement.querySelectorAll('[data-act="wahl"]').forEach((b) => {
      const an = liste.includes(b.dataset.wert);
      b.classList.toggle('on', an);
      b.setAttribute('aria-pressed', an);
    });
    return;
  }
  if (act === 'set') {
    const id = el.dataset.field;
    const raw = el.dataset.value;
    const val = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
    const neu = state.entry.values[id] === val ? null : val; // nochmal tippen = leeren
    setValue(id, neu);
    el.parentElement.querySelectorAll('[data-act="set"]').forEach((b) => b.classList.toggle('on', b === el && neu !== null));
    return;
  }
  if (act === 'clear') {
    const id = el.dataset.field;
    setValue(id, null);
    $main.querySelectorAll(`[data-group="${id}"] .on`).forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    const inp = $main.querySelector(`[data-field="${id}"]:not(button)`);
    if (inp) inp.value = '';
    return;
  }
  if (act === 'kette-neu' || act === 'kette-oeffnen') {
    if (!(await leaveOk())) return;
    state.entryDirty = false;
    if (act === 'kette-neu') ketten.neuFuer(state.date);
    else ketten.oeffne((await db.getAllKetten()).find((k) => k.id === el.dataset.id));
    return show('ketten', { force: true });
  }
  if (act === 'med-add') {
    const fid = el.dataset.field;
    (state.entry.values[fid] ??= []).push({ name: '', dose: null, unit: 'mg' });
    autoSpeichern();
    return refreshMeds(fid, true);
  }
  if (act === 'med-del') {
    const fid = el.closest('[data-meds]').dataset.meds;
    state.entry.values[fid].splice(+el.closest('.medrow').dataset.i, 1);
    autoSpeichern();
    return refreshMeds(fid);
  }
  if (act === 'med-last') {
    const fid = el.dataset.field;
    const frueher = (await db.getAllEntries())
      .filter((x) => x.date < state.date && hasValue(x.values[fid]))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!frueher) return toast('Kein früherer Eintrag mit Medikamenten');
    state.entry.values[fid] = clone(frueher.values[fid]);
    autoSpeichern();
    refreshMeds(fid);
    return toast(`Übernommen vom ${formatDate(frueher.date)}`);
  }

  // Vorlage
  const idx = +el.closest('.feld')?.dataset.idx;
  if (act === 'f-add') {
    const group = el.dataset.group || 'Persönlich';
    const neu = { id: newId('f'), name: 'Neues Feld', type: 'scale', min: 0, max: 5, step: 1, group, hint: '', hidden: false };
    return einfuegen([neu]);
  }
  if (act === 'vb-vorlage') {
    state.vb.vorlage = el.dataset.wert;
    state.vb.arten = new Set(VERHALTEN_VORLAGEN[el.dataset.wert].arten);
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    $main.querySelectorAll('[data-vb-art]').forEach((c) => { c.checked = state.vb.arten.has(c.dataset.vbArt); });
    $main.querySelector('.baukasten .einheit-zeile').hidden = !state.vb.arten.has('viel');
    return;
  }
  if (act === 'vb-add') {
    const vb = state.vb;
    const name = $main.querySelector('#vb-name').value.trim();
    if (!name) { $main.querySelector('#vb-name').focus(); return toast('Bitte einen Namen eingeben, z. B. „Gaming“'); }
    if (!vb.arten.size) return toast('Bitte mindestens eine Messart ankreuzen');
    const felder = eindeutig(verhaltenFelder(name, newId('f'), [...vb.arten], { vorlage: vb.vorlage, einheit: vb.einheit }));
    state.vb = { ...vb, name: '', einheit: '' };
    einfuegen(felder);
    return toast(`„${name}“ mit ${felder.length} Messarten angelegt – jetzt „Vorlage speichern“`);
  }
  if (act === 'v-messart') return zeigeMessartWahl(el.dataset.group);
  if (act === 'b-add') {
    const name = $main.querySelector('#bausteinname').value.trim();
    if (!name) { $main.querySelector('#bausteinname').focus(); return toast('Bitte einen Namen eingeben'); }
    return einfuegen(BAUSTEINE[$main.querySelector('#baustein').value].felder(name, newId('f')));
  }
  if (act === 'tpl-standard') {
    if (!(await frage('Andere Felder werden ausgeblendet, nicht gelöscht. Alte Einträge bleiben erhalten.', { titel: 'Standard-Diary-Card übernehmen?', ja: 'Übernehmen' }))) return;
    state.draftFields = applyStandard(state.draftFields);
    renderVorlage();
    return toast('Übernommen – jetzt „Vorlage speichern“');
  }
  if (act === 'f-move') {
    const g = state.draftFields[idx].group;
    const d = +el.dataset.delta;
    let j = idx + d;
    while (state.draftFields[j] && state.draftFields[j].group !== g) j += d;
    if (!state.draftFields[j]) return;
    [state.draftFields[idx], state.draftFields[j]] = [state.draftFields[j], state.draftFields[idx]];
    return renderVorlage();
  }
  if (act === 'f-remove') {
    state.draftFields.splice(idx, 1);
    return renderVorlage();
  }
  if (act === 'tpl-save') {
    const fehler = validateFields(state.draftFields);
    if (fehler.length) return hinweis(fehler.join('\n'), 'Bitte Vorlage prüfen');
    if (commitTemplate(state.config, state.draftFields)) {
      await saveConfig();
      toast(`Vorlage v${currentVersion(state.config).v} gespeichert`);
    }
    state.draftFields = clone(state.config.fields);
    return renderVorlage();
  }
  if (act === 'tpl-reset') {
    state.draftFields = clone(state.config.fields);
    return renderVorlage();
  }

  // PDF
  if (act === 'pdf-woche') { pdfWoche(+el.dataset.delta, +el.dataset.wochen || 1); return renderPdf(); }
  if (act === 'pdf-vorschau') return pdfVorschau();

  // Einstellungen & Daten
  if (act === 'tonfall') {
    E().tonfall = el.dataset.wert;
    E().lueckeAusgeblendet = null;
    await saveConfig();
    $main.querySelectorAll('[data-act=tonfall]').forEach((b) => b.classList.toggle('on', b === el));
    erinnerungenAktualisieren();
    return toast(`Tonfall: ${TONFAELLE[el.dataset.wert].name}`);
  }
  if (act === 'kontakt-weg' || act === 'kontakt-hoch') {
    const liste = [...(E().notfallKontakte ?? [])];
    const i = +el.dataset.i;
    if (act === 'kontakt-weg') {
      if (!(await frage(`${liste[i].name} aus den Notfallkontakten entfernen?`, { titel: 'Kontakt entfernen', ja: 'Entfernen' }))) return;
      liste.splice(i, 1);
    } else [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
    E().notfallKontakte = liste;
    await saveConfig();
    $main.querySelector('#kontakte').innerHTML = kontakteHtml();
    return;
  }
  if (act === 'er-kalender') {
    await dateiSpeichern('diary-card-erinnerung.ics', kalenderDatei(ER()), 'text/calendar');
    return toast('Kalender-Datei gespeichert – öffnen und in den Kalender übernehmen');
  }
  if (act === 'design') {
    E().design = { ...E().design, [el.dataset.key]: el.dataset.wert };
    // Wer ein Dunkel-Akzent wählt, will ihn sehen: Modus auf dunkel, falls gerade hell
    if (el.dataset.key === 'nacht' && document.documentElement.dataset.dunkel !== '1') E().design.modus = 'dunkel';
    if (el.dataset.key === 'thema' && document.documentElement.dataset.dunkel === '1') E().design.modus = 'hell';
    wendeDesignAn(E().design);
    await saveConfig();
    const y = window.scrollY;
    await renderDaten();
    window.scrollTo(0, y);
    return;
  }
  if (act === 'wochenstart') {
    E().wochenstart = +el.dataset.wert;
    await saveConfig();
    pdfWoche(0);
    toast(`Woche beginnt jetzt am ${WOCHENTAGE[E().wochenstart]}`);
    return renderDaten();
  }
  if (act === 'pin-aus') {
    const alt = $main.querySelector('#pin-form [name=alt]').value;
    if (!(await pinPruefen(alt, E().pin))) return toast('Aktuelle PIN stimmt nicht');
    E().pin = null;
    await saveConfig();
    toast('PIN-Sperre ausgeschaltet');
    return renderDaten();
  }
  if (act === 'notfall-speichern') {
    await speichereNotfallplan();
    return toast('Notfallplan gespeichert');
  }
  if (act === 'hinweis-zeigen') return zeigeHinweis();
  if (act === 'export') return exportieren();
  if (act === 'persist') {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'Dauerhafter Speicher aktiv' : 'Browser hat abgelehnt');
    return renderDaten();
  }
});

// Tastatur für die Skalen-Regler (Pfeiltasten, Pos1/Ende, Entf = Offen)
$main.addEventListener('keydown', (e) => {
  const sb = e.target.closest?.('[role=spinbutton]');
  if (!sb || state.view !== 'heute') return;
  const id = sb.dataset.field;
  const f = state.config.fields.find((x) => x.id === id);
  const tasten = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
  if (e.key in tasten) schritt(id, tasten[e.key]);
  else if (e.key === 'Home') schritt(id, 0, f.min);
  else if (e.key === 'End') schritt(id, 0, f.max);
  else if (e.key === 'Delete' || e.key === 'Backspace') { setValue(id, null); updStepper(id); }
  else return;
  e.preventDefault();
});

// Auf-/Zuklappen der Bereiche merken (toggle blubbert nicht → capture)
$main.addEventListener('toggle', (e) => {
  const g = e.target.dataset?.gruppe;
  if (!g) return;
  state.zu ??= new Set();
  if (e.target.open) state.zu.delete(g); else state.zu.add(g);
}, true);

let planTimer = null;
let planGeaendert = false;
/** Speichert den Notfallplan (wird beim Tippen sofort übernommen und kurz danach gesichert) */
async function speichereNotfallplan() {
  clearTimeout(planTimer);
  const feld = $main.querySelector('#notfallplan');
  if (feld && state.config) { planGeaendert ||= (E().notfallPlan ?? '') !== feld.value.trim(); E().notfallPlan = feld.value.trim(); }
  if (!planGeaendert) return;
  planGeaendert = false;
  await saveConfig();
}
$main.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'notfallplan') { E().notfallPlan = t.value.trim(); planGeaendert = true; clearTimeout(planTimer); planTimer = setTimeout(speichereNotfallplan, 600); return; }
  // Verhaltens-Baukasten
  if (t.id === 'vb-name') { state.vb.name = t.value; return; }
  if (t.id === 'vb-einheit') { state.vb.einheit = t.value.trim(); return; }
  if (t.dataset.vbArt) {
    if (t.checked) state.vb.arten.add(t.dataset.vbArt); else state.vb.arten.delete(t.dataset.vbArt);
    $main.querySelector('.baukasten .einheit-zeile').hidden = !state.vb.arten.has('viel');
    return;
  }
  // Medikamente
  if (t.dataset.med) {
    const fid = t.closest('[data-meds]').dataset.meds;
    const m = state.entry.values[fid][+t.closest('.medrow').dataset.i];
    m[t.dataset.med] = t.dataset.med === 'dose' ? (t.value === '' ? null : Number(t.value)) : t.value;
    autoSpeichern();
    return;
  }
  // Tageskarte
  if (t.dataset.field) {
    const id = t.dataset.field;
    if (t.dataset.kind === 'number') {
      setValue(id, t.value === '' ? null : Number(t.value));
      if (t.type === 'range') updStepper(id);
    } else setValue(id, t.value);
    return;
  }
  // Vorlage
  if (t.dataset.f) {
    const f = state.draftFields[+t.closest('.feld').dataset.idx];
    const key = t.dataset.f;
    if (key === 'hidden') f.hidden = t.checked;
    else if (key === 'mehrfach') f.mehrfach = t.checked;
    else if (key === 'optionen') f.optionen = t.value.split(',').map((x) => x.trim()).filter(Boolean);
    else if (['min', 'max', 'step'].includes(key)) f[key] = t.value === '' ? NaN : Number(t.value);
    else f[key] = t.value;
    if (key === 'hidden') t.closest('.feld').classList.toggle('aus', t.checked);
    refreshVorlageButtons();
  }
});

$main.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'kurzansicht') {
    await autoSpeichernJetzt();
    E().kurzansicht = t.checked;
    await saveConfig();
    return renderHeute();
  }
  if (t.dataset.schnellfeld) {
    const id = t.dataset.schnellfeld;
    const liste = (state.config.schnellFelder ?? []).filter((x) => x !== id);
    if (t.checked) liste.push(id);
    state.config.schnellFelder = liste;
    await saveConfig();
    return toast(t.checked ? `In der Schnell-Karte (${liste.length} Felder)` : 'Nicht mehr in der Schnell-Karte');
  }
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
  if (t.id === 'inhalt-schuetzen') {
    E().inhaltSchuetzen = t.checked;
    await saveConfig();
    await bildschirmSchutz(t.checked);
    return toast(t.checked ? 'Inhalt geschützt – keine Bildschirmfotos' : 'Schutz aus – Bildschirmfotos möglich');
  }
  if (t.id === 'sanfter-hinweis') {
    E().sanfterHinweis = t.checked;
    await saveConfig();
    return toast(t.checked ? 'Sanfter Hinweis an' : 'Sanfter Hinweis aus');
  }
  if (t.id === 'hinweis-schwelle') {
    E().hinweisSchwelle = +t.value;
    await saveConfig();
    return toast('Gespeichert');
  }
  if (t.dataset.kurz) {
    const id = t.dataset.kurz;
    const set = new Set(state.config.kurzFelder ?? []);
    if (t.checked) set.add(id); else set.delete(id);
    state.config.kurzFelder = [...set];
    await saveConfig();
    return toast(t.checked ? 'In der Kurzansicht' : 'Nicht mehr in der Kurzansicht');
  }
  if (t.id === 'datum') {
    if (!t.value) return;
    if (!(await leaveOk())) { t.value = state.date; return; }
    state.date = t.value;
    return renderHeute();
  }
  if (t.dataset.med === 'name') {
    // gespeichertes Medikament gewählt → Dosis und Einheit vorschlagen, wenn noch leer
    const row = t.closest('.medrow');
    const m = state.entry.values[t.closest('[data-meds]').dataset.meds][+row.dataset.i];
    const bekannt = (state.config.medikamente ?? []).find((x) => x.name.toLowerCase() === m.name.trim().toLowerCase());
    if (bekannt && !hasValue(m.dose)) {
      Object.assign(m, { name: bekannt.name, dose: bekannt.dose, unit: bekannt.unit });
      t.value = bekannt.name;
      row.querySelector('[data-med="dose"]').value = bekannt.dose ?? '';
      row.querySelector('[data-med="unit"]').value = bekannt.unit;
    }
    return;
  }
  if (t.dataset.skill) {
    const id = t.dataset.skill;
    const s = (state.entry.skills[id] ??= { used: false, rating: null });
    s.used = t.checked;
    const sel = $main.querySelector(`[data-skill-rating="${id}"]`);
    sel.disabled = !t.checked;
    autoSpeichern();
    return updateSkillCount();
  }
  if (t.dataset.skillRating) {
    const id = t.dataset.skillRating;
    const s = (state.entry.skills[id] ??= { used: false, rating: null });
    s.rating = t.value === '' ? null : Number(t.value);
    if (s.rating !== null && !s.used) {
      s.used = true;
      const cb = $main.querySelector(`[data-skill="${id}"]`);
      if (cb) cb.checked = true;
      updateSkillCount();
    }
    autoSpeichern();
    return;
  }
  if (t.classList.contains('bereichname')) {
    const alt = t.dataset.g;
    const neu = t.value.trim();
    if (!neu) { t.value = alt; return; }
    state.draftFields.forEach((f) => { if ((f.group || 'Allgemein') === alt) f.group = neu; });
    return renderVorlage();
  }
  if (t.dataset.pdf) {
    const key = t.dataset.pdf;
    if (key === 'name') {
      state.config.profil = { ...state.config.profil, name: t.value.trim() };
      return saveConfig();
    }
    state.pdf[key] = t.type === 'checkbox' ? t.checked : t.value;
    return;
  }
  if (t.dataset.f === 'group') return renderVorlage();
  if (t.id === 'baustein') {
    $main.querySelector('#bausteininfo').textContent = BAUSTEINE[t.value].info;
    return;
  }
  if (t.dataset.f === 'type') {
    const f = state.draftFields[+t.closest('.feld').dataset.idx];
    if (f.type === 'scale' && !(f.max > f.min)) Object.assign(f, { min: 0, max: 5, step: 1 });
    if (f.type === 'auswahl' && !f.optionen?.length) Object.assign(f, { optionen: ['Option 1', 'Option 2'], mehrfach: true });
    return renderVorlage();
  }
  if (t.dataset.s) {
    const s = state.config.skills.find((x) => x.id === t.closest('.skillrow').dataset.id);
    if (t.dataset.s === 'hidden' || t.dataset.s === 'notfall') s[t.dataset.s] = t.checked;
    else if (t.dataset.s === 'name' && !t.value.trim()) { t.value = s.name; return; }
    else s[t.dataset.s] = t.value.trim();
    await saveConfig();
    t.closest('.skillrow').classList.toggle('aus', !!s.hidden);
    return toast('Gespeichert');
  }
  if (t.id === 'verlaufTage') {
    state.verlaufTage = +t.value;
    return renderVerlauf();
  }
  if (t.id === 'importfile' && t.files[0]) return importieren(t.files[0]);
});

$main.addEventListener('submit', async (e) => {
  if (state.view === 'ketten') return; // eigenes Modul
  e.preventDefault();
  if (e.target.id === 'card') return autoSpeichernJetzt();
  if (e.target.id === 'kontakt-form') {
    const fd = new FormData(e.target);
    const k = { name: String(fd.get('name')).trim(), nummer: String(fd.get('nummer')).trim(), info: String(fd.get('info')).trim() };
    if (!k.name || !k.nummer) return;
    if (telHref(k.nummer).replace('+', '').length < 3) return toast('Bitte eine gültige Nummer eingeben');
    E().notfallKontakte = [...(E().notfallKontakte ?? []), k];
    await saveConfig();
    $main.querySelector('#kontakte').innerHTML = kontakteHtml();
    return toast(`${k.name} gespeichert`);
  }
  if (e.target.id === 'skill-neu') {
    const fd = new FormData(e.target);
    const name = String(fd.get('name')).trim();
    if (!name) return;
    state.config.skills.push({ id: newId('s'), name, module: fd.get('module'), description: String(fd.get('description')).trim(), hidden: false, notfall: fd.get('notfall') === 'on' });
    await saveConfig();
    toast(`„${name}“ angelegt`);
    return renderSkills();
  }
  if (e.target.id === 'pin-form') {
    const fd = new FormData(e.target);
    const neu = String(fd.get('neu'));
    if (E().pin && !(await pinPruefen(String(fd.get('alt')), E().pin))) return toast('Aktuelle PIN stimmt nicht');
    if (!pinGueltig(neu)) return toast('PIN: 4 bis 8 Ziffern');
    if (neu !== String(fd.get('neu2'))) return toast('Die PINs stimmen nicht überein');
    E().pin = await pinHash(neu);
    await saveConfig();
    toast('PIN gespeichert');
    return renderDaten();
  }
});

// ---------- Sperre ----------
async function entsperren() {
  if (!E().pin) return;
  await sperren(E().pin, async () => { E().pin = null; await saveConfig(); toast('PIN entfernt'); }, () => zeigeNotfall());
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

/**
 * Ergänzt fehlende Einstellungen mit Standardwerten – beim Start und nach dem Import älterer Sicherungen.
 * Bestehende eigene Werte werden nie überschrieben.
 */
async function vervollstaendigeConfig() {
  state.config.einstellungen = { ...EINSTELLUNGEN_STANDARD, ...state.config.einstellungen };
  E().design = { ...DESIGN_STANDARD, ...E().design };
  state.config.skills ??= [];
  state.config.medikamente ??= [];
  state.config.stundenNotizen ??= [];
  // Schnell-Karte: Standardfelder einmalig setzen
  // Schnell-Karte: die 6 Befinden-Werte (Belastung bis Vertrauen in die Therapie). Einmalig umstellen, danach frei wählbar.
  if (!state.config.schnellV2) {
    state.config.schnellFelder = BEFINDEN_IDS.filter((id) => state.config.fields.some((f) => f.id === id));
    state.config.schnellV2 = true;
  }
  state.config.luecken ??= {};
  // Kurzansicht „Nur das Wichtigste“: Standardauswahl einmalig setzen
  if (!state.config.kurzFelder) {
    state.config.kurzFelder = ['f_belastung', 'f_selbstmitgefuehl', 'f_suizid', 'f_dissoziation', 'f_skills', 'f_pv_essen_drang', 'f_pv_essen_handlung', 'f_v1_drang', 'f_v1_gemacht', 'f_meds']
      .filter((id) => state.config.fields.some((f) => f.id === id));
    await saveConfig();
  }
  if (!state.config.feldInfoInit) {
    state.config.feldInfo ??= {};
    for (const [id, info] of Object.entries(FELD_INFO)) {
      if (!state.config.feldInfo[id] && state.config.fields.some((f) => f.id === id)) state.config.feldInfo[id] = { notiz: '', ...info };
    }
    state.config.feldInfoInit = true;
    await saveConfig();
  }
  // Standard-Notfall-Skills einmalig markieren
  if (!state.config.notfallMarkiert) {
    state.config.skills.forEach((s) => { if (['s_stop', 's_tipp', 's_sinnesreize', 's_selbstberuhigung', 's_radikale_akzeptanz'].includes(s.id)) s.notfall = true; });
    state.config.notfallMarkiert = true;
  }
  await saveConfig();
}

init().catch((err) => {
  $main.innerHTML = `<p class="fehler">Fehler beim Start: ${esc(err.message)}</p>`;
  console.error(err);
});

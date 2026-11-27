// Tageskarte: Anzeige, Eingaben, Rückmeldung nach dem Speichern, Schnell-Karte und Übungen als Skill eintragen.
import * as db from './db.js';
import { clone, todayISO, shiftDate, formatDate, currentVersion, hasValue, fieldsForEntry, cleanEntry } from './model.js';
import { kategorie } from './defaults.js';
import { esc, datumKurz, groupBy, toast, WOCHENTAGE, wochentag, openModal, closeModal, icon } from './ui.js';
import { $main, E, state, saveConfig, ketten, feldTitel, nav, aufKlick, aufSenden, feldNach, kurzFilter, ton } from './kern.js';
import { erinnerungenAktualisieren } from './erinnerung.js';
import { suizidHoch, KRISEN_HTML, uebungenKompakt } from './notfall.js';
import { gruppeHtml, fieldInput, gruppeHatWerte, updFortschritt, zeigeInfo, infoKnoepfeAktualisieren, updStepper, refreshMeds } from './felder.js';
import { leaveOk, autoSpeichernJetzt, autoSpeichern, schritt, setValue } from './eintrag.js';
import { draengeKasten, skillsBlock, updateSkillCount } from './draenge.js';

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

/** Felder, bei denen ein hoher Wert Belastung bedeutet (nicht z. B. Selbstmitgefühl oder Schlaf) */
const istBelastend = (f) => f.type === 'scale' && (['f_belastung', 'f_suizid', 'f_dissoziation'].includes(f.id) || /drang/i.test(`${f.id} ${f.name}`));

function hoheWerte(values) {
  const schwelle = E().hinweisSchwelle ?? 0.8;
  return state.config.fields.filter((f) => istBelastend(f) && hasValue(values?.[f.id]) && (values[f.id] - f.min) / (f.max - f.min) >= schwelle);
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
      ${uebungenKompakt()}
      <div class="actions dialog-knoepfe">
        <button class="ghost" data-modal-zu>Nicht jetzt</button>
        <button class="ghost" data-notfall>${icon('herz', 16)} Notfallplan</button>
      </div>
      <p class="meta">Diesen Hinweis kannst du unter Mehr → Einstellungen anpassen oder ausschalten.</p>`, { klasse: 'sanft' });
  }, 900);
}

// ---------- Schnell-Karte (ca. 30 Sekunden) ----------
export async function zeigeSchnellkarte(datum = todayISO()) {
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
    if (['woche', 'heute'].includes(state.view)) await nav.neuZeichnen();
  };
}

/** Übung als genutzten Skill in die heutige Karte eintragen */
export async function trageUebungEin(u, wirkung) {
  const heute = todayISO();
  if (state.view === 'heute' && state.date === heute) await autoSpeichernJetzt();
  const e = (await db.getEntry(heute)) ?? { date: heute, values: {}, skills: {}, status: 'entwurf', templateVersion: currentVersion(state.config).v };
  const now = new Date().toISOString();
  if (state.config.skills.some((s) => s.id === u.skill)) e.skills[u.skill] = { used: true, rating: wirkung };
  e.createdAt ??= now;
  e.updatedAt = now;
  await db.putEntry(e);
  toast(`„${u.name}“ in der heutigen Karte eingetragen`);
  if (['woche', 'heute'].includes(state.view)) await nav.neuZeichnen();
}

// ---------- Tageskarte ----------
export async function renderHeute() {
  const [stored, kettenAlle, ...vortage] = await Promise.all([
    db.getEntry(state.date),
    db.getAllKetten(),
    ...Array.from({ length: 14 }, (_, i) => db.getEntry(shiftDate(state.date, -(i + 1)))),
  ]);
  state.entry = stored ? clone(stored) : { date: state.date, values: {}, skills: {}, status: 'entwurf' };
  state.entry.status ??= 'entwurf';
  state.entryDirty = false;
  state.entryHatteWerte = Object.keys(state.entry.values ?? {}).length > 0;
  const fields = fieldsForEntry(state.config, stored);
  const isToday = state.date === todayISO();
  const kettenTag = kettenAlle.filter((k) => k.date === state.date && !k.archiviert);
  // „Zuletzt genutzt“: Skills des letzten Tages (bis 14 Tage zurück), an dem welche genutzt wurden
  state.skillsZuletzt = [];
  for (const e of vortage) {
    state.skillsZuletzt = Object.keys(e?.skills ?? {}).filter((id) => e.skills[id]?.used);
    if (state.skillsZuletzt.length) break;
  }
  const zuKlaeren = E().klaerenAusgeblendet === todayISO() ? 0 : fields.filter((f) => state.config.feldInfo?.[f.id]?.klaeren).length;

  const kurz = !!E().kurzansicht;
  const sichtbarKurz = kurzFilter();
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
      ${(() => {
        const gruppen = groupBy(fields, (f) => f.group || 'Allgemein');
        const istDrang = (g) => kategorie(g) === 'problem';
        state.kartenFelder = fields;
        const dg = gruppen.filter(([g, fs]) => istDrang(g) && (!kurz || fs.some(sichtbarKurz)));
        if (state.drangOffen?.datum !== state.date) {
          state.drangOffen = { datum: state.date, set: new Set(dg.filter(([, fs]) => gruppeHatWerte(fs)).map(([g]) => g)) };
        }
        // Kasten direkt nach „Befinden“ (sonst an der Stelle des ersten Drangs)
        const nachBefinden = gruppen.some(([g]) => g === 'Befinden');
        let kastenFertig = false;
        const kasten = () => { if (kastenFertig || !dg.length) return ''; kastenFertig = true; return draengeKasten(dg); };
        return gruppen.map(([g, fs]) => {
          if (istDrang(g)) return nachBefinden ? '' : kasten();
          return gruppeHtml(g, fs) + (g === 'Befinden' ? kasten() : '');
        }).join('');
      })()}
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

aufKlick({
  day: tagWechseln,
  today: tagWechseln,
  status: async (el) => {
    state.entry.status = el.dataset.wert;
    state.entryDirty = true;
    await autoSpeichernJetzt();
    if (el.dataset.wert === 'abgeschlossen') rueckmeldung(state.entry.values);
    else toast('Wieder als Entwurf geöffnet');
    const y = window.scrollY;
    await renderHeute();
    window.scrollTo(0, y);
  },
  'klaeren-aus': async (el) => { E().klaerenAusgeblendet = todayISO(); await saveConfig(); el.closest('.klaeren-leiste').hidden = true; },
  info: (el) => zeigeInfo(el.dataset.field, infoKnoepfeAktualisieren),
  step: (el) => schritt(el.dataset.field, +el.dataset.delta),
  seg: (el) => schritt(el.dataset.field, 0, +el.dataset.value),
  wahl: (el) => {
    const id = el.dataset.field;
    const f = feldNach(id);
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
  },
  set: (el) => {
    const id = el.dataset.field;
    const raw = el.dataset.value;
    const val = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
    const neu = state.entry.values[id] === val ? null : val; // nochmal tippen = leeren
    setValue(id, neu);
    el.parentElement.querySelectorAll('[data-act="set"]').forEach((b) => b.classList.toggle('on', b === el && neu !== null));
  },
  clear: (el) => {
    const id = el.dataset.field;
    setValue(id, null);
    $main.querySelectorAll(`[data-group="${id}"] .on`).forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    const inp = $main.querySelector(`[data-field="${id}"]:not(button)`);
    if (inp) inp.value = '';
  },
  'kette-neu': ketteOeffnen,
  'kette-oeffnen': ketteOeffnen,
  'med-add': (el) => {
    const fid = el.dataset.field;
    (state.entry.values[fid] ??= []).push({ name: '', dose: null, unit: 'mg' });
    autoSpeichern();
    return refreshMeds(fid, true);
  },
  'med-del': (el) => {
    const fid = el.closest('[data-meds]').dataset.meds;
    state.entry.values[fid].splice(+el.closest('.medrow').dataset.i, 1);
    autoSpeichern();
    return refreshMeds(fid);
  },
  'med-last': async (el) => {
    const fid = el.dataset.field;
    const frueher = (await db.getAllEntries())
      .filter((x) => x.date < state.date && hasValue(x.values[fid]))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!frueher) return toast('Kein früherer Eintrag mit Medikamenten');
    state.entry.values[fid] = clone(frueher.values[fid]);
    autoSpeichern();
    refreshMeds(fid);
    return toast(`Übernommen vom ${formatDate(frueher.date)}`);
  },
});

async function tagWechseln(el) {
  if (!(await leaveOk())) return;
  state.date = el.dataset.act === 'today' ? todayISO() : shiftDate(state.date, +el.dataset.delta);
  return renderHeute();
}

async function ketteOeffnen(el) {
  if (!(await leaveOk())) return;
  state.entryDirty = false;
  if (el.dataset.act === 'kette-neu') ketten.neuFuer(state.date);
  else ketten.oeffne((await db.getAllKetten()).find((k) => k.id === el.dataset.id));
  return nav.zeige('ketten', { force: true });
}

aufSenden({ card: () => autoSpeichernJetzt() });

// Tastatur für die Skalen-Regler (Pfeiltasten, Pos1/Ende, Entf = Offen)
$main.addEventListener('keydown', (e) => {
  const sb = e.target.closest?.('[role=spinbutton]');
  if (!sb || state.view !== 'heute') return;
  const id = sb.dataset.field;
  const f = feldNach(id);
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

$main.addEventListener('input', (e) => {
  const t = e.target;
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
      const faktor = Number(t.dataset.faktor || 0);
      // Dauer: immer ganze Minuten speichern, egal ob Minuten, Stunden oder Tage eingegeben werden
      setValue(id, t.value === '' ? null : faktor ? Math.round(Number(t.value) * faktor) : Number(t.value));
      if (t.type === 'range') updStepper(id);
    } else setValue(id, t.value);
  }
});

$main.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.einheitwahl) {
    state.config.einheitWahl = { ...state.config.einheitWahl, [t.dataset.einheitwahl]: t.value };
    await saveConfig();
    const box = t.closest('.field');
    const f = feldNach(t.dataset.einheitwahl);
    box.outerHTML = fieldInput(f);
    return;
  }
  if (t.id === 'kurzansicht') {
    await autoSpeichernJetzt();
    E().kurzansicht = t.checked;
    await saveConfig();
    return renderHeute();
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
  }
});

// Darstellung der Felder auf der Tageskarte: Eingaben je Typ, Skalen-Wörter, Fortschritt, ⓘ-Erklärungen.
import { todayISO, hasValue, fieldsForEntry, istMinuten, dauerText, ZEIT_EINHEITEN } from './model.js';
import { MED_EINHEITEN, kategorie } from './defaults.js';
import { esc, groupBy, toast, openModal, closeModal, icon } from './ui.js';
import { $main, E, state, saveConfig } from './kern.js';

// ---------- Wörter für Skalen 0–5 ----------
const STUFEN_DRANG = ['kein Drang', 'kaum spürbar', 'leicht', 'deutlich', 'stark', 'kaum auszuhalten'];
export const STUFEN_WIRKUNG = ['nicht geholfen', 'kaum', 'etwas', 'spürbar', 'deutlich', 'sehr geholfen'];
/** Wörter für ein Skalenfeld, falls es eine Drang-Skala 0–5 ist */
const stufenVon = (f) => (f.type === 'scale' && f.min === 0 && f.max === 5 && f.step === 1 && /drang/i.test(`${f.id} ${f.name}`) ? STUFEN_DRANG : null);
const stufenText = (f, v) => { const st = stufenVon(f); return st && hasValue(v) ? st[v] ?? '' : ''; };

/** Ein Bereich der Tageskarte (aufklappbar) */
export function gruppeHtml(g, fs, { versteckt = false } = {}) {
  const kurz = !!E().kurzansicht;
  const kurzSet = new Set(state.config.kurzFelder ?? []);
  const sichtbarKurz = (f) => !kurz || kurzSet.has(f.id);
  const sichtbar = fs.filter(sichtbarKurz);
  return `<details class="kasten gruppe-k kat-${kategorie(g)} ${sichtbar.length ? '' : 'kurz-aus'}" data-gruppe="${esc(g)}" ${state.zu?.has(g) ? '' : 'open'} ${versteckt ? 'hidden' : ''}>
    <summary><span class="kat-punkt" aria-hidden="true"></span><span>${esc(g)}</span><span class="fortschritt" data-fortschritt="${esc(g)}"></span>${icon('runter', 18)}</summary>
    <div class="gruppe-inhalt">${fs.map((f) => (sichtbarKurz(f) ? fieldInput(f) : '')).join('')}</div>
  </details>`;
}

export const drangName = (g) => g.replace(/^(Problemverhalten|Verhalten):\s*/, '');
export const gruppeHatWerte = (fs) => fs.some((f) => hasValue(state.entry.values[f.id]));

/** Fortschritt pro Bereich: „3/6“ ausgefüllt */
export function updFortschritt() {
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

/** ⓘ-Knopf zu einem Feld: signalrot, solange die Bedeutung noch geklärt werden muss. */
function infoKnopf(f) {
  const info = state.config.feldInfo?.[f.id];
  if (!info?.text && !info?.notiz && !info?.klaeren) return '';
  return `<button type="button" class="info-knopf ${info.klaeren ? 'klaeren' : ''}" data-act="info" data-field="${f.id}"
    title="${info.klaeren ? 'Erklärung – muss noch mit der Therapie geklärt werden' : 'Erklärung'}" aria-label="Erklärung zu ${esc(f.name)}">i</button>`;
}

export function zeigeInfo(fid, nachher = () => {}) {
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
export function infoKnoepfeAktualisieren() {
  const knoepfe = [...$main.querySelectorAll('.info-knopf[data-field]')];
  knoepfe.forEach((b) => b.classList.toggle('klaeren', !!state.config.feldInfo?.[b.dataset.field]?.klaeren));
  const n = knoepfe.filter((b) => b.classList.contains('klaeren')).length;
  const el = $main.querySelector('#klaeren-zahl');
  if (el) {
    el.textContent = n;
    el.closest('.klaeren-leiste').hidden = !n || E().klaerenAusgeblendet === todayISO();
  }
}

export function fieldInput(f) {
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
      ${stufenVon(f) ? `<span class="skalentext" aria-live="polite">${esc(stufenText(f, v))}</span>` : ''}
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
  if (istMinuten(f)) {
    const w = state.config.einheitWahl?.[f.id] ?? 'min';
    const faktor = ZEIT_EINHEITEN[w]?.[1] ?? 1;
    const anzeige = hasValue(v) ? +(v / faktor).toFixed(2) : '';
    return `<div class="field">${label}<span class="mitEinheit">
      <input type="number" inputmode="decimal" min="0" step="any" data-field="${f.id}" data-kind="number" data-faktor="${faktor}" value="${anzeige}" aria-label="${esc(f.name)}">
      <select data-einheitwahl="${f.id}" aria-label="Einheit">${Object.entries(ZEIT_EINHEITEN).map(([k, [n]]) => `<option value="${k}" ${k === w ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </span>${hasValue(v) && faktor !== 1 ? `<span class="hint">= ${dauerText(v)}</span>` : ''}</div>`;
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
export function updStepper(id) {
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
  const st = box.querySelector('.skalentext');
  if (st) st.textContent = stufenText(state.config.fields.find((x) => x.id === id), v);
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

export function refreshMeds(fid, focusLast = false) {
  const box = $main.querySelector(`[data-meds="${fid}"]`);
  box.innerHTML = medRows(fid);
  if (focusLast) box.querySelector('.medrow:last-child [data-med="name"]')?.focus();
}

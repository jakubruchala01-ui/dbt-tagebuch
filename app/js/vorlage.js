// „Karte anpassen“: Felder und Bereiche bearbeiten, Verhaltens-Baukasten, fertige Zusammenstellungen.
import { clone, newId, currentVersion, templateChanged, commitTemplate, isCommitted, validateFields, applyStandard } from './model.js';
import { TYPEN, BAUSTEINE, kategorie, MESSARTEN, MESSART_ENDUNG, VERHALTEN_VORLAGEN, verhaltenFelder } from './defaults.js';
import { esc, fmtTime, groupBy, toast, openModal, closeModal, frage, hinweis, icon } from './ui.js';
import { $main, state, saveConfig, BEFINDEN_IDS, aufKlick } from './kern.js';
import { zeigeInfo, infoKnoepfeAktualisieren } from './felder.js';

// ---------- Vorlage: Verhaltens-Baukasten ----------
const istVerhaltenGruppe = (g = '') => /^(Verhalten|Problemverhalten|Neue Wege):/.test(g);

function verhaltenBaukasten() {
  const vb = (state.vb ??= { vorlage: 'bildschirm', arten: new Set(VERHALTEN_VORLAGEN.bildschirm.arten), name: '', einheit: '' });
  return `<details class="karte baukasten kat-problem" ${vb.name || state.vbOffen ? 'open' : ''}>
    <summary><b>${icon('plus', 18)} Neuen Drang oder neues Verhalten hinzufügen</b></summary>
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
    <div class="actions"><button class="primary" data-act="vb-add">${icon('plus', 18)} Hinzufügen</button></div>
  </details>`;
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
    toast(`${neu.length} Messart${neu.length > 1 ? 'en' : ''} ergänzt – jetzt „Speichern“`);
  };
}

/** Fertige Zusammenstellung: blendet nur ein/aus, löscht nie etwas */
export function presetFelder(art, felder) {
  if (art === 'standard') return applyStandard(felder);
  return felder.map((f) => ({ ...f, hidden: art === 'alles' ? false : !BEFINDEN_IDS.includes(f.id) && !['text', 'meds'].includes(f.type) && kategorie(f.group ?? '') !== 'problem' }));
}

// ---------- Vorlage ----------
export function renderVorlage() {
  const c = state.config;
  const bereiche = [...new Set(state.draftFields.map((f) => f.group).filter(Boolean))];
  const geaendert = templateChanged(c, state.draftFields);

  const offen = (state.vorlageOffen ??= new Set());
  $main.innerHTML = `
    <div class="karte vorlage-kopf">
      <h2>Karte anpassen</h2>
      <p>Hier legst du fest, was auf deiner Tageskarte steht. <strong>Nichts geht verloren:</strong> Ausgeblendete Punkte verschwinden nur von der Karte,
      alte Einträge bleiben vollständig. Änderungen gelten erst nach „Speichern“.</p>
      <p class="fname">Schnell starten</p>
      <div class="vorlage-presets">
        <button type="button" data-act="tpl-preset" data-wert="einfach"><b>Einfach</b><small>6 Befinden-Werte, Dränge, Medikamente, Notizen, Skills</small></button>
        <button type="button" data-act="tpl-preset" data-wert="standard"><b>Standard</b><small>wie die Papier-Diary-Card</small></button>
        <button type="button" data-act="tpl-preset" data-wert="alles"><b>Ausführlich</b><small>alles zeigen, auch Ausgeblendetes</small></button>
      </div>
    </div>
    <datalist id="bereiche">${bereiche.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
    <h3 class="vorlage-h">Schon auf deiner Karte</h3>
    <p class="meta">Antippen zum Bearbeiten. ✓ = auf der Karte sichtbar.</p>
    <details class="karte einzelfeld">
      <summary><b>Einzelnes Feld hinzufügen</b> <span class="meta">– z. B. eine Skala oder ein Ja/Nein</span></summary>
      <div class="row wrap">
        <select id="baustein">${Object.entries(BAUSTEINE).filter(([k]) => ['menge', 'skala', 'janein'].includes(k)).map(([k, b]) => `<option value="${k}">${esc(b.titel)}</option>`).join('')}</select>
        <input id="bausteinname" class="grow" placeholder="Name, z. B. Wie viel gezockt?">
        <button data-act="b-add">Hinzufügen</button>
      </div>
      <p class="meta" id="bausteininfo">${esc(BAUSTEINE.menge.info)}</p>
    </details>
    ${groupBy(state.draftFields.map((f, i) => ({ f, i })), (x) => x.f.group || 'Allgemein').map(([g, items]) => {
      const an = items.filter((x) => !x.f.hidden).length;
      return `
      <details class="bereich kat-${kategorie(g)}" data-bereich="${esc(g)}" ${offen.has(g) ? 'open' : ''}>
        <summary class="bereich-zeile"><span class="kat-punkt" aria-hidden="true"></span><b>${esc(g)}</b>
          <span class="meta">${an ? `✓ ${an} von ${items.length} sichtbar` : 'ausgeblendet'}</span>${icon('runter', 18)}</summary>
        <div class="row bereichkopf">
          <input class="bereichname" data-g="${esc(g)}" value="${esc(g)}" aria-label="Bereich umbenennen" title="Bereich umbenennen (gilt für alle Felder darin)">
          ${istVerhaltenGruppe(g) ? `<button data-act="v-messart" data-group="${esc(g)}" class="ghost">+ Messart</button>` : ''}
          <button data-act="f-add" data-group="${esc(g)}" class="ghost">+ Feld</button>
        </div>
        ${items.map(({ f, i }, k) => feldEditor(f, i, k === 0, k === items.length - 1)).join('')}
      </details>`;
    }).join('')}
    ${verhaltenBaukasten()}
    <div class="actions sticky">
      <button data-act="tpl-save" class="primary" ${geaendert ? '' : 'disabled'}>Speichern</button>
      <button data-act="tpl-reset" class="ghost" ${geaendert ? '' : 'disabled'}>Verwerfen</button>
    </div>
    <details class="versionen"><summary>Versionen (${c.versions.length})</summary>
      <ul>${[...c.versions].reverse().map((v) => `<li>v${v.v} · ${fmtTime(v.savedAt)} · ${v.fields.filter((f) => !f.hidden).length} sichtbare Felder</li>`).join('')}</ul>
    </details>
    <p class="meta">Stand: Version ${currentVersion(c).v}. Jedes Speichern legt eine neue Version an; frühere Karten behalten ihre Felder.</p>`;
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
  (state.vorlageOffen ??= new Set()).add(g);
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

aufKlick({
  'f-info': (el) => zeigeInfo(state.draftFields[+el.closest('.feld').dataset.idx].id, infoKnoepfeAktualisieren),
  'f-add': (el) => {
    const group = el.dataset.group || 'Persönlich';
    const neu = { id: newId('f'), name: 'Neues Feld', type: 'scale', min: 0, max: 5, step: 1, group, hint: '', hidden: false };
    return einfuegen([neu]);
  },
  'vb-vorlage': (el) => {
    state.vb.vorlage = el.dataset.wert;
    state.vb.arten = new Set(VERHALTEN_VORLAGEN[el.dataset.wert].arten);
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    $main.querySelectorAll('[data-vb-art]').forEach((c) => { c.checked = state.vb.arten.has(c.dataset.vbArt); });
    $main.querySelector('.baukasten .einheit-zeile').hidden = !state.vb.arten.has('viel');
  },
  'vb-add': async () => {
    const vb = state.vb;
    const name = $main.querySelector('#vb-name').value.trim();
    if (!name) { $main.querySelector('#vb-name').focus(); return toast('Bitte einen Namen eingeben, z. B. „Gaming“'); }
    if (!vb.arten.size) return toast('Bitte mindestens eine Messart ankreuzen');
    const klein = (x) => x.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
    const aehnlich = [...new Set(state.draftFields.map((f) => f.group ?? ''))].filter((g) => {
      const a = klein(g.replace(/^(Problemverhalten|Verhalten|Neue Wege):\s*/, '')); const b = klein(name);
      return a && b && (a.includes(b) || b.includes(a));
    });
    if (aehnlich.length && !(await frage(`Es gibt schon: ${aehnlich.join(', ')}. Trotzdem „${name}“ neu anlegen?`, { titel: 'Schon vorhanden?', ja: 'Trotzdem anlegen', nein: 'Abbrechen' }))) {
      aehnlich.forEach((g) => (state.vorlageOffen ??= new Set()).add(g));
      return renderVorlage();
    }
    const felder = eindeutig(verhaltenFelder(name, newId('f'), [...vb.arten], { vorlage: vb.vorlage, einheit: vb.einheit }));
    state.vb = { ...vb, name: '', einheit: '' };
    state.vbOffen = true;
    einfuegen(felder);
    return toast(`„${name}“ mit ${felder.length} Messarten angelegt – jetzt „Speichern“`);
  },
  'v-messart': (el) => zeigeMessartWahl(el.dataset.group),
  'b-add': () => {
    const name = $main.querySelector('#bausteinname').value.trim();
    if (!name) { $main.querySelector('#bausteinname').focus(); return toast('Bitte einen Namen eingeben'); }
    return einfuegen(BAUSTEINE[$main.querySelector('#baustein').value].felder(name, newId('f')));
  },
  'tpl-preset': async (el) => {
    const art = el.dataset.wert;
    const neu = presetFelder(art, state.draftFields);
    const vorher = new Set(state.draftFields.filter((f) => !f.hidden).map((f) => f.id));
    const sichtbar = neu.filter((f) => !f.hidden);
    const aus = state.draftFields.filter((f) => vorher.has(f.id) && neu.find((n) => n.id === f.id)?.hidden).length;
    const titel = { einfach: 'Einfach', standard: 'Standard', alles: 'Ausführlich' }[art];
    if (!(await frage(`Danach stehen ${sichtbar.length} Punkte auf deiner Karte.${aus ? ` ${aus} werden ausgeblendet – nicht gelöscht, alte Einträge bleiben.` : ''} Danach noch „Speichern“.`, { titel: `„${titel}“ übernehmen?`, ja: 'Übernehmen' }))) return;
    state.draftFields = neu;
    renderVorlage();
    return toast('Übernommen – jetzt „Speichern“');
  },
  'f-move': (el) => {
    const idx = +el.closest('.feld')?.dataset.idx;
    const g = state.draftFields[idx].group;
    const d = +el.dataset.delta;
    let j = idx + d;
    while (state.draftFields[j] && state.draftFields[j].group !== g) j += d;
    if (!state.draftFields[j]) return;
    [state.draftFields[idx], state.draftFields[j]] = [state.draftFields[j], state.draftFields[idx]];
    return renderVorlage();
  },
  'f-remove': (el) => {
    const idx = +el.closest('.feld')?.dataset.idx;
    state.draftFields.splice(idx, 1);
    return renderVorlage();
  },
  'tpl-save': async () => {
    const fehler = validateFields(state.draftFields);
    if (fehler.length) return hinweis(fehler.join('\n'), 'Bitte Vorlage prüfen');
    if (commitTemplate(state.config, state.draftFields)) {
      await saveConfig();
      toast(`Vorlage v${currentVersion(state.config).v} gespeichert`);
    }
    state.draftFields = clone(state.config.fields);
    return renderVorlage();
  },
  'tpl-reset': () => {
    state.draftFields = clone(state.config.fields);
    return renderVorlage();
  },
});

// Auf-/Zuklappen der Bereiche merken (toggle blubbert nicht → capture)
$main.addEventListener('toggle', (e) => {
  if (!e.target.matches?.('details.bereich[data-bereich]')) return;
  state.vorlageOffen ??= new Set();
  if (e.target.open) state.vorlageOffen.add(e.target.dataset.bereich); else state.vorlageOffen.delete(e.target.dataset.bereich);
}, true);

$main.addEventListener('input', (e) => {
  const t = e.target;
  // Verhaltens-Baukasten
  if (t.id === 'vb-name') { state.vb.name = t.value; return; }
  if (t.id === 'vb-einheit') { state.vb.einheit = t.value.trim(); return; }
  if (t.dataset.vbArt) {
    if (t.checked) state.vb.arten.add(t.dataset.vbArt); else state.vb.arten.delete(t.dataset.vbArt);
    $main.querySelector('.baukasten .einheit-zeile').hidden = !state.vb.arten.has('viel');
    return;
  }
  // Felder
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
  if (t.dataset.schnellfeld) {
    const id = t.dataset.schnellfeld;
    const liste = (state.config.schnellFelder ?? []).filter((x) => x !== id);
    if (t.checked) liste.push(id);
    state.config.schnellFelder = liste;
    await saveConfig();
    return toast(t.checked ? `In der Schnell-Karte (${liste.length} Felder)` : 'Nicht mehr in der Schnell-Karte');
  }
  if (t.dataset.kurz) {
    const id = t.dataset.kurz;
    const set = new Set(state.config.kurzFelder ?? []);
    if (t.checked) set.add(id); else set.delete(id);
    state.config.kurzFelder = [...set];
    await saveConfig();
    return toast(t.checked ? 'In der Kurzansicht' : 'Nicht mehr in der Kurzansicht');
  }
  if (t.classList.contains('bereichname')) {
    const alt = t.dataset.g;
    const neu = t.value.trim();
    if (!neu) { t.value = alt; return; }
    state.draftFields.forEach((f) => { if ((f.group || 'Allgemein') === alt) f.group = neu; });
    return renderVorlage();
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
});

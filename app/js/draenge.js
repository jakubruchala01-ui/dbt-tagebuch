// Dränge & Verhalten (Kacheln auf der Karte) und Skills (Kacheln, Wirkung, Seite „Skills“).
import * as db from './db.js';
import { newId, todayISO, shiftDate, hasValue } from './model.js';
import { MODULE, kategorie } from './defaults.js';
import { esc, groupBy, toast } from './ui.js';
import { $main, state, saveConfig, aufKlick, aufSenden } from './kern.js';
import { STUFEN_WIRKUNG, gruppeHtml, drangName, gruppeHatWerte } from './felder.js';
import { autoSpeichern } from './eintrag.js';

/** Dränge & Verhalten: Kacheln antippen, nur angetippte Bereiche werden gezeigt. Reine Darstellung – Werte bleiben immer erhalten. */
export function draengeKasten(dg) {
  const offen = state.drangOffen.set;
  return `<section class="kasten draenge-kasten kat-problem" id="draenge">
    <h3 class="draenge-titel"><span class="kat-punkt" aria-hidden="true"></span>Dränge &amp; Verhalten heute</h3>
    <p class="hint">Tippe an, was heute da war – nur das füllst du aus.</p>
    <div class="chips drang-chips" role="group" aria-label="Dränge und Verhalten">
      ${dg.map(([g, fs]) => `<button type="button" data-act="drang-kachel" data-g="${esc(g)}" aria-pressed="${offen.has(g)}" class="${offen.has(g) ? 'on' : ''} ${gruppeHatWerte(fs) ? 'mitwert' : ''}">${esc(drangName(g))}</button>`).join('')}
    </div>
    <div class="row wrap drang-knoepfe">
      <button type="button" class="ghost klein" data-act="drang-gestern">Wie gestern</button>
      <button type="button" class="ghost klein" data-act="drang-nichts">Nichts davon heute</button>
      <span class="meta">Neue Dränge: Mehr → Karte anpassen</span>
    </div>
    ${dg.map(([g, fs]) => gruppeHtml(g, fs, { versteckt: !offen.has(g) })).join('')}
  </section>`;
}

/** Kachel an/aus: Bereich zeigen oder verbergen (Werte bleiben) */
function drangZeigen(g, an) {
  const offen = state.drangOffen.set;
  if (an) offen.add(g); else offen.delete(g);
  const box = $main.querySelector(`#draenge details[data-gruppe="${CSS.escape(g)}"]`);
  if (box) { box.hidden = !an; if (an) box.open = true; }
  const k = $main.querySelector(`[data-act="drang-kachel"][data-g="${CSS.escape(g)}"]`);
  if (k) { k.classList.toggle('on', an); k.setAttribute('aria-pressed', an); }
}

function skillKachel(s) {
  const an = !!state.entry.skills[s.id]?.used;
  return `<button type="button" class="${an ? 'on' : ''}" data-act="skill-kachel" data-skill-id="${s.id}" aria-pressed="${an}">${esc(s.name)}</button>`;
}

/** Wirkung je genutztem Skill: 6 runde Knöpfe mit Wort */
function wirkungenHtml() {
  const genutzt = state.config.skills.filter((s) => state.entry.skills[s.id]?.used);
  if (!genutzt.length) return '';
  return `<p class="fname">Wie gut hat es geholfen?</p>${genutzt.map((s) => {
    const r = state.entry.skills[s.id].rating;
    return `<div class="wirkung-zeile"><span class="wirkung-name">${esc(s.name)}</span>
      <span class="wirkung-knoepfe" role="group" aria-label="Wirkung ${esc(s.name)}">${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" data-act="skill-wirkung" data-skill-id="${s.id}" data-wert="${n}" class="${r === n ? 'on' : ''}" aria-pressed="${r === n}" title="${STUFEN_WIRKUNG[n]}">${n}</button>`).join('')}</span>
      <span class="skalentext">${hasValue(r) ? STUFEN_WIRKUNG[r] : ''}</span></div>`;
  }).join('')}`;
}

export function skillsBlock(stored) {
  const usedIds = new Set(Object.keys(stored?.skills ?? {}));
  const skills = state.config.skills.filter((s) => !s.hidden || usedIds.has(s.id));
  if (!skills.length) return '<p class="meta">Noch keine Skills. Unter „Mehr → Skills“ anlegen.</p>';
  const zuletzt = (state.skillsZuletzt ?? []).map((id) => skills.find((s) => s.id === id)).filter(Boolean);
  return `<p class="hint">Tippe an, welche Skills du heute genutzt hast.</p>
    ${zuletzt.length ? `<div class="field"><span class="fname">Zuletzt genutzt</span><div class="chips skill-chips">${zuletzt.map(skillKachel).join('')}</div></div>` : ''}
    ${groupBy(skills, (s) => s.module).map(([mod, list]) => `
    <details class="modul-${mod} skill-modul" ${list.some((s) => usedIds.has(s.id)) ? 'open' : ''}><summary>${esc(MODULE[mod] ?? mod)}</summary>
      <div class="chips skill-chips">${list.map(skillKachel).join('')}</div>
    </details>`).join('')}
    <div id="wirkungen" class="wirkungen">${wirkungenHtml()}</div>`;
}

export function updateSkillCount() {
  const n = Object.values(state.entry.skills).filter((s) => s.used).length;
  const el = document.getElementById('skillcount');
  if (el) { el.textContent = n ? `${n} genutzt` : ''; el.hidden = !n; }
}

// ---------- Skills ----------
export async function renderSkills() {
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

aufKlick({
  'drang-kachel': (el) => {
    const g = el.dataset.g;
    const an = !state.drangOffen.set.has(g);
    const fs = (state.kartenFelder ?? state.config.fields).filter((f) => (f.group || 'Allgemein') === g);
    if (!an && gruppeHatWerte(fs)) return toast('Hier ist schon etwas eingetragen – der Bereich bleibt sichtbar');
    return drangZeigen(g, an);
  },
  'drang-nichts': () => {
    let behalten = 0;
    [...state.drangOffen.set].forEach((g) => {
      if (gruppeHatWerte((state.kartenFelder ?? state.config.fields).filter((f) => (f.group || 'Allgemein') === g))) behalten += 1;
      else drangZeigen(g, false);
    });
    return toast(behalten ? 'Bereiche mit Einträgen bleiben sichtbar' : 'Okay – heute keine Dränge');
  },
  'drang-gestern': async () => {
    const gestern = await db.getEntry(shiftDate(state.date, -1));
    const gs = [...new Set(state.config.fields.filter((f) => kategorie(f.group ?? '') === 'problem' && hasValue(gestern?.values?.[f.id])).map((f) => f.group))];
    if (!gs.length) return toast('Gestern war hier nichts eingetragen');
    gs.forEach((g) => drangZeigen(g, true));
    return toast(`Wie gestern: ${gs.map(drangName).join(', ')} – Stärke bitte neu wählen`);
  },
  'skill-kachel': (el) => {
    const id = el.dataset.skillId;
    const s = (state.entry.skills[id] ??= { used: false, rating: null });
    s.used = !s.used;
    $main.querySelectorAll(`[data-act="skill-kachel"][data-skill-id="${id}"]`).forEach((b) => { b.classList.toggle('on', s.used); b.setAttribute('aria-pressed', s.used); });
    const wk = $main.querySelector('#wirkungen');
    if (wk) wk.innerHTML = wirkungenHtml();
    autoSpeichern();
    return updateSkillCount();
  },
  'skill-wirkung': (el) => {
    const s = state.entry.skills[el.dataset.skillId];
    if (!s) return;
    const w = +el.dataset.wert;
    s.rating = s.rating === w ? null : w;
    const wk = $main.querySelector('#wirkungen');
    if (wk) wk.innerHTML = wirkungenHtml();
    return autoSpeichern();
  },
});

// Seite „Skills“: Änderungen sofort speichern
$main.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.s) {
    const s = state.config.skills.find((x) => x.id === t.closest('.skillrow').dataset.id);
    if (t.dataset.s === 'hidden' || t.dataset.s === 'notfall') s[t.dataset.s] = t.checked;
    else if (t.dataset.s === 'name' && !t.value.trim()) { t.value = s.name; return; }
    else s[t.dataset.s] = t.value.trim();
    await saveConfig();
    t.closest('.skillrow').classList.toggle('aus', !!s.hidden);
    return toast('Gespeichert');
  }
});

aufSenden({
  'skill-neu': async (form) => {
    const fd = new FormData(form);
    const name = String(fd.get('name')).trim();
    if (!name) return;
    state.config.skills.push({ id: newId('s'), name, module: fd.get('module'), description: String(fd.get('description')).trim(), hidden: false, notfall: fd.get('notfall') === 'on' });
    await saveConfig();
    toast(`„${name}“ angelegt`);
    return renderSkills();
  },
});

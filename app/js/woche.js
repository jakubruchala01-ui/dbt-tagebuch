// Startseite „Woche“, Lücken, „Für die nächste Stunde merken“ und Verlauf.
import * as db from './db.js';
import { newId, todayISO, shiftDate, formatDate, hasValue, istMinuten, dauerText } from './model.js';
import { kategorie } from './defaults.js';
import { esc, datumKurz, groupBy, toast, wochenbeginn, WOCHENTAGE, WT_KURZ, wochentag, openModal, closeModal, icon } from './ui.js';
import { uebungenListe } from './uebungen.js';
import { $main, E, state, saveConfig, ton, nav, aufKlick } from './kern.js';
import { pdfVorschau } from './pdf.js';
import { exportieren } from './einstellungen.js';

const LUECKEN_GRUENDE = ['keine Kraft', 'vergessen', 'bewusst Pause', 'schlechte Phase', 'keine Zeit', 'anderes'];

// ---------- Für die nächste Stunde merken ----------
export function zeigeMerken() {
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
export function zeigeLueckenNotiz(tage) {
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
  // Problemverhalten und eigene Verhalten („Verhalten: …“): Ja bei „Gemacht?“ oder „Wie oft“ > 0
  return state.config.fields.some((f) => kategorie(f.group ?? '') === 'problem' && ((f.type === 'yesno' && !/skill_statt|gedacht/.test(f.id) && e?.values[f.id] === true) || (f.type === 'number' && /_oft$/.test(f.id) && e?.values[f.id] > 0)));
}

export async function renderWoche() {
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

// ---------- Verlauf ----------
export async function renderVerlauf() {
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
    if (istMinuten(f)) return `<td class="${gs}">${dauerText(v)}</td>`;
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

aufKlick({
  'w-nav': (el) => { state.wocheDatum = shiftDate(state.wocheDatum, +el.dataset.delta); return renderWoche(); },
  'w-heute': () => { state.wocheDatum = todayISO(); return renderWoche(); },
  'w-pdf': async () => {
    state.pdf.von = wochenbeginn(state.wocheDatum, E().wochenstart);
    state.pdf.bis = shiftDate(state.pdf.von, 6);
    await nav.zeige('pdf');
    return pdfVorschau();
  },
  'w-kette': () => nav.zeige('ketten'),
  'w-sichern': async () => { await exportieren(); toast('Sicherung gespeichert – am besten an einen zweiten Ort kopieren'); return renderWoche(); },
  'luecke-spaeter': async () => { E().lueckeAusgeblendet = todayISO(); await saveConfig(); return renderWoche(); },
  'w-sichern-spaeter': async () => { E().sicherungSpaeter = shiftDate(todayISO(), 7); await saveConfig(); toast('Ich erinnere dich in einer Woche'); return renderWoche(); },
  'w-skill': () => openModal(`<h2>${icon('atem', 20)} Skill üben</h2>
      <p class="meta">Geführt, Schritt für Schritt. Am Ende kannst du den Skill in die heutige Karte eintragen.</p>${uebungenListe()}`),
});

$main.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'verlaufTage') {
    state.verlaufTage = +t.value;
    return renderVerlauf();
  }
});

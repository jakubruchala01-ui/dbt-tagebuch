// PDF-Bericht: druckfertige Diary-Card (A4 quer), eine Woche pro Blatt, optional Vorwochen-Vergleich und Verhaltensketten.
// Wird als HTML erzeugt und über den Druckdialog des Browsers als PDF gespeichert.
import { hasValue, shiftDate, currentVersion, istMinuten, dauerText } from './model.js';
import { MODULE, KAT_HELL, MODUL_HELL, kategorie } from './defaults.js';
import { GLIED_ARTEN, ABSCHNITTE } from './ketten.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const zahl = (n, stellen = 1) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen });
const datum = (iso) => iso.split('-').reverse().join('.');

function teile(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { wt: WT[dt.getDay()], wtLang: WT_LANG[dt.getDay()], dm: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.` };
}

function tage(von, bis) {
  const out = [];
  for (let d = von; d <= bis && out.length < 400; d = shiftDate(d, 1)) out.push(d);
  return out;
}

function groupBy(list, keyFn) {
  const m = new Map();
  list.forEach((x) => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return [...m.entries()];
}

function zelle(f, v) {
  if (!hasValue(v)) return '<td class="leer"></td>';
  if (f.type === 'scale') {
    const i = Math.max(0, Math.min(1, (v - f.min) / (f.max - f.min || 1)));
    return `<td class="skala" style="--i:${(0.06 + i * 0.5).toFixed(2)}">${zahl(v)}</td>`;
  }
  if (f.type === 'yesno') return v ? '<td class="ja">Ja</td>' : '<td class="nein">Nein</td>';
  if (istMinuten(f)) return `<td class="zahl">${dauerText(v)}</td>`;
  if (f.type === 'number') return `<td class="zahl">${zahl(v, 2)}${f.unit ? `<small> ${esc(f.unit)}</small>` : ''}</td>`;
  if (f.type === 'auswahl') return `<td class="meds">${[].concat(v).map((x) => `<div>${esc(x)}</div>`).join('')}</td>`;
  if (f.type === 'meds') return `<td class="meds">${v.map((m) => `<div>${esc(m.name)}${hasValue(m.dose) ? ` <small>${zahl(m.dose, 3)} ${esc(m.unit)}</small>` : ''}</div>`).join('')}</td>`;
  return `<td>${esc(v)}</td>`;
}

function auswertung(f, werte, klasse = 'summe') {
  const w = werte.filter(hasValue);
  if (!w.length) return `<td class="${klasse} leer"></td>`;
  if (f.type === 'scale') return `<td class="${klasse}" title="Durchschnitt">Ø ${zahl(w.reduce((a, b) => a + b, 0) / w.length)}</td>`;
  if (f.type === 'yesno') return `<td class="${klasse}">${w.filter(Boolean).length}× Ja</td>`;
  if (istMinuten(f)) return `<td class="${klasse}" title="Summe">Σ ${dauerText(w.reduce((a, b) => a + b, 0))}</td>`;
  if (f.type === 'number') return `<td class="${klasse}" title="Summe">Σ ${zahl(w.reduce((a, b) => a + b, 0), 2)}${f.unit ? `<small> ${esc(f.unit)}</small>` : ''}</td>`;
  if (f.type === 'meds') return `<td class="${klasse}">${w.length} Tage</td>`;
  if (f.type === 'auswahl') {
    const zahl = {};
    w.flat().forEach((x) => { zahl[x] = (zahl[x] ?? 0) + 1; });
    const top = Object.entries(zahl).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return `<td class="${klasse}" style="font-size:7pt;line-height:1.25">${top.map(([x, n]) => `${esc(x)} ${n}×`).join('<br>')}</td>`;
  }
  return `<td class="${klasse}"></td>`;
}

function feldLabel(f) {
  let sub = f.hint;
  if (!sub && f.type === 'scale') sub = `${zahl(f.min)}–${zahl(f.max)}`;
  return `<th class="label"><span>${esc(f.name)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</th>`;
}

/**
 * @param {object} o  { config, entries, ketten, von, bis, name, leereWeglassen, mitSkills, mitTexten, mitVergleich, mitKetten }
 */
/** Tage ohne Karte, zu denen eine Lücken-Notiz existiert */
function lueckenZeile(woche, eintraege, luecken = {}) {
  const l = woche.map((d, k) => (!eintraege[k] && luecken[d] ? { d, ...luecken[d] } : null)).filter(Boolean);
  if (!l.length) return '';
  // Tage mit derselben Notiz zusammenfassen (z. B. „Mo 3.–Do 6.: krank“) statt denselben Satz mehrfach
  const gruppen = [];
  for (const x of l) {
    const text = [x.grund, x.text].filter(Boolean).join(': ');
    const g = gruppen.at(-1);
    if (g && g.text === text) g.tage.push(x.d); else gruppen.push({ text, tage: [x.d] });
  }
  const tagName = (d) => `${teile(d).wt} ${datum(d)}`;
  return `<div class="luecken"><b>Ohne Karte:</b> ${gruppen.map((g) => `${g.tage.length > 1 ? `${tagName(g.tage[0])} bis ${tagName(g.tage.at(-1))}` : tagName(g.tage[0])} – ${esc(g.text)}`).join(' · ')}</div>`;
}

export function berichtHTML(o) {
  const { config, entries, von, bis } = o;
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const alleTage = tage(von, bis);
  const imZeitraum = alleTage.map((d) => byDate.get(d)).filter(Boolean);
  const hatWert = (f) => imZeitraum.some((e) => hasValue(e.values[f.id]));
  const vgl = !!o.mitVergleich;

  let felder = config.fields.filter((f) => !f.hidden || hatWert(f));
  if (o.leereWeglassen) felder = felder.filter(hatWert);
  const tabFelder = felder.filter((f) => f.type !== 'text');
  const textFelder = o.mitTexten ? felder.filter((f) => f.type === 'text') : [];
  const gruppen = groupBy(tabFelder, (f) => f.group || 'Allgemein');

  const erstellt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const wochen = [];
  for (let i = 0; i < alleTage.length; i += 7) wochen.push(alleTage.slice(i, i + 7));

  const blaetter = wochen.map((woche, wi) => {
    const eintraege = woche.map((d) => byDate.get(d));
    const vorEintraege = woche.map((d) => byDate.get(shiftDate(d, -7)));
    const vorhanden = eintraege.filter(Boolean).length;
    const fertig = eintraege.filter((e) => e?.status === 'abgeschlossen').length;
    const spalten = woche.length + (vgl ? 3 : 2);

    const kopfzeile = `<tr><th class="ecke"></th>${woche.map((d, k) => {
      const t = teile(d);
      const e = eintraege[k];
      return `<th class="tag ${e ? '' : 'ohne'}"><b>${t.wt}</b><span>${t.dm}${e?.status === 'abgeschlossen' ? ' ✓' : ''}</span></th>`;
    }).join('')}<th class="summe">Woche</th>${vgl ? '<th class="summe vor">Vorwoche</th>' : ''}</tr>`;

    const feldZeilen = gruppen.map(([g, fs]) => `
      <tr class="gruppe"><th colspan="${spalten}" style="color:${KAT_HELL[kategorie(g)]};background:${KAT_HELL[kategorie(g)]}1A;border-left:3px solid ${KAT_HELL[kategorie(g)]}">${esc(g)}</th></tr>
      ${fs.map((f) => `<tr>${feldLabel(f)}${eintraege.map((e) => zelle(f, e?.values[f.id])).join('')}${auswertung(f, eintraege.map((e) => e?.values[f.id]))}${vgl ? auswertung(f, vorEintraege.map((e) => e?.values[f.id]), 'summe vor') : ''}</tr>`).join('')}`).join('');

    let skillZeilen = '';
    if (o.mitSkills) {
      const ids = new Set(eintraege.filter(Boolean).flatMap((e) => Object.keys(e.skills)));
      const skills = config.skills.filter((s) => ids.has(s.id));
      const anzahl = (e) => (e ? Object.keys(e.skills).length : 0);
      const tageMitSkills = (list) => list.filter((e) => anzahl(e)).length;
      skillZeilen = `<tr class="gruppe"><th colspan="${spalten}">DBT-Skills <small>✓ = angewendet, Zahl = Wirkung 0–5</small></th></tr>
        ${skills.map((s) => `<tr><th class="label"><span>${esc(s.name)}</span><small style="color:${MODUL_HELL[s.module] ?? 'inherit'};font-weight:600">● ${esc(MODULE[s.module] ?? '')}</small></th>
          ${eintraege.map((e) => { const u = e?.skills[s.id]; return u ? `<td class="skillzelle">✓${hasValue(u.rating) ? ` <small>${u.rating}</small>` : ''}</td>` : '<td class="leer"></td>'; }).join('')}
          <td class="summe">${eintraege.filter((e) => e?.skills[s.id]).length}×</td>${vgl ? `<td class="summe vor">${vorEintraege.filter((e) => e?.skills[s.id]).length}×</td>` : ''}</tr>`).join('')}
        <tr class="zusammen"><th class="label"><span>Skills pro Tag</span></th>${eintraege.map((e) => `<td class="${anzahl(e) ? 'skillzelle' : 'leer'}">${anzahl(e) || ''}</td>`).join('')}
          <td class="summe">${tageMitSkills(eintraege)} Tage</td>${vgl ? `<td class="summe vor">${tageMitSkills(vorEintraege)} Tage</td>` : ''}</tr>`;
    }

    const notizen = textFelder.length ? woche.map((d, k) => {
      const e = eintraege[k];
      const texte = textFelder.filter((f) => hasValue(e?.values[f.id]));
      if (!texte.length) return '';
      const t = teile(d);
      return `<div class="notiztag"><h4>${t.wtLang}, ${datum(d)}</h4>
        <dl>${texte.map((f) => `<dt>${esc(['Ereignisse', 'Notizen', 'Persönlich'].includes(f.group) ? f.name : `${f.group} · ${f.name}`)}</dt><dd>${esc(e.values[f.id]).replace(/\n/g, '<br>')}</dd>`).join('')}</dl></div>`;
    }).join('') : '';

    return `<section class="blatt">
      <div class="kopf">
        <div>
          <div class="marke">Diary Card</div>
          <div class="zeitraum">Woche vom ${datum(woche[0])} bis ${datum(woche[woche.length - 1])}</div>
        </div>
        <dl class="kopfmeta">
          <div><dt>Name</dt><dd>${esc(o.name) || '&nbsp;'}</dd></div>
          <div><dt>Erfasst</dt><dd>${vorhanden} von ${woche.length} Tagen</dd></div>
          <div><dt>Abgeschlossen</dt><dd>${fertig}</dd></div>
          <div><dt>Erstellt</dt><dd>${erstellt}</dd></div>
          ${wochen.length > 1 ? `<div><dt>Blatt</dt><dd>${wi + 1} / ${wochen.length}</dd></div>` : ''}
        </dl>
      </div>
      <table class="karte-tabelle ${vgl ? 'mit-vergleich' : ''}">
        <colgroup><col class="c-label">${woche.map(() => '<col class="c-tag">').join('')}<col class="c-summe">${vgl ? '<col class="c-summe">' : ''}</colgroup>
        <thead>${kopfzeile}</thead>
        <tbody>${feldZeilen}${skillZeilen}</tbody>
      </table>
      ${lueckenZeile(woche, eintraege, o.luecken)}
      ${notizen ? `<div class="notizen"><h3>Ereignisse &amp; Notizen</h3><div class="notizspalten">${notizen}</div></div>` : ''}
      <div class="fuss">Vertraulich – persönliche Gesundheitsdaten · Selbstbeobachtung, keine Diagnose · DBT-Tagebuch · Vorlage v${currentVersion(config).v}</div>
    </section>`;
  });

  if (o.mitStunde && ((o.stundenNotizen ?? []).length || (o.klaeren ?? []).length)) {
    blaetter.push(`<section class="blatt stunden-blatt">
      <div class="kopf"><div><div class="marke">Für die nächste Stunde</div>
        <div class="zeitraum">Themen und offene Fragen · Stand ${new Date().toLocaleDateString('de-DE')}</div></div>
        <dl class="kopfmeta"><div><dt>Name</dt><dd>${esc(o.name) || '&nbsp;'}</dd></div></dl></div>
      ${(o.stundenNotizen ?? []).length ? `<h3 class="stunde-h">Was ich ansprechen möchte</h3>
        <ol class="stunde-liste">${o.stundenNotizen.map((n) => `<li>${esc(n.text).replace(/\n/g, '<br>')}<small> · notiert am ${datum(n.datum)}</small></li>`).join('')}</ol>` : ''}
      ${(o.klaeren ?? []).length ? `<h3 class="stunde-h">Was bedeuten diese Punkte auf meiner Karte genau?</h3>
        <ul class="stunde-liste">${o.klaeren.map((k) => `<li><b>${esc(k.name)}</b>${k.notiz ? ` – meine Notiz: ${esc(k.notiz)}` : ''}</li>`).join('')}</ul>` : ''}
      <div class="fuss">Vertraulich – persönliche Gesundheitsdaten · DBT-Tagebuch</div>
    </section>`);
  }
  if (o.mitKetten) {
    const ketten = (o.ketten ?? []).filter((k) => k.date >= von && k.date <= bis).sort((a, b) => a.date.localeCompare(b.date));
    if (ketten.length) blaetter.push(kettenBlatt(ketten, config, o.name, von, bis));
  }
  return blaetter.join('');
}

function kettenBlatt(ketten, config, name, von, bis) {
  const skillName = (id) => config.skills.find((s) => s.id === id)?.name ?? '';
  const text = (s) => esc(s).replace(/\n/g, '<br>');
  return `<section class="blatt ketten-blatt">
    <div class="kopf">
      <div>
        <div class="marke">Verhaltensketten</div>
        <div class="zeitraum">${datum(von)} bis ${datum(bis)} · ${ketten.length} Analyse${ketten.length > 1 ? 'n' : ''}</div>
      </div>
      <dl class="kopfmeta"><div><dt>Name</dt><dd>${esc(name) || '&nbsp;'}</dd></div></dl>
    </div>
    ${ketten.map((k) => {
      const t = teile(k.date);
      const abschnitte = ABSCHNITTE.filter(([key]) => k[key]?.trim());
      const vor = abschnitte.filter(([key]) => ['problem', 'ausloeser', 'verletzlichkeit'].includes(key));
      const nach = abschnitte.filter(([key]) => !['problem', 'ausloeser', 'verletzlichkeit'].includes(key));
      return `<article class="kette">
        <h3>${esc(k.titel || k.problem || 'Verhaltenskette')} <small>${t.wtLang}, ${datum(k.date)} · ${k.status === 'fertig' ? 'abgeschlossen' : 'Entwurf'}</small></h3>
        ${vor.length ? `<div class="kette-raster">${vor.map(([key, titel]) => `<div class="k-feld"><h4>${titel}</h4><p>${text(k[key])}</p></div>`).join('')}</div>` : ''}
        ${k.glieder?.length ? `<h4 class="k-unter">Kettenglieder</h4>
          <ol class="k-glieder">${k.glieder.map((g) => `<li><span class="k-art">${GLIED_ARTEN[g.art] ?? esc(g.art)}</span><span>${text(g.text)}</span></li>`).join('')}</ol>` : ''}
        <div class="kette-raster">
          ${nach.map(([key, titel]) => `<div class="k-feld"><h4>${titel}</h4><p>${text(k[key])}</p></div>`).join('')}
          ${k.skills?.length ? `<div class="k-feld"><h4>Hilfreiche Skills</h4><p>${k.skills.map((id) => esc(skillName(id))).filter(Boolean).join(' · ')}</p></div>` : ''}
        </div>
      </article>`;
    }).join('')}
    <div class="fuss">Vertraulich – persönliche Gesundheitsdaten · Selbstbeobachtung, keine Diagnose · DBT-Tagebuch</div>
  </section>`;
}

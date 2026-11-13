// Verhaltensketten (Kettenanalyse) als Schritt-für-Schritt-Assistent.
// Speichert automatisch – man kann jederzeit aufhören und später weitermachen.
import * as db from './db.js';
import { clone, newId, todayISO, formatDate } from './model.js';
import { MODULE } from './defaults.js';
import { esc, groupBy, toast, icon } from './ui.js';

export const GLIED_ARTEN = {
  ereignis: 'Ereignis',
  gedanke: 'Gedanke',
  gefuehl: 'Gefühl',
  koerper: 'Körper',
  drang: 'Drang',
  handlung: 'Handlung',
};

// Textabschnitte in der Reihenfolge der Analyse (auch vom PDF genutzt)
export const ABSCHNITTE = [
  ['problem', 'Problemverhalten', 'Was genau habe ich getan (oder gelassen)? So konkret wie möglich.'],
  ['ausloeser', 'Auslösendes Ereignis', 'Was ist direkt davor passiert? Wann, wo, mit wem?'],
  ['verletzlichkeit', 'Verletzlichkeitsfaktoren', 'Was hat mich anfälliger gemacht? z. B. wenig Schlaf, Krankheit, Stress, Hunger, Substanzen'],
  ['folgenKurz', 'Folgen – kurzfristig', 'Was ist direkt danach passiert, bei mir und bei anderen?'],
  ['folgenLang', 'Folgen – langfristig', 'Was hat es später bewirkt?'],
  ['loesung', 'Lösungsanalyse', 'An welcher Stelle der Kette hätte ich anders handeln können? Wie?'],
  ['vorbeugung', 'Vorbeugung', 'Wie kann ich die Verletzlichkeit beim nächsten Mal verringern?'],
  ['wiedergutmachung', 'Wiedergutmachung', 'Muss ich etwas wiedergutmachen? Wie?'],
];
const A = Object.fromEntries(ABSCHNITTE.map(([k, t, h]) => [k, { titel: t, hint: h }]));

// Die Schritte des Assistenten
const SCHRITTE = [
  { titel: 'Was ist passiert?', felder: ['problem'], ueberblick: true },
  { titel: 'Was war direkt davor?', felder: ['ausloeser'] },
  { titel: 'Was hat mich anfälliger gemacht?', felder: ['verletzlichkeit'] },
  { titel: 'Die Kette: Schritt für Schritt', glieder: true },
  { titel: 'Was hat es bewirkt?', felder: ['folgenKurz', 'folgenLang'] },
  { titel: 'Wo hätte ich anders handeln können?', felder: ['loesung'], skills: true },
  { titel: 'Vorbeugen und abschließen', felder: ['vorbeugung', 'wiedergutmachung'], abschluss: true },
];

const leer = (date) => ({
  id: newId('k'), date, titel: '', status: 'entwurf', archiviert: false,
  problem: '', ausloeser: '', verletzlichkeit: '', glieder: [],
  folgenKurz: '', folgenLang: '', loesung: '', skills: [], vorbeugung: '', wiedergutmachung: '',
});

const hatInhalt = (k) => !!(k.titel.trim() || ABSCHNITTE.some(([key]) => k[key]?.trim()) || k.glieder.some((g) => g.text.trim()));

export function kettenModul({ $main, state }) {
  let kette = null;        // Arbeitskopie im Editor
  let dirty = false;
  let schrittNr = 0;
  let zeigeArchiv = false;
  let timer = null;

  const isDirty = () => !!kette && dirty;

  // ----- Speichern -----
  async function speichernJetzt() {
    clearTimeout(timer);
    timer = null;
    if (!kette || !dirty) return;
    dirty = false;
    if (!hatInhalt(kette) && !kette.createdAt) return; // leere Kette nicht anlegen
    const now = new Date().toISOString();
    kette.createdAt ??= now;
    kette.updatedAt = now;
    const k = clone(kette);
    k.glieder = k.glieder.filter((g) => g.text.trim());
    await db.putKette(k);
    const el = document.getElementById('speicherstatus');
    if (el) el.innerHTML = `${icon('check', 14)}gespeichert ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  function geaendert() {
    dirty = true;
    const el = document.getElementById('speicherstatus');
    if (el) el.textContent = 'speichert …';
    clearTimeout(timer);
    timer = setTimeout(speichernJetzt, 800);
  }

  // ----- Liste -----
  async function render() {
    if (kette) return renderEditor();
    const alle = (await db.getAllKetten()).sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    const liste = alle.filter((k) => zeigeArchiv || !k.archiviert);
    $main.innerHTML = `
      <div class="karte">
        <h2>Verhaltensketten</h2>
        <p class="meta">Eine Kettenanalyse zerlegt ein Problemverhalten in kleine Schritte: Was war davor, was danach – und wo hätte ein Skill gepasst?
        Du gehst Schritt für Schritt durch und kannst jederzeit aufhören. Alles wird automatisch gespeichert.</p>
        <div class="actions"><button class="primary" data-act="k-neu">${icon('plus', 18)} Neue Verhaltenskette</button></div>
      </div>
      ${liste.length ? liste.map((k) => `
        <button class="listeneintrag ${k.archiviert ? 'aus' : ''}" data-act="k-oeffnen" data-id="${k.id}">
          <span class="tagbadge ${k.status === 'fertig' ? 'fertig' : 'entwurf'}">${k.status === 'fertig' ? icon('check', 18) : icon('ketten', 18)}</span>
          <span class="li-text"><b>${esc(k.titel || k.problem || 'Ohne Titel')}</b>
            <small>${formatDate(k.date)} · ${k.status === 'fertig' ? 'abgeschlossen' : 'Entwurf'}${k.archiviert ? ' · archiviert' : ''}</small></span>
          <span class="pfeil">${icon('rechts')}</span>
        </button>`).join('') : '<p class="meta">Noch keine Verhaltenskette.</p>'}
      ${alle.some((k) => k.archiviert) ? `<p><label class="check"><input type="checkbox" data-k-archiv ${zeigeArchiv ? 'checked' : ''}> Archivierte anzeigen</label></p>` : ''}`;
  }

  // ----- Assistent -----
  function feldHtml(key) {
    return `<label class="field"><span class="fname">${A[key].titel}</span><span class="hint">${A[key].hint}</span>
      <textarea rows="4" data-k="${key}">${esc(kette[key])}</textarea></label>`;
  }

  function vorschau() {
    const teile = kette.glieder.filter((g) => g.text.trim());
    if (!teile.length && !kette.ausloeser && !kette.problem) return '';
    const chip = (t, art) => `<span class="glied-chip" title="${esc(t)}">${art ? `<b>${art}:</b> ` : ''}${esc(t.length > 28 ? `${t.slice(0, 28)}…` : t)}</span>`;
    return `<div class="kette-vorschau" aria-label="Kette im Überblick">
      ${kette.ausloeser ? chip(kette.ausloeser, 'Auslöser') : ''}
      ${teile.map((g) => `<span class="verbinder">${icon('rechts', 14)}</span>${chip(g.text, GLIED_ARTEN[g.art])}`).join('')}
      ${kette.problem ? `<span class="verbinder">${icon('rechts', 14)}</span>${chip(kette.problem, 'Verhalten')}` : ''}
    </div>`;
  }

  function renderEditor() {
    const k = kette;
    const s = SCHRITTE[schrittNr];
    const skills = state.config.skills.filter((x) => !x.hidden || k.skills.includes(x.id));
    let inhalt = '';
    if (s.ueberblick) {
      inhalt += `<label class="field"><span class="fname">Titel</span><span class="hint">Kurz, damit du sie wiederfindest</span>
          <input data-k="titel" value="${esc(k.titel)}" placeholder="z. B. Streit am Abend"></label>
        <label class="field"><span class="fname">Datum</span><input type="date" data-k="date" value="${k.date}" max="${todayISO()}"></label>`;
    }
    inhalt += (s.felder ?? []).map(feldHtml).join('');
    if (s.glieder) {
      inhalt += `<p class="hint">Vom Auslöser bis zum Verhalten in kleinen Schritten: Gedanken, Gefühle, Körperempfindungen, Dränge, Handlungen.</p>
        <ol class="glieder">${k.glieder.map((g, i) => `
          <li class="glied" data-i="${i}">
            <select data-g="art" aria-label="Art von Schritt ${i + 1}">${Object.entries(GLIED_ARTEN).map(([a, t]) => `<option value="${a}" ${g.art === a ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <textarea data-g="text" rows="2" aria-label="Schritt ${i + 1}">${esc(g.text)}</textarea>
            <span class="glied-knoepfe">
              <button type="button" data-act="k-glied-move" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Schritt ${i + 1} nach oben">${icon('hoch', 18)}</button>
              <button type="button" data-act="k-glied-move" data-delta="1" ${i === k.glieder.length - 1 ? 'disabled' : ''} aria-label="Schritt ${i + 1} nach unten">${icon('runter', 18)}</button>
              <button type="button" class="clear" data-act="k-glied-weg" aria-label="Schritt ${i + 1} entfernen">${icon('x', 18)}</button>
            </span>
          </li>`).join('')}</ol>
        <button type="button" class="plus" data-act="k-glied-neu" title="Schritt hinzufügen" aria-label="Schritt hinzufügen">${icon('plus', 20)}</button>
        ${vorschau()}`;
    }
    if (s.skills) {
      inhalt += `<div class="field"><span class="fname">Hilfreiche Skills</span><span class="hint">Welche Skills hätten an welcher Stelle helfen können – oder haben geholfen?</span>
        ${groupBy(skills, (x) => x.module).map(([m, list]) => `
          <details ${list.some((x) => k.skills.includes(x.id)) ? 'open' : ''}><summary>${esc(MODULE[m] ?? m)}</summary>
            ${list.map((x) => `<label class="skill"><span><input type="checkbox" data-k-skill="${x.id}" ${k.skills.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</span></label>`).join('')}
          </details>`).join('')}</div>`;
    }
    const letzter = schrittNr === SCHRITTE.length - 1;
    $main.innerHTML = `
      <div class="toolbar"><button data-act="k-zurueck" class="ghost">${icon('links', 18)} Alle Ketten</button>
        <span class="meta">${k.status === 'fertig' ? 'abgeschlossen' : 'Entwurf · speichert automatisch'}</span></div>
      <div class="karte">
        <div class="schritte" role="navigation" aria-label="Schritte">${SCHRITTE.map((x, i) => `<button type="button" data-act="k-schritt" data-nr="${i}"
          class="${i === schrittNr ? 'aktiv' : i < schrittNr ? 'erledigt' : ''}" aria-label="Schritt ${i + 1}: ${x.titel}" ${i === schrittNr ? 'aria-current="step"' : ''}></button>`).join('')}</div>
        <p class="meta">Schritt ${schrittNr + 1} von ${SCHRITTE.length}</p>
        <h2 class="schritt-titel">${s.titel}</h2>
        <form id="kette" autocomplete="off">${inhalt}</form>
      </div>
      <div class="actions sticky schritt-nav">
        <button type="button" class="ghost" data-act="k-schritt" data-nr="${schrittNr - 1}" ${schrittNr === 0 ? 'disabled' : ''}>${icon('links', 18)} Zurück</button>
        ${letzter
          ? `<span>${k.updatedAt || hatInhalt(k) ? `<button type="button" class="ghost" data-act="k-archiv">${k.archiviert ? 'Aus Archiv holen' : 'Archivieren'}</button>` : ''}
             <button type="button" class="primary" data-act="k-fertig">${icon('check', 18)} ${k.status === 'fertig' ? 'Fertig' : 'Kette abschließen'}</button></span>`
          : `<button type="button" class="primary" data-act="k-schritt" data-nr="${schrittNr + 1}">Weiter ${icon('rechts', 18)}</button>`}
      </div>`;
  }

  async function zurListe() {
    await speichernJetzt();
    kette = null;
    dirty = false;
    return render();
  }

  // ----- Ereignisse (nur aktiv, wenn die Ansicht „ketten“ ist) -----
  $main.addEventListener('click', async (e) => {
    if (state.view !== 'ketten') return;
    const el = e.target.closest('[data-act^="k-"]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'k-neu') { kette = leer(todayISO()); dirty = false; schrittNr = 0; return renderEditor(); }
    if (act === 'k-oeffnen') {
      kette = clone((await db.getAllKetten()).find((x) => x.id === el.dataset.id));
      dirty = false;
      schrittNr = 0;
      return renderEditor();
    }
    if (act === 'k-zurueck') return zurListe();
    if (act === 'k-schritt') {
      await speichernJetzt();
      schrittNr = Math.max(0, Math.min(SCHRITTE.length - 1, +el.dataset.nr));
      renderEditor();
      window.scrollTo(0, 0);
      return;
    }
    if (act === 'k-fertig') {
      kette.status = 'fertig';
      dirty = true;
      await speichernJetzt();
      toast('Verhaltenskette abgeschlossen ✓');
      return zurListe();
    }
    if (act === 'k-glied-neu') {
      const letzte = kette.glieder.at(-1)?.art;
      kette.glieder.push({ art: letzte === 'gedanke' ? 'gefuehl' : 'gedanke', text: '' });
      geaendert();
      renderEditor();
      $main.querySelector('.glied:last-child textarea')?.focus();
      return;
    }
    const i = +el.closest('.glied')?.dataset.i;
    if (act === 'k-glied-weg') { kette.glieder.splice(i, 1); geaendert(); return renderEditor(); }
    if (act === 'k-glied-move') {
      const j = i + +el.dataset.delta;
      [kette.glieder[i], kette.glieder[j]] = [kette.glieder[j], kette.glieder[i]];
      geaendert();
      return renderEditor();
    }
    if (act === 'k-archiv') {
      kette.archiviert = !kette.archiviert;
      dirty = true;
      toast(kette.archiviert ? 'Archiviert' : 'Aus dem Archiv geholt');
      return zurListe();
    }
  });

  $main.addEventListener('input', (e) => {
    if (state.view !== 'ketten' || !kette) return;
    const t = e.target;
    if (t.dataset.k) { kette[t.dataset.k] = t.value; geaendert(); }
    if (t.dataset.g) { kette.glieder[+t.closest('.glied').dataset.i][t.dataset.g] = t.value; geaendert(); }
  });

  $main.addEventListener('change', (e) => {
    if (state.view !== 'ketten') return;
    const t = e.target;
    if (t.hasAttribute('data-k-archiv')) { zeigeArchiv = t.checked; return render(); }
    if (t.dataset.kSkill && kette) {
      const id = t.dataset.kSkill;
      kette.skills = t.checked ? [...new Set([...kette.skills, id])] : kette.skills.filter((x) => x !== id);
      geaendert();
    }
    if (t.dataset.g === 'art' && kette) {
      const box = $main.querySelector('.kette-vorschau');
      if (box) box.outerHTML = vorschau();
    }
  });

  $main.addEventListener('submit', (e) => {
    if (state.view !== 'ketten' || e.target.id !== 'kette') return;
    e.preventDefault();
    speichernJetzt();
  });

  return {
    render,
    isDirty,
    speichernJetzt,
    zurListe() { clearTimeout(timer); kette = null; dirty = false; },
    /** Neue Kette für ein Datum anlegen und Assistent öffnen */
    neuFuer(date) { kette = leer(date); dirty = false; schrittNr = 0; },
    oeffne(k) { kette = clone(k); dirty = false; schrittNr = 0; },
  };
}

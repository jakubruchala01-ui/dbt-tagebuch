// Geführte Skill-Übungen: ein Schritt pro Bildschirm, große Schrift, offline.
// Nach der Übung kann man sie als genutzten Skill (mit Wirkung) in die heutige Karte eintragen.
import { esc, icon, openModal, closeModal } from './ui.js';

export const UEBUNGEN = [
  {
    id: 'atmen', farbe: 'kat-befinden', name: 'Ruhig atmen', kurz: '2 Minuten, länger aus- als einatmen', skill: 's_tipp', atmen: true,
    schritte: [
      'Setz dich bequem hin oder bleib stehen. Lass die Schultern sinken.',
      'Atme mit dem Kreis: einatmen, solange er wächst – ausatmen, solange er kleiner wird. Das Ausatmen ist länger, das beruhigt den Körper.',
    ],
  },
  {
    id: 'erdung', farbe: 'kat-aktiv', name: '5-4-3-2-1 Erdung', kurz: 'Mit den Sinnen zurück ins Hier und Jetzt', skill: 's_selbstberuhigung',
    schritte: [
      'Schau dich um. Nenne leise <b>5 Dinge, die du siehst</b>.',
      'Nenne <b>4 Dinge, die du spürst</b> – z. B. Füße auf dem Boden, Stoff auf der Haut.',
      'Nenne <b>3 Dinge, die du hörst</b>.',
      'Nenne <b>2 Dinge, die du riechst</b> – oder zwei Gerüche, die du magst.',
      'Nenne <b>1 Sache, die du schmeckst</b> – oder nimm einen Schluck Wasser.',
      'Du bist hier, jetzt, an diesem Ort. Wie ist die Anspannung gerade?',
    ],
  },
  {
    id: 'tipp', farbe: 'kat-ereignisse', name: 'TIPP bei hoher Anspannung', kurz: 'Kälte, Bewegung, Atmung, Entspannung', skill: 's_tipp',
    schritte: [
      '<b>Vorsicht:</b> Bei Herzproblemen, niedrigem Puls, Betablockern oder Essstörung Kälte und starke Bewegung vorher mit Ärztin oder Arzt absprechen.<br><br><b>T – Temperatur:</b> Kaltes Wasser ins Gesicht oder einen Kühlakku auf Augen und Wangen, etwa 30 Sekunden. Halte dabei kurz die Luft an.',
      '<b>I – Intensive Bewegung:</b> Ein paar Minuten zügig gehen, Treppen steigen, Hampelmänner – so, dass du außer Atem kommst.',
      '<b>P – Paced Breathing:</b> Langsam atmen, länger aus als ein (z. B. 4 Sekunden ein, 6 Sekunden aus).',
      '<b>P – Progressive Muskelentspannung:</b> Hände zu Fäusten ballen, 5 Sekunden halten, loslassen. Dann Schultern hochziehen, halten, fallen lassen.',
    ],
    timer: [30, 120, 60, 60],
  },
  {
    id: 'sinne', farbe: 'kat-problem', name: 'Starker Sinnesreiz', kurz: 'Notfallkoffer: Kälte, Schärfe, Druck', skill: 's_sinnesreize',
    schritte: [
      'Such dir einen starken, ungefährlichen Reiz aus deinem Notfallkoffer: Eiswürfel in der Hand, Chili oder saures Bonbon, Igelball fest drücken, Ammoniak-Riechfläschchen.',
      'Konzentriere dich ganz auf den Reiz – wie fühlt er sich an, wie verändert er sich?',
      'Bleib dabei, bis die Anspannung etwas sinkt. Dann such dir den nächsten kleinen Schritt.',
    ],
    timer: [0, 60, 0],
  },
  {
    id: 'stop', farbe: 'modul-achtsamkeit', name: 'STOP', kurz: 'Erst anhalten, dann handeln', skill: 's_stop',
    schritte: [
      '<b>S – Stopp.</b> Halte inne. Beweg dich nicht, sag noch nichts.',
      '<b>T – Tritt einen Schritt zurück.</b> Atme einmal tief durch. Du musst jetzt nichts entscheiden.',
      '<b>O – Beobachte.</b> Was passiert in dir und um dich herum? Was fühlst du, was denkst du?',
      '<b>P – Plane achtsam weiter.</b> Was hilft dir und deinem Ziel jetzt wirklich?',
    ],
  },
];

/**
 * Übung anzeigen. onFertig(uebung, wirkung|null) wird aufgerufen, wenn man sie eintragen möchte.
 */
export function starteUebung(id, { onFertig } = {}) {
  const u = UEBUNGEN.find((x) => x.id === id);
  if (!u) return;
  let nr = 0;
  let atemTimer = null;
  let countdown = null;
  const stopTimer = () => { clearInterval(atemTimer); clearInterval(countdown); atemTimer = null; countdown = null; };

  const box = openModal('<div class="uebung" id="uebung"></div>', { klasse: `uebung-box ${u.farbe ?? ''}`, onClose: stopTimer });
  const ziel = box.querySelector('#uebung');

  function zeigeSchritt() {
    stopTimer();
    const letzter = nr >= u.schritte.length;
    if (letzter) return zeigeEnde();
    const sek = u.timer?.[nr] ?? 0;
    ziel.innerHTML = `
      <p class="meta">${esc(u.name)} · Schritt ${nr + 1} von ${u.schritte.length}</p>
      <p class="uebung-text">${u.schritte[nr]}</p>
      ${u.atmen && nr === 1 ? '<div class="atemkreis-rahmen"><div class="atemkreis" id="atemkreis"></div><p class="atem-wort" id="atem-wort" aria-live="polite">bereit</p></div>' : ''}
      ${sek ? `<button class="ghost" id="timer-start">${icon('wolke', 18)} ${sek} Sekunden Timer</button><p class="timer-anzeige" id="timer-anzeige" aria-live="polite"></p>` : ''}
      <div class="actions dialog-knoepfe">
        ${nr > 0 ? `<button class="ghost" id="zurueck">${icon('links', 18)} Zurück</button>` : ''}
        <button class="primary" id="weiter">${nr === u.schritte.length - 1 ? 'Fertig' : 'Weiter'} ${icon('rechts', 18)}</button>
      </div>`;
    ziel.querySelector('#weiter').onclick = () => { nr += 1; zeigeSchritt(); };
    ziel.querySelector('#zurueck')?.addEventListener('click', () => { nr -= 1; zeigeSchritt(); });
    ziel.querySelector('#timer-start')?.addEventListener('click', (e) => {
      e.currentTarget.disabled = true;
      let rest = sek;
      const anzeige = ziel.querySelector('#timer-anzeige');
      anzeige.textContent = `${rest} s`;
      countdown = setInterval(() => {
        rest -= 1;
        anzeige.textContent = rest > 0 ? `${rest} s` : 'Geschafft.';
        if (rest <= 0) clearInterval(countdown);
      }, 1000);
    });
    if (u.atmen && nr === 1) startAtmen();
  }

  function startAtmen() {
    const kreis = ziel.querySelector('#atemkreis');
    const wort = ziel.querySelector('#atem-wort');
    const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let phase = 'aus';
    let runden = 0;
    const schritt = () => {
      phase = phase === 'ein' ? 'aus' : 'ein';
      if (phase === 'ein') runden += 1;
      const dauer = phase === 'ein' ? 4 : 6;
      wort.textContent = phase === 'ein' ? `einatmen … (${runden}/12)` : 'ausatmen …';
      if (!ruhig) {
        kreis.style.transitionDuration = `${dauer}s`;
        kreis.classList.toggle('gross', phase === 'ein');
      }
      if (runden > 12 && phase === 'ein') { stopTimer(); wort.textContent = 'Gut gemacht. Du kannst weiteratmen, solange du magst.'; return; }
      atemTimer = setTimeout(schritt, dauer * 1000);
    };
    // setTimeout-Kette statt Intervall (ein/aus unterschiedlich lang)
    atemTimer = setTimeout(schritt, 600);
    const alt = stopTimer;
    stopTimerRef = () => { clearTimeout(atemTimer); alt(); };
  }
  let stopTimerRef = null;

  function zeigeEnde() {
    stopTimerRef?.();
    ziel.innerHTML = `
      <p class="uebung-text">Du hast <b>${esc(u.name)}</b> geübt. Das zählt – egal, wie viel es gerade gebracht hat.</p>
      ${onFertig ? `<p>Wie sehr hat es geholfen? <span class="meta">(optional)</span></p>
      <div class="chips" id="wirkung">${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" data-w="${n}">${n}</button>`).join('')}</div>` : ''}
      <div class="actions dialog-knoepfe">
        <button class="ghost" id="nochmal">Noch einmal</button>
        ${onFertig ? '<button class="primary" id="eintragen">In heutige Karte eintragen</button>' : '<button class="primary" data-modal-zu>Schließen</button>'}
      </div>`;
    let wirkung = null;
    ziel.querySelectorAll('[data-w]').forEach((b) => {
      b.onclick = () => {
        wirkung = +b.dataset.w;
        ziel.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
      };
    });
    ziel.querySelector('#nochmal').onclick = () => { nr = 0; zeigeSchritt(); };
    ziel.querySelector('#eintragen')?.addEventListener('click', async () => {
      closeModal();
      await onFertig(u, wirkung);
    });
  }

  zeigeSchritt();
}

/** Liste der Übungen als Knöpfe (für ♥-Fenster und Startseite) */
export function uebungenListe() {
  return `<div class="uebungen-liste">${UEBUNGEN.map((u) => `
    <button type="button" class="listeneintrag ${u.farbe ?? ''}" data-uebung="${u.id}">
      <span class="tagbadge">${icon(u.atmen ? 'atem' : 'hand', 20)}</span>
      <span class="li-text"><b>${esc(u.name)}</b><small>${esc(u.kurz)}</small></span>
      <span class="pfeil">${icon('rechts')}</span></button>`).join('')}</div>`;
}

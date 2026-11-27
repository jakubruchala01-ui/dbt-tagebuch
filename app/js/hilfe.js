// Einführung beim ersten Start (Tour) und ?-Hilfe je Seite.
import { commitTemplate } from './model.js';
import { esc, toast, openModal, closeModal } from './ui.js';
import { E, state, saveConfig } from './kern.js';
import { presetFelder } from './vorlage.js';

/** Einführung beim ersten Start (4 Schritte, überspringbar). Sicherheit zuerst. */
export function zeigeHinweis() {
  // Wahl der Ausführlichkeit nur beim allerersten Start – später nie ungefragt die Karte umbauen
  const ersterStart = !E().hinweisGesehen;
  const schritte = [
    () => `<h2>Willkommen</h2>
      <p>Dieses Tagebuch hilft dir, dich selbst zu beobachten und deine Therapie vorzubereiten. Es stellt keine Diagnose und ersetzt keine Therapie.</p>
      <p><strong>In einer Krise</strong> oder wenn du daran denkst, dir etwas anzutun: Notruf <strong>112</strong> oder Telefonseelsorge <strong>0800 111 0 111</strong>
      (kostenlos, rund um die Uhr). Hilfe findest du jederzeit über das <strong>♥</strong> oben rechts.</p>`,
    () => `<h2>Deine Daten gehören dir</h2>
      <p><strong>Deine Einträge bleiben nur auf diesem Gerät.</strong> Niemand sonst kann sie sehen – auch nicht die Entwickler, die Klinik oder eine andere Stelle.
      Es gibt keine Kopie im Internet.</p>
      <p>Das heißt aber auch: Geht das Gerät verloren oder wird die App gelöscht, sind die Einträge weg.
      <strong>Sichere sie deshalb regelmäßig:</strong> Mehr → Einstellungen &amp; Daten → Sicherung.</p>`,
    () => `<h2>Wie ausführlich möchtest du deine Karte?</h2>
      <p class="meta">Tippe eine Möglichkeit an – danach geht es weiter. Später jederzeit änderbar (Mehr → Karte anpassen), es wird nichts gelöscht.</p>
      <div class="vorlage-presets tour-wahl">
        <button type="button" data-tour-preset="einfach"><b>Einfach</b><small>Befinden, Dränge, Medikamente, Notizen, Skills</small></button>
        <button type="button" data-tour-preset="standard"><b>Standard</b><small>wie die Papier-Diary-Card</small></button>
        <button type="button" data-tour-preset="alles"><b>Ausführlich</b><small>alles zeigen</small></button>
      </div>`,
  ].filter((_, k) => k !== 2 || ersterStart).concat([
    () => `<h2>So findest du dich zurecht</h2>
      <ul class="tour-liste">
        <li><b>Woche</b> – dein Überblick. Die <b>Schnell-Karte</b> dauert etwa 30 Sekunden.</li>
        <li><b>Karte</b> – der ganze Tag, wenn du mehr Zeit hast. Alles speichert sich von selbst.</li>
        <li><b>?</b> oben – erklärt die Seite, auf der du gerade bist.</li>
        <li><b>♥</b> oben – Hilfe in der Krise, immer erreichbar.</li>
      </ul>`,
  ]);
  let i = 0;
  return new Promise((resolve) => {
    const fertig = async () => {
      E().hinweisGesehen = true;
      await saveConfig();
      closeModal();
      resolve();
    };
    const zeigen = () => {
      const letzter = i === schritte.length - 1;
      const box = openModal(`${schritte[i]()}
        <div class="tour-punkte" aria-hidden="true">${schritte.map((_, k) => `<span class="${k === i ? 'an' : ''}"></span>`).join('')}</div>
        <div class="actions dialog-knoepfe">
          ${letzter ? '' : '<button class="ghost" id="tour-skip">Überspringen</button>'}
          ${i > 0 ? '<button class="ghost" id="tour-zurueck">Zurück</button>' : ''}
          <button class="primary" id="tour-weiter">${letzter ? 'Los geht’s' : 'Weiter'}</button>
        </div>`, { schliessbar: false, klasse: 'tour' });
      box.querySelector('#tour-skip')?.addEventListener('click', fertig);
      box.querySelector('#tour-zurueck')?.addEventListener('click', () => { i -= 1; zeigen(); });
      box.querySelector('#tour-weiter').addEventListener('click', () => { if (letzter) fertig(); else { i += 1; zeigen(); } });
      let gewaehlt = false;
      box.querySelectorAll('[data-tour-preset]').forEach((b) => b.addEventListener('click', async () => {
        if (gewaehlt) return; // Doppelklick
        gewaehlt = true;
        const neu = presetFelder(b.dataset.tourPreset, state.config.fields);
        if (commitTemplate(state.config, neu)) await saveConfig();
        toast(`„${b.querySelector('b').textContent}“ gewählt`);
        i = Math.min(i + 1, schritte.length - 1);
        zeigen();
      }));
    };
    zeigen();
  });
}

// ---------- ?-Hilfe je Seite ----------
const HILFE = {
  woche: ['Deine Woche', 'Hier siehst du auf einen Blick, an welchen Tagen du eine Karte ausgefüllt hast. Tippe auf einen Tag, um ihn zu öffnen oder nachzutragen.',
    'Die Kacheln zeigen, wie es dir im Schnitt ging. Lücken sind okay – du kannst jederzeit weitermachen.'],
  heute: ['Deine Tageskarte', 'Fülle aus, was heute wichtig war. Nichts ist Pflicht – „Offen“ heißt einfach: noch kein Wert.',
    'Die Zahlen 0–5 bedeuten von „gar nicht“ bis „sehr stark“; bei Drängen und Skills steht ein Wort dabei. Mit − und + oder dem Balken stellst du den Wert ein.',
    'Bei „Dränge & Verhalten“ tippst du nur an, was heute da war. Bei Skills tippst du die genutzten an und wählst darunter, wie gut sie geholfen haben.',
    'Alles speichert sich von selbst. Wenig Zeit? Die Schnell-Karte auf der Startseite dauert etwa 30 Sekunden.'],
  ketten: ['Verhaltensketten', 'Eine Kette hilft zu verstehen, wie es zu einem Problemverhalten kam: Auslöser, Gedanken, Gefühle, Handlung, Folgen.',
    'Du musst nicht alles auf einmal ausfüllen. Besprich die Kette am besten in deiner nächsten Stunde.'],
  verlauf: ['Verlauf', 'Alle Karten als Tabelle. So siehst du, wie sich Werte über Wochen verändern. Ändern kannst du hier nichts – dafür den Tag in der Karte öffnen.'],
  pdf: ['Bericht', 'Erstellt eine übersichtliche Diary Card für deine Therapiestunde. Wähle den Zeitraum und was hinein soll.',
    'Zeige den Bericht in der Stunde oder drucke ihn aus. Bitte nicht per Messenger, Mail oder Cloud verschicken – er enthält Gesundheitsdaten.'],
  mehr: ['Mehr', 'Hier findest du alles Weitere: Verlauf, Karte anpassen, Skills, Einstellungen und Datenschutz.'],
  vorlage: ['Karte anpassen', 'Hier legst du fest, was auf deiner Tageskarte steht. Am einfachsten: oben eine fertige Zusammenstellung wählen.',
    'Anpassen lohnt sich, wenn du etwas Bestimmtes beobachten willst – z. B. einen neuen Drang, den deine Therapeutin mit dir anschauen möchte.',
    'Nichts geht verloren: Ausgeblendetes verschwindet nur von der Karte, alte Einträge bleiben vollständig. Änderungen gelten nach „Speichern“.'],
  skills: ['Skills', 'Deine Liste der DBT-Skills. Ausgeblendete Skills erscheinen nicht mehr auf der Karte. Mit „Notfall“ markierte stehen im ♥-Fenster.'],
  daten: ['Einstellungen & Daten', 'Aussehen, Erinnerung, PIN, Notfallkontakte und deine Sicherung.',
    'Wichtig: Deine Einträge gibt es nur auf diesem Gerät. Exportiere regelmäßig eine Sicherung, sonst sind sie bei Verlust des Handys weg.'],
  datenschutz: ['Datenschutz', 'Hier steht ehrlich, was die App speichert, wo es liegt und was sie nicht tut.'],
};
export function zeigeHilfe() {
  const [titel, ...absaetze] = HILFE[state.view] ?? HILFE.woche;
  openModal(`<h2>${esc(titel)}</h2>${absaetze.map((a) => `<p>${esc(a)}</p>`).join('')}
    <p class="meta">In einer Krise: ♥ oben rechts. Einführung wiederholen: Mehr → Einstellungen &amp; Daten.</p>
    <div class="actions"><button class="primary" data-modal-zu>Okay</button></div>`, { klasse: 'hilfe' });
}

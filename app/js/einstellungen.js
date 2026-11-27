// Mehr, Datenschutz, Einstellungen & Daten (Aussehen, Tonfall, PIN, Sicherung) und Ergänzen älterer Konfigurationen.
import * as db from './db.js';
import { todayISO, currentVersion } from './model.js';
import { FELD_INFO } from './defaults.js';
import { esc, fmtTime, datumKurz, toast, WOCHENTAGE, frage, icon } from './ui.js';
import { pinHash, pinPruefen, pinGueltig } from './sicherheit.js';
import { HELL, NACHT, MODI, DESIGN_STANDARD, wendeDesignAn } from './design.js';
import { istNativ, dateiSpeichern, bildschirmSchutz } from './plattform.js';
import { $main, E, state, saveConfig, BEFINDEN_IDS, TONFAELLE, ton, aufKlick, aufSenden } from './kern.js';
import { erinnerungHtml, erinnerungenAktualisieren } from './erinnerung.js';
import { kontakteHtml } from './notfall.js';
import { zeigeHinweis } from './hilfe.js';
import { pdfWoche } from './pdf.js';

const EINSTELLUNGEN_STANDARD = { wochenstart: 1, pin: null, hinweisGesehen: false, notfallPlan: '', tonfall: 'klar', notfallKontakte: [], inhaltSchuetzen: true };

// ---------- Mehr ----------
export function renderMehr() {
  const punkt = (view, ic, titel, text) => `<button class="listeneintrag" data-act="goto" data-view="${view}">
    <span class="tagbadge">${icon(ic)}</span><span class="li-text"><b>${titel}</b><small>${text}</small></span><span class="pfeil">${icon('rechts')}</span></button>`;
  $main.innerHTML = `
    ${punkt('verlauf', 'verlauf', 'Verlauf', 'Alle Tage als Tabelle, Werte farblich nach Stärke')}
    ${punkt('vorlage', 'vorlage', 'Karte anpassen', `Was auf deiner Karte steht: Dränge, Felder, Kurzansicht · Version v${currentVersion(state.config).v}`)}
    ${punkt('skills', 'skills', 'Skills', 'DBT-Skills sammeln, eigene anlegen, ausblenden')}
    ${punkt('daten', 'einstellungen', 'Einstellungen &amp; Daten', `Aussehen (hell/dunkel, Farben), Therapietag (${WOCHENTAGE[E().wochenstart]}), PIN-Sperre ${E().pin ? 'an' : 'aus'}, Tonfall, Erinnerung, Notfallkontakte, Sicherung`)}
    ${punkt('datenschutz', 'schloss', 'Datenschutz', 'Was gespeichert wird, wo es liegt und wie du alles löschst')}
    <p class="hilfe">Dieses Tagebuch ist ein Werkzeug zur Selbstbeobachtung. Es ersetzt keine Therapie und keine ärztliche Hilfe.</p>`;
}

export function renderDatenschutz() {
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
      <p>Beim Drucken oder „Als PDF speichern“ verarbeitet der Druckdienst deines Geräts den Bericht. Wählst du beim Teilen eine andere App
      (z. B. Messenger, Cloud), gelten deren Regeln. Auch deine Tastatur-App sieht, was du tippst – nutze möglichst eine ohne Online-Funktionen.</p>

      <h3>Schutz vor neugierigen Blicken</h3>
      <p>Die PIN-Sperre schützt die Anzeige, verschlüsselt die Daten aber nicht. Wer dein Handy in der Hand hat, kann die PIN über „PIN vergessen?“ entfernen
      (damit du nie ausgesperrt bist) – sie hält also neugierige Blicke ab, ist aber kein Schutz vor jemandem, der gezielt sucht.
      Auf dem Sperrbildschirm ist die Krisenhilfe immer erreichbar; ob dort auch deine Kontakte und dein Notfallplan erscheinen, stellst du bei der PIN-Sperre ein. ${istNativ() ? 'Mit „Inhalt schützen“ (Einstellungen) ist der Inhalt in der App-Übersicht verborgen und Bildschirmfotos sind gesperrt.' : 'Schütze dein Gerät zusätzlich mit einer Bildschirmsperre.'}</p>

      <h3>Alles löschen</h3>
      <p>${loeschen} Vorher exportieren, wenn du die Daten behalten möchtest – sie sind sonst endgültig weg.</p>

      <h3>Kein Medizinprodukt</h3>
      <p>Das Tagebuch hilft dir, dich selbst zu beobachten und die Therapie vorzubereiten. Es stellt keine Diagnosen, gibt keine Behandlungsempfehlungen
      und ersetzt keine Therapie oder ärztliche Hilfe. In einer Krise: ♥ oben rechts, Notruf 112 oder Telefonseelsorge 0800 111 0 111.</p>
    </div>`;
}

// ---------- Einstellungen & Daten ----------
export async function renderDaten() {
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
      <h3 class="unterkopf">Ruhige Darstellung</h3>
      <label class="check"><input type="checkbox" id="design-ruhig" ${d.ruhig ? 'checked' : ''}> Ohne Farbverläufe und Bewegung</label>
      <p class="meta">Flache, ruhige Flächen – hilfreich, wenn Farben oder Bewegung gerade zu viel sind.</p>
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
      Schützt vor neugierigen Blicken – die Daten selbst sind <strong>nicht verschlüsselt</strong>.
      Über „PIN vergessen?“ lässt sie sich ohne PIN entfernen, damit du nie ausgesperrt bist.</p>
      <label class="check"><input type="checkbox" id="sperre-kontakte" ${E().sperreKontakte !== false ? 'checked' : ''}>
        Auf dem Sperrbildschirm unter „Hilfe in der Krise“ auch meine Kontakte und meinen Notfallplan zeigen</label>
      <p class="meta">Aus: Dort erscheinen nur 112, Telefonseelsorge und die Übungen.</p>
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
        <button class="ghost" data-act="hinweis-zeigen">Einführung erneut zeigen</button></div>
    </div>
    <div class="karte">
      <h2>Wo liegen meine Daten?</h2>
      <p>${istNativ() ? 'Nur hier in dieser App auf deinem Handy.' : `Nur hier im Browser auf diesem Gerät (IndexedDB, Adresse <code>${esc(location.origin)}</code>).`} Nichts wird ins Internet gesendet.</p>
      <p>${entries.length} Tageskarten · ${alleKetten.length} Verhaltensketten · ${state.config.skills.length} Skills · Vorlage v${currentVersion(state.config).v}</p>
      ${istNativ() ? '' : `<p>Dauerhafter Speicher: <strong>${persist ? 'ja' : 'nein'}</strong>
        ${persist ? '' : '<button data-act="persist" class="ghost">anfordern</button>'}
        <br><span class="meta">Verhindert, dass der Browser die Daten bei Platzmangel selbst löscht.</span></p>`}
    </div>
    <div class="karte">
      <h2>Sicherung</h2>
      <p>Export erzeugt eine JSON-Datei mit allem. <strong>Nicht verschlüsselt</strong> – sicher aufbewahren, am besten an einem zweiten Ort (z. B. USB-Stick).</p>
      <p class="meta">Letzte Sicherung: <strong>${E().letzteSicherung ? datumKurz(E().letzteSicherung) : 'noch keine'}</strong>. Die Startseite erinnert sanft, wenn die letzte Sicherung über 30 Tage her ist.</p>
      <p class="meta">Die Datei ist nicht verschlüsselt. Nicht per Messenger, Mail oder Cloud verschicken – am besten auf einem USB-Stick oder dem PC aufbewahren.</p>
      <div class="actions"><button data-act="export" class="primary">Exportieren</button></div>
      <h2>Import</h2>
      <p>Ersetzt alle Daten hier durch die Datei. ${istNativ() ? 'Vorher öffnet sich das Teilen-Menü, um die aktuellen Daten zu sichern.' : 'Vorher wird automatisch ein Export der aktuellen Daten heruntergeladen.'}</p>
      <input type="file" id="importfile" accept="application/json,.json">
    </div>`;
}

export async function exportieren(prefix = 'dbt-tagebuch-export') {
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

/**
 * Ergänzt fehlende Einstellungen mit Standardwerten – beim Start und nach dem Import älterer Sicherungen.
 * Bestehende eigene Werte werden nie überschrieben.
 */
export async function vervollstaendigeConfig() {
  state.config.einstellungen = { ...EINSTELLUNGEN_STANDARD, ...state.config.einstellungen };
  E().design = { ...DESIGN_STANDARD, ...E().design };
  state.config.skills ??= [];
  state.config.medikamente ??= [];
  state.config.stundenNotizen ??= [];
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
  }
  if (!state.config.feldInfoInit) {
    state.config.feldInfo ??= {};
    for (const [id, info] of Object.entries(FELD_INFO)) {
      if (!state.config.feldInfo[id] && state.config.fields.some((f) => f.id === id)) state.config.feldInfo[id] = { notiz: '', ...info };
    }
    state.config.feldInfoInit = true;
  }
  // Standard-Notfall-Skills einmalig markieren
  if (!state.config.notfallMarkiert) {
    state.config.skills.forEach((s) => { if (['s_stop', 's_tipp', 's_sinnesreize', 's_selbstberuhigung', 's_radikale_akzeptanz'].includes(s.id)) s.notfall = true; });
    state.config.notfallMarkiert = true;
  }
  await saveConfig();
}

aufKlick({
  tonfall: async (el) => {
    E().tonfall = el.dataset.wert;
    E().lueckeAusgeblendet = null;
    await saveConfig();
    $main.querySelectorAll('[data-act=tonfall]').forEach((b) => b.classList.toggle('on', b === el));
    erinnerungenAktualisieren();
    return toast(`Tonfall: ${TONFAELLE[el.dataset.wert].name}`);
  },
  design: async (el) => {
    E().design = { ...E().design, [el.dataset.key]: el.dataset.wert };
    // Wer ein Dunkel-Akzent wählt, will ihn sehen: Modus auf dunkel, falls gerade hell
    if (el.dataset.key === 'nacht' && document.documentElement.dataset.dunkel !== '1') E().design.modus = 'dunkel';
    if (el.dataset.key === 'thema' && document.documentElement.dataset.dunkel === '1') E().design.modus = 'hell';
    wendeDesignAn(E().design);
    await saveConfig();
    const y = window.scrollY;
    await renderDaten();
    window.scrollTo(0, y);
  },
  wochenstart: async (el) => {
    E().wochenstart = +el.dataset.wert;
    await saveConfig();
    pdfWoche(0);
    toast(`Woche beginnt jetzt am ${WOCHENTAGE[E().wochenstart]}`);
    return renderDaten();
  },
  'pin-aus': async () => {
    const alt = $main.querySelector('#pin-form [name=alt]').value;
    if (!(await pinPruefen(alt, E().pin))) return toast('Aktuelle PIN stimmt nicht');
    E().pin = null;
    await saveConfig();
    toast('PIN-Sperre ausgeschaltet');
    return renderDaten();
  },
  'hinweis-zeigen': () => zeigeHinweis(),
  export: () => exportieren(),
  persist: async () => {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'Dauerhafter Speicher aktiv' : 'Browser hat abgelehnt');
    return renderDaten();
  },
});

$main.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'inhalt-schuetzen') {
    E().inhaltSchuetzen = t.checked;
    await saveConfig();
    await bildschirmSchutz(t.checked);
    return toast(t.checked ? 'Inhalt geschützt – keine Bildschirmfotos' : 'Schutz aus – Bildschirmfotos möglich');
  }
  if (t.id === 'design-ruhig') {
    E().design = { ...E().design, ruhig: t.checked };
    wendeDesignAn(E().design);
    await saveConfig();
    return toast(t.checked ? 'Ruhige Darstellung an' : 'Ruhige Darstellung aus');
  }
  if (t.id === 'sperre-kontakte') {
    E().sperreKontakte = t.checked;
    await saveConfig();
    return toast(t.checked ? 'Kontakte auf dem Sperrbildschirm sichtbar' : 'Sperrbildschirm zeigt nur allgemeine Hilfe');
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
  if (t.id === 'importfile' && t.files[0]) return importieren(t.files[0]);
});

aufSenden({
  'pin-form': async (form) => {
    const fd = new FormData(form);
    const neu = String(fd.get('neu'));
    if (E().pin && !(await pinPruefen(String(fd.get('alt')), E().pin))) return toast('Aktuelle PIN stimmt nicht');
    if (!pinGueltig(neu)) return toast('PIN: 4 bis 8 Ziffern');
    if (neu !== String(fd.get('neu2'))) return toast('Die PINs stimmen nicht überein');
    E().pin = await pinHash(neu);
    await saveConfig();
    toast('PIN gespeichert');
    return renderDaten();
  },
});

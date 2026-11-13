// Plattform-Schicht: dieselbe App läuft im Browser (PWA) und als Android/iOS-App (Capacitor).
// Alles, was sich je nach Plattform unterscheidet, steht hier. Im Browser bleibt alles wie bisher.

const cap = () => window.Capacitor;
export const istNativ = () => !!cap()?.isNativePlatform?.();
export const plattform = () => (istNativ() ? cap().getPlatform() : 'web'); // 'android' | 'ios' | 'web'
const plugin = (name) => cap()?.Plugins?.[name];

// ---------- Dateien speichern / teilen ----------
/** Speichert Text als Datei: im Browser als Download, in der App über das Teilen-Menü (z. B. „In Dateien speichern“). */
export async function dateiSpeichern(name, text, mime = 'application/json') {
  if (istNativ() && plugin('Filesystem') && plugin('Share')) {
    const { uri } = await plugin('Filesystem').writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await plugin('Share').share({ title: name, files: [uri], dialogTitle: 'Sicherung speichern' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Drucken bzw. als PDF speichern. In der App gibt es (noch) keinen Druckdialog. */
export const kannDrucken = () => !istNativ();

// ---------- Erinnerungen ----------
export const ERINNERUNG_STANDARD = { an: false, start: '12:00', abstand: 60, ende: '21:00', tonfall: null };
export const ABSTAENDE = [[0, 'nur einmal'], [60, 'stündlich'], [120, 'alle 2 Stunden'], [180, 'alle 3 Stunden']];

const TEXTE = {
  sanft: ['Magst du heute deine Karte ausfüllen? Ein paar Werte reichen schon.', 'Deine Karte wartet noch auf dich – ganz ohne Druck.'],
  klar: ['Deine Diary Card für heute ist noch offen.', 'Noch offen: die Schnell-Karte dauert etwa 30 Sekunden.'],
  direkt: ['Diary Card noch offen – jetzt kurz ausfüllen.', 'Immer noch offen. Jetzt 30 Sekunden für die Schnell-Karte.'],
};

const zuMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Uhrzeiten (Minuten seit Mitternacht) aller Erinnerungen an einem Tag */
export function erinnerungsZeiten(e) {
  const s = zuMin(e.start);
  const ende = Math.max(s, zuMin(e.ende));
  if (!e.abstand) return [s];
  const z = [];
  for (let t = s; t <= ende && z.length < 16; t += e.abstand) z.push(t);
  return z;
}

export const erinnerungMoeglich = () => istNativ() && !!plugin('LocalNotifications');

/**
 * Plant die Erinnerungen der nächsten 7 Tage neu (nur in der App).
 * heuteErledigt: für heute nichts mehr planen. Die Mitteilung enthält nie Werte aus dem Tagebuch.
 */
export async function erinnerungenPlanen(e, tonfall, heuteErledigt) {
  const LN = plugin('LocalNotifications');
  if (!LN) return { ok: false, grund: 'web' };
  const offen = await LN.getPending();
  if (offen.notifications?.length) await LN.cancel({ notifications: offen.notifications.map((n) => ({ id: n.id })) });
  if (!e.an) return { ok: true, anzahl: 0 };
  let erlaubt = (await LN.checkPermissions()).display;
  if (erlaubt !== 'granted') erlaubt = (await LN.requestPermissions()).display;
  if (erlaubt !== 'granted') return { ok: false, grund: 'erlaubnis' };

  const texte = TEXTE[tonfall] ?? TEXTE.klar;
  const jetzt = new Date();
  const liste = [];
  for (let tag = 0; tag < 7; tag++) {
    if (tag === 0 && heuteErledigt) continue;
    erinnerungsZeiten(e).forEach((min, i) => {
      const at = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tag, Math.floor(min / 60), min % 60);
      if (at <= jetzt) return;
      liste.push({
        id: 1000 + tag * 20 + i,
        title: 'DBT-Tagebuch',
        body: texte[Math.min(i, 1)],
        schedule: { at, allowWhileIdle: true },
        extra: { ziel: 'heute' },
      });
    });
  }
  if (liste.length) await LN.schedule({ notifications: liste });
  return { ok: true, anzahl: liste.length };
}

/** Tippt man auf eine Mitteilung, öffnet sich die heutige Karte. */
export function beiMitteilungAntippen(fn) {
  plugin('LocalNotifications')?.addListener?.('localNotificationActionPerformed', () => fn());
}

/** App kommt wieder in den Vordergrund (nur App) */
export function beiRueckkehr(fn) {
  plugin('App')?.addListener?.('appStateChange', ({ isActive }) => { if (isActive) fn(); });
}

/**
 * Kalender-Datei (.ics) mit täglichem Termin und Weckzeiten – Ersatz für Erinnerungen im Browser.
 * Hinweis: Der Termin weiß nicht, ob die Karte schon ausgefüllt ist.
 */
export function kalenderDatei(e) {
  const zeiten = erinnerungsZeiten(e);
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const tag = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const hm = (min) => `${p(Math.floor(min / 60))}${p(min % 60)}00`;
  const ende = zeiten.at(-1) + 15;
  const alarme = zeiten.map((min) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Diary Card ausfüllen\r\nTRIGGER;RELATED=START:PT${min - zeiten[0]}M\r\nEND:VALARM`).join('\r\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DBT-Tagebuch//DE', 'BEGIN:VEVENT',
    `UID:dbt-tagebuch-erinnerung-${tag}@lokal`, `DTSTAMP:${tag}T000000`,
    `DTSTART:${tag}T${hm(zeiten[0])}`, `DTEND:${tag}T${hm(Math.min(ende, 23 * 60 + 59))}`,
    'RRULE:FREQ=DAILY', 'SUMMARY:Diary Card ausfüllen', 'DESCRIPTION:DBT-Tagebuch öffnen und die heutige Karte ausfüllen.',
    'TRANSP:TRANSPARENT', alarme, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// ---------- Bildschirmschutz ----------
/** In der App: Inhalt in der App-Übersicht verbergen und Bildschirmfotos sperren (falls Plugin vorhanden). */
export async function bildschirmSchutz(an) {
  const ps = plugin('PrivacyScreen');
  if (!ps) return;
  try { await (an ? ps.enable() : ps.disable()); } catch { /* Plugin nicht verfügbar */ }
}

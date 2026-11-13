// Farbthemen: hell (4 Themen) und dunkel (Dunkelgrau mit wählbarem Akzent).
// Wird früh im <head> geladen, damit beim Start nichts aufblitzt.

export const HELL = {
  salbei: { name: 'Salbei', farben: ['#F4F2EC', '#2E3532', '#4F7A6A', '#A85A40'], meta: '#4F7A6A' },
  bernstein: { name: 'Bernstein', farben: ['#F7F0E4', '#3A3129', '#A0612A', '#A04E3C'], meta: '#A0612A' },
  nebelblau: { name: 'Nebelblau', farben: ['#EEF2F5', '#26323D', '#3F6A8A', '#A65A4C'], meta: '#3F6A8A' },
  lavendel: { name: 'Lavendel', farben: ['#F3F1F6', '#2F2B38', '#6B5B95', '#A8566A'], meta: '#6B5B95' },
};

export const NACHT = {
  mint: { name: 'Mint', farbe: '#8FB8A8' },
  blau: { name: 'Blau', farbe: '#8DB0D8' },
  lavendel: { name: 'Lavendel', farbe: '#B2A5DC' },
  petrol: { name: 'Petrol', farbe: '#7FBCC4' },
  bernstein: { name: 'Bernstein', farbe: '#D6AC6E' },
  rose: { name: 'Rosé', farbe: '#DBA1B3' },
};

export const MODI = { auto: 'Automatisch', hell: 'Hell', dunkel: 'Dunkel' };
export const DESIGN_STANDARD = { modus: 'auto', thema: 'salbei', nacht: 'mint' };

const systemDunkel = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function wendeDesignAn(design = DESIGN_STANDARD) {
  const d = { ...DESIGN_STANDARD, ...design };
  const dunkel = d.modus === 'dunkel' || (d.modus === 'auto' && systemDunkel());
  const html = document.documentElement;
  html.dataset.thema = HELL[d.thema] ? d.thema : 'salbei';
  html.dataset.nacht = NACHT[d.nacht] ? d.nacht : 'mint';
  html.dataset.dunkel = dunkel ? '1' : '0';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? '#1C1F22' : HELL[html.dataset.thema].meta);
  try { localStorage.setItem('dbt-design', JSON.stringify(d)); } catch { /* nur Komfort */ }
}

// Sofort mit dem zuletzt gemerkten Design starten (nur Darstellung, keine Tagebuchdaten).
let gemerkt = DESIGN_STANDARD;
try { gemerkt = JSON.parse(localStorage.getItem('dbt-design')) ?? DESIGN_STANDARD; } catch { /* egal */ }
wendeDesignAn(gemerkt);

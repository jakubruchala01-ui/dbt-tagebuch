// Lokaler Speicher im Browser (IndexedDB). Nichts verlässt das Gerät.
const DB_NAME = 'dbt-tagebuch';
const DB_VERSION = 2; // v2: Verhaltensketten
let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'date' });
      if (!d.objectStoreNames.contains('ketten')) d.createObjectStore('ketten', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

export async function getConfig() {
  const d = await open();
  return req(d.transaction('meta').objectStore('meta').get('config'));
}

export async function putConfig(config) {
  const d = await open();
  const t = d.transaction('meta', 'readwrite');
  t.objectStore('meta').put(config, 'config');
  return done(t);
}

export async function getEntry(date) {
  const d = await open();
  return req(d.transaction('entries').objectStore('entries').get(date));
}

export async function putEntry(entry) {
  const d = await open();
  const t = d.transaction('entries', 'readwrite');
  t.objectStore('entries').put(entry);
  return done(t);
}

export async function getAllEntries() {
  const d = await open();
  return req(d.transaction('entries').objectStore('entries').getAll());
}

export async function getAllKetten() {
  const d = await open();
  return req(d.transaction('ketten').objectStore('ketten').getAll());
}

export async function putKette(kette) {
  const d = await open();
  const t = d.transaction('ketten', 'readwrite');
  t.objectStore('ketten').put(kette);
  return done(t);
}

/** Ersetzt alles (nur für Import – vorher wird automatisch exportiert). */
export async function replaceAll(config, entries, ketten = []) {
  const d = await open();
  const t = d.transaction(['meta', 'entries', 'ketten'], 'readwrite');
  const es = t.objectStore('entries');
  es.clear();
  entries.forEach((e) => es.put(e));
  const ks = t.objectStore('ketten');
  ks.clear();
  ketten.forEach((k) => ks.put(k));
  t.objectStore('meta').put(config, 'config');
  return done(t);
}

// PIN-Sperre. Schützt vor neugierigen Blicken – ist KEINE Verschlüsselung der Daten.
// Die PIN wird nie im Klartext gespeichert, nur als PBKDF2-Hash mit Salt.
import { icon } from './ui.js';

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function pinHash(pin, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}

export async function pinPruefen(pin, gespeichert) {
  const { hash } = await pinHash(pin, gespeichert.salt);
  return hash === gespeichert.hash;
}

export const pinGueltig = (pin) => /^\d{4,8}$/.test(pin);

/**
 * Zeigt den Sperrbildschirm. Löst auf, sobald die richtige PIN eingegeben wurde.
 * onEntfernen: wird aufgerufen, wenn die PIN über „vergessen“ entfernt wird.
 */
export function sperren(gespeichert, onEntfernen) {
  const el = document.getElementById('sperre');
  el.hidden = false;
  document.body.classList.add('gesperrt');
  el.innerHTML = `
    <form class="sperrbox" autocomplete="off">
      <div class="sperr-icon" aria-hidden="true">${icon('schloss', 40)}</div>
      <h2>DBT-Tagebuch</h2>
      <p>PIN eingeben</p>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" id="pin-eingabe" aria-label="PIN" autofocus>
      <p class="fehler" id="pin-fehler" hidden>Falsche PIN</p>
      <button class="primary" type="submit">Entsperren</button>
      <button type="button" class="ghost klein" id="pin-vergessen">PIN vergessen?</button>
      <div class="sperr-vergessen" id="vergessen-box" hidden>
        <p>Die PIN schützt nur vor neugierigen Blicken – deine Einträge sind nicht verschlüsselt und bleiben erhalten.
        Zum Entfernen der PIN tippe <b>PIN ENTFERNEN</b> ein.</p>
        <input id="vergessen-eingabe" aria-label="Bestätigung: PIN ENTFERNEN" autocomplete="off">
        <button type="button" class="ghost" id="vergessen-ok">PIN entfernen</button>
      </div>
    </form>`;
  const input = el.querySelector('#pin-eingabe');
  setTimeout(() => input.focus(), 50);

  return new Promise((resolve) => {
    const frei = () => { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('gesperrt'); resolve(); };
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      if (await pinPruefen(input.value, gespeichert)) frei();
      else {
        el.querySelector('#pin-fehler').hidden = false;
        input.value = '';
        input.focus();
      }
    };
    el.querySelector('#pin-vergessen').onclick = () => {
      el.querySelector('#vergessen-box').hidden = false;
      el.querySelector('#vergessen-eingabe').focus();
    };
    el.querySelector('#vergessen-ok').onclick = async () => {
      if (el.querySelector('#vergessen-eingabe').value.trim().toUpperCase() === 'PIN ENTFERNEN') {
        await onEntfernen();
        frei();
      } else {
        el.querySelector('#vergessen-eingabe').setAttribute('aria-invalid', 'true');
        el.querySelector('#vergessen-eingabe').focus();
      }
    };
  });
}

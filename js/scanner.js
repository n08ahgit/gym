// =============================================================
// scanner.js – Barcode scannen (Essen, Gerichte, Energy-Drinks)
//
// Android/Chrome: eingebauter BarcodeDetector. iPhone/Safari hat keinen →
// ZXing (Open Source, Apache 2.0, js/vendor/zxing.min.js) wird beim ersten
// Scan nachgeladen. Ohne Kamera: Nummer eintippen.
// scanCode({ onCode(code), onCancel() })
// =============================================================

import { openSheet, closeSheet, toast } from './app.js';
import { ICON } from './screens/icons.js';

export const canScan = () => !!navigator.mediaDevices?.getUserMedia;

let zxing = null;
function loadZxing() {
  zxing ||= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'js/vendor/zxing.min.js';
    sc.onload = () => res(window.ZXing);
    sc.onerror = () => { zxing = null; rej(new Error('Scanner konnte nicht geladen werden')); };
    document.head.appendChild(sc);
  });
  return zxing;
}

/** Erkennung: Funktion (video) → Code oder null. */
export async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      return async (v) => (await det.detect(v).catch(() => []))[0]?.rawValue || null;
    } catch { /* weiter mit ZXing */ }
  }
  const Z = await loadZxing();
  const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]], [Z.DecodeHintType.TRY_HARDER, true]]);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  return async (v) => {
    if (!v.videoWidth) return null;
    // nur den Bereich im Rahmen auswerten (schneller, weniger Fehltreffer)
    const w = Math.round(v.videoWidth * 0.8), h = Math.round(v.videoHeight * 0.45);
    cv.width = w; cv.height = h;
    ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));
      return reader.decodeWithState(bmp).getText();
    } catch { return null; }
  };
}

export async function scanCode({ onCode, onCancel = () => {} }) {
  closeSheet(true);
  const ov = document.createElement('div');
  ov.className = 'scan';
  ov.innerHTML = `<video playsinline muted></video><div class="scan-frame"><i class="scan-line"></i></div>
    <p class="scan-text">Barcode in den Rahmen halten</p>
    <button class="chip scan-type">Nummer eintippen</button>
    <button class="glass-circle scan-x" aria-label="Schließen">${ICON.x}</button>`;
  document.body.appendChild(ov);
  let stream, stop = false;
  const end = () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); ov.remove(); };
  ov.querySelector('.scan-x').onclick = () => { end(); onCancel(); };
  ov.querySelector('.scan-type').onclick = () => { end(); openCodeSheet(onCode); };
  try {
    const [st, detect] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      makeDetector(),
    ]);
    stream = st;
    if (stop) return end();
    const v = ov.querySelector('video');
    v.srcObject = stream;
    await v.play();
    while (!stop) {
      const code = await detect(v);
      if (code && /^\d{8,14}$/.test(code)) {
        navigator.vibrate?.(30);
        end();
        return onCode(code);
      }
      await new Promise((r) => setTimeout(r, 180));
    }
  } catch (e) {
    end();
    toast(e?.name === 'NotAllowedError' ? 'Kamera nicht erlaubt – in den Einstellungen für „Gym“ freigeben' : 'Kamera nicht verfügbar – Nummer eintippen');
    openCodeSheet(onCode);
  }
}

/** Barcode-Nummer von Hand (steht unter den Strichen). */
export function openCodeSheet(onCode) {
  openSheet(`<h2 class="sheet-title">Barcode eintippen</h2>
    <p class="muted small sheet-sub">Die Zahl unter den Strichen (8 oder 13 Ziffern).</p>
    <label class="gfield"><span>Barcode</span><input id="bcIn" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" data-enter="go"></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="go">Suchen</button></div>`, {
    go: () => {
      const code = document.getElementById('bcIn').value.replace(/\D/g, '');
      if (!/^\d{8,14}$/.test(code)) return toast('8 bis 14 Ziffern eingeben');
      closeSheet(true);
      onCode(code);
    },
  });
  setTimeout(() => document.getElementById('bcIn')?.focus(), 350);
}

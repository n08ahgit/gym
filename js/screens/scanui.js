// =============================================================
// scanui.js – KI-Kalorien-Scan: Zustimmung, Foto/Text, Ergebnis prüfen,
// Scans kaufen (Bestellseite), Kauf-Code, Widerruf, Inhalt melden
//
// Pflichten aus dem Rechts-Check: Einwilligung + „ab 18“ vor dem ersten Scan,
// Hinweis „KI-Schätzung – kann falsch sein“ unter jedem Ergebnis, KI-Einträge
// mit quelle: 'ki', Bestellseite mit Preis + § 19-Hinweis + Links + „Jetzt kaufen“,
// Widerrufsbutton ohne Login erreichbar.
// =============================================================

import { openSheet, closeSheet, toast, render } from '../app.js';
import { data, save } from '../store.js';
import { esc, fmtNum, fmtBig, parseNum } from '../util.js';
import { logFood } from '../nutrition.js';
import { ICON } from './icons.js';
import { shopStatus, walletStatus, giveConsent, revokeConsent, prepImage, scan, withNutrition, startCheckout, walletCode, fmtCode, useCode, sendWiderruf, sendReport } from '../scan.js';
import { openLegal } from './legal.js';

const euro = (v) => `${fmtNum(v)} €`.replace('.', ',');
const busy = (html) => openSheet(`<div class="scan-busy"><span class="spinner" aria-hidden="true"></span><p>${html}</p></div>`);

// ---------- Einstieg ----------

/** Aus „Essen eintragen“: Foto (Kamera/Galerie) oder Beschreibung. */
export async function startScan(mode = 'photo') {
  const st = await shopStatus();
  if (!st.scan) return toast(st.offline ? 'Keine Verbindung – der KI-Scan braucht Internet' : 'Der KI-Scan ist bald verfügbar');
  const w = await walletStatus();
  if (!w.ok) return toast(w.error || 'Server nicht erreichbar');
  if (!w.consent) return openConsent(() => startScan(mode));
  if (w.left <= 0) return openShop('Keine Scans mehr übrig.');
  if (mode === 'text') return openTextScan(w.left);
  pickPhoto();
}

function pickPhoto() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    if (!f) return;
    busy('Foto wird vorbereitet …');
    try {
      const image = await prepImage(f);
      await runScan({ image });
    } catch (e) { closeSheet(); toast(e.message); }
  });
  inp.click();
}

function openTextScan(left) {
  openSheet(`<h2 class="sheet-title">Mahlzeit beschreiben</h2>
    <p class="muted small sheet-sub">Z. B. „2 Brötchen mit Nutella und ein Glas Milch“ – je genauer (Mengen, Zubereitung), desto besser. ${left} Scans übrig.</p>
    <label class="gfield"><span>Was hast du gegessen?</span><input id="scanText" maxlength="300" autocomplete="off" data-enter="go" placeholder="Beschreibung"></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="go">KI schätzen lassen</button></div>`, {
    go: () => {
      const text = document.getElementById('scanText').value.trim();
      if (text.length < 3) return toast('Bitte kurz beschreiben');
      runScan({ text });
    },
  });
  setTimeout(() => document.getElementById('scanText')?.focus(), 350);
}

async function runScan(input) {
  busy('KI schätzt die Mahlzeit …<br><small class="muted">dauert ein paar Sekunden</small>');
  try {
    const r = await scan(input);
    openResult(r);
  } catch (e) {
    closeSheet();
    if (e.needConsent) return openConsent(() => (input.text ? openTextScan(e.left ?? 0) : pickPhoto()));
    if (e.needBuy) return openShop(e.message);
    toast(e.message);
  }
}

// ---------- Zustimmung (vor dem ersten Scan) ----------

function openConsent(next) {
  openSheet(`<h2 class="sheet-title">KI-Scan: kurz zustimmen</h2>
    <div class="consent-text">
      <p><b>So funktioniert es:</b> Dein Foto oder deine Beschreibung geht über unseren Server an <b>Anthropic</b> (KI-Anbieter, USA, Vertragspartner Anthropic Ireland). Die KI schätzt Zutaten und Gramm, du prüfst und korrigierst, dann wird eingetragen.</p>
      <p>Fotos werden vorher verkleinert, Ortsdaten entfernt, <b>nirgends gespeichert</b> und nicht zum Training verwendet. Anthropic löscht Anfragen nach spätestens 30 Tagen.</p>
      <p>Essen, Kalorien und Gewicht können <b>Gesundheitsdaten</b> sein – deshalb fragen wir ausdrücklich. Du kannst die Einwilligung jederzeit unter Einstellungen → „KI-Scan“ widerrufen.</p>
      <p class="muted small">Die Ergebnisse sind Schätzungen und können falsch sein. Kein Medizinprodukt, keine Ernährungsberatung.</p>
    </div>
    <label class="check-row"><input type="checkbox" id="cAge"><span>Ich bin mindestens 18 Jahre alt.</span></label>
    <label class="check-row"><input type="checkbox" id="cOk"><span>Ich willige ein, dass meine Fotos/Beschreibungen für den Scan wie oben beschrieben verarbeitet werden (<button class="text-btn" data-action="ds">Datenschutzerklärung</button>).</span></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="yes">Zustimmen und scannen</button></div>`, {
    ds: () => openLegal('datenschutz'),
    yes: async () => {
      if (!document.getElementById('cAge').checked || !document.getElementById('cOk').checked) return toast('Bitte beide Punkte bestätigen');
      const r = await giveConsent();
      if (!r.ok) return toast(r.error || 'Server nicht erreichbar');
      closeSheet();
      if (r.left > 0) toast(r.free > 0 ? `${r.free} Gratis-Scans zum Ausprobieren` : 'Zugestimmt');
      setTimeout(next, 350);
    },
  });
}

// ---------- Ergebnis prüfen und eintragen ----------

function openResult(r) {
  const rows = withNutrition(r.items);
  if (!rows.length) {
    openSheet(`<h2 class="sheet-title">Nichts erkannt</h2><p>${esc(r.note || 'Auf dem Foto war kein Essen zu erkennen.')}</p>
      <p class="muted small">Dafür wurde kein Scan abgezogen. ${r.left} Scans übrig.</p>
      <div class="sheet-actions"><button class="btn primary big" data-action="again">Nochmal versuchen</button></div>`, { again: () => { closeSheet(); setTimeout(() => startScan('photo'), 300); } });
    return;
  }
  const val = (row) => (row.use === 'db' ? row.db : row.ai);
  const kcalOf = (row) => Math.round((val(row).kcal * row.grams) / 100);
  const totals = () => rows.filter((x) => !x.off).reduce((t, x) => ({ kcal: t.kcal + kcalOf(x), p: t.p + (val(x).p * x.grams) / 100 }), { kcal: 0, p: 0 });
  const conf = { hoch: 'sicher', mittel: 'ungefähr', niedrig: 'unsicher' };
  const draw = () => `${rows.map((x, i) => `<div class="scan-row${x.off ? ' off' : ''}">
      <div class="scan-top">
        <b class="scan-name">${esc(x.name)}</b>
        <span class="scan-kcal" id="sk${i}">${x.off ? '–' : `${fmtBig(kcalOf(x))} kcal`}</span>
        <button class="icon-btn sm" data-action="tog" data-i="${i}" aria-label="${x.off ? 'Wieder aufnehmen' : 'Weglassen'}">${x.off ? ICON.plus : ICON.x}</button>
      </div>
      <div class="scan-bot">
        <span class="scan-meta">${fmtNum(val(x).kcal)} kcal/100 g · ${x.use === 'db' ? `Datenbank: ${esc(x.db.name)}` : 'KI-Wert'}${x.db ? ` · <button class="text-btn" data-action="src" data-i="${i}">${x.use === 'db' ? 'KI-Wert nehmen' : 'Datenbank nehmen'}</button>` : ''}<br><span class="scan-conf c-${x.confidence}">Menge ${conf[x.confidence]}</span></span>
        <label class="field mini"><input inputmode="numeric" value="${x.grams}" data-input="g" data-i="${i}" aria-label="Gramm ${esc(x.name)}"><span>g</span></label>
      </div>
    </div>`).join('')}`;
  const sum = () => { const t = totals(); return `Zusammen <b>${fmtBig(t.kcal)} kcal</b> · ${fmtNum(Math.round(t.p))} g Protein`; };
  const redraw = () => { document.getElementById('scanRows').innerHTML = draw(); document.getElementById('scanSum').innerHTML = sum(); };
  openSheet(`<h2 class="sheet-title">KI-Scan prüfen</h2>
    <p class="ki-note">${ICON.info}<span><b>KI-Schätzung – kann falsch sein.</b> Bitte Mengen prüfen und korrigieren${r.note ? ` · ${esc(r.note)}` : ''}</span></p>
    <div class="scan-rows" id="scanRows">${draw()}</div>
    <p class="scan-sum" id="scanSum">${sum()}</p>
    <div class="sheet-actions"><button class="btn primary big" data-action="log">Eintragen</button></div>
    <p class="muted small center-text">${r.left} Scans übrig</p>`, {
    inputs: {
      g: (el) => {
        const i = +el.dataset.i, g = Math.round(parseNum(el.value));
        if (!(g >= 0 && g <= 3000)) return;
        rows[i].grams = g;
        document.getElementById('sk' + i).textContent = rows[i].off ? '–' : `${fmtBig(kcalOf(rows[i]))} kcal`;
        document.getElementById('scanSum').innerHTML = sum();
      },
    },
    tog: (el) => { const x = rows[+el.dataset.i]; x.off = !x.off; redraw(); },
    src: (el) => { const x = rows[+el.dataset.i]; x.use = x.use === 'db' ? 'ai' : 'db'; redraw(); },
    log: () => {
      const use = rows.filter((x) => !x.off && x.grams > 0);
      if (!use.length) return toast('Nichts ausgewählt');
      for (const x of use) {
        const e = logFood(val(x), x.grams);
        e.quelle = 'ki'; // KI-generiert (maschinenlesbar markiert)
      }
      save();
      closeSheet();
      toast(`${use.length} ${use.length === 1 ? 'Eintrag' : 'Einträge'} aus dem KI-Scan eingetragen`);
      render();
    },
  });
}

// ---------- Scans kaufen (Bestellseite) ----------

export async function openShop(reason = '') {
  const st = await shopStatus(true);
  const w = await walletStatus().catch(() => ({}));
  const price = euro(st.price || 2.99);
  const n = (st.credits || 1000).toLocaleString('de-DE');
  const closed = !st.sales;
  openSheet(`<h2 class="sheet-title">KI-Scans kaufen</h2>
    ${reason ? `<p class="sheet-sub">${esc(reason)}</p>` : ''}
    <div class="order-card">
      <div class="order-line"><span><b>${n} KI-Scans</b><br><span class="muted small">Einmalkauf, kein Abo · verfallen nicht · für den KI-Kalorien-Scan (Foto oder Text) in dieser Web-App · braucht Internet, für Fotos eine Kamera</span></span><b class="order-price">${price}</b></div>
      <div class="order-line total"><span>Gesamtpreis</span><b>${price}</b></div>
      <p class="muted small">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>
      ${w.left != null ? `<p class="muted small">Aktuell übrig: ${w.left} Scans</p>` : ''}
    </div>
    <label class="check-row"><input type="checkbox" id="bAge"><span>Ich bin mindestens 18 Jahre alt und wohne in der EU.</span></label>
    <label class="check-row"><input type="checkbox" id="bStart"><span>Ich verlange, dass die Scans sofort freigeschaltet werden. Mir ist bekannt, dass ich bei einem Widerruf Wertersatz für bereits genutzte Scans leiste.</span></label>
    <label class="check-row"><input type="checkbox" id="bAgb"><span>Ich habe die <button class="text-btn" data-action="agb">AGB</button> und die <button class="text-btn" data-action="wb">Widerrufsbelehrung</button> gelesen und akzeptiere die AGB. <button class="text-btn" data-action="ds">Datenschutz</button></span></label>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="buy"${closed ? ' disabled' : ''}>Jetzt kaufen</button>
      ${closed ? `<p class="muted small center-text">${st.offline ? 'Keine Verbindung.' : `Kaufen ist ab ${String(st.salesFrom || '2026-12-01').split('-').reverse().join('.')} möglich, sobald alles freigeschaltet ist.`}</p>` : '<p class="muted small center-text">Danach geht es zur sicheren Zahlungsseite von Stripe.</p>'}
      <button class="text-btn muted" data-action="code">Kauf-Code von einem anderen Gerät eingeben</button>
    </div>`, {
    agb: () => openLegal('agb'),
    wb: () => openLegal('widerruf'),
    ds: () => openLegal('datenschutz'),
    code: () => openCodeEntry(),
    buy: async (el) => {
      const age = document.getElementById('bAge').checked, start = document.getElementById('bStart').checked, agb = document.getElementById('bAgb').checked;
      if (!age || !start || !agb) return toast('Bitte alle drei Punkte bestätigen');
      el.disabled = true; el.textContent = 'Weiter zur Zahlung …';
      try { await startCheckout({ age18: true, eu: true, start: true, agb: true }); }
      catch (e) { el.disabled = false; el.textContent = 'Jetzt kaufen'; toast(e.message); }
    },
  });
}

/** Rückkehr von Stripe (?kauf=ok|abbruch). Die Gutschrift kommt per Webhook – kurz nachfragen. */
export async function afterCheckout(result) {
  if (result !== 'ok') return toast('Kauf abgebrochen – es wurde nichts berechnet');
  busy('Zahlung wird bestätigt …');
  let w = null;
  for (let i = 0; i < 8; i++) {
    w = await walletStatus().catch(() => null);
    if (w?.purchases?.some((p) => Date.now() - p.t < 30 * 60000 && !p.refunded)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const okBuy = w?.purchases?.some((p) => Date.now() - p.t < 30 * 60000 && !p.refunded);
  openSheet(`<h2 class="sheet-title">${okBuy ? 'Danke für deinen Kauf!' : 'Zahlung eingegangen'}</h2>
    <p>${okBuy ? `Deine Scans sind freigeschaltet – jetzt ${w.left} übrig.` : 'Die Freischaltung dauert noch einen Moment. Schau gleich unter Einstellungen → „KI-Scan“ nach.'}</p>
    <p class="muted small">Die Bestätigung mit Beleg, Widerrufsbelehrung und AGB kommt per E-Mail. Dein Kauf-Code (für andere Geräte):</p>
    <p class="kauf-code">${fmtCode(walletCode())}</p>
    <div class="sheet-actions"><button class="btn primary big" data-action="closeSheet">Fertig</button></div>`);
}

// ---------- Kauf-Code ----------

export function openCodeEntry() {
  openSheet(`<h2 class="sheet-title">Kauf-Code eingeben</h2>
    <p class="muted small sheet-sub">Steht in deiner Kauf-Bestätigung per E-Mail. Danach nutzt dieses Gerät dasselbe Guthaben.</p>
    <label class="gfield"><span>Kauf-Code</span><input id="kcode" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" data-enter="go"></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="go">Übernehmen</button></div>`, {
    go: async () => {
      try { const st = await useCode(document.getElementById('kcode').value); closeSheet(); toast(`Guthaben übernommen: ${st.left} Scans`); render(); }
      catch (e) { toast(e.message); }
    },
  });
}

/** Einstellungen → KI-Scan: Guthaben, Code, Einwilligung. */
export async function openScanSettings() {
  busy('Lade Guthaben …');
  const [st, w] = await Promise.all([shopStatus(true), walletStatus().catch(() => ({ ok: false }))]);
  openSheet(`<h2 class="sheet-title">KI-Scan</h2>
    ${w.ok ? `<p class="sheet-sub"><b>${w.left} Scans übrig</b>${w.free ? ` (davon ${w.free} gratis)` : ''}</p>` : '<p class="sheet-sub">Server nicht erreichbar.</p>'}
    <p class="muted small">Dein Kauf-Code – damit bekommst du das Guthaben auf ein anderes Gerät (mit Konto passiert das automatisch):</p>
    <p class="kauf-code">${fmtCode(walletCode())}</p>
    ${w.purchases?.length ? `<p class="muted small">Käufe: ${w.purchases.map((p) => `${new Date(p.t).toLocaleDateString('de-DE')}${p.refunded ? ` (${esc(p.refunded)})` : ''}`).join(', ')}</p>` : ''}
    <div class="sheet-actions">
      <button class="btn primary big" data-action="buy">Scans kaufen</button>
      <button class="btn big" data-action="code">Anderen Kauf-Code eingeben</button>
      ${w.consent ? '<button class="btn ghost big" data-action="revoke">Einwilligung widerrufen</button>' : ''}
      <button class="btn ghost big" data-action="wd">Vertrag widerrufen</button>
    </div>
    ${!st.scan ? '<p class="muted small center-text">Der KI-Scan ist noch nicht freigeschaltet.</p>' : ''}`, {
    buy: () => openShop(),
    code: () => openCodeEntry(),
    wd: () => openWiderruf(),
    revoke: async () => { const r = await revokeConsent(); toast(r.ok ? 'Einwilligung widerrufen – vor dem nächsten Scan fragen wir wieder' : 'Fehlgeschlagen'); closeSheet(); },
  });
}

// ---------- Widerruf (§ 356a BGB: ohne Login erreichbar, Bestätigungsschritt, Eingangsbestätigung) ----------

export function openWiderruf() {
  openSheet(`<h2 class="sheet-title">Vertrag widerrufen</h2>
    <p class="muted small sheet-sub">Für Käufe von KI-Scans. Die Bestellnummer (Beleg-Nr.) steht in deiner Kauf-Bestätigung – mit ihr geht die Erstattung binnen 14 Tagen automatisch.</p>
    <form class="acct-form">
      <label class="gfield"><span>Name</span><input id="wName" autocomplete="name" maxlength="80"></label>
      <label class="gfield"><span>E-Mail (wie beim Kauf)</span><input id="wMail" type="email" autocomplete="email" maxlength="120"></label>
      <label class="gfield"><span>Bestellnummer / Beleg-Nr. (falls zur Hand)</span><input id="wOrder" autocomplete="off" maxlength="80" placeholder="pi_…"></label>
      <label class="gfield"><span>Erklärung (optional)</span><input id="wText" maxlength="500" placeholder="Hiermit widerrufe ich den Vertrag über …"></label>
    </form>
    <div class="sheet-actions"><button class="btn primary big" data-action="next">Vertrag widerrufen</button></div>`, {
    next: () => {
      const f = { name: document.getElementById('wName').value.trim(), email: document.getElementById('wMail').value.trim(), order: document.getElementById('wOrder').value.trim(), text: document.getElementById('wText').value.trim() || 'Hiermit widerrufe ich den Vertrag über den Kauf von KI-Scans.' };
      if (f.name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return toast('Bitte Name und E-Mail angeben');
      openSheet(`<h2 class="sheet-title">Widerruf bestätigen</h2>
        <p>Name: <b>${esc(f.name)}</b><br>E-Mail: <b>${esc(f.email)}</b>${f.order ? `<br>Bestellnummer: <b>${esc(f.order)}</b>` : ''}</p>
        <p>${esc(f.text)}</p>
        <div class="sheet-actions"><button class="btn primary big" data-action="send">Widerruf jetzt bestätigen</button><button class="btn ghost big" data-action="back">Zurück</button></div>`, {
        back: () => openWiderruf(),
        send: async (el) => {
          el.disabled = true; el.textContent = 'Sende …';
          const r = await sendWiderruf(f).catch(() => ({ ok: false }));
          if (!r.ok) { el.disabled = false; el.textContent = 'Widerruf jetzt bestätigen'; return toast(r.error || 'Senden fehlgeschlagen – bitte nochmal'); }
          openSheet(`<h2 class="sheet-title">Widerruf eingegangen</h2>
            <p>Eingegangen am <b>${new Date(r.at).toLocaleString('de-DE')}</b>.${r.mailed ? ' Eine Eingangsbestätigung ist per E-Mail unterwegs.' : ''}</p>
            <p>${r.refunded ? 'Der Betrag wird auf dein Zahlungsmittel zurückerstattet (meist 5–10 Tage), die restlichen Scans dieses Pakets sind gesperrt.' : 'Wir prüfen deinen Widerruf und melden uns per E-Mail.'}</p>
            <div class="sheet-actions"><button class="btn primary big" data-action="closeSheet">Fertig</button></div>`);
        },
      });
    },
  });
}

// ---------- Inhalt melden (DSA Art. 16) ----------

export function openReport(kind, ref, text = '') {
  const what = { avatar: 'Profilbild', cheer: 'Nachricht', food: 'Lebensmittel-Eintrag', name: 'Name' }[kind] || 'Inhalt';
  openSheet(`<h2 class="sheet-title">${what} melden</h2>
    <p class="muted small sheet-sub">Rechtswidrig, beleidigend oder falsch? Wir prüfen jede Meldung und entfernen den Inhalt, wenn nötig.</p>
    <div class="chips">${['Beleidigend', 'Unangemessen', 'Falsche Angaben', 'Rechtswidrig'].map((r) => `<button class="chip sec" data-action="r" data-r="${r}">${r}</button>`).join('')}</div>
    <label class="gfield" style="margin-top:10px"><span>Details (optional)</span><input id="rpText" maxlength="300"></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="send">Melden</button></div>`, {
    r: (el) => { document.querySelectorAll('#sheet [data-action=r]').forEach((b) => b.classList.toggle('on', b === el)); },
    send: async () => {
      const reason = document.querySelector('#sheet [data-action=r].on')?.dataset.r || '';
      if (!reason) return toast('Bitte einen Grund wählen');
      const r = await sendReport({ kind, ref, text, reason: `${reason}: ${document.getElementById('rpText').value}` }).catch(() => ({ ok: false }));
      closeSheet();
      toast(r.ok ? 'Danke – wir prüfen die Meldung' : 'Melden fehlgeschlagen');
    },
  });
}

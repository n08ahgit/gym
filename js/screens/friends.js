// =============================================================
// friends.js (Screen) – Tab "Freunde": Rangliste, eigenen Stand teilen,
// Freund per kurzem Code (z. B. K7Q2MX) oder Link hinzufügen.
// Stände werden beim Öffnen automatisch vom Server aktualisiert.
// =============================================================

import { render, ui, openSheet, closeSheet, ask, toast } from '../app.js';
import { data, save } from '../store.js';
import { esc, fmtNum, fmtBig, fmtW, fmtVol } from '../util.js';
import { setAvatar, isLive, shareTimes, BOARDS, BIG3, leaderboard, myStats, decodeFriend, upsertFriend, removeFriend, shortCode, shortLink, publishMe, fetchFriend, parseShort, refreshFriends, linkTo } from '../friends.js';
import { DAILY_LIMIT, logDrink, removeDrink, todayDrinks, mgOf, caffeineStats, drinkChoices, drinkByCode, rememberDrink, TYPICAL_MG_100, nutrOf, setDrinkNutr } from '../drinks.js';
import { scanCode, canScan } from '../scanner.js';
import { parseNum, fmtClock } from '../util.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';

const ago = (t) => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
};

function fmtValue(key, v) {
  if (v == null) return '–';
  if (key === 'volume') return fmtVol(v);
  if (key === 'strength') return `${fmtNum(Math.round(v * 100) / 100)}×`;
  if (key === 'sets') return `${v} %`;
  if (key === 'skips') return `${v}×`;
  if (key === 'food') return fmtBig(v);
  return String(v);
}
const unitOf = (key) => (['strength', 'volume', 'sets', 'skips'].includes(key) ? '' : BOARDS[key].unit);

function gapText(key, rows) {
  const i = rows.findIndex((r) => r.me);
  const me = rows[i];
  if (rows.length < 2) return '';
  if (me.value == null) return key === 'strength' ? 'Für die Kraft-Wertung brauchst du Bankdrücken, Kniebeuge, Kreuzheben (letzte 90 Tage) und dein Körpergewicht.' : '';
  if (i === 0) {
    const second = rows[1];
    if (second.value == null) return 'Du führst.';
    const d = Math.abs(me.value - second.value);
    if (d === 0) return `Gleichstand mit ${esc(second.name)}.`;
    if (BOARDS[key].asc) return key === 'skips' ? `Du skippst am wenigsten – ${d}× weniger als ${esc(second.name)}.` : `Du lässt am wenigsten aus – ${d} Prozentpunkte weniger als ${esc(second.name)}.`;
    return `Du führst mit ${fmtValue(key, d)} ${unitOf(key)} Vorsprung vor ${esc(second.name)}.`;
  }
  const ahead = rows[i - 1];
  const d = Math.abs(ahead.value - me.value);
  if (BOARDS[key].asc) return `Platz ${i + 1} · ${esc(ahead.name)} ${key === 'skips' ? `hat ${d}× weniger geskippt` : `lässt ${d} Prozentpunkte weniger aus`}.`;
  return `Platz ${i + 1} · ${fmtValue(key, d)} ${unitOf(key)} hinter ${esc(ahead.name)}.`;
}

const pct = (st) => (typeof st?.t4 === 'number' ? (st.t4 ? Math.round((st.k4 / st.t4) * 100) : 0) : null);

/** Zusatzzeile je Wertung: worauf sich die Zahl bezieht. */
function detail(key, st) {
  if (!st) return '';
  if (key === 'skips' && typeof st.p4 === 'number') return `${st.m4} von ${st.p4} Trainings verpasst`;
  if (key === 'sets' && typeof st.t4 === 'number') return st.t4 ? `${st.k4} von ${st.t4} Sätzen übersprungen` : 'noch keine Workouts';
  if (key === 'food') return typeof st.fk === 'number' ? `Ø ${st.fp} g Protein · ${st.fd} ${st.fd === 1 ? 'Tag' : 'Tage'} eingetragen` : 'trägt kein Essen ein';
  return '';
}

// ---------- Anwesenheit: trainiert gerade / zuletzt ----------

const WD1 = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const hhmm = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const mins = (t) => Math.max(1, Math.round((Date.now() - t) / 60000));
const hourTxt = (h) => (h == null ? '' : `${Math.floor(h)}${h % 1 ? ':30' : ''} Uhr`);

/** Kurzstatus: „Push · 25 min“ (live) bzw. „heute 17:30“, „gestern“, „vor 3 T.“ */
function status(st, long = false) {
  if (isLive(st)) return long ? `Trainiert gerade · ${esc(st.live.n)} · seit ${fmtDur(mins(st.live.s))}` : `${esc(st.live.n)} · ${fmtDur(mins(st.live.s))}`;
  if (!st?.lt) return long ? 'Noch kein Training geteilt' : '–';
  const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(st.lt).setHours(0, 0, 0, 0)) / 864e5);
  const when = d <= 0 ? `heute ${hhmm(st.lt)}` : d === 1 ? `gestern ${long ? hhmm(st.lt) : ''}`.trim() : long ? `vor ${d} Tagen` : `vor ${d} T.`;
  return long ? `Zuletzt: ${when}${st.ln ? ` · ${esc(st.ln)}` : ''}` : when;
}
const fmtDur = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());

/** Profilbild oder Initialen-Kreis (Farbe aus dem Namen, immer gleich pro Person). Inhalt immer exakt mittig. */
function avatar(name, live, size = 52, img = null) {
  const n = String(name || '?').trim();
  const ini = n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  const safe = img && /^data:image\/(jpeg|webp|png);base64,/.test(img) ? img : null;
  return `<span class="ava${live ? ' live' : ''}${safe ? ' has-img' : ''}" style="--ava-h:${h};--ava-s:${size}px" aria-hidden="true">${safe ? `<img src="${safe}" alt="">` : `<span class="ava-ini">${esc(ini)}</span>`}</span>`;
}
const meAvatar = (size) => avatar(data.profile.name || 'Du', false, size, data.profile.avatar);

/** Profilbild groß ansehen (antippen schließt). */
export function zoomAvatar(name, img) {
  document.querySelector('.ava-zoom')?.remove();
  const el = document.createElement('div');
  el.className = 'ava-zoom';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Profilbild von ${name}`);
  el.innerHTML = `<div class="ava-zoom-in">${avatar(name, false, Math.min(300, Math.round(window.innerWidth * 0.72)), img)}<b>${esc(name)}</b><span class="muted small">Antippen zum Schließen</span></div>`;
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); };
  el.addEventListener('click', close);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
}

/** Foto → quadratisch zugeschnitten, 320 px, JPEG (max. ca. 30 KB). */
async function shrinkPhoto(file) {
  const src = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild konnte nicht gelesen werden')); i.src = src; });
  const S = 320, side = Math.min(img.naturalWidth, img.naturalHeight); // scharf auch in der Großansicht
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
  let q = 0.82, out = cv.toDataURL('image/jpeg', q);
  while (out.length > 40000 && q > 0.4) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
  return out;
}

/** Leiste oben: wer ist im Gym, wer war zuletzt da. Live zuerst, dann nach letztem Training. */
function presenceStrip() {
  const people = data.friends.slice().sort((a, b) => (isLive(b.stats) - isLive(a.stats)) || ((b.stats?.live?.s || b.stats?.lt || 0) - (a.stats?.live?.s || a.stats?.lt || 0)));
  const liveN = people.filter((f) => isLive(f.stats)).length;
  return `<section class="presence" aria-label="Wer trainiert">
    <div class="presence-head"><h2>${liveN ? `<i class="live-dot"></i>${liveN} im Gym` : 'Freunde'}</h2><button class="text-btn" data-action="invite">${ICON.plus} Hinzufügen</button></div>
    <div class="presence-row">${people.map((f) => `<button class="pr-item" data-action="friend" data-id="${esc(f.id)}" aria-label="${esc(f.name)}: ${status(f.stats, true)}">
      ${avatar(f.name, isLive(f.stats), 52, f.img)}<span class="pr-name">${esc(f.name)}</span><span class="pr-st${isLive(f.stats) ? ' on' : ''}">${status(f.stats)}</span></button>`).join('')}</div>
  </section>`;
}

const BOARD_GROUPS = [['Training', ['consistency', 'streak', 'volume', 'strength']], ['Disziplin', ['skips', 'sets']], ['Just for fun', ['caffeine', 'food']]];

export const friendsScreen = {
  render(params) {
    const key = params.board || 'consistency';
    const rows = leaderboard(key);
    const noFriends = !data.friends.length;
    const list = rows.map((r, i) => `
      <button class="list-row rank-row${r.me ? ' me' : ''}" data-action="${r.me ? 'zoomMe' : 'friend'}" data-id="${esc(r.id)}">
        <span class="rank${i < 3 && r.value != null ? ` r${i + 1}` : ''}">${r.value == null ? '–' : i + 1}</span>
        ${r.me ? meAvatar(34) : avatar(r.name, false, 34, r.img)}
        <span class="lr-main"><span class="lr-title">${esc(r.name)}${r.me ? ' <span class="you">Du</span>' : ''}${!r.me && isLive(r.stats) ? ' <i class="live-dot" aria-label="trainiert gerade"></i>' : ''}</span>
          <span class="lr-sub">${detail(key, r.stats) || (r.me ? 'aktueller Stand' : `Stand ${ago(r.t)}`)}</span></span>
        <span class="lr-value">${fmtValue(key, r.value)}${key !== 'volume' && key !== 'strength' && r.value != null ? `<small> ${BOARDS[key].unit}</small>` : ''}</span>
      </button>`).join('');
    const today = mgOf(todayDrinks());
    const week = caffeineStats(7);
    return `<main class="content no-title has-tabbar friends">
      ${noFriends ? inviteCard(true) : presenceStrip()}

      <section class="card list-card board-card">
        <div class="card-head"><h2>Rangliste</h2>
          <button class="board-pick" data-action="boards" aria-haspopup="dialog">${BOARDS[key].label}${ICON.chevDown}</button></div>
        <p class="muted small board-sub">${BOARDS[key].sub}</p>
        ${list}
        ${noFriends ? '' : `<p class="note">${gapText(key, rows)}</p>`}
      </section>

      <section class="card list-card">
        <div class="list-row caf-row-mini${today > DAILY_LIMIT ? ' over' : ''}">
          <span class="set-ic">${ICON.bolt || ICON.plus}</span>
          <span class="lr-main"><span class="lr-title">Energy-Drinks</span><span class="lr-sub"><span class="caf-big">${today}</span> mg heute · ${week.mg} mg in 7 Tagen${today > DAILY_LIMIT ? ' · über 400 mg' : ''}</span></span>
          <button class="chip" data-action="drinks">${ICON.plus} Drink</button>
        </div>
        ${noFriends ? '' : `<button class="list-row set-row" data-action="invite"><span class="set-ic">${ICON.users}</span>
          <span class="lr-main"><span class="lr-title">Freunde hinzufügen</span><span class="lr-sub">${data.profile.name ? `Dein Code ${shortCode()}` : 'Name eintragen und einladen'}</span></span><span class="chev">${ICON.chev}</span></button>`}
      </section>
    </main>${tabBar('friends')}`;
  },

  after() {
    // Eigenen Stand hochladen, Freunde aktualisieren (still im Hintergrund)
    publishMe();
    const quiet = () => ui.screen === 'friends' && document.getElementById('sheet').hidden && !document.querySelector('#fcode:focus, #pname:focus');
    refreshFriends().then((changed) => { if (changed && quiet()) render(); });
    // Live-Status aktuell halten: jede Minute neu holen (nur solange die Freunde-Seite offen ist)
    clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      if (ui.screen !== 'friends' || document.visibilityState !== 'visible') { if (ui.screen !== 'friends') clearInterval(liveTimer); return; }
      refreshFriends().then((changed) => { if (quiet() && (changed || data.friends.some((f) => isLive(f.stats)))) render(); });
    }, 60000);
  },

  inputs: {
    avatarFile: async (el) => {
      const file = el.files?.[0];
      if (!file) return;
      if (!data.profile.name) { toast('Bitte zuerst deinen Namen eingeben'); return; }
      try {
        const img = await shrinkPhoto(file);
        await setAvatar(img);
        toast('Profilbild gespeichert – Freunde sehen es gleich');
        const inSheet = !document.getElementById('sheet').hidden;
        render();
        if (inSheet) openInviteSheet();
      } catch (e) { toast(e.message || 'Bild konnte nicht verwendet werden'); }
    },
    pname: (el) => {
      const had = !!data.profile.name;
      data.profile.name = el.value.trim().slice(0, 24);
      save();
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => { publishMe(true); if (!had && data.profile.name) render(); }, 900);
    },
  },

  actions: {
    noop: () => {},
    zoomMe: () => zoomAvatar(data.profile.name || 'Du', data.profile.avatar),
    avatarDel: async () => { const inSheet = !document.getElementById('sheet').hidden; await setAvatar(null); toast('Profilbild entfernt'); render(); if (inSheet) openInviteSheet(); },
    zoomMe: () => zoomAvatar(data.profile.name || 'Du', data.profile.avatar),
    toggleTimes: (el) => {
      data.settings.shareTimes = !shareTimes();
      save();
      el.setAttribute('aria-checked', shareTimes());
      el.querySelector('.switch').classList.toggle('on', shareTimes());
      publishMe(true);
      toast(shareTimes() ? 'Freunde sehen deine Trainingszeiten' : 'Trainingszeiten verborgen');
    },
    board: (el) => { ui.params.board = el.dataset.k; render(); },
    share: async () => {
      if (!data.profile.name) {
        document.getElementById('pname').focus();
        return toast('Bitte zuerst deinen Namen eingeben');
      }
      await publishMe(true);
      const url = shortLink();
      const text = `${data.profile.name} lädt dich zur Gym-Rangliste ein.\nMein Code: ${shortCode()}\n\nApp kostenlos installieren und beitreten:`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Gym-Rangliste', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Einladung kopiert'); } catch { prompt('Kopieren:', url); }
    },
    copyCode: async () => {
      try { await navigator.clipboard.writeText(shortCode()); toast(`Code ${shortCode()} kopiert`); } catch { prompt('Code:', shortCode()); }
    },
    addFriend: async () => {
      const el = document.getElementById('fcode');
      try {
        if (await addFromCode(el.value)) { el.value = ''; render(); }
      } catch (e) { toast(e.message); }
    },
    friend: (el) => openFriend(el.dataset.id),
    drinks: () => openDrinkSheet(),
    invite: () => openInviteSheet(),
    boards: () => openBoardSheet(),
  },
};

/** Einladen (Name, Code, teilen, Code eingeben, Privatsphäre) – als Karte ohne Freunde, sonst als Fenster. */
function inviteBody() {
  return `<div class="me-profile">
      <button class="ava-btn" id="meAva" data-action="zoomMe" aria-label="Dein Profilbild groß anzeigen">${meAvatar(72)}</button>
      <span class="me-pic-btns">
        <label class="chip">${ICON.edit} ${data.profile.avatar ? 'Foto ändern' : 'Profilbild wählen'}<input type="file" accept="image/*" hidden data-input="avatarFile"></label>
        ${data.profile.avatar ? '<button class="text-btn muted" data-action="avatarDel">Entfernen</button>' : ''}
      </span>
    </div>
    <label class="label" for="pname">Dein Name in der Rangliste</label>
    <input id="pname" class="input" data-input="pname" value="${esc(data.profile.name)}" placeholder="z. B. Alex" maxlength="24" autocomplete="off">
    ${data.profile.name ? `<button class="my-code" data-action="copyCode" aria-label="Code kopieren"><span class="my-code-val">${shortCode()}</span><span class="muted small">Dein Code · antippen zum Kopieren</span></button>` : ''}
    <button class="btn primary big full" data-action="share">${ICON.share} Einladung per WhatsApp & Co.</button>
    <label class="label" for="fcode">Code von einem Freund</label>
    <div class="add-row">
      <input id="fcode" class="input code-input" placeholder="z. B. K7Q2MX" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="addFriend">
      <button class="btn" data-action="addFriend">Hinzufügen</button>
    </div>
    <button class="switch-row" data-action="toggleTimes" role="switch" aria-checked="${shareTimes()}">
      <span><b>Trainingszeiten zeigen</b><span class="muted small">Freunde sehen, wenn du gerade trainierst, wann zuletzt und an welchen Tagen meist.</span></span>
      <i class="switch${shareTimes() ? ' on' : ''}"></i></button>
    <p class="note">Freunde sehen nur Namen, Kennzahlen${shareTimes() ? ' und Trainingszeiten' : ''} – keine einzelnen Workouts.</p>`;
}
function inviteCard() {
  return `<section class="card invite-card"><div class="card-head"><h2>Freunde hinzufügen</h2></div>
    <p class="muted small">Tretet gegeneinander an und seht, wer gerade im Gym ist.</p>${inviteBody()}</section>`;
}
function openInviteSheet() {
  openSheet(`<h2 class="sheet-title">Freunde hinzufügen</h2>${inviteBody()}`, { ...friendsScreen.actions, addFriend: async () => {
    const el = document.getElementById('fcode');
    try { if (await addFromCode(el.value)) { el.value = ''; closeSheet(); render(); } } catch (e) { toast(e.message); }
  } });
}
/** Wertung wählen: gruppiert statt 8 Segmente (HIG: höchstens ~5 auf dem iPhone). */
function openBoardSheet() {
  const cur = ui.params.board || 'consistency';
  openSheet(`<h2 class="sheet-title">Wertung</h2>
    ${BOARD_GROUPS.map(([g, keys]) => `<h3 class="sheet-h">${g}</h3><div class="list-card sheet-list-card">${keys.map((k) => `<button class="list-row board-opt${k === cur ? ' on' : ''}" data-action="pick" data-k="${k}" aria-pressed="${k === cur}">
      <span class="lr-main"><span class="lr-title">${BOARDS[k].label}</span><span class="lr-sub">${BOARDS[k].sub}</span></span>${k === cur ? `<span class="board-check">${ICON.check}</span>` : ''}</button>`).join('')}</div>`).join('')}`, {
    pick: (el) => { ui.params.board = el.dataset.k; closeSheet(); render(); },
  });
}

let nameTimer, liveTimer;

/** Kurzer Code, kurzer Link oder alter langer Link → Freund übernehmen. */
export async function addFromCode(input) {
  const short = parseShort(input);
  if (!short && !String(input).includes('#f=') && String(input).trim().length < 20) throw new Error('Bitte den 6-stelligen Code eingeben, z. B. K7Q2MX');
  if (short && short === data.profile.code) { toast('Das ist dein eigener Code'); return false; }
  const f = short ? await fetchFriend(short) : decodeFriend(input);
  const r = upsertFriend(f);
  if (r === 'self') { toast('Das ist dein eigener Link'); return false; }
  if (r === 'old') { toast(`Du hast schon einen neueren Stand von ${f.name}`); return false; }
  if (f.code) {
    if (data.profile.name) publishMe(true).then(() => linkTo(f.code));
    else setTimeout(() => toast(`Trag unten deinen Namen ein, dann erscheinst du auch bei ${f.name}`), 2600);
  }
  toast(r === 'new' ? `${f.name} ist jetzt in deiner Rangliste` : `Stand von ${f.name} aktualisiert`);
  return true;
}

function openFriend(id) {
  const f = data.friends.find((x) => x.id === id);
  if (!f) return;
  const me = myStats();
  const row = (label, a, b, fmt = (v) => (v == null ? '–' : String(v)), lowerBetter = false) => {
    const lead = a != null && b != null && a !== b ? ((a > b) !== lowerBetter ? 'me' : 'them') : '';
    return `<li class="cmp"><span class="cmp-l">${label}</span><b class="${lead === 'me' ? 'lead' : ''}">${fmt(a)}</b><b class="${lead === 'them' ? 'lead' : ''}">${fmt(b)}</b></li>`;
  };
  const kg = (v) => (v ? fmtW(v) : '–');
  const st = f.stats || {};
  const tw = Array.isArray(st.tw) && st.tw.some((x) => x[0]) ? st.tw : null;
  const maxN = tw ? Math.max(1, ...tw.map((x) => x[0])) : 1;
  const top = tw ? tw.map((x, i) => [i, ...x]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  const usual = top.length ? `Meist ${top.map(([i, , h]) => `${WD1[i]}${h != null ? ` ${hourTxt(h)}` : ''}`).join(' · ')}` : '';
  openSheet(`<h2 class="sheet-title">${esc(f.name)}</h2>
    <div class="fr-status${isLive(st) ? ' on' : ''}"><button class="ava-btn" data-action="zoom" aria-label="Profilbild von ${esc(f.name)} groß anzeigen">${avatar(f.name, isLive(st), 52, f.img)}</button><span class="fr-text"><b>${status(st, true)}</b><span class="muted small">Stand ${ago(f.t)}</span></span></div>
    ${tw ? `<h3 class="sheet-h">Trainiert meist · letzte 8 Wochen</h3>
      <div class="tw-chart" role="img" aria-label="${esc(usual || 'Keine Trainings')}">${tw.map(([n, h], i) => `<div class="tw-col"><span class="tw-bar" style="--k:${n / maxN}"></span><span class="tw-d">${WD1[i]}</span><span class="tw-h">${n ? hourTxt(h).replace(' Uhr', '') : ''}</span></div>`).join('')}</div>
      ${usual ? `<p class="muted small">${usual}</p>` : ''}` : (Array.isArray(st.tw) ? `<p class="muted small">${esc(f.name)} hat in den letzten 8 Wochen noch nicht trainiert.</p>` : '<p class="muted small">Trainingszeiten sieht man, sobald ' + esc(f.name) + ' die neue Version nutzt und sie freigegeben hat.</p>')}
    <h3 class="sheet-h">Vergleich</h3>
    <ul class="cmp-list">
      <li class="cmp head"><span class="cmp-l"></span><b>Du</b><b>${esc(f.name)}</b></li>
      ${row('Trainings (4 Wo.)', me.w4, f.stats.w4)}
      ${row('Harte Sätze (4 Wo.)', me.x4, f.stats.x4)}
      ${row('Streak', me.s, f.stats.s)}
      ${row('Beste Streak', me.b, f.stats.b)}
      ${Object.entries(BIG3).map(([k, n]) => row(`${n} (1RM)`, me.e[k], f.stats.e?.[k], kg)).join('')}
      ${row('Gym geskippt (4 Wo.)', me.m4, f.stats.m4, (v) => (v == null ? '–' : `${v}×`), true)}
      ${row('Sätze ausgelassen', pct(me), pct(f.stats), (v) => (v == null ? '–' : `${v} %`), true)}
      ${row('Ø Kalorien/Tag (7 T.)', me.fk, f.stats.fk, (v) => (v == null ? '–' : fmtBig(v)))}
      ${row('Ø Protein/Tag (7 T.)', me.fp, f.stats.fp, (v) => (v == null ? '–' : `${v} g`))}
      ${row('Körpergewicht', me.bw, f.stats.bw, kg)}
      ${row('Koffein (7 Tage)', me.c7, f.stats.c7, (v) => (v == null ? '–' : `${v} mg`))}
    </ul>
    ${f.stats.dr?.length ? `<p class="muted small">${esc(f.name)} trinkt am meisten: ${f.stats.dr.map(([n, c]) => `${esc(n)} (${c}×)`).join(', ')}</p>` : ''}
    <div class="sheet-actions"><button class="btn ghost big danger" data-action="del">Aus Rangliste entfernen</button></div>`, {
    zoom: () => zoomAvatar(f.name, f.img),
    del: async () => {
      closeSheet();
      if (!(await ask(`${f.name} entfernen?`, 'Mit einem neuen Link kannst du ihn jederzeit wieder hinzufügen.', 'Entfernen', true))) return;
      removeFriend(id);
      render();
    },
  });
}

// ---------- Energy-Drinks ----------


function openDrinkSheet() {
  const { recent, all } = drinkChoices();
  const list = [...recent, ...all.filter((d) => !recent.some((r) => r.name === d.name))];
  const item = (d) => { const n = nutrOf(d); return `<button class="drink" data-action="log" data-i="${list.indexOf(d)}" data-id="${esc(d.id)}">
    <span class="drink-name">${esc(d.name)}</span><span class="drink-meta">${d.ml ? `${d.ml} ml · ` : ''}<b>${d.mg} mg</b>${n && d.ml ? ` · ${Math.round(n.kcal * d.ml / 100)} kcal` : ''}</span></button>`; };
  const todayList = todayDrinks().slice().reverse().map((x) => `<li><span>${esc(x.name)} <span class="muted small">${new Date(x.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></span>
    <span class="muted small">${x.mg} mg</span><button class="icon-btn sm" data-action="undo" data-id="${esc(x.id)}" aria-label="Löschen">${ICON.x}</button></li>`).join('');
  openSheet(`<h2 class="sheet-title">Drink eintragen</h2>
    ${canScan() ? `<button class="btn big full scan-drink" data-action="scan">${ICON.barcode} Dose scannen</button>` : ''}
    ${recent.length ? `<h3 class="sheet-h">Zuletzt</h3><div class="drinks">${recent.map(item).join('')}</div>` : ''}
    <h3 class="sheet-h">Alle</h3><div class="drinks">${all.filter((d) => !recent.some((r) => r.name === d.name)).map(item).join('')}</div>
    <h3 class="sheet-h">Eigenes Getränk</h3>
    <div class="add-row">
      <input id="dName" class="input" placeholder="Name" maxlength="30" autocomplete="off">
      <input id="dMg" class="input mg-input" placeholder="mg" inputmode="numeric" autocomplete="off" data-enter="logCustom">
      <button class="btn" data-action="logCustom">+</button>
    </div>
    ${todayList ? `<h3 class="sheet-h">Heute</h3><ul class="plain-list">${todayList}</ul>` : ''}`, {
    log: (el) => {
      const d = list[+el.dataset.i];
      // Kalorien unbekannt → einmal nachfragen (wird gemerkt)
      if (!nutrOf(d) || !d.ml) return openDrinkScanSheet({ ...d, preset: true });
      const r = logDrink(d);
      closeSheet(); afterLog(d.mg, d.name, r.kcal);
    },
    logCustom: () => {
      const name = document.getElementById('dName').value.trim();
      const mg = parseNum(document.getElementById('dMg').value);
      if (!name || Number.isNaN(mg) || mg == null || mg > 1000) return toast('Name und Koffein in mg eingeben (z. B. 160)');
      openDrinkScanSheet({ id: 'custom:' + name.toLowerCase(), name, mg: Math.round(mg), ml: null, preset: true, nutr: nutrOf({ id: 'custom:' + name.toLowerCase(), name }) });
    },
    undo: (el) => { removeDrink(el.dataset.id); closeSheet(); render(); },
    scan: () => scanCode({ onCode: lookupDrink, onCancel: openDrinkSheet }),
  });
}

async function lookupDrink(code) {
  toast('Suche Getränk …');
  const d = await drinkByCode(code);
  openDrinkScanSheet(d || { code, name: '', ml: 500, caf: TYPICAL_MG_100, mg: Math.round(TYPICAL_MG_100 * 5), known: false });
}

/** Drink bestätigen (gescannt, eigener oder Liste ohne bekannte Kalorien): Name, ml, Koffein, kcal je 100 ml. */
function openDrinkScanSheet(d) {
  const n = d.nutr || nutrOf(d);
  const per100 = () => { const ml = parseNum(document.getElementById('sdMl')?.value), mg = parseNum(document.getElementById('sdMg')?.value); return ml > 0 && mg >= 0 ? Math.round(mg / ml * 1000) / 10 : null; };
  const info = () => {
    const ml = parseNum(document.getElementById('sdMl')?.value), k = parseNum(document.getElementById('sdKcal')?.value);
    const v = per100();
    return [v != null ? `= ${v} mg Koffein pro 100 ml` : '', ml > 0 && k >= 0 ? `${Math.round(k * ml / 100)} kcal für die ganze Flasche` : ''].filter(Boolean).join(' · ');
  };
  const sub = d.preset ? (n ? '' : 'Einmal die Kalorien von der Dose eintragen (zuckerfrei = 0) – danach zählt der Drink automatisch auch im Kalorienrechner.')
    : d.known ? (d.source === 'mine' ? 'Schon mal gescannt.' : 'Koffein laut Datenbank.')
    : d.name ? `Koffein nicht in der Datenbank – Vorschlag ${TYPICAL_MG_100} mg/100 ml (EU-üblich für Energy-Drinks). <b>Bitte mit der Dose vergleichen.</b>`
    : `Unbekannter Barcode ${esc(d.code)} – einmal eintragen, dann kennt die App die Dose.`;
  openSheet(`<h2 class="sheet-title">${d.name ? esc(d.name) : 'Neues Getränk'}</h2>
    ${sub ? `<p class="muted small sheet-sub">${sub}</p>` : ''}
    <label class="gfield"><span>Name</span><input id="sdName" value="${esc(d.name || '')}" placeholder="z. B. Monster Mango Loco" maxlength="40" autocomplete="off"></label>
    <div class="two-col">
      <label class="gfield"><span>Menge (ml)</span><input id="sdMl" inputmode="numeric" value="${d.ml || ''}" placeholder="z. B. 500" autocomplete="off" data-input="sd"></label>
      <label class="gfield"><span>Koffein gesamt (mg)</span><input id="sdMg" inputmode="numeric" value="${d.mg ?? ''}" placeholder="160" autocomplete="off" data-input="sd"></label>
      <label class="gfield"><span>kcal pro 100 ml</span><input id="sdKcal" inputmode="decimal" value="${n?.kcal ?? ''}" placeholder="z. B. 46 · zuckerfrei 0" autocomplete="off" data-input="sd"></label>
      <label class="gfield"><span>Zucker pro 100 ml (g)</span><input id="sdSug" inputmode="decimal" value="${n?.sug ?? ''}" placeholder="z. B. 11" autocomplete="off"></label>
    </div>
    <p class="muted small" id="sdPer"></p>
    <div class="sheet-actions"><button class="btn primary big" data-action="save">Eintragen</button></div>`, {
    inputs: { sd: () => { document.getElementById('sdPer').textContent = info(); } },
    save: () => {
      const name = document.getElementById('sdName').value.trim();
      const ml = parseNum(document.getElementById('sdMl').value);
      const mg = parseNum(document.getElementById('sdMg').value);
      const kcal = parseNum(document.getElementById('sdKcal').value);
      const sug = parseNum(document.getElementById('sdSug').value);
      if (!name) return toast('Name eingeben');
      if (!(ml >= 20 && ml <= 2000)) return toast('Menge in ml eintragen (steht auf der Flasche)');
      if (mg == null || Number.isNaN(mg) || mg < 0 || mg > 1000) return toast('Koffein in mg eingeben (z. B. 160)');
      if (kcal == null || Number.isNaN(kcal) || kcal < 0 || kcal > 400) return toast('kcal pro 100 ml eintragen (zuckerfrei = 0)');
      const s2 = sug == null || Number.isNaN(sug) ? (n?.sug ?? Math.round(kcal / 4 * 10) / 10) : sug;
      const nutr = { ...(n || {}), kcal: Math.round(kcal * 10) / 10, sug: s2, c: Math.max(n?.c ?? 0, s2) };
      let e;
      if (d.code) e = { id: 'scan:' + d.code, ...rememberDrink({ ...d, name, ml, mg, nutr }) };
      else { e = { id: d.id || 'custom', name, ml: Math.round(ml), mg: Math.round(mg) }; setDrinkNutr(d.id || name, nutr); }
      const r = logDrink({ id: e.id, name: e.name, ml: e.ml, mg: e.mg, nutr });
      closeSheet(); afterLog(e.mg, e.name, r.kcal);
    },
  });
  setTimeout(() => { const el = document.getElementById('sdPer'); if (el) el.textContent = info(); }, 0);
}

function afterLog(mg, name, kcal = null) {
  const today = mgOf(todayDrinks());
  const k = kcal != null ? ` · ${kcal} kcal im Kalorienrechner` : '';
  toast(today > DAILY_LIMIT ? `${name} eingetragen – heute ${today} mg, über dem Richtwert${k}` : `${name} · ${mg} mg${k}`);
  publishMe(true);
  render();
}

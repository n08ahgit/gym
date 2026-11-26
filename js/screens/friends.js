// =============================================================
// friends.js (Screen) – Tab "Freunde": Rangliste, eigenen Stand teilen,
// Freund per kurzem Code (z. B. K7Q2MX) oder Link hinzufügen.
// Stände werden beim Öffnen automatisch vom Server aktualisiert.
// =============================================================

import { render, ui, openSheet, closeSheet, ask, toast } from '../app.js';
import { data, save } from '../store.js';
import { esc, fmtNum, fmtBig } from '../util.js';
import { BOARDS, BIG3, leaderboard, myStats, decodeFriend, upsertFriend, removeFriend, shortCode, shortLink, publishMe, fetchFriend, parseShort, refreshFriends, linkTo } from '../friends.js';
import { DAILY_LIMIT, logDrink, removeDrink, todayDrinks, mgOf, caffeineStats, drinkChoices } from '../drinks.js';
import { parseNum, fmtClock } from '../util.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';

const ago = (t) => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
};

function fmtValue(key, v) {
  if (v == null) return '–';
  if (key === 'volume') return v >= 10000 ? `${fmtNum(Math.round(v / 100) / 10)} t` : `${fmtBig(v)} kg`;
  if (key === 'strength') return `${fmtNum(Math.round(v * 100) / 100)}×`;
  return String(v);
}

function gapText(key, rows) {
  const i = rows.findIndex((r) => r.me);
  const me = rows[i];
  if (rows.length < 2) return '';
  if (me.value == null) return key === 'strength' ? 'Für die Kraft-Wertung brauchst du Bankdrücken, Kniebeuge, Kreuzheben (letzte 90 Tage) und dein Körpergewicht.' : '';
  if (i === 0) {
    const second = rows[1];
    if (second.value == null) return 'Du führst.';
    const d = me.value - second.value;
    return d === 0 ? `Gleichstand mit ${esc(second.name)}.` : `Du führst mit ${fmtValue(key, d)} ${key === 'strength' || key === 'volume' ? '' : BOARDS[key].unit} Vorsprung vor ${esc(second.name)}.`;
  }
  const ahead = rows[i - 1];
  const d = ahead.value - me.value;
  return `Platz ${i + 1} · ${fmtValue(key, d)} ${key === 'strength' || key === 'volume' ? '' : BOARDS[key].unit} hinter ${esc(ahead.name)}.`;
}

export const friendsScreen = {
  render(params) {
    const key = params.board || 'consistency';
    const rows = leaderboard(key);
    const seg = `<div class="seg-wrap seg-5" role="tablist" aria-label="Wertung">${Object.entries(BOARDS)
      .map(([k, b]) => `<button class="seg-item${k === key ? ' on' : ''}" role="tab" aria-selected="${k === key}" data-action="board" data-k="${k}">${b.label}</button>`)
      .join('')}</div>`;

    const list = rows.map((r, i) => `
      <button class="list-row rank-row${r.me ? ' me' : ''}" data-action="${r.me ? 'noop' : 'friend'}" data-id="${esc(r.id)}">
        <span class="rank">${r.value == null ? '–' : i + 1}</span>
        <span class="lr-main"><span class="lr-title">${esc(r.name)}${r.me ? ' <span class="you">Du</span>' : ''}</span>
          <span class="lr-sub">${r.me ? 'aktueller Stand' : `Stand ${ago(r.t)}`}</span></span>
        <span class="lr-value">${fmtValue(key, r.value)}${key !== 'volume' && key !== 'strength' && r.value != null ? `<small> ${BOARDS[key].unit}</small>` : ''}</span>
      </button>`).join('');

    const noFriends = !data.friends.length;
    return `<main class="content no-title has-tabbar friends">
      <section class="card">
        <div class="card-head"><h2>Rangliste</h2><span class="muted small">${BOARDS[key].sub}</span></div>
        <div class="filter-row tight">${seg}</div>
        ${list}
        ${noFriends ? '<p class="note">Noch keine Freunde. Schick deinen Code per WhatsApp – fügt ihr euch gegenseitig hinzu, seht ihr euch in der Rangliste. Die Zahlen aktualisieren sich danach von selbst.</p>'
          : `<p class="note">${gapText(key, rows)}</p>`}
      </section>

      ${caffeineCard()}

      <section class="card">
        <div class="card-head"><h2>Freund hinzufügen</h2></div>
        <div class="add-row">
          <input id="fcode" class="input code-input" placeholder="Code, z. B. K7Q2MX" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="addFriend">
          <button class="btn" data-action="addFriend">Hinzufügen</button>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Dein Code</h2></div>
        <label class="label first" for="pname">Dein Name in der Rangliste</label>
        <input id="pname" class="input" data-input="pname" value="${esc(data.profile.name)}" placeholder="z. B. Alex" maxlength="24" autocomplete="off">
        ${data.profile.name ? `<button class="my-code" data-action="copyCode" aria-label="Code kopieren"><span class="my-code-val">${shortCode()}</span><span class="muted small">Antippen zum Kopieren</span></button>` : ''}
        <button class="btn primary big full" data-action="share">${ICON.share} Einladung per WhatsApp & Co.</button>
        <p class="note">Freunde sehen nur deinen Namen und Kennzahlen (Trainings, Streak, Volumen, Kraftwerte) – keine einzelnen Workouts.</p>
      </section>
    </main>${tabBar('friends')}`;
  },

  after() {
    // Eigenen Stand hochladen, Freunde aktualisieren (still im Hintergrund)
    publishMe();
    refreshFriends().then((changed) => { if (changed && ui.screen === 'friends' && !document.querySelector('#fcode:focus, #pname:focus')) render(); });
  },

  inputs: {
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
  },
};

let nameTimer;

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
  const row = (label, a, b, fmt = (v) => (v == null ? '–' : String(v))) => {
    const lead = a != null && b != null && a !== b ? (a > b ? 'me' : 'them') : '';
    return `<li class="cmp"><span class="cmp-l">${label}</span><b class="${lead === 'me' ? 'lead' : ''}">${fmt(a)}</b><b class="${lead === 'them' ? 'lead' : ''}">${fmt(b)}</b></li>`;
  };
  const kg = (v) => (v ? `${fmtNum(v)} kg` : '–');
  openSheet(`<h2 class="sheet-title">${esc(f.name)}</h2>
    <p class="muted small">Stand ${ago(f.t)} · zum Aktualisieren neuen Link schicken lassen</p>
    <ul class="cmp-list">
      <li class="cmp head"><span class="cmp-l"></span><b>Du</b><b>${esc(f.name)}</b></li>
      ${row('Trainings (4 Wo.)', me.w4, f.stats.w4)}
      ${row('Harte Sätze (4 Wo.)', me.x4, f.stats.x4)}
      ${row('Streak', me.s, f.stats.s)}
      ${row('Beste Streak', me.b, f.stats.b)}
      ${Object.entries(BIG3).map(([k, n]) => row(`${n} (1RM)`, me.e[k], f.stats.e?.[k], kg)).join('')}
      ${row('Körpergewicht', me.bw, f.stats.bw, kg)}
      ${row('Koffein (7 Tage)', me.c7, f.stats.c7, (v) => (v == null ? '–' : `${v} mg`))}
    </ul>
    ${f.stats.dr?.length ? `<p class="muted small">${esc(f.name)} trinkt am meisten: ${f.stats.dr.map(([n, c]) => `${esc(n)} (${c}×)`).join(', ')}</p>` : ''}
    <div class="sheet-actions"><button class="btn ghost big danger" data-action="del">Aus Rangliste entfernen</button></div>`, {
    del: async () => {
      closeSheet();
      if (!(await ask(`${f.name} entfernen?`, 'Mit einem neuen Link kannst du ihn jederzeit wieder hinzufügen.', 'Entfernen', true))) return;
      removeFriend(id);
      render();
    },
  });
}

// ---------- Energy-Drinks ----------

function caffeineCard() {
  const today = mgOf(todayDrinks());
  const week = caffeineStats(7);
  const pct = Math.min(100, (today / DAILY_LIMIT) * 100);
  const over = today > DAILY_LIMIT;
  return `<section class="card caf-card">
    <div class="card-head"><h2>Energy-Drinks</h2><button class="chip" data-action="drinks">${ICON.plus} Drink</button></div>
    <div class="caf-row">
      <div><span class="caf-big">${today}</span><span class="muted small"> mg heute</span></div>
      <div class="muted small">${week.mg} mg · ${week.n} ${week.n === 1 ? 'Drink' : 'Drinks'} in 7 Tagen</div>
    </div>
    <div class="caf-bar${over ? ' over' : ''}"><i style="width:${pct}%"></i></div>
    <p class="note">${over ? `Über ${DAILY_LIMIT} mg – mehr gilt laut EFSA nicht mehr als unbedenklich. Für heute reicht's.` : `Richtwert: höchstens ${DAILY_LIMIT} mg pro Tag, 200 mg auf einmal (EFSA).`}</p>
  </section>`;
}

function openDrinkSheet() {
  const { recent, all } = drinkChoices();
  const item = (d) => `<button class="drink" data-action="log" data-id="${esc(d.id)}" data-name="${esc(d.name)}" data-mg="${d.mg}" data-ml="${d.ml || ''}">
    <span class="drink-name">${esc(d.name)}</span><span class="drink-meta">${d.ml ? `${d.ml} ml · ` : ''}<b>${d.mg} mg</b></span></button>`;
  const todayList = todayDrinks().slice().reverse().map((x) => `<li><span>${esc(x.name)} <span class="muted small">${new Date(x.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></span>
    <span class="muted small">${x.mg} mg</span><button class="icon-btn sm" data-action="undo" data-id="${esc(x.id)}" aria-label="Löschen">${ICON.x}</button></li>`).join('');
  openSheet(`<h2 class="sheet-title">Drink eintragen</h2>
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
      logDrink({ id: el.dataset.id, name: el.dataset.name, mg: +el.dataset.mg, ml: +el.dataset.ml || null });
      closeSheet(); afterLog(+el.dataset.mg, el.dataset.name);
    },
    logCustom: () => {
      const name = document.getElementById('dName').value.trim();
      const mg = parseNum(document.getElementById('dMg').value);
      if (!name || !mg || Number.isNaN(mg) || mg > 1000) return toast('Name und Koffein in mg eingeben (z. B. 160)');
      logDrink({ id: 'custom', name, mg: Math.round(mg) });
      closeSheet(); afterLog(Math.round(mg), name);
    },
    undo: (el) => { removeDrink(el.dataset.id); closeSheet(); render(); },
  });
}

function afterLog(mg, name) {
  const today = mgOf(todayDrinks());
  toast(today > DAILY_LIMIT ? `${name} eingetragen – heute ${today} mg, über dem Richtwert` : `${name} · ${mg} mg eingetragen (heute ${today} mg)`);
  publishMe(true);
  render();
}

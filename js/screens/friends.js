// =============================================================
// friends.js (Screen) – Tab "Freunde": Rangliste, eigenen Stand teilen,
// Freund per Link/Code hinzufügen.
// =============================================================

import { render, ui, openSheet, closeSheet, ask, toast } from '../app.js';
import { data, save } from '../store.js';
import { esc, fmtNum, fmtBig } from '../util.js';
import { BOARDS, BIG3, leaderboard, myLink, myStats, decodeFriend, upsertFriend, removeFriend } from '../friends.js';
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
    const seg = `<div class="seg-wrap seg-4" role="tablist" aria-label="Wertung">${Object.entries(BOARDS)
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
        ${noFriends ? '<p class="note">Noch keine Freunde. Teile deinen Link – öffnet ihn jemand mit dieser App, erscheint ihr gegenseitig in der Rangliste, sobald er seinen Link zurückschickt.</p>'
          : `<p class="note">${gapText(key, rows)}</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h2>Dein Stand</h2></div>
        <label class="label first" for="pname">Dein Name in der Rangliste</label>
        <input id="pname" class="input" data-input="pname" value="${esc(data.profile.name)}" placeholder="z. B. Alex" maxlength="24" autocomplete="off">
        <button class="btn primary big full" data-action="share">${ICON.share} Stand teilen</button>
        <p class="note">Geteilt werden nur Name und Kennzahlen (Trainings, Streak, Volumen, Kraftwerte) – keine einzelnen Workouts. Kein Server: dein Stand aktualisiert sich bei Freunden, wenn du den Link neu schickst.</p>
      </section>

      <section class="card">
        <div class="card-head"><h2>Freund hinzufügen</h2></div>
        <p class="muted small">Link öffnen genügt. Oder Code bzw. Link hier einfügen:</p>
        <div class="add-row">
          <input id="fcode" class="input" placeholder="Link oder Code" autocomplete="off" autocapitalize="off" spellcheck="false" data-enter="addFriend">
          <button class="btn" data-action="addFriend">Hinzufügen</button>
        </div>
      </section>
    </main>${tabBar('friends')}`;
  },

  inputs: {
    pname: (el) => { data.profile.name = el.value.trim().slice(0, 24); save(); },
  },

  actions: {
    noop: () => {},
    board: (el) => { ui.params.board = el.dataset.k; render(); },
    share: async () => {
      if (!data.profile.name) {
        document.getElementById('pname').focus();
        return toast('Bitte zuerst deinen Namen eingeben');
      }
      const url = myLink();
      const text = `Mein Trainingsstand – öffne den Link mit deiner Gym-App, dann sind wir in der Rangliste:`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Gym-Rangliste', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { prompt('Link kopieren:', url); }
    },
    addFriend: () => {
      const el = document.getElementById('fcode');
      try {
        const res = addFromCode(el.value);
        if (res) { el.value = ''; render(); }
      } catch (e) { toast(e.message); }
    },
    friend: (el) => openFriend(el.dataset.id),
  },
};

/** Code/Link übernehmen und Rückmeldung geben. */
export function addFromCode(code) {
  const f = decodeFriend(code);
  const r = upsertFriend(f);
  if (r === 'self') { toast('Das ist dein eigener Link'); return false; }
  if (r === 'old') { toast(`Du hast schon einen neueren Stand von ${f.name}`); return false; }
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
    </ul>
    <div class="sheet-actions"><button class="btn ghost big danger" data-action="del">Aus Rangliste entfernen</button></div>`, {
    del: async () => {
      closeSheet();
      if (!(await ask(`${f.name} entfernen?`, 'Mit einem neuen Link kannst du ihn jederzeit wieder hinzufügen.', 'Entfernen', true))) return;
      removeFriend(id);
      render();
    },
  });
}

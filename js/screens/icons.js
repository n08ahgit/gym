// =============================================================
// icons.js – kleine Inline-SVG-Icons (stroke = currentColor)
// =============================================================

const svg = (d, w = 22) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chev: svg('<path d="M9 18l6-6-6-6"/>', 18),
  up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 20),
  down: svg('<path d="M12 5v14M19 12l-7 7-7-7"/>', 20),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>', 20),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
  minus: svg('<path d="M5 12h14"/>', 20),
  chevL: svg('<path d="M15 18l-6-6 6-6"/>', 20),
  shield: svg('<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>', 14),
  chevDown: svg('<path d="M6 9l6 6 6-6"/>', 18),
  chevR: svg('<path d="M9 18l6-6-6-6"/>', 20),
  check: svg('<path d="M20 6L9 17l-5-5"/>', 20),
  dumbbell: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
  arrowUp: svg('<path d="M12 19V6M6 11l6-6 6 6"/>', 12),
  arrowDown: svg('<path d="M12 5v13M6 13l6 6 6-6"/>', 12),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>', 18),
  share: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', 20),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/>', 20),
  plates: svg('<path d="M2 12h20"/><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="16" y="6" width="3" height="12" rx="1"/><rect x="8.5" y="8" width="2" height="8" rx="0.8"/><rect x="13.5" y="8" width="2" height="8" rx="0.8"/>', 20),
  award: svg('<circle cx="12" cy="9" r="6"/><path d="M8.5 13.9L7 22l5-3 5 3-1.5-8.1"/>', 20),
  scale: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8.5 9.5a5 5 0 0 1 7 0L13 12"/>', 20),
  food: svg('<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-1.7 0-3 2.2-3 5v4h3v9"/>'),
  barcode: svg('<path d="M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12"/>', 20),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', 20),
};

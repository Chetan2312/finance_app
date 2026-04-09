// ══════════════════════════════════════
// THEME — toggle, apply, chart updates
// ══════════════════════════════════════
import { S, charts, sv } from '../state.js';

export function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  applyTheme(S.theme);
  sv();
}

export function applyTheme(t) {
  document.body.setAttribute('data-theme', t);
  document.getElementById('theme-btn').textContent = t === 'dark' ? '☀️' : '🌙';
  Object.values(charts).forEach(c => {
    if (c) {
      const lc = t === 'dark' ? '#94a3b8' : '#475569';
      c.options.plugins.legend.labels.color = lc;
      c.update();
    }
  });
}

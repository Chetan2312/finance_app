// ══════════════════════════════════════
// MODALS — shared modal + emoji picker logic
// ══════════════════════════════════════
import { EMOJIS } from '../../data/defaults.js';

export function openMo(id) { document.getElementById(id).classList.add('on'); }
export function cmo() { document.querySelectorAll('.ovl').forEach(o => o.classList.remove('on')); }

export function initModalListeners() {
  document.querySelectorAll('.ovl').forEach(o => o.addEventListener('click', e => { if (e.target === o) cmo(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cmo(); });
}

export function buildEg(gid, getter, setter) {
  const el = document.getElementById(gid); if (!el) return;
  el.innerHTML = EMOJIS.map(e => `<div class="eo ${e === getter() ? 'on' : ''}" onclick="pickEm(this,'${e}','${gid}')">${e}</div>`).join('');
  el._setter = setter;
}

export function pickEm(el, e, gid) {
  document.getElementById(gid)?._setter?.(e);
  document.getElementById(gid)?.querySelectorAll('.eo').forEach(x => x.classList.remove('on'));
  el.classList.add('on');
}

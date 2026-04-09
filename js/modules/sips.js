// ══════════════════════════════════════
// SIPs — SIP cards, CRUD, chart, summary
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { COLS, RISK_LVL, CAT_ICO } from '../../data/defaults.js';
import { S, charts, sv, sipFV } from '../state.js';
import { openMo, cmo } from './modals.js';

let rcFn = () => {};
export function setRcFn(fn) { rcFn = fn; }

export function openSIPModal(id) {
  document.getElementById('sip-eid').value = id || '';
  document.getElementById('mo-sip-t').textContent = id ? '✏️ Edit SIP' : '📈 Add SIP';
  if (id) {
    const s = S.sips.find(x => x.id === id);
    if (s) { document.getElementById('sip-fn').value = s.name; document.getElementById('sip-am').value = s.amt; document.getElementById('sip-ct').value = s.cat; document.getElementById('sip-do').value = s.done || 0; document.getElementById('sip-iv').value = s.invested || 0; document.getElementById('sip-cv').value = s.curval || 0; document.getElementById('sip-rt').value = s.ret || 12; document.getElementById('sip-pl').value = s.plan || 60; }
  } else {
    ['sip-fn', 'sip-am', 'sip-do', 'sip-iv', 'sip-cv', 'sip-pl'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('sip-rt').value = '12'; document.getElementById('sip-ct').value = 'large';
  }
  openMo('mo-sip');
}

export function saveSIP() {
  const nm = document.getElementById('sip-fn').value.trim(), amt = parseFloat(document.getElementById('sip-am').value) || 0;
  if (!nm || !amt) { alert('Enter name and amount'); return; }
  const obj = { name: nm, amt, cat: document.getElementById('sip-ct').value, done: parseInt(document.getElementById('sip-do').value) || 0, invested: parseFloat(document.getElementById('sip-iv').value) || 0, curval: parseFloat(document.getElementById('sip-cv').value) || 0, ret: parseFloat(document.getElementById('sip-rt').value) || 12, plan: parseInt(document.getElementById('sip-pl').value) || 60 };
  const eid = document.getElementById('sip-eid').value;
  if (eid) { const s = S.sips.find(x => x.id === eid); if (s) Object.assign(s, obj); }
  else S.sips.push({ id: 'sip' + Date.now(), ...obj, color: COLS[(S.sips.length + 3) % COLS.length] });
  cmo(); sv(); renderSIPs(); rcFn();
}

export function rmSIP(id) {
  if (!confirm('Remove SIP?')) return;
  S.sips = S.sips.filter(s => s.id !== id); sv(); renderSIPs(); rcFn();
}

export function renderSIPs() {
  sipSummary();
  const el = document.getElementById('sip-list');
  if (!S.sips.length) { el.innerHTML = '<div class="empty"><span class="empty-ic">📈</span>No SIPs yet.</div>'; return; }
  el.innerHTML = S.sips.map(sip => {
    const fv = sipFV(sip.curval || 0, sip.amt, sip.plan, sip.ret);
    const fi = (sip.invested || 0) + sip.amt * sip.plan;
    const fg = fv - fi;
    const g = (sip.curval || 0) - (sip.invested || 0);
    const gp = sip.invested > 0 ? g / sip.invested * 100 : 0;
    const rl = RISK_LVL[sip.cat] || 3;
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="rdot ${i < rl ? 'on ' + (rl > 3 ? 'h' : rl > 2 ? 'm' : '') : ''}"></span>`).join('');
    return `<div class="sipcard"><div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.65rem"><div style="width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:.88rem;background:${sip.color}15;color:${sip.color};flex-shrink:0">${CAT_ICO[sip.cat] || '📈'}</div><div style="flex:1"><div class="fw7" style="font-size:.85rem;font-family:var(--fd);letter-spacing:-.01em">${sip.name}</div><div class="xxs c-muted">${sip.cat?.toUpperCase()} · ${sip.ret}% p.a.</div></div><div class="rdots">${dots}</div><button class="btn bg bsm" onclick="openSIPModal('${sip.id}')">✏️</button><button class="btn bd bsm" onclick="rmSIP('${sip.id}')">✕</button></div>
  <div class="sip-sts"><div class="sip-st"><div class="sip-stl">Monthly</div><div class="sip-stv c-p">${fmt(sip.amt)}</div></div><div class="sip-st"><div class="sip-stl">Months Done</div><div class="sip-stv">${sip.done || 0}</div></div><div class="sip-st"><div class="sip-stl">Invested</div><div class="sip-stv">${fmt(sip.invested || 0)}</div></div><div class="sip-st"><div class="sip-stl">Value</div><div class="sip-stv c-ok">${fmt(sip.curval || 0)}</div></div></div>
  <div class="sip-sts mt05"><div class="sip-st"><div class="sip-stl">Gain</div><div class="sip-stv" style="color:${g >= 0 ? 'var(--lime)' : 'var(--danger)'}">${g >= 0 ? '+' : ''}${fmt(g)}</div></div><div class="sip-st"><div class="sip-stl">Gain%</div><div class="sip-stv" style="color:${gp >= 0 ? 'var(--amber)' : 'var(--danger)'}">${gp.toFixed(1)}%</div></div><div class="sip-st"><div class="sip-stl">Plan</div><div class="sip-stv c-sky">${sip.plan}mo</div></div><div class="sip-st"><div class="sip-stl">Projected</div><div class="sip-stv c-warn">${fmt(fv)}</div></div></div>
  <div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.55rem;margin-top:.55rem"><div class="flex jb xxs c-muted"><span>Projection over ${sip.plan}mo</span><span class="c-warn">${fmt(fv)}</span></div><div class="sip-proj-bar mt05"><div class="spi" style="width:${Math.min(95, fi / fv * 100).toFixed(1)}%"></div><div class="spg" style="width:${Math.min(95, Math.max(0, fg / fv * 100)).toFixed(1)}%"></div></div><div class="flex jb" style="font-size:.58rem;color:var(--t3)"><span>■ Invested: ${fmt(fi)}</span><span>■ Gains: ${fmt(Math.max(0, fg))}</span></div></div></div>`;
  }).join('');
  sipChart();
}

export function sipSummary() {
  const ti = S.sips.reduce((s, x) => s + (x.invested || 0), 0), tv = S.sips.reduce((s, x) => s + (x.curval || 0), 0), tg = tv - ti, tp = ti > 0 ? tg / ti * 100 : 0;
  const fv = S.sips.reduce((s, x) => s + sipFV(x.curval || 0, x.amt, x.plan, x.ret), 0);
  document.getElementById('sip-ti').textContent = fmt(ti); document.getElementById('sip-tv').textContent = fmt(tv);
  document.getElementById('sip-tg').textContent = (tg >= 0 ? '+' : '') + fmt(tg); document.getElementById('sip-tp').textContent = tp.toFixed(1) + '%';
  document.getElementById('sip-proj').textContent = fmt(fv);
  document.getElementById('sip-projd').textContent = `Across ${S.sips.length} SIP${S.sips.length !== 1 ? 's' : ''}, next ${Math.max(0, ...S.sips.map(x => x.plan))}mo`;
  document.getElementById('ov-sipv').textContent = fmt(tv); document.getElementById('ov-sips').textContent = S.sips.length + ' SIP' + (S.sips.length !== 1 ? 's' : '');
}

function sipChart() {
  const ctx = document.getElementById('sip-chart'); if (charts.sip) charts.sip.destroy(); if (!S.sips.length) return;
  const mx = Math.min(120, Math.max(...S.sips.map(x => x.plan)));
  const pts = Math.min(9, Math.ceil(mx / 12) + 1);
  const labels = Array.from({ length: pts }, (_, i) => i === 0 ? 'Now' : (i * Math.ceil(mx / (pts - 1))) + 'mo');
  const inv = labels.map((_, i) => { const mo = i * Math.ceil(mx / (pts - 1)); return S.sips.reduce((s, x) => s + (x.invested || 0) + x.amt * Math.min(mo, x.plan), 0); });
  const proj = labels.map((_, i) => { const mo = i * Math.ceil(mx / (pts - 1)); return S.sips.reduce((s, x) => s + sipFV(x.curval || 0, x.amt, Math.min(mo, x.plan), x.ret), 0); });
  const isDark = S.theme === 'dark'; const lc = isDark ? '#94a3b8' : '#475569'; const gc = isDark ? '#252545' : '#e2e8f0';
  charts.sip = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Invested', data: inv, borderColor: '#7c73e6', backgroundColor: 'rgba(124,115,230,.1)', fill: true, tension: .4, borderWidth: 2, pointRadius: 3 }, { label: 'Projected', data: proj, borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,.07)', fill: true, tension: .4, borderWidth: 2, pointRadius: 3 }] }, options: { responsive: true, plugins: { legend: { labels: { color: lc, font: { family: 'JetBrains Mono', size: 10 } } } }, scales: { x: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 9 } }, grid: { color: gc } }, y: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 9 }, callback: v => fmt(v) }, grid: { color: gc } } } } });
}

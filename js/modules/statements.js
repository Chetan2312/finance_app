// ══════════════════════════════════════
// STATEMENTS — CSV bank statement parser and renderer
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S, charts } from '../state.js';

export function dov(e) { e.preventDefault(); document.getElementById('upz').classList.add('dg'); }
export function dol() { document.getElementById('upz').classList.remove('dg'); }
export function dod(e) { e.preventDefault(); dol(); const f = e.dataTransfer.files[0]; if (f) pStmt(f); }
export function hStmt(e) { if (e.target.files[0]) pStmt(e.target.files[0]); }

function pStmt(f) {
  const r = new FileReader();
  r.onload = e => parseStmt(e.target.result);
  r.readAsText(f);
}

function parseStmt(txt) {
  const lines = txt.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) { alert('Empty file'); return; }
  const dl = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map(l => l.split(dl).map(c => c.replace(/^["']|["']$/g, '').trim()));
  let hi = 0, dc = -1, nc = -1, dbc = -1, cc = -1, ac = -1;
  const dw = ['date', 'dt', 'txn date', 'value date'];
  const nw = ['description', 'narration', 'particulars', 'remarks'];
  const dbw = ['debit', 'dr', 'withdrawal'];
  const cw = ['credit', 'cr', 'deposit'];
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const h = rows[i].map(c => c.toLowerCase());
    if (h.some(c => dw.some(d => c.includes(d)))) {
      hi = i;
      dc = h.findIndex(c => dw.some(d => c.includes(d)));
      nc = h.findIndex(c => nw.some(d => c.includes(d)));
      dbc = h.findIndex(c => dbw.some(d => c.includes(d)));
      cc = h.findIndex(c => cw.some(d => c.includes(d)));
      ac = dbc === -1 && cc === -1 ? h.findIndex(c => c.includes('amount')) : -1;
      break;
    }
  }
  if (dc === -1) { alert('Cannot detect date column.'); return; }
  const txns = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[dc]) continue;
    const date = pdt(row[dc]);
    if (!date) continue;
    let deb = 0, cr = 0;
    if (dbc >= 0) deb = pam(row[dbc]);
    if (cc >= 0) cr = pam(row[cc]);
    if (ac >= 0) { const a = pam(row[ac]); if (a < 0) deb = Math.abs(a); else cr = a; }
    const desc = nc >= 0 ? row[nc] : '';
    if (deb > 0 || cr > 0) txns.push({ date, desc, deb, cr });
  }
  if (!txns.length) { alert('No transactions found.'); return; }

  const months = {};
  txns.forEach(t => {
    const k = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
    if (!months[k]) months[k] = { in: 0, out: 0, txns: [] };
    months[k].in += t.cr; months[k].out += t.deb; months[k].txns.push(t);
  });
  const sm = Object.keys(months).sort();
  const tIn = txns.reduce((s, t) => s + t.cr, 0);
  const tOut = txns.reduce((s, t) => s + t.deb, 0);
  const net = tIn - tOut;

  document.getElementById('st-in').textContent = fmt(tIn);
  document.getElementById('st-out').textContent = fmt(tOut);
  const ne = document.getElementById('st-net');
  ne.textContent = (net >= 0 ? '+' : '') + fmt(net);
  ne.className = 'kv ' + (net >= 0 ? 'c-ok' : 'c-dan');
  document.getElementById('st-avg').textContent = fmt(tOut / sm.length);
  document.getElementById('st-per').textContent = sm[0] + ' to ' + sm[sm.length - 1];

  // Chart
  if (charts.stmt) charts.stmt.destroy();
  const isDark = S.theme === 'dark';
  const lc = isDark ? '#94a3b8' : '#475569';
  const gc = isDark ? '#252545' : '#e2e8f0';
  charts.stmt = new Chart(document.getElementById('stmt-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: sm.map(m => { const [y, mo] = m.split('-'); return new Date(y, mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' }); }),
      datasets: [
        { label: 'Credit', data: sm.map(m => months[m].in), backgroundColor: 'rgba(45,212,191,.45)', borderColor: '#2dd4bf', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Debit', data: sm.map(m => months[m].out), backgroundColor: 'rgba(244,63,94,.45)', borderColor: '#f43f5e', borderWidth: 1.5, borderRadius: 4 },
      ],
    },
    options: { responsive: true, plugins: { legend: { labels: { color: lc, font: { family: 'JetBrains Mono', size: 10 } } } }, scales: { x: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 9 } }, grid: { color: gc } }, y: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 9 }, callback: v => fmt(v) }, grid: { color: gc } } } },
  });

  // Month-by-month table
  const maxV = Math.max(...Object.values(months).map(m => Math.max(m.in, m.out)));
  document.getElementById('stmt-mo').innerHTML = sm.map(m => {
    const mo = months[m];
    const [y, mo2] = m.split('-');
    const lbl = new Date(y, mo2 - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const n = mo.in - mo.out;
    return `<div style="display:flex;align-items:center;gap:.5rem;padding:.42rem 0;border-bottom:1px solid var(--b1)"><div class="fw7 xs" style="min-width:105px">${lbl}</div><div style="flex:1;display:flex;flex-direction:column;gap:3px"><div style="height:5px;border-radius:2px;background:var(--teal);width:${(mo.in / maxV * 100).toFixed(1)}%"></div><div style="height:5px;border-radius:2px;background:var(--rose);width:${(mo.out / maxV * 100).toFixed(1)}%"></div></div><div style="text-align:right;font-family:var(--fm);font-size:.6rem;min-width:88px"><div class="c-ok">+${fmt(mo.in)}</div><div class="c-dan">-${fmt(mo.out)}</div><div style="color:${n >= 0 ? 'var(--ok)' : 'var(--danger)'}">${n >= 0 ? '+' : ''}${fmt(n)}</div></div></div>`;
  }).join('');

  // Top debits
  const top = [...txns].sort((a, b) => b.deb - a.deb).slice(0, 8).filter(t => t.deb > 0);
  document.getElementById('stmt-top').innerHTML = top.map(t =>
    `<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--b1)"><div class="xxs c-muted mono" style="min-width:72px">${t.date.toLocaleDateString('en-IN')}</div><div style="flex:1;font-size:.77rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.desc || '—'}</div><div class="c-dan mono xs">-${fmt(t.deb)}</div></div>`
  ).join('');

  document.getElementById('stmt-res').style.display = 'block';
}

function pdt(s) {
  if (!s) return null;
  s = s.trim();
  let m, d;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; d = new Date(y, m[2] - 1, m[1]); if (!isNaN(d)) return d; }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) { d = new Date(m[1], m[2] - 1, m[3]); if (!isNaN(d)) return d; }
  d = new Date(s);
  return isNaN(d) ? null : d;
}

function pam(s) {
  if (!s && s !== 0) return 0;
  const n = parseFloat(String(s).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

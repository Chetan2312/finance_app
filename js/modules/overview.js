// ══════════════════════════════════════
// OVERVIEW — rc(), renderExpBars(), renderSnap()
// ══════════════════════════════════════
import { fmt, N } from '../utils.js';
import { S, charts, secTot, getTotalExp, calcPayoff, sipFV } from '../state.js';

// Callbacks injected by app.js after all modules load
let _sipSummary = () => {};
let _renderDebts = () => {};
let _renderDexStats = () => {};
let _updateBudget = () => {};

export function setOverviewFns({ sipSummary, renderDebts, renderDexStats, updateBudget }) {
  _sipSummary = sipSummary;
  _renderDebts = renderDebts;
  _renderDexStats = renderDexStats;
  _updateBudget = updateBudget;
}

export function rc() {
  const inc = N('s-inc'), xi = N('s-xi'), xp = N('s-xp');
  const totInc = inc + xi;
  const { total: exp, bd } = getTotalExp();
  const surp = totInc - exp - xp;
  const tD = S.debts.reduce((s, d) => s + d.balance, 0);
  const ioD = S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet').reduce((s, d) => s + d.balance, 0);
  const sipM = S.sips.reduce((s, x) => s + x.amt, 0);

  // Update section totals in expenses tab
  [...S.expSecs, ...S.custSecs].forEach(sec => {
    const el = document.getElementById('st-' + sec.id);
    if (el) el.textContent = fmt(secTot(sec));
  });
  const gt = document.getElementById('exp-gt');
  if (gt) gt.textContent = fmt(exp);

  // Overview KPIs
  document.getElementById('ov-inc').textContent = fmt(totInc);
  document.getElementById('ov-exp').textContent = fmt(exp);
  document.getElementById('ov-dbt').textContent = fmt(tD);
  const dbtS = document.getElementById('ov-dbts'); if (dbtS) dbtS.textContent = S.debts.length + ' debt' + (S.debts.length !== 1 ? 's' : '');
  const se = document.getElementById('ov-sp');
  se.textContent = fmt(surp);
  se.className = 'kv ' + (surp >= 0 ? 'c-ok' : 'c-dan');
  document.getElementById('ov-sps').textContent = surp >= 0 ? 'available' : '⚠️ OVERSPENDING';
  document.getElementById('ov-io').textContent = fmt(ioD);

  // Debt-free countdown
  const { results, months, totalInt } = calcPayoff(S.debts, xp);
  const { months: m0, totalInt: ti0 } = calcPayoff(S.debts, 0);
  const saved = ti0 - totalInt, mSaved = m0 - months;
  if (S.debts.filter(d => d.repay === 'emi' || !d.repay).length) {
    const fd = new Date();
    fd.setMonth(fd.getMonth() + months);
    const ds = fd.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const y = Math.floor(months / 12), mo = months % 12;
    document.getElementById('ov-fd').textContent = ds;
    document.getElementById('r-date').textContent = ds;
    document.getElementById('ov-fm').textContent = (y > 0 ? y + 'y ' : '') + mo + 'mo to go';
    document.getElementById('r-mo').textContent = (y > 0 ? y + 'y ' : '') + mo + 'mo';
  } else {
    document.getElementById('ov-fd').textContent = '—';
    document.getElementById('r-date').textContent = '—';
  }

  // Debt ring
  const tO = S.debts.filter(d => d.repay === 'emi' || !d.repay).reduce((s, d) => s + d.original, 0);
  const pO = tO - S.debts.filter(d => d.repay === 'emi' || !d.repay).reduce((s, d) => s + d.balance, 0);
  const pct = tO > 0 ? Math.min(100, pO / tO * 100) : 0;
  document.getElementById('r-dbt').style.strokeDashoffset = 327 - (327 * pct / 100);
  document.getElementById('r-pct').textContent = Math.round(pct) + '%';

  // Debt payoff timeline
  const tl = document.getElementById('ov-tl');
  if (tl) {
    if (results.length) {
      tl.innerHTML = results.map((r, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() + r.month);
        return `<div class="tli"><div class="tld ${i === 0 ? 'done' : ''}"></div><div class="tl-t">${r.name}</div><div class="tl-d">${d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })} · Mo ${r.month}</div></div>`;
      }).join('') + `<div class="tli"><div class="tld gold"></div><div class="tl-t c-warn">🎉 Debt Free!</div></div>`;
    } else {
      tl.innerHTML = '<div class="tli"><div class="tld"></div><div class="tl-t c-muted">Add EMI debts to see timeline</div></div>';
    }
  }

  // Debt callout
  const dc = document.getElementById('dbt-callout');
  if (dc) dc.innerHTML = xp > 0 && saved > 0
    ? `<div class="cb-ok xxs">✅ Extra ${fmt(xp)}/mo saves <strong>${fmt(saved)}</strong> interest &amp; ${mSaved} months!</div>`
    : `<div class="ib xxs">💡 Set extra payment in Overview to see impact.</div>`;

  // Delegate to other tabs
  renderExpBars(bd, totInc);
  renderSnap(bd);
  _updateBudget(totInc, exp, bd, xp, surp, sipM);
  _sipSummary();
  _renderDebts();
  _renderDexStats();
}

export function renderExpBars(bd, inc) {
  const el = document.getElementById('exp-bars');
  if (!el) return;
  const tot = Object.values(bd).reduce((s, b) => s + b.val, 0);
  if (!tot) { el.innerHTML = '<div class="empty xxs">Fill expenses to see breakdown</div>'; return; }
  el.innerHTML = Object.entries(bd).filter(([, b]) => b.val > 0).sort((a, b) => b[1].val - a[1].val).map(([, b]) => {
    const p = (b.val / tot * 100).toFixed(1), ip = inc > 0 ? (b.val / inc * 100).toFixed(1) : 0;
    return `<div style="margin-bottom:.62rem"><div class="flex jb ac xxs" style="margin-bottom:.25rem"><span>${b.icon} ${b.label}</span><span class="flex gap4 ac"><span class="mono c-muted" style="font-size:.57rem">${ip}% of income</span><span class="mono">${fmt(b.val)}</span></span></div><div class="pb"><div class="pbf" style="width:${p}%;background:${b.color}"></div></div></div>`;
  }).join('');
}

export function renderSnap(bd) {
  const el = document.getElementById('ov-snap');
  if (!el) return;
  const tot = Object.values(bd).reduce((s, b) => s + b.val, 0);
  if (!tot) { el.innerHTML = '<div class="empty xxs">Fill expenses in the Expenses tab</div>'; return; }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:.45rem">` +
    Object.entries(bd).filter(([, b]) => b.val > 0).map(([, b]) =>
      `<div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.58rem;text-align:center"><div style="font-size:1rem">${b.icon}</div><div class="mono" style="font-size:.78rem;margin:3px 0;color:${b.color}">${fmt(b.val)}</div><div class="xxs c-muted">${b.label}</div></div>`
    ).join('') + '</div>';
}

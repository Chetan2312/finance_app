// ══════════════════════════════════════
// BUDGET — updateBudget(), allocation plan, category comparison
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S } from '../state.js';
import { N, getTotalExp, calcPayoff } from '../state.js';

export function updateBudget(inc, exp, bd, xp, surp, sipM) {
  if (!inc) return;
  const sr = Math.max(0, surp / inc * 100);

  // Savings ring
  document.getElementById('r-sav').style.strokeDashoffset = 301 - (301 * Math.min(100, sr) / 100);
  document.getElementById('r-sav-p').textContent = Math.round(sr) + '%';
  document.getElementById('sav-vrd').textContent = sr >= 30
    ? '🌟 Excellent! Aggressive saving.'
    : sr >= 20 ? '✅ Good. Push to 30%?'
    : sr >= 10 ? '⚠️ Below 20% target.'
    : surp < 0 ? '🚨 Overspending!' : '🚨 Very low — cut spending.';

  // Income allocation bars
  const dp = S.debts.reduce((s, d) => s + d.emi, 0) + xp;
  const items = [
    { l: 'Housing',   v: bd.housing?.val   || 0, c: 'var(--p)'      },
    { l: 'Transport', v: bd.transport?.val  || 0, c: 'var(--sky)'    },
    { l: 'Food',      v: bd.food?.val       || 0, c: 'var(--amber)'  },
    { l: 'Family',    v: bd.family?.val     || 0, c: 'var(--coral)'  },
    { l: 'Health',    v: bd.health?.val     || 0, c: 'var(--teal)'   },
    { l: 'Lifestyle', v: bd.lifestyle?.val  || 0, c: 'var(--rose)'   },
    { l: 'EMI+Debt',  v: dp,                      c: 'var(--danger)' },
    { l: 'SIP',       v: sipM,                    c: 'var(--sky)'    },
    { l: 'Surplus',   v: Math.max(0, surp),        c: 'var(--ok)'    },
  ].filter(x => x.v > 0);

  document.getElementById('bgt-bars').innerHTML = items.map(x => {
    const p = (x.v / inc * 100).toFixed(1);
    return `<div style="margin-bottom:.62rem"><div class="flex jb ac xxs" style="margin-bottom:.25rem"><span>${x.l}</span><span class="flex gap4 ac"><span class="mono c-muted" style="font-size:.58rem">${p}%</span><span class="mono">${fmt(x.v)}</span></span></div><div class="pb"><div class="pbf" style="width:${Math.min(100, p)}%;background:${x.c}"></div></div></div>`;
  }).join('');

  // Smart allocation plan
  if (S.debts.length && surp > 0) {
    const td = S.strat === 'avalanche'
      ? S.debts.reduce((a, b) => b.rate > a.rate ? b : a)
      : S.debts.reduce((a, b) => a.balance < b.balance ? a : b);
    const sv2 = N('s-sav');
    const et = exp * 6;
    const eg = Math.max(0, et - sv2);
    const ea = eg > 0 ? Math.min(surp * .2, eg) : 0;
    const da = surp * .6;
    const inv = Math.max(0, surp - ea - da - sipM);

    document.getElementById('alloc-plan').innerHTML = `<div class="g3" style="gap:.7rem;margin-bottom:.8rem">
    <div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.9rem;text-align:center;border-top:2px solid var(--amber)"><div style="font-size:1.15rem">🛡️</div><div style="font-family:var(--fd);font-size:.95rem;font-weight:900;color:var(--amber);margin:3px 0">${fmt(ea)}<span class="xxs c-muted">/mo</span></div><div class="xxs c-muted">Emergency Fund</div></div>
    <div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.9rem;text-align:center;border-top:2px solid var(--p)"><div style="font-size:1.15rem">🔥</div><div style="font-family:var(--fd);font-size:.95rem;font-weight:900;color:var(--p2);margin:3px 0">${fmt(da)}<span class="xxs c-muted">/mo</span></div><div class="xxs c-muted">Debt Accel → ${td.name}</div></div>
    <div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.9rem;text-align:center;border-top:2px solid var(--teal)"><div style="font-size:1.15rem">📈</div><div style="font-family:var(--fd);font-size:.95rem;font-weight:900;color:var(--teal);margin:3px 0">${fmt(inv)}<span class="xxs c-muted">/mo</span></div><div class="xxs c-muted">New Investments</div></div>
  </div><div class="ib xxs">💡 Extra on <strong style="color:var(--p2)">${td.name}</strong> (${td.rate}%) = guaranteed ${td.rate}% return. After payoff, redirect EMI to SIP immediately.</div>`;
  } else {
    document.getElementById('alloc-plan').innerHTML = `<div class="empty xxs">${!S.debts.length ? 'Add debts to see allocation plan.' : surp <= 0 ? 'Fix overspending first.' : 'Loading...'}</div>`;
  }

  // Category vs recommended
  const REC = { housing: .30, transport: .10, food: .15, family: .10, health: .05, lifestyle: .05 };
  document.getElementById('cat-cmp').innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem">` +
    Object.entries(REC).map(([k, r]) => {
      const b = bd[k];
      const a = b?.val || 0;
      const ra = inc * r;
      const over = a > ra && a > 0;
      return `<div style="background:var(--bg2);border:1.5px solid ${over ? 'rgba(244,63,94,.4)' : 'var(--b1)'};border-radius:var(--rm);padding:.78rem"><div class="flex jb ac" style="margin-bottom:.38rem"><span class="xs fw7" style="font-family:var(--fd)">${b?.icon || ''} ${b?.label || k}</span>${a > 0 ? `<span class="bdg ${over ? 'bdg-dan' : 'bdg-ok'}">${over ? 'Over' : '✓'}</span>` : ''}</div><div class="mono" style="font-size:.88rem;color:${over && a > 0 ? 'var(--danger)' : 'var(--t1)'}">${fmt(a)}</div><div class="xxs c-muted" style="margin-top:2px">Rec: ${fmt(ra)} (${(r * 100).toFixed(0)}%)</div><div class="pb" style="margin-top:5px"><div class="pbf" style="width:${Math.min(100, a / Math.max(ra, 1) * 100).toFixed(1)}%;background:${over && a > 0 ? 'var(--danger)' : 'var(--teal)'}"></div></div></div>`;
    }).join('') + '</div>';
}

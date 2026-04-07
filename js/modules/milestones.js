// ══════════════════════════════════════
// MILESTONES — genMilestones, renderIOSec, buildMsLocal, renderMs
// Note: API calls removed in Phase 5. Local logic only for now.
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S } from '../state.js';
import { N, getTotalExp, calcPayoff, sipFV } from '../state.js';
import { DICONS, MS_COLS } from '../../data/defaults.js';

export async function genMilestones() {
  const inc = N('s-inc') + N('s-xi');
  const sav = N('s-sav');
  const xp = N('s-xp');
  const { total: exp } = getTotalExp();
  const surp = inc - exp - xp;
  const ioDs = S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet');
  const emiDs = S.debts.filter(d => d.repay === 'emi' || !d.repay);
  const sipV = S.sips.reduce((s, x) => s + (x.curval || 0), 0);

  renderIOSec(ioDs, sav, surp);
  if (!inc && !S.debts.length) return;
  buildMsLocal(surp, sav, ioDs, emiDs, sipV);

  // AI-enhanced milestones (Phase 6 will add API key input — left as stub)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1500,
        system: 'Indian finance coach. ONLY valid JSON.',
        messages: [{ role: 'user', content: `6 milestones JSON: {"hl":"sentence","ms":[{"num":1,"title":"...","desc":"...","when":"X months","amount":"₹X","type":"debt|save|invest|emergency|closure|freedom","urgency":"high|medium|low","action":"step"}]}\nIncome ₹${inc}/mo expenses ₹${exp}/mo surplus ₹${surp}/mo savings ₹${sav}.\nEMI debts: ${emiDs.map(d => d.name + ' ₹' + d.balance + '@' + d.rate + '%').join(', ') || 'none'}.\nIO loans: ${ioDs.map(d => d.name + ' ₹' + d.balance).join(', ') || 'none'}.` }],
      }),
    });
    const d = await res.json();
    const ms = JSON.parse((d.content?.[0]?.text || '{}').replace(/```\w*|```/g, '').trim());
    if (ms.hl) document.getElementById('ms-hl').textContent = '🎯 ' + ms.hl;
    if (ms.ms) renderMs(ms.ms);
  } catch (e) {}
}

function renderIOSec(io, sav, surp) {
  const ioEl = document.getElementById('io-sec');
  const ctEl = document.getElementById('cl-track');
  if (!io.length) {
    ioEl.innerHTML = '<div class="empty xxs">No interest-only loans. Add in Debts tab with "Interest-Only" repayment.</div>';
    ctEl.innerHTML = '<div class="empty xxs">No closure goals.</div>';
    return;
  }
  ioEl.innerHTML = io.map(d => {
    const mi = d.balance * d.rate / 100 / 12;
    return `<div style="background:var(--bg2);border:1.5px solid rgba(244,63,94,.35);border-radius:var(--rm);padding:.82rem;margin-bottom:.45rem"><div class="flex jb ac mb1"><div><div class="fw7 xs" style="font-family:var(--fd)">${DICONS[d.type] || '🏦'} ${d.name}</div><div class="xxs c-muted">${d.rate}% p.a.</div></div><span class="bdg bdg-dan">CLOSURE</span></div><div class="g2" style="gap:.42rem"><div style="background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--rs);padding:.42rem;text-align:center"><div class="xxs c-muted">Full Closure</div><div style="font-family:var(--fd);font-size:.92rem;font-weight:900;color:var(--danger)">${fmt(d.balance)}</div></div><div style="background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--rs);padding:.42rem;text-align:center"><div class="xxs c-muted">Monthly Interest</div><div style="font-family:var(--fd);font-size:.92rem;font-weight:900;color:var(--rose)">${fmt(mi)}</div></div></div><div class="cb-dan xxs mt05">Paying ${fmt(mi)}/mo with zero balance reduction.</div></div>`;
  }).join('');

  const tot = io.reduce((s, d) => s + d.balance, 0);
  const pct = tot > 0 ? Math.min(100, sav / tot * 100) : 0;
  const mo = surp > 0 ? Math.ceil((tot - Math.min(sav, tot)) / surp) : null;
  ctEl.innerHTML = `<div style="background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.88rem"><div class="kl">Closure Needed</div><div style="font-family:var(--fd);font-size:1.3rem;font-weight:900;color:var(--danger);margin-bottom:.38rem">${fmt(tot)}</div><div class="kl">Saved So Far</div><div style="font-family:var(--fd);font-size:1rem;font-weight:700;color:var(--ok);margin-bottom:.38rem">${fmt(sav)}</div>${surp > 0 ? `<div class="kl">Months to Goal</div><div style="font-family:var(--fd);font-size:1.2rem;font-weight:900;color:var(--amber);margin-bottom:.38rem">${mo ? mo + ' months' : 'surplus needed'}</div><div class="pb"><div class="pbf" style="width:${pct.toFixed(1)}%;background:var(--teal)"></div></div><div class="xxs c-muted mt05">${pct.toFixed(1)}% saved</div>` : '<div class="cb-dan xxs">No surplus for closure savings.</div>'}</div>`;
  document.getElementById('ov-io').textContent = fmt(tot);
}

function buildMsLocal(surp, sav, io, emi, sipV) {
  const ms = [];
  const { total: exp } = getTotalExp();
  const ef = exp * 6;
  if (sav < ef) ms.push({ num: 1, title: 'Build Emergency Fund', desc: `Target ${fmt(ef)} (6mo expenses). Currently ${fmt(sav)}.`, when: surp > 0 ? Math.ceil((ef - sav) / surp) + ' months' : '—', amount: fmt(ef), type: 'emergency', urgency: 'high', action: 'Open liquid mutual fund account' });
  io.forEach(d => ms.push({ num: ms.length + 1, title: 'Close: ' + d.name, desc: `Full ${fmt(d.balance)} due at closure. Currently wasting ${fmt(d.balance * d.rate / 100 / 12)}/mo on interest.`, when: surp > 0 ? Math.ceil(d.balance / Math.max(surp, 1)) + ' months' : '—', amount: fmt(d.balance), type: 'closure', urgency: 'high', action: `Recurring deposit of ${fmt(Math.min(surp, d.balance / 12))}/mo` }));
  if (emi.length) {
    const td = emi.reduce((a, b) => b.rate > a.rate ? b : a);
    const py = calcPayoff(S.debts, N('s-xp'));
    ms.push({ num: ms.length + 1, title: 'Pay Off: ' + td.name, desc: `${td.rate}% p.a. Clears ${fmt(td.emi)}/mo EMI upon payoff.`, when: py.months + ' months', amount: fmt(td.balance), type: 'debt', urgency: 'medium', action: `Add ${fmt(N('s-xp'))}/mo extra payment` });
  }
  if (S.sips.length) {
    const fv = S.sips.reduce((s, x) => s + sipFV(x.curval || 0, x.amt, x.plan, x.ret), 0);
    ms.push({ num: ms.length + 1, title: 'SIP Wealth Target', desc: `Portfolio projected to reach ${fmt(fv)}.`, when: 'Ongoing', amount: fmt(fv), type: 'invest', urgency: 'low', action: 'Never break SIPs — compounding needs time' });
  }
  if (emi.length) {
    const py = calcPayoff(S.debts, N('s-xp'));
    ms.push({ num: ms.length + 1, title: '🎉 Debt-Free Day', desc: `All EMIs cleared. Freeing ${fmt(emi.reduce((s, d) => s + d.emi, 0))}/mo for investments.`, when: py.months + ' months', amount: fmt(emi.reduce((s, d) => s + d.balance, 0)), type: 'freedom', urgency: 'medium', action: 'Redirect all freed EMIs to index funds' });
  }
  renderMs(ms);
}

function renderMs(ms) {
  document.getElementById('ms-cont').innerHTML = ms.map(m =>
    `<div class="mscard"><div class="ms-stripe" style="background:${MS_COLS[m.type] || 'var(--p)'}"></div><div class="ms-num">${m.num}</div><div class="flex gap4 ac" style="margin-bottom:.45rem"><span class="bdg ${m.urgency === 'high' ? 'bdg-dan' : m.urgency === 'medium' ? 'bdg-warn' : 'bdg-ok'}">${m.urgency?.toUpperCase()}</span><span class="bdg bdg-muted">${m.type?.toUpperCase()}</span></div><div class="ms-t" style="color:${MS_COLS[m.type] || 'var(--p)'}">${m.title}</div><div class="ms-d">${m.desc}</div><div class="ms-tags"><span class="bdg bdg-sky xxs">⏱ ${m.when}</span><span class="bdg bdg-warn xxs">💰 ${m.amount}</span><span class="bdg bdg-muted xxs" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">→ ${m.action || ''}</span></div></div>`
  ).join('');
}

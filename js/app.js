// ══════════════════════════════════════
// APP.JS — main entry module (Phase 4)
// Imports all tab modules, wires callbacks,
// contains: AI chat, Invest tab, navigation, init.
// ══════════════════════════════════════
import { today, N } from './utils.js';
import { DEF_SECS, DEF_DCATS } from '../data/defaults.js';
import { S, charts, sv, load, initSecs, initDCats } from './state.js';

// ── Phase 3 modules ──
import { openMo, cmo, initModalListeners, pickEm } from './modules/modals.js';
import { renderExp, togSec, openSecModal, saveSection, rmCustSec, openItemModal, saveItem, rmExpItem, setRcFn as setExpRc } from './modules/expenses.js';
import { renderDebts, upRepHint, openDebtModal, saveDebt, rmDebt, setSt, setRcFn as setDebtRc } from './modules/debts.js';
import { renderSIPs, sipSummary, openSIPModal, saveSIP, rmSIP, setRcFn as setSipRc } from './modules/sips.js';
import { renderDex, renderDexStats, renderCatMgr, renderDexSelects, buildMonthFilter, clearDexFilter, addDex, openDexEdit, saveDexEdit, rmDex, openDCatModal, saveDCat, rmDCat, setRcFn as setDailyRc } from './modules/daily.js';

// ── Phase 4 modules ──
import { toggleTheme, applyTheme } from './modules/theme.js';
import { rc, setOverviewFns } from './modules/overview.js';
import { updateBudget } from './modules/budget.js';
import { genReport, printReport, downloadPDF } from './modules/reports.js';
import { dov, dol, dod, hStmt } from './modules/statements.js';
import { genMilestones } from './modules/milestones.js';

// ══════════════════════════════════════
// INVEST TAB (Phase 5 will clean this up)
// ══════════════════════════════════════
import { mktLoaded, setMktLoaded, getTotalExp } from './state.js';

async function loadInvest() {
  if (mktLoaded) return;
  await loadMkt();
  await genInvPlan();
  setMktLoaded(true);
}

async function loadMkt() {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: 'Return ONLY valid JSON. No markdown.', messages: [{ role: 'user', content: `Indian market data JSON: {"nifty":"24800","ns":"+0.5%","sensex":"81200","ss":"+0.4%","bnifty":"52300","bs":"+0.2%","mid":"16800","ms":"+1.1%","gold":"73500","gs":"+0.3%","note":"Brief market note for ${new Date().toLocaleDateString('en-IN')}"}` }] }) });
    const d = await res.json();
    const m = JSON.parse((d.content?.[0]?.text || '{}').replace(/```\w*|```/g, '').trim());
    [['n', m.nifty, m.ns], ['s', m.sensex, m.ss], ['b', m.bnifty, m.bs], ['m', m.mid, m.ms], ['g', m.gold, m.gs]].forEach(([k, v, c]) => {
      const ve = document.getElementById('t-' + k), ce = document.getElementById('tc-' + k);
      if (ve) ve.textContent = v || '--';
      if (ce) { ce.textContent = c || ''; ce.style.color = c?.startsWith('+') ? 'var(--ok)' : 'var(--danger)'; }
    });
    if (m.note) document.getElementById('mkt-note').innerHTML = `📡 <strong>${new Date().toLocaleDateString('en-IN')}:</strong> ${m.note}`;
  } catch (e) {
    document.getElementById('mkt-note').textContent = '📡 Market data unavailable. Recommendations based on historical data.';
  }
}

async function genInvPlan() {
  const surplus = N('s-inc') + N('s-xi') - getTotalExp().total - N('s-xp');
  const tD = S.debts.reduce((s, d) => s + d.balance, 0);
  const ioD = S.debts.filter(d => d.repay === 'interest').reduce((s, d) => s + d.balance, 0);
  const sipM = S.sips.reduce((s, x) => s + x.amt, 0);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: 'SEBI advisor India. Return ONLY valid JSON.', messages: [{ role: 'user', content: `Plan JSON: {"steps":[{"num":1,"title":"...","desc":"...","action":"...","amount":"₹X/mo"}],"funds":[{"name":"...","category":"Large Cap","icon":"emoji","risk":"Low","returns_1y":"X%","returns_3y":"X%","returns_5y":"X%","min_sip":"₹X","reason":"...","rl":2}],"alloc":{"Equity":60,"Debt":20,"Gold":10,"Liquid":10},"ideas":[{"title":"...","desc":"...","potential":"₹X-Y/mo","effort":"Low"}]}\nsurplus ₹${surplus}/mo investable ₹${Math.max(0, surplus - sipM)}/mo debt ₹${tD} io-debt ₹${ioD} SIP ₹${sipM}/mo. Use real Indian funds.` }] }) });
    const d = await res.json();
    const plan = JSON.parse((d.content?.[0]?.text || '{}').replace(/```\w*|```/g, '').trim());
    renderInvPlan(plan);
  } catch (e) {
    document.getElementById('inv-steps').innerHTML = '<div class="cb-dan xxs">Could not generate plan.</div>';
  }
}

function renderInvPlan(plan) {
  const isDark = S.theme === 'dark';
  const lc = isDark ? '#94a3b8' : '#475569';
  if (plan.steps) document.getElementById('inv-steps').innerHTML = plan.steps.map(s => `<div class="step-c"><div class="step-n">${s.num}</div><div><div class="fw7 xs" style="font-family:var(--fd)">${s.title} <span class="bdg bdg-warn">${s.amount || ''}</span></div><div class="xxs c-muted" style="line-height:1.6;margin-top:.2rem">${s.desc}</div><div style="margin-top:.35rem"><span class="bdg bdg-sky xxs">→ ${s.action}</span></div></div></div>`).join('');
  if (plan.alloc) {
    const ctx = document.getElementById('alloc-c');
    if (charts.alloc) charts.alloc.destroy();
    const cs = ['#7c73e6', '#2dd4bf', '#f59e0b', '#38bdf8'];
    charts.alloc = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(plan.alloc), datasets: [{ data: Object.values(plan.alloc), backgroundColor: cs, borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: lc, font: { family: 'JetBrains Mono', size: 9 }, padding: 7 } } } } });
    document.getElementById('alloc-leg').innerHTML = Object.entries(plan.alloc).map(([k, v], i) => `<div style="display:flex;align-items:center;gap:.28rem;font-size:.6rem;font-family:var(--fm);color:var(--t2)"><div style="width:8px;height:8px;border-radius:2px;background:${cs[i]}"></div>${k}: ${v}%</div>`).join('');
  }
  if (plan.funds) document.getElementById('fund-list').innerHTML = plan.funds.map(f => {
    const rl = f.rl || 3;
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="rdot ${i < rl ? 'on ' + (rl > 3 ? 'h' : rl > 2 ? 'm' : '') : ''}"></span>`).join('');
    return `<div class="fund-c"><div class="fund-hd" style="display:flex;align-items:flex-start;gap:.6rem;margin-bottom:.5rem"><div class="fund-ico">${f.icon || '📊'}</div><div style="flex:1"><div class="fw7 xs" style="font-family:var(--fd)">${f.name}</div><div class="xxs c-muted">${f.category} · Min ${f.min_sip}</div></div><span class="bdg ${rl <= 2 ? 'bdg-ok' : rl <= 3 ? 'bdg-warn' : 'bdg-dan'}">${f.risk} Risk</span></div><div class="fund-sts"><div class="fund-st"><div class="fund-stl">1Y</div><div class="fund-stv c-ok">${f.returns_1y}</div></div><div class="fund-st"><div class="fund-stl">3Y</div><div class="fund-stv c-p">${f.returns_3y}</div></div><div class="fund-st"><div class="fund-stl">5Y</div><div class="fund-stv c-warn">${f.returns_5y}</div></div><div class="fund-st"><div class="fund-stl">Min SIP</div><div class="fund-stv c-rose">${f.min_sip}</div></div></div><div class="rdots mt05">${dots}</div><div class="xxs c-muted" style="margin-top:.35rem;line-height:1.5">${f.reason || ''}</div></div>`;
  }).join('');
  if (plan.ideas) document.getElementById('ei-list').innerHTML = `<div class="g2">` + plan.ideas.map(x => `<div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.82rem"><div class="fw7 xs mb1" style="font-family:var(--fd)">${x.title}</div><div class="xxs c-muted" style="line-height:1.6;margin-bottom:.4rem">${x.desc}</div><div class="flex gap4"><span class="bdg bdg-ok">${x.potential}</span><span class="bdg bdg-muted">${x.effort} Effort</span></div></div>`).join('') + '</div>';
}

// ══════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════
function sq(msg) { document.getElementById('chat-in').value = msg; sendMsg(); }

async function sendMsg() {
  const inp = document.getElementById('chat-in');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  appMsg(msg, 'u');
  await aiReply(msg);
}

function appMsg(txt, role) {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (role === 'a') div.innerHTML = '<span class="aitg">// FINANCE AI · v7</span>' + txt;
  else div.textContent = txt;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function appTyping() {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'msg a';
  div.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

async function aiReply(msg) {
  const ty = appTyping();
  const inc = N('s-inc') + N('s-xi'), sav = N('s-sav'), xp = N('s-xp');
  const { total: exp, bd } = getTotalExp();
  const surp = inc - exp - xp;
  const ioD = S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet');
  const sipV = S.sips.reduce((s, x) => s + (x.curval || 0), 0);
  const sipM = S.sips.reduce((s, x) => s + x.amt, 0);
  const moStr = new Date().toISOString().slice(0, 7);
  const dexMo = S.dailyExps.filter(e => e.date.startsWith(moStr)).reduce((s, e) => s + e.amt, 0);
  const expD = Object.values(bd).filter(b => b.val > 0).map(b => `${b.label}: ₹${Math.round(b.val).toLocaleString('en-IN')}`).join(', ');
  const dD = S.debts.map(d => `${d.name} ₹${Math.round(d.balance).toLocaleString('en-IN')} @${d.rate}% (${d.repay || 'emi'})`).join(' | ');
  const sD = S.sips.map(x => `${x.name} ₹${x.amt}/mo val ₹${Math.round(x.curval || 0).toLocaleString('en-IN')}`).join(' | ');
  S.chatHist.push({ role: 'user', content: msg });
  const ctx = `India ₹ | Income ₹${inc}/mo | Exp ₹${exp}/mo | Surplus ₹${surp}/mo | Savings ₹${sav} | Extra debt pay ₹${xp}/mo | Debts: ${dD || 'none'} | IO: ${ioD.map(d => d.name + ' ₹' + d.balance).join(',') || 'none'} | SIPs: ${sD || 'none'} (₹${sipV} val,₹${sipM}/mo) | Daily spend this month ₹${dexMo} | Expenses: ${expD || 'none'} | Strategy: ${S.strat}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: `Sharp Indian personal finance advisor. Data: ${ctx}. Concise (4-6 sentences), specific ₹ numbers, encouraging but honest. Minimal emojis.`, messages: S.chatHist }) });
    const d = await res.json();
    const txt = d.content?.[0]?.text || 'Sorry, try again.';
    S.chatHist.push({ role: 'assistant', content: txt });
    ty.remove();
    appMsg(txt, 'a');
    sv();
  } catch (e) {
    ty.remove();
    appMsg('Connection error. Try again.', 'a');
  }
}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function sw(t, el) {
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('pg-' + t).classList.add('on');
  if (t === 'invest') loadInvest();
  if (t === 'milestones') genMilestones();
  if (t === 'sip') renderSIPs();
  if (t === 'daily') { buildMonthFilter(); renderDex(); }
  if (t === 'reports') {
    const f = document.getElementById('rpt-from'), to = document.getElementById('rpt-to');
    if (!f.value) {
      const now = new Date(), mo = now.toISOString().slice(0, 7);
      f.value = mo + '-01';
      to.value = now.toISOString().split('T')[0];
    }
  }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
function init() {
  // Wire rc() into tab modules
  setExpRc(rc); setDebtRc(rc); setSipRc(rc); setDailyRc(rc);

  // Wire cross-module callbacks into overview
  setOverviewFns({ sipSummary, renderDebts, renderDexStats, updateBudget });

  // Init modal listeners
  initModalListeners();

  // Init state
  initSecs(); initDCats(); load(applyTheme);
  if (!S.expSecs.length) S.expSecs = JSON.parse(JSON.stringify(DEF_SECS));
  DEF_SECS.forEach(d => { if (!S.expSecs.find(s => s.id === d.id)) S.expSecs.push(JSON.parse(JSON.stringify(d))); });
  if (!S.dailyCats.length) S.dailyCats = JSON.parse(JSON.stringify(DEF_DCATS));

  // Render all
  renderExp(); renderDebts(); renderSIPs(); renderCatMgr(); renderDexSelects(); buildMonthFilter(); renderDex(); rc();
  togSec('housing');
  document.getElementById('st-av').classList.toggle('on', S.strat === 'avalanche');
  document.getElementById('st-sn').classList.toggle('on', S.strat === 'snowball');
  document.getElementById('de-qdt').value = today();
  document.addEventListener('input', e => {
    if (['s-inc', 's-xi', 's-sav', 's-xp'].includes(e.target.id)) { sv(); rc(); }
  });
}

// ══════════════════════════════════════
// EXPOSE TO WINDOW (for onclick handlers in HTML)
// ══════════════════════════════════════
Object.assign(window, {
  // Theme
  toggleTheme,
  // Expenses
  togSec, openSecModal, saveSection, rmCustSec, openItemModal, saveItem, rmExpItem,
  // Debts
  upRepHint, openDebtModal, saveDebt, rmDebt, setSt,
  // SIPs
  openSIPModal, saveSIP, rmSIP,
  // Daily
  openDCatModal, saveDCat, rmDCat, addDex, openDexEdit, saveDexEdit, rmDex, clearDexFilter, renderDex,
  // Reports
  genReport, printReport, downloadPDF,
  // Statements
  dov, dol, dod, hStmt,
  // AI
  sq, sendMsg,
  // Milestones
  genMilestones,
  // Modals
  openMo, cmo, pickEm,
  // Navigation
  sw,
  // Core
  sv, rc,
});

init();

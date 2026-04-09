// ══════════════════════════════════════
// INVEST.JS — Phase 5
// Static investment plan generator.
// No API calls. All logic is local.
// ══════════════════════════════════════
import { S, charts, getTotalExp } from '../state.js';
import { N } from '../utils.js';

// ── Curated Indian fund list ──
const FUNDS = [
  { name: 'Nifty 50 Index Fund (UTI / HDFC)', category: 'Index Fund', icon: '📊', risk: 'Low', returns_1y: '22%', returns_3y: '18%', returns_5y: '16%', min_sip: '₹500', reason: 'Lowest cost broad market exposure. Outperforms 80% of active large-cap funds over 10 years.', rl: 2 },
  { name: 'Mirae Asset Large Cap Fund', category: 'Large Cap', icon: '🏛', risk: 'Low-Med', returns_1y: '24%', returns_3y: '19%', returns_5y: '17%', min_sip: '₹1,000', reason: 'Consistent large-cap performer with disciplined portfolio of Nifty 100 stocks.', rl: 2 },
  { name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', icon: '🌐', risk: 'Medium', returns_1y: '27%', returns_3y: '22%', returns_5y: '20%', min_sip: '₹1,000', reason: 'Unique global diversification (10–15% US stocks). Excellent downside protection.', rl: 3 },
  { name: 'HDFC Balanced Advantage Fund', category: 'Hybrid', icon: '⚖️', risk: 'Low-Med', returns_1y: '20%', returns_3y: '17%', returns_5y: '15%', min_sip: '₹500', reason: 'Dynamic equity allocation reduces volatility. Good for conservative investors.', rl: 2 },
  { name: 'Axis ELSS Tax Saver Fund', category: 'ELSS', icon: '🧾', risk: 'Medium', returns_1y: '19%', returns_3y: '16%', returns_5y: '15%', min_sip: '₹500', reason: 'Saves up to ₹46,800/yr in tax (80C). Lowest lock-in of 3 yrs among 80C options.', rl: 3 },
  { name: 'Nippon India Small Cap Fund', category: 'Small Cap', icon: '🚀', risk: 'High', returns_1y: '38%', returns_3y: '30%', returns_5y: '28%', min_sip: '₹1,000', reason: 'Best long-term compounder for aggressive investors. High volatility — only for 7+ yr horizon.', rl: 5 },
  { name: 'ICICI Pru Corporate Bond Fund', category: 'Debt Fund', icon: '🏦', risk: 'Low', returns_1y: '8%', returns_3y: '7%', returns_5y: '7.5%', min_sip: '₹5,000', reason: 'Stable returns for emergency fund parking. Better post-tax yield than FDs for 3+ yr holding.', rl: 1 },
  { name: 'Kotak Gold Fund (FOF)', category: 'Gold', icon: '🥇', risk: 'Low-Med', returns_1y: '15%', returns_3y: '12%', returns_5y: '11%', min_sip: '₹1,000', reason: 'Digital gold via mutual fund. Hedge against inflation and rupee depreciation.', rl: 2 },
];

const ALLOC_PROFILES = {
  conservative: { Equity: 40, Debt: 35, Gold: 15, Liquid: 10 },
  moderate:     { Equity: 60, Debt: 20, Gold: 10, Liquid: 10 },
  aggressive:   { Equity: 75, Debt: 10, Gold: 10, Liquid: 5 },
};

const EI_IDEAS = [
  { title: 'Freelancing / Consulting', desc: 'Monetise your professional skills on Upwork, Toptal, or LinkedIn. Even 5 hrs/week can add meaningful income.', potential: '₹10K–₹80K/mo', effort: 'Medium' },
  { title: 'Dividend Stocks / REITs', desc: 'Build a portfolio of dividend-paying PSU stocks (ONGC, Coal India) and REITs for passive quarterly income.', potential: '₹2K–₹15K/mo', effort: 'Low' },
  { title: 'Peer-to-Peer Lending (P2P)', desc: 'Platforms like Faircent and Lendbox offer 10–14% returns. Diversify across 50+ borrowers to manage risk.', potential: '₹1K–₹8K/mo', effort: 'Low' },
  { title: 'Digital Products / Courses', desc: 'Create once, earn repeatedly. Udemy, Gumroad, or Teachable for courses, templates, or ebooks in your domain.', potential: '₹5K–₹50K/mo', effort: 'High' },
  { title: 'Rental Income (Subletting)', desc: 'Sublet a spare room or parking space. In metros, parking alone fetches ₹2K–₹5K/mo with zero effort.', potential: '₹3K–₹20K/mo', effort: 'Low' },
];

function buildSteps(surplus, sipM, tD, ioD) {
  const investable = Math.max(0, surplus - sipM);
  const steps = [];

  if (ioD > 0) {
    steps.push({ num: steps.length + 1, title: 'Close Interest-Only Loans First', desc: `You have ₹${ioD.toLocaleString('en-IN')} in interest-only/bullet loans — these are wealth destroyers. Build a closure fund before investing.`, action: 'Allocate 30–40% of surplus to closure SIP', amount: `₹${Math.round(surplus * 0.35).toLocaleString('en-IN')}/mo` });
  }

  if (investable <= 0) {
    steps.push({ num: steps.length + 1, title: 'Reduce Fixed Expenses', desc: 'Your SIPs already use your full surplus. Review your expense sections for cuts before adding new investments.', action: 'Target 10% reduction in discretionary spend', amount: '—' });
  } else {
    steps.push({ num: steps.length + 1, title: 'Build 6-Month Emergency Fund', desc: `Keep 6× monthly expenses (≈ ₹${Math.round(getTotalExp().total * 6).toLocaleString('en-IN')}) in a liquid fund or high-yield savings account before investing.`, action: 'Open Kotak 811 / Paytm Payments Bank savings', amount: `₹${Math.min(investable, Math.round(getTotalExp().total * 6)).toLocaleString('en-IN')} target` });

    if (investable > 2000) {
      steps.push({ num: steps.length + 1, title: 'Start Nifty 50 Index SIP', desc: 'Lowest cost (0.1% TER), instant diversification across India\'s top 50 companies. The single best first investment for most people.', action: 'UTI Nifty 50 or HDFC Index Nifty 50', amount: `₹${Math.round(investable * 0.4).toLocaleString('en-IN')}/mo` });
    }

    if (investable > 5000) {
      steps.push({ num: steps.length + 1, title: 'Add Flexi-Cap for Higher Growth', desc: 'Parag Parikh Flexi Cap gives mid/small-cap upside with lower volatility than pure small-cap funds.', action: 'Add SIP via Zerodha Coin or direct plan', amount: `₹${Math.round(investable * 0.3).toLocaleString('en-IN')}/mo` });
    }

    if (investable > 3000) {
      steps.push({ num: steps.length + 1, title: 'Tax-Save with ELSS (Section 80C)', desc: `Investing ₹1.5L/yr in ELSS saves up to ₹46,800/yr in tax and generates equity-level returns with only a 3-year lock-in.`, action: 'Axis ELSS or Mirae Asset Tax Saver', amount: `₹${Math.min(Math.round(investable * 0.2), 12500).toLocaleString('en-IN')}/mo` });
    }
  }

  if (tD > 100000) {
    steps.push({ num: steps.length + 1, title: 'Accelerate EMI Debt Repayment', desc: `₹${tD.toLocaleString('en-IN')} in active debt is a guaranteed "return" equal to your loan interest rate. Prepay high-rate loans first.`, action: 'Use avalanche strategy — target highest rate loan', amount: `₹${N('s-xp').toLocaleString('en-IN')}/mo extra` });
  }

  return steps;
}

function getAllocProfile(surplus, tD) {
  if (tD > surplus * 12) return ALLOC_PROFILES.conservative;
  if (surplus > 20000) return ALLOC_PROFILES.aggressive;
  return ALLOC_PROFILES.moderate;
}

export function renderInvPlan() {
  const isDark = S.theme === 'dark';
  const lc = isDark ? '#94a3b8' : '#475569';
  const surplus = N('s-inc') + N('s-xi') - getTotalExp().total - N('s-xp');
  const tD = S.debts.reduce((s, d) => s + d.balance, 0);
  const ioD = S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet').reduce((s, d) => s + d.balance, 0);
  const sipM = S.sips.reduce((s, x) => s + x.amt, 0);

  const steps = buildSteps(surplus, sipM, tD, ioD);
  const alloc = getAllocProfile(surplus, tD);

  // Steps
  document.getElementById('inv-steps').innerHTML = steps.map(s =>
    `<div class="step-c"><div class="step-n">${s.num}</div><div><div class="fw7 xs" style="font-family:var(--fd)">${s.title} <span class="bdg bdg-warn">${s.amount || ''}</span></div><div class="xxs c-muted" style="line-height:1.6;margin-top:.2rem">${s.desc}</div><div style="margin-top:.35rem"><span class="bdg bdg-sky xxs">→ ${s.action}</span></div></div></div>`
  ).join('');

  // Allocation chart
  const ctx = document.getElementById('alloc-c');
  if (charts.alloc) charts.alloc.destroy();
  const cs = ['#7c73e6', '#2dd4bf', '#f59e0b', '#38bdf8'];
  charts.alloc = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(alloc), datasets: [{ data: Object.values(alloc), backgroundColor: cs, borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: lc, font: { family: 'JetBrains Mono', size: 9 }, padding: 7 } } } } });
  document.getElementById('alloc-leg').innerHTML = Object.entries(alloc).map(([k, v], i) =>
    `<div style="display:flex;align-items:center;gap:.28rem;font-size:.6rem;font-family:var(--fm);color:var(--t2)"><div style="width:8px;height:8px;border-radius:2px;background:${cs[i]}"></div>${k}: ${v}%</div>`
  ).join('');

  // Funds
  document.getElementById('fund-list').innerHTML = FUNDS.map(f => {
    const rl = f.rl || 3;
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="rdot ${i < rl ? 'on ' + (rl > 3 ? 'h' : rl > 2 ? 'm' : '') : ''}"></span>`).join('');
    return `<div class="fund-c"><div class="fund-hd" style="display:flex;align-items:flex-start;gap:.6rem;margin-bottom:.5rem"><div class="fund-ico">${f.icon}</div><div style="flex:1"><div class="fw7 xs" style="font-family:var(--fd)">${f.name}</div><div class="xxs c-muted">${f.category} · Min ${f.min_sip}</div></div><span class="bdg ${rl <= 2 ? 'bdg-ok' : rl <= 3 ? 'bdg-warn' : 'bdg-dan'}">${f.risk} Risk</span></div><div class="fund-sts"><div class="fund-st"><div class="fund-stl">1Y</div><div class="fund-stv c-ok">${f.returns_1y}</div></div><div class="fund-st"><div class="fund-stl">3Y</div><div class="fund-stv c-p">${f.returns_3y}</div></div><div class="fund-st"><div class="fund-stl">5Y</div><div class="fund-stv c-warn">${f.returns_5y}</div></div><div class="fund-st"><div class="fund-stl">Min SIP</div><div class="fund-stv c-rose">${f.min_sip}</div></div></div><div class="rdots mt05">${dots}</div><div class="xxs c-muted" style="margin-top:.35rem;line-height:1.5">${f.reason}</div></div>`;
  }).join('');

  // Extra income ideas
  document.getElementById('ei-list').innerHTML = `<div class="g2">` + EI_IDEAS.map(x =>
    `<div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.82rem"><div class="fw7 xs mb1" style="font-family:var(--fd)">${x.title}</div><div class="xxs c-muted" style="line-height:1.6;margin-bottom:.4rem">${x.desc}</div><div class="flex gap4"><span class="bdg bdg-ok">${x.potential}</span><span class="bdg bdg-muted">${x.effort} Effort</span></div></div>`
  ).join('') + '</div>';
}

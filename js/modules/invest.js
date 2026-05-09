// ══════════════════════════════════════
// INVEST MODULE — Phase 5
// Static investment plan engine. Zero API calls.
// Generates contextual steps, fund picks, and allocation
// directly from the user's live S state.
// ══════════════════════════════════════
import { S, charts, getTotalExp } from '../state.js';
import { N } from '../utils.js';

// ─────────────────────────────────────────────────────────
// CURATED FUND DATABASE
// Returns/risk data are approximate trailing figures.
// ─────────────────────────────────────────────────────────
const FUNDS = [
  // ── Index
  { id:'uti-n50',    name:'UTI Nifty 50 Index Fund',              category:'Index Fund',  icon:'📊', risk:'Low',        rl:2, r1:'14.1%', r3:'13.8%', r5:'15.0%', minSip:'₹500',   reason:'Lowest-cost Nifty 50 tracker (TER 0.18%). Ideal core holding — owns every large company in India. Set-and-forget.' },
  { id:'mot-mid150', name:'Motilal Oswal Nifty Midcap 150 Index', category:'Index Fund',  icon:'📈', risk:'Medium',     rl:3, r1:'21.8%', r3:'24.3%', r5:'26.1%', minSip:'₹500',   reason:'Passive mid cap exposure at low cost. Higher long-term returns than large cap, but brace for 30–40% drawdowns.' },
  // ── Large Cap
  { id:'mira-lc',    name:'Mirae Asset Large Cap Fund',           category:'Large Cap',   icon:'🏛️', risk:'Low',        rl:2, r1:'14.4%', r3:'13.9%', r5:'15.3%', minSip:'₹1,000', reason:'Top-quartile large cap. 80%+ Nifty 100 stocks. Consistent quality bias, low churn. Strong core holding.' },
  // ── Flexi Cap
  { id:'ppfas',      name:'Parag Parikh Flexi Cap Fund',          category:'Flexi Cap',   icon:'🌏', risk:'Low–Medium', rl:2, r1:'16.4%', r3:'17.6%', r5:'19.5%', minSip:'₹1,000', reason:'20–30% in global stocks (Alphabet, Meta, Amazon). Only Indian fund with meaningful international diversification.' },
  { id:'hdfc-flexi', name:'HDFC Flexi Cap Fund',                  category:'Flexi Cap',   icon:'🏦', risk:'Medium',     rl:3, r1:'18.6%', r3:'20.1%', r5:'18.2%', minSip:'₹100',   reason:'Value-oriented, one of India\'s largest flexi cap by AUM. Contrarian picks with a proven long-term track record.' },
  // ── Mid Cap
  { id:'nippon-mid', name:'Nippon India Mid Cap Fund',            category:'Mid Cap',     icon:'🚀', risk:'High',       rl:4, r1:'23.9%', r3:'27.1%', r5:'28.4%', minSip:'₹100',   reason:'India\'s largest mid cap fund. Aggressive growth pick for 7y+ horizon. Stay invested through 40% drawdowns.' },
  { id:'kotak-mid',  name:'Kotak Emerging Equity Fund',           category:'Mid Cap',     icon:'⚡', risk:'High',       rl:4, r1:'21.5%', r3:'23.9%', r5:'25.6%', minSip:'₹1,000', reason:'Quality mid cap with bottom-up stock picking. Lower churn than peers, steadier compounding.' },
  // ── ELSS
  { id:'quant-elss', name:'Quant ELSS Tax Saver Fund',            category:'ELSS',        icon:'🎯', risk:'High',       rl:4, r1:'27.8%', r3:'31.4%', r5:'30.1%', minSip:'₹500',   reason:'Tax saving (80C) + equity growth, 3-year lock-in. Quant\'s quantitative model has consistently outperformed peers.' },
  { id:'mira-elss',  name:'Mirae Asset ELSS Tax Saver',           category:'ELSS',        icon:'💎', risk:'Low–Medium', rl:2, r1:'14.9%', r3:'14.4%', r5:'16.3%', minSip:'₹500',   reason:'Stable ELSS if you prefer consistency over momentum. Good if you already hold high-risk funds elsewhere.' },
  // ── Hybrid
  { id:'hdfc-bal',   name:'HDFC Balanced Advantage Fund',         category:'Hybrid',      icon:'⚖️', risk:'Low–Medium', rl:2, r1:'16.0%', r3:'15.6%', r5:'14.2%', minSip:'₹100',   reason:'Dynamically adjusts equity-debt allocation by market valuation. Smoother ride for conservative investors.' },
  // ── Debt
  { id:'hdfc-short', name:'HDFC Short Duration Fund',             category:'Debt Fund',   icon:'🏧', risk:'Very Low',   rl:1, r1:'7.9%',  r3:'7.3%',  r5:'7.2%',  minSip:'₹100',   reason:'For emergency fund and short-term goals. Earns ~7.5% vs ~3.5% savings account. Same-day redemption.' },
];

const IDEAS = [
  { title:'Move idle cash to a liquid fund',       desc:'Anything above your 3-month emergency fund in a savings account earns ~3.5%. A liquid fund earns ~7.2% with same-day redemption.',                                   potential:'₹500–3,000/mo',          effort:'Low'   },
  { title:'Freelance / consulting on weekends',    desc:'Use your primary skill for 4–6 hrs/week. Toptal, Upwork, LinkedIn Services, or direct referrals from colleagues.',                                                   potential:'₹15,000–60,000/mo',       effort:'Medium'},
  { title:'Sovereign Gold Bonds (SGB)',             desc:'RBI issues 2–4 windows/year. 2.5% annual interest + gold price upside. Far superior to physical gold or Gold ETF.',                                                  potential:'Gold upside + 2.5% p.a.', effort:'Low'   },
  { title:'Switch SIPs to growth plans',           desc:'If any SIP is on IDCW (dividend) plan, switch to growth. Dividends create a taxable event; growth compounds without interruption.',                                   potential:'20–30% more corpus/10y',  effort:'Low'   },
  { title:'Rent idle assets',                      desc:'Car on Zoomcar/Drivezy, unused room on Airbnb, parking space on Parks24x7, camera/equipment on RentoMojo.',                                                          potential:'₹2,000–15,000/mo',        effort:'Low'   },
];

function buildSteps(surplus, totalDebt, ioDebt, sipMonthly, savings) {
  const steps = [];
  const inc   = N('s-inc') + N('s-xi');

  const { total: exp } = getTotalExp();
  const efTarget = Math.round(exp * 6);
  const efShort  = Math.max(0, efTarget - savings);
  if (efShort > 0) {
    const monthly = Math.round(Math.min(efShort * 0.35, surplus * 0.5) / 500) * 500 || 2000;
    steps.push({ num:1, title:'Build a 6-month emergency fund first', desc:`Target: ₹${(efTarget/100000).toFixed(1)}L (6× monthly expenses). Short by ₹${Math.round(efShort/1000)}K. Park in HDFC Short Duration Fund — earns ~7.5%, redeems next day.`, action:`₹${monthly.toLocaleString('en-IN')}/mo → HDFC Short Duration Fund until full`, amount:`₹${monthly.toLocaleString('en-IN')}/mo` });
  }

  if (ioDebt > 0) {
    const ioMaxRate = Math.max(...S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet').map(d => d.rate), 0);
    steps.push({ num:steps.length+1, title:'Close interest-only loans urgently', desc:`₹${Math.round(ioDebt/100000*10)/10}L in IO/bullet loans eat cash without reducing principal. Closing them is a guaranteed ${ioMaxRate}% risk-free return.`, action:'Redirect all spare income toward these until fully closed', amount:`₹${Math.round(ioDebt/100000*10)/10}L outstanding` });
  }

  if (S.taxRegime === 'old' && sipMonthly < 12500) {
    const taxSaved = Math.round(150000 * (S.taxSlab / 100)).toLocaleString('en-IN');
    steps.push({ num:steps.length+1, title:'Maximise Section 80C with ELSS', desc:`₹1.5L/year (₹12,500/mo) in ELSS saves ₹${taxSaved} in tax (${S.taxSlab}% slab, old regime). 3-year lock-in. Quant ELSS for aggression; Mirae ELSS for stability.`, action:'Start ₹12,500/mo SIP in an ELSS fund before March 31', amount:'₹12,500/mo (₹1.5L/yr)' });
  } else if (S.taxRegime === 'new' && sipMonthly < 12500) {
    steps.push({ num:steps.length+1, title:'New regime selected — focus core SIP', desc:'Section 80C deductions (ELSS, PPF, LIC) do not apply under the new tax regime. Skip ELSS and direct the full ₹12,500/mo into a diversified equity SIP instead.', action:'Start ₹12,500/mo SIP in UTI Nifty 50 + PPFAS Flexi Cap', amount:'₹12,500/mo' });
  }

  if (surplus > 5000 || sipMonthly > 0) {
    const coreAmt = Math.max(sipMonthly > 0 ? 0 : Math.round(surplus * 0.4/500)*500, 5000);
    steps.push({ num:steps.length+1, title:'Core equity: Nifty 50 Index + PPFAS Flexi Cap', desc:'Split your main SIP 50/50 between UTI Nifty 50 Index and Parag Parikh Flexi Cap. Simple, diversified, globally hedged.', action:'50% → UTI Nifty 50 Index · 50% → PPFAS Flexi Cap', amount:sipMonthly>0?`Review current ₹${sipMonthly.toLocaleString('en-IN')}/mo`:`₹${coreAmt.toLocaleString('en-IN')}/mo` });
  }

  if (surplus > 25000) {
    const satAmt = Math.round(surplus * 0.12/500)*500;
    steps.push({ num:steps.length+1, title:'Satellite: mid cap for growth (7y+ only)', desc:'Once core is set, add Nippon or Motilal Midcap 150 Index for a growth kicker. Keep under 20% of total SIP. Ignore 30–40% drawdowns.', action:'Nippon Mid Cap or Motilal Midcap 150 Index · max 20% of SIP', amount:`₹${satAmt.toLocaleString('en-IN')}/mo` });
  }

  const emiDebts = S.debts.filter(d => !d.repay || d.repay==='emi');
  if (emiDebts.length && surplus > 10000 && steps.length < 6) {
    const prePayAmt = Math.round(Math.min(surplus*0.25, 20000)/500)*500;
    steps.push({ num:steps.length+1, title:'Accelerate debt repayment (avalanche order)', desc:'Extra EMI payment against the highest-rate loan gives guaranteed return equal to that rate. Roll freed EMI into SIPs once cleared.', action:`Extra ₹${prePayAmt.toLocaleString('en-IN')}/mo → ${emiDebts.sort((a,b)=>b.rate-a.rate)[0]?.name||'highest-rate debt'}`, amount:`₹${prePayAmt.toLocaleString('en-IN')}/mo extra` });
  }

  return steps.slice(0, 6);
}

function buildAlloc(surplus, totalDebt, ioDebt) {
  if (ioDebt > 500000)     return { 'Debt Closure':50, 'Equity':30,       'Debt Funds':15, 'Gold':5  };
  if (totalDebt > 2000000) return { 'Equity':40,       'Debt Paydown':35, 'Debt Funds':15, 'Gold':10 };
  if (surplus < 10000)     return { 'Emergency':40,    'Equity':35,       'Debt Funds':20, 'Gold':5  };
  if (surplus > 50000)     return { 'Equity':65,       'Debt Funds':15,   'Gold':10, 'Liquid':10     };
  return                          { 'Equity':60,       'Debt Funds':20,   'Gold':10, 'Liquid':10     };
}

function pickFunds(surplus, totalDebt, ioDebt) {
  const byId = id => FUNDS.find(f => f.id===id);
  if (surplus < 5000 || ioDebt > surplus*3)
    return [byId('hdfc-short'), byId('hdfc-bal'), byId('mira-elss')].filter(Boolean);
  if (totalDebt > 1500000)
    return [byId('uti-n50'), byId('hdfc-bal'), byId('mira-elss'), byId('hdfc-short')].filter(Boolean);
  return [byId('uti-n50'), byId('ppfas'), byId('mira-lc'), byId('quant-elss'), byId('nippon-mid'), byId('hdfc-short')].filter(Boolean);
}

function renderSteps(steps) {
  const el = document.getElementById('inv-steps'); if (!el) return;
  el.innerHTML = steps.map(s => `
    <div class="step-c">
      <div class="step-n">${s.num}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-weight:800;font-size:.85rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">${s.title}<span class="bdg bdg-warn">${s.amount}</span></div>
        <div class="xxs c-muted" style="line-height:1.65;margin-top:.3rem">${s.desc}</div>
        <div style="margin-top:.42rem"><span class="bdg bdg-sky xxs">→ ${s.action}</span></div>
      </div>
    </div>`).join('');
}

function renderAlloc(alloc) {
  const ctx = document.getElementById('alloc-c'); if (!ctx) return;
  if (charts.alloc) charts.alloc.destroy();
  const lc = S.theme==='dark'?'#94a3b8':'#475569';
  const cs = ['#7c73e6','#2dd4bf','#f59e0b','#38bdf8'];
  charts.alloc = new Chart(ctx, { type:'doughnut', data:{ labels:Object.keys(alloc), datasets:[{data:Object.values(alloc),backgroundColor:cs,borderWidth:0,hoverOffset:5}] }, options:{ responsive:true, cutout:'65%', plugins:{ legend:{ position:'bottom', labels:{ color:lc, font:{ family:'JetBrains Mono', size:9 }, padding:7 } } } } });
  const leg = document.getElementById('alloc-leg');
  if (leg) leg.innerHTML = Object.entries(alloc).map(([k,v],i)=>`<div style="display:flex;align-items:center;gap:.28rem;font-size:.6rem;font-family:var(--fm);color:var(--t2)"><div style="width:8px;height:8px;border-radius:2px;background:${cs[i]}"></div>${k}: ${v}%</div>`).join('');
}

function renderFunds(funds) {
  const el = document.getElementById('fund-list'); if (!el) return;
  el.innerHTML = funds.map(f => {
    const rl=f.rl||3, dots=Array.from({length:5},(_,i)=>`<span class="rdot ${i<rl?'on '+(rl>3?'h':rl>2?'m':''):''}"></span>`).join('');
    const riskBdg = rl<=2?'bdg-ok':rl<=3?'bdg-warn':'bdg-dan';
    return `<div class="fund-c">
      <div style="display:flex;align-items:flex-start;gap:.6rem;margin-bottom:.55rem">
        <div style="font-size:1.3rem;width:34px;text-align:center;flex-shrink:0;margin-top:1px">${f.icon}</div>
        <div style="flex:1;min-width:0"><div style="font-family:var(--fd);font-weight:800;font-size:.85rem">${f.name}</div><div class="xxs c-muted">${f.category} · Min ${f.minSip}</div></div>
        <span class="bdg ${riskBdg}">${f.risk} Risk</span>
      </div>
      <div class="fund-sts">
        <div class="fund-st"><div class="fund-stl">1Y</div><div class="fund-stv c-ok">${f.r1}</div></div>
        <div class="fund-st"><div class="fund-stl">3Y</div><div class="fund-stv c-p">${f.r3}</div></div>
        <div class="fund-st"><div class="fund-stl">5Y</div><div class="fund-stv c-warn">${f.r5}</div></div>
        <div class="fund-st"><div class="fund-stl">Min SIP</div><div class="fund-stv" style="color:var(--rose)">${f.minSip}</div></div>
      </div>
      <div class="rdots" style="margin-top:.5rem">${dots}</div>
      <div class="xxs c-muted" style="margin-top:.38rem;line-height:1.55">${f.reason}</div>
      <div class="xxs c-muted" style="margin-top:.3rem;font-style:italic;opacity:.7">Past performance does not indicate future returns.</div>
    </div>`;
  }).join('');
}

function renderIdeas() {
  const el = document.getElementById('ei-list'); if (!el) return;
  el.innerHTML = `<div class="g2">` + IDEAS.map(x =>
    `<div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--rm);padding:.82rem">
      <div style="font-family:var(--fd);font-weight:800;font-size:.85rem;margin-bottom:.35rem">${x.title}</div>
      <div class="xxs c-muted" style="line-height:1.65;margin-bottom:.45rem">${x.desc}</div>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap"><span class="bdg bdg-ok">${x.potential}</span><span class="bdg bdg-muted">${x.effort} effort</span></div>
    </div>`
  ).join('') + '</div>';
}

function renderNote(surplus, totalDebt) {
  const el = document.getElementById('mkt-note'); if (!el) return;
  const date = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
  const msg = surplus<=0
    ? `Expenses exceed income by ₹${Math.round(-surplus).toLocaleString('en-IN')}/mo. Cut costs before starting new SIPs.`
    : totalDebt>0
      ? `₹${Math.round(surplus).toLocaleString('en-IN')}/mo investable. Prioritise high-interest debt clearance, then redirect freed EMIs into SIPs.`
      : `₹${Math.round(surplus).toLocaleString('en-IN')}/mo fully investable — no debt drag. Maximise SIPs and tax-saving instruments.`;
  el.innerHTML = `💡 <strong>${date}:</strong> ${msg}`;
}

export function loadInvest() {
  const inc       = N('s-inc') + N('s-xi');
  const savings   = N('s-sav');
  const { total:exp } = getTotalExp();
  const surplus   = inc - exp - N('s-xp');
  const totalDebt = S.debts.reduce((s,d)=>s+d.balance, 0);
  const ioDebt    = S.debts.filter(d=>d.repay==='interest'||d.repay==='bullet').reduce((s,d)=>s+d.balance, 0);
  const sipMonthly= S.sips.reduce((s,x)=>s+x.amt, 0);

  renderNote(surplus, totalDebt);
  renderSteps(buildSteps(surplus, totalDebt, ioDebt, sipMonthly, savings));
  renderAlloc(buildAlloc(surplus, totalDebt, ioDebt));
  renderFunds(pickFunds(surplus, totalDebt, ioDebt));
  renderIdeas();
}

// ══════════════════════════════════════
// RETIREMENT — corpus, SWR, FI gap calculator
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S, sv, sipFV } from '../state.js';

const DEFAULT = { curAge: 30, retireAge: 55, monthlyExp: 50000, inflation: 5, preRet: 12, postRet: 7, swr: 4 };

function getInputs() {
  const g = id => parseFloat(document.getElementById(id)?.value) || 0;
  return {
    curAge:     g('ret-cur-age')   || DEFAULT.curAge,
    retireAge:  g('ret-retire-age')|| DEFAULT.retireAge,
    monthlyExp: g('ret-exp')       || DEFAULT.monthlyExp,
    inflation:  g('ret-inf')       || DEFAULT.inflation,
    preRet:     g('ret-pre')       || DEFAULT.preRet,
    postRet:    g('ret-post')      || DEFAULT.postRet,
    swr:        g('ret-swr')       || DEFAULT.swr,
    curCorpus:  g('ret-corpus'),
  };
}

function calcRetirement(inp) {
  const yearsToRetire = Math.max(0, inp.retireAge - inp.curAge);
  // Future monthly expense at retirement (inflation-adjusted)
  const futureMonthlyExp = inp.monthlyExp * Math.pow(1 + inp.inflation / 100, yearsToRetire);
  const futureAnnualExp  = futureMonthlyExp * 12;
  // Corpus needed by SWR rule: annual expense / (SWR/100)
  const corpusNeeded = futureAnnualExp / (inp.swr / 100);
  // Corpus from current savings growing to retirement
  const r = inp.preRet / 100 / 12;
  const n = yearsToRetire * 12;
  const curCorpusGrown = inp.curCorpus * Math.pow(1 + r, n);
  // Gap
  const gap = Math.max(0, corpusNeeded - curCorpusGrown);
  // Monthly SIP needed to close gap
  const monthlyNeeded = gap > 0 && r > 0 && n > 0
    ? gap * r / (Math.pow(1 + r, n) - 1)
    : 0;
  // Years corpus lasts post-retirement using postRet return
  const postR = inp.postRet / 100 / 12;
  const corpusAtRetire = curCorpusGrown + (monthlyNeeded > 0 ? sipFV(0, monthlyNeeded, n, inp.preRet) : 0);
  // SWP: how many months corpus lasts drawing futureMonthlyExp
  let swpMonths = 0;
  if (postR > 0 && futureMonthlyExp > 0 && corpusAtRetire > 0) {
    // ln(1 - C*r/W) / ln(1+r) where C=corpus, r=monthly rate, W=monthly withdrawal
    const ratio = futureMonthlyExp / (corpusAtRetire * postR);
    if (ratio < 1) swpMonths = Math.round(-Math.log(1 - ratio) / Math.log(1 + postR));
    else swpMonths = 0; // withdrawal > corpus interest — drain quickly
  }
  return { yearsToRetire, futureMonthlyExp, futureAnnualExp, corpusNeeded, curCorpusGrown, gap, monthlyNeeded, swpMonths };
}

function fmtYrs(months) {
  if (!months || months > 1200) return '> 100 yrs';
  const y = Math.floor(months / 12), m = months % 12;
  return y > 0 ? `${y}y ${m}m` : `${m}m`;
}

export function genRetirement() {
  const inp = getInputs();
  const c   = calcRetirement(inp);
  const el  = document.getElementById('ret-output');
  if (!el) return;

  const sipCurrent = S.sips.reduce((s, x) => s + x.amt, 0);
  const sipGap     = Math.max(0, c.monthlyNeeded - sipCurrent);
  const onTrack    = sipCurrent >= c.monthlyNeeded;

  el.innerHTML = `
    <div class="g4 mb1">
      <div class="kcard"><div class="kl">Target Corpus</div><div class="kv c-warn">${fmt(c.corpusNeeded)}</div><div class="ks">${inp.swr}% SWR rule</div></div>
      <div class="kcard"><div class="kl">Years to Retire</div><div class="kv c-sky">${c.yearsToRetire}y</div><div class="ks">at age ${inp.retireAge}</div></div>
      <div class="kcard"><div class="kl">Monthly SIP Needed</div><div class="kv ${onTrack ? 'c-ok' : 'c-dan'}">${fmt(Math.round(c.monthlyNeeded))}</div><div class="ks">${onTrack ? '✓ covered by current SIPs' : `₹${fmt(sipGap)} gap`}</div></div>
      <div class="kcard"><div class="kl">Corpus Lasts</div><div class="kv c-p">${fmtYrs(c.swpMonths)}</div><div class="ks">post-retirement at ${inp.postRet}%</div></div>
    </div>
    <div class="card mb1">
      <div class="sh"><div class="shdot" style="background:var(--amber)"></div>Retirement Math</div>
      <div class="g2">
        <div>
          <table style="width:100%;font-size:.75rem;border-collapse:collapse">
            <tr><td class="c-muted" style="padding:.3rem 0">Monthly expenses today</td><td class="mono" style="text-align:right">${fmt(inp.monthlyExp)}</td></tr>
            <tr><td class="c-muted" style="padding:.3rem 0">At retirement (${inp.inflation}% inflation)</td><td class="mono" style="text-align:right;color:var(--amber)">${fmt(Math.round(c.futureMonthlyExp))}</td></tr>
            <tr><td class="c-muted" style="padding:.3rem 0">Annual expense at retirement</td><td class="mono" style="text-align:right;color:var(--amber)">${fmt(Math.round(c.futureAnnualExp))}</td></tr>
            <tr style="border-top:1px solid var(--b1)"><td class="c-muted" style="padding:.4rem 0">Corpus needed (${inp.swr}% SWR)</td><td class="mono fw7" style="text-align:right;color:var(--warn)">${fmt(Math.round(c.corpusNeeded))}</td></tr>
            <tr><td class="c-muted" style="padding:.3rem 0">Current corpus grown</td><td class="mono" style="text-align:right;color:var(--ok)">${fmt(Math.round(c.curCorpusGrown))}</td></tr>
            <tr><td class="c-muted" style="padding:.3rem 0">Funding gap</td><td class="mono" style="text-align:right;color:${c.gap > 0 ? 'var(--danger)' : 'var(--ok)'}">${fmt(Math.round(c.gap))}</td></tr>
          </table>
        </div>
        <div>
          <div class="ib mb05">
            ${onTrack
              ? `✅ Current SIPs (${fmt(sipCurrent)}/mo) exceed the target. You are on track.`
              : `📌 Start an additional <strong>${fmt(Math.round(sipGap))}/mo</strong> SIP to bridge the gap. Add it on the SIPs tab.`}
          </div>
          <div class="xxs c-muted" style="line-height:1.6">
            Trinity Study rule: a portfolio earns ${inp.postRet}% post-retirement and withdraws ${inp.swr}% annually.
            At this draw-rate your corpus lasts <strong>${fmtYrs(c.swpMonths)}</strong>.
            Reduce expenses or lower withdrawal rate if this looks short.
          </div>
          <div class="xxs c-muted mt05" style="font-style:italic">Past performance does not indicate future returns. These projections are illustrative only.</div>
        </div>
      </div>
    </div>
  `;
}

export function initRetirementListeners() {
  ['ret-cur-age','ret-retire-age','ret-exp','ret-inf','ret-pre','ret-post','ret-swr','ret-corpus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', genRetirement);
  });
}

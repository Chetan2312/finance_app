// ══════════════════════════════════════
// REPORTS — genReport, buildGantt, drawRptCharts, print, PDF, genMonthlyReport
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S, rptCharts, getTotalExp, calcPayoff, sipFV } from '../state.js';

export function genReport() {
  const from = document.getElementById('rpt-from').value;
  const to = document.getElementById('rpt-to').value;
  if (!from || !to) { alert('Select date range'); return; }
  if (from > to) { alert('From date must be before To date'); return; }
  const type = document.getElementById('rpt-type').value;
  const dExps = S.dailyExps.filter(e => e.date >= from && e.date <= to);
  const totalDaily = dExps.reduce((s, e) => s + e.amt, 0);
  const daysDiff = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)));
  const { total: fixedMonthly, bd } = getTotalExp();
  const fixedProrated = type === 'daily' ? 0 : (fixedMonthly / 30 * daysDiff);
  const grandTotal = type === 'fixed' ? fixedProrated : type === 'daily' ? totalDaily : totalDaily + fixedProrated;
  const catTotals = {};
  dExps.forEach(e => { catTotals[e.catId] = (catTotals[e.catId] || 0) + e.amt; });
  const dateRange = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) { dateRange.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
  const dailyByDate = {};
  dateRange.forEach(d => { dailyByDate[d] = dExps.filter(e => e.date === d).reduce((s, e) => s + e.amt, 0); });
  const maxDayAmt = Math.max(...Object.values(dailyByDate), 1);
  const ganttCats = S.dailyCats.filter(c => catTotals[c.id] > 0);
  const ganttHtml = buildGantt(ganttCats, dateRange, dExps, maxDayAmt);
  const topExps = [...dExps].sort((a, b) => b.amt - a.amt).slice(0, 10);
  const fromLabel = new Date(from + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const toLabel = new Date(to + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  document.getElementById('rpt-content').innerHTML = `
    <div class="rpt-hdr">
      <div><div class="rpt-title">Financial Report</div><div class="rpt-period">${fromLabel} → ${toLabel} · ${daysDiff} days</div></div>
      <div style="text-align:right;font-family:var(--fm);font-size:.6rem;color:var(--t3)">Generated: ${new Date().toLocaleDateString('en-IN')}<br>FinanceFreedom v7</div>
    </div>
    <div class="rpt-kpis">
      <div class="rpt-kpi"><div class="rpt-kpi-l">Total Spend</div><div class="rpt-kpi-v" style="color:var(--danger)">${fmt(grandTotal)}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-l">Daily Expenses</div><div class="rpt-kpi-v" style="color:var(--rose)">${fmt(totalDaily)}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-l">Fixed (Prorated)</div><div class="rpt-kpi-v" style="color:var(--amber)">${fmt(fixedProrated)}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-l">Avg Per Day</div><div class="rpt-kpi-v" style="color:var(--sky)">${fmt(grandTotal / daysDiff)}</div></div>
    </div>
    ${dExps.length ? `
    <div style="margin-bottom:1.4rem">
      <div style="font-family:var(--fd);font-size:.85rem;font-weight:800;margin-bottom:.7rem;display:flex;align-items:center;gap:.4rem"><div style="width:5px;height:18px;border-radius:3px;background:linear-gradient(var(--p),var(--rose));flex-shrink:0"></div>Daily Expense Timeline (Gantt)</div>
      ${ganttHtml}
    </div>
    <div class="g2" style="margin-bottom:1.4rem">
      <div><div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.6rem">Daily Totals</div><canvas id="rpt-bar-c" style="max-height:180px"></canvas></div>
      <div><div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.6rem">Category Breakdown</div><canvas id="rpt-donut-c" style="max-height:180px"></canvas></div>
    </div>
    <div style="margin-bottom:1.4rem">
      <div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.6rem">Category Summary</div>
      <table class="rpt-table">
        <thead><tr><th>Category</th><th>Entries</th><th>Total</th><th>% of Daily Spend</th></tr></thead>
        <tbody>${S.dailyCats.filter(c => catTotals[c.id] > 0).sort((a, b) => catTotals[b.id] - catTotals[a.id]).map(c => `<tr><td>${c.icon} ${c.name}</td><td>${dExps.filter(e => e.catId === c.id).length}</td><td style="font-family:var(--fm);color:var(--danger)">${fmt(catTotals[c.id])}</td><td><div style="display:flex;align-items:center;gap:.4rem"><div style="height:5px;width:${(catTotals[c.id] / totalDaily * 60).toFixed(1)}px;background:${c.color};border-radius:2px;display:inline-block"></div>${(catTotals[c.id] / totalDaily * 100).toFixed(1)}%</div></td></tr>`).join('')}</tbody>
      </table>
    </div>
    ${type !== 'daily' ? `
    <div style="margin-bottom:1.4rem">
      <div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.6rem">Fixed Expenses (Monthly)</div>
      <table class="rpt-table">
        <thead><tr><th>Category</th><th>Monthly</th><th>Prorated (${daysDiff}d)</th></tr></thead>
        <tbody>${Object.entries(bd).filter(([, b]) => b.val > 0).map(([, b]) => `<tr><td>${b.icon} ${b.label}</td><td class="mono">${fmt(b.val)}</td><td class="mono" style="color:var(--amber)">${fmt(b.val / 30 * daysDiff)}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    <div>
      <div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.6rem">Top ${topExps.length} Expenses</div>
      <table class="rpt-table">
        <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
        <tbody>${topExps.map(e => { const c = S.dailyCats.find(x => x.id === e.catId) || { icon: '💸', name: 'Other' }; return `<tr><td class="mono xs">${e.date}</td><td>${c.icon} ${c.name}</td><td class="xs c-muted">${e.note || '—'}</td><td class="mono" style="color:var(--danger)">${fmt(e.amt)}</td></tr>`; }).join('')}</tbody>
      </table>
    </div>` : `<div style="text-align:center;padding:2rem;color:var(--t3)">No daily expenses found in this date range.</div>`}
  `;
  document.getElementById('rpt-preview-wrap').style.display = 'block';
  setTimeout(() => { drawRptCharts(dateRange, dailyByDate, catTotals); }, 100);
}

function buildGantt(cats, dates, dExps, maxDay) {
  if (!cats.length || !dates.length) return '<div class="empty xxs">No data for Gantt</div>';
  const showDates = dates.length > 30 ? dates.filter((_, i) => i % Math.ceil(dates.length / 15) === 0) : dates;
  const cellW = Math.max(600 / (dates.length || 1), 8);
  const isDark = S.theme === 'dark';
  let svg = `<div class="gantt-wrap"><svg class="gantt" style="min-width:${130 + dates.length * cellW}px" height="${cats.length * 28 + 36}" xmlns="http://www.w3.org/2000/svg">`;
  showDates.forEach(d => {
    const x = 130 + dates.indexOf(d) * cellW;
    const lbl = d.slice(5);
    svg += `<text x="${x + 2}" y="14" fill="${isDark ? '#475569' : '#94a3b8'}" font-size="8" font-family="JetBrains Mono">${lbl}</text>`;
  });
  cats.forEach((cat, ci) => {
    const y = 20 + ci * 28;
    svg += `<text x="4" y="${y + 16}" fill="${cat.color}" font-size="11" font-family="Outfit" font-weight="600">${cat.icon} ${cat.name}</text>`;
    svg += `<rect x="130" y="${y + 2}" width="${dates.length * cellW}" height="20" rx="3" fill="${isDark ? 'rgba(37,37,69,.5)' : 'rgba(220,220,240,.5)'}"/>`;
    dates.forEach((d, di) => {
      const dayExps = dExps.filter(e => e.date === d && e.catId === cat.id);
      if (!dayExps.length) return;
      const amt = dayExps.reduce((s, e) => s + e.amt, 0);
      const intensity = Math.min(.95, amt / maxDay * .8 + .2);
      const x = 130 + di * cellW;
      svg += `<rect x="${x + 1}" y="${y + 3}" width="${cellW - 2}" height="18" rx="2" fill="${cat.color}" opacity="${intensity}"><title>${d}: ${fmt(amt)}</title></rect>`;
    });
  });
  svg += `</svg>`;
  svg += `<div class="gantt-legend"><span>Intensity = spend amount</span><div class="gantt-scale"><span style="background:rgba(124,115,230,.2)"></span><span style="background:rgba(124,115,230,.5)"></span><span style="background:rgba(124,115,230,.8)"></span><span style="background:rgba(124,115,230,1)"></span><span class="xs c-muted">Low → High</span></div></div></div>`;
  return svg;
}

function drawRptCharts(dates, dailyByDate, catTotals) {
  const isDark = S.theme === 'dark';
  const lc = isDark ? '#94a3b8' : '#475569';
  const gc = isDark ? '#252545' : '#e2e8f0';
  const barCtx = document.getElementById('rpt-bar-c');
  if (barCtx) {
    if (rptCharts.bar) rptCharts.bar.destroy();
    const labels = dates.length > 20 ? dates.filter((_, i) => i % Math.ceil(dates.length / 10) === 0) : dates;
    rptCharts.bar = new Chart(barCtx, { type: 'bar', data: { labels: labels.map(d => d.slice(5)), datasets: [{ label: 'Daily Spend', data: labels.map(d => dailyByDate[d] || 0), backgroundColor: 'rgba(244,63,94,.55)', borderColor: '#f43f5e', borderWidth: 1, borderRadius: 3 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 8 } }, grid: { color: gc } }, y: { ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 8 }, callback: v => fmt(v) }, grid: { color: gc } } } } });
  }
  const doCtx = document.getElementById('rpt-donut-c');
  if (doCtx) {
    if (rptCharts.donut) rptCharts.donut.destroy();
    const activeCats = S.dailyCats.filter(c => catTotals[c.id] > 0);
    rptCharts.donut = new Chart(doCtx, { type: 'doughnut', data: { labels: activeCats.map(c => c.icon + ' ' + c.name), datasets: [{ data: activeCats.map(c => catTotals[c.id]), backgroundColor: activeCats.map(c => c.color), borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'right', labels: { color: lc, font: { family: 'JetBrains Mono', size: 9 }, padding: 6 } } } } });
  }
}

export function printReport() { window.print(); }

// ══════════════════════════════════════
// MONTHLY REPORT — one-click rich PDF
// ══════════════════════════════════════
export function genMonthlyReport(btn) {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth(); // 0-indexed; we report previous month if before 5th, else current
  const target = now.getDate() < 5 ? new Date(year, month - 1, 1) : new Date(year, month, 1);
  const tYear  = target.getFullYear();
  const tMonth = target.getMonth();
  const from   = `${tYear}-${String(tMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(tYear, tMonth + 1, 0).getDate();
  const to     = `${tYear}-${String(tMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthLabel = target.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const dExps      = S.dailyExps.filter(e => e.date >= from && e.date <= to);
  const dailyTotal = dExps.reduce((s, e) => s + e.amt, 0);
  const { total: fixedTotal, bd } = getTotalExp();
  const grandTotal = dailyTotal + fixedTotal;

  // Income
  const inc  = parseFloat(document.getElementById('s-inc')?.value) || 0;
  const xi   = parseFloat(document.getElementById('s-xi')?.value)  || 0;
  const totInc = inc + xi;
  const xp   = parseFloat(document.getElementById('s-xp')?.value)  || 0;
  const surp  = totInc - grandTotal - xp;

  // Debts
  const totalDebt = S.debts.reduce((s, d) => s + d.balance, 0);
  const emiTotal  = S.debts.reduce((s, d) => s + d.emi, 0);
  const { months: payoffMonths, converged: payoffConverged } = calcPayoff(S.debts, xp);

  // SIPs
  const sipMonthly  = S.sips.reduce((s, x) => s + x.amt, 0);
  const sipInvested = S.sips.reduce((s, x) => s + (x.invested || 0), 0);
  const sipCurrent  = S.sips.reduce((s, x) => s + (x.curval || 0), 0);
  const sipGain     = sipCurrent - sipInvested;
  const sipGainPct  = sipInvested > 0 ? (sipGain / sipInvested * 100).toFixed(1) : '0.0';

  // Category breakdown (daily)
  const catTotals = {};
  dExps.forEach(e => { catTotals[e.catId] = (catTotals[e.catId] || 0) + e.amt; });
  const topCats = S.dailyCats.filter(c => catTotals[c.id] > 0)
    .sort((a, b) => catTotals[b.id] - catTotals[a.id])
    .slice(0, 8);

  // Savings rate
  const savRate = totInc > 0 ? (surp / totInc * 100).toFixed(1) : '0.0';
  const savCol  = surp >= 0 ? 'var(--ok)' : 'var(--danger)';

  // Fixed expense breakdown
  const fixedRows = Object.entries(bd)
    .filter(([, b]) => b.val > 0)
    .map(([, b]) => `<tr><td>${b.icon} ${b.label}</td><td class="mono" style="text-align:right;color:var(--rose)">${fmt(b.val)}</td></tr>`)
    .join('');

  // Top daily expenses
  const top5 = [...dExps].sort((a, b) => b.amt - a.amt).slice(0, 5);

  const html = `
    <div style="font-family:'Outfit',sans-serif;color:var(--t1);padding:.5rem">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.2rem;padding-bottom:.8rem;border-bottom:2px solid var(--b1)">
        <div>
          <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:1.4rem;font-weight:900;letter-spacing:-.03em">Monthly Summary</div>
          <div style="font-size:.8rem;color:var(--t3);margin-top:.15rem">${monthLabel} · NidhiPath</div>
        </div>
        <div style="text-align:right;font-size:.6rem;color:var(--t3);font-family:'JetBrains Mono',monospace">
          Generated ${new Date().toLocaleDateString('en-IN')}<br>
          ${dExps.length} transactions
        </div>
      </div>

      <!-- KPI row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:1.2rem">
        ${[
          { l:'Total Income',    v: fmt(totInc),    c:'var(--ok)'     },
          { l:'Total Expenses',  v: fmt(grandTotal), c:'var(--danger)' },
          { l:'Surplus',         v: fmt(surp),       c: savCol         },
          { l:'Savings Rate',    v: savRate + '%',   c: savCol         },
        ].map(k => `
          <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.7rem .8rem">
            <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">${k.l}</div>
            <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:1.1rem;font-weight:900;color:${k.c}">${k.v}</div>
          </div>`).join('')}
      </div>

      <!-- Income + Expense split -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1.2rem">
        <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem">
          <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">💰 Income</div>
          <table style="width:100%;font-size:.72rem;border-collapse:collapse">
            <tr><td style="padding:.2rem 0;color:var(--t2)">Base Salary</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--ok)">${fmt(inc)}</td></tr>
            ${xi > 0 ? `<tr><td style="padding:.2rem 0;color:var(--t2)">Extra Income</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--ok)">${fmt(xi)}</td></tr>` : ''}
            <tr style="border-top:1px solid var(--b1)"><td style="padding:.3rem 0;font-weight:700">Total</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ok)">${fmt(totInc)}</td></tr>
          </table>
        </div>
        <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem">
          <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">💸 Expenses</div>
          <table style="width:100%;font-size:.72rem;border-collapse:collapse">
            <tr><td style="padding:.2rem 0;color:var(--t2)">Fixed Monthly</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--rose)">${fmt(fixedTotal)}</td></tr>
            <tr><td style="padding:.2rem 0;color:var(--t2)">Daily Expenses</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--rose)">${fmt(dailyTotal)}</td></tr>
            ${xp > 0 ? `<tr><td style="padding:.2rem 0;color:var(--t2)">Extra Payoff</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--rose)">${fmt(xp)}</td></tr>` : ''}
            <tr style="border-top:1px solid var(--b1)"><td style="padding:.3rem 0;font-weight:700">Total</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--danger)">${fmt(grandTotal + xp)}</td></tr>
          </table>
        </div>
      </div>

      <!-- Fixed expense breakdown -->
      ${fixedRows ? `
      <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem">
        <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">🏠 Fixed Expense Breakdown</div>
        <table style="width:100%;font-size:.72rem;border-collapse:collapse">${fixedRows}</table>
      </div>` : ''}

      <!-- Daily category breakdown -->
      ${topCats.length ? `
      <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem">
        <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.7rem">🗓 Daily Spend by Category</div>
        ${topCats.map(c => {
          const pct = dailyTotal > 0 ? (catTotals[c.id] / dailyTotal * 100).toFixed(1) : '0.0';
          const w   = Math.min(100, parseFloat(pct));
          return `<div style="margin-bottom:.5rem">
            <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.2rem">
              <span>${c.icon} ${c.name}</span>
              <span style="font-family:'JetBrains Mono',monospace;color:var(--danger)">${fmt(catTotals[c.id])} <span style="color:var(--t3);font-size:.62rem">${pct}%</span></span>
            </div>
            <div style="height:5px;background:var(--s3);border-radius:3px"><div style="height:5px;width:${w}%;background:${c.color};border-radius:3px"></div></div>
          </div>`;
        }).join('')}
      </div>` : `<div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem;text-align:center;color:var(--t3);font-size:.75rem">No daily expenses logged for ${monthLabel}.</div>`}

      <!-- Top 5 transactions -->
      ${top5.length ? `
      <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem">
        <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">📌 Top Transactions</div>
        <table style="width:100%;font-size:.72rem;border-collapse:collapse">
          <tr style="color:var(--t3);font-size:.6rem"><th style="text-align:left;padding:.2rem 0">Date</th><th style="text-align:left;padding:.2rem 0">Category</th><th style="text-align:left;padding:.2rem 0">Note</th><th style="text-align:right;padding:.2rem 0">Amount</th></tr>
          ${top5.map(e => {
            const c = S.dailyCats.find(x => x.id === e.catId) || { icon: '💸', name: 'Other' };
            return `<tr><td style="padding:.25rem 0;color:var(--t3);font-family:'JetBrains Mono',monospace;font-size:.65rem">${e.date}</td><td>${c.icon} ${c.name}</td><td style="color:var(--t3)">${e.note || '—'}</td><td style="text-align:right;font-family:'JetBrains Mono',monospace;color:var(--danger)">${fmt(e.amt)}</td></tr>`;
          }).join('')}
        </table>
      </div>` : ''}

      <!-- Debt snapshot -->
      ${S.debts.length ? `
      <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem">
        <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">💳 Debt Snapshot</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.6rem">
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Total Outstanding</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--danger)">${fmt(totalDebt)}</div></div>
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Monthly EMI</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--rose)">${fmt(emiTotal)}</div></div>
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Debt-Free In</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--amber)">${!payoffConverged ? '≥40 yrs' : payoffMonths > 0 ? payoffMonths + ' mo' : 'N/A'}</div></div>
        </div>
        ${S.debts.map(d => `<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-top:1px solid var(--b1);font-size:.72rem"><span style="color:var(--t2)">${d.name}</span><span style="font-family:'JetBrains Mono',monospace;color:var(--danger)">${fmt(d.balance)} <span style="color:var(--t3);font-size:.62rem">@ ${d.rate}%</span></span></div>`).join('')}
      </div>` : ''}

      <!-- SIP snapshot -->
      ${S.sips.length ? `
      <div style="background:var(--s1);border:1.5px solid var(--b1);border-radius:10px;padding:.9rem;margin-bottom:1.2rem">
        <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:.85rem;font-weight:800;margin-bottom:.6rem">📈 SIP Portfolio</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem">
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Monthly SIP</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--sky)">${fmt(sipMonthly)}</div></div>
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Invested</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700">${fmt(sipInvested)}</div></div>
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Current Value</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--teal)">${fmt(sipCurrent)}</div></div>
          <div style="text-align:center"><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase">Gain</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${sipGain >= 0 ? 'var(--ok)' : 'var(--danger)'}">${sipGain >= 0 ? '+' : ''}${fmt(sipGain)} (${sipGainPct}%)</div></div>
        </div>
      </div>` : ''}

      <!-- Footer -->
      <div style="text-align:center;font-size:.6rem;color:var(--t3);padding-top:.8rem;border-top:1px solid var(--b1)">
        NidhiPath · finance.aashman.in · ${monthLabel} Report · Data is private and stored locally
      </div>
    </div>
  `;

  const wrap = document.getElementById('rpt-preview-wrap');
  const content = document.getElementById('rpt-content');
  if (wrap) wrap.style.display = 'block';
  if (content) content.innerHTML = html;

  // Scroll to preview
  wrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export async function downloadPDF(btn) {
  const el = document.getElementById('rpt-content');
  if (!el) { alert('Generate a report first'); return; }
  // btn may be passed directly from onclick="downloadPDF(this)" or resolved here
  const button = btn instanceof HTMLElement ? btn : document.querySelector('[onclick*="downloadPDF"]');
  try {
    if (button) { button.textContent = '⏳ Generating...'; button.disabled = true; }
    const canvas = await html2canvas(el, { backgroundColor: S.theme === 'dark' ? '#101022' : '#ffffff', scale: 2, useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth() - 20, ph = pdf.internal.pageSize.getHeight() - 20;
    const imgW = canvas.width, imgH = canvas.height, ratio = imgW / pw;
    const pages = Math.ceil((imgH / ratio) / ph);
    for (let p = 0; p < pages; p++) {
      if (p > 0) pdf.addPage();
      const srcY = p * ph * ratio;
      const srcH = Math.min(ph * ratio, imgH - srcY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = imgW; pageCanvas.height = srcH;
      pageCanvas.getContext('2d').drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.9);
      pdf.addImage(imgData, 'JPEG', 10, 10, pw, srcH / ratio);
    }
    const from = document.getElementById('rpt-from').value, to = document.getElementById('rpt-to').value;
    pdf.save(`FinanceFreedom_Report_${from}_to_${to}.pdf`);
    if (button) { button.textContent = '⬇️ Download PDF'; button.disabled = false; }
  } catch (e) {
    console.error(e);
    alert('PDF generation failed. Try Print instead.');
    if (button) { button.textContent = '⬇️ Download PDF'; button.disabled = false; }
  }
}

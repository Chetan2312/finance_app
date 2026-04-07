// ══════════════════════════════════════
// REPORTS — genReport, buildGantt, drawRptCharts, print, PDF
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { S, rptCharts } from '../state.js';
import { getTotalExp } from '../state.js';

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

export async function downloadPDF() {
  const el = document.getElementById('rpt-content');
  if (!el) { alert('Generate a report first'); return; }
  try {
    const btn = event.target;
    btn.textContent = '⏳ Generating...';
    btn.disabled = true;
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
    btn.textContent = '⬇️ Download PDF';
    btn.disabled = false;
  } catch (e) {
    console.error(e);
    alert('PDF generation failed. Try Print instead.');
    event.target.textContent = '⬇️ Download PDF';
    event.target.disabled = false;
  }
}

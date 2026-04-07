// ══════════════════════════════════════
// DAILY EXPENSES — quick add, edit, stats, category mgr
// ══════════════════════════════════════
import { fmt, today } from '../utils.js';
import { S, dcEm, setDcEm, sv } from '../state.js';
import { openMo, cmo, buildEg } from './modals.js';

let rcFn = () => {};
export function setRcFn(fn) { rcFn = fn; }

export function openDCatModal(id) {
  const c = id ? S.dailyCats.find(x => x.id === id) : null;
  document.getElementById('dc-eid').value = id || ''; document.getElementById('mo-dcat-t').textContent = id ? '✏️ Edit Category' : 'New Category';
  document.getElementById('dc-nm').value = c ? c.name : ''; document.getElementById('dc-col').value = c ? c.color : '#fb7185';
  setDcEm(c ? c.icon : '☕'); buildEg('eg-dcat', () => dcEm, e => setDcEm(e)); openMo('mo-dcat');
}

export function saveDCat() {
  const nm = document.getElementById('dc-nm').value.trim(); if (!nm) { alert('Enter name'); return; }
  const col = document.getElementById('dc-col').value, eid = document.getElementById('dc-eid').value;
  if (eid) { const c = S.dailyCats.find(x => x.id === eid); if (c) { c.name = nm; c.icon = dcEm; c.color = col; } }
  else S.dailyCats.push({ id: 'dc' + Date.now(), name: nm, icon: dcEm, color: col });
  cmo(); sv(); renderCatMgr(); renderDex(); renderDexSelects();
}

export function rmDCat(id) {
  if (!confirm('Delete category? Expenses in it become uncategorised.')) return;
  S.dailyCats = S.dailyCats.filter(c => c.id !== id);
  S.dailyExps.forEach(e => { if (e.catId === id) e.catId = 'dc10'; });
  sv(); renderCatMgr(); renderDex(); renderDexSelects();
}

export function renderCatMgr() {
  const el = document.getElementById('cat-mgr'); if (!el) return;
  el.innerHTML = S.dailyCats.map(c => `<div class="cat-pill" style="background:${c.color}15;border-color:${c.color}50;color:${c.color}">${c.icon} ${c.name}<span style="margin-left:.3rem;display:inline-flex;gap:.2rem"><button class="btn bxs" style="background:transparent;border:none;padding:0;cursor:pointer;opacity:.7" onclick="openDCatModal('${c.id}')">✏️</button><button class="btn bxs" style="background:transparent;border:none;padding:0;cursor:pointer;opacity:.7" onclick="rmDCat('${c.id}')">✕</button></span></div>`).join('');
}

export function renderDexSelects() {
  ['de-qcat', 'de-cat'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = S.dailyCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    if (cur) el.value = cur;
  });
}

export function addDex() {
  const dt = document.getElementById('de-qdt').value || today();
  const catId = document.getElementById('de-qcat').value;
  const amt = parseFloat(document.getElementById('de-qamt').value) || 0;
  const note = document.getElementById('de-qnote').value.trim();
  if (!amt) { alert('Enter amount'); return; }
  S.dailyExps.push({ id: 'dex' + Date.now(), date: dt, catId, amt, note });
  document.getElementById('de-qamt').value = ''; document.getElementById('de-qnote').value = '';
  sv(); renderDex(); rcFn();
}

export function openDexEdit(id) {
  const e = S.dailyExps.find(x => x.id === id); if (!e) return;
  document.getElementById('dex-eid').value = id; document.getElementById('de-dt').value = e.date;
  renderDexSelects(); document.getElementById('de-cat').value = e.catId;
  document.getElementById('de-amt').value = e.amt; document.getElementById('de-note').value = e.note || '';
  openMo('mo-dex');
}

export function saveDexEdit() {
  const id = document.getElementById('dex-eid').value; const e = S.dailyExps.find(x => x.id === id); if (!e) return;
  e.date = document.getElementById('de-dt').value; e.catId = document.getElementById('de-cat').value;
  e.amt = parseFloat(document.getElementById('de-amt').value) || 0; e.note = document.getElementById('de-note').value.trim();
  cmo(); sv(); renderDex(); rcFn();
}

export function rmDex(id) { S.dailyExps = S.dailyExps.filter(e => e.id !== id); sv(); renderDex(); rcFn(); }

export function renderDex() {
  renderDexStats();
  const el = document.getElementById('dex-list'); if (!el) return;
  const filterMo = document.getElementById('dex-filter-mo')?.value || '';
  let exps = filterMo ? S.dailyExps.filter(e => e.date.startsWith(filterMo)) : S.dailyExps;
  if (!exps.length) { el.innerHTML = '<div class="empty"><span class="empty-ic">🗓</span>No daily expenses yet.</div>'; return; }
  exps = [...exps].sort((a, b) => b.date.localeCompare(a.date));
  const grouped = {}; exps.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e); });
  el.innerHTML = Object.entries(grouped).map(([date, items]) => {
    const tot = items.reduce((s, e) => s + e.amt, 0);
    const label = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<div class="mb1"><div class="dex-day-hd"><div class="dex-day-lbl">${label}</div><div class="dex-day-tot">${fmt(tot)}</div></div>${items.map(e => { const cat = S.dailyCats.find(c => c.id === e.catId) || { name: 'Other', icon: '💸', color: '#94a3b8' }; return `<div class="dex-entry"><div class="dex-date">${date}</div><div class="dex-cat-dot" style="background:${cat.color}"></div><div class="dex-label">${cat.icon} ${cat.name}${e.note ? `<span class="dex-note">— ${e.note}</span>` : ''}</div><div class="dex-amt">${fmt(e.amt)}</div><div class="dex-acts"><button class="btn bg bsm bic" onclick="openDexEdit('${e.id}')" title="Edit">✏️</button><button class="btn bd bsm bic" onclick="rmDex('${e.id}')" title="Delete">✕</button></div></div>`; }).join('')}</div>`;
  }).join('');
}

export function renderDexStats() {
  const now = new Date(), todayStr = now.toISOString().split('T')[0];
  const wk = new Date(now); wk.setDate(wk.getDate() - 6); const wkStr = wk.toISOString().split('T')[0];
  const moStr = now.toISOString().slice(0, 7);
  const todayAmt = S.dailyExps.filter(e => e.date === todayStr).reduce((s, e) => s + e.amt, 0);
  const wkAmt = S.dailyExps.filter(e => e.date >= wkStr).reduce((s, e) => s + e.amt, 0);
  const moExps = S.dailyExps.filter(e => e.date.startsWith(moStr)); const moAmt = moExps.reduce((s, e) => s + e.amt, 0);
  const catTots = {}; moExps.forEach(e => { catTots[e.catId] = (catTots[e.catId] || 0) + e.amt; });
  const topCatId = Object.entries(catTots).sort((a, b) => b[1] - a[1])[0]?.[0]; const topCat = topCatId ? S.dailyCats.find(c => c.id === topCatId) : null;
  document.getElementById('dex-today').textContent = fmt(todayAmt); document.getElementById('dex-today-c').textContent = S.dailyExps.filter(e => e.date === todayStr).length + ' entries';
  document.getElementById('dex-week').textContent = fmt(wkAmt); document.getElementById('dex-month').textContent = fmt(moAmt); document.getElementById('dex-month-c').textContent = moExps.length + ' entries';
  document.getElementById('dex-top').textContent = topCat ? topCat.icon + ' ' + topCat.name : '—'; document.getElementById('dex-tops').textContent = topCat ? fmt(catTots[topCatId]) : ' this month';
  document.getElementById('ov-dex').textContent = fmt(moAmt); document.getElementById('ov-dexs').textContent = moExps.length + ' entries this month';
}

export function buildMonthFilter() {
  const el = document.getElementById('dex-filter-mo'); if (!el) return;
  const months = new Set(S.dailyExps.map(e => e.date.slice(0, 7)));
  const cur = new Date().toISOString().slice(0, 7);
  el.innerHTML = `<option value="">All Months</option>` + [...months].sort().reverse().map(m => `<option value="${m}" ${m === cur ? 'selected' : ''}>${m}</option>`).join('');
}

export function clearDexFilter() { document.getElementById('dex-filter-mo').value = ''; renderDex(); }

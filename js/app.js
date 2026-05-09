// ══════════════════════════════════════
// APP.JS — main entry module (Phase 6)
// Imports all tab modules, wires callbacks,
// navigation, init.
// ══════════════════════════════════════
import { today } from './utils.js';
import { S, sv, load, applyFromData, initSecs, initDCats } from './state.js';
import { exportData, importData } from './storage.js';

// ── Phase 3 modules ──
import { openMo, cmo, initModalListeners, pickEm } from './modules/modals.js';
import { renderExp, togSec, openSecModal, saveSection, rmCustSec, openItemModal, saveItem, rmExpItem, setRcFn as setExpRc } from './modules/expenses.js';
import { renderDebts, upRepHint, openDebtModal, saveDebt, rmDebt, setSt, setRcFn as setDebtRc } from './modules/debts.js';
import { renderSIPs, sipSummary, openSIPModal, saveSIP, rmSIP, toggleRealFV, setRcFn as setSipRc } from './modules/sips.js';
import { renderDex, renderDexStats, renderCatMgr, renderDexSelects, buildMonthFilter, clearDexFilter, addDex, openDexEdit, saveDexEdit, rmDex, openDCatModal, saveDCat, rmDCat, setRcFn as setDailyRc } from './modules/daily.js';

// ── Phase 4 modules ──
import { toggleTheme, applyTheme } from './modules/theme.js';
import { rc, setOverviewFns } from './modules/overview.js';
import { updateBudget } from './modules/budget.js';
import { genReport, printReport, downloadPDF, genMonthlyReport } from './modules/reports.js';
import { dov, dol, dod, hStmt } from './modules/statements.js';
import { genMilestones } from './modules/milestones.js';

// ── Phase 5: static invest module ──
import { loadInvest } from './modules/invest.js';

// ── Phase 6 modules ──
import { sq, sendMsg, toggleApiKeyPanel, applyApiKey, clearApiKeyUI } from './modules/ai.js';

// ── SMS import ──
import { parseSMS, renderSMS, smsPaste, smsFromClipboard, smsImportOne, smsImportAll, smsDismiss, setRcFn as setSmsRc } from './modules/sms.js';

// ── Retirement ──
import { genRetirement, initRetirementListeners } from './modules/retirement.js';

// ── v8 modules ──
import { initAuth, setAuthCallbacks, setAuthRcFn, showAuthModal } from './modules/auth.js';
import { renderHousehold, initHouseholdWindowBindings, setRcFn as setHhRc } from './modules/household.js';

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function sw(t, el) {
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('pg-' + t).classList.add('on');
  if (t === 'invest')     loadInvest();
  if (t === 'sms')        renderSMS();
  if (t === 'household')  renderHousehold();
  if (t === 'milestones') genMilestones();
  if (t === 'retirement') genRetirement();
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

// ── Import handler — called after importData writes to IDB ──
function onImport(d) {
  applyFromData(d, applyTheme);
  initSecs(); initDCats();
  renderAll();
}

function renderAll() {
  renderExp(); renderDebts(); renderSIPs(); renderCatMgr(); renderDexSelects(); buildMonthFilter(); renderDex(); rc();
  togSec('housing');
  document.getElementById('st-av').classList.toggle('on', S.strat === 'avalanche');
  document.getElementById('st-sn').classList.toggle('on', S.strat === 'snowball');
}

// ── Tax regime helpers ──
function setTaxRegime(v) {
  S.taxRegime = v;
  const slabWrap = document.getElementById('s-tax-slab-wrap');
  if (slabWrap) slabWrap.style.display = v === 'old' ? '' : 'none';
  sv(); loadInvest();
}
function setTaxSlab(v) {
  S.taxSlab = parseInt(v) || 30;
  sv(); loadInvest();
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
  // Wire rc() into tab modules
  setExpRc(rc); setDebtRc(rc); setSipRc(rc); setDailyRc(rc); setSmsRc(rc);

  // Wire cross-module callbacks into overview
  setOverviewFns({ sipSummary, renderDebts, renderDexStats, updateBudget });

  // Init modal listeners
  initModalListeners();

  // Load persisted data (IndexedDB, migrates localStorage automatically)
  await load(applyTheme);

  // Ensure default sections/cats are present
  initSecs(); initDCats();

  // Render all
  renderAll();
  document.getElementById('de-qdt').value = today();

  // Sync tax regime UI with restored state
  const taxRegimeEl = document.getElementById('s-tax-regime');
  if (taxRegimeEl) taxRegimeEl.value = S.taxRegime || 'new';
  const taxSlabEl = document.getElementById('s-tax-slab');
  if (taxSlabEl) taxSlabEl.value = String(S.taxSlab || 30);
  const slabWrap = document.getElementById('s-tax-slab-wrap');
  if (slabWrap) slabWrap.style.display = (S.taxRegime === 'old') ? '' : 'none';
  document.addEventListener('input', e => {
    if (['s-inc', 's-xi', 's-sav', 's-xp'].includes(e.target.id)) { sv(); rc(); }
  });

  // Retirement listeners
  initRetirementListeners();

  // v8: household + auth
  initHouseholdWindowBindings();
  setHhRc(rc);
  setAuthCallbacks(
    async (user, hhId) => { renderHousehold(); },
    () => { renderHousehold(); }
  );
  setAuthRcFn(rc);
  initAuth();

  // Handle ?join=CODE deep links
  const joinCode = new URLSearchParams(location.search).get('join');
  if (joinCode) {
    history.replaceState({}, '', location.pathname);
    sessionStorage.setItem('pending_join_code', joinCode);
  }
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
  openSIPModal, saveSIP, rmSIP, toggleRealFV,
  // Daily
  openDCatModal, saveDCat, rmDCat, addDex, openDexEdit, saveDexEdit, rmDex, clearDexFilter, renderDex,
  // Reports
  genReport, printReport, downloadPDF, genMonthlyReport,
  // Statements
  dov, dol, dod, hStmt,
  // AI
  sq, sendMsg, toggleApiKeyPanel, applyApiKey, clearApiKeyUI,
  // Milestones
  genMilestones,
  // Retirement
  genRetirement,
  // Modals
  openMo, cmo, pickEm,
  // Navigation
  sw,
  // SMS import
  smsPaste, smsFromClipboard, smsImportOne, smsImportAll, smsDismiss,
  // Auth + Household
  showAuthModal,
  renderHousehold,
  // Tax regime
  setTaxRegime, setTaxSlab,
  // Core
  sv, rc,
  // Data export/import (Phase 8)
  exportData,
  importData: (file) => importData(file, onImport),
});

init();

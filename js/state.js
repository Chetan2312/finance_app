// ══════════════════════════════════════
// STATE — app state, persistence, core calculations
// ══════════════════════════════════════
import { gv, N } from './utils.js';
import { DEF_SECS, DEF_DCATS } from '../data/defaults.js';

// ── Global state ──
export let S = {
  inc: 0, xi: 0, sav: 0, xp: 0,
  debts: [], sips: [], expSecs: [], custSecs: [],
  dailyExps: [], dailyCats: [],
  chatHist: [], strat: 'avalanche', theme: 'dark',
};

// Mutable refs used by various modules
export let iCtx = { sid: null, isEmi: false };
export let charts = { sip: null, alloc: null, stmt: null };
export let rptCharts = { bar: null, donut: null };
export let mktLoaded = false;
export function setMktLoaded(v) { mktLoaded = v; }

// Emoji state for modals
export let sEm = '✨', secEm = '✨', dcEm = '☕';
export function setSEm(v) { sEm = v; }
export function setSecEm(v) { secEm = v; }
export function setDcEm(v) { dcEm = v; }

// Item context for expense modals
export let iCtxSid = null, iCtxEmi = false;
export function setICtx(sid, emi) { iCtxSid = sid; iCtxEmi = emi; }

// ── Persistence ──
let saveTimer;
export function sv() {
  const b = document.getElementById('sv-badge');
  b.classList.add('busy');
  document.getElementById('sv-txt').textContent = 'SAVING';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('ff6', JSON.stringify({
        inc: gv('s-inc'), xi: gv('s-xi'), sav: gv('s-sav'), xp: gv('s-xp'),
        debts: S.debts, sips: S.sips, expSecs: S.expSecs, custSecs: S.custSecs,
        dailyExps: S.dailyExps, dailyCats: S.dailyCats,
        strat: S.strat, theme: S.theme, chatHist: S.chatHist.slice(-20)
      }));
      b.classList.remove('busy');
      document.getElementById('sv-txt').textContent = 'SAVED';
    } catch (e) {}
  }, 500);
}

export function load(applyThemeFn) {
  try {
    const d = JSON.parse(localStorage.getItem('ff6') || 'null');
    if (!d) return;
    ['inc', 'xi', 'sav', 'xp'].forEach(k => {
      const m = { inc: 's-inc', xi: 's-xi', sav: 's-sav', xp: 's-xp' };
      const el = document.getElementById(m[k]);
      if (el && d[k]) el.value = d[k];
    });
    S.debts = d.debts || []; S.sips = d.sips || []; S.expSecs = d.expSecs || []; S.custSecs = d.custSecs || [];
    S.dailyExps = d.dailyExps || []; S.dailyCats = d.dailyCats || [];
    S.strat = d.strat || 'avalanche'; S.chatHist = d.chatHist || [];
    if (d.theme) { S.theme = d.theme; applyThemeFn(d.theme); }
  } catch (e) {}
}

// ── Init helpers ──
export function initSecs() {
  if (!S.expSecs.length) S.expSecs = JSON.parse(JSON.stringify(DEF_SECS));
  DEF_SECS.forEach(d => {
    if (!S.expSecs.find(s => s.id === d.id)) S.expSecs.push(JSON.parse(JSON.stringify(d)));
  });
}

export function initDCats() {
  if (!S.dailyCats.length) S.dailyCats = JSON.parse(JSON.stringify(DEF_DCATS));
}

// ── Core calculations ──
export function secTot(sec) {
  if (sec.isEmi) return S.debts.reduce((s, d) => s + d.emi, 0) + sec.items.filter(i => !i.linked).reduce((s, i) => s + (i.val || 0), 0);
  return sec.items.reduce((s, i) => s + (i.val || 0), 0);
}

export function getTotalExp() {
  let tot = 0, bd = {};
  [...S.expSecs, ...S.custSecs].forEach(sec => {
    const v = secTot(sec);
    bd[sec.id] = { label: sec.name, icon: sec.icon, color: sec.color, val: v };
    tot += v;
  });
  return { total: tot, bd };
}

export function calcPayoff(debts, extra) {
  if (!debts.length) return { results: [], months: 0, totalInt: 0 };
  const eds = debts.filter(d => d.repay === 'emi' || !d.repay);
  if (!eds.length) return { results: [], months: 0, totalInt: 0 };
  let bals = eds.map(d => ({ ...d, bal: d.balance }));
  let sorted = S.strat === 'avalanche' ? [...bals].sort((a, b) => b.rate - a.rate) : [...bals].sort((a, b) => a.bal - b.bal);
  let months = 0, results = [], totalInt = 0, remaining = [...sorted];
  while (remaining.length && months < 480) {
    months++;
    remaining.forEach(d => { const i = d.bal * (d.rate / 100 / 12); totalInt += i; d.bal += i; });
    remaining.forEach(d => { if (d.emi > 0) d.bal -= Math.min(d.emi, d.bal); });
    if (remaining.length && extra > 0) { const t = remaining[0]; t.bal -= Math.min(extra, t.bal); }
    remaining = remaining.filter(d => { if (d.bal <= 1) { results.push({ ...d, month: months }); return false; } return true; });
  }
  return { results, months, totalInt };
}

export function sipFV(cv, mo, mo2, ret) {
  const r = ret / 100 / 12;
  return cv * Math.pow(1 + r, mo2) + mo * (Math.pow(1 + r, mo2) - 1) / r;
}

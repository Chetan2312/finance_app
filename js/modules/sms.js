// ══════════════════════════════════════
// js/modules/sms.js — Bank SMS auto-import
// Parses Indian bank SMS text → daily expense entries
// Supports: HDFC, SBI, ICICI, Axis, Kotak, Paytm, Yes, IndusInd
// ══════════════════════════════════════
import { fmt, today } from '../utils.js';
import { S, sv } from '../state.js';

let _rcFn = () => {};
export function setRcFn(fn) { _rcFn = fn; }

// ── Parser patterns ──────────────────────────────────────────
// Each rule: { bank, regex, extract(match) → { amt, merchant, type } }
const RULES = [
  // HDFC: "Rs.500.00 debited from a/c XX1234 on 01-Jan-25 trf to SWIGGY"
  { bank: 'HDFC',
    re: /(?:Rs\.?|INR\s*)(\d[\d,]*\.?\d*)\s*(?:debited|deducted|spent)/i,
    merchant: /(?:trf to|at|to)\s+([A-Z][A-Z0-9 &._/-]{1,30})/i },

  // ICICI: "INR 250.00 spent on ICICI Bank Credit Card XX9876 at AMAZON"
  { bank: 'ICICI',
    re: /INR\s*(\d[\d,]*\.?\d*)\s*(?:spent|debited|deducted)/i,
    merchant: /\bat\s+([A-Z][A-Z0-9 &._/-]{1,30})/i },

  // SBI: "Your a/c no. XX7890 is debited by Rs 1200.00 on 01JAN25. Info: UPI-PHONEPE"
  { bank: 'SBI',
    re: /debited\s+by\s+Rs\.?\s*(\d[\d,]*\.?\d*)/i,
    merchant: /Info:\s*([A-Z0-9][A-Z0-9 &._/-]{1,30})/i },

  // Axis: "INR 399.00 has been debited from Axis Bank A/c XX4321 towards NETFLIX"
  { bank: 'Axis',
    re: /INR\s*(\d[\d,]*\.?\d*)\s*has been debited/i,
    merchant: /towards\s+([A-Z][A-Z0-9 &._/-]{1,30})/i },

  // Kotak: "Rs.800 debited from Kotak Bank Ac XXXXXX1234 for UPI txn ZOMATO"
  { bank: 'Kotak',
    re: /Rs\.?\s*(\d[\d,]*\.?\d*)\s*debited from Kotak/i,
    merchant: /(?:for UPI txn|to)\s+([A-Z][A-Z0-9 &._/-]{1,30})/i },

  // Paytm/UPI generic: "Paid Rs.150 to CAFE COFFEE DAY"
  { bank: 'UPI',
    re: /(?:Paid|paid|Sent|sent)\s+(?:Rs\.?|INR\s*)(\d[\d,]*\.?\d*)\s*(?:to|at)/i,
    merchant: /(?:to|at)\s+([A-Za-z][A-Za-z0-9 &._/-]{1,30})/i },

  // Generic debit fallback: "debited Rs 500 UPI ref"
  { bank: 'Generic',
    re: /(?:debited|deducted)\s+(?:Rs\.?|INR)?\s*(\d[\d,]*\.?\d*)/i,
    merchant: /(?:UPI-|ref\s+|at\s+)([A-Z][A-Z0-9 &._/-]{1,20})/i },
];

// Date patterns within SMS
const DATE_RE = [
  /(\d{2})[/-](\w{3})[/-](\d{2,4})/,   // 01-Jan-25
  /(\d{2})[/-](\d{2})[/-](\d{2,4})/,   // 01/01/2025
  /(\d{1,2})\s+(\w{3})\s+(\d{2,4})/,   // 1 Jan 2025
  /(\d{8})/,                             // 20250101
];

const MON = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function _parseAmt(s) {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

function _parseDate(sms) {
  for (const re of DATE_RE) {
    const m = sms.match(re);
    if (!m) continue;
    try {
      if (re === DATE_RE[3]) {
        const s = m[1];
        return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
      }
      const [, a, b, c] = m;
      const mo = MON[b.toLowerCase().slice(0,3)];
      if (mo !== undefined) {
        const yr = c.length === 2 ? '20' + c : c;
        return `${yr}-${String(mo + 1).padStart(2,'0')}-${a.padStart(2,'0')}`;
      }
      // numeric dd/mm/yy
      const yr2 = c.length === 2 ? '20' + c : c;
      return `${yr2}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
    } catch (_) {}
  }
  return today();
}

function _cleanMerchant(s) {
  return (s || 'Unknown')
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 &._/-]/g, '')
    .trim()
    .slice(0, 30);
}

export function parseSMS(text) {
  const results = [];
  // Split on newlines — each line may be a separate SMS
  const lines = text.split(/\n{2,}|\r\n\r\n/).map(l => l.trim()).filter(Boolean);
  const blocks = lines.length > 1 ? lines : [text];

  for (const block of blocks) {
    for (const rule of RULES) {
      const amtM = block.match(rule.re);
      if (!amtM) continue;
      const amt = _parseAmt(amtM[1]);
      if (!amt || amt <= 0) continue;

      // Skip credit/received messages
      if (/credited|received|added|deposited/i.test(block) &&
          !/debited|spent|deducted|paid|sent/i.test(block)) continue;

      const mercM = block.match(rule.merchant);
      const merchant = _cleanMerchant(mercM?.[1] || rule.bank);
      const date = _parseDate(block);

      results.push({ amt, merchant, date, bank: rule.bank, raw: block.slice(0, 80) });
      break;
    }
  }
  return results;
}

// ── Default category guesser ─────────────────────────────────
const CAT_MAP = [
  { kw: /zomato|swiggy|food|cafe|restaurant|dhaba|pizza|burger|chai|coffee|eat/i,       hint: 'food' },
  { kw: /uber|ola|rapido|auto|cab|taxi|metro|bus|petrol|fuel|parking/i,                  hint: 'transport' },
  { kw: /amazon|flipkart|myntra|meesho|ajio|nykaa|shop|store|market/i,                   hint: 'shopping' },
  { kw: /netflix|hotstar|prime|spotify|youtube|zepto|blinkit|grofer/i,                   hint: 'subscriptions' },
  { kw: /hospital|pharmacy|medical|doctor|clinic|health|apollo|1mg/i,                    hint: 'health' },
  { kw: /school|college|tuition|course|book|education/i,                                  hint: 'education' },
  { kw: /electricity|water|gas|broadband|wifi|mobile|recharge|jio|airtel/i,              hint: 'utilities' },
  { kw: /rent|housing|flat|maintenance|society/i,                                          hint: 'housing' },
];

function _guessCategory(merchant) {
  for (const { kw, hint } of CAT_MAP) {
    if (kw.test(merchant)) {
      const cat = S.dailyCats.find(c => c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase()));
      if (cat) return cat.id;
    }
  }
  return S.dailyCats[S.dailyCats.length - 1]?.id || '';
}

// ── State for pending imports ─────────────────────────────────
let _pending = [];

export function renderSMS() {
  const el = document.getElementById('sms-result');
  if (!el) return;

  if (!_pending.length) {
    el.style.display = 'none';
    return;
  }

  const catOpts = S.dailyCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  el.style.display = '';
  el.innerHTML = `
    <div class="sh mb1"><div class="shdot" style="background:var(--ok)"></div>
      ${_pending.length} transaction${_pending.length > 1 ? 's' : ''} detected
      <button class="btn bp bsm" style="margin-left:auto" onclick="smsImportAll()">⬇️ Import All</button>
    </div>
    <div id="sms-rows">
      ${_pending.map((p, i) => `
        <div class="sms-row" id="sms-row-${i}">
          <div class="sms-row-meta">
            <span class="bdg" style="background:var(--info-s);color:var(--p2)">${p.bank}</span>
            <span class="xs c-muted">${p.date}</span>
            <span class="xs c-muted mono">${p.raw}</span>
          </div>
          <div class="sms-row-fields">
            <input class="ci" type="number" id="sms-amt-${i}" value="${p.amt}" style="width:100px">
            <input class="ci" type="date" id="sms-date-${i}" value="${p.date}" style="width:145px">
            <select class="ci" id="sms-cat-${i}" style="flex:1">${catOpts}</select>
            <input class="ci" id="sms-note-${i}" value="${p.merchant}" style="flex:1;min-width:120px" placeholder="Note">
            <button class="btn bp bsm" onclick="smsImportOne(${i})">+ Add</button>
            <button class="btn bg bsm" onclick="smsDismiss(${i})">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Set default categories after render
  _pending.forEach((p, i) => {
    const sel = document.getElementById(`sms-cat-${i}`);
    if (sel) sel.value = _guessCategory(p.merchant);
  });
}

export function smsPaste() {
  const ta = document.getElementById('sms-input');
  const txt = ta?.value?.trim();
  if (!txt) { _smsMsg('Paste SMS text above first.', 'warn'); return; }
  const found = parseSMS(txt);
  if (!found.length) { _smsMsg('No debit transactions found. Check if SMS shows a debited/spent/paid amount.', 'warn'); return; }
  _pending = found;
  _smsMsg(`Found ${found.length} transaction${found.length > 1 ? 's' : ''}. Review below.`, 'ok');
  renderSMS();
}

export function smsFromClipboard() {
  if (!navigator.clipboard?.readText) {
    _smsMsg('Clipboard API not supported. Paste SMS text manually.', 'warn');
    return;
  }
  navigator.clipboard.readText().then(txt => {
    const ta = document.getElementById('sms-input');
    if (ta) ta.value = txt;
    smsPaste();
  }).catch(() => {
    _smsMsg('Clipboard access denied. Paste SMS text manually.', 'warn');
  });
}

export function smsImportOne(i) {
  const p = _pending[i];
  if (!p) return;
  const amt  = parseFloat(document.getElementById(`sms-amt-${i}`)?.value) || p.amt;
  const date = document.getElementById(`sms-date-${i}`)?.value || p.date;
  const catId = document.getElementById(`sms-cat-${i}`)?.value || _guessCategory(p.merchant);
  const note = document.getElementById(`sms-note-${i}`)?.value?.trim() || p.merchant;

  S.dailyExps.push({ id: 'de' + Date.now() + i, date, catId, amt, note });
  sv();
  _rcFn();

  _pending.splice(i, 1);
  _smsMsg('Added to Daily Expenses.', 'ok');
  renderSMS();
}

export function smsImportAll() {
  let count = 0;
  _pending.forEach((p, i) => {
    const amt  = parseFloat(document.getElementById(`sms-amt-${i}`)?.value) || p.amt;
    const date = document.getElementById(`sms-date-${i}`)?.value || p.date;
    const catId = document.getElementById(`sms-cat-${i}`)?.value || _guessCategory(p.merchant);
    const note = document.getElementById(`sms-note-${i}`)?.value?.trim() || p.merchant;
    if (amt > 0) {
      S.dailyExps.push({ id: 'de' + Date.now() + i, date, catId, amt, note });
      count++;
    }
  });
  sv();
  _rcFn();
  _pending = [];
  _smsMsg(`${count} expense${count !== 1 ? 's' : ''} imported to Daily Expenses.`, 'ok');
  renderSMS();
}

export function smsDismiss(i) {
  _pending.splice(i, 1);
  renderSMS();
}

function _smsMsg(msg, type) {
  const el = document.getElementById('sms-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sms-msg ' + type;
  el.style.display = '';
  clearTimeout(el._t);
  if (type === 'ok') el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

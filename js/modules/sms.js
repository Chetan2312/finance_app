// ══════════════════════════════════════
// js/modules/sms.js — Bank SMS auto-import
// Universal parser — works on any Indian bank debit SMS.
// Strategy: signal words → extract amount + payee, no bank-specific rules.
// ══════════════════════════════════════
import { fmt, today } from '../utils.js';
import { S, sv } from '../state.js';

let _rcFn = () => {};
export function setRcFn(fn) { _rcFn = fn; }

// ── Noise tokens to strip from extracted merchant names ───────
const NOISE = /\b(bank|a\/c|ac|acct|account|avl|bal|balance|upi|ref|refno|txn|transaction|neft|imps|rtgs|transfer|if not|call|helpline|for queries|customer care|services|info|dear|user|your|has been|is|was|the|on|date|time|from|towards|card|credit|debit|saving|current|salary|linked)\b/gi;

// Payee-introducing keywords — text after these is the merchant
const PAYEE_TRIGGERS = [
  /\btrf(?:\s+to)?\s+/i,
  /\btowards\s+/i,
  /\bat\s+/i,
  /\bto\s+/i,
  /\bInfo:\s*/i,
  /\bfor\s+(?:UPI\s+txn\s+)?/i,
  /\bVPA\s+/i,
  /\bpayee\s+/i,
];

// Terminals — stop extracting merchant name at these
const PAYEE_STOP = /\s+(?:Refno|Ref No|UPI Ref|txn id|transaction|avl|bal|balance|if not|call|rs\.?|inr|\d{6,}|\.)/i;

// Words that are definitely NOT merchant names
const NOT_MERCHANT = /^(upi|neft|imps|rtgs|sbi|hdfc|icici|axis|kotak|yes|indusind|paytm|phonepe|gpay|bank|a\/c|xx|ref|txn|on|at|by|to|the|for|has|been|is|was|your|dear|not|if|call|services?|queries|care|info|avl|bal|balance|saving|current|salary)$/i;

const MON = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

// ── Amount extraction ─────────────────────────────────────────
// Collects ALL numeric values, then picks the most likely debit amount:
// - Has a currency signal nearby (Rs/INR/₹) → prefer that
// - Otherwise: not a 10-digit phone, not a 4-6 digit OTP/PIN,
//   not an 8+ digit ref number → pick the one right after a debit keyword
function _extractAmt(sms) {
  // 1. Explicit currency-tagged amount
  let m = sms.match(/(?:Rs\.?|INR|₹)\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (m) return parseFloat(m[1].replace(/,/g, ''));

  // 2. Amount adjacent to a debit signal word
  m = sms.match(/(?:debited|deducted|spent|paid|sent)\s+(?:by\s+)?(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (m) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    // Reject if it looks like a ref/phone number (too many digits, no decimal)
    if (v > 0 && (m[1].includes('.') || m[1].replace(/,/g,'').length <= 7)) return v;
  }

  // 3. Amount before a debit signal word  e.g. "374.00 debited"
  m = sms.match(/(\d[\d,]*\.\d{1,2})\s*(?:debited|deducted|spent)/i);
  if (m) return parseFloat(m[1].replace(/,/g, ''));

  return 0;
}

// ── Merchant/payee extraction ─────────────────────────────────
function _extractMerchant(sms) {
  for (const trigger of PAYEE_TRIGGERS) {
    const idx = sms.search(trigger);
    if (idx === -1) continue;
    // Move past the trigger keyword
    const afterTrigger = sms.slice(idx).replace(trigger, '');
    // Cut at terminal token
    const chunk = afterTrigger.split(PAYEE_STOP)[0].trim();
    if (!chunk) continue;
    // Take first 1-4 words, skip noise/bank tokens
    const words = chunk.split(/\s+/)
      .filter(w => w.length > 1 && !NOT_MERCHANT.test(w))
      .slice(0, 4);
    if (words.length) return words.join(' ').slice(0, 35);
  }

  // Fallback: look for a UPI VPA  e.g. merchant@upi
  const vpa = sms.match(/([a-z0-9._-]+@[a-z]+)/i);
  if (vpa) return vpa[1].split('@')[0]; // e.g. "swiggy" from "swiggy@icici"

  return '';
}

// ── Date extraction ───────────────────────────────────────────
function _parseDate(sms) {
  let m;
  // DDMonYY(YY) — no separator e.g. 06May26
  m = sms.match(/\b(\d{1,2})([A-Za-z]{3})(\d{2,4})\b/);
  if (m) {
    const mo = MON[m[2].toLowerCase()];
    if (mo !== undefined) {
      const yr = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${yr}-${String(mo + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
  // DD-Mon-YY or DD/Mon/YYYY
  m = sms.match(/(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2,4})/);
  if (m) {
    const mo = MON[m[2].toLowerCase()];
    if (mo !== undefined) {
      const yr = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${yr}-${String(mo + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
  // DD/MM/YYYY or DD-MM-YY
  m = sms.match(/(\d{2})[/-](\d{2})[/-](\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yr}-${m[2]}-${m[1]}`;
  }
  // D Mon YYYY
  m = sms.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (m) {
    const mo = MON[m[2].toLowerCase().slice(0, 3)];
    if (mo !== undefined) return `${m[3]}-${String(mo + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  // YYYYMMDD
  m = sms.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return today();
}

// ── Is this a debit SMS? ──────────────────────────────────────
const DEBIT_SIGNALS  = /debited|deducted|spent|withdrawn|paid|sent|purchase|payment made/i;
const CREDIT_SIGNALS = /credited|received|deposited|added|refund/i;

function _isDebit(sms) {
  const hasDebit  = DEBIT_SIGNALS.test(sms);
  const hasCredit = CREDIT_SIGNALS.test(sms);
  // If both present (e.g. "refund credited after debit"), still treat as debit
  return hasDebit;
}

function _cleanMerchant(s) {
  return (s || '')
    .replace(NOISE, ' ')
    .replace(/[^A-Za-z0-9 &._@/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 35);
}

// ── Public: parse one or many SMS blocks ──────────────────────
export function parseSMS(text) {
  const results = [];
  // Split multiple SMS — separated by blank lines or obvious SMS boundary
  const blocks = text
    .split(/\n{2,}|\r\n\r\n/)
    .map(b => b.trim())
    .filter(Boolean);
  // If no blank lines, treat whole thing as one SMS
  const list = blocks.length ? blocks : [text.trim()];

  for (const block of list) {
    if (!_isDebit(block)) continue;

    const amt = _extractAmt(block);
    if (!amt || amt <= 0) continue;

    const raw      = _extractMerchant(block);
    const merchant = _cleanMerchant(raw) || 'Debit';
    const date     = _parseDate(block);

    // Detect bank name for the badge (best-effort, cosmetic only)
    const bankM = block.match(/\b(HDFC|SBI|ICICI|Axis|Kotak|Yes Bank|IndusInd|PNB|BOB|Canara|Union|IDFC|AU|Federal|Karnataka|UCO|IOB|Paytm|PhonePe|GPay|Razorpay)\b/i);
    const bank  = bankM ? bankM[1].toUpperCase() : 'Bank';

    results.push({ amt, merchant, date, bank, raw: block.slice(0, 100) });
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

  const key = `${date}|${amt}|${(note || '').toLowerCase().trim()}`;
  const seen = new Set(S.dailyExps.map(e => `${e.date}|${e.amt}|${(e.note || '').toLowerCase().trim()}`));
  if (seen.has(key)) {
    _pending.splice(i, 1);
    _smsMsg('Duplicate — already imported.', 'warn');
    renderSMS();
    return;
  }
  const id = 'de_' + (crypto.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  S.dailyExps.push({ id, date, catId, amt, note });
  sv();
  _rcFn();

  _pending.splice(i, 1);
  _smsMsg('Added to Daily Expenses.', 'ok');
  renderSMS();
}

export function smsImportAll() {
  let count = 0;
  const seen = new Set(S.dailyExps.map(e => `${e.date}|${e.amt}|${(e.note || '').toLowerCase().trim()}`));
  _pending.forEach((p, i) => {
    const amt  = parseFloat(document.getElementById(`sms-amt-${i}`)?.value) || p.amt;
    const date = document.getElementById(`sms-date-${i}`)?.value || p.date;
    const catId = document.getElementById(`sms-cat-${i}`)?.value || _guessCategory(p.merchant);
    const note = document.getElementById(`sms-note-${i}`)?.value?.trim() || p.merchant;
    if (amt > 0) {
      const key = `${date}|${amt}|${(note || '').toLowerCase().trim()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const id = 'de_' + (crypto.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2, 8));
      S.dailyExps.push({ id, date, catId, amt, note });
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

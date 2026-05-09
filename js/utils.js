// ══════════════════════════════════════
// UTILS — formatting, DOM helpers
// ══════════════════════════════════════

export function fmt(n) {
  const a = Math.abs(n || 0), s = n < 0 ? '-' : '';
  if (a >= 10000000) return s + '₹' + (a / 10000000).toFixed(1) + 'Cr';
  if (a >= 100000) return s + '₹' + (a / 100000).toFixed(1) + 'L';
  if (a >= 1000) return s + '₹' + (a / 1000).toFixed(1) + 'k';
  return s + '₹' + Math.round(a).toLocaleString('en-IN');
}

export function fmtFull(n) {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function gv(id) {
  return document.getElementById(id)?.value || '';
}

export function N(id) {
  return parseFloat(document.getElementById(id)?.value) || 0;
}

// Post-tax FV calculator — taxKind: 'equity'|'debt'|'hybrid', holdingYears: number, taxSlab: 0-30
export function postTaxFV(fv, invested, taxKind, holdingYears, taxSlab) {
  const gain = fv - invested;
  if (gain <= 0) return fv;
  if (taxKind === 'equity' || taxKind === 'hybrid') {
    if (holdingYears < 1) return fv - gain * 0.20;            // STCG 20%
    const ltcgExempt = 125000;
    const taxable = Math.max(0, gain - ltcgExempt);
    return fv - taxable * 0.125;                               // LTCG 12.5% above ₹1.25L
  }
  // debt fund: slab rate
  const slabRate = (taxSlab || 30) / 100;
  return fv - gain * slabRate;
}

// Newton-Raphson XIRR — cashflows: [{date: Date, amount: Number}]
// Outflows negative, inflows positive. Returns decimal rate (e.g. 0.12 = 12%).
export function xirr(cashflows, guess = 0.1) {
  if (!cashflows || cashflows.length < 2) return null;
  const t0 = cashflows[0].date;
  const days = cashflows.map(c => (c.date - t0) / 86400000);
  let r = guess;
  for (let i = 0; i < 100; i++) {
    let f = 0, df = 0;
    for (let k = 0; k < cashflows.length; k++) {
      const d = days[k] / 365;
      const pv = cashflows[k].amount * Math.pow(1 + r, -d);
      f  += pv;
      df -= cashflows[k].amount * d * Math.pow(1 + r, -d - 1);
    }
    if (df === 0) break;
    const nr = r - f / df;
    if (Math.abs(nr - r) < 1e-7) return nr;
    r = nr;
    if (!isFinite(r) || r < -0.9999) return null;
  }
  return r;
}

// Approximate XIRR from SIP aggregate data (Quick mode — no cashflow history).
// Assumes uniform monthly contributions starting `done` months ago.
export function sipXIRR(sip) {
  if (!sip.done || sip.done < 2 || !sip.curval) return null;
  const now = new Date();
  const flows = [];
  for (let m = sip.done; m >= 1; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    flows.push({ date: d, amount: -(sip.amt || 0) });
  }
  if (sip.invested && sip.invested > sip.amt * sip.done) {
    // lump-sum correction: add the difference at start
    flows[0].amount -= (sip.invested - sip.amt * sip.done);
  }
  flows.push({ date: now, amount: sip.curval });
  return xirr(flows);
}

import { describe, test, expect, vi } from 'vitest';
import { xirr, sipXIRR, postTaxFV } from '../js/utils.js';

// ── calendarDaysInPeriod (pure fn, tested inline to avoid DOM deps of reports.js) ──
function calendarDaysInPeriod(from, to) {
  const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T00:00:00');
  let total = 0, cur = new Date(f.getFullYear(), f.getMonth(), 1);
  while (cur <= t) {
    const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const start = cur.getFullYear() === f.getFullYear() && cur.getMonth() === f.getMonth() ? f.getDate() : 1;
    const end   = cur.getFullYear() === t.getFullYear() && cur.getMonth() === t.getMonth() ? t.getDate() : daysInMonth;
    total += (end - start + 1);
    cur.setMonth(cur.getMonth() + 1);
  }
  return total;
}

describe('xirr', () => {
  test('returns null for fewer than 2 cashflows', () => {
    expect(xirr([])).toBeNull();
    expect(xirr([{ date: new Date(), amount: -10000 }])).toBeNull();
  });

  test('24 monthly ₹10K SIPs with ₹2.6L current value returns positive XIRR', () => {
    const now = new Date(2026, 0, 1);
    const flows = [];
    // monthly outflows from 24 months ago to 1 month ago
    for (let m = 24; m >= 1; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      flows.push({ date: d, amount: -10000 });
    }
    flows.push({ date: now, amount: 260000 });
    const r = xirr(flows);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});

describe('sipXIRR', () => {
  test('returns null when done < 2', () => {
    expect(sipXIRR({ done: 1, curval: 10000, amt: 5000 })).toBeNull();
  });

  test('returns a finite rate for valid SIP', () => {
    const r = sipXIRR({ done: 24, curval: 260000, amt: 10000, invested: 240000 });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('postTaxFV', () => {
  test('equity LTCG: exempts first ₹1.25L gain', () => {
    // FV=200000, invested=100000 → gain=100000 < exemption → no tax
    const result = postTaxFV(200000, 100000, 'equity', 2, 30);
    expect(result).toBe(200000);
  });

  test('equity LTCG: taxes gain above ₹1.25L at 12.5%', () => {
    // FV=600000, invested=100000 → gain=500000, taxable=375000, tax=46875
    const result = postTaxFV(600000, 100000, 'equity', 2, 30);
    expect(Math.round(result)).toBe(600000 - Math.round(375000 * 0.125));
  });

  test('equity STCG: 20% flat on gain when holding < 1yr', () => {
    const result = postTaxFV(200000, 100000, 'equity', 0.5, 30);
    expect(result).toBe(200000 - 100000 * 0.20);
  });

  test('debt fund: slab rate on full gain', () => {
    const result = postTaxFV(200000, 100000, 'debt', 2, 30);
    expect(result).toBe(200000 - 100000 * 0.30);
  });

  test('no tax when no gain', () => {
    expect(postTaxFV(100000, 100000, 'equity', 2, 30)).toBe(100000);
    expect(postTaxFV(80000, 100000, 'equity', 2, 30)).toBe(80000);
  });
});

describe('calendarDaysInPeriod', () => {
  test('single full month (Jan 31d)', () => {
    expect(calendarDaysInPeriod('2025-01-01', '2025-01-31')).toBe(31);
  });

  test('single full month (Feb 28d non-leap)', () => {
    expect(calendarDaysInPeriod('2025-02-01', '2025-02-28')).toBe(28);
  });

  test('partial month (Jan 1–15 = 15 days)', () => {
    expect(calendarDaysInPeriod('2025-01-01', '2025-01-15')).toBe(15);
  });

  test('cross-month range (Jan 15 – Feb 14 = 17+14 = 31 days)', () => {
    // Jan: 15th to 31st = 17 days; Feb: 1st to 14th = 14 days
    expect(calendarDaysInPeriod('2025-01-15', '2025-02-14')).toBe(31);
  });

  test('same day = 1', () => {
    expect(calendarDaysInPeriod('2025-03-10', '2025-03-10')).toBe(1);
  });
});

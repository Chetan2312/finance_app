import { describe, test, expect } from 'vitest';
import { xirr, sipXIRR, postTaxFV } from '../js/utils.js';

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

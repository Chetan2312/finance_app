import { vi, describe, test, expect, beforeAll } from 'vitest';

vi.mock('../js/utils.js', () => ({ gv: vi.fn() }));
vi.mock('../js/storage.js', () => ({
  saveData: vi.fn(),
  loadData: vi.fn(async () => ({})),
}));
vi.mock('../data/defaults.js', () => ({
  DEF_SECS: [],
  DEF_DCATS: [],
}));

const { sipFV, calcPayoff, secTot, S } = await import('../js/state.js');

describe('sipFV', () => {
  test('returns finite number with normal ret', () => {
    expect(Number.isFinite(sipFV(100000, 5000, 120, 12))).toBe(true);
  });
  test('ret=0 returns simple sum, no NaN', () => {
    expect(sipFV(100000, 5000, 120, 0)).toBe(700000);
  });
  test('ret=12 with zero corpus returns finite', () => {
    expect(Number.isFinite(sipFV(0, 5000, 120, 12))).toBe(true);
  });
});

describe('calcPayoff', () => {
  test('empty debts returns zero months and converged=true', () => {
    const { months, converged } = calcPayoff([], 0);
    expect(months).toBe(0);
    expect(converged).toBe(true);
  });
  test('flags non-convergence on impossible debt (emi < interest)', () => {
    const { converged } = calcPayoff([{ balance: 1000000, rate: 24, emi: 100, repay: 'emi' }], 0);
    expect(converged).toBe(false);
  });
});

describe('secTot', () => {
  test('placeholder: section with no items returns 0', () => {
    const sec = { isEmi: false, items: [] };
    expect(secTot(sec)).toBe(0);
  });
});

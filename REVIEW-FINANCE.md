# Finance App — Expert Financial Review

> Finance-correctness only. No UI/UX. Personal finance webapp targeting Indian (INR) users.
> Single HTML + modular JS, ~3.1K LOC, dual-store (IndexedDB + Firestore), Claude AI advisor, SMS-based txn import.

## Scope reviewed

- [js/state.js](js/state.js) — core math (`sipFV`, `calcPayoff`, `secTot`, `getTotalExp`)
- [js/modules/invest.js](js/modules/invest.js) — investment plan engine, fund DB, allocation rules
- [js/modules/sips.js](js/modules/sips.js) — SIP projections
- [js/modules/debts.js](js/modules/debts.js) — debt tracking
- [js/modules/milestones.js](js/modules/milestones.js) — payoff milestones
- [js/modules/budget.js](js/modules/budget.js) — budget allocation, savings ring
- [js/modules/reports.js](js/modules/reports.js) — monthly summary math
- [js/modules/expenses.js](js/modules/expenses.js), [js/modules/daily.js](js/modules/daily.js) — expense entry/sums
- [js/modules/sms.js](js/modules/sms.js) — SMS-based debit import
- [js/modules/statements.js](js/modules/statements.js) — bank CSV import
- [js/modules/ai.js](js/modules/ai.js) — Claude advisor
- [js/modules/household.js](js/modules/household.js) — multi-user
- [js/storage.js](js/storage.js), [js/firebase.js](js/firebase.js), [firestore.rules](firestore.rules)
- [data/defaults.js](data/defaults.js)

---

## Findings — by severity

### 🔴 CRITICAL — financial-correctness bugs

#### C1. Payoff loop silently caps at 480 months without a non-convergence flag
[js/state.js:165-171](js/state.js#L165-L171)

```js
while (remaining.length && months < 480) {
  months++;
  remaining.forEach(d => { const i = d.bal * (d.rate / 100 / 12); totalInt += i; d.bal += i; });
  remaining.forEach(d => { if (d.emi > 0) d.bal -= Math.min(d.emi, d.bal); });
  if (remaining.length && extra > 0) { const t = remaining[0]; t.bal -= Math.min(extra, t.bal); }
  remaining = remaining.filter(d => { if (d.bal <= 1) { results.push({ ...d, month: months }); return false; } return true; });
}
return { results, months, totalInt };
```

For someone with high-rate IO + low EMI, loop terminates with debts still active and reports `months: 480` as if solved. Caller can't distinguish. Also `bal <= 1` rounding can leave residual ₹0.5.

#### C2. `sipFV` divides by zero when `ret = 0`
[js/state.js:175-178](js/state.js#L175-L178)

```js
const r = ret / 100 / 12;
return cv * Math.pow(1 + r, mo2) + mo * (Math.pow(1 + r, mo2) - 1) / r;
```

User enters 0% expected return → `r = 0` → NaN. UI shows ₹NaN. Need `r === 0 ? mo * mo2 + cv : ...` branch.

#### C3. Emergency-fund target inconsistent across screens
- [js/modules/invest.js:47](js/modules/invest.js#L47): `efTarget = inc * 3` (3 months **income**)
- [js/modules/milestones.js](js/modules/milestones.js): `ef = exp * 6` (6 months **expenses**)
- [js/modules/budget.js:45](js/modules/budget.js#L45): `et = exp * 6` (6 months **expenses**)

Three different targets. Industry standard = 3-6× **expenses** (not income). Income-based target is wrong: high earner with low expenses gets inflated target; low earner with high rent gets insufficient cushion.

#### C4. Savings rate uses projected surplus + clamps negative to 0
[js/modules/reports.js:177](js/modules/reports.js#L177)

```js
const savRate = totInc > 0 ? Math.max(0, surp / totInc * 100).toFixed(1) : '0.0';
```

`surp` = projected surplus from inputs, not money actually saved. `Math.max(0, …)` masks overspending — user never sees red flag.

#### C5. Future Value never inflation-adjusted
`sipFV` everywhere. India CPI ~5% → "₹1Cr in 20 years" displays as nominal but means ~₹37L real. No inflation toggle. Materially misleads long-horizon (retirement, FIRE).

#### C6. SIP gain-% not annualized — no XIRR
[js/modules/sips.js:49](js/modules/sips.js#L49), [js/modules/reports.js:166](js/modules/reports.js#L166):
```js
sip.invested > 0 ? g / sip.invested * 100 : 0
```
10% gain on a 1-month SIP and 10% on a 10-year SIP look identical. **No time-weighted return.** Single biggest missing finance metric.

---

### 🟠 HIGH — methodology / advisory quality

#### H1. Trailing returns without "past performance" disclaimer
[js/modules/invest.js:14-33](js/modules/invest.js#L14-L33). Mid Cap "28.4% 5Y" displayed next to "Min SIP" with no caveat. SEBI-required disclosure missing. Compliance + behavioral risk.

#### H2. ELSS recommendation hardcoded ₹12,500/mo regardless of tax regime
[js/modules/invest.js:58-60](js/modules/invest.js#L58-L60). New tax regime (default since FY 2023-24) has no 80C deduction. Bad advice for ~50% of filers. App never asks regime.

#### H3. "30% slab → ₹46,800 saved" assumes old regime + 30% slab
Same line. Lower slabs save less. Should be slab-conditional.

#### H4. Avalanche-vs-snowball not compared on user data
[js/state.js:163](js/state.js#L163). Strategy stored but never compared. No "Avalanche saves ₹X over Snowball over Y months" callout.

#### H5. Per-debt payoff timeline not exposed
`calcPayoff` returns aggregate `months` only. `results` array exists but unused in reports. Hard to set per-debt milestones.

#### H6. "Interest-only loan = guaranteed 12-18% return" fabricated
[js/modules/invest.js:55](js/modules/invest.js#L55). Real return = the loan's own `d.rate`. Hardcoded 12-18% range invented.

#### H7. Liquid fund "~7.2%" + savings "~3.5%" stale
[js/modules/invest.js:36](js/modules/invest.js#L36). 2024-2025 RBI repo cuts + Kotak/IDFC/AU 7%-savings. No "last updated" stamp.

#### H8. No tax-on-redemption modeling
LTCG equity 12.5% above ₹1.25L/yr (post-Jul 2024). STCG 20%. Debt funds at slab rate (post-Apr 2023). App shows gross only → over-estimates corpus 10-15%.

#### H9. No CAGR / XIRR for SIPs (see C6)

#### H10. Allocation thresholds in raw INR, not income-relative
[js/modules/invest.js:81-87](js/modules/invest.js#L81-L87). ₹5L IO debt, ₹20L total, ₹10K/₹50K surplus. ₹50K is huge for ₹80K-income user, small for ₹5L-income one. Should be ratios.

#### H11. No risk profiling
No questionnaire. 25-year-old and 55-year-old with same surplus get identical 60-65% equity.

#### H12. No retirement / SWR modeling
Trinity Study, "years to FI" milestone — absent. [js/modules/milestones.js](js/modules/milestones.js) covers debt + EF only.

---

### 🟡 MEDIUM — data integrity

#### M1. Firestore listener overwrites local state — no LWW
[js/state.js:39-48](js/state.js#L39-L48). `onSnapshot` blindly assigns `S.debts = d.debts`. Offline edit + race with remote = silent data loss.

Mitigation: compare `d.updatedAt`; or transactions; or field-level dirty flags.

#### M2. SMS import has no deduplication
[js/modules/sms.js:269-303](js/modules/sms.js#L269-L303). Same SMS pasted twice → two `dailyExps` rows.

#### M3. SMS import ID generation collision-prone
`id: 'de' + Date.now() + i`. Use `crypto.randomUUID()`.

#### M4. Float arithmetic on currency
JS Number throughout. `0.1 + 0.2 = 0.30000000000000004`. Consider integer paise (×100) internally.

#### M5. Bank CSV importer fragile
[js/modules/statements.js:18-54](js/modules/statements.js#L18-L54). Auto-detect of "debit"/"credit" by keyword: HDFC = "Withdrawal Amt", ICICI = "Debit", SBI = "Debit Amount". No sign-convention validation. Likely silent miscounting.

#### M6. Daily expense prorating divides monthly by 30
[js/modules/reports.js:16-17](js/modules/reports.js#L16-L17): `fixedMonthly / 30 * daysDiff`. Months 28-31 days → drift over a year.

---

### 🟠 SECURITY / PRIVACY

#### S1. AI module sends full financial picture to Anthropic
[js/modules/ai.js:57-73, 121-135](js/modules/ai.js#L57-L73). Income, savings, every debt+rate, every SIP+value in system prompt. Chat history persisted to Firestore [js/state.js:83](js/state.js#L83). Opt-in unclear.

#### S2. Firestore rules: household members read each other's full profiles
[firestore.rules](firestore.rules) — `match /profiles/{uid} { allow read: if isMember(hhId); }`. Spouses see all of each other's data. Maybe intentional but no field-masking + irrevocable on join.

#### S3. Pair codes globally R/W
```
match /pair_codes/{code} {
  allow read, create, update: if isAuth();
}
```
Race condition: attacker enumerates active codes, claims them first. Should bind to creator + single-use atomic claim.

#### S4. Anthropic API key in sessionStorage — XSS exposure
[js/modules/ai.js:11-28](js/modules/ai.js#L11-L28). Any injected script (SMS-paste, statement parser, chat) can exfiltrate. Better: proxy via Cloud Function.

---

### 🟢 LOW

- L1. [js/modules/budget.js:9](js/modules/budget.js#L9) `surp / inc * 100` — Infinity if `inc=0`; `Math.max(0, …)` doesn't clamp Infinity.
- L2. [js/modules/budget.js:67](js/modules/budget.js#L67) overspend zero-tolerance — ₹100 overshoot triggers warning. Add 5-10% buffer.
- L3. Default `strat: 'avalanche'` mathematically optimal; behavioral research (Gal & McShane 2012) shows snowball improves follow-through. Tooltip worth adding.
- L4. [data/defaults.js:11](data/defaults.js#L11) `RISK_LVL` 1-5 defined but never compared against user-stated risk tolerance (which doesn't exist; see H11).

---

## Recommended fix priorities

1. **C2** sipFV ÷0 — 1-line fix.
2. **C3** EF target unification — pick 6× expenses, use everywhere.
3. **C1** payoff loop convergence flag — return `converged: bool`.
4. **M2** SMS dedup — hash check before push.
5. **H2** tax regime question — fixes ELSS advice.
6. **H9** XIRR — single most-requested honest metric.
7. **C5** inflation toggle.
8. **H1** "past performance" disclaimer on fund cards.
9. **S2** Firestore field masking or explicit consent on household join.
10. **M1** updatedAt-based LWW on Firestore sync.

---

## Verification when fixes happen

- **Math unit tests:** `sipFV(100000, 5000, 120, 0)` ≠ NaN. `calcPayoff([{IO loan}], 0)` sets `converged: false`.
- **Three-persona scenarios:** low-income high-rent / high-income low-debt / mid-income IO loan — EF, allocation, ELSS advice internally consistent.
- **SMS dedup:** paste same 3-SMS block twice → 3 rows, not 6.
- **XIRR:** ₹10K/mo for 24mo, current ₹2.6L → XIRR ≈ 11.2%.
- **Tax regime:** new regime selected → ELSS step shows "no benefit in new regime".
- **Inflation toggle:** ₹1Cr nominal at 5% / 20y → real ₹37.7L.

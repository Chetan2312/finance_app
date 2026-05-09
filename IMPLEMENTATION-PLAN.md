# Finance App — Combined Implementation Plan

> Robust, phased implementation plan for both finance-correctness and design fixes identified in [REVIEW-FINANCE.md](REVIEW-FINANCE.md) and [REVIEW-DESIGN.md](REVIEW-DESIGN.md).
>
> Scope: every fix has file path, exact snippet (where small), effort, dependency, and verification step. Phases are ordered so that early work unblocks later work and ships independently usable increments.

---

## How to use this document

- **Phases** are checkpoints. Each ends with a working app that can ship.
- **Tickets** inside a phase are independent — pick any order within a phase.
- **Effort key:** `XS` ≤30 min, `S` ≤2 h, `M` ≤1 day, `L` 2-3 days.
- **Dep:** other ticket IDs that must land first.
- **Verify:** how to confirm done. Always check before merging.
- ID prefixes: `F` = finance, `D` = design, `X` = cross-cutting.

Branching: one branch per phase, e.g. `phase-0-foundations`. PR merges phase as a unit so a half-done phase never lives on `main`.

Test harness: app currently has none. Phase 0 ticket `X0.1` adds a tiny vitest setup so finance math has unit tests. After that, every finance ticket comes with a test.

---

## Phase 0 — Foundations (1-2 days)

Goal: nothing user-visible, everything that follows depends on this.

### X0.1  Add minimal test harness  ·  S
- Add `vitest` + `jsdom` as devDeps. Single config `vitest.config.js` at repo root.
- Create `tests/finance.spec.js` with three placeholder tests (sipFV, calcPayoff, secTot) that import directly from [js/state.js](js/state.js).
- Add `npm test` script in [package.json](package.json) (create if missing).
- Verify: `npm test` runs, passes 3 trivial assertions.

### X0.2  Create design-token spacing scale  ·  XS
- Edit [css/tokens.css](css/tokens.css), append after line 55:
```css
  /* Spacing scale (8pt) */
  --sp-1:.25rem; --sp-2:.5rem; --sp-3:.75rem;
  --sp-4:1rem;   --sp-5:1.5rem; --sp-6:2rem; --sp-7:3rem;

  /* Motion tiers */
  --tr-micro:.1s cubic-bezier(.4,0,.2,1);
  --tr-sm:.18s cubic-bezier(.4,0,.2,1);
  --tr-md:.28s cubic-bezier(.4,0,.2,1);
  --tr-lg:.45s cubic-bezier(.4,0,.2,1);
```
- Keep existing `--tr` for back-compat; mark deprecated in comment.
- Verify: token file parses, app still renders identically.

### X0.3  Lift root font-size 15px → 16px  ·  XS
- [css/base.css:5](css/base.css#L5) change `font-size:15px` → `16px`.
- Visual scan: amounts may overflow KPI cards — accept (will be addressed by D-tickets later) or temporarily wrap fmt outputs in `min(.95rem, …)`. Recommend: just ship; ugly is informative.
- Verify: smallest text (`xxs` 0.58rem) jumps from ~8.7px to 9.3px.

### X0.4  Add `:focus-visible` global  ·  XS
- Append to [css/base.css](css/base.css):
```css
:focus-visible{outline:2px solid var(--p);outline-offset:2px;border-radius:var(--rm)}
button:focus:not(:focus-visible){outline:none}
```
- Verify: keyboard-tab through every button shows ring; mouse-click never shows it.

### X0.5  `prefers-reduced-motion` respect  ·  XS
- Append to [css/base.css](css/base.css):
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
```
- Verify: macOS System Settings → Accessibility → Reduce Motion ON. Modal opens without slide; pulse on save badge stops.

### Phase 0 exit criteria
- [ ] `npm test` green
- [ ] Tokens compile, spacing + motion scales available
- [ ] Root size 16px, focus rings visible, reduced-motion honored
- [ ] No regression in current screens (manual scan: Overview, Daily, Debts)

---

## Phase 1 — Finance correctness (critical math) (2-3 days)

Goal: stop computing wrong numbers. User-visible only when wrong inputs hit the bugs (e.g. ret=0).

### F1.1  Fix `sipFV` divide-by-zero (C2)  ·  XS  ·  Dep: X0.1
- Edit [js/state.js:175-178](js/state.js#L175-L178):
```js
export function sipFV(cv, mo, mo2, ret) {
  const r = ret / 100 / 12;
  if (r === 0) return cv + mo * mo2;
  return cv * Math.pow(1 + r, mo2) + mo * (Math.pow(1 + r, mo2) - 1) / r;
}
```
- Add to `tests/finance.spec.js`:
```js
test('sipFV with ret=0 returns simple sum', () => {
  expect(sipFV(100000, 5000, 120, 0)).toBe(700000);
});
test('sipFV with ret=12 ≠ NaN', () => {
  expect(Number.isFinite(sipFV(0, 5000, 120, 12))).toBe(true);
});
```
- Verify: test green; in app, set SIP ret=0 → no `₹NaN`.

### F1.2  Add convergence flag to `calcPayoff` (C1)  ·  S  ·  Dep: X0.1
- Edit [js/state.js:158-173](js/state.js#L158-L173) `return { results, months, totalInt, converged: !remaining.length }`.
- Update `bal <= 1` filter to `bal <= 0.5` for cleaner paise rounding.
- Find callers via `grep -rn "calcPayoff" js/`. Update [js/modules/reports.js](js/modules/reports.js) and any UI that consumes `months` to show "≥40 years (not converged)" when `!converged`.
- Test:
```js
test('calcPayoff flags non-convergence on impossible debt', () => {
  const { converged } = calcPayoff([{balance:1000000, rate:24, emi:100, repay:'emi'}], 0);
  expect(converged).toBe(false);
});
```
- Verify: test green; UI shows warning instead of "40 years".

### F1.3  Unify emergency-fund target → 6× expenses everywhere (C3)  ·  S
- Edit [js/modules/invest.js:47-51](js/modules/invest.js#L47-L51):
  - Replace `const efTarget = Math.round(inc * 3)` with `const { total: exp } = getTotalExp(); const efTarget = Math.round(exp * 6);`
  - Update copy: `'Build a 6-month emergency fund first'`, `'Target: ₹X.XL (6× monthly expenses)'`.
- Confirm [js/modules/budget.js:45](js/modules/budget.js#L45) and [js/modules/milestones.js:73](js/modules/milestones.js#L73) already use `exp * 6` — they do.
- Verify: three-persona scenarios show identical EF target on Overview, Invest, Milestones, Budget.

### F1.4  Savings-rate truth + sign (C4)  ·  S
- Edit [js/modules/reports.js:177](js/modules/reports.js#L177):
```js
const savRate = totInc > 0 ? (surp / totInc * 100).toFixed(1) : '0.0';
```
- Remove `Math.max(0, …)`. Add UI: render in red when negative.
- Bigger fix (separate ticket if too much): introduce `actualSavingsRate` from delta of `S.sav` between report periods. Not blocking F1.4.
- Verify: enter expenses > income → savings rate shows negative %, in danger color.

### F1.5  SMS import deduplication (M2 + M3)  ·  M
- Edit [js/modules/sms.js:269-303](js/modules/sms.js#L269-L303). Before push:
```js
const key = `${date}|${amt}|${(note||'').toLowerCase().trim()}`;
const seen = new Set(S.dailyExps.map(e => `${e.date}|${e.amt}|${(e.note||'').toLowerCase().trim()}`));
if (seen.has(key)) continue;  // skip dup
```
- Replace `id: 'de' + Date.now() + i` with `id: 'de_' + (crypto.randomUUID?.() || Date.now()+'_'+Math.random().toString(36).slice(2,8))`.
- Test: import same 3-SMS block twice via DevTools → expect 3 rows total, not 6.

### F1.6  Inflation toggle for projections (C5)  ·  M
- Add to [js/state.js:9-15](js/state.js#L9-L15) state shape: `inflation: 5` (default 5%).
- In [js/modules/sips.js:54](js/modules/sips.js#L54) and [js/modules/reports.js](js/modules/reports.js) where `fv` is shown, add a toggle (single checkbox in header or per-card) that re-renders with real value:
  - `realFV = fv / Math.pow(1 + S.inflation/100, sip.plan/12)`.
- Persist toggle state in `S` and IndexedDB.
- Verify: ₹1Cr nominal at 5%/20y → real ₹37.7L when toggle ON.

### Phase 1 exit criteria
- [ ] All Phase 1 tests green
- [ ] No `NaN` reachable in any UI from valid input
- [ ] EF target identical across all 4 screens
- [ ] SMS dedup demo works
- [ ] Inflation toggle ships behind a single button in header

---

## Phase 2 — Finance methodology & advisor quality (3-5 days)

Goal: stop giving misleading advice. Most are content/copy fixes + one math add.

### F2.1  Tax regime question (H2 + H3)  ·  S
- Add input on Settings/Overview: radio "Old regime / New regime".
- Persist `S.taxRegime: 'old' | 'new'` (default 'new', current default since FY 2023-24).
- In [js/modules/invest.js:58-60](js/modules/invest.js#L58-L60) ELSS step: skip entirely when `S.taxRegime === 'new'`. Replace with new-regime step: "New regime selected — 80C deductions don't apply. Focus core SIP instead."
- For old regime, replace hardcoded ₹46,800 with slab-conditional copy. Add `S.taxSlab: 5|10|15|20|30` field.
- Verify: toggle regime → ELSS card disappears or rewords; slab change → savings amount changes proportionally.

### F2.2  XIRR for SIPs (H9 / C6)  ·  M  ·  Dep: X0.1
- Implement Newton-Raphson XIRR in [js/utils.js](js/utils.js):
```js
export function xirr(cashflows /* [{date:Date, amount:Number}] */, guess=0.1) {
  const days = cashflows.map(c => (c.date - cashflows[0].date) / 86400000);
  let r = guess;
  for (let i=0; i<50; i++) {
    let f=0, df=0;
    for (let k=0; k<cashflows.length; k++) {
      const d = days[k] / 365;
      f  += cashflows[k].amount * Math.pow(1+r, -d);
      df -= cashflows[k].amount * d * Math.pow(1+r, -d-1);
    }
    const newR = r - f/df;
    if (Math.abs(newR - r) < 1e-7) return newR;
    r = newR;
  }
  return r;
}
```
- Each SIP needs cashflow history. Currently SIP shape stores `invested, curval` aggregates — not enough. Two options:
  - **Quick:** approximate XIRR from `(amt * plan, curval, donemonths)` assuming uniform monthly contribution. Lossy.
  - **Right:** add `S.sips[i].cashflows: [{date, amount}]` array. Backfill from `done` count. Append on each contribution event. Bigger lift.
- Recommend: ship Quick now, queue Right as F2.2b.
- Add to [js/modules/sips.js:54](js/modules/sips.js#L54) gain%-row: replace `gp` with `xirr` annualized %.
- Test: 24 monthly contributions of ₹10K with current value ₹2.6L → XIRR ≈ 0.112.

### F2.3  Past-performance disclaimer on fund cards (H1)  ·  XS
- Add line at [js/modules/invest.js:139](js/modules/invest.js#L139) under reason: `<div class="xxs c-muted">Past performance does not indicate future returns.</div>`.
- Update copy comment line 11-12 to reference SEBI advertising guidelines.
- Verify: every fund card shows disclaimer.

### F2.4  Fix "12-18% guaranteed return" claim (H6)  ·  XS
- Edit [js/modules/invest.js:55](js/modules/invest.js#L55). Replace hardcoded `12–18%` with computed:
```js
const ioMaxRate = Math.max(...S.debts.filter(d=>d.repay!=='emi').map(d=>d.rate), 0);
// in template: `Closing them is a guaranteed ${ioMaxRate}% risk-free return.`
```
- Verify: change a debt's rate → step copy reflects it.

### F2.5  Per-debt timeline exposure (H5)  ·  S
- `calcPayoff` already populates `results: [{...debt, month}]`. In [js/modules/reports.js](js/modules/reports.js) or [js/modules/debts.js](js/modules/debts.js), render per-debt expected payoff date next to each card.
- Verify: each debt card shows "Cleared by Aug 2027".

### F2.6  Tax-on-redemption modeling (H8)  ·  M
- Add fund category `taxKind: 'equity' | 'debt' | 'hybrid'` to [data/defaults.js](data/defaults.js) catalog.
- Add post-tax `fv` calculator in [js/utils.js](js/utils.js):
```js
export function postTaxFV(fv, invested, taxKind, holdingYears){
  const gain = fv - invested;
  if (gain <= 0) return fv;
  if (taxKind === 'equity'){
    if (holdingYears < 1) return fv - gain * 0.20;
    const ltcgExempt = 125000;
    const taxable = Math.max(0, gain - ltcgExempt);
    return fv - taxable * 0.125;
  }
  // debt: slab rate (use user's slab)
  return fv - gain * (S.taxSlab/100);
}
```
- Show both "Projected (gross)" and "Post-tax" on SIP cards.
- Verify: 20-yr equity SIP with ₹50L gain → post-tax shows ~₹6.1L tax bite.

### F2.7  Inflation-adjusted retirement / SWR module (H12)  ·  L
- New module [js/modules/retirement.js](js/modules/retirement.js).
- Inputs: current age, retire-by age, monthly expense today, expected inflation, expected pre-retire return, expected post-retire return.
- Outputs: corpus needed (Trinity Study 4% rule + bond tent variant), years to FI, monthly SIP gap.
- Surface as new tab or insert into Milestones.
- Verify: inputs (30y/55y/₹50K mo, 5% inflation, 12% pre, 7% post) ≈ corpus ₹4.5-5Cr, monthly gap ~₹35K.

### F2.8  Allocation thresholds → ratios (H10)  ·  S
- Edit [js/modules/invest.js:81-87](js/modules/invest.js#L81-L87). Replace raw INR with ratios:
```js
function buildAlloc(surplus, totalDebt, ioDebt, inc) {
  const debtToInc = inc>0 ? totalDebt/(inc*12) : 0;     // years of income
  const savingsRate = inc>0 ? surplus/inc : 0;
  const ioBurden = inc>0 ? ioDebt/inc : 0;
  if (ioBurden > 6)   return { 'Debt Closure':50, ... };  // IO > 6 mo income
  if (debtToInc > 2)  return { 'Equity':40, 'Debt Paydown':35, ... };  // 2y income debt
  if (savingsRate < 0.10) return { 'Emergency':40, ... };
  if (savingsRate > 0.30) return { 'Equity':65, ... };
  return { 'Equity':60, ... };
}
```
- Verify: ₹80K-income user with ₹50K surplus and ₹5L-income user with ₹50K surplus get different recommendations.

### F2.9  Risk profiling questionnaire (H11)  ·  M
- Add 5-question form at first launch + accessible from Settings:
  - Age band, dependents, job type (salaried/self/biz), market-drop comfort (1-5), horizon (years).
- Compute risk score 1-5, store `S.riskProfile`.
- Modify allocation in F2.8 to weight equity by `riskProfile / 5`.
- Verify: 55-y/o conservative (score 1) gets max 30% equity; 25-y/o aggressive (score 5) gets up to 80%.

### Phase 2 exit criteria
- [ ] Tax regime fully integrated; ELSS advice correct in both
- [ ] XIRR shown on SIPs (Quick form acceptable)
- [ ] All fund cards carry disclaimer
- [ ] Allocation reflects user-relative ratios + risk profile
- [ ] Retirement module ships at minimum as draft tab

---

## Phase 3 — Data integrity & sync (2-3 days)

Goal: stop losing money data on sync races.

### F3.1  Last-write-wins via `updatedAt` (M1)  ·  M
- Edit [js/state.js:39-48](js/state.js#L39-L48) snapshot listener. Before assigning, compare `d.updatedAt` (already written by `sv()` line 90) vs. `S._lastLocalSave`. Skip overwrite if remote is older.
- Add `S._lastLocalSave = Date.now()` in `sv()` after Firestore writes.
- Edge case: user offline + edit → reconnect: needs explicit conflict UI ("you edited X, partner edited Y — pick one"). Out of scope for this ticket; track as F3.1b.
- Verify: simulated stale-snapshot (open two tabs, edit different debts) → no overwrite.

### F3.2  Bank CSV importer hardening (M5)  ·  M
- Edit [js/modules/statements.js:18-54](js/modules/statements.js#L18-L54). Add explicit bank presets:
  - HDFC: cols "Withdrawal Amt.", "Deposit Amt.", "Date", "Narration"
  - ICICI: "Date", "Withdrawals", "Deposits", "Description"
  - SBI: "Txn Date", "Debit", "Credit", "Description"
- UI: dropdown "Detect bank format" + manual override.
- Sign-convention validation: if `deb` and `cr` both present non-zero → flag row.
- Verify: ship sample CSVs (anonymized) for each bank in `tests/fixtures/`; round-trip totals match expected.

### F3.3  Float → integer paise (M4)  ·  L  ·  optional
- Big lift, low daily-impact. Defer unless precision issue surfaces.
- Track on roadmap; not a Phase 3 blocker.

### F3.4  Calendar-aware proration (M6)  ·  S
- Edit [js/modules/reports.js:16-17](js/modules/reports.js#L16-L17):
```js
const daysInRange = Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1;
const fixedProrated = type === 'daily' ? 0
  : (fixedMonthly * daysInRange / daysInPeriod(from, to));  // exact calendar
```
- Helper `daysInPeriod(from, to)` = sum days-in-month for spanned months.
- Verify: Feb 1-28 (28d) and Jan 1-31 (31d) prorate differently from raw `/30`.

### Phase 3 exit criteria
- [ ] No data loss on simulated sync race
- [ ] Three bank CSV samples round-trip cleanly
- [ ] Proration uses real calendar

---

## Phase 4 — Security & privacy (2-3 days)

### S4.1  Cloud-Function proxy for Anthropic API (S4)  ·  L
- New Firebase Function `callClaude(systemPrompt, messages)`. Accepts auth, owns the API key (env var), forwards to Anthropic, streams response back.
- [js/modules/ai.js:11-28](js/modules/ai.js#L11-L28) — drop sessionStorage path; always call function URL.
- Cost guardrail in function: 50 calls/user/day rate-limit.
- Verify: clear sessionStorage → AI still works through proxy.

### S4.2  Field-level read masking on household profiles (S2)  ·  M
- Decision required from user: which fields are partner-visible by default? Recommend tier system.
- Default: aggregates visible (income total, total debt, savings rate). Drilldowns (per-debt rate, per-SIP value) opt-in.
- Implement via two Firestore subcollections: `profiles/{uid}/public/` (always readable) + `profiles/{uid}/private/` (own-only).
- Update [firestore.rules](firestore.rules) accordingly.
- Verify: partner views show aggregates only by default; toggle "share details" exposes drilldowns.

### S4.3  Pair-code single-use atomic claim (S3)  ·  M
- Update Firestore rules:
```
match /pair_codes/{code} {
  allow read: if isAuth();
  allow create: if isAuth() && request.resource.data.createdBy == request.auth.uid;
  allow update: if isAuth() &&
    resource.data.usedBy == null &&
    request.resource.data.usedBy == request.auth.uid;
}
```
- Pair-code generation: bind to creator UID. On claim, transactionally set `usedBy` once.
- Verify: two clients try to claim same code simultaneously → exactly one succeeds.

### S4.4  AI-context opt-in (S1)  ·  S
- Default `S.aiShareConsent = false`.
- On first AI tab open, show consent modal listing exactly what gets sent (income, debt list, SIP list).
- If declined, [js/modules/ai.js:76-117](js/modules/ai.js#L76-L117) `localAnalysis` mode only.
- Verify: first-run with decline → no Anthropic call ever fires (DevTools network).

### Phase 4 exit criteria
- [ ] No API key in browser
- [ ] Household privacy tier shipped
- [ ] Pair-code race-free
- [ ] AI share is opt-in

---

## Phase 5 — Design foundations (3-4 days)

Goal: visual fundamentals so later component-level work has a stable platform.

### D5.1  Refloor type scale (D5)  ·  S  ·  Dep: X0.3
- Edit [css/base.css:35](css/base.css#L35):
```css
.xs{font-size:.78rem}      /* was .65rem */
.xxs{font-size:.7rem}      /* was .58rem */
```
- Hunt sub-`.xxs` callsites: SIP stat label `.sip-stl` 0.52rem in [css/components.css](css/components.css) — bump to 0.7rem. Badge text 0.57rem → 0.7rem.
- Visual scan all screens; bump KPI value `.kv` if it now overflows (likely fine since root went 15→16).
- Verify: smallest UI text ≥11px on every screen.

### D5.2  Spacing scale rollout (D10)  ·  M  ·  Dep: X0.2
- Find magic numbers in [css/base.css](css/base.css), [css/components.css](css/components.css), inline styles in HTML.
- Replace with `var(--sp-N)` tokens. Examples:
  - `.g2 gap:.9rem` → `gap:var(--sp-3)` (closest)
  - `.mb1 margin-bottom:.9rem` → `var(--sp-3)`
  - `.empty padding:2rem` → `var(--sp-6)`
- Inline `style="margin-top:.2rem"` etc. → utility class `.mt-1` (0.25rem) etc.
- Verify: visual diff <2px on every screen; no spacing drift.

### D5.3  Touch target floor 40px (D8)  ·  S
- Append [css/components.css](css/components.css):
```css
button,a.btn,.ntab,.ico-btn,.bic{min-height:40px;display:inline-flex;align-items:center;justify-content:center}
.bsm{min-height:36px}  /* secondary controls allowed slightly smaller */
.bxs{min-height:32px;padding-inline:.5rem}  /* keep micro-control but raise */
```
- Verify: DevTools layout overlay shows ≥40px hit-box on every primary control.

### D5.4  Tablet + small-phone breakpoints (D11)  ·  S
- Edit [css/responsive.css](css/responsive.css):
```css
@media(max-width:1024px){
  .g4{grid-template-columns:repeat(2,1fr)}
  .wrap{padding-inline:var(--sp-4)}
}
@media(max-width:720px){ /* existing */ }
@media(max-width:480px){
  .g2,.g3,.g4{grid-template-columns:1fr}
  .nav{padding-inline:var(--sp-3)}
}
```
- Verify: iPad portrait + landscape, 1280-desktop, 360-phone all reflow cleanly.

### D5.5  Light-mode bg detint (D4)  ·  XS
- Edit [css/tokens.css:58-63](css/tokens.css#L58-L63):
```css
[data-theme=light]{
  --bg:#f7f8fa;     /* near-neutral */
  --bg2:#eef0f4;
  --s0:#ffffff;
  --s1:#f3f4f7;
  --s2:#eaecf0;
  --s3:#dde0e5;
  /* borders, text unchanged */
}
```
- Verify: light mode no longer reads "lavender". Indigo `--p` still pops on neutrals.

### D5.6  Palette restraint (D3)  ·  M
- Demote rose/lime/sky/coral usage from chrome surfaces to chart/data-viz only.
- Audit `c-rose, c-sky, c-teal, c-warn` usage in inline styles and component CSS. Replace chrome instances with `var(--p)` or `var(--t2)` (muted).
- New chart palette CSS var `--chart-1..6` mapping to existing 6 hues; surfaces in chart configs only.
- Verify: chrome (nav, cards, badges) uses ≤3 hues. Charts retain spectrum.

### D5.7  Print styles use tokens (D15)  ·  XS
- Edit [css/responsive.css:4-6](css/responsive.css#L4-L6):
```css
@media print{
  body{background:#fff;color:#000}
  .card{border:1px solid #ddd;break-inside:avoid}
  .nav,.bp,.bg{display:none}
  *{font-variant-numeric:tabular-nums}
}
```
- Use real tokens once we're sure print honors CSS vars (it does in modern browsers).
- Verify: PDF export shows tokens; no hardcoded value remains.

### Phase 5 exit criteria
- [ ] No text below 11px
- [ ] All controls ≥40px tap zone
- [ ] 3 breakpoints active
- [ ] Light mode neutralized
- [ ] Palette: ≤3 chrome hues, charts unchanged

---

## Phase 6 — Design: trust-signal layer (3-5 days)

Goal: shift perception from "indie" to "bank-grade household".

### D6.1  SVG icon set replaces emoji chrome (D1)  ·  L
- Pick set: **Lucide** (MIT, 1k+ icons, two stroke weights). Add `lucide` package or copy 30 SVGs to `assets/icons/`.
- Map: 📊→`bar-chart-3`, 💸→`wallet`, 💳→`credit-card`, 🏠→`home`, 🚗→`car`, 📈→`trending-up`, ⚡→`zap`, ⚖️→`scale`, 🏧→`landmark`, 🎯→`target`, 💎→`gem`, 🏛️→`building-2`, 🌏→`globe`, 🚀→`rocket`, 🏦→`landmark`. Empty states get muted line-icons.
- Render via `<svg><use href="#ico-name"/></svg>` sprite OR inline.
- Sweep [index.html](index.html), [finance-freedom-v6.html](finance-freedom-v6.html), [js/modules/invest.js](js/modules/invest.js), [js/modules/sms.js](js/modules/sms.js) `_guessCategory`, [data/defaults.js](data/defaults.js) defaults — replace emoji in dropdown options, fund cards, nav tabs, empty states.
- **Keep** emoji ONLY for user-set custom-section icons (DEF_DCATS) — they're personality, not chrome.
- Verify: zero emoji in nav/dropdowns/empty states across iPhone, Android, Windows screenshots.

### D6.2  Per-record attribution `editedBy/editedAt` (D2)  ·  M  ·  Dep: F3.1
- Extend record shapes (debts, sips, expenses): on save, stamp `{updatedBy: S.userId, updatedAt: Date.now()}`.
- Render inline on each card: `<span class="xxs c-muted">Updated by Priya · 2m ago</span>`. Resolve `Priya` via `S.members` lookup.
- Verify: household demo (two browsers, same household) → partner edits debt → other sees attribution within 5s of sync.

### D6.3  Sync-state pill in header (D2)  ·  S
- Replace simple save badge with three-state pill: `synced / saving / offline / conflict`.
- Hook into [js/state.js](js/state.js) sv() + Firestore connection state.
- Verify: airplane mode → "offline"; reconnect → "syncing" → "synced".

### D6.4  Compliance footer (D2)  ·  XS
- Add to [index.html](index.html) shell footer:
```html
<footer class="xxs c-muted" style="text-align:center;padding:var(--sp-5)">
  Local-first · Encrypted in transit · Open source
  <a href="LICENSE">License</a> · v{VERSION}
</footer>
```
- Verify: appears on every page.

### D6.5  Skeleton states (D16)  ·  S
- Append [css/components.css](css/components.css):
```css
.skel{background:linear-gradient(90deg,var(--s1) 0%,var(--s2) 50%,var(--s1) 100%);background-size:200% 100%;animation:skel 1.4s ease-in-out infinite;border-radius:var(--rs)}
@keyframes skel{0%{background-position:200% 0}100%{background-position:-200% 0}}
```
- Replace empty-states with skeletons during initial Firestore load. Gate on `S._syncReady`.
- Verify: cold load on Firestore-backed account → skeletons, not "no data" flash.

### D6.6  Inline-style sweep (D12)  ·  M
- Grep `style="` in HTML files. ~100 instances. Categorize:
  - Decorative dot color → utility class `.dot-amber`, `.dot-teal`, etc.
  - Font-size override → utility `.fs-sm`, `.fs-md`, `.fs-lg`.
  - Margin/padding → spacing utilities from D5.2.
- Goal: <10 inline styles total. Track regressions visually.
- Verify: `grep -c 'style="' index.html` ≤10.

### D6.7  Wordmark consolidation + monogram (D22)  ·  S
- Pick **NidhiPath** (current direction in v7).
- Design SVG monogram: simple "N" inside rounded square with indigo gradient — store at `assets/logo.svg`.
- Replace text wordmarks across both HTMLs.
- Verify: every "FinanceFreedom" reference gone; logo visible on login + header.

### Phase 6 exit criteria
- [ ] Zero chrome emoji
- [ ] Attribution shows on shared records
- [ ] Sync pill replaces save badge
- [ ] Skeletons replace flash-empty
- [ ] <10 inline styles
- [ ] Single brand wordmark

---

## Phase 7 — Information architecture & polish (3-5 days)

### D7.1  IA reduction 13 → 6 tabs (D6)  ·  L
- New nav: **Money, Spending, Debt, Grow, Reports, Household**.
- Each top-tab lands on overview-of-section; sub-nav within page handles old tabs.
- Big change. Take time. Branch separately. Stage feature flag if possible.
- Verify: every previous feature reachable in ≤2 taps from home.

### D7.2  Typography swap (D13)  ·  S
- Edit [css/tokens.css:45-47](css/tokens.css#L45-L47):
  - `--fd: 'Inter Display', 'Inter', sans-serif`
  - `--fb: 'Inter', sans-serif`
  - `--fm: 'JetBrains Mono', monospace` (kept)
- Update font preload in `<head>` of both HTMLs.
- Add `font-variant-numeric: tabular-nums` to `.mono`, `.kv`, `.sip-stv`, all amount classes.
- Verify: amounts column-align everywhere; display feels neutral, not boutique.

### D7.3  Motion tier rollout (D14)  ·  S  ·  Dep: X0.2
- Sweep `--tr` callsites. Reassign:
  - Hover, focus → `--tr-micro`
  - Toggles, dropdowns → `--tr-sm`
  - Modals, sheets → `--tr-md`
  - Page transitions → `--tr-lg`
- Verify: button hover snappy; modal opens unhurried; nothing feels "off".

### D7.4  Scrollbar + selection token wiring (D17, D18)  ·  XS
- [css/base.css:7-10](css/base.css#L7-L10):
```css
::selection{background:color-mix(in oklch,var(--p) 35%,transparent);color:var(--t1)}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--b2);border-radius:6px;border:2px solid var(--bg)}
```
- Verify: scrollbar grabbable with mouse; selection color follows brand.

### D7.5  Save-pulse smarter (D19)  ·  XS
- Toggle pulse animation off when state is `synced`. Only animate during `saving`.
- [css/components.css:10-14](css/components.css#L10-L14) — add class state.

### D7.6  System theme preference (D21)  ·  S
- On first launch, if no `S.theme` set, honor `prefers-color-scheme: light`.
- [js/app.js](js/app.js) startup hook.
- Verify: fresh install on macOS Light → app loads light.

### Phase 7 exit criteria
- [ ] 6 nav tabs
- [ ] Inter shipped, tabular nums everywhere
- [ ] Motion tiers consistent
- [ ] System theme honored

---

## Cross-cutting / nice-to-haves (queue, no phase)

| ID | Item | From |
|---|---|---|
| X.a | Vault green secondary accent token | D3 fix |
| X.b | APCA contrast audit script (`bun run audit-contrast`) | D9 |
| X.c | F3.1b — explicit conflict-resolution UI | F3.1 |
| X.d | F3.3 — integer-paise migration | M4 |
| X.e | Snowball-vs-avalanche compare badge | H4 |
| X.f | "Last updated" stamp on stale-rate disclaimers | H7 |
| X.g | Fund return data refresh mechanism (manual or scheduled) | H7 |
| X.h | F2.2b — full XIRR with cashflow history | F2.2 |
| X.i | Behavioral nudge: snowball tooltip | L3 |
| X.j | Risk-tolerance + RISK_LVL coupling | L4 |

---

## Verification matrix (regression checklist for every PR)

| Area | Check |
|---|---|
| **Math** | `npm test` green; no `NaN` reachable in any UI from typed input |
| **Sync** | Edit on tab A reflects on tab B within 5s; airplane-mode pill flips correctly |
| **A11y** | Tab through entire app, focus ring visible on every control; reduce-motion off all motion |
| **Touch** | Every control ≥40px hit-box (DevTools) |
| **Contrast** | Body text APCA Lc ≥75 light + dark; secondary ≥60 |
| **Responsive** | 360 / 480 / 720 / 1024 / 1280 — no horizontal scroll on core flows |
| **Theme** | Light + dark identical info; first-launch honors system pref |
| **Print** | Reports → PDF readable, tabular nums aligned |

---

## Recommended schedule

- Week 1: Phase 0 + Phase 1 (foundations + finance-critical math)
- Week 2: Phase 2 (advisor quality)
- Week 3: Phase 3 + Phase 5 (data integrity + design foundations)
- Week 4: Phase 4 + Phase 6 (security + trust signals)
- Week 5: Phase 7 (IA + polish)
- Buffer: a week for testing, content (copy, disclaimers), cross-device QA

Total: ~5-6 weeks single-dev part-time, 2-3 weeks full-time.

---

## Open decisions (need user call before starting)

1. **Phase 4 scope:** are you okay running a Cloud Function for AI proxy? (cost + ops). If not, S4.1 deferred and S4.4 opt-in becomes the only mitigation for S4.
2. **Household privacy default (S4.2):** aggregates-public-drilldowns-private — confirm this default vs. fully-public (current) vs. fully-private.
3. **D7.1 IA:** 13→6 is opinionated. Confirm category names (`Money / Spending / Debt / Grow / Reports / Household`) or propose alternative.
4. **D7.2 typography:** Inter is default suggestion. Open to GT America / Söhne / Aktiv Grotesk if budget allows licensed fonts.
5. **F2.7 retirement:** confirm tab placement (own tab vs. inside Milestones).
6. **F2.2 XIRR:** Quick (lossy aggregate-based) acceptable for MVP, or block on Right (cashflow history)?

Answer these before Phase 2 starts; everything before is unblocked.

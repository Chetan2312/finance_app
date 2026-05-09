# Finance App — Web Design Audit

> Visual / brand audit. Target: **trustworthy bank-grade**. Audience: **family / household**.
> Stack: vanilla CSS tokens + HTML, modular [css/](css/).

**Verdict:** strong fundamentals (token system, semantic colors, India-native formatting) but **leans indie hobby**.
The three biggest gaps vs. "bank-grade": emoji-as-iconography, dense compactness, missing trust signals.

---

## Files reviewed

- [css/tokens.css](css/tokens.css) — 72 lines, all design tokens
- [css/base.css](css/base.css) — 38 lines, utilities
- [css/components.css](css/components.css) — 384 lines, all components
- [css/responsive.css](css/responsive.css) — 15 lines, single breakpoint
- [index.html](index.html) — 515 lines, current shell
- [finance-freedom-v6.html](finance-freedom-v6.html) — 1428 lines, legacy monolith

---

## Findings — by severity

### 🔴 CRITICAL — undermines "trustworthy bank-grade" perception

#### D1. Emoji-as-iconography breaks bank-grade trust
Tab nav, debt categories, fund cards, empty states ([index.html:195-207](index.html#L195-L207), [css/base.css:37](css/base.css#L37)).

```html
<button class="ntab on">📊 Overview</button>
<option value="home">🏠 Home Loan</option>
<span class="empty-ic">💳</span>No debts yet.
```

Emoji rendering varies wildly across OS — couple opening on iPhone vs. Android sees different "brand". Bank apps universally use proprietary SVG icons.

**Fix:** ship 30-icon SVG set (Lucide / Tabler / Phosphor). Tabs, categories, fund types, debt types, empty states convert. Keep emoji only for user-set custom-section icons.

#### D2. Trust-signal density is near zero
Inventory:
- Header wordmark, no version, no security indicator
- Login: single "Data stays on device" line ([index.html:167](index.html#L167))
- No: encryption-at-rest indicator, last-sync timestamp, audit log, "spouse last edited X" attribution
- Save badge ([css/components.css:10-14](css/components.css#L10-L14)) is the only persistent system feedback

For households, attribution is critical: "Updated by Priya · 2m ago". Currently absent.

**Fix:** (a) sync state pill in header, (b) per-record `editedBy` + `editedAt` on debt/SIP/expense cards, (c) lock indicator for read-only partner views, (d) compliance footer.

#### D3. Color palette over-saturated for a finance product
[css/tokens.css:21-37](css/tokens.css#L21-L37) ships 7 named accent hues + indigo + 4 semantic.

OKLCH conversion:
| Token | Hex | OKLCH |
|---|---|---|
| `--p` | `#7c73e6` | `oklch(63% 0.16 280)` |
| `--p2` | `#a598ff` | `oklch(74% 0.13 285)` |
| `--rose` | `#fb7185` | `oklch(70% 0.20 16)` |
| `--teal` | `#2dd4bf` | `oklch(78% 0.13 178)` |
| `--amber` | `#f59e0b` | `oklch(75% 0.16 70)` |
| `--lime` | `#86efac` | `oklch(86% 0.18 148)` |
| `--sky` | `#38bdf8` | `oklch(74% 0.14 232)` |
| `--coral` | `#fb923c` | `oklch(74% 0.17 50)` |

Six chromatic accents fight for chrome attention. Bank apps stay 2-3 hues.

**Fix:** keep `--p` indigo as anchor. Add ONE warm accent — suggest "vault green" `oklch(48% 0.10 200)`. Demote rose/lime/sky/coral to chart-only palette. Semantic ok/warn/danger stay.

#### D4. Light-mode palette has trust problems
[css/tokens.css:60-71](css/tokens.css#L60-L71):
```css
--bg: #f0f1ff;   /* tinted lavender */
--bg2: #e8e9ff;
--s0: #ffffff;
```

Lavender bg reads "novelty fintech" not "bank". Wealthsimple / Monarch / Mercury / Lunchmoney use neutral cool-grays.

**Fix:** light `--bg` → `oklch(98% 0.003 250)` (true near-white). `--bg2` → `oklch(96% 0.005 250)`. Reserve indigo tint for primary actions only.

#### D5. Compactness past comfortable for shared use
Type sizes ([css/base.css:35](css/base.css#L35)):
- `.xs` = 0.65rem (~9.75px at 15px root)
- `.xxs` = 0.58rem (~8.7px)
- Badge text = 0.57rem ([css/components.css:83-91](css/components.css#L83-L91))
- SIP stat label = 0.52rem (~7.8px)

40-something couple at arm's length on phone *cannot read 7.8px*. Bank apps respect 11-12px floor.

**Fix:** root `15px` → `16px` ([css/base.css:5](css/base.css#L5)). Re-floor: `.xxs` → 0.7rem, `.xs` → 0.78rem. Badges → 0.7rem.

---

### 🟠 HIGH — visual hierarchy & accessibility

#### D6. 13 top-level tabs is a wayfinding failure
[index.html:194-208](index.html#L194-L208): Overview, Expenses, Debts, SIPs, Invest, Daily, Milestones, Budget, Reports, Statements, SMS, Household, AI.

Suggested IA reduction (13 → 6):
- **Money** (overview + budget)
- **Spending** (daily + expenses + statements + SMS-import as sub-actions)
- **Debt** (debts + milestones)
- **Grow** (SIPs + invest)
- **Reports**
- **Household** (household + AI as drawer)

#### D7. Focus rings missing on all buttons
[css/components.css:71-79](css/components.css#L71-L79). `.btn`, `.bp`, `.bg`, `.bd`, `.bok`, `.bwarn` have hover only — no `:focus-visible`. Inputs do ([css/components.css:65](css/components.css#L65)).

**Fix:**
```css
:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; border-radius: var(--rm); }
```

#### D8. Touch targets below WCAG 2.5.5 / Apple HIG
- `.bsm` ~24px ([css/components.css:71-79](css/components.css#L71-L79))
- `.bxs` ~18px
- `.ntab` ~32px ([css/components.css:23-27](css/components.css#L23-L27))
- `.ico-btn`, `.bic` 28-32px ([css/components.css:17-18](css/components.css#L17-L18))

WCAG 2.2 AAA + Apple HIG = 44×44. Couples tap-misfire on iPad / phone.

**Fix:** elevate all interactives to 40px min-height. Visual size can stay small (padding inside generous click zone).

#### D9. Contrast unverified on key combos
- Badges: `.bdg-p` puts `--p2` on translucent `--info-s`. Borderline ~3.5:1 dark, fails 4.5:1 light.
- Date input placeholder `var(--b3)` (`#3d3d70` dark) on `--bg2` — invisible in dark mode.

**Fix:** run pairs through APCA. Targets: 75 Lc body, 60 Lc secondary, 45 Lc incidental.

#### D10. Spacing scale absent
[css/base.css:21-30](css/base.css#L21-L30). Gaps + margins live as `.4`, `.6`, `.7`, `.8`, `.9`, `1.5`, `1.2`, `3rem` — eight magic values.

Root cause of *visual unevenness*: similar cards have ±2px padding differences.

**Fix:** introduce 8pt scale tokens
```css
--sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem;
--sp-4: 1rem;    --sp-5: 1.5rem; --sp-6: 2rem; --sp-7: 3rem;
```

#### D11. Single 720px breakpoint
[css/responsive.css:10](css/responsive.css#L10). At 1023px (iPad landscape) 4-column KPI grid cramped; at 480px nav scrolls awkwardly. **Tablet = primary household device.**

**Fix:** add 480px (small phone) + 1024px (tablet/laptop transition).

---

### 🟡 MEDIUM — polish

#### D12. Inline-style sprawl
~100 inline `style=` attributes per HTML file. Examples: [index.html:215](index.html#L215) overrides `.kv` with inline font-size; decorative dots set via inline `background:var(--amber)`.

**Fix:** sweep into utility classes. Goal: <10 inline styles total.

#### D13. Typography stack design-forward, not finance-coded
[css/tokens.css:45-47](css/tokens.css#L45-L47): Cabinet Grotesk + Outfit + JetBrains Mono.

Cabinet Grotesk reads "design studio" not "bank". Bank-grade pairings tend toward humanist sans (Inter, GT America, Söhne, Aktiv Grotesk).

**Fix:** keep Outfit body OR swap to Inter. Replace Cabinet Grotesk display with Inter Display. Numbers stay JetBrains Mono — but enable `font-variant-numeric: tabular-nums` everywhere amounts render.

#### D14. Animation timings uniform — no hierarchy
Single `--tr: .16s` ([css/tokens.css:55](css/tokens.css#L55)). Modal slide 0.22s. Pulse 2s. No tiered system.

**Fix:** add `--tr-micro` (100ms), `--tr-sm` (180ms), `--tr-md` (280ms), `--tr-lg` (450ms).

#### D15. Print styles use hardcoded colors
[css/responsive.css:4-6](css/responsive.css#L4-L6) — `#fff`, `#000`, `#ddd` bypass tokens. PDF reports won't honor brand.

**Fix:** map print to tokens. Ensure tabular-nums on amounts.

#### D16. No skeleton states beyond emoji
Empty states are emoji + 1 line ([css/base.css:37-38](css/base.css#L37-L38)). For Firestore-synced household data, first paint shows real "no data" before sync — feels broken.

**Fix:** add `.skel` shimmer utility; gate empty-state on "synced && truly empty".

---

### 🟢 LOW

- D17. `::selection` hardcoded `rgba(124,115,230,.35)` ([css/base.css:7](css/base.css#L7)) — should reference `--p`.
- D18. Scrollbar 4px ([css/base.css:8-10](css/base.css#L8-L10)) — too thin. Use 8-10px.
- D19. Save-badge dot pulse 2s — distracting at edge of vision. Pause when idle.
- D20. No `prefers-reduced-motion` respect anywhere. Required for AAA + bank-grade.
- D21. No `prefers-color-scheme` system preference fallback — force-applies dark.
- D22. Wordmark inconsistent ("FinanceFreedom" v6, "NidhiPath" v7). Pick one + design proper monogram.

---

## Priority order (impact × effort for bank-grade household feel)

| # | Fix | Severity | Effort | Why first |
|---|-----|----------|--------|-----------|
| 1 | D7 focus rings | High | XS | Accessibility floor |
| 2 | D5 type scale floor | Critical | S | Adult readability |
| 3 | D10 spacing scale | High | S | Foundation for cleanup |
| 4 | D8 touch targets | High | S | One global rule fixes most |
| 5 | D2 trust signals | Critical | M | Biggest household-grade win |
| 6 | D1 emoji → SVG icons | Critical | M | Largest "bank vs hobby" dial |
| 7 | D3 + D4 palette restraint | Critical | M | Reset chrome to neutrals |
| 8 | D11 breakpoints (tablet) | High | S | Households use iPads |
| 9 | D6 IA reduction (13→6) | High | L | Best after above |
| 10 | D13 type stack swap | Medium | S | Inter ships free |

---

## What this audit does NOT cover

- Mockups / rebrand concepts (audit-only requested)
- Mood boards / brand guidelines
- Information architecture deep-dive (D6 sketched only)
- Code-level CSS refactor execution
- Deep typography (delegate to **typography-expert**)
- Color theory math (delegate to **color-theory-palette-harmony-expert**)
- Token architecture overhaul (delegate to **design-system-creator**)

---

## Verification (when fixes happen)

1. **Focus rings (D7):** keyboard tab through every button — visible 2px ring on each.
2. **Type floor (D5):** root 16px; smallest UI text ≥11px on phone at arm's length.
3. **Touch (D8):** every interactive control hit-box ≥40×40px.
4. **Palette (D3/D4):** APCA Lc≥75 for body text both themes; chart hues quarantined.
5. **Icons (D1):** zero emoji in nav, dropdowns, empty states. Custom-section emoji preserved.
6. **Trust (D2):** household demo — partner edits debt → other sees attribution within 5s.
7. **Tablet (D11):** iPad portrait + landscape no horizontal scroll; KPI grid ≤3 columns.
8. **No-motion (D20):** with `prefers-reduced-motion`, no transforms / pulses fire.

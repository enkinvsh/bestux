# bestux rulebook

Every number below was read on the cited page during the research pass of 2026-10-20; † marks numbers re-checked against the source a second time. Checks: **[P]** `ux-probe` gate/signal, **[D]** your own DOM measurement in Playwright, **[M]** fresh-eye test, **[E]** your eye on the screenshot.

Not used as evidence: the Z-pattern (no primary source), the "3-click rule" (a myth), Miller's 7±2 as a menu limit (it is about memory chunks, not choices).

---

## A. One job per state

**A1. One primary action per screen state, in the first viewport.**
- People spend 57% of viewing time above the fold and 74% in the first two screenfuls; NN/g: "Keep major CTAs above the fold" ([NN/g, scrolling and attention](https://www.nngroup.com/articles/scrolling-and-attention/)†).
- [P] `G-PRIMARY-MISSING`, `G-PRIMARY-FOLD` at 390x844 and 320x568. [M] first click >= 2/3.

**A2. The state decides the primary action.** Expired -> renew; limit reached -> top up / upgrade; trial -> choose a plan; empty -> create the first item; error -> the recovery action. The healthy "all good" state may have no urgent action: then the most frequent task is primary.
- [E] Task Map row per state; [M] comprehension reads the state correctly.

**A3. Exactly one strongly emphasised action per view.** If more than two elements pop, none does (Von Restorff, [lawsofux](https://lawsofux.com/von-restorff-effect/)).
- [P] `S-COMPETING-PRIMARY`, `S-PRIMARY-OUTSHOUTED`; [M] squint puts the primary first or second.

## B. Task order

**B1. Top to bottom = orient -> act -> confirm.** Status first, then the action that changes it, then details.
**B2. A status lives with its action** ("Expired 12 Oct" + "Renew for 250 ₽" in one block; "Balance 0 ₽" + "Top up" in one row).
**B3. The next control is where the previous step ends.** Confirm/continue at the bottom of a long list or in a sticky bar, not only at the top.
**B4. Shorten finger travel.** The probe sums travel between consecutive steps (`transitPx`); big jumps between related steps are a layout defect.
- [P] `S-TASK-SCROLL`, task `transitPx`, `scrolls`; [M] after-click test "is it clear what to do next".

## C. Grouping

**C1. Gap inside a group < gap between groups** (aim for >= 2x). Labels sit closer to their own field than to the next one ([NN/g, web form design](https://www.nngroup.com/articles/web-form-design/); [proximity](https://lawsofux.com/law-of-proximity/), [common region](https://lawsofux.com/law-of-common-region/)).
- [D] compare vertical gaps between siblings inside a card vs between cards.
**C2. Visual grouping matches functional grouping.** Things used together sit together; controls are anchored to the object they act on; no orphan buttons floating away from their list or table.
- [E] on `marks.png`; [M] DOUBT pointing to a control from a different group.

## D. Size and position follow importance

**D1. Biggest/highest = the user's main thing in this state.** In bento layouts the big tile is the main task, not a promo.
**D2. Secondary blocks go lower and smaller:** referral promos, gifts, news, tours, tips. They never push the primary action below the fold.
**D3. Zero, empty or irrelevant cards do not hold prime spots,** or they turn into their action (balance 0 ₽ -> one row with "Top up").
**D4. Nothing important lives only in a collapsed section or an overflow menu.**
- [P] `G-PRIMARY-FOLD`, `S-PRIMARY-OUTSHOUTED`; [M] squint and EYE order; [E] the "Карта экранов" order now vs proposed.

## E. Reach on phones

**E1. Key actions in the middle band; secondary paths on the top and bottom edges.** "Users prefer to touch the center of the screen... Place key actions in the middle half to two-thirds of the screen. Then, place options and buttons that provide paths to secondary screens along the top and bottom of the screen." Touch accuracy is 7 mm at the centre and 12 mm at the corners ([Hoober 2017, Part 3](https://www.uxmatters.com/mt/archives/2017/07/design-for-fingers-touch-and-people-part-3.php)†).
- [P] `G-PRIMARY-REACH` (centre in the top 20%). A primary action pinned in a bottom bar is fine.
**E2. Do not design for one grip.** 49% one-handed, 36% cradled, 15% two-handed ([Hoober 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)†).
**E3. Targets >= 44x44 px, never below 24 px, >= 8 px apart.** Apple 44pt ([HIG buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)), Android 48dp ([Android accessibility](https://support.google.com/accessibility/android/answer/7101858)), WCAG 2.5.8 floor 24px ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- [P] `G-PRIMARY-SIZE`, `G-TARGET-24`, `S-TARGET-44`, `S-TIGHT-GAP`.
**E4. Bars hold few items.** "Placing more than four items on an iOS menu bar - or five on the largest phones - is just asking for trouble" (Hoober 2017†). Bottom navigation: 3-5 destinations with visible labels ([Material 3](https://m3.material.io/components/navigation-bar/guidelines)).
**E5. Dangerous actions far from frequent ones** (Hoober 2017†): delete, cancel subscription, log out never sit next to the main action.
**E6. Room at the bottom.** Leave padding so the last card scrolls above fixed bars; Hoober: let content scroll to the middle.
- [P] `G-BOTTOM-COVERED`, `G-PRIMARY-COVERED`.

## F. Steps and friction

**F1. Count, then cut.** Clicks, fields, scrolls per task from the probe. Remove steps with no visible next action, redundant confirmations and re-entry of known data ([WCAG 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)).
**F2. Clarity over click count.** The 3-click rule is a myth: users do not quit after three clicks if each click is obvious ([NN/g](https://www.nngroup.com/articles/3-click-rule/)).
**F3. Undo over confirm** for reversible actions: people click through confirmations by habit ([Raskin, A List Apart](https://alistapart.com/article/neveruseawarning/), [GNOME HIG](https://developer.gnome.org/hig/patterns/feedback/dialogs.html)). Confirm only the irreversible, with a specific verb.
**F4. Sensible defaults.** Pre-select the most common choice (the current plan, the saved card, the last device type) so the common path is one tap.
**F5. Feedback within 0.1 s, keep flow under 1 s, show progress beyond that** ([NN/g response times](https://www.nngroup.com/articles/response-times-3-important-limits/)). Multi-step flows show "step N of M" ([goal gradient](https://lawsofux.com/goal-gradient-effect/)).
- [P] task cost lines in `summary.md`; [M] after-click test.

## G. Same thing, same place

**G1. Persistent elements keep their coordinates** across screens and states: navigation, back, account, help, the primary button of a repeated pattern ([WCAG 3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), [3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)). Blocks do not jump between states (expired vs active home keep the same skeleton where possible).
- [P] `S-SPATIAL-DRIFT` (> 4 px) with `anchors`.
**G2. Conventions users bring from other products** ([Jakob's law](https://lawsofux.com/jakobs-law/)): logo top-left links home, account top-right, back top-left, primary button position consistent in every dialog ([NN/g, OK-Cancel](https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/)).
**G3. Desktop navigation visible.** Hidden menus were used in 27% of cases vs 48% for visible navigation; on mobile 57% vs 86% for combo navigation ([NN/g, hamburger menus](https://www.nngroup.com/articles/hamburger-menus/)).

## H. Forms

**H1. One column, labels above, never placeholder-only labels** ([NN/g](https://www.nngroup.com/articles/web-form-design/)). [P] `S-PLACEHOLDER-LABEL`.
**H2. Fewer fields.** Average checkout: 11.3 fields, 5.1 steps; most need about 8 fields; 17% of shoppers abandoned a checkout as too long or complicated ([Baymard](https://baymard.com/research-articles/checkout-flow-average-form-fields)†). Hide optional fields (coupon, address line 2) behind a link.
**H3. Validate after the field is left, error next to the field, specific text.** Inline validation: +22% success, -22% errors, -42% completion time ([Wroblewski, A List Apart](https://alistapart.com/article/inline-validation-in-web-forms/)); [Baymard inline validation](https://baymard.com/research-articles/inline-form-validation).
**H4. Right keyboard:** `type`/`inputmode`/`autocomplete` for e-mail, phone, numbers, codes ([Baymard](https://baymard.com/labs/touch-keyboard-types)). [P] `S-INPUT-KEYBOARD`.
**H5. Keep everything typed** on error and on back navigation ([WCAG 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)).
**H6. The keyboard and sticky bars never cover the focused field or submit** ([WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).

## I. No dead ends

**I1. Every state has a way forward:** errors, empty lists, 404, success screens.
**I2. Empty state = what is happening + what this place is for + one direct action** ([NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)).
**I3. After an action, land on its result** (created item, paid subscription), not on a generic list; keep filters and scroll position on back.
- [M] after-click test; [P] `G-TASK-NOT-DONE`.

## J. Progressive disclosure

**J1. Rare options one level deep, two at most:** "designs that go beyond 2 disclosure levels typically have low usability" ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)).
**J2. Never hide the primary tool or a frequent action** behind "More", a collapsed card or a second tab.

## K. Order for every input method

**K1. Focus and reading order follow the visual order** ([WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [1.3.2](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html)). Reordering with CSS `order` or absolute positioning breaks this: reorder the DOM. [P] `S-FOCUS-ORDER`.
**K2. Reflow at 320 px without horizontal scroll** ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)). [P] `G-OVERFLOW`.

## Choices

**Choices and Hick's law.** More options of equal weight take longer to choose from ([Hick's law](https://lawsofux.com/hicks-law/)). The fix is grouping and a highlighted default, not hiding options. [P] `S-CHOICES` (> 7 actions in the first viewport outside navigation) is a prompt to check grouping, not a hard limit.

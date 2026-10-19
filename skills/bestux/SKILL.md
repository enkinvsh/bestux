---
name: bestux
description: Zero-friction screen arrangement for web and mobile UI. Maps user tasks per state, measures layout with a Playwright probe (fold, thumb reach, target size, overlap, steps, cross-screen drift), runs a blind first-click test with a zero-context multimodal model on a numbered Set-of-Mark screenshot, then rearranges blocks and proves the win. Use ONLY when the user explicitly asks for bestux, a UX arrangement or friction audit, or to rearrange screen elements for comfort.
license: MIT
---

# bestux - Zero-Friction Arrangement

Toolkit root (`<skill-dir>`): the directory of this SKILL.md, usually `.agents/skills/bestux/` or `~/.agents/skills/bestux/`. It holds `scripts/ux-probe.mjs` and `references/`.

A screen can be beautiful and still make people work. Friction almost always comes from **where things are**, not how they look: the action the user came for sits under a promo, the status and its fix live on different cards, the confirm button is at the top of a list the user just scrolled to the bottom of, the same button moves between screens.

Agents arrange screens badly for three predictable reasons:
1. **Data order instead of task order.** Blocks follow the API response, the component tree or the order they were built in, not the order a person needs them.
2. **Asking a model for opinions.** "What UX improvements can be made?" gives 80% noise: in Baymard's test GPT-4 was right in 19.9% of its suggestions and found only 25.5% of the issues visible in the screenshots ([Baymard 2023](https://baymard.com/research-articles/gpt-ux-audit)).
3. **Judging geometry by eye.** A model looking at a screenshot cannot reliably tell distances, sizes, overlap, balance or what is below the fold.

This skill fixes all three: **Task Map -> Measure -> Blind First-Click -> Arrange -> Prove.** Geometry is measured by a script. The fresh-eye model is never asked what to improve; it is asked to *act*, like a hurried first-time user, and we score what it does.

---

## 0. Scope and Iron Laws

**bestux owns:** what is on the first screen, order of blocks, grouping, which action is primary in each state, size and emphasis as a signal of importance, reach, number of steps, form layout, empty/error/dead-end states, navigation, and consistency across screens and states.

**taste owns:** colors, fonts, tokens, motion, visual polish. When bestux changes emphasis (which button is primary vs secondary), it uses the project's existing button variants and tokens. Run taste after bestux if new visuals are needed.

Iron laws:
1. **Tasks before pixels.** No change before the Task Map (section 1) exists.
2. **Never ask the fresh eye how to improve the screen.** It acts; you diagnose.
3. **Geometry is measured, never eyeballed.** Fold, sizes, gaps, overlap, steps, drift come from `scripts/ux-probe.mjs`.
4. **Arrangement is not content.** Moving, merging, resizing, reordering, collapsing and state-dependent order are yours. Adding or removing a feature, block or text, or changing money/business logic, is an `owner_decision`: propose it, show it, do not ship it silently.
5. **Weight by who actually sees the screen.** If 80% of users are in the "expired" state, the expired home is the main screen, not the happy active one.
6. **No change for the sake of change.** If round 0 passes every gate and the first-click test, report that and stop.

---

## 1. Phase 1 - Task Map

Before touching anything, write this table (in the report and in the probe config):

| Screen | User state (share of users) | Top 1-3 tasks in this state | The ONE primary action | Reference target (selector) |
|---|---|---|---|---|
| Home | Expired (most users) | Get the service working again; check money | Renew | `#renew` |
| Home | Active | Connect a new device; check days left | Add device | ... |

How to fill it:
- **States** come from fixtures, feature flags, mocks and, when available, real counts (`expired`, `trial`, `empty`, `limited`, `active`, `error`, `first visit`, `returning`). Include worst-case data (long names, zero balance, 0 and 1 items).
- **Tasks** are the reasons a person opens this screen in this state, written as a situation in the user's words, never with the button's label ("The service stopped working because the paid period ended. You want it back" - not "Click Renew").
- **One primary action per state.** If you cannot name one, the screen has no job; that is finding #1.
- **Threads.** For each top task write the path: entry -> step -> ... -> done. For every step note where the user's finger and eye are when it ends, and where the next control is. The next control must be where the previous step ends.

---

## 2. Phase 2 - Measure with `ux-probe`

```bash
node <skill-dir>/scripts/ux-probe.mjs --config probe.json --out ux-work/round-0
node <skill-dir>/scripts/ux-probe.mjs --url http://localhost:5173/ --viewports 390x844,320x568,1440x900
```
- Playwright is resolved from the project (`node_modules`), then `BESTUX_NODE_MODULES=/path/to/node_modules`, then the skill directory. Do not install packages into the project without the owner's permission.
- Config format, steps, `prototype`, `accept` and outputs: `references/probe-config.md`.
- Default viewports: `390x844` (main phone), `320x568` (narrow phone), `1440x900` (desktop). Mobile-only products: add `430x932` instead of desktop.

Per screen x viewport it writes `clean.png`, `marks.png` (every interactive element outlined with a yellow number, ruler ticks every 100px), `squint.png` (blurred), task walk shots, `probe.json`, `summary.md`. Exit code 1 when any gate fails.

**Gates** (must be fixed or explicitly accepted with a reason via `accept`):

| ID | Meaning |
|---|---|
| `G-PRIMARY-MISSING` | The declared primary action is not on screen or hidden. |
| `G-PRIMARY-FOLD` | The primary action is below the first viewport. |
| `G-PRIMARY-REACH` | Phone: primary action centre in the top 20% of the screen and not pinned (hard to reach, Hoober). |
| `G-PRIMARY-SIZE` | Primary action smaller than 44px on its short side. |
| `G-PRIMARY-COVERED` | Primary action covered >= 30% by another element (bottom bar, sticky header, toast). |
| `G-BOTTOM-COVERED` | At the very bottom of the page targets still sit under a fixed bar. |
| `G-TARGET-24` | A control is below the WCAG 2.2 floor of 24px. |
| `G-OVERFLOW` | Horizontal overflow. |
| `G-TASK-BROKEN` / `G-TASK-NOT-DONE` | A task path from the config fails or does not reach its expected state. |

**Signals** (look at the screenshot and decide; a signal is a question, not a verdict): `S-PRIMARY-OUTSHOUTED` (another element is louder than the primary), `S-COMPETING-PRIMARY` (more than one strongly emphasised action in the first viewport), `S-CHOICES` (>7 actions in the first viewport outside navigation), `S-TARGET-44`, `S-TIGHT-GAP` (<8px between targets), `S-PLACEHOLDER-LABEL`, `S-INPUT-KEYBOARD`, `S-FOCUS-ORDER` (Tab jumps back up), `S-TASK-SCROLL` (task needs scrolling between steps), `S-SPATIAL-DRIFT` (the same pinned or header element moves >4px between screens).

---

## 3. Phase 3 - Blind First-Click (the fresh eye)

Use `look_at` (or a multimodal subagent with zero project context). Prompts and parsing rules: `references/monkey-protocol.md` (Russian and English).

**What to ask - four separate calls, never merged** (merging tasks degrades quality, [UICrit](https://arxiv.org/abs/2407.08850)):
1. **First click** on `marks.png`, one call per task and viewport: the situation from the Task Map, answer strictly `CLICK: <mark|NONE> / WHY / DOUBT: <other mark or no> / EYE: first, second, third`. The model answers with a mark number: numbered marks raised a model's grounding from 11.72% to 95.20% ([arXiv 2509.11548](https://arxiv.org/html/2509.11548v2)).
2. **Squint** on `squint.png`: what pulls the eye first, second, third. The primary action or the state it fixes must be in the top two.
3. **Comprehension** on `clean.png`: what is this screen and what is the state of the user's thing right now (e.g. "the subscription has ended"). Misreading the state is a Blocker.
4. **After-click check** (cognitive walkthrough, one call per step) on the task walk end shot: did the action do what you expected, is it clear what to do next.

**How to run:**
- **Three runs per question with reworded situations.** Run-to-run agreement of LLM usability judgements is low (31-57% in [MeasuringU](https://measuringu.com/ai-usability-problem-analysis-of-a-video/) tests), one run proves nothing.
- **Fresh context every run and every round.** A checker that saw earlier versions grades intent, not pixels.
- Never describe the product, the intent, or which button you hope it picks. Neutral wording only (models are sycophantic to stated intent).

**Pass criteria for a task on a viewport:** the intended mark (or a listed `alt` mark) in at least 2 of 3 runs, **and** the probe has no gate on that target. A model reads tiny text exhaustively, so it may find a 17px link a hurried person never sees: the probe gate still fails it. Do not use self-reported confidence %: verbalised confidence is overconfident (80-100% regardless of accuracy).

**What the answers are for:** a miss tells you *where* attention went instead (EYE and DOUBT name the competitor). The diagnosis and the fix come from the probe and the rulebook, never from the model. The `DOUBT` field is gold: "I'd tap 'Top up' first because the balance is 0" means the balance and renew blocks compete, a real arrangement question.

**Limits.** The model's click distribution differs from humans in about half of the tasks and collapses onto the most salient element ([What Would GPT Click, arXiv 2605.18302](https://arxiv.org/abs/2605.18302)). Treat it as a salience and clarity probe, not a population: if it misses with clear wording, a hurried human will likely miss too; a hit is necessary, not sufficient. It cannot judge click counts, timing, states after an action, sizes, spacing or cross-screen consistency: the probe covers those.

---

## 4. Phase 4 - Arrange (the rulebook)

Full rules with evidence and checks: `references/rulebook.md`. The core:

**A. One job per state.** One primary action per screen state, chosen from the Task Map, visible in the first viewport at 390x844 and 320x568. People spend 57% of viewing time above the fold and 74% in the first two screens ([NN/g](https://www.nngroup.com/articles/scrolling-and-attention/)). The state-specific action wins the prime spot: expired -> renew, limit reached -> top up, trial -> choose a plan, empty -> create the first item.

**B. Lay out in task order.** Orient -> act -> confirm, top to bottom. A status sits with its action ("Expired 12 Oct" + "Renew for 250 ₽" in one block). The confirm/continue control lives where the work ends: at the bottom of a long list or in a sticky bar, not only at the top. Sum the distance the finger/cursor travels between consecutive steps; shrink the big jumps.

**C. Group by use, not by data type.** Things used together sit together; the gap inside a group is clearly smaller than between groups (aim for >= 2x). Controls are anchored to what they act on; no orphan buttons. Visual grouping must match functional grouping.

**D. Size and position follow importance.** The biggest, highest, most emphasised element is the user's main thing in this state. Exactly one strongly emphasised action per view; if more than two elements pop, none does (Von Restorff). Promo, referral, gifts, news and tours go lower and smaller and never push the primary action below the fold. Zero, empty or irrelevant cards do not hold prime spots, or they become the action (balance 0 ₽ -> one row with "Top up").

**E. Reach on phones.** Users touch the centre of the screen most, fastest and most accurately: "Place key actions in the middle half to two-thirds of the screen. Then, place options and buttons that provide paths to secondary screens along the top and bottom of the screen." Accuracy is 7 mm at the centre and 12 mm at the corners ([Hoober 2017](https://www.uxmatters.com/mt/archives/2017/07/design-for-fingers-touch-and-people-part-3.php)). Grip is mixed (49% one hand, 36% cradled, 15% two hands, [Hoober 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)), so never design for one hand only. Targets >= 44x44 px (Apple 44pt, Android 48dp), never below 24px ([WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), >= 8px apart. Destructive actions are far from frequent ones. Bars hold at most 4-5 items. Leave room at the bottom so the last card can scroll above fixed bars.

**F. Fewer, clearer steps.** Count clicks, fields, scrolls per task from the probe. Remove steps with no visible next action, redundant confirmations (prefer undo for reversible actions), and re-entry of data the product already has ([WCAG 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)). Pre-select the sensible default. Do not chase a click count: the "3-click rule" is a myth ([NN/g](https://www.nngroup.com/articles/3-click-rule/)); three obvious clicks beat one confusing click.

**G. Same thing, same place.** Navigation, back, account, help and the primary button of a pattern stay at the same coordinates on every screen and in every state ([WCAG 3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), [3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)). Follow conventions users bring from other products: logo top-left goes home, account top-right, back top-left. On desktop keep the main navigation visible: hidden menus were used in 27% of cases versus 48% for visible ones ([NN/g](https://www.nngroup.com/articles/hamburger-menus/)).

**H. Forms.** One column, labels above fields, never a placeholder as the only label, the right keyboard (`type`/`inputmode`/`autocomplete`), validation after the field is left, the error next to the field, input kept on error. Cut fields: the average checkout has 11.3 fields while most need about 8 ([Baymard](https://baymard.com/blog/checkout-flow-average-form-fields)). Inline validation raised success by 22% and cut completion time by 42% in Wroblewski's test ([A List Apart](https://alistapart.com/article/inline-validation-in-web-forms/)).

**I. No dead ends.** Every state, error and empty screen offers the way forward. An empty state says what this place is for and has the one action that fills it ([NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)). Errors say what happened and what to do, next to where it happened.

**J. Progressive disclosure, carefully.** Hide rare options one level deep (max two, [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)). Never hide the primary tool or a frequent action in an overflow menu or a collapsed section.

**K. Order for every input method.** Focus and reading order follow the visual order ([WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)). Sticky bars and the on-screen keyboard never cover the focused field or the submit button ([WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).

**Prototype before you edit source.** Put the proposed arrangement into the probe config as `prototype` (a JS file that reorders the live DOM: `insertBefore`, `append`, toggling existing classes). Measure and first-click-test the prototype; only a winning arrangement goes into the source.

---

## 5. Phase 5 - Prove

1. **Probe** the new arrangement: zero gates (or accepted with a reason), signals reviewed.
2. **First-click** again with fresh contexts: every top task passes on every viewport.
3. **Pairwise A/B** on `clean.png`, current vs proposed, in **both orders** (A/B and B/A) with fresh contexts: `EASIER: A|B|SAME / DIFFERENCE / LOSS`. Accept a win only when both orders agree; models have position bias, and general MLLM preference between UIs is close to chance (GPT-4V 51.6% in [UIClip](https://arxiv.org/abs/2404.12500)). Pairwise is a regression detector and a tiebreaker, not proof on its own.
4. **Read every LOSS.** Anything the user can no longer find (a block that disappeared, an action that moved into a menu) must be listed in the report and approved by the owner.
5. **Stop rules.** Maximum two fix rounds. LLM feedback quality drops across iterative rounds (accurate comments 52% -> 39% after edits in [Duan et al., CHI 2024](https://arxiv.org/abs/2403.13139)). If round 2 does not beat round 1, keep round 1 and report the trade-off.

---

## 6. Findings, Severity, Report

Every finding cites evidence: a probe gate/signal ID, or a first-click miss (`2/3 runs chose mark 2 instead of 5`), plus the screenshot file. Without evidence it is a hypothesis and is labelled so. Twelve real findings beat forty padded ones.

Severity (frequency multiplies it: a screen everyone sees daily outranks a settings page):
- **Blocker** - the top task cannot be completed, the primary action is missing/hidden/covered, the state is misread (expired read as active, money read wrong).
- **Major** - the primary action needs scrolling, loses the first click, or the task costs avoidable steps.
- **Minor** - grouping, order or consistency drift that slows but does not stop.
- **Nit** - polish.

Final report:
```txt
Task Map: <screens x states, share of users, top tasks, primary action>
Round 0: probe <gates/signals per screen x viewport>; first-click <task: hits/3 per viewport>; squint/comprehension notes
Changes: <what moved where and why, one line each; owner_decision items listed separately>
Round N: probe <0 gates>; first-click <all tasks >= 2/3>; pairwise <winner in both orders>; LOSS <list or none>
Not assessable: <what needs real users or analytics>
```

## 7. Pre-flight Checklist
- [ ] Task Map written; states weighted by real share; one primary action per state.
- [ ] Probe run at 390x844, 320x568 and 1440x900 (or 430x932 for mobile-only); zero gates or each accepted with a reason.
- [ ] First-click: every top task >= 2/3 runs on every viewport, fresh context per run, neutral wording.
- [ ] Squint and comprehension pass on the main screens.
- [ ] Arrangement prototyped in the DOM before editing source; pairwise win in both orders; every LOSS listed.
- [ ] No features, blocks or texts added or removed without `owner_decision`.
- [ ] Dev servers, browsers and probes started during the work are stopped.

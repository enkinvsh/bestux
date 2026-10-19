# ux-probe config

```bash
node <skill-dir>/scripts/ux-probe.mjs --config probe.json --out ux-work/round-0
```

Playwright is taken from the project being checked (`./node_modules`), then from `BESTUX_NODE_MODULES=/abs/path/node_modules`, then from the toolkit directory. Chromium comes from the Playwright cache or the system Google Chrome. Never add dependencies to the checked project without the owner's permission; point `BESTUX_NODE_MODULES` at any local `node_modules` that has `playwright-core`.

CLI flags override the config: `--out`, `--viewports 390x844,320x568`, `--wait <ms>`, `--wait-for <selector>`, `--storage <state.json>`, `--full`, `--no-focus`, `--blur <px>`.

## Shape

```json
{
  "viewports": ["390x844", "320x568", "1440x900"],
  "wait": 600,
  "waitFor": "main",
  "storage": "auth-state.json",
  "full": false,
  "anchors": { "nav-home": "nav a[href='/']", "account": "[data-testid=account]" },
  "screens": [
    {
      "name": "home-expired",
      "url": "http://localhost:5173/?data=expired",
      "waitFor": "[data-testid=status]",
      "actions": ["[data-testid=close-welcome]"],
      "primary": "#renew",
      "prototype": "proto/home-expired.js",
      "accept": { "G-PRIMARY-REACH": "search field on top is the platform convention" },
      "tasks": [
        {
          "id": "renew",
          "target": "#renew",
          "alt": ["header a.renew"],
          "path": ["#renew", { "click": "#pay-sbp" }],
          "expect": "[data-testid=payment-sheet]"
        },
        { "id": "topup", "target": "#topup" }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `viewports` | `WxH` list. Width <= 600 is a phone: DPR 2, touch, mobile UA. |
| `anchors` | Elements that must stay in the same place on every screen (`S-SPATIAL-DRIFT`). Per-screen `anchors` add to them. |
| `storage` | Playwright `storageState` for logged-in screens. |
| `screens[].actions` | Steps run after load and before measuring: close a welcome sheet, switch a tab, open a state. |
| `screens[].primary` | Selector of the ONE primary action for this state (from the Task Map). Enables the `G-PRIMARY-*` gates. |
| `screens[].prototype` | JS file (path relative to the config) run in the page after `actions`: rebuild the proposed order in the DOM before touching the source. `prototypeJs` takes inline code. |
| `screens[].accept` | `{gateId: reason}`: a gate the owner accepted on purpose. It moves to "принято" in the summary and does not fail the run. |
| `tasks[].target` | Reference target for the first-click test. Its mark number is printed in `summary.md`. |
| `tasks[].alt` | Other selectors that also count as a correct first click. |
| `tasks[].path` | Steps of the task walk. Counts clicks, fills, presses, scrolls, scroll px and finger travel px; shoots every step. |
| `tasks[].expect` | Selector that must be visible at the end of the walk (`G-TASK-NOT-DONE`). |

Steps: a string clicks the selector; objects `{ "click": sel }`, `{ "fill": [sel, text] }`, `{ "press": "Enter" }`, `{ "wait": ms }`, `{ "scroll": px }`, `{ "eval": "js" }`.

## Prototype example

```js
// proto/home-expired.js: статус и продление наверх, промо рефералки вниз
const main = document.querySelector("main");
const status = document.querySelector("[data-block=subscription]");
const promo = document.querySelector("[data-block=referral-promo]");
main.prepend(status);
main.append(promo);
document.querySelector("#renew").classList.replace("btn-ghost", "btn-primary");
```
Reuse existing classes and components. The prototype is a preview of a rearrangement, not a redesign.

## Output (`--out`)

| File | Use |
|---|---|
| `<screen>@<WxH>.clean.png` | Comprehension and pairwise tests, the report. |
| `<screen>@<WxH>.marks.png` | First-click test: every target outlined with a yellow number, ruler ticks every 100px on top and left. |
| `<screen>@<WxH>.squint.png` | Squint test (blurred page). |
| `<screen>@<WxH>.full.*.png` | With `--full`: the whole page, clean and marked. |
| `<screen>@<WxH>.task-<id>.step-<k>.marks.png`, `.end.png` | Task walk, for the after-click test. |
| `probe.json` | Everything measured: marks (role, name, box, inFold, pinned, emphasis, covered), headings, inputs, focus walk, bottom check, tasks, verdict. |
| `summary.md` | Russian summary: primary action, reference marks for tasks, task cost, gates, accepted gates, signals. |

Exit code 1 when any screen has a gate or an error.

## Gates and signals

| ID | Kind | Fix direction |
|---|---|---|
| `G-PRIMARY-MISSING` | gate | The state has no visible primary action. Add it from the existing component set (`owner_decision` if it is a new action). |
| `G-PRIMARY-FOLD` | gate | Move the primary action (and its status) up, move promo/secondary blocks down, or pin it in a bottom bar. |
| `G-PRIMARY-REACH` | gate | Phone: the primary action sits in the top 20% of the screen. Move it to the middle band or a bottom bar. |
| `G-PRIMARY-SIZE` | gate | Primary action under 44px: use the full-size button variant. |
| `G-PRIMARY-COVERED` | gate | A fixed bar, header or toast covers it: add bottom padding equal to the bar, or move it. |
| `G-BOTTOM-COVERED` | gate | At the end of the page targets stay under a fixed bar: add bottom padding / safe-area inset. |
| `G-TARGET-24` | gate | A control under 24px: enlarge the hit area (padding) or merge it into a row. |
| `G-OVERFLOW` | gate | Horizontal overflow: `min-width: 0`, wrapping, no `100vw`. |
| `G-TASK-BROKEN` / `G-TASK-NOT-DONE` | gate | The task path fails or ends in the wrong state. |
| `S-PRIMARY-OUTSHOUTED` | signal | Something else is louder than the primary action. Demote it or promote the primary. |
| `S-COMPETING-PRIMARY` | signal | More than one strongly emphasised action in the first viewport: keep one. |
| `S-CHOICES` | signal | More than 7 actions in the first viewport outside navigation: group or move rare ones down. |
| `S-TARGET-44` / `S-TIGHT-GAP` | signal | Targets under 44px or closer than 8px. |
| `S-PLACEHOLDER-LABEL` / `S-INPUT-KEYBOARD` | signal | Field with only a placeholder as label; e-mail or phone field without the right keyboard. |
| `S-FOCUS-ORDER` | signal | Tab jumps back up the page: DOM order differs from visual order. |
| `S-TASK-SCROLL` | signal | The next step of a task is off screen: put it where the previous step ends. |
| `S-SPATIAL-DRIFT` | signal | A pinned/header element or an anchor moved > 4px between screens. |

Emphasis is computed from the element's colors: `accent` (saturated fill or gradient), `contrast` (fill far from the page background), `filled`, `none`. It is a heuristic: confirm `S-*` emphasis signals on the screenshot.

---
description: bestux - arrange screen elements for maximum comfort and zero friction (Playwright probe + blind first-click test). Runs only when invoked as /bestux
---

The user invoked **bestux**: arrange the UI for maximum user comfort and zero friction. Target: $ARGUMENTS

If the target is empty, ask which product, screens or route to look at and stop.

1. Read the bestux `SKILL.md` completely before anything else (`.agents/skills/bestux/SKILL.md` in the project or `~/.agents/skills/bestux/SKILL.md`; if you keep it outside the skill loader, point this line at that path) and follow it: Task Map -> Measure (`scripts/ux-probe.mjs`) -> Blind First-Click -> Arrange -> Prove. Open the files in its `references/` folder when the guide points to them.
2. Mode:
   - The target asks to fix, apply or implement -> prototype the new arrangement in the DOM, prove the win, then edit the source and re-run the probe and the first-click test on the real build.
   - Otherwise this is an audit: Task Map, probe, first-click, DOM prototypes of the proposed arrangement and before/after screenshots. Do not edit the project's source; wait for the user's "ok" by finding ID.
3. Anything that adds or removes a feature, block or text, or touches money and business logic, is an `owner_decision`: show it, never ship it silently.
4. Keep work files in a scratch folder (for example `ux-work/`, git-ignored) or the system temp dir. Stop every dev server and browser you start.
5. Report in the user's language: what the user sees now, what moves where and why (one line each), probe gates before/after, first-click hits per task and viewport, every LOSS from the pairwise test, and the before/after screenshots.

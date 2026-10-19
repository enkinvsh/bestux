# Fresh-eye protocol ("мартышка")

The fresh eye is a multimodal model with **zero project context** (`look_at`, or a new subagent that has never seen the code, the brief or earlier versions). It plays a hurried first-time user. It is never asked what to improve.

## Why it is built this way

| Finding | Source | Consequence for the protocol |
|---|---|---|
| Open question "what UX improvements can be made?": 19.9% of GPT-4 suggestions correct, 80.1% false positives, 25.5% of screenshot-visible issues found | [Baymard 2023](https://baymard.com/research-articles/gpt-ux-audit) | Never ask for improvements. Ask it to act. |
| GPT-4o found 21.2% of the issues experts found; 24.3% of its issues were false | [arXiv 2506.16345](https://arxiv.org/html/2506.16345) | Its findings are leads, not verdicts. |
| Numbered marks raised a model's grounding on ScreenSpot-v2 from 11.72% to 95.20% | [arXiv 2509.11548](https://arxiv.org/html/2509.11548v2) | It answers with a mark number from `marks.png`. |
| Few-shot + coordinate references on the screenshot edges improved critique quality 0.31 -> 0.48; asking for critique and boxes in one call made it worse | [UICrit, UIST 2024](https://arxiv.org/abs/2407.08850) | Ruler ticks on `marks.png`; one question per call. |
| Any-2 agreement between repeated runs of the same LLM on the same material: 31% (ChatGPT), 57% (Gemini); between the two models 28% | [MeasuringU](https://measuringu.com/ai-usability-problem-analysis-of-a-video/) | Three runs, reworded, fresh context each. |
| GPT first clicks differ from human distributions in about half of the tasks and collapse onto the most salient element; personas and chain-of-thought did not fix that | [What Would GPT Click, arXiv 2605.18302](https://arxiv.org/abs/2605.18302), prompts: [uxtweak-research/synthetic-first-click](https://github.com/uxtweak-research/synthetic-first-click) | It is a salience and clarity probe, not a population. No personas. |
| General MLLM preference between two UIs is near chance (GPT-4V 51.6%) | [UIClip, arXiv 2404.12500](https://arxiv.org/abs/2404.12500) | Pairwise only as tiebreaker and regression detector, both orders. |
| LLM design feedback degrades over iterative rounds (accurate comments 52% -> 39%) | [Duan et al., CHI 2024](https://arxiv.org/abs/2403.13139) | Max two fix rounds, fresh context per round. |
| A correct first click predicts task success (87% vs 46% in Bailey's data, smaller gap 78% vs 70% in later replication); image-based first-click tests differ from live sites by 5-7% on average | [MeasuringU first-click](https://measuringu.com/first-click/), [click tests vs live](https://measuringu.com/do-click-tests-predict-live-site-clicks/) | First-click on a screenshot is a valid proxy for the first step. |

## Wording rules

- Describe a **situation**, never the button: no words from the target's label, no product name, no internal terms. "The service stopped working because the paid period ended. You want it back" - not "renew the subscription".
- Never describe the product, the intent of the design or what you hope it picks. Models agree with stated intent.
- Write three paraphrases of each situation (different words, same goal). Run each in a fresh context.
- One question per call. Never combine first click, squint, comprehension and pairwise.
- The model must not "rescue" the screen by reading tiny print: say it is in a hurry. The probe still gates tiny targets, because a model finds a 17px link a skimming human does not.

## 1. First click (`<screen>@<vp>.marks.png`)

RU:
```txt
Ты впервые видишь этот экран телефона и ничего не знаешь о сервисе. Все нажимаемые элементы обведены и помечены жёлтыми номерами.
Ситуация: <ситуация своими словами, без слов с кнопки>.
Не рассуждай долго, действуй как обычный человек, который спешит. Ответь строго в четыре строки:
КЛИК: <номер метки или НЕТ>
ПОЧЕМУ: <одна фраза>
СОМНЕНИЕ: <другая метка, которую тоже хотелось нажать, или «нет»>
ВЗГЛЯД: <что заметил первым, вторым, третьим>
```
EN:
```txt
You are seeing this screen for the first time and know nothing about the service. Every clickable element is outlined and labelled with a yellow number.
Situation: <situation in plain words, without the button's words>.
Do not deliberate, act like an ordinary person in a hurry. Answer in exactly four lines:
CLICK: <mark number or NONE>
WHY: <one sentence>
DOUBT: <another mark you were tempted to press, or "no">
EYE: <what you noticed first, second, third>
```
For desktop write "этот экран сайта" / "this website screen".

Score: hit = the intended mark or a listed `alt` mark (see `summary.md`, «Цели задач»). Pass = hits in >= 2 of 3 runs on each viewport **and** no probe gate on the target. Record misses with the chosen mark: "renew@390: 1/3, picked 2 «Пригласить друга» twice".

## 2. Squint (`<screen>@<vp>.squint.png`)

RU: `Это размытый снимок экрана, текст не читается. Что притягивает взгляд первым, вторым и третьим? Опиши место и форму (например «большой зелёный прямоугольник сверху»). Три строки, без советов.`
EN: `This is a blurred screenshot, the text is unreadable. What pulls your eye first, second and third? Describe position and shape. Three lines, no advice.`

Pass: the primary action, or the status it resolves, is first or second. Compare positions with the probe's mark coordinates.

## 3. Comprehension (`<screen>@<vp>.clean.png`)

RU: `Ты впервые видишь этот экран. Ответь коротко: 1) Что это за экран? 2) Что сейчас с <твоей подпиской / заказом / счётом> - всё хорошо или что-то не так? 3) Что от тебя здесь ждут?`
EN: `You are seeing this screen for the first time. Answer briefly: 1) What is this screen? 2) What is the state of your <subscription / order / account> right now - fine or not? 3) What does it expect you to do?`

Misreading the state (expired read as active, money read wrong, spent read as remaining) is a Blocker.

## 4. After the click (task walk shots)

Show the `step-<k>.marks.png` after the step and, at the end, `step-<n>.end.png`:

RU: `Ты хотел: <ситуация>. Ты только что нажал «<подпись>». Перед тобой то, что открылось. 1) Это то, чего ты ожидал? (да / не совсем / нет) 2) Понятно, что делать дальше? Если да - какую метку нажмёшь? 3) Видно ли, что ты продвинулся к цели?`
EN: `You wanted: <situation>. You just pressed "<label>". This is what opened. 1) Is this what you expected? (yes / not quite / no) 2) Is it clear what to do next? If yes, which mark? 3) Can you see that you got closer to your goal?`

These are the cognitive-walkthrough questions: did the action match the goal, was it noticeable, did the label match the effect, was progress visible.

## 5. Pairwise (two `clean.png`, current and proposed)

Run twice with fresh contexts: A = current, B = proposed; then A = proposed, B = current.

RU:
```txt
Перед тобой два варианта одного и того же экрана: первый снимок - А, второй - Б.
Ситуация: <ситуация>.
Ответь строго в три строки:
ЛЕГЧЕ: <А | Б | РАВНО>
РАЗНИЦА: <что в расположении сделало выбранный вариант легче>
ПОТЕРЯ: <что в выбранном варианте стало хуже или труднее найти, или «ничего»>
```
EN: same with `EASIER: <A | B | SAME>`, `DIFFERENCE`, `LOSS`.

Accept a win only when both orders pick the same version. Every LOSS goes into the report. A LOSS that names a disappeared block or a feature moved out of reach is an `owner_decision`.

## What counts as a finding

Real:
- a first-click miss in >= 2 of 3 runs (EYE/DOUBT name the competitor);
- a misread state in comprehension;
- the same element named by >= 2 of 3 runs with the same reason, **and** confirmed by the probe or by your own look at the shot;
- a probe gate.

Noise (drop it):
- a remark from one run only;
- generic advice ("add onboarding", "make it responsive");
- things already on the screen;
- feature requests and copy rewrites (unless the copy breaks the arrangement);
- claims about sizes, distances, alignment or balance - the probe measures those.

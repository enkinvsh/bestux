#!/usr/bin/env node
// ux-probe — измерительный зонд скилла bestux.
// Меряет то, что модель на скриншоте оценивает плохо: первый экран, досягаемость
// главного действия, размеры и зазоры целей, порядок фокуса, постоянство мест между
// экранами и цену пути задачи. Рисует нумерованную разметку (Set-of-Mark), чтобы
// «свежий глаз» отвечал номером метки, а не словами: на ScreenSpot-v2 такая сетка
// подняла попадание модели с 11.72% до 95.20% (arXiv 2509.11548).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const usage = `ux-probe — замер расстановки и снимки для слепого теста первого клика

Запуск:
  node ux-probe.mjs --url <url> [--url <url> ...] [опции]
  node ux-probe.mjs --config probe.json [опции]

Опции:
  --out <dir>             куда писать снимки и JSON (по умолчанию ./ux-probe-out)
  --viewports <list>      например 390x844,320x568,1440x900 (это и есть умолчание)
  --wait <ms>             пауза после загрузки (по умолчанию 600)
  --wait-for <selector>   ждать появления селектора перед замером
  --storage <file>        Playwright storageState (куки/localStorage для входа)
  --full                  дополнительно снять всю страницу (чистую и размеченную)
  --no-focus              не проходить Tab-ом по странице
  --blur <px>             размытие для снимка-«прищура» (по умолчанию 6 на телефоне, 10 на десктопе)

Конфиг (JSON): см. ~/.agents/skills/bestux/references/probe-config.md.
`;

// ---------- аргументы ----------
function readArgs(argv) {
  const out = { urls: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`флагу ${a} нужно значение`);
      return v;
    };
    switch (a) {
      case "--url": out.urls.push(next()); break;
      case "--config": out.config = next(); break;
      case "--out": out.out = next(); break;
      case "--viewports": out.viewports = next(); break;
      case "--wait": out.wait = Number(next()); break;
      case "--wait-for": out.waitFor = next(); break;
      case "--storage": out.storage = next(); break;
      case "--blur": out.blur = Number(next()); break;
      case "--full": out.full = true; break;
      case "--no-focus": out.noFocus = true; break;
      case "-h": case "--help": console.log(usage); process.exit(0); break;
      default: fail(`неизвестный флаг ${a}\n\n${usage}`);
    }
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

function loadPlaywright() {
  // Сначала ищем драйвер в проверяемом проекте, потом рядом со скиллом.
  // В pnpm playwright-core не поднят наверх, поэтому пробуем и @playwright/test.
  // BESTUX_NODE_MODULES — путь к чужому node_modules с Playwright, когда в проекте его нет
  // (например, папка харнесса или другой репозиторий): ставить зависимости в проект нельзя.
  const extra = process.env.BESTUX_NODE_MODULES
    ? [createRequire(path.join(path.resolve(process.env.BESTUX_NODE_MODULES), "..", "package.json"))]
    : [];
  const requirers = [
    createRequire(`${process.cwd()}/package.json`),
    ...extra,
    createRequire(import.meta.url),
  ];
  const attempts = [];
  for (const req of requirers) {
    for (const pkg of ["playwright-core", "playwright", "@playwright/test"]) {
      try {
        const mod = req(pkg);
        if (mod?.chromium) return mod;
      } catch (error) {
        attempts.push(`${pkg}: ${String(error.message).split("\n")[0]}`);
      }
    }
  }
  fail(
    "Не найден Playwright (playwright-core / playwright / @playwright/test).\n" +
      "Запусти из проекта, где он уже стоит, или задай BESTUX_NODE_MODULES=<путь к node_modules с playwright-core>.\n" +
      "Зависимости проверяемого проекта без разрешения владельца не меняй.\n  - " +
      attempts.join("\n  - "),
  );
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) || null;
}

const slug = (s) =>
  String(s)
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "root";

function parseViewports(spec) {
  return String(spec)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      const m = v.match(/^(\d+)x(\d+)$/);
      if (!m) fail(`плохой вьюпорт «${v}», нужен вид 390x844`);
      return { width: Number(m[1]), height: Number(m[2]) };
    });
}

// ---------- код, который исполняется в странице ----------
// Функции ниже сериализуются Playwright-ом, поэтому они самодостаточны:
// никаких ссылок на внешние переменные модуля.

function collectProbe(opts) {
  const vw = innerWidth;
  const vh = innerHeight;
  const sy = scrollY;
  const sx = scrollX;
  const INTERACTIVE =
    'a[href],button,input:not([type="hidden"]),select,textarea,summary,' +
    '[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],' +
    '[role="radio"],[role="menuitem"],[role="option"],[tabindex]:not([tabindex="-1"]),[onclick]';

  document.querySelectorAll("[data-uxprobe-mark]").forEach((el) => el.removeAttribute("data-uxprobe-mark"));

  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  // Канва переводит любой цвет (rgb, oklch, color()) в RGBA, getComputedStyle этого не гарантирует.
  const toRgba = (c) => {
    if (!c || c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const sat = ({ r, g, b }) => {
    const mx = Math.max(r, g, b) / 255;
    const mn = Math.min(r, g, b) / 255;
    const l = (mx + mn) / 2;
    if (mx === mn) return 0;
    return l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
  };
  const pageBgOf = () => {
    for (const el of [document.body, document.documentElement]) {
      const c = toRgba(getComputedStyle(el).backgroundColor);
      if (c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const pageBg = pageBgOf();

  const hiddenByTree = (el) => {
    if (el.closest('[inert],[aria-hidden="true"]')) return true;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || Number(s.opacity) === 0) return true;
      if (n === el && (s.visibility === "hidden" || s.visibility === "collapse")) return true;
    }
    return false;
  };
  const pinnedOf = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return p;
    }
    return null;
  };
  const nameOf = (el) => {
    const label = el.labels && el.labels[0] ? el.labels[0].innerText : "";
    const raw =
      el.getAttribute("aria-label") ||
      label ||
      (el.innerText || "").trim() ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      (el.tagName === "INPUT" && el.type !== "password" ? el.value : "") ||
      el.getAttribute("alt") ||
      el.querySelector("img[alt]")?.getAttribute("alt") ||
      el.querySelector("svg title")?.textContent ||
      "";
    return String(raw).replace(/\s+/g, " ").trim().slice(0, 80);
  };
  const roleOf = (el) => {
    const r = el.getAttribute("role");
    if (r) return r;
    const t = el.tagName.toLowerCase();
    if (t === "a") return "link";
    if (t === "button" || t === "summary") return "button";
    if (t === "input") return `input:${el.type || "text"}`;
    return t;
  };
  // Доля видимой части цели, которую перекрывает чужой элемент (нижнее меню, липкая шапка, тост).
  // Геометрия «в первом экране» этого не видит: кнопка под фиксированной панелью формально на экране.
  const coverage = (el) => {
    const r = el.getBoundingClientRect();
    const pts = [];
    for (const fx of [0.2, 0.5, 0.8]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x >= 0 && y >= 0 && x < vw && y < vh) pts.push([x, y]);
      }
    }
    if (!pts.length) return null;
    let hidden = 0;
    let by = null;
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
      hidden += 1;
      by = by || hit;
    }
    if (!hidden) return null;
    const pinnedHost = by && pinnedOf(by);
    return {
      ratio: Number((hidden / pts.length).toFixed(2)),
      by: by ? `${by.tagName.toLowerCase()}${by.id ? `#${by.id}` : ""}${pinnedHost ? ` (${pinnedHost})` : ""}` : null,
    };
  };
  // Ссылка внутри предложения освобождена от минимального размера (WCAG 2.5.8, inline).
  const isInlineTextLink = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const p = el.parentElement;
    if (!p) return false;
    return [...p.childNodes].some((n) => n !== el && n.nodeType === 3 && n.textContent.trim().length > 0);
  };

  // 1. Кандидаты: семантические цели плюс внешние элементы с cursor:pointer (div-кнопки).
  const set = new Set(document.querySelectorAll(INTERACTIVE));
  for (const el of document.body.querySelectorAll("*")) {
    if (set.has(el)) continue;
    if (getComputedStyle(el).cursor !== "pointer") continue;
    const parent = el.parentElement;
    if (parent && getComputedStyle(parent).cursor === "pointer") continue;
    set.add(el);
  }
  let items = [];
  for (const el of set) {
    if (el.closest("#__uxprobe_overlay")) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (hiddenByTree(el)) continue;
    items.push({ el, r });
  }
  // Вложенная цель почти того же размера — это одна и та же цель, оставляем внешнюю.
  const area = (r) => r.width * r.height;
  const inter = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const elems = new Set(items.map((i) => i.el));
  items = items.filter(({ el, r }) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (!elems.has(n)) continue;
      const pr = n.getBoundingClientRect();
      if (inter(r, pr) >= 0.85 * Math.max(area(r), area(pr))) return false;
    }
    return true;
  });

  // 2. Номера меток в порядке чтения: строками по 8 px сверху вниз, потом слева направо.
  items.forEach((i) => {
    i.pageTop = i.r.top + sy;
    i.pageLeft = i.r.left + sx;
  });
  items.sort((a, b) => Math.round(a.pageTop / 8) - Math.round(b.pageTop / 8) || a.pageLeft - b.pageLeft);

  const marks = items.map(({ el, r }, idx) => {
    const n = idx + 1;
    el.setAttribute("data-uxprobe-mark", String(n));
    const s = getComputedStyle(el);
    const bg = toRgba(s.backgroundColor);
    const gradient = s.backgroundImage && s.backgroundImage.includes("gradient");
    const solid = bg.a >= 0.6;
    const contrastToPage = solid ? Math.abs(lum(bg) - lum(pageBg)) : 0;
    const accent = (solid && sat(bg) >= 0.35 && lum(bg) > 0.03) || gradient;
    const pinned = pinnedOf(el);
    const inNav = !!el.closest('nav,[role="navigation"],[role="tablist"]');
    const inFold = r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1;
    return {
      n,
      role: roleOf(el),
      name: nameOf(el),
      x: Math.round(r.left + (pinned === "fixed" ? 0 : sx)),
      y: Math.round(r.top + (pinned === "fixed" ? 0 : sy)),
      w: Math.round(r.width),
      h: Math.round(r.height),
      inFold,
      covered: coverage(el),
      pinned,
      inNav,
      inlineText: el.tagName === "A" && isInlineTextLink(el),
      // Насколько цель «кричит»: акцентная заливка или резкий контраст с фоном страницы.
      emphasis: accent ? "accent" : contrastToPage >= 0.45 ? "contrast" : solid ? "filled" : "none",
      disabled: !!(el.disabled || el.getAttribute("aria-disabled") === "true"),
    };
  });

  // 3. Заголовки: текстовый каркас экрана в порядке сверху вниз.
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 1 && r.height > 1 && !hiddenByTree(el))
    .map(({ el, r }) => ({
      level: Number(el.getAttribute("aria-level")) || Number(el.tagName.slice(1)) || 0,
      text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
      y: Math.round(r.top + sy),
      inFold: r.top >= -1 && r.bottom <= vh + 1,
    }))
    .sort((a, b) => a.y - b.y);

  // 4. Поля ввода: тип клавиатуры, автозаполнение, подпись.
  const inputs = [...document.querySelectorAll("input:not([type=hidden]),textarea,select")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && !hiddenByTree(el);
    })
    .map((el) => {
      const hint = `${el.name || ""} ${el.id || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
      return {
        mark: Number(el.closest("[data-uxprobe-mark]")?.getAttribute("data-uxprobe-mark")) || null,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || (el.tagName === "INPUT" ? "text" : el.tagName.toLowerCase()),
        inputmode: el.getAttribute("inputmode"),
        autocomplete: el.getAttribute("autocomplete"),
        hasLabel: !!((el.labels && el.labels.length) || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")),
        placeholder: el.getAttribute("placeholder"),
        looksEmail: /mail|почт/.test(hint),
        looksPhone: /phone|tel|телефон/.test(hint),
      };
    });

  // 5. Заданные цели (главное действие, цели задач, якоря) → номер метки и геометрия.
  const resolve = (sel) => {
    if (!sel) return null;
    let el = null;
    try {
      el = [...document.querySelectorAll(sel)].find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && !hiddenByTree(e);
      });
    } catch (error) {
      return { selector: sel, error: String(error.message || error) };
    }
    if (!el) return { selector: sel, found: false };
    const host = el.closest("[data-uxprobe-mark]") || el.querySelector("[data-uxprobe-mark]");
    const r = el.getBoundingClientRect();
    const pinned = pinnedOf(el);
    return {
      selector: sel,
      found: true,
      mark: host ? Number(host.getAttribute("data-uxprobe-mark")) : null,
      name: nameOf(el),
      x: Math.round(r.left),
      y: Math.round(r.top + (pinned === "fixed" ? 0 : sy)),
      w: Math.round(r.width),
      h: Math.round(r.height),
      inFold: r.top >= -1 && r.bottom <= vh + 1,
      covered: coverage(el),
      centerYRatio: Number(((r.top + r.height / 2) / vh).toFixed(3)),
      bottomGap: Math.round(vh - r.bottom),
      pinned,
    };
  };
  const targets = {};
  for (const [k, sel] of Object.entries(opts.targets || {})) targets[k] = resolve(sel);
  const anchors = {};
  for (const [k, sel] of Object.entries(opts.anchors || {})) anchors[k] = resolve(sel);

  const de = document.documentElement;
  return {
    viewport: { width: vw, height: vh },
    doc: {
      scrollHeight: de.scrollHeight,
      screens: Number((de.scrollHeight / vh).toFixed(2)),
      overflowX: Math.max(0, de.scrollWidth - de.clientWidth),
    },
    pageBg,
    marks,
    headings,
    inputs,
    primary: resolve(opts.primary),
    targets,
    anchors,
  };
}

function drawOverlay({ ruler, onlyViewport }) {
  document.getElementById("__uxprobe_overlay")?.remove();
  const root = document.createElement("div");
  root.id = "__uxprobe_overlay";
  root.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(root);
  const fixedLayer = document.createElement("div");
  fixedLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  root.appendChild(fixedLayer);
  // Пурпурная рамка и жёлтый номер видны и на тёмном, и на светлом фоне.
  const colors = ["#ff00aa", "#00b3ff", "#ff7a00", "#00c853"];
  for (const el of document.querySelectorAll("[data-uxprobe-mark]")) {
    const n = Number(el.getAttribute("data-uxprobe-mark"));
    const r = el.getBoundingClientRect();
    // На снимке экрана метка за его краем дала бы обрезанный номер у кромки, и модель выбрала бы
    // невидимую цель.
    if (onlyViewport && (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth)) continue;
    let fixed = false;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      if (getComputedStyle(p).position === "fixed") {
        fixed = true;
        break;
      }
    }
    const layer = fixed ? fixedLayer : root;
    const top = r.top + (fixed ? 0 : scrollY);
    const left = r.left + (fixed ? 0 : scrollX);
    const box = document.createElement("div");
    const color = colors[n % colors.length];
    box.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${r.width}px;height:${r.height}px;outline:2px solid ${color};outline-offset:-1px;box-sizing:border-box;`;
    const tag = document.createElement("span");
    tag.textContent = String(n);
    const tagTop = r.top < 16 ? 1 : -15;
    tag.style.cssText = `position:absolute;left:-1px;top:${tagTop}px;font:700 11px/14px ui-monospace,Menlo,monospace;color:#000;background:#ffe500;border:1px solid #000;border-radius:3px;padding:0 3px;white-space:nowrap;`;
    box.appendChild(tag);
    layer.appendChild(box);
  }
  if (ruler) {
    // Деления по краям: модель точнее называет места с координатной опорой (UICrit, UIST 2024).
    const step = 100;
    for (let x = step; x < innerWidth; x += step) {
      const t = document.createElement("span");
      t.textContent = String(x);
      t.style.cssText = `position:absolute;top:0;left:${x}px;transform:translateX(-50%);font:600 9px/11px ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.65);padding:0 2px;`;
      fixedLayer.appendChild(t);
    }
    for (let y = step; y < innerHeight; y += step) {
      const t = document.createElement("span");
      t.textContent = String(y);
      t.style.cssText = `position:absolute;left:0;top:${y}px;transform:translateY(-50%);font:600 9px/11px ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.65);padding:0 2px;`;
      fixedLayer.appendChild(t);
    }
  }
}

function clearOverlay() {
  document.getElementById("__uxprobe_overlay")?.remove();
}

// ---------- шаги и ожидание ----------
async function settle(page, ms) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 4000 });
  } catch {
    // Долгие опросы и сокеты не дают networkidle; дальше страхуемся паузой.
  }
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(ms);
}

async function runStep(page, step) {
  if (typeof step === "string") step = { click: step };
  if (step.click) {
    await page.locator(step.click).first().click({ timeout: 5000 });
    return "click";
  }
  if (step.fill) {
    await page.locator(step.fill[0]).first().fill(String(step.fill[1]), { timeout: 5000 });
    return "fill";
  }
  if (step.press) {
    await page.keyboard.press(step.press);
    return "press";
  }
  if (step.wait) {
    await page.waitForTimeout(Number(step.wait));
    return "wait";
  }
  if (step.scroll) {
    await page.mouse.wheel(0, Number(step.scroll));
    return "scroll";
  }
  if (step.eval) {
    await page.evaluate(step.eval);
    return "eval";
  }
  throw new Error(`неизвестный шаг ${JSON.stringify(step)}`);
}

async function openScreen(page, screen, cfg) {
  await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (screen.waitFor || cfg.waitFor) await page.locator(screen.waitFor || cfg.waitFor).first().waitFor({ timeout: 15000 });
  await settle(page, cfg.wait);
  for (const step of screen.actions || []) {
    await runStep(page, step);
    await settle(page, 250);
  }
  const proto = screen.prototype ? fs.readFileSync(path.resolve(cfg.baseDir, screen.prototype), "utf8") : screen.prototypeJs;
  if (proto) {
    // Прототип новой расстановки прямо в DOM: проверяем порядок до правки исходников.
    await page.evaluate(`(async () => { ${proto}\n })()`);
    await settle(page, 250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
}

async function focusWalk(page, limit) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  const seq = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return null;
      const host = a.closest("[data-uxprobe-mark]");
      let pinned = false;
      for (let p = a; p && p.nodeType === 1; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === "fixed" || pos === "sticky") pinned = true;
      }
      const r = a.getBoundingClientRect();
      return {
        mark: host ? Number(host.getAttribute("data-uxprobe-mark")) : null,
        y: Math.round(r.top + scrollY),
        x: Math.round(r.left + scrollX),
        pinned,
      };
    });
    if (!info) break;
    if (seq.length > 2 && info.mark !== null && info.mark === seq[0].mark) break;
    seq.push(info);
  }
  // Прыжок назад: следующий фокус заметно выше предыдущего. Закреплённые шапки и
  // нижние панели не считаем: их страничная координата едет вместе с прокруткой.
  const back = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1];
    const b = seq[i];
    if (a.pinned || b.pinned) continue;
    if (b.y < a.y - 24) back.push({ from: a.mark, to: b.mark, dy: b.y - a.y });
  }
  return { visited: seq.length, order: seq.map((s) => s.mark), backwardJumps: back };
}

async function shoot(page, file, opts = {}) {
  await page.screenshot({ path: file, fullPage: !!opts.full, animations: "disabled", caret: "hide" });
  return file;
}

// ---------- путь задачи ----------
async function walkTask(page, screen, task, cfg, vp, outDir, base) {
  const res = { id: task.id, steps: [], clicks: 0, fills: 0, presses: 0, scrolls: 0, scrollPx: 0, transitPx: 0, success: null, error: null };
  try {
    await openScreen(page, screen, cfg);
    let prev = null;
    let k = 0;
    for (const raw of task.path || []) {
      const step = typeof raw === "string" ? { click: raw } : raw;
      const sel = step.click || (step.fill && step.fill[0]);
      const state = await page.evaluate(collectProbe, { targets: sel ? { step: sel } : {} });
      const shot = path.join(outDir, `${base}.task-${slug(task.id)}.step-${k}.marks.png`);
      await page.evaluate(drawOverlay, { ruler: true, onlyViewport: true });
      await shoot(page, shot);
      await page.evaluate(clearOverlay);
      const entry = { k, action: Object.keys(step)[0], selector: sel || null, mark: state.targets.step?.mark ?? null, inFold: state.targets.step?.inFold ?? null, shot };
      if (sel) {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: "attached", timeout: 5000 });
        const y0 = await page.evaluate(() => scrollY);
        let box = await loc.boundingBox();
        const inView = box && box.y >= 0 && box.y + box.height <= vp.height;
        if (!inView) {
          res.scrolls++;
          await loc.scrollIntoViewIfNeeded();
          box = await loc.boundingBox();
        }
        res.scrollPx += Math.abs((await page.evaluate(() => scrollY)) - y0);
        if (box) {
          const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          if (prev) res.transitPx += Math.round(Math.hypot(c.x - prev.x, c.y - prev.y));
          prev = c;
        }
      }
      const kind = await runStep(page, step);
      if (kind === "click") res.clicks++;
      if (kind === "fill") res.fills++;
      if (kind === "press") res.presses++;
      await settle(page, 350);
      res.steps.push(entry);
      k++;
    }
    const endShot = path.join(outDir, `${base}.task-${slug(task.id)}.step-${k}.end.png`);
    await shoot(page, endShot);
    res.endShot = endShot;
    if (task.expect) res.success = await page.locator(task.expect).first().isVisible().catch(() => false);
  } catch (error) {
    res.error = String(error.message || error).split("\n")[0];
  }
  return res;
}

// ---------- правила: ворота (провал) и сигналы (смотреть глазами) ----------
function judge(data, screen, vp) {
  const mobile = vp.width <= 600;
  const gates = [];
  const signals = [];
  const fold = data.marks.filter((m) => m.inFold);

  if (data.doc.overflowX > 0) gates.push({ id: "G-OVERFLOW", detail: `горизонтальный вылет ${data.doc.overflowX}px` });

  const p = data.primary;
  if (screen.primary) {
    if (!p?.found) gates.push({ id: "G-PRIMARY-MISSING", detail: `главное действие ${screen.primary} не найдено или скрыто` });
    else {
      if (!p.inFold) gates.push({ id: "G-PRIMARY-FOLD", detail: `главное действие (метка ${p.mark}) не в первом экране: y=${p.y}, экран ${vp.height}` });
      if (mobile && p.inFold && p.centerYRatio < 0.2 && p.pinned !== "fixed")
        gates.push({ id: "G-PRIMARY-REACH", detail: `главное действие в верхней полосе экрана (центр на ${Math.round(p.centerYRatio * 100)}% высоты), до него тянуться` });
      if (Math.min(p.w, p.h) < 44) gates.push({ id: "G-PRIMARY-SIZE", detail: `главное действие ${p.w}x${p.h}, меньше 44px` });
      if (p.covered && p.covered.ratio >= 0.3)
        gates.push({ id: "G-PRIMARY-COVERED", detail: `главное действие перекрыто на ${Math.round(p.covered.ratio * 100)}%: ${p.covered.by}` });
      // Главное действие тихое, а рядом кричит другое: глаз и палец уйдут туда.
      const pm = data.marks.find((m) => m.n === p.mark);
      const louder = data.marks.filter((m) => m.inFold && !m.inNav && m.n !== p.mark && (m.emphasis === "accent" || m.emphasis === "contrast"));
      if (pm && pm.emphasis !== "accent" && pm.emphasis !== "contrast" && louder.length)
        signals.push({ id: "S-PRIMARY-OUTSHOUTED", detail: `главное действие (метка ${p.mark}) выделено слабее, чем ${louder.map((m) => `${m.n} «${m.name}»`).slice(0, 5).join("; ")}` });
    }
  }

  // Под нижней панелью в начале страницы цель уедет при прокрутке, это норма. Ошибка — когда
  // цель остаётся под панелью и в самом низу страницы: дальше прокрутить уже нельзя.
  const stuck = (data.bottom || []).filter((m) => !m.pinned && m.covered && m.covered.ratio >= 0.3);
  if (stuck.length)
    gates.push({ id: "G-BOTTOM-COVERED", detail: `в самом низу страницы цели остаются под панелью: ${stuck.map((m) => `«${m.name}» на ${Math.round(m.covered.ratio * 100)}% (${m.covered.by})`).slice(0, 6).join("; ")}` });

  const sized = data.marks.filter((m) => !m.inlineText && !m.disabled);
  const tiny = sized.filter((m) => Math.min(m.w, m.h) < 24);
  const small = sized.filter((m) => Math.min(m.w, m.h) >= 24 && Math.min(m.w, m.h) < 44);
  if (tiny.length) gates.push({ id: "G-TARGET-24", detail: `цели меньше 24px: ${tiny.map((m) => `${m.n} «${m.name}» ${m.w}x${m.h}`).slice(0, 12).join("; ")}` });
  if (small.length) signals.push({ id: "S-TARGET-44", detail: `цели меньше 44px: ${small.map((m) => `${m.n} ${m.w}x${m.h}`).slice(0, 15).join("; ")}` });

  // Зазор между соседними целями: меньше 8px — риск промаха пальцем.
  const tight = [];
  for (let i = 0; i < sized.length; i++) {
    for (let j = i + 1; j < sized.length; j++) {
      const a = sized[i];
      const b = sized[j];
      if (!!a.pinned !== !!b.pinned) continue;
      const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
      const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
      const overlap = dx === 0 && dy === 0;
      if (overlap) continue;
      const gap = Math.hypot(dx, dy);
      if (gap < 8) tight.push(`${a.n}↔${b.n} ${gap.toFixed(0)}px`);
    }
  }
  if (tight.length) signals.push({ id: "S-TIGHT-GAP", detail: `соседние цели ближе 8px: ${tight.slice(0, 15).join("; ")}` });

  const loud = fold.filter((m) => !m.inNav && (m.emphasis === "accent" || m.emphasis === "contrast"));
  if (loud.length > 1)
    signals.push({ id: "S-COMPETING-PRIMARY", detail: `в первом экране ${loud.length} заметно выделенных действий: ${loud.map((m) => `${m.n} «${m.name}»`).slice(0, 8).join("; ")}` });

  const choices = fold.filter((m) => !m.inNav && !m.pinned).length;
  if (choices > 7) signals.push({ id: "S-CHOICES", detail: `в первом экране ${choices} действий вне навигации; проверь, разбиты ли они на группы` });

  for (const i of data.inputs) {
    if (!i.hasLabel && i.placeholder) signals.push({ id: "S-PLACEHOLDER-LABEL", detail: `поле (метка ${i.mark}) подписано только плейсхолдером «${i.placeholder}»` });
    if (i.looksEmail && i.type !== "email" && i.inputmode !== "email") signals.push({ id: "S-INPUT-KEYBOARD", detail: `поле почты (метка ${i.mark}) без type=email / inputmode=email` });
    if (i.looksPhone && i.type !== "tel" && i.inputmode !== "tel") signals.push({ id: "S-INPUT-KEYBOARD", detail: `поле телефона (метка ${i.mark}) без type=tel / inputmode=tel` });
  }

  if (data.focus?.backwardJumps?.length)
    signals.push({ id: "S-FOCUS-ORDER", detail: `Tab прыгает назад ${data.focus.backwardJumps.length} раз: ${data.focus.backwardJumps.slice(0, 6).map((b) => `${b.from}→${b.to}`).join(", ")}` });

  for (const t of data.tasks || []) {
    if (t.error) gates.push({ id: "G-TASK-BROKEN", detail: `задача ${t.id}: ${t.error}` });
    else if (t.success === false) gates.push({ id: "G-TASK-NOT-DONE", detail: `задача ${t.id}: после пути нет ожидаемого состояния` });
    if (t.scrolls > 0) signals.push({ id: "S-TASK-SCROLL", detail: `задача ${t.id}: прокруток до следующего шага ${t.scrolls}, ${t.scrollPx}px` });
  }
  return { gates, signals };
}

// Осознанные исключения экрана ({"G-PRIMARY-REACH": "причина"}): поиск сверху на экране поиска —
// конвенция, а не трение. Ворота с причиной уходят из провала в отдельный список и видны в отчёте.
function acceptGates(verdict, accept) {
  verdict.accepted = [];
  if (!accept) return;
  verdict.gates = verdict.gates.filter((g) => {
    if (!accept[g.id]) return true;
    verdict.accepted.push({ ...g, reason: accept[g.id] });
    return false;
  });
}

// Одинаковые закреплённые элементы и элементы шапки должны стоять на одном месте на всех экранах.
function crossScreen(results, vp) {
  const drift = [];
  const byKey = new Map();
  for (const r of results) {
    if (!r.data) continue;
    const seen = new Map();
    for (const m of r.data.marks) {
      if (!(m.pinned || m.y < vp.height * 0.15)) continue;
      if (!m.name) continue;
      const key = `${m.role}|${m.name.toLowerCase()}`;
      seen.set(key, seen.has(key) ? null : m);
    }
    for (const [key, m] of seen) {
      if (!m) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ screen: r.screen, m });
    }
    for (const [name, a] of Object.entries(r.data.anchors || {})) {
      if (!a?.found) continue;
      const key = `anchor|${name}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ screen: r.screen, m: a });
    }
  }
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const ref = list[0].m;
    for (const { screen, m } of list.slice(1)) {
      const d = Math.max(Math.abs(m.x - ref.x), Math.abs(m.y - ref.y), Math.abs(m.w - ref.w), Math.abs(m.h - ref.h));
      if (d > 4) drift.push({ key, from: list[0].screen, to: screen, delta: d });
    }
  }
  return drift;
}

// ---------- главный проход ----------
async function main() {
  const args = readArgs(process.argv.slice(2));
  let cfg = { screens: [] };
  let baseDir = process.cwd();
  if (args.config) {
    const file = path.resolve(args.config);
    cfg = JSON.parse(fs.readFileSync(file, "utf8"));
    baseDir = path.dirname(file);
  }
  for (const u of args.urls) cfg.screens.push({ name: slug(u), url: u });
  if (!cfg.screens?.length) fail(usage);
  const viewports = parseViewports(args.viewports || (cfg.viewports || ["390x844", "320x568", "1440x900"]).join(","));
  const outDir = path.resolve(args.out || cfg.out || "ux-probe-out");
  fs.mkdirSync(outDir, { recursive: true });
  const run = {
    wait: Number.isFinite(args.wait) ? args.wait : cfg.wait ?? 600,
    waitFor: args.waitFor || cfg.waitFor,
    baseDir,
  };

  const pw = loadPlaywright();
  const chrome = findChrome();
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
  } catch (error) {
    if (!chrome) throw error;
    browser = await pw.chromium.launch({ headless: true, executablePath: chrome });
  }

  const report = { createdAt: new Date().toISOString(), outDir, viewports, screens: [] };
  try {
    for (const vp of viewports) {
      const mobile = vp.width <= 600;
      const context = await browser.newContext({
        viewport: vp,
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "reduce",
        storageState: args.storage || cfg.storage || undefined,
      });
      const perVp = [];
      for (const screen of cfg.screens) {
        const base = `${slug(screen.name)}@${vp.width}x${vp.height}`;
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message || e).split("\n")[0]));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 200));
        });
        const entry = { screen: screen.name, url: screen.url, viewport: `${vp.width}x${vp.height}`, files: {} };
        try {
          await openScreen(page, screen, run);
          const targets = {};
          for (const t of screen.tasks || []) {
            if (t.target) targets[t.id] = t.target;
            // Запасные цели тоже получают номер: мартышка отвечает меткой, а не селектором.
            (t.alt || []).forEach((sel, i) => (targets[`${t.id}#alt${i}`] = sel));
          }
          const data = await page.evaluate(collectProbe, { primary: screen.primary, targets, anchors: { ...(cfg.anchors || {}), ...(screen.anchors || {}) } });

          entry.files.clean = await shoot(page, path.join(outDir, `${base}.clean.png`));
          const blur = Number.isFinite(args.blur) ? args.blur : mobile ? 6 : 10;
          // «Прищур»: текст не читается, видно только, что тянет взгляд.
          await page.evaluate((px) => {
            document.documentElement.style.filter = `blur(${px}px)`;
          }, blur);
          entry.files.squint = await shoot(page, path.join(outDir, `${base}.squint.png`));
          await page.evaluate(() => {
            document.documentElement.style.filter = "";
          });
          await page.evaluate(drawOverlay, { ruler: true, onlyViewport: true });
          entry.files.marks = await shoot(page, path.join(outDir, `${base}.marks.png`));
          if (args.full || cfg.full) {
            await page.evaluate(clearOverlay);
            entry.files.fullClean = await shoot(page, path.join(outDir, `${base}.full.clean.png`), { full: true });
            await page.evaluate(drawOverlay, { ruler: false });
            entry.files.fullMarks = await shoot(page, path.join(outDir, `${base}.full.marks.png`), { full: true });
          }
          await page.evaluate(clearOverlay);

          if (!(args.noFocus || cfg.noFocus)) data.focus = await focusWalk(page, Math.min(80, data.marks.length + 5));

          // Низ страницы: последняя карточка и её кнопки не должны прятаться под фиксированной панелью.
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(150);
          const atBottom = await page.evaluate(collectProbe, {});
          data.bottom = atBottom.marks
            .filter((m) => m.covered)
            .map(({ n, name, role, pinned, covered }) => ({ n, name, role, pinned, covered }));
          await page.evaluate(() => window.scrollTo(0, 0));

          data.tasks = [];
          for (const task of screen.tasks || []) {
            if (!task.path?.length) continue;
            const tp = await context.newPage();
            data.tasks.push(await walkTask(tp, screen, task, run, vp, outDir, base));
            await tp.close();
          }
          entry.data = data;
          entry.taskTargets = Object.fromEntries(
            (screen.tasks || []).map((t) => [
              t.id,
              {
                mark: data.targets[t.id]?.mark ?? null,
                inFold: data.targets[t.id]?.inFold ?? null,
                alt: (t.alt || []).map((sel, i) => ({ selector: sel, mark: data.targets[`${t.id}#alt${i}`]?.mark ?? null })),
              },
            ]),
          );
          entry.verdict = judge(data, screen, vp);
          acceptGates(entry.verdict, screen.accept);
        } catch (error) {
          entry.error = String(error.message || error).split("\n")[0];
        }
        entry.consoleErrors = errors.slice(0, 20);
        await page.close();
        perVp.push(entry);
        report.screens.push(entry);
      }
      const drift = crossScreen(perVp, vp);
      for (const d of drift) {
        const target = perVp.find((e) => e.screen === d.to);
        target?.verdict?.signals.push({ id: "S-SPATIAL-DRIFT", detail: `«${d.key}» сдвинулся на ${d.delta}px относительно экрана ${d.from}` });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, "probe.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "summary.md"), summarize(report));
  console.log(summarize(report));
  const failed = report.screens.some((s) => s.error || s.verdict?.gates.length);
  process.exitCode = failed ? 1 : 0;
}

function summarize(report) {
  const lines = ["# ux-probe", "", `Папка: ${report.outDir}`, ""];
  for (const s of report.screens) {
    lines.push(`## ${s.screen} @ ${s.viewport}`);
    if (s.error) {
      lines.push(`ОШИБКА: ${s.error}`, "");
      continue;
    }
    const d = s.data;
    const p = d.primary;
    lines.push(
      `- Экран: ${d.doc.screens} высоты вьюпорта, целей ${d.marks.length}, в первом экране ${d.marks.filter((m) => m.inFold).length}`,
      `- Главное действие: ${p ? (p.found ? `метка ${p.mark} «${p.name}», ${p.w}x${p.h}, в первом экране: ${p.inFold ? "да" : "НЕТ"}, центр на ${Math.round(p.centerYRatio * 100)}% высоты${p.covered ? `, перекрыто на ${Math.round(p.covered.ratio * 100)}% (${p.covered.by})` : ""}` : "НЕ НАЙДЕНО") : "не задано"}`,
    );
    const tt = Object.entries(s.taskTargets || {});
    if (tt.length)
      lines.push(
        `- Цели задач (эталон для первого клика): ${tt
          .map(([id, t]) => `${id} → ${t.mark ?? "нет метки"}${t.inFold === false ? " (ниже сгиба)" : ""}${t.alt.length ? `, запасные ${t.alt.map((a) => a.mark ?? `${a.selector} без метки`).join("/")}` : ""}`)
          .join("; ")}`,
      );
    for (const t of d.tasks || []) {
      lines.push(`- Путь «${t.id}»: нажатий ${t.clicks}, ввода ${t.fills}, прокруток ${t.scrolls} (${t.scrollPx}px), перенос пальца ${t.transitPx}px, итог: ${t.error ? `ошибка ${t.error}` : t.success === null ? "не проверялся" : t.success ? "дошёл" : "НЕ ДОШЁЛ"}`);
    }
    if (d.headings.length) lines.push(`- Каркас: ${d.headings.map((h) => `${h.inFold ? "" : "↓"}h${h.level} «${h.text}»`).slice(0, 12).join(" · ")}`);
    for (const g of s.verdict.gates) lines.push(`- ✗ ${g.id}: ${g.detail}`);
    for (const g of s.verdict.accepted || []) lines.push(`- ✓ принято (${g.reason}) ${g.id}: ${g.detail}`);
    for (const g of s.verdict.signals) lines.push(`- △ ${g.id}: ${g.detail}`);
    if (s.consoleErrors.length) lines.push(`- Ошибки консоли: ${s.consoleErrors.length}`);
    lines.push(`- Снимки: ${Object.values(s.files).map((f) => path.basename(f)).join(", ")}`, "");
  }
  return lines.join("\n");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});

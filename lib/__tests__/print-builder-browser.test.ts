import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// The print builder in a real browser. On /leaflet-printing: the corrections
// it makes as choices change (Gloss forces 130gsm, Cross fold removes DL,
// folded business cards force 350gsm uncoated), its notes and summary, and its
// place on a phone. In the quote form: the same builder, starting on the
// choice "Get this printed" sent (a flyer, a folded leaflet and a business
// card) or on the defaults (straight to /quote, or an invalid link), the
// summary bar at the top following it as it changes, its Change link bringing
// the builder into view and focusing it (on /quote and in the Get a Quote
// panel), and what the form would send. Nothing is sent: the form is never
// submitted and every request off the test server is blocked (Web3Forms and
// the CRM included).
//
// Needs a production build of the site running locally and Playwright:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// Skipped otherwise, like the database tests.

const BASE = process.env.QUOTE_FORM_TEST_URL ?? "";
// Playwright is not a dependency of the site, so only what is used here is typed.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Browser = { newContext(options: object): Promise<any>; close(): Promise<void> };
type Playwright = { chromium: { launch(): Promise<Browser> } };
let playwright: Playwright | null = null;
try {
  if (BASE) playwright = createRequire(join(process.cwd(), "package.json"))("playwright") as Playwright;
} catch {
  playwright = null;
}
const local = (() => {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(BASE).hostname);
  } catch {
    return false;
  }
})();
const skip = !BASE || !local ? "set QUOTE_FORM_TEST_URL to a local production build to run" : !playwright ? "Playwright is not available" : false;

let browser: Browser;
before(async () => {
  if (skip) return;
  browser = await playwright!.chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
});

async function open(path: string, width = 1440, height = 900) {
  const phone = width < 640;
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: phone, isMobile: phone });
  const offServer: string[] = [];
  await ctx.route("**/*", (route: any) => {
    const req = route.request();
    if (req.url().startsWith(BASE) && req.method() === "GET") return route.continue();
    offServer.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  return { ctx, page, offServer, errors };
}

// The builder's groups as shown: each legend with its pills, the pressed one marked.
const builderState = (page: any) =>
  page.locator("#paper-and-finish").evaluate((s: Element) => {
    const card = [...s.querySelectorAll("h3")].find((h) => h.textContent === "Build your print")!.parentElement!;
    const groups = [...card.querySelectorAll("fieldset")].map((f) => ({
      legend: f.querySelector("legend")!.textContent,
      pills: [...f.querySelectorAll("button")].map((b) => (b.getAttribute("aria-pressed") === "true" ? `[${b.textContent}]` : b.textContent)),
    }));
    const note = card.querySelector(".bg-\\[\\#eff6ff\\]")?.textContent ?? null;
    const summary = card.querySelector("strong")!.textContent;
    const href = card.querySelector("a")!.getAttribute("href");
    return { groups, note, summary, href };
  });
const pill = (page: any, legend: string, label: string) =>
  page.locator("#paper-and-finish fieldset", { has: page.locator("legend", { hasText: new RegExp(`^${legend}$`) }) }).getByRole("button", { name: label, exact: true });

test("the builder corrects choices: Gloss forces 130gsm, Cross fold removes DL, folded business cards force 350gsm uncoated", { skip }, async () => {
  const o = await open("/leaflet-printing");
  try {
    let st = await builderState(o.page);
    assert.deepEqual(st.groups.map((g: any) => g.legend), ["Product", "Size", "Sides", "Paper type", "Paper weight"]);
    assert.equal(st.summary, "A5 flyers, double-sided, 250gsm silk");
    assert.equal(st.note, null);
    // Gloss: only 130gsm, chosen.
    await pill(o.page, "Paper type", "Gloss").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups.at(-1).pills, ["[130gsm]"]);
    assert.equal(st.summary, "A5 flyers, double-sided, 130gsm gloss");
    // Back to silk: 250gsm (recommended) again.
    await pill(o.page, "Paper type", "Silk").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups.at(-1).pills, ["115gsm", "150gsm", "170gsm", "[250gsm (recommended)]", "350gsm", "450gsm"]);
    // 450gsm silk, then folded: 350gsm, C-fold, no sides choice, and the folded note.
    await pill(o.page, "Paper weight", "450gsm").click();
    await pill(o.page, "Product", "Folded leaflets").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups.map((g: any) => g.legend), ["Product", "Fold", "Size", "Paper type", "Paper weight"]);
    assert.deepEqual(st.groups[1].pills, ["Half fold", "[C-fold]", "Z-fold", "Cross fold"]);
    assert.equal(st.summary, "A5 C-fold leaflets, double-sided, 350gsm silk");
    assert.equal(st.note, "Folded leaflets are always printed double-sided, and heavier papers are creased before folding.");
    // DL, then Cross fold: DL is gone and A5 is chosen.
    await pill(o.page, "Size", "DL").click();
    assert.deepEqual((await builderState(o.page)).groups[2].pills, ["A6", "A5", "A4", "[DL]"]);
    await pill(o.page, "Fold", "Cross fold").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups[2].pills, ["A6", "[A5]", "A4"]);
    assert.equal(st.summary, "A5 cross fold leaflets, double-sided, 350gsm silk");
    // Business cards: Standard, 450gsm silk; Folded forces 350gsm uncoated, the only paper.
    await pill(o.page, "Product", "Business cards").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups.map((g: any) => [g.legend, g.pills]), [
      ["Product", ["Flyers and leaflets", "Folded leaflets", "[Business cards]", "Custom-shaped flyers"]],
      ["Card type", ["[Standard]", "Folded"]],
      ["Paper", ["[450gsm silk]", "350gsm uncoated"]],
    ]);
    assert.equal(st.note, "Business cards are the standard 85 x 55mm size.");
    await pill(o.page, "Card type", "Folded").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups[2].pills, ["[350gsm uncoated]"]);
    assert.equal(st.summary, "Folded business cards, 85 x 55mm, 350gsm uncoated");
    // Custom shapes: sides and the four papers, and their note.
    await pill(o.page, "Product", "Custom-shaped flyers").click();
    st = await builderState(o.page);
    assert.deepEqual(st.groups.map((g: any) => [g.legend, g.pills]).slice(1), [
      ["Sides", ["[Double-sided]", "Single-sided"]],
      ["Paper", ["[250gsm silk]", "350gsm silk", "250gsm uncoated", "350gsm uncoated"]],
    ]);
    assert.equal(st.note, "Cut to any shape you like. We will confirm the size with you on the call.");
    // The pills: at least 44px tall, 12px corners, navy when chosen.
    const look = await pill(o.page, "Sides", "Double-sided").evaluate((b: Element) => {
      const cs = getComputedStyle(b);
      return { h: b.getBoundingClientRect().height, r: cs.borderTopLeftRadius, bg: cs.backgroundColor, color: cs.color };
    });
    assert.ok(look.h >= 44, String(look.h));
    assert.deepEqual([look.r, look.bg, look.color], ["12px", "rgb(30, 58, 138)", "rgb(255, 255, 255)"]);
    assert.deepEqual(o.errors, []);
  } finally {
    await o.ctx.close();
  }
});

test("on a phone the builder comes after the text and the photo, with nothing wider than the screen", { skip }, async () => {
  const o = await open("/leaflet-printing", 390, 844);
  try {
    const at = await o.page.locator("#paper-and-finish").evaluate((s: Element) => {
      const photo = s.querySelector("img")!.getBoundingClientRect();
      const card = [...s.querySelectorAll("h3")].find((h) => h.textContent === "Build your print")!.parentElement!.getBoundingClientRect();
      return { photoBottom: photo.bottom, cardTop: card.top, cardRight: card.right, photoHeight: Math.round(photo.height) };
    });
    assert.ok(at.cardTop > at.photoBottom, JSON.stringify(at));
    assert.equal(at.photoHeight, 180);
    assert.ok(at.cardRight <= 390 - 24 + 0.5, JSON.stringify(at));
    assert.equal(await o.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  } finally {
    await o.ctx.close();
  }
});

// The quote form's print builder, the summary bar and what the form would send.
const formBuilder = (root: any) => root.locator('[role="group"]', { has: root.page().locator("h4", { hasText: /^Your print$/ }) });
const formPill = (root: any, legend: string, label: string) =>
  formBuilder(root).locator("fieldset", { has: root.page().locator("legend", { hasText: new RegExp(`^${legend}$`) }) }).getByRole("button", { name: label, exact: true });
async function formState(root: any) {
  return root.evaluate((r: Element) => {
    const heading = [...r.querySelectorAll("h4")].find((h) => h.textContent?.trim() === "Your print");
    const builder = heading?.closest('[role="group"]');
    const bar = [...r.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Your print: "));
    const form = r.querySelector("form");
    return {
      bar: bar ? bar.textContent : null,
      change: bar ? (bar.parentElement!.querySelector("a")?.textContent?.trim() ?? null) : null,
      pressed: builder ? [...builder.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent) : null,
      choice: builder ? builder.querySelector("strong")!.textContent : null,
      sent: form ? [...new FormData(form).entries()].filter(([k]) => /^print-(spec|item|size|sides|fold|paper)$/.test(k)).map(([k, v]) => `${k}=${v}`) : [],
      old: ["#print-size", 'input[name="print-items"]'].filter((sel) => r.querySelector(sel)).concat(
        [...r.querySelectorAll("p, legend")].some((e) => /^Paper: we recommend|What would you like printed|Your chosen spec/.test(e.textContent ?? "")) ? ["old text"] : []
      ),
    };
  });
}
// The questions show once the contact number has enough digits.
async function showQuestions(root: any) {
  await root.locator("#phone").fill("07700 900123");
  await formBuilder(root).waitFor();
}

test("(a) \"Get this printed\" opens the form on that exact choice: a flyer, a folded leaflet and a business card", { skip }, async () => {
  const cases = [
    {
      name: "flyer",
      choose: [["Size", "A4"], ["Sides", "Single-sided"], ["Paper type", "Uncoated"], ["Paper weight", "170gsm"]],
      href: "/quote?service=printing&item=flyers&size=A4&sides=single&ptype=uncoated&weight=170",
      summary: "A4 flyers, single-sided, 170gsm uncoated",
      pressed: ["Flyers and leaflets", "A4", "Single-sided", "Uncoated", "170gsm"],
      sent: ["print-spec=A4 flyers, single-sided, 170gsm uncoated", "print-item=Flyers and leaflets", "print-size=A4", "print-sides=Single-sided", "print-paper=170gsm uncoated"],
    },
    {
      name: "folded leaflet",
      choose: [["Product", "Folded leaflets"], ["Fold", "Z-fold"], ["Size", "DL"], ["Paper type", "Gloss"]],
      href: "/quote?service=printing&item=folded&fold=z&size=DL&ptype=gloss&weight=130",
      summary: "DL Z-fold leaflets, double-sided, 130gsm gloss",
      pressed: ["Folded leaflets", "Z-fold", "DL", "Gloss", "130gsm"],
      sent: ["print-spec=DL Z-fold leaflets, double-sided, 130gsm gloss", "print-item=Folded leaflets", "print-size=DL", "print-sides=Double-sided", "print-fold=Z-fold", "print-paper=130gsm gloss"],
    },
    {
      name: "business card",
      choose: [["Product", "Business cards"], ["Card type", "Folded"]],
      href: "/quote?service=printing&item=cards&card=folded&paper=350-uncoated",
      summary: "Folded business cards, 85 x 55mm, 350gsm uncoated",
      pressed: ["Business cards", "Folded", "350gsm uncoated"],
      sent: ["print-spec=Folded business cards, 85 x 55mm, 350gsm uncoated", "print-item=Business cards", "print-size=85 x 55mm", "print-fold=Folded", "print-paper=350gsm uncoated"],
    },
  ];
  for (const c of cases) {
    const o = await open("/leaflet-printing");
    try {
      for (const [legend, label] of c.choose) await pill(o.page, legend, label).click();
      assert.equal((await builderState(o.page)).summary, c.summary, c.name);
      await o.page.getByRole("link", { name: "Get this printed" }).click();
      await o.page.waitForURL((u: URL) => u.pathname === "/quote");
      await o.page.waitForLoadState("networkidle");
      assert.equal(o.page.url(), `${BASE}${c.href}`, c.name);
      const main = o.page.locator("main");
      // The bar is there at once, at the top of the card, above What do you need?; Change waits for the builder.
      let st = await formState(main);
      assert.equal(st.bar, `Your print: ${c.summary}`, c.name);
      assert.equal(st.change, null, "no Change before the builder is on the page");
      const order = await main.evaluate((m: Element) => {
        const bar = [...m.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Your print: "))!.parentElement!;
        const legend = [...m.querySelectorAll("legend")].find((l) => l.textContent?.trim() === "What do you need?")!;
        const h2 = [...m.querySelectorAll("h2")].find((h) => h.textContent === "Get Your Free Quote")!;
        return { first: bar.parentElement!.firstElementChild === bar, beforeHeading: !!(bar.compareDocumentPosition(h2) & 4), beforeLegend: !!(bar.compareDocumentPosition(legend) & 4) };
      });
      assert.deepEqual(order, { first: true, beforeHeading: true, beforeLegend: true }, c.name);
      await showQuestions(main);
      st = await formState(main);
      assert.deepEqual(st.pressed, c.pressed, c.name);
      assert.equal(st.choice, c.summary, c.name);
      assert.equal(st.change, "Change");
      assert.deepEqual(st.sent, c.sent, c.name);
      assert.deepEqual(st.old, [], "none of the old printing fields");
      assert.deepEqual(o.errors, [], c.name);
      assert.deepEqual(o.offServer.filter((r) => /web3forms|quote-lead/.test(r)), [], "nothing sent");
    } finally {
      await o.ctx.close();
    }
  }
});

test("(b) changing the print in the form updates the bar at the top and what is sent", { skip }, async () => {
  const o = await open("/quote?service=printing&item=flyers&size=A4&sides=single&ptype=uncoated&weight=170");
  try {
    const main = o.page.locator("main");
    await showQuestions(main);
    await formPill(main, "Paper type", "Gloss").click();
    let st = await formState(main);
    assert.equal(st.bar, "Your print: A4 flyers, single-sided, 130gsm gloss");
    assert.ok(st.sent.includes("print-paper=130gsm gloss") && st.sent.includes("print-spec=A4 flyers, single-sided, 130gsm gloss"), st.sent.join("; "));
    await formPill(main, "Paper type", "Silk").click();
    await formPill(main, "Paper weight", "350gsm").click();
    st = await formState(main);
    assert.equal(st.bar, "Your print: A4 flyers, single-sided, 350gsm silk");
    assert.equal(st.choice, "A4 flyers, single-sided, 350gsm silk");
    // The same corrections as on the page: cross fold drops DL; folded business cards are 350gsm uncoated.
    await formPill(main, "Product", "Folded leaflets").click();
    await formPill(main, "Size", "DL").click();
    await formPill(main, "Fold", "Cross fold").click();
    st = await formState(main);
    assert.equal(st.bar, "Your print: A5 cross fold leaflets, double-sided, 350gsm silk");
    await formPill(main, "Product", "Business cards").click();
    await formPill(main, "Card type", "Folded").click();
    st = await formState(main);
    assert.equal(st.bar, "Your print: Folded business cards, 85 x 55mm, 350gsm uncoated");
    assert.deepEqual(st.sent, ["print-spec=Folded business cards, 85 x 55mm, 350gsm uncoated", "print-item=Business cards", "print-size=85 x 55mm", "print-fold=Folded", "print-paper=350gsm uncoated"]);
    // The pills cannot send the form.
    assert.equal(o.offServer.length, 0, o.offServer.join("; "));
  } finally {
    await o.ctx.close();
  }
});

test("(c) straight to /quote and choosing Leaflet Printing starts on the defaults; an invalid link does too; other services have no builder", { skip }, async () => {
  const defaults = {
    bar: "Your print: A5 flyers, double-sided, 250gsm silk",
    pressed: ["Flyers and leaflets", "A5", "Double-sided", "Silk", "250gsm (recommended)"],
    sent: ["print-spec=A5 flyers, double-sided, 250gsm silk", "print-item=Flyers and leaflets", "print-size=A5", "print-sides=Double-sided", "print-paper=250gsm silk"],
  };
  {
    const o = await open("/quote");
    try {
      const main = o.page.locator("main");
      assert.equal((await formState(main)).bar, null, "no bar before a service is chosen");
      await main.locator("label", { has: o.page.locator('input[name="quote-service"][value="Leaflet Printing"]') }).click();
      assert.equal((await formState(main)).bar, defaults.bar);
      await showQuestions(main);
      const st = await formState(main);
      assert.deepEqual({ bar: st.bar, pressed: st.pressed, sent: st.sent }, defaults);
      // Choosing another service takes the bar away.
      await main.locator("label", { has: o.page.locator('input[name="quote-service"][value="Web Design & SEO"]') }).click();
      assert.equal((await formState(main)).bar, null);
    } finally {
      await o.ctx.close();
    }
  }
  for (const path of ["/quote?service=printing&item=posters&size=A4", "/quote?service=printing&size=A4&weight=170"]) {
    const o = await open(path);
    try {
      await showQuestions(o.page.locator("main"));
      const st = await formState(o.page.locator("main"));
      assert.deepEqual({ bar: st.bar, pressed: st.pressed, sent: st.sent }, defaults, path);
    } finally {
      await o.ctx.close();
    }
  }
  // A valid item with invalid choices: each ignored.
  {
    const o = await open("/quote?service=printing&item=folded&fold=cross&size=DL&ptype=matt&weight=999");
    try {
      await showQuestions(o.page.locator("main"));
      const st = await formState(o.page.locator("main"));
      assert.equal(st.bar, "Your print: A5 cross fold leaflets, double-sided, 250gsm silk");
      assert.deepEqual(st.pressed, ["Folded leaflets", "Cross fold", "A5", "Silk", "250gsm (recommended)"]);
    } finally {
      await o.ctx.close();
    }
  }
  // Another service ignores the print parameters.
  {
    const o = await open("/quote?service=leaflet&item=flyers&size=A4");
    try {
      await o.page.locator("main #phone").fill("07700 900123");
      const st = await formState(o.page.locator("main"));
      assert.deepEqual([st.bar, st.pressed, st.sent], [null, null, []]);
    } finally {
      await o.ctx.close();
    }
  }
});

test("(d) Change brings the builder into view below the header and focuses it, on /quote and in the Get a Quote panel", { skip }, async () => {
  for (const [width, height] of [[1440, 900], [390, 664]]) {
    const o = await open("/quote?service=printing&item=flyers&size=A4&sides=single&ptype=uncoated&weight=170", width, height);
    try {
      const main = o.page.locator("main");
      await showQuestions(main);
      // Go down the form, choose a quantity, then come back up to the bar.
      await main.locator("#print-quantity").selectOption("Not sure yet");
      await main.locator("#print-send-to").scrollIntoViewIfNeeded();
      await main.getByRole("link", { name: "Change your print" }).scrollIntoViewIfNeeded();
      await main.getByRole("link", { name: "Change your print" }).click();
      await o.page.waitForTimeout(900);
      const at = await o.page.evaluate(() => {
        const heading = [...document.querySelectorAll("main h4")].find((h) => h.textContent?.trim() === "Your print")!;
        const builder = heading.closest('[role="group"]') as HTMLElement;
        const header = document.querySelector("header")!.getBoundingClientRect().bottom;
        return { top: builder.getBoundingClientRect().top, header, focused: document.activeElement === builder, inView: builder.getBoundingClientRect().top < innerHeight, url: location.hash };
      });
      assert.ok(at.focused, `${width}: the builder is focused`);
      assert.ok(at.top >= at.header - 1 && at.inView, `${width}: its top (${Math.round(at.top)}) is below the header (${Math.round(at.header)}) and on screen`);
      assert.equal(at.url, "", "the address is left as it was");
      // Tab from there goes to its first pill.
      await o.page.keyboard.press("Tab");
      assert.equal(await o.page.evaluate(() => document.activeElement?.textContent), "Flyers and leaflets");
    } finally {
      await o.ctx.close();
    }
  }
  // The Get a Quote panel on another page: the same builder, starting on the defaults, and Change scrolls the panel.
  const o = await open("/services");
  try {
    await o.page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    const launcher = o.page.locator("div.fixed.bottom-6.right-6 button", { hasText: "Get a Quote" });
    await launcher.waitFor({ state: "visible" });
    await launcher.click();
    const panel = o.page.locator("div.fixed.bottom-6.right-6");
    await panel.locator("label", { has: o.page.locator('input[name="quote-service"][value="Leaflet Printing"]') }).click();
    await showQuestions(panel);
    const st = await formState(panel);
    assert.equal(st.bar, "Your print: A5 flyers, double-sided, 250gsm silk");
    await panel.locator("#print-quantity").selectOption("Not sure yet");
    await panel.locator("#print-message").scrollIntoViewIfNeeded();
    await panel.getByRole("link", { name: "Change your print" }).scrollIntoViewIfNeeded();
    await panel.getByRole("link", { name: "Change your print" }).click();
    await o.page.waitForTimeout(900);
    const at = await panel.evaluate((p: Element) => {
      const builder = [...p.querySelectorAll("h4")].find((h) => h.textContent?.trim() === "Your print")!.closest('[role="group"]') as HTMLElement;
      const area = p.querySelector(".overflow-y-auto")!.getBoundingClientRect();
      const b = builder.getBoundingClientRect();
      return { focused: document.activeElement === builder, top: b.top, areaTop: area.top, areaBottom: area.bottom };
    });
    assert.ok(at.focused && at.top >= at.areaTop - 1 && at.top < at.areaBottom, JSON.stringify(at));
    assert.deepEqual(o.offServer.filter((r) => /web3forms|quote-lead/.test(r)), []);
  } finally {
    await o.ctx.close();
  }
});

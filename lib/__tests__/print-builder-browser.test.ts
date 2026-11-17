import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// The print builder on /leaflet-printing in a real browser: the corrections it
// makes as choices change (Gloss forces 130gsm, Cross fold removes DL, folded
// business cards force 350gsm uncoated), its notes and summary, its place on
// a phone, and "Get this printed" pre-filling the quote form for a flyer, a
// folded leaflet and a business card. Also the form with no spec, or an
// invalid one. Nothing is sent: the form is never submitted and every request
// off the test server is blocked (Web3Forms and the CRM included).
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

// The form after following a link: the contact number typed so the questions show, then a quantity chosen.
async function printQuestions(o: Awaited<ReturnType<typeof open>>) {
  const main = o.page.locator("main");
  await main.locator("#phone").fill("07700 900123");
  await main.locator("#print-quantity").waitFor();
  const before = await main.evaluate((m: Element) => ({
    ticked: [...m.querySelectorAll("fieldset label")].filter((l) => l.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked).map((l) => l.textContent!.trim()),
    box: (() => {
      const p = [...m.querySelectorAll("p")].find((x) => x.textContent === "Your chosen spec");
      return p ? (p.closest("div.rounded-md") as HTMLElement).innerText.replace(/\s+/g, " ").trim() : null;
    })(),
    change: m.querySelector('a[href="/leaflet-printing#paper-and-finish"]')?.textContent?.trim() ?? null,
    spec: m.querySelector<HTMLInputElement>('input[name="print-spec"]')?.value ?? null,
  }));
  await main.locator("#print-quantity").selectOption("1,000 to 2,500");
  const afterQuantity = await main.evaluate((m: Element) => ({
    size: m.querySelector<HTMLSelectElement>("#print-size")!.value,
    sides: m.querySelector<HTMLInputElement>('input[name="print-sides"]:checked')!.value,
    paperNote: [...m.querySelectorAll("p")].some((p) => p.textContent?.startsWith("Paper: we recommend 250gsm silk")),
    sent: [...new FormData(m.querySelector("form")!).entries()].filter(([k]) => k.startsWith("print-")).map(([k, v]) => `${k}=${v}`),
  }));
  return { ...before, ...afterQuantity };
}

test("\"Get this printed\" pre-fills the quote form: a flyer, a folded leaflet and a business card", { skip }, async () => {
  const cases = [
    {
      name: "flyer",
      choose: [["Size", "A4"], ["Sides", "Single-sided"], ["Paper type", "Uncoated"], ["Paper weight", "170gsm"]],
      href: "/quote?service=printing&item=flyers&size=A4&sides=single&ptype=uncoated&weight=170",
      summary: "A4 flyers, single-sided, 170gsm uncoated",
      ticked: ["Flyers and leaflets"],
      size: "A4",
      sides: "Single sided",
    },
    {
      name: "folded leaflet",
      choose: [["Product", "Folded leaflets"], ["Fold", "Z-fold"], ["Size", "DL"], ["Paper type", "Gloss"]],
      href: "/quote?service=printing&item=folded&fold=z&size=DL&ptype=gloss&weight=130",
      summary: "DL Z-fold leaflets, double-sided, 130gsm gloss",
      ticked: ["Folded leaflets"],
      size: "DL",
      sides: "Double sided",
    },
    {
      name: "business card",
      choose: [["Product", "Business cards"], ["Card type", "Folded"]],
      href: "/quote?service=printing&item=cards&card=folded&paper=350-uncoated",
      summary: "Folded business cards, 85 x 55mm, 350gsm uncoated",
      ticked: ["Business cards"],
      size: "85 x 55mm",
      sides: "Double sided",
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
      const f = await printQuestions(o);
      assert.deepEqual(f.ticked, c.ticked, c.name);
      assert.equal(f.box, `Your chosen spec Change ${c.summary}`, c.name);
      assert.equal(f.change, "Change");
      assert.equal(f.spec, c.summary);
      assert.equal(f.size, c.size, c.name);
      assert.equal(f.sides, c.sides, c.name);
      assert.equal(f.paperNote, false, c.name);
      assert.deepEqual(f.sent.slice(0, 2), [`print-spec=${c.summary}`, `print-items=${c.ticked.join(", ")}`], c.name);
      assert.deepEqual(o.errors, [], c.name);
      assert.deepEqual(o.offServer.filter((r) => /web3forms|quote-lead/.test(r)), [], "nothing sent");
    } finally {
      await o.ctx.close();
    }
  }
});

test("without a spec the form is as before, and an invalid one is ignored", { skip }, async () => {
  // No spec: no box, the paper note, Flyers and leaflets ticked, A5 and double-sided, no print-spec.
  for (const path of ["/quote?service=printing", "/quote?service=printing&item=posters&size=A4", "/quote?service=leaflet&item=flyers&size=A4"]) {
    const o = await open(path);
    try {
      if (path.includes("service=leaflet")) {
        // Another service ignores the spec entirely.
        await o.page.locator("main #phone").fill("07700 900123");
        assert.equal(await o.page.locator('main input[name="print-spec"]').count(), 0, path);
        continue;
      }
      const f = await printQuestions(o);
      assert.deepEqual(
        { ticked: f.ticked, box: f.box, spec: f.spec, size: f.size, sides: f.sides, paperNote: f.paperNote },
        { ticked: ["Flyers and leaflets"], box: null, spec: null, size: "A5", sides: "Double sided", paperNote: true },
        path
      );
    } finally {
      await o.ctx.close();
    }
  }
  // A valid item with invalid choices: each ignored, the product's default used.
  const o = await open("/quote?service=printing&item=folded&fold=cross&size=DL&ptype=matt&weight=999");
  try {
    const f = await printQuestions(o);
    assert.equal(f.box, "Your chosen spec Change A5 cross fold leaflets, double-sided, 250gsm silk");
    assert.deepEqual(f.ticked, ["Folded leaflets"]);
    assert.equal(f.size, "A5");
  } finally {
    await o.ctx.close();
  }
});

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// The floating Get a Quote panel in a real browser, at 1440 and 390. Pages
// load neither framer-motion nor the quote form; the panel fetches the form
// the first time it is opened, with a small loading state meanwhile (and the
// quote page if it can't be fetched). The pill and panel move as before, and
// a full Leaflet Distribution enquiry sends exactly what it always did.
// Nothing is sent: the quote requests are answered here and every other
// request off the test server is blocked.
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

const SCREENS = [
  { name: "1440", width: 1440, height: 900, phone: false, panelWidth: 560 },
  { name: "390", width: 390, height: 664, phone: true, panelWidth: 358 },
];
// Text only in the quote form's code, and only in framer-motion's.
const FORM_MARK = "Get Your Free Quote";
const FRAMER_MARK = "framerAppearId";

let browser: Browser;
before(async () => {
  if (skip) return;
  browser = await playwright!.chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
});

// A page with requests under the test's control. scripts: each script fetched,
// with when (before or after the panel was opened) and its text.
async function visit(screen: (typeof SCREENS)[number], path: string) {
  const ctx = await browser.newContext({ viewport: { width: screen.width, height: screen.height }, hasTouch: screen.phone, isMobile: screen.phone });
  const control = { scriptDelayMs: 0, failScripts: false };
  const sent: { to: string; headers: Record<string, string>; body: any }[] = [];
  await ctx.route("**/*", async (route: any) => {
    const req = route.request();
    const url: string = req.url();
    if (url === "https://api.web3forms.com/submit") {
      sent.push({ to: "web3forms", headers: { "content-type": req.headers()["content-type"], accept: req.headers()["accept"] }, body: JSON.parse(req.postData()) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (url === BASE + "/api/quote-lead") {
      sent.push({ to: "quote-lead", headers: { "content-type": req.headers()["content-type"] }, body: JSON.parse(req.postData()) });
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    // Next's own prefetch of other pages for the links on screen (the quote
    // page among them, which would fetch the form's code in the background
    // once the page is idle); held back so only the panel's loading is seen.
    if (req.headers()["next-router-prefetch"]) return route.abort();
    if (!url.startsWith(BASE) || req.method() !== "GET") return route.abort();
    if (req.resourceType() === "script") {
      if (control.failScripts) return route.abort();
      if (control.scriptDelayMs) await new Promise((r) => setTimeout(r, control.scriptDelayMs));
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  let phase = "load";
  const scripts: Promise<{ phase: string; url: string; text: string }>[] = [];
  page.on("response", (res: any) => {
    if (res.request().resourceType() !== "script") return;
    const at = phase;
    scripts.push(res.text().then((text: string) => ({ phase: at, url: res.url(), text }), () => ({ phase: at, url: res.url(), text: "" })));
  });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const container = page.locator("div.fixed.bottom-6.right-6");
  const pill = container.locator("button", { hasText: "Get a Quote" });
  const region = page.getByRole("region", { name: "Get a Quote" });
  const tap = (loc: any) => (screen.phone ? loc.tap() : loc.click());
  const openPanel = async () => {
    phase = "open";
    await pill.waitFor({ state: "visible" });
    await tap(pill);
    await region.waitFor();
  };
  return { ctx, page, control, sent, scripts, container, pill, region, tap, openPanel };
}

for (const screen of SCREENS) {
  test(`${screen.name}: the homepage loads neither framer-motion nor the quote form; opening the panel fetches the form`, { skip }, async () => {
    const v = await visit(screen, "/");
    try {
      await v.page.waitForTimeout(1500);
      const onLoad = await Promise.all(v.scripts);
      assert.ok(onLoad.length > 3, "the page's own scripts were seen");
      for (const s of onLoad) {
        assert.ok(!s.text.includes(FRAMER_MARK), `framer-motion in ${s.url}`);
        assert.ok(!s.text.includes(FORM_MARK), `the quote form in ${s.url}`);
      }
      await v.page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
      await v.openPanel();
      await v.region.locator("fieldset").first().waitFor();
      const all = await Promise.all(v.scripts);
      const fetchedOnOpen = all.filter((s) => s.phase === "open");
      assert.ok(fetchedOnOpen.some((s) => s.text.includes(FORM_MARK)), "the form's code came when the panel opened");
      assert.ok(!all.some((s) => s.text.includes(FRAMER_MARK)), "framer-motion never");
      assert.equal(await v.region.getByRole("heading", { name: FORM_MARK }).count(), 1);
    } finally {
      await v.ctx.close();
    }
  });

  test(`${screen.name}: a small loading state while the form is on its way, the same size as the form, then the form`, { skip }, async () => {
    const v = await visit(screen, "/services");
    try {
      v.control.scriptDelayMs = 1500;
      await v.openPanel();
      const status = v.region.getByRole("status");
      await status.waitFor();
      assert.equal((await status.textContent())?.trim(), "Loading the quote form...");
      // It fades in only once the form has taken more than a moment.
      await v.page.waitForTimeout(700);
      assert.equal(await status.evaluate((el: Element) => getComputedStyle(el).opacity), "1");
      const loading = await v.region.boundingBox();
      assert.equal(Math.round(loading.width), screen.panelWidth);
      await v.region.locator("fieldset").first().waitFor();
      assert.equal(await status.count(), 0, "gone once the form is there");
      await v.page.waitForTimeout(600);
      const form = await v.region.boundingBox();
      assert.equal(Math.round(form.width), screen.panelWidth);
      assert.ok(Math.abs(form.height - loading.height) <= 2, `no jump: ${loading.height} then ${form.height}`);
    } finally {
      await v.ctx.close();
    }
  });
}

test("if the form can't be fetched, the panel points to the quote page, and opening it again tries again", { skip }, async () => {
  const v = await visit(SCREENS[0], "/services");
  try {
    v.control.failScripts = true;
    await v.openPanel();
    const alert = v.region.getByRole("alert");
    await alert.waitFor();
    assert.match((await alert.textContent()) ?? "", /The quote form could not be loaded\. Please check your connection, or open the quote page\./);
    assert.equal(await alert.getByRole("link", { name: "open the quote page" }).getAttribute("href"), "/quote");
    await v.region.getByRole("button", { name: "Close" }).click();
    await v.region.waitFor({ state: "detached" });
    v.control.failScripts = false;
    await v.openPanel();
    await v.region.locator("fieldset").first().waitFor();
    assert.equal(await v.region.getByRole("alert").count(), 0);
  } finally {
    await v.ctx.close();
  }
});

// The element's scale every frame, from when it is first on the page until
// ms later or until it has gone, while act runs. A plain script, so nothing
// the test runner adds to named functions reaches the page.
async function scales(page: any, selector: string, ms: number, act: () => Promise<void>): Promise<number[]> {
  await page.evaluate(`(() => {
    const w = window;
    w.__scales = [];
    w.__scalesDone = false;
    let first = null;
    const begun = performance.now();
    const step = () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const now = performance.now();
      if (el) {
        if (first === null) first = now;
        const scale = getComputedStyle(el).scale;
        w.__scales.push(scale === "none" ? 1 : parseFloat(scale));
      }
      if ((first !== null && (now - first > ${ms} || !el)) || now - begun > 5000) w.__scalesDone = true;
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })()`);
  await act();
  await page.waitForFunction(() => (window as any).__scalesDone === true);
  return page.evaluate(() => (window as any).__scales);
}

test("the pill and panel move as before: a springy grow from 30% in, the pill shrinking away, the panel springing away", { skip }, async () => {
  const v = await visit(SCREENS[0], "/services");
  try {
    // The pill's entrance, as when it comes back after the footer: from 30%,
    // overshooting a little to about 105%, then resting at 100%.
    await v.pill.waitFor({ state: "visible" });
    await v.page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await v.pill.waitFor({ state: "detached" });
    const pillIn = await scales(v.page, "div.fixed.bottom-6.right-6 > button", 700, () =>
      v.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    );
    assert.ok(pillIn.length > 10);
    assert.ok(Math.min(...pillIn) < 0.5, `starts small: ${Math.min(...pillIn)}`);
    assert.ok(Math.max(...pillIn) > 1.03 && Math.max(...pillIn) < 1.06, `overshoots a little: ${Math.max(...pillIn)}`);
    assert.equal(pillIn.at(-1), 1);

    // Hovered with a mouse, it grows to 112%; then back to 100%.
    await v.pill.hover();
    await v.page.waitForTimeout(400);
    assert.equal(await v.pill.evaluate((el: Element) => getComputedStyle(el).scale), "1.12");
    await v.page.mouse.move(10, 10);
    await v.page.waitForTimeout(600);
    assert.equal(await v.pill.evaluate((el: Element) => getComputedStyle(el).scale), "1");

    // Opening: the pill shrinks away in 200ms while the panel springs in, overshooting to about 101%.
    const panelIn = await scales(v.page, '[role="region"][aria-label="Get a Quote"]', 700, () => v.openPanel());
    assert.ok(Math.min(...panelIn) < 0.5, `panel starts small: ${Math.min(...panelIn)}`);
    assert.ok(Math.max(...panelIn) > 1.004 && Math.max(...panelIn) < 1.02, `panel overshoots slightly: ${Math.max(...panelIn)}`);
    assert.equal(panelIn.at(-1), 1);
    assert.equal(await v.pill.count(), 0, "the pill has gone");

    // Escape closes it: it springs away and is removed, and the pill comes back.
    const panelOut = await scales(v.page, '[role="region"][aria-label="Get a Quote"]', 700, () => v.page.keyboard.press("Escape"));
    assert.ok(Math.min(...panelOut) < 0.35, `panel shrinks away: ${Math.min(...panelOut)}`);
    assert.equal(await v.region.count(), 0, "removed once it has gone");
    await v.pill.waitFor({ state: "visible" });

    // A click outside closes it too.
    await v.openPanel();
    await v.page.mouse.click(200, 200);
    await v.region.waitFor({ state: "detached" });
  } finally {
    await v.ctx.close();
  }
});

test("the idle wiggle runs while the pill waits unopened, every 7 seconds, and stops for good once the panel has been opened", { skip }, async () => {
  const v = await visit(SCREENS[0], "/services");
  try {
    await v.pill.waitFor({ state: "visible" });
    const wiggle = () =>
      v.pill.locator(":scope > span").evaluate((el: Element) =>
        el.getAnimations().map((a) => {
          const t = (a.effect as KeyframeEffect).getTiming();
          return { name: (a as CSSAnimation).animationName, duration: t.duration, delay: t.delay, iterations: t.iterations };
        })
      );
    const running = await wiggle();
    assert.equal(running.length, 1);
    assert.match(running[0].name, /wiggle/);
    assert.deepEqual({ duration: running[0].duration, delay: running[0].delay, iterations: running[0].iterations }, { duration: 7000, delay: 7000, iterations: Infinity });
    await v.openPanel();
    await v.region.getByRole("button", { name: "Close" }).click();
    await v.region.waitFor({ state: "detached" });
    await v.pill.waitFor({ state: "visible" });
    assert.deepEqual(await wiggle(), [], "no more wiggling once opened");
  } finally {
    await v.ctx.close();
  }
});

// What a full Leaflet Distribution enquiry sends, as it did before the form
// was loaded on opening (the access key is the form's own, checked apart).
const EXPECTED = {
  subject: "New Quote Request - Flyer Distribution Hampshire",
  "first-name": "Quinn",
  "last-name": "Payload",
  email: "quinn@payload-test.example",
  phone: "07700 900123",
  company: "Payload Test Ltd",
  service: "Leaflet Distribution",
  "areas-required": "Ringwood BH24, Fordingbridge SP6",
  quantity: "2,500 to 5,000",
  "printing-included": "yes",
  "item-size": "A4",
  "print-sides": "Double sided",
  "include-design": "yes",
  budget: "£500 - £1,000",
  message: "Payload check, please ignore.",
  newsletter: "yes",
};

for (const screen of SCREENS) {
  test(`${screen.name}: a full Leaflet enquiry from the panel on the homepage sends exactly the same request, and the popup knows it was sent`, { skip }, async () => {
    const v = await visit(screen, "/");
    try {
      await v.page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
      await v.openPanel();
      const r = v.region;
      await v.tap(r.locator("label", { has: v.page.locator('input[value="Leaflet Distribution"]') }));
      await r.locator("#first-name").fill("Quinn");
      await r.locator("#last-name").fill("Payload");
      await r.locator("#email").fill("quinn@payload-test.example");
      await r.locator("#phone").fill("07700 900123");
      await r.locator("#company").fill("Payload Test Ltd");
      await r.locator("#areas-required").fill("Ringwood BH24, Fordingbridge SP6");
      await r.locator("#quantity").selectOption("2,500 to 5,000");
      await v.tap(r.locator('[role="group"][aria-labelledby="printing-question"] button', { hasText: "Yes" }));
      await v.tap(r.locator('[role="group"][aria-labelledby="design-question"] button', { hasText: "Yes" }));
      await r.locator("#item-size").selectOption("A4");
      await v.tap(r.locator('input[name="print-sides"][value="Double sided"]'));
      await r.locator("#budget").selectOption("£500 - £1,000");
      await r.locator("#message").fill("Payload check, please ignore.");
      await v.tap(r.locator("#newsletter"));
      const accessKey = await r.locator('input[name="access_key"]').inputValue();
      await v.tap(r.getByRole("button", { name: "Send Quote Request" }));
      await r.getByRole("heading", { name: "Request Received" }).waitFor();
      await v.page.waitForTimeout(500);
      assert.deepEqual(v.sent.map((s) => s.to), ["web3forms", "quote-lead"]);
      const expected = { access_key: accessKey, ...EXPECTED };
      for (const s of v.sent) {
        assert.deepEqual(s.body, expected, s.to);
        // In the same order, as the form sends them.
        assert.deepEqual(Object.keys(s.body), Object.keys(expected), s.to);
      }
      assert.deepEqual(v.sent[0].headers, { "content-type": "application/json", accept: "application/json" });
      assert.deepEqual(v.sent[1].headers, { "content-type": "application/json" });
      assert.equal(await v.page.evaluate(() => sessionStorage.getItem("fdh-quote-request-sent")), "1");
    } finally {
      await v.ctx.close();
    }
  });
}

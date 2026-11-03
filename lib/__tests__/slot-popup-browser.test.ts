import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// The timed popup in a real browser, with the page clock fast-forwarded so
// the 13 seconds pass at once. Each test is a fresh visit (a new browser
// context, so a new sessionStorage). It shows after 13 seconds and at most
// once per visit, whether it was closed, clicked or ignored; never on /quote;
// never after a quote request has been sent in the visit; and at most once
// per page load when sessionStorage cannot be used. Nothing is sent: quote
// requests are answered here and every other request off the test server is
// blocked.
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

const POPUP_TEXT = "Get in touch before this month";
const SECOND = 1000;

let browser: Browser;
before(async () => {
  if (skip) return;
  browser = await playwright!.chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
});

// A fresh visit with the page clock under the test's control.
async function visit(options: { noStorage?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sent: string[] = [];
  await ctx.route("**/*", (route: any) => {
    const url: string = route.request().url();
    if (url === "https://api.web3forms.com/submit") {
      sent.push("web3forms");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (url.endsWith("/api/quote-lead")) {
      sent.push("quote-lead");
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (url.startsWith(BASE) && route.request().method() === "GET") return route.continue();
    return route.abort();
  });
  if (options.noStorage) {
    // As in a browser that blocks storage: every use of sessionStorage throws.
    await ctx.addInitScript(() => {
      for (const name of ["getItem", "setItem", "removeItem"] as const) {
        Storage.prototype[name] = () => {
          throw new DOMException("Storage is disabled", "SecurityError");
        };
      }
    });
  }
  const page = await ctx.newPage();
  // The page's clock stands still until the test moves it on, so time spent
  // loading pages never counts towards the 13 seconds.
  await page.clock.install({ time: new Date("2026-11-03T10:00:00") });
  await page.clock.pauseAt(new Date("2026-11-03T10:00:01"));
  const popup = page.getByText(POPUP_TEXT);
  const wait = (ms: number) => page.clock.runFor(ms);
  // Waits in real time for the page to finish loading and start up, so the
  // popup's timer is set before the clock is moved on.
  const settle = async () => {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
  };
  const go = async (path: string) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await settle();
  };
  const close = page.locator('div.popup-panel button[aria-label="Close"]');
  return { ctx, page, popup, close, wait, go, settle, sent };
}

test("it appears after 13 seconds on a page, not before", { skip }, async () => {
  const v = await visit();
  try {
    await v.go("/services");
    await v.wait(12 * SECOND);
    assert.equal(await v.popup.isVisible(), false, "not yet at 12.5 seconds");
    await v.wait(1 * SECOND);
    assert.equal(await v.popup.isVisible(), true, "shown at 13 seconds");
  } finally {
    await v.ctx.close();
  }
});

test("once it has appeared and been ignored, no other page in the visit shows it", { skip }, async () => {
  const v = await visit();
  try {
    await v.go("/services");
    await v.wait(14 * SECOND);
    assert.equal(await v.popup.isVisible(), true);
    for (const path of ["/areas", "/about", "/areas/leaflet-distribution-southampton"]) {
      await v.go(path);
      await v.wait(30 * SECOND);
      assert.equal(await v.popup.isVisible(), false, path);
    }
  } finally {
    await v.ctx.close();
  }
});

test("once closed, it does not come back, after a full page load or a link within the site", { skip }, async () => {
  const v = await visit();
  try {
    await v.go("/faq");
    await v.wait(14 * SECOND);
    await v.close.click();
    assert.equal(await v.popup.isVisible(), false);
    await v.page.locator('header a[href="/about"]').first().click();
    await v.page.waitForURL(BASE + "/about");
    await v.settle();
    await v.wait(30 * SECOND);
    assert.equal(await v.popup.isVisible(), false, "after a link within the site");
    await v.go("/services");
    await v.wait(30 * SECOND);
    assert.equal(await v.popup.isVisible(), false, "after a full page load");
  } finally {
    await v.ctx.close();
  }
});

test("once its Get a Quote is clicked, it does not come back", { skip }, async () => {
  const v = await visit();
  try {
    await v.go("/services");
    await v.wait(14 * SECOND);
    await v.page.locator("div.popup-panel a", { hasText: "Get a Quote" }).click();
    await v.page.waitForURL(BASE + "/quote");
    await v.go("/areas");
    await v.wait(30 * SECOND);
    assert.equal(await v.popup.isVisible(), false);
  } finally {
    await v.ctx.close();
  }
});

test("never on /quote", { skip }, async () => {
  const v = await visit();
  try {
    await v.go("/quote");
    await v.wait(60 * SECOND);
    assert.equal(await v.popup.isVisible(), false);
  } finally {
    await v.ctx.close();
  }
});

test("never after a quote request has been sent in the visit, from /quote or from the Get a Quote panel", { skip }, async () => {
  for (const where of ["/quote", "panel"] as const) {
    const v = await visit();
    try {
      let root;
      if (where === "/quote") {
        await v.go("/quote");
        root = v.page.locator("main");
      } else {
        await v.go("/services");
        await v.page.locator("div.fixed.bottom-6.right-6 button", { hasText: "Get a Quote" }).click();
        await v.wait(1 * SECOND);
        root = v.page.locator("div.fixed.bottom-6.right-6");
      }
      // A full Leaflet Distribution request, well inside the 13 seconds.
      await root.locator("label", { has: v.page.locator('input[value="Leaflet Distribution"]') }).click();
      await v.wait(500);
      await root.locator("#first-name").fill("Quinn");
      await root.locator("#email").fill("quinn@slot-popup-test.example");
      await root.locator("#phone").fill("07700 900123");
      await v.wait(500);
      await root.locator("#quantity").selectOption("Not sure yet");
      await v.wait(500);
      await root.locator("#budget").selectOption({ index: 1 });
      await root.getByRole("button", { name: "Send Quote Request" }).click();
      await root.getByRole("heading", { name: "Request Received" }).waitFor();
      assert.ok(v.sent.includes("web3forms"), `${where}: the request was sent (to the stand-in)`);
      await v.wait(30 * SECOND);
      assert.equal(await v.popup.isVisible(), false, `${where}: not on this page`);
      await v.go("/areas");
      await v.wait(30 * SECOND);
      assert.equal(await v.popup.isVisible(), false, `${where}: not on another page`);
    } finally {
      await v.ctx.close();
    }
  }
});

test("with sessionStorage unavailable, it still works and shows at most once on the page load", { skip }, async () => {
  const v = await visit({ noStorage: true });
  try {
    await v.go("/services");
    await v.wait(14 * SECOND);
    assert.equal(await v.popup.isVisible(), true, "shown once");
    await v.close.click();
    // Moving around the site by its own links keeps the same page load.
    await v.page.locator('header a[href="/about"]').first().click();
    await v.page.waitForURL(BASE + "/about");
    await v.settle();
    await v.wait(30 * SECOND);
    assert.equal(await v.popup.isVisible(), false, "not again on the same page load");
    await v.page.locator('header a[href="/case-studies"]').first().click();
    await v.page.waitForURL(BASE + "/case-studies");
    await v.settle();
    await v.wait(30 * SECOND);
    assert.equal(await v.popup.isVisible(), false, "still not");
  } finally {
    await v.ctx.close();
  }
});

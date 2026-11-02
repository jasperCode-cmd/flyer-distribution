import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// The quote form in a real browser: choosing each service by click,
// keyboard or a ?service= link, on /quote and in the floating Get a Quote
// panel, on a desktop screen and a phone screen the size Safari leaves
// visible on an iPhone. Each time the card is chosen, the form opens, and
// "Your details" with its first field ends up on screen (on a phone it opens
// below all three cards, so it has to be brought into view). For Leaflet
// Distribution, the campaign section follows the contact number, asking
// Company, Areas and the quantity first, and the rest follows the quantity. Nothing is sent: the form is never submitted and
// every request off the test server is blocked.
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

const SERVICES = [
  { value: "Leaflet Distribution", param: "leaflet", heading: "About your campaign" },
  { value: "Web Design & SEO", param: "web", heading: "About your business" },
  { value: "Screen Hire", param: "screen", heading: "About your event" },
] as const;
type Service = (typeof SERVICES)[number];
// The neighbour to start from, and the arrow key that then chooses the service.
const BY_KEYBOARD: Record<Service["param"], [Service["param"], string]> = {
  leaflet: ["web", "ArrowLeft"],
  web: ["leaflet", "ArrowRight"],
  screen: ["web", "ArrowRight"],
};
const SCREENS = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "phone 390x664", width: 390, height: 664 },
];
const PLACES = ["/quote", "the Get a Quote panel"] as const;

let browser: Browser;
before(async () => {
  if (skip) return;
  browser = await playwright!.chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
});

async function open(screen: (typeof SCREENS)[number], place: (typeof PLACES)[number], query = "") {
  const phone = screen.width < 640;
  const ctx = await browser.newContext({ viewport: { width: screen.width, height: screen.height }, hasTouch: phone, isMobile: phone });
  const offServer: string[] = [];
  await ctx.route("**/*", (route: any) => {
    const req = route.request();
    if (req.url().startsWith(BASE) && req.method() === "GET") return route.continue();
    offServer.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  const page = await ctx.newPage();
  if (place === "/quote") {
    await page.goto(`${BASE}/quote${query}`, { waitUntil: "networkidle" });
  } else {
    await page.goto(`${BASE}/services${query}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    const launcher = page.locator("div.fixed.bottom-6.right-6 button", { hasText: "Get a Quote" });
    await launcher.waitFor({ state: "visible" });
    await launcher.click();
    await page.locator("div.fixed.bottom-6.right-6 form, div.fixed.bottom-6.right-6 fieldset").first().waitFor();
    await page.waitForTimeout(500);
  }
  const root = page.locator(place === "/quote" ? "main" : "div.fixed.bottom-6.right-6");
  const radio = (s: Service): any => root.locator(`input[name="quote-service"][value="${s.value}"]`);
  const card = (s: Service): any => root.locator("label", { has: page.locator(`input[name="quote-service"][value="${s.value}"]`) });
  return { ctx, page, root, radio, card, offServer, phone, inPanel: place !== "/quote" };
}
type Opened = Awaited<ReturnType<typeof open>>;

// "Your details" and the first field it asks for, fully on screen: below the
// sticky header on the page, or inside the panel's scrolling area.
async function detailsOnScreen(o: Opened): Promise<boolean> {
  const check = () =>
    o.page.evaluate((inPanel: boolean) => {
      const scope = document.querySelector(inPanel ? "div.fixed.bottom-6.right-6" : "main")!;
      const heading = [...scope.querySelectorAll("h3")].find((h) => h.textContent?.trim() === "Your details");
      const field = scope.querySelector("#first-name");
      if (!heading || !field) return false;
      const area = inPanel ? scope.querySelector(".overflow-y-auto")!.getBoundingClientRect() : null;
      const top = area ? area.top : (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
      const bottom = Math.min(window.innerHeight, area ? area.bottom : Infinity);
      return heading.getBoundingClientRect().top >= top && field.getBoundingClientRect().bottom <= bottom;
    }, o.inPanel);
  // Allow the smooth scroll to finish.
  for (let i = 0; i < 20; i++) {
    if (await check()) return true;
    await o.page.waitForTimeout(100);
  }
  return false;
}

// The section's own controls a person can see, in order (the details aside).
const sectionControls = (o: Opened): Promise<string[]> =>
  o.root.evaluate((el: Element) =>
    [...el.querySelectorAll("form input:not([type=hidden]), form select, form textarea, form button")]
      .filter((e) => (e as HTMLElement).offsetParent !== null && !["first-name", "last-name", "email", "phone"].includes(e.id))
      .map((e) => e.id || (e as HTMLInputElement).name || (e.textContent ?? "").trim())
  );

// Leaflets: Company, Areas and the quantity first, with the hint; the rest
// after any quantity, below it, with what was typed kept and nothing above
// moving; then it stays when the quantity is changed back.
async function leafletSection(o: Opened) {
  assert.deepEqual(await sectionControls(o), ["company", "areas-required", "quantity"], "Company, Areas, then the quantity");
  assert.equal(await o.root.locator("#quantity-continue-hint").textContent(), "Choose a quantity to continue");
  await o.root.locator("#company").fill("Kept Ltd");
  await o.root.locator("#areas-required").fill("Ringwood BH24");
  const tops = () =>
    o.root.evaluate((el: Element) => ["#company", "#areas-required", "#quantity"].map((id) => Math.round(el.querySelector(id)!.getBoundingClientRect().top)));
  // Let the form's own fold-ins (not the page's endless ones), and any
  // scroll to the form, finish first.
  await o.root.evaluate((el: Element) => Promise.all(el.querySelector("form")!.getAnimations({ subtree: true }).map((a) => a.finished)));
  let before = await tops();
  for (let i = 0; i < 20; i++) {
    await o.page.waitForTimeout(100);
    const now = await tops();
    if (now.join() === before.join()) break;
    before = now;
  }
  await o.root.locator("#quantity").selectOption("Not sure yet");
  await o.root.getByRole("button", { name: "Send Quote Request" }).waitFor({ state: "visible" });
  assert.deepEqual(await tops(), before, "nothing above the rest moves");
  assert.deepEqual(await sectionControls(o), ["company", "areas-required", "quantity", "Yes", "No", "Yes", "No", "budget", "message", "newsletter", "Send Quote Request"]);
  assert.equal(await o.root.locator("#company").inputValue(), "Kept Ltd");
  assert.equal(await o.root.locator("#areas-required").inputValue(), "Ringwood BH24");
  assert.equal(await o.root.locator("#quantity-continue-hint").count(), 0);
  await o.root.locator("#quantity").selectOption("");
  assert.equal((await sectionControls(o)).length, 11, "still revealed after changing back");
}

async function choose(o: Opened, s: Service, how: "click" | "keyboard" | "preselect") {
  if (how === "click") {
    if (o.phone) await o.card(s).tap();
    else await o.card(s).click();
  } else if (how === "keyboard") {
    const [from, key] = BY_KEYBOARD[s.param];
    await o.radio(SERVICES.find((x) => x.param === from)!).focus();
    await o.page.keyboard.press(key);
  } else {
    // Already chosen by the link: the form is there; choosing the card again brings it into view.
    assert.ok(await o.radio(s).isChecked(), `${s.param} chosen by the link`);
    assert.ok(await o.root.getByRole("heading", { name: "Your details" }).count(), "the form is there on arrival");
    if (o.phone) await o.card(s).tap();
    else await o.card(s).click();
  }
}

for (const screen of SCREENS) {
  for (const place of PLACES) {
    for (const how of ["click", "keyboard", "preselect"] as const) {
      test(`${place}, ${screen.name}: each service chosen by ${how} opens the form with Your details on screen`, { skip }, async () => {
        for (const s of SERVICES) {
          const o = await open(screen, place, how === "preselect" ? `?service=${s.param}` : "");
          try {
            await choose(o, s, how);
            assert.ok(await o.radio(s).isChecked(), `${s.param}: chosen`);
            for (const other of SERVICES.filter((x) => x !== s)) assert.equal(await o.radio(other).isChecked(), false, `${other.param} not chosen`);
            if (s.param === "leaflet") assert.match((await o.card(s).locator("span[aria-hidden=true]").textContent()) ?? "", /Selected/);
            assert.equal(await o.root.locator("form").count(), 1, `${s.param}: the form is open`);
            assert.ok(await detailsOnScreen(o), `${s.param}: Your details and First name on screen`);
            // Then the service's questions after the contact number.
            await o.root.locator("#phone").fill("07700 900123");
            await o.root.getByRole("heading", { name: s.heading }).waitFor({ state: "visible" });
            if (s.param === "leaflet") await leafletSection(o);
            await o.root.locator("#company").waitFor({ state: "visible" });
            await o.root.getByRole("button", { name: "Send Quote Request" }).waitFor({ state: "visible" });
            assert.deepEqual(o.offServer.filter((r) => !r.startsWith("GET ")), [], "nothing sent");
          } finally {
            await o.ctx.close();
          }
        }
      });
    }
  }
}

test("switching from another service to Leaflet Distribution, by click and by keyboard, opens its questions", { skip }, async () => {
  for (const screen of SCREENS) {
    for (const place of PLACES) {
      const leaflet = SERVICES[0];
      for (const first of SERVICES.slice(1)) {
        const o = await open(screen, place);
        try {
          await choose(o, first, "click");
          assert.ok(await detailsOnScreen(o), `${first.param} first`);
          await o.root.locator("#phone").fill("07700 900123");
          await choose(o, leaflet, "click");
          assert.ok(await o.radio(leaflet).isChecked());
          await o.root.getByRole("heading", { name: leaflet.heading }).waitFor({ state: "visible" });
          await o.root.locator("#quantity").waitFor({ state: "visible" });
          // And back by keyboard, then to Leaflet again.
          await o.radio(leaflet).focus();
          await o.page.keyboard.press("ArrowRight");
          assert.ok(await o.radio(SERVICES[1]).isChecked());
          await o.page.keyboard.press("ArrowLeft");
          assert.ok(await o.radio(leaflet).isChecked());
          assert.ok(await o.root.locator("#quantity").isVisible(), `${screen.name} ${place}: the quantity after switching back`);
        } finally {
          await o.ctx.close();
        }
      }
    }
  }
});

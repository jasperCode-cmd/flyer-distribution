// The slot line, "5 Campaign Slots Remaining Before Christmas, secure your
// slot today": one set of words in lib/campaign-constants.ts that the
// announcement bar and the timed pop-up both show (and the unused hero badge),
// the number and the words after it in bold, the call to action in normal
// weight, linking to /quote. The thank-you email's slot sentence says the
// same (lib/__tests__/thank-you-email.test.ts). Checked on the source, and
// (with a local production build and Playwright) in a real browser at 390
// and 1440:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// The browser checks are skipped otherwise. Requests off the test server are blocked.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { campaignSlots, slotHeadline, slotLine, SLOT_CALL_TO_ACTION } from "@/lib/campaign-constants";

const LINE = "5 Campaign Slots Remaining Before Christmas, secure your slot today";
const BOLD = "5 Campaign Slots Remaining Before Christmas";
const FILES = ["components/AnnouncementBar.tsx", "components/SlotPopup.tsx", "components/HeroSlotBadge.tsx", "lib/campaign-constants.ts"];

test("the words: one shared set, exactly the new line", () => {
  assert.equal(campaignSlots.slotsRemaining, 5);
  assert.equal(campaignSlots.deadline, "Christmas");
  assert.equal(slotLine(campaignSlots.slotsRemaining), LINE);
  assert.equal(`${campaignSlots.slotsRemaining} ${slotHeadline(campaignSlots.slotsRemaining)}`, BOLD);
  assert.equal(SLOT_CALL_TO_ACTION, ", secure your slot today");
  assert.equal(slotLine(1), "1 Campaign Slot Remaining Before Christmas, secure your slot today");
  // The old month field and wording are gone.
  assert.ok(!("monthLabel" in campaignSlots));
});

test("the bar, the pop-up and the hero badge all take their words from it", () => {
  const bar = readFileSync("components/AnnouncementBar.tsx", "utf8");
  assert.match(
    bar,
    /<span className="font-heading font-bold">\s*<SlotCountReveal value=\{campaignSlots\.slotsRemaining\} \/>\s*\{` \$\{slotHeadline\(campaignSlots\.slotsRemaining\)\}`\}\s*<\/span>\s*\{SLOT_CALL_TO_ACTION\}\s*<\/p>/
  );
  assert.match(bar, /<Link\s+href="\/quote"/);
  const popup = readFileSync("components/SlotPopup.tsx", "utf8");
  assert.match(popup, /<p className="text-blue-900 text-lg mb-2 pr-6">\s*<span className="font-heading font-bold">\s*<SlotCountdown triggered=\{visible\} label=\{\(count\) => ` \$\{slotHeadline\(count\)\}`\} \/>\s*<\/span>\s*\{SLOT_CALL_TO_ACTION\}\s*<\/p>/);
  assert.match(readFileSync("components/HeroSlotBadge.tsx", "utf8"), /\{`\$\{slotHeadline\(count\)\}\$\{SLOT_CALL_TO_ACTION\}`\}/);
  for (const file of FILES) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /monthLabel|Available for|November|Distribution Campaign/, file);
    assert.doesNotMatch(source, /[\u2013\u2014]/, file);
  }
});

const BASE = process.env.QUOTE_FORM_TEST_URL ?? "";
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

// The line inside `root`: its whole text, the bold part's text and weight, and the call to action's weight.
function readLine(root: Element) {
  const bold = root.querySelector(".font-bold") as HTMLElement;
  const p = bold.parentElement as HTMLElement;
  return {
    text: p.textContent!.replace(/\s+/g, " ").trim(),
    bold: bold.textContent!.replace(/\s+/g, " ").trim(),
    boldWeight: getComputedStyle(bold).fontWeight,
    restWeight: getComputedStyle(p).fontWeight,
  };
}

test("in the browser: the bar and the pop-up show the same line, bold then normal weight, linking to /quote", { skip }, async () => {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
      await page.clock.install();
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      const bar = await page.evaluate(`(${readLine})(document.querySelector("a.bg-yellow-400[href='/quote']"))`);
      assert.deepEqual(bar, { text: LINE, bold: BOLD, boldWeight: "700", restWeight: "400" }, `bar @${width}`);

      // The pop-up shows after 13 seconds, then counts down to the real figure.
      await page.clock.runFor(14000);
      await page.waitForSelector(".popup-panel");
      await page.clock.runFor(3000);
      const popup = await page.evaluate(`(${readLine})(document.querySelector(".popup-panel"))`);
      assert.deepEqual(popup, { text: LINE, bold: BOLD, boldWeight: "700", restWeight: "400" }, `pop-up @${width}`);
      const rest = await page.evaluate(() => {
        const panel = document.querySelector(".popup-panel")!;
        const link = panel.querySelector("a")!;
        return { body: panel.querySelectorAll("p")[1].textContent, button: link.textContent, href: link.getAttribute("href") };
      });
      assert.deepEqual(rest, { body: "Get in touch before they're gone.", button: "Get a Quote", href: "/quote" }, `@${width}`);
    } finally {
      await ctx.close();
    }
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The timed popup (components/SlotPopup.tsx): after 13 seconds on a page, at
// most once per visit, recorded in sessionStorage as soon as it appears, never
// after a quote request has been sent in the visit, never on /quote, and safe
// when sessionStorage cannot be used (then at most once per page load).
// Checked on the source; slot-popup-browser.test.ts checks it in a browser.

const popup = readFileSync("components/SlotPopup.tsx", "utf8");
const body = (name: string) => {
  const start = popup.indexOf(name);
  assert.ok(start >= 0, name);
  return popup.slice(start, popup.indexOf("\n}\n", start) + 2);
};

test("its timing, place and keys", () => {
  assert.match(popup, /const SHOW_AFTER_MS = 13000;/);
  assert.match(popup, /const BACKDROP_GUARD_MS = 1000;/);
  assert.match(popup, /const SEEN_KEY = "fdh-slot-popup-dismissed";/);
  assert.match(popup, /const QUOTE_SENT_KEY = "fdh-quote-request-sent";/);
  // Off /quote and the pages without the site around them, even if it was open.
  assert.match(popup, /const skip = pathname === "\/quote" \|\| hidesSiteChrome\(pathname\);/);
  assert.match(popup, /if \(!visible \|\| skip\) return null;/);
  assert.match(readFileSync("app/layout.tsx", "utf8"), /<SlotPopup \/>/);
});

test("recorded as shown the moment it appears, so closing, clicking or ignoring it all count", () => {
  assert.match(
    popup,
    /const showTimer = setTimeout\(\(\) => \{\s+\/\/ [^\n]*\n\s+if \(!mayShow\(\)\) return;\s+shownThisPageLoad = true;\s+setFlag\(SEEN_KEY\);\s+setVisible\(true\);\s+\}, SHOW_AFTER_MS\);/
  );
  // Checked before the timer starts and again when it fires.
  assert.match(popup, /if \(!mayShow\(\)\) return;\s+const showTimer/);
  assert.match(body("function mayShow"), /!shownThisPageLoad && !quoteSentThisPageLoad && !readFlag\(SEEN_KEY\) && !readFlag\(QUOTE_SENT_KEY\)/);
  // Closing only hides it now; it was already recorded.
  assert.match(body("  function dismiss"), /^  function dismiss\(\) \{\s+setVisible\(false\);\s+\}/);
});

test("every use of sessionStorage is inside try/catch, with flags in memory as the fallback", () => {
  assert.match(body("function readFlag"), /try \{\s+return sessionStorage\.getItem\(key\) === "1";\s+\} catch \{\s+return false;\s+\}/);
  assert.match(body("function setFlag"), /try \{\s+sessionStorage\.setItem\(key, "1"\);\s+\} catch \{\}/);
  const uses = popup.split("\n").filter((l) => l.includes("sessionStorage.") && !l.trim().startsWith("//"));
  assert.equal(uses.length, 3, uses.join("\n"));
  assert.match(popup, /try \{\s+if \(new URLSearchParams\(window\.location\.search\)\.get\("resetpopup"\) === "1"\) \{\s+sessionStorage\.removeItem\(SEEN_KEY\);\s+\}\s+\} catch \{\}/);
  assert.match(popup, /^let shownThisPageLoad = false;$/m);
  assert.match(popup, /^let quoteSentThisPageLoad = false;$/m);
});

test("a quote request sent anywhere in the visit stops it, recognised by the quote form's own subject", () => {
  // The same subject the quote form sends (the form itself is not changed).
  assert.match(popup, /export const QUOTE_REQUEST_SUBJECT = "New Quote Request - Flyer Distribution Hampshire";/);
  assert.match(readFileSync("components/QuoteForm.tsx", "utf8"), /name="subject"\s+value="New Quote Request - Flyer Distribution Hampshire"/);
  // The distributor application has a different subject, so it does not count.
  assert.doesNotMatch(readFileSync("lib/distributor-application-form.ts", "utf8"), /New Quote Request/);
  assert.match(
    popup,
    /function onSubmit\(e: Event\) \{[\s\S]*?querySelector<HTMLInputElement>\('input\[name="subject"\]'\)\?\.value;\s+if \(subject !== QUOTE_REQUEST_SUBJECT\) return;\s+quoteSentThisPageLoad = true;\s+setFlag\(QUOTE_SENT_KEY\);\s+\}/
  );
  // Listened for on every page, /quote included, from the start.
  assert.match(popup, /document\.addEventListener\("submit", onSubmit, true\);\s+return \(\) => document\.removeEventListener\("submit", onSubmit, true\);\s+\}, \[\]\);/);
});

test("its content and look are as before", () => {
  assert.match(popup, /className="fixed inset-0 z-\[100\] flex items-end sm:items-center justify-center p-4 bg-black\/60 popup-backdrop"/);
  assert.match(popup, /className="relative bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 popup-panel"/);
  assert.match(popup, /Get in touch before this month&apos;s slots are gone\./);
  assert.match(popup, /` Distribution Campaign \$\{slotNoun\(count\)\} Available for \$\{campaignSlots\.monthLabel\}`/);
  assert.match(popup, /<Link\s+href="\/quote"\s+onClick=\{dismiss\}/);
  assert.doesNotMatch(popup, /[\u2013\u2014]/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The floating Get a Quote panel: one visible heading, the form's own "Get
// Your Free Quote", with the panel itself named "Get a Quote" for screen
// readers, and the close button where it was. Checked on the source; the
// browser test checks it in the page at 1440 and 390.

const panel = readFileSync("components/FloatingQuoteButton.tsx", "utf8");
const body = panel.slice(panel.indexOf('key="panel"'), panel.indexOf("</motion.div>"));

test("the panel's own heading is gone and the form comes first", () => {
  assert.doesNotMatch(body, /<h[1-6]\b/, "no heading of the panel's own");
  assert.match(body, /<div className="max-h-\[85vh\] overflow-y-auto rounded-2xl p-6 pb-20">\s*<QuoteForm inPanel \/>\s*<\/div>/);
});

test("the panel keeps an accessible name, without becoming a dialog", () => {
  assert.match(body, /role="region"\s+aria-label="Get a Quote"/);
  assert.doesNotMatch(body, /role="dialog"|aria-modal/);
  // Focus is left as it was: nothing focuses or traps on open or close.
  assert.doesNotMatch(panel, /\.focus\(|autoFocus|tabIndex/);
});

test("the close button is unchanged: bottom right, 44px, named Close", () => {
  assert.match(
    body,
    /<button\s+type="button"\s+onClick=\{\(\) => setOpen\(false\)\}\s+aria-label="Close"\s+className="absolute bottom-4 right-4 flex items-center justify-center w-11 h-11 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-lg transition-colors"/
  );
});

test("the form's heading and line are unchanged, so /quote is too", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  assert.match(form, /<h2 className="text-xl font-bold text-blue-900">Get Your Free Quote<\/h2>\s*<p className="mt-1 text-gray-600">\s*Free, with no obligation\. We&apos;ll be in touch within 24 hours\.\s*<\/p>/);
  assert.match(readFileSync("app/quote/page.tsx", "utf8"), /<QuoteForm \/>/);
});

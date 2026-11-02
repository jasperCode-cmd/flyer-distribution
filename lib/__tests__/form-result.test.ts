import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { revealFirstInvalid, showResult } from "@/components/form-result";

// After a public form is sent, or fails: the result is brought into view
// below the sticky header and focused, smoothly unless reduced motion is
// asked for, and the first field the browser won't accept is centred and
// focused. Checked with stand-in elements, and on both forms' source; the
// browser run covers the real thing.

// A stand-in element that records how it was focused and scrolled.
function fakeElement() {
  const calls = { focused: [] as unknown[], scrolled: [] as unknown[] };
  const el = {
    focus: (opts: unknown) => void calls.focused.push(opts),
    scrollIntoView: (opts: unknown) => void calls.scrolled.push(opts),
  } as unknown as HTMLElement;
  return { el, ...calls };
}
// A stand-in window whose reduced-motion setting is as given, while fn runs
// (and, if it returns a promise, until that settles).
async function withMotion(reduce: boolean, fn: () => unknown): Promise<void> {
  const g = globalThis as { window?: unknown };
  const before = g.window;
  g.window = { matchMedia: (q: string) => ({ matches: reduce && q === "(prefers-reduced-motion: reduce)" }) };
  try {
    await fn();
  } finally {
    g.window = before;
  }
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test("the result is focused without a jump, then scrolled to just below the header: smoothly, or at once with reduced motion", async () => {
  for (const [reduce, behavior] of [[false, "smooth"], [true, "instant"]] as const) {
    const fake = fakeElement();
    await withMotion(reduce, () => showResult(fake.el));
    assert.deepEqual(fake.focused, [{ preventScroll: true }]);
    assert.deepEqual(fake.scrolled, [{ behavior, block: "start" }]);
  }
  assert.doesNotThrow(() => showResult(null));
});

test("only the first field the browser won't accept in an attempt is centred and focused, after the browser's own scroll", async () => {
  const first = fakeElement();
  const second = fakeElement();
  await withMotion(false, async () => {
    revealFirstInvalid({ target: first.el } as unknown as Event);
    revealFirstInvalid({ target: second.el } as unknown as Event);
    // Nothing yet: it waits for the browser's own focus and scroll.
    assert.deepEqual(first.scrolled, []);
    await tick();
    assert.deepEqual(first.focused, [{ preventScroll: true }]);
    assert.deepEqual(first.scrolled, [{ behavior: "smooth", block: "center" }]);
    assert.deepEqual(second.scrolled, [], "the second missing field is left alone");
  });
  // The next attempt starts afresh.
  const again = fakeElement();
  await withMotion(true, async () => {
    revealFirstInvalid({ target: again.el } as unknown as Event);
    await tick();
  });
  assert.deepEqual(again.scrolled, [{ behavior: "instant", block: "center" }]);
});

test("both forms bring their success message and send-failure banner into view, focused, with the same words as before", () => {
  const forms = [
    { file: "components/QuoteForm.tsx", title: "Request Received", text: "Thank you, we will be in touch within 24 hours." },
    { file: "components/DistributorApplicationForm.tsx", title: "Application Received", text: "Thanks for applying. We&apos;ll be in touch soon, most likely on WhatsApp." },
  ];
  for (const { file, title, text } of forms) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /import \{ revealFirstInvalid, showResult \} from "@\/components\/form-result";/, file);
    // The success message: focusable, named by its heading, clear of the header.
    assert.match(
      src,
      /ref=\{successRef\}\s+tabIndex=\{-1\}\s+role="region"\s+aria-labelledby=\{`\$\{resultId\}-title`\}\s+aria-describedby=\{`\$\{resultId\}-text`\}\s+className="[^"]*scroll-mt-20 focus:outline-none"/,
      file
    );
    assert.ok(src.includes(`<h2 id={\`\${resultId}-title\`} className="text-xl font-bold text-blue-900 mb-2">${title}</h2>`), file);
    assert.ok(src.includes(text), file);
    // The banner: the same words, focusable and clear of the header.
    assert.match(src, /<p\s+ref=\{errorRef\}\s+tabIndex=\{-1\}\s+className="[^"]*scroll-mt-20 focus:outline-none"\s*>\s+Something went wrong\. Please try again or email us at/, file);
    // Shown when they appear, and missing fields caught as the browser reports them.
    assert.match(src, /useEffect\(\(\) => \{\s+if \(submitted\) showResult\(successRef\.current\);\s+\}, \[submitted\]\);/, file);
    assert.match(src, /useEffect\(\(\) => \{\s+if \(error\) showResult\(errorRef\.current\);\s+\}, \[error\]\);/, file);
    assert.match(src, /form\.addEventListener\("invalid", revealFirstInvalid, true\);/, file);
    assert.match(src, /form\.removeEventListener\("invalid", revealFirstInvalid, true\);/, file);
  }
  // The quote form's listener follows the form, which only exists once a service is chosen.
  assert.match(readFileSync("components/QuoteForm.tsx", "utf8"), /removeEventListener\("invalid", revealFirstInvalid, true\);\s+\}, \[serviceType, submitted\]\);/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The floating Get a Quote panel loads the quote form only when it is first
// opened, and moves with CSS rather than framer-motion, so neither is loaded
// with every page. Checked on the source; quote-panel-browser.test.ts checks
// it in a browser.

const panel = readFileSync("components/FloatingQuoteButton.tsx", "utf8");
const css = readFileSync("components/FloatingQuoteButton.module.css", "utf8");

test("the form is a dynamic import, made only once the panel is open", () => {
  assert.doesNotMatch(panel, /^import .*QuoteForm/m, "no static import of the form");
  assert.equal(panel.match(/import\("\.\/QuoteForm"\)\.then/g)?.length, 1, "fetched in one place");
  assert.match(
    panel,
    /useEffect\(\(\) => \{\s+if \(!open \|\| QuoteForm\) return;\s+import\("\.\/QuoteForm"\)\.then\(\s+\(loaded\) => setQuoteForm\(\(\) => loaded\.default\),\s+\(\) => setFormFailed\(true\)\s+\);\s+\}, \[open, QuoteForm\]\);/
  );
  // Only a type comes from the module otherwise.
  assert.match(panel, /^type QuoteFormComponent = typeof import\("\.\/QuoteForm"\)\.default;$/m);
  // Opening again after a failure tries again.
  assert.match(panel, /function handleOpen\(\) \{\s+setOpen\(true\);\s+setHasOpenedOnce\(true\);\s+setFormFailed\(false\);\s+\}/);
});

test("a small loading state while the form is on its way, and the quote page if it can't be fetched", () => {
  assert.match(panel, /role="status"[\s\S]*?Loading the quote form\.\.\./);
  assert.match(panel, /min-h-\[592px\] md:min-h-\[319px\]/);
  assert.match(panel, /motion-safe:animate-spin/);
  assert.match(css, /\.loading \{\s+animation: appear 200ms ease-out 300ms both;\s+\}/);
  assert.match(panel, /role="alert"[\s\S]*?The quote form could not be loaded\.[\s\S]*?<Link href="\/quote"/);
});

test("no framer-motion in the panel, or anywhere else on the public site; the CRM still uses it", () => {
  assert.doesNotMatch(panel, /from "framer-motion"|<motion\.|<AnimatePresence|useAnimation\(/);
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
  const users = [...files("app"), ...files("components")].filter((f) => /from "framer-motion"/.test(readFileSync(f, "utf8")));
  assert.ok(users.length > 0);
  for (const f of users) assert.match(f, /^components\/crm\//, `${f} is not CRM`);
});

test("the pill and panel move as before: in from 30% on a spring, the pill out in 200ms, the panel out on its spring", () => {
  assert.match(css, /\.pill\[data-stage="enter"\],\s+\.pill\[data-stage="leave"\],\s+\.panel\[data-stage="enter"\],\s+\.panel\[data-stage="leave"\] \{\s+scale: 0\.3;\s+opacity: 0;\s+\}/);
  assert.match(css, /\.pill,\s+\.panel \{\s+scale: 1;\s+opacity: 1;\s+transition-property: scale, opacity;\s+\}/);
  assert.match(css, /\.pill\[data-stage="leave"\] \{\s+transition-duration: 200ms;\s+transition-timing-function: ease-in-out;\s+\}/);
  assert.match(css, /@media \(hover: hover\) \{\s+\.pill\[data-stage="shown"\]:hover \{\s+scale: 1\.12;\s+transition-duration: 180ms;\s+transition-timing-function: ease-out;\s+\}\s+\}/);
  // The component waits as long as each takes to leave before removing it.
  assert.match(panel, /const PILL_LEAVE_MS = 200;/);
  assert.match(panel, /const PANEL_LEAVE_MS = 530;/);
  assert.match(css, /\.panel \{\s+transition-duration: 530ms;/);
  assert.match(css, /\.pill \{\s+transition-duration: 410ms;/);
  // Origin bottom right, as before.
  assert.match(panel, /\$\{styles\.pill\} origin-bottom-right /);
  assert.match(panel, /\$\{styles\.panel\} origin-bottom-right /);
});

// framer-motion's spring from rest, as progress from 0 to 1.
function spring(stiffness: number, damping: number, ms: number): number {
  const w = Math.sqrt(stiffness);
  const zeta = damping / (2 * w);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const t = ms / 1000;
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

function linearPoints(selector: string): [number, number][] {
  const block = css.slice(css.indexOf("@supports"));
  const m = new RegExp(`${selector} \\{\\s+transition-timing-function: linear\\(([^)]*)\\);`).exec(block);
  assert.ok(m, selector);
  const parts = m[1].split(", ");
  return parts.map((p, i) => {
    const [y, x] = p.split(" ");
    return [x ? parseFloat(x) / 100 : i === 0 ? 0 : 1, parseFloat(y)];
  });
}

for (const [selector, stiffness, damping, duration] of [
  [".pill", 400, 26, 410],
  [".panel", 300, 28, 530],
] as const) {
  test(`${selector} follows framer-motion's spring (stiffness ${stiffness}, damping ${damping}) over ${duration}ms`, () => {
    const points = linearPoints(selector);
    assert.ok(points.length > 10);
    for (const [x, y] of points.slice(0, -1)) {
      assert.ok(Math.abs(y - spring(stiffness, damping, x * duration)) < 0.003, `${selector} at ${x}: ${y}`);
    }
    // Ends at rest, as framer-motion does once it is within half a percent.
    assert.deepEqual(points.at(-1), [1, 1]);
    assert.ok(Math.abs(1 - spring(stiffness, damping, duration)) < 0.006);
  });
}

test("the idle wiggle: every 7 seconds, the first after 7, rocking -8, 8, -5, 5 degrees and back over 0.6 seconds", () => {
  assert.match(css, /\.wiggle \{\s+animation: wiggle 7s ease-in-out 7s infinite;\s+\}/);
  const steps = [...css.matchAll(/([\d.]+)%(?:,\s+100%)? \{\s+transform: rotate\((-?\d+)deg\);/g)].map((m) => [parseFloat(m[1]), parseInt(m[2])]);
  assert.deepEqual(steps.map((s) => s[1]), [0, -8, 8, -5, 5, 0]);
  steps.forEach(([at], i) => assert.ok(Math.abs((at / 100) * 7000 - i * 120) < 0.1, `step ${i} at ${at}%`));
  // Only while resting unopened, and never again once the panel has been opened.
  assert.match(panel, /const wiggling = visible && !open && !hasOpenedOnce && !footerInView;/);
  assert.match(panel, /<span className=\{`flex items-center gap-2\$\{wiggling \? ` \$\{styles\.wiggle\}` : ""\}`\}>/);
});

test("no em or en dashes in the panel's files", () => {
  for (const text of [panel, css]) assert.doesNotMatch(text, /[\u2013\u2014]/);
});

// The Services menu in the header: the desktop dropdown's two columns
// (leaflet services led by Leaflet Distribution, then Leaflet Printing; the
// additional services beside them, with the quote box; the All services bar
// across the bottom), how it opens and closes, and the phone menu's single
// column, ending with the same bar.
// Also the footer's Services list and the link on /services. Checked on the
// source; the browser run checks the rendered menu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("the Services menu: leaflet services led by Leaflet Distribution then Leaflet Printing, the additional ones beside them; the footer and /services link to it", () => {
  const header = read("components/Header.tsx");
  const list = (name: string) => {
    const from = header.indexOf(`const ${name}: ServiceItem[] = [`);
    assert.ok(from > 0, name);
    return [...header.slice(from, header.indexOf("];", from)).matchAll(/\{ href: "([^"]+)", label: "([^"]+)", description: "([^"]+)"(?:, look: "(\w+)")? \}/g)].map((m) => [
      m[1],
      m[2],
      m[3],
      m[4] ?? "",
    ]);
  };
  // Each with its line; Leaflet Distribution first and most prominent (opening /leaflet-delivery), Leaflet Printing second.
  assert.deepEqual(list("LEAFLET_SERVICES"), [
    ["/leaflet-delivery", "Leaflet Distribution", "Door to door, GPS tracked. We can design and print it too.", "featured"],
    ["/leaflet-printing", "Leaflet Printing", "Flyers, leaflets and business cards", "highlight"],
    ["/services/public-notice-leafleting", "Public Notice Leafleting", "Road closures, works and consultations", ""],
    ["/services/hand-to-hand-distribution", "Hand-to-Hand Leaflet Distribution", "Leaflets handed out at events and busy spots", ""],
    ["/services/b2b-distribution", "B2B Leaflet Distribution", "Reach local businesses directly", ""],
  ]);
  assert.deepEqual(list("ADDITIONAL_SERVICES"), [
    ["/services/web-design-seo", "Web Design & SEO", "A site that brings in enquiries", ""],
    ["/services/screen-hire", "Screen Hire", "Mobile screen trailer for events", ""],
  ]);
  assert.match(header, /const BADGE = "Most popular";/);
  // Navy with white text and the yellow badge above the title; light blue (#dbeafe) with a printer icon.
  assert.match(header, /bg-\[#1e3a8a\] px-4 py-3 text-white[^"`]*`\}>\s+<span className="inline-block rounded-full bg-\[#facc15\][^"]*">\{BADGE\}<\/span>\s+<span className="mt-1\.5 block whitespace-nowrap/);
  assert.match(header, /bg-\[#dbeafe\][^`]*`\}>\s+<PrinterIcon \/>/);
  // Desktop: the two columns, 3fr and 2fr, with the divider, the labels, the quote box, then the All services bar.
  const panel = header.slice(header.indexOf('id="services-menu"'), header.indexOf("{navLinks.slice(1).map("));
  assert.match(panel, /w-\[640px\] max-w-\[calc\(100vw-32px\)\] rounded-2xl[^"]*bg-white p-5 shadow-/);
  assert.match(panel, /<div className="grid grid-cols-\[3fr_2fr\]">/);
  assert.match(panel, /border-l border-\[#e2e8f0\] pl-5/);
  assert.ok(panel.indexOf(">Leaflet services</p>") < panel.indexOf("LEAFLET_SERVICES.map") && panel.indexOf("LEAFLET_SERVICES.map") < panel.indexOf(">Additional services</p>"));
  assert.match(panel, /<div className="mt-auto pt-4">\s+<div className="rounded-xl bg-\[#1e3a8a\] p-4 text-white">\s+<p[^>]*>Not sure which you need\?<\/p>\s+<Link\s+href="\/quote"[\s\S]*?text-\[#facc15\][\s\S]*?>\s+Get a free quote &rarr;\s+<\/Link>/);
  assert.match(panel, /<\/div>\s+<AllServicesBar onClick=\{closePanel\} className="mt-4" \/>\s+<\/div>\s+<\/div>\s+\)\}/);
  assert.doesNotMatch(header, /View all services/);
  // The bar: one link to /services, the full width, light grey (#f8fafc) with a 1px #e2e8f0 border and 12px
  // corners; All services in bold with its line underneath on the left, View all on the right; 44px at least.
  const bar = header.slice(header.indexOf("function AllServicesBar("), header.indexOf("const navLinks"));
  assert.match(bar, /<Link\s+href="\/services"\s+onClick=\{onClick\}\s+className=\{`flex min-h-11 items-center justify-between gap-4 rounded-\[12px\] border border-\[#e2e8f0\] bg-\[#f8fafc\] px-4 py-3 /);
  assert.match(bar, /<span className="min-w-0">\s+<span className="block text-sm font-bold [^"]*">All services<\/span>\s+<span className="mt-0\.5 block [^"]*">Leaflet delivery, printing, web design and screen hire in one place<\/span>\s+<\/span>\s+<span className="shrink-0 text-sm font-bold [^"]*">View all &rarr;<\/span>\s+<\/Link>/);
  assert.equal((header.match(/<AllServicesBar /g) ?? []).length, 2);
  // Hover opens it, and moving away closes it only if hover opened it. A click opens it and keeps it
  // open; a click closes it only if a click opened it. A click outside, Escape and tabbing on close it.
  assert.match(header, /onMouseEnter=\{\(\) => setServicesOpen\(true\)\}\s+onMouseLeave=\{\(\) => \{\s+if \(!openedByClick\.current\) setServicesOpen\(false\);\s+\}\}/);
  assert.match(header, /onClick=\{\(\) => \{\s+if \(servicesOpen && openedByClick\.current\) return closePanel\(\);\s+openedByClick\.current = true;\s+setServicesOpen\(true\);\s+\}\}/);
  assert.match(header, /const closePanel = \(\) => \{\s+openedByClick\.current = false;\s+setServicesOpen\(false\);\s+\};/);
  // Every other way it closes goes through closePanel, so a click-opened panel never stays pinned afterwards.
  assert.deepEqual(header.match(/setServicesOpen\([^)]*\)/g), ["setServicesOpen(false)", "setServicesOpen(true)", "setServicesOpen(false)", "setServicesOpen(true)"]);
  assert.match(header, /document\.addEventListener\("mousedown", handleClickOutside\)/);
  assert.match(header, /if \(e\.key !== "Escape"\) return;\s+closePanel\(\);\s+servicesButtonRef\.current\?\.focus\(\);/);
  assert.match(header, /aria-expanded=\{servicesOpen\}\s+aria-haspopup="true"\s+aria-controls="services-menu"/);
  // Kept on screen: moved left if it would come within 16px of the right edge.
  assert.match(header, /const over = left \+ panel\.offsetWidth - \(document\.documentElement\.clientWidth - 16\);/);
  // Phone: the leaflet services, then Also with the other two as pills side by side, then the All services bar at the bottom; 44px taps.
  const phone = header.slice(header.indexOf("{mobileServicesOpen && ("), header.indexOf("{navLinks.slice(1).map((link) => (", header.indexOf("{mobileServicesOpen && (")));
  assert.ok(phone.indexOf(">Leaflet services</p>") < phone.indexOf("LEAFLET_SERVICES.map") && phone.indexOf("LEAFLET_SERVICES.map") < phone.indexOf(">Also</p>"));
  assert.match(phone, /<div className="grid grid-cols-2 gap-2">\s+\{ADDITIONAL_SERVICES\.map/);
  assert.match(phone, /rounded-full border border-blue-200/);
  assert.match(phone, /<\/div>\s+<AllServicesBar onClick=\{closeMobile\} className="mt-1\.5" \/>\s+<\/div>\s+\)\}/);
  assert.equal((phone.match(/min-h-11/g) ?? []).length, 1);
  // Each kind of service link (3), the phone's pills (1) and the All services bar (1) is at least 44px tall.
  assert.equal((header.match(/className=\{`(block|flex) min-h-11 /g) ?? []).length, 5);
  // Footer: second in its Services list.
  const footer = read("components/Footer.tsx");
  const serviceLinks = footer.slice(footer.indexOf("const serviceLinks"), footer.indexOf("];", footer.indexOf("const serviceLinks")));
  assert.deepEqual(
    [...serviceLinks.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]),
    ["Services", "Leaflet Printing", "Public Notice Leafleting", "Hand-to-Hand Leaflet Distribution", "B2B Leaflet Distribution", "Web Design & SEO", "Screen Hire"]
  );
  // /services: one link, in the Print and Deliver card.
  const services = read("app/services/page.tsx");
  assert.equal((services.match(/href="\/leaflet-printing"/g) ?? []).length, 1);
  assert.match(services, /\{pkg\.id === "print-and-deliver" && \(\s+<Link href="\/leaflet-printing"[^>]*>\s+See our leaflet printing\s+<\/Link>\s+\)\}/);
});

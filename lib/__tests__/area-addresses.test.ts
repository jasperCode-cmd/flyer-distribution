import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "@/next.config";
import sitemap from "@/app/sitemap";
import { areas } from "@/lib/areas-data";

// The area pages' addresses: every page lives at
// /areas/leaflet-distribution-[area], each old /areas/[area] address
// (with or without a trailing slash) has a permanent one-hop redirect to it
// that must never be removed, and nothing on the site links to an old one.

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const PREFIX = "leaflet-distribution-";

const pageFolders = readdirSync("app/areas").filter((name) => statSync(join("app/areas", name)).isDirectory()).sort();
const moved = pageFolders.map((name) => name.slice(PREFIX.length));

test("every area page is at /areas/leaflet-distribution-[area]", () => {
  assert.equal(pageFolders.length, 15);
  for (const name of pageFolders) {
    assert.ok(name.startsWith(PREFIX), name);
    assert.ok(statSync(join("app/areas", name, "page.tsx")).isFile(), name);
  }
  // The overview stays at /areas.
  assert.ok(statSync("app/areas/page.tsx").isFile());
  // The shared list the overview and homepage use points at the same pages.
  assert.deepEqual(areas.map((a) => a.href).sort(), pageFolders.map((name) => `/areas/${name}`));
});

test("every old address, with and without a trailing slash, redirects permanently to its new address in one step", async () => {
  assert.equal(nextConfig.skipTrailingSlashRedirect, true);
  const rules = await nextConfig.redirects!();
  for (const area of moved) {
    for (const source of [`/areas/${area}`, `/areas/${area}/`]) {
      const matching = rules.filter((r) => r.source === source);
      assert.equal(matching.length, 1, source);
      assert.equal(matching[0].destination, `${SITE}/areas/${PREFIX}${area}`, source);
      assert.equal((matching[0] as { permanent?: boolean }).permanent, true, source);
      // Straight there: the destination is not itself redirected.
      assert.ok(!rules.some((r) => r.source === new URL(matching[0].destination).pathname), source);
    }
  }
  // Two per area, then Next's usual trailing-slash redirect, last, so it never catches an old area address first.
  assert.equal(rules.length, moved.length * 2 + 1);
  assert.deepEqual(rules.at(-1), { source: "/:path+/", destination: "/:path+", permanent: true });
  // The warning stays with them.
  assert.match(readFileSync("next.config.ts", "utf8"), /THESE REDIRECTS MUST NEVER BE REMOVED/);
});

test("the sitemap lists only the new addresses, with them and /areas dated 27 October 2026", () => {
  const entries = sitemap();
  const areaEntries = entries.filter((e) => e.url.startsWith(`${SITE}/areas/`));
  assert.deepEqual(areaEntries.map((e) => e.url).sort(), pageFolders.map((name) => `${SITE}/areas/${name}`));
  const overview = entries.filter((e) => e.url === `${SITE}/areas`);
  assert.equal(overview.length, 1);
  for (const e of [...areaEntries, ...overview]) assert.equal(new Date(e.lastModified!).toISOString(), "2026-10-27T00:00:00.000Z", e.url);
  // Everything else keeps its date.
  for (const e of entries.filter((e) => e.url !== `${SITE}/areas` && !e.url.startsWith(`${SITE}/areas/`))) {
    assert.equal(new Date(e.lastModified!).toISOString(), "2026-06-24T00:00:00.000Z", e.url);
  }
});

test("each area page's canonical, Open Graph address and breadcrumb point at itself", () => {
  for (const name of pageFolders) {
    const page = readFileSync(join("app/areas", name, "page.tsx"), "utf8");
    const own = `${SITE}/areas/${name}`;
    assert.match(page, new RegExp(`canonical: "${own}"`), name);
    assert.match(page, new RegExp(`url: "${own}"`), name);
    assert.match(page, new RegExp(`item: "${own}"`), name);
    assert.match(page, new RegExp(`areas\\.find\\(\\(a\\) => a\\.href === "/areas/${name}"\\)`), name);
  }
});

test("nothing on the site links to an old area address", () => {
  const old = new RegExp(`/areas/(${moved.join("|")})(?![a-z0-9-])`);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (path !== join("lib", "__tests__")) walk(path);
      } else if (/\.(tsx?|txt|md|json|xml|html)$/.test(entry)) files.push(path);
    }
  };
  for (const dir of ["app", "components", "lib", "public"]) walk(dir);
  for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), old, file);
});

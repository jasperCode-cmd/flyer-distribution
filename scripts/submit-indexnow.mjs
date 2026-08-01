// Submits every URL in the live sitemap to IndexNow (Bing, Yandex, etc).
// Run via `npm run indexnow`. No secrets or env vars required.

const HOST = "www.flyerdistributionhampshire.co.uk";
const KEY = "7eac6cd2b09db5d49dbbfcee011e2383ed4b4e2943ef8a8e8cb63ad7a16047ca";
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

async function getSitemapUrls() {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  if (urls.length === 0) {
    throw new Error("No <loc> URLs found in sitemap");
  }
  return urls;
}

async function submitToIndexNow(urlList) {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return res;
}

async function main() {
  console.log(`Fetching sitemap from ${SITEMAP_URL}...`);
  const urls = await getSitemapUrls();
  console.log(`Found ${urls.length} URL(s):`);
  urls.forEach((u) => console.log(`  - ${u}`));

  console.log(`\nSubmitting to IndexNow (${INDEXNOW_ENDPOINT})...`);
  const res = await submitToIndexNow(urls);
  const body = await res.text();

  console.log(`Response status: ${res.status} ${res.statusText}`);
  if (body) console.log(`Response body: ${body}`);

  // IndexNow returns 200 (OK) or 202 (Accepted) on success.
  if (res.status === 200 || res.status === 202) {
    console.log("\n✓ IndexNow submission succeeded.");
  } else {
    console.error("\n✗ IndexNow submission failed.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\n✗ IndexNow submission failed:", err.message);
  process.exitCode = 1;
});

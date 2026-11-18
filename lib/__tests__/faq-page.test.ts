// The FAQ page: each answer as shown is word for word the text its FAQPage
// schema gives, and neither states a turnaround time or makes a pricing claim.
// The only time on the page is how quickly we reply to a quote request.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

let rendered: string | undefined;
function html(): string {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-faq.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = (JSON.parse(run.stdout) as { html: string }).html;
  }
  return rendered;
}
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const textOf = (h: string) => decode(h.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

const shown = () => [...html().matchAll(/<h2 class="text-base font-semibold text-blue-900 mb-2">([^<]*)<\/h2><p class="text-gray-600 text-base leading-relaxed">([\s\S]*?)<\/p>/g)].map((m) => [decode(m[1]), textOf(m[2])]);
const schema = () => {
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html())![1]);
  assert.equal(ld["@type"], "FAQPage");
  return (ld.mainEntity as { name: string; acceptedAnswer: { text: string } }[]).map((q) => [q.name, q.acceptedAnswer.text]);
};

test("every answer on the page is word for word its FAQPage schema text", () => {
  assert.equal(shown().length, 10);
  assert.deepEqual(shown(), schema());
});

test("no turnaround times and no pricing claims, in the answers or the schema", () => {
  for (const [q, a] of [...shown(), ...schema()]) {
    assert.doesNotMatch(a, /\bwithin (?:a |one |two |three |\d+ )?(?:days?|weeks?|months?)\b|turn(?:ing)? ?around|\bnext.day|same.day|\b\d+\s*(working\s+)?(days?|weeks?)\b/i, q);
    assert.doesNotMatch(a, /competitive|discount|cheap|affordable|best price|low(?:est)? (?:cost|price)|£|\bpricing\b|\bprices\b|value for money|print partners/i, q);
  }
  // "Within 24 hours" only where it is how quickly we reply with a quote.
  const timed = shown().filter(([, a]) => /24 hours/.test(a));
  assert.deepEqual(timed.map(([q]) => q), ["How do I get a quote?"]);
  assert.match(timed[0][1], /We'll come back to you within 24 hours with a tailored quote for your leaflet distribution campaign\./);
});

test("the three answers reworded: printing, quantities and how long a campaign takes", () => {
  const answers = Object.fromEntries(shown());
  assert.equal(
    answers["Do I need to have my leaflets printed already?"],
    "Not necessarily. You can supply your own printed materials, or choose our Print and Deliver service and we'll handle the printing for you, in A6, A5, A4 or DL. Just let us know when requesting your quote and we'll include printing in your package."
  );
  assert.equal(
    answers["How many leaflets do I need?"],
    "That depends on the postcode areas you want to cover across Hampshire and Dorset and how many households are within them. We generally recommend 5,000 or more, as this gives your campaign enough reach to generate a meaningful response. Our Campaign Planning service, part of our leaflet distribution services, can advise on the right quantity for your target areas."
  );
  assert.equal(
    answers["How long does a campaign take?"],
    "It depends on the size of your campaign and the areas you want to cover across Hampshire and Dorset. We'll agree a clear timeline with you before the campaign begins, so you know exactly when to expect completion."
  );
});

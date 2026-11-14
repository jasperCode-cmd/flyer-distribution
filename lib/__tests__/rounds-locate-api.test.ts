import { test, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readLabels, LOCATE_TIMEOUT_MS } from "@/lib/rounds/locate/read-labels";
import { LOCATE_MODEL } from "@/lib/rounds/locate/pricing";
import { fixtureFile, startMockAnthropic } from "./rounds-locate-mock";

// Locate's call to Claude, against a stand-in for the Anthropic API that
// answers with the readings recorded from the three real screenshots: what
// is sent (the model, the refusal fallback, the answer's schema, the image
// with its grid), what comes back (the labels, the cost from the token
// counts), and every way it can fail (no key, rate limited, overloaded,
// refused, unreadable), each a plain reason, with nothing logged but a status.

const FAKE_KEY = "sk-ant-test-not-a-real-key";
const mock = startMockAnthropic();
after(async () => (await mock).close());

async function screenshot(n: string): Promise<Buffer> {
  return sharp(fixtureFile(n)).resize(738, 1600, { kernel: "lanczos3" }).jpeg({ quality: 90 }).toBuffer();
}

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  else process.env[k] = v;
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

test("each real screenshot's labels come back, with the call's cost and time; the request is as intended", async () => {
  const m = await mock;
  await withEnv({ ANTHROPIC_API_KEY: FAKE_KEY, ANTHROPIC_BASE_URL: m.url }, async () => {
    for (const n of ["1", "2", "3"]) {
      const sent = m.requests.length;
      const r = await readLabels(await screenshot(n), 738, 1600);
      assert.ok(r.ok, `screenshot ${n}: ${!r.ok ? r.reason : ""}`);
      assert.equal(m.requests[sent].screenshot, n, "the mock recognised the screenshot");
      assert.ok(r.labels.length >= 15 && r.labels.some((l) => l.kind === "street"));
      // 2104 tokens in at $4 a million, the answer's out at $20 a million.
      const out = 150 + 36 * r.labels.length;
      assert.ok(Math.abs(r.costUsd - (2104 * 4 + out * 20) / 1e6) < 1e-9, `${r.costUsd}`);
      assert.equal(r.model, LOCATE_MODEL);
      assert.ok(r.seconds >= 0 && r.seconds < 30);
    }
    const req = m.requests[m.requests.length - 1];
    assert.equal(req.body.model, "claude-opus-5-5");
    assert.equal(req.body.fallbacks, "default");
    assert.match(String(req.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
    const config = req.body.output_config as { effort: string; format: { type: string; schema: { required: string[] } } };
    assert.equal(config.effort, "low");
    assert.equal(config.format.type, "json_schema");
    assert.deepEqual(config.format.schema.required, ["labels"]);
    const content = (req.body.messages as { content: { type: string; source?: { media_type: string } ; text?: string }[] }[])[0].content;
    assert.equal(content[0].type, "image");
    assert.equal(content[0].source!.media_type, "image/jpeg");
    assert.match(content[1].text!, /738 by 1600/);
    // The key goes to the API (as a bearer token in this SDK version), and nowhere else.
    assert.ok(req.headers["x-api-key"] === FAKE_KEY || req.headers.authorization === `Bearer ${FAKE_KEY}`);
  });
  assert.ok(LOCATE_TIMEOUT_MS < 60_000, "inside the function's time limit");
});

test("without a key, Locate isn't set up: nothing is sent", async () => {
  const m = await mock;
  const before = m.requests.length;
  await withEnv({ ANTHROPIC_API_KEY: undefined, ANTHROPIC_BASE_URL: m.url }, async () => {
    const r = await readLabels(await screenshot("1"), 738, 1600);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, "Locate isn't set up yet");
  });
  assert.equal(m.requests.length, before);
});

test("rate limited, overloaded, refused or unreadable: a plain reason, a wait where asked, and only the status logged", async () => {
  const m = await mock;
  const logged: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  try {
    await withEnv({ ANTHROPIC_API_KEY: FAKE_KEY, ANTHROPIC_BASE_URL: m.url }, async () => {
      const image = await screenshot("2");
      m.setMode("rate-limit");
      const limited = await readLabels(image, 738, 1600);
      assert.ok(!limited.ok && /busy \(rate limited\)/.test(limited.reason) && limited.retryAfterS === 7 && limited.costUsd === 0);
      m.setMode("overloaded");
      const overloaded = await readLabels(image, 738, 1600);
      assert.ok(!overloaded.ok && /overloaded/.test(overloaded.reason) && (overloaded.retryAfterS ?? 0) > 0);
      m.setMode("refusal");
      const refused = await readLabels(image, 738, 1600);
      assert.ok(!refused.ok && /declined/.test(refused.reason) && refused.costUsd > 0, "a refusal's tokens are still counted");
      m.setMode("bad-json");
      const unreadable = await readLabels(image, 738, 1600);
      assert.ok(!unreadable.ok && /couldn't be read/.test(unreadable.reason));
      // Back to normal for the next one.
      assert.ok((await readLabels(image, 738, 1600)).ok);
    });
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(logged, ["Rounds: Locate's call to Claude failed (429)", "Rounds: Locate's call to Claude failed (529)"]);
  for (const line of logged) assert.ok(!line.includes(FAKE_KEY) && line.length < 80);
});

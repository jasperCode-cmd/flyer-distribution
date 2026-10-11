import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  buildRawMessage,
  encodeQuotedPrintable,
  signatureToText,
  describeSignatureImages,
  sendEmailVia,
  loadSignature,
  clearSignatureCache,
  type GmailSendApi,
  type SendAsEntry,
} from "@/lib/gmail";
import { sendLeadEmailAndRecord, type SendLeadEmailPrisma } from "@/lib/send-lead-email";

const US = "flyerdistributionhampshire@gmail.com";
// A made-up signature, shaped like the HTML Gmail stores for one.
const SIGNATURE_HTML =
  '<div dir="ltr"><b>Jasper Adams</b><br>Flyer Distribution Hampshire<br>' +
  '<a href="https://www.flyerdistributionhampshire.co.uk">www.flyerdistributionhampshire.co.uk</a><br>' +
  '<img src="https://ci3.googleusercontent.com/sig/logo.png" width="120" alt="Logo"></div>';

function decodeRaw(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function decodeQuotedPrintable(text: string): string {
  const joined = text.replace(/=\r\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && /^[0-9A-F]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}

type Part = { headers: Record<string, string>; raw: string; text: string };

// Splits a raw message into its top-level headers and its MIME parts.
function parseMime(raw: string): { headers: Record<string, string>; boundary: string; parts: Part[]; message: string } {
  const message = decodeRaw(raw);
  const [head, ...rest] = message.split("\r\n\r\n");
  const headers = Object.fromEntries(
    head.split("\r\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])
  );
  const boundary = /boundary="([^"]+)"/.exec(headers["Content-Type"])![1];
  const body = rest.join("\r\n\r\n");
  const chunks = body.split(`--${boundary}`);
  const parts = chunks.slice(1, -1).map((chunk) => {
    const trimmed = chunk.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const [partHead, ...partBody] = trimmed.split("\r\n\r\n");
    const partHeaders = Object.fromEntries(
      partHead.split("\r\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])
    );
    const rawPart = partBody.join("\r\n\r\n");
    return { headers: partHeaders, raw: rawPart, text: decodeQuotedPrintable(rawPart) };
  });
  return { headers, boundary, parts, message };
}

function fakeApi(opts: { signature?: string | null; listFails?: boolean; sendFails?: boolean; sender?: string } = {}) {
  const sent: { raw: string; threadId?: string }[] = [];
  let listCalls = 0;
  const api: GmailSendApi = {
    async send(requestBody) {
      if (opts.sendFails) throw new Error("Backend Error");
      sent.push(requestBody);
      return { id: `m${sent.length}`, threadId: requestBody.threadId ?? `t${sent.length}` };
    },
    async listSendAs(): Promise<SendAsEntry[]> {
      listCalls++;
      if (opts.listFails) throw new Error("Request had insufficient authentication scopes.");
      return [
        { sendAsEmail: "alias@example.com", signature: "<b>Not ours</b>" },
        { sendAsEmail: opts.sender ?? "FlyerDistributionHampshire@gmail.com", signature: opts.signature ?? SIGNATURE_HTML },
      ];
    },
  };
  return { api, sent, listCalls: () => listCalls };
}

beforeEach(() => clearSignatureCache());

// --- MIME structure -----------------------------------------------------------------

test("MIME: multipart/alternative with a text/plain and a text/html part, both UTF-8, correctly bounded", () => {
  const { headers, boundary, parts, message } = parseMime(
    buildRawMessage({ from: US, to: "lead@example.com", subject: "Your quote", body: "Hello there", signatureHtml: SIGNATURE_HTML })
  );
  assert.equal(headers["MIME-Version"], "1.0");
  assert.match(headers["Content-Type"], /^multipart\/alternative; boundary="fdh_[0-9a-f]{24}"$/);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].headers["Content-Type"], 'text/plain; charset="UTF-8"');
  assert.equal(parts[1].headers["Content-Type"], 'text/html; charset="UTF-8"');
  for (const p of parts) assert.equal(p.headers["Content-Transfer-Encoding"], "quoted-printable");
  // Every boundary line is exact, and the closing one ends the message.
  assert.equal(message.split(`\r\n--${boundary}\r\n`).length, 3);
  assert.ok(message.endsWith(`\r\n--${boundary}--\r\n`));
  // No encoded line is longer than the 76 characters MIME allows.
  for (const p of parts) for (const line of p.raw.split("\r\n")) assert.ok(line.length <= 76, line);
});

test("MIME: each message gets its own boundary", () => {
  const a = parseMime(buildRawMessage({ from: US, to: "a@example.com", subject: "s", body: "b" })).boundary;
  const b = parseMime(buildRawMessage({ from: US, to: "a@example.com", subject: "s", body: "b" })).boundary;
  assert.notEqual(a, b);
});

test("the typed body is always escaped in the HTML part: a <script> stays as text", () => {
  const body = 'Hi <script>alert("x")</script> & <b>bold</b>\nSecond line';
  const { parts } = parseMime(buildRawMessage({ from: US, to: "a@example.com", subject: "s", body, signatureHtml: SIGNATURE_HTML }));
  const html = parts[1].text;
  assert.ok(!html.includes("<script"), "no script tag");
  assert.ok(!html.includes("<b>bold"), "no markup from the body");
  assert.ok(html.includes("Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;<br>\r\nSecond line"));
  assert.ok(parts[0].text.startsWith(body.replace("\n", "\r\n")), "the plain part has the body exactly as typed");
});

test("the signature appears in both parts: as HTML in a gmail_signature div, and as plain text", () => {
  const { parts } = parseMime(
    buildRawMessage({ from: US, to: "a@example.com", subject: "s", body: "Thanks,\nJasper", signatureHtml: SIGNATURE_HTML })
  );
  const [plain, html] = parts.map((p) => p.text);
  assert.ok(
    html.includes(`<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${SIGNATURE_HTML}</div>`)
  );
  assert.equal(
    plain,
    "Thanks,\r\nJasper\r\n\r\n-- \r\nJasper Adams\r\nFlyer Distribution Hampshire\r\nwww.flyerdistributionhampshire.co.uk"
  );
  assert.ok(!plain.includes("<"), "no HTML in the plain part");
});

test("without a signature, both parts carry just the body", () => {
  const { parts } = parseMime(buildRawMessage({ from: US, to: "a@example.com", subject: "s", body: "Just this" }));
  assert.equal(parts[0].text, "Just this");
  assert.equal(parts[1].text, '<div dir="ltr">Just this</div>');
});

test("non-ASCII text works in the subject and both parts", () => {
  const body = "Café delivery for £120, thanks José 👍";
  const { headers, parts } = parseMime(
    buildRawMessage({ from: US, to: "a@example.com", subject: "Café quote £120", body, signatureHtml: "<b>Zoë</b>" })
  );
  assert.match(headers.Subject, /^=\?UTF-8\?B\?/);
  assert.equal(Buffer.from(/\?B\?(.*)\?=/.exec(headers.Subject)![1], "base64").toString("utf-8"), "Café quote £120");
  assert.ok(parts[0].text.startsWith(body));
  assert.ok(parts[0].text.endsWith("Zoë"));
  assert.ok(parts[1].text.includes(body) && parts[1].text.includes("<b>Zoë</b>"));
});

test("quoted-printable round-trips long lines, '=' signs and trailing spaces", () => {
  const text = `${"a".repeat(200)}\n1+1=2 \nline with tab\t`;
  const encoded = encodeQuotedPrintable(text);
  for (const line of encoded.split("\r\n")) assert.ok(line.length <= 76);
  assert.ok(encoded.includes("1+1=3D2=20"));
  assert.equal(decodeQuotedPrintable(encoded), text.replace(/\n/g, "\r\n"));
});

// --- Threading --------------------------------------------------------------------------

test("threading on a reply is exactly as before: In-Reply-To, References and the thread ID", async () => {
  const { api, sent } = fakeApi();
  const result = await sendEmailVia(api, US, {
    to: "lead@example.com",
    subject: "Re: Your quote",
    body: "Following up",
    threadContext: { threadId: "thread123", lastMessageId: "<abc123@mail.gmail.com>" },
  });
  assert.ok(result.ok);
  assert.equal(sent[0].threadId, "thread123");
  const { headers } = parseMime(sent[0].raw);
  assert.equal(headers["In-Reply-To"], "<abc123@mail.gmail.com>");
  assert.equal(headers.References, "<abc123@mail.gmail.com>");
});

test("a fresh email has no threading headers and no thread ID", async () => {
  const { api, sent } = fakeApi();
  await sendEmailVia(api, US, { to: "lead@example.com", subject: "Hello", body: "Hi" });
  assert.equal(sent[0].threadId, undefined);
  const { headers } = parseMime(sent[0].raw);
  assert.equal(headers["In-Reply-To"], undefined);
  assert.equal(headers.References, undefined);
});

// --- Fetching the signature -----------------------------------------------------------------

test("the signature for the sender address is added, matched case-insensitively", async () => {
  const { api, sent } = fakeApi();
  const result = await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "Hi" });
  assert.ok(result.ok && result.data.signature === "added");
  const { parts } = parseMime(sent[0].raw);
  assert.ok(parts[1].text.includes("Jasper Adams"));
  assert.ok(!parts[1].text.includes("Not ours"), "another address's signature is never used");
});

test("fallback: if the signature can't be fetched, the email still goes, without it, and says so", async () => {
  const { api, sent } = fakeApi({ listFails: true });
  const logs: unknown[][] = [];
  const spy = mock.method(console, "error", (...args: unknown[]) => {
    logs.push(args);
  });
  let result;
  try {
    result = await sendEmailVia(api, US, { to: "a@example.com", subject: "Private subject", body: "Private body text" });
  } finally {
    spy.mock.restore();
  }
  assert.ok(result.ok);
  assert.equal(result.data.signature, "unavailable");
  assert.equal(sent.length, 1);
  const { parts } = parseMime(sent[0].raw);
  assert.equal(parts[0].text, "Private body text");
  assert.ok(!parts[1].text.includes("gmail_signature"));
  const logged = JSON.stringify(logs);
  assert.ok(!logged.includes("Private") && !logged.includes("Jasper"), "no email content or signature in logs");
});

test("fallback: a sender address that isn't in Gmail's settings sends without a signature", async () => {
  const { api } = fakeApi({ sender: "someone-else@example.com" });
  const spy = mock.method(console, "error", () => {});
  try {
    const result = await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "b" });
    assert.ok(result.ok && result.data.signature === "unavailable");
  } finally {
    spy.mock.restore();
  }
});

test("an empty Gmail signature means none is added, which isn't a failure", async () => {
  const { api, sent } = fakeApi({ signature: "" });
  const result = await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "b" });
  assert.ok(result.ok && result.data.signature === "none");
  assert.ok(!parseMime(sent[0].raw).parts[1].text.includes("gmail_signature"));
});

test("the signature is cached in memory for 10 minutes, then fetched again", async () => {
  const { api, listCalls } = fakeApi();
  const t0 = 1_000_000;
  await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "1" }, t0);
  await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "2" }, t0 + 9 * 60_000);
  assert.equal(listCalls(), 1);
  await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "3" }, t0 + 10 * 60_000 + 1);
  assert.equal(listCalls(), 2);
});

test("a failed fetch isn't cached, so the next email tries again", async () => {
  let fail = true;
  let calls = 0;
  const spy = mock.method(console, "error", () => {});
  try {
    const list = async () => {
      calls++;
      if (fail) throw new Error("timeout");
      return [{ sendAsEmail: US, signature: SIGNATURE_HTML }];
    };
    assert.equal((await loadSignature(list, US, 0)).status, "unavailable");
    fail = false;
    assert.equal((await loadSignature(list, US, 1)).status, "found");
    assert.equal(calls, 2);
  } finally {
    spy.mock.restore();
  }
});

test("a Gmail send failure is reported as before", async () => {
  const { api } = fakeApi({ sendFails: true });
  const spy = mock.method(console, "error", () => {});
  try {
    const result = await sendEmailVia(api, US, { to: "a@example.com", subject: "s", body: "b" });
    assert.deepEqual(result, { ok: false, reason: "error", message: "Gmail request failed." });
  } finally {
    spy.mock.restore();
  }
});

// --- The Activity record -------------------------------------------------------------------

test("the Activity record is unchanged: subject and the first 200 characters of the body, no signature", async () => {
  const { api } = fakeApi();
  const created: { data: { detail: string } }[] = [];
  const prismaClient: SendLeadEmailPrisma = {
    activity: { create: (args) => created.push(args) },
    lead: { update: () => ({}) },
    $transaction: async () => [],
  };
  const body = `Hello Sam,\n${"x".repeat(250)}`;
  const result = await sendLeadEmailAndRecord({
    lead: { id: "lead1", stage: "AWAITING_RESPONSE" },
    to: "sam@example.com",
    subject: "Your quote",
    body,
    userId: "u1",
    sendEmailFn: (p) => sendEmailVia(api, US, p),
    prismaClient,
  });
  assert.ok(result.ok && result.signature === "added");
  assert.equal(created[0].data.detail, `Email: "Your quote"\n\n${body.slice(0, 200)}...`);
  assert.ok(!created[0].data.detail.includes("Jasper Adams"));
});

// --- Signature images ---------------------------------------------------------------------

test("signature images: linked by URL works, embedded (data: or cid:) is flagged", () => {
  assert.deepEqual(describeSignatureImages(SIGNATURE_HTML), { linked: 1, embedded: 0 });
  assert.deepEqual(
    describeSignatureImages('<img src="data:image/png;base64,AAAA"><img src=\'cid:logo@x\'><IMG SRC="http://x.example/a.gif">'),
    { linked: 1, embedded: 2 }
  );
  assert.equal(signatureToText(SIGNATURE_HTML).includes("logo.png"), false, "images are left out of the text version");
  assert.equal(
    signatureToText(
      '<a href="mailto:jo@example.com">jo@example.com</a> <a href="tel:07700900999">07700 900999</a> <a href="https://example.com/book">Book a call</a>'
    ),
    "jo@example.com 07700 900999 Book a call [https://example.com/book]",
    "an address shown as its own text isn't repeated; a link with other text keeps its address"
  );
});

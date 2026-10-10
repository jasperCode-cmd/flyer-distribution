import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encodeMimeHeader,
  buildRawMessage,
  shouldExcludeMessage,
  parseConversationMessage,
} from "@/lib/gmail";

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeRaw(raw: string): string {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

test("encodeMimeHeader leaves plain ASCII text untouched", () => {
  assert.equal(encodeMimeHeader("Quote follow-up"), "Quote follow-up");
});

test("encodeMimeHeader RFC2047-encodes non-ASCII text", () => {
  const encoded = encodeMimeHeader("Café quote");
  assert.match(encoded, /^=\?UTF-8\?B\?.*\?=$/);
});

test("buildRawMessage produces a plain text message with the expected headers", () => {
  const raw = buildRawMessage({
    from: "flyerdistributionhampshire@gmail.com",
    to: "lead@example.com",
    subject: "Your quote",
    body: "Hello there",
  });
  const decoded = decodeRaw(raw);
  assert.match(decoded, /^From: flyerdistributionhampshire@gmail\.com\r\n/);
  assert.match(decoded, /To: lead@example\.com\r\n/);
  assert.match(decoded, /Subject: Your quote\r\n/);
  assert.match(decoded, /Content-Type: text\/plain; charset="UTF-8"\r\n/);
  assert.match(decoded, /\r\n\r\nHello there$/);
  assert.ok(!decoded.includes("In-Reply-To"), "no threading headers on a fresh send");
});

test("buildRawMessage sets In-Reply-To and References when replying", () => {
  const raw = buildRawMessage({
    from: "flyerdistributionhampshire@gmail.com",
    to: "lead@example.com",
    subject: "Re: Your quote",
    body: "Following up",
    inReplyTo: "<abc123@mail.gmail.com>",
  });
  const decoded = decodeRaw(raw);
  assert.match(decoded, /In-Reply-To: <abc123@mail\.gmail\.com>\r\n/);
  assert.match(decoded, /References: <abc123@mail\.gmail\.com>\r\n/);
});

test("shouldExcludeMessage matches an excluded address in From, To, Cc or Delivered-To", () => {
  const headers = [
    { name: "From", value: "someone@internal-list.com" },
    { name: "To", value: "lead@example.com" },
  ];
  assert.equal(shouldExcludeMessage(headers, ["internal-list.com"]), true);
  assert.equal(shouldExcludeMessage(headers, ["other-domain.com"]), false);
  assert.equal(shouldExcludeMessage(headers, []), false);
});

test("parseConversationMessage marks a message from the shared mailbox as sent, otherwise received", () => {
  const sent = parseConversationMessage(
    {
      id: "m1",
      threadId: "t1",
      internalDate: String(Date.now()),
      payload: {
        headers: [
          { name: "From", value: "flyerdistributionhampshire@gmail.com" },
          { name: "Subject", value: "Hello" },
        ],
        mimeType: "text/plain",
        body: { data: b64url("Hi") },
      },
    },
    "flyerdistributionhampshire@gmail.com"
  );
  assert.equal(sent?.direction, "sent");

  const received = parseConversationMessage(
    {
      id: "m2",
      threadId: "t1",
      internalDate: String(Date.now()),
      payload: {
        headers: [
          { name: "From", value: "Lead Person <lead@example.com>" },
          { name: "Subject", value: "Re: Hello" },
        ],
        mimeType: "text/plain",
        body: { data: b64url("Thanks") },
      },
    },
    "flyerdistributionhampshire@gmail.com"
  );
  assert.equal(received?.direction, "received");
});

// This is the core safety guarantee: an HTML-only message is converted to
// plain text on the server. The parsed result never contains an HTML tag,
// so nothing downstream can render it as HTML, and no dangerouslySetInnerHTML
// style sink is ever needed on the client.
test("an HTML-only message body is converted to plain text, never left as HTML", () => {
  const html = "<p>Hello <b>there</b></p><script>alert(1)</script>";
  const message = parseConversationMessage(
    {
      id: "m3",
      threadId: "t1",
      internalDate: String(Date.now()),
      payload: {
        headers: [{ name: "From", value: "lead@example.com" }, { name: "Subject", value: "Hi" }],
        mimeType: "text/html",
        body: { data: b64url(html) },
      },
    },
    "flyerdistributionhampshire@gmail.com"
  );
  assert.ok(message);
  assert.ok(!message!.bodyText.includes("<"), "no raw HTML tags survive into bodyText");
  assert.ok(!message!.bodyText.includes(">"));
  assert.ok(message!.bodyText.includes("Hello"));
  assert.ok(message!.bodyText.includes("there"));
});

test("a multipart message prefers the text/plain part over text/html", () => {
  const message = parseConversationMessage(
    {
      id: "m4",
      threadId: "t1",
      internalDate: String(Date.now()),
      payload: {
        headers: [{ name: "From", value: "lead@example.com" }, { name: "Subject", value: "Hi" }],
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: b64url("Plain version") } },
          { mimeType: "text/html", body: { data: b64url("<p>HTML version</p>") } },
        ],
      },
    },
    "flyerdistributionhampshire@gmail.com"
  );
  assert.equal(message?.bodyText, "Plain version");
});

test("a part with a filename is reported as hasAttachment, without returning its content", () => {
  const message = parseConversationMessage(
    {
      id: "m5",
      threadId: "t1",
      internalDate: String(Date.now()),
      payload: {
        headers: [{ name: "From", value: "lead@example.com" }, { name: "Subject", value: "Hi" }],
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", body: { data: b64url("See attached") } },
          { mimeType: "application/pdf", filename: "quote.pdf", body: { attachmentId: "att1", size: 1234 } },
        ],
      },
    },
    "flyerdistributionhampshire@gmail.com"
  );
  assert.equal(message?.hasAttachment, true);
  assert.equal(message?.bodyText, "See attached");
  assert.ok(!JSON.stringify(message).includes("att1"), "attachment content/id is never surfaced");
});

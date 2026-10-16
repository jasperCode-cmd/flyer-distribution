"use client";

import { useEffect, useRef, useState } from "react";
import {
  composeSendPayload,
  defaultComposeBody,
  looksLikeOneAddress,
  MAX_EMAIL_ADDRESS,
  replySubject,
  type ComposeMode,
  type ReplyContext,
} from "@/lib/email-compose";
import { isBusiness, type Business } from "@/lib/business";
import BusinessBadge from "./BusinessBadge";

export type { ReplyContext } from "@/lib/email-compose";

const SENDER_LABEL = "Sending from flyerdistributionhampshire@gmail.com";
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

export type SendResult = {
  movedToAwaitingResponse: boolean;
  // "unavailable" means our Gmail signature couldn't be loaded, so the
  // email went without it.
  signature?: "added" | "none" | "unavailable";
  // A new email from the Inbox: whether it was recorded on a lead, and whose.
  recordedOnLead?: boolean;
  leadName?: string | null;
};

// Whose address a typed To is, from the server, before anything is sent.
type ToLookup =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "invalid" | "excluded" | "both_businesses"; error: string }
  | {
      status: "ok";
      // Which business the email goes from: Bournemouth for an LDB lead's
      // address, otherwise FDH.
      business: Business;
      lead: { id: string; name: string; stage: string; stageLabel: string; scrapped: boolean; business: Business } | null;
    }
  | { status: "failed" };

// Who a Bournemouth email comes from, from the server. Never the API key.
type LdbSender =
  | { status: "loading" }
  | { status: "configured"; fromName: string; fromAddress: string; signatureText: string }
  | { status: "not_configured" }
  | { status: "failed" };

// The confirmation text after a send, noting when the signature was left off.
export function sentLabel(kind: "Email" | "Reply", result: SendResult): string {
  return result.signature === "unavailable" ? `${kind} sent without the signature` : `${kind} sent`;
}

type SignaturePreview =
  | { status: "loading" }
  | { status: "found"; text: string; embeddedImages: number }
  | { status: "none" }
  | { status: "unavailable" };

export default function EmailComposeModal({
  open,
  onClose,
  leadId,
  sendUrl,
  toAddress,
  showReplyingTo = false,
  business = "FDH",
  configured,
  configuredKnown,
  userFirstName,
  replyTo,
  latestReply = null,
  toEditable = false,
  lookupUrl,
  onSent,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  // Either a lead (the lead's own send route) or an explicit sendUrl, which
  // the inbox uses so its server route can decide lead vs non-lead itself.
  leadId?: string;
  sendUrl?: string;
  toAddress: string;
  // Inbox replies show "Replying to [address]" in place of the To field, so
  // the recipient the server worked out is visible before sending.
  showReplyingTo?: boolean;
  // Which business the email goes from. LDB emails go only through the
  // Bournemouth sender (Brevo), never the FDH Gmail. A new email from the
  // Inbox ignores this: its business comes from the To address's lead.
  business?: Business;
  // Whether Gmail is connected (for an LDB email, the conversation lookup
  // is what is waited on; Bournemouth email has its own check).
  configured: boolean;
  configuredKnown: boolean;
  userFirstName: string;
  // A specific message being replied to: the email is that reply, no choice.
  replyTo: ReplyContext | null;
  // The latest message of the lead's conversation, when there is one: the
  // modal then offers "Reply to latest" or "New email" at the top.
  latestReply?: ReplyContext | null;
  // A new email from the Inbox: the To address is typed, and lookupUrl says
  // whether it is usable and whose it is.
  toEditable?: boolean;
  lookupUrl?: string;
  onSent: (result: SendResult) => void;
  onError: (message: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(() => defaultComposeBody(business, userFirstName));
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<SignaturePreview>({ status: "loading" });
  const [ldbSender, setLdbSender] = useState<LdbSender>({ status: "loading" });
  const [mode, setMode] = useState<ComposeMode>("new");
  const [to, setTo] = useState("");
  const [lookup, setLookup] = useState<ToLookup>({ status: "idle" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  // The business this email goes from, which picks the sender, signature
  // and sign-off.
  const sendBusiness: Business = toEditable ? (lookup.status === "ok" ? lookup.business : "FDH") : business;
  const fixedLdb = !toEditable && business === "LDB";

  const offersChoice = !replyTo && !!latestReply;
  // The conversation this email continues, if any.
  const activeReply = replyTo ?? (mode === "reply" ? latestReply : null);

  // Our Gmail signature, as plain text, to show what will be added. Not
  // needed for a Bournemouth email, which never goes through Gmail.
  useEffect(() => {
    if (!open || !configuredKnown || !configured || fixedLdb) return;
    let cancelled = false;
    setSignature({ status: "loading" });
    fetch("/api/crm/gmail/signature")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.status === "found" && typeof data.text === "string") {
          setSignature({ status: "found", text: data.text, embeddedImages: data.images?.embedded ?? 0 });
        } else if (data?.status === "none") {
          setSignature({ status: "none" });
        } else {
          setSignature({ status: "unavailable" });
        }
      })
      .catch(() => {
        if (!cancelled) setSignature({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, configured, configuredKnown, fixedLdb]);

  // The Bournemouth sender and signature, or that it isn't connected.
  useEffect(() => {
    if (!open || sendBusiness !== "LDB") return;
    let cancelled = false;
    setLdbSender({ status: "loading" });
    fetch("/api/crm/email/ldb-sender")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.configured === true && typeof data.fromAddress === "string") {
          setLdbSender({
            status: "configured",
            fromName: typeof data.fromName === "string" ? data.fromName : "",
            fromAddress: data.fromAddress,
            signatureText: typeof data.signatureText === "string" ? data.signatureText : "",
          });
        } else if (data?.configured === false) {
          setLdbSender({ status: "not_configured" });
        } else {
          setLdbSender({ status: "failed" });
        }
      })
      .catch(() => {
        if (!cancelled) setLdbSender({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, sendBusiness]);

  // A new email whose address turns out to be a Bournemouth lead's (or
  // stops being one) swaps the pre-filled sign-off, if it is still there.
  useEffect(() => {
    if (!open || !toEditable) return;
    const other = defaultComposeBody(sendBusiness === "LDB" ? "FDH" : "LDB", userFirstName);
    const wanted = defaultComposeBody(sendBusiness, userFirstName);
    if (other === wanted) return;
    setBody((current) => (current.endsWith(other) ? current.slice(0, current.length - other.length) + wanted : current));
  }, [open, toEditable, sendBusiness, userFirstName]);

  // A lead with a conversation opens on "Reply to latest"; switching to
  // "New email" starts a fresh thread with an empty subject.
  const latestKey = latestReply ? `${latestReply.threadId}:${latestReply.lastMessageId}` : "";
  useEffect(() => {
    if (!open) return;
    const startMode: ComposeMode = replyTo || latestReply ? "reply" : "new";
    const reply = replyTo ?? latestReply;
    setMode(startMode);
    setSubject(reply ? replySubject(reply.subject) : "");
    // A new email starts as FDH until its address says otherwise.
    setBody(defaultComposeBody(toEditable ? "FDH" : business, userFirstName));
    setTo("");
    setLookup({ status: "idle" });
    // Cursor starts at the very top, above the pre-filled sign-off, so the
    // user can type their message without having to click past it first.
    // A new email from the Inbox starts on the To field instead.
    requestAnimationFrame(() => {
      if (toEditable) {
        toRef.current?.focus();
        return;
      }
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(0, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyTo, latestKey]);

  // Checks a typed address with the server as it is typed, so whose it is
  // shows before sending. The send checks it again.
  useEffect(() => {
    if (!open || !toEditable || !lookupUrl) return;
    const value = to.trim();
    if (!looksLikeOneAddress(value)) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${lookupUrl}?to=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) setLookup({ status: "failed" });
          else if (data.status === "ok") {
            setLookup({ status: "ok", business: isBusiness(data.business) ? data.business : "FDH", lead: data.lead ?? null });
          } else {
            const status = data.status === "excluded" || data.status === "both_businesses" ? data.status : "invalid";
            setLookup({ status, error: data.error ?? "" });
          }
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setLookup({ status: "failed" });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, toEditable, lookupUrl, to]);

  if (!open) return null;

  function chooseMode(next: ComposeMode) {
    if (next === mode) return;
    // Swap the subject only if it is still the one this modal filled in.
    const auto = mode === "reply" && latestReply ? replySubject(latestReply.subject) : "";
    if (subject.trim() === auto.trim()) setSubject(next === "reply" && latestReply ? replySubject(latestReply.subject) : "");
    setMode(next);
  }

  const toOk =
    !toEditable ||
    (looksLikeOneAddress(to) &&
      lookup.status !== "excluded" &&
      lookup.status !== "invalid" &&
      lookup.status !== "both_businesses");
  // A Bournemouth email waits for its sender, and never sends when it isn't
  // connected. If the check itself failed, the server checks again.
  const senderOk = sendBusiness !== "LDB" || ldbSender.status === "configured" || ldbSender.status === "failed";
  const canSend = !!subject.trim() && !!body.trim() && toOk && senderOk && !sending;
  // Waiting on the Gmail check, or for an LDB lead on its conversation and
  // the Bournemouth sender.
  const ready = configuredKnown && (!fixedLdb || ldbSender.status !== "loading");
  const notConnected = fixedLdb ? ldbSender.status === "not_configured" : !configured;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch(sendUrl ?? `/api/crm/leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          composeSendPayload({ mode: activeReply ? "reply" : "new", replyTo: activeReply, subject, body, to: toEditable ? to : undefined })
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Could not send the email");
        setSending(false);
        return;
      }
      onSent({
        movedToAwaitingResponse: !!data.movedToAwaitingResponse,
        signature: data.signature,
        recordedOnLead: data.recordedOnLead,
        leadName: data.lead?.name ?? null,
      });
      setSending(false);
      onClose();
    } catch {
      onError("Could not send the email");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-sm font-bold text-blue-900 mb-3">
          {replyTo ? "Reply" : toEditable ? "New email" : "Send Email"}
        </h3>

        {!ready ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {fixedLdb ? "Checking Bournemouth email..." : "Checking Gmail connection..."}
          </p>
        ) : notConnected && fixedLdb ? (
          <div className="py-4">
            <p className="text-sm text-gray-700 mb-1 font-semibold">Bournemouth email not connected</p>
            <p className="text-xs text-gray-500 mb-4">
              This is a Leaflet Distribution Bournemouth lead, so it can only be emailed from the Bournemouth
              address, and that hasn&apos;t been set up yet. Nothing is sent from the FDH Gmail instead. Ask an
              administrator to add the Bournemouth email settings, then try again.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
            >
              Close
            </button>
          </div>
        ) : notConnected ? (
          <div className="py-4">
            <p className="text-sm text-gray-700 mb-1 font-semibold">Gmail is not connected</p>
            <p className="text-xs text-gray-500 mb-4">
              The CRM's Gmail account hasn't been set up yet. Ask an administrator to run the
              connection script, then try again.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {offersChoice && latestReply && (
              <div role="radiogroup" aria-label="Reply or new email" className="mb-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ["reply", "Reply to latest", replySubject(latestReply.subject)],
                    ["new", "New email", "Starts a new conversation"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => chooseMode(value)}
                    className={`min-w-0 rounded-md border px-3 py-2 text-left transition-colors ${
                      mode === value
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${mode === value ? "text-blue-900" : "text-gray-800"}`}>
                      {label}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500">{hint}</span>
                  </button>
                ))}
              </div>
            )}

            {toEditable ? (
              <>
                <label htmlFor="compose-to" className="block text-xs font-semibold text-gray-500 mb-1">
                  To
                </label>
                <input
                  ref={toRef}
                  id="compose-to"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  maxLength={MAX_EMAIL_ADDRESS}
                  placeholder="name@example.com"
                  aria-describedby="compose-to-status"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div id="compose-to-status" aria-live="polite" className="mt-1.5 mb-3 text-xs">
                  {to.trim() && !looksLikeOneAddress(to) && (
                    <p className="text-gray-500">Enter one email address, for example name@example.com.</p>
                  )}
                  {lookup.status === "checking" && <p className="text-gray-400">Checking the address...</p>}
                  {(lookup.status === "invalid" || lookup.status === "excluded" || lookup.status === "both_businesses") && (
                    <p className="text-red-700">{lookup.error}</p>
                  )}
                  {lookup.status === "ok" && lookup.lead && !lookup.lead.scrapped && (
                    <p className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-green-900">
                      <BusinessBadge business={lookup.lead.business} className="mr-1.5" />
                      Lead: <span className="font-semibold">{lookup.lead.name}</span>, {lookup.lead.stageLabel}. The email
                      is recorded on this lead
                      {lookup.lead.stage === "UNCONTACTED" ? " and moves it to Warm / Awaiting Response" : ""}.
                    </p>
                  )}
                  {lookup.status === "ok" && lookup.lead?.scrapped && (
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-gray-700">
                      {lookup.lead.name} is a scrapped lead, so this goes as a plain email and nothing is recorded.
                    </p>
                  )}
                  {lookup.status === "ok" && !lookup.lead && (
                    <p className="text-gray-500">Not a lead&apos;s address. It goes as a plain email and nothing is recorded in the CRM.</p>
                  )}
                  {lookup.status === "failed" && (
                    <p className="text-amber-700">Couldn&apos;t check the address. It is checked again when you send.</p>
                  )}
                </div>
              </>
            ) : showReplyingTo ? (
              <p className="text-sm text-gray-600 mb-3 wrap-break-word">
                Replying to <span className="font-semibold text-gray-800">{toAddress}</span>
              </p>
            ) : (
              <>
                <label htmlFor="compose-to-fixed" className="block text-xs font-semibold text-gray-500 mb-1">
                  To
                </label>
                <input
                  id="compose-to-fixed"
                  type="text"
                  value={toAddress}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 mb-3"
                />
              </>
            )}

            {sendBusiness === "LDB" && (
              <div
                className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                  ldbSender.status === "not_configured"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-teal-200 bg-teal-50 text-teal-900"
                }`}
              >
                {ldbSender.status === "configured" ? (
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 wrap-break-word">
                    <BusinessBadge business="LDB" />
                    <span>
                      From <span className="font-semibold">{ldbSender.fromName}</span> &lt;{ldbSender.fromAddress}&gt;
                    </span>
                  </p>
                ) : ldbSender.status === "not_configured" ? (
                  <p>
                    <span className="font-semibold">Bournemouth email not connected.</span> This is a Bournemouth
                    lead&apos;s address, so it can only be emailed from the Bournemouth address. Nothing is sent from
                    the FDH Gmail instead.
                  </p>
                ) : ldbSender.status === "failed" ? (
                  <p>Couldn&apos;t check the Bournemouth sender. It is checked again when you send.</p>
                ) : (
                  <p>Checking Bournemouth email...</p>
                )}
              </div>
            )}

            <label htmlFor="compose-subject" className="block text-xs font-semibold text-gray-500 mb-1">
              Subject
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={MAX_SUBJECT}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <label htmlFor="compose-body" className="block text-xs font-semibold text-gray-500 mb-1">
              Message
            </label>
            <textarea
              id="compose-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={10}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              {sendBusiness === "LDB" ? (
                ldbSender.status === "configured" ? (
                  <>
                    <p className="text-[11px] font-semibold text-gray-500">
                      The Bournemouth signature will be added below your message
                    </p>
                    <p className="mt-1 text-xs text-gray-500 whitespace-pre-line wrap-break-word">
                      {ldbSender.signatureText}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-500">The Bournemouth signature is added below your message.</p>
                )
              ) : (
                <>
                  {signature.status === "loading" && (
                    <p className="text-[11px] text-gray-400">Loading our Gmail signature...</p>
                  )}
                  {signature.status === "found" && (
                    <>
                      <p className="text-[11px] font-semibold text-gray-500">
                        Our Gmail signature will be added below your message
                      </p>
                      <p className="mt-1 max-h-28 overflow-y-auto text-xs text-gray-500 whitespace-pre-line wrap-break-word">
                        {signature.text}
                      </p>
                      {signature.embeddedImages > 0 && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Some images in the signature are embedded rather than linked, so they may not show.
                        </p>
                      )}
                    </>
                  )}
                  {signature.status === "none" && (
                    <p className="text-[11px] text-gray-500">No Gmail signature is set up, so none will be added.</p>
                  )}
                  {signature.status === "unavailable" && (
                    <p className="text-[11px] text-amber-700">
                      Couldn&apos;t load our Gmail signature. The email will be sent without it.
                    </p>
                  )}
                </>
              )}
            </div>

            <p className="text-[11px] text-gray-400 mt-2 wrap-break-word">
              {sendBusiness === "LDB"
                ? ldbSender.status === "configured"
                  ? `Sending from ${ldbSender.fromAddress}, with a copy to the same address`
                  : "Sending from the Bournemouth address only"
                : SENDER_LABEL}
            </p>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

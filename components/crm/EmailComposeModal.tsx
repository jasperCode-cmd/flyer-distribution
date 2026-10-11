"use client";

import { useEffect, useRef, useState } from "react";
import {
  composeSendPayload,
  looksLikeOneAddress,
  MAX_EMAIL_ADDRESS,
  replySubject,
  type ComposeMode,
  type ReplyContext,
} from "@/lib/email-compose";

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
  | { status: "invalid" | "excluded"; error: string }
  | { status: "ok"; lead: { id: string; name: string; stage: string; stageLabel: string; scrapped: boolean } | null }
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
  const defaultBody = `\nKind regards,\n${userFirstName}`;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<SignaturePreview>({ status: "loading" });
  const [mode, setMode] = useState<ComposeMode>("new");
  const [to, setTo] = useState("");
  const [lookup, setLookup] = useState<ToLookup>({ status: "idle" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const offersChoice = !replyTo && !!latestReply;
  // The conversation this email continues, if any.
  const activeReply = replyTo ?? (mode === "reply" ? latestReply : null);

  // Our Gmail signature, as plain text, to show what will be added.
  useEffect(() => {
    if (!open || !configuredKnown || !configured) return;
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
  }, [open, configured, configuredKnown]);

  // A lead with a conversation opens on "Reply to latest"; switching to
  // "New email" starts a fresh thread with an empty subject.
  const latestKey = latestReply ? `${latestReply.threadId}:${latestReply.lastMessageId}` : "";
  useEffect(() => {
    if (!open) return;
    const startMode: ComposeMode = replyTo || latestReply ? "reply" : "new";
    const reply = replyTo ?? latestReply;
    setMode(startMode);
    setSubject(reply ? replySubject(reply.subject) : "");
    setBody(defaultBody);
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
          else if (data.status === "ok") setLookup({ status: "ok", lead: data.lead ?? null });
          else setLookup({ status: data.status === "excluded" ? "excluded" : "invalid", error: data.error ?? "" });
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

  const toOk = !toEditable || (looksLikeOneAddress(to) && lookup.status !== "excluded" && lookup.status !== "invalid");

  async function handleSend() {
    if (!subject.trim() || !body.trim() || !toOk || sending) return;
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

        {!configuredKnown ? (
          <p className="text-sm text-gray-500 py-6 text-center">Checking Gmail connection...</p>
        ) : !configured ? (
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
                  {(lookup.status === "invalid" || lookup.status === "excluded") && (
                    <p className="text-red-700">{lookup.error}</p>
                  )}
                  {lookup.status === "ok" && lookup.lead && !lookup.lead.scrapped && (
                    <p className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-green-900">
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
            </div>

            <p className="text-[11px] text-gray-400 mt-2">{SENDER_LABEL}</p>

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
                disabled={sending || !subject.trim() || !body.trim() || !toOk}
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

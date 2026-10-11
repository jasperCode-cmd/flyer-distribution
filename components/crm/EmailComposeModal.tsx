"use client";

import { useEffect, useRef, useState } from "react";

const SENDER_LABEL = "Sending from flyerdistributionhampshire@gmail.com";
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

export type ReplyContext = {
  subject: string;
  threadId: string;
  lastMessageId: string;
};

export type SendResult = {
  movedToAwaitingResponse: boolean;
  // "unavailable" means our Gmail signature couldn't be loaded, so the
  // email went without it.
  signature?: "added" | "none" | "unavailable";
};

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
  replyTo: ReplyContext | null;
  onSent: (result: SendResult) => void;
  onError: (message: string) => void;
}) {
  const defaultBody = `\nKind regards,\n${userFirstName}`;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<SignaturePreview>({ status: "loading" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const prefixed = replyTo
      ? /^re:/i.test(replyTo.subject.trim())
        ? replyTo.subject
        : `Re: ${replyTo.subject}`
      : "";
    setSubject(prefixed);
    setBody(defaultBody);
    // Cursor starts at the very top, above the pre-filled sign-off, so the
    // user can type their message without having to click past it first.
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(0, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyTo]);

  if (!open) return null;

  async function handleSend() {
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(sendUrl ?? `/api/crm/leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body,
          threadId: replyTo?.threadId,
          lastMessageId: replyTo?.lastMessageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Could not send the email");
        setSending(false);
        return;
      }
      onSent({ movedToAwaitingResponse: !!data.movedToAwaitingResponse, signature: data.signature });
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
          {replyTo ? "Reply" : "Send Email"}
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
            {showReplyingTo ? (
              <p className="text-sm text-gray-600 mb-3 wrap-break-word">
                Replying to <span className="font-semibold text-gray-800">{toAddress}</span>
              </p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                <input
                  type="text"
                  value={toAddress}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 mb-3"
                />
              </>
            )}

            <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={MAX_SUBJECT}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
            <textarea
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
                disabled={sending || !subject.trim() || !body.trim()}
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

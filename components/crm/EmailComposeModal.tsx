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

export default function EmailComposeModal({
  open,
  onClose,
  leadId,
  leadEmail,
  configured,
  configuredKnown,
  userFirstName,
  replyTo,
  onSent,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadEmail: string;
  configured: boolean;
  configuredKnown: boolean;
  userFirstName: string;
  replyTo: ReplyContext | null;
  onSent: (result: { movedToAwaitingResponse: boolean }) => void;
  onError: (message: string) => void;
}) {
  const defaultBody = `\nKind regards,\n${userFirstName}`;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
      const res = await fetch(`/api/crm/leads/${leadId}/email`, {
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
      onSent({ movedToAwaitingResponse: !!data.movedToAwaitingResponse });
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
            <input
              type="text"
              value={leadEmail}
              readOnly
              className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 mb-3"
            />

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

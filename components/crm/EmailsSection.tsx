"use client";

import { useState } from "react";

export type ConversationMessage = {
  id: string;
  threadId: string;
  messageIdHeader: string | null;
  direction: "sent" | "received";
  from: string;
  date: string;
  subject: string;
  bodyText: string;
  hasAttachment: boolean;
};

export type EmailsState = {
  loaded: boolean;
  loading: boolean;
  configured: boolean;
  messages: ConversationMessage[];
  error: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailsSection({
  leadEmail,
  state,
  onExpand,
  onRefresh,
  onReply,
}: {
  leadEmail: string | null;
  state: EmailsState;
  onExpand: () => void;
  onRefresh: () => void;
  onReply: (message: ConversationMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !state.loaded && !state.loading) onExpand();
  }

  const lastMessage = state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-sm font-bold text-blue-900">Emails</h2>
        <span className="text-xs text-gray-400">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="mt-3">
          {!leadEmail ? (
            <p className="text-sm text-gray-400">This lead has no email address on file.</p>
          ) : state.loading && !state.loaded ? (
            <p className="text-sm text-gray-500">Loading conversation...</p>
          ) : !state.configured ? (
            <p className="text-sm text-gray-500">
              Gmail is not connected. Ask an administrator to run the connection script.
            </p>
          ) : state.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={state.loading}
                  className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-60"
                >
                  {state.loading ? "Refreshing..." : "Refresh"}
                </button>
                {lastMessage && (
                  <button
                    type="button"
                    onClick={() => onReply(lastMessage)}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Reply
                  </button>
                )}
              </div>

              {state.messages.length === 0 ? (
                <p className="text-sm text-gray-400">No emails with this lead yet.</p>
              ) : (
                <ul className="space-y-3">
                  {state.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-md border p-3 ${
                        m.direction === "sent"
                          ? "bg-blue-50 border-blue-100 ml-0 sm:ml-6"
                          : "bg-gray-50 border-gray-200 mr-0 sm:mr-6"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span
                          className={`text-[11px] font-semibold ${
                            m.direction === "sent" ? "text-blue-700" : "text-gray-600"
                          }`}
                        >
                          {m.direction === "sent" ? "Sent" : "Received"}
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          {formatDate(m.date)}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">{m.subject}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {m.bodyText}
                      </p>
                      {m.hasAttachment && (
                        <p className="text-[11px] text-gray-400 mt-1">Has attachment</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

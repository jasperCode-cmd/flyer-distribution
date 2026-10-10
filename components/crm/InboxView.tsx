"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import EmailComposeModal, { type ReplyContext } from "./EmailComposeModal";
import type { ConversationMessage } from "./EmailsSection";
import { STAGE_LABELS } from "@/lib/crm-constants";

const SEARCH_MAX = 200;

type InboxLead = { id: string; name: string; stage: string; email: string; scrapped: boolean };

type ThreadRow = {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  hasAttachment: boolean;
  messageCount: number;
  lead: InboxLead | null;
};

type LoadStatus = "loading" | "ready" | "not_configured" | "reconnect" | "error" | "not_found";

type ListState = { status: LoadStatus; threads: ThreadRow[]; nextPageToken: string | null };

type OpenThread = {
  status: LoadStatus;
  message?: string;
  thread?: {
    id: string;
    subject: string;
    counterparty: { name: string; address: string } | null;
    replyTo: { name: string; address: string } | null;
    recipient: { name: string; address: string } | null;
    lastMessageId: string | null;
    messages: ConversationMessage[];
  };
  lead?: InboxLead | null;
  // Who a reply goes to, as worked out by the server from the thread.
  recipient?: string;
};

// Maps an API failure to a state. Error text shown to staff is always one of
// these fixed strings or the route's own fixed message, never Google's.
function failureStatus(res: Response, data: { configured?: boolean; reason?: string }): LoadStatus {
  if (data.configured === false || data.reason === "not_configured") return "not_configured";
  if (data.reason === "reconnect") return "reconnect";
  if (res.status === 404) return "not_found";
  return "error";
}

function formatRowDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LeadBadge({ lead }: { lead: InboxLead }) {
  return (
    <Link
      href={`/admin/crm/leads/${lead.id}`}
      className="relative z-10 pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
    >
      <span className="truncate">{lead.name}</span>
      <span className="shrink-0 font-normal text-blue-600">
        · {lead.scrapped ? "Scrapped" : STAGE_LABELS[lead.stage] ?? lead.stage}
      </span>
    </Link>
  );
}

function PaperclipIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Has attachment" role="img">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function StateCard({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ConnectionState({ status, onRetry }: { status: LoadStatus; onRetry: () => void }) {
  if (status === "not_configured") {
    return (
      <StateCard
        title="Gmail is not connected"
        body="The CRM's Gmail account hasn't been set up yet. Ask an administrator to run the connection script, then try again."
      />
    );
  }
  if (status === "reconnect") {
    return (
      <StateCard
        title="Gmail needs to be reconnected"
        body="The CRM's connection to Gmail has expired or been revoked. Ask an administrator to run the connection script again, then refresh this page."
      />
    );
  }
  return (
    <StateCard
      title="Could not load the inbox"
      body="Something went wrong talking to Gmail. Please try again."
      action={
        <button type="button" onClick={onRetry} className="text-xs font-semibold text-blue-700 hover:underline">
          Try again
        </button>
      }
    />
  );
}

export default function InboxView() {
  const { data: session } = useSession();
  const userFirstName = (session?.user?.name ?? "").split(" ")[0] || "the team";

  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  // Gmail only hands out forward page tokens, so Previous walks back
  // through the tokens already used. The last entry is the current page.
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [list, setList] = useState<ListState>({ status: "loading", threads: [], nextPageToken: null });
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const currentToken = pageTokens[pageTokens.length - 1];

  useEffect(() => {
    let cancelled = false;
    setList((l) => ({ ...l, status: "loading" }));
    const params = new URLSearchParams();
    if (currentToken) params.set("pageToken", currentToken);
    if (activeQuery) params.set("q", activeQuery);
    fetch(`/api/crm/inbox/threads?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.configured === false) {
          setList({ status: failureStatus(res, data), threads: [], nextPageToken: null });
          return;
        }
        setList({ status: "ready", threads: data.threads ?? [], nextPageToken: data.nextPageToken ?? null });
      })
      .catch(() => {
        if (!cancelled) setList({ status: "error", threads: [], nextPageToken: null });
      });
    return () => {
      cancelled = true;
    };
  }, [currentToken, activeQuery, reloadKey]);

  const loadThread = useCallback(async (id: string) => {
    setOpen({ status: "loading" });
    try {
      const res = await fetch(`/api/crm/inbox/threads/${id}`);
      const data = await res.json();
      if (!res.ok || data.configured === false) {
        setOpen({ status: failureStatus(res, data), message: res.status === 404 ? data.error : undefined });
        return;
      }
      setOpen({ status: "ready", thread: data.thread, lead: data.lead, recipient: data.recipient });
    } catch {
      setOpen({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function openThread(id: string) {
    setSelectedId(id);
    loadThread(id);
  }

  function closeThread() {
    setSelectedId(null);
    setOpen(null);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim().slice(0, SEARCH_MAX);
    setActiveQuery(q);
    setPageTokens([null]);
  }

  function clearSearch() {
    setSearchInput("");
    setActiveQuery("");
    setPageTokens([null]);
  }

  const thread = open?.status === "ready" ? open.thread : undefined;
  const lastMessage = thread?.messages[thread.messages.length - 1];
  // Stable across re-renders: the compose modal resets its draft whenever
  // this object changes, so a fresh object per render would wipe typing.
  const threadId = thread?.id;
  const threadSubject = thread?.subject;
  const threadLastMessageId = thread?.lastMessageId;
  const replyContext = useMemo<ReplyContext | null>(
    () =>
      threadId
        ? { subject: threadSubject ?? "", threadId, lastMessageId: threadLastMessageId ?? "" }
        : null,
    [threadId, threadSubject, threadLastMessageId]
  );
  const counterparty = thread?.counterparty ?? null;
  // A new lead is for the person a reply goes to: the Reply-To when there is
  // one (a form service writing on a customer's behalf), else the sender.
  const leadCandidate = thread?.recipient ?? counterparty;

  // Gmail unusable: no search, list or reading pane, just what to do about it.
  const connectionProblem = list.status === "not_configured" || list.status === "reconnect";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-blue-900 mb-1">Inbox</h1>
          <p className="text-sm text-gray-500">
            A read-only view of the Gmail inbox. Opening a conversation here does not mark it as read.
          </p>
        </div>
        {!connectionProblem && (
          <form onSubmit={submitSearch} className="flex w-full sm:w-auto gap-2" role="search">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={SEARCH_MAX}
              placeholder="Search the inbox"
              aria-label="Search the inbox"
              className="flex-1 sm:w-72 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-md">
              Search
            </button>
          </form>
        )}
      </div>

      {connectionProblem ? (
        <div className="max-w-xl">
          <ConnectionState status={list.status} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-4 lg:items-start">
          {/* List */}
          <section aria-label="Conversations" className={selectedId ? "hidden lg:block" : "block"}>
            <div className="flex items-center justify-between gap-2 mb-2 text-xs text-gray-500">
              <span>
                {activeQuery ? (
                  <>
                    Results for <span className="font-semibold text-gray-700">{activeQuery}</span>{" "}
                    <button type="button" onClick={clearSearch} className="ml-1 font-semibold text-blue-700 hover:underline">
                      Clear
                    </button>
                  </>
                ) : (
                  "Newest first"
                )}
              </span>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                disabled={list.status === "loading"}
                className="font-semibold text-blue-700 hover:underline disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            {list.status === "loading" ? (
              <StateCard title="Loading inbox..." body="Fetching the latest conversations from Gmail." />
            ) : list.status !== "ready" ? (
              <ConnectionState status={list.status} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : list.threads.length === 0 ? (
              <StateCard
                title={activeQuery ? "No matching emails" : "Your inbox is empty"}
                body={activeQuery ? "Nothing in the inbox matches that search." : "New emails will appear here."}
              />
            ) : (
              <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {list.threads.map((t) => (
                  <li
                    key={t.id}
                    className={`relative px-3 py-3 ${selectedId === t.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      aria-label={`Open conversation from ${t.fromName || t.fromAddress}: ${t.subject}`}
                      className="absolute inset-0 w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    />
                    <div className="relative pointer-events-none flex gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-blue-600" : "bg-transparent"}`}
                        aria-label={t.unread ? "Unread" : undefined}
                        role={t.unread ? "img" : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-sm ${t.unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                            {t.fromName || t.fromAddress || "(unknown sender)"}
                            {t.messageCount > 1 && <span className="ml-1 font-normal text-gray-400">({t.messageCount})</span>}
                          </p>
                          <span className="shrink-0 text-[11px] text-gray-400 whitespace-nowrap">{formatRowDate(t.date)}</span>
                        </div>
                        {t.fromName && t.fromAddress && t.fromName !== t.fromAddress && (
                          <p className="truncate text-[11px] text-gray-400">{t.fromAddress}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className={`truncate text-sm ${t.unread ? "font-semibold text-gray-800" : "text-gray-700"}`}>{t.subject}</p>
                          {t.hasAttachment && <PaperclipIcon />}
                        </div>
                        <p className="truncate text-xs text-gray-500 mt-0.5">{t.snippet}</p>
                        {t.lead && (
                          <div className="mt-1.5">
                            <LeadBadge lead={t.lead} />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {list.status === "ready" && (pageTokens.length > 1 || list.nextPageToken) && (
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={() => setPageTokens((s) => s.slice(0, -1))}
                  disabled={pageTokens.length <= 1}
                  className="border border-gray-300 bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {pageTokens.length}</span>
                <button
                  type="button"
                  onClick={() => list.nextPageToken && setPageTokens((s) => [...s, list.nextPageToken])}
                  disabled={!list.nextPageToken}
                  className="border border-gray-300 bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </section>

          {/* Thread. Full screen below lg, the right-hand pane from lg up. */}
          <section
            aria-label="Conversation"
            className={`${
              selectedId ? "fixed inset-0 z-[45] overflow-y-auto bg-gray-100 p-3 sm:p-6" : "hidden"
            } lg:static lg:z-auto lg:block lg:overflow-visible lg:bg-transparent lg:p-0`}
          >
            {selectedId && (
              <button
                type="button"
                onClick={closeThread}
                className="lg:hidden mb-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to inbox
              </button>
            )}

            {!selectedId || !open ? (
              <div className="hidden lg:block">
                <StateCard title="No conversation selected" body="Choose a conversation from the list to read it here." />
              </div>
            ) : open.status === "loading" ? (
              <StateCard title="Loading conversation..." body="Fetching the messages from Gmail." />
            ) : open.status === "not_found" ? (
              <StateCard title="Conversation not available" body={open.message ?? "This conversation is no longer in the inbox."} />
            ) : open.status !== "ready" || !thread ? (
              <ConnectionState status={open.status} onRetry={() => selectedId && loadThread(selectedId)} />
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-blue-900 break-words">{thread.subject}</h2>
                    {counterparty && (
                      <p className="text-xs text-gray-500 mt-0.5 wrap-break-word">
                        {counterparty.name && counterparty.name !== counterparty.address ? (
                          <>
                            <span className="font-semibold text-gray-700">{counterparty.name}</span> &lt;{counterparty.address}&gt;
                          </>
                        ) : (
                          counterparty.address
                        )}
                      </p>
                    )}
                    {thread.replyTo && thread.replyTo.address !== counterparty?.address && (
                      <p className="text-xs text-gray-500 wrap-break-word">
                        Reply-To: {thread.replyTo.name !== thread.replyTo.address ? `${thread.replyTo.name} <${thread.replyTo.address}>` : thread.replyTo.address}
                      </p>
                    )}
                    <div className="mt-2">
                      {open.lead ? (
                        <LeadBadge lead={open.lead} />
                      ) : leadCandidate?.address ? (
                        <Link
                          href={`/admin/crm/leads/new?${new URLSearchParams({
                            name: leadCandidate.name !== leadCandidate.address ? leadCandidate.name : "",
                            email: leadCandidate.address,
                            source: "OTHER",
                          }).toString()}`}
                          className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Create lead from this sender
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {lastMessage && open.recipient && (
                    <button
                      type="button"
                      onClick={() => setComposeOpen(true)}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-md"
                    >
                      Reply
                    </button>
                  )}
                </div>

                <ul className="space-y-3">
                  {thread.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-md border p-3 ${
                        m.direction === "sent"
                          ? "bg-blue-50 border-blue-100 ml-0 sm:ml-6"
                          : "bg-gray-50 border-gray-200 mr-0 sm:mr-6"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className={`text-[11px] font-semibold ${m.direction === "sent" ? "text-blue-700" : "text-gray-600"}`}>
                          {m.direction === "sent" ? "Sent" : "Received"}
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatFullDate(m.date)}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1 wrap-break-word">{m.from}</p>
                      {/* Plain text only: bodyText was converted on the server and
                          is rendered as a text node, never as HTML. */}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{m.bodyText}</p>
                      {m.hasAttachment && <p className="text-[11px] text-gray-400 mt-1">Has attachment (not downloaded)</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {thread && open?.recipient && (
        <EmailComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          sendUrl={`/api/crm/inbox/threads/${thread.id}/reply`}
          toAddress={open.recipient}
          showReplyingTo
          configured
          configuredKnown
          userFirstName={userFirstName}
          replyTo={replyContext}
          onSent={(result) => {
            setToast({
              text: result.movedToAwaitingResponse ? "Reply sent. Lead moved to Awaiting Response." : "Reply sent",
              kind: "success",
            });
            loadThread(thread.id);
          }}
          onError={(message) => setToast({ text: message, kind: "error" })}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-white text-sm font-medium rounded-full shadow-lg px-4 py-2 ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

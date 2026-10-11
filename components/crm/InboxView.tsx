"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import EmailComposeModal, { sentLabel, type ReplyContext } from "./EmailComposeModal";
import type { ConversationMessage } from "./EmailsSection";
import { STAGE_LABELS } from "@/lib/crm-constants";
import { appendUniqueThreads, inboxFilterUrl } from "@/lib/inbox-list";

const SEARCH_MAX = 200;

type InboxLead = { id: string; name: string; stage: string; email: string; scrapped: boolean };
type InboxDistributor = { id: string; name: string };
type InboxApplicant = { id: string; fullName: string };
type CategoryOption = { id: string; label: string };

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
  distributor?: InboxDistributor | null;
  applicant?: InboxApplicant | null;
};

type LoadStatus = "loading" | "ready" | "not_configured" | "reconnect" | "error" | "not_found";

// "pages": a Gmail-query filter, paged by Gmail with Previous and Next.
// "scan": a CRM filter, read in batches and continued with Load more; there
// is never a total, only what has been found so far.
type ListState = {
  status: LoadStatus;
  threads: ThreadRow[];
  mode: "pages" | "scan";
  nextPageToken: string | null;
  cursor: string | null;
  loadingMore: boolean;
  // The last Load more found nothing new in the emails it checked.
  lastBatchEmpty: boolean;
};

const EMPTY_LIST: Omit<ListState, "status"> = {
  threads: [],
  mode: "pages",
  nextPageToken: null,
  cursor: null,
  loadingMore: false,
  lastBatchEmpty: false,
};

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
  distributor?: InboxDistributor | null;
  applicant?: InboxApplicant | null;
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

// A Distributor outranks an application from the same address: once someone
// is delivering for us, that's what matters about them.
function PeopleBadge({ distributor, applicant }: { distributor?: InboxDistributor | null; applicant?: InboxApplicant | null }) {
  if (distributor) {
    return (
      <Link
        href="/admin/crm/distributors"
        className="relative z-10 pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 hover:bg-green-100"
      >
        <span className="shrink-0">Distributor</span>
        <span className="truncate font-normal">· {distributor.name}</span>
      </Link>
    );
  }
  if (applicant) {
    return (
      <Link
        href={`/admin/crm/applications/${applicant.id}`}
        className="relative z-10 pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full border border-yellow-100 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 hover:bg-yellow-100"
      >
        <span className="shrink-0">Applicant</span>
        <span className="truncate font-normal">· {applicant.fullName}</span>
      </Link>
    );
  }
  return null;
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

export default function InboxView({
  categories,
  initialCategory,
  initialUnread,
}: {
  categories: CategoryOption[];
  initialCategory: string;
  initialUnread: boolean;
}) {
  const { data: session } = useSession();
  const userFirstName = (session?.user?.name ?? "").split(" ")[0] || "the team";

  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  // Gmail only hands out forward page tokens, so Previous walks back
  // through the tokens already used. The last entry is the current page.
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [list, setList] = useState<ListState>({ status: "loading", ...EMPTY_LIST });
  const [reloadKey, setReloadKey] = useState(0);
  const [category, setCategory] = useState(initialCategory);
  const [unreadOnly, setUnreadOnly] = useState(initialUnread);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newEmailOpen, setNewEmailOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const currentToken = pageTokens[pageTokens.length - 1];

  const listParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams(extra);
      if (category !== "all") params.set("category", category);
      if (unreadOnly) params.set("unread", "1");
      if (activeQuery) params.set("q", activeQuery);
      return params.toString();
    },
    [category, unreadOnly, activeQuery]
  );

  useEffect(() => {
    let cancelled = false;
    setList((l) => ({ ...l, status: "loading" }));
    fetch(`/api/crm/inbox/threads?${listParams(currentToken ? { pageToken: currentToken } : {})}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.configured === false) {
          setList({ status: failureStatus(res, data), ...EMPTY_LIST });
          return;
        }
        setList({
          ...EMPTY_LIST,
          status: "ready",
          threads: data.threads ?? [],
          mode: data.mode === "scan" ? "scan" : "pages",
          nextPageToken: data.nextPageToken ?? null,
          cursor: data.cursor ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setList({ status: "error", ...EMPTY_LIST });
      });
    return () => {
      cancelled = true;
    };
  }, [currentToken, listParams, reloadKey]);

  // Carries a CRM filter's scan on from where it stopped, adding only
  // conversations not already listed.
  async function loadMore() {
    if (!list.cursor || list.loadingMore) return;
    setList((l) => ({ ...l, loadingMore: true }));
    try {
      const res = await fetch(`/api/crm/inbox/threads?${listParams({ cursor: list.cursor })}`);
      const data = await res.json();
      if (!res.ok || data.configured === false) {
        setList((l) => ({ ...l, loadingMore: false }));
        setToast({ text: "Couldn't load more conversations. Try again.", kind: "error" });
        return;
      }
      setList((l) => {
        const threads = appendUniqueThreads(l.threads, data.threads ?? []);
        return {
          ...l,
          threads,
          cursor: data.cursor ?? null,
          loadingMore: false,
          lastBatchEmpty: threads.length === l.threads.length,
        };
      });
    } catch {
      setList((l) => ({ ...l, loadingMore: false }));
      setToast({ text: "Couldn't load more conversations. Try again.", kind: "error" });
    }
  }

  // A new filter starts from the newest emails, and goes in the address so
  // Refresh and the back button keep it.
  function changeFilter(next: { category?: string; unread?: boolean }) {
    const nextCategory = next.category ?? category;
    const nextUnread = next.unread ?? unreadOnly;
    setCategory(nextCategory);
    setUnreadOnly(nextUnread);
    setPageTokens([null]);
    window.history.replaceState(null, "", inboxFilterUrl(nextCategory, nextUnread));
  }

  const loadThread = useCallback(async (id: string) => {
    setOpen({ status: "loading" });
    try {
      const res = await fetch(`/api/crm/inbox/threads/${id}`);
      const data = await res.json();
      if (!res.ok || data.configured === false) {
        setOpen({ status: failureStatus(res, data), message: res.status === 404 ? data.error : undefined });
        return;
      }
      setOpen({
        status: "ready",
        thread: data.thread,
        lead: data.lead,
        distributor: data.distributor,
        applicant: data.applicant,
        recipient: data.recipient,
      });
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
  const filtered = !!activeQuery || category !== "all" || unreadOnly;

  const loadMoreButton = (
    <button
      type="button"
      onClick={loadMore}
      disabled={list.loadingMore}
      className="border border-gray-300 bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-60"
    >
      {list.loadingMore ? "Checking older emails..." : "Load more"}
    </button>
  );

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
          <div className="flex w-full sm:w-auto flex-col-reverse sm:flex-row gap-2">
            <form onSubmit={submitSearch} className="flex w-full sm:w-auto gap-2" role="search">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={SEARCH_MAX}
                placeholder="Search the inbox"
                aria-label="Search the inbox"
                className="min-w-0 flex-1 sm:w-72 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-md">
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={() => setNewEmailOpen(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-sm font-bold px-4 py-2 rounded-md whitespace-nowrap"
            >
              New email
            </button>
          </div>
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
            {/* One row; on a phone it scrolls sideways rather than wrapping. */}
            <div
              role="group"
              aria-label="Filter conversations"
              className="-mx-3 px-3 sm:mx-0 sm:px-0 mb-2 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1"
            >
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => category !== c.id && changeFilter({ category: c.id })}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === c.id
                      ? "bg-blue-700 border-blue-700 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
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
              <div className="flex shrink-0 items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={(e) => changeFilter({ unread: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  Unread only
                </label>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  disabled={list.status === "loading"}
                  className="font-semibold text-blue-700 hover:underline disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>
            </div>

            {list.status === "loading" ? (
              <StateCard title="Loading inbox..." body="Fetching the latest conversations from Gmail." />
            ) : list.status !== "ready" ? (
              <ConnectionState status={list.status} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : list.threads.length === 0 ? (
              list.mode === "scan" && list.cursor ? (
                <StateCard
                  title="No matches in the latest emails"
                  body="Only the most recent emails have been checked so far."
                  action={loadMoreButton}
                />
              ) : (
                <StateCard
                  title={filtered ? "No matching conversations" : "Your inbox is empty"}
                  body={
                    activeQuery
                      ? "Nothing in the inbox matches that search."
                      : filtered
                        ? "Nothing in the inbox matches this filter."
                        : "New emails will appear here."
                  }
                />
              )
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
                        {(t.lead || t.distributor || t.applicant) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.lead && <LeadBadge lead={t.lead} />}
                            <PeopleBadge distributor={t.distributor} applicant={t.applicant} />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {list.status === "ready" && list.mode === "scan" && list.threads.length > 0 && (
              <div className="mt-3 text-center">
                {list.lastBatchEmpty && list.cursor && (
                  <p className="mb-2 text-xs text-gray-500">No more matches in the next batch of emails.</p>
                )}
                {list.cursor ? loadMoreButton : <p className="text-xs text-gray-400">No more conversations to check.</p>}
              </div>
            )}

            {list.status === "ready" && list.mode === "pages" && (pageTokens.length > 1 || list.nextPageToken) && (
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
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {open.lead ? (
                        <LeadBadge lead={open.lead} />
                      ) : leadCandidate?.address && !open.distributor && !open.applicant ? (
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
                      <PeopleBadge distributor={open.distributor} applicant={open.applicant} />
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
              text: `${sentLabel("Reply", result)}${result.movedToAwaitingResponse ? ". Lead moved to Awaiting Response." : ""}`,
              kind: "success",
            });
            loadThread(thread.id);
          }}
          onError={(message) => setToast({ text: message, kind: "error" })}
        />
      )}

      {/* A new email to a typed address. The server decides whether it is a
          lead's (recorded on the lead) or anyone else's (nothing recorded). */}
      <EmailComposeModal
        open={newEmailOpen}
        onClose={() => setNewEmailOpen(false)}
        sendUrl="/api/crm/inbox/new-email"
        lookupUrl="/api/crm/inbox/new-email"
        toEditable
        toAddress=""
        configured
        configuredKnown
        userFirstName={userFirstName}
        replyTo={null}
        onSent={(result) => {
          const recorded = result.recordedOnLead && result.leadName ? ` and recorded on ${result.leadName}` : "";
          setToast({
            text: `${sentLabel("Email", result)}${recorded}.${result.movedToAwaitingResponse ? " Lead moved to Awaiting Response." : ""}`,
            kind: "success",
          });
        }}
        onError={(message) => setToast({ text: message, kind: "error" })}
      />

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

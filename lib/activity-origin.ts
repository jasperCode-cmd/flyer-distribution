// Whether a person logged an activity by hand: a call, an email sent from
// the CRM, or a note someone wrote. The CRM also writes notes itself when
// something changes elsewhere (a retainer, a won date, a bulk action, Still
// in talks on Priorities), and stage changes; none of those is contact with
// the lead.
//
// No column records who wrote a note, so the CRM's own notes are recognised
// by having no user at all (the website form's note) or by their fixed
// wording below. A test checks that every route writing a note is either
// one a person types into or carries one of these wordings.

export type ActivityOrigin = { type: string; detail: string; userId: string | null };

// The wording of every note the CRM writes for itself.
export const SYSTEM_NOTE_PATTERNS: readonly RegExp[] = [
  // Retainer and won date changes on the Profit page.
  / on the Profit page$/,
  // Still in talks on the Priorities page.
  /^Still in talks\. Snoozed on Priorities /,
  // Reassigning or changing the source of several leads at once.
  / \(bulk action\)$/,
  // Duplicating a lead.
  /^Duplicated from /,
  // A notes column brought in by the spreadsheet import.
  /^Imported note: /,
  // The website quote form's details.
  /^Service type: /,
  // A quote or invoice accepted, declined, paid or voided.
  /^(Quote QUO|Invoice INV)-\d+ /,
];

export function isSystemNote(detail: string): boolean {
  return SYSTEM_NOTE_PATTERNS.some((re) => re.test(detail));
}

export function isPersonLoggedContact(activity: ActivityOrigin): boolean {
  if (activity.type === "CALL" || activity.type === "EMAIL") return true;
  if (activity.type !== "NOTE") return false;
  return activity.userId !== null && !isSystemNote(activity.detail);
}

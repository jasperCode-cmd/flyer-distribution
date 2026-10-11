// Shared by the public Work With Us form and its tests. Nothing here may
// change what Web3Forms receives: the email for each application is sent
// exactly as before, and the CRM copy is a separate, best-effort request.

export const DISTRIBUTOR_APPLICATION_SUBJECT = "New Distributor Application - Flyer Distribution Hampshire";
export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
export const APPLICATION_ENDPOINT = "/api/distributor-application";

// A field people never see or fill in. Bots that fill every input fill this
// one too, and the CRM endpoint then quietly drops the submission. It is
// never sent to Web3Forms, so the email is unchanged.
export const APPLICATION_HONEYPOT_FIELD = "fdh_extra_details";

// The form fields the CRM copy needs, by their names on the form.
const CRM_FIELDS = ["name", "phone", "email", "area", "age", "has-car", "has-licence", "availability"] as const;

type Entries = Record<string, FormDataEntryValue>;

export function splitApplicationEntries(entries: Entries): {
  web3forms: Entries;
  crm: Record<string, string>;
} {
  const web3forms: Entries = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key !== APPLICATION_HONEYPOT_FIELD) web3forms[key] = value;
  }
  const crm: Record<string, string> = {};
  for (const key of [...CRM_FIELDS, APPLICATION_HONEYPOT_FIELD]) {
    const value = entries[key];
    if (typeof value === "string") crm[key] = value;
  }
  return { web3forms, crm };
}

// Never throws and is never awaited by the caller, so a CRM failure (or a
// slow response) can't change what the applicant sees.
function saveToCrm(crm: Record<string, string>, fetchFn: typeof fetch) {
  try {
    fetchFn(APPLICATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crm),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nothing to do: the email has already been sent.
  }
}

// Returns true when Web3Forms accepted the application, exactly as the form
// decided success before. Only then is the CRM copy sent, as the quote form
// does with its lead.
export async function submitDistributorApplication(
  entries: Entries,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const { web3forms, crm } = splitApplicationEntries(entries);
  const res = await fetchFn(WEB3FORMS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(web3forms),
  });
  const json = await res.json();
  if (!json.success) return false;
  saveToCrm(crm, fetchFn);
  return true;
}

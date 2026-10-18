// The bank details printed on invoices. They only ever come from the
// environment (PAYMENT_ACCOUNT_NAME, PAYMENT_SORT_CODE, PAYMENT_ACCOUNT_NUMBER),
// are the same for both businesses for now, and are never written to code,
// logs or error messages. Without all three, invoices can't be downloaded or
// sent, and the CRM says which setting is missing (the names are not
// secret, the values are).

export const PAYMENT_ENV_NAMES = ["PAYMENT_ACCOUNT_NAME", "PAYMENT_SORT_CODE", "PAYMENT_ACCOUNT_NUMBER"] as const;

export type PaymentDetails = { accountName: string; sortCode: string; accountNumber: string };

export type PaymentDetailsResult =
  | { ok: true; details: PaymentDetails }
  | { ok: false; problems: string[]; message: string };

type Env = Record<string, string | undefined>;

export function readPaymentDetails(env: Env = process.env): PaymentDetailsResult {
  const problems: string[] = [];
  const accountName = (env.PAYMENT_ACCOUNT_NAME ?? "").replace(/\s+/g, " ").trim();
  const sortDigits = (env.PAYMENT_SORT_CODE ?? "").replace(/[\s-]/g, "");
  const accountNumber = (env.PAYMENT_ACCOUNT_NUMBER ?? "").replace(/\s/g, "");

  if (!accountName) problems.push("PAYMENT_ACCOUNT_NAME is not set");
  else if (accountName.length > 70) problems.push("PAYMENT_ACCOUNT_NAME is too long");
  if (!sortDigits) problems.push("PAYMENT_SORT_CODE is not set");
  else if (!/^\d{6}$/.test(sortDigits)) problems.push("PAYMENT_SORT_CODE is not 6 digits");
  if (!accountNumber) problems.push("PAYMENT_ACCOUNT_NUMBER is not set");
  else if (!/^\d{8}$/.test(accountNumber)) problems.push("PAYMENT_ACCOUNT_NUMBER is not 8 digits");

  if (problems.length > 0) {
    return {
      ok: false,
      problems,
      message: `Invoices can't be downloaded or sent until the bank details are set up: ${problems.join(", ")}.`,
    };
  }
  return {
    ok: true,
    details: {
      accountName,
      sortCode: `${sortDigits.slice(0, 2)}-${sortDigits.slice(2, 4)}-${sortDigits.slice(4, 6)}`,
      accountNumber,
    },
  };
}

// For the browser: whether invoices can go out, and if not why. Never the details.
export function paymentDetailsStatus(env: Env = process.env): { ready: true } | { ready: false; message: string } {
  const result = readPaymentDetails(env);
  return result.ok ? { ready: true } : { ready: false, message: result.message };
}

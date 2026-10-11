// The one place a Distributor's fields are checked and tidied before it is
// created, whether by hand on the Distributors page or from an approved
// application.
export type DistributorInput = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  notes?: unknown;
};

export type DistributorCreateData = {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildDistributorData(
  input: DistributorInput
): { ok: true; data: DistributorCreateData } | { ok: false; error: string } {
  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return { ok: false, error: "Distributor name is required" };
  }
  return {
    ok: true,
    data: {
      name: input.name.trim(),
      phone: optionalText(input.phone),
      email: optionalText(input.email),
      notes: optionalText(input.notes),
    },
  };
}

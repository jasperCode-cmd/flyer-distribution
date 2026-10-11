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

export type DistributorUpdateData = Partial<DistributorCreateData> & { active?: boolean };

// Edit, deactivate and reactivate: only the fields sent change, tidied by
// the same rules as creating one. Deactivating only turns the flag off, so
// every job, payment and shift stays linked to them.
export function buildDistributorUpdate(
  body: Record<string, unknown>
): { ok: true; data: DistributorUpdateData } | { ok: false; error: string } {
  const data: DistributorUpdateData = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { ok: false, error: "Distributor name is required" };
    }
    data.name = body.name.trim();
  }
  if ("phone" in body) data.phone = optionalText(body.phone);
  if ("email" in body) data.email = optionalText(body.email);
  if ("notes" in body) data.notes = optionalText(body.notes);
  if ("active" in body) {
    if (typeof body.active !== "boolean") return { ok: false, error: "Active must be true or false" };
    data.active = body.active;
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to change" };
  return { ok: true, data };
}

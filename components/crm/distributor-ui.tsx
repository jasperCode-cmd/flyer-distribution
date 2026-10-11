import { telHref, whatsAppHref } from "@/lib/distributor-applications";
import { formatUkPhone } from "@/lib/distributor-directory";

// Small pieces shared by the Distributors list and an open distributor.

export function ActiveChip({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-block whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
  ) : (
    <span className="inline-block whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactive</span>
  );
}

function YesNoChip({ value, yes, no }: { value: boolean | null; yes: string; no: string }) {
  if (value === null) return null;
  return value ? (
    <span className="inline-block whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200">
      {yes}
    </span>
  ) : (
    <span className="inline-block whitespace-nowrap rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
      {no}
    </span>
  );
}

// "Car" and "Licence" when they have them, "No car" and "No licence" when
// they said not, nothing when unknown; "-" for someone added by hand.
export function CarLicenceChips({ car, licence, manual }: { car: boolean | null; licence: boolean | null; manual: boolean }) {
  if (manual || (car === null && licence === null)) return <span className="text-sm text-gray-400">-</span>;
  return (
    <span className="flex flex-wrap gap-1">
      <YesNoChip value={car} yes="Car" no="No car" />
      <YesNoChip value={licence} yes="Licence" no="No licence" />
    </span>
  );
}

const SMALL_LINK =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function PhoneCell({ phone, name }: { phone: string | null; name: string }) {
  const shown = formatUkPhone(phone);
  if (!shown) return <span className="text-gray-400">-</span>;
  const tel = telHref(phone);
  const whatsApp = whatsAppHref(phone);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="whitespace-nowrap tabular-nums">{shown}</span>
      <span className="flex gap-1">
        {tel && (
          <a href={tel} aria-label={`Call ${name}`} className={`${SMALL_LINK} border-blue-200 text-blue-800 hover:bg-blue-50`}>
            Call
          </a>
        )}
        {whatsApp && (
          <a
            href={whatsApp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${name}`}
            className={`${SMALL_LINK} border-green-200 text-green-800 hover:bg-green-50`}
          >
            WhatsApp
          </a>
        )}
      </span>
    </span>
  );
}

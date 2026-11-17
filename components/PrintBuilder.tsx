"use client";

import Link from "next/link";
import { useState } from "react";
import {
  applyChange,
  CARD_TYPES,
  defaultSpec,
  FOLDS,
  PAPER_TYPES,
  papersFor,
  PRODUCTS,
  quoteHrefFor,
  SIDES,
  sizesFor,
  specSummary,
  weightLabel,
  weightsFor,
  type Change,
  type PrintSpec,
} from "@/lib/print-options";

// The print builder: pill buttons for each option the chosen product has
// (product, then fold or card type, size, sides, paper type and weight, or one
// Paper group), corrected as they change so the choice is always one we print.
//
// Page mode, "Build your print" on /leaflet-printing: a white card that keeps
// its own choice, with a link that takes it to the quote form. The server
// renders the default choice, so the card and its link work before this loads.
//
// Form mode, "Your print" in the quote form's Leaflet Printing questions: the
// same groups, pills, corrections and notes on a light grey panel, without the
// link; the form holds the choice (spec and onSpecChange), sends it, and its
// "Change" link brings this panel into view and focuses it (id).

const LEGEND = "mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#4b5563]";
const PILL =
  "inline-flex min-h-11 items-center rounded-[12px] border px-4 text-[15px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2";
const SELECTED = "border-[#1e3a8a] bg-[#1e3a8a] text-white";
const UNSELECTED = "border-[#cbd5e1] bg-white text-[#172554] hover:border-[#1e3a8a]";
const BUTTON =
  "inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#facc15] px-6 text-[17px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] focus-visible:ring-offset-2 motion-reduce:hover:scale-100";

const NOTES: Partial<Record<PrintSpec["product"], string>> = {
  folded: "Folded leaflets are always printed double-sided, and heavier papers are creased before folding.",
  cards: "Business cards are the standard 85 x 55mm size.",
  custom: "Cut to any shape you like. We will confirm the size with you on the call.",
};

function Group<T extends string | number>({
  legend,
  options,
  value,
  onPick,
}: {
  legend: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LEGEND}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === value}
            onClick={() => onPick(o.id)}
            className={`${PILL} ${o.id === value ? SELECTED : UNSELECTED}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type Props =
  | { mode?: "page" }
  | { mode: "form"; spec: PrintSpec; onSpecChange: (spec: PrintSpec) => void; id: string };

export default function PrintBuilder(props: Props) {
  const [own, setOwn] = useState<PrintSpec>(() => defaultSpec());
  const form = props.mode === "form" ? props : null;
  const spec = form ? form.spec : own;
  const change = (c: Change) => (form ? form.onSpecChange(applyChange(form.spec, c)) : setOwn((s) => applyChange(s, c)));
  const note = NOTES[spec.product];

  const groups = (
    <>
      <Group legend="Product" options={PRODUCTS} value={spec.product} onPick={(product) => change({ product })} />
      {spec.product === "folded" && <Group legend="Fold" options={FOLDS} value={spec.fold} onPick={(fold) => change({ fold })} />}
      {spec.product === "cards" && <Group legend="Card type" options={CARD_TYPES} value={spec.card} onPick={(card) => change({ card })} />}
      {(spec.product === "flyers" || spec.product === "folded") && (
        <Group legend="Size" options={sizesFor(spec).map((s) => ({ id: s, label: s }))} value={spec.size} onPick={(size) => change({ size })} />
      )}
      {(spec.product === "flyers" || spec.product === "custom") && (
        <Group legend="Sides" options={SIDES} value={spec.sides} onPick={(sides) => change({ sides })} />
      )}
      {(spec.product === "flyers" || spec.product === "folded") && (
        <>
          <Group legend="Paper type" options={PAPER_TYPES} value={spec.ptype} onPick={(ptype) => change({ ptype })} />
          <Group
            legend="Paper weight"
            options={weightsFor(spec.product, spec.ptype).map((w) => ({ id: w, label: weightLabel(w, spec.ptype) }))}
            value={spec.weight}
            onPick={(weight) => change({ weight })}
          />
        </>
      )}
      {(spec.product === "cards" || spec.product === "custom") && (
        <Group legend="Paper" options={papersFor(spec)} value={spec.paper} onPick={(paper) => change({ paper })} />
      )}
      {note && <p className="rounded-[12px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[15px] text-[#1e3a8a]">{note}</p>}
      <p className="text-[15px] text-[#4b5563]">Lamination, spot UV, foil and perforation are also available. Ask us on the call.</p>
    </>
  );
  const choice = (
    <p className="text-[16px] text-[#374151]" aria-live="polite">
      Your choice: <strong className="text-[#172554]">{specSummary(spec)}</strong>
    </p>
  );

  if (form) {
    return (
      <div
        id={form.id}
        tabIndex={-1}
        role="group"
        aria-labelledby={`${form.id}-heading`}
        className="scroll-mt-20 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <h4 id={`${form.id}-heading`} className="font-sans font-bold text-[18px] leading-tight text-[#172554]">
          Your print
        </h4>
        <div className="mt-4 flex flex-col gap-5">{groups}</div>
        <div className="mt-5 border-t border-[#e2e8f0] pt-4">{choice}</div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-[#e2e8f0] bg-white p-[26px] shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <h3 className="font-sans font-bold text-[22px] leading-tight text-[#172554]">Build your print</h3>
      <div className="mt-5 flex flex-col gap-5">{groups}</div>
      <div className="mt-6 flex flex-col gap-4 border-t border-[#e2e8f0] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {choice}
        <Link href={quoteHrefFor(spec)} className={BUTTON}>
          Get this printed
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

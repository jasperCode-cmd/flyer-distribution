"use client";

import { useState, useRef, useEffect, useId } from "react";
import { revealFirstInvalid, showResult } from "@/components/form-result";
import { QUANTITY_PLACEHOLDER, QUANTITY_RANGES } from "@/lib/quote-quantity";
import { defaultSpec, specFields, specFromParams, specSummary, type PrintSpec } from "@/lib/print-options";
import PrintBuilder from "@/components/PrintBuilder";
import {
  DEFAULT_DISTRIBUTION_TYPE,
  DISTRIBUTION_TYPES,
  QUOTE_SERVICES,
  distributionTypeFromParam,
  serviceFromParam,
  type DistributionType,
  type QuoteService,
} from "@/lib/quote-services";

// How many digits the contact number needs before the service's questions show.
const PHONE_DIGITS_TO_CONTINUE = 10;

// inPanel: the form is in the floating Get a Quote panel. From 768px up the
// panel itself is the card there, so the form drops its own border and
// padding and has the panel's full width; below that it looks as on /quote.
export default function QuoteForm({ inPanel = false }: { inPanel?: boolean }) {
  const [serviceType, setServiceType] = useState("");
  // The service's questions, once the contact number has enough digits.
  // They then stay for the visit, even if the number is changed or cleared.
  const [showQuestions, setShowQuestions] = useState(false);
  // Leaflet Distribution asks the quantity first. Any choice folds in the
  // rest of its questions, which then stay for the visit, even if the
  // quantity is changed back.
  const [quantity, setQuantity] = useState("");
  const [quantityChosen, setQuantityChosen] = useState(false);
  const [includePrinting, setIncludePrinting] = useState(false);
  const [includeDesign, setIncludeDesign] = useState(false);
  // Leaflet Distribution: what kind, which names the areas field to suit.
  const [distributionType, setDistributionType] = useState<DistributionType["value"]>(DEFAULT_DISTRIBUTION_TYPE);
  // Leaflet Printing: what to print (the print builder's choice: the defaults,
  // or what the builder on /leaflet-printing sent), whether to design it, and
  // whether to deliver it door to door too.
  const [printSpec, setPrintSpec] = useState<PrintSpec>(() => defaultSpec());
  const [printDesign, setPrintDesign] = useState(false);
  const [alsoDeliver, setAlsoDeliver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Each time someone chooses a card (click, tap or keyboard, the one already
  // chosen included), the start of the form is brought into view if it is
  // off screen. Counted, so choosing the same card again still asks.
  const [cardChoices, setCardChoices] = useState(0);
  const detailsRef = useRef<HTMLDivElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  // The result once sent: the success message, or the banner if sending failed.
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultId = useId();
  const printBuilderId = useId();

  // After sending, the result is brought into view below the header and focused.
  useEffect(() => {
    if (submitted) showResult(successRef.current);
  }, [submitted]);
  useEffect(() => {
    if (error) showResult(errorRef.current);
  }, [error]);
  // A field the browser won't accept is brought into view with its message.
  // The form only exists once a service is chosen.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.addEventListener("invalid", revealFirstInvalid, true);
    return () => form.removeEventListener("invalid", revealFirstInvalid, true);
  }, [serviceType, submitted]);

  // Once the form is there for the card just chosen.
  useEffect(() => {
    if (cardChoices) showDetails(detailsRef.current, firstNameRef.current);
  }, [cardChoices]);

  // A link can choose the service: /quote?service=leaflet, printing, web or
  // screen, or Leaflet Distribution and its kind: public-notice, hand-to-hand or b2b.
  // With printing, the print builder's link also carries its spec (item, size,
  // sides, ptype, weight, fold, card, paper), checked against lib/print-options.ts:
  // the form's builder starts on it. Anything it doesn't offer is ignored, and
  // without a valid item the builder starts on the defaults.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("service");
    const chosen = serviceFromParam(param);
    if (chosen) setServiceType(chosen);
    const kind = distributionTypeFromParam(param);
    if (kind) setDistributionType(kind);
    const spec = chosen === "Leaflet Printing" ? specFromParams(params) : null;
    if (spec) setPrintSpec(spec);
  }, []);

  const isLeaflet = serviceType === "Leaflet Distribution";
  const isPrinting = serviceType === "Leaflet Printing";
  const areasField = DISTRIBUTION_TYPES.find((t) => t.value === distributionType) ?? DISTRIBUTION_TYPES[0];
  const isWebDesign = serviceType === "Web Design & SEO";
  const isScreenHire = serviceType === "Screen Hire";
  const printFields = specFields(printSpec);

  // The top bar's Change link: the form's print builder, brought into view
  // below the header (smoothly, or at once with reduced motion) and focused.
  function goToPrintBuilder(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const builder = document.getElementById(printBuilderId);
    if (!builder) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    builder.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
    builder.focus({ preventScroll: true });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    setIsSubmitting(true);
    setError(false);

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        formRef.current?.reset();
        setServiceType("");
        setIncludePrinting(false);
        setIncludeDesign(false);
        setQuantity("");
        setDistributionType(DEFAULT_DISTRIBUTION_TYPE);
        setPrintSpec(defaultSpec());
        setPrintDesign(false);
        setAlsoDeliver(false);

        // Best-effort CRM lead capture, alongside the Web3Forms email
        // above. Never allowed to affect the user-facing success state.
        fetch("/api/quote-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).catch(() => {});
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="region"
        aria-labelledby={`${resultId}-title`}
        aria-describedby={`${resultId}-text`}
        className="bg-white rounded-lg border border-gray-200 p-8 text-center scroll-mt-20 focus:outline-none"
      >
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h2 id={`${resultId}-title`} className="text-xl font-bold text-blue-900 mb-2">Request Received</h2>
        <p id={`${resultId}-text`} className="text-gray-600 text-lg">
          Thank you, we will be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-8${inPanel ? " md:border-0 md:p-0" : ""}`}>
      <h2 className="text-xl font-bold text-blue-900">Get Your Free Quote</h2>
      <p className="mt-1 text-gray-600">
        Free, with no obligation. We&apos;ll be in touch within 24 hours.
      </p>

      {/* The service, as one choice of four cards. The radios sit outside
          the form, so they are never sent themselves: the choice goes as
          "service", from the hidden field after Company below. */}
      <fieldset className="mt-7">
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
          What do you need?
        </legend>
        {/* Leaflet Distribution leads: a full-width card on top, larger than
            the rest, then the other three in an equal row under it (one
            column on phones). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUOTE_SERVICES.map((s) => {
            const chosen = serviceType === s.value;
            // The leaflet card: light blue with a navy border until chosen,
            // then navy with a yellow ring, with a "Most popular" badge
            // either way. Its focus ring is yellow, set off from the card.
            const featured = s.param === "leaflet";
            const dark = featured && chosen;
            const look = featured
              ? `sm:col-span-3 grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] items-start sm:items-center gap-x-4 sm:gap-x-6 gap-y-2 p-5 sm:px-7 sm:py-7 border-[#1e3a8a] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[#facc15] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white ${
                  chosen
                    ? "bg-[#1e3a8a] ring-[3px] ring-[#facc15] shadow-[0_12px_28px_-10px_rgba(30,58,138,0.65)]"
                    : "bg-[#eff6ff] hover:bg-[#dbeafe]"
                }`
              : `flex sm:flex-col items-start gap-3 sm:gap-2.5 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${
                  chosen
                    ? "border-blue-700 bg-blue-50 shadow-[0_0_0_4px_rgba(29,78,216,0.12),0_8px_20px_-6px_rgba(29,78,216,0.35)]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`;
            return (
              <label
                key={s.param}
                className={`relative rounded-xl border-2 cursor-pointer transition-[border-color,background-color,box-shadow] duration-200 ${look}`}
              >
                <input
                  type="radio"
                  name="quote-service"
                  value={s.value}
                  checked={chosen}
                  onChange={() => setServiceType(s.value)}
                  onClick={() => setCardChoices((n) => n + 1)}
                  aria-labelledby={`quote-service-${s.param}`}
                  aria-describedby={
                    featured ? `quote-service-${s.param}-line quote-service-${s.param}-badge` : `quote-service-${s.param}-line`
                  }
                  className="sr-only"
                />
                <ServiceIcon
                  param={s.param}
                  className={featured ? `h-10 w-10 ${dark ? "text-[#facc15]" : "text-[#1e3a8a]"}` : `h-7 w-7 ${chosen ? "text-blue-700" : "text-gray-500"}`}
                />
                <span className="flex flex-col sm:flex-1">
                  <span className={featured ? "flex flex-wrap items-center gap-x-2.5 gap-y-1" : "contents"}>
                    <span
                      id={`quote-service-${s.param}`}
                      className={`block font-bold leading-snug ${featured ? `text-xl sm:text-2xl ${dark ? "text-white" : "text-[#1e3a8a]"}` : "text-gray-900"}`}
                    >
                      {s.title}
                    </span>
                    {featured && (
                      <span
                        id={`quote-service-${s.param}-badge`}
                        className="rounded-full bg-[#facc15] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1e3a8a] leading-none"
                      >
                        Most popular
                      </span>
                    )}
                  </span>
                  <span
                    id={`quote-service-${s.param}-line`}
                    className={`mt-1 block leading-snug ${featured ? `text-sm sm:text-base ${dark ? "text-[#dbeafe]" : "text-gray-700"}` : "text-sm text-gray-600"}`}
                  >
                    {s.line}
                  </span>
                </span>
                {featured && (
                    // Seen only: the radio already says whether it is chosen.
                    <span
                      aria-hidden="true"
                      className={`col-start-2 sm:col-start-3 inline-flex items-center gap-1 text-sm font-bold ${dark ? "text-[#facc15]" : "text-[#1e3a8a]"}`}
                    >
                      {chosen ? (
                        <>
                          Selected
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </>
                      ) : (
                        <>
                          Start here
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </>
                      )}
                    </span>
                  )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {!serviceType && (
        <p className="mt-5 text-sm text-gray-500">
          Choose a service to see the right questions for you.
        </p>
      )}

      {serviceType && (
        <form ref={formRef} className="quote-fold-in mt-7 space-y-5" onSubmit={handleSubmit}>
          {/* Web3Forms hidden fields */}
          <input
            type="hidden"
            name="access_key"
            value="5d6ae482-b516-4f75-9a54-d9856689d1b5"
          />
          <input
            type="hidden"
            name="subject"
            value="New Quote Request - Flyer Distribution Hampshire"
          />

          <div ref={detailsRef} className="border-t border-gray-200 pt-6 scroll-mt-20">
            {/* Leaflet Printing: what they are getting printed, as it stands in
                the print builder below, just above Your details (so it comes
                into view with them when the service is chosen). Change takes
                them to the builder, once it is on the page (with the questions). */}
            {isPrinting && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-blue-100 bg-[#eff6ff] px-4 py-3 text-sm text-blue-900">
                <p>
                  Your print: <strong className="font-semibold">{specSummary(printSpec)}</strong>
                </p>
                {showQuestions && (
                  <a
                    href={`#${printBuilderId}`}
                    onClick={goToPrintBuilder}
                    aria-label="Change your print"
                    className="inline-flex min-h-6 shrink-0 items-center font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                  >
                    Change
                  </a>
                )}
              </div>
            )}
            <h3 className="text-lg font-bold text-blue-900">Your details</h3>
          </div>

          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="first-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                First name <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstNameRef}
                type="text"
                id="first-name"
                name="first-name"
                required
                autoComplete="given-name"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="last-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Last name
              </label>
              <input
                type="text"
                id="last-name"
                name="last-name"
                autoComplete="family-name"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contact number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              autoComplete="tel"
              inputMode="tel"
              aria-describedby={showQuestions ? undefined : "phone-hint"}
              onChange={(e) => {
                // Checked as they type, not only when they leave the field.
                if (!showQuestions && e.target.value.replace(/\D/g, "").length >= PHONE_DIGITS_TO_CONTINUE) {
                  setShowQuestions(true);
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {!showQuestions && (
              <p id="phone-hint" className="mt-1.5 text-xs text-gray-500">
                Enter your number to continue
              </p>
            )}
          </div>

          {showQuestions && (
            <div className="quote-fold-in space-y-5">
              {/* The chosen service's questions. Company stays put when the
                  service changes, so what was typed in it is kept. */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-blue-900">
                  {QUOTE_SERVICES.find((s) => s.value === serviceType)?.heading}
                </h3>
              </div>

              <div>
                {/* Shown with the heading: Company, then for leaflets the areas
                    and the quantity, in the order they are sent. */}
                <div className="space-y-5">
                  {/* Company */}
                  <div>
                    <label
                      htmlFor="company"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Company / Organisation
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      autoComplete="organization"
                      className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Service type, from the card chosen above: sent in the same place
                      and with the same words as the old dropdown. */}
                  <input type="hidden" name="service" value={serviceType} />

                  {/* ── Leaflet Distribution fields ── */}
                  {isLeaflet && (
                    <>
                      {/* What kind: four cards, two by two (one column on phones),
                          Door to door to start with. Sent as distribution-type. */}
                      <fieldset>
                        <legend className="block text-sm font-medium text-gray-700 mb-2">
                          What kind of leaflet distribution? <span className="text-red-500">*</span>
                        </legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {DISTRIBUTION_TYPES.map((t) => {
                            const picked = distributionType === t.value;
                            return (
                              <label
                                key={t.value}
                                className={`flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${
                                  picked ? "border-blue-700 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="distribution-type"
                                  value={t.value}
                                  required
                                  checked={picked}
                                  onChange={() => setDistributionType(t.value)}
                                  className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>
                                  <span className="block text-sm font-semibold text-gray-900">{t.value}</span>
                                  <span className="block text-xs text-gray-600">{t.line}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* Areas required: its label and example follow the kind chosen; its name never changes. */}
                      <div>
                        <label
                          htmlFor="areas-required"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {areasField.areasLabel}
                        </label>
                        <input
                          type="text"
                          id="areas-required"
                          name="areas-required"
                          placeholder={areasField.areasPlaceholder}
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Quantity: one of the ranges, sent as it reads ("1,000 to 2,500").
                          Any choice folds in the rest of the section. */}
                      <div>
                        <label
                          htmlFor="quantity"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Approximate quantity (flyers) <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="quantity"
                          name="quantity"
                          required
                          value={quantity}
                          onChange={(e) => {
                            setQuantity(e.target.value);
                            // Any choice, "Not sure yet" included, folds in the rest.
                            if (e.target.value) setQuantityChosen(true);
                          }}
                          aria-describedby={quantityChosen ? "quantity-hint" : "quantity-hint quantity-continue-hint"}
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">{QUANTITY_PLACEHOLDER}</option>
                          {QUANTITY_RANGES.map((range) => (
                            <option key={range} value={range}>
                              {range}
                            </option>
                          ))}
                        </select>
                        <p id="quantity-hint" className="mt-1.5 text-xs text-gray-500">
                          Not sure? Your best guess is fine.
                        </p>
                        {!quantityChosen && (
                          <p id="quantity-continue-hint" className="mt-1.5 text-xs text-gray-500">
                            Choose a quantity to continue
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Leaflet Printing fields ── */}
                  {isPrinting && (
                    <>
                      {/* What to print: the print builder, starting on the defaults or on
                          the choice the builder on /leaflet-printing sent. It is sent as
                          its summary, print-spec, first, then print-item, print-size,
                          print-sides (not for business cards), print-fold (folded only)
                          and print-paper. */}
                      <div>
                        <input type="hidden" name="print-spec" value={specSummary(printSpec)} />
                        <input type="hidden" name="print-item" value={printFields.item} />
                        <input type="hidden" name="print-size" value={printFields.size} />
                        {printFields.sides && <input type="hidden" name="print-sides" value={printFields.sides} />}
                        {printFields.fold && <input type="hidden" name="print-fold" value={printFields.fold} />}
                        <input type="hidden" name="print-paper" value={printFields.paper} />
                        <PrintBuilder mode="form" id={printBuilderId} spec={printSpec} onSpecChange={setPrintSpec} />
                      </div>

                      {/* Quantity: the leaflet ranges. Any choice folds in the rest. */}
                      <div>
                        <label
                          htmlFor="print-quantity"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Approximate quantity <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="print-quantity"
                          name="print-quantity"
                          required
                          value={quantity}
                          onChange={(e) => {
                            setQuantity(e.target.value);
                            if (e.target.value) setQuantityChosen(true);
                          }}
                          aria-describedby={quantityChosen ? "print-quantity-hint" : "print-quantity-hint print-quantity-continue-hint"}
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">{QUANTITY_PLACEHOLDER}</option>
                          {QUANTITY_RANGES.map((range) => (
                            <option key={range} value={range}>
                              {range}
                            </option>
                          ))}
                        </select>
                        <p id="print-quantity-hint" className="mt-1.5 text-xs text-gray-500">
                          Not sure? Your best guess is fine.
                        </p>
                        {!quantityChosen && (
                          <p id="print-quantity-continue-hint" className="mt-1.5 text-xs text-gray-500">
                            Choose a quantity to continue
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* The rest of the section. For leaflets it is hidden until a
                    quantity is chosen, then folds in below it and stays, so
                    nothing above moves and nothing typed is lost. The other
                    services show it straight away, as before. */}
                <div
                  hidden={(isLeaflet || isPrinting) && !quantityChosen}
                  className={isLeaflet || isPrinting ? "quote-fold-in mt-5 space-y-5" : "mt-5 space-y-5"}
                >
                  {/* ── Leaflet Distribution, after the quantity ── */}
                  {isLeaflet && (
                    <>
                      {/* Print and design, side by side in two equal columns
                          whenever the form is at least 240px wide (the form's own
                          width, so the Get a Quote panel behaves the same), else
                          one above the other. The size and sides, when printing,
                          go full width underneath both. Yes sends
                          printing-included or include-design as "yes", as the
                          ticked boxes did, and No sends nothing; the fields stay in
                          the order they were sent: printing-included, item-size,
                          print-sides, then include-design. */}
                      <div className="@container">
                        <div className="grid grid-cols-1 @min-[240px]:grid-cols-2 gap-2">
                          <div className="border border-gray-200 rounded-md px-3 py-3 bg-gray-50">
                            <YesNo
                              id="printing-question"
                              question="Would you like us to print?"
                              value={includePrinting}
                              onChange={setIncludePrinting}
                            />
                            <p className="mt-2 text-xs text-gray-500">Choose No if they&apos;re already printed.</p>
                          </div>
                          <div className="border border-gray-200 rounded-md px-3 py-3 bg-gray-50">
                            <YesNo
                              id="design-question"
                              question="Would you like us to design it?"
                              value={includeDesign}
                              onChange={setIncludeDesign}
                            />
                            <p className="mt-2 text-xs text-gray-500">Choose No if your artwork is ready.</p>
                          </div>
                        </div>

                        {includePrinting && (
                          <div className="mt-2 space-y-3 border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
                            <input type="hidden" name="printing-included" value="yes" />
                            <div>
                              <label
                                htmlFor="item-size"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Item size
                              </label>
                              <select
                                id="item-size"
                                name="item-size"
                                defaultValue="A5"
                                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="A5">A5 (most popular)</option>
                                <option value="A4">A4</option>
                                <option value="A6">A6</option>
                                <option value="DL">DL</option>
                              </select>
                            </div>

                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Print sides
                              </p>
                              <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="print-sides"
                                    value="Single sided"
                                    defaultChecked
                                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">Single sided</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="print-sides"
                                    value="Double sided"
                                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">Double sided</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                        {includeDesign && <input type="hidden" name="include-design" value="yes" />}
                      </div>

                      {/* Budget (leaflet) */}
                      <div>
                        <label
                          htmlFor="budget"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Approximate campaign budget <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="budget"
                          name="budget"
                          required
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">Select a range...</option>
                          <option>Under £300</option>
                          <option>£300 - £500</option>
                          <option>£500 - £1,000</option>
                          <option>£1,000 - £2,000</option>
                          <option>£2,000 - £4,000</option>
                          <option>£4,000+</option>
                        </select>
                      </div>

                      {/* Additional details (leaflet) */}
                      <div>
                        <label
                          htmlFor="message"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Additional details
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          rows={4}
                          placeholder="Tell us about your campaign, timing, or any special requirements..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Leaflet Printing, after the quantity ── */}
                  {isPrinting && (
                    <>
                      {/* Design: Yes sends print-design "Yes"; No sends nothing. */}
                      <div className="border border-gray-200 rounded-md px-3 py-3 bg-gray-50">
                        <YesNo
                          id="print-design-question"
                          question="Would you like us to design it?"
                          value={printDesign}
                          onChange={setPrintDesign}
                        />
                        <p className="mt-2 text-xs text-gray-500">Choose No if your artwork is ready.</p>
                        {printDesign && <input type="hidden" name="print-design" value="Yes" />}
                      </div>

                      {/* Where to send the printed leaflets: their full delivery address,
                          sent as print-address-1, print-address-2, print-town, then the
                          postcode, which keeps its old name, print-send-to. Town or city
                          and Postcode side by side from sm, as the name fields are. */}
                      <fieldset aria-describedby="print-send-to-hint">
                        <legend className="block text-sm font-semibold text-gray-800 mb-3">Delivery address</legend>
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="print-address-1"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Address <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="print-address-1"
                              name="print-address-1"
                              required
                              autoComplete="address-line1"
                              placeholder="Building name or number and road"
                              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="print-address-2"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Address line 2
                            </label>
                            <input
                              type="text"
                              id="print-address-2"
                              name="print-address-2"
                              autoComplete="address-line2"
                              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor="print-town"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Town or city <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="print-town"
                                name="print-town"
                                required
                                autoComplete="address-level2"
                                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="print-send-to"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Postcode <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="print-send-to"
                                name="print-send-to"
                                required
                                autoComplete="postal-code"
                                placeholder="e.g. SO15 2AB"
                                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                        <p id="print-send-to-hint" className="mt-1.5 text-xs text-gray-500">
                          We deliver across Hampshire and Dorset, and can send them to other areas too.
                        </p>
                      </fieldset>

                      {/* Door to door as well: Yes sends also-deliver and shows the
                          areas to deliver to; No sends nothing. */}
                      <div className="border border-gray-200 rounded-md px-3 py-3 bg-gray-50">
                        <YesNo
                          id="also-deliver-question"
                          question="Would you also like us to deliver them through letterboxes?"
                          value={alsoDeliver}
                          onChange={setAlsoDeliver}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Choose No if you just want the printed leaflets. Door to door delivery covers Hampshire and Dorset, every round GPS tracked.
                        </p>
                        {alsoDeliver && (
                          <div className="quote-fold-in mt-3 space-y-2">
                            <input type="hidden" name="also-deliver" value="Yes (Print and Deliver)" />
                            <p className="text-sm font-semibold text-blue-900">Great, we&apos;ll quote you for Print and Deliver.</p>
                            <div>
                              <label
                                htmlFor="print-delivery-areas"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Areas required / target postcodes
                              </label>
                              <input
                                type="text"
                                id="print-delivery-areas"
                                name="print-delivery-areas"
                                placeholder="e.g. Southampton SO15, SO16"
                                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Additional details (printing) */}
                      <div>
                        <label
                          htmlFor="print-message"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Additional details
                        </label>
                        <textarea
                          id="print-message"
                          name="message"
                          rows={4}
                          placeholder="Paper or finish you have in mind, when you need them, or anything else you'd like printed..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Web Design & SEO fields ── */}
                  {isWebDesign && (
                    <>
                      <div>
                        <label
                          htmlFor="business-type"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Business type
                        </label>
                        <input
                          type="text"
                          id="business-type"
                          name="business-type"
                          placeholder="e.g. Restaurant, Trades, Charity"
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="web-budget"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Approximate budget <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="web-budget"
                          name="budget"
                          required
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">Select a range...</option>
                          <option>Under £500</option>
                          <option>£500 - £1,000</option>
                          <option>£1,000 - £2,500</option>
                          <option>£2,500+</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="web-message"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Additional details
                        </label>
                        <textarea
                          id="web-message"
                          name="message"
                          rows={4}
                          placeholder="Tell us about your project, what you need, or any questions you have..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Screen Hire fields ── */}
                  {isScreenHire && (
                    <>
                      <div>
                        <label
                          htmlFor="event-date"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Event date
                        </label>
                        <input
                          type="date"
                          id="event-date"
                          name="event-date"
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="event-location"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Event location
                        </label>
                        <input
                          type="text"
                          id="event-location"
                          name="event-location"
                          placeholder="e.g. Southampton City Centre"
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="event-duration"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Approximate duration
                        </label>
                        <select
                          id="event-duration"
                          name="event-duration"
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">Select a duration...</option>
                          <option>Half day</option>
                          <option>Full day</option>
                          <option>2-3 days</option>
                          <option>Longer</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="screen-message"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Additional details
                        </label>
                        <textarea
                          id="screen-message"
                          name="message"
                          rows={4}
                          placeholder="Tell us about your event, what you need the screen for, or any questions..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Newsletter opt-in */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id="newsletter"
                        name="newsletter"
                        value="yes"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                      <span className="text-sm text-gray-600">
                        Keep me updated with tips and offers from Flyer Distribution Hampshire
                      </span>
                    </label>
                  </div>

                  {/* Error message */}
                  {error && (
                    <p
                      ref={errorRef}
                      tabIndex={-1}
                      className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3 scroll-mt-20 focus:outline-none"
                    >
                      Something went wrong. Please try again or email us at{" "}
                      <a
                        href="mailto:flyerdistributionhampshire@gmail.com"
                        className="underline"
                      >
                        flyerdistributionhampshire@gmail.com
                      </a>
                      .
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 text-sm"
                  >
                    {isSubmitting ? "Sending..." : "Send Quote Request"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

// On a phone the form opens below all three cards, out of sight, so a card
// chosen there looked as if nothing had happened. If the first field is not
// fully on screen (the page, or the Get a Quote panel's own scrolling area),
// the start of the form, "Your details", is brought to just below the
// header: smoothly, or at once with reduced motion. Left alone when it is
// already in view.
function showDetails(start: HTMLElement | null, field: HTMLElement | null) {
  if (!start || !field) return;
  let bottom = window.innerHeight;
  for (let el = field.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") bottom = Math.min(bottom, el.getBoundingClientRect().bottom);
  }
  if (field.getBoundingClientRect().bottom <= bottom) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  start.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
}

// A question answered with Yes or No pills, one of them always pressed.
function YesNo({
  id,
  question,
  value,
  onChange,
}: {
  id: string;
  question: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="text-sm font-medium text-gray-700 mb-2">
        {question}
      </p>
      <div className="flex gap-2">
        {[true, false].map((answer) => (
          <button
            key={String(answer)}
            type="button"
            aria-pressed={value === answer}
            onClick={() => onChange(answer)}
            className={`flex-1 max-w-16 min-h-11 rounded-full border px-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              value === answer
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
            }`}
          >
            {answer ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

// The line icon on each service card.
function ServiceIcon({ param, className }: { param: QuoteService["param"]; className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-colors duration-200 ${className}`}
    >
      {param === "leaflet" && <path d="M21.5 2.5 2.5 10l7 3 3 7 9-17.5ZM9.5 13 15 8.5" />}
      {param === "printing" && (
        <>
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </>
      )}
      {param === "web" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M6.5 6.5h.01M9 6.5h.01M7.5 13h9M7.5 16h5.5" />
        </>
      )}
      {param === "screen" && (
        <>
          <rect x="3" y="2.5" width="18" height="11" rx="1.5" />
          <path d="M12 13.5V17M3.5 17h16M19.5 17h2" />
          <circle cx="8" cy="19.5" r="1.5" />
          <circle cx="15" cy="19.5" r="1.5" />
        </>
      )}
    </svg>
  );
}

"use client";

import { useState, useRef, useEffect, useId } from "react";
import { revealFirstInvalid, showResult } from "@/components/form-result";
import { QUANTITY_PLACEHOLDER, QUANTITY_RANGES } from "@/lib/quote-quantity";
import { QUOTE_SERVICES, serviceFromParam, type QuoteService } from "@/lib/quote-services";

// How many digits the contact number needs before the service's questions show.
const PHONE_DIGITS_TO_CONTINUE = 10;

export default function QuoteForm() {
  const [serviceType, setServiceType] = useState("");
  // The service's questions, once the contact number has enough digits.
  // They then stay for the visit, even if the number is changed or cleared.
  const [showQuestions, setShowQuestions] = useState(false);
  const [includePrinting, setIncludePrinting] = useState(false);
  const [includeDesign, setIncludeDesign] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // The result once sent: the success message, or the banner if sending failed.
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultId = useId();

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

  // A link can choose the service: /quote?service=leaflet, web or screen.
  useEffect(() => {
    const chosen = serviceFromParam(new URLSearchParams(window.location.search).get("service"));
    if (chosen) setServiceType(chosen);
  }, []);

  const isLeaflet = serviceType === "Leaflet Distribution";
  const isWebDesign = serviceType === "Web Design & SEO";
  const isScreenHire = serviceType === "Screen Hire";

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
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-blue-900">Get Your Free Quote</h2>
      <p className="mt-1 text-gray-600">
        Free, with no obligation. We&apos;ll be in touch within 24 hours.
      </p>

      {/* The service, as one choice of three cards. The radios sit outside
          the form, so they are never sent themselves: the choice goes as
          "service", from the hidden field after Company below. */}
      <fieldset className="mt-7">
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
          What do you need?
        </legend>
        {/* Leaflet Distribution leads: wider on desktop and first when they stack. */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] gap-3">
          {QUOTE_SERVICES.map((s) => {
            const chosen = serviceType === s.value;
            // The leaflet card: dark blue, a "Most popular" badge, and a yellow
            // ring when chosen. Its focus ring is white then yellow, so it
            // shows against the dark card and the white page alike.
            const featured = s.param === "leaflet";
            const look = featured
              ? `border-[#1e3a8a] bg-[#1e3a8a] shadow-[0_12px_28px_-10px_rgba(30,58,138,0.65)] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[#facc15] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white ${
                  chosen ? "ring-[3px] ring-[#facc15]" : ""
                }`
              : `has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${
                  chosen
                    ? "border-blue-700 bg-blue-50 shadow-[0_0_0_4px_rgba(29,78,216,0.12),0_8px_20px_-6px_rgba(29,78,216,0.35)]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`;
            return (
              <label
                key={s.param}
                className={`relative flex sm:flex-col items-start gap-3 sm:gap-2.5 rounded-xl border-2 p-4 cursor-pointer transition-[border-color,background-color,box-shadow] duration-200 ${look}`}
              >
                <input
                  type="radio"
                  name="quote-service"
                  value={s.value}
                  checked={chosen}
                  onChange={() => setServiceType(s.value)}
                  aria-labelledby={`quote-service-${s.param}`}
                  aria-describedby={
                    featured ? `quote-service-${s.param}-line quote-service-${s.param}-badge` : `quote-service-${s.param}-line`
                  }
                  className="sr-only"
                />
                {featured && (
                  <span
                    id={`quote-service-${s.param}-badge`}
                    className="absolute -top-2.5 left-3 rounded-full bg-[#facc15] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1e3a8a] leading-none"
                  >
                    Most popular
                  </span>
                )}
                <ServiceIcon
                  param={s.param}
                  className={featured ? "text-[#facc15]" : chosen ? "text-blue-700" : "text-gray-500"}
                />
                <span className="flex flex-col sm:flex-1">
                  <span
                    id={`quote-service-${s.param}`}
                    className={`block font-bold leading-snug ${featured ? "text-white" : "text-gray-900"}`}
                  >
                    {s.title}
                  </span>
                  <span
                    id={`quote-service-${s.param}-line`}
                    className={`mt-0.5 block text-sm leading-snug ${featured ? "text-[#dbeafe]" : "text-gray-600"}`}
                  >
                    {s.line}
                  </span>
                  {featured && (
                    // Seen only: the radio already says whether it is chosen.
                    <span aria-hidden="true" className="mt-2.5 sm:mt-auto sm:pt-2.5 inline-flex items-center gap-1 text-sm font-bold text-[#facc15]">
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
                </span>
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

          <div className="border-t border-gray-200 pt-6">
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
                type="text"
                id="first-name"
                name="first-name"
                required
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Service type, from the card chosen above: sent in the same place
                  and with the same words as the old dropdown. */}
              <input type="hidden" name="service" value={serviceType} />

              {/* ── Leaflet Distribution fields ── */}
              {isLeaflet && (
                <>
                  {/* Areas required */}
                  <div>
                    <label
                      htmlFor="areas-required"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Areas required / target postcodes
                    </label>
                    <input
                      type="text"
                      id="areas-required"
                      name="areas-required"
                      placeholder="e.g. Southampton SO15, SO16"
                      className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Quantity: one of the ranges, sent as it reads ("1,000 to 2,500") */}
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
                      defaultValue=""
                      aria-describedby="quantity-hint"
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
                  </div>

                  {/* Printing. Yes sends printing-included as "yes", as the ticked
                      box did; No sends nothing for it. */}
                  <div className="border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
                    <YesNo
                      id="printing-question"
                      question="Would you like us to print?"
                      value={includePrinting}
                      onChange={setIncludePrinting}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Choose No if you already have your materials printed and just need
                      distribution.
                    </p>

                    {includePrinting && (
                      <div className="mt-3 space-y-3">
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
                  </div>

                  {/* Design. Yes sends include-design as "yes", as the ticked box
                      did; No sends nothing for it. */}
                  <div className="border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
                    <YesNo
                      id="design-question"
                      question="Would you like us to design it?"
                      value={includeDesign}
                      onChange={setIncludeDesign}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Choose No if you already have your artwork ready.
                    </p>
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
          )}
        </form>
      )}
    </div>
  );
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
            className={`min-w-16 rounded-full border px-5 py-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
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
      className={`h-7 w-7 shrink-0 transition-colors duration-200 ${className}`}
    >
      {param === "leaflet" && <path d="M21.5 2.5 2.5 10l7 3 3 7 9-17.5ZM9.5 13 15 8.5" />}
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

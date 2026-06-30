"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function QuoteForm() {
  const [includePrinting, setIncludePrinting] = useState(true);
  const [includeDesign, setIncludeDesign] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

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
        setIncludePrinting(true);
        setIncludeDesign(false);
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
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-blue-900 mb-2">Request Received</h2>
        <p className="text-gray-600">
          Thank you, we will be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-blue-900 mb-6">
        Your Campaign Details
      </h2>
      <form ref={formRef} className="space-y-5" onSubmit={handleSubmit}>
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

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="first-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First name
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
              required
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
            Email address
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
            Contact number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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

        {/* Address */}
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Address
          </label>
          <input
            type="text"
            id="address"
            name="address"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Town + Postcode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="town"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Town
            </label>
            <input
              type="text"
              id="town"
              name="town"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label
              htmlFor="postcode"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Postcode
            </label>
            <input
              type="text"
              id="postcode"
              name="postcode"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

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

        {/* Quantity + Campaign start date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Approximate quantity (flyers)
            </label>
            <select
              id="quantity"
              name="quantity"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select a range…</option>
              <option>Under 1,000</option>
              <option>1,000 – 5,000</option>
              <option>5,000 – 10,000</option>
              <option>10,000 – 25,000</option>
              <option>25,000+</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="campaign-start-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Campaign start date
            </label>
            <input
              type="date"
              id="campaign-start-date"
              name="campaign-start-date"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Service type */}
        <div>
          <label
            htmlFor="service"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Service type
          </label>
          <select
            id="service"
            name="service"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Not sure yet</option>
            <option>Leaflet Distribution</option>
            <option>Targeted Postcode Campaign</option>
            <option>Vehicle Leaflet Distribution</option>
            <option>Campaign Planning</option>
          </select>
        </div>

        {/* Printing */}
        <div className="border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="printing-included"
              name="printing-included"
              value="yes"
              checked={includePrinting}
              onChange={(e) => setIncludePrinting(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span className="text-sm font-medium text-gray-700">
              Include printing with my order
            </span>
          </label>
          <p className="mt-1.5 text-xs text-gray-500 pl-7">
            Uncheck if you already have your materials printed and just need
            distribution.
          </p>

          {includePrinting && (
            <div className="mt-3 pl-7 space-y-3">
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

        {/* Design */}
        <div className="border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="include-design"
              name="include-design"
              value="yes"
              checked={includeDesign}
              onChange={(e) => setIncludeDesign(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span className="text-sm font-medium text-gray-700">
              Include design with my order
            </span>
          </label>
          <p className="mt-1.5 text-xs text-gray-500 pl-7">
            Uncheck if you already have your artwork ready.
          </p>
        </div>

        {/* Budget */}
        <div>
          <label
            htmlFor="budget"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Approximate campaign budget
          </label>
          <select
            id="budget"
            name="budget"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select a range...</option>
            <option>£150 - £300</option>
            <option>£300 - £500</option>
            <option>£500 - £1,000</option>
            <option>£1,000 - £2,000</option>
            <option>£2,000+</option>
          </select>
        </div>

        {/* Message */}
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
            placeholder="Tell us about your campaign, timing, or any special requirements…"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

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
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
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
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-md transition-colors text-sm"
        >
          {isSubmitting ? "Sending…" : "Send Quote Request"}
        </button>
      </form>

      <p className="text-center text-gray-500 text-sm mt-6">
        Prefer to talk?{" "}
        <Link href="/about" className="text-blue-700 hover:underline">
          Contact us directly
        </Link>{" "}
        and we&apos;ll call you back.
      </p>
    </div>
  );
}

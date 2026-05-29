"use client";

import { useState } from "react";
import Link from "next/link";

export default function QuoteForm() {
  const [includePrinting, setIncludePrinting] = useState(true);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-blue-900 mb-6">
        Your Campaign Details
      </h2>
      <form className="space-y-5" action="#" method="POST">
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

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="area"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Target area / postcodes
          </label>
          <input
            type="text"
            id="area"
            name="area"
            placeholder="e.g. Southampton SO15, SO16"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

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

        <div className="border border-gray-200 rounded-md px-4 py-3 bg-gray-50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="include-printing"
              name="include-printing"
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
            <div className="mt-3 pl-7">
              <label
                htmlFor="print-size"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Print size required
              </label>
              <select
                id="print-size"
                name="print-size"
                defaultValue="A5"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="A5">A5 (most popular)</option>
                <option value="A4">A4</option>
                <option value="A6">A6</option>
                <option value="DL">DL</option>
              </select>

              <div className="mt-3">
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

        <button
          type="submit"
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-md transition-colors text-sm"
        >
          Send Quote Request
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

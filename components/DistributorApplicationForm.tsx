"use client";

import { useState, useRef, useEffect } from "react";

export default function DistributorApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [area, setArea] = useState("");
  const [showRest, setShowRest] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const revealed = area.trim().length > 0;

  useEffect(() => {
    if (revealed) {
      const id = requestAnimationFrame(() => setShowRest(true));
      return () => cancelAnimationFrame(id);
    }
    setShowRest(false);
  }, [revealed]);

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
        setArea("");
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
        <h2 className="text-xl font-bold text-blue-900 mb-2">Application Received</h2>
        <p className="text-gray-600">
          Thanks for applying. We&apos;ll be in touch soon, most likely on WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-blue-900 mb-6">Your Details</h2>
      <form ref={formRef} className="space-y-5" onSubmit={handleSubmit}>
        {/* Web3Forms hidden fields */}
        <input type="hidden" name="access_key" value="5d6ae482-b516-4f75-9a54-d9856689d1b5" />
        <input
          type="hidden"
          name="subject"
          value="New Distributor Application - Flyer Distribution Hampshire"
        />

        {/* Name */}
        <div>
          <label htmlFor="dist-name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="dist-name"
            name="name"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="dist-phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="dist-phone"
            name="phone"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">We&apos;ll most likely reach out on WhatsApp.</p>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="dist-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            type="email"
            id="dist-email"
            name="email"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Where do you live — last of the initial fields; answering it reveals the rest */}
        <div>
          <label htmlFor="dist-area" className="block text-sm font-medium text-gray-700 mb-1">
            Where do you live? <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="dist-area"
            name="area"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Southampton, SO15"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {revealed && (
          <div
            className={`space-y-5 transition-[opacity,transform] duration-500 ease-out ${
              showRest ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            {/* Age */}
            <div>
              <label htmlFor="dist-age" className="block text-sm font-medium text-gray-700 mb-1">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="dist-age"
                name="age"
                min={1}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Car access + licence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Access to a car? <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has-car" value="Yes" required className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has-car" value="No" className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Full UK licence? <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has-licence" value="Yes" required className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has-licence" value="No" className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>
            </div>
            <p className="-mt-3 text-xs text-gray-500">
              A car and full UK driving licence are preferred but not essential, plenty of our rounds don&apos;t need either.
            </p>

            {/* Availability */}
            <div>
              <label htmlFor="dist-availability" className="block text-sm font-medium text-gray-700 mb-1">
                Availability <span className="text-red-500">*</span>
              </label>
              <textarea
                id="dist-availability"
                name="availability"
                rows={3}
                required
                minLength={20}
                placeholder="e.g. Weekday mornings and most weekends"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
                Something went wrong. Please try again or email us at{" "}
                <a href="mailto:flyerdistributionhampshire@gmail.com" className="underline">
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
              {isSubmitting ? "Sending..." : "Submit Application"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

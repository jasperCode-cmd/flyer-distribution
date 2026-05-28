import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get a Free Quote",
  description:
    "Request a free, no-obligation quote for flyer and leaflet distribution across Hampshire and Dorset.",
};

export default function QuotePage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Get a Free Quote
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Fill in the form below and we&apos;ll come back to you within 24
            hours with a tailored quote for your distribution campaign.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
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
                  <option>Print &amp; Deliver</option>
                </select>
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
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            Prefer to talk?{" "}
            <Link href="/about" className="text-blue-700 hover:underline">
              Contact us directly
            </Link>{" "}
            and we&apos;ll call you back.
          </p>
        </div>
      </section>
    </>
  );
}

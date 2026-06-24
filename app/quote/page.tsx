import type { Metadata } from "next";
import QuoteForm from "@/components/QuoteForm";

export const metadata: Metadata = {
  title: "Get a Free Quote",
  description:
    "Request a free, no-obligation quote for flyer and leaflet distribution across Hampshire and Dorset.",
  alternates: {
    canonical: "https://flyerdistributionhampshire.co.uk/quote",
  },
  openGraph: {
    title: "Get a Free Quote",
    description:
      "Request a free, no-obligation quote for flyer and leaflet distribution across Hampshire and Dorset.",
    url: "https://flyerdistributionhampshire.co.uk/quote",
    siteName: "Flyer Distribution Hampshire",
    images: [
      {
        url: "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
        width: 1200,
        height: 630,
        alt: "Flyer Distribution Hampshire",
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Get a Free Quote",
    description:
      "Request a free, no-obligation quote for flyer and leaflet distribution across Hampshire and Dorset.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
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
          <QuoteForm />
        </div>
      </section>
    </>
  );
}

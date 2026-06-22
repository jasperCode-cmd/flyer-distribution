import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ: Frequently Asked Questions",
  description:
    "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
  openGraph: {
    title: "FAQ: Frequently Asked Questions",
    description:
      "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
    url: "https://flyerdistributionhampshire.co.uk/faq",
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
    title: "FAQ: Frequently Asked Questions",
    description:
      "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const faqs = [
  {
    q: "What areas do you cover?",
    a: "We cover the Hampshire and Dorset corridor, from Winchester in the north to Poole in the west. This includes Southampton, Bournemouth, Poole, Winchester, Eastleigh, New Forest, Romsey, Ringwood, Christchurch, Hythe, Totton, Hedge End, and Chandler's Ford. If your target area is not listed, get in touch and we can often accommodate additional postcodes on request.",
  },
  {
    q: "How does leaflet distribution work?",
    a: "Once we have your printed leaflets, we take care of getting them delivered. We post them directly through letterboxes across your chosen postcode areas in Hampshire and Dorset. Once your materials are received, our team carries out the rounds and confirms completion.",
  },
  {
    q: "Do you offer a full design, print and delivery service?",
    a: "Yes. We offer a complete end-to-end service where we handle everything from initial artwork through to delivery. Just let us know when requesting your quote and we will talk you through the options.",
  },
  {
    q: "Can I target specific postcode areas?",
    a: "Yes. Postcode-level targeting is central to how we work. You choose the postcode areas you want to reach, and we focus the campaign there. Our Campaign Planning service can help if you are unsure which postcode areas are best suited to your business.",
  },
  {
    q: "Do I need to have my leaflets printed already?",
    a: "Not necessarily. You can supply your own printed materials, or we can handle printing for you. We have established relationships with print partners which means we can offer competitive pricing on A6, A5, A4 and DL formats. Just let us know when requesting your quote and we will include printing in your package.",
  },
  {
    q: "How do I get a quote?",
    a: "Use the Get a Quote page and tell us your target postcode areas and approximate quantity. We will come back to you within 24 hours with a tailored price for your campaign.",
  },
  {
    q: "How many leaflets do I need?",
    a: "That depends on the postcode areas you want to cover and how many households are within them. We generally recommend 5,000 or more as this gives your campaign enough reach to generate a meaningful response, and we offer discounted packages at this volume. We can advise on the right quantity for your target areas as part of our Campaign Planning service.",
  },
  {
    q: "What size leaflets do you deliver?",
    a: "We deliver most standard leaflet sizes including A6, A5, A4, and DL. If you are unsure whether your format is suitable, just ask before you go to print.",
  },
  {
    q: "What is vehicle leaflet distribution?",
    a: "Vehicle leaflet distribution involves placing your leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. It is an effective way to reach people who are already out and spending locally, and works well alongside a door-to-door campaign.",
  },
  {
    q: "How long does a campaign take?",
    a: "Most campaigns are completed within two weeks of us receiving your materials, with smaller campaigns often turning around faster. We will agree a clear timeline with you before the campaign begins so you know exactly when to expect completion.",
  },
];

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Everything you need to know about leaflet distribution in Hampshire
            and Dorset.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-6"
              >
                <h2 className="text-base font-semibold text-blue-900 mb-2">
                  {faq.q}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <h2 className="text-lg font-bold text-blue-900 mb-2">
              Still have questions?
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Get in touch and we&apos;ll be happy to help.
            </p>
            <Link
              href="/quote"
              className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3 rounded-md transition-colors text-sm"
            >
              Get a Free Quote
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

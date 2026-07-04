import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ: Frequently Asked Questions",
  description:
    "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/faq",
  },
  openGraph: {
    title: "FAQ: Frequently Asked Questions",
    description:
      "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
    url: "https://www.flyerdistributionhampshire.co.uk/faq",
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

/* ─── Inline link style ─────────────────────────────────────────────── */
const a = "text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors";

/* ─── FAQ data ──────────────────────────────────────────────────────── */

const questions = [
  "What areas do you cover?",
  "How does leaflet distribution work?",
  "Do you offer a full design, print and delivery service?",
  "Can I target specific postcode areas?",
  "Do I need to have my leaflets printed already?",
  "How do I get a quote?",
  "How many leaflets do I need?",
  "What size leaflets do you deliver?",
  "What is vehicle leaflet distribution?",
  "How long does a campaign take?",
];

/* Plain-text versions for FAQPage schema — no markdown, no link syntax */
const schemaAnswers = [
  "We cover the Hampshire and Dorset corridor, offering flyer distribution and leaflet distribution across Southampton, Bournemouth, Poole, Winchester, Eastleigh, the New Forest, Romsey, Ringwood, Christchurch, and Dorset more widely, along with Hythe, Totton, Hedge End, and Chandler's Ford. See our full coverage areas for details, and if your target area isn't listed, get in touch, as we can often accommodate additional postcodes on request.",
  "Once we have your printed leaflets, we take care of getting them delivered. Our door-to-door leaflet distribution service posts them directly through letterboxes across your chosen postcode areas in Hampshire and Dorset. Once your materials are received, our team carries out the rounds and confirms completion.",
  "Yes. Our Design, Print and Deliver package is a complete end-to-end service where we handle everything from initial artwork through to delivery across Hampshire and Dorset. Just let us know when requesting your quote and we'll talk you through the options.",
  "Yes. Postcode-level targeting is central to how we work. You choose the postcode areas you want to reach, and we focus your flyer distribution campaign there. Our Campaign Planning service can help if you're unsure which postcode areas in Hampshire or Dorset are best suited to your business.",
  "Not necessarily. You can supply your own printed materials, or choose our Print and Deliver service and we'll handle the printing for you. We have established relationships with print partners which means we can offer competitive pricing on A6, A5, A4 and DL formats. Just let us know when requesting your quote and we'll include printing in your package.",
  "Use our Get a Quote page and tell us your target postcode areas and approximate quantity. We'll come back to you within 24 hours with a tailored price for your leaflet distribution campaign.",
  "That depends on the postcode areas you want to cover across Hampshire and Dorset and how many households are within them. We generally recommend 5,000 or more, as this gives your campaign enough reach to generate a meaningful response, and we offer discounted packages at this volume. Our Campaign Planning service, part of our leaflet distribution services, can advise on the right quantity for your target areas.",
  "We deliver most standard leaflet sizes including A6, A5, A4, and DL. If you're unsure whether your format is suitable, just ask when you get a quote.",
  "Vehicle leaflet distribution involves placing your leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. It's an effective way to reach people who are already out and spending locally, and works well alongside a door-to-door leaflet distribution campaign.",
  "Most flyer distribution campaigns across Hampshire and Dorset are completed within two weeks of us receiving your materials, with smaller campaigns often turning around faster. We'll agree a clear timeline with you before the campaign begins, so you know exactly when to expect completion.",
];

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q, i) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: schemaAnswers[i],
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

            {/* Q1 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[0]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                We cover the Hampshire and Dorset corridor, offering flyer distribution and leaflet
                distribution across{" "}
                <Link href="/areas/southampton" className={a}>Southampton</Link>,{" "}
                <Link href="/areas/bournemouth" className={a}>Bournemouth</Link>,{" "}
                <Link href="/areas/poole" className={a}>Poole</Link>,{" "}
                <Link href="/areas/winchester" className={a}>Winchester</Link>,{" "}
                <Link href="/areas/eastleigh" className={a}>Eastleigh</Link>, the{" "}
                <Link href="/areas/new-forest" className={a}>New Forest</Link>, Romsey,{" "}
                <Link href="/areas/ringwood" className={a}>Ringwood</Link>,{" "}
                <Link href="/areas/christchurch" className={a}>Christchurch</Link>, and{" "}
                <Link href="/areas/dorset" className={a}>Dorset</Link> more widely, along with
                Hythe, Totton, Hedge End, and Chandler&apos;s Ford. See our full{" "}
                <Link href="/areas" className={a}>coverage areas</Link> for details, and if
                your target area isn&apos;t listed,{" "}
                <Link href="/quote" className={a}>get in touch</Link>, as we can often
                accommodate additional postcodes on request.
              </p>
            </div>

            {/* Q2 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[1]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Once we have your printed leaflets, we take care of getting them delivered. Our{" "}
                <Link href="/services" className={a}>door-to-door leaflet distribution service</Link>{" "}
                posts them directly through letterboxes across your chosen postcode areas in Hampshire
                and Dorset. Once your materials are received, our team carries out the rounds and
                confirms completion.
              </p>
            </div>

            {/* Q3 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[2]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Yes. Our{" "}
                <Link href="/services" className={a}>Design, Print and Deliver package</Link>{" "}
                is a complete end-to-end service where we handle everything from initial artwork
                through to delivery across Hampshire and Dorset. Just let us know when{" "}
                <Link href="/quote" className={a}>requesting your quote</Link> and we&apos;ll
                talk you through the options.
              </p>
            </div>

            {/* Q4 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[3]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Yes. Postcode-level targeting is central to how we work. You choose the postcode
                areas you want to reach, and we focus your flyer distribution campaign there. Our{" "}
                <Link href="/services" className={a}>Campaign Planning service</Link> can help
                if you&apos;re unsure which postcode areas in Hampshire or Dorset are best suited
                to your business.
              </p>
            </div>

            {/* Q5 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[4]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Not necessarily. You can supply your own printed materials, or choose our{" "}
                <Link href="/services" className={a}>Print and Deliver service</Link> and
                we&apos;ll handle the printing for you. We have established relationships with print
                partners which means we can offer competitive pricing on A6, A5, A4 and DL formats.
                Just let us know when{" "}
                <Link href="/quote" className={a}>requesting your quote</Link> and we&apos;ll
                include printing in your package.
              </p>
            </div>

            {/* Q6 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[5]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Use our{" "}
                <Link href="/quote" className={a}>Get a Quote page</Link> and tell us your
                target postcode areas and approximate quantity. We&apos;ll come back to you within
                24 hours with a tailored price for your leaflet distribution campaign.
              </p>
            </div>

            {/* Q7 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[6]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                That depends on the postcode areas you want to cover across Hampshire and Dorset and
                how many households are within them. We generally recommend 5,000 or more, as this
                gives your campaign enough reach to generate a meaningful response, and we offer
                discounted packages at this volume. Our{" "}
                <Link href="/services" className={a}>Campaign Planning service</Link>, part of our{" "}
                <Link href="/services" className={a}>leaflet distribution services</Link>, can
                advise on the right quantity for your target areas.
              </p>
            </div>

            {/* Q8 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[7]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                We deliver most standard leaflet sizes including A6, A5, A4, and DL. If you&apos;re
                unsure whether your format is suitable, just ask when you{" "}
                <Link href="/quote" className={a}>get a quote</Link>.
              </p>
            </div>

            {/* Q9 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[8]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Vehicle leaflet distribution involves placing your leaflets on parked cars in car
                parks, retail areas, and high-footfall locations across Hampshire and Dorset.
                It&apos;s an effective way to reach people who are already out and spending locally,
                and works well alongside a{" "}
                <Link href="/services" className={a}>door-to-door leaflet distribution campaign</Link>.
              </p>
            </div>

            {/* Q10 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-base font-semibold text-blue-900 mb-2">{questions[9]}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Most flyer distribution campaigns across Hampshire and Dorset are completed within
                two weeks of us receiving your materials, with smaller campaigns often turning around
                faster. We&apos;ll agree a clear timeline with you before the campaign begins, so
                you know exactly when to expect completion.
              </p>
            </div>

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
              className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3 rounded-md transition duration-200 ease-out hover:scale-105 text-sm"
            >
              Get a Free Quote
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

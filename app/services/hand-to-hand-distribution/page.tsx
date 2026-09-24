import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import StaggerGroup from "@/components/StaggerGroup";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Hand-to-Hand Leaflet Distribution",
  description:
    "Hand-to-hand leaflet distribution across Hampshire and Dorset. Direct, face-to-face handouts at shopping centres, town centres and events for immediate brand exposure.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/hand-to-hand-distribution",
  },
  openGraph: {
    title: "Hand-to-Hand Leaflet Distribution | Flyer Distribution Hampshire",
    description:
      "Hand-to-hand leaflet distribution across Hampshire and Dorset. Direct, face-to-face handouts at shopping centres, town centres and events for immediate brand exposure.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/hand-to-hand-distribution",
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
    title: "Hand-to-Hand Leaflet Distribution | Flyer Distribution Hampshire",
    description:
      "Hand-to-hand leaflet distribution across Hampshire and Dorset. Direct, face-to-face handouts at shopping centres, town centres and events for immediate brand exposure.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.flyerdistributionhampshire.co.uk",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Services",
      item: "https://www.flyerdistributionhampshire.co.uk/services",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Hand-to-Hand Distribution",
      item: "https://www.flyerdistributionhampshire.co.uk/services/hand-to-hand-distribution",
    },
  ],
};

const benefits = [
  {
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    title: "Direct, Face-to-Face Reach",
    body: "Handing a leaflet straight to someone gets noticed in a way a letterbox drop can't. People engage with material they've been handed personally far more than unannounced post.",
  },
  {
    icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    title: "Immediate Visibility",
    body: "A team member handing out leaflets in a busy spot creates instant brand awareness, useful for launches, offers, and anything where you need fast exposure.",
  },
  {
    icon: (
      <>
        <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    title: "Targeted by Location and Footfall",
    body: "We choose busy pedestrian areas and match the location to your target customer, whether that's families at a shopping centre or commuters in a town centre.",
  },
  {
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    title: "Great for Events and Offers",
    body: "Ideal for seasonal campaigns, new openings, and promotions, wherever you want a concentrated burst of activity around a specific date.",
  },
  {
    icon: (
      <>
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </>
    ),
    title: "Works Alongside Your Other Marketing",
    body: "A cost-effective way to add reach on top of door-to-door distribution or your website, rather than replacing either.",
  },
  {
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </>
    ),
    title: "Trackable Results",
    body: "Add a QR code, discount code, or dedicated landing page to your leaflet and you'll have a clear way to measure response.",
  },
];

export default function HandToHandDistributionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Services", href: "/services" },
              { label: "Hand-to-Hand Distribution" },
            ]}
          />
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">
            Hampshire &amp; Dorset &middot; Face-to-Face Distribution
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl">
            Hand-to-Hand Leaflet Distribution
          </h1>
          <p className="text-blue-200 text-lg max-w-2xl leading-relaxed">
            Putting your leaflets directly into people&apos;s hands at the
            moments they&apos;re most likely to take notice, from shopping
            centres to local events across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* What this service covers */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                What This Service Covers
              </h2>
            </div>
          </ScrollReveal>
          <div className="max-w-3xl space-y-4 text-gray-600 leading-relaxed">
            <p>
              Hand-to-hand distribution puts your leaflets directly into
              people&apos;s hands instead of through a letterbox. One of our
              team stands in a busy spot, whether that&apos;s a shopping
              centre entrance, a town centre pedestrian area, or an event,
              and hands your material straight to passers-by. It&apos;s a
              direct, personal way to reach people at the exact moment
              they&apos;re out and about.
            </p>
            <p>
              We&apos;ve run hand-to-hand campaigns at Westquay Shopping
              Centre in{" "}
              <Link href="/areas/southampton" className="text-blue-700 hover:underline font-medium">
                Southampton
              </Link>
              , Festival Place in Basingstoke, and{" "}
              <Link href="/areas/bournemouth" className="text-blue-700 hover:underline font-medium">
                Bournemouth
              </Link>{" "}
              Town Centre, reaching shoppers and commuters at busy times of
              day. For examples of completed work, take a look at{" "}
              <Link href="/case-studies" className="text-blue-700 hover:underline font-medium">
                our track record
              </Link>
              .
            </p>
            <p>
              It complements our regular{" "}
              <Link href="/services" className="text-blue-700 hover:underline font-medium">
                door-to-door rounds
              </Link>{" "}
              well for businesses wanting a fuller campaign. Got questions
              first? Our{" "}
              <Link href="/faq" className="text-blue-700 hover:underline font-medium">
                FAQ page
              </Link>{" "}
              covers the basics.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Why Choose Hand-to-Hand Distribution
            </h2>
            <p className="text-gray-600 max-w-2xl mb-10">
              A direct, personal way to put your message in front of the
              right people, at the right time and place.
            </p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <svg className="w-6 h-6 text-blue-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-blue-900 text-white border-t border-blue-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Planning a Campaign?
          </h2>
          <p className="text-blue-200 mb-8 max-w-xl">
            Our distributors are briefed on your campaign before every
            hand-to-hand round, so they can talk to people naturally rather
            than just pushing paper into hands.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import StaggerGroup from "@/components/StaggerGroup";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "B2B Leaflet Distribution",
  description:
    "B2B leaflet distribution across Hampshire and Dorset. Direct marketing to business owners and decision-makers at offices, business parks and commercial areas.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/b2b-distribution",
  },
  openGraph: {
    title: "B2B Leaflet Distribution | Flyer Distribution Hampshire",
    description:
      "B2B leaflet distribution across Hampshire and Dorset. Direct marketing to business owners and decision-makers at offices, business parks and commercial areas.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/b2b-distribution",
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
    title: "B2B Leaflet Distribution | Flyer Distribution Hampshire",
    description:
      "B2B leaflet distribution across Hampshire and Dorset. Direct marketing to business owners and decision-makers at offices, business parks and commercial areas.",
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
      name: "B2B Distribution",
      item: "https://www.flyerdistributionhampshire.co.uk/services/b2b-distribution",
    },
  ],
};

const benefits = [
  {
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </>
    ),
    title: "Reaches Decision-Makers Directly",
    body: "Delivered straight to offices and business premises, putting your material in front of the people who actually make the buying decisions, rather than a general audience.",
  },
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    title: "Targeted by Industry and Sector",
    body: "We can focus a campaign on the industries and sectors most relevant to what you offer, rather than distributing blind across every business in an area.",
  },
  {
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    title: "Suited to a Wide Range of Businesses",
    body: "Trades, professional services, recruitment agencies, and commercial suppliers all use B2B distribution well, and it works just as effectively promoting a B2B event.",
  },
  {
    icon: (
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </>
    ),
    title: "Builds Local Commercial Awareness",
    body: "Delivered across industrial estates, business parks, retail parks and office locations, building recognition for your business among other businesses nearby.",
  },
  {
    icon: (
      <>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </>
    ),
    title: "Generates Quality Enquiries",
    body: "A direct, physical touchpoint that gets noticed on a desk, generating genuine enquiries from people already in a position to make a decision.",
  },
  {
    icon: (
      <>
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </>
    ),
    title: "Works Alongside Your Other Marketing",
    body: "A cost-effective addition to your existing digital campaigns, email marketing and sales outreach, and one that scales from a single business park to a much wider regional campaign.",
  },
];

export default function B2BDistributionPage() {
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
              { label: "B2B Distribution" },
            ]}
          />
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">
            Hampshire &amp; Dorset &middot; Direct Business Marketing
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl">
            B2B Leaflet Distribution
          </h1>
          <p className="text-blue-200 text-lg max-w-2xl leading-relaxed">
            Putting your message directly into the hands of local business
            owners and decision-makers, delivered to offices, business parks
            and commercial areas across Hampshire and Dorset.
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                What This Service Covers
              </h2>
            </div>
          </ScrollReveal>
          <div className="space-y-4 text-gray-600 leading-relaxed">
            <p>
              B2B leaflet distribution puts your marketing directly in front
              of business owners and decision-makers, rather than relying on
              broad advertising that may never reach the right person. We
              deliver to offices, industrial estates, business parks and
              other commercial areas, focusing on the specific industries
              and sectors most relevant to what you offer.
            </p>
            <p>
              It&apos;s well suited to trades, professional services,
              recruitment agencies, commercial suppliers, and B2B events,
              helping you build brand awareness across your local commercial
              area and generate quality enquiries from people already in a
              position to buy. Curious how it compares to our other options?
              Our{" "}
              <Link href="/faq" className="text-blue-700 hover:underline font-medium">
                FAQ page
              </Link>{" "}
              covers the basics.
            </p>
            <p>
              It complements your existing marketing well, sitting alongside
              digital campaigns, email marketing and sales outreach rather
              than replacing any of it, and scales from a single business
              park to a much wider regional campaign. Take a look at{" "}
              <Link href="/case-studies" className="text-blue-700 hover:underline font-medium">
                our track record
              </Link>{" "}
              for examples of completed work.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Why Choose B2B Distribution
            </h2>
            <p className="text-gray-600 max-w-2xl mb-10">
              A direct way to put your business in front of other local
              businesses, targeted by industry and location.
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
            Ready to Reach Other Businesses?
          </h2>
          <p className="text-blue-200 mb-8 max-w-xl">
            Whether you&apos;re targeting a single business park or a wider
            commercial area across Hampshire and Dorset, we handle the
            distribution so you can focus on running your business.
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

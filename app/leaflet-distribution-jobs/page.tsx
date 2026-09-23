import type { Metadata } from "next";
import Link from "next/link";
import DistributorBenefits from "@/components/DistributorBenefits";
import DistributorRequirements from "@/components/DistributorRequirements";
import DistributorApplicationForm from "@/components/DistributorApplicationForm";
import StaggerGroup from "@/components/StaggerGroup";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Leaflet Distributor Jobs in Hampshire & Dorset",
  description:
    "Looking for flexible, self-employed work in Hampshire or Dorset? Join our leaflet distribution team. No experience needed, quick payment, work when you want.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/leaflet-distribution-jobs",
  },
  openGraph: {
    title: "Leaflet Distributor Jobs in Hampshire & Dorset",
    description:
      "Looking for flexible, self-employed work in Hampshire or Dorset? Join our leaflet distribution team. No experience needed, quick payment, work when you want.",
    url: "https://www.flyerdistributionhampshire.co.uk/leaflet-distribution-jobs",
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
    title: "Leaflet Distributor Jobs in Hampshire & Dorset",
    description:
      "Looking for flexible, self-employed work in Hampshire or Dorset? Join our leaflet distribution team. No experience needed, quick payment, work when you want.",
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
      name: "Work as a Leaflet Distributor",
      item: "https://www.flyerdistributionhampshire.co.uk/leaflet-distribution-jobs",
    },
  ],
};

// employmentType: OTHER is schema.org's own catch-all for work that isn't
// FULL_TIME/PART_TIME/CONTRACTOR/TEMPORARY/INTERN/VOLUNTEER/PER_DIEM, and
// it's the closest fit for casual, self-employed, pick-your-own-hours
// distribution work. No baseSalary: pay is agreed per job, never published
// as a fixed rate, so the field is omitted rather than guessed at. No
// validThrough: this is an ongoing, evergreen role with no closing date,
// which is Google's own recommended approach for postings that never
// expire. datePosted is what signals freshness instead.
const jobPostingSchema = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Leaflet Distributor",
  description:
    "Self-employed leaflet distributor role covering Hampshire and Dorset. Flexible hours, no experience needed, payment agreed per job and usually paid the same day. Apply online, we'll be in touch to get you started.",
  hiringOrganization: {
    "@type": "Organization",
    name: "Flyer Distribution Hampshire",
    sameAs: "https://www.flyerdistributionhampshire.co.uk",
  },
  jobLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      streetAddress: "11 Forest Reach, St Leonards",
      addressLocality: "Ringwood",
      addressRegion: "Dorset",
      postalCode: "BH24 2NR",
      addressCountry: "GB",
    },
  },
  employmentType: "OTHER",
  datePosted: "2026-09-22",
};

export default function LeafletDistributionJobsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />

      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">
            Hampshire &amp; Dorset
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl">
            Work as a Leaflet Distributor
          </h1>
          <p className="text-blue-200 text-lg max-w-xl mb-8 leading-relaxed">
            Earn flexible, self-employed income delivering leaflets in your
            local area. Work when it suits you, around a job, studying, or
            anything else on your plate.
          </p>
          <a
            href="#apply"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
          >
            Apply Now
          </a>
        </div>
      </section>

      {/* Application form — moved up to sit right under the hero, since
          that's the whole point of the page. */}
      <section id="apply" className="bg-slate-50 scroll-mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Apply to Join the Team
            </h2>
            <p className="text-gray-600 max-w-xl mb-10">
              Fill in your details below and we&apos;ll be in touch to get you started.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 items-start">
            <ScrollReveal>
              <DistributorApplicationForm />
            </ScrollReveal>
            <StaggerGroup className="space-y-5">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Quick Payment</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Often same day, always agreed with you before each job.
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">No Experience Needed</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  We&apos;ll talk you through everything once you apply.
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Serving Hampshire &amp; Dorset</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Rounds available across the areas we cover, including{" "}
                  <Link href="/areas/southampton" className="text-blue-700 hover:underline">
                    Southampton
                  </Link>{" "}
                  and{" "}
                  <Link href="/areas/dorset" className="text-blue-700 hover:underline">
                    Dorset
                  </Link>
                  .
                </p>
              </div>
            </StaggerGroup>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white border-t border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-3">
              Why Distribute With Us
            </h2>
            <p className="text-gray-600 text-center max-w-xl mx-auto mb-12">
              A genuinely easy way to earn extra income, on your own terms.
            </p>
          </ScrollReveal>
          <DistributorBenefits />
        </div>
      </section>

      {/* Requirements */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-8">
              What You&apos;ll Need
            </h2>
          </ScrollReveal>
          <DistributorRequirements />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-10">
              How It Works
            </h2>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Apply Above", body: "Fill in the short form and tell us a bit about yourself." },
              { step: "2", title: "We're In Touch", body: "We'll message you, most likely on WhatsApp, usually quickly." },
              { step: "3", title: "Start Earning", body: "It's a genuinely easy process to get going and start your first round." },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mb-4">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-blue-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Further reading */}
      <section className="bg-slate-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600 text-sm">
            Want to know more about us first? Read{" "}
            <Link href="/about" className="text-blue-700 hover:underline font-medium">
              our story
            </Link>{" "}
            or check our{" "}
            <Link href="/faq" className="text-blue-700 hover:underline font-medium">
              FAQ
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}

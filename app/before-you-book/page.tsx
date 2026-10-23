import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

const PAGE_URL = "https://www.flyerdistributionhampshire.co.uk/before-you-book";
const TITLE = "Before You Book";
const DESCRIPTION =
  "Choosing a leaflet distributor? Why the cheapest drop is rarely the best value, real messages from clients who came back to us, and what to look for beyond price.";
const OG_IMAGE = "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200";
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `${TITLE} | Flyer Distribution Hampshire`,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Flyer Distribution Hampshire",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | Flyer Distribution Hampshire`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.flyerdistributionhampshire.co.uk" },
    { "@type": "ListItem", position: 2, name: "Before You Book", item: PAGE_URL },
  ],
};

// Real messages from clients who tried the cheapest distributor first,
// shared with permission. Each screen's background matches its screenshot.
const messages = [
  {
    src: "/before-you-book-message-1.webp",
    background: "#c4c3c8",
    caption: "The quality of their delivery has been sub par according to residents.",
    alt: "Message from a client: The quality of their delivery has been sub par according to residents. I will likely go with you next time. Remind me how much it would be to print and deliver A5 leaflets double sided?",
  },
  {
    src: "/before-you-book-message-2.webp",
    background: "#000000",
    caption: "We went back and spoke to the residents and no one had received a leaflet.",
    alt: "Message from a client: We printed off 2500 for this month, and had to cancel the job halfway through as they said they did half of them. We went back and spoke to the residents and no one had received a leaflet. They didn't provide tracking either. Are you available to do the other 1250?",
  },
  {
    src: "/before-you-book-message-3.webp",
    background: "#131315",
    caption: "A resident received 20 leaflets through their letterbox.",
    alt: "Email from a client: I went with another company in the end, but unfortunately it looks like I made the wrong decision. A resident received 20 leaflets through their letterbox, and I have now ended up with a bad review as a result. I'd rather get this sorted properly with you this time.",
  },
];

const payingFor = [
  {
    title: "Our own local team",
    body: "People who know Hampshire and Dorset and take pride in the work.",
    link: { href: "/about", label: "Meet the team" },
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
  },
  {
    title: "GPS tracked rounds",
    body: "Every round is recorded, with a route report once delivery is complete.",
    link: { href: "/case-studies", label: "See examples" },
    icon: (
      <>
        <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  {
    title: "The right doors",
    body: "Targeted by postcode, so your leaflets reach the homes you want.",
    link: { href: "/areas", label: "Areas we cover" },
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
  },
  {
    title: "Clients who come back",
    body: "We'd rather earn your next campaign than rush this one.",
    link: { href: "/services", label: "Our services" },
    icon: (
      <>
        <path d="M21 12a9 9 0 01-15.4 6.4L3 16" />
        <path d="M3 21v-5h5" />
        <path d="M3 12a9 9 0 0115.4-6.4L21 8" />
        <path d="M21 3v5h-5" />
      </>
    ),
  },
];

const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

const Tick = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="w-5 h-5 shrink-0 mt-0.5 text-blue-700"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const link = "text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors";

export default function BeforeYouBookPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Header band */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Before You Book" }]} />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Before You Book</h1>
          <p className="text-blue-200 text-xl max-w-2xl leading-relaxed">
            What to know before you choose who delivers your leaflets.
          </p>
        </div>
      </section>

      {/* Price & Quality, and the messages */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Price &amp; Quality</h2>
          <p className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 leading-snug max-w-3xl mb-4">
            The cheapest leaflet drop is rarely the best value.
          </p>
          <p className="text-gray-600 text-lg max-w-2xl leading-relaxed mb-12">
            These are real messages from people who went with the cheapest distributor they could find first,
            then came back to us.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 justify-items-center">
            {messages.map((m) => (
              <figure key={m.src} className="w-full max-w-[300px]">
                <div className="rounded-[28px] border-[10px] border-[#0f172a] overflow-hidden shadow-[0_20px_40px_-16px_rgba(15,23,42,0.45)]">
                  <div className="relative aspect-[4/5]" style={{ backgroundColor: m.background }}>
                    <Image src={m.src} alt={m.alt} fill sizes="(min-width: 768px) 280px, 80vw" className="object-contain" />
                  </div>
                </div>
                <figcaption className="mt-5 text-gray-700 text-base leading-relaxed text-center">{m.caption}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-10 text-sm text-gray-500 text-center">
            Real messages from real clients, shared with permission. Names and the other company&apos;s details
            removed.
          </p>
        </div>
      </section>

      {/* Too good to be true */}
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="font-heading text-2xl sm:text-3xl font-bold text-blue-900 leading-snug">
            If it seems too good to be true, it usually is.
          </p>
          <div className="w-16 h-1 bg-yellow-400 rounded-full mx-auto my-6" aria-hidden="true" />
          <p className="text-gray-600 text-lg leading-relaxed mb-5">
            If you&apos;re after the cheapest service, we&apos;re not the ones to go with. If you want every one of your
            leaflets{" "}
            <Link href="/services" className={link}>
              delivered properly, to a high standard
            </Link>
            , we&apos;re definitely the ones to pick.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            We want to work with our clients again and again, not take the money and rush the job. You can see the
            kind of work we do in{" "}
            <Link href="/case-studies" className={link}>
              our recent campaigns
            </Link>
            .
          </p>
        </div>
      </section>

      {/* What you're paying for */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-10">What you&apos;re paying for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {payingFor.map((item) => (
              <div
                key={item.title}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:shadow-lg transition-all duration-300 ease-out h-full flex flex-col"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <svg className="w-6 h-6 text-blue-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                <h3 className="text-base font-semibold text-blue-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-base leading-relaxed mb-4 flex-1">{item.body}</p>
                <Link href={item.link.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors">
                  {item.link.label}
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Worried it'll cost too much? */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Worried it&apos;ll cost too much?</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              Asking costs nothing. Tell us roughly what you&apos;d like to spend, and we&apos;ll show you the best campaign
              it can buy.
            </p>
            <ul className="space-y-3 text-gray-700 text-lg">
              <li className="flex items-start gap-3">
                <Tick />
                Free quote, with no obligation to book
              </li>
              <li className="flex items-start gap-3">
                <Tick />
                Your quote within 24 hours
              </li>
              <li className="flex items-start gap-3">
                <Tick />
                A campaign built around your budget
              </li>
              <li className="flex items-start gap-3">
                <Tick />
                <span>
                  Got questions first?{" "}
                  <Link href="/faq" className={link}>
                    Read our FAQs
                  </Link>
                </span>
              </li>
            </ul>
          </div>
          {/* The stars are #d97706 on #f6f9fe: 3.02:1, above the 3:1 graphics need. */}
          <figure className="rounded-2xl bg-[#f6f9fe] border border-[#dbe4f0] p-6 sm:p-8">
            <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-6 w-auto fill-[#d97706] mb-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
              ))}
            </svg>
            <blockquote className="text-gray-800 text-lg leading-relaxed">
              &ldquo;...the pricing was very reasonable compared with other distributors I contacted. The whole process
              was straightforward and reliable, and I&apos;d definitely use the service again.&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-bold text-blue-900">Auriel Cochrane</span>
              <span className="ml-2 text-[#475569]">Google Review</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Want it done properly? */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Want it done properly?</h2>
          <p className="text-blue-200 text-lg leading-relaxed mb-8">
            Tell us about your campaign and we&apos;ll put together a free, no-obligation quote.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-8 py-3.5 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
          >
            Get a Free Quote
          </Link>
          <p className="text-blue-200 mt-6">
            Or see{" "}
            <Link href="/areas" className="text-white underline underline-offset-2 hover:text-blue-200 transition-colors">
              where we deliver
            </Link>{" "}
            and{" "}
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="text-white underline underline-offset-2 hover:text-blue-200 transition-colors"
            >
              what our clients say
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}

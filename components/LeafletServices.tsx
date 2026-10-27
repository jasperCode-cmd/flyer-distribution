import Link from "next/link";
import StaggerGroup from "@/components/StaggerGroup";

// The homepage's "Leaflet Services" section: the two print packages as large
// cards, three core services as smaller cards, and the rest as one line of
// links. Every description is the homepage's own, word for word; services
// with a page of their own link to it, the rest to /services.

type Icon = "pen" | "printer" | "mail" | "target" | "hand";

export const PACKAGES = [
  {
    title: "Design, Print and Deliver",
    desc: "Our full end-to-end service. We handle everything from design and printing in A6, A5, A4 or DL through to full distribution across your chosen areas.",
    href: "/services",
    icon: "pen" as Icon,
    tags: ["Design", "Print", "Deliver"],
  },
  {
    title: "Print and Deliver",
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    href: "/services",
    icon: "printer" as Icon,
    tags: ["Print", "Deliver"],
  },
];

export const CORE_SERVICES = [
  {
    title: "Leaflet Distribution",
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
    href: "/services",
    icon: "mail" as Icon,
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    href: "/services",
    icon: "target" as Icon,
  },
  {
    title: "Hand-to-Hand Leaflet Distribution",
    desc: "Direct, face-to-face handouts at shopping centres, town centres and events across Hampshire and Dorset for immediate brand exposure.",
    href: "/services/hand-to-hand-distribution",
    icon: "hand" as Icon,
  },
];

export const MORE_SERVICES = [
  { title: "Campaign Planning", href: "/services" },
  { title: "Vehicle Leaflet Distribution", href: "/services" },
  { title: "Public Notice Leafleting", href: "/services/public-notice-leafleting" },
  { title: "B2B Leaflet Distribution", href: "/services/b2b-distribution" },
];

// Line icons in the site's style: 24px grid, 1.75 stroke, round ends.
function ServiceIcon({ name, className }: { name: Icon; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {name === "pen" && (
        <>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </>
      )}
      {name === "printer" && (
        <>
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </>
      )}
      {name === "mail" && (
        <>
          <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path d="M22 6l-10 7L2 6" />
        </>
      )}
      {name === "target" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </>
      )}
      {name === "hand" && (
        <>
          <path d="M18 11V6a2 2 0 00-4 0" />
          <path d="M14 10V4a2 2 0 00-4 0v2" />
          <path d="M10 10.5V6a2 2 0 00-4 0v8" />
          <path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
        </>
      )}
    </svg>
  );
}

const Arrow = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// The site's hover lift, and a focus ring that shows on the light background.
const CARD = "group flex h-full flex-col rounded-2xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50";
const IN_TEXT_LINK = "font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900";

export default function LeafletServices() {
  const [featured, standard] = PACKAGES;
  return (
    <section className="bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 1. Header row */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[#1d4ed8] text-xs sm:text-sm font-bold uppercase tracking-[0.16em] mb-3">What we do</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">Leaflet Services</h2>
            <p className="text-gray-600 text-lg">
              From door-to-door delivery to targeted postcode campaigns, we have a service to suit every budget and campaign goal.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex shrink-0 items-center gap-2 self-start md:self-auto rounded-md border-2 border-blue-700 px-5 py-2.5 font-bold text-blue-700 transition-colors duration-200 hover:bg-blue-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
          >
            View all services
            <Arrow />
          </Link>
        </div>

        {/* 2. The two packages */}
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href={featured.href} className={`${CARD} relative bg-[#1e3a8a] p-7 sm:p-8 text-white shadow-lg`}>
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <ServiceIcon name={featured.icon} className="h-7 w-7 text-white" />
            </span>
            <h3 className="mt-6 text-2xl font-bold">{featured.title}</h3>
            {/* Placed top right; after the name in reading order. */}
            <span className="absolute top-6 right-6 rounded-full bg-[#facc15] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1e3a8a]">
              Most popular
            </span>
            <p className="mt-3 text-blue-100 text-base leading-relaxed">{featured.desc}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {featured.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                  {tag}
                </li>
              ))}
            </ul>
            <span className="mt-auto pt-7 inline-flex items-center gap-1.5 font-bold text-[#facc15]">
              Find out more
              <Arrow className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
          <Link href={standard.href} className={`${CARD} border border-gray-200 bg-white p-7 sm:p-8 shadow-md`}>
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
              <ServiceIcon name={standard.icon} className="h-7 w-7 text-blue-700" />
            </span>
            <h3 className="mt-6 text-2xl font-bold text-blue-900">{standard.title}</h3>
            <p className="mt-3 text-gray-600 text-base leading-relaxed">{standard.desc}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {standard.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                  {tag}
                </li>
              ))}
            </ul>
            <span className="mt-auto pt-7 inline-flex items-center gap-1.5 font-bold text-[#1d4ed8]">
              Find out more
              <Arrow className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </StaggerGroup>

        {/* 3. Three core services */}
        <StaggerGroup className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {CORE_SERVICES.map((svc) => (
            <Link key={svc.title} href={svc.href} className={`${CARD} border border-gray-200 bg-white p-6 shadow-sm`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                <ServiceIcon name={svc.icon} className="h-6 w-6 text-blue-700" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-blue-900">{svc.title}</h3>
              <p className="mt-2 text-gray-600 text-base leading-relaxed">{svc.desc}</p>
            </Link>
          ))}
        </StaggerGroup>

        {/* 4. Everything else, in one line */}
        <p className="mt-8 text-gray-600 text-base leading-relaxed">
          Also:{" "}
          {MORE_SERVICES.map((svc, i) => (
            <span key={svc.title}>
              <Link href={svc.href} className={IN_TEXT_LINK}>
                {svc.title}
              </Link>
              {i < MORE_SERVICES.length - 2 ? ", " : i === MORE_SERVICES.length - 2 ? " and " : "."}
            </span>
          ))}{" "}
          <Link href="/services" className="inline-flex items-center gap-1 font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
            View all services
            <Arrow className="w-3.5 h-3.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}

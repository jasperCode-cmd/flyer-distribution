import Link from "next/link";
import StaggerGroup from "@/components/StaggerGroup";

// The homepage's "Leaflet Services" section: the two print packages as large
// cards, three core services as smaller cards, and the rest as one line of
// links. Every description is the homepage's own, word for word; services
// with a page of their own link to it, the rest to their card on /services.
//
// On phones (below md) the same markup is much shorter: Design, Print and
// Deliver is one compact navy card, the other four are rows of one white
// panel (each with a short line instead of its description), the Also line
// names the same services in smaller text, and View all services moves to the
// bottom. Nothing is rendered twice: what a phone doesn't show is display:
// none there.

type Icon = "pen" | "printer" | "mail" | "target" | "hand";

export const PACKAGES = [
  {
    title: "Design, Print and Deliver",
    desc: "Our full end-to-end service. We handle everything from design and printing in A6, A5, A4 or DL through to full distribution across your chosen areas.",
    href: "/services#design-print-deliver",
    icon: "pen" as Icon,
    tags: ["Design", "Print", "Deliver"],
    phoneLine: "We design it, print it and deliver it for you.",
  },
  {
    title: "Print and Deliver",
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    href: "/services#print-and-deliver",
    icon: "printer" as Icon,
    tags: ["Print", "Deliver"],
    phoneLine: "Your artwork, printed and delivered",
  },
];

export const CORE_SERVICES = [
  {
    title: "Leaflet Distribution",
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
    href: "/services#leaflet-distribution",
    icon: "mail" as Icon,
    phoneLine: "Through letterboxes in your areas",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    href: "/services#targeted-postcode-campaigns",
    icon: "target" as Icon,
    phoneLine: "Focus on the areas most likely to respond",
  },
  {
    title: "Hand-to-Hand Leaflet Distribution",
    desc: "Direct, face-to-face handouts at shopping centres, town centres and events across Hampshire and Dorset for immediate brand exposure.",
    href: "/services/hand-to-hand-distribution",
    icon: "hand" as Icon,
    phoneTitle: "Hand-to-Hand Distribution",
    phoneLine: "Handed out at events and busy spots",
  },
];

export const MORE_SERVICES = [
  { title: "Leaflet Printing", href: "/leaflet-printing" },
  { title: "Campaign Planning", href: "/services#campaign-planning" },
  { title: "Vehicle Leaflet Distribution", href: "/services#vehicle-leaflet-distribution" },
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
// A row of the phone's white panel (at least 56px tall, a 36px icon square,
// a chevron), which is the card above from md up. The panel's 1px #e2e8f0
// border is drawn by its rows, with #f1f5f9 lines between them.
const ROW =
  "group flex h-full min-h-14 items-center gap-3 border-x border-x-[#e2e8f0] bg-white px-4 py-3 transition-all duration-300 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 md:flex-col md:items-stretch md:gap-0 md:rounded-2xl md:border md:border-gray-200 md:hover:-translate-y-1 md:hover:bg-white md:hover:shadow-xl";
const ROW_ICON = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe] md:rounded-xl md:bg-blue-50 md:ring-1 md:ring-blue-100";
const IN_TEXT_LINK = "font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900 md:font-medium";
// The phone's stagger is off, so the panel's rows arrive together.
const NO_PHONE_STAGGER = "max-md:translate-y-0 max-md:opacity-100";

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-auto h-4 w-4 shrink-0 text-slate-400 md:hidden" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function LeafletServices() {
  const [featured, standard] = PACKAGES;
  return (
    <section className="bg-slate-50">
      {/* On phones one column, View all services last; from md a grid with it top right, beside the header. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-6">
        {/* 1. Header */}
        <div className="max-w-2xl">
          <p className="text-[#1d4ed8] text-xs sm:text-sm font-bold uppercase tracking-[0.16em] mb-3">What we do</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">Leaflet Services</h2>
          <p className="text-gray-600 text-lg">
            From door-to-door delivery to targeted postcode campaigns, we have a service to suit every budget and campaign goal.
          </p>
        </div>

        <div className="mt-8 md:col-span-2 md:mt-10">
          {/* 2. The two packages: Design, Print and Deliver, then Print and Deliver (the panel's first row on phones). */}
          <StaggerGroup className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6" itemClassName={NO_PHONE_STAGGER}>
            <Link href={featured.href} className={`${CARD} relative bg-[#1e3a8a] p-[18px] md:p-8 text-white shadow-lg`}>
              <span className="hidden md:flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <ServiceIcon name={featured.icon} className="h-7 w-7 text-white" />
              </span>
              <div className="flex items-start justify-between gap-3 md:block">
                <h3 className="font-heading text-[20px] font-extrabold md:mt-6 md:text-2xl md:font-bold">{featured.title}</h3>
                {/* Top right; after the name in reading order. */}
                <span className="shrink-0 rounded-full bg-[#facc15] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1e3a8a] md:absolute md:top-6 md:right-6">
                  Most popular
                </span>
              </div>
              <p className="mt-3 hidden text-blue-100 text-base leading-relaxed md:block">{featured.desc}</p>
              <p className="mt-1 text-[15px] text-[#dbeafe] md:hidden">{featured.phoneLine}</p>
              <ul className="mt-5 hidden flex-wrap gap-2 md:flex">
                {featured.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                    {tag}
                  </li>
                ))}
              </ul>
              <span className="mt-3 inline-flex items-center gap-1.5 font-bold text-[#facc15] md:mt-auto md:pt-7">
                Find out more
                <Arrow className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
            <Link href={standard.href} className={`${ROW} rounded-t-2xl border-t border-t-[#e2e8f0] md:p-8 md:shadow-md`}>
              <span className={`${ROW_ICON} md:h-14 md:w-14`}>
                <ServiceIcon name={standard.icon} className="h-5 w-5 text-[#1d4ed8] md:h-7 md:w-7 md:text-blue-700" />
              </span>
              <div className="min-w-0 md:mt-6">
                <h3 className="text-[15px] font-bold text-blue-900 md:text-2xl">{standard.title}</h3>
                <p className="text-[13px] text-gray-500 md:hidden">{standard.phoneLine}</p>
              </div>
              <p className="mt-3 hidden text-gray-600 text-base leading-relaxed md:block">{standard.desc}</p>
              <ul className="mt-5 hidden flex-wrap gap-2 md:flex">
                {standard.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                    {tag}
                  </li>
                ))}
              </ul>
              <span className="mt-auto hidden items-center gap-1.5 pt-7 font-bold text-[#1d4ed8] md:inline-flex">
                Find out more
                <Arrow className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
              <Chevron />
            </Link>
          </StaggerGroup>

          {/* 3. Three core services: the panel's other rows on phones, cards from md. */}
          <StaggerGroup className="grid grid-cols-1 md:mt-6 md:grid-cols-3 md:gap-6" itemClassName={NO_PHONE_STAGGER}>
            {CORE_SERVICES.map((svc, i) => (
              <Link
                key={svc.title}
                href={svc.href}
                className={`${ROW} border-t border-t-[#f1f5f9] md:p-6 md:shadow-sm ${i === CORE_SERVICES.length - 1 ? "rounded-b-2xl border-b border-b-[#e2e8f0]" : ""}`}
              >
                <span className={`${ROW_ICON} md:h-12 md:w-12`}>
                  <ServiceIcon name={svc.icon} className="h-5 w-5 text-[#1d4ed8] md:h-6 md:w-6 md:text-blue-700" />
                </span>
                <div className="min-w-0 md:mt-5">
                  <h3 className="text-[15px] font-bold text-blue-900 md:text-lg">
                    {svc.phoneTitle ? (
                      <>
                        <span className="md:hidden">{svc.phoneTitle}</span>
                        <span className="hidden md:inline">{svc.title}</span>
                      </>
                    ) : (
                      svc.title
                    )}
                  </h3>
                  <p className="text-[13px] text-gray-500 md:hidden">{svc.phoneLine}</p>
                </div>
                <p className="mt-2 hidden text-gray-600 text-base leading-relaxed md:block">{svc.desc}</p>
                <Chevron />
              </Link>
            ))}
          </StaggerGroup>
        </div>

        {/* 4. Everything else, in one line (smaller on phones); View all services here from md, as the button on phones. */}
        <p className="mt-5 text-sm leading-relaxed text-gray-500 md:col-span-2 md:mt-8 md:text-base md:text-gray-600">
          Also:{" "}
          {MORE_SERVICES.map((svc, i) => (
            <span key={svc.title}>
              <Link href={svc.href} className={IN_TEXT_LINK}>
                {svc.title}
              </Link>
              {i < MORE_SERVICES.length - 2 ? ", " : i === MORE_SERVICES.length - 2 ? " and " : "."}
            </span>
          ))}
          <span className="hidden md:inline"> </span>
          <Link
            href="/services"
            className="hidden items-center gap-1 font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 md:inline-flex"
          >
            View all services
            <Arrow className="w-3.5 h-3.5" />
          </Link>
        </p>

        {/* View all services: at the bottom on phones (full width, 48px), top right from md. One link, placed by the grid. */}
        <Link
          href="/services"
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-blue-700 px-5 py-2.5 font-bold text-blue-700 transition-colors duration-200 hover:bg-blue-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 md:col-start-2 md:row-start-1 md:mt-0 md:inline-flex md:min-h-0 md:w-auto md:shrink-0 md:justify-self-end"
        >
          View all services
          <Arrow />
        </Link>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer & Leaflet Distribution Services",
  description:
    "Explore our flyer and leaflet distribution services in Hampshire, including solus drops, shared distribution, B2B delivery and more.",
};

const services = [
  {
    title: "Solus Distribution",
    desc: "Your flyer delivered alone through each letterbox, with no other leaflets competing for attention. The most impactful option for campaigns where quality matters.",
    image: "https://picsum.photos/seed/solus/600/400",
    alt: "Single flyer being delivered through a letterbox",
  },
  {
    title: "Shared Distribution",
    desc: "Share delivery costs with non-competing businesses. A cost-effective way to reach thousands of homes without breaking your marketing budget.",
    image: "https://picsum.photos/seed/shared/600/400",
    alt: "Bundle of leaflets ready for shared distribution",
  },
  {
    title: "Business-to-Business (B2B)",
    desc: "Target commercial premises, offices, and retail parks across Hampshire. Perfect for B2B services, suppliers, and trade businesses.",
    image: "https://picsum.photos/seed/b2b/600/400",
    alt: "Office park targeted for B2B leaflet delivery",
  },
  {
    title: "Door-to-Door Residential",
    desc: "Full coverage of chosen postcodes, street by street. Great for restaurants, tradespeople, estate agents, and any business that relies on local custom.",
    image: "https://picsum.photos/seed/doortodoor/600/400",
    alt: "Distributor walking down a residential street",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "Use our postcode-level targeting to focus your budget on the streets most likely to convert. We'll help you choose the right areas.",
    image: "https://picsum.photos/seed/postcode/600/400",
    alt: "Map highlighting targeted postcode areas",
  },
  {
    title: "Event & Venue Distribution",
    desc: "Distribute flyers at events, community centres, gyms, and high-footfall venues to reach your audience where they gather.",
    image: "https://picsum.photos/seed/event/600/400",
    alt: "Flyers being handed out at a local event",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Our Services</h1>
          <p className="text-blue-200 max-w-xl text-lg">
            Flexible flyer and leaflet distribution solutions for businesses of
            all sizes across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((svc) => (
              <div
                key={svc.title}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
              >
                <Image
                  src={svc.image}
                  alt={svc.alt}
                  width={600}
                  height={400}
                  className="w-full h-44 object-cover"
                />
                <div className="p-5">
                  <h2 className="text-base font-semibold text-blue-900 mb-2">
                    {svc.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{svc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Not Sure Which Service Is Right for You?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Get in touch and we'll recommend the most effective distribution
            strategy for your business and budget.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-md transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}

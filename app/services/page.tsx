import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer & Leaflet Distribution Services",
  description:
    "Explore our leaflet distribution services in Hampshire and Dorset, including door-to-door delivery, targeted postcode campaigns, vehicle distribution and more.",
};

const services = [
  {
    title: "Leaflet Distribution",
    desc: "Standard door-to-door leaflet delivery to households across your chosen areas. We handle the rounds so your printed materials land directly through letterboxes across Hampshire and Dorset.",
    image: "https://picsum.photos/seed/leafletdist/600/400",
    alt: "Distributor posting leaflets through residential letterboxes",
  },
  {
    title: "Door-to-Door Residential",
    desc: "Full residential coverage of your chosen postcodes and areas. Great for restaurants, tradespeople, estate agents, and any business that relies on local custom.",
    image: "https://picsum.photos/seed/residential/600/400",
    alt: "Distributor walking through a residential area",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "Focus your budget on the postcode areas most likely to convert. We help you choose the right zones and quantities to get the best return from your campaign.",
    image: "https://picsum.photos/seed/postcode/600/400",
    alt: "Map highlighting targeted postcode areas",
  },
  {
    title: "Event & Venue Distribution",
    desc: "Distribute flyers at events, community centres, gyms, and high-footfall venues to reach your audience where they gather.",
    image: "https://picsum.photos/seed/eventdist/600/400",
    alt: "Flyers being handed out at a local event",
  },
  {
    title: "Vehicle Leaflet Distribution",
    desc: "Place leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. An effective way to reach people already out and spending locally.",
    image: "https://picsum.photos/seed/vehicle/600/400",
    alt: "Leaflets placed on parked cars in a car park",
  },
  {
    title: "Campaign Planning",
    desc: "Not sure where to start? We help businesses choose the right areas, postcodes, and quantities for their distribution campaign to make every leaflet count.",
    image: "https://picsum.photos/seed/planning/600/400",
    alt: "Business owner planning a leaflet distribution campaign",
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

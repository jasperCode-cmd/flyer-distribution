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
    desc: "Standard door-to-door leaflet delivery to households across your chosen areas in Hampshire and Dorset. We handle the rounds so your printed materials land directly through letterboxes.",
    image: "https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?w=800&q=80",
    alt: "Distributor posting leaflets through residential letterboxes",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "Focus your campaign on the specific postcode areas most relevant to your business. We help you choose the right zones and quantities to get the best return.",
    image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80",
    alt: "Map highlighting targeted postcode areas",
  },
  {
    title: "Vehicle Leaflet Distribution",
    desc: "Place leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. An effective way to reach people already out and spending locally.",
    image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80",
    alt: "Leaflets placed on parked cars in a car park",
  },
  {
    title: "Campaign Planning",
    desc: "We help businesses choose the right areas, postcodes, and quantities for their distribution campaign to make every leaflet count.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

          {/* Supporting service */}
          <div className="mt-10 border-t border-gray-200 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-4">
              Also Available
            </p>
            <div className="bg-white rounded-lg border border-gray-200 p-6 md:max-w-xl hover:border-blue-300 transition-colors">
              <h2 className="text-base font-semibold text-blue-900 mb-2">
                Print &amp; Deliver
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Need your leaflets produced before distribution? We offer
                printing in A6, A5, and A4. Just let us know when requesting
                your quote and we can handle both print and delivery together.
              </p>
            </div>
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

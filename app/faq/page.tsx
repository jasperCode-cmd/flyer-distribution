import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ: Frequently Asked Questions",
  description:
    "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more.",
};

const faqs = [
  {
    q: "What areas do you cover?",
    a: "We cover the Hampshire and Dorset corridor, from Winchester in the north to Poole in the west. This includes Southampton, Portsmouth, Bournemouth, Poole, Winchester, Eastleigh, New Forest, Romsey, Ringwood, Christchurch, Hythe, Totton, Hedge End, and Chandler's Ford. If your target area is not listed, get in touch and we can often accommodate additional postcodes on request.",
  },
  {
    q: "How does leaflet distribution work?",
    a: "You supply the printed leaflets and we take care of the delivery. We post them directly through letterboxes in your chosen postcode areas across Hampshire and Dorset. Once your campaign is agreed and materials are received, our distribution teams carry out the rounds and confirm completion.",
  },
  {
    q: "Can I target specific postcode areas?",
    a: "Yes. Postcode-level targeting is central to how we work. You choose the postcode areas you want to reach, and we focus the campaign there. Our Campaign Planning service can help if you are unsure which postcode areas are best suited to your business.",
  },
  {
    q: "Do I need to have my leaflets printed already?",
    a: "Not necessarily. You can supply your own printed leaflets, or we can handle printing for you. We print A6, A5, A4, and DL. Just let us know when requesting your quote and we will include printing in the price.",
  },
  {
    q: "How do I get a quote?",
    a: "Use the Get a Quote page and tell us your target postcode areas and approximate quantity. We will come back to you within 24 hours with a tailored price for your campaign.",
  },
  {
    q: "How many leaflets do I need?",
    a: "That depends on the postcode areas you want to cover and how many households are within them. As a rough guide, a single postcode area typically contains between 1,500 and 3,000 households. We can advise on quantities as part of our Campaign Planning service.",
  },
  {
    q: "What size leaflets do you deliver?",
    a: "We deliver most standard leaflet sizes including A6, A5, A4, and DL. If you are unsure whether your format is suitable, just ask before you go to print.",
  },
  {
    q: "What is vehicle leaflet distribution?",
    a: "Vehicle leaflet distribution involves placing your leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. It is an effective way to reach people who are already out and spending locally, and works well alongside a door-to-door campaign.",
  },
  {
    q: "How long does a campaign take?",
    a: "Most campaigns are completed within 5 to 10 working days of us receiving your materials. Smaller campaigns covering fewer postcode areas can often be turned around more quickly. We will agree a timeline with you before the campaign begins.",
  },
];

export default function FaqPage() {
  return (
    <>
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
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-6"
              >
                <h2 className="text-base font-semibold text-blue-900 mb-2">
                  {faq.q}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
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
              className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3 rounded-md transition-colors text-sm"
            >
              Get a Free Quote
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

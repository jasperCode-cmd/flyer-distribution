import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description:
    "Answers to common questions about flyer and leaflet distribution in Hampshire. Learn about pricing, quantities, timing and more.",
};

const faqs = [
  {
    q: "How much does leaflet distribution cost in Hampshire?",
    a: "Pricing depends on the quantity, distribution type (solus or shared), and target area. Shared distribution starts from a lower cost per door, while solus delivery costs more but gives your flyer maximum impact. Contact us for a free quote tailored to your campaign.",
  },
  {
    q: "What is the minimum order quantity?",
    a: "We generally work with campaigns from 500 flyers upwards. Smaller quantities are possible for targeted B2B campaigns — just ask.",
  },
  {
    q: "How long does distribution take?",
    a: "Turnaround depends on quantity and area. Most residential campaigns are completed within 5–10 working days of us receiving your materials. We can often work faster for smaller campaigns.",
  },
  {
    q: "Do I need to print my own flyers?",
    a: "Yes — you supply the printed materials and we deliver them. We can recommend print suppliers if you need help with that step.",
  },
  {
    q: "What is solus distribution?",
    a: "Solus means your flyer is delivered on its own — not bundled with any other leaflets. This gives it the best chance of being noticed and read. It costs more per door than shared distribution but is often worth it for high-impact campaigns.",
  },
  {
    q: "What is shared distribution?",
    a: "Shared distribution means your flyer is bundled with a small number of non-competing leaflets from other businesses. It's a cost-effective option that significantly reduces the price per door.",
  },
  {
    q: "How do I know my flyers have been delivered?",
    a: "We complete all rounds as agreed and report back on completion. For larger campaigns we can discuss monitoring arrangements in advance.",
  },
  {
    q: "Which areas do you cover?",
    a: "We cover all major towns and postcodes across Hampshire and into Dorset, including Southampton, Portsmouth, Bournemouth, Poole, Winchester, Eastleigh, Fareham, and more. See our areas page for the full list.",
  },
  {
    q: "Can I target specific postcodes or streets?",
    a: "Absolutely. Targeted postcode and street-level distribution is one of our specialities. We'll work with you to define exactly which households you want to reach.",
  },
  {
    q: "Do you offer B2B distribution?",
    a: "Yes. We can target commercial premises, offices, retail parks, and business estates across Hampshire for business-to-business campaigns.",
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
            Everything you need to know about flyer distribution in Hampshire.
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

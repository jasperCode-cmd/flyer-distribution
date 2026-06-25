import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaflet Distribution Blog",
  description:
    "Tips, guides, and news from the Flyer Distribution Hampshire team. Learn how to get the most from your leaflet campaigns.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/blog",
  },
  openGraph: {
    title: "Leaflet Distribution Blog",
    description:
      "Tips, guides, and news from the Flyer Distribution Hampshire team. Learn how to get the most from your leaflet campaigns.",
    url: "https://www.flyerdistributionhampshire.co.uk/blog",
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
    title: "Leaflet Distribution Blog",
    description:
      "Tips, guides, and news from the Flyer Distribution Hampshire team. Learn how to get the most from your leaflet campaigns.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

export default function BlogPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Blog</h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Tips, guides, and insights for getting the most out of your leaflet
            and flyer campaigns.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-lg">
            We are working on guides and tips for local businesses running
            leaflet campaigns. Check back soon.
          </p>
        </div>
      </section>
    </>
  );
}

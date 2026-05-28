import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog: Leaflet Distribution Tips & News",
  description:
    "Tips, guides, and news from the Flyer Distribution Hampshire team. Learn how to get the most from your leaflet campaigns.",
  robots: {
    index: false,
    follow: true,
  },
};

const posts = [
  {
    title: "5 Reasons Leaflet Distribution Still Works in 2024",
    excerpt:
      "Digital ads dominate the conversation, but print marketing continues to deliver measurable results for local businesses. Here's why.",
    date: "12 November 2024",
    image: "https://picsum.photos/seed/blog1/600/400",
    alt: "Stack of colourful leaflets ready for distribution",
    slug: "#",
  },
  {
    title: "Leaflet Distribution or Vehicle Distribution: Which Is Right for Your Campaign?",
    excerpt:
      "Both approaches have their place. We break down the pros, cons, and ideal use cases so you can make the right choice for your business.",
    date: "28 October 2024",
    image: "https://picsum.photos/seed/blog2/600/400",
    alt: "Leaflets being placed on a parked car in a car park",
    slug: "#",
  },
  {
    title: "How to Design a Flyer That Gets Results",
    excerpt:
      "A well-delivered flyer is wasted if the design fails to grab attention. Follow these simple principles to maximise your response rate.",
    date: "15 October 2024",
    image: "https://picsum.photos/seed/blog3/600/400",
    alt: "Person designing a flyer on a laptop",
    slug: "#",
  },
  {
    title: "Targeting the Right Postcodes: A Guide for Hampshire Businesses",
    excerpt:
      "Not all postcode areas are equal. Learn how to use demographic data to choose the areas most likely to respond to your campaign.",
    date: "2 October 2024",
    image: "https://picsum.photos/seed/blog4/600/400",
    alt: "Map of Hampshire postcodes",
    slug: "#",
  },
];

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

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <article
                key={post.title}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
              >
                <Image
                  src={post.image}
                  alt={post.alt}
                  width={600}
                  height={400}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <p className="text-xs text-gray-400 mb-2">{post.date}</p>
                  <h2 className="text-base font-semibold text-blue-900 mb-2">
                    <Link href={post.slug} className="hover:text-blue-700">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {post.excerpt}
                  </p>
                  <Link
                    href={post.slug}
                    className="text-blue-700 text-xs font-semibold hover:underline"
                  >
                    Read more →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

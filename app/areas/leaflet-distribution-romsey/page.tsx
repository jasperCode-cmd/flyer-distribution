import type { Metadata } from "next";
import AreaPage from "@/components/AreaPage";
import { AREA_PAGES } from "@/lib/area-pages";

export const metadata: Metadata = {
  title: "Leaflet Distribution Romsey",
  description:
    "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-romsey",
  },
  openGraph: {
    title: "Leaflet Distribution Romsey",
    description:
      "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-romsey",
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
    title: "Leaflet Distribution Romsey",
    description:
      "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.flyerdistributionhampshire.co.uk",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Areas",
      item: "https://www.flyerdistributionhampshire.co.uk/areas",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Romsey",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-romsey",
    },
  ],
};

export default function RomseyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <AreaPage area={AREA_PAGES["romsey"]} />
    </>
  );
}

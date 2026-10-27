import type { Metadata } from "next";
import AreaPage from "@/components/AreaPage";
import { AREA_PAGES } from "@/lib/area-pages";

export const metadata: Metadata = {
  title: "Flyer Distribution New Forest",
  description:
    "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-new-forest",
  },
  openGraph: {
    title: "Flyer Distribution New Forest",
    description:
      "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-new-forest",
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
    title: "Flyer Distribution New Forest",
    description:
      "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
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
      name: "New Forest",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-new-forest",
    },
  ],
};

export default function NewForestPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <AreaPage area={AREA_PAGES["new-forest"]} />
    </>
  );
}

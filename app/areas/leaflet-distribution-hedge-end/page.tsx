import type { Metadata } from "next";
import AreaPage from "@/components/AreaPage";
import { AREA_PAGES } from "@/lib/area-pages";

export const metadata: Metadata = {
  title: "Leaflet Distribution Hedge End",
  description:
    "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-hedge-end",
  },
  openGraph: {
    title: "Leaflet Distribution Hedge End",
    description:
      "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-hedge-end",
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
    title: "Leaflet Distribution Hedge End",
    description:
      "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
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
      name: "Hedge End",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/leaflet-distribution-hedge-end",
    },
  ],
};

export default function HedgeEndPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <AreaPage area={AREA_PAGES["hedge-end"]} />
    </>
  );
}

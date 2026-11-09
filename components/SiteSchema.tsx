"use client";

import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";
import { FDH_POSTAL_ADDRESS } from "@/lib/fdh-address";

// The website's own structured data, on every public page: the website and
// the business behind it, as one graph, so the website's publisher reference
// resolves wherever it appears. Left off the CRM and the private delivery
// pages, which must carry nothing of FDH when they are for a Bournemouth job.
const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.flyerdistributionhampshire.co.uk/#website",
      "name": "Flyer Distribution Hampshire",
      "url": "https://www.flyerdistributionhampshire.co.uk",
      "publisher": {
        "@id": "https://www.flyerdistributionhampshire.co.uk/#business",
      },
      "inLanguage": "en-GB",
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://www.flyerdistributionhampshire.co.uk/#business",
      "name": "Flyer Distribution Hampshire",
      "description":
        "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
      "url": "https://www.flyerdistributionhampshire.co.uk",
      "email": "flyerdistributionhampshire@gmail.com",
      "address": FDH_POSTAL_ADDRESS,
      "image": "https://www.flyerdistributionhampshire.co.uk/Flyer%20Distribution%20Logo%20White%20Cropped.webp",
      // The logo shown in the site header.
      "logo": "https://www.flyerdistributionhampshire.co.uk/website_logo_main.webp",
      "sameAs": [
        "https://share.google/RVxyPi4TzXAzkt1Am",
        "https://www.facebook.com/share/1EWf3WKLJZ/?mibextid=wwXIfr",
        "https://www.instagram.com/flyerdistributionhampshire/",
        "https://www.tiktok.com/@aw.flyers",
      ],
      "areaServed": [
        "Southampton",
        "Bournemouth",
        "Poole",
        "Winchester",
        "Eastleigh",
        "New Forest",
        "Romsey",
        "Ringwood",
        "Christchurch",
        "Dorset",
        "Hythe",
        "Totton",
        "Hedge End",
        "Chandler's Ford",
        "Brockenhurst",
      ],
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          "opens": "09:00",
          "closes": "18:00",
        },
      ],
    },
  ],
};

export default function SiteSchema() {
  const pathname = usePathname();
  if (hidesSiteChrome(pathname)) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }} />;
}

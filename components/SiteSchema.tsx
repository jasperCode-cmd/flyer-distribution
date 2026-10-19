"use client";

import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";

// The website's own structured data, on every public page. Left off the CRM
// and the private delivery pages, which must carry nothing of FDH when they
// are for a Bournemouth job.
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.flyerdistributionhampshire.co.uk/#website",
  "name": "Flyer Distribution Hampshire",
  "url": "https://www.flyerdistributionhampshire.co.uk",
  "publisher": {
    "@id": "https://www.flyerdistributionhampshire.co.uk/#business",
  },
  "inLanguage": "en-GB",
};

export default function SiteSchema() {
  const pathname = usePathname();
  if (hidesSiteChrome(pathname)) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />;
}

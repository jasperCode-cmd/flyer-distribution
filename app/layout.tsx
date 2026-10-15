import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import SlotPopup from "@/components/SlotPopup";
import FloatingQuoteButton from "@/components/FloatingQuoteButton";

// Both are variable fonts, so every weight comes from one file each,
// self-hosted at build time (no request to Google from the browser).
// Headings use Schibsted Grotesk, everything else Atkinson Hyperlegible
// Next; the CRM keeps Inter, loaded in its own layout.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

// Declared explicitly rather than relying on the framework default, so the
// zoom guarantee is visible in code: no maximumScale and no
// userScalable:false; pinch-to-zoom must always stay available as an
// accessibility fallback, whatever the responsive layout does.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
};

export const metadata: Metadata = {
  title: {
    default: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
    template: "%s | Flyer Distribution Hampshire",
  },
  description:
    "Professional flyer and leaflet distribution across Hampshire and Dorset. Covering Southampton, Bournemouth, Poole and Winchester.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Flyer Distribution Hampshire",
    description:
      "Professional flyer and leaflet distribution across Hampshire and Dorset.",
    url: "https://www.flyerdistributionhampshire.co.uk",
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
    title: "Flyer Distribution Hampshire",
    description:
      "Professional flyer and leaflet distribution across Hampshire and Dorset.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${schibsted.variable} ${atkinson.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased bg-slate-50 text-gray-800">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <AnnouncementBar />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <SlotPopup />
        <FloatingQuoteButton />
      </body>
    </html>
  );
}

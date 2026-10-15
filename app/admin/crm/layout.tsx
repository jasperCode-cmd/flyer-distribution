import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionProviderWrapper from "@/components/crm/SessionProviderWrapper";
import CrmShell from "@/components/crm/CrmShell";
import { CRM_NAV_INIT_SCRIPT } from "@/lib/crm-nav";

// Second layer of protection alongside robots.ts's existing
// "Disallow: /admin/", belt and braces in case robots.txt is ever
// changed or a crawler ignores it.
// The CRM keeps the font it has always had; the marketing site's fonts are
// set in the root layout.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Applies the saved desktop navigation position before first paint. */}
      <script dangerouslySetInnerHTML={{ __html: CRM_NAV_INIT_SCRIPT }} />
      {/* display: contents, so this wrapper adds no box and changes no layout. */}
      <div className={`${inter.variable} crm-font contents`}>
        <SessionProviderWrapper>
          <CrmShell>{children}</CrmShell>
        </SessionProviderWrapper>
      </div>
    </>
  );
}

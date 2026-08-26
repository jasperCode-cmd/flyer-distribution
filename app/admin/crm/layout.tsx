import type { Metadata } from "next";
import SessionProviderWrapper from "@/components/crm/SessionProviderWrapper";
import CrmShell from "@/components/crm/CrmShell";

// Second layer of protection alongside robots.ts's existing
// "Disallow: /admin/" — belt and braces in case robots.txt is ever
// changed or a crawler ignores it.
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
    <SessionProviderWrapper>
      <CrmShell>{children}</CrmShell>
    </SessionProviderWrapper>
  );
}

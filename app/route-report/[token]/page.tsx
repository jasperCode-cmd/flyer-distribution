import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveReportToken } from "@/lib/rounds/service";
import RouteReportView from "@/components/route-report/RouteReportView";
import "./route-report.css";

// A client's route report: public and read-only, with no login. The
// unguessable token in the address is checked instead; unknown, revoked and
// expired links all get the same plain "not found". It shows only the rounds
// the link covers, under the business's own name, and none of the website
// around it (an LDB client's page carries nothing of FDH). Never indexed.

export const dynamic = "force-dynamic";

const resolve = cache(async (token: string) => resolveReportToken(prisma, token));

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const view = await resolve(token);
  return {
    title: { absolute: view ? `Leaflet delivery report: ${view.brand.name}` : "Link not available" },
    description: "Leaflet delivery report",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: null,
    twitter: null,
    icons: { icon: view?.business === "FDH" ? "/favicon.png" : "/delivery-icon.svg" },
  };
}

export default async function RouteReportPage({ params }: Props) {
  const { token } = await params;
  const view = await resolve(token);
  if (!view) notFound();
  return <RouteReportView view={view} imageBase={`/route-report/${token}/screenshots`} />;
}

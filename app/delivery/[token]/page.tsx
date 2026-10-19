import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveShareToken } from "@/lib/area-planner/service";
import DeliveryView from "@/components/delivery/DeliveryView";
import "./delivery.css";

// A distributor's private, read-only link. There is no user session: the
// unguessable token in the address is checked instead. Unknown, revoked,
// expired and switched-off links all get the same plain "not found". The
// page is never indexed and carries none of the website around it; for a
// Bournemouth job it carries no business branding at all.

export const dynamic = "force-dynamic";

const resolve = cache(async (token: string) => resolveShareToken(prisma, token));

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const view = await resolve(token);
  const showBusiness = view?.business === "FDH";
  return {
    title: { absolute: view ? `${view.title}: your delivery areas` : "Link not available" },
    description: "Delivery areas",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: null,
    twitter: null,
    icons: { icon: showBusiness ? "/favicon.png" : "/delivery-icon.svg" },
  };
}

export default async function DeliveryPage({ params }: Props) {
  const { token } = await params;
  const view = await resolve(token);
  if (!view) notFound();
  return <DeliveryView view={view} showBusiness={view.business === "FDH"} />;
}

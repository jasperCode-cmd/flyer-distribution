import type { Metadata } from "next";
import RoundPage from "@/components/rounds/RoundPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Round" };

export default async function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoundPage id={id} />;
}

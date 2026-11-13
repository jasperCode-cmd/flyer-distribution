import type { Metadata } from "next";
import RoundsView from "@/components/rounds/RoundsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rounds" };

// The Rounds list. The page reads nothing itself: the list loads through
// the API once it has drawn, and again only when a filter changes.
export default function RoundsPage() {
  return <RoundsView />;
}

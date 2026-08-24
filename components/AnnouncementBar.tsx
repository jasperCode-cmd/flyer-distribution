"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <Link
      href="/quote"
      className="block bg-yellow-400 hover:bg-yellow-300 transition-colors duration-200 text-center px-4 py-2"
    >
      <p className="text-blue-900 text-xs sm:text-sm leading-snug">
        <span className="font-bold">End of Summer Deal:</span> New customers
        get 10% off their first campaign
      </p>
    </Link>
  );
}

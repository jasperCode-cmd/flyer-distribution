"use client";

import { useEffect, useState } from "react";

// Pops the real current figure in with a bounce once mounted — an honest
// reveal of the actual number, not a countdown ticking down from anything.
export default function SlotCountReveal({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span
      className={`inline-block transition-[transform,opacity] duration-500 ${
        shown ? "opacity-100 scale-100" : "opacity-0 scale-50"
      } ${className}`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      {value}
    </span>
  );
}

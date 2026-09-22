"use client";

import { useEffect, useRef, useState } from "react";

// Shared scroll-in stagger used across several card grids on this page —
// same fade-up-on-enter mechanism as TrustCards on the homepage, just
// generalised so it isn't copy-pasted per grid. itemClassName carries each
// item's own layout (e.g. width, for a flex-wrap grid that needs its last
// row centered rather than left-aligned when the count doesn't divide evenly).
export default function StaggerGroup({
  children,
  className = "",
  itemClassName = "",
  staggerMs = 100,
}: {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <div
          key={i}
          className={`transition-[opacity,transform] duration-500 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          } ${itemClassName}`}
          style={{ transitionDelay: `${i * staggerMs}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { isNavItemActive, type CrmNavGroup, type CrmNavItem } from "@/lib/crm-nav";

// One top bar dropdown (Jobs, Team, Tools). Opens on click, closes on
// Escape or an outside click, and works with the keyboard: Enter, Space or
// Down Arrow on the button opens it on the first link, the arrow keys, Home
// and End move between links, Escape returns to the button, and Tab moves
// on and closes it. The button is highlighted while one of its pages is
// open, and carries any count shown inside (Applications, under Team).
export default function NavMenu({
  group,
  pathname,
  open,
  onOpenChange,
  renderCount,
  footer,
}: {
  group: CrmNavGroup;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderCount: (item: CrmNavItem) => React.ReactNode;
  footer?: (close: () => void) => React.ReactNode;
}) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusFirstRef = useRef(false);
  const active = group.items.some((item) => isNavItemActive(pathname, item.href));

  function items(): HTMLElement[] {
    return [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  }

  useEffect(() => {
    if (!open) return;
    if (focusFirstRef.current) {
      focusFirstRef.current = false;
      items()[0]?.focus();
    }
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onOpenChange(false);
    }
    function onDocKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const inside = containerRef.current?.contains(document.activeElement);
      onOpenChange(false);
      if (inside) buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKey);
    };
  }, [open, onOpenChange]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % list.length;
    else if (e.key === "ArrowUp") next = (index - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else if (e.key === "Tab") onOpenChange(false);
    if (next !== null) {
      e.preventDefault();
      list[next]?.focus();
    }
  }

  const close = () => onOpenChange(false);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        id={`${id}-button`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={(e) => {
          // A click from the keyboard (Enter or Space) has no pointer detail:
          // open with the first link focused, as a menu button should.
          if (!open && e.detail === 0) focusFirstRef.current = true;
          onOpenChange(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            focusFirstRef.current = true;
            onOpenChange(true);
          }
        }}
        className={`inline-flex items-center gap-1 px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
          active || open ? "bg-blue-800 text-yellow-400" : "text-blue-100 hover:bg-blue-800/60"
        }`}
      >
        {group.label}
        {group.items.map((item) => (item.count ? <span key={item.href}>{renderCount(item)}</span> : null))}
        <svg
          aria-hidden="true"
          className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-button`}
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 mt-1 w-48 bg-white rounded-md border border-gray-200 shadow-lg py-1 z-50"
        >
          {group.items.map((item) => {
            const current = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={current ? "page" : undefined}
                onClick={close}
                className={`flex items-center px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:bg-gray-100 ${
                  current ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
                {item.count && renderCount(item)}
              </Link>
            );
          })}
          {footer && <div className="mt-1 border-t border-gray-100 pt-1">{footer(close)}</div>}
        </div>
      )}
    </div>
  );
}

// Where the CRM navigation sits on desktop (1024px and wider). Remembered per
// device in localStorage; below 1024px the CRM always uses its usual top and
// mobile navigation, whatever is stored here.
export type CrmNavPosition = "top" | "side";

export const CRM_NAV_STORAGE_KEY = "fdh-crm-nav-position";
export const CRM_NAV_ATTRIBUTE = "data-crm-nav";

export function readStoredNavPosition(): CrmNavPosition {
  try {
    return window.localStorage.getItem(CRM_NAV_STORAGE_KEY) === "side" ? "side" : "top";
  } catch {
    return "top";
  }
}

export function storeNavPosition(position: CrmNavPosition) {
  try {
    window.localStorage.setItem(CRM_NAV_STORAGE_KEY, position);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
}

// Runs inline in the CRM layout before the shell is parsed, so a saved
// "side" choice is on <html> before first paint and CSS lays the page out
// correctly with no flash. Defaults to top if storage is empty or blocked.
export const CRM_NAV_INIT_SCRIPT = `(function(){var p="top";try{if(localStorage.getItem(${JSON.stringify(
  CRM_NAV_STORAGE_KEY
)})==="side")p="side"}catch(e){}document.documentElement.setAttribute(${JSON.stringify(CRM_NAV_ATTRIBUTE)},p)})();`;

// --- What the navigation lists ----------------------------------------------

// Defined once here and read by the top bar, the side navigation and the
// phone menu. Groups with topBar "links" sit in the top bar as plain links
// (Dashboard, Leads, Inbox, Dialer); "menu" groups become a dropdown there.
// The side navigation and phone menu list every group under its heading.
// count marks the links that carry a live number beside them.
export type CrmNavCount = "inbox" | "applications" | "priorities";
export type CrmNavItem = { href: string; label: string; count?: CrmNavCount };
export type CrmNavGroup = {
  id: "dashboard" | "sales" | "jobs" | "team" | "tools";
  // Null for Dashboard and Priorities, which stand on their own without a
  // heading.
  label: string | null;
  topBar: "links" | "menu";
  items: CrmNavItem[];
};

export const CRM_NAV_GROUPS: CrmNavGroup[] = [
  {
    id: "dashboard",
    label: null,
    topBar: "links",
    items: [
      { href: "/admin/crm", label: "Dashboard" },
      { href: "/admin/crm/priorities", label: "Priorities", count: "priorities" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    topBar: "links",
    items: [
      { href: "/admin/crm/leads", label: "Leads" },
      { href: "/admin/crm/inbox", label: "Inbox", count: "inbox" },
      { href: "/admin/crm/dialer", label: "Dialer" },
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    topBar: "menu",
    items: [
      { href: "/admin/crm/calendar", label: "Calendar" },
      { href: "/admin/crm/profit", label: "Profit" },
      { href: "/admin/crm/documents", label: "Documents" },
      { href: "/admin/crm/jobs-by-area", label: "Jobs by Area" },
      { href: "/admin/crm/map", label: "Area Planner" },
    ],
  },
  {
    id: "team",
    label: "Team",
    topBar: "menu",
    items: [
      { href: "/admin/crm/distributors", label: "Distributors" },
      { href: "/admin/crm/applications", label: "Applications", count: "applications" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    topBar: "menu",
    items: [
      { href: "/admin/crm/tags", label: "Tags" },
      { href: "/admin/crm/import", label: "Import" },
      { href: "/admin/crm/scrapped-leads", label: "Scrapped Leads" },
    ],
  },
];

// "Add Lead" is deliberately not listed: /admin/crm/leads/new is reached from
// the Leads page, and Leads stays highlighted there because this is a prefix
// check.
export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/admin/crm" ? pathname === "/admin/crm" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavGroupActive(pathname: string, group: CrmNavGroup): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item.href));
}

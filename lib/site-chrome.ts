// Pages that show none of the public website around them: the CRM, the
// private delivery pages a distributor opens from a link, and a client's
// route report, which must carry nothing of FDH when they are for a
// Bournemouth job. The header, footer,
// announcement bar, popups, quote button and the site's structured data all
// check this.
export function hidesSiteChrome(pathname: string | null): boolean {
  const path = pathname ?? "";
  return (
    path.startsWith("/admin/crm") ||
    path === "/delivery" ||
    path.startsWith("/delivery/") ||
    path === "/route-report" ||
    path.startsWith("/route-report/")
  );
}

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

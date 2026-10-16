// Two enquiries exactly as the Leaflet Distribution Bournemouth website sends
// them, shared by the intake unit and database tests. Made-up people.

export const SARAH_PAYLOAD = `{"firstName":"Sarah","lastName":"Mitchell","email":"sarah@example.com","phone":"07700900123","company":"Mitchell Interiors","service":"leaflet-distribution","budget":"500-1000","areas":["Bournemouth","Poole","Westbourne"],"quantity":"5000","startDate":"2026-11-01","includePrinting":true,"includeDesign":false,"message":"Looking to target residential areas only."}`;

export const JAMES_PAYLOAD = `{"firstName":"James","email":"james@example.com","phone":"01202555000","service":"public-notice-leafleting","budget":"1000-2000","projectLocation":"Lansdowne Road, Bournemouth","deadline":"2026-12-15","scale":"2000 households","message":"Planning consultation for proposed development."}`;

// What each should save: the lead's fields, and its note line by line.
export const SARAH_LEAD = {
  name: "Sarah Mitchell",
  email: "sarah@example.com",
  phone: "07700900123",
  businessName: "Mitchell Interiors",
  postcode: null,
  targetAreas: "Bournemouth, Poole, Westbourne",
  leafletQuantity: "5000",
  printingIncluded: true,
  designIncluded: false,
  business: "LDB",
  source: "WEBSITE_QUOTE_FORM",
  stage: "UNCONTACTED",
};

export const SARAH_NOTE = [
  "Service type: leaflet-distribution",
  "From the Leaflet Distribution Bournemouth website",
  "Budget range: 500-1000",
  "Requested start date: 2026-11-01",
  "Message: Looking to target residential areas only.",
].join("\n");

export const JAMES_LEAD = {
  name: "James",
  email: "james@example.com",
  phone: "01202555000",
  businessName: null,
  postcode: null,
  targetAreas: "Lansdowne Road, Bournemouth",
  leafletQuantity: null,
  printingIncluded: false,
  designIncluded: false,
  business: "LDB",
  source: "WEBSITE_QUOTE_FORM",
  stage: "UNCONTACTED",
};

export const JAMES_NOTE = [
  "Service type: public-notice-leafleting",
  "From the Leaflet Distribution Bournemouth website",
  "Budget range: 1000-2000",
  "Deadline: 2026-12-15",
  "Project location: Lansdowne Road, Bournemouth",
  "Scale: 2000 households",
  "Message: Planning consultation for proposed development.",
].join("\n");

// Prints the homepage's Leaflet Services section as the server renders it,
// with the lists it is built from, as JSON. Run on its own by
// leaflet-services.test.ts, outside the test runner's react-server
// condition, so its links and client parts render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LeafletServices, { CORE_SERVICES, MORE_SERVICES, PACKAGES } from "@/components/LeafletServices";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(LeafletServices)), PACKAGES, CORE_SERVICES, MORE_SERVICES }));

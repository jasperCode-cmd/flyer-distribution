// Prints the Leaflet Delivery page as the server renders it, with its
// metadata, as JSON. Run on its own by leaflet-delivery.test.ts, outside the
// test runner's react-server condition, so its links render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LeafletDeliveryPage, { metadata } from "@/app/leaflet-delivery/page";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(LeafletDeliveryPage)), metadata }));

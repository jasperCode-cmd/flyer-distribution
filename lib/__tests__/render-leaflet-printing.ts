// Prints the Leaflet Printing page as the server renders it, with its
// metadata, as JSON. Run on its own by leaflet-printing.test.ts, outside the
// test runner's react-server condition, so its links render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LeafletPrintingPage, { metadata } from "@/app/leaflet-printing/page";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(LeafletPrintingPage)), metadata }));

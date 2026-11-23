// Prints the Case Studies page as the server renders it, with its metadata,
// as JSON. Run on its own by case-studies.test.ts, outside the test runner's
// react-server condition, so its links render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CaseStudiesPage, { metadata } from "@/app/case-studies/page";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(CaseStudiesPage)), metadata }));

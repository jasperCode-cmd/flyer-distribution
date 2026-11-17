// Prints the About page as the server renders it, with its metadata, as
// JSON. Run on its own by about-page.test.ts, outside the test runner's
// react-server condition, so its links and image render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage, { metadata } from "@/app/about/page";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(AboutPage)), metadata }));

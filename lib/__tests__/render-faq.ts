// Prints the FAQ page as the server renders it, as JSON. Run on its own by
// faq-page.test.ts, outside the test runner's react-server condition, so its
// links render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FaqPage from "@/app/faq/page";

process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(createElement(FaqPage)) }));

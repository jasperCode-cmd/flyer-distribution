// Prints the quote form as it first renders (before any card is chosen).
// Run on its own by quote-form.test.ts, outside the test runner's
// react-server condition, so the client component renders as in a browser.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuoteForm from "@/components/QuoteForm";

process.stdout.write(renderToStaticMarkup(createElement(QuoteForm)));

// Prints the rating snapshot as the server renders it. Run on its own by
// review-band.test.ts, outside the test runner's react-server condition.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewBand from "@/components/ReviewBand";

process.stdout.write(renderToStaticMarkup(createElement(ReviewBand)));

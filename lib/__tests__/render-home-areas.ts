// Prints the homepage's Areas We Cover section as the server renders it. Run
// on its own by home-areas.test.ts, outside the test runner's react-server
// condition, so its links and the search form render as on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomeAreas from "@/components/HomeAreas";

process.stdout.write(renderToStaticMarkup(createElement(HomeAreas)));

// Prints the /areas page as the server first sends it ("page"), or its
// results for a search that finds nothing ("empty"). Run on its own by
// areas-overview.test.ts, outside the test runner's react-server condition,
// so the client component renders as it does on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AreasPage from "@/app/areas/page";
import { AreaResults } from "@/components/AreasExplorer";
import { overviewCards } from "@/lib/areas-overview";

const tree =
  process.argv[2] === "empty"
    ? createElement(AreaResults, { cards: overviewCards(), state: { query: "SO31", region: "all" }, onRegion: () => {} })
    : createElement(AreasPage);
process.stdout.write(renderToStaticMarkup(tree));

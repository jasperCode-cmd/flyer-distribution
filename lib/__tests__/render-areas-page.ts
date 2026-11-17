// Prints the /areas page as the server first sends it ("page"), its results
// for a search that finds nothing ("empty"), or for a search given after
// "search" (as they show once typed). Run on its own by
// areas-overview.test.ts, outside the test runner's react-server condition,
// so the client component renders as it does on the server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AreasPage from "@/app/areas/page";
import { AreaResults } from "@/components/AreasExplorer";
import { overviewCards } from "@/lib/areas-overview";

const results = (query: string) => createElement(AreaResults, { cards: overviewCards(), state: { query, region: "all" }, onRegion: () => {} });
const tree = process.argv[2] === "empty" ? results("SO31") : process.argv[2] === "search" ? results(process.argv[3] ?? "") : createElement(AreasPage);
process.stdout.write(renderToStaticMarkup(tree));

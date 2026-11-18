// Prints the all services page (/services) as the server renders it, with its
// metadata, as JSON. Run on its own by services-page.test.ts, outside the test
// runner's react-server condition, so its links render as on the server. Its
// Web Design row's photo comes from images.unsplash.com, so next/image is given
// the app's own image settings (next.config.ts), as Next gives them when it runs.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import nextConfig from "@/next.config";
import ServicesPage, { metadata } from "@/app/services/page";

const images = { ...imageConfigDefault, ...nextConfig.images };
const page = createElement(ImageConfigContext.Provider, { value: images }, createElement(ServicesPage));
process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(page), metadata }));

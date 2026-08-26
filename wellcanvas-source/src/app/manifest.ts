import type { MetadataRoute } from "next";
import { WELL_CANVAS_BASE_PATH, withBasePath } from "@/lib/deployment";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WellCanvas",
    short_name: "WellCanvas",
    description:
      "Your health tracker, stored locally and shaped by you.",
    start_url: `${WELL_CANVAS_BASE_PATH || ""}/`,
    scope: `${WELL_CANVAS_BASE_PATH || ""}/`,
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      {
        src: withBasePath("/icons/wellcanvas-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/icons/wellcanvas-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

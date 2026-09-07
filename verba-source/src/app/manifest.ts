import type { MetadataRoute } from "next";
import { VERBA_BASE_PATH, withBasePath } from "@/lib/deployment";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const scope = `${VERBA_BASE_PATH || ""}/`;

  return {
    name: "Vérba",
    short_name: "Vérba",
    description: "Fast vocabulary, text, and grammar form practice.",
    start_url: scope,
    scope,
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#25635a",
    icons: [
      {
        src: withBasePath("/icons/verba-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/icons/verba-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/icons/verba.svg"),
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: withBasePath("/icons/verba.svg"),
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

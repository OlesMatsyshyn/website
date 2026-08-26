import type { Metadata } from "next";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { WELL_CANVAS_BASE_PATH, withBasePath } from "@/lib/deployment";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellCanvas",
  description:
    "WellCanvas is a registration-free, local-first tracker for food, hydration, activity and weight that can be customised into your own personal application.",
  icons: {
    apple: withBasePath("/icons/wellcanvas-180.png"),
    icon: [
      {
        url: withBasePath("/icons/wellcanvas-favicon-tight-16.png"),
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: withBasePath("/icons/wellcanvas-favicon-tight-32.png"),
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: withBasePath("/icons/wellcanvas-favicon-tight-48.png"),
        sizes: "48x48",
        type: "image/png",
      },
    ],
  },
  manifest: withBasePath("/manifest.webmanifest"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
try {
  var basePath = ${JSON.stringify(WELL_CANVAS_BASE_PATH)};
  var stored = JSON.parse(localStorage.getItem("health-tracker-pwa.appearance.v1") || "null") || {};
  var themes = {
    neutral:["#292524","#1c1917","#f5f5f4","#ffffff","#78716c"],
    graphite:["#334155","#1e293b","#f1f5f9","#ffffff","#64748b"],
    ocean:["#0f766e","#115e59","#ccfbf1","#ffffff","#14b8a6"],
    forest:["#166534","#14532d","#dcfce7","#ffffff","#22c55e"],
    amber:["#92400e","#78350f","#fef3c7","#ffffff","#f59e0b"],
    berry:["#9f1239","#881337","#ffe4e6","#ffffff","#fb7185"]
  };
  var backgrounds = {
    "nature-01":basePath + "/backgrounds/nature-01.png",
    "nature-02":basePath + "/backgrounds/nature-02.png",
    "nature-03":basePath + "/backgrounds/nature-03.png",
    "nature-04":basePath + "/backgrounds/nature-04.png",
    "nature-05":basePath + "/backgrounds/nature-05.png",
    "nature-06":basePath + "/backgrounds/nature-06.png",
    "nature-07":basePath + "/backgrounds/nature-07.png",
    "nature-08":basePath + "/backgrounds/nature-08.png",
    "nature-09":basePath + "/backgrounds/nature-09.png",
    "nature-10":basePath + "/backgrounds/nature-10.png",
    "nature-11":basePath + "/backgrounds/nature-11.png"
  };
  var ids = Object.keys(backgrounds);
  var legacy = stored.background && stored.background.indexOf("background-") === 0;
  var selected = backgrounds[stored.selectedBackgroundId] ? stored.selectedBackgroundId : backgrounds[stored.background] ? stored.background : legacy ? "nature-01" : "nature-01";
  var enabled = Array.isArray(stored.enabledBackgroundIds) ? stored.enabledBackgroundIds.filter(function(id){ return backgrounds[id]; }) : ids;
  if (!enabled.length) enabled = ["nature-01"];
  var selectedIndex = enabled.indexOf(selected);
  if (selectedIndex > 0) enabled = enabled.slice(selectedIndex).concat(enabled.slice(0, selectedIndex));
  var active = stored.background === "none" && stored.backgroundMode !== "automatic" ? null : selected;
  if (stored.backgroundMode === "automatic" && enabled.length > 1 && stored.rotationStartTimestamp) {
    var start = Date.parse(stored.rotationStartTimestamp);
    var interval = [1,3,6,12,24].indexOf(Number(stored.rotationIntervalHours)) >= 0 ? Number(stored.rotationIntervalHours) : 6;
    if (Number.isFinite(start)) {
      var elapsed = Math.max(Date.now() - start, 0);
      active = enabled[Math.floor(elapsed / (interval * 60 * 60 * 1000)) % enabled.length] || selected;
    }
  } else if (stored.backgroundMode === "automatic") {
    active = enabled.indexOf(selected) >= 0 ? selected : enabled[0];
  }
  var theme = themes[stored.accentTheme] || themes.neutral;
  var root = document.documentElement;
  root.style.setProperty("--accent", theme[0]);
  root.style.setProperty("--accent-hover", theme[1]);
  root.style.setProperty("--accent-soft", theme[2]);
  root.style.setProperty("--accent-contrast", theme[3]);
  root.style.setProperty("--focus-ring", theme[4]);
  root.style.setProperty("--app-background-image", active && backgrounds[active] ? "url('" + backgrounds[active] + "')" : "none");
  root.style.setProperty("--background-dim-opacity", String(Math.min(Math.max(Number(stored.backgroundDimPercent || 40), 0), 80) / 100));
  root.dataset.panel = stored.panelTransparency || "solid";
} catch {}
`;

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          id="wellcanvas-theme-init"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full bg-stone-50 text-stone-950">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

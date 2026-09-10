import type { Metadata, Viewport } from "next";
import { withBasePath } from "@/lib/deployment";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vérba",
  description: "Fast vocabulary, text, and grammar form practice.",
  alternates: {
    canonical: "https://olesmatsyshyn.github.io/website/verba.html",
  },
  manifest: withBasePath("/manifest.webmanifest"),
  icons: {
    icon: withBasePath("/icons/verba.svg"),
    apple: withBasePath("/icons/verba-192.png"),
  },
};

export const viewport: Viewport = {
  themeColor: "#25635a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

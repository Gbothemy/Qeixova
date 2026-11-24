import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const DEFAULT_METADATA_BASE = new URL("https://www.qeixova.com");

function getMetadataBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!configured) return DEFAULT_METADATA_BASE;

  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configured);
  const candidate = /^https?:\/\//i.test(configured)
    ? configured
    : `${process.env.NODE_ENV === "development" && isLocalHost ? "http" : "https"}://${configured}`;

  try {
    const url = new URL(candidate);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname && !url.username && !url.password) {
      return new URL(url.origin);
    }
  } catch {
    // A malformed optional URL must not prevent the app layout from rendering.
  }

  return DEFAULT_METADATA_BASE;
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Qeixova — Community-Powered Digital Growth",
  description: "Launch campaigns with verified growth partners, grow real visibility, and earn through meaningful digital participation.",
  icons: {
    icon: [{ url: "/qeixova-icon.png?v=2", type: "image/png" }],
    shortcut: "/qeixova-icon.png?v=2",
    apple: "/qeixova-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    try {
      const STORAGE_KEY = 'qeixova:theme';
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const theme = saved === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    }
  `;

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/qeixova-icon.png?v=2" type="image/png" />
        <link rel="shortcut icon" href="/qeixova-icon.png?v=2" type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#1AEF22" />
      </head>
      <body>
        <Script id="qeixova-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

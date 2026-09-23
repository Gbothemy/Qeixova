import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
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
      window.localStorage.setItem(STORAGE_KEY, 'dark');
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
    } catch (e) {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
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

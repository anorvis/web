import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import Script from "next/script";
import { AppDataPreloader } from "@/components/providers/app-data-preloader";
import { AppQueryEvents } from "@/components/providers/app-query-events";
import { WebAppProviders } from "@/components/providers/web-app-providers";
import "@fontsource/cossette-titre";
import "./globals.css";
import { Toaster } from "@anorvis/ui/sonner";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const enableReactScan =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_REACT_SCAN === "1";

export const metadata: Metadata = {
  title: "anorvis",
  description: "a network of rather very intelligent systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={instrumentSerif.variable}
      suppressHydrationWarning
    >
      <head>
        {enableReactScan && (
          <>
            <Script
              src="//unpkg.com/react-scan/dist/auto.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="//unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        )}
      </head>
      <body>
        <WebAppProviders>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
          >
            Skip to main content
          </a>
          <AppDataPreloader />
          <AppQueryEvents />
          {children}
          <Toaster />
        </WebAppProviders>
      </body>
    </html>
  );
}

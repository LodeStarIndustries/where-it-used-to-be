import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Where It Used To Be",
  description: "A free daily map game about the Saint John businesses that are gone.",
};

export const viewport: Viewport = {
  themeColor: "#EEF2F4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Vercel Web Analytics and Speed Insights: anonymous page views and load times, no cookies.
            They only report on Vercel deployments. */}
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </body>
    </html>
  );
}

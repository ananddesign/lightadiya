import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

// Safira March by Din Studio: personal / non-commercial licence.
// Subset to Latin and converted to woff2 (~26 KB).
const safira = localFont({
  src: "./fonts/safira-march.woff2",
  display: "swap",
  variable: "--font-safira",
  fallback: ["Cormorant Garamond", "Georgia", "serif"],
});

const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Light a Diya, Spread the Light 🪔",
  description: "Light a diya, watch it light a thousand more, and pass the light on this Diwali.",
  openGraph: { type: "website", siteName: "Light a Diya" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Light a Diya" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07152E",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${safira.variable}`}>
      <body>{children}</body>
    </html>
  );
}

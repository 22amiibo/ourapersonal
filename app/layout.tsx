import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import TabBar from "./components/TabBar";
import CircadianBackground from "./components/CircadianBackground";
import StatusBar from "./components/StatusBar";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Briefing",
  description: "Your personal intelligence briefing.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Briefing" },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-ink antialiased">
        <svg style={{ display: "none" }}>
          <defs>
            <filter id="noise-filter">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} stitchTiles="stitch" />
              <feComposite operator="in" in2="SourceGraphic" />
            </filter>
          </defs>
        </svg>
        <CircadianBackground />
        <StatusBar />
        {children}
        <TabBar />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

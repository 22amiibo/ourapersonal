import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import TabBar from "./components/TabBar";
import NavShell from "./components/NavShell";
import CommandPalette from "./components/CommandPalette";
import CircadianBackground from "./components/CircadianBackground";
import StatusBar from "./components/StatusBar";
import RevealGate from "./components/RevealGate";
import "./globals.css";

// Set data-revealed before first paint on any reload/return within a session,
// so already-seen pages don't flash their entrance animations. The first load
// of a session leaves it unset (RevealGate sets it after entrances finish).
const REVEAL_BOOT = `try{if(sessionStorage.getItem('revealed'))document.documentElement.setAttribute('data-revealed','1')}catch(e){}`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      </head>
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
        <NavShell>
          <StatusBar />
          <RevealGate />
          {children}
          <TabBar />
          <CommandPalette />
          <ServiceWorkerRegistration />
        </NavShell>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import TabBar from "./components/TabBar";
import CircadianBackground from "./components/CircadianBackground";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
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
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Briefing" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <CircadianBackground />
        {children}
        <TabBar />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

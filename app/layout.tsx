import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import InstallPrompt from "@/components/InstallPrompt";
import PushBanner from "@/components/PushBanner";
import { I18nProvider } from "@/lib/i18n";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JomCOD — Community Runner Network",
  description:
    "Find a community runner nearby for groceries, parcel pickups, and errands.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1C2321",
};

// Preconnect to Supabase so API calls don't wait on the DNS/TLS handshake.
const SUPABASE_ORIGIN = "https://vjanzunjalhrghikqzsy.supabase.co";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="font-body min-h-screen flex justify-center">
        <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
        <I18nProvider>
          <div className="w-full max-w-7xl px-5 md:px-8 py-4 pb-16">
            <TopNav />
            <main>{children}</main>
          </div>
          <InstallPrompt />
          <PushBanner />
        </I18nProvider>
      </body>
    </html>
  );
}

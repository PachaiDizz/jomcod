import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import InstallPrompt from "@/components/InstallPrompt";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="font-body min-h-screen flex justify-center">
        <div className="w-full max-w-7xl px-5 md:px-8 py-4 pb-16">
          <TopNav />
          <main>{children}</main>
        </div>
        <InstallPrompt />
      </body>
    </html>
  );
}

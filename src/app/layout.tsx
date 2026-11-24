import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import AppShell from "../components/shell/AppShell";
import "./globals.css";

// One family for everything. Plex Sans is clear on a laptop and at phone width.
const plex = IBM_Plex_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Postline",
  description: "Your personal content studio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} h-full`}>
      <body className="min-h-full">
        {/* AppShell reads the current path, which needs a Suspense boundary for static pages. */}
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}

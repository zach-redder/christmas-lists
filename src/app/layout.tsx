import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Lora } from "next/font/google";
import { Snowfall } from "@/components/Snowfall";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "WONK"] });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Redder Christmas 2026",
  description: "The Redder family Christmas lists.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#9e1b32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${lora.variable} ${caveat.variable}`}>
      <body className="antialiased">
        <Snowfall />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}

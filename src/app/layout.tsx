import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The editorial display serif used for event names on the participant-facing
// invitation/gallery pages — everything else stays on the sans-serif.
const editorialSerif = Playfair_Display({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
});

export const metadata: Metadata = {
  title: "Paris Photo Club",
  description: "An invitation only society. Scan the code from your outing to enter the gallery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${editorialSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

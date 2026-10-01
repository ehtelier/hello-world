import type { Metadata } from "next";
import { Geist, Geist_Mono, Bodoni_Moda } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The editorial display serif used for event names (and, in italic, the
// confident one-line closing statements) on the participant-facing
// invitation/gallery pages — everything else stays on the sans-serif.
const editorialSerif = Bodoni_Moda({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
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

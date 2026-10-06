import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The sans used across the participant-facing pages -- brand mark, labels,
// dates, body copy, and (at a much larger size, for hierarchy via scale
// rather than a contrasting typeface) event titles.
const functionalSans = Montserrat({
  variable: "--font-functional-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Paris Photo Club",
  description: "An invitation only society. Scan the code from your outing to enter the gallery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${functionalSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

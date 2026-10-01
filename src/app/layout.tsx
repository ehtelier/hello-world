import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel, Montserrat } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The engraved display serif used only for the event name on the
// participant-facing invitation/gallery pages.
const editorialSerif = Cinzel({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// The functional sans used for everything else on those same pages — brand
// mark, labels, dates, and body copy.
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${editorialSerif.variable} ${functionalSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

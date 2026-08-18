import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { IntroOverlay } from "@/components/intro-overlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sigla",
  description:
    "The coaching platform where clients are not judged and coaches do not have to find clients alone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <IntroOverlay />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Langopia — The modern platform for language academies",
  description:
    "Stream live classes, record sessions, get AI-powered transcriptions and progress reports. The complete toolkit for modern language education.",
  openGraph: {
    title: "Langopia — The modern platform for language academies",
    description:
      "Stream live classes, record sessions, get AI-powered transcriptions and progress reports.",
    siteName: "Langopia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Langopia — The modern platform for language academies",
    description:
      "Stream live classes, record sessions, get AI-powered transcriptions and progress reports.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

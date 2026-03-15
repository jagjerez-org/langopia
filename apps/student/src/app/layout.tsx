import type { Metadata, Viewport } from "next";
import { Nunito, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AcademyProvider } from "@/lib/academy-context";
import { AuthProvider } from "@/lib/auth-context";

const nunito = Nunito({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Langopia — Learn Languages",
  description: "Your personalized language learning experience",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${sourceSans.variable} antialiased`}
      >
        <AcademyProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </AcademyProvider>
      </body>
    </html>
  );
}

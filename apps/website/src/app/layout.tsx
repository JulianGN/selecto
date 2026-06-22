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
  title: "Selecto Onboarding | Open Source User Onboarding Platform",
  description: "Create, run, and analyze interactive product tours and guides with a lightweight, developer-friendly open source platform.",
  keywords: ["onboarding", "product tour", "user onboarding", "chrome extension", "developer tools"],
  openGraph: {
    title: "Selecto Onboarding | Open Source User Onboarding Platform",
    description: "Create, run, and analyze interactive product tours and guides with a lightweight, developer-friendly open source platform.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

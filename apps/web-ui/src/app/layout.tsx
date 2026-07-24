import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClipPilot | Shorts Factory Studio",
  description: "Dashboard for AI Short Video Generation & YouTube Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased min-h-screen bg-slate-950 text-slate-100 overflow-y-auto`}>
        {children}
      </body>
    </html>
  );
}

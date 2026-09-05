import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "BTC Weekend — ORB BTCUSD",
  description: "ORB M5 su BTCUSD nel weekend. Nessun ICT, nessuna AI.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BTC Weekend",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-base text-text font-sans antialiased">{children}</body>
    </html>
  );
}

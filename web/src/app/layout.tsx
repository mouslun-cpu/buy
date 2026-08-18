import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuyBuyBuy｜政府標案工作台",
  description: "政府標案推播、追蹤與投標決策工作台。",
  applicationName: "BuyBuyBuy",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon.svg", apple: "/app-icon-192.png" },
  appleWebApp: { capable: true, title: "BuyBuyBuy", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

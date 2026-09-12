import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foundry Frontier",
  description: "청크를 개척하고 자동화 생산 라인을 구축하는 웹 공장 타이쿤 게임",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

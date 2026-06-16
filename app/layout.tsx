import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { MetaPixel } from "@/components/MetaPixel";

const BASE_URL = "https://naejimayo.com";

export const metadata: Metadata = {
  title: "1분 셀프 대여약정서 | 내지마요",
  description:
    "가족 간 금전 거래, 자금조달계획서까지 한번에! 대여약정서 작성 + 전자서명 + 내용증명 발송. 단 30,000원.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "내지마요",
    title: "1분 셀프 대여약정서 | 내지마요",
    description:
      "가족 간 금전 거래, 자금조달계획서까지 한번에! 대여약정서 + 전자서명 + 내용증명. 단 30,000원.",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "내지마요 — 가족간 금전거래 자금조달계획서 한번에",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "1분 셀프 대여약정서 | 내지마요",
    description: "가족 간 금전 거래, 자금조달계획서까지 한번에!",
    images: ["/og-image.jpg"],
  },
  keywords: [
    "대여약정서", "차용증", "가족간 금전거래", "자금조달계획서",
    "증여세 절세", "전자서명", "내용증명", "내지마요",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased text-slate-900 bg-slate-50">
        <MetaPixel />
        <SiteHeader />
        <div className="pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}

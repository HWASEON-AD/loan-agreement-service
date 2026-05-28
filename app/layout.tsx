import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

// 사이트 전역 메타데이터
export const metadata: Metadata = {
  title: "1분 셀프 대여약정서 | 내지마요",
  description:
    "가족 간 금전 거래를 위한 대여약정서 작성, 전자서명, 우체국 내용증명 발송 서비스. 단 30,000원.",
};

// 루트 레이아웃
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased text-slate-900 bg-slate-50">
        <SiteHeader />
        <div className="pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}

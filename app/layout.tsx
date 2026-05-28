import type { Metadata } from "next";
import "./globals.css";

// 사이트 전역 메타데이터
export const metadata: Metadata = {
  title: "/ 내지마요 | 대여약정서 + 전자서명 + 내용증명",
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
        {children}
        <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white mt-auto">
          대표자 : 민기태 &nbsp;|&nbsp; gt.min@hwaseon.com &nbsp;|&nbsp; 010-3097-7823
        </footer>
      </body>
    </html>
  );
}

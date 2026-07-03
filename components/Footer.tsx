// 공통 Footer — 면책 문구 포함
import React from "react";
import Link from "next/link";
import { SERVICE_NAME } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto max-w-5xl px-6 text-sm text-slate-500">
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-brand-700">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-brand-700">
            개인정보처리방침
          </Link>
        </div>
        <p className="mt-4 leading-relaxed">
          내지마요는 가족 간 금전거래의 증거 보관 접근성을 높이고 누구나 부담
          없이 신뢰할 수 있는 세무 서비스를 받을 수 있도록 운영되고 있습니다.
          내지마요는 이용자가 세무 전문가인 세무사의 도움을 받을 수 있도록 제휴
          세무사의 상담 채널을 연결해드릴 뿐이며, 세무 상담·신고·세무조사 대리
          등 세무사 고유 업무에 대해 세무사법 관련 규정이 금지하는 이익이나
          금품을 받고 있지 않으며, 제휴 세무사로부터 보수를 받거나 이익을
          분배받지 않습니다. 내지마요는 세무 서비스의 결과에 대해 어떠한 보장도
          하지 않으며 책임을 지지 않습니다. 모든 세무 상담 및 업무는 각 세무사가
          소속 사무소에서 독립적으로 수행합니다.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          © {new Date().getFullYear()} {SERVICE_NAME}. All rights reserved. (HWASEONAD)
        </p>
        <p className="mt-1 text-xs text-slate-400">
          대표자 : gt.min@hwaseon.com &nbsp;|&nbsp; 대표 : 민기태
        </p>
      </div>
    </footer>
  );
}

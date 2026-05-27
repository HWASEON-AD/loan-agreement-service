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
          본 서비스는 법률 서비스가 아니며, 변호사법에 따른 법률 자문이나 대리를
          제공하지 않습니다. 제공되는 문서 양식은 일반적인 참고용이며, 구체적인
          사안에 대해서는 전문가와 상담하시기 바랍니다.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          © {new Date().getFullYear()} {SERVICE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

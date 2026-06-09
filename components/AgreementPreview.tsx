// 약정서 미리보기 — 공식 법적 문서 스타일 렌더링
import React from "react";
import type { CreateFormData, Agreement } from "@/lib/types";
import { numberToKorean, formatNumber, calcMonthlyInterest } from "@/lib/interest-calc";

// CreateFormData → Agreement 변환 (미리보기용)
function toAgreement(form: CreateFormData): Agreement {
  return {
    id: "preview",
    status: "draft",
    amount: form.amount,
    interestRate: form.interestRate,
    startDate: form.startDate,
    endDate: form.endDate,
    repaymentMethod: form.repaymentMethod,
    interestDay: form.interestDay,
    lender: form.lender,
    borrower: form.borrower,
    familyRelation: form.familyRelation,
    lenderSignToken: "",
    borrowerSignToken: "",
    borrowerTokenExpiresAt: null,
    parentAgreementId: null,
    pdfBase64: null,
    documentHash: null,
    lenderSigned: false,
    borrowerSigned: false,
    transferConfirmed: false,
    transferDate: null,
    transferNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function formatKoreanDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

function formatBirth(birth: string): string {
  if (!birth || birth.length !== 6) return birth;
  return `${birth.slice(0, 2)}.${birth.slice(2, 4)}.${birth.slice(4, 6)}`;
}

export function AgreementPreview({
  form,
  agreement,
}: {
  form?: CreateFormData;
  agreement?: Agreement;
}) {
  const a = agreement ?? (form ? toAgreement(form) : null);
  if (!a) return null;

  const amountKorean = numberToKorean(a.amount);
  const amountNumber = formatNumber(a.amount);
  const isFree = a.interestRate <= 0;
  const monthlyInterest = calcMonthlyInterest(a.amount, a.interestRate);
  const today = formatKoreanDate(new Date().toISOString().slice(0, 10));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* 문서 영역 */}
      <div className="px-8 py-10 sm:px-14 sm:py-12 font-serif" style={{ fontFamily: "'Noto Serif KR', 'Nanum Myeongjo', Georgia, serif" }}>

        {/* 제목 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.4em] text-slate-900 border-b-2 border-slate-900 inline-block pb-2">
            대 여 금 약 정 서
          </h1>
        </div>

        {/* 당사자 정보 */}
        <div className="space-y-6 mb-8">
          {/* 대여인 갑 */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-sm border-b border-slate-300">
              대여인 (갑)
            </div>
            <div className="px-4 py-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">성    명</span>
                <span className="font-medium text-slate-900">{a.lender.name || "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">생년월일</span>
                <span>{a.lender.birth ? formatBirth(a.lender.birth) : "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">연 락 처</span>
                <span>{a.lender.phone || "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">주    소</span>
                <span className="flex-1 break-all">{a.lender.address || "　"}</span>
              </div>
            </div>
          </div>

          {/* 차입인 을 */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-sm border-b border-slate-300">
              차입인 (을)
            </div>
            <div className="px-4 py-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">성    명</span>
                <span className="font-medium text-slate-900">{a.borrower.name || "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">생년월일</span>
                <span>{a.borrower.birth ? formatBirth(a.borrower.birth) : "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">연 락 처</span>
                <span>{a.borrower.phone || "　"}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-20 text-slate-500 shrink-0">주    소</span>
                <span className="flex-1 break-all">{a.borrower.address || "　"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 핵심 조건 요약 */}
        <div className="border border-slate-300 rounded-lg overflow-hidden mb-8">
          <div className="bg-slate-800 px-4 py-2 text-white text-sm font-bold">
            약정 주요 내용
          </div>
          <div className="divide-y divide-slate-200">
            <Row label="대 여 금 액" value={`금 ${amountKorean}원정 (￦${amountNumber})`} />
            <Row label="대 여 일 자" value={formatKoreanDate(a.startDate)} />
            <Row label="만    기    일" value={formatKoreanDate(a.endDate)} />
            <Row
              label="이       자"
              value={isFree ? "무이자 (당사자 간 합의)" : `연 ${(a.interestRate * 100).toFixed(1)}% / 월 ${formatNumber(monthlyInterest)}원`}
            />
            <Row
              label="상 환 방 법"
              value={a.repaymentMethod === "lump_sum" ? "만기일시상환" : "분할상환"}
            />
          </div>
        </div>

        {/* 약정 조항 */}
        <div className="mb-8 space-y-4 text-sm text-slate-700 leading-7">
          <p className="text-center text-slate-600 text-xs mb-4">
            위 당사자 간에 다음과 같이 금전 대여 약정을 체결합니다.
          </p>

          <Article num="제1조" title="대여 금액">
            &quot;갑&quot;은 &quot;을&quot;에게 금 {amountKorean}원({amountNumber}원)을 대여한다.
          </Article>

          <Article num="제2조" title="대여 기간">
            대여 기간은 {formatKoreanDate(a.startDate)}부터{" "}
            {formatKoreanDate(a.endDate)}까지로 한다.
          </Article>

          <Article num="제3조" title="이자">
            {isFree
              ? `본 대여금에 대한 이자는 없는 것으로 한다.`
              : `이자율은 연 ${(a.interestRate * 100).toFixed(1)}%로 하며, "을"은 매월 ${a.interestDay ?? 1}일에 금 ${formatNumber(monthlyInterest)}원을 "갑"의 지정 계좌로 이체한다.`}
          </Article>

          <Article num="제4조" title="상환 방법">
            {a.repaymentMethod === "installment"
              ? `"을"은 만기일(${formatKoreanDate(a.endDate)})까지 매월 ${a.interestDay ?? 1}일에 원금을 분할하여 "갑"에게 상환한다.`
              : `"을"은 만기일(${formatKoreanDate(a.endDate)})에 원금 전액을 "갑"에게 일시 상환한다.`}
          </Article>

          <Article num="제5조" title="기한이익 상실">
            &quot;을&quot;이 이자 또는 원금을 2회 이상 연속하여 지급하지 아니하거나 기타 본
            약정을 위반한 경우, &quot;갑&quot;은 즉시 원금 전액의 반환을 청구할 수 있다.
          </Article>

          <Article num="제6조" title="기타">
            본 약정에 명시되지 않은 사항은 민법 및 관련 법령에 따른다.
          </Article>
        </div>

        {/* 날짜 + 약정 성립 문구 */}
        <div className="border-t border-slate-200 pt-6 mb-8 text-sm text-slate-600 text-center leading-7">
          <p>
            위 약정의 성립을 증명하기 위하여 약정서 2부를 작성하여<br />
            &quot;갑&quot;과 &quot;을&quot;이 각각 서명·날인한 후 각자 1부씩 보관한다.
          </p>
          <p className="mt-4 font-medium text-slate-800">{today}</p>
        </div>

        {/* 서명란 */}
        <div className="grid grid-cols-2 gap-4">
          <SignBox role="대여인 (갑)" name={a.lender.name} signed={a.lenderSigned} />
          <SignBox role="차입인 (을)" name={a.borrower.name} signed={a.borrowerSigned} />
        </div>
      </div>
    </div>
  );
}

// 조항 컴포넌트
function Article({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-bold text-slate-800 mb-1">
        {num} ({title})
      </p>
      <p className="pl-4">{children}</p>
    </div>
  );
}

// 요약 행 컴포넌트
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm">
      <span className="w-32 px-4 py-2.5 bg-slate-50 text-slate-600 font-medium shrink-0 border-r border-slate-200">
        {label}
      </span>
      <span className="px-4 py-2.5 text-slate-900 font-medium">{value}</span>
    </div>
  );
}

// 서명란 컴포넌트
function SignBox({ role, name, signed }: { role: string; name: string; signed: boolean }) {
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden text-center">
      <div className="bg-slate-100 py-2 text-xs font-bold text-slate-700 border-b border-slate-300">
        {role}
      </div>
      <div className="py-4 px-3">
        <p className="text-sm text-slate-700 mb-1">{name || "　"}</p>
        {signed ? (
          <div className="mt-2 inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs font-semibold">
            ✓ 서명 완료
          </div>
        ) : (
          <div className="mt-2 w-20 h-10 border border-dashed border-slate-300 rounded mx-auto flex items-center justify-center text-xs text-slate-400">
            (인)
          </div>
        )}
      </div>
    </div>
  );
}

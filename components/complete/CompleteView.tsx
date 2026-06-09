"use client";

// 완료 페이지 — 서명 완료 안내 + PDF 다운로드 + 확정일자 안내 + 구독 CTA
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { Footer } from "@/components/Footer";
import { TransferEvidenceSection } from "@/components/complete/TransferEvidenceSection";
import { SUBSCRIPTION_PRICE } from "@/lib/config";
import { formatNumber } from "@/lib/interest-calc";
import type { Agreement, Order } from "@/lib/types";
import { trackPixelEvent } from "@/components/MetaPixel";

export function CompleteView({ agreementId }: { agreementId: string }) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/agreements/${agreementId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok) {
          setAgreement(data.agreement);
          setOrder(data.order);
          // 약정서 완료 = 구매 전환 이벤트
          trackPixelEvent("Purchase", {
            currency: "KRW",
            value: data.order?.amount ?? 30000,
            content_name: "대여약정서",
            content_type: "product",
          });
        }
      } catch {
        // 조회 실패 무시
      } finally {
        setLoading(false);
      }
    })();
  }, [agreementId]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-5 py-12">
        {/* 완료 헤더 */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            서명이 완료되었습니다
          </h1>
          <p className="mt-2 text-slate-500">
            영업일 기준 2~3일 이내에 내용증명이 발송될 예정입니다.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          {/* 요약 */}
          {loading ? (
            <Card>
              <p className="text-center text-slate-400">불러오는 중...</p>
            </Card>
          ) : agreement ? (
            <Card>
              <h3 className="mb-3 font-semibold text-slate-900">접수 내역</h3>
              <dl className="space-y-2 text-sm">
                <Row label="대여자(갑)" value={agreement.lender.name} />
                <Row label="차용자(을)" value={agreement.borrower.name} />
                <Row
                  label="대여 금액"
                  value={`${formatNumber(agreement.amount)}원`}
                />
                <Row
                  label="결제 상태"
                  value={order?.status === "paid" ? "결제완료" : "대기"}
                />
                <Row
                  label="내용증명"
                  value={
                    order?.certMailStatus === "sent"
                      ? "발송완료"
                      : "발송 준비 중"
                  }
                />
              </dl>
            </Card>
          ) : (
            <LegalNotice tone="warn">
              접수 내역을 찾을 수 없습니다. 이메일로 받으신 링크를 확인해주세요.
            </LegalNotice>
          )}

          {/* PDF 다운로드 — 토큰 필수 (보안 접근 제어) */}
          {agreement?.lenderSignToken ? (
            <a
              href={`/api/agreements/${agreementId}/pdf?token=${agreement.lenderSignToken}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button fullWidth>서명된 약정서 PDF 다운로드</Button>
            </a>
          ) : (
            <Button fullWidth disabled>
              PDF 준비 중...
            </Button>
          )}

          {/* 감사추적인증서 다운로드 */}
          {agreement?.lenderSignToken ? (
            <a
              href={`/api/agreements/${agreementId}/audit-cert?token=${agreement.lenderSignToken}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" fullWidth>
                📋 전자서명 감사추적인증서 다운로드
              </Button>
            </a>
          ) : null}

          <LegalNotice tone="info">
            대여자(갑)와 차용자(을) 이메일로 각각 확인 안내가 발송되었습니다.
            감사추적인증서는 분쟁 발생 시 전자서명법에 따른 증거 자료로
            활용됩니다.
          </LegalNotice>

          {/* 확정일자 안내 */}
          <Card>
            <h3 className="font-semibold text-slate-900">
              추가 법적 효력: 확정일자
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              약정서에 확정일자를 받으면 작성 시점에 대한 공적 증거를 추가로
              확보할 수 있습니다. 확정일자는 인터넷등기소에서 직접 신청하실 수
              있습니다. (수수료 약 500원)
            </p>
            <ol className="mt-3 space-y-1 text-sm text-slate-600">
              <li>1. 인터넷등기소(iros.go.kr) 접속</li>
              <li>2. 확정일자 메뉴 선택 후 문서 업로드</li>
              <li>3. 수수료 결제 → 확정일자 부여 완료</li>
            </ol>
            <a
              href="https://www.iros.go.kr"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-medium text-brand-700 underline"
            >
              인터넷등기소 바로가기
            </a>
          </Card>

          {/* 이체 확인증 업로드 — 토큰 필수 */}
          {agreement?.lenderSignToken ? (
            <TransferEvidenceSection
              agreementId={agreementId}
              token={agreement.lenderSignToken}
            />
          ) : null}

          {/* 이자 리마인더 구독 CTA */}
          <Card className="border-brand-200 bg-brand-50">
            <h3 className="font-semibold text-brand-800">
              매월 이자 납부일에 알림 받기
            </h3>
            <p className="mt-2 text-sm text-brand-900/80">
              납부일 알림과 입금 기록 관리를 도와드립니다. 월{" "}
              {formatNumber(SUBSCRIPTION_PRICE)}원.
            </p>
            {agreement?.lenderSignToken &&
            agreement.interestRate > 0 ? (
              <Link
                href={`/subscribe/${agreementId}?token=${agreement.lenderSignToken}`}
                className="mt-3 inline-block"
              >
                <Button variant="outline">이자 관리 구독 신청하기</Button>
              </Link>
            ) : (
              <p className="mt-3 text-xs text-brand-900/60">
                이자 약정이 있는 약정서에서 신청할 수 있습니다.
              </p>
            )}
          </Card>

          <Link href="/" className="block">
            <Button variant="ghost" fullWidth>
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

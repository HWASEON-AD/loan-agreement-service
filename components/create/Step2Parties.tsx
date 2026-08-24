"use client";

// Step 2: 당사자 정보 입력 (대여자 갑, 차용자 을) — 주민번호 수집 금지
// 아코디언: 갑/을 중 하나만 열림. 갑 완료 시 자동으로 접고 을을 펼침.
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { loadForm, saveForm, defaultForm } from "@/lib/form-store";
import { FAMILY_RELATION_LABELS } from "@/lib/types";
import type { CreateFormData, FamilyRelation, Party } from "@/lib/types";
import { formatPhone } from "@/lib/phone";

// 당사자 입력 카드 (아코디언 헤더 + 펼침 영역)
function PartyFields({
  title,
  badge,
  badgeClass,
  party,
  onChange,
  isOpen,
  onToggle,
  complete,
  onBlurOutside,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  party: Party;
  onChange: (p: Party) => void;
  isOpen: boolean;
  onToggle: () => void;
  complete: boolean;
  onBlurOutside?: () => void;
}) {
  const set = (k: keyof Party, v: string) => onChange({ ...party, [k]: v });
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}
        >
          {badge}
        </span>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {complete && (
          <span className="text-sm font-semibold text-brand-600">✓</span>
        )}
        <span
          className={`ml-auto inline-block text-xs text-slate-400 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="mt-4 space-y-3"
          onBlur={(e) => {
            // 포커스가 이 영역(갑/을 입력칸) 밖으로 완전히 빠져나갈 때만
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              onBlurOutside?.();
            }
          }}
        >
          <Input
            label="성명"
            value={party.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="홍길동"
          />
          <Input
            label="생년월일 6자리"
            value={party.birth}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => set("birth", e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="예: 920103"
            hint="주민등록번호는 수집하지 않습니다. 생년월일 6자리만 입력하세요."
          />
          <Input
            label="휴대폰 번호"
            value={party.phone}
            inputMode="numeric"
            maxLength={13}
            onChange={(e) => set("phone", formatPhone(e.target.value))}
            placeholder="010-1234-5678"
          />
          <Input
            label="이메일"
            type="email"
            value={party.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="example@email.com"
          />
          <Input
            label="주소"
            value={party.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="서울특별시 ..."
          />
        </div>
      )}
    </Card>
  );
}

export function Step2Parties() {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormData>(defaultForm());
  const [error, setError] = useState("");
  // 아코디언: 한 번에 하나만 열림. 초기엔 갑만 열림.
  const [open, setOpen] = useState<"lender" | "borrower" | null>("lender");
  const advancedRef = useRef(false);

  useEffect(() => {
    setForm(loadForm());
  }, []);

  // 당사자 유효성 검사
  const validParty = (p: Party) =>
    p.name.trim() &&
    p.birth.length === 6 &&
    p.phone.trim() &&
    /\S+@\S+\.\S+/.test(p.email) &&
    p.address.trim();

  const lenderComplete = !!validParty(form.lender);
  const borrowerComplete = !!validParty(form.borrower);

  // 갑 입력을 마치고(모든 항목 충족) 입력 영역 밖으로 포커스가 빠져나갈 때
  // 자동으로 갑을 접고 을을 펼침 (최초 1회만). 타이핑 도중에는 닫히지 않음.
  const handleLenderBlur = () => {
    if (lenderComplete && open === "lender" && !advancedRef.current) {
      advancedRef.current = true;
      setOpen("borrower");
    }
  };

  const handleNext = () => {
    if (!validParty(form.lender)) {
      setOpen("lender");
      setError(
        "대여자(갑) 정보를 모두 입력해주세요. (생년월일 6자리, 유효한 이메일 포함)"
      );
      return;
    }
    if (!validParty(form.borrower)) {
      setOpen("borrower");
      setError(
        "차용자(을) 정보를 모두 입력해주세요. (생년월일 6자리, 유효한 이메일 포함)"
      );
      return;
    }
    saveForm(form);
    router.push("/create/step/3");
  };

  return (
    <StepForm
      step={2}
      title="당사자 정보"
      description="돈을 빌려주는 대여자(갑)와 빌리는 차용자(을)의 정보를 입력합니다."
    >
      <div className="space-y-5">
        <LegalNotice tone="info" title="개인정보 안내">
          본 서비스는 주민등록번호를 수집하지 않으며, 생년월일 6자리만
          사용합니다. 차용자 이메일로 서명 요청 링크가 발송됩니다.
        </LegalNotice>

        <PartyFields
          title="대여자 (돈을 빌려주는 사람)"
          badge="갑"
          badgeClass="bg-brand-700 text-white"
          party={form.lender}
          onChange={(p) => setForm({ ...form, lender: p })}
          isOpen={open === "lender"}
          onToggle={() => setOpen(open === "lender" ? null : "lender")}
          complete={lenderComplete}
          onBlurOutside={handleLenderBlur}
        />
        <PartyFields
          title="차용자 (돈을 빌리는 사람)"
          badge="을"
          badgeClass="border border-brand-700 bg-white text-brand-700"
          party={form.borrower}
          onChange={(p) => setForm({ ...form, borrower: p })}
          isOpen={open === "borrower"}
          onToggle={() => setOpen(open === "borrower" ? null : "borrower")}
          complete={borrowerComplete}
        />

        {/* 가족 관계 */}
        <Card>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            가족 관계
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FAMILY_RELATION_LABELS) as FamilyRelation[]).map(
              (rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => setForm({ ...form, familyRelation: rel })}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    form.familyRelation === rel
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {FAMILY_RELATION_LABELS[rel]}
                </button>
              )
            )}
          </div>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="shrink-0 px-5"
            onClick={() => router.push("/create/step/1")}
          >
            이전
          </Button>
          <Button
            onClick={handleNext}
            fullWidth
            disabled={!validParty(form.lender) || !validParty(form.borrower)}
          >
            다음 — 약정서 미리보기
          </Button>
        </div>
      </div>
    </StepForm>
  );
}

"use client";
// Step 1: 서식 선택 + 기본 정보 입력
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type {
  FundingStep1Data,
  FundingFormType,
  LandParcel,
} from "@/lib/funding-types";

interface Props {
  initialData: FundingStep1Data | null;
  onNext: (data: FundingStep1Data) => void;
}

// 숫자만 추출
function digitsOnly(s: string, maxLen?: number): string {
  const d = s.replace(/\D/g, "");
  return maxLen !== undefined ? d.slice(0, maxLen) : d;
}

// 휴대전화 자동 포맷 (010-XXXX-XXXX)
function formatPhone(s: string): string {
  const d = digitsOnly(s, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

// 콤마 표시 (숫자 입력용)
function formatAmountInput(v: string): string {
  const d = digitsOnly(v);
  if (!d) return "";
  return Number(d).toLocaleString("ko-KR");
}

function parseAmount(v: string): number {
  const d = digitsOnly(v);
  return d ? Number(d) : 0;
}

export function FundingStep1Basic({ initialData, onNext }: Props) {
  const initFormType: FundingFormType =
    initialData?.formType ?? "housing";
  const initBase = initialData?.baseInfo;

  const [formType, setFormType] = useState<FundingFormType>(initFormType);
  const [name, setName] = useState(initBase?.name ?? "");
  const [idFront, setIdFront] = useState(initBase?.idNumberFront ?? "");
  const [idBack, setIdBack] = useState(initBase?.idNumberBack ?? "");
  const [address, setAddress] = useState(initBase?.address ?? "");
  const [phone, setPhone] = useState(initBase?.phone ?? "");

  // 주택 전용
  const initTradeAmount =
    initialData?.formType === "housing"
      ? initialData.baseInfo.tradeAmount
      : null;
  const [tradeAmountStr, setTradeAmountStr] = useState(
    initTradeAmount ? initTradeAmount.toLocaleString("ko-KR") : ""
  );

  // 토지 전용
  const initLandParcels: LandParcel[] =
    initialData?.formType === "land"
      ? initialData.baseInfo.landParcels
      : [{ location: "", area: "", tradeAmount: null }];
  const [landParcels, setLandParcels] = useState<LandParcel[]>(
    initLandParcels.length > 0
      ? initLandParcels
      : [{ location: "", area: "", tradeAmount: null }]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 필지 추가/삭제
  const addParcel = () => {
    if (landParcels.length >= 3) return;
    setLandParcels([
      ...landParcels,
      { location: "", area: "", tradeAmount: null },
    ]);
  };
  const removeParcel = (idx: number) => {
    if (landParcels.length <= 1) return;
    setLandParcels(landParcels.filter((_, i) => i !== idx));
  };
  const updateParcel = (idx: number, patch: Partial<LandParcel>) => {
    setLandParcels(
      landParcels.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  };

  // 검증
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "성명은 2자 이상이어야 합니다.";
    if (idFront.length !== 6 || !/^\d{6}$/.test(idFront))
      errs.idFront = "주민등록번호 앞 6자리를 입력해주세요.";
    if (idBack.length !== 7 || !/^\d{7}$/.test(idBack))
      errs.idBack = "주민등록번호 뒤 7자리를 입력해주세요.";
    if (address.trim().length < 5) errs.address = "주소를 입력해주세요.";
    if (!/^010-\d{4}-\d{4}$/.test(phone))
      errs.phone = "휴대전화 번호 형식이 올바르지 않습니다.";

    if (formType === "housing") {
      const amt = parseAmount(tradeAmountStr);
      if (amt <= 0) errs.tradeAmount = "거래금액을 입력해주세요.";
    } else {
      // 토지: 최소 1필지, 각 소재지+거래금액 필수
      let hasValid = false;
      landParcels.forEach((p, i) => {
        if (!p.location.trim())
          errs[`parcel_location_${i}`] = "소재지를 입력해주세요.";
        if (
          p.tradeAmount === null ||
          typeof p.tradeAmount !== "number" ||
          p.tradeAmount <= 0
        )
          errs[`parcel_amount_${i}`] = "거래금액을 입력해주세요.";
        else hasValid = true;
      });
      if (!hasValid) errs.parcels = "최소 1개 필지의 거래금액을 입력해주세요.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    if (formType === "housing") {
      const data: FundingStep1Data = {
        formType: "housing",
        baseInfo: {
          name: name.trim(),
          idNumberFront: idFront,
          idNumberBack: idBack,
          address: address.trim(),
          phone,
          tradeAmount: parseAmount(tradeAmountStr),
        },
      };
      onNext(data);
    } else {
      const data: FundingStep1Data = {
        formType: "land",
        baseInfo: {
          name: name.trim(),
          idNumberFront: idFront,
          idNumberBack: idBack,
          address: address.trim(),
          phone,
          landParcels: landParcels.map((p) => ({
            location: p.location.trim(),
            area: p.area.trim(),
            tradeAmount:
              typeof p.tradeAmount === "number" ? p.tradeAmount : null,
          })),
        },
      };
      onNext(data);
    }
  };

  return (
    <Card className="space-y-6">
      {/* 서식 종류 */}
      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">
          서식 종류를 선택하세요
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setFormType("housing")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              formType === "housing"
                ? "border-brand-500 bg-brand-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="font-semibold text-slate-900">주택 취득자금</p>
            <p className="mt-1 text-xs text-slate-500">
              주택 매수 시 작성 (별지 제1호의3 서식)
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFormType("land")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              formType === "land"
                ? "border-brand-500 bg-brand-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="font-semibold text-slate-900">토지 취득자금</p>
            <p className="mt-1 text-xs text-slate-500">
              토지 매수 시 작성 (별지 제1호의4 서식)
            </p>
          </button>
        </div>
      </div>

      {/* 인적사항 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">인적사항</h3>
        <Input
          label="성명"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          error={errors.name}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            주민등록번호
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={idFront}
              onChange={(e) => setIdFront(digitsOnly(e.target.value, 6))}
              placeholder="앞 6자리"
              className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
                errors.idFront ? "border-red-400" : "border-slate-300"
              }`}
            />
            <span className="text-slate-400">-</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={7}
              value={idBack}
              onChange={(e) => setIdBack(digitsOnly(e.target.value, 7))}
              placeholder="뒤 7자리"
              className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
                errors.idBack ? "border-red-400" : "border-slate-300"
              }`}
              autoComplete="off"
            />
          </div>
          {(errors.idFront || errors.idBack) && (
            <p className="mt-1 text-xs text-red-500">
              {errors.idFront || errors.idBack}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            뒤 7자리는 화면에 표시되지 않으며, PDF 생성 후 즉시 폐기됩니다.
          </p>
        </div>

        <Input
          label="주소"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="서울특별시 ..."
          error={errors.address}
        />
        <Input
          label="휴대전화"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-1234-5678"
          error={errors.phone}
        />
      </div>

      {/* 거래 정보 (주택) */}
      {formType === "housing" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">거래 정보</h3>
          <Input
            label="거래금액 (원)"
            name="tradeAmount"
            inputMode="numeric"
            value={tradeAmountStr}
            onChange={(e) =>
              setTradeAmountStr(formatAmountInput(e.target.value))
            }
            placeholder="330,000,000"
            error={errors.tradeAmount}
          />
        </div>
      )}

      {/* 거래 정보 (토지) */}
      {formType === "land" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">
            거래 정보 (필지 최대 3개)
          </h3>
          {landParcels.map((p, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  필지 {idx + 1}
                </p>
                {landParcels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParcel(idx)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                )}
              </div>
              <Input
                label="소재지"
                value={p.location}
                onChange={(e) =>
                  updateParcel(idx, { location: e.target.value })
                }
                placeholder="경기도 성남시 ..."
                error={errors[`parcel_location_${idx}`]}
              />
              <Input
                label="면적"
                value={p.area}
                onChange={(e) => updateParcel(idx, { area: e.target.value })}
                placeholder="200㎡"
              />
              <Input
                label="거래금액 (원)"
                inputMode="numeric"
                value={
                  p.tradeAmount !== null
                    ? p.tradeAmount.toLocaleString("ko-KR")
                    : ""
                }
                onChange={(e) =>
                  updateParcel(idx, {
                    tradeAmount: parseAmount(e.target.value) || null,
                  })
                }
                placeholder="180,000,000"
                error={errors[`parcel_amount_${idx}`]}
              />
            </div>
          ))}
          {landParcels.length < 3 && (
            <Button variant="outline" onClick={addParcel}>
              + 필지 추가
            </Button>
          )}
          {errors.parcels && (
            <p className="text-xs text-red-500">{errors.parcels}</p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleNext}>다음 단계 →</Button>
      </div>
    </Card>
  );
}

"use client";

// 계약갱신 요구 통지서 작성 폼 — 한 페이지 완결형
//
// ★★ 절대 금지 (Fable 법률 검토 반영) — 수정 시 반드시 지킬 것
//   1. LLM/AI 호출 0회. 문구 다듬기·"더 정중하게" 버튼도 금지.
//   2. "행사 가능합니다" 류 결론 선언 금지.
//      ★경계 원리: 주어가 '법령·조문·산식'이면 정보, '귀하·귀하의 계약'이면 결론(위법).
//   3. D-day 배지·카운트다운·신호등 UI 금지 (산술을 시각 언어로 결론화한 것과 같다).
//   4. 거절사유 자가진단 문답 금지. 9개 사유는 모든 이용자에게 조문 그대로만.
//   5. 변호사 연결·검토 버튼 금지 (변호사법 34조). 특정 사무소 소개 불가.
//   6. 무료 유지. 구독 혜택 목록·가격표에 이 기능을 넣지 말 것.
//   7. 생성 문서를 DB에 저장하지 말 것 (실명·주소가 들어간다).

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LegalNotice } from "@/components/ui/LegalNotice";
import {
  calcRenewalWindow,
  calcMaxIncrease,
  calcRenewedEndDate,
  contractMonths,
  formatKoreanDate,
  todayKst,
} from "@/lib/renewal-calc";
import {
  buildRenewalNoticeText,
  buildRenewalNoticeSms,
  buildRenewalNoticeSubject,
  type RenewalNotice,
} from "@/lib/renewal-text";

const onlyDigits = (v: string) => v.replace(/[^\d]/g, "");
const comma = (v: string) => {
  const n = onlyDigits(v);
  return n ? Number(n).toLocaleString("ko-KR") : "";
};

// 섹션 헤더 (번호 뱃지 + 제목) — 컴포넌트 밖에 정의해야 리렌더 시 포커스가 유지된다
function SectionTitle({ no, children }: { no: number; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-xs font-bold text-white">
        {no}
      </span>
      <h2 className="text-base font-bold text-slate-900">{children}</h2>
    </div>
  );
}

// 선택 카드형 라디오
function ChoiceButton({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/40"
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {sub && <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>}
    </button>
  );
}

export function RenewalForm() {
  // 1. 계약 정보
  const [propertyAddress, setPropertyAddress] = useState("");
  const [periodOrigin, setPeriodOrigin] = useState<"new" | "exercised" | "implied">("new");
  const [contractSignDate, setContractSignDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 2. 보증금·차임 (전세/월세 분기)
  const [hasMonthlyRent, setHasMonthlyRent] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");

  // 3. 당사자
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState("");
  const [ownerChanged, setOwnerChanged] = useState(false);

  // 4. 갱신 조건
  const [condition, setCondition] = useState<"same" | "negotiate">("same");

  // 5. 확인 3개
  const [ckResidential, setCkResidential] = useState(false);
  const [ckNotUsed, setCkNotUsed] = useState(false);
  const [ckFromContract, setCkFromContract] = useState(false);

  // 6. 보내기
  const [mailTo, setMailTo] = useState("");
  const [mailCc, setMailCc] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfErr, setPdfErr] = useState("");

  // 계산 — 순수 함수. 판정하지 않고 날짜만 낸다.
  const win = useMemo(
    () => (endDate ? calcRenewalWindow(endDate, contractSignDate) : null),
    [endDate, contractSignDate]
  );

  const months = useMemo(
    () => (startDate && endDate ? contractMonths(startDate, endDate) : null),
    [startDate, endDate]
  );

  const notice: RenewalNotice = useMemo(
    () => ({
      propertyAddress,
      startDate,
      endDate,
      hasMonthlyRent,
      deposit: Number(onlyDigits(deposit) || 0),
      monthlyRent: Number(onlyDigits(monthlyRent) || 0),
      tenantName,
      tenantPhone,
      tenantAddress: tenantAddress || propertyAddress,
      landlordName,
      landlordAddress,
      condition,
      noticeDate: todayKst(),
    }),
    [
      propertyAddress, startDate, endDate, hasMonthlyRent, deposit, monthlyRent,
      tenantName, tenantPhone, tenantAddress, landlordName, landlordAddress, condition,
    ]
  );

  const noticeText = useMemo(() => buildRenewalNoticeText(notice), [notice]);
  const smsText = useMemo(() => buildRenewalNoticeSms(notice), [notice]);

  const requiredFilled = Boolean(
    propertyAddress && startDate && endDate && tenantName && landlordName && deposit
  );
  // 주거용 확인은 '서식의 전제'이므로 게이트. (법적 판정이 아니라 제품 사양으로 둔다)
  const canBuild = requiredFilled && ckResidential;

  async function handleSend() {
    if (!mailTo) return;
    if (
      !confirm(
        `아래 주소로 통지서를 보냅니다.\n\n받는 사람: ${mailTo}\n${
          mailCc ? `사본: ${mailCc}\n` : ""
        }\n주소가 정확한지 확인해 주세요.`
      )
    )
      return;

    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/renewal/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: mailTo,
          cc: mailCc,
          subject: buildRenewalNoticeSubject(notice),
          noticeText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "발송에 실패했습니다.");
      setSendMsg({
        ok: true,
        text: `${mailTo} 로 발송했습니다.${mailCc ? ` (사본: ${mailCc})` : ""}`,
      });
    } catch (e) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(smsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // PDF 다운로드 — 서버에서 한글 폰트를 임베드해 만들고, 저장 없이 그대로 내려받는다.
  async function handleDownloadPdf() {
    setDownloading(true);
    setPdfErr("");
    try {
      const res = await fetch("/api/renewal/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeText, dateYmd: notice.noticeDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "PDF 생성에 실패했습니다.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `계약갱신요구통지서_${notice.noticeDate.replace(/-/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  const checks = [
    {
      checked: ckResidential,
      set: setCkResidential,
      text: "임차한 건물을 주로 주거 목적으로 사용하고 있음을 확인합니다.",
      sub: "주택임대차보호법은 주거용 건물의 임대차에 적용됩니다(법 제2조). 오피스텔 등 겸용 건물은 사안마다 결론이 다르며, 이 확인은 이용자 본인의 판단입니다.",
    },
    {
      checked: ckNotUsed,
      set: setCkNotUsed,
      text: "이 주택에 관하여 과거에 계약갱신요구권을 행사하여 갱신한 적이 없음을 확인합니다.",
      sub: "합의에 의한 재계약이나 묵시적 갱신은 여기의 ‘행사’에 포함되지 않는다는 것이 국토교통부 해설의 입장입니다.",
    },
    {
      checked: ckFromContract,
      set: setCkFromContract,
      text: "만료일을 계약서에 적힌 날짜 그대로 입력했음을 확인합니다.",
      sub: "만료일 표기는 계약서마다 다를 수 있고, 하루 차이가 기간 계산에 영향을 줍니다.",
    },
  ];

  return (
    <>
      {/* ── 입력 영역 (인쇄 시 숨김) */}
      <div className="space-y-5 print:hidden">
        {/* 1. 계약 정보 */}
        <Card>
          <SectionTitle no={1}>계약 정보</SectionTitle>
          <div className="space-y-5">
            <Input
              label="임차주택 소재지"
              hint="계약서상 주소를 동·호수까지 적어주세요"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="서울시 ○○구 ○○로 12, 101동 502호"
            />

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                현재 살고 있는 임대차기간은 어떻게 시작되었나요?
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <ChoiceButton
                  active={periodOrigin === "new"}
                  label="새로 계약서를 씀"
                  sub="신규 체결 또는 재계약"
                  onClick={() => setPeriodOrigin("new")}
                />
                <ChoiceButton
                  active={periodOrigin === "exercised"}
                  label="갱신요구권을 행사함"
                  sub="권리를 써서 갱신"
                  onClick={() => setPeriodOrigin("exercised")}
                />
                <ChoiceButton
                  active={periodOrigin === "implied"}
                  label="통지 없이 계속 거주"
                  sub="묵시적 갱신에 해당할 수 있음"
                  onClick={() => setPeriodOrigin("implied")}
                />
              </div>

              {periodOrigin === "implied" && (
                <div className="mt-3">
                  <LegalNotice tone="info">
                    통지 없이 기간이 지나 계속 거주하는 경우(묵시적 갱신)는 갱신요구권을{" "}
                    <b>행사한 것에 포함되지 않는다</b>는 것이 국토교통부 해설의 입장입니다.
                    아래 ‘계약서 작성일’에는 종전 기간이 끝난 <b>다음 날</b>을, 만료일에는 종전
                    만료일에 2년을 더한 날짜를 확인 후 입력해 주세요.
                  </LegalNotice>
                </div>
              )}
              {periodOrigin === "exercised" && (
                <div className="mt-3">
                  <LegalNotice tone="warn">
                    법 제6조의3 제2항은 갱신요구권을 1회에 한하여 행사할 수 있다고 정합니다.
                    과거 갱신이 ‘갱신요구권 행사’였는지 ‘합의에 의한 재계약’이었는지는 계약서·문자
                    기록에 따라 달라지며, 본 서비스는 이를 판단하지 않습니다.
                  </LegalNotice>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="현재 계약서 작성(서명)일"
                hint="갱신·재계약을 했다면 가장 최근 갱신 계약일"
                type="date"
                value={contractSignDate}
                onChange={(e) => setContractSignDate(e.target.value)}
              />
              <Input
                label="임대차기간 시작일"
                hint="계약서 ‘임대차기간’ 칸의 앞 날짜"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-4">
              <Input
                label="임대차기간 만료일"
                hint="직접 계산하지 말고, 계약서에 인쇄된 종료일을 그대로 옮겨 적어주세요. 입주일·잔금일과 다를 수 있습니다."
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {months !== null && months > 0 && months < 24 && (
              <LegalNotice tone="warn">
                입력하신 기간은 약 {months}개월입니다. 주택임대차보호법 제4조 제1항은 기간을
                정하지 않거나 2년 미만으로 정한 임대차는 그 기간을 2년으로 본다고 정하고 있습니다
                (임차인은 2년 미만으로 정한 기간이 유효함을 주장할 수 있습니다). 어느 날짜를
                만료일로 볼지는 본 서비스가 판단하지 않습니다.
              </LegalNotice>
            )}
          </div>
        </Card>

        {/* 2. 보증금 · 차임 */}
        <Card>
          <SectionTitle no={2}>보증금 · 차임</SectionTitle>
          <div className="space-y-5">
            <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setHasMonthlyRent(false)}
                className={`flex-1 rounded-lg px-8 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
                  !hasMonthlyRent
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                전세
              </button>
              <button
                type="button"
                onClick={() => setHasMonthlyRent(true)}
                className={`flex-1 rounded-lg px-8 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
                  hasMonthlyRent
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                월세
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="보증금 (원)"
                inputMode="numeric"
                value={comma(deposit)}
                onChange={(e) => setDeposit(onlyDigits(e.target.value))}
                placeholder="300,000,000"
              />
              {hasMonthlyRent && (
                <Input
                  label="월 차임 (원)"
                  inputMode="numeric"
                  value={comma(monthlyRent)}
                  onChange={(e) => setMonthlyRent(onlyDigits(e.target.value))}
                  placeholder="1,000,000"
                />
              )}
            </div>

            {deposit && (
              <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                법 제7조가 정한 증액 한도(20분의 1)를 입력값에 대입하면 — 보증금{" "}
                {Number(onlyDigits(deposit)).toLocaleString("ko-KR")}원의 한도 증액분은{" "}
                <b className="text-slate-900">
                  {calcMaxIncrease(Number(onlyDigits(deposit))).toLocaleString("ko-KR")}원
                </b>
                {hasMonthlyRent && monthlyRent && (
                  <>
                    , 월 차임 {Number(onlyDigits(monthlyRent)).toLocaleString("ko-KR")}원의 한도
                    증액분은{" "}
                    <b className="text-slate-900">
                      {calcMaxIncrease(Number(onlyDigits(monthlyRent))).toLocaleString("ko-KR")}원
                    </b>
                  </>
                )}
                입니다. 이는 <b className="text-slate-900">올려야 하는 금액이 아니라 올릴 수 있는
                상한</b>이며, 증액은 협의 사항입니다.
              </div>
            )}
          </div>
        </Card>

        {/* 3. 당사자 */}
        <Card>
          <SectionTitle no={3}>당사자</SectionTitle>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="임차인 성명"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
              <Input
                label="임차인 연락처"
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>

            <Input
              label="임차인 주소"
              hint="비워두면 임차주택 주소가 발신인 주소로 들어갑니다"
              value={tenantAddress}
              onChange={(e) => setTenantAddress(e.target.value)}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                checked={ownerChanged}
                onChange={(e) => setOwnerChanged(e.target.checked)}
              />
              <span className="text-sm leading-relaxed text-slate-800">
                계약 후 <b>집주인이 바뀌었습니다</b>
                {ownerChanged && (
                  <span className="mt-1 block text-xs text-slate-600">
                    통지는 현재 등기부상 소유자에게 보내는 것이 일반적입니다. 소유자는
                    인터넷등기소에서 확인할 수 있습니다.
                  </span>
                )}
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={ownerChanged ? "임대인 성명 (현재 등기부상 소유자)" : "임대인 성명"}
                value={landlordName}
                onChange={(e) => setLandlordName(e.target.value)}
              />
              <Input
                label="임대인 주소"
                hint="우편으로 보낼 때 필요합니다"
                value={landlordAddress}
                onChange={(e) => setLandlordAddress(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* 4. 갱신 조건 */}
        <Card>
          <SectionTitle no={4}>갱신 조건</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceButton
              active={condition === "same"}
              label="종전과 동일한 조건으로 갱신 요구"
              sub="기본"
              onClick={() => setCondition("same")}
            />
            <ChoiceButton
              active={condition === "negotiate"}
              label="조건은 협의 희망"
              sub="갱신 요구 자체는 동일하게 유지됩니다"
              onClick={() => setCondition("negotiate")}
            />
          </div>
        </Card>

        {/* 5. 확인 */}
        <Card>
          <SectionTitle no={5}>확인</SectionTitle>
          <div className="space-y-4">
            {checks.map((c, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  c.checked
                    ? "border-brand-200 bg-brand-50/50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                  checked={c.checked}
                  onChange={(e) => c.set(e.target.checked)}
                />
                <span className="text-sm leading-relaxed text-slate-800">
                  {c.text}
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{c.sub}</span>
                </span>
              </label>
            ))}
            {!ckResidential && (
              <p className="text-xs leading-relaxed text-slate-500">
                본 서식은 주택임대차보호법상 임대차를 전제로 작성되어 있어, 첫 번째 확인 없이는
                다음 단계로 진행할 수 없습니다.
              </p>
            )}
          </div>
        </Card>

        {/* ── 계산 결과 (법령정보형 출력. 결론·배지 금지) */}
        {win && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 shadow-sm">
            {/* 근거 조문 표기 — 기간 자체는 제6조 제1항 전단이 정하고 제6조의3 제1항이 이를 인용한다.
                (법제처 생활법령정보의 인용 방식과 동일하게 맞췄다) */}
            <h2 className="text-base font-bold text-brand-900">
              주택임대차보호법 제6조의3 제1항 본문 · 제6조 제1항 전단이 정한 계약갱신요구 기간
            </h2>

            <div className="mt-4 rounded-xl bg-white p-4">
              <p className="text-xs text-slate-500">법령이 정한 기간</p>
              <p className="mt-1 text-lg font-bold leading-relaxed text-brand-800 sm:text-xl">
                {formatKoreanDate(win.windowStart)} 0시
                <span className="mx-1.5 text-slate-400">~</span>
                {formatKoreanDate(win.windowEnd)} 24시
              </p>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">입력하신 만료일</dt>
                <dd className="font-medium text-slate-900">{formatKoreanDate(win.endDate)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">갱신 시 존속기간</dt>
                <dd className="text-slate-900">
                  2년 (제2항) — {formatKoreanDate(calcRenewedEndDate(win.endDate))}까지
                </dd>
              </div>
            </dl>

            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-600">
              <li>
                · 이 기간은 통지가 임대인에게 <b className="text-slate-900">‘도달’하는 시점</b>{" "}
                기준입니다. 발송일이 아닙니다.
              </li>
              <li>
                · 위 날짜는 입력하신 만료일을 법령의 기간 계산 방식(민법 제157조 초일 불산입,
                제160조의 유추적용)에 기계적으로 대입한 결과이며, 개별 사안에 대한 법률적 판단이
                아닙니다.
              </li>
              <li>
                · 역산 시 초일을 산입할지에 관하여{" "}
                <b className="text-slate-900">법무부·국토교통부는 초일 불산입을 안내</b>하고 있으나,
                하급심 판결 중에는 초일을 산입해 역산한 사례도 보도된 바 있습니다. 본 서비스는 두
                방식 중 <b className="text-slate-900">더 이른 마감 시점</b>을 기준으로 표시합니다.
              </li>
              <li>
                · 우편은 도달까지 시일이 걸립니다. 마감에 임박해 보내기보다{" "}
                <b className="text-slate-900">법정 기간의 중간 시점(만료 3~5개월 전)</b>에 통지하는
                방식이 실무에서 일반적으로 안내됩니다.
              </li>
              {win.today >= win.windowStart && win.today <= win.windowEnd && (
                <li>
                  · 오늘({formatKoreanDate(win.today)})은 위에서 계산된 기간 범위 안의 날짜입니다.
                </li>
              )}
              {win.today > win.windowEnd && (
                <li>· 위에서 계산된 기간의 마지막 날은 오늘 기준으로 이미 지난 날짜입니다.</li>
              )}
              {win.today < win.windowStart && (
                <li>· 위에서 계산된 기간의 시작일은 오늘 기준으로 아직 오지 않은 날짜입니다.</li>
              )}
            </ul>

            {win.isLegacyRule && (
              <div className="mt-4">
                <LegalNotice tone="warn">
                  입력하신 계약서 작성일 기준으로{" "}
                  <b>개정 전 규정(만료 6개월 전 ~ 1개월 전)</b>이 적용되는 것으로 계산되었습니다.
                  ‘2개월 전’ 규정은 2020년 12월 10일 이후 최초로 체결되거나 갱신된 임대차부터
                  적용됩니다(법률 제17363호). 작성일이 정확한지 다시 확인해 주세요.
                </LegalNotice>
              </div>
            )}
          </div>
        )}

        {/* 6. 보내기 */}
        {canBuild && (
          <Card>
            <SectionTitle no={6}>보내기</SectionTitle>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={handleDownloadPdf} disabled={downloading}>
                  {downloading ? "PDF 만드는 중..." : "PDF 다운로드"}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  인쇄
                </Button>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? "복사되었습니다" : "문자·카톡용 텍스트 복사"}
                </Button>
              </div>

              {pdfErr && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{pdfErr}</p>
              )}

              <p className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                문자·카카오톡으로 보낼 때는{" "}
                <b className="text-slate-900">인쇄한 파일과 요약 텍스트를 함께</b> 보내는 것이
                일반적입니다. 파일만 보내면 열어보지 않는 경우가 있습니다. 받은 답장은 보관해
                두시면 도달 여부를 확인하는 자료가 됩니다.
              </p>

              <div className="border-t border-slate-200 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="이메일로 보내기 — 받는 사람"
                    type="email"
                    value={mailTo}
                    onChange={(e) => setMailTo(e.target.value)}
                    placeholder="landlord@example.com"
                  />
                  <Input
                    label="사본 받을 내 이메일 (선택)"
                    type="email"
                    value={mailCc}
                    onChange={(e) => setMailCc(e.target.value)}
                    placeholder="me@example.com"
                  />
                </div>

                <div className="mt-4">
                  <Button variant="primary" onClick={handleSend} disabled={!mailTo || sending}>
                    {sending ? "발송 중..." : "이메일 발송"}
                  </Button>
                </div>

                {sendMsg && (
                  <p
                    className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                      sendMsg.ok
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {sendMsg.text}
                  </p>
                )}
              </div>

              <LegalNotice tone="warn" title="도달 증명이 필요한 경우">
                전자우편과 문자는 <b>도달 사실을 증명하는 수단이 아닙니다.</b> 임대인이 응답하지
                않거나, 이미 퇴거·실거주 통보를 받았거나, 마감이 임박한 경우에는 우체국{" "}
                <b>내용증명 + 배달증명</b> 우편이 이용됩니다. 내용증명은 ‘무엇을 보냈는지’를,
                배달증명은 ‘언제 도달했는지’를 증명합니다.{" "}
                <a
                  href="https://service.epost.go.kr/postal/front/econprf/pafay02b01.jsp"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  인터넷우체국 내용증명 안내 →
                </a>
              </LegalNotice>
            </div>
          </Card>
        )}

        {/* 여기부터는 사람 */}
        <Card className="bg-slate-50/70">
          <h2 className="text-sm font-bold text-slate-900">
            다음과 같은 경우에는 자격 있는 전문가와 상의하시기 바랍니다
          </h2>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
            <li>· 임대인이 실거주를 이유로 갱신을 거절한 이후의 대응</li>
            <li>· 과거 갱신이 ‘갱신요구권 행사’였는지 다툼이 있는 경우</li>
            <li>· 상속 미등기·신탁 등기·공유자 다수 등으로 임대인 특정이 어려운 경우</li>
            <li>· 보증금 반환 관련 분쟁 (임차권등기명령 등 — 본 서비스의 범위 밖입니다)</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            주택임대차분쟁조정위원회, 대한법률구조공단 등 공적 기관을 이용할 수 있습니다.
          </p>
        </Card>
      </div>

      {/* ── 통지서 미리보기 / 인쇄 대상 */}
      {canBuild && (
        <div className="mt-6 print:mt-0">
          <p className="mb-2 text-sm font-semibold text-slate-500 print:hidden">통지서 미리보기</p>
          <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-8 text-[13px] leading-[1.9] text-slate-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
            {noticeText}
          </pre>
        </div>
      )}
    </>
  );
}

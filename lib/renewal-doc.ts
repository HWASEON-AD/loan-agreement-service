// 서식 문서 구조 모델 — 화면 미리보기·인쇄·PDF가 전부 이 하나를 렌더링한다.
//
// ★ 왜 구조체인가
//   예전에는 통지서를 하나의 긴 문자열로 만들어 <pre> 와 PDF 에 그대로 흘렸다.
//   그러면 표(당사자·계약 표시)를 공백으로 흉내내야 해서, 글자 수가 조금만 달라져도
//   칸이 밀려 서식이 깨진다. 실제 쓰는 서식은 표 기반이므로 구조를 그대로 들고 있다가
//   렌더러(HTML/PDF)가 각자 표로 그린다. 이러면 어느 쪽에서도 칸이 밀리지 않는다.
//
// ★ 이 파일은 순수 변환만 한다. LLM 호출 0회, 입력값을 고정 서식에 그대로 배치할 뿐이다.

import { calcRenewedEndDate, formatDotDate, isValidDate } from "./renewal-calc";
import type { RenewalNotice } from "./renewal-text";

// ---------------------------------------------------------------------------
// 구조
// ---------------------------------------------------------------------------

export type DocCell = {
  text: string;
  align?: "left" | "center";
  bold?: boolean;
  /** 라벨 칸 회색 배경 */
  fill?: boolean;
};

/** 표 블록 — colRatios 는 표 전체 폭을 1로 본 비율 (합이 1이어야 한다) */
export type DocTableBlock = {
  kind: "table";
  heading: string;
  colRatios: number[];
  rows: DocCell[][];
};

/** 본문 블록 — 테두리 상자 안에 문단을 넣는다 */
export type DocBodyBlock = {
  kind: "body";
  heading: string;
  /** 문단 → 줄 배열 */
  paragraphs: string[][];
};

/**
 * 참고 블록 — 테두리 없이 작은 글씨.
 * ★ 여기에는 반드시 **주어가 법령·해설인 문장만** 넣는다.
 *   "귀하는 ~할 수 있습니다" 처럼 이용자를 주어로 삼는 순간 개별 사안에 대한 결론이 된다.
 */
export type DocNoteBlock = {
  kind: "note";
  heading: string;
  paragraphs: string[][];
};

export type DocBlock = DocTableBlock | DocBodyBlock | DocNoteBlock;

export type DocSignature = { label: string; name: string };

/** 서식 한 장 */
export type FormDoc = {
  /** 문서 제목 (자간을 벌려 가운데 정렬로 그린다) */
  title: string;
  blocks: DocBlock[];
  /** 작성일 — "2026 년 8 월 14 일" */
  dateText: string;
  /** 서명란 (확인서는 임대인·임차인 2줄) */
  signatures: DocSignature[];
};

/** 서식 종류 */
export type DocKind = "notice" | "confirm";

// ---------------------------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------------------------

function formatMoney(num: number): string {
  return `금 ${(num ?? 0).toLocaleString("ko-KR")} 원`;
}

/** YYYY-MM-DD → "2026 년 8 월 14 일" (서식지의 날짜 표기) */
export function formatSignatureDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return `${Number(m[1])} 년  ${Number(m[2])} 월  ${Number(m[3])} 일`;
}

/** 블록 제목에 붙는 번호 — note 블록은 번호를 매기지 않는다 */
export function numberedHeadings(blocks: DocBlock[]): string[] {
  let no = 0;
  return blocks.map((b) => {
    if (b.kind === "note") return b.heading;
    no += 1;
    return `${no}. ${b.heading}`;
  });
}

/** 당사자 표 (4열: 라벨/값/라벨/값) — 통지서·확인서가 공유한다 */
function partyTable(
  heading: string,
  left: { label: string; name: string; address: string; phone: string },
  right: { label: string; name: string; address: string; phone: string }
): DocTableBlock {
  const L = (t: string): DocCell => ({ text: t, align: "center", bold: true, fill: true });
  return {
    kind: "table",
    heading,
    colRatios: [0.17, 0.33, 0.17, 0.33],
    rows: [
      [L(left.label), { text: left.name }, L(right.label), { text: right.name }],
      [L("주   소"), { text: left.address }, L("주   소"), { text: right.address }],
      [L("연 락 처"), { text: left.phone }, L("연 락 처"), { text: right.phone }],
    ],
  };
}

/**
 * 임차주택 및 임대차계약의 표시 (2열).
 *
 * `withTerms = false` 이면 주소만 넣는다 — 확인서는 뒤에 오는 '갱신 내용' 표가
 * 기존/갱신 조건을 나란히 보여주므로, 여기서 같은 값을 또 적으면 표가 중복되고
 * A4 한 장을 넘겨 서식이 두 장으로 쪼개진다.
 */
function propertyTable(n: RenewalNotice, withTerms = true): DocTableBlock {
  const rows: DocCell[][] = [
    [
      { text: "임차주택의 표시", align: "center", bold: true, fill: true },
      { text: n.propertyAddress },
    ],
  ];
  if (!withTerms) {
    return { kind: "table", heading: "임차주택의 표시", colRatios: [0.24, 0.76], rows };
  }
  rows.push(
    [
      { text: "임 대 차 기 간", align: "center", bold: true, fill: true },
      { text: `${formatDotDate(n.startDate)}  ~  ${formatDotDate(n.endDate)}` },
    ],
    [
      { text: "보 증 금", align: "center", bold: true, fill: true },
      { text: formatMoney(n.deposit) },
    ]
  );
  // 전세면 '월 차임' 칸 자체를 넣지 않는다. 빈 칸을 남기면 "0원"으로 오해된다.
  if (n.hasMonthlyRent) {
    rows.push([
      { text: "월 차 임", align: "center", bold: true, fill: true },
      { text: formatMoney(n.monthlyRent ?? 0) },
    ]);
  }
  return {
    kind: "table",
    heading: "임차주택 및 임대차계약의 표시",
    colRatios: [0.24, 0.76],
    rows,
  };
}

// ---------------------------------------------------------------------------
// ① 계약갱신 요구 통지서 (임차인 → 임대인)
// ---------------------------------------------------------------------------

/**
 * 통지 본문 문단.
 *
 * ★ 톤 원칙 (변경 금지)
 *   - 경고성 문구("법적 조치"·"손해배상") 금지. 공격적이면 임대인이 실거주 거절 카드를 꺼낸다.
 *   - 그러나 "주택임대차보호법 제6조의3에 따라 위 임대차계약의 갱신을 요구합니다" 이 한 문장은
 *     어떤 톤에서도 빠지면 안 된다. "계속 살고 싶습니다" 수준으로 쓰면 나중에
 *     "희망사항이었지 권리행사가 아니었다"는 다툼이 실제로 난다.
 */
export function buildBodyParagraphs(n: RenewalNotice): string[][] {
  const conditionPara =
    n.condition === "negotiate"
      ? [
          "갱신되는 임대차의 존속기간은 같은 법 제6조의3 제2항에 따라 2년이며,",
          "차임 및 보증금에 관하여는 같은 조 제3항이 정한 범위에서 협의를 희망합니다.",
          "조건에 관한 협의 여부와 관계없이 위 갱신 요구의 의사는 변함이 없습니다.",
        ]
      : [
          "갱신되는 임대차의 존속기간은 같은 법 제6조의3 제2항에 따라 2년이며,",
          "임대차의 조건은 종전과 동일한 조건으로 갱신되기를 요청드립니다.",
        ];

  return [
    ["안녕하십니까. 그동안 임대차계약과 관련하여 배려해 주신 점 감사드립니다."],
    [
      "본인은 위 임차주택의 임차인으로서, 주택임대차보호법 제6조의3에 따라",
      "위 임대차계약의 갱신을 요구합니다.",
    ],
    conditionPara,
    ["협의가 필요하신 사항이 있으시면 위 연락처로 연락 주시기 바랍니다."],
  ];
}

/** 계약갱신 요구 통지서 */
export function buildNoticeDoc(n: RenewalNotice): FormDoc {
  return {
    title: "계약갱신 요구 통지서",
    blocks: [
      partyTable(
        "당사자",
        {
          label: "발신인\n(임차인)",
          name: n.tenantName,
          address: n.tenantAddress || n.propertyAddress,
          phone: n.tenantPhone ?? "",
        },
        {
          label: "수신인\n(임대인)",
          name: n.landlordName,
          address: n.landlordAddress ?? "",
          phone: n.landlordPhone ?? "",
        }
      ),
      propertyTable(n),
      { kind: "body", heading: "통지의 내용", paragraphs: buildBodyParagraphs(n) },
    ],
    dateText: formatSignatureDate(n.noticeDate),
    signatures: [{ label: "발신인(임차인)", name: n.tenantName }],
  };
}

// ---------------------------------------------------------------------------
// ② 주택임대차계약 갱신 확인서 (임대인 · 임차인 공용, 양 당사자 서명)
// ---------------------------------------------------------------------------
//
// ★★ 이 서식의 설계 원리 — 법률검토(Fable) 결과. 함부로 바꾸지 말 것.
//
//  왜 "임대인용 통지서"가 아니라 "양 당사자 확인서"인가:
//   1) 제6조의3의 계약갱신요구권은 **임차인의 형성권**이다. 임대인에게는 '갱신을 요구할'
//      권리 자체가 없으므로, 임대인 명의로 "제6조의3에 따라 갱신을 요구합니다"라고 쓰면
//      법적으로 무의미한 의사표시가 되고, 오히려 "작성자가 법률관계를 이해하지 못한 문서"로
//      취급되어 문서 전체의 신빙성이 깎인다. (= 입장만 뒤집은 서식은 만들면 안 된다)
//   2) 임대인 단독 통지는 처분문서가 아니라 자기에게 유리한 진술일 뿐이라,
//      "2년 뒤 '그건 그냥 합의 재계약이었다'는 주장" 을 실제로 막지 못한다.
//      **양 당사자가 서명한 확인서라야** 그 다툼이 봉쇄된다.
//   3) 🚨 문장은 반드시 **과거 사실의 확인**이어야 하고 **간주 합의**여서는 안 된다.
//      임차인의 갱신요구가 실제로 없었는데 "이번 갱신을 갱신요구권 행사로 본다"는 문서에
//      서명을 받으면, 임차인의 장래 갱신요구권을 상실시키는 불리한 약정이 되어
//      법 제10조(편면적 강행규정)로 무효가 될 소지가 있다.
//
//  🚫 넣지 말 것:
//   - "이로써 임차인의 계약갱신요구권은 소진되었습니다" 를 **서비스가 자동 삽입**하는 것.
//     소진 여부는 법에서 나오는 효과이고 그 발생 여부는 개별 포섭이다. 서비스가 쓰면
//     "귀하의 계약에서 권리가 소멸했다"는 결론을 서비스가 말한 것이 된다.
//     애초에 불필요하다 — 행사일 기재 + "제6조의3에 따른 갱신임을 상호 확인" 이면
//     소진 효과는 법에서 자동으로 따라온다.
//   - "임차인은 서명하여야 합니다" / "서명하지 않으면 인정되지 않습니다" (의무·효과 단정)
//   - 행사일이 기간 내인지에 대한 유효/무효 판정, 5% 증액 적법 여부 판정

/** 갱신 확인서 본문 — 과거 사실 진술 + 상호 확인 구조 (간주 합의 금지) */
export function buildConfirmParagraphs(n: RenewalNotice): string[][] {
  const requestDate = n.renewalRequestDate ? formatDotDate(n.renewalRequestDate) : "";
  return [
    // 🚨🚨 이 문장을 빼지 말 것.
    //   화면의 경고("없었던 것을 있었던 것으로 적는 용도가 아님")는 **작성자만** 본다.
    //   서명하는 상대방은 종이 한 장만 보므로, 문서 자체가 자기 용도를 밝혀야 한다.
    //   주어가 '이 확인서'라 개별 사안 판정이 아니다(안전선 안).
    [
      "이 확인서는 실제로 있었던 계약갱신 요구를 기록하기 위한 것이며,",
      "그러한 요구가 없었던 경우에 이를 있었던 것으로 정하기 위한 것이 아닙니다.",
    ],
    [
      // 🚨 "제6조의3 제1항에 **따른**" 이라고 쓰지 말 것.
      //   그 표현은 "기간 내에, 소진되지 않은 권리로, 적법하게 행사되었다"는 **법적 성질결정**을
      //   함축한다. 서비스는 그 어느 것도 검증하지 않으며, 약관 제7조⑤도 "그러한 취지의 문구를
      //   자동 삽입하지 않는다"고 선언하고 있다. 문구와 약관 중 하나가 거짓이 되면 안 된다.
      //   → 조문 인용을 빼고 '있었던 사실'만 적는다.
      `임차인은 ${requestDate} 임대인에게 위 주택임대차계약에 관하여`,
      "계약갱신 요구의 의사를 표시하였습니다.",
    ],
    [
      "임대인과 임차인은 위 임대차계약이 임차인의 위 계약갱신 요구에 따라",
      "갱신되었음을 상호 확인합니다.",
    ],
    ["갱신되는 임대차의 기간 및 조건은 위 '갱신 계약'란에 적은 바와 같습니다."],
  ];
}

/**
 * 확인서에 붙는 참고 정보 — 주어가 전부 법령·해설이어야 한다.
 *
 * 🚨🚨 이 목록에서 항목을 빼지 말 것. 특히 해지권(제4항)과 증액 상한(제3항).
 *   이 확인서는 "이번 갱신은 제6조의3에 따른 갱신"이라고 성격을 규정하는 문서다.
 *   그 성격이 붙는 순간 임차인에게는 **중도 해지권**이, 임대인에게는 **증액 5% 상한**이 따라온다.
 *   존속기간 2년만 인쇄하고 해지권을 빼면, 나중에 임대인이 이 확인서를 들고
 *   "2년이라고 서명했잖아"라며 임차인의 중도해지를 다투는 근거로 쓰인다.
 *   → 서명하는 사람이 서명 직전에 양쪽 효과를 모두 보게 한다.
 *
 * ★ 개별 사안 판정이 아니라 **조문의 정적 인용**이다. 이 둘은 다르다.
 *   "귀하의 요구일은 기간 안입니다"(판정, 금지) / "법이 정한 기간은 6~2개월 전입니다"(정보, 허용)
 */
/**
 * 참고란에 박는 법령 기준 시점 표기.
 *
 * 🚨 왜 시점을 박나 — 화면은 고치면 끝이지만 **인쇄된 종이는 회수할 수 없다.**
 *   나중에 법이 개정되면, 시점이 없는 문서는 "틀린 법률정보"가 되고 그 책임 소재가 흐려진다.
 *   시행일·법률번호를 함께 적으면 "그 시점의 법령을 옮긴 것"으로 고정되어,
 *   개정 이후에도 문서 자체가 스스로 기준 시점을 밝힌다.
 *   값은 매일 1회 법제처를 확인하는 크론이 갱신한다(`lib/law-watch.ts`).
 */
export function buildLawLabel(
  effectiveDate?: string | null,
  lawNumber?: string | null
): string | undefined {
  if (!effectiveDate) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  const d = m ? `${Number(m[1])}. ${Number(m[2])}. ${Number(m[3])}.` : effectiveDate;
  return lawNumber
    ? `주택임대차보호법 [시행 ${d}] [법률 ${lawNumber}]`
    : `주택임대차보호법 [시행 ${d}]`;
}

export function buildConfirmNotes(lawLabel?: string): string[][] {
  // ★ 줄바꿈을 직접 넣지 않는다. 렌더러가 지면 폭에 맞춰 흘리게 두어야
  //   항목이 늘어도 줄 수가 최소로 유지되고 A4 한 장을 지킬 수 있다.
  return [
    [
      "주택임대차보호법 제6조의3 제2항 : 임차인은 계약갱신요구권을 1회에 한하여 행사할 수 있고, 갱신되는 임대차의 존속기간은 2년으로 봅니다.",
    ],
    [
      "같은 조 제1항 본문 및 제6조 제1항 전단 : 계약갱신의 요구는 임대차기간이 끝나기 6개월 전부터 2개월 전까지의 기간에 하는 것으로 정해져 있습니다.",
    ],
    [
      "같은 조 제4항 및 이에 따라 준용되는 제6조의2 : 임차인은 갱신된 임대차에 대하여 언제든지 임대인에게 계약해지를 통지할 수 있고, 임대인이 그 통지를 받은 날부터 3개월이 지나면 해지의 효력이 발생합니다.",
    ],
    [
      "같은 조 제3항 및 제7조 제2항 본문 : 갱신되는 임대차의 차임과 보증금의 증액청구는 약정한 차임·보증금의 20분의 1의 금액을 초과하지 못합니다. 다만 같은 항 단서는 시·도가 조례로 상한을 달리 정할 수 있도록 하고 있습니다.",
    ],
    [
      "제7조 제1항 후단 : 증액청구는 임대차계약 또는 약정한 차임·보증금의 증액이 있은 후 1년 이내에는 하지 못합니다.",
    ],
    [
      "국토교통부·법무부 「개정 주택임대차보호법 해설집」은 같은 법 제6조에 따른 묵시적 갱신은 계약갱신요구권의 행사로 보지 않는다는 입장입니다.",
    ],
    [
      lawLabel
        ? `${lawLabel} 기준으로 옮겨 적은 것입니다. 조문 전문은 국가법령정보센터(law.go.kr).`
        : "조문을 옮겨 적은 것입니다. 조문 전문은 국가법령정보센터(law.go.kr).",
    ],
  ];
}

/** 갱신 내용 표 (3열: 구분 / 기존 계약 / 갱신 계약) */
function renewalTermsTable(n: RenewalNotice): DocTableBlock {
  const H = (t: string): DocCell => ({ text: t, align: "center", bold: true, fill: true });
  const L = (t: string): DocCell => ({ text: t, align: "center", bold: true, fill: true });

  const newStart = n.renewedStartDate || n.endDate;
  const newEnd = n.renewedEndDate || calcRenewedEndDate(newStart);

  const rows: DocCell[][] = [
    [H("구   분"), H("기존 계약"), H("갱신 계약")],
    [
      L("임대차기간"),
      { text: `${formatDotDate(n.startDate)} ~ ${formatDotDate(n.endDate)}`, align: "center" },
      { text: `${formatDotDate(newStart)} ~ ${formatDotDate(newEnd)}`, align: "center" },
    ],
    [
      L("보 증 금"),
      { text: formatMoney(n.deposit), align: "center" },
      { text: formatMoney(n.renewedDeposit ?? n.deposit), align: "center" },
    ],
  ];
  if (n.hasMonthlyRent) {
    rows.push([
      L("월 차 임"),
      { text: formatMoney(n.monthlyRent ?? 0), align: "center" },
      { text: formatMoney(n.renewedMonthlyRent ?? n.monthlyRent ?? 0), align: "center" },
    ]);
  }

  return {
    kind: "table",
    heading: "임대차계약의 내용 및 갱신 내용",
    colRatios: [0.24, 0.38, 0.38],
    rows,
  };
}

/** 주택임대차계약 갱신 확인서 */
export function buildConfirmDoc(n: RenewalNotice, lawLabel?: string): FormDoc {
  return {
    title: "주택임대차계약 갱신 확인서",
    blocks: [
      partyTable(
        "당사자",
        {
          label: "임 대 인",
          name: n.landlordName,
          address: n.landlordAddress ?? "",
          phone: n.landlordPhone ?? "",
        },
        {
          label: "임 차 인",
          name: n.tenantName,
          address: n.tenantAddress || n.propertyAddress,
          phone: n.tenantPhone ?? "",
        }
      ),
      propertyTable(n, false),
      renewalTermsTable(n),
      { kind: "body", heading: "확인 사항", paragraphs: buildConfirmParagraphs(n) },
      {
        kind: "note",
        // 🚨 "당사자가 합의한 내용이 아님"을 반드시 밝힌다.
        //   이 문구가 없으면 참고란의 조문이 합의 조항으로 오해될 수 있고,
        //   그러면 우리가 당사자 대신 계약 내용을 넣은 셈이 된다.
        heading: "참고 — 아래는 관련 법령의 내용이며, 당사자가 합의한 내용이 아닙니다",
        paragraphs: buildConfirmNotes(lawLabel),
      },
    ],
    dateText: formatSignatureDate(n.noticeDate),
    signatures: [
      { label: "임 대 인", name: n.landlordName },
      { label: "임 차 인", name: n.tenantName },
    ],
  };
}

/** 종류에 따라 서식을 만든다 */
export function buildFormDoc(kind: DocKind, n: RenewalNotice, lawLabel?: string): FormDoc {
  return kind === "confirm" ? buildConfirmDoc(n, lawLabel) : buildNoticeDoc(n);
}

/** 다운로드·메일 제목에 쓰는 문서명 */
export function docTitleOf(kind: DocKind): string {
  return kind === "confirm" ? "주택임대차계약 갱신 확인서" : "계약갱신 요구 통지서";
}

// ---------------------------------------------------------------------------
// 서버측 검증
// ---------------------------------------------------------------------------
//
// 🚨 왜 서버가 구조를 검증해야 하나
//   PDF·이메일 라우트는 무인증 공개 엔드포인트다. 예전에는 클라이언트가 만든
//   **완성된 문자열**을 그대로 받아 메일로 내보냈는데, 그러면 naejimayo.com 발신으로
//   임의 제목·임의 본문을 아무에게나 보낼 수 있는 **발송기**가 된다(피싱 악용).
//   → 서버는 '구조'만 받고 문장은 서버가 조립한다. 이용자 입력은 칸 안의 값으로만 들어간다.

/**
 * 칸별 최대 길이 — 서식의 칸이지 자유 게시판이 아니다.
 *
 * 🚨 전부 200자로 두면 안 된다. 당사자 표의 값 칸 폭은 약 145pt 라
 *   9.5pt 한글 기준 한 줄 15자 남짓이다. 주소에 200자를 넣으면 한 칸이 13~14줄이 되어
 *   **확인서가 A4 한 장을 넘기고 둘째 장에 서명란만 남는다.**
 *   길이를 의미에 맞게 줄이는 것이 레이아웃 방어인 동시에, 서식 칸을 메시지 게시판으로
 *   쓰는 발송 악용에 대한 방어이기도 하다.
 */
const FIELD_LIMITS: Record<string, number> = {
  propertyAddress: 100,
  tenantName: 30,
  tenantPhone: 20,
  tenantAddress: 100,
  landlordName: 30,
  landlordPhone: 20,
  landlordAddress: 100,
};
const MAX_FIELD_LEN = 100;

/**
 * 서식 칸에 들어갈 수 있는 값인가.
 *
 * 🚨 URL 을 막는 이유: 임대차 서식의 성명·주소·연락처 칸에 링크가 들어갈 일은 없다.
 *   반대로 링크를 허용하면 "우리 도메인에서 발송되는 메일에 임의 링크를 심는" 통로가 남는다.
 *   제어문자도 막는다(헤더 인젝션·본문 조작 방지).
 */
function okField(v: unknown, limit = MAX_FIELD_LEN): boolean {
  if (typeof v !== "string") return false;
  if (v.length > limit) return false;
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  if (/https?:\/\/|www\.|<\s*a[\s>]/i.test(v)) return false;
  return true;
}

// 🚨 정규식만 보면 2026-02-31 같은 실재하지 않는 날짜가 통과한다.
//   달력상 실재 여부까지 확인한다(isValidDate).
function okDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  if (v === "") return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && isValidDate(v);
}

function okMoney(v: unknown): boolean {
  return v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e15);
}

/**
 * 서식 입력값 검증.
 *
 * 🚨🚨 서버는 **값만** 받고 문장은 서버가 만든다(`buildFormDoc`).
 *   완성된 문서 구조(FormDoc)를 그대로 받으면, 공격자가 껍데기를 흉내내
 *   본문 문단에 임의 문구를 넣어 우리 도메인으로 발송할 수 있다.
 *   실제로 그 구멍을 확인하고 이 구조로 바꿨다. 되돌리지 말 것.
 */
export function isRenewalInput(v: unknown): v is RenewalNotice {
  if (!v || typeof v !== "object") return false;
  const n = v as Record<string, unknown>;

  const texts = [
    "propertyAddress", "tenantName", "tenantPhone", "tenantAddress",
    "landlordName", "landlordAddress", "landlordPhone",
  ];
  for (const k of texts) {
    if (n[k] === undefined) continue;
    if (!okField(n[k], FIELD_LIMITS[k])) return false;
  }
  // 필수 칸은 비어 있으면 안 된다. 화면에서 막고 있지만 API 는 직접 호출될 수 있고,
  // 성명이 빈 확인서가 만들어지면 그 자체로 분쟁의 소지가 된다.
  const required: [unknown, number][] = [
    [n.propertyAddress, FIELD_LIMITS.propertyAddress],
    [n.tenantName, FIELD_LIMITS.tenantName],
    [n.landlordName, FIELD_LIMITS.landlordName],
  ];
  for (const [v, limit] of required) {
    if (!okField(v, limit) || (v as string).trim() === "") return false;
  }

  const dates = [
    "startDate", "endDate", "noticeDate",
    "renewalRequestDate", "renewedStartDate", "renewedEndDate",
  ];
  for (const k of dates) {
    if (n[k] === undefined) continue;
    if (!okDate(n[k])) return false;
  }
  for (const v of [n.startDate, n.endDate, n.noticeDate]) {
    if (!okDate(v) || v === "") return false;
  }
  // 🚨 논리적으로 불가능한 날짜는 막는다. 이건 '법적 판정'이 아니라 산술이다.
  //   ① 만료일이 시작일보다 앞설 수 없다
  //   ② 확인서의 '계약갱신 요구일'은 **이미 있었던 사실**이므로 미래일 수 없다
  //     (미래 날짜가 통과하면 문서가 스스로 불능인 사실을 증명하게 된다)
  if ((n.endDate as string) < (n.startDate as string)) return false;
  if (n.renewalRequestDate) {
    if ((n.renewalRequestDate as string) > (n.noticeDate as string)) return false;
  }

  if (typeof n.hasMonthlyRent !== "boolean") return false;
  if (typeof n.deposit !== "number" || !Number.isFinite(n.deposit) || n.deposit < 0) return false;
  for (const k of ["monthlyRent", "renewedDeposit", "renewedMonthlyRent"]) {
    if (!okMoney(n[k])) return false;
  }
  if (n.condition !== "same" && n.condition !== "negotiate") return false;

  return true;
}

/**
 * 확인서 전용 필수값 검증.
 * 🚨 갱신 요구일은 이 서식의 존재 이유다. 비어 있으면 본문이
 *   "임차인은 (빈칸) 임대인에게 … 의사를 표시하였습니다" 가 되어 문서가 무의미해진다.
 */
export function isConfirmInput(n: RenewalNotice): boolean {
  if (!n.renewalRequestDate || !isValidDate(n.renewalRequestDate)) return false;
  if (!n.renewedStartDate || !isValidDate(n.renewedStartDate)) return false;
  if (!n.renewedEndDate || !isValidDate(n.renewedEndDate)) return false;
  if (n.renewedEndDate < n.renewedStartDate) return false;
  return true;
}

/** 서식 종류 검증 */
export function isDocKind(v: unknown): v is DocKind {
  return v === "notice" || v === "confirm";
}

function okText(v: unknown): boolean {
  return typeof v === "string" && v.length <= 400;
}

/** 렌더러가 기대하는 모양인지 검증한다 (값 자체는 이용자 입력 그대로 둔다) */
export function isFormDoc(v: unknown): v is FormDoc {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  if (!okText(d.title) || !d.title) return false;
  if (!okText(d.dateText)) return false;
  if (!Array.isArray(d.blocks) || d.blocks.length === 0 || d.blocks.length > 12) return false;
  if (!Array.isArray(d.signatures) || d.signatures.length > 4) return false;

  for (const s of d.signatures as Record<string, unknown>[]) {
    if (!s || !okText(s.label) || !okText(s.name)) return false;
  }

  for (const b of d.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== "object" || !okText(b.heading)) return false;

    if (b.kind === "table") {
      if (!Array.isArray(b.colRatios) || !Array.isArray(b.rows)) return false;
      if (b.rows.length > 30) return false;
      for (const row of b.rows as unknown[]) {
        if (!Array.isArray(row) || row.length > 6) return false;
        for (const cell of row as Record<string, unknown>[]) {
          if (!cell || !okText(cell.text)) return false;
        }
      }
      continue;
    }

    if (b.kind === "body" || b.kind === "note") {
      if (!Array.isArray(b.paragraphs) || b.paragraphs.length > 20) return false;
      for (const para of b.paragraphs as unknown[]) {
        if (!Array.isArray(para) || para.length > 20) return false;
        for (const line of para) if (!okText(line)) return false;
      }
      continue;
    }

    return false;
  }
  return true;
}

/**
 * 메일 제목 — 서버가 문서에서 뽑아 만든다.
 * ★ 클라이언트가 준 제목 문자열을 그대로 쓰면 임의 제목 발송기가 된다.
 */
export function buildSubjectFromDoc(doc: FormDoc): string {
  const table = doc.blocks.find(
    (b): b is DocTableBlock => b.kind === "table" && b.heading.includes("임차주택")
  );
  const address = table?.rows[0]?.[1]?.text?.trim();
  return address ? `[${doc.title}] ${address}` : `[${doc.title}]`;
}

// ---------------------------------------------------------------------------
// 평문 렌더러 (이메일 본문용)
// ---------------------------------------------------------------------------
//
// 이메일은 표를 그릴 수 없으므로 "라벨 : 값" 목록으로 편다.
// ★ 표를 공백으로 흉내내지 않는다 — 수신자의 글꼴에 따라 반드시 어긋나기 때문이다.

/**
 * 라벨을 평문용으로 정리한다.
 * 서식지의 라벨은 칸 폭을 맞추려고 자간을 벌려 둔다("임 대 인", "주   소").
 * 표에서는 그게 맞지만 평문 목록에서는 어색하므로, 한 글자씩 떨어진 라벨만 붙여 준다.
 * ("기존 계약" 처럼 두 글자 이상 낱말로 이루어진 것은 건드리지 않는다)
 */
const flat = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  const parts = t.split(" ");
  return parts.length > 1 && parts.every((p) => [...p].length === 1) ? parts.join("") : t;
};

/**
 * 표 한 개를 평문 줄로 편다.
 *
 * 🚨 단순히 "1열 : 2열" 로 펴면 안 된다. 당사자 표는 좌우 2인이 같은 라벨("주 소")을 쓰기 때문에
 *   목록으로 펴는 순간 **어느 주소가 임대인 것인지 알 수 없게 된다.**
 *   → 당사자 표(4열)는 사람별로 묶고, 라벨 앞에 그 사람의 역할을 붙인다.
 *   → 머리행이 있는 대조표(3열)는 머리행을 값 앞에 괄호로 붙여 어느 쪽 값인지 남긴다.
 */
function tableAsTextLines(rows: DocCell[][]): string[] {
  const out: string[] = [];
  if (rows.length === 0) return out;

  // ── 당사자 표: [라벨][값][라벨][값] — 사람별로 묶는다
  if (rows[0].length === 4) {
    const roleOf = (i: number) => flat(rows[0][i].text); // "발신인 (임차인)" / "임 대 인"
    [0, 2].forEach((col, idx) => {
      if (idx > 0) out.push("");
      const role = roleOf(col);
      out.push(`  - ${role} : ${rows[0][col + 1].text}`);
      rows.slice(1).forEach((cells) => {
        const label = flat(cells[col].text);
        const value = cells[col + 1].text;
        if (value) out.push(`  - ${role} ${label} : ${value}`);
      });
    });
    return out;
  }

  // ── 머리행이 있는 대조표: 첫 행의 칸이 전부 라벨칸(회색)이면 머리행으로 본다
  const hasHeader = rows[0].length >= 3 && rows[0].every((c) => c.fill);
  if (hasHeader) {
    const heads = rows[0].slice(1).map((c) => flat(c.text));
    rows.slice(1).forEach((cells) => {
      const values = cells
        .slice(1)
        .map((c, i) => `(${heads[i]}) ${flat(c.text)}`)
        .join("   →   ");
      out.push(`  - ${flat(cells[0].text)} : ${values}`);
    });
    return out;
  }

  // ── 그 밖: "라벨 : 값"
  rows.forEach((cells) => {
    out.push(`  - ${flat(cells[0].text)} : ${cells[1]?.text ?? ""}`);
  });
  return out;
}

/** FormDoc → 평문 (이메일 본문) */
export function renderDocAsText(doc: FormDoc): string {
  const out: string[] = [doc.title, ""];
  const headings = numberedHeadings(doc.blocks);

  doc.blocks.forEach((block, bi) => {
    out.push("", headings[bi], "");

    if (block.kind === "table") {
      out.push(...tableAsTextLines(block.rows));
      return;
    }

    block.paragraphs.forEach((para, pi) => {
      if (pi > 0) out.push("");
      para.forEach((line) => out.push(`  ${line}`));
    });
  });

  out.push("", "", `  ${doc.dateText}`, "");
  doc.signatures.forEach((s) => out.push("", `  ${s.label}   ${s.name}   (서명 또는 날인)`));
  return out.join("\n");
}

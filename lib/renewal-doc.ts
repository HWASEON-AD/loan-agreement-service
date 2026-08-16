// 서식 문서 구조 모델 — 화면 미리보기·인쇄·PDF가 전부 이 하나를 렌더링한다.
//
// ★ 왜 구조체인가
//   예전에는 통지서를 하나의 긴 문자열로 만들어 <pre> 와 PDF 에 그대로 흘렸다.
//   그러면 표(당사자·계약 표시)를 공백으로 흉내내야 해서, 글자 수가 조금만 달라져도
//   칸이 밀려 서식이 깨진다. 실제 쓰는 서식은 표 기반이므로 구조를 그대로 들고 있다가
//   렌더러(HTML/PDF)가 각자 표로 그린다. 이러면 어느 쪽에서도 칸이 밀리지 않는다.
//
// ★ 이 파일은 순수 변환만 한다. LLM 호출 0회, 입력값을 고정 서식에 그대로 배치할 뿐이다.

import { calcRenewedEndDate, formatDotDate } from "./renewal-calc";
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
    [
      `임차인은 ${requestDate} 임대인에게 위 주택임대차계약에 관하여`,
      "주택임대차보호법 제6조의3 제1항에 따른 계약갱신 요구의 의사를 표시하였습니다.",
    ],
    [
      "임대인과 임차인은 위 임대차계약이 임차인의 위 계약갱신 요구에 따라",
      "갱신되었음을 상호 확인합니다.",
    ],
    ["갱신되는 임대차의 기간 및 조건은 위 '갱신 계약'란에 적은 바와 같습니다."],
  ];
}

/** 확인서에 붙는 참고 정보 — 주어가 전부 법령·해설이어야 한다 */
export function buildConfirmNotes(): string[][] {
  return [
    [
      "주택임대차보호법 제6조의3 제2항 : 임차인은 계약갱신요구권을 1회에 한하여 행사할 수",
      "있으며, 갱신되는 임대차의 존속기간은 2년으로 봅니다.",
    ],
    [
      "국토교통부·법무부 「개정 주택임대차보호법 해설집」은 같은 법 제6조에 따른 묵시적",
      "갱신은 계약갱신요구권의 행사로 보지 않는다는 입장입니다.",
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
export function buildConfirmDoc(n: RenewalNotice): FormDoc {
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
      { kind: "note", heading: "참고", paragraphs: buildConfirmNotes() },
    ],
    dateText: formatSignatureDate(n.noticeDate),
    signatures: [
      { label: "임 대 인", name: n.landlordName },
      { label: "임 차 인", name: n.tenantName },
    ],
  };
}

/** 종류에 따라 서식을 만든다 */
export function buildFormDoc(kind: DocKind, n: RenewalNotice): FormDoc {
  return kind === "confirm" ? buildConfirmDoc(n) : buildNoticeDoc(n);
}

/** 다운로드·메일 제목에 쓰는 문서명 */
export function docTitleOf(kind: DocKind): string {
  return kind === "confirm" ? "주택임대차계약 갱신 확인서" : "계약갱신 요구 통지서";
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

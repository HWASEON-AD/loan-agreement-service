// 서식 미리보기 / 인쇄 렌더러 — PDF(`lib/renewal-pdf.ts`)와 같은 FormDoc 을 그린다.
//
// ★ 화면과 PDF가 같은 구조체를 그리므로 "미리보기와 다운로드가 다르게 나오는" 사고가 없다.
// ★ 표를 공백으로 흉내내지 않고 진짜 <table> 로 그린다. 값이 길어지면 칸이 늘어날 뿐
//   서식이 밀리지 않는다.

import { numberedHeadings, type DocCell, type FormDoc } from "@/lib/renewal-doc";

function Cell({ cell, isHeadCol }: { cell: DocCell; isHeadCol: boolean }) {
  const cls = [
    "border border-slate-300 px-2.5 py-2 align-middle text-[12px] leading-[1.55] text-slate-800",
    cell.fill ? "bg-slate-50" : "bg-white",
    cell.bold ? "font-semibold" : "",
    cell.align === "center" ? "text-center" : "text-left",
    // 주소처럼 긴 값이 표를 밀어내지 않도록 줄바꿈을 허용한다
    isHeadCol ? "whitespace-pre-line" : "break-words",
  ]
    .filter(Boolean)
    .join(" ");
  return <td className={cls}>{cell.text || " "}</td>;
}

export function FormDocument({ doc }: { doc: FormDoc }) {
  const headings = numberedHeadings(doc.blocks);

  return (
    <div className="doc-sheet mx-auto w-full bg-white px-9 py-10 text-slate-900 print:px-0 print:py-0">
      {/* 제목 */}
      <h1 className="text-center text-[22px] font-bold tracking-[0.32em] text-slate-900">
        {doc.title}
      </h1>
      <div className="mt-3 h-[2px] w-full bg-slate-900" />

      {/* 블록 */}
      {doc.blocks.map((block, bi) => (
        <section key={bi} className={block.kind === "note" ? "mt-6" : "mt-7"}>
          <h2
            className={
              block.kind === "note"
                ? "text-[12px] font-semibold text-slate-500"
                : "text-[13.5px] font-bold text-slate-900"
            }
          >
            {headings[bi]}
          </h2>

          {block.kind === "table" && (
            <table className="mt-2.5 w-full table-fixed border-collapse" style={{ marginLeft: 0 }}>
              <colgroup>
                {block.colRatios.map((r, i) => (
                  <col key={i} style={{ width: `${r * 100}%` }} />
                ))}
              </colgroup>
              <tbody>
                {block.rows.map((cells, ri) => (
                  <tr key={ri}>
                    {cells.map((cell, ci) => (
                      <Cell key={ci} cell={cell} isHeadCol={Boolean(cell.fill)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {block.kind === "body" && (
            <div className="mt-2.5 rounded-[2px] border border-slate-300 px-4 py-4">
              {block.paragraphs.map((para, pi) => (
                <p
                  key={pi}
                  className={`text-[13px] leading-[1.75] text-slate-800 ${pi > 0 ? "mt-3.5" : ""}`}
                >
                  {para.map((line, li) => (
                    <span key={li} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}

          {/* 참고 블록의 들여쓰기는 본문 상자 '안쪽 글자'(px-4)와 같은 열에 맞춘다.
              테두리가 없다고 0으로 두면 참고 문단만 왼쪽으로 튀어나와 보인다. */}
          {block.kind === "note" && (
            <div className="mt-1.5 px-4">
              {block.paragraphs.map((para, pi) => (
                <p
                  key={pi}
                  className={`text-[11px] leading-[1.7] text-slate-500 ${pi > 0 ? "mt-1.5" : ""}`}
                >
                  {para.join(" ")}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* 작성일 */}
      <p className="mt-9 text-center text-[13.5px] tracking-[0.06em] text-slate-800">
        {doc.dateText}
      </p>

      {/* 서명란 */}
      <div className="mt-7 space-y-6">
        {doc.signatures.map((sig, i) => (
          <div key={i} className="flex items-end justify-end gap-3">
            <span className="text-[13px] font-bold text-slate-900">{sig.label}</span>
            <span className="min-w-[110px] border-b border-slate-800 pb-1 text-center text-[13px] text-slate-800">
              {sig.name || " "}
            </span>
            <span className="border-b border-slate-800 pb-1 text-[12px] text-slate-700">
              (서명 또는 날인)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

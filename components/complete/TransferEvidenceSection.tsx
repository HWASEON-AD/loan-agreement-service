"use client";

// 이체 확인증 업로드 섹션 (완료 페이지 하단)
// - JPG/PNG/PDF, 최대 10MB
// - 드래그앤드롭 또는 파일 선택
// - 이체 날짜 입력
// - 업로드 성공 시 안내 + 등록된 목록 표시
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { TransferEvidence } from "@/lib/types";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

// 업로드 주체 옵션
const UPLOADER_OPTIONS: { value: "lender" | "borrower"; label: string }[] = [
  { value: "lender", label: "대여자(빌려준 사람)" },
  { value: "borrower", label: "차용자(빌린 사람)" },
];

// 파일 크기 표기
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 날짜 표기 (YYYY-MM-DD)
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function TransferEvidenceSection({
  agreementId,
  token,
}: {
  agreementId: string;
  token: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [uploadedBy, setUploadedBy] = useState<"lender" | "borrower">("lender");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [list, setList] = useState<TransferEvidence[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // 기존 증빙 목록 로드
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(
        `/api/agreements/${agreementId}/transfer-evidence?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setList(data.evidences ?? []);
      }
    } catch {
      // 조회 실패 무시
    } finally {
      setLoadingList(false);
    }
  }, [agreementId, token]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // 파일 선택 검증
  const pickFile = (f: File | null) => {
    setError("");
    setMessage("");
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("JPG, PNG, PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("파일 크기는 최대 10MB까지 가능합니다.");
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  // 업로드 실행
  const upload = async () => {
    setError("");
    setMessage("");
    if (!file) {
      setError("파일을 첨부해주세요.");
      return;
    }
    if (!transferDate) {
      setError("이체 날짜를 입력해주세요.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("transferDate", transferDate);
      form.append("uploadedBy", uploadedBy);
      form.append("token", token);

      const res = await fetch(
        `/api/agreements/${agreementId}/transfer-evidence`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");

      setMessage("이체 증빙이 등록되었습니다.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-slate-900">이체 확인증 업로드</h3>
      <p className="mt-2 text-sm text-slate-500">
        실제 송금/입금이 이루어졌다면 이체 확인증(스크린샷·PDF)을 업로드해
        대여 사실의 증거를 보강하세요. JPG·PNG·PDF, 최대 10MB.
      </p>

      {/* 등록된 목록 */}
      {!loadingList && list.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            등록된 이체 증빙 ({list.length})
          </p>
          <ul className="space-y-1.5">
            {list.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-slate-700">
                  📎 {e.fileName}
                  <span className="ml-1 text-xs text-slate-400">
                    {formatSize(e.fileSize)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDate(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 업로드 폼 */}
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="이체 날짜"
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
          />
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              업로드 주체
            </label>
            <select
              value={uploadedBy}
              onChange={(e) =>
                setUploadedBy(e.target.value as "lender" | "borrower")
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {UPLOADER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 드래그앤드롭 영역 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-slate-300 bg-slate-50 hover:border-brand-300"
          }`}
        >
          <p className="text-sm text-slate-600">
            {file ? (
              <span className="font-medium text-brand-700">
                {file.name}{" "}
                <span className="text-xs text-slate-400">
                  ({formatSize(file.size)})
                </span>
              </span>
            ) : (
              <>
                파일을 끌어다 놓거나{" "}
                <span className="font-medium text-brand-700">클릭</span>하여
                선택
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-400">JPG · PNG · PDF (최대 10MB)</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        <Button fullWidth onClick={upload} disabled={uploading || !file}>
          {uploading ? "업로드 중..." : "이체 증빙 등록"}
        </Button>
      </div>
    </Card>
  );
}

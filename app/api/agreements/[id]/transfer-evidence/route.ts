// /api/agreements/[id]/transfer-evidence
// POST: 이체 확인증 업로드 (multipart/form-data)
//   - file, transferDate, uploadedBy(lender|borrower), token
//   - token 은 lenderSignToken 또는 borrowerSignToken 과 일치해야 함
//   - Supabase Storage(transfer-evidences) 업로드 후 transfer_evidences INSERT
//   - agreements.transfer_confirmed=true, transfer_date 갱신
// GET: 해당 약정서의 증빙 목록 조회 (token 검증)

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  createTransferEvidence,
  getTransferEvidences,
  updateAgreementTransferStatus,
  uploadTransferFile,
} from "@/lib/db";
import { uuid } from "@/lib/otp";
import type { TransferEvidence, TransferUploader } from "@/lib/types";

// 허용 파일 타입 / 최대 크기
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 토큰이 약정서의 대여자/차용자 서명 토큰과 일치하는지 검증
function verifyToken(
  token: string | null,
  lenderToken: string,
  borrowerToken: string
): TransferUploader | null {
  if (!token) return null;
  if (token === lenderToken) return "lender";
  if (token === borrowerToken) return "borrower";
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "파일 업로드 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const token = (form.get("token") as string) || null;
    const tokenRole = verifyToken(
      token,
      agreement.lenderSignToken,
      agreement.borrowerSignToken
    );
    if (!tokenRole) {
      return NextResponse.json(
        { error: "유효하지 않은 접근입니다." },
        { status: 403 }
      );
    }

    // uploadedBy 는 명시값 우선, 없으면 토큰 역할로 추론
    const uploadedByRaw = (form.get("uploadedBy") as string) || tokenRole;
    const uploadedBy: TransferUploader =
      uploadedByRaw === "borrower" ? "borrower" : "lender";

    const transferDate = (form.get("transferDate") as string) || null;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!transferDate || !datePattern.test(transferDate)) {
      return NextResponse.json(
        { error: "이체 날짜를 올바르게 입력해주세요. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "파일을 첨부해주세요." },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "JPG, PNG, PDF 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 최대 10MB까지 가능합니다." },
        { status: 400 }
      );
    }

    // 파일명 안전화 (경로/특수문자 제거)
    const safeName = file.name.replace(/[^\w.\-가-힣]/g, "_").slice(0, 120);
    const bytes = new Uint8Array(await file.arrayBuffer());

    const fileUrl = await uploadTransferFile(
      agreement.id,
      safeName,
      bytes,
      file.type
    );

    const evidence: TransferEvidence = {
      id: uuid(),
      agreementId: agreement.id,
      fileName: safeName,
      fileUrl,
      fileSize: file.size,
      uploadedBy,
      createdAt: new Date().toISOString(),
    };
    await createTransferEvidence(evidence);

    // 약정서 이체 확인 상태 갱신
    await updateAgreementTransferStatus(agreement.id, transferDate);

    return NextResponse.json({ success: true, fileUrl });
  } catch (err) {
    console.error("[transfer-evidence/POST] 실패:", err);
    return NextResponse.json(
      { error: "이체 증빙 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const tokenRole = verifyToken(
      token,
      agreement.lenderSignToken,
      agreement.borrowerSignToken
    );
    if (!tokenRole) {
      return NextResponse.json(
        { error: "유효하지 않은 접근입니다." },
        { status: 403 }
      );
    }

    const evidences = await getTransferEvidences(agreement.id);
    return NextResponse.json({
      evidences,
      transferConfirmed: agreement.transferConfirmed,
      transferDate: agreement.transferDate,
    });
  } catch (err) {
    console.error("[transfer-evidence/GET] 실패:", err);
    return NextResponse.json(
      { error: "이체 증빙 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

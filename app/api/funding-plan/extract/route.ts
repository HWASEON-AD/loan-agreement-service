// POST /api/funding-plan/extract — 자연어 스토리 → 자금 항목 JSON 추출
// 서버 사이드 전용 (ANTHROPIC_API_KEY 사용)

import { NextRequest, NextResponse } from "next/server";
import { isMockMode } from "@/lib/config";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  normalizeExtractResponse,
  MOCK_EXTRACT_RESULT_HOUSING,
  MOCK_EXTRACT_RESULT_LAND,
} from "@/lib/funding-prompts";
import type {
  FundingExtractRequest,
  FundingExtractResponse,
  FundingFormType,
} from "@/lib/funding-types";

// Node.js Runtime 필수 (fs/Anthropic SDK 사용)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 요청 본문 검증
function validateBody(body: unknown): {
  ok: boolean;
  data?: FundingExtractRequest;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "요청 본문이 비어있습니다." };
  }
  const b = body as Record<string, unknown>;
  const formType = b.formType;
  const tradeAmount = b.tradeAmount;
  const story = b.story;

  if (formType !== "housing" && formType !== "land") {
    return { ok: false, error: "formType은 'housing' 또는 'land'여야 합니다." };
  }
  if (typeof tradeAmount !== "number" || tradeAmount < 0) {
    return { ok: false, error: "tradeAmount는 0 이상의 숫자여야 합니다." };
  }
  if (typeof story !== "string" || story.trim().length < 10) {
    return { ok: false, error: "story는 최소 10자 이상이어야 합니다." };
  }
  if (story.length > 2000) {
    return { ok: false, error: "story는 최대 2000자까지 입력 가능합니다." };
  }
  return {
    ok: true,
    data: {
      formType: formType as FundingFormType,
      tradeAmount,
      story,
    },
  };
}

// Claude API 호출 + JSON 파싱 (재시도 1회 포함)
async function callClaude(
  formType: FundingFormType,
  tradeAmount: number,
  story: string
): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }

  // 동적 import (서버 사이드 전용 보장)
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const userPrompt = buildUserPrompt(formType, tradeAmount, story);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        },
        { timeout: 30_000 }
      );

      // 응답 텍스트 추출
      const textParts = response.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text);
      const fullText = textParts.join("").trim();

      // 코드블럭 제거 (만약 들어왔을 경우 대비)
      const jsonText = fullText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      // JSON 파싱
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (err) {
      lastError = err;
      console.error(
        `[funding-extract] Claude 호출 실패 (attempt ${attempt}):`,
        err
      );
      if (attempt === 2) break;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}

// POST 핸들러
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const validation = validateBody(body);
    if (!validation.ok || !validation.data) {
      return NextResponse.json<FundingExtractResponse>(
        { ok: false, error: validation.error ?? "요청 본문 오류" },
        { status: 400 }
      );
    }

    const { formType, tradeAmount, story } = validation.data;

    // Mock 모드: 하드코딩 샘플 반환
    if (isMockMode()) {
      const mock =
        formType === "housing"
          ? MOCK_EXTRACT_RESULT_HOUSING
          : MOCK_EXTRACT_RESULT_LAND;
      // 사용자 입력 스토리를 storyOriginal에 반영하여 반환
      const result = { ...mock, storyOriginal: story };
      return NextResponse.json<FundingExtractResponse>({
        ok: true,
        result,
      });
    }

    // 실모드: Claude API 호출
    let rawResponse: unknown;
    try {
      rawResponse = await callClaude(formType, tradeAmount, story);
    } catch (err) {
      console.error("[funding-extract] Claude 최종 실패:", err);
      const msg =
        err instanceof Error ? err.message : "AI 호출 중 알 수 없는 오류";
      return NextResponse.json<FundingExtractResponse>(
        {
          ok: false,
          error: `AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요. (${msg})`,
        },
        { status: 500 }
      );
    }

    // 응답 정규화 (whitelist 필터링 포함)
    const result = normalizeExtractResponse(rawResponse, formType, story);

    return NextResponse.json<FundingExtractResponse>({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("[funding-extract] 예외:", err);
    const msg = err instanceof Error ? err.message : "서버 내부 오류";
    return NextResponse.json<FundingExtractResponse>(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

"use client";

// 세무사 전용 로그인 폼
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export function AdvisorLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/advisor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "로그인 실패");
      router.push("/advisor/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-xl font-bold text-slate-900">
          세무사 전용 로그인
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          파트너 세무사 전용 페이지입니다.
        </p>
        <Card>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="세무사 비밀번호"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={loading} fullWidth>
              {loading ? "확인 중..." : "로그인"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

"use client";

// 세무사 로그아웃 버튼
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AdvisorLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/advisor/logout", { method: "POST" });
    router.push("/advisor");
  };

  return (
    <Button variant="outline" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}

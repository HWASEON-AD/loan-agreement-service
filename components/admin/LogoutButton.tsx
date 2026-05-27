"use client";

// 관리자 로그아웃 버튼
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
  };

  return (
    <Button variant="outline" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}

@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 가족대여닷컴 - 의존성 설치

echo ============================================
echo   가족대여닷컴 의존성 설치 (npm install)
echo ============================================
echo.

call npm install

echo.
if exist "node_modules" (
  echo [완료] 설치가 끝났습니다. run.bat 으로 서버를 시작하세요.
) else (
  echo [오류] 설치에 실패했습니다. Node.js 가 설치되어 있는지 확인하세요.
)
echo.
pause >nul

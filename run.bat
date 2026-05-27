@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 가족대여닷컴 개발 서버

echo ============================================
echo   가족대여닷컴 (loan-agreement-service)
echo ============================================
echo.

REM node_modules 없으면 먼저 설치
if not exist "node_modules" (
  echo [안내] 의존성이 설치되어 있지 않습니다. npm install 을 먼저 실행합니다...
  call npm install
  echo.
)

REM 사용할 포트 (3000이 사용 중이면 PORT 환경변수로 바꿔 실행 가능)
if "%PORT%"=="" set PORT=3000

echo 서버를 시작합니다...
echo.
echo   브라우저에서 http://localhost:%PORT% 로 접속하세요.
echo   (종료하려면 이 창에서 Ctrl+C)
echo.
echo   * 만약 "포트가 이미 사용 중(EADDRINUSE)" 에러가 나면,
echo     이 창을 닫고  set PORT=3005 ^&^& run.bat  로 다시 실행하세요.
echo.

npx next dev -p %PORT%

echo.
echo 서버가 종료되었습니다. 아무 키나 누르면 창이 닫힙니다.
pause >nul

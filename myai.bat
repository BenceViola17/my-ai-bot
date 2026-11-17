@echo off
REM ============================================
REM  MyAI Bot - parancsfájl (Windows)
REM  Használat: myai.bat [parancs] [argumentumok]
REM ============================================
setlocal
set BOTDIR=%~dp0
cd /d "%BOTDIR%"

where pnpm >nul 2>nul
if %errorlevel%==0 (
  set PKG=pnpm
) else (
  set PKG=npm
)

REM Függőségek auto-telepítés, ha hiányoznak
if not exist "node_modules" (
  echo [MyAI] Fuggosegek telepitese %PKG%-gel...
  call %PKG% install
)

REM Parancs atiranyitas
if "%~1"=="" goto :chat
if /i "%~1"=="chat" goto :chat
if /i "%~1"=="start" goto :chat
if /i "%~1"=="serve" goto :serve
if /i "%~1"=="ui" goto :serve
if /i "%~1"=="doctor" goto :doctor
if /i "%~1"=="models" goto :models
if /i "%~1"=="pull" goto :pull
if /i "%~1"=="identity" goto :identity
if /i "%~1"=="memory" goto :memory
if /i "%~1"=="ask" (
  shift
  goto :ask
)
if /i "%~1"=="docs" (
  shift
  goto :docs
)
goto :direct

:chat
call node src/index.js chat
goto :eof

:serve
echo [MyAI] Szerver indul: http://localhost:4141  (UI: bongeszo)
call node src/index.js serve
goto :eof

:doctor
call node src/index.js doctor
goto :eof

:models
call node src/index.js models
goto :eof

:pull
call node src/index.js pull %~2
goto :eof

:identity
call node src/index.js identity
goto :eof

:memory
call node src/index.js memory %~2
goto :eof

:ask
call node src/index.js %*
goto :eof

:docs
call node src/index.js ask-docs %*
goto :eof

:direct
call node src/index.js %*
goto :eof

@echo off
setlocal
cd /d "%~dp0\.."

echo.
echo === Video Picker for FDM — bridge installer ===
echo Author: Sofiqul Islam  https://sofiqul.dev
echo.

set "EXTID="
if exist "bridge\EXTENSION_ID.txt" (
  set /p EXTID=<"bridge\EXTENSION_ID.txt"
)

echo Using extension ID: %EXTID%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1" -ExtensionId "%EXTID%"
set ERR=%ERRORLEVEL%
echo.
if %ERR% neq 0 (
  echo Install failed with code %ERR%.
) else (
  echo Done.
  echo 1. Reload the Video Picker extension
  echo 2. Fully quit and reopen the browser
  echo 3. Open a video and use Download
)
echo.
pause
exit /b %ERR%

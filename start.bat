@echo off
REM =====================================================
REM  ConstructionIMS - Windows Launcher
REM  Starts a local web server on http://localhost:8080
REM  and opens the app in your default browser.
REM =====================================================

title ConstructionIMS - Local Server

cd /d "%~dp0"

echo.
echo  ============================================
echo   ConstructionIMS v2 - Starting local server
echo  ============================================
echo.
echo   URL:    http://localhost:8080
echo   Folder: %CD%
echo.
echo   Press Ctrl+C or close this window to stop.
echo.

REM Try py launcher first, then fall back to plain python
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" http://localhost:8080
    py -3 -m http.server 8080
    goto :end
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" http://localhost:8080
    python -m http.server 8080
    goto :end
)

echo  [ERROR] Python is not installed or not in PATH.
echo.
echo  Install Python 3 from https://www.python.org/downloads/
echo  and tick "Add Python to PATH" during installation.
echo.
echo  Alternatively, just double-click index.html to open the app
echo  directly in your browser (works without a server).
echo.
pause

:end

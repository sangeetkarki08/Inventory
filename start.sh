#!/usr/bin/env bash
# =====================================================
#  ConstructionIMS - macOS / Linux Launcher
#  Starts a local web server on http://localhost:8080
#  and opens the app in your default browser.
# =====================================================

cd "$(dirname "$0")" || exit 1

PORT=8080
URL="http://localhost:$PORT"

echo
echo " ============================================"
echo "  ConstructionIMS v2 - Starting local server"
echo " ============================================"
echo
echo "  URL:    $URL"
echo "  Folder: $(pwd)"
echo
echo "  Press Ctrl+C to stop."
echo

# Open browser (best-effort, OS-dependent)
( sleep 1 &&
  if   command -v open       >/dev/null 2>&1; then open       "$URL"
  elif command -v xdg-open   >/dev/null 2>&1; then xdg-open   "$URL"
  elif command -v gnome-open >/dev/null 2>&1; then gnome-open "$URL"
  fi
) &

# Start the server (python3 preferred, falls back to python)
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
else
  echo
  echo " [ERROR] Python is not installed."
  echo " Install Python 3 (https://www.python.org) and try again."
  echo " Or simply open index.html directly in your browser."
  echo
  exit 1
fi

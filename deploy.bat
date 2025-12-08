@echo off
echo ================================
echo Meeting Genius Git Deploy
echo ================================
echo.

cd /d "C:\Users\Jeff Domingo\Videos\meeting-genius"

echo [1/3] Building locally...
call npm run build
if errorlevel 1 (
    echo ERROR: Local build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Pushing to GitHub (including .next)...
git add .next -f
git add .
git commit -m "Deploy %date% %time%"
git push origin main

if errorlevel 1 (
    echo Trying pull and retry...
    git pull origin main --rebase
    git push origin main
)

echo.
echo [3/3] Deploy complete! Successfully pushed to GitHub.
echo.
pause

@echo off
echo ================================
echo Meeting Genius Git Deploy
echo ================================
echo.

cd "C:\Users\Jeff Domingo\Videos\meeting-genius"

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
echo [3/3] Local deploy done. Now run the server commands manually.
echo.
echo Next steps on SERVER:
echo   1. ssh -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" root@45.59.114.16
echo   2. cd /opt/meetinggenius/app
echo   3. git fetch origin
echo   4. git reset --hard origin/main
echo   5. NODE_ENV=production PORT=3000 npx next start
echo.
pause

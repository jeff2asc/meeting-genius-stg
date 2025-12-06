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
echo [2/3] Pushing to GitHub...
REM Make sure .next (build) is included
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
echo [3/3] Deploying to server...
ssh -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" root@45.59.114.16 ^
  "cd /opt/meetinggenius/app && git fetch origin && git reset --hard origin/main && pm2 restart meetinggenius"

echo.
echo ================================
echo Deployment Complete! (30-60 sec)
echo ================================
echo.
echo App: https://app.meetinggenius.ca
echo.
pause

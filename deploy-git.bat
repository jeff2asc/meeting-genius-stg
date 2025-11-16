@"
@echo off
echo ================================
echo Meeting Genius Git Deploy
echo ================================
echo.

cd "C:\Users\Jeff Domingo\Videos\meeting-genius"

echo [1/2] Pushing to GitHub...
git add .
git commit -m "Deploy %date% %time%"
git push origin main

if errorlevel 1 (
    echo Trying pull and retry...
    git pull origin main --rebase
    git push origin main
)

echo.
echo [2/2] Deploying to server...
ssh -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" root@45.59.114.16 "cd /opt/meetinggenius/app && git pull origin main && npm install --legacy-peer-deps --production && npm run build && pm2 restart meetinggenius"

echo.
echo ================================
echo Deployment Complete! (30-60 sec)
echo ================================
echo.
echo App: https://app.meetinggenius.ca
echo.
pause
"@ | Out-File -FilePath "C:\Users\Jeff Domingo\Videos\meeting-genius\deploy-git.bat" -Encoding ASCII -Force

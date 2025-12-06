@echo off
echo ================================
echo Meeting Genius Server Deploy
echo (GitHub push skipped)
echo ================================
echo.

cd "C:\Users\Jeff Domingo\Videos\meeting-genius"

echo Deploying to server...
ssh -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" root@45.59.114.16 "cd /opt/meetinggenius/app && git pull origin main && npm install --legacy-peer-deps && npm run build && pm2 restart meetinggenius"

echo.
echo ================================
echo Deployment Complete! (30-60 sec)
echo ================================
echo.
echo App: https://app.meetinggenius.ca
echo.
pause

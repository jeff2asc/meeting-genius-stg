@echo off
echo ================================
echo Meeting Genius Deployment
echo ================================
echo.

echo [1/4] Building application...
cd "C:\Users\Jeff Domingo\Videos\meeting-genius"
call npm run build

if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Preparing deploy folder...
if exist deploy rmdir /s /q deploy
mkdir deploy
xcopy /E /I /Y .next deploy\.next
xcopy /E /I /Y public deploy\public
copy /Y package.json deploy\
copy /Y package-lock.json deploy\
copy /Y next.config.js deploy\

echo.
echo [3/4] Uploading to server (app.meetinggenius.ca)...
scp -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" -r deploy\.next root@45.59.114.16:/opt/meetinggenius/app/
scp -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" -r deploy\public root@45.59.114.16:/opt/meetinggenius/app/
scp -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" deploy\package.json root@45.59.114.16:/opt/meetinggenius/app/
scp -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" deploy\package-lock.json root@45.59.114.16:/opt/meetinggenius/app/
scp -i "C:\Users\Jeff Domingo\Videos\meetinggenius_openssh" deploy\next.config.js root@45.59.114.16:/opt/meetinggenius/app/

echo.
echo [4/4] Deployment Complete!
echo ================================
echo.
echo Next: SSH into server and run:
echo   cd /opt/meetinggenius/app
echo   npm install --production
echo   systemctl restart meetinggenius
echo.
echo App now available at: https://app.meetinggenius.ca
echo.
pause
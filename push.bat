@echo off
git add .
git commit -m "Auto Update %date% %time%"
git push origin main
echo ✅ Done! Everything is on GitHub.
pause
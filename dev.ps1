# تشغيل كل حاجة لوكال في 3 نوافذ (الـ API بيعيد تشغيل نفسه لما كود الـ API يتغيّر): الـ API (5034) + موقع العميل (4200) + لوحة التحكم (4201)
#   .\dev.ps1
$root = $PSScriptRoot
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; dotnet ef database update --project api; dotnet watch --project api run"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; npm run start:admin"
Write-Host 'API http://localhost:5034 | Store http://localhost:4200 | Admin http://localhost:4201'

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\gerson.lucas\cafeteria-saas\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\gerson.lucas\cafeteria-saas\frontend'; npm run dev"
Write-Host "Servidores iniciados — backend :8000 | frontend :3000"

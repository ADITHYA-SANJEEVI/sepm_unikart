@echo off
setlocal
cd /d "%~dp0"

set "DEFAULT_FRONTEND_PORT_START=3000"
set "DEFAULT_FRONTEND_PORT_END=3010"
set "DEFAULT_BACKEND_PORT_START=4000"
set "DEFAULT_BACKEND_PORT_END=4010"

echo Releasing stale UniKart ports if needed...
powershell -NoProfile -Command "$ports = %DEFAULT_FRONTEND_PORT_START%..%DEFAULT_FRONTEND_PORT_END%; $ports += %DEFAULT_BACKEND_PORT_START%..%DEFAULT_BACKEND_PORT_END%; foreach($port in $ports){ try { $connections=Get-NetTCPConnection -LocalPort $port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique; foreach($pid in $connections){ if($pid -and $pid -ne 0){ try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Host ('Stopped process ' + $pid + ' on port ' + $port) } catch {} } } } catch {} }"

echo Clearing stale frontend build output...
powershell -NoProfile -Command "$target=Join-Path (Resolve-Path '.').Path 'frontend-v2\.next'; if(Test-Path $target){ for($i=0; $i -lt 5; $i++){ try { attrib -R \"$target\\*\" /S /D 2>$null; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop; Write-Host 'Cleared frontend-v2\.next'; break } catch { Start-Sleep -Milliseconds 700 } } }"

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

set "FRONTEND_MODE=prod"
echo Building UniKart frontend for a stable demo startup...
call npm.cmd run build:frontend:v2
if errorlevel 1 (
  echo Frontend production build hit a local worker error. Falling back to Next dev mode for this session.
  set "FRONTEND_MODE=dev"
)

echo Building UniKart backend for a stable demo startup...
call npm.cmd run build:backend
if errorlevel 1 (
  echo Backend build failed. Fix the backend before starting the demo.
  exit /b 1
)

if not exist .env (
  echo Creating default .env...
  > .env (
    echo CHUTES_API_KEY=placeholder-chutes-key
    echo CHUTES_BASE_URL=https://llm.chutes.ai
    echo CHUTES_COMPLETIONS_PATH=/v1/chat/completions
    echo CHUTES_MODEL=placeholder-chutes-model
    echo CHUTES_TIMEOUT_SECONDS=60
    echo AUTH_OFF=0
    echo SUPABASE_URL=
    echo SUPABASE_PROJECT_REF=
    echo SUPABASE_ANON_KEY=
    echo SUPABASE_SERVICE_ROLE_KEY=
  )
)

set "NEXT_PUBLIC_SUPABASE_URL="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$envValue = ''; if(Test-Path '.env'){ $line = Get-Content '.env' | Where-Object { $_ -match '^SUPABASE_URL=' } | Select-Object -First 1; if($line){ $envValue = $line.Substring('SUPABASE_URL='.Length) } }; if(-not $envValue -and (Test-Path 'frontend-v2\.env.local')){ $line = Get-Content 'frontend-v2\.env.local' | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1; if($line){ $envValue = $line.Substring('NEXT_PUBLIC_SUPABASE_URL='.Length) } }; Write-Output $envValue"`) do set "NEXT_PUBLIC_SUPABASE_URL=%%v"

set "NEXT_PUBLIC_SUPABASE_ANON_KEY="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$envValue = ''; if(Test-Path '.env'){ $line = Get-Content '.env' | Where-Object { $_ -match '^SUPABASE_ANON_KEY=' } | Select-Object -First 1; if($line){ $envValue = $line.Substring('SUPABASE_ANON_KEY='.Length) } }; if(-not $envValue -and (Test-Path 'frontend-v2\.env.local')){ $line = Get-Content 'frontend-v2\.env.local' | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' } | Select-Object -First 1; if($line){ $envValue = $line.Substring('NEXT_PUBLIC_SUPABASE_ANON_KEY='.Length) } }; Write-Output $envValue"`) do set "NEXT_PUBLIC_SUPABASE_ANON_KEY=%%v"

set "BACKEND_PORT="
for /f %%p in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\find-free-port.ps1" -Start %DEFAULT_BACKEND_PORT_START% -End %DEFAULT_BACKEND_PORT_END%') do set "BACKEND_PORT=%%p"
if not defined BACKEND_PORT (
  echo Could not find a free backend port between %DEFAULT_BACKEND_PORT_START% and %DEFAULT_BACKEND_PORT_END%.
  exit /b 1
)

echo Writing frontend-v2\.env.local for backend port %BACKEND_PORT%...
> frontend-v2\.env.local (
  echo NEXT_PUBLIC_API_BASE=/api/backend
  echo UNIKART_BACKEND_URL=http://localhost:%BACKEND_PORT%
  echo NEXT_PUBLIC_SUPABASE_URL=%NEXT_PUBLIC_SUPABASE_URL%
  echo NEXT_PUBLIC_SUPABASE_ANON_KEY=%NEXT_PUBLIC_SUPABASE_ANON_KEY%
)

echo Starting UniKart backend on http://localhost:%BACKEND_PORT%/
start "UniKart Backend" cmd /k "cd /d %~dp0 && set PORT=%BACKEND_PORT% && node dist\\backend\\server.js"

echo Waiting for backend health check...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(45); $ready=$false; while((Get-Date) -lt $deadline){ try { $payload=Invoke-RestMethod -UseBasicParsing -Uri 'http://localhost:%BACKEND_PORT%/health' -TimeoutSec 2; if($payload.success -eq $true -and $payload.service -eq 'unikart-backend' -and $null -ne $payload.authOff){ $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 800 }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo Strict backend health signature did not appear in time. Trying a looser health probe...
  powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(15); $ready=$false; while((Get-Date) -lt $deadline){ try { $resp=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:%BACKEND_PORT%/health' -TimeoutSec 2; if($resp.StatusCode -eq 200){ $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 800 }; if(-not $ready){ exit 1 }"
  if errorlevel 1 (
    echo Backend did not become reachable in time. Check the backend window for stale or failed startup.
    exit /b 1
  )
  echo Backend is reachable, but the health payload shape did not match the latest expected signature.
)

echo Backend auth mode:
powershell -NoProfile -Command "try { (Invoke-RestMethod -UseBasicParsing -Uri 'http://localhost:%BACKEND_PORT%/health').PSObject.Properties | ForEach-Object { if($_.Name -in @('authOff','devAuthBypassEnabled','devAuthBypassEmails')){ Write-Host ($_.Name + ': ' + $_.Value) } } } catch { Write-Host 'Could not read backend auth mode.' }"

set "FRONTEND_PORT="
for /f %%p in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\find-free-port.ps1" -Start %DEFAULT_FRONTEND_PORT_START% -End %DEFAULT_FRONTEND_PORT_END%') do set "FRONTEND_PORT=%%p"
if not defined FRONTEND_PORT (
  echo Could not find a free frontend port between %DEFAULT_FRONTEND_PORT_START% and %DEFAULT_FRONTEND_PORT_END%.
  exit /b 1
)

echo Starting UniKart frontend on http://localhost:%FRONTEND_PORT%/
if /I "%FRONTEND_MODE%"=="dev" (
  start "UniKart Frontend" cmd /k "cd /d %~dp0frontend-v2 && npx.cmd next dev --webpack -p %FRONTEND_PORT%"
) else (
  start "UniKart Frontend" cmd /k "cd /d %~dp0frontend-v2 && npx.cmd next start -p %FRONTEND_PORT%"
)

echo Waiting for frontend to become reachable...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(45); $ready=$false; while((Get-Date) -lt $deadline){ try { $resp=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:%FRONTEND_PORT%/' -TimeoutSec 3; if($resp.StatusCode -eq 200){ $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 800 }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo Frontend did not become reachable in time. Check the frontend window for a failed build or startup error.
  exit /b 1
)

echo UniKart MVP launch initiated.
echo Backend: http://localhost:%BACKEND_PORT%/
echo Frontend: http://localhost:%FRONTEND_PORT%/
echo Frontend mode: %FRONTEND_MODE%
if defined NEXT_PUBLIC_SUPABASE_URL (
  echo Supabase URL detected.
) else (
  echo Supabase URL missing in .env and frontend-v2\.env.local.
)
start "" "http://localhost:%FRONTEND_PORT%/"

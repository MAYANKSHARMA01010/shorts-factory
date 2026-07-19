# ensure_postiz.ps1 - make sure Docker + the Postiz containers are UP so the scripts can read the
# YouTube credentials (client id/secret from the postiz container env, refresh token from postiz-postgres).
#
# IMPORTANT: the daily pipeline publishes via DIRECT YouTube upload (post_to_youtube.py), NOT Postiz's
# flaky Temporal publisher. So we DO NOT restart the postiz container here. A `docker restart postiz`
# races the backend into `EADDRINUSE: :::3000` -> the backend dies -> the Postiz UI/API 502s. We only
# ensure the containers are RUNNING (start if stopped; never restart a healthy one).
$ErrorActionPreference = 'SilentlyContinue'

function Test-Docker { docker info *> $null; return ($LASTEXITCODE -eq 0) }

# 1) Docker daemon up (launch Docker Desktop if needed)
if (-not (Test-Docker)) {
    Write-Output "[$(Get-Date -Format HH:mm:ss)] Docker daemon down -> launching Docker Desktop"
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $deadline = (Get-Date).AddMinutes(4)
    while (-not (Test-Docker) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 10 }
}
if (-not (Test-Docker)) { Write-Output "[$(Get-Date -Format HH:mm:ss)] ERROR: Docker still down after 4 min"; exit 1 }
Write-Output "[$(Get-Date -Format HH:mm:ss)] Docker is up"

# 2) ensure the Postiz stack is running (starts stopped containers; a no-op for already-running ones,
#    so no restart / no EADDRINUSE race)
Push-Location "C:\Dikshant\auto posting tool\postiz-app-main"
docker compose -f docker-compose.yaml up -d *>&1 | Out-String | Write-Output
Pop-Location

# 3) wait for Postgres (that is all the credential reads need)
$deadline = (Get-Date).AddMinutes(2); $ready = $false
while (-not $ready -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 4
    docker exec postiz-postgres pg_isready -U postiz-user -d postiz-db-local *> $null
    $ready = ($LASTEXITCODE -eq 0)
}
Write-Output "[$(Get-Date -Format HH:mm:ss)] Postiz DB ready: $ready"

# 4) self-heal: if the backend zombied out on a prior restart (nothing on :3000 -> UI 502), bounce just
#    the backend process (cheap, no container restart, no port race). Keeps the Postiz UI usable.
if (Test-Docker) {
    $on3000 = docker exec postiz sh -c "netstat -tln 2>/dev/null | grep -c ':3000' || ss -tln 2>/dev/null | grep -c ':3000'"
    if ("$on3000".Trim() -eq "0") {
        Write-Output "[$(Get-Date -Format HH:mm:ss)] backend not listening on :3000 -> restarting just the backend process"
        docker exec postiz sh -c "npx pm2 restart backend" *> $null
    }
}

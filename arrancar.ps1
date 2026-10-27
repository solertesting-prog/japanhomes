# Japan Property Token - arranque local en Windows
# Uso: doble clic en arrancar.bat (o: powershell -ExecutionPolicy Bypass -File arrancar.ps1)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Paso($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }

Paso 'Comprobando Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Instala Node.js 22 LTS desde https://nodejs.org y vuelve a ejecutar.' -ForegroundColor Red; exit 1 }
node -v

Paso 'Activando pnpm (corepack)'
try { corepack enable 2>$null } catch {}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { npm install -g pnpm@10 }
pnpm -v

function NuevoSecreto { $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join '' }
if (-not (Test-Path .env)) { New-Item .env -ItemType File | Out-Null }
# Anade a .env las variables nuevas de .env.example sin tocar las existentes.
$actual = Get-Content .env
$claves = $actual | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { ($_ -split '=', 2)[0] }
$nuevas = Get-Content .env.example | Where-Object { $_ -match '^[A-Z_]+=' -and ($claves -notcontains ($_ -split '=', 2)[0]) }
if ($nuevas) {
  Paso 'Completando .env con variables nuevas'
  $nuevas | ForEach-Object { $_ -replace 'replace-with-openssl-rand-hex-32-output', (NuevoSecreto) } | Add-Content .env -Encoding UTF8
}

if (Select-String -Path .env -Pattern '@localhost:5432/' -Quiet) {
  (Get-Content .env) -replace '@localhost:5432/', '@localhost:54329/' | Set-Content .env -Encoding UTF8
}

# Windows resuelve "localhost" a ::1 (IPv6) y la API escucha en IPv4.
if (Select-String -Path .env -Pattern 'localhost:4000' -Quiet) {
  (Get-Content .env) -replace 'localhost:4000', '127.0.0.1:4000' | Set-Content .env -Encoding UTF8
}

Paso 'Instalando dependencias (la primera vez tarda unos minutos)'
pnpm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Paso 'Generando el cliente de base de datos (Prisma)'
pnpm db:generate

Paso 'Compilando el paquete compartido y ejecutando sus tests'
pnpm --filter @jpt/shared build
pnpm --filter @jpt/shared test

$docker = Get-Command docker -ErrorAction SilentlyContinue
$dockerOk = $false
if ($docker) {
  # Docker Desktop cerrado escribe en stderr; no debe abortar el script.
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { docker info *> $null; $dockerOk = ($LASTEXITCODE -eq 0) } catch { $dockerOk = $false }
  $ErrorActionPreference = $prev
}

if ($dockerOk) {
  Paso 'Docker disponible: levantando PostgreSQL + Redis, migrando y cargando datos DEMO'
  pnpm infra:up
  Start-Sleep -Seconds 8
  Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($k, $v, 'Process')
  }
  pnpm db:migrate
  pnpm db:seed
  Paso 'Arrancando API (http://localhost:4000/docs) y web (http://localhost:3000)'
  pnpm dev
} else {
  Paso 'Docker no disponible: arrancando solo la web con datos DEMO en http://localhost:3000'
  $env:JPT_DATA_SOURCE = 'demo'
  pnpm --filter @jpt/web dev
}

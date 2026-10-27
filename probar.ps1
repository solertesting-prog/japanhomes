# Japan Property Token - batería de pruebas completa (requiere Docker Desktop abierto)
# Escribe el resultado en .sync\probar.log para poder revisarlo.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force .sync | Out-Null
$log = Join-Path $PSScriptRoot '.sync\probar.log'
"Inicio: $(Get-Date -Format s)" | Set-Content $log -Encoding UTF8

function Paso($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan; "`n== $msg" | Add-Content $log -Encoding UTF8 }
function Ejecuta([string]$cmd) {
  "`n> $cmd" | Add-Content $log -Encoding UTF8
  cmd /c "$cmd 2>&1" | ForEach-Object { Write-Host $_; "$_" | Add-Content $log -Encoding UTF8 }
  $code = $LASTEXITCODE
  "[exit $code]" | Add-Content $log -Encoding UTF8
  return $code
}

$resultados = [ordered]@{}

Paso 'Comprobando Docker'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop no esta en marcha. Abrelo, espera a "Engine running" y vuelve a ejecutar probar.bat.' -ForegroundColor Red
  'DOCKER NO DISPONIBLE' | Add-Content $log -Encoding UTF8
  exit 1
}

# Bases de datos en el puerto 54329 (el 5432 suele estar ocupado por un PostgreSQL local).
if ((Test-Path .env) -and (Select-String -Path .env -Pattern '@localhost:5432/' -Quiet)) {
  (Get-Content .env) -replace '@localhost:5432/', '@localhost:54329/' | Set-Content .env -Encoding UTF8
}

Paso 'Dependencias'
$resultados['install'] = Ejecuta 'pnpm install'
$resultados['prisma generate'] = Ejecuta 'pnpm db:generate'

Paso 'Base de datos de pruebas limpia (jpt_test)'
Ejecuta 'docker compose -f infra/docker/docker-compose.yml up -d postgres' | Out-Null
for ($i = 0; $i -lt 30; $i++) {
  docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U jpt *> $null
  if ($LASTEXITCODE -eq 0) { break }; Start-Sleep -Seconds 2
}
Ejecuta 'docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U jpt -d postgres -c "DROP DATABASE IF EXISTS jpt_test" -c "CREATE DATABASE jpt_test"' | Out-Null

$env:DATABASE_URL = 'postgresql://jpt:jpt_dev_password@localhost:54329/jpt_test'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$resultados['migraciones'] = Ejecuta 'pnpm --filter @jpt/database exec prisma migrate deploy'

Paso 'Invariantes SQL'
"`n> invariants.sql" | Add-Content $log -Encoding UTF8
Get-Content packages/database/test/invariants.sql -Raw |
  docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U jpt -d jpt_test -v ON_ERROR_STOP=1 -q 2>&1 |
  ForEach-Object { Write-Host $_; "$_" | Add-Content $log -Encoding UTF8 }
$resultados['invariantes SQL'] = $LASTEXITCODE

$resultados['seed DEMO'] = Ejecuta 'pnpm --filter @jpt/database run seed'

Paso 'Tests'
$resultados['tests dominio'] = Ejecuta 'pnpm --filter @jpt/shared build'
$resultados['tests dominio'] = Ejecuta 'pnpm --filter @jpt/shared test'
$resultados['build database'] = Ejecuta 'pnpm --filter @jpt/database exec tsc -p tsconfig.json'
$resultados['tests API unitarios'] = Ejecuta 'pnpm --filter @jpt/api test'
$resultados['tests API integracion'] = Ejecuta 'pnpm --filter @jpt/api test:int'

Paso 'Tipos'
$resultados['typecheck API'] = Ejecuta 'pnpm --filter @jpt/api typecheck'
$resultados['typecheck web'] = Ejecuta 'pnpm --filter @jpt/web typecheck'

Paso 'Resumen'
$fallos = 0
foreach ($k in $resultados.Keys) {
  $ok = $resultados[$k] -eq 0
  if (-not $ok) { $fallos++ }
  $linea = '{0,-24} {1}' -f $k, ($(if ($ok) { 'OK' } else { "FALLO (exit $($resultados[$k]))" }))
  Write-Host $linea -ForegroundColor ($(if ($ok) { 'Green' } else { 'Red' }))
  $linea | Add-Content $log -Encoding UTF8
}
"Fin: $(Get-Date -Format s) - fallos: $fallos" | Add-Content $log -Encoding UTF8
Write-Host "`nRegistro completo en .sync\probar.log"

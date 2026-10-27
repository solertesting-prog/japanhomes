# Japan Property Token - da acceso al panel de administracion a una cuenta
# Uso: doble clic en crear-admin.bat (con Docker y la base de datos en marcha)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($k, $v, 'Process')
}

Write-Host 'Si la cuenta ya existe (por ejemplo, la que creaste en la web), se le anade el rol y la contrasena no cambia.'
Write-Host 'Si no existe, se crea y se muestra una contrasena de un solo uso.'
Write-Host ''
$email = Read-Host 'Email de la cuenta'
Write-Host ''
Write-Host 'Roles: 1) SUPER_ADMINISTRATOR (todo)  2) ADMINISTRATOR  3) COMPLIANCE_OFFICER  4) PROPERTY_MANAGER'
$opcion = Read-Host 'Rol [1]'
$rol = switch ($opcion) { '2' { 'ADMINISTRATOR' } '3' { 'COMPLIANCE_OFFICER' } '4' { 'PROPERTY_MANAGER' } default { 'SUPER_ADMINISTRATOR' } }

pnpm --filter @jpt/database staff:create -- --email $email --role $rol
if ($LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host 'Listo. Entra en http://localhost:3000/admin (el panel exige tener activada la verificacion en dos pasos).' -ForegroundColor Green
}

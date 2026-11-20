# Stops ThermaGuard. Data is kept; add -Reset to wipe it and start fresh next time.
param([switch]$Reset)
Set-Location -Path $PSScriptRoot
if ($Reset) { docker compose down -v } else { docker compose down }

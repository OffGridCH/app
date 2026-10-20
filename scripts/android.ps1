# OffGrid – Android-Build unter Windows vorbereiten und Android Studio öffnen.
# Aufruf im Windows-Klon des Repos (PowerShell):   .\scripts\android.ps1
# Optionen:
#   -Branch feature/T12-screen-chat   einen PR-Branch statt main bauen (zum Testen vor dem Merge)
#   -NoPull                           nichts von GitHub holen
#   -NoOpen                           Android Studio nicht öffnen
param([string]$Branch = 'main', [switch]$NoPull, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$nodeVersion = (node -v).TrimStart('v')
if ([version]$nodeVersion -lt [version]'24.15.0') {
  Write-Host "Node $nodeVersion ist zu alt. Bitte Node 24 LTS (>= 24.15) installieren: https://nodejs.org" -ForegroundColor Red
  exit 1
}

if (-not $NoPull) {
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Host 'Es gibt lokale Aenderungen. Bitte zuerst committen oder verwerfen:' -ForegroundColor Red
    Write-Host $dirty
    exit 1
  }
  git fetch origin
  git switch $Branch
  git pull --ff-only origin $Branch
}

Write-Host "Baue Branch: $(git branch --show-current)" -ForegroundColor Cyan
Write-Host '1/3  Abhaengigkeiten installieren (npm ci) ...' -ForegroundColor Cyan
npm ci

Write-Host '2/3  Web-App bauen (npm run build) ...' -ForegroundColor Cyan
npm run build

Write-Host '3/3  In Android-Projekt kopieren (npx cap sync android) ...' -ForegroundColor Cyan
npx cap sync android

if (-not $NoOpen) {
  Write-Host 'Android Studio wird geoeffnet. Dort oben das Handy waehlen und auf Run (gruenes Dreieck) klicken.' -ForegroundColor Green
  npx cap open android
}

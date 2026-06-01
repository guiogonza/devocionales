# build-apk.ps1 - Compila el APK de SpiritFly y lo copia a la carpeta apk/
# Uso: .\build-apk.ps1 [-Release] [-Open]

param(
    [switch]$Release,  # Construir APK de release (por defecto: debug)
    [switch]$Open      # Abrir Android Studio al terminar
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$androidDir = Join-Path $root "android"
$apkOutDir = Join-Path $root "apk"

Write-Host ""
Write-Host "=== SpiritFly APK Builder ===" -ForegroundColor Cyan
Write-Host ""

# 1. Sync Capacitor assets
Write-Host "[1/3] Sincronizando assets con Capacitor..." -ForegroundColor Yellow
Set-Location $root
npx cap sync android
if (-not $?) { Write-Host "Error en cap sync" -ForegroundColor Red; exit 1 }

# 2. Compilar con Gradle
Set-Location $androidDir
if ($Release) {
    Write-Host "[2/3] Compilando APK de RELEASE..." -ForegroundColor Yellow
    .\gradlew.bat assembleRelease
    $apkSrc = Get-ChildItem -Path "app\build\outputs\apk\release\*.apk" | Select-Object -First 1
    $destName = "spiritfly-release.apk"
} else {
    Write-Host "[2/3] Compilando APK de DEBUG..." -ForegroundColor Yellow
    .\gradlew.bat assembleDebug
    $apkSrc = Get-ChildItem -Path "app\build\outputs\apk\debug\*.apk" | Select-Object -First 1
    $destName = "spiritfly.apk"
}

if (-not $?) { Write-Host "Error al compilar con Gradle" -ForegroundColor Red; exit 1 }
if (-not $apkSrc) { Write-Host "No se encontró el APK generado" -ForegroundColor Red; exit 1 }

# 3. Copiar APK a carpeta apk/
Write-Host "[3/3] Copiando APK a carpeta apk/..." -ForegroundColor Yellow
if (-not (Test-Path $apkOutDir)) { New-Item -ItemType Directory $apkOutDir | Out-Null }
$dest = Join-Path $apkOutDir $destName
Copy-Item -Force $apkSrc.FullName $dest

$sizeMB = [math]::Round((Get-Item $dest).Length / 1MB, 1)
Write-Host ""
Write-Host "APK generado correctamente:" -ForegroundColor Green
Write-Host "  Ruta:  $dest" -ForegroundColor White
Write-Host "  Tamano: ${sizeMB} MB" -ForegroundColor White
Write-Host ""
Write-Host "Disponible en: https://spiritfly.org/descargar-app" -ForegroundColor Cyan

Set-Location $root

if ($Open) {
    Write-Host "Abriendo Android Studio..." -ForegroundColor Yellow
    npx cap open android
}

@echo off
echo ========================================
echo  Devocionales PWA - Script de Inicio
echo ========================================
echo.

REM Verificar si Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker no esta instalado o no esta en el PATH
    echo Por favor, instala Docker Desktop desde https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [OK] Docker encontrado
echo.

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Usando 'docker compose' en lugar de 'docker-compose'
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo [INFO] Construyendo la imagen Docker...
%COMPOSE_CMD% build

if %errorlevel% neq 0 (
    echo [ERROR] Fallo al construir la imagen
    pause
    exit /b 1
)

echo.
echo [INFO] Iniciando el contenedor...
%COMPOSE_CMD% up -d

if %errorlevel% neq 0 (
    echo [ERROR] Fallo al iniciar el contenedor
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Aplicacion iniciada correctamente!
echo ========================================
echo.
echo Abre tu navegador en: http://localhost:3000
echo Panel de admin: http://localhost:3000/admin.html
echo.
echo Para detener la aplicacion ejecuta: docker-compose down
echo Para ver los logs ejecuta: docker-compose logs -f
echo.
pause

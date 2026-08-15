@echo off
title Fabrica de Maquetes - Compilador EXE
echo ========================================================
echo   FABRICA DE MAQUETES - COMPILANDO SERVIDOR PONTE PARA EXE
echo ========================================================
echo.

:: Verifica se a pasta node_modules existe
if not exist node_modules (
    echo [Info] Instalando dependencias necessarias para compilar...
    call npm install
)

:: Verifica se o pkg esta instalado localmente
if not exist node_modules\pkg (
    echo [Info] Instalando biblioteca de empacotamento 'pkg'...
    call npm install --save-dev pkg
)

echo.
echo [Compilador] Gerando o executavel de arquivo unico para Windows (campo-tatil-ponte.exe)...
echo [Compilador] Aguarde, isso pode levar alguns segundos...
echo.

call npx pkg . --targets node18-win-x64 --output campo-tatil-ponte.exe

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   🟢 SUCESSO! Executavel gerado com sucesso!
    echo   Arquivo criado: campo-tatil-ponte.exe
    echo   Para rodar em qualquer maquina, copie este .exe e o .env
    echo ========================================================
) else (
    echo.
    echo   ❌ ERRO ao gerar o executavel. Verifique os logs acima.
)
echo.
pause

@echo off
title Ponte Campo Tatil Pro - Servidor
echo ========================================================
echo   INICIANDO SERVIDOR PONTE DO CAMPO TATIL PRO
echo ========================================================
echo.

:: Verifica se a pasta node_modules existe, se nao existir roda npm install
if not exist node_modules (
    echo [Info] Instalando dependencias do projeto pela primeira vez...
    call npm install
    if %errorlevel% neq 0 (
        echo [Erro] Falha ao rodar npm install. Verifique se o Node.js esta instalado!
        pause
        exit /b
    )
)

echo [Info] Iniciando o servidor de comunicacao...
echo.
node servidor_integracao.js
pause

@echo off
title Servidor Galo Mura
echo ====================================================
echo      INICIANDO O APLICATIVO EXPOSICAO GALO MURA
echo ====================================================
echo.
echo 1. Iniciando o servidor local...
echo (Esta janela do terminal deve continuar aberta durante o uso)
echo.

:: Starts npm start in a separate minimized cmd window or runs it here
start /B galo-mura.exe

:: Wait a brief moment for the server to spin up
timeout /t 3 /nobreak >nul

echo 2. Abrindo o Painel da TV no navegador...
start http://localhost:3000

echo.
echo Tudo Pronto! 
echo Se o navegador nao abrir sozinho, acesse: http://localhost:3000
echo.
pause

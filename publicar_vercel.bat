@echo off
title Publicador resulta. - Vercel Deploy
echo ========================================================
echo   PUBLICADOR AUTOMATICO DO SITE "RESULTA." NO VERCEL
echo ========================================================
echo.

cd BetSmarterHub_extracted

:: 1. Efetuar Login na Vercel
echo [Passo 1/4] Autenticando com a sua conta Vercel...
echo Se voce nao estiver logado, o navegador abrira para voce entrar com o GitHub.
echo.
call npx vercel login
if %errorlevel% neq 0 (
    echo [Erro] Falha na autenticacao do Vercel. Certifique-se de completar o login no navegador!
    pause
    exit /b
)

:: 2. Vincular o projeto
echo.
echo [Passo 2/4] Vinculando a pasta do aplicativo com o painel da Vercel...
echo.
call npx vercel link --yes

:: 3. Configurar as chaves do Supabase no ambiente de nuvem do Vercel
echo.
echo [Passo 3/4] Gravando as senhas do novo Supabase na nuvem da Vercel...
echo.
call npx vercel env add VITE_SUPABASE_URL production "https://paelbarlmayswqilhoxa.supabase.co" --yes
call npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production "sb_publishable_6Kz2o4DWlxhBgc7oyDt2AA_KmphGK-h" --yes
call npx vercel env add SUPABASE_URL production "https://paelbarlmayswqilhoxa.supabase.co" --yes
call npx vercel env add SUPABASE_PUBLISHABLE_KEY production "sb_publishable_6Kz2o4DWlxhBgc7oyDt2AA_KmphGK-h" --yes

:: 4. Fazer o Deploy de Producao
echo.
echo [Passo 4/4] Compilando e gerando o link publico na nuvem (Production)...
echo Aguarde, isso pode levar ate 2 minutos...
echo.
call npx vercel --prod --yes

echo.
echo ========================================================
echo   🟢 SITE PUBLICADO COM SUCESSO NO VERCEL!
echo   Voce ja pode abrir o link gerado acima no seu celular!
echo ========================================================
echo.
pause

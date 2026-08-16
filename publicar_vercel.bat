@echo off
title Publicador resulta. - Vercel Deploy
echo ========================================================
echo   PUBLICADOR AUTOMATICO DO SITE "RESULTA." NO VERCEL
echo ========================================================
echo.

cd BetSmarterHub_extracted

:: Configura o Token da Vercel lendo o arquivo local .env (ignorado pelo git)
for /f "usebackq tokens=1,2 delims==" %%I in (".env") do (
    if "%%I"=="VERCEL_TOKEN" set VERCEL_TOKEN=%%~J
)

:: 1. Vincular o projeto
echo [Passo 1/3] Vinculando a pasta do aplicativo com o painel da Vercel...
echo.
call npx vercel link --project resulta-app --yes

:: 2. Configurar as chaves do Supabase no ambiente de nuvem do Vercel
echo.
echo [Passo 2/3] Gravando as senhas do novo Supabase na nuvem da Vercel...
echo.
echo https://paelbarlmayswqilhoxa.supabase.co|call npx vercel env add VITE_SUPABASE_URL production
echo sb_publishable_6Kz2o4DWlxhBgc7oyDt2AA_KmphGK-h|call npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
echo https://paelbarlmayswqilhoxa.supabase.co|call npx vercel env add SUPABASE_URL production
echo sb_publishable_6Kz2o4DWlxhBgc7oyDt2AA_KmphGK-h|call npx vercel env add SUPABASE_PUBLISHABLE_KEY production

:: 3. Fazer o Deploy de Producao
echo.
echo [Passo 3/3] Compilando e gerando o link publico na nuvem (Production)...
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

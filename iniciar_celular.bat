@echo off
chcp 65001 > nul
title CarHealth - Frontend no celular (https na rede Wi-Fi)
cd /d "%~dp0frontend"

where npm > nul 2> nul
if errorlevel 1 (
    echo.
    echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
    pause
    exit /b 1
)

echo Conferindo as dependencias do frontend ...
call npm install --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  Para testar o check-in com a camera do CELULAR:
echo  1. O celular precisa estar no MESMO Wi-Fi deste computador.
echo  2. Abra no celular o endereco "Network: https://..." que
echo     aparece logo abaixo (NAO o localhost).
echo  3. O celular vai avisar que a conexao nao e segura: toque em
echo     "Avancado" e "Continuar" (o certificado e gerado aqui mesmo).
echo  4. Se o Windows perguntar, permita o acesso do Node.js a rede.
echo  O backend (iniciar_backend.bat) precisa estar aberto tambem.
echo ============================================================
echo.
call npm run celular
pause
exit /b 0

:erro
echo.
echo [ERRO] Falha ao instalar as dependencias. Veja o COMO_RODAR.md.
pause
exit /b 1

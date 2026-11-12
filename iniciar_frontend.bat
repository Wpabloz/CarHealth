@echo off
chcp 65001 > nul
title CarHealth - Frontend (telas)
cd /d "%~dp0frontend"

where npm > nul 2> nul
if errorlevel 1 (
    echo.
    echo [ERRO] Node.js nao encontrado.
    echo Instale a versao LTS em https://nodejs.org/ e abra este arquivo de novo.
    pause
    exit /b 1
)

echo Conferindo as dependencias do frontend (na primeira vez demora um pouco) ...
call npm install --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  Abra no navegador: http://localhost:5173
echo  Gestor:    silvana@reboquessilva.com.br  /  carhealth2026
echo  Motorista: marcos@reboquessilva.com.br   /  carhealth2026
echo  NAO feche esta janela durante a apresentacao.
echo ============================================================
echo.
start "" http://localhost:5173
call npm run dev
pause
exit /b 0

:erro
echo.
echo [ERRO] Falha ao instalar as dependencias. Veja o COMO_RODAR.md.
pause
exit /b 1

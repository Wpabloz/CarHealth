@echo off
chcp 65001 > nul
title CarHealth - Backend (API)
cd /d "%~dp0"

rem Sem .env: usa SQLite (nao precisa instalar o PostgreSQL)
if not exist .env (
    echo DB_ENGINE=sqlite> .env
)

if exist .venv\Scripts\python.exe goto instalar

rem Prefere Python 3.13 ou 3.12 (versoes testadas com o projeto)
set "PY="
where py > nul 2> nul
if not errorlevel 1 (
    py -3.13 -c "pass" > nul 2> nul && set "PY=py -3.13"
    if not defined PY py -3.12 -c "pass" > nul 2> nul && set "PY=py -3.12"
)
if not defined PY (
    where python > nul 2> nul && set "PY=python"
)
if not defined PY (
    echo.
    echo [ERRO] Python nao encontrado.
    echo Instale o Python 3.13 em https://www.python.org/downloads/
    echo e marque a opcao "Add Python to PATH" na instalacao.
    pause
    exit /b 1
)
echo [1/4] Criando o ambiente virtual .venv com: %PY%
%PY% -m venv .venv
if errorlevel 1 goto erro

:instalar

echo [2/4] Instalando as bibliotecas (a primeira vez demora um pouco) ...
.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto erro

echo [3/4] Criando/atualizando as tabelas do banco ...
.venv\Scripts\python.exe manage.py migrate
if errorlevel 1 goto erro

echo [4/4] Carregando os dados de demonstracao ...
.venv\Scripts\python.exe manage.py popular_demo --manter
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  API rodando em http://127.0.0.1:8000/api/docs
echo  NAO feche esta janela. Agora abra o iniciar_frontend.bat
echo ============================================================
echo.
.venv\Scripts\python.exe manage.py runserver
pause
exit /b 0

:erro
echo.
echo [ERRO] Algo deu errado no passo acima. Leia a mensagem e veja o COMO_RODAR.md.
echo Dica: se falhou ao instalar as bibliotecas, instale o Python 3.13,
echo apague a pasta .venv e abra este arquivo de novo.
pause
exit /b 1

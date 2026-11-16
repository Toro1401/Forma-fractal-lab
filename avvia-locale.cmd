@echo off
setlocal
title Forma - Laboratorio locale
where python >nul 2>nul
if errorlevel 1 goto no_python
echo.
echo Avvio di Forma all'indirizzo:
echo http://127.0.0.1:8080
echo.
echo Apri questo indirizzo nel browser. Non serve alcun account.
echo Per arrestare il server premi Ctrl+C o chiudi questa finestra.
echo.
python "%~dp0serve.py" --port 8080
if errorlevel 1 goto server_error
exit /b 0

:no_python
echo Python 3 non e disponibile. Puoi aprire direttamente dist\index.html.
pause
exit /b 1

:server_error
echo.
echo Il server non e partito o si e arrestato. Controlla il messaggio sopra.
echo Se la porta 8080 e occupata, consulta il README per cambiarla.
echo Puoi anche aprire direttamente dist\index.html.
pause
exit /b 1

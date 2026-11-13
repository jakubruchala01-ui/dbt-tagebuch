@echo off
rem Startet das DBT-Tagebuch lokal. Nur von diesem PC erreichbar (127.0.0.1).
cd /d "%~dp0app"
start "" http://127.0.0.1:8765/
echo DBT-Tagebuch laeuft auf http://127.0.0.1:8765/  -  Fenster schliessen zum Beenden.
python -m http.server 8765 --bind 127.0.0.1

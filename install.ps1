# MyAI Bot — Windows telepítő (PowerShell)
# Teljesen lokális AI: Ollama + modell + npm csomagok.

Write-Host "=== MyAI Bot telepítő ===" -ForegroundColor Cyan

# 1) Ollama ellenőrzés / telepítés via winget
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama nincs telepítve. Telepítés winget-tel..." -ForegroundColor Yellow
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
    if ($?) { Write-Host "Ollama telepítve. Indítsd újra a terminált, majd futtasd újra ezt a szkriptet." -ForegroundColor Green }
    else { Write-Host "Telepítsd kézzel: https://ollama.com/download" -ForegroundColor Red }
    exit
}
Write-Host "✔ Ollama megvan: $(ollama --version)"

# 2) npm függőségek
Write-Host "npm install..." -ForegroundColor Cyan
npm install
if (-not $?) { exit 1 }

# 3) Globális myai parancs
npm link

# 4) Modellek
Write-Host "Modellek letöltése (llama3.2 ~2GB, nomic-embed-text ~270MB)..." -ForegroundColor Cyan
ollama pull llama3.2
ollama pull nomic-embed-text

# 5) Teszt
Write-Host "Diagnosztika:" -ForegroundColor Cyan
myai doctor

Write-Host "`n✔ Kész! Próbáld: myai `"szia, ki vagy?`"" -ForegroundColor Green

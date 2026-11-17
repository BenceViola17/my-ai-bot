# MyAI Bot — saját AI asszisztens, API kulcs nélkül

Teljesen **lokálisan futó** AI bot: a modell a saját gépeden dolgozik (Ollama motorral), ezért
**nincs szükség API kulcsra, fiókra vagy internetre**. Használható terminálból, bármelyik mappából, és VSCode-ból is.

## Első lépések

```powershell
# 1) Telepítsd az Ollamát (egyszer): https://ollama.com/download
#    Windows: letöltöd, telepíted, automatikusan fut a háttérben.

# 2) Projekt függőségei
cd my-ai-bot
npm install

# 3) Globális parancs (myai)
npm link

# 4) Modell letöltése (egyszer, ~2 GB)
myai pull llama3.2

# 5) Teszt
myai doctor
myai "szia, ki vagy?"
```

## Használat

| Parancs | Mit csinál |
|---|---|
| `myai "kérdés"` | egyszeri kérdés, streaming válasz |
| `myai chat` | interaktív beszélgetés (memóriával) |
| `myai serve` | lokális szerver: `http://localhost:4141/v1` (OpenAI-kompatibilis) |
| `myai doctor` | motor + modell ellenőrzés |
| `myai models` | elérhető modellek |
| `myai pull <modell>` | modell letöltése (`llama3.2`, `qwen2.5-coder`, `deepseek-r1`, `phi3.5`, `nomic-embed-text`) |
| `myai index .` | a projekt fájljainak indexelése (RAG) |
| `myai ask-docs "kérdés"` | kérdés a saját fájljaidról (RAG) |

## VSCode-ban

1. Terminálban indítsd: `myai serve`
2. Az extensiont telepítsd:
   ```powershell
   cd vscode-extension
   npx vsce package
   code --install-extension myai-bot-1.0.0.vsix
   ```
3. Parancsok (`Ctrl+Shift+P`):
   - **MyAI: Chat megnyitása** (`Ctrl+Alt+M`) — chat panel
   - **MyAI: Kijelölés magyarázata** (`Ctrl+Alt+E`)
   - **MyAI: Kijelölés refaktorálása** (`Ctrl+Alt+R`) — a kijelölt kódot lecseréli
   - **MyAI: Kérdezz a projektről** — RAG

## Modellek (mind ingyenes, lokális)

- `llama3.2` — gyors általános chat (alapérték)
- `llama3.1` — okosabb, nagyobb
- `qwen2.5-coder` — kódhoz ajánlott
- `deepseek-r1` — érvelés/reasoning
- `phi3.5` — könnyű
- `nomic-embed-text` — RAG embeddingshez

Modellváltás: `myai "kérdés" --model qwen2.5-coder` (vagy a VSCode `myai.model` beállításban).

## Architektúra

Lásd: [PLAN.md](PLAN.md). Motorok: **Ollama** (fő), opcionálisan llama.cpp (`:8080`) és LM Studio (`:1234`) —
ha az egyik nem fut, automatikusan a másikra vált (auto-fallback).

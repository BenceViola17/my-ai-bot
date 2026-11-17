# MyAI Bot — Fejlesztési terv (v2 — TELJESEN LOKÁLIS, API kulcs NÉLKÜL)

Egy saját, **a gépeden futó** AI asszisztens: Node.js core + CLI + lokális API szerver + VSCode extension.
**Nem kell API kulcs, nem kell fiók, nem kell internet** — a modell a saját gépeden fut.

## Hogyan lehetséges AI kulcsok nélkül?
- **Ollama** motor: ingyenes, nyílt forrású, a modelljeidet (Llama 3.2, Qwen2.5, Phi-3.5, DeepSeek-R1, stb.)
  a gépeden futtatja. Ez a MyAI agya.
- A MyAI Bot **OpenAI-kompatibilis lokális API-t** nyit (`http://localhost:4141/v1`), így bármelyik
  kliens (VSCode extension, Continue, Cursor, curl) ráköthető, mintha ChatGPT volna.
- Opcionális (kikapcsolható): más szolgáltatók hozzáadása, ha egyszer mégis szeretnél felhőt.

## Architektúra

```
my-ai-bot/
├─ package.json
├─ config/
│   └─ providers.json      # lokális motorok + opcionális felhő-szolgáltatók (disabled)
├─ src/
│   ├─ index.js            # belépési pont (CLI / szerver mód)
│   ├─ core/
│   │   ├─ engine.js       # router + fallback + streaming
│   │   ├─ providers/
│   │   │   ├─ base.js
│   │   │   ├─ openai.js   # OpenAI-kompatibilis (Ollama, llama.cpp, LM Studio)
│   │   │   ├─ ollama.js   # Ollama natív adapter + modellkezelés (pull/list)
│   │   │   └─ index.js    # registry
│   │   ├─ conversation.js # memória, session perzisztencia (.myai/)
│   │   ├─ rag.js          # embeddings + chunking + keresés (lokális, nomic-embed)
│   │   └─ tools.js        # tool-use / function calling keret
│   ├─ server/
│   │   └─ http.js         # REST + SSE, OpenAI-kompatibilis /v1/chat/completions
│   ├─ cli/
│   │   ├─ cli.js          # parancsok: ask, chat, models, pull, serve, index, ask-docs
│   │   └─ repl.js         # interaktív chat mód
│   └─ util/logger.js
├─ vscode-extension/
│   ├─ package.json
│   └─ extension.js        # chat panel + kijelölés-műveletek, a lokális szerverhez csatlakozik
└─ README.md
```

## Lokális modellek (alap, kulcs nélkül)
| Modell | Méret | Mire jó |
|---|---|---|
| llama3.2 (3B) | ~2 GB | általános chat, gyors |
| llama3.1 (8B) | ~5 GB | okosabb válaszok |
| qwen2.5-coder | ~4.7 GB | **kód, refaktorálás** |
| deepseek-r1 | ~4.7 GB | érvelés, reasoning |
| phi3.5 | ~2.2 GB | könnyű, gyors |
| nomic-embed-text | ~0.3 GB | RAG embeddings |

## Fejlett funkciók
1. **Auto-fallback**: ha az elsődleges lokális motor nem fut, a következőre vált (ollama → llama.cpp → LM Studio).
2. **Streaming** mindenhol: CLI-ben élő gépelés, API-ban SSE.
3. **OpenAI-kompatibilis lokális API** — bármelyik OpenAI-kliensnek beköthető.
4. **Konvergencia-memória** (.myai/sessions/), session váltás, törlés.
5. **RAG**: `myai index <mappa>` → chunkolás + embeddings (nomic-embed-text) → `myai ask-docs "kérdés"` a saját fájljaidból válaszol.
6. **Modellkezelés**: `myai models` (listázás), `myai pull <modell>` (letöltés), `myai doctor` (egészségellenőrzés).
7. **Tool use** keretrendszer a későbbi bővítéshez.

## Implementációs sorrend
1. Konfigok: providers.json (lokális-first), .env.example csökkentve
2. Provider adapterek: Ollama natív + OpenAI-kompatibilis (llama.cpp / LM Studio)
3. Engine (routing, fallback, streaming), Conversation
4. CLI (ask, chat, models, pull, doctor, index, ask-docs) és HTTP szerver (REST + SSE)
5. RAG modul
6. VSCode extension
7. Telepítés, Ollama setup, modell pull, smoke-teszt

## Használat
```powershell
npm install
myai doctor          # Ollama fut? Modell megvan?
myai pull llama3.2   # ha még nincs modell
myai "mi a fibonacci?"   # egyedi kérdés
myai chat            # interaktív
myai serve           # szerver (VSCode extension ehhez csatlakozik)
myai index .         # RAG indexelés
myai ask-docs "mi a projektben?"   # RAG kérdés
```

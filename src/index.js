#!/usr/bin/env node
/** MyAI Bot — belépési pont. API kulcs nélkül, teljesen lokális (Ollama alapú). */
require('dotenv').config();

const cli = require('./cli/cli');

const [, , cmd, ...args] = process.argv;
const question = args.join(' ') || (cmd && !['chat', 'serve', 'doctor', 'models', 'pull', 'index', 'ask-docs', 'selftest', 'identity', 'memory', 'help'].includes(cmd) ? [cmd, ...args].join(' ') : '');

async function main() {
  const { Engine } = require('./core/engine');

  switch (cmd) {
    case undefined:
    case 'help':
      console.log(`
MyAI Bot — saját lokális AI asszisztens (API kulcs nélkül)

Parancsok:
  myai "kérdés"          egyszeri kérdés (streaming válasz)
  myai chat              interaktív beszélgetés (REPL)
  myai serve             lokális szerver indítása (OpenAI-kompatibilis API, port ${process.env.MYAI_PORT || 4141})
  myai doctor            motorok és modellek ellenőrzése
  myai models            elérhető modellek listázása
  myai pull <modell>     modell letöltése (pl. llama3.2, qwen2.5-coder)
  myai index [mappa]     projekt indexelése RAG-hez
  myai ask-docs "kérdés" kérdés a saját fájljaidról (RAG)
  myai selftest          gyors diagnosztika

Első futtatás:
  1) Telepítsd az Ollamát: https://ollama.com/download
  2) myai pull llama3.2
  3) myai "szia!"
`);
      break;
    case 'chat':
      await cli.repl(new Engine());
      break;
    case 'serve': {
      const { startServer } = require('./server/http');
      await startServer();
      break;
    }
    case 'doctor': await cli.doctor(); break;
    case 'models': await cli.models(); break;
    case 'pull': await cli.pull(args[0] || 'llama3.2'); break;
    case 'index': await cli.index(args[0] || '.'); break;
    case 'ask-docs': await cli.askDocs(args.join(' ')); break;
    case 'selftest': await cli.selftest(); break;
    case 'identity': await cli.identityCmd(); break;
    case 'memory': await cli.memoryCmd(args); break;
    default: {
      if (!question) { console.log('Kérdés hiányzik. Használat: myai "kérdés"'); process.exit(1); }
  const engine = new Engine();
  engine.learn(question);
  await cli.ask(engine, question);
}
  }
}

main().catch((e) => {
  console.error('Hiba:', e.message);
  process.exit(1);
});

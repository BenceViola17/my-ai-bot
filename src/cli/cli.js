/** CLI parancsok: ask, chat, models, pull, doctor, index, ask-docs, serve, selftest. */
const chalk = require('chalk');
const ora = require('ora');
const { Engine } = require('../core/engine');
const { Conversation } = require('../core/conversation');
const { Rag } = require('../core/rag');
const logger = require('../util/logger');

async function ask(engine, question, opts = {}) {
  let full = '';
  for await (const t of engine.chatStream([{ role: 'user', content: question }], opts)) {
    full += t;
    process.stdout.write(t);
  }
  console.log('\n');
  return full;
}

async function repl(engine) {
  const conv = new Conversation();
  console.log(chalk.cyan('MyAI interaktív mód — üres sor/barat: /exit, /new, /sessions, /clear\n'));
  const inquirer = require('inquirer');
  while (true) {
    const { q } = await inquirer.prompt([{ type: 'input', name: 'q', message: chalk.blue('te>'), prefix: '' }]);
    const cmd = q.trim();
    if (!cmd) continue;
    if (cmd === '/exit' || cmd === '/q') break;
    if (cmd === '/new') { conv.clear(); console.log(chalk.gray('Új session.')); continue; }
    if (cmd === '/clear') { conv.clear(); continue; }
    if (cmd === '/sessions') { console.log(conv.list()); continue; }
    conv.add('user', cmd);
    process.stdout.write(chalk.green('MyAI> '));
    let full = '';
    for await (const t of engine.chatStream(conv.history())) { full += t; process.stdout.write(t); }
    console.log('\n');
    conv.add('assistant', full);
  }
}

async function doctor() {
  const engine = new Engine();
  const spinner = ora('Motorok ellenőrzése...').start();
  const results = [];
  for (const p of engine.providers) {
    const alive = await p.isAlive();
    results.push({ id: p.id, alive });
    spinner.stop();
    console.log(alive ? chalk.green(`  ✔ ${p.id} — fut`) : chalk.red(`  ✖ ${p.id} — nem elérhető`));
    if (p.id === 'ollama' && alive) {
      try {
        const models = await p.listModels();
        if (models.length) {
          console.log(chalk.gray('    Modellek: ' + models.join(', ')));
          if (!models.some((m) => m.startsWith('llama3.2'))) {
            console.log(chalk.yellow('    Tipp: `myai pull llama3.2` a fő modellhez'));
          }
        } else {
          console.log(chalk.yellow('    Nincs modell! Futtasd: `myai pull llama3.2`'));
        }
      } catch { /* ignore */ }
    }
  }
  spinner.stop();
  if (!results.some((r) => r.alive)) {
    console.log(chalk.red('\nNincs futó lokális motor!'));
    console.log(chalk.yellow('Telepítsd az Ollamát: https://ollama.com/download, majd: `ollama serve`'));
  }
}

async function pull(model) {
  const engine = new Engine();
  const ollama = engine.providers.find((p) => p.id === 'ollama');
  if (!ollama) { logger.error('Ollama provider nem elérhető'); return; }
  logger.info(`Letöltés: ${model} (ez percekig tarthat)...`);
  await ollama.pullModel(model, (j) => {
    if (j.status) process.stdout.write(`\r${j.status}${j.completed ? ` ${Math.round(j.completed / j.total * 100)}%` : ''}   `);
  });
  console.log('\n');
  logger.ok(`${model} kész`);
}

async function models() {
  const engine = new Engine();
  const all = await engine.listModels();
  for (const [p, ms] of Object.entries(all)) {
    console.log(chalk.cyan(`\n${p}:`));
    if (!ms.length) console.log(chalk.gray('  (nincs modell)'));
    for (const m of ms) console.log(`  - ${m}`);
  }
}

async function index(folder) {
  const rag = new Rag();
  let count = 0;
  const n = await rag.indexFolder(folder || '.', (f) => {
    process.stdout.write(`\r${chalk.gray('Indexelés:')} ${f.slice(0, 80)}${' '.repeat(10)}`);
    count++;
  });
  console.log('\n');
  logger.ok(`${n} fájl indexelve (chunkok: ${rag.index.chunks.length})`);
}

async function askDocs(question) {
  const rag = new Rag();
  logger.info('Keresés az indexben...');
  await rag.askDocs(question, (t) => process.stdout.write(t));
  console.log('\n');
}

async function selftest() {
  const engine = new Engine();
  const alive = engine.providers.filter((p) => p.isAlive());
  logger.info(`Identitás: ${engine.identity.name} (${engine.identity.botId})`);
  logger.info(`Saját API kulcs: ${engine.identity.apiKey.slice(0, 12)}...`);
  logger.info(`Hosszú távú memória: ${engine.memory.stats().facts} tény (${engine.memory.stats().file})`);
  logger.info(`Provider-ek: ${alive.map((p) => p.id).join(', ') || 'NINCS'}`);
  for (const p of alive) {
    const ok = await p.isAlive();
    logger.info(`${p.id}: ${ok ? 'él' : 'halott'}`);
  }
  console.log(chalk.green('Selftest kész.'));
}

async function identityCmd() {
  const { identity, IDENTITY_FILE } = require('../core/identity');
  console.log(chalk.cyan('MyAI identitás:'));
  console.log(`  Név:      ${identity.name}`);
  console.log(`  Bot ID:   ${identity.botId}`);
  console.log(`  API kulcs: ${identity.apiKey}`);
  console.log(`  Gép:      ${identity.machine} / ${identity.user}`);
  console.log(`  Létrehozva: ${identity.createdAt}`);
  console.log(chalk.gray(`  Fájl: ${IDENTITY_FILE}`));
}

async function memoryCmd(args) {
  const engine = new Engine();
  const sub = args[0];
  if (sub === 'clear') { engine.memory.clear(); logger.ok('Memória törölve.'); return; }
  const s = engine.memory.stats();
  console.log(chalk.cyan(`Hosszú távú memória: ${s.facts} tény`));
  console.log(chalk.gray(`Fájl: ${s.file}`));
}

module.exports = { ask, repl, doctor, pull, models, index, askDocs, selftest, identityCmd, memoryCmd };

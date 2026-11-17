/** Tool-use keretrendszer: saját, lokálisan futtatható eszközök regisztrálása. */
const fs = require('fs');
const path = require('path');

const tools = new Map();

function register(name, description, parameters, fn) {
  tools.set(name, { name, description, parameters, fn });
}

// Beépített eszközök
register('read_file', 'Fájl tartalmának olvasása', { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  (args) => fs.readFileSync(path.resolve(args.path), 'utf8').slice(0, 20000));

register('list_dir', 'Mappa tartalmának listázása', { type: 'object', properties: { path: { type: 'string', default: '.' } }, required: [] },
  (args) => fs.readdirSync(path.resolve(args.path || '.')).join('\n'));

register('write_file', 'Fájl írása', { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  (args) => { fs.writeFileSync(path.resolve(args.path), args.content); return 'OK'; });

register('run_command', 'Parancs futtatása (PowerShell)', { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  (args) => require('child_process').execSync(args.command, { encoding: 'utf8', timeout: 30000 }).slice(0, 10000));

function toolSchemas() {
  return [...tools.values()].map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function execute(name, args) {
  const t = tools.get(name);
  if (!t) throw new Error(`Ismeretlen eszköz: ${name}`);
  return t.fn(args || {});
}

module.exports = { register, toolSchemas, execute, tools };

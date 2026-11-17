const chalk = require('chalk');
const debug = process.env.MYAI_DEBUG === '1' || process.env.MYAI_DEBUG === 'true';

function ts() {
  return new Date().toLocaleTimeString('hu-HU', { hour12: false });
}

module.exports = {
  info: (...a) => console.log(chalk.blue(`[${ts()}]`), ...a),
  ok: (...a) => console.log(chalk.green(`[${ts()}] ✔`), ...a),
  warn: (...a) => console.log(chalk.yellow(`[${ts()}] ⚠`), ...a),
  error: (...a) => console.error(chalk.red(`[${ts()}] ✖`), ...a),
  debug: (...a) => { if (debug) console.log(chalk.gray(`[${ts()}] DEBUG`), ...a); },
  setDebug: (v) => { process.env.MYAI_DEBUG = v ? '1' : '0'; },
};

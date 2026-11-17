/** Provider registry: betölti a providers.json-t és példányosítja az adaptereket. */
const path = require('path');
const fs = require('fs');
const logger = require('../../util/logger');

const CONFIG_PATH = path.join(__dirname, '../../../config/providers.json');

const TYPES = {
  ollama: () => require('./ollama'),
  openai: () => require('./openai'),
};

const PROVIDER_CLASS_IDS = { ollama: 'ollama' };

function loadProviders(configPath = CONFIG_PATH) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const providers = [];
  for (const p of cfg.providers) {
    if (!p.enabled) continue;
    const Factory = (TYPES[p.type] || TYPES.openai)();
    const Cls = PROVIDER_CLASS_IDS[p.id] === 'ollama' ? Factory : Factory;
    const instance = new Cls(p, p.id);
    if (instance.isAvailable()) {
      providers.push(instance);
    } else {
      logger.debug(`Provider ${p.id} kihagyva (nincs API kulcs / nem engedélyezett)`);
    }
  }
  return { providers, config: cfg };
}

module.exports = { loadProviders };

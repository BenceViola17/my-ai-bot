/** Parallel router: egy kérdés -> több modell PÁRHUZAMOSAN (Omniroute-szerű). */
const { Engine } = require('./engine');
const logger = require('../util/logger');

class ParallelRouter {
  constructor() {
    this.engine = new Engine();
  }

  /** Egy kérdés párhuzamos elküldése több (provider, model) párosnak. */
  async askAll(question, targets, onModelDelta) {
    const messages = [{ role: 'user', content: question }];
    const jobs = targets.map(async (t) => {
      const started = Date.now();
      let full = '';
      try {
        for await (const chunk of this.engine.chatStream(messages, { model: t.model })) {
          full += chunk;
          if (onModelDelta) onModelDelta(t.key, chunk);
        }
        return { key: t.key, provider: t.provider, model: t.model, ok: true, content: full, ms: Date.now() - started };
      } catch (e) {
        logger.warn(`[${t.key}] hiba: ${e.message}`);
        return { key: t.key, provider: t.provider, model: t.model, ok: false, error: e.message, ms: Date.now() - started };
      }
    });
    return Promise.all(jobs);
  }

  /** Automatikus target lista: az összes elérhető Ollama modell. */
  async autoTargets(models) {
    const list = models && models.length ? models : ['llama3.2'];
    return list.map((m) => ({ key: `ollama/${m}`, provider: 'ollama', model: m }));
  }
}

module.exports = { ParallelRouter };

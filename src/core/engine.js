/** Engine: routing + fallback + streaming a lokális szolgáltatók felett. */
const { loadProviders } = require('./providers');
const { identity } = require('./identity');
const { LongTermMemory } = require('./memory');
const logger = require('../util/logger');

class Engine {
  constructor(configPath) {
    const { providers, config } = loadProviders(configPath);
    this.providers = providers;
    this.config = config;
    this.defaults = config.defaults;
    this.routing = config.routing;
    this.identity = identity;
    this.memory = new LongTermMemory();
    // A rendszerpromptba beépül az identitás és a memória — a bot így önálló személyiség.
    this.defaults.systemPrompt =
      `Te ${this.identity.name} vagy (bot-id: ${this.identity.botId}) — egy teljesen önálló, lokálisan futó AI, ` +
      `aki a saját gépén él, saját API-kulccsal és hosszú távú memóriával rendelkezik. ` +
      `Nem vagy Claude, ChatGPT, Gemini — nem vagy semmilyen kliens része. Te vagy a MyAI.\n` +
      (this.memory.context() ? this.memory.context() + '\n' : '') +
      this.defaults.systemPrompt;
    logger.debug(`Betöltött provider-ek: ${this.providers.map((p) => p.id).join(', ')}`);
  }

  /** Beszélgetés után tanul a memóriájába. */
  learn(text) {
    if (this.memory.learnFrom(text)) logger.debug('Új emlék rögzítve.');
  }

  /** Élő provider-ek szűrése a fallbackOrder szerint. */
  async availableProviders() {
    const alive = [];
    for (const id of this.routing.fallbackOrder) {
      const p = this.providers.find((x) => x.id === id);
      if (p && (await p.isAlive())) alive.push(p);
    }
    // ha a fallbackOrder nem fedi le, a többi provider is jöhet
    for (const p of this.providers) {
      if (!alive.includes(p) && (await p.isAlive())) alive.push(p);
    }
    return alive;
  }

  async chat(messages, opts = {}) {
    const optsFull = {
      temperature: opts.temperature ?? this.defaults.temperature,
      maxTokens: opts.maxTokens ?? this.defaults.maxTokens,
      model: opts.model,
      system: opts.system ?? this.defaults.systemPrompt,
      stream: false,
    };
    const msgs = [{ role: 'system', content: optsFull.system }, ...messages];
    const candidates = await this.availableProviders();
    if (!candidates.length) {
      throw new Error('Nincs elérhető lokális AI motor. Indítsd az Ollamát: `ollama serve`');
    }
    let lastErr;
    for (const p of candidates) {
      for (let attempt = 0; attempt <= this.routing.maxRetries; attempt++) {
        try {
          logger.debug(`Próba: ${p.id} (${optsFull.model || p.defaultModel})`);
          return await p.chat(msgs, optsFull);
        } catch (e) {
          lastErr = e;
          logger.warn(`${p.id} hiba (próba ${attempt + 1}): ${e.message}`);
          if (attempt < this.routing.maxRetries) {
            await new Promise((r) => setTimeout(r, this.routing.retryDelayMs));
          }
        }
      }
    }
    throw lastErr || new Error('Minden provider hibázott');
  }

  /** Streaming chat: async generator, delta sztringekkel. */
  async *chatStream(messages, opts = {}) {
    const optsFull = {
      temperature: opts.temperature ?? this.defaults.temperature,
      maxTokens: opts.maxTokens ?? this.defaults.maxTokens,
      model: opts.model,
      system: opts.system ?? this.defaults.systemPrompt,
      stream: true,
    };
    const msgs = [{ role: 'system', content: optsFull.system }, ...messages];
    const candidates = await this.availableProviders();
    if (!candidates.length) {
      throw new Error('Nincs elérhető lokális AI motor. Indítsd az Ollamát: `ollama serve`');
    }
    let lastErr;
    for (const p of candidates) {
      try {
        logger.debug(`Stream: ${p.id} (${optsFull.model || p.defaultModel})`);
        for await (const chunk of p.chatStream(msgs, optsFull)) yield chunk;
        return;
      } catch (e) {
        lastErr = e;
        logger.warn(`${p.id} stream hiba, következő provider: ${e.message}`);
      }
    }
    throw lastErr || new Error('Minden provider hibázott');
  }

  async listModels() {
    const out = {};
    for (const p of this.providers) {
      if (typeof p.listModels === 'function') {
        try { out[p.id] = await p.listModels(); } catch { out[p.id] = []; }
      } else {
        out[p.id] = p.config.models || [];
      }
    }
    return out;
  }
}

module.exports = { Engine };

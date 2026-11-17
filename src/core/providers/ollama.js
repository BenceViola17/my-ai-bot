/** Ollama natív adapter — lokális, API kulcs nélkül. Modellkezelés (pull/list), embeddings, chat. */
const BaseProvider = require('./base');

class OllamaProvider extends BaseProvider {
  constructor(config, id) {
    super(config, id);
    // base.js a baseUrl-ra számít; a configban ez a root (pl. http://localhost:11434)
  }

  /** Natív Ollama API: /api/chat (root, nem /v1). */
  chatUrl() { return `${this.baseUrl}/api/chat`; }

  buildBody(messages, opts) {
    return {
      model: opts.model || this.defaultModel,
      messages,
      stream: !!opts.stream,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 4096,
      },
    };
  }

  async chat(messages, opts = {}) {
    const data = await this.fetchJson(this.chatUrl(), this.buildBody(messages, { ...opts, stream: false }));
    return {
      content: (data.message && data.message.content) || '',
      model: data.model || opts.model,
      provider: this.id,
      usage: data.eval_count ? { total_tokens: data.eval_count } : null,
      raw: data,
    };
  }

  async *chatStream(messages, opts = {}) {
    // Ollama natív stream: ndjson sorok, nem SSE
    for await (const line of this.streamLines(this.chatUrl(), this.buildBody(messages, { ...opts, stream: true }))) {
      try {
        const json = JSON.parse(line);
        if (json.message && json.message.content) yield json.message.content;
        if (json.done) return;
      } catch { /* ignore */ }
    }
  }

  async listModels() {
    const data = await this.fetchJson(`${this.baseUrl}/api/tags`, null, 'GET');
    return (data.models || []).map((m) => m.name);
  }

  /** Modell letöltése (hosszú művelet — progress callback). */
  async pullModel(model, onProgress) {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
    });
    if (!res.ok) throw new Error(`Ollama pull HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const j = JSON.parse(t);
          if (onProgress) onProgress(j);
        } catch { /* ignore */ }
      }
    }
  }

  async embed(input, model) {
    const data = await this.fetchJson(`${this.baseUrl}/api/embeddings`, {
      model: model || this.config.embedModel || 'nomic-embed-text',
      prompt: input,
    });
    return data.embedding || [];
  }

  async isAlive() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

module.exports = OllamaProvider;

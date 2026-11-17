/**
 * BaseProvider — minden szolgáltató adaptere ebből származik.
 * Két fő metódus:
 *   chat(messages, opts) -> { content, model, usage, provider }
 *   chatStream(messages, opts) -> async generator (delta sztringek)
 */
const logger = require('../../util/logger');

class BaseProvider {
  constructor(config, providerId) {
    this.config = config;
    this.id = providerId;
    this.apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : null;
    this.baseUrl = (config.baseUrl || '').replace(/\/$/, '');
    this.defaultModel = config.defaultModel;
    this.supports = config.supports || {};
  }

  isAvailable() {
    // Ollama-nak nem kell kulcs
    if (!this.config.apiKeyEnv) return true;
    return !!this.apiKey;
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
    return Object.assign(h, this.config.headers || {});
  }

  async fetchJson(url, body, method = 'POST') {
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`${this.id} HTTP ${res.status}: ${text.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /** SSE / ndjson stream parser: async iterátor a raw szöveg chunkok felett. */
  async *streamLines(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`${this.id} HTTP ${res.status}: ${text.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }
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
        if (t) yield t;
      }
    }
    if (buf.trim()) yield buf.trim();
  }

  /** Ollama healthcheck: fut-e a lokális szerver? */
  async isAlive() {
    if (!this.isAvailable()) return false;
    try {
      const res = await fetch(this.baseUrl, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

module.exports = BaseProvider;

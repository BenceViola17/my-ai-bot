/** OpenAI-kompatibilis adapter: OpenAI, Groq, DeepSeek, OpenRouter, Together, HuggingFace, Ollama. */
const BaseProvider = require('./base');

class OpenAICompatProvider extends BaseProvider {
  chatUrl() { return `${this.baseUrl}/chat/completions`; }

  buildBody(messages, opts) {
    return {
      model: opts.model || this.defaultModel,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      stream: !!opts.stream,
    };
  }

  async chat(messages, opts = {}) {
    const data = await this.fetchJson(this.chatUrl(), this.buildBody(messages, { ...opts, stream: false }));
    const choice = data.choices && data.choices[0];
    return {
      content: choice ? (choice.message.content || '') : '',
      model: data.model || opts.model,
      provider: this.id,
      usage: data.usage || null,
      raw: data,
    };
  }

  async *chatStream(messages, opts = {}) {
    for await (const line of this.streamLines(this.chatUrl(), this.buildBody(messages, { ...opts, stream: true }))) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        if (delta && delta.content) yield delta.content;
      } catch { /* ignore malformed chunk */ }
    }
  }
}

module.exports = OpenAICompatProvider;

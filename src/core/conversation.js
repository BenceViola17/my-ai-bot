/** Konvergencia-memória: session perzisztencia a .myai/sessions/ mappában. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const nanoid = require('nanoid');

const SESSIONS_DIR = path.join(process.cwd(), '.myai', 'sessions');

class Conversation {
  constructor(sessionId) {
    this.sessionId = sessionId || nanoid.nanoid(8);
    this.messages = [];
    this.limit = 40;
    this._load();
  }

  dir() { return SESSIONS_DIR; }
  file() { return path.join(SESSIONS_DIR, `${this.sessionId}.json`); }

  _load() {
    try {
      if (fs.existsSync(this.file())) {
        const data = JSON.parse(fs.readFileSync(this.file(), 'utf8'));
        this.messages = data.messages || [];
      }
    } catch { /* ignore */ }
  }

  save() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify({
      sessionId: this.sessionId,
      updatedAt: new Date().toISOString(),
      messages: this.messages,
    }, null, 2));
  }

  add(role, content) {
    this.messages.push({ role, content, ts: Date.now() });
    if (this.messages.length > this.limit) this.messages = this.messages.slice(-this.limit);
    this.save();
  }

  history() {
    return this.messages.map((m) => ({ role: m.role, content: m.content }));
  }

  list() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    return fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')).map((f) => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
        return { id: d.sessionId, updatedAt: d.updatedAt, count: (d.messages || []).length };
      } catch { return null; }
    }).filter(Boolean);
  }

  clear() {
    this.messages = [];
    this.save();
  }
}

module.exports = { Conversation, SESSIONS_DIR };

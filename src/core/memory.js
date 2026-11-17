/**
 * Long-term memory — a bot hosszú távú emlékezete (fájlokban, ~/.myai/memory/).
 * - Tények, preferenciák, fontos információk automatikus kinyerése a beszélgetésekből
 * - A jövőbeli beszélgetésekbe kontextusként beépül
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { identity } = require('./identity');

const MEM_DIR = identity.memoryPath || path.join(os.homedir(), '.myai', 'memory');
const MEM_FILE = path.join(MEM_DIR, 'longterm.json');

class LongTermMemory {
  constructor() {
    this.data = { facts: [], preferences: {}, updatedAt: null };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(MEM_FILE)) this.data = JSON.parse(fs.readFileSync(MEM_FILE, 'utf8'));
    } catch { /* ignore */ }
  }

  save() {
    fs.mkdirSync(MEM_DIR, { recursive: true });
    this.data.updatedAt = new Date().toISOString();
    fs.writeFileSync(MEM_FILE, JSON.stringify(this.data, null, 2));
  }

  /** Egyszerű tény-kinyerés: "a nevem X", "kedvelem Y", "mindig Z" minták. */
  learnFrom(text) {
    const t = text.toLowerCase();
    let learned = false;
    const nameMatch = text.match(/a nevem ([^\s,.!]+)/i) || text.match(/([^\s,.!]+) vagyok/i);
    if (nameMatch) {
      this.data.facts.push({ type: 'name', value: nameMatch[1], ts: Date.now() });
      learned = true;
    }
    const prefMatch = text.match(/kedvelem? ([^.!?\n]+)/i);
    if (prefMatch) {
      this.data.facts.push({ type: 'preference', value: prefMatch[1].trim(), ts: Date.now() });
      learned = true;
    }
    const alwaysMatch = text.match(/mindig ([^.!?\n]+)/i);
    if (alwaysMatch) {
      this.data.facts.push({ type: 'rule', value: 'mindig ' + alwaysMatch[1].trim(), ts: Date.now() });
      learned = true;
    }
    if (learned) this.save();
    return learned;
  }

  /** Kontextus a beszélgetéshez (max utolsó 10 tény). */
  context() {
    const facts = this.data.facts.slice(-10).map((f) => `- ${f.type}: ${f.value}`);
    return facts.length ? `Amit a felhasználóról tudsz (hosszú távú memória):\n${facts.join('\n')}` : '';
  }

  stats() {
    return { facts: this.data.facts.length, updatedAt: this.data.updatedAt, file: MEM_FILE };
  }

  clear() {
    this.data = { facts: [], preferences: {}, updatedAt: null };
    this.save();
  }
}

module.exports = { LongTermMemory, MEM_DIR };

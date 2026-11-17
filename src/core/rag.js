/** RAG: fájlindexelés chunkolással + embeddings, koszinusz-keresés. Lokális, nomic-embed-text. */
const fs = require('fs');
const path = require('path');
const { Engine } = require('./engine');

const INDEX_FILE = path.join(process.cwd(), '.myai', 'rag-index.json');

const SKIP_DIRS = new Set(['node_modules', '.git', '.myai', 'dist', 'build', '.vscode', 'out', '__pycache__']);
const TEXT_EXT = new Set(['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.py', '.cs', '.cpp', '.h', '.java', '.go', '.rs', '.html', '.css', '.yml', '.yaml', '.sql', '.sh', '.ps1', '.php']);

function chunkText(text, size = 1200, overlap = 150) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter((c) => c.trim());
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

class Rag {
  constructor() {
    this.engine = new Engine();
    this.ollama = this.engine.providers.find((p) => p.id === 'ollama');
    this.index = { files: {}, chunks: [] };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(INDEX_FILE)) this.index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    } catch { /* ignore */ }
  }

  save() {
    fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(this.index));
  }

  async indexFolder(folder, onProgress) {
    if (!this.ollama) throw new Error('RAG-hez Ollama kell (nomic-embed-text modell: `myai pull nomic-embed-text`)');
    const abs = path.resolve(folder);
    const files = [];

    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
        if (TEXT_EXT.has(path.extname(e.name).toLowerCase())) files.push(path.join(dir, e.name));
      }
    })(abs);

    for (const f of files) {
      if (onProgress) onProgress(f);
      const rel = path.relative(abs, f);
      const content = fs.readFileSync(f, 'utf8').slice(0, 200000);
      const stat = fs.statSync(f);
      const sig = `${stat.mtimeMs}:${content.length}`;
      if (this.index.files[rel] === sig) continue; // változatlan

      const chunks = chunkText(content);
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.ollama.embed(chunks[i]);
        this.index.chunks.push({ file: rel, chunk: i, text: chunks[i].slice(0, 400), embedding, folder: abs });
      }
      this.index.files[rel] = sig;
      this.save();
    }
    return files.length;
  }

  async search(query, topK = 5) {
    if (!this.ollama) throw new Error('RAG-hez Ollama kell');
    if (!this.index.chunks.length) return [];
    const qv = await this.ollama.embed(query);
    const scored = this.index.chunks
      .map((c) => ({ ...c, score: cosine(qv, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }

  /** Kérdés a dokumentumokra: RAG kontextus + válasz. */
  async askDocs(question, onToken) {
    const hits = await this.search(question, 5);
    const context = hits.map((h, i) => `[${i + 1}] ${h.file}:\n${h.text}`).join('\n\n');
    const prompt = `Az alábbi dokumentum-részletek alapján válaszolj. Ha nincs benne a válasz, mondd meg.\n\n${context}\n\nKérdés: ${question}`;
    if (onToken) {
      let full = '';
      for await (const t of this.engine.chatStream([{ role: 'user', content: prompt }])) {
        full += t; onToken(t);
      }
      return full;
    }
    const r = await this.engine.chat([{ role: 'user', content: prompt }]);
    return r.content;
  }
}

module.exports = { Rag, chunkText, cosine };

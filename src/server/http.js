/** OpenAI-kompatibilis lokális HTTP szerver: REST + SSE. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Engine } = require('../core/engine');
const { ParallelRouter } = require('../core/parallel');
const { Conversation } = require('../core/conversation');
const logger = require('../util/logger');

const PORT = parseInt(process.env.MYAI_PORT || '4141', 10);
const UI_DIR = path.join(__dirname, '../../ui');

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function startServer() {
  const engine = new Engine();
  logger.info(`MyAI szerver indul: http://localhost:${PORT}`);
  logger.info('OpenAI-kompatibilis endpoint: /v1/chat/completions (SSE streaming támogatással)');

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    try {
      if (req.method === 'GET' && url === '/health') {
        const alive = [];
        for (const p of engine.providers) alive.push({ id: p.id, alive: await p.isAlive() });
        return sendJson(res, 200, { status: 'ok', providers: alive });
      }

      if (req.method === 'GET' && url === '/v1/models') {
        const models = await engine.listModels();
        return sendJson(res, 200, { object: 'list', data: Object.entries(models).flatMap(([p, ms]) => ms.map((m) => ({ id: m, object: 'model', owned_by: p }))) });
      }

      if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat')) {
        const body = await readBody(req);
        const messages = body.messages || [{ role: 'user', content: body.prompt || '' }];
        const stream = !!body.stream;

        if (!stream) {
          const r = await engine.chat(messages, { model: body.model });
          return sendJson(res, 200, {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            model: r.model,
            choices: [{ index: 0, message: { role: 'assistant', content: r.content }, finish_reason: 'stop' }],
            usage: r.usage || {},
          });
        }

        // SSE streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        try {
          for await (const chunk of engine.chatStream(messages, { model: body.model })) {
            const payload = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
        } catch (e) {
          logger.error('Stream hiba:', e.message);
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      if (req.method === 'POST' && url === '/v1/parallel') {
        // Omniroute-szerű párhuzamos futtatás: több modell egyszerre válaszol (SSE-vel, modellenként)
        const body = await readBody(req);
        const question = body.question || body.prompt || '';
        const router = new ParallelRouter();
        const ollama = engine.providers.find((p) => p.id === 'ollama');
        let available = [];
        try { available = ollama ? await ollama.listModels() : []; } catch { /* ignore */ }
        const wanted = (body.models || []).map((m) => m.replace(/^ollama\//, ''));
        const models = wanted.length ? wanted.filter((m) => available.some((a) => a.startsWith(m))) : ['llama3.2'];
        const targets = models.map((m) => ({ key: `ollama/${m}`, provider: 'ollama', model: m }));

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify({ type: 'start', targets })}\n\n`);
        const results = await router.askAll(question, targets, (key, delta) => {
          res.write(`data: ${JSON.stringify({ type: 'delta', key, delta })}\n\n`);
        });
        for (const r of results) {
          res.write(`data: ${JSON.stringify({ type: 'done', ...r })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      if (req.method === 'GET' && (url === '/' || url === '/ui')) {
        const html = fs.readFileSync(path.join(UI_DIR, 'index.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      if (req.method === 'GET' && url.startsWith('/ui/')) {
        const file = path.join(UI_DIR, url.replace('/ui/', ''));
        if (fs.existsSync(file)) {
          const ext = path.extname(file);
          const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime });
          return res.end(fs.readFileSync(file));
        }
      }

      if (req.method === 'GET' && url === '/api') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h1>MyAI Bot API</h1><p>OpenAI-kompatibilis: <code>POST /v1/chat/completions</code> · Párhuzamos: <code>POST /v1/parallel</code></p>');
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (e) {
      logger.error('Kérés hiba:', e.message);
      sendJson(res, 500, { error: e.message });
    }
  });

  server.listen(PORT, '127.0.0.1');
  return server;
}

module.exports = { startServer };

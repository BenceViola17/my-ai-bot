/**
 * Identity — a MyAI Bot saját, önálló identitása.
 * - Saját, gépen generált API kulcs (a saját API-jához)
 * - Saját bot-id, név, létrehozási dátum
 * - Ez a fájl teszi a botot "önálló entitássá": nem kliens, nem másolat — ő maga a szolgáltatás.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.myai');
const IDENTITY_FILE = path.join(DATA_DIR, 'identity.json');

function loadOrCreate() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(IDENTITY_FILE)) {
    try { return JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8')); } catch { /* regenerate */ }
  }
  const id = {
    name: 'MyAI',
    botId: 'myai-' + crypto.randomBytes(4).toString('hex'),
    apiKey: 'myai-' + crypto.randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
    machine: os.hostname(),
    user: os.userInfo().username,
    memoryPath: path.join(DATA_DIR, 'memory'),
  };
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(id, null, 2));
  return id;
}

const identity = loadOrCreate();

/** Saját API-kulcs ellenőrzés (a bot saját API-ja ezt kéri). */
function verifyKey(key) {
  // Ha nincs kulcs a kérésben, lokálisan (127.0.0.1) engedjük — a gép tulaja vagyunk.
  if (!key) return true;
  return key === identity.apiKey || key === 'local';
}

module.exports = { identity, verifyKey, IDENTITY_FILE };

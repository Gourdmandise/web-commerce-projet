const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '.cache');
const DEFAULT_TTL_DAYS = Number(process.env.CACHE_TTL_DAYS || 30);

function ttlMs() {
  return Math.max(1, DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
}

function cacheKey(prefix, payload) {
  return crypto.createHash('sha256').update(`${prefix}:${JSON.stringify(payload)}`).digest('hex');
}

async function readCache(prefix, payload) {
  const key = cacheKey(prefix, payload);
  const filePath = path.join(CACHE_DIR, `${key}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.savedAt || 0) > ttlMs()) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

async function writeCache(prefix, payload, value) {
  const key = cacheKey(prefix, payload);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ savedAt: Date.now(), value }, null, 2));
}

module.exports = {
  readCache,
  writeCache,
};

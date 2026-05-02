/**
 * ローカル開発・テスト用APIアプリ
 * Vercelサーバーレス関数をExpressハンドラとして読み込む
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

const analyzeHandler = await import('./analyze.js');
const uaamHandler = await import('./uaam.js');
const historyHandler = await import('./history.js');

let adminHandlers = {};
let meHandlers = {};
try {
  const fs = await import('fs');
  const path = await import('path');
  const adminDir = path.resolve('./api/admin');
  if (fs.existsSync(adminDir)) {
    const files = fs.readdirSync(adminDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const name = file.replace('.js', '');
      const mod = await import(`./admin/${file}`);
      adminHandlers[name] = mod.default || mod;
    }
  }

  const apiRoot = path.resolve('./api');
  const meDir = path.resolve('./api/me');
  const loadMeHandlers = async (dir, routeParts = []) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await loadMeHandlers(fullPath, [...routeParts, entry.name]);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

      const filePart = entry.name.replace('.js', '');
      const routePath = [...routeParts, filePart]
        .map((part) => (part.startsWith('[') && part.endsWith(']') ? `:${part.slice(1, -1)}` : part))
        .join('/');
      const importPath = `./${path.relative(apiRoot, fullPath).split(path.sep).join('/')}`;
      const mod = await import(importPath);
      meHandlers[routePath] = mod.default || mod;
    }
  };

  if (fs.existsSync(meDir)) {
    await loadMeHandlers(meDir);
  }
} catch (e) {
  console.log('⚠ dynamic handlers not loaded:', e.message);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: process.env.MOCK_ANTHROPIC === '1' ? 'mock' : 'live' });
});

app.all('/api/analyze', (req, res) => {
  const handler = analyzeHandler.default || analyzeHandler;
  return handler(req, res);
});

app.all('/api/uaam', (req, res) => {
  const handler = uaamHandler.default || uaamHandler;
  return handler(req, res);
});

app.all('/api/history', (req, res) => {
  const handler = historyHandler.default || historyHandler;
  return handler(req, res);
});

for (const [name, handler] of Object.entries(adminHandlers)) {
  app.all(`/api/admin/${name}`, (req, res) => handler(req, res));
}

for (const [routePath, handler] of Object.entries(meHandlers)) {
  app.all(`/api/me/${routePath}`, (req, res) => {
    Object.defineProperty(req, 'query', {
      value: { ...req.query, ...req.params },
      configurable: true,
      writable: true,
    });
    return handler(req, res);
  });
}

export default app;

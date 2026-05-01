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

let adminHandlers = {};
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
} catch (e) {
  console.log('⚠ admin handlers not loaded:', e.message);
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

for (const [name, handler] of Object.entries(adminHandlers)) {
  app.all(`/api/admin/${name}`, (req, res) => handler(req, res));
}

export default app;

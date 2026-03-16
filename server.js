/**
 * ローカル開発用APIサーバー
 * Vercelサーバーレス関数をローカルで動かすためのExpressラッパー
 *
 * 起動方法: node server.js
 * → http://localhost:3001 でAPIが起動
 * → Vite dev server (localhost:5173) が /api/* をここにプロキシする
 */
import 'dotenv/config';
import express from 'express';
import { createRequire } from 'module';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Vercelサーバーレス関数をExpressハンドラとして読み込む
const analyzeHandler = await import('./api/analyze.js');
const uaamHandler = await import('./api/uaam.js');

// adminディレクトリのハンドラも読み込む（存在する場合）
let adminHandlers = {};
try {
  const fs = await import('fs');
  const path = await import('path');
  const adminDir = path.resolve('./api/admin');
  if (fs.existsSync(adminDir)) {
    const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const name = file.replace('.js', '');
      const mod = await import(`./api/admin/${file}`);
      adminHandlers[name] = mod.default || mod;
    }
  }
} catch (e) {
  console.log('⚠ admin handlers not loaded:', e.message);
}

// APIルート
app.all('/api/analyze', (req, res) => {
  const handler = analyzeHandler.default || analyzeHandler;
  return handler(req, res);
});

app.all('/api/uaam', (req, res) => {
  const handler = uaamHandler.default || uaamHandler;
  return handler(req, res);
});

// adminルート
for (const [name, handler] of Object.entries(adminHandlers)) {
  app.all(`/api/admin/${name}`, (req, res) => handler(req, res));
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅ ローカルAPIサーバー起動: http://localhost:${PORT}`);
  console.log('   /api/analyze  → 才覚領域分析');
  console.log('   /api/uaam     → 才覚発動領域診断');
  console.log(`\n💡 別ターミナルで npm run dev を実行して http://localhost:5173 にアクセス\n`);
});
